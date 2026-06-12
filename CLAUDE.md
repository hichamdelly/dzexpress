# DzExpress — Documentation complète

## Description du projet

**DzExpress** (`rakibdz`) est une plateforme mobile de transport de marchandises pour particuliers en Algérie. Elle met en relation des **expéditeurs** (qui ont une marchandise à envoyer) et des **transporteurs** (qui ont un camion/fourgon et cherchent des chargements).

Le concept s'inspire d'Uber/Yassir mais pour le fret : deux modes de demande (urgente immédiate ou planifiée à une date), marketplace d'offres entre les parties, messagerie intégrée, et tarification dynamique (surge pricing).

L'appli est **100% offline-first** — pas de serveur backend, toutes les données sont en SQLite local sur l'appareil. Firebase est initialisé mais pas encore utilisé en production. Supabase est configuré mais pas utilisé non plus.

---

## Stack technique

| Élément | Version / Lib |
|---|---|
| Framework | Expo SDK `~54.0.33` |
| Navigation | `expo-router` `~6.0.23` (file-based routing) |
| Base de données | `expo-sqlite` `~16.0.10` (SQLite synchrone) |
| Language | JavaScript (JSX) — **pas de TypeScript dans les écrans** sauf `_layout.tsx` |
| UI | React Native pur — StyleSheet, pas de lib UI externe |
| Auth (partiel) | Firebase Auth (`firebase` `^12.13.0`) + `expo-secure-store` |
| Backend (non utilisé) | Supabase (`@supabase/supabase-js` `^2.105.4`) |
| Audio | `expo-av` (messages vocaux) |
| Carte | `react-native-maps` `1.20.1` |
| Géolocalisation | `expo-location` |
| Images | `expo-image-picker` |
| Animations | `react-native-reanimated` `~4.1.1` |
| Date picker | `react-native-modal-datetime-picker` |
| Stockage clé-valeur | `@react-native-async-storage/async-storage` |

**React 19.1 / React Native 0.81.5** — new architecture activée (`newArchEnabled: true`).

---

## Architecture des fichiers

```
rakibdz/
├── app/                        # Routes expo-router (file-system routing)
│   ├── _layout.tsx             # Root layout : AppProvider + Stack navigation
│   ├── onboarding.jsx          # Écran d'inscription 3 étapes (rôle → profil → véhicule)
│   ├── otp.jsx                 # Vérification téléphone (simulée, code affiché en dev)
│   ├── notation.jsx            # Écran de notation post-livraison (UI complète, persist TODO)
│   ├── carte-transporteurs.jsx # Carte MapView avec transporteurs simulés (mode Maintenant)
│   ├── (tabs)/                 # Onglets principaux
│   │   ├── _layout.tsx         # Tab bar avec badges notifications + messages
│   │   ├── index.jsx           # Accueil : ExpéditeurHome (formulaire) | TransporteurHome (liste)
│   │   ├── suivi.jsx           # Mes demandes (expéditeur) | Mes courses (transporteur)
│   │   ├── messages.jsx        # Liste des conversations
│   │   ├── profil.jsx          # Profil + gains transporteur + disponibilité
│   │   ├── connexion.jsx       # (caché, href:null)
│   │   ├── expediteur.jsx      # (caché)
│   │   ├── transporteur.jsx    # (caché)
│   │   ├── proposer.jsx        # (caché)
│   │   └── connexion.jsx       # (caché)
│   ├── demande/[id].jsx        # Détail demande : offres, négociation, annulation, timeline
│   ├── course/[id].jsx         # Détail course transporteur : GPS, photo livraison, gains
│   ├── chat/[id].jsx           # Chat temps réel (polling 3s) : texte + messages vocaux
│   └── messages/[id].jsx       # (ancienne route messages, remplacée par chat/)
│
├── src/
│   ├── db/database.js          # TOUTE la logique SQLite : init, migrations, CRUD
│   ├── context/AppContext.jsx  # Context global : user, login, logout, refreshUser, localNotif
│   ├── components/
│   │   ├── CityInput.jsx       # Autocomplete communes/wilayas (2500+ communes)
│   │   └── NotifBanner.jsx     # Bannière animée notifications (Animated API)
│   ├── constants/
│   │   └── communes.js         # Base des communes algériennes avec searchCommunes()
│   ├── hooks/
│   │   ├── useNotifications.js # Polling SQLite 5s → badge + bannière
│   │   └── useMessagesBadge.js # Polling messages non lus
│   ├── lib/
│   │   ├── firebase.js         # Config Firebase (initialisé, pas encore utilisé)
│   │   ├── supabase.js         # Config Supabase (configuré, pas encore utilisé)
│   │   └── notifications.js    # (utilitaires notifs)
│   ├── simulation/
│   │   └── transporteurs.js    # Génération transporteurs fictifs style Uber (noms algériens, notes réalistes)
│   └── utils/
│       ├── wilayas.js          # Coords GPS 48 wilayas + haversine + getDistanceKm + searchVilles
│       ├── pricing.js          # Moteur tarification : TARIFS_BASE, calculerPrix, calculerSurge, partTransporteur
│       └── sound.js            # Son de notification
│
├── assets/images/              # Icônes app (icon, splash, android adaptive icon)
├── app.json                    # Config Expo : nom "DzExpress", slug, permissions, plugins
├── package.json                # Dépendances
└── tsconfig.json               # TypeScript (layouts .tsx uniquement)
```

