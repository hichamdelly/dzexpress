import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  StatusBar, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { useApp, localNotif } from '../../src/context/AppContext';
import { useReservation, ProgressBar } from '../../src/context/ReservationContext';
import { demandesDB, notifDB } from '../../src/db/database';
import {
  genererTransporteurs, simulerReponse, simulerMouvement,
  fmtTimer,
} from '../../src/simulation/transporteurs';
import { fmtKm } from '../../src/utils/wilayas';
import { getVehicule } from '../../src/constants/vehicules';
import { getDistanceKmPrecise as getDistanceKm } from '../../src/utils/distance';

const ALGER = { latitude: 36.7372, longitude: 3.0865 };

// Offset ajouté sous la barre de progression fixée en haut de l'écran
// (voir ProgressBar) pour que le header flottant et la légende ne se
// chevauchent pas avec elle.
const PB_OFFSET = 26;

const C = {
  primary: '#0A0A0A', accent: '#0F4D2E', accentLight: '#E8F2EC',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
  warning: '#F59E0B',
};

const VEH_ICON = {
  herbine:    'cart-outline',
  utilitaire: 'car-outline',
  fourgon:    'car-sport-outline',
  camion35:   'bus-outline',
  camion10:   'cube-outline',
  semi:       'construct-outline',
};
const VEH_LABEL = {
  herbine:    'Herbine',
  utilitaire: 'Utilitaire léger',
  fourgon:    'Fourgon',
  camion35:   'Camion 3.5T',
  camion10:   'Camion 10T',
  semi:       'Semi-remorque',
};
// Couleur du marqueur selon le type de véhicule (quand le transporteur est disponible)
const VEH_COLOR = {
  herbine:    '#10B981',
  utilitaire: '#8B5CF6',
  fourgon:    '#1A56DB',
  camion35:   '#D4A017',
  camion10:   '#EF4444',
  semi:       '#1A56DB',
};
// Les marqueurs de la carte (WebView/Leaflet) ne peuvent pas afficher les
// icônes vectorielles Ionicons (police propre à React Native) — on utilise
// un emoji équivalent par véhicule uniquement pour ces marqueurs HTML (🚛).
const VEH_EMOJI = {
  herbine:    '🚗',
  utilitaire: '🚙',
  fourgon:    '🚐',
  camion35:   '🚛',
  camion10:   '🚚',
  semi:       '🚛',
};

/** Distance haversine en km (string, 1 décimale) entre deux points GPS. */
function calculerDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (R * c).toFixed(1);
}

