import { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Platform, StatusBar, KeyboardAvoidingView, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useReservation, ProgressBar } from '../../src/context/ReservationContext';
import CityInput from '../../src/components/CityInput';
import { getCoordsVille } from '../../src/utils/distance';

const C = {
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB', accent: '#0F4D2E',
};

const ALGER = { lat: 36.737, lng: 3.087 };

// Carte d'aperçu du trajet — WebView + Leaflet/OpenStreetMap, non
// interactive (pas de gestion de clic marqueur), reconstruite chaque fois
// que les coordonnées départ/arrivée changent. Même approche que
// app/select-location.jsx et l'ancien app/carte-transporteurs.jsx : pas de
// clé Google Maps requise.
function routeMapHTML(depart, arrivee) {
  const hasDepart  = !!depart;
  const hasArrivee = !!arrivee;
  const d = depart  || ALGER;
  const a = arrivee || depart || ALGER;
  const center = hasDepart ? d : ALGER;

  const markersJs = `
    ${hasDepart ? `
      L.marker([${d.lat}, ${d.lng}], {
        icon: L.divIcon({ className: '', html: '<div class="pin pin-depart"></div>', iconSize: [18,18], iconAnchor: [9,9] }),
      }).addTo(map);
    ` : ''}
    ${hasArrivee ? `
      L.marker([${a.lat}, ${a.lng}], {
        icon: L.divIcon({ className: '', html: '<div class="pin pin-arrivee"></div>', iconSize: [18,18], iconAnchor: [9,9] }),
      }).addTo(map);
    ` : ''}
    ${hasDepart && hasArrivee ? `
      var line = L.polyline([[${d.lat}, ${d.lng}], [${a.lat}, ${a.lng}]], {
        color: '#0F4D2E', weight: 3, dashArray: '1, 8',
      }).addTo(map);
      map.fitBounds(line.getBounds(), { padding: [36, 36] });
    ` : ''}
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    #map { width: 100vw; height: 100vh; background: #F5F5F5; }
    .pin { width: 18px; height: 18px; border-radius: 9px; border: 3px solid #fff; box-sizing: border-box; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
    .pin-depart  { background: #10B981; }
    .pin-arrivee { background: #EF4444; }
    .leaflet-control-attribution { display: none; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false })
      .setView([${center.lat}, ${center.lng}], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    ${markersJs}
  </script>
</body>
</html>
`;
}

export default function Etape1() {
  const router = useRouter();
  const { departure, arrival, setField } = useReservation();

  const [localDepart,  setLocalDepart]  = useState(departure || '');
  const [localArrivee, setLocalArrivee] = useState(arrival   || '');

  const departCoords  = useMemo(() => localDepart  ? getCoordsVille(localDepart)  : null, [localDepart]);
  const arriveeCoords = useMemo(() => localArrivee ? getCoordsVille(localArrivee) : null, [localArrivee]);

  const html = useMemo(
    () => routeMapHTML(
      departCoords  ? { lat: departCoords.lat,  lng: departCoords.lng }  : null,
      arriveeCoords ? { lat: arriveeCoords.lat, lng: arriveeCoords.lng } : null,
    ),
    [departCoords, arriveeCoords]
  );

  const canNext = !!localDepart && !!localArrivee;

  const handleNext = () => {
    if (!localDepart)  return Alert.alert('Requis', 'Choisis la ville de départ.');
    if (!localArrivee) return Alert.alert('Requis', "Choisis la ville d'arrivée.");
    setField('departure', localDepart);
    setField('arrival',   localArrivee);
    router.push('/reservation/etape2');
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
      <ProgressBar step={1} total={3} />

      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={s.title}>Où aller ?</Text>

        <Text style={s.fieldLabel}>Départ</Text>
        <CityInput
          value={localDepart}
          onChange={setLocalDepart}
          accentColor={C.accent}
          placeholder="Ville de départ…"
        />

        <Text style={s.fieldLabel}>Arrivée</Text>
        <CityInput
          value={localArrivee}
          onChange={setLocalArrivee}
          accentColor={C.accent}
          placeholder="Ville d'arrivée…"
        />

        <View style={s.mapBox}>
          <WebView
            key={html}
            style={StyleSheet.absoluteFill}
            source={{ html }}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            scrollEnabled={false}
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
        </TouchableOpacity>
      </View>
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
  title:   { fontSize: 24, fontWeight: '800', color: C.text, marginBottom: 24 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },

  mapBox: {
    height: 220, borderRadius: 16, overflow: 'hidden',
    backgroundColor: C.bgAlt, borderWidth: 1, borderColor: C.border,
    marginTop: 8,
  },

  footer:          { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  nextBtn:         { alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, borderRadius: 50, paddingVertical: 17 },
  nextBtnDisabled: { backgroundColor: '#FBC89A' },
  nextBtnTxt:      { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
