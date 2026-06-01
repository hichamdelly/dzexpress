import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, StatusBar, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { demandesDB } from '../../src/db/database';

const C = {
  blue:        '#1A56DB',
  blueLight:   '#EBF5FF',
  blueDark:    '#1E40AF',
  orange:      '#F97316',
  orangeLight: '#FFF7ED',
  bg:          '#F8FAFC',
  white:       '#FFFFFF',
  text:        '#1E293B',
  muted:       '#64748B',
  border:      '#E2E8F0',
  green:       '#16A34A',
  greenLight:  '#F0FDF4',
  yellow:      '#D97706',
  yellowLight: '#FFFBEB',
  red:         '#DC2626',
  redLight:    '#FEF2F2',
};

const STATUTS = {
  en_attente: { label: 'En attente',  color: C.yellow, bg: C.yellowLight, icon: '⏳' },
  acceptee:   { label: 'Acceptée',    color: C.blue,   bg: C.blueLight,   icon: '✅' },
  en_cours:   { label: 'En cours',    color: C.orange, bg: C.orangeLight, icon: '🚛' },
  livree:     { label: 'Livrée',      color: C.green,  bg: C.greenLight,  icon: '📦' },
  annulee:    { label: 'Annulée',     color: C.red,    bg: C.redLight,    icon: '❌' },
};

const TYPES_ICON = {
  meubles: '🪑', electromenager: '📺', cartons: '📦',
  materiaux: '🧱', vehicule: '🚗', autre: '🔧',
};