---

## Fonctionnalités déjà implémentées

### Onboarding & Auth
- Inscription en 3 étapes : choix rôle → profil (nom, tel, wilaya) → véhicule (transporteur)
- Persistance session via `AsyncStorage` (clé `dzexpress_user_id`)
- Écran OTP simulé : le code à 4 chiffres s'affiche directement (pas de SMS réel)
- Firebase Auth configuré mais non connecté au flux d'inscription

### Interface duale (rôle adaptatif)
- Couleur orange pour les expéditeurs, bleu pour les transporteurs
- Header, onglets, icônes, et libellés changent selon `user.type`
- Badge rouge sur l'onglet "Suivi/Courses" (notifications) et "Messages" (messages non lus)

### Expéditeur — Créer une demande
- **Mode Maintenant (urgent)** : ouvre la carte des transporteurs disponibles
- **Mode Planifié** : publie dans la marketplace avec date + créneau horaire (matin/après-midi/soir/flexible)
- Autocomplete communes via `CityInput` (2500+ communes algériennes)
- Détection GPS de la wilaya de départ (bouton "Ma position")
- Sélection type de marchandise : Meubles, Électroménager, Cartons, Matériaux BTP, Véhicule, Autre
- Options supplémentaires : étages sans ascenseur (par palier de 200 DA, max 5), aide chargement (+500 DA), fragile (+20%), express (+40%)
- Widget d'estimation de prix en temps réel (tous véhicules) avec détail du calcul dépliable
- Surge pricing affiché visuellement si actif

### Transporteur — Trouver des courses
- Liste des demandes disponibles avec pull-to-refresh
- Filtres : Tous / Urgent (maintenant) / Planifié
- Filtres par type de marchandise (chips horizontaux)
- Carte demande : route, distance, créneau, poids, prix estimé, badge "N offres"
- Les demandes urgentes sont surlignées en rouge avec bannière "URGENT"

### Carte transporteurs (mode Maintenant)
- `MapView` avec marqueurs transporteurs simulés autour de la position GPS
- Sélection d'un transporteur → affiche ses détails (véhicule, note, prix estimé, distance)
- Simulation de réponse (accepte/refuse en quelques secondes)
- Simulation de mouvement vers l'expéditeur
- Confirmer → crée la demande en base avec `transporteur_simule` (JSON)

### Détail demande (`/demande/[id]`)
- Timeline visuelle 4 étapes : En attente → Acceptée → En cours → Livrée
- Expéditeur voit toutes les offres reçues (triées par prix)
- Accepter une offre → refuse automatiquement les autres + notifie le transporteur
- Contre-proposition de prix (négociation bidirectionnelle, compteur de tours)
- Annulation avec motif (gratuite dans les 5 min après acceptation, sinon comptabilisée)
- Timer de grâce de 5 minutes pour annulation gratuite
- Badge messages non lus
- Note d'annulations du transporteur visible sur chaque offre

