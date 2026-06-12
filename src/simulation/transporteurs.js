// Génération de transporteurs fictifs — style Uber, réaliste

import { calculerPrix, TARIFS_BASE } from '../utils/pricing';

// ── Pool de noms algériens réalistes ─────────────────────────
const NOMS = [
  'Karim Bensaid',   'Mohamed Ait Ali', 'Youcef Hamdi',
  'Rachid Oussama',  'Samir Kaci',      'Ali Mansour',
  'Nabil Zerrouk',   'Farid Lounès',    'Hichem Benali',
  'Tarek Meziane',   'Sofiane Amrani',  'Walid Chettouh',
  'Omar Belkacemi',  'Riad Benali',     'Abdel Bouzid',
  'Mourad Tahar',    'Amir Daoud',      'Hassan Zergui',
  'Khaled Rahali',   'Bilal Ferdi',     'Djamel Hadjadj',
  'Nasim Ouali',     'Yazid Kerbache',  'Adel Toumi',
];

const TEL_PREFIXES = ['0550', '0560', '0770', '0780', '0540', '0670', '0659', '0551', '0661'];

// ── Distribution pondérée des véhicules ──────────────────────
const VEHICULES_POIDS = [
  { key: 'herbine',    poids: 15 },
  { key: 'utilitaire', poids: 20 },
  { key: 'fourgon',    poids: 35 },
  { key: 'camion35',   poids: 18 },
  { key: 'camion10',   poids: 8  },
  { key: 'semi',       poids: 4  },
];

function rnd(min, max)    { return min + Math.random() * (max - min); }
function randInt(min, max){ return Math.floor(rnd(min, max + 1)); }
function pick(arr)        { return arr[randInt(0, arr.length - 1)]; }

function genTel() {
  const p = pick(TEL_PREFIXES);
  const n = String(randInt(100000, 999999));
  return `${p} ${n.slice(0, 3)} ${n.slice(3)}`;
}

function randomVehicule() {
  const total = VEHICULES_POIDS.reduce((s, v) => s + v.poids, 0);
  let r = Math.random() * total;
  for (const v of VEHICULES_POIDS) {
    r -= v.poids;
    if (r <= 0) return v.key;
  }
  return 'fourgon';
}

// ── Distribution réaliste des notes ──────────────────────────
// La majorité est entre 4.0 et 4.8 (comme sur Uber/Lyft)
function randomRating() {
  const r = Math.random();
  if (r < 0.04) return parseFloat(rnd(2.8, 3.3).toFixed(1)); // 4%  bas
  if (r < 0.12) return parseFloat(rnd(3.4, 3.9).toFixed(1)); // 8%  moyen
  if (r < 0.38) return parseFloat(rnd(4.0, 4.3).toFixed(1)); // 26% bien
  if (r < 0.70) return parseFloat(rnd(4.3, 4.7).toFixed(1)); // 32% très bien
  if (r < 0.90) return parseFloat(rnd(4.7, 4.9).toFixed(1)); // 20% excellent
  return parseFloat(rnd(4.9, 5.0).toFixed(1));                // 10% parfait
}

// Nombre de courses corrélé à la note (les bons ont plus de courses)
function coursesByRating(rating) {
  if (rating < 3.5) return randInt(5, 40);
  if (rating < 4.0) return randInt(25, 90);
  if (rating < 4.4) return randInt(70, 200);
  if (rating < 4.7) return randInt(160, 350);
  if (rating < 4.9) return randInt(280, 480);
  return randInt(420, 620);
}

/**
 * Génère `count` transporteurs fictifs autour de (centerLat, centerLng).
 * Véhicules pondérés, notes réalistes, prix via moteur de tarification.
 */
export function genererTransporteurs(centerLat, centerLng, count = 8, routeKm = null) {
  const km  = Math.max(5, routeKm || 50);
  const now = new Date();

  // On garantit au moins 2 transporteurs disponibles
  const disponibilites = Array.from({ length: count }, () => Math.random() > 0.28);
  const nbDispo = disponibilites.filter(Boolean).length;
  if (nbDispo < 2) { disponibilites[0] = true; disponibilites[1] = true; }

  // Pool de noms sans répétition (shuffled)
  const nomsShuffled = [...NOMS].sort(() => Math.random() - 0.5);

  return Array.from({ length: count }, (_, i) => {
    const angle   = (i / count) * 2 * Math.PI + rnd(-0.4, 0.4);
    const radius  = rnd(0.006, 0.044);       // ~0.7 km à ~5 km
    const veh     = randomVehicule();
    const rating  = randomRating();
    const distM   = Math.round(radius * 111_000);
    const dispo   = disponibilites[i];

    // Prix via moteur dynamique ± variation ±12 %
    const result      = calculerPrix(km, veh, { nbActives: 0, date: now });
    const variation   = 0.88 + Math.random() * 0.24;
    const prix_estime = Math.round((result.min * variation) / 50) * 50;

    return {
      id:             `sim_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
      nom:            nomsShuffled[i % nomsShuffled.length],
      vehicule:       veh,
      vehicule_label: TARIFS_BASE[veh]?.label || veh,
      vehicule_icon:  TARIFS_BASE[veh]?.icon  || '🚛',
      rating,
      latitude:       centerLat + Math.cos(angle) * radius,
      longitude:      centerLng + Math.sin(angle) * radius,
      disponible:     dispo,
      distance_m:     distM,
      prix_estime,
      telephone:      genTel(),
      nb_courses:     coursesByRating(rating),
      moveKey:        0,
    };
  });
}

/**
 * Simule un léger déplacement des transporteurs disponibles.
 * Appelé toutes les 30 secondes côté carte.
 * Distance de mouvement : ~45–180 m
 */
export function simulerMouvement(transporteurs) {
  return transporteurs.map(t => {
    if (!t.disponible) return t;
    const delta = 0.0004 + Math.random() * 0.0013; // ~45-180m
    const angle = Math.random() * 2 * Math.PI;
    return {
      ...t,
      latitude:  t.latitude  + Math.cos(angle) * delta,
      longitude: t.longitude + Math.sin(angle) * delta,
      moveKey:   (t.moveKey || 0) + 1,
    };
  });
}

/**
 * Simule la réponse d'un transporteur — 72 % d'acceptation, délai 4-11 s.
 * Renvoie un cleanup pour annuler.
 */
export function simulerReponse(onAccept, onRefuse) {
  const accepte = Math.random() < 0.72;
  const delai   = randInt(4000, 11000);
  const tid     = setTimeout(() => (accepte ? onAccept() : onRefuse()), delai);
  return () => clearTimeout(tid);
}

/** Distance GPS en texte lisible (m → km). */
export function fmtDistance(meters) {
  if (!meters) return '—';
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/** Formate un countdown MM:SS. */
export function fmtTimer(seconds) {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}
