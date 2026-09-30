import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  StatusBar, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { demandesDB } from '../../src/db/database';
import { getCoordsVille, haversineDistance } from '../../src/utils/distance';
import { calculerPositionSimulee } from '../../src/lib/simulationTrajet';

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
};

const SIM_STEP_MS = 3000; // fréquence de rafraîchissement de l'affichage (la position elle-même est calculée à partir du temps écoulé, voir src/lib/simulationTrajet.js)

// Icône par véhicule pour le marqueur carte + l'avatar de la carte du bas
// (mêmes emoji que app/carte-transporteurs.jsx, dupliqués ici par
// convention de ce projet — voir CLAUDE.md : constantes répétées par écran).
const VEH_EMOJI = {
  herbine: '🚗', utilitaire: '🚙', fourgon: '🚐',
  camion35: '🚛', camion10: '🚚', semi: '🚛',
};
const VEH_LABEL = {
  herbine: 'Herbine', utilitaire: 'Utilitaire léger', fourgon: 'Fourgon',
  camion35: 'Camion 3.5T', camion10: 'Camion 10T', semi: 'Semi-remorque',
};

// Carte de suivi live (WebView + Leaflet/OpenStreetMap — même solution
// que app/carte-transporteurs.jsx et app/select-location.jsx, pour éviter
// le fond de carte vide de react-native-maps sur Android sans clé Google
// Maps). Le camion est déplacé via injectJavaScript à chaque tick ; une
// transition CSS lisse son déplacement plutôt qu'un saut brut.
//
// Marqueur "style Uber" : avatar rond noir à bord blanc (comme l'icône
// voiture d'Uber), pas juste un emoji flottant — cohérent avec l'avatar
// de la carte du bas (voir truckBadge plus loin).
const suiviHTML = (destLat, destLon, vehiculeEmoji) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    #map { width: 100vw; height: 100vh; }
    .camion-marker {
      background: #0A0A0A;
      border: 3px solid #fff;
      border-radius: 50%;
      width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      box-shadow: 0 3px 8px rgba(0,0,0,0.4);
    }
    .dest-marker {
      font-size: 30px; line-height: 1;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4));
    }
    .leaflet-marker-icon.camion-icon { transition: transform 0.5s linear; }
    .leaflet-popup-content { font-size: 13px; font-weight: 600; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false }).setView([${destLat}, ${destLon}], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var destIcon = L.divIcon({ className: '', html: '<div class="dest-marker">📍</div>', iconSize: [30, 30], iconAnchor: [15, 28] });
    var camionIcon = L.divIcon({
      className: 'camion-icon',
      html: '<div class="camion-marker">${vehiculeEmoji}</div>',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    L.marker([${destLat}, ${destLon}], { icon: destIcon })
      .addTo(map)
      .bindPopup('Votre adresse');

    var camionMarker = null;
    var routeLine     = null;
    var dest          = [${destLat}, ${destLon}];

    window.updateTruck = function (lat, lng) {
      var pos = [lat, lng];
      if (!camionMarker) {
        camionMarker = L.marker(pos, { icon: camionIcon }).addTo(map);
        map.fitBounds(L.latLngBounds([pos, dest]), { padding: [60, 60], maxZoom: 14 });
      } else {
        camionMarker.setLatLng(pos);
      }
      if (routeLine) map.removeLayer(routeLine);
      routeLine = L.polyline([pos, dest], { color: '#1A56DB', weight: 3, dashArray: '6,8' }).addTo(map);
    };
  </script>
</body>
</html>
`;

/**
 * Suivi live de la course côté expéditeur.
 *
 * ⚠️ SIMULATION, PAS UNE VRAIE POSITION : DzExpress est 100% offline-first
 * (voir CLAUDE.md) — chaque appareil a sa PROPRE base SQLite locale, il
 * n'existe aucun backend/serveur partagé (Supabase est configuré mais non
 * utilisé, voir src/lib/supabase.js). Si l'expéditeur et le transporteur
 * sont sur deux téléphones physiques différents, la position écrite par
 * le transporteur (src/lib/tracking.js, toujours actif côté
 * app/course/[id].jsx) n'atteint jamais cet écran.
 *
 * Pour pouvoir tester/démontrer le rendu de la carte sur un seul
 * téléphone, cet écran ignore délibérément cette position réelle et
 * simule un trajet du point de départ vers la destination de la demande
 * (coordonnées réelles, résolues via getCoordsVille). Un badge "🧪
 * Simulation" reste affiché en permanence pour qu'on ne confonde jamais
 * ce déplacement avec une vraie position GPS.
 */
export default function SuiviLiveScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const webviewRef = useRef(null);
  const seuilsAtteintsRef = useRef(new Set());
  const bannerTimeoutRef  = useRef(null);

  const [demande, setDemande]           = useState(null);
  const [webviewReady, setWebviewReady] = useState(false);
  const [distanceRestante, setDistanceRestante] = useState(null);
  const [arrive, setArrive]             = useState(false);
  const [banner, setBanner]             = useState(null);

  const load = useCallback(() => {
    try { setDemande(demandesDB.getById(parseInt(id))); } catch (_) {}
  }, [id]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  // Coordonnées départ/arrivée — précises si déjà en cache local, sinon
  // centre de la wilaya (voir src/utils/distance.js). Calculées une seule
  // fois, pas à chaque poll de `demande`.
  const departCoords = useMemo(
    () => (demande ? getCoordsVille(demande.ville_depart) : null),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [demande?.ville_depart]);

  const destCoords = useMemo(
    () => (demande ? getCoordsVille(demande.ville_arrivee) : null),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [demande?.ville_arrivee]);

  // Distance totale du trajet simulé (departure → destination), calculée
  // une seule fois — sert à afficher la barre de progression "style Uber".
  const totalDistanceKm = useMemo(
    () => (departCoords && destCoords
      ? haversineDistance(departCoords.lat, departCoords.lng, destCoords.lat, destCoords.lng)
      : null),
    [departCoords, destCoords]
  );

  // Ancre temporelle du trajet simulé — voir src/lib/simulationTrajet.js.
  // Repli sur accepted_at si en_route_at est absent (ne devrait arriver
  // que pour une course déjà en_route avant l'ajout de cette colonne).
  const enRouteAt = demande?.en_route_at || demande?.accepted_at || null;

  const vehiculeEmoji = VEH_EMOJI[demande?.vehicule_recommande] || '🚛';
  const vehiculeLabel = VEH_LABEL[demande?.vehicule_recommande] || null;

  // HTML construit une seule fois (destination + véhicule fixes) — jamais
  // recalculé à chaque tick de simulation, pour ne pas recharger la WebView.
  const html = useMemo(
    () => (destCoords ? suiviHTML(destCoords.lat, destCoords.lng, vehiculeEmoji) : null),
    [destCoords, vehiculeEmoji]
  );

  const showBanner = useCallback((msg) => {
    setBanner(msg);
    clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => setBanner(null), 4000);
  }, []);

  // ── Simulation du déplacement (voir avertissement en tête de fichier) ──
  // La position est une fonction pure du temps écoulé depuis en_route_at
  // (calculerPositionSimulee) — pas un compteur de pas propre à cet écran.
  // Ce setInterval ne fait que rafraîchir l'affichage périodiquement ; la
  // même course affichée ailleurs (ex : mini-carte de l'accueil) calcule
  // exactement la même position au même instant.
  useEffect(() => {
    if (!webviewReady || !departCoords || !destCoords || !enRouteAt) return;

    seuilsAtteintsRef.current = new Set();

    const tick = () => {
      const pos = calculerPositionSimulee(enRouteAt, departCoords, destCoords);
      if (!pos) return;

      webviewRef.current?.injectJavaScript(
        `window.updateTruck && window.updateTruck(${pos.lat}, ${pos.lng}); true;`
      );

      const distKm = haversineDistance(pos.lat, pos.lng, destCoords.lat, destCoords.lng);
      setDistanceRestante(distKm);

      for (const seuil of [10, 5]) {
        if (distKm <= seuil && !seuilsAtteintsRef.current.has(seuil)) {
          seuilsAtteintsRef.current.add(seuil);
          showBanner(`🚛 Votre transporteur est à ${seuil} km !`);
        }
      }

      if (pos.arrive) {
        clearInterval(intervalId);
        setArrive(true);
        showBanner('🎉 Livraison arrivée !');
      }
    };

    tick(); // premier point immédiatement, pas d'attente de 3s
    const intervalId = setInterval(tick, SIM_STEP_MS);
    return () => clearInterval(intervalId);
  }, [webviewReady, departCoords, destCoords, enRouteAt, showBanner]);

  useEffect(() => () => clearTimeout(bannerTimeoutRef.current), []);

  if (!demande || !html) return (
    <View style={s.fullCenter}>
      <StatusBar barStyle="dark-content" />
      <ActivityIndicator size="large" color={C.accent} />
      <Text style={s.loadingTxt}>Chargement du suivi…</Text>
    </View>
  );

  const eta = distanceRestante != null ? Math.max(1, Math.round(distanceRestante * 2)) : null;
  const progress = arrive
    ? 100
    : (totalDistanceKm && distanceRestante != null
      ? Math.max(0, Math.min(100, Math.round((1 - distanceRestante / totalDistanceKm) * 100)))
      : 0);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      <WebView
        ref={webviewRef}
        style={StyleSheet.absoluteFill}
        source={{ html }}
        onLoadEnd={() => setWebviewReady(true)}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={['*']}
      />

      <View style={s.simBadge}>
        <Text style={s.simBadgeTxt}>🧪 Simulation — pas une vraie position GPS</Text>
      </View>

      {banner && (
        <View style={s.proximityBanner}>
          <Text style={s.proximityBannerTxt}>{banner}</Text>
        </View>
      )}

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={s.headerTitle}>Suivi de livraison</Text>
          <Text style={s.headerSub} numberOfLines={1}>{demande.ville_depart} → {demande.ville_arrivee}</Text>
        </View>
      </View>

      <View style={s.bottomCard}>
        <View style={s.progressBarBg}>
          <View style={[s.progressBarFill, { width: `${progress}%` }, arrive && { backgroundColor: C.success }]} />
        </View>

        <View style={s.statusRow}>
          <View style={[s.truckBadge, arrive && { backgroundColor: C.success }]}>
            <Text style={{ fontSize: 20 }}>{arrive ? '🎉' : vehiculeEmoji}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.driverName}>{demande.transporteur_nom || 'Ton transporteur'}</Text>
              {vehiculeLabel && !arrive && <Text style={s.vehiculeTag}>{vehiculeLabel}</Text>}
            </View>
            {arrive ? (
              <Text style={[s.updateTxt, { color: C.success, fontWeight: '700' }]}>Livraison arrivée à destination</Text>
            ) : distanceRestante != null ? (
              <Text style={s.updateTxt}>{distanceRestante} km restants · ETA ~{eta} min</Text>
            ) : (
              <Text style={s.updateTxt}>Localisation du trajet…</Text>
            )}
          </View>
        </View>

        <TouchableOpacity style={s.chatBtn} onPress={() => router.push(`/chat/${id}`)} activeOpacity={0.88}>
          <Ionicons name="chatbubble-ellipses-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={s.chatBtnTxt}>Contacter le transporteur</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fullCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgAlt, padding: 24 },
  loadingTxt: { fontSize: 15, fontWeight: '700', color: C.text, marginTop: 16 },

  simBadge: {
    position: 'absolute', top: Platform.OS === 'ios' ? 110 : (StatusBar.currentHeight || 24) + 62, left: 12, right: 12,
    backgroundColor: 'rgba(249,115,22,0.95)', borderRadius: 10,
    paddingVertical: 6, alignItems: 'center',
  },
  simBadgeTxt: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },

  proximityBanner: {
    position: 'absolute', top: Platform.OS === 'ios' ? 148 : (StatusBar.currentHeight || 24) + 100, left: 12, right: 12,
    backgroundColor: 'rgba(10,10,10,0.92)', borderRadius: 14,
    paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center',
  },
  proximityBannerTxt: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  header: {
    position: 'absolute', top: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 8, left: 12, right: 12,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 10,
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8,
  },
  backBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' },
  headerTitle: { fontSize: 14, fontWeight: '800', color: C.text },
  headerSub:   { fontSize: 11, color: C.muted, marginTop: 1 },

  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 10,
  },
  progressBarBg:   { height: 5, backgroundColor: C.border, borderRadius: 3, overflow: 'hidden', marginBottom: 16 },
  progressBarFill: { height: '100%', backgroundColor: C.accent, borderRadius: 3 },

  statusRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  // Avatar rond noir à bord blanc — cohérent avec le marqueur camion sur
  // la carte (.camion-marker dans suiviHTML), style Uber.
  truckBadge: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
    borderWidth: 3, borderColor: '#FFFFFF',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  driverName:  { fontSize: 15, fontWeight: '800', color: C.text },
  vehiculeTag: { fontSize: 10, fontWeight: '700', color: C.muted, backgroundColor: C.bgAlt, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  updateTxt:   { fontSize: 12, color: C.muted, marginTop: 2 },
  chatBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 15 },
  chatBtnTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
