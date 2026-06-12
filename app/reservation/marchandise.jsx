import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useReservation, ProgressBar } from '../../src/context/ReservationContext';

const TYPES_MARCHANDISE = [
  { key: 'meubles',        label: 'Meubles',         icon: 'grid-outline' },
  { key: 'electromenager', label: 'Électroménager',  icon: 'tv-outline' },
  { key: 'cartons',        label: 'Cartons',          icon: 'cube-outline' },
  { key: 'alimentation',   label: 'Alimentation',    icon: 'basket-outline' },
  { key: 'materiaux',      label: 'Matériaux BTP',    icon: 'construct-outline' },
  { key: 'vehicule',       label: 'Véhicule',         icon: 'car-outline' },
  { key: 'autre',          label: 'Autre',            icon: 'ellipsis-horizontal-circle-outline' },
];

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
};

export default function Marchandise() {
  const router = useRouter();
  const { category, setField } = useReservation();
  const [selected, setSelected] = useState(category || '');

  const handleNext = () => {
    if (!selected) return;
    setField('category', selected);
    setField('sousCategorie', '');
    router.push('/reservation/quantite');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nouvelle demande</Text>
        <View style={{ width: 36 }} />
      </View>
      <ProgressBar step={2} total={6} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.stepLabel}>Étape 2 / 6</Text>
        <Text style={s.title}>Que transportes-tu ?</Text>
        <Text style={s.sub}>Choisis le type de marchandise.</Text>

        <View style={s.grid}>
          {TYPES_MARCHANDISE.map(t => {
            const active = selected === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[s.card, active && s.cardActive]}
                onPress={() => setSelected(t.key)}
                activeOpacity={0.8}
              >
                <View style={[s.iconBox, active && s.iconBoxActive]}>
                  <Ionicons name={t.icon} size={30} color={active ? C.accent : '#9CA3AF'} />
                </View>
                <Text style={[s.cardTxt, active && { color: C.accent, fontWeight: '700' }]}>
                  {t.label}
                </Text>
                {active && (
                  <View style={s.checkBadge}>
                    <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.nextBtn, !selected && s.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!selected}
          activeOpacity={0.88}
        >
          <Text style={s.nextBtnTxt}>Suivant</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
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

  content:   { padding: 20, paddingBottom: 32 },
  stepLabel: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  title:     { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 8, letterSpacing: -0.5 },
  sub:       { fontSize: 14, color: C.muted, marginBottom: 28, lineHeight: 20 },

  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card:         { width: '47%', backgroundColor: C.bgAlt, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: 'transparent', position: 'relative' },
  cardActive:   { borderColor: C.accent, backgroundColor: C.accentLight },
  iconBox:      { width: 56, height: 56, borderRadius: 14, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  iconBoxActive:{ backgroundColor: '#FEE2CA' },
  cardTxt:      { fontSize: 13, fontWeight: '600', color: C.muted, textAlign: 'center' },
  checkBadge:   { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },

  footer:          { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  nextBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.primary, borderRadius: 50, paddingVertical: 17 },
  nextBtnDisabled: { backgroundColor: '#9CA3AF' },
  nextBtnTxt:      { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
