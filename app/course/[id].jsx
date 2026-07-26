import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, ActivityIndicator,
  Alert, Modal, Image, Animated, Easing, Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { demandesDB, offresDB, notifDB, usersDB, annulationsDB, gainsDB, messagesDB } from '../../src/db/database';
import { fmtPrix, partTransporteur } from '../../src/utils/pricing';
import { useApp, localNotif } from '../../src/context/AppContext';
import { NT } from '../../src/lib/notifications';
import { getDistanceKm, fmtKm } from '../../src/utils/wilayas';

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
  warning: '#F59E0B', warningLight: '#FFFBEB',
};

const STATUTS = {
  en_attente: { label: 'En attente',  color: C.warning, bg: C.warningLight, icon: 'time-outline' },
  acceptee:   { label: 'Acceptée',    color: '#1A56DB', bg: '#EBF5FF',      icon: 'checkmark-circle-outline' },
  en_route:   { label: 'En route',    color: C.accent,  bg: C.accentLight,  icon: 'car-sport-outline' },
  en_cours:   { label: 'En cours',    color: C.accent,  bg: C.accentLight,  icon: 'car-sport-outline' },
  livree:     { label: 'Livrée',      color: C.success, bg: C.successLight, icon: 'cube-outline' },
  annulee:    { label: 'Annulée',     color: C.error,   bg: C.errorLight,   icon: 'close-circle-outline' },
};

const TYPES_ICON = {
  meubles: 'grid-outline', electromenager: 'tv-outline', cartons: 'cube-outline',
  materiaux: 'construct-outline', vehicule: 'car-outline', autre: 'ellipsis-horizontal-circle-outline',
};

const RAISONS_ANNULATION = [
  { key: 'mecanique', label: 'Problème mécanique',   icon: 'construct-outline' },
  { key: 'personnel', label: 'Empêchement personnel', icon: 'person-outline' },
  { key: 'erreur',    label: 'Erreur de saisie',      icon: 'pencil-outline' },
  { key: 'autre',     label: 'Autre raison',           icon: 'chatbubble-outline' },
];

