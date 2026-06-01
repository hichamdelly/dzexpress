import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, ActivityIndicator,
  Alert, Dimensions, KeyboardAvoidingView, Modal, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { demandesDB, offresDB, notifDB, usersDB, annulationsDB, gainsDB, messagesDB } from '../../src/db/database';
import { fmtPrix, partTransporteur } from '../../src/utils/pricing';
import { useApp, localNotif } from '../../src/context/AppContext';
import { getDistanceKm, fmtKm, estimerPrix } from '../../src/utils/wilayas';

const { width: W } = Dimensions.get('window');

const C = {
  blue:        '#1A56DB',
  blueLight:   '#EBF5FF',
  blueDark:    '#1E40AF',
  orange:      '#F97316',
  orangeLight: '#FFF7ED',
  bg:          '#F8FAFC',
  white:       '#FFFFFF',
  text:        '#1E293B',
  muted:       '#64748B',
  border:      '#E2E8F0',
  green:       '#16A34A',
  greenLight:  '#F0FDF4',
  yellow:      '#D97706',
  yellowLight: '#FFFBEB',
  red:         '#DC2626',
  redLight:    '#FEF2F2',
};

const STATUTS = {
  en_attente: { label: 'En attente',  color: C.yellow, bg: C.yellowLight, icon: '⏳' },
  acceptee:   { label: 'Acceptée',    color: C.blue,   bg: C.blueLight,   icon: '✅' },
  en_cours:   { label: 'En cours',    color: C.orange, bg: C.orangeLight, icon: '🚛' },
  livree:     { label: 'Livrée',      color: C.green,  bg: C.greenLight,  icon: '📦' },
  annulee:    { label: 'Annulée',     color: C.red,    bg: C.redLight,    icon: '❌' },
};

const TYPES_ICON = {
  meubles: '🪑', electromenager: '📺', cartons: '📦',
  materiaux: '🧱', vehicule: '🚗', autre: '🔧',
};

const RAISONS_ANNULATION = [
  { key: 'mecanique', label: '🔧 Problème mécanique' },
  { key: 'personnel', label: '👤 Empêchement personnel' },
  { key: 'erreur',    label: '✏️ Erreur de saisie' },
  { key: 'autre',     label: '💬 Autre raison' },
];

