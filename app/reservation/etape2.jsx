import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet,
  Platform, StatusBar, KeyboardAvoidingView, ScrollView, Modal, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useReservation, ProgressBar } from '../../src/context/ReservationContext';
import { VEHICULES, formatCapacite, getVehicule, vehiculeIcon, vehiculeRecommande } from '../../src/constants/vehicules';
import { calculerPrix, fmtPrix } from '../../src/utils/pricing';
import { getDistanceKmPrecise as getDistanceKm } from '../../src/utils/distance';

export const TYPES_MARCHANDISE = [
  { key: 'demenagement',   label: 'Déménagement' },
  { key: 'electromenager', label: 'Électroménager' },
  { key: 'materiaux',      label: 'Matériaux' },
  { key: 'marchandises',   label: 'Marchandises' },
  { key: 'fruits_legumes', label: 'Fruits/Légumes' },
  { key: 'autre',          label: 'Autre' },
];

const C = {
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB', accent: '#0F4D2E', accentLight: '#E8F2EC',
  gold: '#D4A017', orange: '#F97316', red: '#DC2626',
  black: '#0A0A0A', disabled: '#D1D5DB',
};

const DESC_MIN = 5;

// Image du véhicule, ou icône dans un carré gris clair si le fichier n'existe pas encore
function VehiculeVisuel({ vehicule, size = 56 }) {
  if (vehicule.image) {
    return <Image source={vehicule.image} style={{ width: size, height: size, borderRadius: 10 }} resizeMode="contain" />;
  }
  return (
    <View style={[s.vehPlaceholder, { width: size, height: size }]}>
      <Ionicons name={vehiculeIcon(vehicule)} size={Math.round(size * 0.5)} color={C.muted} />
    </View>
  );
}