function StatusBadge({ statut }) {
  const st = STATUTS[statut] || STATUTS.en_attente;
  return (
    <View style={[badge.root, { backgroundColor: st.bg }]}>
      <Text style={[badge.txt, { color: st.color }]}>{st.icon} {st.label}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  root: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  txt:  { fontSize: 12, fontWeight: '700' },
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

  const filtered = filtre === 'all' ? demandes : demandes.filter(d => d.statut === filtre);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>📋 Mes demandes</Text>
        <Text style={s.headerSub}>{demandes.length} demande{demandes.length !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
        {[
          { key: 'all',        label: 'Toutes' },
          { key: 'en_attente', label: '⏳ En attente' },
          { key: 'acceptee',   label: '✅ Acceptées' },
          { key: 'en_cours',   label: '🚛 En cours' },
          { key: 'livree',     label: '📦 Livrées' },
        ].map(f => (
          <TouchableOpacity key={f.key}
            style={[s.filterChip, filtre === f.key && s.filterChipOn]}
            onPress={() => setFiltre(f.key)}>
            <Text style={[s.filterChipTxt, filtre === f.key && s.filterChipTxtOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.orange} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 52, marginBottom: 14 }}>📭</Text>
          <Text style={s.emptyTitle}>{filtre === 'all' ? 'Aucune demande' : 'Aucune dans cette catégorie'}</Text>
          <Text style={s.emptyDesc}>{filtre === 'all' ? 'Publie ta première demande depuis l\'onglet Accueil !' : 'Essaie un autre filtre.'}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={C.orange} />}
        >
          {filtered.map(d => (
            <TouchableOpacity key={d.id} style={s.card}
              onPress={() => router.push(`/demande/${d.id}`)} activeOpacity={0.88}>
              <View style={s.cardTop}>
                <View style={[s.iconBox, { backgroundColor: C.orangeLight }]}>
                  <Text style={{ fontSize: 26 }}>{TYPES_ICON[d.type_marchandise] || '📦'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.cardRoute}>{d.ville_depart} → {d.ville_arrivee}</Text>
                  <Text style={s.cardType}>{d.type_marchandise} {d.poids ? `· ${d.poids}` : ''}</Text>
                </View>
                <StatusBadge statut={d.statut} />
              </View>

              <View style={s.cardMeta}>
                <Text style={s.metaItem}>📅 {d.date_souhaitee}</Text>
                {d.transporteur_nom && <Text style={s.metaItem}>🚛 {d.transporteur_nom}</Text>}
              </View>

              {d.statut === 'acceptee' && d.transporteur_nom && (
                <View style={s.infoBar}>
                  <Text style={s.infoBarTxt}>✅ Accepté par {d.transporteur_nom} · {d.transporteur_tel}</Text>
                </View>
              )}

              <View style={s.cardFooter}>
                <Text style={s.cardDate}>{d.created_at?.slice(0, 10)}</Text>
                {d.statut === 'en_attente' && (
                  <TouchableOpacity onPress={() => annuler(d.id)}>
                    <Text style={s.cancelTxt}>Annuler</Text>
                  </TouchableOpacity>
                )}
                <Text style={s.voirDetail}>Voir →</Text>
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

  const filtered = filtre === 'all' ? courses : courses.filter(c => c.statut === filtre);
  const actif  = courses.filter(c => ['acceptee', 'en_cours'].includes(c.statut)).length;
  const livrees = courses.filter(c => c.statut === 'livree').length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[s.header, { backgroundColor: C.blueDark }]}>
        <Text style={s.headerTitle}>🚛 Mes courses</Text>
        <Text style={s.headerSub}>{actif} active{actif !== 1 ? 's' : ''} · {livrees} livrée{livrees !== 1 ? 's' : ''}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar}
        contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 10, gap: 8 }}>
        {[
          { key: 'all',      label: 'Toutes' },
          { key: 'acceptee', label: '✅ Acceptées' },
          { key: 'en_cours', label: '🚛 En cours' },
          { key: 'livree',   label: '📦 Livrées' },
        ].map(f => (
          <TouchableOpacity key={f.key}
            style={[s.filterChip, filtre === f.key && [s.filterChipOn, { backgroundColor: C.blue, borderColor: C.blue }]]}
            onPress={() => setFiltre(f.key)}>
            <Text style={[s.filterChipTxt, filtre === f.key && s.filterChipTxtOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.blue} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 52, marginBottom: 14 }}>🚛</Text>
          <Text style={s.emptyTitle}>Aucune course ici</Text>
          <Text style={s.emptyDesc}>Va dans «&nbsp;Disponibles&nbsp;» pour accepter des demandes !</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={C.blue} />}
        >
          {filtered.map(c => (
            <TouchableOpacity key={c.id} style={s.card}
              onPress={() => router.push(`/course/${c.id}`)} activeOpacity={0.88}>
              <View style={s.cardTop}>
                <View style={[s.iconBox, { backgroundColor: C.blueLight }]}>
                  <Text style={{ fontSize: 26 }}>{TYPES_ICON[c.type_marchandise] || '📦'}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.cardRoute}>{c.ville_depart} → {c.ville_arrivee}</Text>
                  <Text style={s.cardType}>{c.type_marchandise} {c.poids ? `· ${c.poids}` : ''}</Text>
                </View>
                <StatusBadge statut={c.statut} />
              </View>

              <View style={s.cardMeta}>
                <Text style={s.metaItem}>📅 {c.date_souhaitee}</Text>
                <Text style={s.metaItem}>👤 {c.expediteur_nom}</Text>
              </View>

              {c.statut === 'acceptee' && (
                <View style={[s.actionHint, { borderColor: C.blue }]}>
                  <Text style={[s.actionHintTxt, { color: C.blue }]}>▶ Appuie pour démarrer la course</Text>
                </View>
              )}
              {c.statut === 'en_cours' && (
                <View style={[s.actionHint, { borderColor: C.orange }]}>
                  <Text style={[s.actionHintTxt, { color: C.orange }]}>🚛 En cours — Appuie pour marquer livré</Text>
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
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  emptyDesc:   { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  header:      { backgroundColor: C.orange, paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '900' },
  headerSub:   { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 3 },
  filterBar:   { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0 },
  filterChip:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  filterChipOn:{ backgroundColor: C.orange, borderColor: C.orange },
  filterChipTxt:   { fontSize: 13, fontWeight: '600', color: C.muted },
  filterChipTxtOn: { color: C.white },
  card:        { backgroundColor: C.white, borderRadius: 16, padding: 16, elevation: 2, borderWidth: 1, borderColor: C.border },
  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconBox:     { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardRoute:   { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 3 },
  cardType:    { fontSize: 12, color: C.muted, fontWeight: '600' },
  cardMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  metaItem:    { fontSize: 12, color: C.muted, fontWeight: '600' },
  infoBar:     { backgroundColor: C.greenLight, borderRadius: 10, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  infoBarTxt:  { fontSize: 13, color: C.green, fontWeight: '600' },
  actionHint:  { borderRadius: 10, padding: 10, borderWidth: 1.5, marginBottom: 6 },
  actionHintTxt: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  cardDate:    { fontSize: 12, color: C.muted },
  cancelTxt:   { fontSize: 13, color: C.red, fontWeight: '600' },
  voirDetail:  { fontSize: 13, color: C.blue, fontWeight: '700' },
});
