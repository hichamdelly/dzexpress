import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput, StyleSheet,
  Platform, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useReservation, ProgressBar } from '../../src/context/ReservationContext';

const SOUS_CATEGORIES = {
  meubles: [
    { key: 'lit',     label: 'Lit',             veh: 'fourgon' },
    { key: 'canape',  label: 'Canapé',           veh: 'fourgon' },
    { key: 'armoire', label: 'Armoire',          veh: 'camion35' },
    { key: 'table',   label: 'Table & Chaises',  veh: 'fourgon' },
    { key: 'salon',   label: 'Salon complet',    veh: 'camion35' },
    { key: 'appart',  label: "Tout l'appart",    veh: 'camion35', warn: 'Un déménagement complet nécessite généralement un camion 3.5T. Prévoir 2–3h de chargement minimum.' },
  ],
  electromenager: [
    { key: 'frigo',    label: 'Réfrigérateur',            veh: 'fourgon' },
    { key: 'machine',  label: 'Machine à laver',          veh: 'fourgon' },
    { key: 'clim',     label: 'Climatiseur',              veh: 'fourgon' },
    { key: 'tv',       label: 'TV / Écran',               veh: 'fourgon' },
    { key: 'plusieurs',label: 'Plusieurs gros appareils', veh: 'camion35' },
  ],
  cartons: [
    { key: 'petit', label: '< 10 cartons',   veh: 'fourgon' },
    { key: 'moyen', label: '10 – 30 cartons',veh: 'fourgon' },
    { key: 'grand', label: '> 30 cartons',   veh: 'camion35' },
  ],
  alimentation: [
    { key: 'fruits_legumes', label: 'Fruits & Légumes',       veh: 'utilitaire' },
    { key: 'epicerie',       label: 'Produits alimentaires',  veh: 'utilitaire' },
    { key: 'vrac_alim',      label: 'Grande quantité',        veh: 'fourgon' },
    { key: 'surgeles',       label: 'Surgelés / Réfrigérés',  veh: 'fourgon', warn: 'Les produits surgelés nécessitent un véhicule frigorifique. Mentionne cette exigence dans la description.' },
  ],
  materiaux: [
    { key: 'sable',    label: 'Sable / Gravier',     veh: 'camion10', warn: 'Le sable et gravier en vrac nécessitent un camion benne 10T minimum. Précise la quantité en tonnes.' },
    { key: 'briques',  label: 'Briques / Parpaings',  veh: 'camion10' },
    { key: 'fer',      label: 'Fer à béton',           veh: 'camion35', warn: 'Le fer à béton est long et lourd — précise absolument les dimensions dans la description.' },
    { key: 'carrelage',label: 'Carrelage',              veh: 'fourgon' },
    { key: 'autre_btp',label: 'Autre BTP',              veh: 'camion35' },
  ],
  vehicule: [
    { key: 'voiture', label: 'Voiture',      veh: 'semi',   warn: 'Le transport de voitures nécessite un plateau ou semi-remorque. Vérifie que le transporteur dispose du matériel adéquat.' },
    { key: 'moto',    label: 'Moto / Scooter',veh: 'fourgon' },
    { key: 'camion_l',label: 'Camion léger',  veh: 'semi',   warn: 'Pour les véhicules lourds, assure-toi que le transporteur possède un plateau homologué.' },
  ],
  autre: [],
};

const VEH_LABELS = {
  herbine: 'Herbine', utilitaire: 'Utilitaire léger', fourgon: 'Fourgon',
  camion35: 'Camion 3.5T', camion10: 'Camion 10T', semi: 'Semi-remorque',
};

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
};

