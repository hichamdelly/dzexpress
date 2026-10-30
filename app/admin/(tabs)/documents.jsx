import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput, StyleSheet,
  Platform, StatusBar, RefreshControl, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { adminDB, logsAdminDB } from '../../../src/db/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', primary: '#1A56DB',
  success: '#16A34A', error: '#DC2626', warning: '#D97706',
  text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
};

const DOCS_REQUIS = [
  { key: 'cni',      label: "Carte d'identité (CNI)",  icon: 'card-outline' },
  { key: 'permis',   label: 'Permis de conduire',       icon: 'id-card-outline' },
  { key: 'assurance',label: 'Assurance véhicule',       icon: 'shield-outline' },
  { key: 'rc',       label: 'Registre de commerce',     icon: 'document-text-outline' },
  { key: 'photo',    label: 'Photo du véhicule',        icon: 'camera-outline' },
];

function DocItem({ doc }) {
  return (
    <View style={d.row}>
      <View style={d.iconBox}>
        <Ionicons name={doc.icon} size={16} color={C.muted} />
      </View>
      <Text style={d.label}>{doc.label}</Text>
      <View style={d.pendingBadge}>
        <Text style={d.pendingTxt}>En attente</Text>
      </View>
    </View>
  );
}
const d = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 10 },
  iconBox:     { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  label:       { flex: 1, fontSize: 13, color: C.text, fontWeight: '600' },
  pendingBadge:{ backgroundColor: C.warning + '18', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 50 },
  pendingTxt:  { fontSize: 10, fontWeight: '700', color: C.warning },
});

