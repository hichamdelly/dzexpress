import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useReservation, ProgressBar } from '../../src/context/ReservationContext';
import { TARIFS_BASE } from '../../src/utils/pricing';

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
};

const VEHICLE_LIST = Object.entries(TARIFS_BASE).map(([key, val]) => ({ key, ...val }));

const VEH_DESCRIPTIONS = {
  herbine:    'Petits colis, courses rapides',
  utilitaire: 'Livraisons légères, commissions',
  fourgon:    'Meubles, électroménager, cartons',
  camion35:   'Déménagements, gros volumes',
  camion10:   'Matériaux BTP, charges lourdes',
  semi:       'Transport de véhicules, très grands volumes',
};

export default function Vehicule() {
  const router = useRouter();
  const { vehicule, setField } = useReservation();
  const [selected, setSelected] = useState(vehicule || '');

  const handleNext = () => {
    if (!selected) return;
    setField('vehicule', selected);
    router.push('/reservation/options');
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
      <ProgressBar step={4} total={6} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.stepLabel}>Étape 4 / 6</Text>
        <Text style={s.title}>Quel véhicule ?</Text>
        <Text style={s.sub}>Choisis le véhicule adapté à ta marchandise.</Text>

        <View style={s.list}>
          {VEHICLE_LIST.map(veh => {
            const active = selected === veh.key;
            return (
              <TouchableOpacity
                key={veh.key}
                style={[s.card, active && s.cardActive]}
                onPress={() => setSelected(veh.key)}
                activeOpacity={0.85}
              >
                <View style={[s.iconBox, active && s.iconBoxActive]}>
                  <Ionicons name={veh.icon} size={28} color={active ? C.accent : '#9CA3AF'} />
                </View>
                <View style={s.cardBody}>
                  <Text style={[s.cardName, active && { color: C.accent }]}>{veh.label}</Text>
                  <Text style={s.cardDesc}>{VEH_DESCRIPTIONS[veh.key]}</Text>
                  <Text style={s.cardPrice}>
                    {veh.perKm} DA/km · {veh.priseEnCharge} DA prise en charge
                  </Text>
                </View>
                {active && (
                  <View style={s.checkBox}>
                    <Ionicons name="checkmark" size={16} color="#FFFFFF" />
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
  sub:       { fontSize: 14, color: C.muted, marginBottom: 24, lineHeight: 20 },

  list:         { gap: 10 },
  card:         { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderRadius: 14, padding: 16, borderWidth: 2, borderColor: 'transparent' },
  cardActive:   { borderColor: C.accent, backgroundColor: C.accentLight },
  iconBox:      { width: 52, height: 52, borderRadius: 13, backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginRight: 14, flexShrink: 0 },
  iconBoxActive:{ backgroundColor: '#FEE2CA' },
  cardBody:     { flex: 1 },
  cardName:     { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 2 },
  cardDesc:     { fontSize: 12, color: C.muted, marginBottom: 3, lineHeight: 17 },
  cardPrice:    { fontSize: 12, fontWeight: '600', color: C.muted },
  checkBox:     { width: 30, height: 30, borderRadius: 15, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },

  footer:          { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  nextBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.primary, borderRadius: 50, paddingVertical: 17 },
  nextBtnDisabled: { backgroundColor: '#9CA3AF' },
  nextBtnTxt:      { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
