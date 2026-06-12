import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, StatusBar, ActivityIndicator, Alert, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useReservation, ProgressBar } from '../../src/context/ReservationContext';
import CityInput from '../../src/components/CityInput';
import { WILAYA_COORDS } from '../../src/utils/wilayas';

const WILAYAS = [
  'Adrar','Aïn Defla','Aïn Témouchent','Alger','Annaba',
  'Batna','Béchar','Béjaïa','Biskra','Blida','Bordj Bou Arréridj',
  'Bouira','Boumerdès','Chlef','Constantine','Djelfa','El Bayadh',
  'El Oued','El Tarf','Ghardaïa','Guelma','Illizi','Jijel',
  'Khenchela','Laghouat','Mascara','Médéa','Mila','Mostaganem',
  'Msila','Naâma','Oran','Ouargla','Oum El Bouaghi','Relizane',
  'Saïda','Sétif','Sidi Bel Abbès','Skikda','Souk Ahras',
  'Tamanrasset','Tébessa','Tiaret','Tindouf','Tipaza',
  'Tissemsilt','Tizi Ouzou','Tlemcen',
];

function nearestWilaya(lat, lng) {
  const toR = d => d * Math.PI / 180;
  let best = null, bestDist = Infinity;
  for (const name of WILAYAS) {
    const c = WILAYA_COORDS[name];
    if (!c) continue;
    const a = Math.sin(toR((c.lat - lat) / 2)) ** 2 +
              Math.cos(toR(lat)) * Math.cos(toR(c.lat)) *
              Math.sin(toR((c.lng - lng) / 2)) ** 2;
    const d = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

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
  const [gpsLoading,   setGpsLoading]   = useState(false);
  const [gpsKey,       setGpsKey]       = useState(0);

  const detectPosition = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('Permission refusée', 'Active la localisation dans les paramètres.');
      }
      const pos    = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const wilaya = nearestWilaya(pos.coords.latitude, pos.coords.longitude);
      if (wilaya) { setLocalDepart(wilaya); setGpsKey(k => k + 1); }
      else Alert.alert('Position introuvable', 'Saisis ta ville manuellement.');
    } catch {
      Alert.alert('GPS échoué', 'Vérifie que le GPS est activé.');
    } finally {
      setGpsLoading(false);
    }
  };

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
          <View style={s.labelRow}>
            <Text style={s.fieldLabel}>Ville de départ</Text>
            <TouchableOpacity
              style={[s.gpsBtn, gpsLoading && { opacity: 0.6 }]}
              onPress={detectPosition}
              disabled={gpsLoading}
            >
              {gpsLoading
                ? <ActivityIndicator size="small" color={C.accent} />
                : (
                  <>
                    <Ionicons name="locate-outline" size={13} color={C.accent} />
                    <Text style={s.gpsBtnTxt}>Ma position</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>

          {localDepart && gpsKey > 0 && (
            <View style={s.gpsBadge}>
              <Ionicons name="location" size={14} color={C.success} style={{ marginRight: 6 }} />
              <Text style={s.gpsBadgeTxt}>{localDepart}</Text>
              <TouchableOpacity onPress={() => { setLocalDepart(''); setGpsKey(k => k + 1); }}>
                <Ionicons name="close-circle" size={17} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          )}

          <CityInput
            key={`depart-${gpsKey}`}
            value={localDepart}
            onChange={setLocalDepart}
            accentColor={C.accent}
            zIndex={20}
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
            zIndex={19}
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
  labelRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  gpsBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, borderWidth: 1.5, borderColor: C.accent, backgroundColor: C.accentLight },
  gpsBtnTxt:   { fontSize: 12, fontWeight: '700', color: C.accent },
  gpsBadge:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, borderWidth: 1, borderColor: '#6EE7B7' },
  gpsBadgeTxt: { fontSize: 13, fontWeight: '700', color: C.success, flex: 1 },

  divider:     { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },

  footer:          { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  nextBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.primary, borderRadius: 50, paddingVertical: 17 },
  nextBtnDisabled: { backgroundColor: '#9CA3AF' },
  nextBtnTxt:      { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
