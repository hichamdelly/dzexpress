import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  StatusBar, ActivityIndicator, Alert, Dimensions, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Circle, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { useApp, localNotif } from '../src/context/AppContext';
import { demandesDB, notifDB } from '../src/db/database';
import {
  genererTransporteurs, simulerReponse, simulerMouvement,
  fmtDistance, fmtTimer,
} from '../src/simulation/transporteurs';
import { getDistanceKm, fmtKm } from '../src/utils/wilayas';

const { width: W, height: H } = Dimensions.get('window');

// Centre de repli si géolocalisation refusée
const ALGER = { latitude: 36.737, longitude: 3.087 };

const C = {
  blue:        '#1A56DB',
  blueLight:   '#EBF5FF',
  blueDark:    '#1E40AF',
  orange:      '#F97316',
  bg:          '#F8FAFC',
  white:       '#FFFFFF',
  text:        '#1E293B',
  muted:       '#64748B',
  border:      '#E2E8F0',
  green:       '#16A34A',
  greenLight:  '#F0FDF4',
  red:         '#DC2626',
  redLight:    '#FEF2F2',
  yellow:      '#D97706',
  dark:        'rgba(0,0,0,0.55)',
};

const VEH_ICON  = { fourgon: '🚐', camion35: '🚛', camion10: '🚚', semi: '🏗️' };
const VEH_LABEL = { fourgon: 'Fourgon', camion35: 'Camion 3.5T', camion10: 'Camion 10T', semi: 'Semi-remorque' };

