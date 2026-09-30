// Pont en mémoire entre CityInput (qui ouvre /select-location) et l'écran
// carte lui-même. expo-router ne permet pas de faire transiter une
// fonction de callback via les params de route (ils doivent être
// sérialisables), donc on enregistre le callback ici, sous un id, et
// l'écran carte va simplement le rechercher et l'appeler au moment de la
// confirmation.
const resolvers = new Map();
let counter = 0;

/** Enregistre un callback à appeler avec le résultat choisi. Retourne un id à passer en param de route. */
export function registerPicker(onPicked) {
  const id = `pick_${Date.now()}_${counter++}`;
  resolvers.set(id, onPicked);
  return id;
}

/** Appelé par l'écran carte à la confirmation. */
export function resolvePicker(id, result) {
  const resolve = resolvers.get(id);
  resolvers.delete(id);
  resolve?.(result);
}

/** Appelé si l'utilisateur quitte l'écran carte sans confirmer (évite une fuite mémoire). */
export function cancelPicker(id) {
  resolvers.delete(id);
}