### Détail course (`/course/[id]`)
- Vue transporteur : démarrer la course → marquer livré
- Carte GPS en temps réel pendant la course
- Prise de photo à la livraison (expo-image-picker)
- Modal de confirmation livraison avec photo
- Calcul et enregistrement des gains (commission 15%, bonus 10% si note > 4,5)
- Annulation avec sélection de raison → remet la demande "en attente"

### Messagerie
- Liste des conversations (toutes demandes avec messages)
- Temps relatif ("À l'instant", "5 min", heure, date)
- Badge nombre de non-lus par conversation
- Chat avec polling toutes les 3 secondes
- Messages texte + **messages vocaux** (appui long sur le micro)
- Waveform statique pour les bulles vocales
- Statut de lecture (✓ envoyé / ✓✓ lu)
- Bannière animée nouveau message entrant
- Son de notification à la réception

### Profil
- Modification nom, téléphone, wilaya, véhicule
- Toggle disponibilité transporteur (temps réel en SQLite)
- Dashboard gains transporteur : aujourd'hui / semaine / mois / total / nb courses
- Info commission (15% standard, 10% si note > 4,5)
- Déconnexion

### Notifications locales
- SQLite comme bus de notifications (table `notifications`)
- Polling 5 secondes via `useNotifications`
- Bannière animée slide-down sur tous les onglets (`NotifBanner`)
- Badge rouge sur l'onglet Suivi avec compteur (max "9+")

### Notation
- UI complète avec étoiles (1-5), tags prédéfinis, commentaire libre
- **Persistance non implémentée** (TODO : `persist rating to DB when backend ready`)

### Tarification dynamique
- 4 types de véhicules avec tarifs différents :
  - Fourgon : 45 DA/km + 500 DA prise en charge
  - Camion 3.5T : 65 DA/km + 800 DA
  - Camion 10T : 90 DA/km + 1200 DA
  - Semi-remorque : 130 DA/km + 2000 DA
- Surge pricing cumulatif (max 80%) :
  - Nuit (20h–6h) : +25%
  - Heure de pointe (7h–9h, 16h–19h) : +20%
  - Weekend (vendredi/samedi) : +15%
  - Forte demande (>10 demandes actives) : +30%
  - Jour férié : +35%
- Jours fériés algériens fixes + islamiques (2025-2026)
- Part transporteur : 85% (standard) ou 90% (si note > 4,5)

### Système d'annulations
- Compteur d'annulations par utilisateur (ce mois)
- Suspension automatique 7 jours après 3 annulations transporteur dans le mois
- Historique dans la table `annulations` avec motif et flag `gratuite`

---

## Base de données SQLite