// ── Marqueur transporteur ────────────────────────────────────
function TransporteurMarker({ t, selected, onPress }) {
  const bg = t.disponible ? (selected ? C.blue : C.green) : '#9CA3AF';
  return (
    <Marker
      coordinate={{ latitude: t.latitude, longitude: t.longitude }}
      onPress={onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={false}
    >
      <View style={[mk.container, { backgroundColor: bg, borderColor: selected ? C.white : bg }]}>
        <Text style={mk.icon}>{VEH_ICON[t.vehicule] || '🚛'}</Text>
      </View>
      {selected && <View style={mk.pulse} />}
    </Marker>
  );
}
const mk = StyleSheet.create({
  container: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 3, elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  icon:      { fontSize: 20 },
  pulse:     { position: 'absolute', width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(26,86,219,0.15)', top: -7, left: -7 },
});

// ── Marqueur "Ma position" ───────────────────────────────────
function MaPositionMarker({ coord }) {
  return (
    <Marker coordinate={coord} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
      <View style={mp.outer}>
        <View style={mp.inner} />
      </View>
    </Marker>
  );
}
const mp = StyleSheet.create({
  outer: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(249,115,22,0.25)', alignItems: 'center', justifyContent: 'center' },
  inner: { width: 12, height: 12, borderRadius: 6, backgroundColor: C.orange, borderWidth: 2, borderColor: C.white },
});

// ════════════════════════════════════════════════════════════
export default function CarteTransporteursScreen() {
  const router  = useRouter();
  const { user } = useApp();
  const params  = useLocalSearchParams();

  const { depart, arrivee, type, poids, desc } = params;
  const routeKm = getDistanceKm(depart, arrivee);

  const mapRef        = useRef(null);
  const cancelSimRef  = useRef(null);
  const moveIntervalRef = useRef(null);

  // États
  const [phase, setPhase]               = useState('loading'); // loading|map|waiting|accepted|refused|error
  const [myPos, setMyPos]               = useState(null);
  const [noPermission, setNoPermission] = useState(false);
  const [locationErr, setLocationErr]   = useState(null);
  const [transporteurs, setTransporteurs] = useState([]);
  const [selected, setSelected]         = useState(null);
  const [countdown, setCountdown]       = useState(120);
  const [acceptedT, setAcceptedT]       = useState(null);
  const [demandeId, setDemandeId]       = useState(null);

  // ── Chargement position ──────────────────────────────────
  const chargerPosition = useCallback(async () => {
    setPhase('loading');
    setNoPermission(false);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      let latitude, longitude;

      if (status !== 'granted') {
        // Permission refusée : carte centrée sur Alger, message d'info
        latitude  = ALGER.latitude;
        longitude = ALGER.longitude;
        setNoPermission(true);
      } else {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude  = pos.coords.latitude;
        longitude = pos.coords.longitude;
      }

      setMyPos({ latitude, longitude });
      const list = genererTransporteurs(latitude, longitude, 8, routeKm);
      setTransporteurs(list);
      setPhase('map');

      setTimeout(() => {
        mapRef.current?.animateToRegion({
          latitude, longitude,
          latitudeDelta: 0.06, longitudeDelta: 0.06,
        }, 800);
      }, 400);
    } catch (e) {
      setLocationErr('GPS indisponible. Vérifie que la localisation est activée.');
      setPhase('error');
    }
  }, [routeKm]);

  useEffect(() => { chargerPosition(); }, []);

  // ── Countdown ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'waiting') return;
    setCountdown(120);
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(interval);
          // Timeout → refus automatique
          handleRefus('Temps écoulé');
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  // ── Mouvement toutes les 30 s (phase map uniquement) ────
  useEffect(() => {
    if (phase !== 'map') {
      clearInterval(moveIntervalRef.current);
      return;
    }
    moveIntervalRef.current = setInterval(() => {
      setTransporteurs(prev => simulerMouvement(prev));
    }, 30_000);
    return () => clearInterval(moveIntervalRef.current);
  }, [phase]);

  // ── Nettoyage simulation ─────────────────────────────────
  useEffect(() => () => {
    cancelSimRef.current?.();
    clearInterval(moveIntervalRef.current);
  }, []);

  // ── Envoyer la demande ───────────────────────────────────
  const envoyerDemande = (t) => {
    if (!t.disponible) {
      Alert.alert('Transporteur occupé', 'Ce transporteur est actuellement en course. Choisis-en un autre.');
      return;
    }
    setSelected(t);
    setPhase('waiting');

    // Créer la demande dans SQLite
    const id = demandesDB.createMaintenant({
      expediteur_id:      user.id,
      ville_depart:       depart,
      ville_arrivee:      arrivee,
      type_marchandise:   type,
      poids:              poids || null,
      description:        desc || null,
      transporteur_simule: t,
    });
    setDemandeId(id);

    // Notification locale — simulation de l'alerte au transporteur
    localNotif(user.id, `🚀 Demande envoyée à ${t.nom} — en attente de réponse…`);

    // Simuler la réponse
    cancelSimRef.current = simulerReponse(
      () => handleAccept(t, id),
      () => handleRefus('refusé'),
    );
  };

  const handleAccept = (t, id) => {
    demandesDB.updateStatut(id, 'acceptee');
    notifDB.create(user.id, `✅ ${t.nom} a accepté ta demande ${depart} → ${arrivee} !`);
    setAcceptedT(t);
    setPhase('accepted');
  };

  const handleRefus = (reason) => {
    cancelSimRef.current?.();
    if (demandeId) {
      demandesDB.updateStatut(demandeId, 'annulee');
    }
    localNotif(user.id, `❌ ${selected?.nom || 'Le transporteur'} n'est pas disponible — choisis-en un autre sur la carte.`);
    setPhase('refused');
    setDemandeId(null);
    setTimeout(() => {
      // Marque le transporteur refuseur comme occupé
      setTransporteurs(prev =>
        prev.map(t => t.id === selected?.id ? { ...t, disponible: false } : t)
      );
      setSelected(null);
      setPhase('map');
    }, 2500);
  };

  // ── Annuler l'attente ────────────────────────────────────
  const annulerAttente = () => {
    cancelSimRef.current?.();
    if (demandeId) demandesDB.updateStatut(demandeId, 'annulee');
    setSelected(null);
    setDemandeId(null);
    setPhase('map');
  };

  // ── Render ───────────────────────────────────────────────

  // Phase loading
  if (phase === 'loading') return (
    <View style={s.fullCenter}>
      <StatusBar barStyle="dark-content" />
      <ActivityIndicator size="large" color={C.blue} />
      <Text style={s.loadingTxt}>Recherche des transporteurs près de toi…</Text>
      <Text style={s.loadingTxt2}>📍 Localisation en cours</Text>
    </View>
  );

  // Phase error
  if (phase === 'error') return (
    <View style={s.fullCenter}>
      <Text style={{ fontSize: 48, marginBottom: 14 }}>📍</Text>
      <Text style={s.errorTitle}>Localisation impossible</Text>
      <Text style={s.errorDesc}>{locationErr}</Text>
      <TouchableOpacity style={s.retryBtn} onPress={chargerPosition}>
        <Text style={s.retryTxt}>Réessayer</Text>
      </TouchableOpacity>
      <TouchableOpacity style={s.backLink} onPress={() => router.back()}>
        <Text style={s.backLinkTxt}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );

  // Phase accepted
  if (phase === 'accepted' && acceptedT) return (
    <View style={s.fullCenter}>
      <StatusBar barStyle="dark-content" />
      <View style={s.acceptedCard}>
        <Text style={{ fontSize: 64, marginBottom: 12 }}>🎉</Text>
        <Text style={s.acceptedTitle}>Labès ! Demande acceptée !</Text>

        <View style={s.transporteurCard}>
          <View style={s.tAvatar}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: C.blue }}>
              {acceptedT.nom.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.tNom}>{acceptedT.nom}</Text>
            <Text style={s.tVeh}>{VEH_ICON[acceptedT.vehicule]} {VEH_LABEL[acceptedT.vehicule]}</Text>
            <Text style={s.tRating}>⭐ {acceptedT.rating} · {acceptedT.nb_courses} courses</Text>
          </View>
        </View>

        <View style={s.routeRecap}>
          <Text style={s.routeRecapTxt}>📍 {depart}</Text>
          <Text style={s.routeRecapArrow}>↓ {VEH_ICON[acceptedT.vehicule]}</Text>
          <Text style={s.routeRecapTxt}>🎯 {arrivee}</Text>
        </View>

        <View style={s.phoneCard}>
          <Text style={s.phoneLabel}>📞 Son numéro de téléphone</Text>
          <Text style={s.phoneNumber}>{acceptedT.telephone}</Text>
          <Text style={s.phoneSub}>Contacte-le pour coordonner la livraison</Text>
        </View>

        <Text style={[s.prixEstime]}>💰 Prix estimé : ~{acceptedT.prix_estime.toLocaleString()} DA</Text>

        <TouchableOpacity
          style={s.doneBtn}
          onPress={() => router.replace('/(tabs)/suivi')}
        >
          <Text style={s.doneBtnTxt}>Voir mes demandes →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const disponibles = transporteurs.filter(t => t.disponible);
  const occupes     = transporteurs.filter(t => !t.disponible);

  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="dark-content" />

      {/* ── CARTE ── */}
      {myPos && (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          initialRegion={{
            latitude:      myPos.latitude,
            longitude:     myPos.longitude,
            latitudeDelta: 0.06,
            longitudeDelta: 0.06,
          }}
          showsCompass
          showsScale
        >
          {/* Cercle de rayon */}
          <Circle
            center={myPos}
            radius={5000}
            strokeColor="rgba(26,86,219,0.3)"
            fillColor="rgba(26,86,219,0.05)"
            strokeWidth={1}
          />

          {/* Ma position */}
          <MaPositionMarker coord={myPos} />

          {/* Transporteurs — clé inclut moveKey pour forcer la mise à jour de position */}
          {transporteurs.map(t => (
            <TransporteurMarker
              key={`${t.id}-${t.moveKey || 0}`}
              t={t}
              selected={selected?.id === t.id}
              onPress={() => phase === 'map' && setSelected(t)}
            />
          ))}
        </MapView>
      )}

      {/* ── HEADER ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => phase === 'map' ? router.back() : annulerAttente()}>
          <Text style={s.backBtnTxt}>← Retour</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>Choisir un transporteur</Text>
          <Text style={s.headerSub} numberOfLines={1}>
            📍 {depart} → 🎯 {arrivee}{routeKm ? `  ·  📏 ${fmtKm(routeKm)}` : ''}
          </Text>
        </View>
        <TouchableOpacity style={s.refreshMapBtn} onPress={chargerPosition}>
          <Text style={{ fontSize: 18 }}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* ── BANNIÈRE PERMISSION REFUSÉE ── */}
      {phase === 'map' && noPermission && (
        <View style={s.noPermBanner}>
          <Text style={s.noPermIcon}>📍</Text>
          <Text style={s.noPermTxt}>
            Activez la géolocalisation pour voir les transporteurs près de vous
          </Text>
          <TouchableOpacity style={s.noPermBtn} onPress={chargerPosition}>
            <Text style={s.noPermBtnTxt}>Activer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── LÉGENDE ── */}
      {phase === 'map' && (
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: C.green }]} />
            <Text style={s.legendTxt}>{disponibles.length} disponible{disponibles.length !== 1 ? 's' : ''}</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: '#9CA3AF' }]} />
            <Text style={s.legendTxt}>{occupes.length} occupé{occupes.length !== 1 ? 's' : ''}</Text>
          </View>
          <Text style={s.legendHint}>Appuie sur un marqueur</Text>
        </View>
      )}

      {/* ── BOTTOM SHEET : sélection ── */}
      {phase === 'map' && selected && (
        <View style={s.sheet}>
          <View style={s.sheetHandle} />

          <View style={s.sheetTop}>
            <View style={s.sheetAvatar}>
              <Text style={{ fontSize: 17, fontWeight: '900', color: selected.disponible ? C.blue : C.muted }}>
                {selected.nom.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.sheetNom}>{selected.nom}</Text>
              <Text style={s.sheetVeh}>{VEH_ICON[selected.vehicule]} {VEH_LABEL[selected.vehicule]}</Text>
            </View>
            {selected.disponible
              ? <View style={s.dispoBadge}><Text style={s.dispoBadgeTxt}>🟢 Dispo</Text></View>
              : <View style={[s.dispoBadge, { backgroundColor: '#F3F4F6' }]}><Text style={[s.dispoBadgeTxt, { color: C.muted }]}>🔴 Occupé</Text></View>
            }
          </View>

          <View style={s.sheetMeta}>
            <SheetMeta icon="⭐" label={`${selected.rating} (${selected.nb_courses} courses)`} />
            <SheetMeta icon="🛞" label={`À ${fmtDistance(selected.distance_m)}`} />
            {routeKm && <SheetMeta icon="📏" label={`Trajet ${fmtKm(routeKm)}`} />}
            <SheetMeta icon="💰" label={`~${selected.prix_estime.toLocaleString()} DA`} />
          </View>

          {selected.disponible ? (
            <TouchableOpacity
              style={s.sendBtn}
              onPress={() => envoyerDemande(selected)}
              activeOpacity={0.88}
            >
              <Text style={s.sendBtnTxt}>📤 Envoyer la demande à {selected.nom.split(' ')[0]}</Text>
            </TouchableOpacity>
          ) : (
            <View style={s.occupeMsg}>
              <Text style={s.occupeMsgTxt}>Ce transporteur est en course — choisis-en un autre 🟢</Text>
            </View>
          )}

          <TouchableOpacity onPress={() => setSelected(null)} style={s.closeSheet}>
            <Text style={s.closeSheetTxt}>Fermer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── OVERLAY ATTENTE ── */}
      {phase === 'waiting' && selected && (
        <View style={s.waitOverlay}>
          <View style={s.waitCard}>
            <ActivityIndicator size="large" color={C.blue} style={{ marginBottom: 16 }} />

            <Text style={s.waitTitle}>Demande envoyée à</Text>
            <Text style={s.waitNom}>{selected.nom}</Text>
            <Text style={s.waitVeh}>{VEH_ICON[selected.vehicule]} {VEH_LABEL[selected.vehicule]}</Text>

            <View style={s.waitRoute}>
              <Text style={s.waitRouteTxt}>📍 {depart}</Text>
              <Text style={{ color: C.orange, fontWeight: '700', marginVertical: 2 }}>→</Text>
              <Text style={s.waitRouteTxt}>🎯 {arrivee}</Text>
            </View>

            {/* Countdown */}
            <View style={s.countdownBox}>
              <Text style={s.countdownLabel}>Temps restant</Text>
              <Text style={[s.countdownVal, countdown < 30 && { color: C.red }]}>
                {fmtTimer(countdown)}
              </Text>
              <View style={s.countdownBar}>
                <View style={[s.countdownFill, { width: `${(countdown / 120) * 100}%`, backgroundColor: countdown < 30 ? C.red : C.blue }]} />
              </View>
            </View>

            <Text style={s.waitHint}>
              Le transporteur a 2 minutes pour accepter ou refuser.
            </Text>

            <TouchableOpacity style={s.cancelWaitBtn} onPress={annulerAttente}>
              <Text style={s.cancelWaitTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── OVERLAY REFUS ── */}
      {phase === 'refused' && (
        <View style={s.waitOverlay}>
          <View style={[s.waitCard, { borderColor: C.red, borderWidth: 2 }]}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>😔</Text>
            <Text style={[s.waitTitle, { color: C.red }]}>Demande refusée</Text>
            <Text style={s.waitHint}>
              Ce transporteur n'est pas disponible.{'\n'}
              Reviens à la carte pour en choisir un autre.
            </Text>
          </View>
        </View>
      )}

      {/* ── LISTE transporteurs (si aucun sélectionné) ── */}
      {phase === 'map' && !selected && (
        <View style={s.bottomList}>
          <Text style={s.bottomListTitle}>
            {disponibles.length} transporteur{disponibles.length !== 1 ? 's' : ''} disponible{disponibles.length !== 1 ? 's' : ''} autour de toi
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 16 }}>
            {transporteurs.filter(t => t.disponible).map(t => (
              <TouchableOpacity
                key={t.id}
                style={s.miniCard}
                onPress={() => setSelected(t)}
                activeOpacity={0.85}
              >
                <Text style={{ fontSize: 22 }}>{VEH_ICON[t.vehicule]}</Text>
                <Text style={s.miniNom}>{t.nom.split(' ')[0]}</Text>
                <Text style={s.miniMeta}>⭐ {t.rating}</Text>
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

function SheetMeta({ icon, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Text style={{ fontSize: 16 }}>{icon}</Text>
      <Text style={{ fontSize: 14, color: C.text, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  fullCenter:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  loadingTxt:    { fontSize: 16, fontWeight: '700', color: C.text, marginTop: 16 },
  loadingTxt2:   { fontSize: 13, color: C.muted, marginTop: 6 },
  errorTitle:    { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  errorDesc:     { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  retryBtn:      { backgroundColor: C.blue, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 12, marginBottom: 12 },
  retryTxt:      { color: 'white', fontWeight: '700', fontSize: 15 },
  backLink:      { padding: 10 },
  backLinkTxt:   { color: C.blue, fontWeight: '600', fontSize: 14 },

  // Bannière permission refusée
  noPermBanner:  { position: 'absolute', top: Platform.OS === 'ios' ? 130 : (StatusBar.currentHeight || 24) + 84, left: 12, right: 12, backgroundColor: 'rgba(255,247,237,0.97)', borderRadius: 14, borderWidth: 1.5, borderColor: '#FED7AA', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
  noPermIcon:    { fontSize: 22 },
  noPermTxt:     { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400E', lineHeight: 18 },
  noPermBtn:     { backgroundColor: '#F97316', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  noPermBtnTxt:  { color: 'white', fontSize: 12, fontWeight: '800' },

  // Header flottant
  header:        { position: 'absolute', top: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 8, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 8, gap: 10 },
  backBtn:       { padding: 4 },
  backBtnTxt:    { fontSize: 14, fontWeight: '700', color: C.blue },
  headerCenter:  { flex: 1 },
  headerTitle:   { fontSize: 14, fontWeight: '800', color: C.text },
  headerSub:     { fontSize: 12, color: C.muted, marginTop: 1 },
  refreshMapBtn: { padding: 4 },

  // Légende
  legend:        { position: 'absolute', top: Platform.OS === 'ios' ? 126 : (StatusBar.currentHeight || 24) + 78, right: 12, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 12, padding: 10, elevation: 4, gap: 6 },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:     { width: 10, height: 10, borderRadius: 5 },
  legendTxt:     { fontSize: 12, fontWeight: '600', color: C.text },
  legendHint:    { fontSize: 10, color: C.muted, marginTop: 4, textAlign: 'center' },

  // Bottom sheet sélection
  sheet:         { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: Platform.OS === 'ios' ? 36 : 20, elevation: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 10 },
  sheetHandle:   { width: 36, height: 4, backgroundColor: C.border, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTop:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sheetAvatar:   { width: 50, height: 50, borderRadius: 25, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center' },
  sheetNom:      { fontSize: 17, fontWeight: '800', color: C.text, marginBottom: 3 },
  sheetVeh:      { fontSize: 13, color: C.muted },
  dispoBadge:    { backgroundColor: C.greenLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  dispoBadgeTxt: { fontSize: 12, fontWeight: '700', color: C.green },
  sheetMeta:     { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: C.bg, borderRadius: 14, paddingVertical: 14, marginBottom: 16 },
  sendBtn:       { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 10 },
  sendBtnTxt:    { color: 'white', fontSize: 16, fontWeight: '800' },
  occupeMsg:     { backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
  occupeMsgTxt:  { fontSize: 14, color: C.muted, fontWeight: '600' },
  closeSheet:    { alignItems: 'center', paddingTop: 4 },
  closeSheetTxt: { fontSize: 14, color: C.muted, fontWeight: '600' },

  // Overlay attente
  waitOverlay:   { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: C.dark, alignItems: 'center', justifyContent: 'center', padding: 20 },
  waitCard:      { backgroundColor: C.white, borderRadius: 24, padding: 26, width: '100%', alignItems: 'center', elevation: 10 },
  waitTitle:     { fontSize: 16, color: C.muted, fontWeight: '600', marginBottom: 6 },
  waitNom:       { fontSize: 22, fontWeight: '900', color: C.text, marginBottom: 4 },
  waitVeh:       { fontSize: 15, color: C.muted, marginBottom: 14 },
  waitRoute:     { backgroundColor: C.bg, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 16 },
  waitRouteTxt:  { fontSize: 14, fontWeight: '700', color: C.text },
  waitHint:      { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19, marginTop: 10, marginBottom: 14 },
  countdownBox:  { width: '100%', alignItems: 'center', marginBottom: 10 },
  countdownLabel:{ fontSize: 11, color: C.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  countdownVal:  { fontSize: 36, fontWeight: '900', color: C.blue, fontVariant: ['tabular-nums'] },
  countdownBar:  { width: '100%', height: 6, backgroundColor: C.border, borderRadius: 3, marginTop: 8, overflow: 'hidden' },
  countdownFill: { height: '100%', borderRadius: 3 },
  cancelWaitBtn: { borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 10 },
  cancelWaitTxt: { color: C.muted, fontWeight: '700', fontSize: 14 },

  // Liste mini transporteurs
  bottomList:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.97)', paddingTop: 14, paddingBottom: Platform.OS === 'ios' ? 34 : 14, paddingLeft: 16, borderTopLeftRadius: 20, borderTopRightRadius: 20, elevation: 10 },
  bottomListTitle: { fontSize: 13, fontWeight: '700', color: C.text, marginBottom: 10 },
  miniCard:      { backgroundColor: C.bg, borderRadius: 16, padding: 14, alignItems: 'center', width: 100, borderWidth: 1.5, borderColor: C.border, gap: 3 },
  miniNom:       { fontSize: 12, fontWeight: '800', color: C.text },
  miniMeta:      { fontSize: 11, color: C.muted },
  miniPrix:      { fontSize: 12, fontWeight: '700', color: C.blue },

  // Accepted card
  acceptedCard:  { backgroundColor: C.white, borderRadius: 24, padding: 24, width: '100%', alignItems: 'center', elevation: 4 },
  acceptedTitle: { fontSize: 22, fontWeight: '900', color: C.green, marginBottom: 18 },
  transporteurCard: { flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%', backgroundColor: C.blueLight, borderRadius: 16, padding: 16, marginBottom: 14 },
  tAvatar:       { width: 50, height: 50, borderRadius: 25, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' },
  tNom:          { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 3 },
  tVeh:          { fontSize: 13, color: C.muted },
  tRating:       { fontSize: 12, color: C.muted, marginTop: 2 },
  routeRecap:    { backgroundColor: C.bg, borderRadius: 12, padding: 14, width: '100%', alignItems: 'center', marginBottom: 14, gap: 4 },
  routeRecapTxt: { fontSize: 14, fontWeight: '700', color: C.text },
  routeRecapArrow: { fontSize: 20, color: C.orange },
  phoneCard:     { backgroundColor: C.greenLight, borderRadius: 16, padding: 16, width: '100%', alignItems: 'center', marginBottom: 14, borderWidth: 2, borderColor: '#BBF7D0' },
  phoneLabel:    { fontSize: 12, color: C.green, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  phoneNumber:   { fontSize: 26, fontWeight: '900', color: C.green, letterSpacing: 1 },
  phoneSub:      { fontSize: 12, color: C.green, marginTop: 6 },
  prixEstime:    { fontSize: 14, fontWeight: '700', color: C.muted, marginBottom: 20 },
  doneBtn:       { backgroundColor: C.blue, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, alignItems: 'center' },
  doneBtnTxt:    { color: 'white', fontSize: 16, fontWeight: '800' },
});