// ── Carte GPS ────────────────────────────────────────────────
function LocationMap({ user, status }) {
  const mapRef = useRef(null);
  const [coords, setCoords]         = useState(null);
  const [permStatus, setPermStatus] = useState(null);
  const [locLoading, setLocLoading] = useState(true);
  const [accuracy, setAccuracy]     = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const requestAndLocate = useCallback(async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermStatus(status);
      if (status !== 'granted') { setLocLoading(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude, accuracy: acc } = pos.coords;
      setCoords({ latitude, longitude });
      setAccuracy(acc ? Math.round(acc) : null);
      setLastUpdate(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
      mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 800);
    } catch {
      Alert.alert('Localisation', "Impossible d'obtenir la position GPS.");
    } finally { setLocLoading(false); }
  }, []);

  useEffect(() => { requestAndLocate(); }, []);
  useEffect(() => {
    if (status !== 'en_route') return;
    const interval = setInterval(requestAndLocate, 30_000);
    return () => clearInterval(interval);
  }, [status, requestAndLocate]);

  if (permStatus === 'denied') return (
    <View style={ms.permDenied}>
      <Ionicons name="location-outline" size={28} color={C.error} style={{ marginBottom: 8 }} />
      <Text style={ms.permTitle}>Permission refusée</Text>
      <Text style={ms.permSub}>Active la localisation dans les paramètres pour utiliser la carte.</Text>
      <TouchableOpacity style={ms.retryBtn} onPress={requestAndLocate}>
        <Text style={ms.retryTxt}>Réessayer</Text>
      </TouchableOpacity>
    </View>
  );

  if (locLoading && !coords) return (
    <View style={ms.loading}>
      <ActivityIndicator color={C.primary} size="large" />
      <Text style={ms.loadingTxt}>Localisation en cours…</Text>
    </View>
  );

  if (!coords) return null;

  return (
    <View style={ms.container}>
      <MapView
        ref={mapRef}
        style={ms.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }}
        showsUserLocation={false}
        showsCompass
      >
        <Marker coordinate={coords} title={user?.nom || 'Ma position'} pinColor={C.primary} />
      </MapView>
      <View style={ms.infoOverlay}>
        <View style={ms.infoBadge}>
          <Text style={ms.infoTxt}>{coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</Text>
          {accuracy && <Text style={ms.infoAccuracy}>±{accuracy} m</Text>}
        </View>
      </View>
      <View style={ms.footer}>
        {lastUpdate && <Text style={ms.footerTxt}>Mis à jour à {lastUpdate}</Text>}
        <TouchableOpacity style={[ms.refreshBtn, locLoading && { opacity: 0.6 }]} onPress={requestAndLocate} disabled={locLoading}>
          {locLoading
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <>
                <Ionicons name="refresh-outline" size={13} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={ms.refreshTxt}>Actualiser</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  container:   { borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.border },
  map:         { width: '100%', height: 220 },
  infoOverlay: { position: 'absolute', top: 10, left: 10, right: 10 },
  infoBadge:   { backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  infoTxt:     { fontSize: 11, fontWeight: '700', color: C.text },
  infoAccuracy:{ fontSize: 10, color: C.muted, marginTop: 1 },
  footer:      { backgroundColor: C.bg, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border },
  footerTxt:   { fontSize: 12, color: C.muted, fontWeight: '600' },
  refreshBtn:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 7 },
  refreshTxt:  { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  loading:     { height: 160, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgAlt, borderRadius: 12, gap: 10 },
  loadingTxt:  { fontSize: 14, color: C.muted, fontWeight: '600' },
  permDenied:  { backgroundColor: C.errorLight, borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5' },
  permTitle:   { fontSize: 15, fontWeight: '800', color: C.error, marginBottom: 6 },
  permSub:     { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19, marginBottom: 14 },
  retryBtn:    { backgroundColor: C.error, borderRadius: 50, paddingHorizontal: 18, paddingVertical: 9 },
  retryTxt:    { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});

// ════════════════════════════════════════════════════════════
export default function DetailCourseScreen() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const { user } = useApp();

  const [demande, setDemande]   = useState(null);
  const [myOffer, setMyOffer]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(false);

  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUri, setPhotoUri]             = useState(null);
  const [confirming, setConfirming]         = useState(false);

  const [offrePrix, setOffrePrix]       = useState('');
  const [offreMsg, setOffreMsg]         = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason]   = useState(null);
  const [suspension, setSuspension]           = useState(null);
  const [msgUnread, setMsgUnread]             = useState(0);

  const [showStartModal, setShowStartModal] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  const requestMediaPermission = async (type) => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const takePhoto = async () => {
    if (!(await requestMediaPermission('camera'))) {
      Alert.alert('Permission refusée', "Active l'accès à la caméra dans les paramètres."); return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets?.[0]?.uri) setPhotoUri(result.assets[0].uri);
  };

  const pickFromGallery = async () => {
    if (!(await requestMediaPermission('gallery'))) {
      Alert.alert('Permission refusée', "Active l'accès à la galerie dans les paramètres."); return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets?.[0]?.uri) setPhotoUri(result.assets[0].uri);
  };

  const confirmLivraison = async () => {
    if (!photoUri) return;
    setConfirming(true);
    try {
      demandesDB.updateStatut(parseInt(id), 'livree');
      const prixRef = demande.prix_final || demande.prix_estime || 0;
      if (prixRef > 0) {
        const part = partTransporteur(prixRef);
        gainsDB.create({ transporteur_id: user.id, demande_id: parseInt(id), montant: part.montant, commission: part.commission });
        demandesDB.setPrixFinal(parseInt(id), prixRef);
      }
      if (demande.expediteur_id) {
        notifDB.create(demande.expediteur_id, `📦 Votre livraison est arrivée ! Marchandise déposée à ${demande.ville_arrivee}.`, NT.LIVRAISON_EFFECTUEE, { route: `/demande/${id}` });
      }
      setShowPhotoModal(false);
      router.replace(`/notation?nom=${encodeURIComponent(demande.expediteur_nom || '')}&type=expediteur&demandeId=${id}`);
    } catch (e) { Alert.alert('Erreur', e.message); }
    finally { setConfirming(false); }
  };

  const fetch = useCallback(() => {
    try {
      const d = demandesDB.getById(parseInt(id));
      setDemande(d);
      if (user && d?.type_demande === 'planifie') setMyOffer(offresDB.getMyOffer(parseInt(id), user.id));
      if (user?.type === 'transporteur') setSuspension(usersDB.isSuspended(user.id));
      setMsgUnread(messagesDB.countUnreadForDemande(parseInt(id), user?.id || 0));
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); }
  }, [id, user]);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  const isMyOrder = demande?.transporteur_id === user?.id;
  const isT       = user?.type === 'transporteur';
  const canStart  = demande?.statut === 'acceptee' && isMyOrder;
  const isEnRoute = demande?.statut === 'en_route' && isMyOrder;

  // Pulse du bouton « Démarrer » pour attirer l'attention
  useEffect(() => {
    if (!canStart) { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [canStart, pulse]);

  const openNavigation = async (app) => {
    const dest = encodeURIComponent(demande?.ville_arrivee || '');
    const url = app === 'waze'
      ? `https://waze.com/ul?q=${dest}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
    try { await Linking.openURL(url); } catch {
      Alert.alert('Navigation', `Impossible d'ouvrir ${app === 'waze' ? 'Waze' : 'Google Maps'}.`);
    }
  };

  const startCourse = async (navApp) => {
    setActing(true);
    try {
      if (navApp) openNavigation(navApp);
      demandesDB.updateStatut(parseInt(id), 'en_route');
      if (demande.expediteur_id) {
        notifDB.create(demande.expediteur_id, `🚛 Votre transporteur a démarré la course ! ${user.nom} est en route vers ${demande.ville_arrivee}.`, NT.TRANSPORTEUR_ENROUTE, { route: `/demande/${id}` });
      }
      setShowStartModal(false);
      fetch();
    } catch (e) { Alert.alert('Erreur', e.message); }
    finally { setActing(false); }
  };

  const handleAction = (nextStatut, confirmMsg) => {
    Alert.alert('Confirmer ?', confirmMsg, [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui', onPress: async () => {
        setActing(true);
        try {
          if (nextStatut === 'acceptee') demandesDB.updateStatut(parseInt(id), 'acceptee', user.id);
          else demandesDB.updateStatut(parseInt(id), nextStatut);
          const msgs = {
            acceptee: `${user.nom} a accepté ta demande ${demande.ville_depart} → ${demande.ville_arrivee} !`,
          };
          const notifTypes = { acceptee: NT.COURSE_ACCEPTEE };
          if (demande.expediteur_id && msgs[nextStatut]) notifDB.create(demande.expediteur_id, msgs[nextStatut], notifTypes[nextStatut], { route: `/demande/${id}` });
          fetch();
        } catch (e) { Alert.alert('Erreur', e.message); }
        finally { setActing(false); }
      }},
    ]);
  };

  const handleAnnulerCourse = () => {
    if (!selectedReason) return;
    setActing(true);
    try {
      demandesDB.annulerParTransporteur(parseInt(id));
      usersDB.incrementAnnulations(user.id);
      annulationsDB.create({ demande_id: parseInt(id), user_id: user.id, role: 'transporteur', motif: selectedReason, gratuite: 0 });
      const suspDate = usersDB.checkAndSuspend(user.id);
      if (demande.expediteur_id) notifDB.create(demande.expediteur_id, 'Votre transporteur a annulé la course. Votre demande est à nouveau disponible.', NT.COURSE_ANNULEE, { route: `/demande/${id}` });
      setShowCancelModal(false);
      if (suspDate) {
        const fmt = new Date(suspDate).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' });
        Alert.alert('Compte suspendu', `Votre compte est suspendu jusqu'au ${fmt} suite à trop d'annulations.`,
          [{ text: 'Compris', onPress: () => router.replace('/(tabs)/suivi') }]);
      } else {
        router.replace('/(tabs)/suivi');
      }
    } catch (e) { Alert.alert('Erreur', e.message); }
    finally { setActing(false); }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>;

  if (!demande) return (
    <View style={s.center}>
      <Text style={s.emptyTitle}>Demande introuvable</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
        <Text style={{ color: C.accent, fontWeight: '700' }}>Retour</Text>
      </TouchableOpacity>
    </View>
  );

  const st = STATUTS[demande.statut] || STATUTS.en_attente;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.headerTitle}>Détail de la course</Text>
          <Text style={s.headerId}>#DZ{String(demande.id).padStart(4, '0')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 50 }}>

        {/* Statut */}
        <View style={[s.statusCard, { backgroundColor: st.bg, borderColor: st.color }]}>
          <View style={[s.statusIcon, { backgroundColor: st.color }]}>
            <Ionicons name={st.icon} size={22} color="#FFFFFF" />
          </View>
          <Text style={[s.statusTitle, { color: st.color }]}>{st.label}</Text>
        </View>

        {/* Carte GPS (transporteur) */}
        {isT && (
          <View style={s.card}>
            <View style={s.cardTitleRow}>
              <Ionicons name="location-outline" size={16} color={C.text} style={{ marginRight: 8 }} />
              <Text style={s.cardTitle}>Ma position</Text>
              {demande.statut === 'en_route' && (
                <View style={s.liveChip}>
                  <View style={s.liveDot} />
                  <Text style={s.liveTxt}>En direct</Text>
                </View>
              )}
            </View>
            <LocationMap user={user} status={demande.statut} />
          </View>
        )}

        {/* Itinéraire */}
        {(() => {
          const km = getDistanceKm(demande.ville_depart, demande.ville_arrivee);
          return (
            <View style={s.card}>
              <View style={s.cardTitleRow}>
                <Ionicons name="navigate-outline" size={16} color={C.text} style={{ marginRight: 8 }} />
                <Text style={s.cardTitle}>Itinéraire</Text>
                {km != null && (
                  <View style={s.kmBadge}>
                    <Ionicons name="resize-outline" size={11} color={C.success} style={{ marginRight: 3 }} />
                    <Text style={s.kmBadgeTxt}>{fmtKm(km)}</Text>
                  </View>
                )}
              </View>
              <View style={s.routeRow}>
                <View style={s.routeSide}>
                  <View style={[s.routeDot, { backgroundColor: C.success }]} />
                  <Text style={s.routeLabel}>Départ</Text>
                  <Text style={s.routeCity}>{demande.ville_depart}</Text>
                </View>
                <Ionicons name="car-sport-outline" size={24} color={C.muted} />
                <View style={[s.routeSide, { alignItems: 'flex-end' }]}>
                  <View style={[s.routeDot, { backgroundColor: C.error }]} />
                  <Text style={[s.routeLabel, { textAlign: 'right' }]}>Arrivée</Text>
                  <Text style={[s.routeCity, { textAlign: 'right' }]}>{demande.ville_arrivee}</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* Marchandise */}
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <Ionicons name="cube-outline" size={16} color={C.text} style={{ marginRight: 8 }} />
            <Text style={s.cardTitle}>Marchandise</Text>
          </View>
          <View style={s.marchaRow}>
            <View style={s.marchaIconBox}>
              <Ionicons name={TYPES_ICON[demande.type_marchandise] || 'cube-outline'} size={26} color={C.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.marchaType}>{demande.type_marchandise}</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                {demande.poids && (
                  <View style={s.metaChip}>
                    <Ionicons name="scale-outline" size={11} color={C.muted} style={{ marginRight: 3 }} />
                    <Text style={s.metaChipTxt}>{demande.poids}</Text>
                  </View>
                )}
                <View style={s.metaChip}>
                  <Ionicons name="calendar-outline" size={11} color={C.muted} style={{ marginRight: 3 }} />
                  <Text style={s.metaChipTxt}>{demande.date_souhaitee}</Text>
                </View>
              </View>
            </View>
          </View>
          {demande.description ? (
            <View style={s.descBox}><Text style={s.descTxt}>{demande.description}</Text></View>
          ) : null}
        </View>

        {/* Rémunération */}
        {(() => {
          const prixRef = demande.prix_final || demande.prix_estime;
          if (!prixRef) return null;
          const part = partTransporteur(prixRef);
          return (
            <View style={[s.card, { borderColor: C.success, borderWidth: 1.5 }]}>
              <View style={s.cardTitleRow}>
                <Ionicons name="wallet-outline" size={16} color={C.success} style={{ marginRight: 8 }} />
                <Text style={[s.cardTitle, { color: C.success }]}>Ma rémunération</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={s.remLabel}>{demande.prix_final ? 'Prix final' : 'Prix estimé'}</Text>
                  <Text style={s.remTotal}>{fmtPrix(prixRef)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={s.remLabel}>Ma part ({part.tauxGarder}%)</Text>
                  <Text style={[s.remTotal, { color: C.success }]}>{fmtPrix(part.montant)}</Text>
                  {part.bonus && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                      <Ionicons name="star" size={11} color="#F59E0B" style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: 11, color: '#F59E0B', fontWeight: '700' }}>Bonus note {'>'} 4.5</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={s.commissionRow}>
                <Text style={s.commissionTxt}>Commission DzExpress</Text>
                <Text style={s.commissionAmt}>{fmtPrix(part.commission)} ({100 - part.tauxGarder}%)</Text>
              </View>
            </View>
          );
        })()}

        {/* Bouton contacter expéditeur */}
        {isMyOrder && ['acceptee', 'en_route'].includes(demande.statut) && (
          <TouchableOpacity style={s.contactBtn} onPress={() => router.push(`/chat/${id}`)}>
            <Ionicons name="chatbubble-ellipses" size={18} color={C.success} style={{ marginRight: 8 }} />
            <Text style={s.contactBtnTxt}>
              {"Contacter l'expéditeur"}{msgUnread > 0 ? ` · ${msgUnread} non lu${msgUnread > 1 ? 's' : ''}` : ''}
            </Text>
            {msgUnread > 0 && (
              <View style={s.msgBadge}><Text style={s.msgBadgeTxt}>{msgUnread > 9 ? '9+' : msgUnread}</Text></View>
            )}
          </TouchableOpacity>
        )}

        {/* Expéditeur */}
        <View style={s.card}>
          <View style={s.cardTitleRow}>
            <Ionicons name="person-outline" size={16} color={C.text} style={{ marginRight: 8 }} />
            <Text style={s.cardTitle}>Expéditeur</Text>
          </View>
          <View style={s.clientRow}>
            <View style={s.clientAvatar}>
              <Text style={s.clientAvatarTxt}>
                {demande.expediteur_nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.clientName}>{demande.expediteur_nom}</Text>
              {demande.expediteur_wilaya && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                  <Ionicons name="location-outline" size={12} color={C.muted} style={{ marginRight: 3 }} />
                  <Text style={s.clientMeta}>{demande.expediteur_wilaya}</Text>
                </View>
              )}
            </View>
          </View>
          {['acceptee', 'en_route'].includes(demande.statut) && (
            <TouchableOpacity style={s.callBtn}
              onPress={() => Alert.alert("Appeler l'expéditeur", `Numéro : ${demande.expediteur_tel}`)}>
              <Ionicons name="call-outline" size={16} color={C.success} style={{ marginRight: 8 }} />
              <Text style={s.callBtnTxt}>{demande.expediteur_tel}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Bannière suspension */}
        {suspension && isT && (
          <View style={s.suspendedCard}>
            <Ionicons name="ban-outline" size={28} color={C.error} style={{ marginBottom: 10 }} />
            <Text style={s.suspendedTitle}>Compte suspendu</Text>
            <Text style={s.suspendedTxt}>
              {'Suspendu jusqu’au '}
              <Text style={{ fontWeight: '900' }}>
                {new Date(suspension).toLocaleDateString('fr-DZ', { day: '2-digit', month: 'long', year: 'numeric' })}
              </Text>
              {' suite à trop d’annulations.'}
            </Text>
          </View>
        )}

        {/* ── Boutons d'action ── */}

        {/* Accepter (transporteur non assigné) */}
        {demande.statut === 'en_attente' && !isMyOrder && isT && !suspension && (
          <TouchableOpacity style={[s.actionBtn, acting && { opacity: 0.65 }]} onPress={() => handleAction('acceptee', `Accepter la course ${demande.ville_depart} → ${demande.ville_arrivee} ?`)} disabled={acting}>
            {acting ? <ActivityIndicator color="#FFFFFF" /> : <>
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={s.actionBtnTxt}>Accepter cette course</Text>
            </>}
          </TouchableOpacity>
        )}

        {/* 🚀 Démarrer (pulsant) */}
        {canStart && (
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <TouchableOpacity
              style={[s.actionBtn, s.startBtn, acting && { opacity: 0.65 }]}
              onPress={() => setShowStartModal(true)}
              disabled={acting}
              activeOpacity={0.85}
            >
              <Text style={s.startEmoji}>🚀</Text>
              <Text style={s.actionBtnTxt}>Démarrer la course</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* 🏁 Terminer la course */}
        {isEnRoute && (
          <TouchableOpacity
            style={[s.actionBtn, acting && { opacity: 0.65 }]}
            onPress={() => { setPhotoUri(null); setShowPhotoModal(true); }}
            disabled={acting}
          >
            <Text style={s.startEmoji}>🏁</Text>
            <Text style={s.actionBtnTxt}>Terminer la course</Text>
          </TouchableOpacity>
        )}

        {/* Annuler */}
        {['acceptee', 'en_route'].includes(demande.statut) && isMyOrder && (
          <TouchableOpacity style={[s.cancelCourseBtn, acting && { opacity: 0.65 }]} onPress={() => { setSelectedReason(null); setShowCancelModal(true); }} disabled={acting}>
            <Ionicons name="close-circle-outline" size={18} color={C.error} style={{ marginRight: 8 }} />
            <Text style={s.cancelCourseTxt}>Annuler cette course</Text>
          </TouchableOpacity>
        )}

        {/* Course terminée */}
        {demande.statut === 'livree' && (
          <View style={s.doneCard}>
            <Ionicons name="checkmark-circle" size={48} color={C.success} style={{ marginBottom: 10 }} />
            <Text style={s.doneTxt}>Course terminée</Text>
            <Text style={s.doneSub}>Marchandise livrée à {demande.ville_arrivee}.</Text>
          </View>
        )}

        {demande.statut === 'acceptee' && !isMyOrder && isT && (
          <View style={s.takenCard}>
            <Ionicons name="lock-closed-outline" size={18} color={C.muted} style={{ marginRight: 8 }} />
            <Text style={s.takenTxt}>Cette course a déjà été acceptée par un autre transporteur.</Text>
          </View>
        )}

        {/* Formulaire offre (mode planifié) */}
        {isT && demande.type_demande === 'planifie' && demande.statut === 'en_attente' && (
          myOffer ? (
            <View style={of.card}>
              <View style={of.titleRow}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={C.text} style={{ marginRight: 8 }} />
                <Text style={of.title}>Mon offre envoyée</Text>
              </View>
              {myOffer.prix_propose
                ? <Text style={of.prix}>{myOffer.prix_propose.toLocaleString()} DA</Text>
                : <Text style={[of.prix, { color: C.muted }]}>Prix à négocier</Text>
              }
              {myOffer.message ? <Text style={of.msg}>{'"'}{myOffer.message}{'"'}</Text> : null}
              <View style={[of.badge,
                myOffer.statut === 'acceptee' && { backgroundColor: C.successLight, borderColor: '#6EE7B7' },
                myOffer.statut === 'refusee'  && { backgroundColor: C.errorLight, borderColor: '#FCA5A5' },
              ]}>
                <Ionicons
                  name={myOffer.statut === 'acceptee' ? 'checkmark-circle' : myOffer.statut === 'refusee' ? 'close-circle' : 'time-outline'}
                  size={14}
                  color={myOffer.statut === 'acceptee' ? C.success : myOffer.statut === 'refusee' ? C.error : C.muted}
                  style={{ marginRight: 6 }}
                />
                <Text style={[of.badgeTxt, myOffer.statut === 'acceptee' && { color: C.success }, myOffer.statut === 'refusee' && { color: C.error }]}>
                  {myOffer.statut === 'acceptee' ? 'Acceptée !' : myOffer.statut === 'refusee' ? 'Offre refusée' : 'En attente de réponse'}
                </Text>
              </View>
              {myOffer.statut === 'acceptee' && demande.expediteur_tel && (
                <TouchableOpacity style={of.callBtn} onPress={() => Alert.alert('Client', `Numéro : ${demande.expediteur_tel}`)}>
                  <Ionicons name="call-outline" size={15} color={C.success} style={{ marginRight: 6 }} />
                  <Text style={of.callTxt}>Appeler le client · {demande.expediteur_tel}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={of.card}>
              <View style={of.titleRow}>
                <Ionicons name="cash-outline" size={16} color={C.text} style={{ marginRight: 8 }} />
                <Text style={of.title}>Faire une offre</Text>
              </View>
              <Text style={of.sub}>{"Propose ton prix à l'expéditeur"}</Text>

              <Text style={of.label}>Ton prix (DA)</Text>
              <TextInput style={of.input} placeholder="Ex : 2500" placeholderTextColor="#9CA3AF" value={offrePrix} onChangeText={setOffrePrix} keyboardType="numeric" />

              <Text style={of.label}>Message (optionnel)</Text>
              <TextInput style={[of.input, { minHeight: 65, textAlignVertical: 'top' }]} placeholder="Disponible dès demain matin, camion propre…" placeholderTextColor="#9CA3AF" value={offreMsg} onChangeText={setOffreMsg} multiline />

              <TouchableOpacity style={[of.sendBtn, sendingOffer && { opacity: 0.7 }]} disabled={sendingOffer}
                onPress={() => {
                  if (!offrePrix && !offreMsg) return Alert.alert('Requis', 'Entre un prix ou un message.');
                  setSendingOffer(true);
                  try {
                    offresDB.create({ demande_id: demande.id, transporteur_id: user.id, prix_propose: offrePrix ? parseFloat(offrePrix) : null, message: offreMsg.trim() || null });
                    notifDB.create(demande.expediteur_id, `${user.nom} a fait une offre pour ${demande.ville_depart} → ${demande.ville_arrivee} !`, NT.OFFRE_RECUE, { route: `/demande/${demande.id}` });
                    localNotif(user.id, "Offre envoyée ! Ta proposition a été transmise à l'expéditeur.", NT.INFO);
                    setOffrePrix(''); setOffreMsg(''); fetch();
                  } catch (e) { Alert.alert('Erreur', e.message); }
                  finally { setSendingOffer(false); }
                }}
              >
                {sendingOffer ? <ActivityIndicator color="#FFFFFF" /> : <>
                  <Ionicons name="send-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={of.sendBtnTxt}>Envoyer mon offre</Text>
                </>}
              </TouchableOpacity>
            </View>
          )
        )}
      </ScrollView>

      {/* ── Modal démarrage course ── */}
      <Modal visible={showStartModal} transparent animationType="slide" onRequestClose={() => setShowStartModal(false)}>
        <View style={sm.overlay}>
          <View style={sm.sheet}>
            <View style={sm.handle} />
            <View style={sm.rocketBadge}><Text style={{ fontSize: 28 }}>🚀</Text></View>
            <Text style={sm.title}>Êtes-vous prêt à démarrer ?</Text>
            <Text style={sm.sub}>
              {"L'expéditeur sera notifié immédiatement. Destination :"}{'\n'}
              <Text style={{ fontWeight: '800', color: C.text }}>{demande.ville_arrivee}</Text>
            </Text>

            <Text style={sm.navLabel}>Naviguer vers la destination</Text>

            {/* Google Maps */}
            <TouchableOpacity
              style={[sm.navBtn, sm.navBtnGoogle, acting && { opacity: 0.6 }]}
              onPress={() => startCourse('gmaps')}
              disabled={acting}
              activeOpacity={0.8}
            >
              <View style={sm.navBtnIcon}>
                <Ionicons name="map-outline" size={20} color="#34A853" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sm.navBtnTitle}>🗺️ Google Maps</Text>
                <Text style={sm.navBtnSub}>Ouvrir la navigation GPS</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#34A853" />
            </TouchableOpacity>

            {/* Waze */}
            <TouchableOpacity
              style={[sm.navBtn, sm.navBtnWaze, acting && { opacity: 0.6 }]}
              onPress={() => startCourse('waze')}
              disabled={acting}
              activeOpacity={0.8}
            >
              <View style={[sm.navBtnIcon, { backgroundColor: '#33CCFF' }]}>
                <Ionicons name="navigate-outline" size={20} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[sm.navBtnTitle, { color: '#1A8FBF' }]}>🔵 Waze</Text>
                <Text style={sm.navBtnSub}>Trafic en temps réel</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#1A8FBF" />
            </TouchableOpacity>

            {/* Sans navigation */}
            <TouchableOpacity
              style={[sm.skipBtn, acting && { opacity: 0.6 }]}
              onPress={() => startCourse(null)}
              disabled={acting}
            >
              {acting
                ? <ActivityIndicator color={C.primary} size="small" />
                : <Text style={sm.skipTxt}>Démarrer sans navigation</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={sm.cancelBtn} onPress={() => setShowStartModal(false)} disabled={acting}>
              <Text style={sm.cancelTxt}>Plus tard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal annulation course ── */}
      <Modal visible={showCancelModal} transparent animationType="slide" onRequestClose={() => setShowCancelModal(false)}>
        <View style={cm.overlay}>
          <View style={cm.sheet}>
            <View style={cm.handle} />
            <Text style={cm.title}>Annuler la course ?</Text>
            <Text style={cm.sub}>
              La demande sera remise en attente.{'\n'}
              <Text style={{ fontWeight: '800', color: C.error }}>Cette annulation sera enregistrée.</Text>
            </Text>
            <Text style={cm.reasonLabel}>{"Raison de l'annulation"}</Text>
            {RAISONS_ANNULATION.map(r => (
              <TouchableOpacity key={r.key} style={[cm.reasonBtn, selectedReason === r.key && cm.reasonBtnSelected]} onPress={() => setSelectedReason(r.key)} activeOpacity={0.75}>
                <Ionicons name={r.icon} size={16} color={selectedReason === r.key ? C.error : C.muted} style={{ marginRight: 10 }} />
                <Text style={[cm.reasonTxt, selectedReason === r.key && { color: C.error, fontWeight: '700' }]}>{r.label}</Text>
                {selectedReason === r.key && <Ionicons name="checkmark-circle" size={18} color={C.error} />}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={[cm.confirmBtn, !selectedReason && { backgroundColor: C.border }, acting && { opacity: 0.7 }]} onPress={handleAnnulerCourse} disabled={!selectedReason || acting}>
              {acting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={cm.confirmTxt}>{"Confirmer l'annulation"}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={cm.abandonBtn} onPress={() => setShowCancelModal(false)} disabled={acting}>
              <Text style={cm.abandonTxt}>Abandonner</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Modal photo de livraison ── */}
      <Modal visible={showPhotoModal} transparent animationType="slide" onRequestClose={() => setShowPhotoModal(false)}>
        <View style={pm.overlay}>
          <View style={pm.sheet}>
            <View style={pm.handle} />
            <Text style={pm.title}>📦 Confirmer la livraison</Text>
            <Text style={pm.sub}>
              {"Prends une photo de la marchandise déposée."}{'\n'}
              <Text style={{ fontWeight: '800', color: C.text }}>Obligatoire</Text> pour terminer la course.
            </Text>
            {photoUri ? (
              <View style={pm.previewBox}>
                <Image source={{ uri: photoUri }} style={pm.preview} resizeMode="cover" />
                <TouchableOpacity style={pm.retakeBtn} onPress={() => setPhotoUri(null)}>
                  <Ionicons name="close" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                  <Text style={pm.retakeTxt}>Reprendre</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={pm.placeholder}>
                <Ionicons name="camera-outline" size={40} color="#D1D5DB" />
                <Text style={pm.placeholderTxt}>Aucune photo sélectionnée</Text>
              </View>
            )}
            {!photoUri && (
              <View style={pm.sourceRow}>
                <TouchableOpacity style={pm.sourceBtn} onPress={takePhoto}>
                  <Ionicons name="camera-outline" size={26} color={C.primary} />
                  <Text style={pm.sourceTxt}>Caméra</Text>
                </TouchableOpacity>
                <TouchableOpacity style={pm.sourceBtn} onPress={pickFromGallery}>
                  <Ionicons name="images-outline" size={26} color={C.primary} />
                  <Text style={pm.sourceTxt}>Galerie</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity style={[pm.confirmBtn, !photoUri && { backgroundColor: C.border }, confirming && { opacity: 0.7 }]} onPress={confirmLivraison} disabled={!photoUri || confirming}>
              {confirming ? <ActivityIndicator color="#FFFFFF" /> : <>
                <Ionicons name={photoUri ? 'checkmark-circle-outline' : 'camera-outline'} size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={pm.confirmTxt}>{photoUri ? 'Livraison confirmée !' : "Ajoute d'abord une photo"}</Text>
              </>}
            </TouchableOpacity>
            <TouchableOpacity style={pm.cancelBtn} onPress={() => { setShowPhotoModal(false); setPhotoUri(null); }} disabled={confirming}>
              <Text style={pm.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgAlt },
  emptyTitle:  { fontSize: 17, fontWeight: '700', color: C.text },

  header:      { backgroundColor: C.primary, paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' },
  backBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  headerId:    { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },

  card:         { backgroundColor: C.bg, borderRadius: 12, padding: 18, elevation: 1, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  cardTitle:    { fontSize: 15, fontWeight: '800', color: C.text, flex: 1 },
  liveChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.errorLight, borderRadius: 50, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FCA5A5' },
  liveDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: C.error },
  liveTxt:      { fontSize: 11, fontWeight: '700', color: C.error },

  statusCard:   { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 16, borderWidth: 1.5 },
  statusIcon:   { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 14 },
  statusTitle:  { fontSize: 18, fontWeight: '800' },

  kmBadge:      { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 50, borderWidth: 1, borderColor: '#6EE7B7' },
  kmBadgeTxt:   { fontSize: 11, fontWeight: '700', color: C.success },

  routeRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeSide:    { flex: 1, alignItems: 'flex-start', gap: 3 },
  routeDot:     { width: 12, height: 12, borderRadius: 6 },
  routeLabel:   { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.3 },
  routeCity:    { fontSize: 16, fontWeight: '800', color: C.text, letterSpacing: -0.3 },

  marchaRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  marchaIconBox:{ width: 52, height: 52, borderRadius: 12, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },
  marchaType:   { fontSize: 15, fontWeight: '800', color: C.text },
  metaChip:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 50, borderWidth: 1, borderColor: C.border },
  metaChipTxt:  { fontSize: 11, color: C.muted, fontWeight: '600' },
  descBox:      { backgroundColor: C.bgAlt, borderRadius: 8, padding: 12 },
  descTxt:      { fontSize: 14, color: C.text, lineHeight: 20 },

  remLabel:     { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 3 },
  remTotal:     { fontSize: 20, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  commissionRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.bgAlt, borderRadius: 8, padding: 10, marginTop: 10 },
  commissionTxt:{ fontSize: 12, color: C.muted },
  commissionAmt:{ fontSize: 12, fontWeight: '700', color: C.muted },

  clientRow:        { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  clientAvatar:     { width: 46, height: 46, borderRadius: 23, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' },
  clientAvatarTxt:  { fontSize: 15, fontWeight: '900', color: C.accent },
  clientName:       { fontSize: 15, fontWeight: '800', color: C.text },
  clientMeta:       { fontSize: 12, color: C.muted },
  callBtn:          { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#6EE7B7' },
  callBtnTxt:       { fontSize: 14, fontWeight: '700', color: C.success },

  actionBtn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 17, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 6 },
  actionBtnTxt:    { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  startBtn:        { backgroundColor: C.success },
  startEmoji:      { fontSize: 18, marginRight: 8 },

  doneCard:    { backgroundColor: C.successLight, borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1.5, borderColor: '#6EE7B7' },
  doneTxt:     { fontSize: 20, fontWeight: '800', color: C.success, marginBottom: 4 },
  doneSub:     { fontSize: 13, color: C.success },

  takenCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: C.border },
  takenTxt:    { fontSize: 13, color: C.muted, fontWeight: '600', flex: 1 },

  cancelCourseBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 14, borderWidth: 1.5, borderColor: '#FCA5A5', backgroundColor: C.errorLight },
  cancelCourseTxt: { fontSize: 14, fontWeight: '700', color: C.error },

  contactBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 12, paddingVertical: 15, backgroundColor: C.successLight, borderWidth: 1.5, borderColor: '#6EE7B7' },
  contactBtnTxt: { fontSize: 14, fontWeight: '800', color: C.success },
  msgBadge:      { backgroundColor: C.error, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginLeft: 6 },
  msgBadgeTxt:   { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },

  suspendedCard:  { backgroundColor: C.errorLight, borderRadius: 12, padding: 24, alignItems: 'center', borderWidth: 1.5, borderColor: '#FCA5A5' },
  suspendedTitle: { fontSize: 17, fontWeight: '800', color: C.error, marginBottom: 8 },
  suspendedTxt:   { fontSize: 13, fontWeight: '600', color: C.error, textAlign: 'center', lineHeight: 20 },
});

const of = StyleSheet.create({
  card:     { backgroundColor: C.bg, borderRadius: 12, padding: 18, borderWidth: 1.5, borderColor: C.primary },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title:    { fontSize: 15, fontWeight: '800', color: C.text },
  sub:      { fontSize: 13, color: C.muted, marginBottom: 16 },
  label:    { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 },
  input:    { backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.text, marginBottom: 14 },
  sendBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 15 },
  sendBtnTxt: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  prix:     { fontSize: 22, fontWeight: '900', color: C.primary, marginBottom: 6 },
  msg:      { fontSize: 13, color: C.muted, fontStyle: 'italic', marginBottom: 12, lineHeight: 19 },
  badge:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderRadius: 10, padding: 12, borderWidth: 1.5, borderColor: C.border, marginBottom: 10 },
  badgeTxt: { fontSize: 13, fontWeight: '700', color: C.muted },
  callBtn:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1.5, borderColor: '#6EE7B7' },
  callTxt:  { fontSize: 13, fontWeight: '700', color: C.success },
});

const cm = StyleSheet.create({
  overlay:           { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:             { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28 },
  handle:            { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },
  title:             { fontSize: 19, fontWeight: '800', color: C.error, marginBottom: 8, textAlign: 'center' },
  sub:               { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  reasonLabel:       { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  reasonBtn:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt, marginBottom: 8 },
  reasonBtnSelected: { borderColor: C.error, backgroundColor: C.errorLight },
  reasonTxt:         { fontSize: 14, fontWeight: '600', color: C.text, flex: 1 },
  confirmBtn:        { backgroundColor: C.error, borderRadius: 50, paddingVertical: 16, alignItems: 'center', marginTop: 10, marginBottom: 10 },
  confirmTxt:        { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  abandonBtn:        { alignItems: 'center', paddingVertical: 8 },
  abandonTxt:        { fontSize: 14, color: C.muted, fontWeight: '600' },
});

// Start modal styles
const sm = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28 },
  handle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 18 },
  rocketBadge:  { width: 64, height: 64, borderRadius: 32, backgroundColor: C.successLight, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14, borderWidth: 1.5, borderColor: '#6EE7B7' },
  title:        { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  sub:          { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 22 },
  navLabel:     { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },

  navBtn:       { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 10, borderWidth: 1.5, gap: 12 },
  navBtnGoogle: { backgroundColor: '#FAFFFE', borderColor: '#BBF7D0' },
  navBtnWaze:   { backgroundColor: '#EAF8FF', borderColor: '#B3E7FA' },
  navBtnIcon:   { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  navBtnTitle:  { fontSize: 14, fontWeight: '800', color: C.text, marginBottom: 2 },
  navBtnSub:    { fontSize: 12, color: C.muted, fontWeight: '500' },

  skipBtn:      { alignItems: 'center', justifyContent: 'center', borderRadius: 50, paddingVertical: 14, marginBottom: 8, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt },
  skipTxt:      { fontSize: 14, fontWeight: '700', color: C.text },

  cancelBtn:    { alignItems: 'center', paddingVertical: 10 },
  cancelTxt:    { fontSize: 14, color: C.muted, fontWeight: '600' },
});

const pm = StyleSheet.create({
  overlay:        { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:          { backgroundColor: C.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28 },
  handle:         { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },
  title:          { fontSize: 19, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  sub:            { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  placeholder:    { height: 160, borderRadius: 12, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bgAlt, marginBottom: 16, gap: 8 },
  placeholderTxt: { fontSize: 13, color: C.muted, fontWeight: '600' },
  previewBox:     { position: 'relative', marginBottom: 16, borderRadius: 12, overflow: 'hidden' },
  preview:        { width: '100%', height: 200, borderRadius: 12 },
  retakeBtn:      { flexDirection: 'row', alignItems: 'center', position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  retakeTxt:      { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  sourceRow:      { flexDirection: 'row', gap: 12, marginBottom: 20 },
  sourceBtn:      { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt, gap: 6 },
  sourceTxt:      { fontSize: 13, fontWeight: '700', color: C.primary },
  confirmBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.success, borderRadius: 50, paddingVertical: 17, marginBottom: 12 },
  confirmTxt:     { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  cancelBtn:      { alignItems: 'center', paddingVertical: 10 },
  cancelTxt:      { fontSize: 14, color: C.muted, fontWeight: '600' },
});