export default function Quantite() {
  const router = useRouter();
  const { category, sousCategorie, quantite, description, setField } = useReservation();

  const [localSC,    setLocalSC]    = useState(sousCategorie || '');
  const [localPoids, setLocalPoids] = useState(quantite      || '');
  const [localDesc,  setLocalDesc]  = useState(description   || '');

  const scList = SOUS_CATEGORIES[category] || [];
  const scInfo = scList.find(s => s.key === localSC);
  const vehRec = scInfo ? (Array.isArray(scInfo.veh) ? scInfo.veh[0] : scInfo.veh) : null;
  const warn   = scInfo?.warn;

  const handleNext = () => {
    setField('sousCategorie', localSC);
    setField('quantite',      localPoids.trim());
    setField('description',   localDesc.trim());
    if (vehRec) setField('vehicule', vehRec);
    router.push('/reservation/vehicule');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nouvelle demande</Text>
        <View style={{ width: 36 }} />
      </View>
      <ProgressBar step={3} total={6} />

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.stepLabel}>Étape 3 / 6</Text>
        <Text style={s.title}>Détails</Text>
        <Text style={s.sub}>Précise ce que tu transportes.</Text>

        {scList.length > 0 && (
          <>
            <Text style={s.fieldLabel}>Type exact</Text>
            <View style={s.chipRow}>
              {scList.map(item => {
                const active = localSC === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setLocalSC(active ? '' : item.key)}
                    activeOpacity={0.8}
                  >
                    {active && <Ionicons name="checkmark-circle" size={13} color={C.accent} style={{ marginRight: 4 }} />}
                    <Text style={[s.chipTxt, active && s.chipTxtActive]}>{item.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {vehRec && (
          <View style={s.vehRec}>
            <Ionicons name="checkmark-circle" size={16} color={C.success} style={{ marginRight: 8 }} />
            <Text style={s.vehRecTxt}>
              Véhicule recommandé :{' '}
              <Text style={{ fontWeight: '800', color: C.text }}>{VEH_LABELS[vehRec]}</Text>
            </Text>
          </View>
        )}

        {warn && (
          <View style={s.warnBox}>
            <Ionicons name="warning-outline" size={18} color="#92400E" style={{ marginRight: 10, flexShrink: 0, marginTop: 1 }} />
            <Text style={s.warnTxt}>{warn}</Text>
          </View>
        )}

        <Text style={s.fieldLabel}>Poids estimé</Text>
        <TextInput
          style={s.input}
          placeholder="Ex : 500 kg, 2 tonnes…"
          placeholderTextColor="#9CA3AF"
          value={localPoids}
          onChangeText={setLocalPoids}
        />

        <Text style={s.fieldLabel}>Description (optionnel)</Text>
        <TextInput
          style={[s.input, { minHeight: 80, textAlignVertical: 'top' }]}
          placeholder="Dimensions, fragilité, accès difficile…"
          placeholderTextColor="#9CA3AF"
          value={localDesc}
          onChangeText={setLocalDesc}
          multiline
        />
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.88}>
          <Text style={s.nextBtnTxt}>Suivant</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', flex: 1, textAlign: 'center' },

  content:   { padding: 20, paddingBottom: 40 },
  stepLabel: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  title:     { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 8, letterSpacing: -0.5 },
  sub:       { fontSize: 14, color: C.muted, marginBottom: 24, lineHeight: 20 },

  fieldLabel:   { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input:        { backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 14, color: C.text, marginBottom: 20 },

  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 50, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt },
  chipActive:   { borderColor: C.accent, backgroundColor: C.accentLight },
  chipTxt:      { fontSize: 13, fontWeight: '600', color: C.muted },
  chipTxtActive:{ color: C.accent, fontWeight: '700' },

  vehRec:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#6EE7B7' },
  vehRecTxt: { fontSize: 13, color: C.success, flex: 1 },

  warnBox:  { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginBottom: 16, borderWidth: 1.5, borderColor: '#FCD34D' },
  warnTxt:  { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19, fontWeight: '600' },

  footer:   { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  nextBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.primary, borderRadius: 50, paddingVertical: 17 },
  nextBtnTxt:{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
