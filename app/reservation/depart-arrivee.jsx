import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, StatusBar, KeyboardAvoidingView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useReservation, ProgressBar } from '../../src/context/ReservationContext';
import CityInput from '../../src/components/CityInput';

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
};

export default function DepartArrivee() {
  const router = useRouter();
  const { departure, arrival, setField } = useReservation();

  const [localDepart,  setLocalDepart]  = useState(departure || '');
  const [localArrivee, setLocalArrivee] = useState(arrival   || '');

  const handleNext = () => {
    if (!localDepart)  return Alert.alert('Requis', 'Choisis la ville de départ.');
    if (!localArrivee) return Alert.alert('Requis', "Choisis la ville d'arrivée.");
    setField('departure', localDepart);
    setField('arrival',   localArrivee);
    router.push('/reservation/marchandise');
  };

  const canNext = !!localDepart && !!localArrivee;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nouvelle demande</Text>
        <View style={{ width: 36 }} />
      </View>
      <ProgressBar step={1} total={6} />

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.stepLabel}>Étape 1 / 6</Text>
        <Text style={s.title}>D'où à où ?</Text>
        <Text style={s.sub}>Indique les villes de départ et d'arrivée.</Text>

        <View style={s.routeBlock}>
          <Text style={s.fieldLabel}>Ville de départ</Text>
          <CityInput
            value={localDepart}
            onChange={setLocalDepart}
            accentColor={C.accent}
            placeholder="Commune ou wilaya de départ…"
          />

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <View style={s.dividerIcon}>
              <Ionicons name="arrow-down" size={14} color={C.muted} />
            </View>
            <View style={s.dividerLine} />
          </View>

          <Text style={s.fieldLabel}>Ville d'arrivée</Text>
          <CityInput
            value={localArrivee}
            onChange={setLocalArrivee}
            accentColor={C.accent}
            placeholder="Commune ou wilaya d'arrivée…"
          />
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.nextBtn, !canNext && s.nextBtnDisabled]}
          onPress={handleNext}
          activeOpacity={0.88}
        >
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

  content:    { padding: 20, paddingBottom: 40 },
  stepLabel:  { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  title:      { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 8, letterSpacing: -0.5 },
  sub:        { fontSize: 14, color: C.muted, marginBottom: 28, lineHeight: 20 },

  routeBlock:  { },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },

  divider:     { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },

  footer:          { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  nextBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.primary, borderRadius: 50, paddingVertical: 17 },
  nextBtnDisabled: { backgroundColor: '#9CA3AF' },
  nextBtnTxt:      { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
