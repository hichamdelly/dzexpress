import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, StatusBar, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/context/AppContext';
import { demandesDB } from '../../src/db/database';

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
  warning: '#F59E0B', warningLight: '#FFFBEB',
};

const STATUTS = {
  en_attente: { label: 'En attente',  color: C.warning,  bg: C.warningLight,  icon: 'time-outline' },
  acceptee:   { label: 'Acceptée',    color: '#1A56DB',  bg: '#EBF5FF',       icon: 'checkmark-circle-outline' },
  en_cours:   { label: 'En cours',    color: C.accent,   bg: C.accentLight,   icon: 'car-sport-outline' },
  livree:     { label: 'Livrée',      color: C.success,  bg: C.successLight,  icon: 'cube-outline' },
  annulee:    { label: 'Annulée',     color: C.error,    bg: C.errorLight,    icon: 'close-circle-outline' },
};

const TYPES_ICON = {
  meubles: 'grid-outline', electromenager: 'tv-outline', cartons: 'cube-outline',
  materiaux: 'construct-outline', vehicule: 'car-outline', autre: 'ellipsis-horizontal-outline',
};

function StatusPill({ statut }) {
  const st = STATUTS[statut] || STATUTS.en_attente;
  return (
    <View style={[pill.root, { backgroundColor: st.bg }]}>
      <Ionicons name={st.icon} size={11} color={st.color} style={{ marginRight: 4 }} />
      <Text style={[pill.txt, { color: st.color }]}>{st.label}</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50 },
  txt:  { fontSize: 11, fontWeight: '700' },
});

