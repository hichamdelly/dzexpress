import * as SQLite from 'expo-sqlite';

let db = null;

export function getDB() {
  if (!db) db = SQLite.openDatabaseSync('dzexpress.db');
  return db;
}

export function initDatabase() {
  const d = getDB();
  d.execSync(`PRAGMA journal_mode = WAL;`);

  // ── Tables ───────────────────────────────────────────────
  d.execSync(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      nom        TEXT NOT NULL,
      telephone  TEXT NOT NULL,
      wilaya     TEXT NOT NULL,
      type       TEXT NOT NULL,
      vehicule   TEXT,
      disponible INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  d.execSync(`
    CREATE TABLE IF NOT EXISTS demandes (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      expediteur_id       INTEGER NOT NULL REFERENCES users(id),
      ville_depart        TEXT NOT NULL,
      ville_arrivee       TEXT NOT NULL,
      description         TEXT,
      type_marchandise    TEXT NOT NULL,
      poids               TEXT,
      date_souhaitee      TEXT NOT NULL,
      type_demande        TEXT NOT NULL DEFAULT 'planifie',
      creneau             TEXT,
      statut              TEXT NOT NULL DEFAULT 'en_attente',
      transporteur_id     INTEGER REFERENCES users(id),
      transporteur_simule TEXT,
      created_at          TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  d.execSync(`
    CREATE TABLE IF NOT EXISTS offres (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      demande_id      INTEGER NOT NULL REFERENCES demandes(id),
      transporteur_id INTEGER NOT NULL REFERENCES users(id),
      prix_propose    REAL,
      message         TEXT,
      statut          TEXT NOT NULL DEFAULT 'en_attente',
      created_at      TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  d.execSync(`
    CREATE TABLE IF NOT EXISTS transporteurs_disponibles (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER REFERENCES users(id),
      nom        TEXT NOT NULL,
      vehicule   TEXT NOT NULL,
      rating     REAL DEFAULT 4.0,
      latitude   REAL NOT NULL,
      longitude  REAL NOT NULL,
      disponible INTEGER DEFAULT 1,
      prix_min   REAL,
      is_simule  INTEGER DEFAULT 1,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  d.execSync(`
    CREATE TABLE IF NOT EXISTS notifications (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      message    TEXT NOT NULL,
      lu         INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  d.execSync(`
    CREATE TABLE IF NOT EXISTS messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      demande_id INTEGER NOT NULL REFERENCES demandes(id),
      sender_id  INTEGER NOT NULL REFERENCES users(id),
      contenu    TEXT NOT NULL,
      lu         INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  d.execSync(`
    CREATE TABLE IF NOT EXISTS tarifs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      type_vehicule   TEXT NOT NULL UNIQUE,
      prix_km         REAL NOT NULL,
      prise_en_charge REAL NOT NULL,
      updated_at      TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  d.execSync(`
    CREATE TABLE IF NOT EXISTS gains_transporteur (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      transporteur_id INTEGER NOT NULL REFERENCES users(id),
      demande_id      INTEGER REFERENCES demandes(id),
      montant         REAL NOT NULL,
      commission      REAL NOT NULL,
      date            TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  d.execSync(`
    CREATE TABLE IF NOT EXISTS annulations (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      demande_id INTEGER NOT NULL REFERENCES demandes(id),
      user_id    INTEGER NOT NULL REFERENCES users(id),
      role       TEXT NOT NULL,
      motif      TEXT,
      timestamp  TEXT DEFAULT CURRENT_TIMESTAMP,
      gratuite   INTEGER DEFAULT 0
    );
  `);

  // ── Migrations colonnes ajoutées ──────────────────────────
  const migrations = [
    `ALTER TABLE demandes ADD COLUMN type_demande TEXT NOT NULL DEFAULT 'planifie'`,
    `ALTER TABLE demandes ADD COLUMN creneau TEXT`,
    `ALTER TABLE demandes ADD COLUMN transporteur_simule TEXT`,
    `ALTER TABLE users ADD COLUMN annulations_count INTEGER DEFAULT 0`,
    `ALTER TABLE demandes ADD COLUMN accepted_at TEXT`,
    `ALTER TABLE users ADD COLUMN nb_annulations_mois INTEGER DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN suspendu_jusqu_au TEXT`,
    `ALTER TABLE users ADD COLUMN nb_annulations_expediteur_mois INTEGER DEFAULT 0`,
    `ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'text'`,
    `ALTER TABLE messages ADD COLUMN uri_fichier TEXT`,
    `ALTER TABLE messages ADD COLUMN duree INTEGER DEFAULT 0`,
    `ALTER TABLE demandes ADD COLUMN prix_estime REAL`,
    `ALTER TABLE demandes ADD COLUMN prix_final REAL`,
    `ALTER TABLE demandes ADD COLUMN surge_coefficient REAL`,
    `ALTER TABLE demandes ADD COLUMN options_supplementaires TEXT`,
    `ALTER TABLE offres ADD COLUMN contre_prix REAL`,
    `ALTER TABLE offres ADD COLUMN nb_contre_propositions INTEGER DEFAULT 0`,
    `ALTER TABLE offres ADD COLUMN dernier_negociateur TEXT`,
    `ALTER TABLE demandes ADD COLUMN sous_categorie TEXT`,
    `ALTER TABLE demandes ADD COLUMN vehicule_recommande TEXT`,
    `ALTER TABLE demandes ADD COLUMN avertissement_affiche INTEGER DEFAULT 0`,
    `ALTER TABLE notifications ADD COLUMN type TEXT DEFAULT 'info'`,
    `ALTER TABLE notifications ADD COLUMN data_json TEXT`,
    `ALTER TABLE users ADD COLUMN telephone_verifie INTEGER DEFAULT 1`,
    `ALTER TABLE demandes ADD COLUMN dispatch_simule TEXT`,
    `ALTER TABLE demandes ADD COLUMN simule_dispatch_at TEXT`,
    `ALTER TABLE users ADD COLUMN heure_mise_en_ligne TEXT`,
    `ALTER TABLE demandes ADD COLUMN heure_souhaitee TEXT`,
    // Suivi GPS temps réel (voir src/lib/tracking.js) — position live du
    // transporteur pendant que statut = 'en_route'.
    `ALTER TABLE demandes ADD COLUMN transporteur_lat REAL`,
    `ALTER TABLE demandes ADD COLUMN transporteur_lng REAL`,
    `ALTER TABLE demandes ADD COLUMN position_updated_at TEXT`,
    // Paiement (voir app/paiement/[id].jsx)
    `ALTER TABLE demandes ADD COLUMN mode_paiement TEXT DEFAULT 'cash'`,
    `ALTER TABLE demandes ADD COLUMN statut_paiement TEXT DEFAULT 'en_attente'`,
    `ALTER TABLE demandes ADD COLUMN reference_paiement TEXT`,
    // Infos bancaires transporteur (BaridiMob) — voir app/(tabs)/profil.jsx
    `ALTER TABLE users ADD COLUMN ccp_numero TEXT`,
    `ALTER TABLE users ADD COLUMN ccp_cle TEXT`,
    // Horodatage du passage à "en_route" — ancre le trajet simulé (voir
    // src/lib/simulationTrajet.js) sur un temps partagé plutôt que sur un
    // compteur local à chaque écran, pour que la position affichée soit
    // cohérente entre app/(tabs)/index.jsx et app/suivi-live/[id].jsx.
    `ALTER TABLE demandes ADD COLUMN en_route_at TEXT`,
  ];
  // Table cache des coordonnées GPS précises par commune (voir
  // src/utils/distance.js) — alimentée en tâche de fond via géocodage,
  // pour affiner les distances au-delà de l'approximation par wilaya.
  try {
    d.execSync(`
      CREATE TABLE IF NOT EXISTS commune_coords (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        commune    TEXT NOT NULL,
        wilaya     TEXT NOT NULL,
        latitude   REAL NOT NULL,
        longitude  REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(commune, wilaya)
      );
    `);
  } catch (_) {}
  // Table signalements (aide & support)
  try {
    d.execSync(`
      CREATE TABLE IF NOT EXISTS signalements (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id    INTEGER REFERENCES users(id),
        type       TEXT NOT NULL,
        description TEXT NOT NULL,
        statut     TEXT DEFAULT 'ouvert',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (_) {}
  for (const sql of migrations) {
    try { d.execSync(sql); } catch (_) {}
  }

  // Table créneaux bloqués (agenda transporteur)
  try {
    d.execSync(`
      CREATE TABLE IF NOT EXISTS creneaux_bloques (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        transporteur_id INTEGER NOT NULL REFERENCES users(id),
        date            TEXT NOT NULL,
        creneau         TEXT NOT NULL,
        created_at      TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(transporteur_id, date, creneau)
      );
    `);
  } catch (_) {}

  // ── Tables admin ─────────────────────────────────────────────
  try {
    d.execSync(`
      CREATE TABLE IF NOT EXISTS logs_admin (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        gestionnaire_id INTEGER REFERENCES users(id),
        action          TEXT NOT NULL,
        details         TEXT,
        created_at      TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (_) {}

  try {
    d.execSync(`
      CREATE TABLE IF NOT EXISTS config_app (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        cle        TEXT NOT NULL UNIQUE,
        valeur     TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (_) {}

  try {
    d.execSync(`
      CREATE TABLE IF NOT EXISTS documents_transporteur (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        transporteur_id INTEGER NOT NULL REFERENCES users(id),
        type_doc        TEXT NOT NULL,
        uri             TEXT,
        statut          TEXT DEFAULT 'en_attente',
        motif_rejet     TEXT,
        created_at      TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (_) {}

  // ── Migrations admin ─────────────────────────────────────────
  const adminMigrations = [
    `ALTER TABLE users ADD COLUMN mot_de_passe TEXT`,
    `ALTER TABLE users ADD COLUMN validation_statut TEXT DEFAULT 'en_attente'`,
    `ALTER TABLE users ADD COLUMN motif_rejet_transporteur TEXT`,
    `ALTER TABLE signalements ADD COLUMN user_nom TEXT`,
    `ALTER TABLE signalements ADD COLUMN demande_id INTEGER`,
  ];
  for (const sql of adminMigrations) {
    try { d.execSync(sql); } catch (_) {}
  }

  // ── Compte gestionnaire par défaut ────────────────────────────
  try {
    const admin = d.getFirstSync(`SELECT id FROM users WHERE type='gestionnaire' LIMIT 1`);
    if (!admin) {
      d.runSync(
        `INSERT INTO users (nom, telephone, wilaya, type, mot_de_passe)
         VALUES (?,?,?,?,?)`,
        ['Admin RouteX', '+213555000000', 'Alger', 'gestionnaire', 'admin123']
      );
    }
  } catch (_) {}

  // ── Tarifs par défaut dans config_app ────────────────────────
  const defaultTarifs = [
    ['tarif_fourgon_km', '45'],  ['tarif_fourgon_pec', '500'],
    ['tarif_camion35_km', '65'], ['tarif_camion35_pec', '800'],
    ['tarif_camion10_km', '90'], ['tarif_camion10_pec', '1200'],
    ['tarif_semi_km', '130'],    ['tarif_semi_pec', '2000'],
  ];
  for (const [cle, valeur] of defaultTarifs) {
    try { d.runSync(`INSERT OR IGNORE INTO config_app (cle, valeur) VALUES (?,?)`, [cle, valeur]); } catch (_) {}
  }
}

// ── USERS ────────────────────────────────────────────────────
export const usersDB = {
  getById: (id) =>
    getDB().getFirstSync('SELECT * FROM users WHERE id = ?', [id]),

  create: ({ nom, telephone, wilaya, type, vehicule = null, disponible = 1 }) => {
    const r = getDB().runSync(
      `INSERT INTO users (nom, telephone, wilaya, type, vehicule, disponible)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nom, telephone, wilaya, type, vehicule, disponible]
    );
    return r.lastInsertRowId;
  },

  update: (id, { nom, telephone, wilaya, vehicule = null, disponible = 1 }) => {
    getDB().runSync(
      `UPDATE users SET nom=?, telephone=?, wilaya=?, vehicule=?, disponible=? WHERE id=?`,
      [nom, telephone, wilaya, vehicule, disponible, id]
    );
  },

  // Infos bancaires transporteur (BaridiMob) — voir app/(tabs)/profil.jsx
  // et app/paiement/[id].jsx
  updateCCP: (id, { ccp_numero, ccp_cle }) =>
    getDB().runSync(
      `UPDATE users SET ccp_numero=?, ccp_cle=? WHERE id=?`,
      [ccp_numero || null, ccp_cle || null, id]
    ),

  getAnnulations: (id) =>
    getDB().getFirstSync(
      `SELECT annulations_count FROM users WHERE id = ?`, [id]
    )?.annulations_count ?? 0,

  incrementAnnulations: (id) =>
    getDB().runSync(
      `UPDATE users SET annulations_count = annulations_count + 1 WHERE id = ?`, [id]
    ),

  isSuspended: (id) => {
    const u = getDB().getFirstSync(`SELECT suspendu_jusqu_au FROM users WHERE id = ?`, [id]);
    if (!u?.suspendu_jusqu_au) return null;
    return new Date(u.suspendu_jusqu_au) > new Date() ? u.suspendu_jusqu_au : null;
  },

  // Suspend 7 jours si >= 3 annulations ce mois-ci ; retourne la date ou null
  getAllTransporteurs: () =>
    getDB().getAllSync(`SELECT id FROM users WHERE type = 'transporteur'`),

  setDisponible: (id, disponible, heureISO = null) =>
    getDB().runSync(
      `UPDATE users SET disponible=?, heure_mise_en_ligne=? WHERE id=?`,
      [disponible, heureISO, id]
    ),

  countTransporteursDisponibles: () => {
    const row = getDB().getFirstSync(
      `SELECT COUNT(*) AS n FROM users WHERE type='transporteur' AND disponible=1 AND telephone_verifie=1`
    );
    return row?.n ?? 0;
  },

  checkAndSuspend: (userId) => {
    const count = getDB().getFirstSync(
      `SELECT COUNT(*) AS n FROM annulations
       WHERE user_id = ? AND role = 'transporteur'
       AND strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')`,
      [userId]
    )?.n ?? 0;
    if (count >= 3) {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      const dateStr = d.toISOString().split('T')[0];
      getDB().runSync(`UPDATE users SET suspendu_jusqu_au = ? WHERE id = ?`, [dateStr, userId]);
      return dateStr;
    }
    return null;
  },
};

// ── DEMANDES ─────────────────────────────────────────────────
export const demandesDB = {
  getById: (id) =>
    getDB().getFirstSync(
      `SELECT d.*,
              e.nom        AS expediteur_nom,
              e.telephone  AS expediteur_tel,
              e.wilaya     AS expediteur_wilaya,
              t.nom        AS transporteur_nom,
              t.telephone  AS transporteur_tel,
              t.vehicule   AS transporteur_vehicule
       FROM demandes d
       JOIN users e ON d.expediteur_id = e.id
       LEFT JOIN users t ON d.transporteur_id = t.id
       WHERE d.id = ?`,
      [id]
    ),

  getByExpediteur: (userId) =>
    getDB().getAllSync(
      `SELECT d.*,
              t.nom       AS transporteur_nom,
              t.telephone AS transporteur_tel,
              t.vehicule  AS transporteur_vehicule,
              (SELECT COUNT(*) FROM offres o WHERE o.demande_id = d.id AND o.statut = 'en_attente') AS nb_offres
       FROM demandes d
       LEFT JOIN users t ON d.transporteur_id = t.id
       WHERE d.expediteur_id = ?
       ORDER BY CASE WHEN d.type_demande='maintenant' THEN 0 ELSE 1 END, d.created_at DESC`,
      [userId]
    ),

  getDisponibles: (typeFilter = null) => {
    const where = typeFilter
      ? `WHERE d.statut = 'en_attente' AND d.type_demande = '${typeFilter}'`
      : `WHERE d.statut = 'en_attente'`;
    return getDB().getAllSync(
      `SELECT d.*,
              e.nom       AS expediteur_nom,
              e.telephone AS expediteur_tel,
              e.wilaya    AS expediteur_wilaya,
              (SELECT COUNT(*) FROM offres o WHERE o.demande_id = d.id) AS nb_offres
       FROM demandes d
       JOIN users e ON d.expediteur_id = e.id
       ${where}
       ORDER BY CASE WHEN d.type_demande='maintenant' THEN 0 ELSE 1 END, d.created_at DESC`
    );
  },

  getByTransporteur: (userId) =>
    getDB().getAllSync(
      `SELECT d.*, e.nom AS expediteur_nom, e.telephone AS expediteur_tel
       FROM demandes d
       JOIN users e ON d.expediteur_id = e.id
       WHERE d.transporteur_id = ?
       ORDER BY d.created_at DESC`,
      [userId]
    ),

  create: ({ expediteur_id, ville_depart, ville_arrivee, description,
             type_marchandise, poids, date_souhaitee,
             type_demande = 'planifie', creneau = null, heure_souhaitee = null,
             prix_estime = null, surge_coefficient = null,
             options_supplementaires = null,
             sous_categorie = null, vehicule_recommande = null,
             avertissement_affiche = 0 }) => {
    const r = getDB().runSync(
      `INSERT INTO demandes
         (expediteur_id, ville_depart, ville_arrivee, description,
          type_marchandise, poids, date_souhaitee, type_demande, creneau, heure_souhaitee,
          prix_estime, surge_coefficient, options_supplementaires,
          sous_categorie, vehicule_recommande, avertissement_affiche)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [expediteur_id, ville_depart, ville_arrivee, description || null,
       type_marchandise, poids || null, date_souhaitee, type_demande, creneau || null, heure_souhaitee || null,
       prix_estime, surge_coefficient, options_supplementaires,
       sous_categorie, vehicule_recommande, avertissement_affiche]
    );
    return r.lastInsertRowId;
  },

  setPrixFinal: (id, prixFinal) =>
    getDB().runSync(`UPDATE demandes SET prix_final=? WHERE id=?`, [prixFinal, id]),

  countActives: () =>
    getDB().getFirstSync(
      `SELECT COUNT(*) AS n FROM demandes WHERE statut='en_attente'`
    )?.n ?? 0,

  // Pour mode Maintenant : crée la demande et associe un transporteur simulé
  createMaintenant: ({ expediteur_id, ville_depart, ville_arrivee,
                        type_marchandise, poids, description, transporteur_simule,
                        vehicule_recommande = null }) => {
    const r = getDB().runSync(
      `INSERT INTO demandes
         (expediteur_id, ville_depart, ville_arrivee, type_marchandise,
          poids, description, date_souhaitee, type_demande, transporteur_simule,
          vehicule_recommande)
       VALUES (?, ?, ?, ?, ?, ?, 'Maintenant', 'maintenant', ?, ?)`,
      [expediteur_id, ville_depart, ville_arrivee, type_marchandise,
       poids || null, description || null, JSON.stringify(transporteur_simule),
       vehicule_recommande]
    );
    return r.lastInsertRowId;
  },

  updateStatut: (id, statut, transporteur_id = undefined) => {
    if (transporteur_id !== undefined) {
      const sql = statut === 'acceptee'
        ? `UPDATE demandes SET statut=?, transporteur_id=?, accepted_at=datetime('now') WHERE id=?`
        : `UPDATE demandes SET statut=?, transporteur_id=? WHERE id=?`;
      getDB().runSync(sql, [statut, transporteur_id, id]);
    } else {
      const sql = statut === 'en_route'
        ? `UPDATE demandes SET statut=?, en_route_at=datetime('now') WHERE id=?`
        : `UPDATE demandes SET statut=? WHERE id=?`;
      getDB().runSync(sql, [statut, id]);
    }
  },

  // Position GPS live du transporteur (suivi temps réel, voir src/lib/tracking.js)
  updatePosition: (id, latitude, longitude) =>
    getDB().runSync(
      `UPDATE demandes SET transporteur_lat=?, transporteur_lng=?, position_updated_at=datetime('now') WHERE id=?`,
      [latitude, longitude, id]
    ),

  // Paiement (voir app/paiement/[id].jsx et app/course/[id].jsx)
  setModePaiement: (id, mode) =>
    getDB().runSync(`UPDATE demandes SET mode_paiement=? WHERE id=?`, [mode, id]),

  confirmerPaiement: (id, { mode, reference = null } = {}) =>
    getDB().runSync(
      `UPDATE demandes SET statut_paiement='confirme', mode_paiement=COALESCE(?, mode_paiement), reference_paiement=? WHERE id=?`,
      [mode || null, reference, id]
    ),

  // Remet la demande en attente quand le transporteur annule
  annulerParTransporteur: (id) =>
    getDB().runSync(
      `UPDATE demandes SET statut='en_attente', transporteur_id=NULL, accepted_at=NULL WHERE id=?`, [id]
    ),

  // Simulation dispatch : demandes planifiées en attente non encore dispatché
  getDispatchReady: () =>
    getDB().getAllSync(
      `SELECT d.*, e.nom AS expediteur_nom FROM demandes d
       JOIN users e ON d.expediteur_id = e.id
       WHERE d.type_demande='planifie' AND d.statut='en_attente' AND d.dispatch_simule IS NULL`
    ),

  markDispatched: (id) =>
    getDB().runSync(
      `UPDATE demandes SET dispatch_simule='dispatched', simule_dispatch_at=datetime('now') WHERE id=?`, [id]
    ),

  // Demandes dispatché depuis plus de 2 minutes → auto-acceptation
  getReadyForAutoAccept: () =>
    getDB().getAllSync(
      `SELECT * FROM demandes
       WHERE dispatch_simule='dispatched' AND statut='en_attente'
         AND simule_dispatch_at <= datetime('now', '-2 minutes')`
    ),

  markAutoAccepted: (id) =>
    getDB().runSync(
      `UPDATE demandes SET dispatch_simule='auto_acceptee' WHERE id=?`, [id]
    ),

  // Pour l'agenda : courses d'un transporteur dans une plage de dates
  getForAgenda: (transporteurId) =>
    getDB().getAllSync(
      `SELECT d.*, e.nom AS expediteur_nom FROM demandes d
       JOIN users e ON d.expediteur_id = e.id
       WHERE d.transporteur_id = ? AND d.statut IN ('acceptee','en_cours','livree')
       ORDER BY d.date_souhaitee ASC, d.creneau ASC`,
      [transporteurId]
    ),

  // Planifiées proches (dans les 48h) disponibles = "Courses à venir"
  getPlanifieesProchaines: () =>
    getDB().getAllSync(
      `SELECT d.*, e.nom AS expediteur_nom,
              (SELECT COUNT(*) FROM offres o WHERE o.demande_id=d.id) AS nb_offres
       FROM demandes d
       JOIN users e ON d.expediteur_id = e.id
       WHERE d.type_demande='planifie' AND d.statut='en_attente'
       ORDER BY d.date_souhaitee ASC, d.creneau ASC`
    ),
};

// ── OFFRES ───────────────────────────────────────────────────
export const offresDB = {
  getByDemande: (demandeId) =>
    getDB().getAllSync(
      `SELECT o.*,
              t.nom      AS transporteur_nom,
              t.telephone AS transporteur_tel,
              t.vehicule  AS transporteur_vehicule,
              t.wilaya    AS transporteur_wilaya
       FROM offres o
       JOIN users t ON o.transporteur_id = t.id
       WHERE o.demande_id = ?
       ORDER BY
         CASE WHEN o.statut = 'acceptee' THEN 0 ELSE 1 END,
         CASE WHEN o.prix_propose IS NULL THEN 1 ELSE 0 END,
         o.prix_propose ASC`,
      [demandeId]
    ),

  getByTransporteur: (userId) =>
    getDB().getAllSync(
      `SELECT o.*, d.ville_depart, d.ville_arrivee, d.type_marchandise,
              d.date_souhaitee, d.type_demande, d.statut AS demande_statut
       FROM offres o
       JOIN demandes d ON o.demande_id = d.id
       WHERE o.transporteur_id = ?
       ORDER BY o.created_at DESC`,
      [userId]
    ),

  getMyOffer: (demandeId, transporteurId) =>
    getDB().getFirstSync(
      `SELECT * FROM offres WHERE demande_id = ? AND transporteur_id = ?`,
      [demandeId, transporteurId]
    ),

  create: ({ demande_id, transporteur_id, prix_propose = null, message = null }) => {
    const r = getDB().runSync(
      `INSERT INTO offres (demande_id, transporteur_id, prix_propose, message)
       VALUES (?, ?, ?, ?)`,
      [demande_id, transporteur_id, prix_propose, message || null]
    );
    return r.lastInsertRowId;
  },

  // Accepte UNE offre et refuse toutes les autres pour la même demande
  accepter: (offreId, demandeId, transporteurId) => {
    getDB().runSync(`UPDATE offres SET statut='refusee' WHERE demande_id=?`, [demandeId]);
    getDB().runSync(`UPDATE offres SET statut='acceptee' WHERE id=?`, [offreId]);
    demandesDB.updateStatut(demandeId, 'acceptee', transporteurId);
  },

  updateStatut: (id, statut) =>
    getDB().runSync(`UPDATE offres SET statut=? WHERE id=?`, [statut, id]),

  contreProposer: (offreId, prix, negociateur) =>
    getDB().runSync(
      `UPDATE offres SET contre_prix=?,
         nb_contre_propositions=nb_contre_propositions+1,
         dernier_negociateur=?
       WHERE id=?`,
      [prix, negociateur, offreId]
    ),
};

// ── TRANSPORTEURS DISPONIBLES ────────────────────────────────
export const transpDispoDb = {
  upsertSimules: (list) => {
    const d = getDB();
    d.runSync(`DELETE FROM transporteurs_disponibles WHERE is_simule = 1`);
    for (const t of list) {
      d.runSync(
        `INSERT INTO transporteurs_disponibles
           (nom, vehicule, rating, latitude, longitude, disponible, prix_min, is_simule)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
        [t.nom, t.vehicule, t.rating, t.latitude, t.longitude, t.disponible ? 1 : 0, t.prix_estime]
      );
    }
  },

  getAll: () =>
    getDB().getAllSync(`SELECT * FROM transporteurs_disponibles ORDER BY disponible DESC`),
};

// ── NOTIFICATIONS ────────────────────────────────────────────
export const notifDB = {
  getByUser: (userId) =>
    getDB().getAllSync(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
      [userId]
    ),

  create: (userId, message, type = 'info', data = null) =>
    getDB().runSync(
      `INSERT INTO notifications (user_id, message, type, data_json) VALUES (?, ?, ?, ?)`,
      [userId, message, type || 'info', data ? JSON.stringify(data) : null]
    ),

  countUnread: (userId) =>
    getDB().getFirstSync(
      `SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND lu = 0`,
      [userId]
    )?.n ?? 0,

  markRead: (id) =>
    getDB().runSync(`UPDATE notifications SET lu = 1 WHERE id = ?`, [id]),

  markAllRead: (userId) =>
    getDB().runSync(`UPDATE notifications SET lu = 1 WHERE user_id = ?`, [userId]),
};

// ── MESSAGES ─────────────────────────────────────────────────
export const messagesDB = {
  getByDemande: (demandeId) =>
    getDB().getAllSync(
      `SELECT m.*, u.nom AS sender_nom, u.type AS sender_type
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.demande_id = ?
       ORDER BY m.created_at ASC`,
      [demandeId]
    ),

  create: (demandeId, senderId, contenu) =>
    getDB().runSync(
      `INSERT INTO messages (demande_id, sender_id, contenu) VALUES (?, ?, ?)`,
      [demandeId, senderId, contenu]
    ),

  createVoice: (demandeId, senderId, uri, duree = 0) =>
    getDB().runSync(
      `INSERT INTO messages (demande_id, sender_id, contenu, type, uri_fichier, duree)
       VALUES (?, ?, '[Message vocal]', 'vocal', ?, ?)`,
      [demandeId, senderId, uri, Math.round(duree)]
    ),

  markRead: (demandeId, userId) =>
    getDB().runSync(
      `UPDATE messages SET lu = 1
       WHERE demande_id = ? AND sender_id != ? AND lu = 0`,
      [demandeId, userId]
    ),

  countUnreadTotal: (userId) =>
    getDB().getFirstSync(
      `SELECT COUNT(*) AS n FROM messages m
       JOIN demandes d ON m.demande_id = d.id
       WHERE m.lu = 0 AND m.sender_id != ?
         AND (d.expediteur_id = ? OR d.transporteur_id = ?)`,
      [userId, userId, userId]
    )?.n ?? 0,

  countUnreadForDemande: (demandeId, userId) =>
    getDB().getFirstSync(
      `SELECT COUNT(*) AS n FROM messages
       WHERE demande_id = ? AND sender_id != ? AND lu = 0`,
      [demandeId, userId]
    )?.n ?? 0,

  getConversations: (userId) =>
    getDB().getAllSync(
      `SELECT d.id, d.ville_depart, d.ville_arrivee, d.statut,
              d.expediteur_id, d.transporteur_id,
              e.nom AS expediteur_nom,
              t.nom AS transporteur_nom, t.vehicule AS transporteur_vehicule,
              (SELECT contenu    FROM messages WHERE demande_id = d.id ORDER BY created_at DESC LIMIT 1) AS last_message,
              (SELECT created_at FROM messages WHERE demande_id = d.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
              (SELECT COUNT(*)   FROM messages WHERE demande_id = d.id AND sender_id != ? AND lu = 0)    AS nb_unread
       FROM demandes d
       JOIN  users e ON d.expediteur_id  = e.id
       LEFT JOIN users t ON d.transporteur_id = t.id
       WHERE EXISTS (SELECT 1 FROM messages WHERE demande_id = d.id)
         AND (d.expediteur_id = ? OR d.transporteur_id = ?)
       ORDER BY last_message_at DESC`,
      [userId, userId, userId]
    ),
};

// ── GAINS TRANSPORTEUR ───────────────────────────────────────
export const gainsDB = {
  create: ({ transporteur_id, demande_id, montant, commission }) =>
    getDB().runSync(
      `INSERT INTO gains_transporteur (transporteur_id, demande_id, montant, commission)
       VALUES (?, ?, ?, ?)`,
      [transporteur_id, demande_id, montant, commission]
    ),

  getStats: (userId) => {
    const d = getDB();
    const today     = new Date().toISOString().split('T')[0];
    const weekStart = (() => { const w = new Date(); w.setDate(w.getDate() - ((w.getDay() + 1) % 7)); return w.toISOString().split('T')[0]; })();
    const monthStr  = `${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-01`;

    return {
      today:    d.getFirstSync(`SELECT COALESCE(SUM(montant),0) AS t FROM gains_transporteur WHERE transporteur_id=? AND date(date)=?`,         [userId, today])?.t     ?? 0,
      semaine:  d.getFirstSync(`SELECT COALESCE(SUM(montant),0) AS t FROM gains_transporteur WHERE transporteur_id=? AND date(date)>=?`,        [userId, weekStart])?.t  ?? 0,
      mois:     d.getFirstSync(`SELECT COALESCE(SUM(montant),0) AS t FROM gains_transporteur WHERE transporteur_id=? AND date(date)>=?`,        [userId, monthStr])?.t   ?? 0,
      total:    d.getFirstSync(`SELECT COALESCE(SUM(montant),0) AS t FROM gains_transporteur WHERE transporteur_id=?`,                          [userId])?.t             ?? 0,
      nbCourses:d.getFirstSync(`SELECT COUNT(*) AS n FROM gains_transporteur WHERE transporteur_id=?`,                                           [userId])?.n             ?? 0,
    };
  },

  // Répartition prix/commission déjà enregistrée pour une course donnée
  // (voir app/paiement/[id].jsx) — écrite une fois à la livraison
  // (app/course/[id].jsx, confirmLivraison), source de vérité plutôt
  // que de recalculer via partTransporteur().
  getByDemande: (demandeId) =>
    getDB().getFirstSync(
      `SELECT * FROM gains_transporteur WHERE demande_id = ? ORDER BY id DESC LIMIT 1`,
      [demandeId]
    ) || null,

  getStatToday: (userId) => {
    const today = new Date().toISOString().split('T')[0];
    const d = getDB();
    return {
      gains:   d.getFirstSync(`SELECT COALESCE(SUM(montant),0) AS t FROM gains_transporteur WHERE transporteur_id=? AND date(date)=?`, [userId, today])?.t ?? 0,
      courses: d.getFirstSync(`SELECT COUNT(*) AS n FROM gains_transporteur WHERE transporteur_id=? AND date(date)=?`, [userId, today])?.n ?? 0,
    };
  },
};

// ── AGENDA (créneaux bloqués) ────────────────────────────────
export const agendaDB = {
  getByTransporteur: (transporteurId) =>
    getDB().getAllSync(
      `SELECT * FROM creneaux_bloques WHERE transporteur_id=? ORDER BY date ASC, creneau ASC`,
      [transporteurId]
    ),

  bloquer: (transporteurId, date, creneau) => {
    try {
      getDB().runSync(
        `INSERT OR IGNORE INTO creneaux_bloques (transporteur_id, date, creneau) VALUES (?,?,?)`,
        [transporteurId, date, creneau]
      );
    } catch (_) {}
  },

  debloquer: (transporteurId, date, creneau) =>
    getDB().runSync(
      `DELETE FROM creneaux_bloques WHERE transporteur_id=? AND date=? AND creneau=?`,
      [transporteurId, date, creneau]
    ),

  isBloquer: (transporteurId, date, creneau) =>
    (getDB().getFirstSync(
      `SELECT 1 FROM creneaux_bloques WHERE transporteur_id=? AND date=? AND creneau=?`,
      [transporteurId, date, creneau]
    ) != null),
};

// ── SIGNALEMENTS ─────────────────────────────────────────────
export const signalementsDB = {
  create: ({ user_id, type, description }) =>
    getDB().runSync(
      `INSERT INTO signalements (user_id, type, description) VALUES (?, ?, ?)`,
      [user_id || null, type, description]
    ),

  getByUser: (userId) =>
    getDB().getAllSync(
      `SELECT * FROM signalements WHERE user_id=? ORDER BY created_at DESC`,
      [userId]
    ),

  getAll: () =>
    getDB().getAllSync(
      `SELECT s.*, u.nom AS user_nom, u.telephone AS user_tel
       FROM signalements s LEFT JOIN users u ON s.user_id=u.id ORDER BY s.created_at DESC`
    ),

  traiter: (id) =>
    getDB().runSync(`UPDATE signalements SET statut='traite' WHERE id=?`, [id]),
};

// ── ADMIN ────────────────────────────────────────────────────
export const adminDB = {
  login: (telephone, motDePasse) =>
    getDB().getFirstSync(
      `SELECT * FROM users WHERE telephone=? AND mot_de_passe=? AND type='gestionnaire'`,
      [telephone, motDePasse]
    ),

  kpisJour: () => {
    const d = getDB();
    const today = new Date().toISOString().split('T')[0];
    const coursesJour     = d.getFirstSync(`SELECT COUNT(*) AS n FROM demandes WHERE date(created_at)=?`, [today])?.n ?? 0;
    const coursesCompletes = d.getFirstSync(`SELECT COUNT(*) AS n FROM demandes WHERE statut='livree' AND date(created_at)=?`, [today])?.n ?? 0;
    const caJour          = d.getFirstSync(`SELECT COALESCE(SUM(montant+commission),0) AS t FROM gains_transporteur WHERE date(date)=?`, [today])?.t ?? 0;
    const nouveauxUsers   = d.getFirstSync(`SELECT COUNT(*) AS n FROM users WHERE date(created_at)=? AND type!='gestionnaire'`, [today])?.n ?? 0;
    return { coursesJour, coursesCompletes, caJour, nouveauxUsers };
  },

  statsGlobales: () => {
    const d = getDB();
    const totalExp   = d.getFirstSync(`SELECT COUNT(*) AS n FROM users WHERE type='expediteur'`)?.n ?? 0;
    const totalTrans = d.getFirstSync(`SELECT COUNT(*) AS n FROM users WHERE type='transporteur'`)?.n ?? 0;
    const total      = d.getFirstSync(`SELECT COUNT(*) AS n FROM demandes`)?.n ?? 0;
    const completes  = d.getFirstSync(`SELECT COUNT(*) AS n FROM demandes WHERE statut='livree'`)?.n ?? 0;
    const annulees   = d.getFirstSync(`SELECT COUNT(*) AS n FROM demandes WHERE statut='annulee'`)?.n ?? 0;
    const caTotal    = d.getFirstSync(`SELECT COALESCE(SUM(montant+commission),0) AS t FROM gains_transporteur`)?.t ?? 0;
    return { totalExp, totalTrans, total, completes, annulees, caTotal };
  },

  activite7Jours: () => {
    const d = getDB();
    const rows  = d.getAllSync(
      `SELECT date(created_at) AS j, COUNT(*) AS n FROM demandes WHERE created_at >= date('now','-6 days') GROUP BY j`
    );
    const gains = d.getAllSync(
      `SELECT date(date) AS j, COALESCE(SUM(montant+commission),0) AS ca FROM gains_transporteur WHERE date >= date('now','-6 days') GROUP BY j`
    );
    const result = [];
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(); dt.setDate(dt.getDate() - i);
      const jour = dt.toISOString().split('T')[0];
      const lbl  = dt.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3);
      result.push({
        jour, label: lbl,
        courses: rows.find(r => r.j === jour)?.n ?? 0,
        ca:      gains.find(g => g.j === jour)?.ca ?? 0,
      });
    }
    return result;
  },

  getAllTransporteurs: () =>
    getDB().getAllSync(
      `SELECT u.*,
              (SELECT COUNT(*) FROM gains_transporteur WHERE transporteur_id=u.id) AS nb_courses
       FROM users u WHERE u.type='transporteur' ORDER BY u.created_at DESC`
    ),

  getAllUsers: () =>
    getDB().getAllSync(`SELECT * FROM users WHERE type!='gestionnaire' ORDER BY created_at DESC`),

  getDemandesActives: () =>
    getDB().getAllSync(
      `SELECT d.*, e.nom AS expediteur_nom, t.nom AS transporteur_nom
       FROM demandes d
       JOIN users e ON d.expediteur_id=e.id
       LEFT JOIN users t ON d.transporteur_id=t.id
       ORDER BY d.created_at DESC`
    ),

  validerTransporteur: (id) =>
    getDB().runSync(`UPDATE users SET validation_statut='valide' WHERE id=?`, [id]),

  rejeterTransporteur: (id, motif) =>
    getDB().runSync(`UPDATE users SET validation_statut='rejete', motif_rejet_transporteur=? WHERE id=?`, [motif, id]),

  suspendreTransporteur: (id) => {
    const dt = new Date(); dt.setDate(dt.getDate() + 7);
    getDB().runSync(`UPDATE users SET suspendu_jusqu_au=? WHERE id=?`, [dt.toISOString().split('T')[0], id]);
  },

  leverSuspension: (id) =>
    getDB().runSync(`UPDATE users SET suspendu_jusqu_au=NULL WHERE id=?`, [id]),

  getAllSignalements: () =>
    getDB().getAllSync(
      `SELECT s.*, u.nom AS user_nom, u.telephone AS user_tel
       FROM signalements s LEFT JOIN users u ON s.user_id=u.id ORDER BY s.created_at DESC`
    ),

  traiterSignalement: (id) =>
    getDB().runSync(`UPDATE signalements SET statut='traite' WHERE id=?`, [id]),
};

// ── CONFIG APP ───────────────────────────────────────────────
export const configDB = {
  get: (cle) =>
    getDB().getFirstSync(`SELECT valeur FROM config_app WHERE cle=?`, [cle])?.valeur ?? null,

  set: (cle, valeur) => {
    const existing = getDB().getFirstSync(`SELECT id FROM config_app WHERE cle=?`, [cle]);
    if (existing) {
      getDB().runSync(`UPDATE config_app SET valeur=?, updated_at=CURRENT_TIMESTAMP WHERE cle=?`, [String(valeur), cle]);
    } else {
      getDB().runSync(`INSERT INTO config_app (cle, valeur) VALUES (?,?)`, [cle, String(valeur)]);
    }
  },

  getAll: () => {
    const rows = getDB().getAllSync(`SELECT * FROM config_app`);
    return rows.reduce((acc, r) => ({ ...acc, [r.cle]: r.valeur }), {});
  },

  getTarifs: () => {
    const all = configDB.getAll();
    return {
      fourgon:  { km: parseFloat(all.tarif_fourgon_km  || '45'),  pec: parseFloat(all.tarif_fourgon_pec  || '500') },
      camion35: { km: parseFloat(all.tarif_camion35_km || '65'),  pec: parseFloat(all.tarif_camion35_pec || '800') },
      camion10: { km: parseFloat(all.tarif_camion10_km || '90'),  pec: parseFloat(all.tarif_camion10_pec || '1200') },
      semi:     { km: parseFloat(all.tarif_semi_km     || '130'), pec: parseFloat(all.tarif_semi_pec     || '2000') },
    };
  },
};

// ── LOGS ADMIN ───────────────────────────────────────────────
export const logsAdminDB = {
  create: (gestionnaire_id, action, details = null) =>
    getDB().runSync(
      `INSERT INTO logs_admin (gestionnaire_id, action, details) VALUES (?,?,?)`,
      [gestionnaire_id, action, details ? JSON.stringify(details) : null]
    ),

  getRecent: (limit = 50) =>
    getDB().getAllSync(
      `SELECT l.*, u.nom AS gestionnaire_nom FROM logs_admin l
       LEFT JOIN users u ON l.gestionnaire_id=u.id ORDER BY l.created_at DESC LIMIT ?`,
      [limit]
    ),
};

// ── ANNULATIONS ──────────────────────────────────────────────
export const annulationsDB = {
  create: ({ demande_id, user_id, role, motif = null, gratuite = 0 }) =>
    getDB().runSync(
      `INSERT INTO annulations (demande_id, user_id, role, motif, gratuite)
       VALUES (?, ?, ?, ?, ?)`,
      [demande_id, user_id, role, motif || null, gratuite]
    ),

  countMoisTransporteur: (userId) =>
    getDB().getFirstSync(
      `SELECT COUNT(*) AS n FROM annulations
       WHERE user_id = ? AND role = 'transporteur'
       AND strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')`,
      [userId]
    )?.n ?? 0,

  countMoisExpediteur: (userId) =>
    getDB().getFirstSync(
      `SELECT COUNT(*) AS n FROM annulations
       WHERE user_id = ? AND role = 'expediteur'
       AND strftime('%Y-%m', timestamp) = strftime('%Y-%m', 'now')`,
      [userId]
    )?.n ?? 0,
};

// ── CACHE COORDONNÉES COMMUNE (voir src/utils/distance.js) ────
export const communeCoordsDB = {
  get: (commune, wilaya) => {
    try {
      return getDB().getFirstSync(
        `SELECT latitude, longitude FROM commune_coords WHERE commune = ? AND wilaya = ?`,
        [commune, wilaya]
      ) || null;
    } catch (_) {
      return null;
    }
  },

  set: (commune, wilaya, latitude, longitude) => {
    try {
      getDB().runSync(
        `INSERT OR REPLACE INTO commune_coords (commune, wilaya, latitude, longitude)
         VALUES (?, ?, ?, ?)`,
        [commune, wilaya, latitude, longitude]
      );
    } catch (_) {}
  },
};
