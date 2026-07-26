import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  Platform, StatusBar, RefreshControl, Alert, Modal, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { adminDB, logsAdminDB } from '../../../src/db/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', primary: '#1A56DB',
  accent: '#F97316', success: '#16A34A', error: '#DC2626', warning: '#D97706',
  text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
};

const VALIDATION_COLORS = { valide: C.success, rejete: C.error, en_attente: C.warning };
const VALIDATION_ICONS  = { valide: 'checkmark-circle', rejete: 'close-circle', en_attente: 'time' };
const VALIDATION_LABELS = { valide: 'Validé', rejete: 'Rejeté', en_attente: 'En attente' };

function ValidationBadge({ statut }) {
  const s = statut || 'en_attente';
  const color = VALIDATION_COLORS[s] ?? C.muted;
  return (
    <View style={[vb.badge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <Ionicons name={VALIDATION_ICONS[s] ?? 'help-circle'} size={12} color={color} />
      <Text style={[vb.txt, { color }]}>{VALIDATION_LABELS[s] ?? s}</Text>
    </View>
  );
}
const vb = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 50, borderWidth: 1 },
  txt:   { fontSize: 10, fontWeight: '700' },
});

export default function AdminUtilisateurs() {
  const [users,      setUsers]      = useState([]);
  const [filtre,     setFiltre]     = useState('all');
  const [search,     setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [rejectModal, setRejectModal] = useState(null); // { userId, nom }
  const [rejectMotif, setRejectMotif] = useState('');
  const [adminId,    setAdminId]    = useState(null);

  const loadUsers = useCallback(() => {
    try { setUsers(adminDB.getAllUsers()); } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => {
    loadUsers();
    AsyncStorage.getItem('dzexpress_admin_id').then(id => setAdminId(parseInt(id)));
  }, [loadUsers]));

  const onRefresh = () => { setRefreshing(true); loadUsers(); setRefreshing(false); };

  const log = (action, details) => {
    if (adminId) try { logsAdminDB.create(adminId, action, details); } catch (_) {}
  };

  const handleValider = (u) => {
    Alert.alert(`Valider ${u.nom} ?`, 'Ce transporteur sera validé et pourra recevoir des courses.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Valider', style: 'default',
        onPress: () => {
          try {
            adminDB.validerTransporteur(u.id);
            log('VALIDER_TRANSPORTEUR', { userId: u.id, nom: u.nom });
            loadUsers();
          } catch (e) { Alert.alert('Erreur', e.message); }
        },
      },
    ]);
  };

  const handleRejecter = (u) => {
    setRejectMotif('');
    setRejectModal({ userId: u.id, nom: u.nom });
  };

  const confirmRejet = () => {
    if (!rejectMotif.trim()) { Alert.alert('Motif requis', 'Entre un motif de rejet.'); return; }
    try {
      adminDB.rejeterTransporteur(rejectModal.userId, rejectMotif.trim());
      log('REJETER_TRANSPORTEUR', { userId: rejectModal.userId, nom: rejectModal.nom, motif: rejectMotif.trim() });
      setRejectModal(null);
      loadUsers();
    } catch (e) { Alert.alert('Erreur', e.message); }
  };

  const handleSuspendre = (u) => {
    const isSuspended = u.suspendu_jusqu_au && new Date(u.suspendu_jusqu_au) > new Date();
    if (isSuspended) {
      Alert.alert(`Lever la suspension de ${u.nom} ?`, `Actuellement suspendu jusqu'au ${u.suspendu_jusqu_au}.`, [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Lever la suspension',
          onPress: () => {
            try { adminDB.leverSuspension(u.id); log('LEVER_SUSPENSION', { userId: u.id }); loadUsers(); } catch (_) {}
          },
        },
      ]);
    } else {
      Alert.alert(`Suspendre ${u.nom} ?`, 'Ce transporteur sera suspendu 7 jours.', [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Suspendre', style: 'destructive',
          onPress: () => {
            try { adminDB.suspendreTransporteur(u.id); log('SUSPENDRE_TRANSPORTEUR', { userId: u.id }); loadUsers(); } catch (_) {}
          },
        },
      ]);
    }
  };

  const filtered = users.filter(u => {
    if (filtre === 'expediteur'   && u.type !== 'expediteur')   return false;
    if (filtre === 'transporteur' && u.type !== 'transporteur') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return u.nom?.toLowerCase().includes(q) || u.telephone?.toLowerCase().includes(q) || u.wilaya?.toLowerCase().includes(q);
    }
    return true;
  });

  const counts = { all: users.length, expediteur: 0, transporteur: 0 };
  users.forEach(u => { if (u.type === 'expediteur') counts.expediteur++; else if (u.type === 'transporteur') counts.transporteur++; });

  const renderUser = ({ item: u }) => {
    const isSuspended = u.suspendu_jusqu_au && new Date(u.suspendu_jusqu_au) > new Date();
    const isTransporteur = u.type === 'transporteur';
    const valStatut = u.validation_statut || 'en_attente';

    return (
      <View style={s.card}>
        <View style={s.cardTop}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>
              {u.nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={s.cardInfo}>
            <Text style={s.cardNom} numberOfLines={1}>{u.nom}</Text>
            <Text style={s.cardTel}>{u.telephone}</Text>
            <View style={s.cardBadges}>
              <View style={[s.typeBadge, u.type === 'expediteur' ? s.expBadge : s.transBadge]}>
                <Text style={[s.typeBadgeTxt, u.type === 'expediteur' ? { color: C.accent } : { color: C.primary }]}>
                  {u.type === 'expediteur' ? 'Expéditeur' : 'Transporteur'}
                </Text>
              </View>
              {isSuspended && (
                <View style={s.suspBadge}>
                  <Text style={s.suspBadgeTxt}>Suspendu</Text>
                </View>
              )}
            </View>
          </View>
          <View style={s.cardRight}>
            <View style={[s.onlineDot, { backgroundColor: u.disponible ? C.success : '#D1D5DB' }]} />
            <Text style={s.onlineTxt}>{u.disponible ? 'En ligne' : 'Hors ligne'}</Text>
          </View>
        </View>

        {/* Détails transporteur */}
        {isTransporteur && (
          <View style={s.transDetails}>
            <View style={s.transRow}>
              <ValidationBadge statut={valStatut} />
              {u.vehicule && (
                <View style={s.vehBadge}>
                  <Ionicons name="car-outline" size={11} color={C.muted} />
                  <Text style={s.vehTxt}>{u.vehicule}</Text>
                </View>
              )}
              {u.nb_courses != null && (
                <View style={s.coursesBadge}>
                  <Ionicons name="checkmark-circle-outline" size={11} color={C.muted} />
                  <Text style={s.vehTxt}>{u.nb_courses} course{u.nb_courses !== 1 ? 's' : ''}</Text>
                </View>
              )}
            </View>
            {u.motif_rejet_transporteur && valStatut === 'rejete' && (
              <Text style={s.motifTxt} numberOfLines={2}>Motif : {u.motif_rejet_transporteur}</Text>
            )}

            {/* Actions */}
            <View style={s.actions}>
              {valStatut !== 'valide' && (
                <TouchableOpacity style={s.btnValider} onPress={() => handleValider(u)}>
                  <Ionicons name="checkmark" size={13} color={C.success} />
                  <Text style={s.btnValiderTxt}>Valider</Text>
                </TouchableOpacity>
              )}
              {valStatut !== 'rejete' && (
                <TouchableOpacity style={s.btnRejeter} onPress={() => handleRejecter(u)}>
                  <Ionicons name="close" size={13} color={C.error} />
                  <Text style={s.btnRejeterTxt}>Rejeter</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.btnSuspendre, isSuspended && s.btnLeverSusp]}
                onPress={() => handleSuspendre(u)}
              >
                <Ionicons name={isSuspended ? 'lock-open-outline' : 'ban-outline'} size={13} color={isSuspended ? C.primary : C.warning} />
                <Text style={[s.btnSuspreTxt, isSuspended && { color: C.primary }]}>
                  {isSuspended ? 'Lever' : 'Suspendre'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={s.cardDate}>Inscrit le {u.created_at?.slice(0, 10) ?? '—'}</Text>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <Text style={s.headerTitle}>Utilisateurs</Text>
        <View style={s.countBadge}>
          <Text style={s.countTxt}>{filtered.length}</Text>
        </View>
      </View>

      {/* Recherche */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Nom, téléphone, wilaya…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres type */}
      <View style={s.filtreRow}>
        {[
          { key: 'all',          label: `Tous (${counts.all})` },
          { key: 'expediteur',   label: `Expéditeurs (${counts.expediteur})` },
          { key: 'transporteur', label: `Transporteurs (${counts.transporteur})` },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filtreChip, filtre === f.key && s.filtreChipActive]}
            onPress={() => setFiltre(f.key)}
          >
            <Text style={[s.filtreChipTxt, filtre === f.key && s.filtreChipTxtActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={u => String(u.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
        renderItem={renderUser}
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Ionicons name="people-outline" size={40} color="#D1D5DB" />
            <Text style={s.emptyTxt}>Aucun utilisateur</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      {/* Modal motif rejet */}
      <Modal visible={!!rejectModal} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={m.sheet}>
            <Text style={m.title}>Rejeter {rejectModal?.nom}</Text>
            <Text style={m.sub}>Entre le motif du rejet (obligatoire) :</Text>
            <TextInput
              style={m.input}
              placeholder="Documents manquants, informations incorrectes…"
              placeholderTextColor="#9CA3AF"
              value={rejectMotif}
              onChangeText={setRejectMotif}
              multiline
              maxLength={200}
              autoFocus
            />
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setRejectModal(null)}>
                <Text style={m.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.confirmBtn} onPress={confirmRejet}>
                <Text style={m.confirmTxt}>Confirmer le rejet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  header:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.text },
  countBadge:  { backgroundColor: C.primary + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 50 },
  countTxt:    { fontSize: 12, fontWeight: '800', color: C.primary },

  searchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 16, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, color: C.text },

  filtreRow:        { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  filtreChip:       { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 50, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border },
  filtreChipActive: { borderColor: C.primary, backgroundColor: '#EBF5FF' },
  filtreChipTxt:    { fontSize: 12, fontWeight: '700', color: C.muted },
  filtreChipTxtActive: { color: C.primary },

  card:       { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  avatar:     { width: 44, height: 44, borderRadius: 22, backgroundColor: '#EBF5FF', alignItems: 'center', justifyContent: 'center' },
  avatarTxt:  { fontSize: 14, fontWeight: '900', color: C.primary },
  cardInfo:   { flex: 1 },
  cardNom:    { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 2 },
  cardTel:    { fontSize: 12, color: C.muted, marginBottom: 5 },
  cardBadges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  typeBadge:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 50 },
  expBadge:   { backgroundColor: C.accent + '18' },
  transBadge: { backgroundColor: C.primary + '18' },
  typeBadgeTxt: { fontSize: 10, fontWeight: '700' },
  suspBadge:  { backgroundColor: C.error + '18', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 50 },
  suspBadgeTxt: { fontSize: 10, fontWeight: '700', color: C.error },
  cardRight:  { alignItems: 'center', gap: 3 },
  onlineDot:  { width: 10, height: 10, borderRadius: 5 },
  onlineTxt:  { fontSize: 10, color: C.muted, fontWeight: '600' },
  cardDate:   { fontSize: 11, color: C.muted, marginTop: 8 },

  transDetails: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  transRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  vehBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 50, borderWidth: 1, borderColor: C.border },
  coursesBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.bg, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 50, borderWidth: 1, borderColor: C.border },
  vehTxt:       { fontSize: 10, color: C.muted, fontWeight: '600' },
  motifTxt:     { fontSize: 11, color: C.error, fontStyle: 'italic', marginBottom: 8 },

  actions:      { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 8 },
  btnValider:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 50, borderWidth: 1.5, borderColor: C.success + '60', backgroundColor: C.success + '12' },
  btnValiderTxt:{ fontSize: 11, fontWeight: '700', color: C.success },
  btnRejeter:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 50, borderWidth: 1.5, borderColor: C.error + '60', backgroundColor: C.error + '12' },
  btnRejeterTxt:{ fontSize: 11, fontWeight: '700', color: C.error },
  btnSuspendre: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 50, borderWidth: 1.5, borderColor: C.warning + '60', backgroundColor: C.warning + '12' },
  btnLeverSusp: { borderColor: C.primary + '60', backgroundColor: C.primary + '12' },
  btnSuspreTxt: { fontSize: 11, fontWeight: '700', color: C.warning },

  empty:    { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTxt: { fontSize: 15, color: C.muted, fontWeight: '600' },
});

const m = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:      { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  title:      { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  sub:        { fontSize: 14, color: C.muted, marginBottom: 14 },
  input:      { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, padding: 14, fontSize: 14, color: C.text, minHeight: 80, textAlignVertical: 'top', marginBottom: 16 },
  btnRow:     { flexDirection: 'row', gap: 10 },
  cancelBtn:  { flex: 1, paddingVertical: 14, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, alignItems: 'center' },
  cancelTxt:  { fontSize: 15, fontWeight: '700', color: C.muted },
  confirmBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: C.error, alignItems: 'center' },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
