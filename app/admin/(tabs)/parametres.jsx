import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet,
  Platform, StatusBar, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configDB, signalementsDB, logsAdminDB } from '../../../src/db/database';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', primary: '#1A56DB',
  accent: '#F97316', success: '#16A34A', error: '#DC2626', warning: '#D97706',
  text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
};

const VEHICULES = [
  { key: 'fourgon',  label: 'Fourgon',        icon: 'bus-outline' },
  { key: 'camion35', label: 'Camion 3.5T',    icon: 'car-outline' },
  { key: 'camion10', label: 'Camion 10T',      icon: 'cube-outline' },
  { key: 'semi',     label: 'Semi-remorque',   icon: 'construct-outline' },
];

const TYPES_SIGNALEMENT = {
  bug:       { label: 'Bug', color: C.error,   icon: 'bug-outline' },
  paiement:  { label: 'Paiement', color: C.warning, icon: 'cash-outline' },
  abus:      { label: 'Abus', color: C.error,  icon: 'flag-outline' },
  autre:     { label: 'Autre', color: C.muted, icon: 'help-circle-outline' },
};

export default function AdminParametres() {
  const router = useRouter();

  // Tarifs locaux (édition en cours)
  const [tarifs, setTarifs] = useState({
    fourgon:  { km: '45',  pec: '500' },
    camion35: { km: '65',  pec: '800' },
    camion10: { km: '90',  pec: '1200' },
    semi:     { km: '130', pec: '2000' },
  });
  const [tarifsOriginal, setTarifsOriginal] = useState(null);
  const [saving,       setSaving]        = useState(false);
  const [signalements, setSignalements]  = useState([]);
  const [refreshing,   setRefreshing]    = useState(false);
  const [adminId,      setAdminId]       = useState(null);

  const loadData = useCallback(() => {
    try {
      const t = configDB.getTarifs();
      const mapped = {
        fourgon:  { km: String(t.fourgon.km),  pec: String(t.fourgon.pec) },
        camion35: { km: String(t.camion35.km), pec: String(t.camion35.pec) },
        camion10: { km: String(t.camion10.km), pec: String(t.camion10.pec) },
        semi:     { km: String(t.semi.km),     pec: String(t.semi.pec) },
      };
      setTarifs(mapped);
      setTarifsOriginal(mapped);
    } catch (_) {}
    try { setSignalements(signalementsDB.getAll()); } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    AsyncStorage.getItem('dzexpress_admin_id').then(id => setAdminId(parseInt(id)));
  }, [loadData]));

  const onRefresh = () => { setRefreshing(true); loadData(); setRefreshing(false); };

  const updateTarif = (veh, field, val) => {
    setTarifs(prev => ({ ...prev, [veh]: { ...prev[veh], [field]: val.replace(',', '.') } }));
  };

  const handleSaveTarifs = () => {
    for (const veh of VEHICULES) {
      const km  = parseFloat(tarifs[veh.key].km);
      const pec = parseFloat(tarifs[veh.key].pec);
      if (isNaN(km) || km <= 0 || isNaN(pec) || pec <= 0) {
        Alert.alert('Valeur invalide', `Vérifie les tarifs pour ${veh.label}.`);
        return;
      }
    }
    setSaving(true);
    try {
      for (const veh of VEHICULES) {
        configDB.set(`tarif_${veh.key}_km`,  tarifs[veh.key].km);
        configDB.set(`tarif_${veh.key}_pec`, tarifs[veh.key].pec);
      }
      if (adminId) {
        try { logsAdminDB.create(adminId, 'MODIFIER_TARIFS', tarifs); } catch (_) {}
      }
      Alert.alert('Tarifs mis à jour', 'Les nouveaux tarifs s\'appliquent immédiatement.');
      loadData();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTraiterSignalement = (sig) => {
    Alert.alert('Marquer comme traité ?', `Signalement de ${sig.user_nom ?? 'utilisateur inconnu'}`, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Marquer traité',
        onPress: () => {
          try {
            signalementsDB.traiter(sig.id);
            if (adminId) try { logsAdminDB.create(adminId, 'TRAITER_SIGNALEMENT', { id: sig.id }); } catch (_) {}
            loadData();
          } catch (e) { Alert.alert('Erreur', e.message); }
        },
      },
    ]);
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Quitter l\'espace gestionnaire ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('dzexpress_admin_id');
          router.replace('/admin/login');
        },
      },
    ]);
  };

  const tarifsDirty = tarifsOriginal && JSON.stringify(tarifs) !== JSON.stringify(tarifsOriginal);
  const nbOuverts   = signalements.filter(s => s.statut === 'ouvert').length;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <Text style={s.pageTitle}>Paramètres</Text>

      {/* ── Section : Gestion tarifs ── */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Ionicons name="cash-outline" size={18} color={C.primary} />
          <Text style={s.cardTitle}>Tarifs par véhicule</Text>
        </View>
        <Text style={s.cardSub}>
          Les modifications s'appliquent immédiatement dans l'app pour tous les calculs.
        </Text>

        {/* En-tête colonnes */}
        <View style={s.tarifHeader}>
          <Text style={[s.tarifCol, { flex: 2 }]}>Véhicule</Text>
          <Text style={s.tarifCol}>DA / km</Text>
          <Text style={s.tarifCol}>Prise en charge (DA)</Text>
        </View>

        {VEHICULES.map(veh => (
          <View key={veh.key} style={s.tarifRow}>
            <View style={[s.tarifCol, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
              <Ionicons name={veh.icon} size={16} color={C.muted} />
              <Text style={s.tarifLabel}>{veh.label}</Text>
            </View>
            <TextInput
              style={s.tarifInput}
              value={tarifs[veh.key].km}
              onChangeText={v => updateTarif(veh.key, 'km', v)}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={s.tarifInput}
              value={tarifs[veh.key].pec}
              onChangeText={v => updateTarif(veh.key, 'pec', v)}
              keyboardType="decimal-pad"
            />
          </View>
        ))}

        <TouchableOpacity
          style={[s.saveBtn, !tarifsDirty && s.saveBtnDisabled, saving && { opacity: 0.7 }]}
          onPress={handleSaveTarifs}
          disabled={!tarifsDirty || saving}
          activeOpacity={0.85}
        >
          <Ionicons name="checkmark-circle-outline" size={16} color={tarifsDirty ? '#FFFFFF' : C.muted} />
          <Text style={[s.saveBtnTxt, !tarifsDirty && { color: C.muted }]}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder les tarifs'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Section : Signalements ── */}
      <View style={s.card}>
        <View style={s.cardHead}>
          <Ionicons name="flag-outline" size={18} color={C.warning} />
          <Text style={s.cardTitle}>Signalements</Text>
          {nbOuverts > 0 && (
            <View style={s.openBadge}>
              <Text style={s.openBadgeTxt}>{nbOuverts} ouvert{nbOuverts > 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        {signalements.length === 0 ? (
          <View style={s.emptySmall}>
            <Ionicons name="checkmark-circle-outline" size={24} color={C.success} />
            <Text style={s.emptySmallTxt}>Aucun signalement</Text>
          </View>
        ) : (
          signalements.map(sig => {
            const info = TYPES_SIGNALEMENT[sig.type] ?? TYPES_SIGNALEMENT.autre;
            const isTraite = sig.statut === 'traite';
            return (
              <View key={sig.id} style={[s.sigCard, isTraite && s.sigCardTraite]}>
                <View style={s.sigTop}>
                  <View style={[s.sigTypeBadge, { backgroundColor: info.color + '18' }]}>
                    <Ionicons name={info.icon} size={12} color={info.color} />
                    <Text style={[s.sigTypeTxt, { color: info.color }]}>{info.label}</Text>
                  </View>
                  {isTraite ? (
                    <View style={s.traiteBadge}>
                      <Ionicons name="checkmark-circle" size={12} color={C.success} />
                      <Text style={s.traiteTxt}>Traité</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={s.traiterBtn} onPress={() => handleTraiterSignalement(sig)}>
                      <Text style={s.traiterBtnTxt}>Marquer traité</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={s.sigDesc} numberOfLines={3}>{sig.description}</Text>
                <View style={s.sigMeta}>
                  <Ionicons name="person-outline" size={11} color={C.muted} />
                  <Text style={s.sigMetaTxt}>{sig.user_nom ?? 'Anonyme'}</Text>
                  {sig.user_tel && <Text style={s.sigMetaTxt}>· {sig.user_tel}</Text>}
                  <Text style={s.sigMetaTxt}>· {sig.created_at?.slice(0, 10) ?? '—'}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      {/* ── Déconnexion ── */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={18} color={C.error} />
        <Text style={s.logoutTxt}>Déconnexion de l'espace admin</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: C.bg },
  content:   {
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingHorizontal: 16, paddingBottom: 40, gap: 16,
  },
  pageTitle: { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5, marginBottom: 4 },

  card:      { backgroundColor: C.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4 },
  cardHead:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: C.text, flex: 1 },
  cardSub:   { fontSize: 12, color: C.muted, lineHeight: 17, marginBottom: 14 },

  tarifHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4 },
  tarifCol:    { flex: 1, fontSize: 10, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  tarifRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', gap: 6 },
  tarifLabel:  { fontSize: 13, fontWeight: '700', color: C.text },
  tarifInput:  { flex: 1, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontWeight: '700', color: C.text, textAlign: 'center' },

  saveBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.primary, borderRadius: 10, paddingVertical: 13, marginTop: 14 },
  saveBtnDisabled:{ backgroundColor: C.border },
  saveBtnTxt:     { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  openBadge:    { backgroundColor: C.warning + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 50 },
  openBadgeTxt: { fontSize: 11, fontWeight: '800', color: C.warning },

  emptySmall:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  emptySmallTxt: { fontSize: 14, color: C.muted, fontWeight: '600' },

  sigCard:      { backgroundColor: C.bg, borderRadius: 10, padding: 12, marginTop: 8, borderWidth: 1, borderColor: C.border },
  sigCardTraite:{ opacity: 0.6 },
  sigTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sigTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 50 },
  sigTypeTxt:   { fontSize: 11, fontWeight: '700' },
  traiteBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  traiteTxt:    { fontSize: 11, fontWeight: '700', color: C.success },
  traiterBtn:   { backgroundColor: C.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50 },
  traiterBtnTxt:{ fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  sigDesc:      { fontSize: 13, color: C.text, lineHeight: 19, marginBottom: 6 },
  sigMeta:      { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  sigMetaTxt:   { fontSize: 11, color: C.muted },

  logoutBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.error + '10', borderRadius: 12, paddingVertical: 14, borderWidth: 1.5, borderColor: C.error + '40' },
  logoutTxt:    { fontSize: 15, fontWeight: '700', color: C.error },
});
