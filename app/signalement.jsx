import { useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, Alert, ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useApp } from '../src/context/AppContext';
import { signalementsDB, demandesDB } from '../src/db/database';

const C = {
  primary: '#0A0A0A', accent: '#0F4D2E', accentLight: '#E8F2EC',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
};

const CATEGORIES = [
  { key: 'paiement',     label: 'Paiement',         icon: 'cash-outline',           color: '#D97706', bg: '#FFFBEB' },
  { key: 'comportement', label: 'Comportement',      icon: 'person-remove-outline',  color: '#7C3AED', bg: '#F5F3FF' },
  { key: 'marchandise',  label: 'Marchandise',       icon: 'cube-outline',           color: '#D4A017', bg: '#E8F2EC' },
  { key: 'bug',          label: 'Bug technique',     icon: 'bug-outline',            color: '#DC2626', bg: '#FEF2F2' },
  { key: 'abus',         label: 'Fraude / Abus',     icon: 'shield-outline',         color: '#9333EA', bg: '#FAF5FF' },
  { key: 'autre',        label: 'Autre',             icon: 'help-circle-outline',    color: '#6B7280', bg: '#F9FAFB' },
];

const STATUT_LABELS = { ouvert: 'En cours', traite: 'Traité' };
const STATUT_COLORS = { ouvert: '#D97706', traite: '#10B981' };

