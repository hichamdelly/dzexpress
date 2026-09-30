// Position simulée du transporteur pendant une course "en_route" — voir
// app/suivi-live/[id].jsx pour le contexte complet (pas de backend, donc
// pas de vraie position cross-appareil ; on simule un trajet départ →
// destination pour pouvoir tester/démontrer le suivi).
//
// Point important : la position est calculée comme une fonction PURE du
// temps écoulé depuis `en_route_at` (horodaté en base au démarrage de la
// course, voir demandesDB.updateStatut), PAS d'un compteur de pas propre
// à chaque écran. Si elle dépendait d'un compteur local incrémenté par
// setInterval à partir du montage du composant, deux écrans affichant la
// même course (ex : la mini-carte de l'accueil et l'écran de suivi
// complet) calculeraient chacun leur propre progression et afficheraient
// deux positions différentes pour le même camion. Une fonction du temps
// écoulé garantit que n'importe quel écran, à n'importe quel moment,
// calcule exactement la même position.

export const SIM_TOTAL_MS = 72_000; // durée totale du trajet simulé (~72s)

/**
 * Calcule la position simulée actuelle entre le départ et la destination.
 * Retourne `null` tant que la course n'est pas "en_route" (pas encore de
 * mouvement) ou si les coordonnées/l'horodatage sont indisponibles.
 */
export function calculerPositionSimulee(enRouteAtISO, departCoords, destCoords) {
  if (!enRouteAtISO || !departCoords || !destCoords) return null;

  const startedMs = new Date(enRouteAtISO.replace(' ', 'T') + 'Z').getTime();
  if (Number.isNaN(startedMs)) return null;

  const elapsed  = Date.now() - startedMs;
  const progress = Math.max(0, Math.min(1, elapsed / SIM_TOTAL_MS));

  return {
    lat:      departCoords.lat + (destCoords.lat - departCoords.lat) * progress,
    lng:      departCoords.lng + (destCoords.lng - departCoords.lng) * progress,
    progress,
    arrive:   progress >= 1,
  };
}
