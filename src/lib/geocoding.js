// Géocodage inverse partagé — utilisé par CityInput (bouton "Ma position")
// et par l'écran app/select-location.jsx (sélecteur sur carte).

// Clé OpenCage, fournie via .env (voir .env.example) — jamais en dur dans
// le code (un fichier committé sur git resterait exposé indéfiniment dans
// l'historique, même après suppression ultérieure de la clé).
const OPENCAGE_API_KEY = process.env.EXPO_PUBLIC_OPENCAGE_API_KEY;

/**
 * Géocodage inverse (OpenCage Data API) → commune exacte, MÊME si elle
 * n'existe pas dans notre base locale COMMUNES (ex : un village comme
 * "Toghza" rattaché à la commune de "Chorfa"). On ne cherche plus à faire
 * correspondre le résultat à notre liste : on construit le label
 * directement à partir de la réponse.
 *
 * Retourne un label du type "Toghza, Chorfa — Bouira", ou `null` si la
 * requête échoue (pas de clé configurée, hors-ligne, timeout, quota
 * dépassé, réponse inexploitable) — dans ce cas l'appelant se rabat
 * généralement sur la wilaya la plus proche (nearestWilaya, 100%
 * hors-ligne, voir src/utils/wilayas.js).
 */
export async function trouverCommuneExacte(latitude, longitude) {
  if (!OPENCAGE_API_KEY) return null;
  try {
    const url = `https://api.opencagedata.com/geocode/v1/json?q=${latitude}+${longitude}&key=${OPENCAGE_API_KEY}&language=fr&countrycode=dz&limit=1`;
    const response = await Promise.race([
      fetch(url),
      new Promise((_, reject) => setTimeout(() => reject(new Error('geocode_timeout')), 6000)),
    ]);
    const data = await response.json();
    if (!data.results?.length) return null;

    const components = data.results[0].components;
    console.log('OpenCage result:', JSON.stringify(components));

    // Récupère le niveau le plus précis disponible (hameau/village avant
    // ville) — plus de restriction à notre liste COMMUNES.
    const commune = components.village
      || components.hamlet
      || components.neighbourhood
      || components.suburb
      || components.town
      || components.city;
    if (!commune) return null;

    // Commune administrative parente (ex : "Chorfa" pour le village "Toghza")
    const communeParente = components.municipality || components.county || '';
    const label = (communeParente && communeParente !== commune)
      ? `${commune}, ${communeParente}`
      : commune;

    const wilaya = (components.state || '')
      .replace('Wilaya de ', '')
      .replace("Wilaya d'", '');

    return wilaya ? `${label} — ${wilaya}` : label;
  } catch (e) {
    console.error('Erreur géocodage OpenCage:', e);
    return null;
  }
}
