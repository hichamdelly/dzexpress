// Notifications locales, sans expo-notifications — depuis Expo Go SDK 53+,
// expo-notifications ne supporte plus les notifications remote/push dans
// Expo Go, et son initialisation (Notifications.setNotificationHandler,
// appelée au niveau module) pouvait planter au chargement de ce fichier.
// Comme ce module est importé en cascade par AppContext.jsx puis
// app/(tabs)/_layout.tsx, un throw ici corrompait l'évaluation de tout ce
// chemin d'import — cause probable de l'erreur "ErrorBoundary of
// undefined" dans useScreens.js.
//
// Cette version ne dépend d'aucun module natif : une simple file
// d'attente en mémoire + un système d'abonnement (pub/sub), qu'un
// composant peut écouter pour afficher sa propre UI de notification
// (bannière in-app, toast…). Ça ne produit plus de vraie notification
// système (tiroir/écran verrouillé) — ce n'était de toute façon
// qu'un affichage local, DzExpress n'ayant aucun backend pour de vraies
// notifications push cross-appareil (voir CLAUDE.md).

let notificationQueue = [];
let listeners = [];

/** Conservé pour compatibilité d'appel (AppContext) — ne fait plus rien de réel. */
export const enregistrerNotifications = async () => {
  console.log('Notifications locales activées');
  return null;
};

/** Empile une notification et prévient les listeners abonnés (voir ajouterListenerNotification). */
export const envoyerNotificationLocale = async (titre, message, data = {}) => {
  const notif = { titre, message, data, timestamp: new Date(), lu: false };
  notificationQueue.push(notif);
  listeners.forEach(l => l(notif));
  console.log('Notification:', titre, message);
};

/** S'abonne aux nouvelles notifications. Retourne une fonction de désabonnement. */
export const ajouterListenerNotification = (callback) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
};

/** Alias de envoyerNotificationLocale, même effet (empile + notifie les listeners). */
export const notifierTous = (titre, message, data = {}) => envoyerNotificationLocale(titre, message, data);

export const getNotifications = () => notificationQueue;
export const clearNotifications = () => { notificationQueue = []; };

/**
 * Contenu (titre + message) des notifications DzExpress, par évènement
 * métier. Distinct de NOTIF_META ci-dessous : NOTIF_META fournit
 * l'icône/couleur de la bannière in-app, NOTIFS fournit un texte
 * titre+message réutilisable (ex : pour la file d'attente ci-dessus).
 */
export const NOTIFS = {
  NOUVELLE_DEMANDE: (trajet) => ({
    titre: '🚛 Nouvelle course disponible',
    message: `${trajet.depart} → ${trajet.arrivee}`,
  }),
  COURSE_ACCEPTEE: (transporteur) => ({
    titre: '✅ Course acceptée !',
    message: `${transporteur.nom} a accepté votre demande`,
  }),
  TRANSPORTEUR_EN_ROUTE: (nom) => ({
    titre: '🚛 En route !',
    message: `${nom} est en route vers vous`,
  }),
  LIVRAISON_ARRIVEE: () => ({
    titre: '📦 Livraison arrivée !',
    message: 'Votre marchandise est arrivée à destination',
  }),
  COURSE_ANNULEE: (motif) => ({
    titre: '❌ Course annulée',
    message: motif ? `Motif : ${motif}` : 'Votre course a été annulée',
  }),
  NOUVEAU_MESSAGE: (nom) => ({
    titre: `💬 Message de ${nom}`,
    message: 'Vous avez un nouveau message',
  }),
  CONTRE_PROPOSITION: (nom) => ({
    titre: '💰 Contre-proposition',
    message: `${nom} a fait une contre-proposition de prix`,
  }),
};

export const NT = {
  NOUVELLE_DEMANDE:     'nouvelle_demande',
  OFFRE_RECUE:          'offre_recue',
  COURSE_ACCEPTEE:      'course_acceptee',
  TRANSPORTEUR_ENROUTE: 'transporteur_enroute',
  LIVRAISON_EFFECTUEE:  'livraison_effectuee',
  COURSE_ANNULEE:       'course_annulee',
  NOUVEAU_MESSAGE:      'nouveau_message',
  TIMER_ANNULATION:     'timer_annulation',
  CONTRE_PROPOSITION:   'contre_proposition',
  PAIEMENT_CONFIRME:    'paiement_confirme',
  INFO:                 'info',
};

export const NOTIF_META = {
  nouvelle_demande:     { icon: 'cube-outline',         color: '#1A56DB', label: 'Nouvelle demande' },
  offre_recue:          { icon: 'pricetag-outline',      color: '#7C3AED', label: 'Offre reçue' },
  course_acceptee:      { icon: 'checkmark-circle',      color: '#16A34A', label: 'Course acceptée' },
  transporteur_enroute: { icon: 'car-sport-outline',     color: '#0F4D2E', label: 'En route' },
  livraison_effectuee:  { icon: 'cube',                  color: '#16A34A', label: 'Livraison effectuée' },
  course_annulee:       { icon: 'close-circle',          color: '#DC2626', label: 'Course annulée' },
  nouveau_message:      { icon: 'chatbubble-ellipses',   color: '#0891B2', label: 'Nouveau message' },
  timer_annulation:     { icon: 'time-outline',          color: '#D97706', label: 'Annulation gratuite' },
  contre_proposition:   { icon: 'swap-horizontal',       color: '#7C3AED', label: 'Contre-proposition' },
  paiement_confirme:    { icon: 'card-outline',          color: '#16A34A', label: 'Paiement confirmé' },
  info:                 { icon: 'notifications-outline', color: '#6B7280', label: 'Info' },
};

export function notifMeta(type) {
  return NOTIF_META[type] || NOTIF_META.info;
}