// ── Carte (WebView + Leaflet/OpenStreetMap) — style "Google Maps" avec
// marqueurs rouges 🚛 pour les transporteurs disponibles. Même approche
// que l'ancien app/carte-transporteurs.jsx (pas de clé Google Maps requise).
const mapHTML = (latitude, longitude) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
    #map { width: 100vw; height: 100vh; background: #F5F5F5; }
    .t-marker {
      width: 40px; height: 40px; border-radius: 20px;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; border: 3px solid #fff; box-sizing: border-box;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    }
    .t-marker.selected {
      border-color: #0F4D2E;
      box-shadow: 0 0 0 6px rgba(249,115,22,0.22), 0 2px 4px rgba(0,0,0,0.3);
    }
    .my-pos {
      width: 16px; height: 16px; border-radius: 8px;
      background: #1A56DB; border: 3px solid #fff; box-sizing: border-box;
      box-shadow: 0 0 0 6px rgba(26,86,219,0.22);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: true, attributionControl: false })
      .setView([${latitude}, ${longitude}], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var myCircle = L.circle([${latitude}, ${longitude}], {
      radius: 15000, color: 'rgba(10,10,10,0.15)', weight: 1, fillColor: 'rgba(10,10,10,0.03)', fillOpacity: 1,
    }).addTo(map);
    var myMarker = L.marker([${latitude}, ${longitude}], {
      icon: L.divIcon({ className: '', html: '<div class="my-pos"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }),
      interactive: false,
    }).addTo(map);

    var markersLayer = L.layerGroup().addTo(map);

    // Appelé depuis React Native à chaque changement de la liste des
    // transporteurs (chargement initial, mouvement simulé, sélection).
    window.updateMarkers = function (json) {
      var payload = JSON.parse(json);
      markersLayer.clearLayers();
      payload.transporteurs.forEach(function (t) {
        var cls = 't-marker' + (t.selected ? ' selected' : '');
        var icon = L.divIcon({
          className: '',
          html: '<div class="' + cls + '" style="background:' + t.color + '">' + t.emoji + '</div>',
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });
        var marker = L.marker([t.latitude, t.longitude], { icon: icon }).addTo(markersLayer);
        marker.on('click', function () {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', id: t.id }));
          }
        });
      });
    };

    // Appelé depuis React Native quand la position GPS de l'utilisateur
    // change (bouton "rafraîchir").
    window.recenterMap = function (lat, lng) {
      map.setView([lat, lng], map.getZoom());
      myMarker.setLatLng([lat, lng]);
      myCircle.setLatLng([lat, lng]);
    };
  </script>
</body>
</html>
`;

// ── Ligne méta du sheet ──────────────────────────────────────
function SheetMeta({ iconName, label }) {
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View style={sm.iconBox}><Ionicons name={iconName} size={16} color={C.muted} /></View>
      <Text style={sm.label}>{label}</Text>
    </View>
  );
}
const sm = StyleSheet.create({
  iconBox: { width: 34, height: 34, borderRadius: 8, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },
  label:   { fontSize: 11, color: C.text, fontWeight: '600', textAlign: 'center', maxWidth: 72 },
});

// ════════════════════════════════════════════════════════════
export default function Etape3Screen() {
  const router  = useRouter();
  const { user } = useApp();
  const ctx     = useReservation();
  const { departure: depart, arrival: arrivee, categories, description: desc, aideChargement, vehicule, reset } = ctx;
  const vehTarif = getVehicule(vehicule)?.tarif || null;

  const typeMarchandise = (categories || []).join(',');
  const aideFee  = (aideChargement || 0) * 500;
  const routeKm  = getDistanceKm(depart, arrivee);

  const webviewRef       = useRef(null);
  const cancelSimRef     = useRef(null);
  const moveIntervalRef  = useRef(null);

  const [phase, setPhase]               = useState('loading');
  const [myPos, setMyPos]               = useState(null);
  const [mapHtml, setMapHtml]           = useState(null);
  const [webviewReady, setWebviewReady] = useState(false);
  const [noPermission, setNoPermission] = useState(false);
  const [locationErr, setLocationErr]   = useState(null);
  const [transporteurs, setTransporteurs] = useState([]);
  const [selected, setSelected]         = useState(null);
  const [countdown, setCountdown]       = useState(120);
  const [acceptedT, setAcceptedT]       = useState(null);
  const [demandeId, setDemandeId]       = useState(null);

  // Transporteurs enrichis d'une distance réelle (haversine) depuis la
  // position de l'utilisateur et du prix final (avec aide au chargement),
  // triés du plus proche au plus loin.
  const transporteursTries = useMemo(() => {
    if (!myPos) return transporteurs;
    return transporteurs
      .map(t => ({
        ...t,
        distance_km: parseFloat(calculerDistance(myPos.latitude, myPos.longitude, t.latitude, t.longitude)),
        prix_final:  t.prix_estime + aideFee,
      }))
      .sort((a, b) => a.distance_km - b.distance_km);
  }, [transporteurs, myPos, aideFee]);

  const chargerPosition = useCallback(async () => {
    setPhase('loading');
    setNoPermission(false);
    let latitude = ALGER.latitude, longitude = ALGER.longitude;
    let usedFallback = false;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        usedFallback = true;
      } else {
        try {
          // On borne l'attente GPS : certains devices/émulateurs ne répondent
          // jamais, ce qui bloquait l'écran en phase "loading" sans jamais
          // afficher la carte ni les transporteurs.
          const pos = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('gps_timeout')), 8000)),
          ]);
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch (gpsErr) {
          console.log('Position GPS indisponible, repli sur Alger par défaut:', gpsErr?.message);
          usedFallback = true;
        }
      }
      setNoPermission(usedFallback);
      setMyPos({ latitude, longitude });
      setMapHtml(prev => prev || mapHTML(latitude, longitude));
      const dispos = genererTransporteurs(latitude, longitude, 8, routeKm, vehTarif);
      setTransporteurs(dispos);
      setPhase('map');
    } catch (e) {
      console.log('Erreur chargement carte transporteurs:', e?.message);
      setLocationErr('GPS indisponible. Vérifie que la localisation est activée.');
      setPhase('error');
    }
  }, [routeKm, vehTarif]);

  useEffect(() => { chargerPosition(); }, []);

  useEffect(() => {
    if (phase !== 'waiting') return;
    setCountdown(120);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(interval); handleRefus('Temps écoulé'); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'map') { clearInterval(moveIntervalRef.current); return; }
    moveIntervalRef.current = setInterval(() => setTransporteurs(prev => simulerMouvement(prev)), 30_000);
    return () => clearInterval(moveIntervalRef.current);
  }, [phase]);

  useEffect(() => () => {
    cancelSimRef.current?.();
    clearInterval(moveIntervalRef.current);
  }, []);

  useEffect(() => {
    if (!webviewReady) return;
    const payload = JSON.stringify({
      transporteurs: transporteursTries.map(t => ({
        id: t.id,
        latitude: t.latitude,
        longitude: t.longitude,
        emoji: VEH_EMOJI[t.vehicule] || '🚛',
        color: t.disponible ? (selected?.id === t.id ? C.accent : (VEH_COLOR[t.vehicule] || C.success)) : '#9CA3AF',
        selected: selected?.id === t.id,
      })),
    });
    webviewRef.current?.injectJavaScript(
      `window.updateMarkers && window.updateMarkers(${JSON.stringify(payload)}); true;`
    );
  }, [webviewReady, transporteursTries, selected]);

  useEffect(() => {
    if (!webviewReady || !myPos) return;
    webviewRef.current?.injectJavaScript(
      `window.recenterMap && window.recenterMap(${myPos.latitude}, ${myPos.longitude}); true;`
    );
  }, [webviewReady, myPos]);

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'select' && phase === 'map') {
        const t = transporteursTries.find(x => x.id === data.id);
        if (t) setSelected(t);
      }
    } catch { /* message non exploitable, on ignore */ }
  };

  const envoyerDemande = (t) => {
    if (!t.disponible) {
      Alert.alert('Chauffeur occupé', 'Ce chauffeur est actuellement en course. Choisis-en un autre.');
      return;
    }
    setSelected(t);
    setPhase('waiting');
    const id = demandesDB.createMaintenant({
      expediteur_id: user.id, ville_depart: depart, ville_arrivee: arrivee,
      type_marchandise: typeMarchandise, poids: null, description: desc || null,
      transporteur_simule: { ...t, prix_estime: t.prix_final },
      vehicule_recommande: vehTarif,
    });
    setDemandeId(id);
    localNotif(user.id, `Demande envoyée à ${t.nom} — en attente de réponse…`);
    cancelSimRef.current = simulerReponse(
      () => handleAccept(t, id),
      () => handleRefus('refusé'),
    );
  };

  const handleAccept = (t, id) => {
    demandesDB.updateStatut(id, 'acceptee');
    notifDB.create(user.id, `${t.nom} a accepté ta demande ${depart} → ${arrivee} !`);
    setAcceptedT(t);
    setPhase('accepted');
    reset();
  };

  const handleRefus = (reason) => {
    cancelSimRef.current?.();
    if (demandeId) demandesDB.updateStatut(demandeId, 'annulee');
    localNotif(user.id, `${selected?.nom || 'Le chauffeur'} n'est pas disponible — choisis-en un autre sur la carte.`);
    setPhase('refused');
    setDemandeId(null);
    setTimeout(() => {
      setTransporteurs(prev => prev.map(t => t.id === selected?.id ? { ...t, disponible: false } : t));
      setSelected(null);
      setPhase('map');
    }, 2500);
  };

  const fermer = () => {
    if (phase === 'waiting') annulerAttente();
    router.replace('/(tabs)');
  };

  const annulerAttente = () => {
    cancelSimRef.current?.();
    if (demandeId) demandesDB.updateStatut(demandeId, 'annulee');
    setSelected(null);
    setDemandeId(null);
    setPhase('map');
  };

  // ── Phases plein écran ───────────────────────────────────
  if (phase === 'loading') return (
    <View style={s.fullCenter}>
      <StatusBar barStyle="dark-content" />
      <ActivityIndicator size="large" color={C.accent} />
      <Text style={s.loadingTxt}>Recherche des chauffeurs autour de vous…</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <Ionicons name="location-outline" size={14} color={C.muted} />
        <Text style={s.loadingTxt2}>Localisation en cours</Text>
      </View>
    </View>
  );

  if (phase === 'error') return (
    <View style={s.fullCenter}>
      <View style={s.errorIconBox}><Ionicons name="location-outline" size={40} color={C.error} /></View>
      <Text style={s.errorTitle}>Localisation impossible</Text>
      <Text style={s.errorDesc}>{locationErr}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={chargerPosition}>
        <Ionicons name="refresh-outline" size={16} color="#FFFFFF" style={{ marginRight: 7 }} />
        <Text style={s.retryTxt}>Réessayer</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.backLink} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={14} color={C.muted} style={{ marginRight: 5 }} />
        <Text style={s.backLinkTxt}>Retour</Text>
      </TouchableOpacity>
    </View>
  );

  if (phase === 'accepted' && acceptedT) return (
    <View style={s.fullCenter}>
      <StatusBar barStyle="dark-content" />
      <View style={s.acceptedCard}>
        <View style={s.acceptedIconBox}>
          <Ionicons name="checkmark-circle" size={52} color={C.success} />
        </View>
        <Text style={s.acceptedTitle}>Demande acceptée !</Text>

        <View style={s.transporteurCard}>
          <View style={s.tAvatar}>
            <Text style={s.tAvatarTxt}>
              {acceptedT.nom.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.tNom}>{acceptedT.nom}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <Ionicons name={VEH_ICON[acceptedT.vehicule] || 'car-sport-outline'} size={13} color={C.muted} />
              <Text style={s.tVeh}>{VEH_LABEL[acceptedT.vehicule]}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
              <Ionicons name="star" size={12} color={C.warning} />
              <Text style={s.tRating}>{acceptedT.rating} · {acceptedT.nb_courses} courses</Text>
            </View>
          </View>
        </View>

        <View style={s.routeRecap}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <View style={[s.routeDot, { backgroundColor: C.success }]} />
            <Text style={s.routeRecapTxt}>{depart}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Ionicons name={VEH_ICON[acceptedT.vehicule] || 'car-sport-outline'} size={18} color={C.muted} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <View style={[s.routeDot, { backgroundColor: C.error }]} />
            <Text style={s.routeRecapTxt}>{arrivee}</Text>
          </View>
        </View>

        <View style={s.phoneCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Ionicons name="call-outline" size={14} color={C.success} />
            <Text style={s.phoneLabel}>Numéro de téléphone</Text>
          </View>
          <Text style={s.phoneNumber}>{acceptedT.telephone}</Text>
          <Text style={s.phoneSub}>Contacte-le pour coordonner la livraison</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 20 }}>
          <Ionicons name="wallet-outline" size={15} color={C.muted} />
          <Text style={s.prixEstime}>Prix estimé · ~{(acceptedT.prix_final ?? acceptedT.prix_estime).toLocaleString()} DA</Text>
        </View>

        <TouchableOpacity style={s.doneBtn} onPress={() => router.replace('/(tabs)/suivi')}>
          <Text style={s.doneBtnTxt}>Voir mes demandes</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const disponibles = transporteursTries.filter(t => t.disponible);
  const occupes     = transporteursTries.filter(t => !t.disponible);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      {mapHtml && (
        <WebView
          ref={webviewRef}
          style={StyleSheet.absoluteFill}
          source={{ html: mapHtml }}
          onMessage={handleWebViewMessage}
          onLoadEnd={() => setWebviewReady(true)}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
        />
      )}

      {/* Barre de progression (3/3) */}
      <View style={s.pbBar}>
        <ProgressBar step={3} total={3} />
      </View>

      {/* Header flottant */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => phase === 'map' ? router.back() : annulerAttente()}>
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Choisissez votre chauffeur</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
            <Ionicons name="navigate-outline" size={11} color={C.muted} />
            <Text style={s.headerSub} numberOfLines={1}>
              {depart} → {arrivee}{routeKm ? `  ·  ${fmtKm(routeKm)}` : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={s.refreshMapBtn} onPress={chargerPosition}>
          <Ionicons name="refresh-outline" size={18} color={C.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={s.backBtn} onPress={fermer}>
          <Ionicons name="close" size={18} color={C.text} />
        </TouchableOpacity>
      </View>

      {/* Bannière permission refusée */}
      {phase === 'map' && noPermission && (
        <View style={s.noPermBanner}>
          <Ionicons name="location-outline" size={20} color={C.warning} />
          <Text style={s.noPermTxt}>Activez la géolocalisation pour voir les chauffeurs près de vous</Text>
          <TouchableOpacity style={s.noPermBtn} onPress={chargerPosition}>
            <Text style={s.noPermBtnTxt}>Activer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Légende */}
      {phase === 'map' && (
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: C.success }]} />
            <Text style={s.legendTxt}>{disponibles.length} dispo</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: '#9CA3AF' }]} />
            <Text style={s.legendTxt}>{occupes.length} occupé</Text>
          </View>
          <Text style={s.legendHint}>Appuie sur un marqueur</Text>
        </View>
      )}

      {/* Bottom sheet — infos transporteur sélectionné (nom, véhicule, note, distance, prix) */}
      {phase === 'map' && selected && (
        <View style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetTop}>
            <View style={s.sheetAvatar}>
              <Text style={s.sheetAvatarTxt}>
                {selected.nom.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetNom}>{selected.nom}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 }}>
                <Ionicons name={VEH_ICON[selected.vehicule] || 'car-sport-outline'} size={12} color={C.muted} />
                <Text style={s.sheetVeh}>{VEH_LABEL[selected.vehicule]}</Text>
              </View>
            </View>
            {selected.disponible
              ? <View style={s.dispoBadge}><View style={[s.dispoIndicator, { backgroundColor: C.success }]} /><Text style={s.dispoBadgeTxt}>Disponible</Text></View>
              : <View style={[s.dispoBadge, { backgroundColor: C.bgAlt }]}><View style={[s.dispoIndicator, { backgroundColor: C.muted }]} /><Text style={[s.dispoBadgeTxt, { color: C.muted }]}>Occupé</Text></View>
            }
          </View>

          <View style={s.sheetMeta}>
            <SheetMeta iconName="star-outline" label={`${selected.rating} (${selected.nb_courses})`} />
            <SheetMeta iconName="car-sport-outline" label={`${selected.distance_km} km`} />
            {routeKm && <SheetMeta iconName="resize-outline" label={fmtKm(routeKm)} />}
            <SheetMeta iconName="wallet-outline" label={`~${((selected.prix_final ?? selected.prix_estime) / 1000).toFixed(1)}k DA`} />
          </View>

          {selected.disponible ? (
            <TouchableOpacity style={s.sendBtn} onPress={() => envoyerDemande(selected)} activeOpacity={0.88}>
              <Ionicons name="send-outline" size={18} color="#FFFFFF" style={{ marginRight: 9 }} />
              <Text style={s.sendBtnTxt}>Demander ce chauffeur</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.occupeMsg}>
              <Ionicons name="lock-closed-outline" size={14} color={C.muted} style={{ marginRight: 7 }} />
              <Text style={s.occupeMsgTxt}>Ce chauffeur est en course — choisis-en un autre</Text>
            </View>
          )}

          <TouchableOpacity
            style={s.profileBtn}
            onPress={() => Alert.alert(
              selected.nom,
              `${VEH_LABEL[selected.vehicule]}\n★ ${selected.rating} · ${selected.nb_courses} courses\n${selected.telephone}`,
            )}
          >
            <Text style={s.profileBtnTxt}>Voir le profil</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => setSelected(null)} style={s.closeSheet}>
            <Text style={s.closeSheetTxt}>Fermer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Overlay attente */}
      {phase === 'waiting' && selected && (
        <View style={s.waitOverlay}>
          <View style={s.waitCard}>
            <ActivityIndicator size="large" color={C.primary} style={{ marginBottom: 16 }} />
            <Text style={s.waitLabel}>Demande envoyée à</Text>
            <Text style={s.waitNom}>{selected.nom}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
              <Ionicons name={VEH_ICON[selected.vehicule] || 'car-sport-outline'} size={14} color={C.muted} />
              <Text style={s.waitVeh}>{VEH_LABEL[selected.vehicule]}</Text>
            </View>
            <View style={s.waitRoute}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.routeDot, { backgroundColor: C.success }]} />
                <Text style={s.waitRouteTxt}>{depart}</Text>
              </View>
              <Ionicons name="arrow-down" size={16} color={C.accent} style={{ marginVertical: 3 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[s.routeDot, { backgroundColor: C.error }]} />
                <Text style={s.waitRouteTxt}>{arrivee}</Text>
              </View>
            </View>
            <View style={s.countdownBox}>
              <Text style={s.countdownLabel}>Temps restant</Text>
              <Text style={[s.countdownVal, countdown < 30 && { color: C.error }]}>{fmtTimer(countdown)}</Text>
              <View style={s.countdownBar}>
                <View style={[s.countdownFill, { width: `${(countdown / 120) * 100}%`, backgroundColor: countdown < 30 ? C.error : C.primary }]} />
              </View>
            </View>
            <Text style={s.waitHint}>Le chauffeur a 2 minutes pour accepter ou refuser.</Text>
            <TouchableOpacity style={s.cancelWaitBtn} onPress={annulerAttente}>
              <Text style={s.cancelWaitTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Overlay refus */}
      {phase === 'refused' && (
        <View style={s.waitOverlay}>
          <View style={[s.waitCard, { borderColor: C.error, borderWidth: 1.5 }]}>
            <View style={s.refusedIconBox}><Ionicons name="close-circle" size={48} color={C.error} /></View>
            <Text style={[s.waitNom, { color: C.error }]}>Demande refusée</Text>
            <Text style={s.waitHint}>
              Ce chauffeur n'est pas disponible.{'\n'}
              Reviens à la carte pour en choisir un autre.
            </Text>
          </View>
        </View>
      )}

      {/* Liste mini transporteurs */}
      {phase === 'map' && !selected && (
        <View style={s.bottomList}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={[s.legendDot, { backgroundColor: C.success, width: 9, height: 9 }]} />
            <Text style={s.bottomListTitle}>
              {disponibles.length} chauffeur{disponibles.length !== 1 ? 's' : ''} disponible{disponibles.length !== 1 ? 's' : ''} autour de toi
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {disponibles.map(t => (
              <TouchableOpacity key={t.id} style={s.miniCard} onPress={() => setSelected(t)} activeOpacity={0.85}>
                <View style={[s.miniIconBox, { backgroundColor: VEH_COLOR[t.vehicule] ? `${VEH_COLOR[t.vehicule]}1A` : C.bg }]}>
                  <Ionicons name={VEH_ICON[t.vehicule] || 'car-sport-outline'} size={22} color={VEH_COLOR[t.vehicule] || C.primary} />
                </View>
                <Text style={s.miniNom}>{t.nom.split(' ')[0]}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="star" size={10} color={C.warning} />
                  <Text style={s.miniMeta}>{t.rating}</Text>
                </View>
                <Text style={s.miniMeta}>{t.distance_km} km</Text>
                <Text style={s.miniPrix}>~{(t.prix_final / 1000).toFixed(1)}k DA</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  fullCenter:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgAlt, padding: 24 },
  loadingTxt:    { fontSize: 15, fontWeight: '700', color: C.text, marginTop: 16 },
  loadingTxt2:   { fontSize: 13, color: C.muted },
  errorIconBox:  { width: 72, height: 72, borderRadius: 36, backgroundColor: C.errorLight, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  errorTitle:    { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  errorDesc:     { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  retryBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accent, borderRadius: 50, paddingHorizontal: 24, paddingVertical: 13, marginBottom: 12 },
  retryTxt:      { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  backLink:      { flexDirection: 'row', alignItems: 'center', padding: 10 },
  backLinkTxt:   { color: C.muted, fontWeight: '600', fontSize: 14 },

  pbBar: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.96)', paddingTop: Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) },

  noPermBanner:  { position: 'absolute', top: Platform.OS === 'ios' ? 130 + PB_OFFSET : (StatusBar.currentHeight || 24) + 84 + PB_OFFSET, left: 12, right: 12, backgroundColor: 'rgba(255,253,235,0.97)', borderRadius: 14, borderWidth: 1.5, borderColor: '#FCD34D', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  noPermTxt:     { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E', lineHeight: 18 },
  noPermBtn:     { backgroundColor: C.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  noPermBtnTxt:  { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  header:        { position: 'absolute', top: Platform.OS === 'ios' ? 56 + PB_OFFSET : (StatusBar.currentHeight || 24) + 8 + PB_OFFSET, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, gap: 10 },
  backBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },
  headerCenter:  { flex: 1 },
  headerTitle:   { fontSize: 14, fontWeight: '800', color: C.text },
  headerSub:     { fontSize: 11, color: C.muted },
  refreshMapBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },

  legend:        { position: 'absolute', top: Platform.OS === 'ios' ? 126 + PB_OFFSET : (StatusBar.currentHeight || 24) + 78 + PB_OFFSET, right: 12, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 12, padding: 10, elevation: 4, gap: 6 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:     { width: 10, height: 10, borderRadius: 5 },
  legendTxt:     { fontSize: 12, fontWeight: '600', color: C.text },
  legendHint:    { fontSize: 10, color: C.muted, marginTop: 4, textAlign: 'center' },

  sheet:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 10 },
  sheetHandle:   { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTop:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sheetAvatar:   { width: 50, height: 50, borderRadius: 25, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' },
  sheetAvatarTxt:{ fontSize: 17, fontWeight: '900', color: C.accent },
  sheetNom:      { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 2 },
  sheetVeh:      { fontSize: 13, color: C.muted },
  dispoBadge:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.successLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dispoIndicator:{ width: 7, height: 7, borderRadius: 4 },
  dispoBadgeTxt: { fontSize: 12, fontWeight: '700', color: C.success },
  sheetMeta:     { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: C.bgAlt, borderRadius: 12, paddingVertical: 14, marginBottom: 16 },
  sendBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, borderRadius: 50, paddingVertical: 16, marginBottom: 10 },
  sendBtnTxt:    { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  occupeMsg:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgAlt, borderRadius: 12, paddingVertical: 13, marginBottom: 10, paddingHorizontal: 12 },
  occupeMsgTxt:  { fontSize: 13, color: C.muted, fontWeight: '600' },
  profileBtn:    { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border, borderRadius: 50, paddingVertical: 13 },
  profileBtnTxt: { fontSize: 14, fontWeight: '700', color: C.text },
  closeSheet:    { alignItems: 'center', paddingTop: 6 },
  closeSheetTxt: { fontSize: 14, color: C.muted, fontWeight: '600' },

  waitOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  waitCard:      { backgroundColor: C.bg, borderRadius: 24, padding: 26, width: '100%', alignItems: 'center', elevation: 10 },
  waitLabel:     { fontSize: 13, color: C.muted, fontWeight: '600', marginBottom: 4 },
  waitNom:       { fontSize: 22, fontWeight: '900', color: C.text, marginBottom: 4 },
  waitVeh:       { fontSize: 14, color: C.muted },
  waitRoute:     { backgroundColor: C.bgAlt, borderRadius: 12, padding: 14, width: '100%', alignItems: 'flex-start', marginBottom: 16, gap: 2 },
  routeDot:      { width: 10, height: 10, borderRadius: 5 },
  waitRouteTxt:  { fontSize: 14, fontWeight: '700', color: C.text },
  waitHint:      { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19, marginTop: 10, marginBottom: 14 },
  countdownBox:  { width: '100%', alignItems: 'center', marginBottom: 10 },
  countdownLabel:{ fontSize: 11, color: C.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  countdownVal:  { fontSize: 38, fontWeight: '900', color: C.primary, fontVariant: ['tabular-nums'] },
  countdownBar:  { width: '100%', height: 5, backgroundColor: C.border, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  countdownFill: { height: '100%', borderRadius: 3 },
  cancelWaitBtn: { borderWidth: 1.5, borderColor: C.border, borderRadius: 50, paddingHorizontal: 28, paddingVertical: 11 },
  cancelWaitTxt: { color: C.muted, fontWeight: '700', fontSize: 14 },
  refusedIconBox:{ marginBottom: 12 },

  bottomList:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.97)', paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 34 : 14, paddingLeft: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 10 },
  bottomListTitle: { fontSize: 13, fontWeight: '700', color: C.text },
  miniCard:        { backgroundColor: C.bgAlt, borderRadius: 14, padding: 14, alignItems: 'center', width: 104, borderWidth: 1.5, borderColor: C.border, gap: 4 },
  miniIconBox:     { width: 40, height: 40, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  miniNom:         { fontSize: 12, fontWeight: '800', color: C.text },
  miniMeta:        { fontSize: 11, color: C.muted },
  miniPrix:        { fontSize: 12, fontWeight: '700', color: C.primary },

  acceptedCard:    { backgroundColor: C.bg, borderRadius: 24, padding: 24, width: '100%', alignItems: 'center', elevation: 4 },
  acceptedIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  acceptedTitle:   { fontSize: 22, fontWeight: '900', color: C.success, marginBottom: 18 },
  transporteurCard:{ flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%', backgroundColor: C.bgAlt, borderRadius: 16, padding: 16, marginBottom: 14 },
  tAvatar:         { width: 50, height: 50, borderRadius: 25, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' },
  tAvatarTxt:      { fontSize: 16, fontWeight: '900', color: C.accent },
  tNom:            { fontSize: 16, fontWeight: '800', color: C.text },
  tVeh:            { fontSize: 13, color: C.muted },
  tRating:         { fontSize: 12, color: C.muted },
  routeRecap:      { backgroundColor: C.bgAlt, borderRadius: 12, padding: 14, width: '100%', marginBottom: 14, gap: 8 },
  routeRecapTxt:   { fontSize: 14, fontWeight: '700', color: C.text },
  phoneCard:       { backgroundColor: C.successLight, borderRadius: 16, padding: 16, width: '100%', alignItems: 'center', marginBottom: 14, borderWidth: 1.5, borderColor: '#6EE7B7' },
  phoneLabel:      { fontSize: 11, color: C.success, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  phoneNumber:     { fontSize: 26, fontWeight: '900', color: C.success, letterSpacing: 1, marginVertical: 4 },
  phoneSub:        { fontSize: 12, color: C.success, marginTop: 2 },
  prixEstime:      { fontSize: 14, fontWeight: '700', color: C.muted },
  doneBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.accent, borderRadius: 50, paddingVertical: 16, paddingHorizontal: 32 },
  doneBtnTxt:      { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
