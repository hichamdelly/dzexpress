import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, ActivityIndicator,
  Alert, KeyboardAvoidingView, RefreshControl,
} from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useApp } from '../../src/context/AppContext';
import { demandesDB } from '../../src/db/database';
import { getDistanceKm, fmtKm, WILAYA_COORDS } from '../../src/utils/wilayas';
import { calculerPrix, calculerSurge, fmtPrix, TARIFS_BASE } from '../../src/utils/pricing';
import CityInput from '../../src/components/CityInput';

// ── Haversine local (évite de ré-exporter depuis wilayas.js) ──
function _haversine(lat1, lng1, lat2, lng2) {
  const R = 6371, toR = d => d * Math.PI / 180;
  const a =
    Math.sin(toR(lat2 - lat1) / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) *
    Math.sin(toR(lng2 - lng1) / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Trouve la wilaya la plus proche d'un point GPS (parmi les 48 canoniques)
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
  { key: 'meubles',        label: 'Meubles',         icon: '🪑' },
  { key: 'electromenager', label: 'Électroménager',  icon: '📺' },
  { key: 'cartons',        label: 'Cartons',          icon: '📦' },
  { key: 'materiaux',      label: 'Matériaux BTP',    icon: '🧱' },
  { key: 'vehicule',       label: 'Véhicule',         icon: '🚗' },
  { key: 'autre',          label: 'Autre',            icon: '🔧' },
];

const CRENEAUX = [
  { key: 'matin',      label: 'Matin',       sub: '06h – 12h', icon: '🌅' },
  { key: 'apres-midi', label: 'Après-midi',  sub: '12h – 18h', icon: '☀️' },
  { key: 'soir',       label: 'Soir',        sub: '18h – 22h', icon: '🌆' },
  { key: 'flexible',   label: 'Flexible',    sub: 'Peu importe', icon: '🕐' },
];

// CityPicker remplacé par CityInput (src/components/CityInput.jsx)

// ════════════════════════════════════════════════════════════
// ── EXPÉDITEUR ───────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
function ExpéditeurHome({ user }) {
  const router = useRouter();

  // Mode : 'maintenant' | 'planifie'
  const [mode, setMode]       = useState('maintenant');

  // Champs communs
  const [depart, setDepart]   = useState('');
  const [arrivee, setArrivee] = useState('');
  const [type, setType]       = useState('');
  const [poids, setPoids]     = useState('');
  const [desc, setDesc]       = useState('');

  // Champs "Planifier"
  const [date, setDate]       = useState(null);
  const [creneau, setCreneau] = useState('flexible');
  const [showDate, setShowDate] = useState(false);

  const [saving, setSaving]   = useState(false);

  // ── Options supplémentaires & tarification ──────────────────
  const [etages,   setEtages]   = useState(0);
  const [aide,     setAide]     = useState(false);
  const [fragile,  setFragile]  = useState(false);
  const [express,  setExpress]  = useState(false);
  const [showPrixDetail, setShowPrixDetail] = useState(false);

  // ── Géolocalisation départ ──────────────────────────────────
  const [gpsLoading, setGpsLoading] = useState(false);
  // Clé incrémentale pour forcer le remontage du CityInput après remplissage GPS
  const [gpsKey, setGpsKey]         = useState(0);

  const detectPosition = async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée',
          'Active la localisation dans les paramètres pour utiliser cette fonctionnalité.'
        );
        return;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = pos.coords;
      const wilaya = nearestWilaya(latitude, longitude, WILAYAS);

      if (wilaya) {
        setDepart(wilaya);
        // Force le remontage du CityInput pour afficher la nouvelle valeur
        setGpsKey(k => k + 1);
      } else {
        Alert.alert('Position introuvable', 'Impossible de détecter ta wilaya. Saisis-la manuellement.');
      }
    } catch {
      Alert.alert(
        'Géolocalisation échouée',
        'Vérifie que le GPS est activé et réessaie, ou saisis ta ville manuellement.'
      );
    } finally {
      setGpsLoading(false);
    }
  };
  // ────────────────────────────────────────────────────────────

  const reset = () => {
    setDepart(''); setArrivee(''); setType('');
    setPoids(''); setDesc(''); setDate(null); setCreneau('flexible');
    setEtages(0); setAide(false); setFragile(false); setExpress(false);
    setGpsKey(k => k + 1);
  };

  // Mode Maintenant → ouvre la carte des transporteurs
  const ouvrirCarte = () => {
    if (!depart)  return Alert.alert('Requis', 'Choisis la ville de départ.');
    if (!arrivee) return Alert.alert('Requis', 'Choisis la ville d\'arrivée.');
    if (!type)    return Alert.alert('Requis', 'Choisis le type de marchandise.');
    router.push({
      pathname: '/carte-transporteurs',
      params: { depart, arrivee, type, poids: poids.trim(), desc: desc.trim() },
    });
  };

  // Mode Planifié → publie directement dans la marketplace
  const handlePublier = async () => {
    if (!depart)  return Alert.alert('Requis', 'Choisis la ville de départ.');
    if (!arrivee) return Alert.alert('Requis', 'Choisis la ville d\'arrivée.');
    if (!type)    return Alert.alert('Requis', 'Choisis le type de marchandise.');
    if (!date)    return Alert.alert('Requis', 'Choisis la date souhaitée.');

    setSaving(true);
    try {
      const fmtDate = (d) => {
        const j = String(d.getDate()).padStart(2, '0');
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${j}/${m}/${d.getFullYear()}`;
      };
      const km          = getDistanceKm(depart, arrivee);
      const nbActives   = demandesDB.countActives();
      const estimation  = km ? calculerPrix(km, 'fourgon', { etages, aide, fragile, express, nbActives }) : null;
      const optsJson    = JSON.stringify({ etages, aide, fragile, express });

      demandesDB.create({
        expediteur_id:           user.id,
        ville_depart:            depart,
        ville_arrivee:           arrivee,
        type_marchandise:        type,
        poids:                   poids.trim() || null,
        description:             desc.trim() || null,
        type_demande:            'planifie',
        date_souhaitee:          fmtDate(date),
        creneau,
        prix_estime:             estimation?.min ?? null,
        surge_coefficient:       estimation?.surgeCoefficient ?? null,
        options_supplementaires: optsJson,
      });
      reset();
      Alert.alert(
        '📅 Demande planifiée publiée !',
        'Les transporteurs peuvent maintenant voir ta demande et faire des offres.',
        [{ text: 'Voir mes demandes', onPress: () => router.push('/(tabs)/suivi') }]
      );
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d) => d
    ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: C.orange }]}>
        <View style={s.headerLeft}>
          <View style={s.logoBubble}><Text style={{ fontSize: 22 }}>🚛</Text></View>
          <View>
            <Text style={s.appName}>DzExpress</Text>
            <Text style={s.appSub}>📦 Expéditeur</Text>
          </View>
        </View>
        <View style={[s.roleBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={[s.roleBadgeTxt, { color: 'white' }]}>📦</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
      >
        <View style={s.formCard}>
          {/* ── Toggle Maintenant / Planifier ── */}
          <View style={s.modeToggle}>
            <TouchableOpacity
              style={[s.modeBtn, mode === 'maintenant' && s.modeBtnUrgent]}
              onPress={() => setMode('maintenant')}
              activeOpacity={0.85}
            >
              <Text style={[s.modeIcon, mode === 'maintenant' && { color: 'white' }]}>🚀</Text>
              <Text style={[s.modeBtnTxt, mode === 'maintenant' && { color: 'white', fontWeight: '900' }]}>
                Maintenant
              </Text>
              <Text style={[s.modeBtnSub, mode === 'maintenant' && { color: 'rgba(255,255,255,0.8)' }]}>
                Urgent
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.modeBtn, mode === 'planifie' && s.modeBtnPlanifie]}
              onPress={() => setMode('planifie')}
              activeOpacity={0.85}
            >
              <Text style={[s.modeIcon, mode === 'planifie' && { color: 'white' }]}>📅</Text>
              <Text style={[s.modeBtnTxt, mode === 'planifie' && { color: 'white', fontWeight: '900' }]}>
                Planifier
              </Text>
              <Text style={[s.modeBtnSub, mode === 'planifie' && { color: 'rgba(255,255,255,0.8)' }]}>
                Choisir une date
              </Text>
            </TouchableOpacity>
          </View>

          {/* Bandeau urgence */}
          {mode === 'maintenant' && (
            <View style={s.urgenceBanner}>
              <Text style={s.urgenceTxt}>
                🚀 Ta demande sera marquée <Text style={{ fontWeight: '900' }}>URGENT</Text> — les transporteurs disponibles la verront en priorité !
              </Text>
            </View>
          )}

          <Text style={[s.formTitle, { marginTop: 8 }]}>Nouvelle demande</Text>
          <Text style={s.formSub}>
            {mode === 'maintenant'
              ? 'Transport à effectuer dès aujourd\'hui'
              : 'Transport à une date choisie'}
          </Text>

          {/* Route */}
          <View style={s.routeBlock}>

            {/* ── Départ + bouton GPS ── */}
            <View style={s.gpsLabelRow}>
              <Text style={s.label}>Ville de départ *</Text>
              <TouchableOpacity
                style={[
                  s.gpsBtn,
                  { borderColor: mode === 'maintenant' ? C.red : C.blue },
                  gpsLoading && s.gpsBtnLoading,
                ]}
                onPress={detectPosition}
                disabled={gpsLoading}
                activeOpacity={0.8}
              >
                {gpsLoading
                  ? <ActivityIndicator size="small" color={mode === 'maintenant' ? C.red : C.blue} />
                  : <Text style={[s.gpsBtnTxt, { color: mode === 'maintenant' ? C.red : C.blue }]}>
                      📍 Ma position
                    </Text>
                }
              </TouchableOpacity>
            </View>

            {/* Indicateur wilaya détectée */}
            {depart && gpsKey > 0 && (
              <View style={s.gpsFillBadge}>
                <Text style={s.gpsFillTxt}>📍 {depart}</Text>
                <TouchableOpacity onPress={() => { setDepart(''); setGpsKey(k => k + 1); }}>
                  <Text style={s.gpsClearTxt}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            <CityInput
              key={`depart-${gpsKey}`}
              value={depart}
              onChange={setDepart}
              accentColor={mode === 'maintenant' ? C.red : C.blue}
              zIndex={20}
              placeholder="Commune ou wilaya de départ…"
            />

            <View style={s.routeDivider}>
              <View style={s.routeLine} />
              <Text style={[s.routeArrow, { color: mode === 'maintenant' ? C.red : C.blue }]}>↓</Text>
              <View style={s.routeLine} />
            </View>

            <Text style={[s.label, { marginTop: 4 }]}>Ville d'arrivée *</Text>
            <CityInput
              value={arrivee}
              onChange={setArrivee}
              accentColor={mode === 'maintenant' ? C.red : C.blue}
              zIndex={19}
              placeholder="Commune ou wilaya d'arrivée…"
            />
          </View>

          {/* ── Widget estimation de prix ── */}
          {depart && arrivee && (() => {
            const km = getDistanceKm(depart, arrivee);
            if (!km) return null;
            const nbActives = demandesDB.countActives();
            const surge     = calculerSurge(nbActives);
            const opts      = { etages, aide, fragile, express, nbActives };
            const estims    = Object.entries(TARIFS_BASE).map(([veh]) => ({
              veh,
              px: calculerPrix(km, veh, opts),
            }));
            const fourgon = estims[0].px;
            return (
              <View style={px.box}>
                <View style={px.headerRow}>
                  <Text style={px.title}>💰 Estimation de prix</Text>
                  {surge.isForteDemande && (
                    <View style={px.surgeBadge}><Text style={px.surgeTxt}>🔥 Forte demande</Text></View>
                  )}
                </View>

                {surge.label && (
                  <View style={px.surgeRow}>
                    <Text style={px.surgeLabel}>⚡ {surge.label} (+{surge.pct}%)</Text>
                  </View>
                )}

                {estims.map(({ veh, px: p }) => (
                  <View key={veh} style={px.row}>
                    <Text style={px.vehTxt}>{TARIFS_BASE[veh].icon} {TARIFS_BASE[veh].label}</Text>
                    <Text style={px.rangeTxt}>{fmtPrix(p.min)} – {fmtPrix(p.max)}</Text>
                  </View>
                ))}

                <TouchableOpacity style={px.detailBtn} onPress={() => setShowPrixDetail(v => !v)}>
                  <Text style={px.detailBtnTxt}>{showPrixDetail ? '▲' : '▼'} Voir le détail du calcul</Text>
                </TouchableOpacity>

                {showPrixDetail && (
                  <View style={px.detail}>
                    <Text style={px.detailLine}>📏 {fourgon.detail.km} km × {fourgon.detail.tarifKm} DA/km</Text>
                    <Text style={px.detailLine}>+ Prise en charge : {fmtPrix(fourgon.detail.priseEnCharge)}</Text>
                    <Text style={px.detailLine}>= Base : {fmtPrix(fourgon.detail.baseAvantSurge)}</Text>
                    {fourgon.detail.surgePct > 0 && (
                      <Text style={[px.detailLine, { color: '#F97316' }]}>⚡ Surge × {(fourgon.surgeCoefficient).toFixed(2)} (+{fourgon.detail.surgePct}%)</Text>
                    )}
                    {fourgon.detail.fraisEtages > 0 && (
                      <Text style={px.detailLine}>🏢 Étages : +{fmtPrix(fourgon.detail.fraisEtages)}</Text>
                    )}
                    {fourgon.detail.fraisAide > 0 && (
                      <Text style={px.detailLine}>🤝 Aide chargement : +500 DA</Text>
                    )}
                    {fourgon.detail.fragile && (
                      <Text style={px.detailLine}>📦 Fragile : +20%</Text>
                    )}
                    {fourgon.detail.express && (
                      <Text style={px.detailLine}>⚡ Express : +40%</Text>
                    )}
                    <Text style={[px.detailLine, { fontWeight: '900', color: '#1A56DB', marginTop: 4 }]}>
                      Total fourgon : {fmtPrix(fourgon.min)} – {fmtPrix(fourgon.max)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })()}

          {/* Type marchandise */}
          <Text style={s.label}>Type de marchandise *</Text>
          <View style={s.typeGrid}>
            {TYPES_MARCHANDISE.map(t => (
              <TouchableOpacity
                key={t.key}
                style={[s.typeBtn,
                  type === t.key && (mode === 'maintenant' ? s.typeBtnUrgent : s.typeBtnPlanifie)
                ]}
                onPress={() => setType(t.key)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 24 }}>{t.icon}</Text>
                <Text style={[s.typeTxt,
                  type === t.key && { color: mode === 'maintenant' ? C.orange : C.blue }
                ]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Poids */}
          <Text style={s.label}>Poids estimé</Text>
          <TextInput
            style={s.input}
            placeholder="Ex : 500 kg, 2 tonnes…"
            placeholderTextColor={C.muted}
            value={poids}
            onChangeText={setPoids}
          />

          {/* ── Section "Planifier" uniquement ── */}
          {mode === 'planifie' && (
            <>
              <Text style={s.label}>Date souhaitée *</Text>
              <TouchableOpacity style={s.datePicker} onPress={() => setShowDate(true)}>
                <Text style={{ fontSize: 22 }}>📅</Text>
                <Text style={[s.datePickerTxt, !date && { color: C.muted }]}>
                  {fmtDate(date) ?? 'Choisir une date'}
                </Text>
              </TouchableOpacity>

              <Text style={[s.label, { marginTop: 4 }]}>Créneau horaire</Text>
              <View style={s.creneauGrid}>
                {CRENEAUX.map(cr => (
                  <TouchableOpacity
                    key={cr.key}
                    style={[s.creneauBtn, creneau === cr.key && s.creneauBtnActive]}
                    onPress={() => setCreneau(cr.key)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 20 }}>{cr.icon}</Text>
                    <Text style={[s.creneauTxt, creneau === cr.key && { color: C.blue, fontWeight: '800' }]}>
                      {cr.label}
                    </Text>
                    <Text style={[s.creneauSub, creneau === cr.key && { color: C.blue }]}>
                      {cr.sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* ── Options supplémentaires ── */}
          <Text style={s.label}>Options supplémentaires</Text>
          <View style={opt.section}>
            {/* Étages */}
            <View style={opt.row}>
              <View style={{ flex: 1 }}>
                <Text style={opt.optTitle}>🏢 Étages sans ascenseur</Text>
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
            {/* Aide chargement */}
            <TouchableOpacity style={opt.row} onPress={() => setAide(v => !v)} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={opt.optTitle}>🤝 Aide au chargement/déchargement</Text>
                <Text style={opt.optSub}>+500 DA</Text>
              </View>
              <View style={[opt.toggle, aide && opt.toggleOn]}><View style={[opt.thumb, aide && opt.thumbOn]} /></View>
            </TouchableOpacity>
            {/* Fragile */}
            <TouchableOpacity style={opt.row} onPress={() => setFragile(v => !v)} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={opt.optTitle}>📦 Marchandise fragile</Text>
                <Text style={opt.optSub}>+20% sur le total</Text>
              </View>
              <View style={[opt.toggle, fragile && opt.toggleOn]}><View style={[opt.thumb, fragile && opt.thumbOn]} /></View>
            </TouchableOpacity>
            {/* Express */}
            <TouchableOpacity style={[opt.row, { borderBottomWidth: 0 }]} onPress={() => setExpress(v => !v)} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={opt.optTitle}>⚡ Livraison express (&lt;2h)</Text>
                <Text style={opt.optSub}>+40% sur le total</Text>
              </View>
              <View style={[opt.toggle, express && opt.toggleOn]}><View style={[opt.thumb, express && opt.thumbOn]} /></View>
            </TouchableOpacity>
          </View>

          {/* Description */}
          <Text style={s.label}>Description</Text>
          <TextInput
            style={[s.input, { minHeight: 70, textAlignVertical: 'top' }]}
            placeholder="Détails : dimensions, fragilité, accès difficile…"
            placeholderTextColor={C.muted}
            value={desc}
            onChangeText={setDesc}
            multiline
          />

          {mode === 'maintenant' ? (
            <TouchableOpacity style={[s.submitBtn, { backgroundColor: C.red }]} onPress={ouvrirCarte} activeOpacity={0.88}>
              <Text style={s.submitBtnTxt}>🗺️ Voir les transporteurs disponibles</Text>
              <Text style={s.submitBtnSub}>Choisis un transporteur sur la carte</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.submitBtn, { backgroundColor: C.blue }, saving && { opacity: 0.7 }]}
              onPress={handlePublier}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="white" />
                : <>
                    <Text style={s.submitBtnTxt}>📅 Publier dans la marketplace</Text>
                    <Text style={s.submitBtnSub}>Les transporteurs feront des offres</Text>
                  </>
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Info */}
        <View style={s.infoBox}>
          <Text style={s.infoTitle}>Comment ça marche ?</Text>
          {[
            '📝 Tu publies une demande (urgente ou planifiée)',
            '🔔 Les transporteurs disponibles la voient',
            '💬 Un transporteur te fait une offre de prix',
            '✅ Tu acceptes et il vient chercher ta marchandise',
          ].map((item, i) => (
            <Text key={i} style={s.infoStep}>{item}</Text>
          ))}
        </View>
      </ScrollView>

      <DateTimePickerModal
        isVisible={showDate}
        mode="date"
        minimumDate={new Date()}
        onConfirm={d => { setDate(d); setShowDate(false); }}
        onCancel={() => setShowDate(false)}
        locale="fr_FR"
        confirmTextIOS="Confirmer"
        cancelTextIOS="Annuler"
      />
    </KeyboardAvoidingView>
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

  // Filtre urgence
  const [urgFilter, setUrgFilter]   = useState('tous');   // 'tous' | 'maintenant' | 'planifie'
  // Filtre type marchandise
  const [typeFilter, setTypeFilter] = useState('');

  const fetchDemandes = useCallback(() => {
    try {
      const data = demandesDB.getDisponibles(
        urgFilter !== 'tous' ? urgFilter : null
      );
      setDemandes(data);
    } catch (e) { console.log('fetch error:', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [urgFilter]);

  useState(() => { fetchDemandes(); }, []);

  // Re-fetch quand le filtre urgence change
  const onUrgFilterChange = (val) => {
    setUrgFilter(val);
    setLoading(true);
    try {
      const data = demandesDB.getDisponibles(val !== 'tous' ? val : null);
      setDemandes(data);
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); }
  };

  const displayed = typeFilter
    ? demandes.filter(d => d.type_marchandise === typeFilter)
    : demandes;

  const urgentCount   = demandes.filter(d => d.type_demande === 'maintenant').length;
  const planifieCount = demandes.filter(d => d.type_demande === 'planifie').length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={[s.header, { backgroundColor: C.blueDark }]}>
        <View style={s.headerLeft}>
          <View style={s.logoBubble}><Text style={{ fontSize: 22 }}>🚛</Text></View>
          <View>
            <Text style={s.appName}>DzExpress</Text>
            <Text style={s.appSub}>🚛 Transporteur</Text>
          </View>
        </View>
        <View style={[s.roleBadge, { backgroundColor: C.blueLight }]}>
          <Text style={[s.roleBadgeTxt, { color: C.blue }]}>
            {demandes.length} demande{demandes.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {/* ── Filtre Urgent / Planifié / Tous ── */}
      <View style={s.urgFilterBar}>
        {[
          { key: 'tous',        icon: '🔍', label: 'Tous',     count: demandes.length },
          { key: 'maintenant',  icon: '🚀', label: 'Urgent',   count: urgentCount },
          { key: 'planifie',    icon: '📅', label: 'Planifié', count: planifieCount },
        ].map(f => (
          <TouchableOpacity
            key={f.key}
            style={[s.urgBtn,
              urgFilter === f.key && (
                f.key === 'maintenant' ? s.urgBtnRed
                  : f.key === 'planifie' ? s.urgBtnBlue
                  : s.urgBtnGray
              )
            ]}
            onPress={() => onUrgFilterChange(f.key)}
            activeOpacity={0.85}
          >
            <Text style={[s.urgBtnIcon]}>{f.icon}</Text>
            <Text style={[s.urgBtnTxt, urgFilter === f.key && { color: 'white' }]}>
              {f.label}
            </Text>
            {f.count > 0 && (
              <View style={[s.urgCount,
                urgFilter === f.key ? { backgroundColor: 'rgba(255,255,255,0.3)' } : { backgroundColor: C.border }
              ]}>
                <Text style={[s.urgCountTxt, urgFilter === f.key && { color: 'white' }]}>
                  {f.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtre type marchandise */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.typeFilterBar}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 7 }}>
        <TouchableOpacity
          style={[s.typeChip, !typeFilter && s.typeChipActive]}
          onPress={() => setTypeFilter('')}
        >
          <Text style={[s.typeChipTxt, !typeFilter && { color: C.white }]}>Tout</Text>
        </TouchableOpacity>
        {TYPES_MARCHANDISE.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.typeChip, typeFilter === t.key && s.typeChipActive]}
            onPress={() => setTypeFilter(typeFilter === t.key ? '' : t.key)}
          >
            <Text style={[s.typeChipTxt, typeFilter === t.key && { color: C.white }]}>
              {t.icon} {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Liste */}
      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.blue} /></View>
      ) : displayed.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 52, marginBottom: 14 }}>
            {urgFilter === 'maintenant' ? '🚀' : urgFilter === 'planifie' ? '📅' : '🔍'}
          </Text>
          <Text style={s.emptyTitle}>
            {urgFilter === 'maintenant' ? 'Aucune urgence' :
             urgFilter === 'planifie'   ? 'Aucune planifiée' :
             'Aucune demande disponible'}
          </Text>
          <Text style={s.emptyDesc}>Reviens dans quelques minutes 🕐</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, gap: 12, paddingBottom: 90 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchDemandes(); }}
              tintColor={C.blue}
            />
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

// ── Carte demande ────────────────────────────────────────────
function DemandeCard({ demande: d, onPress }) {
  const isUrgent    = d.type_demande === 'maintenant';
  const typeInfo    = TYPES_MARCHANDISE.find(t => t.key === d.type_marchandise);
  const creneauInfo = CRENEAUX.find(c => c.key === d.creneau);
  const distKm      = getDistanceKm(d.ville_depart, d.ville_arrivee);

  return (
    <TouchableOpacity style={[s.card, isUrgent && s.cardUrgent]} onPress={onPress} activeOpacity={0.88}>
      {/* Badge urgent */}
      {isUrgent && (
        <View style={s.urgentBanner}>
          <Text style={s.urgentBannerTxt}>🚀 URGENT — Transport immédiat</Text>
        </View>
      )}

      <View style={s.cardTop}>
        <View style={[s.cardIconBox, { backgroundColor: isUrgent ? '#FEF2F2' : C.blueLight }]}>
          <Text style={{ fontSize: 28 }}>{typeInfo?.icon || '📦'}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={s.cardType}>{typeInfo?.label || d.type_marchandise}</Text>
          <View style={s.routeRow}>
            <Text style={s.cityFrom}>{d.ville_depart}</Text>
            <Text style={[s.routeArrowTxt, { color: isUrgent ? C.red : C.blue }]}> → </Text>
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
          <View style={s.metaUrgent}><Text style={s.metaUrgentTxt}>🚀 Maintenant</Text></View>
        ) : (
          <>
            <View style={s.metaChip}><Text style={s.metaChipTxt}>📅 {d.date_souhaitee}</Text></View>
            {creneauInfo && (
              <View style={[s.metaChip, { backgroundColor: C.blueLight, borderColor: '#BFDBFE' }]}>
                <Text style={[s.metaChipTxt, { color: C.blue }]}>{creneauInfo.icon} {creneauInfo.label}</Text>
              </View>
            )}
          </>
        )}
        {distKm != null && (
          <View style={[s.metaChip, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
            <Text style={[s.metaChipTxt, { color: '#16A34A' }]}>📏 {fmtKm(distKm)}</Text>
          </View>
        )}
        {d.poids && <View style={s.metaChip}><Text style={s.metaChipTxt}>⚖️ {d.poids}</Text></View>}
        {d.expediteur_wilaya && (
          <View style={s.metaChip}><Text style={s.metaChipTxt}>📍 {d.expediteur_wilaya}</Text></View>
        )}
      </View>

      {d.prix_estime > 0 && (
        <View style={s.prixChip}>
          <Text style={s.prixChipTxt}>💰 À partir de {fmtPrix(d.prix_estime)}</Text>
        </View>
      )}

      <View style={s.cardFooter}>
        <Text style={s.clientTxt}>👤 {d.expediteur_nom}</Text>
        <Text style={[s.voirDetail, { color: isUrgent ? C.red : C.blue }]}>Voir →</Text>
      </View>
    </TouchableOpacity>
  );
}

// ════════════════════════════════════════════════════════════
// ── Entry point ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════
export default function HomeScreen() {
  const { user, loading } = useApp();

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color={C.blue} /></View>
  );

  if (!user) return <Redirect href="/onboarding" />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {user.type === 'expediteur'
        ? <ExpéditeurHome user={user} />
        : <TransporteurHome user={user} />
      }
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────
const s = StyleSheet.create({
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: C.bg },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  emptyDesc:   { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  countTxt:    { fontSize: 13, color: C.muted, marginBottom: 4 },

  // Header
  header:      { paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 18, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBubble:  { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  appName:     { color: 'white', fontSize: 20, fontWeight: '900' },
  appSub:      { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 1 },
  roleBadge:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  roleBadgeTxt:{ fontSize: 12, fontWeight: '700' },

  // Filtre urgence (transporteur)
  urgFilterBar:{ flexDirection: 'row', backgroundColor: C.white, paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: C.border },
  urgBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 9, borderRadius: 12, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border },
  urgBtnRed:   { backgroundColor: C.red, borderColor: C.red },
  urgBtnBlue:  { backgroundColor: C.blue, borderColor: C.blue },
  urgBtnGray:  { backgroundColor: C.muted, borderColor: C.muted },
  urgBtnIcon:  { fontSize: 14 },
  urgBtnTxt:   { fontSize: 12, fontWeight: '800', color: C.text },
  urgCount:    { borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
  urgCountTxt: { fontSize: 11, fontWeight: '700', color: C.muted },

  // Filtre type (transporteur)
  typeFilterBar: { backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border, flexGrow: 0 },
  typeChip:    { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  typeChipActive: { backgroundColor: C.blue, borderColor: C.blue },
  typeChipTxt: { fontSize: 12, fontWeight: '600', color: C.muted },

  // Formulaire expéditeur
  formCard:    { backgroundColor: C.white, borderRadius: 20, padding: 18, elevation: 2, borderWidth: 1, borderColor: C.border, marginBottom: 16 },

  // Toggle Maintenant / Planifier
  modeToggle:  { flexDirection: 'row', gap: 10, marginBottom: 16 },
  modeBtn:     { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: 16, borderWidth: 2, borderColor: C.border, backgroundColor: C.bg, gap: 2 },
  modeBtnUrgent: { backgroundColor: C.red, borderColor: C.red },
  modeBtnPlanifie: { backgroundColor: C.blue, borderColor: C.blue },
  modeIcon:    { fontSize: 28, color: C.muted },
  modeBtnTxt:  { fontSize: 15, fontWeight: '700', color: C.muted },
  modeBtnSub:  { fontSize: 11, color: C.muted },

  urgenceBanner: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 4, borderWidth: 1, borderColor: '#FECACA' },
  urgenceTxt:  { fontSize: 13, color: C.red, lineHeight: 19 },

  formTitle:   { fontSize: 18, fontWeight: '900', color: C.text, marginBottom: 3 },
  formSub:     { fontSize: 13, color: C.muted, marginBottom: 18, lineHeight: 19 },

  label:       { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input:       { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.text, marginBottom: 16 },

  routeBlock:  { marginBottom: 4 },
  routeDivider:{ flexDirection: 'row', alignItems: 'center', marginVertical: 6, gap: 8 },
  routeLine:   { flex: 1, height: 1, backgroundColor: C.border },
  routeArrow:  { fontSize: 18, fontWeight: '700' },

  // GPS button
  gpsLabelRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  gpsBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1.5, backgroundColor: C.white, minWidth: 32, minHeight: 30, justifyContent: 'center' },
  gpsBtnLoading: { opacity: 0.6 },
  gpsBtnTxt:     { fontSize: 12, fontWeight: '700' },
  gpsFillBadge:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7, marginBottom: 6, borderWidth: 1, borderColor: '#BBF7D0' },
  gpsFillTxt:    { fontSize: 13, fontWeight: '700', color: '#16A34A', flex: 1 },
  gpsClearTxt:   { fontSize: 14, color: '#64748B', paddingLeft: 8, fontWeight: '600' },


  typeGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  typeBtn:     { width: '31%', backgroundColor: C.bg, borderRadius: 12, padding: 10, alignItems: 'center', borderWidth: 1.5, borderColor: C.border },
  typeBtnUrgent: { borderColor: C.orange, backgroundColor: C.orangeLight },
  typeBtnPlanifie: { borderColor: C.blue, backgroundColor: C.blueLight },
  typeTxt:     { fontSize: 10, fontWeight: '700', color: C.muted, marginTop: 4, textAlign: 'center' },

  datePicker:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.bg, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1.5, borderColor: C.border, marginBottom: 16 },
  datePickerTxt: { fontSize: 14, color: C.text, fontWeight: '500', flex: 1 },

  // Créneau horaire
  creneauGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  creneauBtn:  { width: '48%', borderWidth: 1.5, borderColor: C.border, borderRadius: 14, padding: 12, alignItems: 'center', backgroundColor: C.bg, gap: 3 },
  creneauBtnActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  creneauTxt:  { fontSize: 13, fontWeight: '700', color: C.muted },
  creneauSub:  { fontSize: 11, color: C.muted },

  submitBtn:   { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4, gap: 3 },
  submitBtnTxt:{ color: 'white', fontSize: 17, fontWeight: '900' },
  submitBtnSub:{ color: 'rgba(255,255,255,0.75)', fontSize: 12 },

  infoBox:     { backgroundColor: C.white, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: C.border },
  infoTitle:   { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 12 },
  infoStep:    { fontSize: 13, color: C.muted, lineHeight: 22, marginBottom: 2 },

  // Cartes demandes (transporteur)
  card:        { backgroundColor: C.white, borderRadius: 16, padding: 14, elevation: 2, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  cardUrgent:  { borderColor: '#FECACA', borderWidth: 2 },
  urgentBanner:{ backgroundColor: '#FEF2F2', marginHorizontal: -14, marginTop: -14, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#FECACA' },
  urgentBannerTxt: { fontSize: 12, fontWeight: '800', color: C.red },
  cardTop:     { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  cardIconBox: { width: 54, height: 54, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  cardType:    { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 3 },
  routeRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cityFrom:    { fontSize: 15, fontWeight: '900', color: C.text },
  routeArrowTxt: { fontSize: 15, fontWeight: '700' },
  cityTo:      { fontSize: 15, fontWeight: '900', color: C.text },
  offreBadge:  { backgroundColor: C.greenLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  offreBadgeTxt: { fontSize: 11, fontWeight: '800', color: C.green },
  cardMeta:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  metaChip:    { backgroundColor: C.bg, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  metaChipTxt: { fontSize: 11, color: C.muted, fontWeight: '600' },
  metaUrgent:  { backgroundColor: '#FEF2F2', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 20, borderWidth: 1, borderColor: '#FECACA' },
  metaUrgentTxt: { fontSize: 11, color: C.red, fontWeight: '800' },
  cardFooter:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 9 },
  clientTxt:   { fontSize: 13, fontWeight: '600', color: C.text },
  voirDetail:  { fontSize: 13, fontWeight: '700' },
  prixChip:    { backgroundColor: '#F0FDF4', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BBF7D0' },
  prixChipTxt: { fontSize: 12, fontWeight: '800', color: '#16A34A' },
});

// ── Styles widget prix ───────────────────────────────────────
const px = StyleSheet.create({
  box:        { backgroundColor: '#F0FDF4', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#BBF7D0', marginBottom: 14 },
  headerRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  title:      { fontSize: 14, fontWeight: '900', color: '#16A34A', flex: 1 },
  surgeBadge: { backgroundColor: '#FEF2F2', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FECACA' },
  surgeTxt:   { fontSize: 11, fontWeight: '800', color: '#DC2626' },
  surgeRow:   { backgroundColor: '#FFF7ED', borderRadius: 8, padding: 7, marginBottom: 8, borderWidth: 1, borderColor: '#FED7AA' },
  surgeLabel: { fontSize: 12, fontWeight: '700', color: '#F97316' },
  row:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#DCFCE7' },
  vehTxt:     { fontSize: 13, color: '#1E293B', fontWeight: '600' },
  rangeTxt:   { fontSize: 13, fontWeight: '800', color: '#1A56DB' },
  detailBtn:  { marginTop: 10, alignItems: 'center' },
  detailBtnTxt:{ fontSize: 12, fontWeight: '700', color: '#16A34A' },
  detail:     { backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10, marginTop: 8 },
  detailLine: { fontSize: 12, color: '#374151', marginBottom: 3 },
});

// ── Styles options supplémentaires ───────────────────────────
const opt = StyleSheet.create({
  section:    { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', marginBottom: 14, overflow: 'hidden' },
  row:        { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 12 },
  optTitle:   { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  optSub:     { fontSize: 12, color: '#64748B', marginTop: 2 },
  counter:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  counterBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
  counterBtnTxt: { fontSize: 18, fontWeight: '900', color: '#1E293B', lineHeight: 22 },
  counterVal: { fontSize: 18, fontWeight: '900', color: '#1E293B', minWidth: 22, textAlign: 'center' },
  toggle:     { width: 46, height: 26, borderRadius: 13, backgroundColor: '#E2E8F0', justifyContent: 'center', padding: 3 },
  toggleOn:   { backgroundColor: '#16A34A' },
  thumb:      { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', elevation: 2 },
  thumbOn:    { alignSelf: 'flex-end' },
});