export default function AdminDocuments() {
  const [transporteurs, setTransporteurs]   = useState([]);
  const [refreshing,    setRefreshing]      = useState(false);
  const [rejectModal,   setRejectModal]     = useState(null);
  const [rejectMotif,   setRejectMotif]     = useState('');
  const [adminId,       setAdminId]         = useState(null);
  const [filtre,        setFiltre]          = useState('en_attente');

  const loadData = useCallback(() => {
    try { setTransporteurs(adminDB.getAllTransporteurs()); } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    AsyncStorage.getItem('dzexpress_admin_id').then(id => setAdminId(parseInt(id)));
  }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); setRefreshing(false); };

  const log = (action, details) => {
    if (adminId) try { logsAdminDB.create(adminId, action, details); } catch (_) {}
  };

  const handleValider = (u) => {
    Alert.alert(`Valider le dossier de ${u.nom} ?`, 'Ce chauffeur pourra accéder à toutes les fonctionnalités.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Valider le dossier', style: 'default',
        onPress: () => {
          try {
            adminDB.validerTransporteur(u.id);
            log('VALIDER_DOSSIER', { userId: u.id, nom: u.nom });
            loadData();
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
    if (!rejectMotif.trim()) { Alert.alert('Motif requis', 'Le motif de rejet est obligatoire.'); return; }
    try {
      adminDB.rejeterTransporteur(rejectModal.userId, rejectMotif.trim());
      log('REJETER_DOSSIER', { userId: rejectModal.userId, motif: rejectMotif.trim() });
      setRejectModal(null);
      loadData();
    } catch (e) { Alert.alert('Erreur', e.message); }
  };

  const filtered = transporteurs.filter(u => {
    const vs = u.validation_statut || 'en_attente';
    if (filtre === 'en_attente') return vs === 'en_attente';
    if (filtre === 'valide')     return vs === 'valide';
    if (filtre === 'rejete')     return vs === 'rejete';
    return true;
  });

  const counts = { all: transporteurs.length, en_attente: 0, valide: 0, rejete: 0 };
  transporteurs.forEach(u => {
    const vs = u.validation_statut || 'en_attente';
    counts[vs] = (counts[vs] ?? 0) + 1;
  });

  const renderCard = ({ item: u }) => {
    const vs = u.validation_statut || 'en_attente';
    const valColor = vs === 'valide' ? C.success : vs === 'rejete' ? C.error : C.warning;

    return (
      <View style={s.card}>
        {/* Entête */}
        <View style={s.cardHead}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>
              {u.nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={s.headInfo}>
            <Text style={s.nom} numberOfLines={1}>{u.nom}</Text>
            <Text style={s.tel}>{u.telephone} • {u.wilaya}</Text>
            {u.vehicule && <Text style={s.veh}>{u.vehicule}</Text>}
          </View>
          <View style={[s.vsBadge, { backgroundColor: valColor + '18', borderColor: valColor + '40' }]}>
            <Text style={[s.vsBadgeTxt, { color: valColor }]}>
              {vs === 'valide' ? 'Validé' : vs === 'rejete' ? 'Rejeté' : 'En attente'}
            </Text>
          </View>
        </View>

        {/* Liste documents */}
        {vs === 'en_attente' && (
          <View style={s.docSection}>
            <Text style={s.docTitle}>Documents requis</Text>
            {DOCS_REQUIS.map(doc => <DocItem key={doc.key} doc={doc} />)}
            <Text style={s.docNote}>
              Les chauffeurs doivent soumettre leurs documents via l'application.
              Vérifie les documents reçus avant de valider.
            </Text>
          </View>
        )}

        {u.motif_rejet_transporteur && vs === 'rejete' && (
          <View style={s.motifBox}>
            <Ionicons name="alert-circle-outline" size={14} color={C.error} />
            <Text style={s.motifTxt}>{u.motif_rejet_transporteur}</Text>
          </View>
        )}

        {/* Actions */}
        {vs !== 'valide' && (
          <View style={s.actions}>
            <TouchableOpacity style={s.btnValider} onPress={() => handleValider(u)}>
              <Ionicons name="checkmark-circle" size={14} color={C.success} />
              <Text style={s.btnValiderTxt}>Valider le dossier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnRejeter} onPress={() => handleRejecter(u)}>
              <Ionicons name="close-circle" size={14} color={C.error} />
              <Text style={s.btnRejeterTxt}>Rejeter avec motif</Text>
            </TouchableOpacity>
          </View>
        )}
        {vs === 'valide' && (
          <View style={s.validatedNote}>
            <Ionicons name="checkmark-circle" size={14} color={C.success} />
            <Text style={s.validatedNoteTxt}>Dossier validé · Accès complet accordé</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Documents</Text>
          <Text style={s.headerSub}>Validation des dossiers chauffeurs</Text>
        </View>
        <View style={[s.pendingBig, { backgroundColor: C.warning + '18' }]}>
          <Text style={[s.pendingBigTxt, { color: C.warning }]}>{counts.en_attente}</Text>
          <Text style={[s.pendingBigLbl, { color: C.warning }]}>en attente</Text>
        </View>
      </View>

      {/* Filtres */}
      <View style={s.filtreRow}>
        {[
          { key: 'en_attente', label: `En attente (${counts.en_attente})`, color: C.warning },
          { key: 'valide',     label: `Validés (${counts.valide})`,         color: C.success },
          { key: 'rejete',     label: `Rejetés (${counts.rejete})`,         color: C.error },
          { key: 'all',        label: `Tous (${counts.all})`,               color: C.muted },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.filtreChip, filtre === f.key && { borderColor: f.color, backgroundColor: f.color + '12' }]}
            onPress={() => setFiltre(f.key)}
          >
            <Text style={[s.filtreChipTxt, filtre === f.key && { color: f.color }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={u => String(u.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
        renderItem={renderCard}
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Ionicons name="document-text-outline" size={44} color="#D1D5DB" />
            <Text style={s.emptyTxt}>
              {filtre === 'en_attente' ? 'Aucun dossier en attente' : 'Aucun chauffeur dans cette catégorie'}
            </Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />

      {/* Modal motif rejet */}
      <Modal visible={!!rejectModal} transparent animationType="slide">
        <View style={m.overlay}>
          <View style={m.sheet}>
            <Text style={m.title}>Rejeter le dossier</Text>
            <Text style={m.sub}>{rejectModal?.nom} — entre le motif obligatoire :</Text>
            <TextInput
              style={m.input}
              placeholder="Documents illisibles, informations incorrectes, permis expiré…"
              placeholderTextColor="#9CA3AF"
              value={rejectMotif}
              onChangeText={setRejectMotif}
              multiline
              maxLength={300}
              autoFocus
            />
            <View style={m.btnRow}>
              <TouchableOpacity style={m.cancelBtn} onPress={() => setRejectModal(null)}>
                <Text style={m.cancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={m.confirmBtn} onPress={confirmRejet}>
                <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                <Text style={m.confirmTxt}>Rejeter</Text>
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
  header:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingHorizontal: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.text },
  headerSub:   { fontSize: 13, color: C.muted, marginTop: 2 },
  pendingBig:  { borderRadius: 12, padding: 10, alignItems: 'center', minWidth: 64 },
  pendingBigTxt: { fontSize: 22, fontWeight: '900' },
  pendingBigLbl: { fontSize: 10, fontWeight: '700' },

  filtreRow:    { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  filtreChip:   { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 50, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border },
  filtreChipTxt:{ fontSize: 11, fontWeight: '700', color: C.muted },

  card:      { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  cardHead:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  avatar:    { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EBF5FF', alignItems: 'center', justifyContent: 'center' },
  avatarTxt: { fontSize: 15, fontWeight: '900', color: C.primary },
  headInfo:  { flex: 1 },
  nom:       { fontSize: 15, fontWeight: '800', color: C.text },
  tel:       { fontSize: 12, color: C.muted, marginTop: 1 },
  veh:       { fontSize: 11, color: C.muted, marginTop: 2, fontWeight: '600' },
  vsBadge:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50, borderWidth: 1 },
  vsBadgeTxt:{ fontSize: 11, fontWeight: '800' },

  docSection: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  docTitle:   { fontSize: 13, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  docNote:    { fontSize: 11, color: C.muted, fontStyle: 'italic', marginTop: 8, lineHeight: 16 },

  motifBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: C.error + '10', borderRadius: 8, padding: 10, marginBottom: 8 },
  motifTxt:  { flex: 1, fontSize: 12, color: C.error, lineHeight: 17 },

  actions:      { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  btnValider:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: C.success + '14', borderWidth: 1.5, borderColor: C.success + '50' },
  btnValiderTxt:{ fontSize: 13, fontWeight: '700', color: C.success },
  btnRejeter:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: C.error + '12', borderWidth: 1.5, borderColor: C.error + '50' },
  btnRejeterTxt:{ fontSize: 13, fontWeight: '700', color: C.error },

  validatedNote:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  validatedNoteTxt: { fontSize: 12, color: C.success, fontWeight: '600' },

  empty:    { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyTxt: { fontSize: 14, color: C.muted, fontWeight: '600', textAlign: 'center' },
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
  confirmBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 14, borderRadius: 10, backgroundColor: C.error },
  confirmTxt: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
});
