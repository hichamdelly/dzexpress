import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useReservation, ProgressBar } from '../../src/context/ReservationContext';
import { useApp } from '../../src/context/AppContext';
import { demandesDB, notifDB, usersDB } from '../../src/db/database';
import { NT } from '../../src/lib/notifications';
import { calculerPrix, fmtPrix, TARIFS_BASE } from '../../src/utils/pricing';
import { getDistanceKm } from '../../src/utils/wilayas';

const TYPE_LABELS = {
  meubles: 'Meubles', electromenager: 'Électroménager',
  cartons: 'Cartons', alimentation: 'Alimentation',
  materiaux: 'Matériaux BTP', vehicule: 'Véhicule', autre: 'Autre',
};

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
};

function SummaryRow({ icon, label, value }) {
  if (!value) return null;
  return (
    <View style={sr.row}>
      <View style={sr.iconBox}>
        <Ionicons name={icon} size={15} color={C.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={sr.label}>{label}</Text>
        <Text style={sr.value}>{value}</Text>
      </View>
    </View>
  );
}

export default function Recapitulatif() {
  const router  = useRouter();
  const { user } = useApp();
  const ctx     = useReservation();

  const mode = ctx.mode || 'instantane';
  const [date,      setDate]      = useState(ctx.date  || null);
  const [heure,     setHeure]     = useState(ctx.heure || null);
  const [showDate,  setShowDate]  = useState(false);
  const [showHeure, setShowHeure] = useState(false);
  const [saving,    setSaving]    = useState(false);

  const km    = getDistanceKm(ctx.departure, ctx.arrival);
  const opts  = ctx.options || {};
  const estim = km && ctx.vehicule
    ? calculerPrix(km, ctx.vehicule, { ...opts, nbActives: 0 })
    : null;

  const fmtDate  = d => d
    ? d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;
  const fmtHeure = h => h
    ? h.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  const getCreneau = h => {
    if (!h) return 'flexible';
    const hr = h.getHours();
    if (hr >= 6  && hr < 12) return 'matin';
    if (hr >= 12 && hr < 18) return 'apres-midi';
    if (hr >= 18 && hr < 22) return 'soir';
    return 'flexible';
  };

  const optionsLabel = () => {
    const parts = [];
    if (opts.etages > 0)  parts.push(`${opts.etages} étage${opts.etages > 1 ? 's' : ''}`);
    if (opts.aide)        parts.push('Aide chargement');
    if (opts.fragile)     parts.push('Fragile');
    if (opts.express)     parts.push('Express');
    return parts.length > 0 ? parts.join(' · ') : 'Aucune';
  };

  const handleReserver = async () => {
    if (!ctx.departure) return Alert.alert('Incomplet', 'Ville de départ manquante. Retourne à l\'étape 1.');
    if (!ctx.arrival)   return Alert.alert('Incomplet', "Ville d'arrivée manquante. Retourne à l'étape 1.");
    if (!ctx.category)  return Alert.alert('Incomplet', 'Type de marchandise manquant. Retourne à l\'étape 2.');
    if (!ctx.vehicule)  return Alert.alert('Incomplet', 'Véhicule non sélectionné. Retourne à l\'étape 4.');

    if (mode === 'instantane') {
      router.push({
        pathname: '/carte-transporteurs',
        params: {
          depart:               ctx.departure,
          arrivee:              ctx.arrival,
          type:                 ctx.category,
          poids:                ctx.quantite || '',
          desc:                 ctx.description || '',
          sous_categorie:       ctx.sousCategorie || '',
          vehicule_recommande:  ctx.vehicule || '',
        },
      });
      return;
    }

    if (!date) return Alert.alert('Requis', 'Choisis une date de transport.');

    setSaving(true);
    try {
      const fmt = d =>
        `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

      const heureStr = fmtHeure(heure);

      const newDemandeId = demandesDB.create({
        expediteur_id:            user.id,
        ville_depart:             ctx.departure,
        ville_arrivee:            ctx.arrival,
        type_marchandise:         ctx.category,
        poids:                    ctx.quantite || null,
        description:              ctx.description || null,
        type_demande:             'planifie',
        date_souhaitee:           fmt(date),
        creneau:                  getCreneau(heure),
        heure_souhaitee:          heureStr || null,
        prix_estime:              estim?.min ?? null,
        surge_coefficient:        estim?.surgeCoefficient ?? null,
        options_supplementaires:  JSON.stringify(opts),
        sous_categorie:           ctx.sousCategorie || null,
        vehicule_recommande:      ctx.vehicule || null,
      });

      // Notification riche pour les transporteurs
      const vehLbl = TARIFS_BASE[ctx.vehicule]?.label || ctx.vehicule || '';
      const typeLbl = TYPE_LABELS[ctx.category] || ctx.category;
      const sousLbl = ctx.sousCategorie ? ` — ${ctx.sousCategorie}` : '';
      const quandLbl = heureStr ? `${fmt(date)} à ${heureStr}` : fmt(date);
      const notifMsg =
        `🚛 Nouvelle course disponible\n` +
        `📍 ${ctx.departure} → ${ctx.arrival}\n` +
        `📦 ${typeLbl}${sousLbl}\n` +
        `🚗 ${vehLbl}\n` +
        `📅 ${quandLbl}`;

      try {
        const transporteurs = usersDB.getAllTransporteurs();
        for (const t of transporteurs) {
          if (t.id !== user.id) {
            notifDB.create(t.id, notifMsg, NT.NOUVELLE_DEMANDE, { route: `/course/${newDemandeId}` });
          }
        }
      } catch (_) {}

      ctx.reset();
      Alert.alert(
        'Demande publiée !',
        'Les transporteurs peuvent voir ta demande et faire des offres.',
        [{ text: 'Voir mes demandes', onPress: () => router.replace('/(tabs)/suivi') }],
      );
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nouvelle demande</Text>
        <View style={{ width: 36 }} />
      </View>
      <ProgressBar step={6} total={6} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.stepLabel}>Étape 6 / 6</Text>
        <Text style={s.title}>Récapitulatif</Text>
        <Text style={s.sub}>Vérifie les informations avant de confirmer.</Text>

        <View style={s.card}>
          <SummaryRow icon="location-outline"   label="Départ"      value={ctx.departure} />
          <SummaryRow icon="flag-outline"        label="Arrivée"     value={ctx.arrival} />
          {km != null && (
            <SummaryRow icon="navigate-outline"  label="Distance"    value={`${km} km`} />
          )}
          <SummaryRow icon="cube-outline"        label="Marchandise" value={TYPE_LABELS[ctx.category]} />
          <SummaryRow icon="car-sport-outline"   label="Véhicule"    value={TARIFS_BASE[ctx.vehicule]?.label} />
          {ctx.quantite    && <SummaryRow icon="scale-outline"       label="Poids"       value={ctx.quantite} />}
          <SummaryRow       icon="options-outline" label="Options"   value={optionsLabel()} />
          {ctx.description && <SummaryRow icon="chatbubble-outline"  label="Description" value={ctx.description} />}
          {estim && (
            <SummaryRow icon="wallet-outline" label="Estimation"
              value={`${fmtPrix(estim.min)} – ${fmtPrix(estim.max)}`} />
          )}
        </View>

        {mode === 'planifie' && (
          <Text style={[s.sectionTitle, { marginBottom: 12 }]}>Date et heure</Text>
        )}
        {mode === 'planifie' && (
          <>
            <View style={s.dtRow}>
              <TouchableOpacity
                style={[s.dtBtn, date && s.dtBtnFilled]}
                onPress={() => setShowDate(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="calendar-outline" size={16} color={date ? C.primary : '#9CA3AF'} style={{ marginRight: 7 }} />
                <Text style={[s.dtBtnTxt, !date && { color: '#9CA3AF' }]} numberOfLines={1}>
                  {fmtDate(date) ?? 'Choisir une date'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.dtBtn, heure && s.dtBtnFilled, { flex: 0.55 }]}
                onPress={() => setShowHeure(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="time-outline" size={16} color={heure ? C.primary : '#9CA3AF'} style={{ marginRight: 7 }} />
                <Text style={[s.dtBtnTxt, !heure && { color: '#9CA3AF' }]}>
                  {fmtHeure(heure) ?? 'Heure'}
                </Text>
              </TouchableOpacity>
            </View>

            {showDate && (
              <DateTimePicker
                value={date || new Date()}
                mode="date"
                minimumDate={new Date()}
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_, d) => {
                  if (Platform.OS !== 'ios') setShowDate(false);
                  if (d) setDate(d);
                }}
                style={{ marginBottom: 8 }}
              />
            )}
            {Platform.OS === 'ios' && showDate && (
              <TouchableOpacity style={s.dtDone} onPress={() => setShowDate(false)}>
                <Text style={s.dtDoneTxt}>Valider la date</Text>
              </TouchableOpacity>
            )}

            {showHeure && (
              <DateTimePicker
                value={heure || new Date()}
                mode="time"
                is24Hour
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, d) => {
                  if (Platform.OS !== 'ios') setShowHeure(false);
                  if (d) setHeure(d);
                }}
                style={{ marginBottom: 8 }}
              />
            )}
            {Platform.OS === 'ios' && showHeure && (
              <TouchableOpacity style={s.dtDone} onPress={() => setShowHeure(false)}>
                <Text style={s.dtDoneTxt}>Valider l'heure</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.reserveBtn, saving && { opacity: 0.6 }]}
          onPress={handleReserver}
          disabled={saving}
          activeOpacity={0.88}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : mode === 'instantane' ? (
            <>
              <Ionicons name="flash" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <View>
                <Text style={s.reserveBtnTxt}>Réserver maintenant</Text>
                <Text style={s.reserveBtnSub}>Choix du transporteur sur la carte</Text>
              </View>
            </>
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <View>
                <Text style={s.reserveBtnTxt}>Publier la demande</Text>
                <Text style={s.reserveBtnSub}>Les transporteurs feront des offres</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', flex: 1, textAlign: 'center' },

  content:      { padding: 20, paddingBottom: 40 },
  stepLabel:    { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  title:        { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 8, letterSpacing: -0.5 },
  sub:          { fontSize: 14, color: C.muted, marginBottom: 24, lineHeight: 20 },

  card:         { backgroundColor: C.bgAlt, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, marginBottom: 28, overflow: 'hidden' },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  modeRow:      { flexDirection: 'row', gap: 10, marginBottom: 20 },
  modeBtn:      { flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 14, borderWidth: 2, borderColor: C.border, backgroundColor: C.bgAlt, gap: 5 },
  modeBtnActive:{ backgroundColor: C.primary, borderColor: C.primary },
  modeBtnTxt:   { fontSize: 14, fontWeight: '800', color: C.muted },
  modeBtnSub:   { fontSize: 11, color: C.muted, textAlign: 'center' },

  dtRow:      { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dtBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 13 },
  dtBtnFilled:{ borderColor: C.primary, backgroundColor: C.bg },
  dtBtnTxt:   { fontSize: 13, fontWeight: '600', color: C.text, flex: 1 },
  dtDone:     { backgroundColor: C.primary, borderRadius: 50, paddingVertical: 12, alignItems: 'center', marginBottom: 10 },
  dtDoneTxt:  { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },

  footer:         { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  reserveBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 17 },
  reserveBtnTxt:  { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  reserveBtnSub:  { fontSize: 11, color: 'rgba(255,255,255,0.65)' },
});

const sr = StyleSheet.create({
  row:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  iconBox: { width: 32, height: 32, borderRadius: 8, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: C.border },
  label:   { fontSize: 10, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value:   { fontSize: 14, fontWeight: '700', color: C.text },
});
