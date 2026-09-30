import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Platform, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { demandesDB, usersDB, notifDB, gainsDB } from '../../src/db/database';
import { NT } from '../../src/lib/notifications';
import { fmtPrix, calculerPrix, TARIFS_BASE } from '../../src/utils/pricing';
import { getDistanceKmPrecise as getDistanceKm } from '../../src/utils/distance';

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  warning: '#F59E0B', warningLight: '#FFFBEB',
};

const MODES = [
  { key: 'cash',      label: 'Cash à la livraison', icon: 'cash-outline' },
  { key: 'baridimob', label: 'BaridiMob',            icon: 'card-outline' },
];

function LigneP({ label, value }) {
  return (
    <View style={s.ligne}>
      <Text style={s.libelleP}>{label}</Text>
      <Text style={s.valeurP}>{value}</Text>
    </View>
  );
}

/**
 * Écran de paiement — s'affiche après confirmation de livraison côté
 * expéditeur. Deux modes : cash (confirmé par le transporteur dans
 * app/course/[id].jsx, voir "Confirmer réception paiement cash") ou
 * BaridiMob (manuel — pas d'intégration bancaire réelle : l'expéditeur
 * effectue le virement en dehors de l'app vers le CCP du transporteur,
 * puis déclare lui-même le paiement effectué avec une référence).
 */