function fmtDate(str) {
  if (!str) return '';
  const d = new Date(str.replace(' ', 'T'));
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SignalementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useApp();

  const [categorie, setCategorie]   = useState('');
  const [desc, setDesc]             = useState('');
  const [demandeId, setDemandeId]   = useState(params.demande_id ? parseInt(params.demande_id) : null);
  const [demandes, setDemandes]     = useState([]);
  const [showDemandes, setShowDemandes] = useState(false);
  const [sending, setSending]       = useState(false);
  const [succes, setSucces]         = useState(false);
  const [historique, setHistorique] = useState([]);
  const [showHistorique, setShowHistorique] = useState(false);

  const checkAnim = useRef(new Animated.Value(0)).current;

  const loadData = useCallback(() => {
    if (!user?.id) return;
    try {
      const mes = demandesDB.getByExpediteur(user.id)
        .concat(demandesDB.getByTransporteur ? demandesDB.getByTransporteur(user.id) : [])
        .slice(0, 10);
      setDemandes(mes);
    } catch (_) {}
    try { setHistorique(signalementsDB.getByUser(user.id)); } catch (_) {}
  }, [user?.id]);

  useFocusEffect(useCallback(() => { loadData(); setSucces(false); }, [loadData]));

  const demandeSelectionnee = demandes.find(d => d.id === demandeId);

  const envoyer = () => {
    if (!categorie) { Alert.alert('Catégorie requise', 'Choisis un type de signalement.'); return; }
    if (desc.trim().length < 10) { Alert.alert('Description trop courte', 'Décris le problème en au moins 10 caractères.'); return; }
    setSending(true);
    try {
      signalementsDB.create({
        user_id: user?.id ?? null,
        type: categorie,
        description: desc.trim(),
        ...(demandeId ? { demande_id: demandeId } : {}),
      });
      Animated.sequence([
        Animated.timing(checkAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start();
      setSucces(true);
      setCategorie('');
      setDesc('');
      setDemandeId(null);
      loadData();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Signalement</Text>
        {historique.length > 0 ? (
          <TouchableOpacity style={s.histBtn} onPress={() => setShowHistorique(v => !v)}>
            <View style={s.histBadge}><Text style={s.histBadgeTxt}>{historique.length}</Text></View>
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── Confirmation succès ── */}
        {succes && (
          <Animated.View style={[s.successBanner, { opacity: checkAnim, transform: [{ scale: checkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
            <View style={s.successIcon}>
              <Ionicons name="checkmark-circle" size={32} color={C.success} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.successTitle}>Signalement envoyé</Text>
              <Text style={s.successSub}>Notre équipe le traitera sous 24h. Merci de nous aider à améliorer RouteX.</Text>
            </View>
            <TouchableOpacity onPress={() => setSucces(false)}>
              <Ionicons name="close" size={18} color={C.success} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Intro ── */}
        <View style={s.intro}>
          <Text style={s.introTitle}>Signaler un problème</Text>
          <Text style={s.introSub}>Aide-nous à améliorer l'expérience de tous les utilisateurs.</Text>
        </View>

        {/* ── Catégorie ── */}
        <View style={s.card}>
          <Text style={s.fieldLabel}>Catégorie *</Text>
          <View style={s.catGrid}>
            {CATEGORIES.map(cat => {
              const active = categorie === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[s.catChip, { backgroundColor: active ? cat.bg : C.bg, borderColor: active ? cat.color : C.border }]}
                  onPress={() => setCategorie(cat.key)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={cat.icon} size={20} color={active ? cat.color : C.muted} />
                  <Text style={[s.catLabel, active && { color: cat.color, fontWeight: '700' }]}>{cat.label}</Text>
                  {active && <View style={[s.catDot, { backgroundColor: cat.color }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Demande liée (optionnel) ── */}
        <View style={s.card}>
          <Text style={s.fieldLabel}>Course concernée (optionnel)</Text>
          <TouchableOpacity
            style={s.demandeSelector}
            onPress={() => setShowDemandes(v => !v)}
            activeOpacity={0.85}
          >
            {demandeSelectionnee ? (
              <View style={{ flex: 1 }}>
                <Text style={s.demandeSel}>{demandeSelectionnee.ville_depart} → {demandeSelectionnee.ville_arrivee}</Text>
                <Text style={s.demandeSelSub}>{demandeSelectionnee.date_souhaitee} · {demandeSelectionnee.type_marchandise}</Text>
              </View>
            ) : (
              <Text style={s.demandeNone}>Aucune course sélectionnée</Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {demandeId && (
                <TouchableOpacity
                  onPress={(e) => { e.stopPropagation(); setDemandeId(null); setShowDemandes(false); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={C.muted} />
                </TouchableOpacity>
              )}
              <Ionicons name={showDemandes ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
            </View>
          </TouchableOpacity>

          {showDemandes && (
            <View style={s.demandeList}>
              {demandes.length === 0 ? (
                <Text style={s.demandeEmpty}>Aucune course dans votre historique</Text>
              ) : (
                demandes.map(d => (
                  <TouchableOpacity
                    key={d.id}
                    style={[s.demandeItem, demandeId === d.id && s.demandeItemActive]}
                    onPress={() => { setDemandeId(d.id); setShowDemandes(false); }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.demandeItemRoute}>{d.ville_depart} → {d.ville_arrivee}</Text>
                      <Text style={s.demandeItemSub}>{d.date_souhaitee} · {d.statut}</Text>
                    </View>
                    {demandeId === d.id && <Ionicons name="checkmark-circle" size={16} color={C.accent} />}
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </View>

        {/* ── Description ── */}
        <View style={s.card}>
          <View style={s.descHeader}>
            <Text style={s.fieldLabel}>Description *</Text>
            <Text style={[s.charCount, desc.length > 450 && { color: C.error }]}>
              {desc.length} / 500
            </Text>
          </View>
          <TextInput
            style={s.textarea}
            placeholder="Décris ton problème en détail : que s'est-il passé, quand, avec qui…"
            placeholderTextColor="#9CA3AF"
            value={desc}
            onChangeText={setDesc}
            multiline
            maxLength={500}
            textAlignVertical="top"
          />
          {desc.length > 0 && desc.length < 10 && (
            <Text style={s.descWarn}>Minimum 10 caractères</Text>
          )}
        </View>

        {/* ── Bouton envoyer ── */}
        <View style={s.submitSection}>
          <TouchableOpacity
            style={[s.sendBtn, (!categorie || desc.trim().length < 10 || sending) && s.sendBtnDisabled]}
            onPress={envoyer}
            disabled={!categorie || desc.trim().length < 10 || sending}
            activeOpacity={0.88}
          >
            {sending
              ? <ActivityIndicator color="#FFFFFF" />
              : <>
                  <Ionicons name="send" size={18} color="#FFFFFF" style={{ marginRight: 10 }} />
                  <Text style={s.sendBtnTxt}>Envoyer le signalement</Text>
                </>
            }
          </TouchableOpacity>
          <Text style={s.submitNote}>
            Traité par notre équipe sous 24h · 7j/7
          </Text>
        </View>

        {/* ── Historique ── */}
        {historique.length > 0 && (
          <View style={s.card}>
            <TouchableOpacity
              style={s.histHeader}
              onPress={() => setShowHistorique(v => !v)}
              activeOpacity={0.8}
            >
              <Ionicons name="time-outline" size={16} color={C.muted} />
              <Text style={s.histTitle}>Mes signalements ({historique.length})</Text>
              <Ionicons name={showHistorique ? 'chevron-up' : 'chevron-down'} size={16} color={C.muted} />
            </TouchableOpacity>

            {showHistorique && historique.map((sig, i) => {
              const cat = CATEGORIES.find(c => c.key === sig.type);
              const statColor = STATUT_COLORS[sig.statut] ?? C.muted;
              return (
                <View key={sig.id} style={[s.histItem, i === 0 && { marginTop: 8 }]}>
                  <View style={s.histItemTop}>
                    <View style={[s.histCatBadge, { backgroundColor: (cat?.bg ?? '#F9FAFB') }]}>
                      <Ionicons name={cat?.icon ?? 'help-circle-outline'} size={12} color={cat?.color ?? C.muted} />
                      <Text style={[s.histCatTxt, { color: cat?.color ?? C.muted }]}>{cat?.label ?? sig.type}</Text>
                    </View>
                    <View style={[s.histStatBadge, { backgroundColor: statColor + '18' }]}>
                      <View style={[s.histStatDot, { backgroundColor: statColor }]} />
                      <Text style={[s.histStatTxt, { color: statColor }]}>{STATUT_LABELS[sig.statut] ?? sig.statut}</Text>
                    </View>
                    <Text style={s.histDate}>{fmtDate(sig.created_at)}</Text>
                  </View>
                  <Text style={s.histDesc} numberOfLines={2}>{sig.description}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)' },
  headerTitle:  { fontSize: 17, fontWeight: '800', color: '#FFFFFF', flex: 1 },
  histBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  histBadge:    { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  histBadgeTxt: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },

  successBanner: {
    margin: 16, marginBottom: 0, backgroundColor: C.successLight, borderRadius: 14,
    borderWidth: 1.5, borderColor: '#6EE7B7', padding: 14,
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
  },
  successIcon:  { marginTop: 2 },
  successTitle: { fontSize: 14, fontWeight: '800', color: C.success, marginBottom: 3 },
  successSub:   { fontSize: 12, color: '#059669', lineHeight: 17 },

  intro:      { padding: 20, paddingBottom: 4 },
  introTitle: { fontSize: 20, fontWeight: '900', color: C.text, letterSpacing: -0.4, marginBottom: 4 },
  introSub:   { fontSize: 13, color: C.muted, lineHeight: 19 },

  card: {
    backgroundColor: C.bg, marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },

  fieldLabel:  { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 },

  catGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip:  {
    width: '31.5%', borderRadius: 12, borderWidth: 1.5, padding: 12,
    alignItems: 'center', gap: 6, position: 'relative',
  },
  catLabel: { fontSize: 12, fontWeight: '600', color: C.muted, textAlign: 'center' },
  catDot:   { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4 },

  demandeSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, paddingHorizontal: 14, paddingVertical: 13 },
  demandeSel:    { fontSize: 14, fontWeight: '700', color: C.text },
  demandeSelSub: { fontSize: 11, color: C.muted, marginTop: 2 },
  demandeNone:   { flex: 1, fontSize: 14, color: '#9CA3AF' },
  demandeList:   { backgroundColor: C.bg, borderRadius: 10, borderWidth: 1, borderColor: C.border, marginTop: 6, overflow: 'hidden', elevation: 2 },
  demandeEmpty:  { padding: 14, fontSize: 13, color: C.muted, textAlign: 'center' },
  demandeItem:   { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.bgAlt, flexDirection: 'row', alignItems: 'center', gap: 10 },
  demandeItemActive: { backgroundColor: C.accentLight },
  demandeItemRoute: { fontSize: 13, fontWeight: '700', color: C.text },
  demandeItemSub:   { fontSize: 11, color: C.muted, marginTop: 2 },

  descHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  charCount:  { fontSize: 11, color: C.muted, fontWeight: '600' },
  textarea:   { backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, minHeight: 120 },
  descWarn:   { fontSize: 11, color: C.error, marginTop: 5 },

  submitSection: { paddingHorizontal: 16, marginTop: 16, gap: 10 },
  sendBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, borderRadius: 50, paddingVertical: 16, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  sendBtnDisabled: { backgroundColor: '#D1D5DB', elevation: 0 },
  sendBtnTxt:      { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  submitNote:      { textAlign: 'center', fontSize: 12, color: C.muted },

  histHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  histTitle:   { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },
  histItem:    { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, marginTop: 12 },
  histItemTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' },
  histCatBadge:{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 50 },
  histCatTxt:  { fontSize: 10, fontWeight: '700' },
  histStatBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 50 },
  histStatDot:   { width: 5, height: 5, borderRadius: 3 },
  histStatTxt:   { fontSize: 10, fontWeight: '700' },
  histDate:    { marginLeft: 'auto', fontSize: 10, color: C.muted },
  histDesc:    { fontSize: 13, color: C.muted, lineHeight: 18 },
});
