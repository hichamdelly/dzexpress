import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useReservation, ProgressBar } from '../../src/context/ReservationContext';

const VEHICULES = [
  { id: 'utilitaire', nom: 'Utilitaire léger', detail: "Kangoo, Doblo — jusqu'à 500 kg", icon: 'car-outline' },
  { id: 'herbine',    nom: 'Herbine (DFSK)',   detail: "Idéal fruits, légumes — jusqu'à 1T", icon: 'cart-outline' },
  { id: 'fourgon',    nom: 'Fourgon',          detail: "Déménagement léger — jusqu'à 2T",   icon: 'car-sport-outline' },
  { id: 'camion35',   nom: 'Camion 3.5T',      detail: "Salon, électroménager — jusqu'à 3.5T", icon: 'bus-outline' },
  { id: 'camion10',   nom: 'Camion 10T',       detail: "Déménagement complet — jusqu'à 10T",  icon: 'cube-outline' },
  { id: 'semi',       nom: 'Semi-remorque',    detail: 'Très gros volumes — +10T',             icon: 'construct-outline' },
];

export default function VehiculeScreen() {
  const router = useRouter();
  const { vehicule, setField } = useReservation();
  const [selected, setSelected] = useState(vehicule || null);

  const handleSelect = (id) => {
    setSelected(id);
    setField('vehicule', id);
  };

  const handleNext = () => {
    if (!selected) return;
    router.push('/reservation/options');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nouvelle demande</Text>
        <View style={{ width: 36 }} />
      </View>

      <ProgressBar step={4} total={6} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.stepLabel}>Étape 4 / 6</Text>
        <Text style={s.title}>Quel véhicule ?</Text>
        <Text style={s.sub}>Choisis le véhicule adapté à ta marchandise.</Text>

        {VEHICULES.map((v) => {
          const active = selected === v.id;
          return (
            <TouchableOpacity
              key={v.id}
              onPress={() => handleSelect(v.id)}
              activeOpacity={0.85}
              style={[s.card, active && s.cardActive]}
            >
              <View style={[s.iconBox, active && s.iconBoxActive]}>
                <Ionicons name={v.icon} size={26} color={active ? '#F97316' : '#9CA3AF'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.cardNom, active && { color: '#F97316' }]}>{v.nom}</Text>
                <Text style={s.cardDetail}>{v.detail}</Text>
              </View>
              {active && (
                <View style={s.checkBox}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
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
    backgroundColor: '#0A0A0A',
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', flex: 1, textAlign: 'center' },

  content:   { padding: 20, paddingBottom: 32, gap: 10 },
  stepLabel: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.8 },
  title:     { fontSize: 26, fontWeight: '900', color: '#0A0A0A', marginBottom: 6, letterSpacing: -0.5 },
  sub:       { fontSize: 14, color: '#6B7280', marginBottom: 8, lineHeight: 20 },

  card:         { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 14, padding: 16, borderWidth: 2, borderColor: 'transparent', gap: 14 },
  cardActive:   { borderColor: '#F97316', backgroundColor: '#FFF3E8' },
  iconBox:      { width: 50, height: 50, borderRadius: 12, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  iconBoxActive:{ backgroundColor: '#FEE2CA' },
  cardNom:      { fontSize: 15, fontWeight: '800', color: '#0A0A0A', marginBottom: 3 },
  cardDetail:   { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  checkBox:     { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F97316', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  footer:          { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  nextBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#0A0A0A', borderRadius: 50, paddingVertical: 17 },
  nextBtnDisabled: { backgroundColor: '#9CA3AF' },
  nextBtnTxt:      { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
