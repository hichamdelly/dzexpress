/**
 * Coordonnées GPS approx. des chefs-lieux des 48 wilayas algériennes.
 * Source : centres géographiques officiels.
 */
export const WILAYA_COORDS = {
  'Adrar':                { lat: 27.874, lng: -0.293 },
  'Aïn Defla':            { lat: 36.264, lng:  1.967 },
  'Aïn Témouchent':       { lat: 35.298, lng: -1.140 },
  'Alger':                { lat: 36.737, lng:  3.087 },
  'Alger Centre':         { lat: 36.737, lng:  3.087 },
  'Annaba':               { lat: 36.900, lng:  7.767 },
  'Batna':                { lat: 35.556, lng:  6.174 },
  'Béchar':               { lat: 31.624, lng: -2.214 },
  'Béjaïa':               { lat: 36.751, lng:  5.056 },
  'Biskra':               { lat: 34.850, lng:  5.729 },
  'Blida':                { lat: 36.472, lng:  2.828 },
  'Bordj Bou Arréridj':   { lat: 36.067, lng:  4.763 },
  'Bouira':               { lat: 36.380, lng:  3.900 },
  'Boumerdès':            { lat: 36.764, lng:  3.477 },
  'Chlef':                { lat: 36.165, lng:  1.332 },
  'Constantine':          { lat: 36.365, lng:  6.615 },
  'Djelfa':               { lat: 34.674, lng:  3.251 },
  'El Bayadh':            { lat: 33.683, lng:  1.017 },
  'El Oued':              { lat: 33.368, lng:  6.863 },
  'El Tarf':              { lat: 36.767, lng:  8.313 },
  'Ghardaïa':             { lat: 32.491, lng:  3.673 },
  'Guelma':               { lat: 36.463, lng:  7.433 },
  'Illizi':               { lat: 26.508, lng:  8.474 },
  'Jijel':                { lat: 36.822, lng:  5.766 },
  'Khenchela':            { lat: 35.426, lng:  7.143 },
  'Laghouat':             { lat: 33.800, lng:  2.874 },
  'Mascara':              { lat: 35.395, lng:  0.140 },
  'Médéa':                { lat: 36.264, lng:  2.753 },
  'Mila':                 { lat: 36.451, lng:  6.264 },
  'Mostaganem':           { lat: 35.933, lng:  0.089 },
  'Msila':                { lat: 35.707, lng:  4.541 },
  'Naâma':                { lat: 33.267, lng: -0.317 },
  'Oran':                 { lat: 35.697, lng: -0.633 },
  'Ouargla':              { lat: 31.954, lng:  5.324 },
  'Oum El Bouaghi':       { lat: 35.876, lng:  7.114 },
  'Relizane':             { lat: 35.736, lng:  0.556 },
  'Saïda':                { lat: 34.830, lng:  0.151 },
  'Sétif':                { lat: 36.191, lng:  5.410 },
  'Sidi Bel Abbès':       { lat: 35.189, lng: -0.634 },
  'Skikda':               { lat: 36.876, lng:  6.909 },
  'Souk Ahras':           { lat: 36.287, lng:  7.952 },
  'Tamanrasset':          { lat: 22.785, lng:  5.523 },
  'Tébessa':              { lat: 35.404, lng:  8.124 },
  'Tiaret':               { lat: 35.371, lng:  1.322 },
  'Tindouf':              { lat: 27.673, lng: -8.147 },
  'Tipaza':               { lat: 36.589, lng:  2.446 },
  'Tissemsilt':           { lat: 35.604, lng:  1.812 },
  'Tizi Ouzou':           { lat: 36.717, lng:  4.047 },
  'Tlemcen':              { lat: 34.883, lng: -1.317 },

  // ── Nouvelles wilayas 2019 (49-58) ────────────────────────
  'Timimoun':             { lat: 29.263, lng:  0.234 },
  'Bordj Badji Mokhtar':  { lat: 21.333, lng:  0.949 },
  'Ouled Djellal':        { lat: 34.418, lng:  5.072 },
  'Béni Abbès':           { lat: 30.129, lng: -2.167 },
  'In Salah':             { lat: 27.201, lng:  2.472 },
  'In Guezzam':           { lat: 19.565, lng:  5.768 },
  'Touggourt':            { lat: 33.100, lng:  6.068 },
  'Djanet':               { lat: 24.556, lng:  9.485 },
  "El M'Ghair":           { lat: 33.956, lng:  5.932 },
  'El Meniaa':            { lat: 30.585, lng:  2.880 },
};