// ── MES DEMANDES (Expéditeur) ────────────────────────────────
function MesDemandes({ user }) {
  const router = useRouter();
  const [demandes, setDemandes]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtre, setFiltre]         = useState('all');

  const fetch = useCallback(() => {
    try { setDemandes(demandesDB.getByExpediteur(user.id)); }
    catch (e) { console.log(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user.id]);

  useFocusEffect(useCallback(() => { setLoading(true); fetch(); }, [fetch]));

  const annuler = (id) =>
    Alert.alert('Annuler la demande ?', 'Elle ne sera plus visible par les transporteurs.', [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui', style: 'destructive', onPress: () => { demandesDB.updateStatut(id, 'annulee'); fetch(); } },
    ]);

  const FILTRES = [
    { key: 'all',        label: 'Toutes' },
    { key: 'en_attente', label: 'En attente' },
    { key: 'acceptee',   label: 'Acceptées' },
    { key: 'en_cours',   label: 'En cours' },
    { key: 'livree',     label: 'Livrées' },
  ];

  const filtered = filtre === 'all' ? demandes : demandes.filter(d => d.statut === filtre);

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Mes demandes</Text>
        <View style={s.headerBadge}>
          <Text style={s.headerBadgeTxt}>{demandes.length}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        {FILTRES.map(f => (
          <TouchableOpacity key={f.key}
            style={[s.filterChip, filtre === f.key && s.filterChipOn]}
            onPress={() => setFiltre(f.key)}>
            <Text style={[s.filterChipTxt, filtre === f.key && s.filterChipTxtOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.accent} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}><Ionicons name="cube-outline" size={32} color="#D1D5DB" /></View>
          <Text style={s.emptyTitle}>{filtre === 'all' ? 'Aucune demande' : 'Aucune dans cette catégorie'}</Text>
          <Text style={s.emptyDesc}>{filtre === 'all' ? 'Publie ta première demande depuis l\'onglet Accueil' : 'Essaie un autre filtre'}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={C.accent} />}
        >
          {filtered.map(d => (
            <TouchableOpacity key={d.id} style={s.card}
              onPress={() => router.push(`/demande/${d.id}`)} activeOpacity={0.92}>

              <View style={s.cardTop}>
                <View style={[s.cardIcon, { backgroundColor: C.accentLight }]}>
                  <Ionicons name={TYPES_ICON[d.type_marchandise] || 'cube-outline'} size={22} color={C.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.cardRoute}>{d.ville_depart}  →  {d.ville_arrivee}</Text>
                  <Text style={s.cardMeta}>{d.type_marchandise}{d.poids ? ` · ${d.poids}` : ''}</Text>
                </View>
                <StatusPill statut={d.statut} />
              </View>

              <View style={s.cardInfo}>
                <View style={s.infoChip}>
                  <Ionicons name="calendar-outline" size={12} color={C.muted} style={{ marginRight: 4 }} />
                  <Text style={s.infoChipTxt}>{d.date_souhaitee}</Text>
                </View>
                {d.transporteur_nom && (
                  <View style={s.infoChip}>
                    <Ionicons name="car-sport-outline" size={12} color={C.muted} style={{ marginRight: 4 }} />
                    <Text style={s.infoChipTxt}>{d.transporteur_nom}</Text>
                  </View>
                )}
              </View>

              {d.statut === 'acceptee' && d.transporteur_nom && (
                <View style={s.acceptedBar}>
                  <Ionicons name="checkmark-circle" size={14} color={C.success} style={{ marginRight: 6 }} />
                  <Text style={s.acceptedBarTxt}>Accepté par {d.transporteur_nom}</Text>
                </View>
              )}

              <View style={s.cardFooter}>
                <Text style={s.cardDate}>{d.created_at?.slice(0, 10)}</Text>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {d.statut === 'en_attente' && (
                    <TouchableOpacity onPress={() => annuler(d.id)}>
                      <Text style={s.cancelTxt}>Annuler</Text>
                    </TouchableOpacity>
                  )}
                  <View style={s.seeBtn}>
                    <Text style={s.seeBtnTxt}>Voir</Text>
                    <Ionicons name="chevron-forward" size={13} color={C.primary} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── MES COURSES (Transporteur) ───────────────────────────────
function MesCourses({ user }) {
  const router = useRouter();
  const [courses, setCourses]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtre, setFiltre]         = useState('all');

  const fetch = useCallback(() => {
    try { setCourses(demandesDB.getByTransporteur(user.id)); }
    catch (e) { console.log(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user.id]);

  useFocusEffect(useCallback(() => { setLoading(true); fetch(); }, [fetch]));

  const FILTRES = [
    { key: 'all',      label: 'Toutes' },
    { key: 'acceptee', label: 'Acceptées' },
    { key: 'en_cours', label: 'En cours' },
    { key: 'livree',   label: 'Livrées' },
  ];

  const filtered = filtre === 'all' ? courses : courses.filter(c => c.statut === filtre);
  const actif    = courses.filter(c => ['acceptee', 'en_cours'].includes(c.statut)).length;
  const livrees  = courses.filter(c => c.statut === 'livree').length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      <View style={[s.header, { backgroundColor: C.primary }]}>
        <Text style={[s.headerTitle, { color: '#FFFFFF' }]}>Mes courses</Text>
        <View style={[s.headerBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Text style={[s.headerBadgeTxt, { color: '#FFFFFF' }]}>{actif} active{actif !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        {FILTRES.map(f => (
          <TouchableOpacity key={f.key}
            style={[s.filterChip, filtre === f.key && [s.filterChipOn, { backgroundColor: C.primary, borderColor: C.primary }]]}
            onPress={() => setFiltre(f.key)}>
            <Text style={[s.filterChipTxt, filtre === f.key && s.filterChipTxtOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}><Ionicons name="car-sport-outline" size={32} color="#D1D5DB" /></View>
          <Text style={s.emptyTitle}>Aucune course ici</Text>
          <Text style={s.emptyDesc}>Va dans «Disponibles» pour accepter des demandes</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={C.primary} />}
        >
          {filtered.map(c => (
            <TouchableOpacity key={c.id} style={s.card}
              onPress={() => router.push(`/course/${c.id}`)} activeOpacity={0.92}>

              <View style={s.cardTop}>
                <View style={[s.cardIcon, { backgroundColor: C.bgAlt }]}>
                  <Ionicons name={TYPES_ICON[c.type_marchandise] || 'cube-outline'} size={22} color={C.muted} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.cardRoute}>{c.ville_depart}  →  {c.ville_arrivee}</Text>
                  <Text style={s.cardMeta}>{c.type_marchandise}{c.poids ? ` · ${c.poids}` : ''}</Text>
                </View>
                <StatusPill statut={c.statut} />
              </View>

              <View style={s.cardInfo}>
                <View style={s.infoChip}>
                  <Ionicons name="calendar-outline" size={12} color={C.muted} style={{ marginRight: 4 }} />
                  <Text style={s.infoChipTxt}>{c.date_souhaitee}</Text>
                </View>
                <View style={s.infoChip}>
                  <Ionicons name="person-outline" size={12} color={C.muted} style={{ marginRight: 4 }} />
                  <Text style={s.infoChipTxt}>{c.expediteur_nom}</Text>
                </View>
              </View>

              {c.statut === 'acceptee' && (
                <View style={[s.hintBar, { borderColor: '#1A56DB', backgroundColor: '#EBF5FF' }]}>
                  <Ionicons name="play-circle-outline" size={14} color="#1A56DB" style={{ marginRight: 6 }} />
                  <Text style={[s.hintBarTxt, { color: '#1A56DB' }]}>Appuie pour démarrer la course</Text>
                </View>
              )}
              {c.statut === 'en_cours' && (
                <View style={[s.hintBar, { borderColor: C.accent, backgroundColor: C.accentLight }]}>
                  <Ionicons name="car-sport-outline" size={14} color={C.accent} style={{ marginRight: 6 }} />
                  <Text style={[s.hintBarTxt, { color: C.accent }]}>En cours — appuie pour marquer livré</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

export default function SuiviScreen() {
  const { user } = useApp();
  if (!user) return null;
  return user.type === 'expediteur'
    ? <MesDemandes user={user} />
    : <MesCourses user={user} />;
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 32, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6, textAlign: 'center' },
  emptyDesc:  { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },

  header: {
    backgroundColor: C.accent,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 18, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle:     { color: '#FFFFFF', fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  headerBadge:     { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5 },
  headerBadgeTxt:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  filterBar: { backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0 },
  filterChip:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg },
  filterChipOn:  { backgroundColor: C.accent, borderColor: C.accent },
  filterChipTxt: { fontSize: 13, fontWeight: '600', color: C.muted },
  filterChipTxtOn: { color: '#FFFFFF' },

  card: {
    backgroundColor: C.bg, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  cardTop:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardRoute:{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2, letterSpacing: -0.2 },
  cardMeta: { fontSize: 12, color: C.muted, fontWeight: '500' },

  cardInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  infoChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50 },
  infoChipTxt: { fontSize: 11, color: C.muted, fontWeight: '600' },

  acceptedBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 8, padding: 10, marginBottom: 10 },
  acceptedBarTxt: { fontSize: 13, color: C.success, fontWeight: '600' },

  hintBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1.5, padding: 10, marginBottom: 4 },
  hintBarTxt: { fontSize: 13, fontWeight: '600' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  cardDate:   { fontSize: 12, color: C.muted },
  cancelTxt:  { fontSize: 13, color: C.error, fontWeight: '600' },
  seeBtn:     { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeBtnTxt:  { fontSize: 13, color: C.primary, fontWeight: '700' },
});