Fichier : `dzexpress.db` (dans le répertoire data de l'app)

### Table `users`
| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `nom` | TEXT NOT NULL | Prénom + nom |
| `telephone` | TEXT NOT NULL | Format +213 |
| `wilaya` | TEXT NOT NULL | Nom de wilaya |
| `type` | TEXT NOT NULL | `'expediteur'` ou `'transporteur'` |
| `vehicule` | TEXT | `'fourgon'`, `'camion35'`, `'camion10'`, `'semi'` |
| `disponible` | INTEGER DEFAULT 1 | 0 ou 1 |
| `created_at` | TEXT | CURRENT_TIMESTAMP |
| `annulations_count` | INTEGER DEFAULT 0 | *migration* |
| `nb_annulations_mois` | INTEGER DEFAULT 0 | *migration* |
| `suspendu_jusqu_au` | TEXT | Date ISO suspension *migration* |
| `nb_annulations_expediteur_mois` | INTEGER DEFAULT 0 | *migration* |

### Table `demandes`
| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `expediteur_id` | INTEGER FK users | |
| `ville_depart` | TEXT NOT NULL | Commune ou wilaya |
| `ville_arrivee` | TEXT NOT NULL | |
| `description` | TEXT | Optionnel |
| `type_marchandise` | TEXT NOT NULL | `meubles`, `electromenager`, `cartons`, `materiaux`, `vehicule`, `autre` |
| `poids` | TEXT | Texte libre (ex: "500 kg") |
| `date_souhaitee` | TEXT NOT NULL | Format `"jj/mm/aaaa"` ou `"Maintenant"` |
| `type_demande` | TEXT DEFAULT `'planifie'` | `'planifie'` ou `'maintenant'` *migration* |
| `creneau` | TEXT | `'matin'`, `'apres-midi'`, `'soir'`, `'flexible'` *migration* |
| `statut` | TEXT DEFAULT `'en_attente'` | `en_attente`, `acceptee`, `en_cours`, `livree`, `annulee` |
| `transporteur_id` | INTEGER FK users | Rempli à l'acceptation |
| `transporteur_simule` | TEXT | JSON du transporteur fictif (mode Maintenant) *migration* |
| `created_at` | TEXT | |
| `accepted_at` | TEXT | Timestamp acceptation (pour grâce 5 min) *migration* |
| `prix_estime` | REAL | *migration* |
| `prix_final` | REAL | *migration* |
| `surge_coefficient` | REAL | *migration* |
| `options_supplementaires` | TEXT | JSON `{etages, aide, fragile, express}` *migration* |

### Table `offres`
| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `demande_id` | INTEGER FK demandes | |
| `transporteur_id` | INTEGER FK users | |
| `prix_propose` | REAL | |
| `message` | TEXT | |
| `statut` | TEXT DEFAULT `'en_attente'` | `en_attente`, `acceptee`, `refusee` |
| `created_at` | TEXT | |
| `contre_prix` | REAL | Contre-proposition *migration* |
| `nb_contre_propositions` | INTEGER DEFAULT 0 | *migration* |
| `dernier_negociateur` | TEXT | `'expediteur'` ou `'transporteur'` *migration* |

### Table `transporteurs_disponibles`
| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `user_id` | INTEGER FK users | NULL pour simulés |
| `nom` | TEXT NOT NULL | |
| `vehicule` | TEXT NOT NULL | |
| `rating` | REAL DEFAULT 4.0 | |
| `latitude` | REAL NOT NULL | |
| `longitude` | REAL NOT NULL | |
| `disponible` | INTEGER DEFAULT 1 | |
| `prix_min` | REAL | |
| `is_simule` | INTEGER DEFAULT 1 | 1 = fictif |
| `updated_at` | TEXT | |

### Table `notifications`
| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `user_id` | INTEGER FK users | |
| `message` | TEXT NOT NULL | |
| `lu` | INTEGER DEFAULT 0 | |
| `created_at` | TEXT | |

### Table `messages`
| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `demande_id` | INTEGER FK demandes | |
| `sender_id` | INTEGER FK users | |
| `contenu` | TEXT NOT NULL | Texte ou `'[Message vocal]'` |
| `lu` | INTEGER DEFAULT 0 | |
| `created_at` | TEXT | |
| `type` | TEXT DEFAULT `'text'` | `'text'` ou `'vocal'` *migration* |
| `uri_fichier` | TEXT | Chemin local audio *migration* |
| `duree` | INTEGER DEFAULT 0 | Durée en secondes *migration* |

### Table `tarifs`
| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `type_vehicule` | TEXT UNIQUE | |
| `prix_km` | REAL | |
| `prise_en_charge` | REAL | |
| `updated_at` | TEXT | |

### Table `gains_transporteur`
| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `transporteur_id` | INTEGER FK users | |
| `demande_id` | INTEGER FK demandes | |
| `montant` | REAL NOT NULL | Part transporteur après commission |
| `commission` | REAL NOT NULL | Part DzExpress |
| `date` | TEXT | |

### Table `annulations`
| Colonne | Type | Description |
|---|---|---|
| `id` | INTEGER PK AUTOINCREMENT | |
| `demande_id` | INTEGER FK demandes | |
| `user_id` | INTEGER FK users | |
| `role` | TEXT NOT NULL | `'expediteur'` ou `'transporteur'` |
| `motif` | TEXT | |
| `timestamp` | TEXT | |
| `gratuite` | INTEGER DEFAULT 0 | 1 si dans la grâce de 5 min |

### Système de migrations
Les colonnes ajoutées après la création initiale sont appliquées via un tableau de `ALTER TABLE` au démarrage. Chaque migration est enveloppée dans un `try/catch` (ignore si colonne existe déjà). **Ne pas modifier les migrations existantes** — ajouter un nouvel élément à la fin du tableau.

---

## Conventions de code

### Style général
- **Pas de TypeScript dans les écrans** — `.jsx` partout sauf les layouts (`_layout.tsx`)
- Styles via `StyleSheet.create` local dans chaque fichier — pas de fichier de styles partagé
- Palette de couleurs locale dans chaque fichier sous la constante `C` (même valeurs répétées partout — c'est voulu)
- Les constantes `WILAYAS`, `VEHICULES`, `TYPES_MARCHANDISE` sont répétées dans chaque écran qui en a besoin (pas d'import centralisé)

### Base de données
- Tout le CRUD SQLite est centralisé dans `src/db/database.js`
- API synchrone : `getFirstSync`, `getAllSync`, `runSync`, `execSync` (expo-sqlite v3)
- DB singleton via `getDB()` — jamais d'import direct de `SQLite.openDatabaseSync`
- Les modules d'accès sont exportés : `usersDB`, `demandesDB`, `offresDB`, `notifDB`, `messagesDB`, `gainsDB`, `annulationsDB`, `transpDispoDb`

### Navigation
- `expo-router` file-based — les routes dynamiques suivent `[id].jsx`
- Navigation via `useRouter()` puis `router.push('/route')` ou `router.replace()`
- Les onglets cachés ont `options={{ href: null }}`

### Polling (pas de WebSocket)
- Les mises à jour temps réel se font par polling SQLite local
- Messages : `setInterval(loadMessages, 3000)` dans `useFocusEffect`
- Notifications : `setInterval(poll, 5000)` dans `useNotifications`
- Messages badge : polling dans `useMessagesBadge`

### Couleurs principales
```js
blue:        '#1A56DB'  // transporteur, actions principales
blueDark:    '#1E40AF'  // header transporteur
blueLight:   '#EBF5FF'  // fond chips transporteur
orange:      '#F97316'  // expéditeur, mode urgent
orangeLight: '#FFF7ED'  // fond chips expéditeur
green:       '#16A34A'  // livré, succès
red:         '#DC2626'  // urgent, annulé, erreur
bg:          '#F8FAFC'  // fond général
border:      '#E2E8F0'  // séparateurs
```

---

## Ce qui reste à développer

### Priorité haute
- **Notation persistante** : `notation.jsx` a une UI complète mais le `submit()` ne sauvegarde rien (`// TODO: persist rating to DB when backend ready`) — créer une table `notations` et brancher
- **OTP réel** : actuellement le code est généré localement et affiché (`useState(() => String(Math.floor(...)))`). Brancher Firebase Phone Auth ou un service SMS (Twilio, etc.)
- **Vrai temps réel** : remplacer les pollings 3s/5s par des subscriptions Supabase Realtime ou Firebase Realtime DB
- **Push notifications** : `expo-device` et `expo-constants` sont installés, la base est là dans `src/lib/notifications.js` mais pas encore connectée

### Priorité moyenne
- **Supabase / backend** : les fichiers `src/lib/supabase.js` et `src/lib/firebase.js` existent. Migrer de SQLite local vers un backend partagé pour que expéditeurs et transporteurs sur des appareils différents voient les mêmes données
- **Vraie carte mode planifié** : actuellement la carte (`carte-transporteurs.jsx`) n'est accessible qu'en mode "Maintenant" avec des transporteurs simulés
- **Transporteurs réels sur la carte** : la table `transporteurs_disponibles` supporte les vrais utilisateurs (`is_simule = 0`) mais aucun vrai transporteur n'y est inséré
- **Messages/[id]** : le fichier `app/messages/[id].jsx` est une ancienne version du chat, à supprimer ou unifier avec `app/chat/[id].jsx`
- **Gestion paiement** : la tarification est calculée mais aucun paiement réel n'est implémenté (CIB/Edahabia)
- **Historique gains** : l'écran profil affiche des agrégats (jour/semaine/mois) mais pas le détail des courses
- **Filtres sur "Mes demandes"** : le filtre "Annulée" existe dans `STATUTS` mais pas dans la liste de filtres de `suivi.jsx`

### Priorité basse
- Thème sombre (app.json a `userInterfaceStyle: "automatic"` mais les couleurs sont codées en dur)
- Onboarding multi-comptes (actuellement un seul profil par appareil)
- Export/partage de preuve de livraison (la photo est prise mais non partagée)
- Internationalisation (arabe / tamazight)
- La table `tarifs` en DB n'est jamais alimentée (les tarifs sont codés en dur dans `pricing.js`)

---

## Bugs connus

1. **`useState` utilisé comme `useEffect`** (`app/(tabs)/index.jsx:616`) — `useState(() => { fetchDemandes(); }, [])` appelle fetch mais ne re-fetch pas quand les dépendances changent. Le re-fetch lors du changement de filtre urgence est géré manuellement dans `onUrgFilterChange`. Pas critique mais inhabituel.

2. **Duplication de la liste WILAYAS** — La liste des 48 wilayas est dupliquée dans `onboarding.jsx`, `index.jsx`, et `profil.jsx`. Si une wilaya change il faut la modifier partout.

3. **OTP non connecté** — L'écran OTP affiche le code en clair dans une bannière jaune ("Code : XXXX"). Il est complètement déconnecté du flux d'inscription (on peut s'inscrire sans valider son numéro).

4. **Notation non persistante** — L'écran de notation soumet mais ne sauvegarde rien (commentaire `// TODO` explicite dans le code).

5. **Messages vocaux locaux uniquement** — Les URIs audio (ex: `file:///data/...`) ne sont valides que sur l'appareil qui a enregistré. En mode offline mono-appareil ça marche, mais si on migre vers un backend, les vocaux ne seront pas accessibles à l'interlocuteur.

6. **Carte non disponible en mode planifié** — Le bouton "Voir les transporteurs" de l'écran expéditeur n'existe qu'en mode Maintenant. Il n'y a pas de carte pour le mode planifié.

7. **`messages/[id].jsx` obsolète** — Ce fichier existe mais la navigation va vers `chat/[id].jsx`. Il pourrait créer une confusion.

8. **Suspension transporteur** — `usersDB.checkAndSuspend` vérifie et suspend mais n'est pas appelé systématiquement à chaque annulation (seulement appelable manuellement depuis `course/[id]`).

---

## Commandes utiles

```bash
# Démarrer le serveur de dev Expo (QR code pour Expo Go)
npx expo start

# Lancer directement sur Android (émulateur ou appareil connecté)
npx expo start --android

# Lancer directement sur iOS (Mac requis)
npx expo start --ios

# Lancer en mode web
npx expo start --web

# Réinitialiser le projet (recrée app/ depuis le template Expo)
npm run reset-project

# Linter
npm run lint

# Build APK Android (EAS Build requis)
npx eas build --platform android --profile preview

# Build production Android
npx eas build --platform android --profile production
```

### Réinitialiser la base de données (en dev)
Il n'y a pas de commande dédiée. Pour repartir de zéro :
- Sur Android : désinstaller et réinstaller l'app, ou vider les données de l'app dans les paramètres
- Sur iOS : supprimer et réinstaller l'app
- La DB se recrée automatiquement avec toutes les tables au prochain démarrage via `initDatabase()`

### Tester sans vrai transporteur
L'app fonctionne en mono-utilisateur (un seul compte par appareil). Pour tester les deux rôles :
- Créer un compte expéditeur → publier une demande
- Déconnecter (Profil → Se déconnecter)
- Créer un compte transporteur → voir les demandes, faire une offre
- Etc.

---

## Notes importantes pour le développement

- **La DB est synchrone** — `expo-sqlite` v3 utilise des méthodes `*Sync`. Pas de `await` sur les requêtes SQLite, elles sont synchrones et bloquantes (MS range). Garder les requêtes simples.
- **Firebase non utilisé en production** — Le fichier `firebase.js` contient des vraies clés API mais l'auth Firebase n'est pas branchée au flux utilisateur. L'`auth` est exporté mais jamais appelé depuis les écrans.
- **Supabase non utilisé** — `src/lib/supabase.js` existe mais n'est importé nulle part.
- **`App.jsx` à la racine** — Ce fichier existe (`App.jsx`) mais est ignoré par expo-router (le point d'entrée est `app/_layout.tsx`).
- **`newArchEnabled: true`** — La nouvelle architecture React Native est activée. Faire attention aux libs incompatibles.
- **`reactCompiler: true`** — Le compilateur React est activé en mode expérimental. Si des bugs étranges apparaissent, essayer de le désactiver dans `app.json`.