export default function Etape2() {
  const router = useRouter();
  const { departure, arrival, categories, description, aideChargement, vehicule, update } = useReservation();

  const [selected,    setSelected]    = useState(categories || []);
  const [localDesc,   setLocalDesc]   = useState(description || '');
  const [descTouched, setDescTouched] = useState(false);
  const [aide,        setAide]        = useState(aideChargement || 0);
  const [vehiculeId,  setVehiculeId]  = useState(vehicule || null);
  const [sheetOpen,   setSheetOpen]   = useState(false);

  const recoId    = vehiculeRecommande(selected);
  const vehChoisi = getVehicule(vehiculeId);
  const routeKm   = useMemo(() => getDistanceKm(departure, arrival), [departure, arrival]);
  const descOk    = localDesc.trim().length >= DESC_MIN;

  // Prix estimé avec le véhicule choisi (même calcul que les chauffeurs simulés de l'étape 3)
  const prixPour = (v) => (routeKm ? calculerPrix(routeKm, v.tarif).min + aide * 500 : null);
  const prixChoisi = vehChoisi ? prixPour(vehChoisi) : null;

  const manquants = [
    selected.length === 0 && 'type de marchandise',
    !vehChoisi && 'véhicule',
    !descOk && 'description',
  ].filter(Boolean);
  const peutContinuer = manquants.length === 0;

  const toggleCategorie = (key) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const choisirVehicule = (id) => {
    setVehiculeId(id);
    update({ vehicule: id });
    setSheetOpen(false);
  };

  const handleNext = () => {
    if (!peutContinuer) { setDescTouched(true); return; }
    update({
      categories:     selected,
      description:    localDesc.trim(),
      aideChargement: aide,
      vehicule:       vehiculeId,
    });
    router.push('/reservation/etape3');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/(tabs)')} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={24} color={C.text} />
        </TouchableOpacity>
      </View>
      <ProgressBar step={2} total={3} />

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={s.trajetRow}>
          <Ionicons name="navigate-outline" size={13} color={C.muted} style={{ marginRight: 6 }} />
          <Text style={s.trajetTxt} numberOfLines={1}>{`${departure || ''} → ${arrival || ''}`}</Text>
        </View>

        <Text style={s.title}>Que voulez-vous expédier ?</Text>

        <View style={s.chipRow}>
          {TYPES_MARCHANDISE.map(t => {
            const active = selected.includes(t.key);
            return (
              <TouchableOpacity
                key={t.key}
                style={[s.chip, active && s.chipActive]}
                onPress={() => toggleCategorie(t.key)}
                activeOpacity={0.8}
              >
                <Text style={[s.chipTxt, active && s.chipTxtActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={s.fieldLabel}>Décrivez votre cargaison</Text>
        <TextInput
          style={[s.input, descTouched && !descOk && s.inputError]}
          placeholder="Dimensions, quantité, fragilité…"
          placeholderTextColor="#9CA3AF"
          value={localDesc}
          onChangeText={setLocalDesc}
          onBlur={() => setDescTouched(true)}
          multiline
        />
        {descTouched && !descOk && (
          <Text style={s.fieldError}>Décrivez votre cargaison</Text>
        )}

        <View style={s.aideRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.aideTitle}>Aide au chargement</Text>
            <Text style={s.aideSub}>Nombre de personnes (0 à 5)</Text>
          </View>
          <View style={s.counter}>
            <TouchableOpacity style={s.counterBtn} onPress={() => setAide(a => Math.max(0, a - 1))}>
              <Text style={s.counterBtnTxt}>−</Text>
            </TouchableOpacity>
            <Text style={s.counterVal}>{String(aide)}</Text>
            <TouchableOpacity style={s.counterBtn} onPress={() => setAide(a => Math.min(5, a + 1))}>
              <Text style={s.counterBtnTxt}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Choix du véhicule */}
        <Text style={s.fieldLabel}>Véhicule</Text>
        <TouchableOpacity style={[s.vehBtn, vehChoisi && s.vehBtnChoisi]} onPress={() => setSheetOpen(true)} activeOpacity={0.85}>
          {vehChoisi ? (
            <>
              <VehiculeVisuel vehicule={vehChoisi} size={40} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.vehBtnTxt} numberOfLines={1}>{vehChoisi.nom}</Text>
                <Text style={s.vehBtnSub} numberOfLines={1}>
                  {`${formatCapacite(vehChoisi.capaciteKg)} · ${vehChoisi.caisse}${prixChoisi != null ? ` · ~${fmtPrix(prixChoisi)}` : ''}`}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Ionicons name="bus-outline" size={22} color={C.text} />
              <Text style={[s.vehBtnTxt, { flex: 1, marginLeft: 12 }]}>Choisir votre camion</Text>
            </>
          )}
          <Ionicons name="chevron-forward" size={20} color={C.muted} />
        </TouchableOpacity>
      </ScrollView>

      <View style={s.footer}>
        {!peutContinuer && (
          <Text style={s.manquantsTxt}>{`Encore nécessaire : ${manquants.join(', ')}`}</Text>
        )}
        <TouchableOpacity
          style={[s.nextBtn, !peutContinuer && s.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!peutContinuer}
          activeOpacity={0.88}
        >
          <Text style={s.nextBtnTxt}>Suivant</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom sheet — choix du camion */}
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <View style={s.sheetOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setSheetOpen(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHandle} />
            <View style={s.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.sheetTitle}>Choisir votre camion</Text>
                <Text style={s.sheetSub}>Classés par capacité</Text>
              </View>
              <TouchableOpacity onPress={() => setSheetOpen(false)} style={s.sheetCloseBtn} activeOpacity={0.8}>
                <Text style={s.sheetCloseTxt}>Fermer</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 20 }} showsVerticalScrollIndicator={false}>
              {VEHICULES.map(v => {
                const actif = v.id === vehiculeId;
                const reco  = v.id === recoId;
                const prix  = prixPour(v);
                return (
                  <TouchableOpacity
                    key={v.id}
                    style={[s.vehCard, actif && s.vehCardActive]}
                    onPress={() => choisirVehicule(v.id)}
                    activeOpacity={0.85}
                  >
                    <VehiculeVisuel vehicule={v} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      {reco && (
                        <View style={s.recoBadge}>
                          <Ionicons name="star" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                          <Text style={s.recoTxt}>Recommandé</Text>
                        </View>
                      )}
                      <Text style={s.vehNom}>{v.nom}</Text>
                      <Text style={s.vehInfo}>{`${formatCapacite(v.capaciteKg)} · ${v.caisse}`}</Text>
                      {prix != null && <Text style={s.vehPrix}>{`~${fmtPrix(prix)}`}</Text>}
                    </View>
                    {actif && <Ionicons name="checkmark-circle" size={22} color={C.accent} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: -8 },

  content: { padding: 20, paddingBottom: 40 },

  trajetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  trajetTxt: { fontSize: 13, fontWeight: '600', color: C.muted, flexShrink: 1 },

  title: { fontSize: 24, fontWeight: '800', color: C.text, marginBottom: 20 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  chip:    { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 50, backgroundColor: C.bgAlt },
  chipActive: { backgroundColor: C.black },
  chipTxt:    { fontSize: 14, fontWeight: '600', color: C.text },
  chipTxtActive: { color: '#FFFFFF' },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 24, marginBottom: 8 },
  input: { backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: C.text, minHeight: 80, textAlignVertical: 'top' },
  inputError: { borderColor: C.red },
  fieldError: { fontSize: 12, fontWeight: '600', color: C.red, marginTop: 6 },

  aideRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderRadius: 14, padding: 16, marginTop: 24, gap: 12 },
  aideTitle: { fontSize: 14, fontWeight: '700', color: C.text },
  aideSub:   { fontSize: 12, color: C.muted, marginTop: 2 },
  counter:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  counterBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  counterBtnTxt: { fontSize: 20, fontWeight: '900', color: C.text, lineHeight: 24 },
  counterVal: { fontSize: 18, fontWeight: '900', color: C.text, minWidth: 24, textAlign: 'center' },

  vehBtn:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 16 },
  vehBtnChoisi:   { backgroundColor: C.accentLight, borderColor: C.accent, paddingVertical: 12 },
  vehBtnTxt:      { fontSize: 15, fontWeight: '700', color: C.text },
  vehBtnSub:      { fontSize: 12, color: C.muted, marginTop: 2 },
  vehPlaceholder: { backgroundColor: C.bgAlt, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  footer:    { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  manquantsTxt: { fontSize: 12, fontWeight: '700', color: C.orange, marginBottom: 10, textAlign: 'center' },
  nextBtn:   { alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, borderRadius: 50, paddingVertical: 17 },
  nextBtnDisabled: { backgroundColor: C.disabled },
  nextBtnTxt:{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' },

  sheetOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet:         { maxHeight: '85%', backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10 },
  sheetHandle:   { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D1D5DB', marginBottom: 12 },
  sheetHeader:   { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sheetTitle:    { fontSize: 20, fontWeight: '800', color: C.text },
  sheetSub:      { fontSize: 13, color: C.muted, marginTop: 2 },
  sheetCloseBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 50, backgroundColor: C.bgAlt },
  sheetCloseTxt: { fontSize: 13, fontWeight: '700', color: C.text },

  vehCard:       { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.border, borderRadius: 14, padding: 12, marginBottom: 10 },
  vehCardActive: { borderColor: C.accent, backgroundColor: C.accentLight },
  vehNom:        { fontSize: 15, fontWeight: '700', color: C.text },
  vehInfo:       { fontSize: 12, color: C.muted, marginTop: 2 },
  vehPrix:       { fontSize: 13, fontWeight: '800', color: C.accent, marginTop: 4 },
  recoBadge:     { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: C.gold, borderRadius: 50, paddingHorizontal: 8, paddingVertical: 2, marginBottom: 4 },
  recoTxt:       { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
});
