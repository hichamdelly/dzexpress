import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  StatusBar, ActivityIndicator, Alert, Dimensions, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useApp, localNotif } from '../src/context/AppContext';
import { demandesDB, notifDB } from '../src/db/database';
import {
  genererTransporteurs, simulerReponse, simulerMouvement,
  fmtDistance, fmtTimer,
} from '../src/simulation/transporteurs';
import { getDistanceKm, fmtKm } from '../src/utils/wilayas';

const ALGER = { latitude: 36.737, longitude: 3.087 };

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
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

// ── Marqueur transporteur ────────────────────────────────────
function TransporteurMarker({ t, selected, onPress }) {
  const bg = t.disponible ? (selected ? C.accent : C.success) : '#9CA3AF';
  return (
    <Marker
      coordinate={{ latitude: t.latitude, longitude: t.longitude }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <View style={[mk.container, { backgroundColor: bg, borderColor: selected ? '#FFFFFF' : bg }]}>
        <Ionicons name={VEH_ICON[t.vehicule] || 'car-sport-outline'} size={18} color="#FFFFFF" />
      </View>
      {selected && <View style={mk.pulse} />}
    </Marker>
  );
}
const mk = StyleSheet.create({
  container: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 3, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  pulse:     { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(249,115,22,0.18)', top: -7, left: -7 },
});

// ── Marqueur Ma position ─────────────────────────────────────
function MaPositionMarker({ coord }) {
  return (
    <Marker coordinate={coord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <View style={mp.outer}><View style={mp.inner} /></View>
    </Marker>
  );
}
const mp = StyleSheet.create({
  outer: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(249,115,22,0.22)', alignItems: 'center', justifyContent: 'center' },
  inner: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.accent, borderWidth: 2, borderColor: '#FFFFFF' },
});

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
export default function CarteTransporteursScreen() {
  const router  = useRouter();
  const { user } = useApp();
  const params  = useLocalSearchParams();
  const { depart, arrivee, type, poids, desc } = params;
  const routeKm = getDistanceKm(depart, arrivee);

  const mapRef          = useRef(null);
  const cancelSimRef    = useRef(null);
  const moveIntervalRef = useRef(null);

  const [phase, setPhase]               = useState('loading');
  const [myPos, setMyPos]               = useState(null);
  const [noPermission, setNoPermission] = useState(false);
  const [locationErr, setLocationErr]   = useState(null);
  const [transporteurs, setTransporteurs] = useState([]);
  const [selected, setSelected]         = useState(null);
  const [countdown, setCountdown]       = useState(120);
  const [acceptedT, setAcceptedT]       = useState(null);
  const [demandeId, setDemandeId]       = useState(null);

  const chargerPosition = useCallback(async () => {
    setPhase('loading');
    setNoPermission(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let latitude, longitude;
      if (status !== 'granted') {
        latitude = ALGER.latitude; longitude = ALGER.longitude;
        setNoPermission(true);
      } else {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = pos.coords.latitude; longitude = pos.coords.longitude;
      }
      setMyPos({ latitude, longitude });
      setTransporteurs(genererTransporteurs(latitude, longitude, 8, routeKm));
      setPhase('map');
      setTimeout(() => {
        mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 }, 800);
      }, 400);
    } catch {
      setLocationErr('GPS indisponible. Vérifie que la localisation est activée.');
      setPhase('error');
    }
  }, [routeKm]);

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

  const envoyerDemande = (t) => {
    if (!t.disponible) {
      Alert.alert('Transporteur occupé', 'Ce transporteur est actuellement en course. Choisis-en un autre.');
      return;
    }
    setSelected(t);
    setPhase('waiting');
    const id = demandesDB.createMaintenant({
      expediteur_id: user.id, ville_depart: depart, ville_arrivee: arrivee,
      type_marchandise: type, poids: poids || null, description: desc || null, transporteur_simule: t,
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
  };

  const handleRefus = (reason) => {
    cancelSimRef.current?.();
    if (demandeId) demandesDB.updateStatut(demandeId, 'annulee');
    localNotif(user.id, `${selected?.nom || 'Le transporteur'} n'est pas disponible — choisis-en un autre sur la carte.`);
    setPhase('refused');
    setDemandeId(null);
    setTimeout(() => {
      setTransporteurs(prev => prev.map(t => t.id === selected?.id ? { ...t, disponible: false } : t));
      setSelected(null);
      setPhase('map');
    }, 2500);
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
      <ActivityIndicator size="large" color={C.primary} />
      <Text style={s.loadingTxt}>Recherche des transporteurs près de toi…</Text>
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
          <Text style={s.prixEstime}>Prix estimé · ~{acceptedT.prix_estime.toLocaleString()} DA</Text>
        </View>

        <TouchableOpacity style={s.doneBtn} onPress={() => router.replace('/(tabs)/suivi')}>
          <Text style={s.doneBtnTxt}>Voir mes demandes</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const disponibles = transporteurs.filter(t => t.disponible);
  const occupes     = transporteurs.filter(t => !t.disponible);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      {myPos && (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={{ latitude: myPos.latitude, longitude: myPos.longitude, latitudeDelta: 0.06, longitudeDelta: 0.06 }}
          showsCompass showsScale
        >
          <Circle center={myPos} radius={5000} strokeColor="rgba(10,10,10,0.15)" fillColor="rgba(10,10,10,0.03)" strokeWidth={1} />
          <MaPositionMarker coord={myPos} />
          {transporteurs.map(t => (
            <TransporteurMarker key={`${t.id}-${t.moveKey || 0}`} t={t} selected={selected?.id === t.id} onPress={() => phase === 'map' && setSelected(t)} />
          ))}
        </MapView>
      )}

      {/* Header flottant */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => phase === 'map' ? router.back() : annulerAttente()}>
          <Ionicons name="arrow-back" size={18} color={C.text} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Choisir un transporteur</Text>
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
      </View>

      {/* Bannière permission refusée */}
      {phase === 'map' && noPermission && (
        <View style={s.noPermBanner}>
          <Ionicons name="location-outline" size={20} color={C.warning} />
          <Text style={s.noPermTxt}>Activez la géolocalisation pour voir les transporteurs près de vous</Text>
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

      {/* Bottom sheet — sélection transporteur */}
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
            <SheetMeta iconName="car-sport-outline" label={`${fmtDistance(selected.distance_m)}`} />
            {routeKm && <SheetMeta iconName="resize-outline" label={fmtKm(routeKm)} />}
            <SheetMeta iconName="wallet-outline" label={`~${(selected.prix_estime / 1000).toFixed(1)}k DA`} />
          </View>

          {selected.disponible ? (
            <TouchableOpacity style={s.sendBtn} onPress={() => envoyerDemande(selected)} activeOpacity={0.88}>
              <Ionicons name="send-outline" size={18} color="#FFFFFF" style={{ marginRight: 9 }} />
              <Text style={s.sendBtnTxt}>Envoyer la demande à {selected.nom.split(' ')[0]}</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.occupeMsg}>
              <Ionicons name="lock-closed-outline" size={14} color={C.muted} style={{ marginRight: 7 }} />
              <Text style={s.occupeMsgTxt}>Ce transporteur est en course — choisis-en un autre</Text>
            </View>
          )}

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
            <Text style={s.waitHint}>Le transporteur a 2 minutes pour accepter ou refuser.</Text>
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
              Ce transporteur n'est pas disponible.{'\n'}
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
              {disponibles.length} transporteur{disponibles.length !== 1 ? 's' : ''} disponible{disponibles.length !== 1 ? 's' : ''} autour de toi
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {transporteurs.filter(t => t.disponible).map(t => (
              <TouchableOpacity key={t.id} style={s.miniCard} onPress={() => setSelected(t)} activeOpacity={0.85}>
                <View style={s.miniIconBox}>
                  <Ionicons name={VEH_ICON[t.vehicule] || 'car-sport-outline'} size={22} color={C.primary} />
                </View>
                <Text style={s.miniNom}>{t.nom.split(' ')[0]}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Ionicons name="star" size={10} color={C.warning} />
                  <Text style={s.miniMeta}>{t.rating}</Text>
                </View>
                <Text style={s.miniMeta}>{fmtDistance(t.distance_m)}</Text>
                <Text style={s.miniPrix}>~{(t.prix_estime / 1000).toFixed(1)}k DA</Text>
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
  retryBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, borderRadius: 50, paddingHorizontal: 24, paddingVertical: 13, marginBottom: 12 },
  retryTxt:      { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  backLink:      { flexDirection: 'row', alignItems: 'center', padding: 10 },
  backLinkTxt:   { color: C.muted, fontWeight: '600', fontSize: 14 },

  noPermBanner:  { position: 'absolute', top: Platform.OS === 'ios' ? 130 : (StatusBar.currentHeight || 24) + 84, left: 12, right: 12, backgroundColor: 'rgba(255,253,235,0.97)', borderRadius: 14, borderWidth: 1.5, borderColor: '#FCD34D', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  noPermTxt:     { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E', lineHeight: 18 },
  noPermBtn:     { backgroundColor: C.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7 },
  noPermBtnTxt:  { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },

  header:        { position: 'absolute', top: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 8, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8, gap: 10 },
  backBtn:       { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },
  headerCenter:  { flex: 1 },
  headerTitle:   { fontSize: 14, fontWeight: '800', color: C.text },
  headerSub:     { fontSize: 11, color: C.muted },
  refreshMapBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },

  legend:        { position: 'absolute', top: Platform.OS === 'ios' ? 126 : (StatusBar.currentHeight || 24) + 78, right: 12, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 12, padding: 10, elevation: 4, gap: 6 },
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
  sendBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 16, marginBottom: 10 },
  sendBtnTxt:    { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  occupeMsg:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgAlt, borderRadius: 12, paddingVertical: 13, marginBottom: 10, paddingHorizontal: 12 },
  occupeMsgTxt:  { fontSize: 13, color: C.muted, fontWeight: '600' },
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
  doneBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 16, paddingHorizontal: 32 },
  doneBtnTxt:      { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