// ── Composant carte ──────────────────────────────────────────
function LocationMap({ user, status }) {
  const mapRef = useRef(null);

  const [coords, setCoords]         = useState(null);
  const [permStatus, setPermStatus] = useState(null); // 'granted'|'denied'|'pending'
  const [locLoading, setLocLoading] = useState(true);
  const [accuracy, setAccuracy]     = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const requestAndLocate = useCallback(async () => {
    setLocLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermStatus(status);

      if (status !== 'granted') {
        setLocLoading(false);
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude, accuracy: acc } = pos.coords;
      setCoords({ latitude, longitude });
      setAccuracy(acc ? Math.round(acc) : null);
      setLastUpdate(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));

      // Centre la carte sur la position
      mapRef.current?.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      }, 800);
    } catch (e) {
      Alert.alert('Localisation', 'Impossible d\'obtenir la position GPS. Vérifie que le GPS est activé.');
    } finally {
      setLocLoading(false);
    }
  }, []);

  // Demande la permission et localise au montage
  useEffect(() => {
    requestAndLocate();
  }, []);

  // Suivi automatique toutes les 30 s quand la course est en cours
  useEffect(() => {
    if (status !== 'en_cours') return;
    const interval = setInterval(requestAndLocate, 30_000);
    return () => clearInterval(interval);
  }, [status, requestAndLocate]);

  // ── Permission refusée ──
  if (permStatus === 'denied') {
    return (
      <View style={ms.permDenied}>
        <Text style={{ fontSize: 32, marginBottom: 8 }}>📍</Text>
        <Text style={ms.permTitle}>Permission refusée</Text>
        <Text style={ms.permSub}>
          Active la localisation dans les paramètres de ton téléphone pour utiliser la carte.
        </Text>
        <TouchableOpacity style={ms.retryBtn} onPress={requestAndLocate}>
          <Text style={ms.retryTxt}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Chargement ──
  if (locLoading && !coords) {
    return (
      <View style={ms.loading}>
        <ActivityIndicator color={C.blue} size="large" />
        <Text style={ms.loadingTxt}>Localisation en cours…</Text>
      </View>
    );
  }

  if (!coords) return null;

  return (
    <View style={ms.container}>
      {/* Carte */}
      <MapView
        ref={mapRef}
        style={ms.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude:      coords.latitude,
          longitude:     coords.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={true}
      >
        <Marker
          coordinate={coords}
          title={user?.nom || 'Ma position'}
          description="Position actuelle du transporteur"
          pinColor={C.blue}
        />
      </MapView>

      {/* Overlay infos */}
      <View style={ms.infoOverlay}>
        <View style={ms.infoBadge}>
          <Text style={ms.infoTxt}>
            📍 {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
          </Text>
          {accuracy && <Text style={ms.infoAccuracy}>Précision : ±{accuracy} m</Text>}
        </View>
      </View>

      {/* Pied de carte */}
      <View style={ms.footer}>
        {lastUpdate && (
          <Text style={ms.footerTxt}>🕐 Mis à jour à {lastUpdate}</Text>
        )}
        <TouchableOpacity
          style={[ms.refreshBtn, locLoading && { opacity: 0.6 }]}
          onPress={requestAndLocate}
          disabled={locLoading}
        >
          {locLoading
            ? <ActivityIndicator color={C.white} size="small" />
            : <Text style={ms.refreshTxt}>🔄 Actualiser</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const ms = StyleSheet.create({
  container:   { borderRadius: 16, overflow: 'hidden', borderWidth: 1.5, borderColor: C.border },
  map:         { width: '100%', height: 220 },
  infoOverlay: { position: 'absolute', top: 10, left: 10, right: 10 },
  infoBadge:   { backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, alignSelf: 'flex-start', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 4 },
  infoTxt:     { fontSize: 11, fontWeight: '700', color: C.text },
  infoAccuracy:{ fontSize: 10, color: C.muted, marginTop: 1 },
  footer:      { backgroundColor: C.white, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border },
  footerTxt:   { fontSize: 12, color: C.muted, fontWeight: '600' },
  refreshBtn:  { backgroundColor: C.blue, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, minWidth: 100, alignItems: 'center' },
  refreshTxt:  { color: C.white, fontSize: 13, fontWeight: '700' },
  loading:     { height: 160, alignItems: 'center', justifyContent: 'center', backgroundColor: C.blueLight, borderRadius: 16, gap: 10 },
  loadingTxt:  { fontSize: 14, color: C.blue, fontWeight: '600' },
  permDenied:  { backgroundColor: C.redLight, borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1.5, borderColor: '#FECACA' },
  permTitle:   { fontSize: 16, fontWeight: '800', color: C.red, marginBottom: 6 },
  permSub:     { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19, marginBottom: 14 },
  retryBtn:    { backgroundColor: C.red, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 9 },
  retryTxt:    { color: C.white, fontWeight: '700', fontSize: 13 },
});

// ════════════════════════════════════════════════════════════
// ── Écran principal ──────────────────────────────────────────
// ════════════════════════════════════════════════════════════
export default function DetailCourseScreen() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const { user } = useApp();

  const [demande, setDemande]   = useState(null);
  const [myOffer, setMyOffer]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(false);

  // Modal photo de livraison
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [photoUri, setPhotoUri]             = useState(null);
  const [confirming, setConfirming]         = useState(false);

  // Formulaire offre (mode planifié)
  const [offrePrix, setOffrePrix]   = useState('');
  const [offreMsg, setOffreMsg]     = useState('');
  const [sendingOffer, setSendingOffer] = useState(false);

  // Modal annulation course
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedReason, setSelectedReason]   = useState(null);
  const [suspension, setSuspension]           = useState(null);
  const [msgUnread, setMsgUnread]             = useState(0);

  // ── Fonctions photo ──────────────────────────────────────────
  const requestMediaPermission = async (type) => {
    if (type === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === 'granted';
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const takePhoto = async () => {
    const ok = await requestMediaPermission('camera');
    if (!ok) {
      Alert.alert('Permission refusée', 'Active l\'accès à la caméra dans les paramètres.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const ok = await requestMediaPermission('gallery');
    if (!ok) {
      Alert.alert('Permission refusée', 'Active l\'accès à la galerie dans les paramètres.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.75,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const confirmLivraison = async () => {
    if (!photoUri) return;
    setConfirming(true);
    try {
      demandesDB.updateStatut(parseInt(id), 'livree');
      // Enregistrer les gains
      const prixRef = demande.prix_final || demande.prix_estime || 0;
      if (prixRef > 0) {
        const part = partTransporteur(prixRef);
        gainsDB.create({
          transporteur_id: user.id,
          demande_id:      parseInt(id),
          montant:         part.montant,
          commission:      part.commission,
        });
        demandesDB.setPrixFinal(parseInt(id), prixRef);
      }
      if (demande.expediteur_id) {
        notifDB.create(
          demande.expediteur_id,
          `📦 Livraison effectuée ! Ta marchandise est arrivée à ${demande.ville_arrivee}. Labès !`
        );
      }
      setShowPhotoModal(false);
      router.replace(
        `/notation?nom=${encodeURIComponent(demande.expediteur_nom || '')}&type=expediteur&demandeId=${id}`
      );
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setConfirming(false);
    }
  };
  // ────────────────────────────────────────────────────────────

  const fetch = useCallback(() => {
    try {
      const d = demandesDB.getById(parseInt(id));
      setDemande(d);
      if (user && d?.type_demande === 'planifie') {
        setMyOffer(offresDB.getMyOffer(parseInt(id), user.id));
      }
      if (user?.type === 'transporteur') {
        setSuspension(usersDB.isSuspended(user.id));
      }
      setMsgUnread(messagesDB.countUnreadForDemande(parseInt(id), user?.id || 0));
    }
    catch (e) { console.log(e.message); }
    finally { setLoading(false); }
  }, [id, user]);

  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));

  const isMyOrder = demande?.transporteur_id === user?.id;
  const isT       = user?.type === 'transporteur';

  const handleAction = (nextStatut, confirmMsg) => {
    Alert.alert('Confirmer ?', confirmMsg, [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui', onPress: async () => {
        setActing(true);
        try {
          if (nextStatut === 'acceptee') {
            demandesDB.updateStatut(parseInt(id), 'acceptee', user.id);
          } else {
            demandesDB.updateStatut(parseInt(id), nextStatut);
          }
          // Notification expéditeur
          const msgs = {
            acceptee: `✅ ${user.nom} a accepté ta demande ${demande.ville_depart} → ${demande.ville_arrivee} !`,
            en_cours: `🚛 Ta livraison est en route ! ${user.nom} a démarré.`,
            livree:   `📦 Livraison effectuée ! Ta marchandise est arrivée à ${demande.ville_arrivee}. Labès !`,
          };
          if (demande.expediteur_id && msgs[nextStatut]) {
            notifDB.create(demande.expediteur_id, msgs[nextStatut]);
          }
          if (nextStatut === 'livree') {
            router.replace(
              `/notation?nom=${encodeURIComponent(demande.expediteur_nom || '')}&type=expediteur&demandeId=${id}`
            );
          } else {
            fetch();
          }
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
      annulationsDB.create({
        demande_id: parseInt(id),
        user_id:    user.id,
        role:       'transporteur',
        motif:      selectedReason,
        gratuite:   0,
      });
      const suspDate = usersDB.checkAndSuspend(user.id);
      if (demande.expediteur_id) {
        notifDB.create(
          demande.expediteur_id,
          `⚠️ Votre transporteur a annulé la course. Votre demande est à nouveau disponible.`
        );
      }
      setShowCancelModal(false);
      if (suspDate) {
        const fmt = new Date(suspDate).toLocaleDateString('fr-DZ', {
          day: '2-digit', month: 'long', year: 'numeric',
        });
        Alert.alert(
          '🚫 Compte suspendu',
          `Votre compte est suspendu jusqu'au ${fmt} suite à trop d'annulations.`,
          [{ text: 'Compris', onPress: () => router.replace('/(tabs)/suivi') }]
        );
      } else {
        router.replace('/(tabs)/suivi');
      }
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setActing(false);
    }
  };

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={C.blue} /></View>
  );

  if (!demande) return (
    <View style={s.center}>
      <Text style={s.emptyTitle}>Demande introuvable</Text>
      <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}>
        <Text style={{ color: C.blue, fontWeight: '700' }}>← Retour</Text>
      </TouchableOpacity>
    </View>
  );

  const st = STATUTS[demande.statut] || STATUTS.en_attente;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={C.blueDark} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>← Retour</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Détail de la course</Text>
        <Text style={s.headerId}>#DZ{String(demande.id).padStart(4, '0')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 50 }}>

        {/* ── Statut ── */}
        <View style={[s.statusCard, { backgroundColor: st.bg, borderColor: st.color }]}>
          <Text style={{ fontSize: 38, marginBottom: 6 }}>{st.icon}</Text>
          <Text style={[s.statusTitle, { color: st.color }]}>{st.label}</Text>
        </View>

        {/* ── Carte géolocalisation (transporteur seulement) ── */}
        {isT && (
          <View style={s.card}>
            <View style={s.cardTitleRow}>
              <Text style={s.cardTitle}>📍 Ma position</Text>
              {demande.statut === 'en_cours' && (
                <View style={s.liveChip}>
                  <View style={s.liveDot} />
                  <Text style={s.liveTxt}>En direct</Text>
                </View>
              )}
            </View>
            <LocationMap user={user} status={demande.statut} />
          </View>
        )}

        {/* ── Route ── */}
        {(() => {
          const km = getDistanceKm(demande.ville_depart, demande.ville_arrivee);
          return (
            <View style={s.card}>
              <Text style={s.cardTitle}>🗺️ Itinéraire</Text>
              <View style={s.routeRow}>
                <View style={s.routeSide}>
                  <View style={[s.routeDot, { backgroundColor: C.green }]} />
                  <Text style={s.routeLabel}>Départ</Text>
                  <Text style={s.routeCity}>{demande.ville_depart}</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={s.routeArrow}>🚛</Text>
                  {km != null && (
                    <Text style={s.routeKm}>{fmtKm(km)}</Text>
                  )}
                </View>
                <View style={[s.routeSide, { alignItems: 'flex-end' }]}>
                  <View style={[s.routeDot, { backgroundColor: C.red }]} />
                  <Text style={s.routeLabel}>Arrivée</Text>
                  <Text style={s.routeCity}>{demande.ville_arrivee}</Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* ── Marchandise ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>📦 Marchandise</Text>
          <View style={s.marchaRow}>
            <View style={s.marchaIconBox}>
              <Text style={{ fontSize: 28 }}>{TYPES_ICON[demande.type_marchandise] || '📦'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.marchaType}>{demande.type_marchandise}</Text>
              {demande.poids && <Text style={s.marchaMeta}>⚖️ {demande.poids}</Text>}
              <Text style={s.marchaMeta}>📅 {demande.date_souhaitee}</Text>
            </View>
          </View>
          {demande.description ? (
            <View style={s.descBox}>
              <Text style={s.descTxt}>{demande.description}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Tarification / Part transporteur ── */}
        {(() => {
          const prixRef = demande.prix_final || demande.prix_estime;
          if (!prixRef) return null;
          const part = partTransporteur(prixRef);
          return (
            <View style={[s.card, { borderColor: C.green, borderWidth: 2 }]}>
              <Text style={s.cardTitle}>💵 Ma rémunération</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase' }}>
                    {demande.prix_final ? 'Prix final' : 'Prix estimé'}
                  </Text>
                  <Text style={{ fontSize: 20, fontWeight: '900', color: C.text }}>{fmtPrix(prixRef)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase' }}>
                    Ma part ({part.tauxGarder}%)
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: '900', color: C.green }}>{fmtPrix(part.montant)}</Text>
                  {part.bonus && (
                    <Text style={{ fontSize: 11, color: C.green, fontWeight: '700' }}>⭐ Bonus note &gt; 4.5</Text>
                  )}
                </View>
              </View>
              <View style={{ backgroundColor: C.bg, borderRadius: 10, padding: 10, marginTop: 10, flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: C.muted }}>Commission DzExpress</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: C.muted }}>{fmtPrix(part.commission)} ({100 - part.tauxGarder}%)</Text>
              </View>
            </View>
          );
        })()}

        {/* ── Bouton Contacter l'expéditeur ── */}
        {isMyOrder && (demande.statut === 'acceptee' || demande.statut === 'en_cours' || demande.statut === 'livree') && (
          <TouchableOpacity
            style={s.contactBtn}
            onPress={() => router.push(`/chat/${id}`)}
            activeOpacity={0.88}
          >
            <Text style={s.contactBtnTxt}>
              💬 Contacter l'expéditeur
              {msgUnread > 0 && ` · ${msgUnread} message${msgUnread > 1 ? 's' : ''} non lu${msgUnread > 1 ? 's' : ''}`}
            </Text>
            {msgUnread > 0 && (
              <View style={s.msgBadge}><Text style={s.msgBadgeTxt}>{msgUnread > 9 ? '9+' : msgUnread}</Text></View>
            )}
          </TouchableOpacity>
        )}

        {/* ── Contact expéditeur ── */}
        <View style={[s.card, { borderColor: C.orange, borderWidth: 2 }]}>
          <Text style={s.cardTitle}>👤 Expéditeur</Text>
          <View style={s.clientRow}>
            <View style={s.clientAvatar}>
              <Text style={{ fontSize: 18, fontWeight: '900', color: C.orange }}>
                {demande.expediteur_nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.clientName}>{demande.expediteur_nom}</Text>
              {demande.expediteur_wilaya && (
                <Text style={s.clientMeta}>📍 {demande.expediteur_wilaya}</Text>
              )}
            </View>
          </View>
          <TouchableOpacity
            style={s.callBtn}
            onPress={() => Alert.alert(
              '📞 Appeler l\'expéditeur',
              `Numéro : ${demande.expediteur_tel}`
            )}
          >
            <Text style={s.callBtnTxt}>📞 {demande.expediteur_tel}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Bannière suspension ── */}
        {suspension && isT && (
          <View style={s.suspendedCard}>
            <Text style={{ fontSize: 32, marginBottom: 10 }}>🚫</Text>
            <Text style={s.suspendedTitle}>Compte suspendu</Text>
            <Text style={s.suspendedTxt}>
              Votre compte est suspendu jusqu'au{'\n'}
              <Text style={{ fontWeight: '900' }}>
                {new Date(suspension).toLocaleDateString('fr-DZ', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </Text>
              {'\n'}suite à trop d'annulations.
            </Text>
          </View>
        )}

        {/* ── Boutons d'action ── */}
        {demande.statut === 'en_attente' && !isMyOrder && isT && !suspension && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: C.blue }, acting && s.btnDisabled]}
            onPress={() => handleAction('acceptee', `Accepter la course ${demande.ville_depart} → ${demande.ville_arrivee} ?`)}
            disabled={acting}
          >
            {acting
              ? <ActivityIndicator color="white" />
              : <Text style={s.actionBtnTxt}>✅ Accepter cette course</Text>
            }
          </TouchableOpacity>
        )}

        {demande.statut === 'acceptee' && isMyOrder && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: C.orange }, acting && s.btnDisabled]}
            onPress={() => handleAction('en_cours', 'Démarrer la course ? Le client sera notifié.')}
            disabled={acting}
          >
            {acting
              ? <ActivityIndicator color="white" />
              : <Text style={s.actionBtnTxt}>🚛 Démarrer — Je suis en route !</Text>
            }
          </TouchableOpacity>
        )}

        {demande.statut === 'en_cours' && isMyOrder && (
          <TouchableOpacity
            style={[s.actionBtn, { backgroundColor: C.green }, acting && s.btnDisabled]}
            onPress={() => { setPhotoUri(null); setShowPhotoModal(true); }}
            disabled={acting}
          >
            <Text style={s.actionBtnTxt}>📸 Marquer comme livré !</Text>
          </TouchableOpacity>
        )}

        {/* Bouton annuler — visible pour acceptée et en_cours */}
        {(demande.statut === 'acceptee' || demande.statut === 'en_cours') && isMyOrder && (
          <TouchableOpacity
            style={[s.cancelCourseBtn, acting && s.btnDisabled]}
            onPress={() => { setSelectedReason(null); setShowCancelModal(true); }}
            disabled={acting}
          >
            <Text style={s.cancelCourseTxt}>❌ Annuler cette course</Text>
          </TouchableOpacity>
        )}

        {demande.statut === 'livree' && (
          <View style={s.doneCard}>
            <Text style={{ fontSize: 48, marginBottom: 8 }}>🎉</Text>
            <Text style={s.doneTxt}>Labès ! Course terminée.</Text>
            <Text style={s.doneSub}>Marchandise livrée à {demande.ville_arrivee}.</Text>
          </View>
        )}

        {/* Demande déjà prise par un autre */}
        {demande.statut === 'acceptee' && !isMyOrder && isT && (
          <View style={s.takenCard}>
            <Text style={s.takenTxt}>🔒 Cette course a déjà été acceptée par un autre transporteur.</Text>
          </View>
        )}

        {/* ── Faire une offre (mode planifié) ── */}
        {isT && demande.type_demande === 'planifie' && demande.statut === 'en_attente' && (
          myOffer ? (
            <View style={of.card}>
              <Text style={of.title}>💬 Mon offre envoyée</Text>
              {myOffer.prix_propose
                ? <Text style={of.prix}>{myOffer.prix_propose.toLocaleString()} DA</Text>
                : <Text style={[of.prix, { color: C.muted }]}>Prix à négocier</Text>
              }
              {myOffer.message ? <Text style={of.msg}>"{myOffer.message}"</Text> : null}
              <View style={[of.badge,
                myOffer.statut === 'acceptee' && { backgroundColor: C.greenLight, borderColor: '#BBF7D0' },
                myOffer.statut === 'refusee'  && { backgroundColor: '#FEF2F2',   borderColor: '#FECACA' },
              ]}>
                <Text style={[of.badgeTxt,
                  myOffer.statut === 'acceptee' && { color: C.green },
                  myOffer.statut === 'refusee'  && { color: C.red },
                ]}>
                  {myOffer.statut === 'acceptee' ? '✅ Acceptée !'
                   : myOffer.statut === 'refusee' ? '❌ Offre refusée'
                   : '⏳ En attente de réponse'}
                </Text>
              </View>
              {myOffer.statut === 'acceptee' && demande.expediteur_tel && (
                <TouchableOpacity
                  style={of.callBtn}
                  onPress={() => Alert.alert('📞 Client', `Numéro : ${demande.expediteur_tel}`)}
                >
                  <Text style={of.callTxt}>📞 Appeler le client · {demande.expediteur_tel}</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={of.card}>
              <Text style={of.title}>💰 Faire une offre</Text>
              <Text style={of.sub}>Propose ton prix à l'expéditeur</Text>

              <Text style={of.label}>Ton prix (DA)</Text>
              <TextInput
                style={of.input}
                placeholder="Ex : 2500"
                placeholderTextColor={C.muted}
                value={offrePrix}
                onChangeText={setOffrePrix}
                keyboardType="numeric"
              />

              <Text style={of.label}>Message (optionnel)</Text>
              <TextInput
                style={[of.input, { minHeight: 65, textAlignVertical: 'top' }]}
                placeholder="Disponible dès demain matin, camion 3.5T propre…"
                placeholderTextColor={C.muted}
                value={offreMsg}
                onChangeText={setOffreMsg}
                multiline
              />

              <TouchableOpacity
                style={[of.sendBtn, sendingOffer && { opacity: 0.7 }]}
                disabled={sendingOffer}
                onPress={() => {
                  if (!offrePrix && !offreMsg)
                    return Alert.alert('Requis', 'Entre un prix ou un message.');
                  setSendingOffer(true);
                  try {
                    offresDB.create({
                      demande_id:      demande.id,
                      transporteur_id: user.id,
                      prix_propose:    offrePrix ? parseFloat(offrePrix) : null,
                      message:         offreMsg.trim() || null,
                    });
                    notifDB.create(demande.expediteur_id,
                      `💬 ${user.nom} a fait une offre pour ${demande.ville_depart} → ${demande.ville_arrivee} !`
                    );
                    localNotif(user.id, `📤 Offre envoyée ! Ta proposition a été transmise à l'expéditeur.`);
                    setOffrePrix(''); setOffreMsg('');
                    fetch();
                  } catch (e) { Alert.alert('Erreur', e.message); }
                  finally { setSendingOffer(false); }
                }}
              >
                {sendingOffer
                  ? <ActivityIndicator color="white" />
                  : <Text style={of.sendBtnTxt}>📤 Envoyer mon offre</Text>
                }
              </TouchableOpacity>
            </View>
          )
        )}

      </ScrollView>

      {/* ════════════════════════════════════════════════════════
          Modal — Annulation course par le transporteur
          ════════════════════════════════════════════════════════ */}
      <Modal
        visible={showCancelModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={cm.overlay}>
          <View style={cm.sheet}>
            <View style={cm.handle} />
            <Text style={cm.title}>Annuler la course ?</Text>
            <Text style={cm.sub}>
              La demande sera remise en attente et l'expéditeur sera notifié.{'\n'}
              <Text style={{ fontWeight: '800', color: C.red }}>Cette annulation sera enregistrée sur ton profil.</Text>
            </Text>

            <Text style={cm.reasonLabel}>Raison de l'annulation</Text>
            {RAISONS_ANNULATION.map(r => (
              <TouchableOpacity
                key={r.key}
                style={[cm.reasonBtn, selectedReason === r.key && cm.reasonBtnSelected]}
                onPress={() => setSelectedReason(r.key)}
                activeOpacity={0.75}
              >
                <Text style={[cm.reasonTxt, selectedReason === r.key && cm.reasonTxtSelected]}>
                  {r.label}
                </Text>
                {selectedReason === r.key && <Text style={cm.check}>✓</Text>}
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[cm.confirmBtn, !selectedReason && cm.confirmBtnDisabled, acting && { opacity: 0.7 }]}
              onPress={handleAnnulerCourse}
              disabled={!selectedReason || acting}
              activeOpacity={0.85}
            >
              {acting
                ? <ActivityIndicator color="white" />
                : <Text style={cm.confirmTxt}>Confirmer l'annulation</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={cm.abandonBtn}
              onPress={() => setShowCancelModal(false)}
              disabled={acting}
            >
              <Text style={cm.abandonTxt}>Abandonner</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          Modal — Photo de livraison obligatoire
          ════════════════════════════════════════════════════════ */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={m.overlay}>
          <View style={m.sheet}>
            {/* Poignée */}
            <View style={m.handle} />

            <Text style={m.title}>📸 Photo de livraison</Text>
            <Text style={m.sub}>
              Prends ou sélectionne une photo de la marchandise déposée.{'\n'}
              <Text style={{ fontWeight: '800', color: C.text }}>Obligatoire</Text> pour confirmer la livraison.
            </Text>

            {/* Aperçu photo */}
            {photoUri ? (
              <View style={m.previewBox}>
                <Image source={{ uri: photoUri }} style={m.preview} resizeMode="cover" />
                <TouchableOpacity style={m.retakeBtn} onPress={() => setPhotoUri(null)}>
                  <Text style={m.retakeTxt}>✕ Reprendre</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={m.placeholder}>
                <Text style={{ fontSize: 48 }}>📷</Text>
                <Text style={m.placeholderTxt}>Aucune photo sélectionnée</Text>
              </View>
            )}

            {/* Boutons source */}
            {!photoUri && (
              <View style={m.sourceRow}>
                <TouchableOpacity style={[m.sourceBtn, { borderColor: C.blue }]} onPress={takePhoto} activeOpacity={0.8}>
                  <Text style={{ fontSize: 26 }}>📷</Text>
                  <Text style={[m.sourceTxt, { color: C.blue }]}>Caméra</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[m.sourceBtn, { borderColor: C.orange }]} onPress={pickFromGallery} activeOpacity={0.8}>
                  <Text style={{ fontSize: 26 }}>🖼️</Text>
                  <Text style={[m.sourceTxt, { color: C.orange }]}>Galerie</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Confirmer */}
            <TouchableOpacity
              style={[
                m.confirmBtn,
                !photoUri && m.confirmBtnDisabled,
                confirming && { opacity: 0.7 },
              ]}
              onPress={confirmLivraison}
              disabled={!photoUri || confirming}
              activeOpacity={0.85}
            >
              {confirming
                ? <ActivityIndicator color="white" />
                : <Text style={m.confirmTxt}>
                    {photoUri ? '✅ Confirmer la livraison' : 'Ajoute une photo d\'abord'}
                  </Text>
              }
            </TouchableOpacity>

            {/* Annuler */}
            <TouchableOpacity
              style={m.cancelBtn}
              onPress={() => { setShowPhotoModal(false); setPhotoUri(null); }}
              disabled={confirming}
            >
              <Text style={m.cancelTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const s = StyleSheet.create({
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg },
  emptyTitle:  { fontSize: 18, fontWeight: '700', color: C.text },

  header:      { backgroundColor: C.blueDark, paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 18, paddingHorizontal: 20 },
  backBtn:     { marginBottom: 6 },
  backTxt:     { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontWeight: '600' },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '900' },
  headerId:    { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 3 },

  card:        { backgroundColor: C.white, borderRadius: 16, padding: 18, elevation: 1, borderWidth: 1, borderColor: C.border },
  cardTitleRow:{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle:   { fontSize: 15, fontWeight: '800', color: C.text },
  liveChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF2F2', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#FECACA' },
  liveDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: C.red },
  liveTxt:     { fontSize: 11, fontWeight: '700', color: C.red },

  statusCard:  { borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 2 },
  statusTitle: { fontSize: 22, fontWeight: '900' },

  routeRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  routeSide:   { flex: 1, alignItems: 'flex-start', gap: 4 },
  routeDot:    { width: 12, height: 12, borderRadius: 6 },
  routeLabel:  { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase' },
  routeCity:   { fontSize: 17, fontWeight: '900', color: C.text },
  routeArrow:  { fontSize: 26 },
  routeKm:     { fontSize: 11, fontWeight: '700', color: '#16A34A', marginTop: 3, backgroundColor: '#F0FDF4', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },

  marchaRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  marchaIconBox: { width: 56, height: 56, borderRadius: 14, backgroundColor: C.blueLight, alignItems: 'center', justifyContent: 'center' },
  marchaType:  { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 4 },
  marchaMeta:  { fontSize: 13, color: C.muted, fontWeight: '600', marginTop: 2 },
  descBox:     { backgroundColor: C.bg, borderRadius: 10, padding: 12 },
  descTxt:     { fontSize: 14, color: C.text, lineHeight: 20 },

  clientRow:   { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  clientAvatar:{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.orangeLight, alignItems: 'center', justifyContent: 'center' },
  clientName:  { fontSize: 16, fontWeight: '800', color: C.text },
  clientMeta:  { fontSize: 13, color: C.muted, marginTop: 3 },
  callBtn:     { backgroundColor: C.greenLight, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1.5, borderColor: '#BBF7D0' },
  callBtnTxt:  { fontSize: 15, fontWeight: '700', color: C.green },

  actionBtn:   { borderRadius: 16, paddingVertical: 18, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6 },
  actionBtnTxt:{ color: 'white', fontSize: 17, fontWeight: '900' },
  btnDisabled: { opacity: 0.65 },

  doneCard:    { backgroundColor: C.greenLight, borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 2, borderColor: '#BBF7D0' },
  doneTxt:     { fontSize: 22, fontWeight: '900', color: C.green, marginBottom: 6 },
  doneSub:     { fontSize: 14, color: C.green, textAlign: 'center' },

  takenCard:   { backgroundColor: C.bg, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1.5, borderColor: C.border },
  takenTxt:    { fontSize: 14, color: C.muted, textAlign: 'center', fontWeight: '600' },

  cancelCourseBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: C.red, backgroundColor: C.redLight },
  cancelCourseTxt: { fontSize: 15, fontWeight: '800', color: C.red },

  contactBtn:      { borderRadius: 14, paddingVertical: 15, alignItems: 'center', backgroundColor: C.blueLight, borderWidth: 2, borderColor: C.blue, flexDirection: 'row', justifyContent: 'center', gap: 8 },
  contactBtnTxt:   { fontSize: 15, fontWeight: '800', color: C.blue },
  msgBadge:        { backgroundColor: C.red, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  msgBadgeTxt:     { color: 'white', fontSize: 11, fontWeight: '900' },

  suspendedCard:   { backgroundColor: C.redLight, borderRadius: 18, padding: 24, alignItems: 'center', borderWidth: 2, borderColor: '#FECACA' },
  suspendedTitle:  { fontSize: 18, fontWeight: '900', color: C.red, marginBottom: 8 },
  suspendedTxt:    { fontSize: 14, fontWeight: '600', color: C.red, textAlign: 'center', lineHeight: 22 },
});

const of = StyleSheet.create({
  card:     { backgroundColor: C.white, borderRadius: 16, padding: 18, borderWidth: 2, borderColor: C.blue },
  title:    { fontSize: 16, fontWeight: '900', color: C.text, marginBottom: 4 },
  sub:      { fontSize: 13, color: C.muted, marginBottom: 16 },
  label:    { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 },
  input:    { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, color: C.text, marginBottom: 14 },
  sendBtn:  { backgroundColor: C.blue, borderRadius: 13, paddingVertical: 15, alignItems: 'center' },
  sendBtnTxt: { color: 'white', fontSize: 15, fontWeight: '800' },
  prix:     { fontSize: 24, fontWeight: '900', color: C.blue, marginBottom: 6 },
  msg:      { fontSize: 13, color: C.muted, fontStyle: 'italic', marginBottom: 12, lineHeight: 19 },
  badge:    { backgroundColor: C.bg, borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', marginBottom: 10 },
  badgeTxt: { fontSize: 14, fontWeight: '700', color: C.muted },
  callBtn:  { backgroundColor: C.greenLight, borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#BBF7D0' },
  callTxt:  { fontSize: 14, fontWeight: '700', color: C.green },
});

// ── Modal annulation course ──────────────────────────────────
const cm = StyleSheet.create({
  overlay:             { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:               { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28 },
  handle:              { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },
  title:               { fontSize: 20, fontWeight: '900', color: C.red, marginBottom: 8, textAlign: 'center' },
  sub:                 { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 18 },
  reasonLabel:         { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  reasonBtn:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg, marginBottom: 8 },
  reasonBtnSelected:   { borderColor: C.red, backgroundColor: C.redLight },
  reasonTxt:           { fontSize: 14, fontWeight: '600', color: C.text },
  reasonTxtSelected:   { color: C.red, fontWeight: '800' },
  check:               { fontSize: 16, color: C.red, fontWeight: '900' },
  confirmBtn:          { backgroundColor: C.red, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 10, marginBottom: 10, elevation: 3, shadowColor: C.red, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
  confirmBtnDisabled:  { backgroundColor: C.border, elevation: 0, shadowOpacity: 0 },
  confirmTxt:          { color: 'white', fontSize: 16, fontWeight: '900' },
  abandonBtn:          { alignItems: 'center', paddingVertical: 8 },
  abandonTxt:          { fontSize: 15, color: C.muted, fontWeight: '600' },
});

// ── Modal photo de livraison ─────────────────────────────────
const m = StyleSheet.create({
  overlay:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:            { backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 28 },
  handle:           { width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, alignSelf: 'center', marginBottom: 20 },

  title:            { fontSize: 20, fontWeight: '900', color: C.text, marginBottom: 8, textAlign: 'center' },
  sub:              { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },

  placeholder:      { height: 160, borderRadius: 16, borderWidth: 2, borderColor: C.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, marginBottom: 16, gap: 8 },
  placeholderTxt:   { fontSize: 14, color: C.muted, fontWeight: '600' },

  previewBox:       { position: 'relative', marginBottom: 16, borderRadius: 16, overflow: 'hidden' },
  preview:          { width: '100%', height: 200, borderRadius: 16 },
  retakeBtn:        { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  retakeTxt:        { color: 'white', fontSize: 12, fontWeight: '700' },

  sourceRow:        { flexDirection: 'row', gap: 12, marginBottom: 20 },
  sourceBtn:        { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 16, borderWidth: 2, backgroundColor: C.bg, gap: 6 },
  sourceTxt:        { fontSize: 14, fontWeight: '800' },

  confirmBtn:       { backgroundColor: C.green, borderRadius: 16, paddingVertical: 17, alignItems: 'center', marginBottom: 12, elevation: 3, shadowColor: C.green, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6 },
  confirmBtnDisabled: { backgroundColor: C.border, elevation: 0, shadowOpacity: 0 },
  confirmTxt:       { color: 'white', fontSize: 16, fontWeight: '900' },

  cancelBtn:        { alignItems: 'center', paddingVertical: 10 },
  cancelTxt:        { fontSize: 15, color: C.muted, fontWeight: '600' },
});
