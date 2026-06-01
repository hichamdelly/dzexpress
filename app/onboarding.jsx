import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Platform, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { usersDB } from '../src/db/database';
import { useApp } from '../src/context/AppContext';
import { searchVilles } from '../src/utils/wilayas';

const C = {
  blue:       '#1A56DB',
  blueLight:  '#EBF5FF',
  blueDark:   '#1E40AF',
  orange:     '#F97316',
  orangeLight:'#FFF7ED',
  bg:         '#F8FAFC',
  white:      '#FFFFFF',
  text:       '#1E293B',
  muted:      '#64748B',
  border:     '#E2E8F0',
  green:      '#16A34A',
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

const VEHICULES = [
  { key: 'fourgon',    label: 'Fourgon',       icon: '🚐', sub: 'Jusqu\'à 1T'   },
  { key: 'camion35',   label: 'Camion 3.5T',   icon: '🚛', sub: 'Léger'         },
  { key: 'camion10',   label: 'Camion 10T',    icon: '🚚', sub: 'Lourd'         },
  { key: 'semi',       label: 'Semi-remorque', icon: '🏗️', sub: 'Très lourd'   },
];

export default function OnboardingScreen() {
  const router    = useRouter();
  const { login } = useApp();

  const [step, setStep]         = useState(1);   // 1: role | 2: profil | 3: vehicule
  const [role, setRole]         = useState(null); // 'expediteur' | 'transporteur'

  const [nom, setNom]           = useState('');
  const [tel, setTel]           = useState('+213');
  const [wilaya, setWilaya]     = useState('');
  const [wilayaQ, setWilayaQ]   = useState('');
  const [showWilayas, setShowWilayas] = useState(false);

  const [vehicule, setVehicule] = useState('');
  const [dispo, setDispo]       = useState(true);
  const [saving, setSaving]     = useState(false);

  const wilayaSugg = wilayaQ.length > 0
    ? searchVilles(wilayaQ, WILAYAS)
    : WILAYAS.slice(0, 6);

  const goStep2 = (r) => { setRole(r); setStep(2); };

  const goStep3 = () => {
    if (!nom.trim())   return Alert.alert('Champ requis', 'Entre ton prénom et nom.');
    if (tel.length < 10) return Alert.alert('Champ requis', 'Numéro de téléphone invalide.');
    if (!wilaya)       return Alert.alert('Champ requis', 'Choisis ta wilaya.');
    if (role === 'transporteur') { setStep(3); }
    else handleSave();
  };

  const handleSave = async () => {
    if (role === 'transporteur' && !vehicule)
      return Alert.alert('Champ requis', 'Choisis le type de ton véhicule.');

    setSaving(true);
    try {
      const id = usersDB.create({
        nom:       nom.trim(),
        telephone: tel.trim(),
        wilaya,
        type:      role,
        vehicule:  role === 'transporteur' ? vehicule : null,
        disponible: dispo ? 1 : 0,
      });
      await login(id);
      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Étape 1 : Choix du rôle ──────────────────────────────
  if (step === 1) return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={s.logoBox}>
        <View style={s.logoCircle}>
          <Text style={s.logoEmoji}>🚛</Text>
        </View>
        <Text style={s.appName}>DzExpress</Text>
        <Text style={s.appTagline}>Transport de marchandises{'\n'}partout en 🇩🇿 Algérie</Text>
      </View>

      <Text style={s.chooseTitle}>Comment tu utilises l'app ?</Text>
      <Text style={s.chooseSub}>Winek ? Expéditeur ou transporteur ?</Text>

      <TouchableOpacity style={[s.roleCard, { borderColor: C.orange }]} onPress={() => goStep2('expediteur')} activeOpacity={0.85}>
        <Text style={{ fontSize: 52 }}>📦</Text>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={[s.roleTitle, { color: C.orange }]}>Expéditeur</Text>
          <Text style={s.roleSub}>J'ai une marchandise à envoyer et je cherche un transporteur</Text>
        </View>
        <Text style={{ fontSize: 20, color: C.orange }}>›</Text>
      </TouchableOpacity>

      <TouchableOpacity style={[s.roleCard, { borderColor: C.blue }]} onPress={() => goStep2('transporteur')} activeOpacity={0.85}>
        <Text style={{ fontSize: 52 }}>🚛</Text>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={[s.roleTitle, { color: C.blue }]}>Transporteur</Text>
          <Text style={s.roleSub}>J'ai un véhicule et je cherche des chargements</Text>
        </View>
        <Text style={{ fontSize: 20, color: C.blue }}>›</Text>
      </TouchableOpacity>

      <Text style={s.footerNote}>Gratuit · Sans commission · 100% Algérien 🇩🇿</Text>
    </View>
  );

  // ── Étape 2 : Profil ─────────────────────────────────────
  if (step === 2) return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 24, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn}>
        <Text style={s.backTxt}>← Retour</Text>
      </TouchableOpacity>

      <Text style={s.stepTitle}>
        {role === 'expediteur' ? '📦 Ton profil expéditeur' : '🚛 Ton profil transporteur'}
      </Text>
      <Text style={s.stepSub}>Ces infos seront visibles par les autres utilisateurs</Text>

      <Text style={s.label}>Prénom et Nom *</Text>
      <TextInput
        style={s.input}
        placeholder="Ex : Mohamed Benali"
        placeholderTextColor={C.muted}
        value={nom}
        onChangeText={setNom}
        autoCapitalize="words"
      />

      <Text style={s.label}>Numéro de téléphone *</Text>
      <TextInput
        style={s.input}
        placeholder="+213 770 00 00 00"
        placeholderTextColor={C.muted}
        value={tel}
        onChangeText={setTel}
        keyboardType="phone-pad"
      />

      {tel.length >= 10 && (
        <TouchableOpacity
          style={[s.otpBtn, { borderColor: role === 'expediteur' ? C.orange : C.blue }]}
          onPress={() => router.push(`/otp?phone=${encodeURIComponent(tel)}`)}
          activeOpacity={0.8}
        >
          <Text style={[s.otpBtnTxt, { color: role === 'expediteur' ? C.orange : C.blue }]}>
            🔐 Vérifier mon numéro
          </Text>
        </TouchableOpacity>
      )}

      <Text style={s.label}>Wilaya *</Text>
      <TextInput
        style={s.input}
        placeholder="Recherche ta wilaya…"
        placeholderTextColor={C.muted}
        value={wilayaQ || wilaya}
        onChangeText={t => { setWilayaQ(t); setWilaya(''); setShowWilayas(true); }}
        onFocus={() => setShowWilayas(true)}
      />
      {showWilayas && (
        <View style={s.suggBox}>
          {wilayaSugg.map(w => (
            <TouchableOpacity
              key={w}
              style={s.suggItem}
              onPress={() => { setWilaya(w); setWilayaQ(''); setShowWilayas(false); }}
            >
              <Text style={s.suggTxt}>📍 {w}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {wilaya ? (
        <View style={s.selectedBadge}>
          <Text style={s.selectedBadgeTxt}>✓ {wilaya}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[s.nextBtn, { backgroundColor: role === 'expediteur' ? C.orange : C.blue }]}
        onPress={goStep3}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="white" />
          : <Text style={s.nextBtnTxt}>
              {role === 'transporteur' ? 'Suivant →' : 'Créer mon compte ✓'}
            </Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Étape 3 : Véhicule (transporteur) ───────────────────
  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 24, paddingBottom: 80 }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <TouchableOpacity onPress={() => setStep(2)} style={s.backBtn}>
        <Text style={s.backTxt}>← Retour</Text>
      </TouchableOpacity>

      <Text style={s.stepTitle}>🚛 Ton véhicule</Text>
      <Text style={s.stepSub}>Choisis le type de camion que tu conduis</Text>

      <View style={s.vehicleList}>
        {VEHICULES.map(v => (
          <TouchableOpacity
            key={v.key}
            style={[s.vehicleCard, vehicule === v.key && s.vehicleCardActive]}
            onPress={() => setVehicule(v.key)}
            activeOpacity={0.85}
          >
            <Text style={{ fontSize: 36 }}>{v.icon}</Text>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={[s.vehicleTitle, vehicule === v.key && { color: C.blue }]}>{v.label}</Text>
              <Text style={s.vehicleSub}>{v.sub}</Text>
            </View>
            <View style={[s.radioCircle, vehicule === v.key && s.radioCircleActive]}>
              {vehicule === v.key && <View style={s.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={s.dispoRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.dispoLabel}>🟢 Disponible maintenant</Text>
          <Text style={s.dispoSub}>Tu recevras les nouvelles demandes</Text>
        </View>
        <TouchableOpacity
          style={[s.toggle, dispo && s.toggleOn]}
          onPress={() => setDispo(!dispo)}
        >
          <View style={[s.toggleThumb, dispo && s.toggleThumbOn]} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[s.nextBtn, { backgroundColor: C.blue }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving
          ? <ActivityIndicator color="white" />
          : <Text style={s.nextBtnTxt}>Créer mon compte ✓</Text>
        }
      </TouchableOpacity>

      <Text style={s.footerNote}>Labès ! Tu peux changer ces infos dans ton profil.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16 },

  logoBox:     { alignItems: 'center', marginBottom: 36, paddingHorizontal: 24 },
  logoCircle:  { width: 90, height: 90, borderRadius: 45, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 14, elevation: 6, shadowColor: C.blue, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10 },
  logoEmoji:   { fontSize: 44 },
  appName:     { fontSize: 34, fontWeight: '900', color: C.blue, letterSpacing: -0.5 },
  appTagline:  { fontSize: 15, color: C.muted, textAlign: 'center', marginTop: 6, lineHeight: 22 },

  chooseTitle: { fontSize: 20, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 4, paddingHorizontal: 24 },
  chooseSub:   { fontSize: 14, color: C.muted, textAlign: 'center', marginBottom: 24, paddingHorizontal: 24 },

  roleCard:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 18, padding: 20, marginHorizontal: 20, marginBottom: 14, borderWidth: 2, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8 },
  roleTitle:   { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  roleSub:     { fontSize: 13, color: C.muted, lineHeight: 19 },

  footerNote:  { textAlign: 'center', fontSize: 13, color: C.muted, marginTop: 24, paddingHorizontal: 24 },

  backBtn:     { marginBottom: 20 },
  backTxt:     { fontSize: 15, color: C.blue, fontWeight: '600' },

  stepTitle:   { fontSize: 24, fontWeight: '900', color: C.text, marginBottom: 6 },
  stepSub:     { fontSize: 14, color: C.muted, marginBottom: 28, lineHeight: 20 },

  label:       { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input:       { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: C.text, marginBottom: 18 },

  suggBox:     { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 12, marginTop: -14, marginBottom: 14, overflow: 'hidden', elevation: 4 },
  suggItem:    { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.bg },
  suggTxt:     { fontSize: 14, color: C.text },
  selectedBadge:  { backgroundColor: '#F0FDF4', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, marginTop: -10, marginBottom: 16, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#BBF7D0' },
  selectedBadgeTxt: { fontSize: 13, color: '#16A34A', fontWeight: '700' },

  otpBtn:      { borderWidth: 1.5, borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginBottom: 18 },
  otpBtnTxt:   { fontSize: 14, fontWeight: '700' },

  nextBtn:     { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  nextBtnTxt:  { color: 'white', fontSize: 17, fontWeight: '800' },

  vehicleList: { gap: 12, marginBottom: 24 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 16, padding: 18, borderWidth: 2, borderColor: C.border },
  vehicleCardActive: { borderColor: C.blue, backgroundColor: C.blueLight },
  vehicleTitle:{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 3 },
  vehicleSub:  { fontSize: 13, color: C.muted },
  radioCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  radioCircleActive: { borderColor: C.blue },
  radioDot:    { width: 10, height: 10, borderRadius: 5, backgroundColor: C.blue },

  dispoRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, borderRadius: 16, padding: 18, marginBottom: 24, borderWidth: 1, borderColor: C.border },
  dispoLabel:  { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 3 },
  dispoSub:    { fontSize: 13, color: C.muted },
  toggle:      { width: 52, height: 30, borderRadius: 15, backgroundColor: C.border, justifyContent: 'center', padding: 3 },
  toggleOn:    { backgroundColor: C.green },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.white, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2 },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
