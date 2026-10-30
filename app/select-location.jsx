import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { trouverCommuneExacte } from '../src/lib/geocoding';
import { resolvePicker, cancelPicker } from '../src/lib/locationPicker';
import { nearestWilaya } from '../src/utils/wilayas';

const ALGER = { latitude: 36.7372, longitude: 3.0865 };

// Fond de carte OpenStreetMap via Leaflet, dans une WebView — pas de
// react-native-maps ici : sur Android, MapView (PROVIDER_DEFAULT → Google
// Maps) affiche un fond vide sans clé Google Maps API configurée. Cette
// solution n'a besoin d'aucune clé.
// Note usage : tile.openstreetmap.org est un service public à usage
// raisonnable, adapté au développement/à un usage modéré — pour un volume
// de production plus élevé, prévoir un fournisseur de tuiles dédié
// (MapTiler, Stadia Maps…) ou un tile server auto-hébergé.
// https://operations.osmfoundation.org/policies/tiles/
const mapHTML = (latitude, longitude) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    #map { width: 100vw; height: 100vh; }
    .center-pin {
      position: absolute; top: 50%; left: 50%;
      width: 34px; height: 34px;
      margin-left: -17px; margin-top: -32px;
      z-index: 1000; pointer-events: none;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <svg class="center-pin" viewBox="0 0 24 24" fill="#EF4444">
    <path d="M12 2C7.6 2 4 5.6 4 10c0 6 8 12 8 12s8-6 8-12c0-4.4-3.6-8-8-8zm0 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
  </svg>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false })
      .setView([${latitude}, ${longitude}], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    function sendCenter() {
      var c = map.getCenter();
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ latitude: c.lat, longitude: c.lng }));
      }
    }
    map.on('moveend', sendCenter);
    sendCenter(); // position initiale → déclenche le premier géocodage côté RN
  </script>
</body>
</html>
`;

/**
 * Sélecteur de position style Uber : un pin fixe au centre de l'écran
 * (dessiné dans le HTML, donc toujours parfaitement centré), l'utilisateur
 * déplace la carte en-dessous. À chaque "moveend" (Leaflet), la WebView
 * envoie les coordonnées du centre à React Native via postMessage, qui
 * déclenche le géocodage inverse. "Confirmer" renvoie le résultat au
 * CityInput qui a ouvert cet écran (voir src/lib/locationPicker.js) puis
 * revient en arrière.
 */
export default function SelectLocationScreen() {
  const router = useRouter();
  const { pickId, accentColor } = useLocalSearchParams();
  const accent = accentColor || '#0F4D2E';

  const [initializing, setInitializing] = useState(true);
  const [initialCoords, setInitialCoords] = useState(null);
  const [address,      setAddress]      = useState(null);
  const [geocoding,    setGeocoding]    = useState(false);
  const geocodeSeq = useRef(0);

  const geocodePosition = useCallback(async (latitude, longitude) => {
    const seq = ++geocodeSeq.current;
    setGeocoding(true);
    try {
      const label = await trouverCommuneExacte(latitude, longitude) || nearestWilaya(latitude, longitude);
      if (seq === geocodeSeq.current) setAddress(label || null);
    } finally {
      if (seq === geocodeSeq.current) setGeocoding(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      let latitude = ALGER.latitude, longitude = ALGER.longitude;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          try {
            const pos = await Promise.race([
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
              new Promise((_, reject) => setTimeout(() => reject(new Error('gps_timeout')), 8000)),
            ]);
            latitude = pos.coords.latitude;
            longitude = pos.coords.longitude;
          } catch { /* GPS indisponible/timeout → repli Alger */ }
        }
      } catch { /* permission indisponible → repli Alger */ }

      setInitialCoords({ latitude, longitude });
      setInitializing(false);
    })();
  }, []);

  // HTML calculé une seule fois (à partir de la position de départ) : on
  // ne veut surtout pas recharger la WebView à chaque changement d'état
  // React pendant que l'utilisateur déplace la carte.
  const html = useMemo(
    () => (initialCoords ? mapHTML(initialCoords.latitude, initialCoords.longitude) : null),
    [initialCoords],
  );

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        geocodePosition(data.latitude, data.longitude);
      }
    } catch { /* message non exploitable, on ignore */ }
  };

  const handleClose = () => {
    cancelPicker(pickId);
    router.back();
  };

  const handleConfirm = () => {
    if (!address || geocoding) return;
    resolvePicker(pickId, address);
    router.back();
  };

  if (initializing || !html) return (
    <View style={s.fullCenter}>
      <StatusBar barStyle="dark-content" />
      <ActivityIndicator size="large" color={accent} />
      <Text style={s.loadingTxt}>Localisation en cours…</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      <WebView
        style={{ flex: 1 }}
        source={{ html }}
        onMessage={handleWebViewMessage}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={20} color="#0A0A0A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Choisir un emplacement</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.bottomCard}>
        <View style={s.addressRow}>
          <Ionicons name="location" size={16} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={s.addressTxt} numberOfLines={2}>
            {address || (geocoding ? 'Recherche de l’adresse…' : 'Déplace la carte pour choisir un emplacement')}
          </Text>
          {geocoding && <ActivityIndicator size="small" color="#9CA3AF" style={{ marginLeft: 8 }} />}
        </View>

        <TouchableOpacity
          style={[s.confirmBtn, (!address || geocoding) && s.confirmBtnDisabled]}
          onPress={handleConfirm}
          disabled={!address || geocoding}
          activeOpacity={0.88}
        >
          <Text style={s.confirmBtnTxt}>Confirmer cette position</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', padding: 24 },
  loadingTxt: { fontSize: 15, fontWeight: '700', color: '#0A0A0A', marginTop: 16 },

  header: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 8, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 10,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  backBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#0A0A0A' },

  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 10,
  },
  addressRow:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, marginBottom: 14 },
  addressTxt:  { flex: 1, fontSize: 14, fontWeight: '600', color: '#0A0A0A' },
  confirmBtn:  { alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0A', borderRadius: 50, paddingVertical: 16 },
  confirmBtnDisabled: { backgroundColor: '#9CA3AF' },
  confirmBtnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
