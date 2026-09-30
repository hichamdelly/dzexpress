// Suivi GPS temps réel du transporteur pendant une course "en_route".
//
// Deux mécanismes tournent en parallèle :
//
// 1. Poll GPS toutes les 10s (setInterval + getCurrentPositionAsync, premier
//    plan) — fonctionne dès aujourd'hui, y compris dans Expo Go, tant que
//    l'app est ouverte. C'est le chemin qui garantit que la fonctionnalité
//    marche pour tester/démontrer, même sur un appareil immobile.
//
// 2. startLocationUpdatesAsync + TaskManager (tâche d'arrière-plan avec
//    notification de service au premier plan) — pour que le suivi
//    continue si le transporteur verrouille l'écran ou change d'appli.
//    ⚠️ Ceci NE FONCTIONNE PAS dans Expo Go : les tâches de localisation
//    en arrière-plan nécessitent un build natif (dev client / EAS Build)
//    avec les permissions ACCESS_BACKGROUND_LOCATION + FOREGROUND_SERVICE
//    déjà déclarées dans app.json. Sous Expo Go, la tentative échoue
//    silencieusement (try/catch) et on continue avec le seul mécanisme 1.
//
// L'id de la demande suivie est stocké dans configDB (table config_app)
// plutôt que dans une variable de module, car la tâche d'arrière-plan
// s'exécute dans un contexte JS qui peut être relancé indépendamment de
// l'écran qui a démarré le suivi.

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { demandesDB, configDB } from '../db/database';

const LOCATION_TASK_NAME  = 'dzexpress-tracking-position';
const CONFIG_KEY_ACTIVE   = 'tracking_active_demande_id';

let pollIntervalId = null;

TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) return;
  const demandeId = parseInt(configDB.get(CONFIG_KEY_ACTIVE) || '', 10);
  const point = data?.locations?.[data.locations.length - 1];
  if (!demandeId || !point) return;
  try {
    demandesDB.updatePosition(demandeId, point.coords.latitude, point.coords.longitude);
  } catch (_) {}
});

/**
 * Démarre le suivi GPS pour une demande donnée. Idempotent : si un suivi
 * est déjà actif pour une autre demande, il est d'abord arrêté.
 */
export async function demarrerTrackingGPS(demandeId) {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return false;

  await arreterTrackingGPS();
  configDB.set(CONFIG_KEY_ACTIVE, String(demandeId));

  // Mécanisme 1 — premier plan, fonctionne partout (voir note en tête de fichier).
  // Un setInterval explicite plutôt qu'un watchPositionAsync : sur certains
  // appareils/émulateurs, un "watch" ne redéclenche pas fiablement son
  // callback toutes les 10s quand l'appareil est immobile (fréquent en
  // test). getCurrentPositionAsync à intervalle fixe garantit l'écriture
  // toutes les 10s, mouvement ou non.
  const pollOnce = async () => {
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      demandesDB.updatePosition(demandeId, pos.coords.latitude, pos.coords.longitude);
      console.log('Position sauvegardée:', pos.coords.latitude, pos.coords.longitude);
    } catch (_) {
      // GPS temporairement indisponible — on retentera au prochain tick.
    }
  };
  await pollOnce();
  pollIntervalId = setInterval(pollOnce, 10_000);

  // Mécanisme 2 — arrière-plan, best-effort (nécessite un build natif).
  try {
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status === 'granted') {
      await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10_000,
        distanceInterval: 0,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: 'DzExpress - Course en cours',
          notificationBody: "Votre position est partagée avec l'expéditeur",
        },
      });
    }
  } catch (_) {
    // Attendu sous Expo Go / sans build natif — le mécanisme 1 suffit.
  }

  return true;
}

/** Arrête le suivi GPS (les deux mécanismes), sans erreur si rien n'était actif. */
export async function arreterTrackingGPS() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
  try {
    const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
  } catch (_) {}
  configDB.set(CONFIG_KEY_ACTIVE, '');
}

/** Id de la demande actuellement suivie, ou `null`. */
export function demandeEnCoursDeSuivi() {
  const raw = configDB.get(CONFIG_KEY_ACTIVE);
  const id = parseInt(raw || '', 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}
