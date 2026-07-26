import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, StatusBar, ActivityIndicator,
  Alert, KeyboardAvoidingView, RefreshControl,
  Animated, Dimensions, Modal,
} from 'react-native';
import { Redirect, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useApp, parseDemandeTime, msToCountdown } from '../../src/context/AppContext';
import { demandesDB, usersDB, offresDB, notifDB, agendaDB, gainsDB } from '../../src/db/database';
import { getDistanceKm, fmtKm, WILAYA_COORDS } from '../../src/utils/wilayas';
import { calculerPrix, calculerSurge, fmtPrix, TARIFS_BASE } from '../../src/utils/pricing';
import { useReservation } from '../../src/context/ReservationContext';
import { useLanguage } from '../../src/i18n';

function _haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, toR = d => d * Math.PI / 180;
  const a =
    Math.sin(toR(lat2 - lat1) / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) *
    Math.sin(toR(lng2 - lng1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestWilaya(lat, lng, canonicalList) {
  let best = null, bestDist = Infinity;
  for (const name of canonicalList) {
    const c = WILAYA_COORDS[name];
    if (!c) continue;
    const d = _haversine(lat, lng, c.lat, c.lng);
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
  warning: '#F59E0B', warningLight: '#FFFBEB',
};

const { width: SCREEN_W } = Dimensions.get('window');
const TOGGLE_SIDE_PAD = 32; // 16px each side
const TRACK_W   = SCREEN_W - TOGGLE_SIDE_PAD;
const THUMB_W   = TRACK_W / 2 - 4;
const THUMB_X_OFF = 4;
const THUMB_X_ON  = TRACK_W / 2;

const WILAYAS = [
  'Adrar','Aïn Defla','Aïn Témouchent','Alger','Annaba',
  'Batna','Béchar','Béjaïa','Biskra','Blida','Bordj Bou Arréridj',
  'Bouira','Boumerdès','Chlef','Constantine','Djelfa','El Bayadh',
  'El Oued','El Tarf','Ghardaïa','Guelma','Illizi','Jijel',
  'Khenchela','Laghouat','Mascara','Médéa','Mila','Mostaganem',
  'Msila','Naâma','Oran','Ouargla','Oum El Bouaghi','Relizane',
  'Saïda','Sétif','Sidi Bel Abbès','Skikda','Souk Ahras',
  'Tamanrasset','Tébessa','Tiaret','Tindouf','Tipaza',
  'Tissemsilt','Tizi Ouzou','Tlemcen',
];

const TYPES_MARCHANDISE = [
  { key: 'meubles',        label: 'Meubles',        icon: 'grid-outline' },
  { key: 'electromenager', label: 'Électroménager', icon: 'tv-outline' },
  { key: 'cartons',        label: 'Cartons',         icon: 'cube-outline' },
  { key: 'alimentation',   label: 'Alimentation',   icon: 'basket-outline' },
  { key: 'materiaux',      label: 'Matériaux BTP',   icon: 'construct-outline' },
  { key: 'vehicule',       label: 'Véhicule',        icon: 'car-outline' },
  { key: 'autre',          label: 'Autre',           icon: 'ellipsis-horizontal-circle-outline' },
];

const CRENEAUX = [
  { key: 'matin',      label: 'Matin',      sub: '06h – 12h',   icon: 'sunny-outline' },
  { key: 'apres-midi', label: 'Après-midi', sub: '12h – 18h',   icon: 'partly-sunny-outline' },
  { key: 'soir',       label: 'Soir',       sub: '18h – 22h',   icon: 'moon-outline' },
  { key: 'flexible',   label: 'Flexible',   sub: 'Peu importe', icon: 'time-outline' },
];

const SOUS_CATEGORIES = {
  meubles: [
    { key: 'lit',       label: 'Lit',              veh: 'fourgon' },
    { key: 'canape',    label: 'Canapé',            veh: 'fourgon' },
    { key: 'armoire',   label: 'Armoire',           veh: 'camion35' },
    { key: 'table',     label: 'Table & Chaises',   veh: 'fourgon' },
    { key: 'salon',     label: 'Salon complet',     veh: 'camion35' },
    { key: 'appart',    label: 'Tout l\'appart',    veh: 'camion35', warn: 'Un déménagement complet nécessite généralement un camion 3.5T. Prévoir 2–3h de chargement minimum.' },
  ],
  electromenager: [
    { key: 'frigo',     label: 'Réfrigérateur',     veh: 'fourgon' },
    { key: 'machine',   label: 'Machine à laver',   veh: 'fourgon' },
    { key: 'clim',      label: 'Climatiseur',       veh: 'fourgon' },
    { key: 'tv',        label: 'TV / Écran',        veh: 'fourgon' },
    { key: 'plusieurs', label: 'Plusieurs gros appareils', veh: 'camion35' },
  ],
  cartons: [
    { key: 'petit',     label: '< 10 cartons',      veh: 'fourgon' },
    { key: 'moyen',     label: '10 – 30 cartons',   veh: 'fourgon' },
    { key: 'grand',     label: '> 30 cartons',      veh: 'camion35' },
  ],
  alimentation: [
    { key: 'fruits_legumes', label: 'Fruits & Légumes (cageots)', veh: ['herbine', 'utilitaire'] },
    { key: 'epicerie',       label: 'Produits alimentaires',       veh: 'utilitaire' },
    { key: 'vrac_alim',      label: 'Grande quantité',            veh: 'fourgon' },
    { key: 'surgeles',       label: 'Surgelés / Réfrigérés',      veh: 'fourgon',
      warn: 'Les produits surgelés nécessitent un véhicule frigorifique. Mentionne cette exigence dans la description pour filtrer les transporteurs équipés.' },
  ],
  materiaux: [
    { key: 'sable',     label: 'Sable / Gravier',   veh: 'camion10', warn: 'Le sable et gravier en vrac nécessitent un camion benne 10T minimum. Précise la quantité en tonnes.' },
    { key: 'briques',   label: 'Briques / Parpaings', veh: 'camion10' },
    { key: 'fer',       label: 'Fer à béton',        veh: 'camion35', warn: 'Le fer à béton est long et lourd — précise absolument les dimensions dans la description.' },
    { key: 'carrelage', label: 'Carrelage',           veh: 'fourgon' },
    { key: 'autre_btp', label: 'Autre BTP',           veh: 'camion35' },
  ],
  vehicule: [
    { key: 'voiture',   label: 'Voiture',            veh: 'semi', warn: 'Le transport de voitures nécessite un plateau ou semi-remorque équipé. Vérifie que le transporteur dispose du matériel adéquat.' },
    { key: 'moto',      label: 'Moto / Scooter',     veh: 'fourgon' },
    { key: 'camion_l',  label: 'Camion léger',       veh: 'semi', warn: 'Pour les véhicules lourds, assure-toi que le transporteur possède un plateau homologué.' },
  ],
  autre: [],
};

const QUICK_CATS = [
  { key: 'meubles',        label: 'Déménagement',     icon: 'grid-outline' },
  { key: 'electromenager', label: 'Électroménager',   icon: 'tv-outline' },
  { key: 'alimentation',   label: 'Fruits & Légumes', icon: 'basket-outline' },
  { key: 'materiaux',      label: 'Matériaux',        icon: 'construct-outline' },
  { key: 'cartons',        label: 'Cartons',           icon: 'cube-outline' },
];

const VEH_LABELS = {
  herbine:    'Herbine',
  utilitaire: 'Utilitaire léger',
  fourgon:    'Fourgon',
  camion35:   'Camion 3.5T',
  camion10:   'Camion 10T',
  semi:       'Semi-remorque / Plateau',
};
const VEH_ICONS = {
  herbine:    'cart-outline',
  utilitaire: 'car-outline',
  fourgon:    'car-sport-outline',
  camion35:   'bus-outline',
  camion10:   'cube-outline',
  semi:       'construct-outline',
};

function Logo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={ls.badge}><Text style={ls.dz}>Dz</Text></View>
      <Text style={ls.express}>Express</Text>
    </View>
  );
}
const ls = StyleSheet.create({
  badge:   { backgroundColor: C.accent, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4 },
  dz:      { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  express: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});

// ════════════════════════════════════════════════════════════
// ── EXPÉDITEUR ───────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function ExpéditeurHome({ user }) {
  const router = useRouter();
  const { setField, reset, setOption } = useReservation();
  const { t } = useLanguage();

  const [recentDemandes, setRecentDemandes] = useState([]);
  const [nbTransporteurs, setNbTransporteurs] = useState(0);

  useEffect(() => {
    const refresh = () => {
      try { setNbTransporteurs(usersDB.countTransporteursDisponibles()); } catch {}
    };
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, []);

  useFocusEffect(useCallback(() => {
    try {
      setRecentDemandes(demandesDB.getByExpediteur(user.id).slice(0, 3));
    } catch {}
  }, [user.id]));

  const refaire = (d) => {
    reset();
    setField('departure',  d.ville_depart);
    setField('arrival',    d.ville_arrivee);
    setField('category',   d.type_marchandise);
    setField('mode',       d.type_demande || 'planifie');
    if (d.poids)       setField('quantite',    d.poids);
    if (d.description) setField('description', d.description);
    if (d.options_supplementaires) {
      try {
        const o = JSON.parse(d.options_supplementaires);
        if (o.etages)  setOption('etages',  o.etages);
        if (o.aide)    setOption('aide',    o.aide);
        if (o.fragile) setOption('fragile', o.fragile);
        if (o.express) setOption('express', o.express);
      } catch {}
    }
    router.push('/reservation/recapitulatif');
  };

  const _h        = new Date().getHours();
  const salutation = _h >= 6 && _h < 18 ? t('bonjour') : t('bonsoir');
  const prenom     = user.nom.split(' ')[0];

  const lancerMaintenant = () => {
    setField('mode', 'instantane');
    router.push('/reservation/depart-arrivee');
  };

  const lancerPlanifie = () => {
    setField('mode', 'planifie');
    router.push('/reservation/depart-arrivee');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.header, { flexDirection: 'column', alignItems: 'stretch', backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }]}>
        <View style={hd.topRow}>
          <Logo />
          <View style={[s.headerBadge, { backgroundColor: '#FFF3E8', borderWidth: 1, borderColor: '#FDBA74' }]}>
            <Ionicons name="cube-outline" size={13} color={C.accent} style={{ marginRight: 5 }} />
            <Text style={[s.headerBadgeTxt, { color: C.accent }]}>Expéditeur</Text>
          </View>
        </View>
        <Text style={hd.salutation}>{salutation}, {prenom}</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
      >
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 22, fontWeight: '800', color: '#0A0A0A', lineHeight: 30, letterSpacing: -0.3, marginBottom: 10 }}>
            {t('ou_envoyez')}
          </Text>
          {nbTransporteurs > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BBF7D0' }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#16A34A', marginRight: 6 }} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: '#15803D' }}>
                {nbTransporteurs} transporteur{nbTransporteurs > 1 ? 's' : ''} disponible{nbTransporteurs > 1 ? 's' : ''} près de vous
              </Text>
            </View>
          )}
        </View>

        {/* Bouton Maintenant */}
        <TouchableOpacity style={nb.btnNoir} onPress={lancerMaintenant} activeOpacity={0.88}>
          <Text style={nb.emoji}>🚀</Text>
          <View style={{ flex: 1 }}>
            <Text style={nb.title}>{t('maintenant')}</Text>
            <Text style={nb.sub}>Trouver un transporteur disponible maintenant</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Bouton Planifier */}
        <TouchableOpacity style={nb.btnBlanc} onPress={lancerPlanifie} activeOpacity={0.88}>
          <Text style={nb.emoji}>📅</Text>
          <View style={{ flex: 1 }}>
            <Text style={[nb.title, { color: '#0A0A0A' }]}>{t('planifier')}</Text>
            <Text style={[nb.sub, { color: '#6B7280' }]}>Programmer une course pour plus tard</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#0A0A0A" />
        </TouchableOpacity>

        {/* Vos dernières demandes */}
        {recentDemandes.length > 0 && (
          <View style={[qs.section, { marginTop: 12 }]}>
            <Text style={qs.sectionTitle}>Vos dernières demandes</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              nestedScrollEnabled keyboardShouldPersistTaps="handled"
              contentContainerStyle={qs.row}>
              {recentDemandes.map(d => {
                const typeInfo = TYPES_MARCHANDISE.find(t => t.key === d.type_marchandise);
                return (
                  <View key={d.id} style={rd.card}>
                    <View style={rd.routeRow}>
                      <Ionicons name="radio-button-on" size={10} color={C.accent} />
                      <Text style={rd.city} numberOfLines={1}>{d.ville_depart}</Text>
                    </View>
                    <View style={rd.routeLine} />
                    <View style={rd.routeRow}>
                      <Ionicons name="location" size={10} color={C.primary} />
                      <Text style={rd.city} numberOfLines={1}>{d.ville_arrivee}</Text>
                    </View>
                    {typeInfo && (
                      <View style={rd.typeBadge}>
                        <Ionicons name={typeInfo.icon} size={11} color={C.muted} style={{ marginRight: 4 }} />
                        <Text style={rd.typeTxt}>{typeInfo.label}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={rd.refaireBtn} onPress={() => refaire(d)} activeOpacity={0.8}>
                      <Ionicons name="refresh-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                      <Text style={rd.refaireTxt}>Refaire</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Transport rapide */}
        <View style={qs.section}>
          <Text style={qs.sectionTitle}>Transport rapide</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            nestedScrollEnabled keyboardShouldPersistTaps="handled"
            contentContainerStyle={qs.row}>
            {QUICK_CATS.map(cat => (
              <TouchableOpacity
                key={cat.key}
                style={qs.card}
                onPress={() => {
                  reset();
                  setField('category', cat.key);
                  router.push('/reservation/marchandise');
                }}
                activeOpacity={0.8}
              >
                <View style={qs.iconBox}>
                  <Ionicons name={cat.icon} size={26} color={C.accent} />
                </View>
                <Text style={qs.label}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Lien aide discret */}
        <TouchableOpacity style={s.aideLink} onPress={() => router.push('/aide')} activeOpacity={0.7}>
          <Ionicons name="help-circle-outline" size={15} color={C.muted} style={{ marginRight: 6 }} />
          <Text style={s.aideLinkTxt}>{"Besoin d'aide ?"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function OptionToggle({ icon, title, sub, value, onToggle, last }) {
  return (
    <TouchableOpacity style={[opt.row, last && { borderBottomWidth: 0 }]} onPress={onToggle} activeOpacity={0.8}>
      <View style={opt.optIcon}><Ionicons name={icon} size={17} color={C.muted} /></View>
      <View style={{ flex: 1 }}>
        <Text style={opt.optTitle}>{title}</Text>
        <Text style={opt.optSub}>{sub}</Text>
      </View>
      <View style={[opt.toggle, value && { backgroundColor: C.success }]}>
        <View style={[opt.thumb, value && { alignSelf: 'flex-end' }]} />
      </View>
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════════════
// ── TRANSPORTEUR ─────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function TransporteurHome({ user }) {
  const router = useRouter();

  // ── En ligne / Hors ligne ──────────────────────────────────
  const [disponible, setDisponible]         = useState(user.disponible === 1);
  const [heureMiseEnLigne, setHeureMiseEnLigne] = useState(null);
  const [dureeEnLigne, setDureeEnLigne]     = useState('');
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [statsToday, setStatsToday]         = useState({ gains: 0, courses: 0 });
  const toggleAnim = useRef(new Animated.Value(user.disponible === 1 ? 1 : 0)).current;

  // ── Demandes ───────────────────────────────────────────────
  const [demandes, setDemandes]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [urgFilter, setUrgFilter]   = useState('tous');
  const [typeFilter, setTypeFilter] = useState('');
  const [prochaines, setProchaines] = useState([]);

  const PROCHAINES_HEURES = 48;

  // Charge l'heure de mise en ligne depuis la DB au montage
  useEffect(() => {
    try {
      const u = usersDB.getById(user.id);
      if (u?.disponible === 1 && u?.heure_mise_en_ligne) {
        setHeureMiseEnLigne(u.heure_mise_en_ligne);
      }
    } catch {}
  }, [user.id]);

  // Compteur de durée (mise à jour toutes les minutes)
  useEffect(() => {
    if (!disponible || !heureMiseEnLigne) { setDureeEnLigne(''); return; }
    const calc = () => {
      const mins = Math.floor((Date.now() - new Date(heureMiseEnLigne).getTime()) / 60000);
      if (mins < 1)   { setDureeEnLigne('quelques secondes'); return; }
      if (mins < 60)  { setDureeEnLigne(`${mins} min`); return; }
      const h = Math.floor(mins / 60), m = mins % 60;
      setDureeEnLigne(m > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${h}h`);
    };
    calc();
    const id = setInterval(calc, 60_000);
    return () => clearInterval(id);
  }, [disponible, heureMiseEnLigne]);

  // Stats du jour
  const loadStats = useCallback(() => {
    try { setStatsToday(gainsDB.getStatToday(user.id)); } catch {}
  }, [user.id]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // Valeurs animées pour le toggle
  const trackBg = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', '#10B981'],
  });
  const thumbX = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [THUMB_X_OFF, THUMB_X_ON],
  });

  // ── Handlers toggle ───────────────────────────────────────
  const goOnline = () => {
    const now = new Date().toISOString();
    try {
      usersDB.setDisponible(user.id, 1, now);
      setDisponible(true);
      setHeureMiseEnLigne(now);
      Animated.timing(toggleAnim, { toValue: 1, duration: 280, useNativeDriver: false }).start();
      setLoading(true);
      fetchDemandes();
    } catch (e) { Alert.alert('Erreur', e.message); }
  };

  const goOffline = () => {
    try {
      usersDB.setDisponible(user.id, 0, null);
      setDisponible(false);
      setHeureMiseEnLigne(null);
      setDureeEnLigne('');
      Animated.timing(toggleAnim, { toValue: 0, duration: 280, useNativeDriver: false }).start();
    } catch (e) { Alert.alert('Erreur', e.message); }
  };

  const handleToggle = () => {
    if (disponible) {
      try {
        const courseActive = demandesDB.getByTransporteur(user.id)
          .find(d => ['acceptee', 'en_route', 'en_cours'].includes(d.statut));
        if (courseActive) { setShowOfflineModal(true); return; }
      } catch {}
      goOffline();
    } else {
      goOnline();
    }
  };

  // ── Chargement des demandes ───────────────────────────────
  const fetchDemandes = useCallback(() => {
    try {
      setDemandes(demandesDB.getDisponibles(urgFilter !== 'tous' ? urgFilter : null));
      const all = demandesDB.getPlanifieesProchaines();
      const now = Date.now();
      setProchaines(all.filter(d => {
        const ms = parseDemandeTime(d.date_souhaitee, d.creneau);
        return ms && ms - now > 0 && ms - now < PROCHAINES_HEURES * 3600000;
      }));
      loadStats();
    } catch (e) { console.log('fetch error:', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [urgFilter, loadStats]);

  useState(() => { fetchDemandes(); }, []);

  const onUrgFilterChange = (val) => {
    setUrgFilter(val);
    setLoading(true);
    try { setDemandes(demandesDB.getDisponibles(val !== 'tous' ? val : null)); }
    catch (e) { console.log(e.message); }
    finally { setLoading(false); }
  };

  const accepterCourse = (demande) => {
    Alert.alert(
      'Accepter cette course ?',
      `${demande.ville_depart} → ${demande.ville_arrivee}\n${demande.date_souhaitee}`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Accepter', onPress: () => {
          try {
            const offreId = offresDB.create({
              demande_id: demande.id,
              transporteur_id: user.id,
              prix_propose: demande.prix_estime || null,
              message: 'Réservation course planifiée',
            });
            offresDB.accepter(offreId, demande.id, user.id);
            notifDB.create(
              demande.expediteur_id,
              `Un transporteur a accepté votre course ${demande.ville_depart} → ${demande.ville_arrivee}`,
              'course_acceptee',
              { route: `/demande/${demande.id}` }
            );
            fetchDemandes();
            Alert.alert('Course ajoutée !', 'Elle apparaît maintenant dans votre agenda.');
          } catch (e) { Alert.alert('Erreur', e.message); }
        }},
      ]
    );
  };

  const displayed     = typeFilter ? demandes.filter(d => d.type_marchandise === typeFilter) : demandes;
  const urgentCount   = demandes.filter(d => d.type_demande === 'maintenant').length;
  const planifieCount = demandes.filter(d => d.type_demande === 'planifie').length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      {/* Header */}
      <View style={s.header}>
        <Logo />
        <View style={[s.headerBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Ionicons name="car-sport-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={s.headerBadgeTxt}>Transporteur</Text>
        </View>
      </View>

      {/* ── Toggle En ligne / Hors ligne ── */}
      <View style={tg.section}>
        <TouchableOpacity onPress={handleToggle} activeOpacity={0.92}>
          <Animated.View style={[tg.track, { backgroundColor: trackBg }]}>
            {/* Thumb blanc glissant */}
            <Animated.View style={[tg.thumb, { width: THUMB_W, transform: [{ translateX: thumbX }] }]} />
            {/* Labels côte à côte */}
            <View style={tg.segments} pointerEvents="none">
              <View style={tg.segment}>
                <Ionicons
                  name="moon-outline" size={15}
                  color={disponible ? 'rgba(255,255,255,0.45)' : '#4B5563'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[tg.segLabel, { color: disponible ? 'rgba(255,255,255,0.45)' : '#374151' }]}>
                  Hors ligne
                </Text>
              </View>
              <View style={tg.segment}>
                <Ionicons
                  name="radio-button-on" size={15}
                  color={disponible ? '#FFFFFF' : 'rgba(107,114,128,0.45)'}
                  style={{ marginRight: 6 }}
                />
                <Text style={[tg.segLabel, { color: disponible ? '#FFFFFF' : 'rgba(107,114,128,0.45)' }]}>
                  En ligne
                </Text>
              </View>
            </View>
          </Animated.View>
        </TouchableOpacity>

        {/* Message de statut */}
        <Text style={[tg.statusMsg, { color: disponible ? C.success : C.muted }]}>
          {disponible
            ? `Vous êtes visible par les expéditeurs 🟢${dureeEnLigne ? `  ·  En ligne depuis ${dureeEnLigne}` : ''}`
            : 'Passez en ligne pour recevoir des courses'}
        </Text>

        {/* Stats rapides (quand en ligne et courses réalisées aujourd'hui) */}
        {disponible && (statsToday.courses > 0 || statsToday.gains > 0) && (
          <View style={tg.statsRow}>
            <Ionicons name="today-outline" size={13} color={C.muted} style={{ marginRight: 6 }} />
            <Text style={tg.statsTxt}>
              {"Aujourd'hui : "}
              <Text style={{ fontWeight: '800', color: C.text }}>
                {statsToday.courses} course{statsToday.courses !== 1 ? 's' : ''}
              </Text>
              {statsToday.gains > 0 && (
                <>
                  {'  ·  '}
                  <Text style={{ fontWeight: '800', color: C.success }}>{fmtPrix(statsToday.gains)}</Text>
                  {' gagnés'}
                </>
              )}
            </Text>
          </View>
        )}
      </View>

      {/* ── Contenu conditionnel (offline / online) ── */}
      {!disponible ? (
        <View style={s.center}>
          <View style={[s.emptyIcon, { backgroundColor: '#F3F4F6', width: 72, height: 72, borderRadius: 36 }]}>
            <Ionicons name="car-sport-outline" size={34} color="#9CA3AF" />
          </View>
          <Text style={s.emptyTitle}>Vous êtes hors ligne</Text>
          <Text style={s.emptyDesc}>Activez le toggle pour recevoir{'\n'}des demandes de courses</Text>
        </View>
      ) : (
        <>
          {/* Filtre Urgent / Planifié / Tous */}
          <View style={s.urgFilterBar}>
            {[
              { key: 'tous',       iconName: 'search-outline',   label: 'Tous',     count: demandes.length },
              { key: 'maintenant', iconName: 'flash-outline',    label: 'Urgent',   count: urgentCount },
              { key: 'planifie',   iconName: 'calendar-outline', label: 'Planifié', count: planifieCount },
            ].map(f => {
              const active = urgFilter === f.key;
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[s.urgBtn, active && s.urgBtnActive]}
                  onPress={() => onUrgFilterChange(f.key)} activeOpacity={0.85}
                >
                  <Ionicons name={f.iconName} size={14} color={active ? '#FFFFFF' : C.muted} />
                  <Text style={[s.urgBtnTxt, active && { color: '#FFFFFF' }]}>{f.label}</Text>
                  {f.count > 0 && (
                    <View style={[s.urgCount, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                      <Text style={[s.urgCountTxt, active && { color: '#FFFFFF' }]}>{f.count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Filtre type marchandise */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={s.typeFilterBar}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 7 }}>
            <TouchableOpacity style={[s.typeChip, !typeFilter && s.typeChipActive]} onPress={() => setTypeFilter('')}>
              <Text style={[s.typeChipTxt, !typeFilter && { color: '#FFFFFF' }]}>Tout</Text>
            </TouchableOpacity>
            {TYPES_MARCHANDISE.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.typeChip, typeFilter === t.key && s.typeChipActive]}
                onPress={() => setTypeFilter(typeFilter === t.key ? '' : t.key)}
              >
                <Ionicons name={t.icon} size={13} color={typeFilter === t.key ? '#FFFFFF' : C.muted} style={{ marginRight: 4 }} />
                <Text style={[s.typeChipTxt, typeFilter === t.key && { color: '#FFFFFF' }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Courses à venir */}
          {prochaines.length > 0 && (
            <View style={s.prochSection}>
              <View style={s.prochHeader}>
                <Ionicons name="alarm-outline" size={15} color={C.accent} style={{ marginRight: 6 }} />
                <Text style={s.prochTitle}>Courses à venir</Text>
                <View style={s.prochBadge}><Text style={s.prochBadgeTxt}>{prochaines.length}</Text></View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 12, gap: 10 }}>
                {prochaines.map(d => {
                  const ms = parseDemandeTime(d.date_souhaitee, d.creneau);
                  const rem = ms ? ms - Date.now() : null;
                  const cd = msToCountdown(rem);
                  const isProche = rem != null && rem < 3 * 3600000;
                  return (
                    <View key={d.id} style={s.prochCard}>
                      {cd && (
                        <View style={[s.prochCdBadge, { backgroundColor: isProche ? C.accentLight : C.successLight }]}>
                          <Ionicons name="alarm" size={11} color={isProche ? C.accent : C.success} style={{ marginRight: 4 }} />
                          <Text style={[s.prochCdTxt, { color: isProche ? C.accent : C.success }]}>{cd}</Text>
                        </View>
                      )}
                      <Text style={s.prochRoute} numberOfLines={1}>{d.ville_depart} → {d.ville_arrivee}</Text>
                      <Text style={s.prochDate}>{d.date_souhaitee} · {CRENEAUX.find(c => c.key === d.creneau)?.label || ''}</Text>
                      {d.prix_estime > 0 && <Text style={s.prochPrix}>{fmtPrix(d.prix_estime)}</Text>}
                      <TouchableOpacity style={s.prochAccepterBtn} onPress={() => accepterCourse(d)} activeOpacity={0.85}>
                        <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
                        <Text style={s.prochAccepterTxt}>Accepter</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Liste principale */}
          {loading ? (
            <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>
          ) : displayed.length === 0 ? (
            <View style={s.center}>
              <View style={s.emptyIcon}>
                <Ionicons name={urgFilter === 'maintenant' ? 'flash-outline' : urgFilter === 'planifie' ? 'calendar-outline' : 'search-outline'} size={32} color="#D1D5DB" />
              </View>
              <Text style={s.emptyTitle}>
                {urgFilter === 'maintenant' ? 'Aucune urgence' : urgFilter === 'planifie' ? 'Aucune planifiée' : 'Aucune demande'}
              </Text>
              <Text style={s.emptyDesc}>Reviens dans quelques minutes</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 90 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDemandes(); }} tintColor={C.primary} />
              }
            >
              <Text style={s.countTxt}>{displayed.length} demande{displayed.length > 1 ? 's' : ''}</Text>
              {displayed.map(d => (
                <DemandeCard key={d.id} demande={d} onPress={() => router.push(`/course/${d.id}`)} />
              ))}
            </ScrollView>
          )}
        </>
      )}

      {/* ── Modal confirmation passage hors ligne ── */}
      <Modal visible={showOfflineModal} transparent animationType="slide" onRequestClose={() => setShowOfflineModal(false)}>
        <View style={tg.modalOverlay}>
          <View style={tg.modalSheet}>
            <View style={tg.modalHandle} />
            <View style={[tg.modalIcon, { backgroundColor: C.warningLight }]}>
              <Ionicons name="warning-outline" size={28} color={C.warning} />
            </View>
            <Text style={tg.modalTitle}>Course en cours</Text>
            <Text style={tg.modalSub}>
              Vous avez une course active en ce moment.{'\n'}
              Êtes-vous sûr de vouloir passer hors ligne ?
            </Text>
            <TouchableOpacity style={[tg.modalBtn, { backgroundColor: C.primary }]} onPress={() => { setShowOfflineModal(false); goOffline(); }}>
              <Text style={tg.modalBtnTxt}>Passer hors ligne quand même</Text>
            </TouchableOpacity>
            <TouchableOpacity style={tg.modalBtnSecondary} onPress={() => setShowOfflineModal(false)}>
              <Text style={tg.modalBtnSecTxt}>Rester en ligne</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function DemandeCard({ demande: d, onPress, onAccepter, showAccepter = false }) {
  const isUrgent    = d.type_demande === 'maintenant';
  const typeInfo    = TYPES_MARCHANDISE.find(t => t.key === d.type_marchandise);
  const creneauInfo = CRENEAUX.find(c => c.key === d.creneau);
  const distKm      = getDistanceKm(d.ville_depart, d.ville_arrivee);

  const scheduledMs = parseDemandeTime(d.date_souhaitee, d.creneau);
  const remainingMs = scheduledMs ? scheduledMs - Date.now() : null;
  const countdown   = msToCountdown(remainingMs);
  const isProche    = remainingMs != null && remainingMs > 0 && remainingMs < 6 * 3600000;

  // Sous-catégorie libellé
  const sousLabel = (() => {
    if (!d.sous_categorie) return null;
    const cats = SOUS_CATEGORIES[d.type_marchandise] || [];
    return cats.find(sc => sc.key === d.sous_categorie)?.label || d.sous_categorie;
  })();

  // Véhicule recommandé libellé
  const vehLabel = d.vehicule_recommande ? VEH_LABELS[d.vehicule_recommande] : null;
  const vehIcon  = d.vehicule_recommande ? VEH_ICONS[d.vehicule_recommande] : 'car-outline';

  return (
    <TouchableOpacity style={[s.card, isUrgent && s.cardUrgent]} onPress={onPress} activeOpacity={0.88}>
      {/* Bannière urgence / countdown */}
      {isUrgent ? (
        <View style={s.urgentBanner}>
          <Ionicons name="flash" size={12} color={C.error} style={{ marginRight: 6 }} />
          <Text style={s.urgentBannerTxt}>URGENT — Transport immédiat</Text>
        </View>
      ) : countdown ? (
        <View style={[s.urgentBanner, { backgroundColor: isProche ? '#FFF7ED' : '#F0FDF4', borderBottomColor: isProche ? '#FED7AA' : '#BBF7D0' }]}>
          <Ionicons name="alarm-outline" size={12} color={isProche ? C.accent : C.success} style={{ marginRight: 6 }} />
          <Text style={[s.urgentBannerTxt, { color: isProche ? C.accent : C.success }]}>{countdown}</Text>
        </View>
      ) : null}

      {/* Trajet principal — grand et gras */}
      <View style={dc.routeBlock}>
        <View style={dc.routeRow}>
          <View style={dc.routeDotGreen} />
          <Text style={dc.routeCity} numberOfLines={1}>{d.ville_depart}</Text>
        </View>
        <View style={dc.routeConnector}>
          <View style={dc.routeLine} />
          {distKm != null && (
            <View style={dc.distBadge}>
              <Ionicons name="navigate-outline" size={10} color={C.success} style={{ marginRight: 3 }} />
              <Text style={dc.distTxt}>{fmtKm(distKm)}</Text>
            </View>
          )}
          <View style={dc.routeLine} />
        </View>
        <View style={dc.routeRow}>
          <View style={dc.routeDotRed} />
          <Text style={dc.routeCity} numberOfLines={1}>{d.ville_arrivee}</Text>
        </View>
      </View>

      {/* Marchandise — type + sous-catégorie */}
      <View style={dc.infoRow}>
        <View style={[dc.infoIcon, { backgroundColor: isUrgent ? C.errorLight : C.bgAlt }]}>
          <Ionicons name={typeInfo?.icon || 'cube-outline'} size={15} color={isUrgent ? C.error : C.muted} />
        </View>
        <Text style={dc.infoTxt} numberOfLines={1}>
          {typeInfo?.label || d.type_marchandise}
          {sousLabel ? <Text style={dc.infoSub}>{`  —  ${sousLabel}`}</Text> : null}
        </Text>
        {d.nb_offres > 0 && (
          <View style={dc.offreBadge}>
            <Text style={dc.offreTxt}>{d.nb_offres} offre{d.nb_offres > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Véhicule requis */}
      {vehLabel && (
        <View style={dc.infoRow}>
          <View style={[dc.infoIcon, { backgroundColor: '#EBF5FF' }]}>
            <Ionicons name={vehIcon} size={15} color="#1A56DB" />
          </View>
          <Text style={[dc.infoTxt, { color: '#1A56DB' }]}>{vehLabel}</Text>
        </View>
      )}

      {/* Timing */}
      <View style={dc.infoRow}>
        {isUrgent ? (
          <View style={dc.timingUrgent}>
            <Text style={dc.timingUrgentTxt}>Maintenant 🔴</Text>
          </View>
        ) : (
          <View style={dc.timingPlan}>
            <Ionicons name="calendar-outline" size={12} color="#1A56DB" style={{ marginRight: 5 }} />
            <Text style={dc.timingPlanTxt}>
              {d.date_souhaitee}
              {d.heure_souhaitee ? `  ·  ${d.heure_souhaitee}` : creneauInfo ? `  ·  ${creneauInfo.label}` : ''}
              {'  🔵'}
            </Text>
          </View>
        )}
        {isProche && countdown && !isUrgent && (
          <View style={[dc.timingPlan, { backgroundColor: C.accentLight, borderColor: '#FED7AA', marginLeft: 6 }]}>
            <Ionicons name="alarm-outline" size={12} color={C.accent} style={{ marginRight: 4 }} />
            <Text style={[dc.timingPlanTxt, { color: C.accent }]}>{countdown}</Text>
          </View>
        )}
      </View>

      {/* Footer : prix + bouton */}
      <View style={dc.footer}>
        {d.prix_estime > 0 ? (
          <View style={dc.prixBox}>
            <Text style={dc.prixLabel}>Prix estimé</Text>
            <Text style={dc.prixVal}>{fmtPrix(d.prix_estime)}</Text>
          </View>
        ) : <View />}

        {showAccepter && onAccepter ? (
          <TouchableOpacity style={dc.accepterBtn} onPress={onAccepter} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle-outline" size={14} color="#FFFFFF" style={{ marginRight: 5 }} />
            <Text style={dc.accepterTxt}>Accepter</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={dc.voirBtn} onPress={onPress} activeOpacity={0.85}>
            <Text style={dc.voirTxt}>Voir les détails</Text>
            <Ionicons name="chevron-forward" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const { user, loading } = useApp();
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>;
  if (!user) return <Redirect href="/onboarding" />;
  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
{user.type === 'expediteur' ? <ExpéditeurHome user={user} /> : <TransporteurHome user={user} />}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 32, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6, textAlign: 'center' },
  emptyDesc:  { fontSize: 14, color: C.muted, textAlign: 'center' },
  countTxt:   { fontSize: 13, color: C.muted, marginBottom: 4 },

  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 18, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerBadge:    { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 50 },
  headerBadgeTxt: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  urgFilterBar: { flexDirection: 'row', backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  urgBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 10, backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border },
  urgBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  urgBtnTxt:    { fontSize: 12, fontWeight: '700', color: C.muted },
  urgCount:     { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: C.border },
  urgCountTxt:  { fontSize: 10, fontWeight: '700', color: C.muted },

  typeFilterBar: { backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0 },
  typeChip:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 50, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg },
  typeChipActive:{ backgroundColor: C.primary, borderColor: C.primary },
  typeChipTxt:   { fontSize: 12, fontWeight: '600', color: C.muted },

  formCard: { backgroundColor: C.bg, borderRadius: 12, padding: 18, elevation: 2, borderWidth: 1, borderColor: C.border, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06 },

  whenTitle:     { fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 10, letterSpacing: -0.1 },
  modeCards:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeCard:      { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt, gap: 5 },
  modeCardActive:{ backgroundColor: C.primary, borderColor: C.primary },
  modeCardTitle: { fontSize: 13, fontWeight: '800', color: C.muted },
  modeCardSub:   { fontSize: 10, color: C.muted, textAlign: 'center', paddingHorizontal: 6, lineHeight: 14 },

  dtRow:         { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dtBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 13 },
  dtBtnFilled:   { borderColor: C.primary, backgroundColor: C.bg },
  dtBtnTxt:      { fontSize: 13, fontWeight: '600', color: C.text, flex: 1 },
  dtSummary:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#6EE7B7' },
  dtSummaryTxt:  { fontSize: 12, color: C.success, fontWeight: '700', flex: 1 },
  dtPickerDone:  { backgroundColor: C.primary, borderRadius: 50, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  dtPickerDoneTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  urgenceBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.errorLight, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#FCA5A5' },
  urgenceTxt:    { fontSize: 13, color: C.error, lineHeight: 19, flex: 1 },

  formTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 3, letterSpacing: -0.3 },
  formSub:   { fontSize: 13, color: C.muted, marginBottom: 18 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input:      { backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, marginBottom: 16 },

  routeBlock:   { marginBottom: 4 },
  routeDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 8 },
  routeLine:    { flex: 1, height: 1, backgroundColor: C.border },
  routeIconBox: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },

  gpsLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  gpsBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, borderWidth: 1.5, borderColor: C.accent, backgroundColor: C.accentLight },
  gpsBtnTxt:   { fontSize: 12, fontWeight: '700', color: C.accent },
  gpsFillBadge:{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, borderWidth: 1, borderColor: '#6EE7B7' },
  gpsFillTxt:  { fontSize: 13, fontWeight: '700', color: C.success, flex: 1 },

  typeGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn:     { width: '31%', backgroundColor: C.bgAlt, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.border, gap: 5 },
  typeBtnActive: { borderColor: C.accent, backgroundColor: C.accentLight },
  typeTxt:     { fontSize: 10, fontWeight: '600', color: C.muted, textAlign: 'center' },


  submitBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 17, marginTop: 4 },
  submitBtnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  submitBtnSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },

  infoBox:     { backgroundColor: C.bg, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: C.border },
  infoTitle:   { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14, letterSpacing: -0.2 },
  infoStep:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  infoStepTxt: { fontSize: 13, color: C.muted, lineHeight: 20, flex: 1 },
  aideLink:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingVertical: 8 },
  aideLinkTxt: { fontSize: 13, color: C.muted, fontWeight: '500' },

  card:        { backgroundColor: C.bg, borderRadius: 12, padding: 14, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06 },
  cardUrgent:  { borderColor: '#FCA5A5', borderWidth: 1.5 },
  urgentBanner:{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.errorLight, marginHorizontal: -14, marginTop: -14, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#FCA5A5' },
  urgentBannerTxt: { fontSize: 12, fontWeight: '800', color: C.error },

  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardIconBox: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTypeTxt: { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
  routeRowInner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cityFrom:    { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  cityTo:      { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },

  offreBadge:    { backgroundColor: C.successLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: '#6EE7B7' },
  offreBadgeTxt: { fontSize: 11, fontWeight: '800', color: C.success },

  cardMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaChip:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 50, borderWidth: 1, borderColor: C.border },
  metaChipTxt: { fontSize: 11, color: C.muted, fontWeight: '600' },

  prixChip:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#6EE7B7' },
  prixChipTxt: { fontSize: 12, fontWeight: '700', color: C.success },

  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  clientTxt:   { fontSize: 13, fontWeight: '600', color: C.muted },
  voirDetail:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  voirDetailTxt: { fontSize: 13, fontWeight: '700', color: C.primary },

  accepterBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A56DB', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  accepterBtnTxt: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  prochSection:   { backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border },
  prochHeader:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  prochTitle:     { fontSize: 14, fontWeight: '800', color: C.text, flex: 1 },
  prochBadge:     { backgroundColor: C.accentLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#FED7AA' },
  prochBadgeTxt:  { fontSize: 11, fontWeight: '800', color: C.accent },
  prochCard:      { width: 200, backgroundColor: C.bgAlt, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: C.border },
  prochCdBadge:   { flexDirection: 'row', alignItems: 'center', borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: 8, borderWidth: 1, borderColor: '#FED7AA' },
  prochCdTxt:     { fontSize: 11, fontWeight: '800' },
  prochRoute:     { fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 3 },
  prochDate:      { fontSize: 11, color: C.muted, fontWeight: '500', marginBottom: 4 },
  prochPrix:      { fontSize: 13, fontWeight: '700', color: C.success, marginBottom: 8 },
  prochAccepterBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 20, paddingVertical: 8 },
  prochAccepterTxt:  { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
});

const px = StyleSheet.create({
  box:        { backgroundColor: C.successLight, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#6EE7B7', marginBottom: 14 },
  headerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  title:      { fontSize: 13, fontWeight: '800', color: C.success, flex: 1 },
  surgeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.errorLight, borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FCA5A5' },
  surgeTxt:   { fontSize: 11, fontWeight: '800', color: C.error },
  surgeRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentLight, borderRadius: 8, padding: 7, marginBottom: 8, borderWidth: 1, borderColor: '#FED7AA' },
  surgeLabel: { fontSize: 12, fontWeight: '700', color: C.accent },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#A7F3D0' },
  vehTxt:     { fontSize: 13, color: C.text, fontWeight: '600' },
  rangeTxt:   { fontSize: 13, fontWeight: '800', color: C.primary },
  detailBtn:  { flexDirection: 'row', alignItems: 'center', marginTop: 10, justifyContent: 'center' },
  detailBtnTxt: { fontSize: 12, fontWeight: '700', color: C.success },
  detail:     { backgroundColor: '#ECFDF5', borderRadius: 8, padding: 10, marginTop: 8 },
  detailLine: { fontSize: 12, color: C.muted, marginBottom: 3 },
});

// Sous-catégorie chips
const sc = StyleSheet.create({
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  chip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 50, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt },
  chipActive:  { borderColor: C.accent, backgroundColor: C.accentLight },
  chipTxt:     { fontSize: 12, fontWeight: '600', color: C.muted },
  chipTxtActive: { color: C.accent, fontWeight: '700' },
});

// Véhicule recommandé
const vr = StyleSheet.create({
  box:         { backgroundColor: C.bgAlt, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: C.border, marginBottom: 14 },
  title:       { fontSize: 13, fontWeight: '800', color: C.text },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card:        { width: '47%', borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 10, alignItems: 'center', gap: 5, backgroundColor: C.bg, position: 'relative' },
  cardSelected:{ borderColor: C.primary, borderWidth: 2 },
  cardLabel:   { fontSize: 11, fontWeight: '600', color: C.muted, textAlign: 'center' },
  recBadge:      { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  insuffisantBox:{ flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: C.accentLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: '#FED7AA' },
  insuffisantTxt:{ fontSize: 12, fontWeight: '700', color: C.accent, flex: 1 },
});

// Avertissement
const wn = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1.5, borderColor: '#FCD34D' },
  txt: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19, fontWeight: '600' },
});

const opt = StyleSheet.create({
  section:    { backgroundColor: C.bgAlt, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, marginBottom: 14, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  optIcon:    { width: 32, height: 32, borderRadius: 8, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  optTitle:   { fontSize: 14, fontWeight: '700', color: C.text },
  optSub:     { fontSize: 12, color: C.muted, marginTop: 2 },
  counter:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  counterBtnTxt: { fontSize: 18, fontWeight: '900', color: C.text, lineHeight: 22 },
  counterVal: { fontSize: 17, fontWeight: '900', color: C.text, minWidth: 22, textAlign: 'center' },
  toggle:     { width: 46, height: 26, borderRadius: 13, backgroundColor: '#D1D5DB', justifyContent: 'center', padding: 3 },
  thumb:      { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', elevation: 2 },
});

const qs = StyleSheet.create({
  section:      { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 12, letterSpacing: -0.2 },
  row:          { gap: 10, paddingHorizontal: 1, paddingBottom: 4 },
  card:         { width: 88, backgroundColor: C.bg, borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.border, gap: 8, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06 },
  iconBox:      { width: 52, height: 52, borderRadius: 14, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' },
  label:        { fontSize: 11, fontWeight: '700', color: C.text, textAlign: 'center' },
});

const hd = StyleSheet.create({
  topRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  salutation: { fontSize: 14, color: '#6B7280', fontWeight: '400' },
});

const rd = StyleSheet.create({
  card:       { width: 162, backgroundColor: C.bg, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: C.border, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06 },
  routeRow:   { flexDirection: 'row', alignItems: 'center', gap: 7 },
  routeLine:  { width: 1, height: 12, backgroundColor: C.border, marginLeft: 4, marginVertical: 3 },
  city:       { fontSize: 13, fontWeight: '700', color: C.text, flex: 1 },
  typeBadge:  { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  typeTxt:    { fontSize: 11, color: C.muted, fontWeight: '600' },
  refaireBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 9, marginTop: 10 },
  refaireTxt: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
});

// ── Toggle En ligne / Hors ligne ─────────────────────────────
const tg = StyleSheet.create({
  section:       { backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  track:         { width: TRACK_W, height: 56, borderRadius: 28, justifyContent: 'center', overflow: 'hidden' },
  thumb:         { position: 'absolute', height: 48, borderRadius: 24, backgroundColor: '#FFFFFF', top: 4, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4 },
  segments:      { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' },
  segment:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  segLabel:      { fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
  statusMsg:     { fontSize: 12, fontWeight: '500', textAlign: 'center', marginTop: 10, lineHeight: 18 },
  statsRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  statsTxt:      { fontSize: 13, color: C.muted, fontWeight: '500' },
  // Modal
  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet:    { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, alignItems: 'center' },
  modalHandle:   { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 24 },
  modalIcon:     { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle:    { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8, letterSpacing: -0.3 },
  modalSub:      { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalBtn:      { width: '100%', paddingVertical: 15, borderRadius: 50, alignItems: 'center', marginBottom: 12 },
  modalBtnTxt:   { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  modalBtnSecondary: { width: '100%', paddingVertical: 15, borderRadius: 50, alignItems: 'center', backgroundColor: C.bgAlt },
  modalBtnSecTxt:{ fontSize: 15, fontWeight: '700', color: C.text },
});

// ── DemandeCard redesign ─────────────────────────────────────
const dc = StyleSheet.create({
  routeBlock:    { marginBottom: 12 },
  routeRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeDotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.success },
  routeDotRed:   { width: 10, height: 10, borderRadius: 5, backgroundColor: C.error },
  routeCity:     { fontSize: 17, fontWeight: '900', color: C.text, letterSpacing: -0.4, flex: 1 },
  routeConnector:{ flexDirection: 'row', alignItems: 'center', marginLeft: 4, gap: 6, marginVertical: 4 },
  routeLine:     { flex: 1, height: 1, backgroundColor: C.border },
  distBadge:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 50, borderWidth: 1, borderColor: '#6EE7B7' },
  distTxt:       { fontSize: 11, fontWeight: '700', color: C.success },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 7 },
  infoIcon:      { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  infoTxt:       { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  infoSub:       { fontSize: 14, fontWeight: '500', color: C.muted },
  offreBadge:    { backgroundColor: C.successLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: '#6EE7B7' },
  offreTxt:      { fontSize: 11, fontWeight: '800', color: C.success },
  timingUrgent:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.errorLight, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#FCA5A5' },
  timingUrgentTxt: { fontSize: 12, fontWeight: '800', color: C.error },
  timingPlan:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EBF5FF', borderRadius: 50, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#BFDBFE' },
  timingPlanTxt: { fontSize: 12, fontWeight: '700', color: '#1A56DB' },
  footer:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  prixBox:       { gap: 1 },
  prixLabel:     { fontSize: 10, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  prixVal:       { fontSize: 18, fontWeight: '900', color: C.accent, letterSpacing: -0.4 },
  voirBtn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  voirTxt:       { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  accepterBtn:   { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A56DB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  accepterTxt:   { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});

// ── Boutons Maintenant / Planifier ───────────────────────────
const nb = StyleSheet.create({
  btnNoir:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0A0A0A', borderRadius: 12, padding: 20, marginBottom: 12 },
  btnBlanc: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, padding: 20, borderWidth: 1.5, borderColor: '#0A0A0A', marginBottom: 12 },
  emoji:    { fontSize: 26, marginRight: 14, width: 34 },
  title:    { fontSize: 17, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3, marginBottom: 3 },
  sub:      { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '400', lineHeight: 18 },
});
