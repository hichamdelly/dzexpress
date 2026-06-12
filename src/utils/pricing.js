// ── Moteur de tarification dynamique DzExpress ───────────────

export const TARIFS_BASE = {
  herbine:   { perKm: 18,  priseEnCharge: 200,  label: 'Herbine',         icon: 'cart-outline' },
  utilitaire:{ perKm: 30,  priseEnCharge: 350,  label: 'Utilitaire léger',icon: 'car-outline' },
  fourgon:   { perKm: 45,  priseEnCharge: 500,  label: 'Fourgon',         icon: 'car-sport-outline' },
  camion35:  { perKm: 65,  priseEnCharge: 800,  label: 'Camion 3.5T',     icon: 'bus-outline' },
  camion10:  { perKm: 90,  priseEnCharge: 1200, label: 'Camion 10T',      icon: 'cube-outline' },
  semi:      { perKm: 130, priseEnCharge: 2000, label: 'Semi-remorque',   icon: 'construct-outline' },
};

// Jours fériés fixes (MM-DD)
const FERIES_FIXES = ['01-01', '01-12', '05-01', '07-05', '11-01'];

// Jours fériés islamiques 2025-2026 (dates approx.)
const FERIES_ISLAMIQUES = [
  '2025-03-30', '2025-03-31',
  '2025-06-06', '2025-06-07', '2025-06-08',
  '2025-06-26',
  '2025-09-04', '2025-09-05',
  '2025-11-04',
  '2026-03-20', '2026-03-21',
  '2026-05-27', '2026-05-28',
];

function pad(n) { return String(n).padStart(2, '0'); }

export function isJourFerie(d = new Date()) {
  const mm   = pad(d.getMonth() + 1);
  const dd   = pad(d.getDate());
  const yyyy = d.getFullYear();
  return FERIES_FIXES.includes(`${mm}-${dd}`) ||
         FERIES_ISLAMIQUES.includes(`${yyyy}-${mm}-${dd}`);
}

/**
 * Calcule le surge actuel.
 * @param {number}  nbActives  Nombre de demandes actives en attente
 * @param {Date}    date       Date de référence (default: maintenant)
 */
export function calculerSurge(nbActives = 0, date = new Date()) {
  const h   = date.getHours();
  const day = date.getDay(); // 0=dim, 5=ven, 6=sam
  const rules = [];

  if (isJourFerie(date))
    rules.push({ key: 'ferie',        label: 'Jour férié',      pct: 35 });
  else if (h >= 20 || h < 6)
    rules.push({ key: 'nuit',         label: 'Nuit (20h–6h)',   pct: 25 });
  else if ((h >= 7 && h < 9) || (h >= 16 && h < 19))
    rules.push({ key: 'heure_pointe', label: 'Heure de pointe', pct: 20 });

  if (day === 5 || day === 6)
    rules.push({ key: 'weekend',      label: 'Weekend',          pct: 15 });

  if (nbActives > 10)
    rules.push({ key: 'forte_demande', label: 'Forte demande',   pct: 30 });

  const pct        = Math.min(rules.reduce((s, r) => s + r.pct, 0), 80);
  const coefficient = pct / 100;

  return {
    coefficient,
    pct,
    rules,
    label:          pct > 0 ? rules.map(r => r.label).join(' + ') : null,
    isForteDemande: rules.some(r => r.key === 'forte_demande'),
    isSignificant:  pct > 20,
    hasAny:         pct > 0,
  };
}

/**
 * Calcule le prix pour un véhicule et des options données.
 * Retourne { min, max, detail, ... }
 */
export function calculerPrix(distanceKm, vehicule, options = {}) {
  const tarif          = TARIFS_BASE[vehicule] || TARIFS_BASE.fourgon;
  const km             = Math.max(5, distanceKm || 5);
  const surge          = calculerSurge(options.nbActives || 0, options.date);
  const baseAvantSurge = tarif.perKm * km + tarif.priseEnCharge;

  // 1. Surge sur le prix de base
  let total = baseAvantSurge * (1 + surge.coefficient);

  // 2. Frais additifs
  const etages      = Math.min(options.etages || 0, 5);
  const fraisEtages = etages * 200;
  const fraisAide   = options.aide ? 500 : 0;
  total += fraisEtages + fraisAide;

  // 3. Multiplicateurs sur le total
  if (options.fragile) total *= 1.20;
  if (options.express) total *= 1.40;

  const prixMin = Math.round(total / 25) * 25;

  return {
    min:              prixMin,
    max:              Math.round(prixMin * 1.15 / 25) * 25,
    surgeCoefficient: 1 + surge.coefficient,
    surgePct:         surge.pct,
    surgeLabel:       surge.label,
    surgeRules:       surge.rules,
    isForteDemande:   surge.isForteDemande,
    isSignificant:    surge.isSignificant,
    detail: {
      km,
      tarifKm:        tarif.perKm,
      priseEnCharge:  tarif.priseEnCharge,
      baseAvantSurge: Math.round(baseAvantSurge),
      surgePct:       surge.pct,
      fraisEtages,
      fraisAide,
      fragile:        !!options.fragile,
      express:        !!options.express,
    },
  };
}

/** Formate un montant en DA avec séparateur de milliers. */
export function fmtPrix(n) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('fr-FR') + ' DA';
}

/**
 * Calcule la part du transporteur.
 * Commission standard : 15 % — Bonus (note > 4.5) : 10 %
 */
export function partTransporteur(prixFinal, rating = 0) {
  const taux    = rating > 4.5 ? 0.90 : 0.85;
  const montant = Math.round(prixFinal * taux);
  return {
    montant,
    commission:  prixFinal - montant,
    tauxGarder:  Math.round(taux * 100),
    bonus:       rating > 4.5,
  };
}