// ── Haversine ────────────────────────────────────────────────
function toRad(deg) { return (deg * Math.PI) / 180; }

function haversineKm(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Normalise les variantes de nom de wilaya (ex : "Alger Centre" → "Alger")
function normalize(ville) {
  return (ville || '')
    .replace(' Centre', '')
    .replace(' Est',    '')
    .replace(' Ouest',  '')
    .trim();
}

// ── Recherche avec priorité "commence par" ────────────────────

/**
 * Supprime les diacritiques et met en minuscules.
 * "Béjaïa" → "bejaia", "Aïn Défla" → "ain defla"
 */
export function normalizeQuery(str) {
  return (str || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents
    .toLowerCase()
    .trim();
}

/**
 * Recherche dans une liste de villes avec tri intelligent :
 *   1. Villes qui COMMENCENT par le texte tapé  (priorité haute)
 *   2. Villes qui CONTIENNENT le texte tapé     (priorité basse)
 * Insensible aux accents/diacritiques.
 *
 * @param {string}   query      Texte saisi par l'utilisateur
 * @param {string[]} list       Liste de villes (ex : WILAYAS)
 * @param {number}   [max=8]    Nombre max de résultats
 * @returns {string[]}
 */
export function searchVilles(query, list, max = 8) {
  if (!query || query.trim() === '') return [];
  const q = normalizeQuery(query);

  const starts   = [];
  const contains = [];

  for (const ville of list) {
    const v = normalizeQuery(ville);
    if (v.startsWith(q))       starts.push(ville);
    else if (v.includes(q))    contains.push(ville);
  }

  return [...starts, ...contains].slice(0, max);
}

/**
 * Extrait le nom de wilaya depuis un label CityInput.
 * "Kouba — Alger" → "Alger"
 * "Alger"         → "Alger"  (déjà une wilaya)
 */
function extractWilaya(cityLabel) {
  if (!cityLabel) return null;
  if (cityLabel.includes(' — ')) return cityLabel.split(' — ')[1].trim();
  return cityLabel;
}

/**
 * Distance routière estimée en km entre deux villes/communes.
 *
 * Accepte indifféremment :
 *   • Un nom de wilaya : "Alger", "Oran"
 *   • Un label commune : "Kouba — Alger", "Bir El Djir — Oran"
 *
 * Règles :
 *   • Même wilaya (ou même adresse) → 5 km minimum
 *   • Villes inconnues → null (pas d'affichage)
 *   • Résultat × 1.25 pour approcher la distance route réelle
 */
export function getDistanceKm(ville1, ville2) {
  if (!ville1 || !ville2) return null;

  const w1 = extractWilaya(ville1);
  const w2 = extractWilaya(ville2);

  const n1 = normalize(w1 || '');
  const n2 = normalize(w2 || '');

  if (n1 === n2) return 5; // même wilaya / même adresse → min 5 km

  const c1 = WILAYA_COORDS[w1] || WILAYA_COORDS[n1];
  const c2 = WILAYA_COORDS[w2] || WILAYA_COORDS[n2];
  if (!c1 || !c2) return null;

  const vol   = haversineKm(c1.lat, c1.lng, c2.lat, c2.lng);
  const route = Math.round(vol * 1.25);
  return Math.max(5, route);
}

/**
 * Prix estimé (DA) selon la distance et le type de véhicule.
 * Tarifs indicatifs Algérie. Distance minimum = 5 km.
 *   Fourgon      5 km min = 225 DA
 *   Camion 3.5T  5 km min = 325 DA
 *   Camion 10T   5 km min = 450 DA
 *   Semi         5 km min = 650 DA
 */
const TARIFS = {
  fourgon:  { perKm: 45 },
  camion35: { perKm: 65 },
  camion10: { perKm: 90 },
  semi:     { perKm: 130 },
};

export const DISTANCE_MIN_KM = 5;

export function estimerPrix(distanceKm, vehicule) {
  if (!distanceKm) return null;
  const t   = TARIFS[vehicule] || TARIFS.fourgon;
  const km  = Math.max(DISTANCE_MIN_KM, distanceKm);
  const raw = km * t.perKm;
  return Math.round(raw / 25) * 25; // arrondi à 25 DA
}

/** Formate un nombre de km en label lisible. */
export function fmtKm(km) {
  if (km == null) return null;
  if (km < 50)  return `~${km} km`;
  // Arrondit à la dizaine
  return `~${Math.round(km / 10) * 10} km`;
}