export default function PaiementScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();

  const [demande, setDemande]     = useState(null);
  const [transporteur, setTransp] = useState(null);
  const [gain, setGain]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [mode, setMode]           = useState('cash');
  const [reference, setReference] = useState('');
  const [saving, setSaving]       = useState(false);

  const load = useCallback(() => {
    try {
      const d = demandesDB.getById(parseInt(id));
      setDemande(d);
      if (d) {
        setMode(d.mode_paiement || 'cash');
        if (d.transporteur_id) setTransp(usersDB.getById(d.transporteur_id));
        setGain(gainsDB.getByDemande(parseInt(id)));
      }
    } catch (_) {}
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const choisirMode = (m) => {
    if (demande?.statut_paiement === 'confirme') return;
    setMode(m);
    try { demandesDB.setModePaiement(parseInt(id), m); } catch (_) {}
  };

  const confirmerBaridiMob = () => {
    if (!reference.trim()) {
      return Alert.alert('Référence requise', 'Indique la référence ou le numéro du virement BaridiMob.');
    }
    setSaving(true);
    try {
      demandesDB.confirmerPaiement(parseInt(id), { mode: 'baridimob', reference: reference.trim() });
      if (demande.transporteur_id) {
        notifDB.create(
          demande.transporteur_id,
          `💳 L'expéditeur a confirmé le paiement BaridiMob (réf. ${reference.trim()}).`,
          NT.PAIEMENT_CONFIRME,
          { route: `/course/${id}` }
        );
      }
      load();
      Alert.alert('Paiement confirmé', 'Le transporteur a été notifié.');
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>;

  if (!demande) return (
    <View style={s.center}>
      <Text style={s.emptyTxt}>Course introuvable</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
        <Text style={{ color: C.accent, fontWeight: '700' }}>Retour</Text>
      </TouchableOpacity>
    </View>
  );

  if (demande.statut !== 'livree') return (
    <View style={s.center}>
      <Ionicons name="time-outline" size={32} color={C.muted} style={{ marginBottom: 10 }} />
      <Text style={s.emptyTxt}>Le paiement s&rsquo;affiche une fois la course livrée.</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
        <Text style={{ color: C.accent, fontWeight: '700' }}>Retour</Text>
      </TouchableOpacity>
    </View>
  );

  const vehicule    = demande.vehicule_recommande || 'fourgon';
  const km          = getDistanceKm(demande.ville_depart, demande.ville_arrivee) || 0;
  const opts        = (() => { try { return JSON.parse(demande.options_supplementaires || '{}'); } catch { return {}; } })();
  const px          = calculerPrix(km, vehicule, { ...opts, nbActives: 0 });
  const tarifKm     = TARIFS_BASE[vehicule]?.perKm || 0;
  const optionsPrix = (px.detail.fraisEtages || 0) + (px.detail.fraisAide || 0);
  const total       = demande.prix_final || demande.prix_estime || px.min;
  const confirme    = demande.statut_paiement === 'confirme';

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Paiement</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>

        {/* Récapitulatif */}
        <View style={s.card}>
          <Text style={s.titre}>💳 Paiement de la course</Text>

          <View style={s.lignesPrix}>
            <LigneP label="Distance"  value={`${km} km`} />
            <LigneP label="Tarif"     value={`${tarifKm} DA/km`} />
            <LigneP label="Options"   value={`${optionsPrix} DA`} />
            <View style={s.separateur} />
            <View style={s.ligne}>
              <Text style={s.totalLibelle}>Total à payer</Text>
              <Text style={s.totalValeur}>{fmtPrix(total)}</Text>
            </View>
          </View>

          {gain && (
            <View style={s.splitRow}>
              <Text style={s.splitTxt}>Part transporteur : {fmtPrix(gain.montant)}</Text>
              <Text style={s.splitTxt}>Commission DzExpress : {fmtPrix(gain.commission)}</Text>
            </View>
          )}
        </View>

        {/* Statut */}
        {confirme && (
          <View style={s.confirmedBox}>
            <Ionicons name="checkmark-circle" size={20} color={C.success} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={s.confirmedTxt}>
                Paiement confirmé{demande.mode_paiement === 'baridimob' ? ' — BaridiMob' : ' — Cash'}
              </Text>
              {demande.reference_paiement && (
                <Text style={s.confirmedSub}>Réf. {demande.reference_paiement}</Text>
              )}
            </View>
          </View>
        )}

        {/* Mode de paiement */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Mode de paiement</Text>
          <View style={{ gap: 10 }}>
            {MODES.map(m => {
              const active = mode === m.key;
              return (
                <TouchableOpacity
                  key={m.key}
                  style={[s.modeChip, active && s.modeChipActive]}
                  onPress={() => choisirMode(m.key)}
                  disabled={confirme}
                  activeOpacity={0.85}
                >
                  <Ionicons name={m.icon} size={20} color={active ? C.accent : C.muted} style={{ marginRight: 12 }} />
                  <Text style={[s.modeChipTxt, active && { color: C.accent }]}>{m.label}</Text>
                  {active && <Ionicons name="checkmark-circle" size={18} color={C.accent} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Cash */}
        {mode === 'cash' && !confirme && (
          <View style={s.infoBox}>
            <Ionicons name="information-circle" size={18} color="#1A56DB" style={{ marginRight: 10 }} />
            <Text style={s.infoTxt}>
              Prépare {fmtPrix(total)} en espèces à remettre au transporteur.
              Il confirmera la réception depuis son écran de course.
            </Text>
          </View>
        )}

        {/* BaridiMob */}
        {mode === 'baridimob' && !confirme && (
          <View style={s.card}>
            <Text style={s.sectionTitle}>Coordonnées BaridiMob du transporteur</Text>
            {transporteur?.ccp_numero ? (
              <View style={s.ccpBox}>
                <View style={s.ccpRow}>
                  <Text style={s.ccpLabel}>Numéro CCP</Text>
                  <Text style={s.ccpValue}>{transporteur.ccp_numero}</Text>
                </View>
                {transporteur.ccp_cle && (
                  <View style={s.ccpRow}>
                    <Text style={s.ccpLabel}>Clé</Text>
                    <Text style={s.ccpValue}>{transporteur.ccp_cle}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={s.warningBox}>
                <Ionicons name="warning" size={16} color={C.warning} style={{ marginRight: 8 }} />
                <Text style={s.warningTxt}>
                  Le transporteur n&rsquo;a pas encore renseigné ses coordonnées BaridiMob. Contacte-le avant de payer.
                </Text>
              </View>
            )}

            <Text style={[s.fieldLabel, { marginTop: 14 }]}>Référence du virement</Text>
            <TextInput
              style={s.input}
              placeholder="Ex : numéro de transaction, capture d'écran envoyée…"
              placeholderTextColor="#9CA3AF"
              value={reference}
              onChangeText={setReference}
            />

            <TouchableOpacity
              style={[s.confirmBtn, saving && { opacity: 0.7 }]}
              onPress={confirmerBaridiMob}
              disabled={saving}
              activeOpacity={0.88}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={s.confirmBtnTxt}>J&rsquo;ai effectué le virement</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bgAlt },
  emptyTxt: { fontSize: 14, color: C.muted, textAlign: 'center' },

  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },

  card: { backgroundColor: C.bg, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, padding: 16 },
  titre: { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 14 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

  lignesPrix: {},
  ligne:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7 },
  libelleP:   { fontSize: 13, color: C.muted },
  valeurP:    { fontSize: 13, fontWeight: '700', color: C.text },
  separateur: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  totalLibelle: { fontSize: 15, fontWeight: '800', color: C.text },
  totalValeur:  { fontSize: 20, fontWeight: '900', color: C.accent },

  splitRow: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border, gap: 4 },
  splitTxt: { fontSize: 11, color: C.muted },

  confirmedBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 12, borderWidth: 1.5, borderColor: '#6EE7B7', padding: 14 },
  confirmedTxt: { fontSize: 14, fontWeight: '800', color: C.success },
  confirmedSub: { fontSize: 12, color: C.success, marginTop: 2 },

  modeChip:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt, padding: 14 },
  modeChipActive:{ borderColor: C.accent, backgroundColor: C.accentLight },
  modeChipTxt:   { flex: 1, fontSize: 14, fontWeight: '700', color: C.text },

  infoBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#EBF5FF', borderRadius: 12, borderWidth: 1.5, borderColor: '#BFDBFE', padding: 14 },
  infoTxt: { flex: 1, fontSize: 12.5, color: '#1E40AF', fontWeight: '600', lineHeight: 18 },

  warningBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.warningLight, borderRadius: 10, borderWidth: 1.5, borderColor: '#FDE68A', padding: 12 },
  warningTxt: { flex: 1, fontSize: 12, color: '#92400E', fontWeight: '600', lineHeight: 17 },

  ccpBox: { backgroundColor: C.bgAlt, borderRadius: 10, padding: 12, gap: 8 },
  ccpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ccpLabel: { fontSize: 12, color: C.muted, fontWeight: '600' },
  ccpValue: { fontSize: 14, color: C.text, fontWeight: '800', letterSpacing: 0.5 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text },

  confirmBtn:    { marginTop: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 15 },
  confirmBtnTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
