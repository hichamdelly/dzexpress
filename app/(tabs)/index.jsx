import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, ActivityIndicator,
  Alert, KeyboardAvoidingView, RefreshControl,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useApp } from '../../src/context/AppContext';
import { demandesDB } from '../../src/db/database';
import { getDistanceKm, fmtKm, WILAYA_COORDS } from '../../src/utils/wilayas';
import { calculerPrix, calculerSurge, fmtPrix, TARIFS_BASE } from '../../src/utils/pricing';
import CityInput from '../../src/components/CityInput';
import { useReservation } from '../../src/context/ReservationContext';

function _haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, toR = d => d * Math.PI / 180;
  const a =
    Math.sin(toR(lat2 - lat1) / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) *
    Math.sin(toR(lng2 - lng1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestWilaya(lat, lng, canonicalList) {
  let best = null, bestDist = Infinity;
  for (const name of canonicalList) {
    const c = WILAYA_COORDS[name];
    if (!c) continue;
    const d = _haversine(lat, lng, c.lat, c.lng);
    if (d < bestDist) { bestDist = d; best = name; }
  }
  return best;
}

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
  warning: '#F59E0B', warningLight: '#FFFBEB',
};

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

const TYPES_MARCHANDISE = [
  { key: 'meubles',        label: 'Meubles',        icon: 'grid-outline' },
  { key: 'electromenager', label: 'Électroménager', icon: 'tv-outline' },
  { key: 'cartons',        label: 'Cartons',         icon: 'cube-outline' },
  { key: 'alimentation',   label: 'Alimentation',   icon: 'basket-outline' },
  { key: 'materiaux',      label: 'Matériaux BTP',   icon: 'construct-outline' },
  { key: 'vehicule',       label: 'Véhicule',        icon: 'car-outline' },
  { key: 'autre',          label: 'Autre',           icon: 'ellipsis-horizontal-circle-outline' },
];

const CRENEAUX = [
  { key: 'matin',      label: 'Matin',      sub: '06h – 12h',   icon: 'sunny-outline' },
  { key: 'apres-midi', label: 'Après-midi', sub: '12h – 18h',   icon: 'partly-sunny-outline' },
  { key: 'soir',       label: 'Soir',       sub: '18h – 22h',   icon: 'moon-outline' },
  { key: 'flexible',   label: 'Flexible',   sub: 'Peu importe', icon: 'time-outline' },
];

const SOUS_CATEGORIES = {
  meubles: [
    { key: 'lit',       label: 'Lit',              veh: 'fourgon' },
    { key: 'canape',    label: 'Canapé',            veh: 'fourgon' },
    { key: 'armoire',   label: 'Armoire',           veh: 'camion35' },
    { key: 'table',     label: 'Table & Chaises',   veh: 'fourgon' },
    { key: 'salon',     label: 'Salon complet',     veh: 'camion35' },
    { key: 'appart',    label: 'Tout l\'appart',    veh: 'camion35', warn: 'Un déménagement complet nécessite généralement un camion 3.5T. Prévoir 2–3h de chargement minimum.' },
  ],
  electromenager: [
    { key: 'frigo',     label: 'Réfrigérateur',     veh: 'fourgon' },
    { key: 'machine',   label: 'Machine à laver',   veh: 'fourgon' },
    { key: 'clim',      label: 'Climatiseur',       veh: 'fourgon' },
    { key: 'tv',        label: 'TV / Écran',        veh: 'fourgon' },
    { key: 'plusieurs', label: 'Plusieurs gros appareils', veh: 'camion35' },
  ],
  cartons: [
    { key: 'petit',     label: '< 10 cartons',      veh: 'fourgon' },
    { key: 'moyen',     label: '10 – 30 cartons',   veh: 'fourgon' },
    { key: 'grand',     label: '> 30 cartons',      veh: 'camion35' },
  ],
  alimentation: [
    { key: 'fruits_legumes', label: 'Fruits & Légumes (cageots)', veh: ['herbine', 'utilitaire'] },
    { key: 'epicerie',       label: 'Produits alimentaires',       veh: 'utilitaire' },
    { key: 'vrac_alim',      label: 'Grande quantité',            veh: 'fourgon' },
    { key: 'surgeles',       label: 'Surgelés / Réfrigérés',      veh: 'fourgon',
      warn: 'Les produits surgelés nécessitent un véhicule frigorifique. Mentionne cette exigence dans la description pour filtrer les transporteurs équipés.' },
  ],
  materiaux: [
    { key: 'sable',     label: 'Sable / Gravier',   veh: 'camion10', warn: 'Le sable et gravier en vrac nécessitent un camion benne 10T minimum. Précise la quantité en tonnes.' },
    { key: 'briques',   label: 'Briques / Parpaings', veh: 'camion10' },
    { key: 'fer',       label: 'Fer à béton',        veh: 'camion35', warn: 'Le fer à béton est long et lourd — précise absolument les dimensions dans la description.' },
    { key: 'carrelage', label: 'Carrelage',           veh: 'fourgon' },
    { key: 'autre_btp', label: 'Autre BTP',           veh: 'camion35' },
  ],
  vehicule: [
    { key: 'voiture',   label: 'Voiture',            veh: 'semi', warn: 'Le transport de voitures nécessite un plateau ou semi-remorque équipé. Vérifie que le transporteur dispose du matériel adéquat.' },
    { key: 'moto',      label: 'Moto / Scooter',     veh: 'fourgon' },
    { key: 'camion_l',  label: 'Camion léger',       veh: 'semi', warn: 'Pour les véhicules lourds, assure-toi que le transporteur possède un plateau homologué.' },
  ],
  autre: [],
};

const VEH_LABELS = {
  herbine:    'Herbine',
  utilitaire: 'Utilitaire léger',
  fourgon:    'Fourgon',
  camion35:   'Camion 3.5T',
  camion10:   'Camion 10T',
  semi:       'Semi-remorque / Plateau',
};
const VEH_ICONS = {
  herbine:    'cart-outline',
  utilitaire: 'car-outline',
  fourgon:    'car-sport-outline',
  camion35:   'bus-outline',
  camion10:   'cube-outline',
  semi:       'construct-outline',
};

function Logo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={ls.badge}><Text style={ls.dz}>Dz</Text></View>
      <Text style={ls.express}>Express</Text>
    </View>
  );
}
const ls = StyleSheet.create({
  badge:   { backgroundColor: C.accent, borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2, marginRight: 4 },
  dz:      { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  express: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
});

// ════════════════════════════════════════════════════════════
// ── EXPÉDITEUR ───────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function ExpéditeurHome({ user }) {
  const router = useRouter();
  const { setField } = useReservation();

  const [mode, setMode]           = useState('instantane');
  const [depart, setDepart]       = useState('');
  const [arrivee, setArrivee]     = useState('');
  const [type, setType]           = useState('');
  const [poids, setPoids]         = useState('');
  const [desc, setDesc]           = useState('');
  const [date, setDate]           = useState(null);
  const [heure, setHeure]         = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving]       = useState(false);

  const [etages,  setEtages]  = useState(0);
  const [aide,    setAide]    = useState(false);
  const [fragile, setFragile] = useState(false);
  const [express, setExpress] = useState(false);
  const [showPrixDetail, setShowPrixDetail] = useState(false);

  const [sousCategorie, setSousCategorie] = useState('');

  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsKey, setGpsKey]         = useState(0);

  const detectPosition = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Active la localisation dans les paramètres.');
        return;
      }
      const pos     = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const wilaya  = nearestWilaya(pos.coords.latitude, pos.coords.longitude, WILAYAS);
      if (wilaya) { setDepart(wilaya); setGpsKey(k => k + 1); }
      else Alert.alert('Position introuvable', 'Saisis ta ville manuellement.');
    } catch {
      Alert.alert('GPS échoué', 'Vérifie que le GPS est activé.');
    } finally {
      setGpsLoading(false);
    }
  };

  const getCreneau = (h) => {
    if (!h) return 'flexible';
    const hr = h.getHours();
    if (hr >= 6  && hr < 12) return 'matin';
    if (hr >= 12 && hr < 18) return 'apres-midi';
    if (hr >= 18 && hr < 22) return 'soir';
    return 'flexible';
  };

  const fmtHeureLabel = (h) => h
    ? h.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const reset = () => {
    setDepart(''); setArrivee(''); setType(''); setSousCategorie('');
    setPoids(''); setDesc(''); setDate(null); setHeure(null);
    setEtages(0); setAide(false); setFragile(false); setExpress(false);
    setGpsKey(k => k + 1);
  };

  const ouvrirCarte = () => {
    setField('mode', 'instantane');
    router.push('/reservation/depart-arrivee');
  };

  const handlePublier = () => {
    setField('mode', 'planifie');
    router.push('/reservation/depart-arrivee');
  };

  const fmtDateLabel = (d) => d
    ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <Logo />
        <View style={s.headerBadge}>
          <Ionicons name="cube-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={s.headerBadgeTxt}>Expéditeur</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
      >
        <View style={s.formCard}>
          {/* Sélecteur mode */}
          <Text style={s.whenTitle}>Quand avez-vous besoin du transport ?</Text>
          <View style={s.modeCards}>
            <TouchableOpacity
              style={[s.modeCard, mode === 'instantane' && s.modeCardActive]}
              onPress={() => setMode('instantane')} activeOpacity={0.85}
            >
              <Ionicons name="flash" size={22} color={mode === 'instantane' ? '#FFFFFF' : C.muted} />
              <Text style={[s.modeCardTitle, mode === 'instantane' && { color: '#FFFFFF' }]}>Maintenant</Text>
              <Text style={[s.modeCardSub, mode === 'instantane' && { color: 'rgba(255,255,255,0.6)' }]}>Choix direct du transporteur</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeCard, mode === 'planifie' && s.modeCardActive]}
              onPress={() => { setMode('planifie'); }} activeOpacity={0.85}
            >
              <Ionicons name="calendar-outline" size={22} color={mode === 'planifie' ? '#FFFFFF' : C.muted} />
              <Text style={[s.modeCardTitle, mode === 'planifie' && { color: '#FFFFFF' }]}>Choisir une heure</Text>
              <Text style={[s.modeCardSub, mode === 'planifie' && { color: 'rgba(255,255,255,0.6)' }]}>Publier pour recevoir des offres</Text>
            </TouchableOpacity>
          </View>

          {mode === 'instantane' && (
            <View style={s.urgenceBanner}>
              <Ionicons name="flash" size={14} color={C.error} style={{ marginRight: 6 }} />
              <Text style={s.urgenceTxt}>
                Ta demande sera marquée <Text style={{ fontWeight: '900' }}>URGENT</Text> — les transporteurs la verront en priorité
              </Text>
            </View>
          )}

          <Text style={s.formTitle}>Nouvelle demande</Text>
          <Text style={s.formSub}>
            {mode === 'instantane' ? 'Transport à effectuer dès maintenant' : 'Planifie à la date et l\'heure souhaitées'}
          </Text>

          {/* Route */}
          <View style={s.routeBlock}>
            <View style={s.gpsLabelRow}>
              <Text style={s.fieldLabel}>Ville de départ</Text>
              <TouchableOpacity
                style={[s.gpsBtn, gpsLoading && { opacity: 0.6 }]}
                onPress={detectPosition} disabled={gpsLoading}
              >
                {gpsLoading
                  ? <ActivityIndicator size="small" color={C.accent} />
                  : <>
                      <Ionicons name="locate-outline" size={13} color={C.accent} />
                      <Text style={s.gpsBtnTxt}>Ma position</Text>
                    </>
                }
              </TouchableOpacity>
            </View>

            {depart && gpsKey > 0 && (
              <View style={s.gpsFillBadge}>
                <Ionicons name="location" size={14} color={C.success} style={{ marginRight: 6 }} />
                <Text style={s.gpsFillTxt}>{depart}</Text>
                <TouchableOpacity onPress={() => { setDepart(''); setGpsKey(k => k + 1); }}>
                  <Ionicons name="close-circle" size={17} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            )}

            <CityInput
              key={`depart-${gpsKey}`}
              value={depart}
              onChange={setDepart}
              accentColor={C.accent}
              zIndex={20}
              placeholder="Commune ou wilaya de départ…"
            />

            <View style={s.routeDivider}>
              <View style={s.routeLine} />
              <View style={s.routeIconBox}>
                <Ionicons name="arrow-down" size={14} color={C.muted} />
              </View>
              <View style={s.routeLine} />
            </View>

            <Text style={s.fieldLabel}>Ville d'arrivée</Text>
            <CityInput
              value={arrivee}
              onChange={setArrivee}
              accentColor={C.accent}
              zIndex={19}
              placeholder="Commune ou wilaya d'arrivée…"
            />
          </View>

          {/* Widget estimation de prix */}
          {depart && arrivee && (() => {
            const km    = getDistanceKm(depart, arrivee);
            if (!km) return null;
            const nbAct = demandesDB.countActives();
            const surge = calculerSurge(nbAct);
            const opts  = { etages, aide, fragile, express, nbActives: nbAct };
            const estims = Object.entries(TARIFS_BASE).map(([veh]) => ({ veh, px: calculerPrix(km, veh, opts) }));
            const fourgon = estims[0].px;
            return (
              <View style={px.box}>
                <View style={px.headerRow}>
                  <Ionicons name="wallet-outline" size={14} color={C.success} style={{ marginRight: 6 }} />
                  <Text style={px.title}>Estimation de prix</Text>
                  {surge.isForteDemande && (
                    <View style={px.surgeBadge}>
                      <Ionicons name="flame" size={10} color={C.error} style={{ marginRight: 3 }} />
                      <Text style={px.surgeTxt}>Forte demande</Text>
                    </View>
                  )}
                </View>
                {surge.label && (
                  <View style={px.surgeRow}>
                    <Ionicons name="flash" size={12} color={C.accent} style={{ marginRight: 5 }} />
                    <Text style={px.surgeLabel}>{surge.label} (+{surge.pct}%)</Text>
                  </View>
                )}
                {estims.map(({ veh, px: p }) => (
                  <View key={veh} style={px.row}>
                    <Text style={px.vehTxt}>{TARIFS_BASE[veh].label}</Text>
                    <Text style={px.rangeTxt}>{fmtPrix(p.min)} – {fmtPrix(p.max)}</Text>
                  </View>
                ))}
                <TouchableOpacity style={px.detailBtn} onPress={() => setShowPrixDetail(v => !v)}>
                  <Ionicons name={showPrixDetail ? 'chevron-up' : 'chevron-down'} size={12} color={C.success} style={{ marginRight: 4 }} />
                  <Text style={px.detailBtnTxt}>Voir le détail du calcul</Text>
                </TouchableOpacity>
                {showPrixDetail && (
                  <View style={px.detail}>
                    <Text style={px.detailLine}>{fourgon.detail.km} km × {fourgon.detail.tarifKm} DA/km</Text>
                    <Text style={px.detailLine}>Prise en charge : {fmtPrix(fourgon.detail.priseEnCharge)}</Text>
                    <Text style={px.detailLine}>Base : {fmtPrix(fourgon.detail.baseAvantSurge)}</Text>
                    {fourgon.detail.surgePct > 0 && (
                      <Text style={[px.detailLine, { color: C.accent }]}>Surge ×{fourgon.surgeCoefficient.toFixed(2)} (+{fourgon.detail.surgePct}%)</Text>
                    )}
                    {fourgon.detail.fraisEtages > 0 && (
                      <Text style={px.detailLine}>Étages : +{fmtPrix(fourgon.detail.fraisEtages)}</Text>
                    )}
                    {fourgon.detail.fraisAide > 0 && <Text style={px.detailLine}>Aide chargement : +500 DA</Text>}
                    {fourgon.detail.fragile && <Text style={px.detailLine}>Fragile : +20%</Text>}
                    {fourgon.detail.express && <Text style={px.detailLine}>Express : +40%</Text>}
                    <Text style={[px.detailLine, { fontWeight: '900', color: C.primary, marginTop: 4 }]}>
                      Total fourgon : {fmtPrix(fourgon.min)} – {fmtPrix(fourgon.max)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })()}

          {/* Type de marchandise */}
          <Text style={s.fieldLabel}>Type de marchandise</Text>
          <View style={s.typeGrid}>
            {TYPES_MARCHANDISE.map(t => {
              const active = type === t.key;
              return (
                <TouchableOpacity
                  key={t.key}
                  style={[s.typeBtn, active && s.typeBtnActive]}
                  onPress={() => { setType(t.key); setSousCategorie(''); }} activeOpacity={0.8}
                >
                  <Ionicons name={t.icon} size={26} color={active ? C.accent : '#9CA3AF'} />
                  <Text style={[s.typeTxt, active && { color: C.accent, fontWeight: '700' }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sous-catégorie */}
          {(() => {
            const scList = type ? SOUS_CATEGORIES[type] : null;
            if (!scList?.length) return null;
            const scInfo   = scList.find(s => s.key === sousCategorie);
            const vehRec   = scInfo?.veh;
            const vehRecArr = vehRec ? (Array.isArray(vehRec) ? vehRec : [vehRec]) : [];
            const avertissement = scInfo?.warn;
            return (
              <>
                <Text style={s.fieldLabel}>Précise le type</Text>
                <View style={sc.chipRow}>
                  {scList.map(sc_ => {
                    const active = sousCategorie === sc_.key;
                    return (
                      <TouchableOpacity
                        key={sc_.key}
                        style={[sc.chip, active && sc.chipActive]}
                        onPress={() => setSousCategorie(active ? '' : sc_.key)}
                        activeOpacity={0.8}
                      >
                        {active && (
                          <Ionicons name="checkmark-circle" size={13} color={C.accent} style={{ marginRight: 4 }} />
                        )}
                        <Text style={[sc.chipTxt, active && sc.chipTxtActive]}>{sc_.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {vehRecArr.length > 0 && (
                  <View style={vr.box}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                      <Ionicons name="checkmark-circle" size={14} color={C.success} style={{ marginRight: 6 }} />
                      <Text style={vr.title}>
                        {vehRecArr.length > 1 ? 'Véhicules recommandés' : 'Véhicule recommandé'}
                      </Text>
                    </View>
                    <View style={vr.grid}>
                      {Object.keys(VEH_LABELS).map(key => {
                        const isRec = vehRecArr.includes(key);
                        return (
                          <View key={key} style={[vr.card, isRec && vr.cardSelected]}>
                            <Ionicons name={VEH_ICONS[key]} size={22} color={isRec ? C.accent : '#9CA3AF'} />
                            <Text style={[vr.cardLabel, isRec && { color: C.accent, fontWeight: '800' }]}>
                              {VEH_LABELS[key]}
                            </Text>
                            {isRec && (
                              <View style={vr.recBadge}>
                                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {avertissement && (
                  <View style={wn.box}>
                    <Ionicons name="warning-outline" size={18} color="#92400E" style={{ marginRight: 10, marginTop: 1, flexShrink: 0 }} />
                    <Text style={wn.txt}>{avertissement}</Text>
                  </View>
                )}
              </>
            );
          })()}

          {/* Poids */}
          <Text style={s.fieldLabel}>Poids estimé</Text>
          <TextInput
            style={s.input}
            placeholder="Ex : 500 kg, 2 tonnes…"
            placeholderTextColor="#9CA3AF"
            value={poids} onChangeText={setPoids}
          />

          {/* Date & Heure (mode planifie) */}
          {mode === 'planifie' && (
            <>
              <Text style={s.fieldLabel}>Date & heure</Text>
              <View style={s.dtRow}>
                <TouchableOpacity
                  style={[s.dtBtn, date && s.dtBtnFilled]}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="calendar-outline" size={16} color={date ? C.primary : '#9CA3AF'} style={{ marginRight: 7 }} />
                  <Text style={[s.dtBtnTxt, !date && { color: '#9CA3AF' }]} numberOfLines={1}>
                    {fmtDateLabel(date) ?? 'Choisir une date'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.dtBtn, heure && s.dtBtnFilled, { flex: 0.55 }]}
                  onPress={() => setShowTimePicker(true)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="time-outline" size={16} color={heure ? C.primary : '#9CA3AF'} style={{ marginRight: 7 }} />
                  <Text style={[s.dtBtnTxt, !heure && { color: '#9CA3AF' }]}>
                    {fmtHeureLabel(heure) ?? 'Heure'}
                  </Text>
                </TouchableOpacity>
              </View>

              {date && heure && (
                <View style={s.dtSummary}>
                  <Ionicons name={CRENEAUX.find(c => c.key === getCreneau(heure))?.icon || 'time-outline'} size={13} color={C.success} style={{ marginRight: 6 }} />
                  <Text style={s.dtSummaryTxt}>
                    {fmtDateLabel(date)} à {fmtHeureLabel(heure)} · créneau {CRENEAUX.find(c => c.key === getCreneau(heure))?.label}
                  </Text>
                </View>
              )}

              {showDatePicker && (
                <DateTimePicker
                  value={date || new Date()}
                  mode="date"
                  minimumDate={new Date()}
                  display={Platform.OS === 'ios' ? 'inline' : 'default'}
                  onChange={(evt, d) => {
                    if (Platform.OS !== 'ios') setShowDatePicker(false);
                    if (d) setDate(d);
                  }}
                  style={{ marginBottom: 8 }}
                />
              )}
              {Platform.OS === 'ios' && showDatePicker && (
                <TouchableOpacity style={s.dtPickerDone} onPress={() => setShowDatePicker(false)}>
                  <Text style={s.dtPickerDoneTxt}>Valider la date</Text>
                </TouchableOpacity>
              )}

              {showTimePicker && (
                <DateTimePicker
                  value={heure || new Date()}
                  mode="time"
                  is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(evt, d) => {
                    if (Platform.OS !== 'ios') setShowTimePicker(false);
                    if (d) setHeure(d);
                  }}
                  style={{ marginBottom: 8 }}
                />
              )}
              {Platform.OS === 'ios' && showTimePicker && (
                <TouchableOpacity style={s.dtPickerDone} onPress={() => setShowTimePicker(false)}>
                  <Text style={s.dtPickerDoneTxt}>Valider l'heure</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Options supplémentaires */}
          <Text style={s.fieldLabel}>Options</Text>
          <View style={opt.section}>
            <View style={opt.row}>
              <View style={opt.optIcon}><Ionicons name="business-outline" size={17} color={C.muted} /></View>
              <View style={{ flex: 1 }}>
                <Text style={opt.optTitle}>Étages sans ascenseur</Text>
                <Text style={opt.optSub}>+200 DA par étage (max 5)</Text>
              </View>
              <View style={opt.counter}>
                <TouchableOpacity style={opt.counterBtn} onPress={() => setEtages(Math.max(0, etages - 1))}>
                  <Text style={opt.counterBtnTxt}>−</Text>
                </TouchableOpacity>
                <Text style={opt.counterVal}>{etages}</Text>
                <TouchableOpacity style={opt.counterBtn} onPress={() => setEtages(Math.min(5, etages + 1))}>
                  <Text style={opt.counterBtnTxt}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <OptionToggle
              icon="people-outline"
              title="Aide au chargement/déchargement"
              sub="+500 DA"
              value={aide} onToggle={() => setAide(v => !v)}
            />
            <OptionToggle
              icon="warning-outline"
              title="Marchandise fragile"
              sub="+20% sur le total"
              value={fragile} onToggle={() => setFragile(v => !v)}
            />
            <OptionToggle
              icon="flash-outline"
              title="Livraison express (<2h)"
              sub="+40% sur le total"
              value={express} onToggle={() => setExpress(v => !v)}
              last
            />
          </View>

          {/* Description */}
          <Text style={s.fieldLabel}>Description</Text>
          <TextInput
            style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
            placeholder="Dimensions, fragilité, accès difficile…"
            placeholderTextColor="#9CA3AF"
            value={desc} onChangeText={setDesc} multiline
          />

          {mode === 'instantane' ? (
            <TouchableOpacity style={s.submitBtn} onPress={ouvrirCarte} activeOpacity={0.88}>
              <Ionicons name="map-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
              <View>
                <Text style={s.submitBtnTxt}>Voir les transporteurs</Text>
                <Text style={s.submitBtnSub}>Choisis sur la carte</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.submitBtn, saving && { opacity: 0.6 }]}
              onPress={handlePublier} disabled={saving} activeOpacity={0.88}
            >
              {saving
                ? <ActivityIndicator color="#FFFFFF" />
                : <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <View>
                      <Text style={s.submitBtnTxt}>Publier dans la marketplace</Text>
                      <Text style={s.submitBtnSub}>Les transporteurs feront des offres</Text>
                    </View>
                  </>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Comment ça marche */}
        <View style={s.infoBox}>
          <Text style={s.infoTitle}>Comment ça marche ?</Text>
          {[
            { icon: 'create-outline',        txt: 'Tu publies une demande (urgente ou planifiée)' },
            { icon: 'notifications-outline', txt: 'Les transporteurs disponibles la voient' },
            { icon: 'chatbubble-outline',     txt: 'Un transporteur te fait une offre de prix' },
            { icon: 'checkmark-circle-outline', txt: 'Tu acceptes et il vient chercher ta marchandise' },
          ].map((item, i) => (
            <View key={i} style={s.infoStep}>
              <Ionicons name={item.icon} size={16} color={C.accent} style={{ marginRight: 10, marginTop: 1 }} />
              <Text style={s.infoStepTxt}>{item.txt}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

    </KeyboardAvoidingView>
  );
}

function OptionToggle({ icon, title, sub, value, onToggle, last }) {
  return (
    <TouchableOpacity style={[opt.row, last && { borderBottomWidth: 0 }]} onPress={onToggle} activeOpacity={0.8}>
      <View style={opt.optIcon}><Ionicons name={icon} size={17} color={C.muted} /></View>
      <View style={{ flex: 1 }}>
        <Text style={opt.optTitle}>{title}</Text>
        <Text style={opt.optSub}>{sub}</Text>
      </View>
      <View style={[opt.toggle, value && { backgroundColor: C.success }]}>
        <View style={[opt.thumb, value && { alignSelf: 'flex-end' }]} />
      </View>
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════════════
// ── TRANSPORTEUR ─────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function TransporteurHome({ user }) {
  const router = useRouter();

  const [demandes, setDemandes]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [urgFilter, setUrgFilter]   = useState('tous');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchDemandes = useCallback(() => {
    try {
      setDemandes(demandesDB.getDisponibles(urgFilter !== 'tous' ? urgFilter : null));
    } catch (e) { console.log('fetch error:', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [urgFilter]);

  useState(() => { fetchDemandes(); }, []);

  const onUrgFilterChange = (val) => {
    setUrgFilter(val);
    setLoading(true);
    try {
      setDemandes(demandesDB.getDisponibles(val !== 'tous' ? val : null));
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); }
  };

  const displayed     = typeFilter ? demandes.filter(d => d.type_marchandise === typeFilter) : demandes;
  const urgentCount   = demandes.filter(d => d.type_demande === 'maintenant').length;
  const planifieCount = demandes.filter(d => d.type_demande === 'planifie').length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      <View style={s.header}>
        <Logo />
        <View style={[s.headerBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Ionicons name="car-sport-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={s.headerBadgeTxt}>{demandes.length} demande{demandes.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Filtre Urgent / Planifié / Tous */}
      <View style={s.urgFilterBar}>
        {[
          { key: 'tous',       iconName: 'search-outline',   label: 'Tous',     count: demandes.length },
          { key: 'maintenant', iconName: 'flash-outline',    label: 'Urgent',   count: urgentCount },
          { key: 'planifie',   iconName: 'calendar-outline', label: 'Planifié', count: planifieCount },
        ].map(f => {
          const active = urgFilter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[s.urgBtn, active && s.urgBtnActive]}
              onPress={() => onUrgFilterChange(f.key)} activeOpacity={0.85}
            >
              <Ionicons name={f.iconName} size={14} color={active ? '#FFFFFF' : C.muted} />
              <Text style={[s.urgBtnTxt, active && { color: '#FFFFFF' }]}>{f.label}</Text>
              {f.count > 0 && (
                <View style={[s.urgCount, active && { backgroundColor: 'rgba(255,255,255,0.25)' }]}>
                  <Text style={[s.urgCountTxt, active && { color: '#FFFFFF' }]}>{f.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Filtre type marchandise */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.typeFilterBar}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10, gap: 7 }}>
        <TouchableOpacity style={[s.typeChip, !typeFilter && s.typeChipActive]} onPress={() => setTypeFilter('')}>
          <Text style={[s.typeChipTxt, !typeFilter && { color: '#FFFFFF' }]}>Tout</Text>
        </TouchableOpacity>
        {TYPES_MARCHANDISE.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.typeChip, typeFilter === t.key && s.typeChipActive]}
            onPress={() => setTypeFilter(typeFilter === t.key ? '' : t.key)}
          >
            <Ionicons name={t.icon} size={13} color={typeFilter === t.key ? '#FFFFFF' : C.muted} style={{ marginRight: 4 }} />
            <Text style={[s.typeChipTxt, typeFilter === t.key && { color: '#FFFFFF' }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : displayed.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}>
            <Ionicons name={urgFilter === 'maintenant' ? 'flash-outline' : urgFilter === 'planifie' ? 'calendar-outline' : 'search-outline'} size={32} color="#D1D5DB" />
          </View>
          <Text style={s.emptyTitle}>
            {urgFilter === 'maintenant' ? 'Aucune urgence' : urgFilter === 'planifie' ? 'Aucune planifiée' : 'Aucune demande'}
          </Text>
          <Text style={s.emptyDesc}>Reviens dans quelques minutes</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 90 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDemandes(); }} tintColor={C.primary} />
          }
        >
          <Text style={s.countTxt}>{displayed.length} demande{displayed.length > 1 ? 's' : ''}</Text>
          {displayed.map(d => (
            <DemandeCard key={d.id} demande={d} onPress={() => router.push(`/course/${d.id}`)} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function DemandeCard({ demande: d, onPress }) {
  const isUrgent    = d.type_demande === 'maintenant';
  const typeInfo    = TYPES_MARCHANDISE.find(t => t.key === d.type_marchandise);
  const creneauInfo = CRENEAUX.find(c => c.key === d.creneau);
  const distKm      = getDistanceKm(d.ville_depart, d.ville_arrivee);

  return (
    <TouchableOpacity style={[s.card, isUrgent && s.cardUrgent]} onPress={onPress} activeOpacity={0.88}>
      {isUrgent && (
        <View style={s.urgentBanner}>
          <Ionicons name="flash" size={12} color={C.error} style={{ marginRight: 6 }} />
          <Text style={s.urgentBannerTxt}>URGENT — Transport immédiat</Text>
        </View>
      )}

      <View style={s.cardTop}>
        <View style={[s.cardIconBox, { backgroundColor: isUrgent ? C.errorLight : C.bgAlt }]}>
          <Ionicons name={typeInfo?.icon || 'cube-outline'} size={26} color={isUrgent ? C.error : C.muted} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.cardTypeTxt}>{typeInfo?.label || d.type_marchandise}</Text>
          <View style={s.routeRowInner}>
            <Text style={s.cityFrom}>{d.ville_depart}</Text>
            <Ionicons name="arrow-forward" size={13} color={C.muted} style={{ marginHorizontal: 5 }} />
            <Text style={s.cityTo}>{d.ville_arrivee}</Text>
          </View>
        </View>
        {d.nb_offres > 0 && (
          <View style={s.offreBadge}>
            <Text style={s.offreBadgeTxt}>{d.nb_offres} offre{d.nb_offres > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      <View style={s.cardMeta}>
        {isUrgent ? (
          <View style={[s.metaChip, { backgroundColor: C.errorLight, borderColor: '#FCA5A5' }]}>
            <Ionicons name="flash" size={11} color={C.error} style={{ marginRight: 3 }} />
            <Text style={[s.metaChipTxt, { color: C.error }]}>Maintenant</Text>
          </View>
        ) : (
          <>
            <View style={s.metaChip}>
              <Ionicons name="calendar-outline" size={11} color={C.muted} style={{ marginRight: 3 }} />
              <Text style={s.metaChipTxt}>{d.date_souhaitee}</Text>
            </View>
            {creneauInfo && (
              <View style={s.metaChip}>
                <Ionicons name={creneauInfo.icon} size={11} color={C.muted} style={{ marginRight: 3 }} />
                <Text style={s.metaChipTxt}>{creneauInfo.label}</Text>
              </View>
            )}
          </>
        )}
        {distKm != null && (
          <View style={[s.metaChip, { backgroundColor: C.successLight, borderColor: '#6EE7B7' }]}>
            <Ionicons name="navigate-outline" size={11} color={C.success} style={{ marginRight: 3 }} />
            <Text style={[s.metaChipTxt, { color: C.success }]}>{fmtKm(distKm)}</Text>
          </View>
        )}
        {d.poids && (
          <View style={s.metaChip}>
            <Ionicons name="scale-outline" size={11} color={C.muted} style={{ marginRight: 3 }} />
            <Text style={s.metaChipTxt}>{d.poids}</Text>
          </View>
        )}
      </View>

      {d.prix_estime > 0 && (
        <View style={s.prixChip}>
          <Ionicons name="cash-outline" size={12} color={C.success} style={{ marginRight: 5 }} />
          <Text style={s.prixChipTxt}>À partir de {fmtPrix(d.prix_estime)}</Text>
        </View>
      )}

      <View style={s.cardFooter}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="person-outline" size={13} color={C.muted} style={{ marginRight: 5 }} />
          <Text style={s.clientTxt}>{d.expediteur_nom}</Text>
        </View>
        <View style={s.voirDetail}>
          <Text style={s.voirDetailTxt}>Voir</Text>
          <Ionicons name="chevron-forward" size={14} color={C.primary} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const { user, loading } = useApp();
  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>;
  if (!user) return <Redirect href="/onboarding" />;
  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
{user.type === 'expediteur' ? <ExpéditeurHome user={user} /> : <TransporteurHome user={user} />}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 32, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6, textAlign: 'center' },
  emptyDesc:  { fontSize: 14, color: C.muted, textAlign: 'center' },
  countTxt:   { fontSize: 13, color: C.muted, marginBottom: 4 },

  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 18, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerBadge:    { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 50 },
  headerBadgeTxt: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  urgFilterBar: { flexDirection: 'row', backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  urgBtn:       { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 10, backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border },
  urgBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  urgBtnTxt:    { fontSize: 12, fontWeight: '700', color: C.muted },
  urgCount:     { borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, backgroundColor: C.border },
  urgCountTxt:  { fontSize: 10, fontWeight: '700', color: C.muted },

  typeFilterBar: { backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0 },
  typeChip:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 50, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg },
  typeChipActive:{ backgroundColor: C.primary, borderColor: C.primary },
  typeChipTxt:   { fontSize: 12, fontWeight: '600', color: C.muted },

  formCard: { backgroundColor: C.bg, borderRadius: 12, padding: 18, elevation: 2, borderWidth: 1, borderColor: C.border, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06 },

  whenTitle:     { fontSize: 13, fontWeight: '800', color: C.text, marginBottom: 10, letterSpacing: -0.1 },
  modeCards:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeCard:      { flex: 1, alignItems: 'center', paddingVertical: 16, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt, gap: 5 },
  modeCardActive:{ backgroundColor: C.primary, borderColor: C.primary },
  modeCardTitle: { fontSize: 13, fontWeight: '800', color: C.muted },
  modeCardSub:   { fontSize: 10, color: C.muted, textAlign: 'center', paddingHorizontal: 6, lineHeight: 14 },

  dtRow:         { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dtBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 13 },
  dtBtnFilled:   { borderColor: C.primary, backgroundColor: C.bg },
  dtBtnTxt:      { fontSize: 13, fontWeight: '600', color: C.text, flex: 1 },
  dtSummary:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#6EE7B7' },
  dtSummaryTxt:  { fontSize: 12, color: C.success, fontWeight: '700', flex: 1 },
  dtPickerDone:  { backgroundColor: C.primary, borderRadius: 50, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  dtPickerDoneTxt: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  urgenceBanner: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: C.errorLight, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#FCA5A5' },
  urgenceTxt:    { fontSize: 13, color: C.error, lineHeight: 19, flex: 1 },

  formTitle: { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 3, letterSpacing: -0.3 },
  formSub:   { fontSize: 13, color: C.muted, marginBottom: 18 },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input:      { backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, marginBottom: 16 },

  routeBlock:   { marginBottom: 4 },
  routeDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 8 },
  routeLine:    { flex: 1, height: 1, backgroundColor: C.border },
  routeIconBox: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },

  gpsLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  gpsBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 50, borderWidth: 1.5, borderColor: C.accent, backgroundColor: C.accentLight },
  gpsBtnTxt:   { fontSize: 12, fontWeight: '700', color: C.accent },
  gpsFillBadge:{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, borderWidth: 1, borderColor: '#6EE7B7' },
  gpsFillTxt:  { fontSize: 13, fontWeight: '700', color: C.success, flex: 1 },

  typeGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn:     { width: '31%', backgroundColor: C.bgAlt, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: C.border, gap: 5 },
  typeBtnActive: { borderColor: C.accent, backgroundColor: C.accentLight },
  typeTxt:     { fontSize: 10, fontWeight: '600', color: C.muted, textAlign: 'center' },


  submitBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 17, marginTop: 4 },
  submitBtnTxt: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  submitBtnSub: { color: 'rgba(255,255,255,0.65)', fontSize: 11 },

  infoBox:     { backgroundColor: C.bg, borderRadius: 12, padding: 18, borderWidth: 1, borderColor: C.border },
  infoTitle:   { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 14, letterSpacing: -0.2 },
  infoStep:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  infoStepTxt: { fontSize: 13, color: C.muted, lineHeight: 20, flex: 1 },

  card:        { backgroundColor: C.bg, borderRadius: 12, padding: 14, elevation: 2, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06 },
  cardUrgent:  { borderColor: '#FCA5A5', borderWidth: 1.5 },
  urgentBanner:{ flexDirection: 'row', alignItems: 'center', backgroundColor: C.errorLight, marginHorizontal: -14, marginTop: -14, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#FCA5A5' },
  urgentBannerTxt: { fontSize: 12, fontWeight: '800', color: C.error },

  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardIconBox: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardTypeTxt: { fontSize: 11, fontWeight: '700', color: C.muted, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
  routeRowInner: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cityFrom:    { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },
  cityTo:      { fontSize: 15, fontWeight: '800', color: C.text, letterSpacing: -0.2 },

  offreBadge:    { backgroundColor: C.successLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: '#6EE7B7' },
  offreBadgeTxt: { fontSize: 11, fontWeight: '800', color: C.success },

  cardMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaChip:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 50, borderWidth: 1, borderColor: C.border },
  metaChipTxt: { fontSize: 11, color: C.muted, fontWeight: '600' },

  prixChip:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#6EE7B7' },
  prixChipTxt: { fontSize: 12, fontWeight: '700', color: C.success },

  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  clientTxt:   { fontSize: 13, fontWeight: '600', color: C.muted },
  voirDetail:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  voirDetailTxt: { fontSize: 13, fontWeight: '700', color: C.primary },
});

const px = StyleSheet.create({
  box:        { backgroundColor: C.successLight, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: '#6EE7B7', marginBottom: 14 },
  headerRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' },
  title:      { fontSize: 13, fontWeight: '800', color: C.success, flex: 1 },
  surgeBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.errorLight, borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FCA5A5' },
  surgeTxt:   { fontSize: 11, fontWeight: '800', color: C.error },
  surgeRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentLight, borderRadius: 8, padding: 7, marginBottom: 8, borderWidth: 1, borderColor: '#FED7AA' },
  surgeLabel: { fontSize: 12, fontWeight: '700', color: C.accent },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#A7F3D0' },
  vehTxt:     { fontSize: 13, color: C.text, fontWeight: '600' },
  rangeTxt:   { fontSize: 13, fontWeight: '800', color: C.primary },
  detailBtn:  { flexDirection: 'row', alignItems: 'center', marginTop: 10, justifyContent: 'center' },
  detailBtnTxt: { fontSize: 12, fontWeight: '700', color: C.success },
  detail:     { backgroundColor: '#ECFDF5', borderRadius: 8, padding: 10, marginTop: 8 },
  detailLine: { fontSize: 12, color: C.muted, marginBottom: 3 },
});

// Sous-catégorie chips
const sc = StyleSheet.create({
  chipRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 14 },
  chip:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 50, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt },
  chipActive:  { borderColor: C.accent, backgroundColor: C.accentLight },
  chipTxt:     { fontSize: 12, fontWeight: '600', color: C.muted },
  chipTxtActive: { color: C.accent, fontWeight: '700' },
});

// Véhicule recommandé
const vr = StyleSheet.create({
  box:         { backgroundColor: C.bgAlt, borderRadius: 12, padding: 14, borderWidth: 1.5, borderColor: C.border, marginBottom: 14 },
  title:       { fontSize: 13, fontWeight: '800', color: C.text },
  grid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card:        { width: '47%', borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingVertical: 11, paddingHorizontal: 10, alignItems: 'center', gap: 5, backgroundColor: C.bg, position: 'relative' },
  cardSelected:{ borderColor: C.primary, borderWidth: 2 },
  cardLabel:   { fontSize: 11, fontWeight: '600', color: C.muted, textAlign: 'center' },
  recBadge:    { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
});

// Avertissement
const wn = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1.5, borderColor: '#FCD34D' },
  txt: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 19, fontWeight: '600' },
});

const opt = StyleSheet.create({
  section:    { backgroundColor: C.bgAlt, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, marginBottom: 14, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  optIcon:    { width: 32, height: 32, borderRadius: 8, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  optTitle:   { fontSize: 14, fontWeight: '700', color: C.text },
  optSub:     { fontSize: 12, color: C.muted, marginTop: 2 },
  counter:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  counterBtnTxt: { fontSize: 18, fontWeight: '900', color: C.text, lineHeight: 22 },
  counterVal: { fontSize: 17, fontWeight: '900', color: C.text, minWidth: 22, textAlign: 'center' },
  toggle:     { width: 46, height: 26, borderRadius: 13, backgroundColor: '#D1D5DB', justifyContent: 'center', padding: 3 },
  thumb:      { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', elevation: 2 },
});
