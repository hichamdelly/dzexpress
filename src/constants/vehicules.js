// ── Véhicules proposés à l'expéditeur (étape 2 de la réservation) ──
// Classés du plus petit au plus grand.
//
// `tarif` : clé de TARIFS_BASE (src/utils/pricing.js) utilisée pour le prix.
//
// `image` : Metro résout les require() à la compilation — un require() vers un
// fichier absent fait planter le bundle. Tant que assets/vehicles/<id>.png
// n'existe pas, laisser `image: null` (une icône s'affiche à la place).
// Quand le fichier est ajouté, remplacer par :
//   image: require('../../assets/vehicles/<id>.png'),
export const VEHICULES = [
  { id: 'utilitaire',       nom: 'Utilitaire léger (Kangoo, Doblo)', capaciteKg: 500,   caisse: 'Caisse fermée',  tarif: 'utilitaire', image: null },
  { id: 'herbine_simple',   nom: 'Herbine simple cabine',            capaciteKg: 1000,  caisse: 'Caisse ouverte', tarif: 'herbine',    image: null },
  { id: 'herbine_double',   nom: 'Herbine double cabine',            capaciteKg: 1000,  caisse: 'Caisse ouverte', tarif: 'herbine',    image: null },
  { id: 'fourgon',          nom: 'Fourgon',                          capaciteKg: 2000,  caisse: 'Caisse fermée',  tarif: 'fourgon',    image: null },
  { id: 'camion35_plateau', nom: 'Camion 3,5 t plateau',             capaciteKg: 3500,  caisse: 'Caisse ouverte', tarif: 'camion35',   image: null },
  { id: 'camion35_ferme',   nom: 'Camion 3,5 t fermé',               capaciteKg: 3500,  caisse: 'Caisse fermée',  tarif: 'camion35',   image: null },
  { id: 'camion10',         nom: 'Camion 10 t',                      capaciteKg: 10000, caisse: 'Caisse fermée',  tarif: 'camion10',   image: null },
  { id: 'semi',             nom: 'Semi-remorque',                    capaciteKg: 25000, caisse: 'Caisse fermée',  tarif: 'semi',       image: null },
];

// 500 → "500 kg" · 3500 → "3,5 t" · 25000 → "25 t"
export const formatCapacite = (kg) => (kg >= 1000 ? `${kg / 1000} t`.replace('.', ',') : `${kg} kg`);

export const getVehicule = (id) => VEHICULES.find(v => v.id === id) || null;

// Icône de repli quand l'image n'existe pas encore
export const vehiculeIcon = (v) => (v && v.capaciteKg > 2000 ? 'bus-outline' : 'car-outline');

// Véhicule conseillé par type de marchandise (clés de TYPES_MARCHANDISE)
const RECO_PAR_CATEGORIE = {
  demenagement:   'camion35_ferme',
  electromenager: 'fourgon',
  materiaux:      'camion35_plateau',
  marchandises:   'fourgon',
  fruits_legumes: 'herbine_simple',
  autre:          'utilitaire',
};

// Plusieurs catégories → on garde le véhicule le plus capacitaire
export function vehiculeRecommande(categories = []) {
  const ids = categories.map(c => RECO_PAR_CATEGORIE[c]).filter(Boolean);
  if (ids.length === 0) return null;
  return ids
    .map(getVehicule)
    .reduce((best, v) => (!best || v.capaciteKg > best.capaciteKg ? v : best), null)?.id || null;
}
