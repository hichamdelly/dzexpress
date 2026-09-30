// Distance commune-à-commune précise, avec cache SQLite local alimenté en
// tâche de fond (voir communeCoordsDB dans src/db/database.js).
//
// Le calcul par défaut de l'app (getDistanceKm dans src/utils/wilayas.js)
// réduit chaque ville à sa WILAYA et utilise le centre administratif de
// cette wilaya — correct en moyenne, mais très approximatif pour deux
// communes proches d'une frontière de wilaya. Exemple concret : Chakourane
// (Bouira) → Akbou (Béjaïa) affichait ~139 km (distance entre les centres
// des wilayas de Bouira et Béjaïa), alors que la distance réelle entre ces
// deux communes est d'environ 50 km.
//
// getDistanceKmPrecise() calcule la distance à partir des VRAIES
// coordonnées de chaque commune dès qu'elles sont connues (cache local),
// et se rabat sur l'estimation par wilaya sinon — en déclenchant en
// arrière-plan un géocodage (Nominatim, gratuit, sans clé) pour peupler
// le cache pour la prochaine fois. Signature synchrone identique à
// getDistanceKm : aucun écran appelant n'a besoin de devenir asynchrone,
// la précision s'améliore silencieusement au fil de l'usage.

import { getDistanceKm, extractWilaya, extractCommune, haversineKm, WILAYA_COORDS } from './wilayas';
import { communeCoordsDB } from '../db/database';

/** Formule Haversine — distance à vol d'oiseau en km entre 2 points GPS. */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Rayon de la Terre en km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Une commune n'est géocodée AU PLUS UNE FOIS par session (succès ou échec),
// pour ne jamais bombarder Nominatim à chaque re-render d'une liste (ex :
// les cartes de demandes dans (tabs)/index.jsx). En cas d'échec, on
// retente simplement à la prochaine ouverture de l'app.
const attempted = new Set();

function geocodeCommuneEnArrierePlan(commune, wilaya) {
  const key = `${commune}|${wilaya}`;
  if (attempted.has(key)) return;
  attempted.add(key);

  (async () => {
    try {
      const query = encodeURIComponent(`${commune}, ${wilaya}, Algérie`);
      const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&countrycodes=dz&limit=1`;
      const response = await Promise.race([
        fetch(url, { headers: { 'User-Agent': 'DzExpress/1.0' } }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('geocode_timeout')), 8000)),
      ]);
      const data = await response.json();
      const hit = data?.[0];
      if (hit?.lat && hit?.lon) {
        communeCoordsDB.set(commune, wilaya, parseFloat(hit.lat), parseFloat(hit.lon));
      }
    } catch (_) {
      // Pas grave : hors-ligne ou requête échouée → on garde le repli par
      // wilaya pour cette session, on retentera au prochain lancement.
    }
  })();
}

/**
 * Coordonnées précises d'une commune si déjà en cache local (lecture
 * SQLite synchrone), sinon `null` — et dans ce cas, déclenche un
 * géocodage en arrière-plan pour la prochaine fois.
 */
function getCoordsCommune(label) {
  const commune = extractCommune(label);
  const wilaya  = extractWilaya(label);
  if (!commune || !wilaya) return null; // pas de commune précise dans le label (juste une wilaya)

  const cached = communeCoordsDB.get(commune, wilaya);
  if (cached) return { lat: cached.latitude, lng: cached.longitude };

  geocodeCommuneEnArrierePlan(commune, wilaya);
  return null;
}

/**
 * Distance routière estimée en km entre deux villes/communes — même
 * contrat que getDistanceKm (src/utils/wilayas.js), mais utilise les
 * coordonnées précises de la commune dès qu'elles sont connues en cache
 * local, au lieu du centre de la wilaya entière.
 *
 * Tant que le cache n'a pas encore été alimenté pour l'une des deux
 * communes (typiquement : premier trajet jamais vu par cette app), le
 * résultat est identique à getDistanceKm — la valeur précise apparaîtra
 * au prochain rendu une fois le géocodage en arrière-plan terminé (déjà
 * déclenché par cet appel).
 */
/**
 * Coordonnées GPS d'une seule ville/commune — précises si déjà en cache
 * local (et déclenche un géocodage en arrière-plan sinon), avec repli
 * synchrone sur le centre de la wilaya. Utile pour placer un point unique
 * sur une carte (ex : le marqueur destination du suivi live).
 */
export function getCoordsVille(label) {
  const precise = getCoordsCommune(label);
  if (precise) return precise;

  const wilaya = extractWilaya(label);
  const w = WILAYA_COORDS[wilaya];
  return w ? { lat: w.lat, lng: w.lng } : null;
}

export function getDistanceKmPrecise(ville1, ville2) {
  if (!ville1 || !ville2) return null;

  const c1 = getCoordsCommune(ville1);
  const c2 = getCoordsCommune(ville2);

  if (c1 && c2) {
    const vol   = haversineKm(c1.lat, c1.lng, c2.lat, c2.lng);
    const route = Math.round(vol * 1.25);
    return Math.max(5, route);
  }

  return getDistanceKm(ville1, ville2);
}
