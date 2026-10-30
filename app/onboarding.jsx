import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  StyleSheet, Platform, StatusBar, ActivityIndicator, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usersDB } from '../src/db/database';
import { useApp } from '../src/context/AppContext';
import { searchVilles } from '../src/utils/wilayas';

const C = {
  primary: '#0A0A0A', accent: '#0F4D2E', accentLight: '#E8F2EC',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981',
};

const WILAYAS = [
  'Adrar','Aïn Defla','Aïn Témouchent','Alger','Annaba','Batna','Béchar','Béjaïa',
  'Biskra','Blida','Bordj Bou Arréridj','Bouira','Boumerdès','Chlef','Constantine',
  'Djelfa','El Bayadh','El Oued','El Tarf','Ghardaïa','Guelma','Illizi','Jijel',
  'Khenchela','Laghouat','Mascara','Médéa','Mila','Mostaganem','Msila','Naâma','Oran',
  'Ouargla','Oum El Bouaghi','Relizane','Saïda','Sétif','Sidi Bel Abbès','Skikda',
  'Souk Ahras','Tamanrasset','Tébessa','Tiaret','Tindouf','Tipaza','Tissemsilt',
  'Tizi Ouzou','Tlemcen',
];

const VEHICULES = [
  { key: 'fourgon',  label: 'Fourgon',       sub: 'Jusqu\'à 1T',    icon: 'bus-outline' },
  { key: 'camion35', label: 'Camion 3.5T',   sub: 'Charge légère',  icon: 'car-outline' },
  { key: 'camion10', label: 'Camion 10T',    sub: 'Charge lourde',  icon: 'car-sport-outline' },
  { key: 'semi',     label: 'Semi-remorque', sub: 'Très lourd',     icon: 'navigate-outline' },
];

export default function OnboardingScreen() {
  const router    = useRouter();
  const { login } = useApp();

  const [step, setStep]     = useState(1);
  const [role, setRole]     = useState(null);

  const [nom, setNom]       = useState('');
  const [tel, setTel]       = useState('+213');
  const [wilaya, setWilaya] = useState('');
  const [wilayaQ, setWilayaQ] = useState('');
  const [showWilayas, setShowWilayas] = useState(false);

  const [vehicule, setVehicule] = useState('');
  const [dispo, setDispo]       = useState(true);
  const [saving, setSaving]     = useState(false);

  const wilayaSugg = wilayaQ.length > 0 ? searchVilles(wilayaQ, WILAYAS) : WILAYAS.slice(0, 6);

  const goStep2 = (r) => { setRole(r); setStep(2); };

  const goStep3 = () => {
    if (!nom.trim())    return Alert.alert('Champ requis', 'Entre ton prénom et nom.');
    if (tel.length < 10) return Alert.alert('Champ requis', 'Numéro de téléphone invalide.');
    if (!wilaya)        return Alert.alert('Champ requis', 'Choisis ta wilaya.');
    if (role === 'transporteur') setStep(3);
    else handleSave();
  };

  const handleSave = async () => {
    if (role === 'transporteur' && !vehicule)
      return Alert.alert('Champ requis', 'Choisis le type de ton véhicule.');
    setSaving(true);
    try {
      const id = usersDB.create({
        nom: nom.trim(), telephone: tel.trim(), wilaya,
        type: role, vehicule: role === 'transporteur' ? vehicule : null,
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

      <View style={s.logoSection}>
        <Image
          source={require('../assets/images/routex-logo.jpg')}
          style={{ alignSelf: 'stretch', height: 320 }}
          contentFit="contain"
        />
        <Text style={s.tagline}>Transport de marchandises en Algérie</Text>
      </View>

      <TouchableOpacity style={s.roleCard} onPress={() => goStep2('expediteur')} activeOpacity={0.88}>
        <View style={[s.roleIcon, { backgroundColor: C.accentLight }]}>
          <Ionicons name="cube-outline" size={28} color={C.accent} />
        </View>
        <View style={s.roleText}>
          <Text style={s.roleTitle}>Expéditeur</Text>
          <Text style={s.roleSub}>J'ai une marchandise à envoyer et je cherche un chauffeur</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
      </TouchableOpacity>

      <TouchableOpacity style={s.roleCard} onPress={() => goStep2('transporteur')} activeOpacity={0.88}>
        <View style={[s.roleIcon, { backgroundColor: '#F0F9FF' }]}>
          <Ionicons name="car-sport-outline" size={28} color="#0EA5E9" />
        </View>
        <View style={s.roleText}>
          <Text style={s.roleTitle}>Chauffeur</Text>
          <Text style={s.roleSub}>J'ai un véhicule et je cherche des chargements</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
      </TouchableOpacity>

      <Text style={s.footerNote}>Gratuit · Sans commission · 100% Algérien</Text>

      <TouchableOpacity
        style={s.adminLink}
        onPress={() => router.push('/admin/login')}
        activeOpacity={0.7}
      >
        <Ionicons name="shield-outline" size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
        <Text style={s.adminLinkTxt}>Accès gestionnaire</Text>
      </TouchableOpacity>
    </View>
  );

  // ── Étape 2 : Profil ─────────────────────────────────────
  if (step === 2) return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <TouchableOpacity onPress={() => setStep(1)} style={s.backBtn}>
        <Ionicons name="arrow-back" size={20} color={C.primary} />
      </TouchableOpacity>

      <View style={s.stepHeader}>
        <View style={[s.stepIcon, { backgroundColor: role === 'expediteur' ? C.accentLight : '#F0F9FF' }]}>
          <Ionicons name={role === 'expediteur' ? 'cube-outline' : 'car-sport-outline'} size={24} color={role === 'expediteur' ? C.accent : '#0EA5E9'} />
        </View>
        <Text style={s.stepTitle}>{role === 'expediteur' ? 'Profil expéditeur' : 'Profil chauffeur'}</Text>
        <Text style={s.stepSub}>Ces infos seront visibles par les autres utilisateurs</Text>
      </View>

      {/* Indicateur étape */}
      <View style={s.stepDots}>
        <View style={s.dot} />
        <View style={[s.dot, s.dotActive]} />
        {role === 'transporteur' && <View style={s.dot} />}
      </View>

      <Text style={s.label}>Prénom et Nom</Text>
      <TextInput
        style={s.input}
        placeholder="Mohamed Benali"
        placeholderTextColor="#9CA3AF"
        value={nom}
        onChangeText={setNom}
        autoCapitalize="words"
      />

      <Text style={s.label}>Numéro de téléphone</Text>
      <TextInput
        style={s.input}
        placeholder="+213 770 00 00 00"
        placeholderTextColor="#9CA3AF"
        value={tel}
        onChangeText={setTel}
        keyboardType="phone-pad"
      />
      {tel.length >= 10 && (
        <TouchableOpacity
          style={s.otpBtn}
          onPress={() => router.push(`/otp?phone=${encodeURIComponent(tel)}`)}
          activeOpacity={0.8}
        >
          <Ionicons name="lock-closed-outline" size={14} color={C.muted} style={{ marginRight: 6 }} />
          <Text style={s.otpBtnTxt}>Vérifier mon numéro</Text>
        </TouchableOpacity>
      )}

      <Text style={s.label}>Wilaya</Text>
      <TextInput
        style={s.input}
        placeholder="Recherche ta wilaya…"
        placeholderTextColor="#9CA3AF"
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
              <Ionicons name="location-outline" size={14} color="#9CA3AF" style={{ marginRight: 8 }} />
              <Text style={s.suggTxt}>{w}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {wilaya && (
        <View style={s.selectedBadge}>
          <Ionicons name="checkmark-circle" size={14} color={C.success} style={{ marginRight: 6 }} />
          <Text style={s.selectedBadgeTxt}>{wilaya}</Text>
        </View>
      )}

      <TouchableOpacity
        style={[s.primaryBtn, { marginTop: 24 }]}
        onPress={goStep3}
        disabled={saving}
        activeOpacity={0.88}
      >
        {saving
          ? <ActivityIndicator color="#FFFFFF" />
          : <Text style={s.primaryBtnTxt}>{role === 'transporteur' ? 'Suivant' : 'Créer mon compte'}</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );

  // ── Étape 3 : Véhicule (transporteur) ───────────────────
  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 80 }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <TouchableOpacity onPress={() => setStep(2)} style={s.backBtn}>
        <Ionicons name="arrow-back" size={20} color={C.primary} />
      </TouchableOpacity>

      <View style={s.stepHeader}>
        <View style={[s.stepIcon, { backgroundColor: '#F0F9FF' }]}>
          <Ionicons name="car-sport-outline" size={24} color="#0EA5E9" />
        </View>
        <Text style={s.stepTitle}>Ton véhicule</Text>
        <Text style={s.stepSub}>Choisis le type de camion que tu conduis</Text>
      </View>

      <View style={s.stepDots}>
        <View style={s.dot} />
        <View style={s.dot} />
        <View style={[s.dot, s.dotActive]} />
      </View>

      <View style={s.vehicleList}>
        {VEHICULES.map(v => (
          <TouchableOpacity
            key={v.key}
            style={[s.vehicleCard, vehicule === v.key && s.vehicleCardActive]}
            onPress={() => setVehicule(v.key)}
            activeOpacity={0.88}
          >
            <View style={[s.vehicleIcon, vehicule === v.key && { backgroundColor: '#EBF5FF' }]}>
              <Ionicons name={v.icon} size={24} color={vehicule === v.key ? '#1A56DB' : C.muted} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[s.vehicleLabel, vehicule === v.key && { color: C.primary }]}>{v.label}</Text>
              <Text style={s.vehicleSub}>{v.sub}</Text>
            </View>
            <View style={[s.radio, vehicule === v.key && s.radioActive]}>
              {vehicule === v.key && <View style={s.radioDot} />}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[s.dispoRow]}
        onPress={() => setDispo(!dispo)}
        activeOpacity={0.85}
      >
        <View style={{ flex: 1 }}>
          <Text style={s.dispoLabel}>Disponible maintenant</Text>
          <Text style={s.dispoSub}>Tu recevras les nouvelles demandes</Text>
        </View>
        <View style={[s.toggle, dispo && s.toggleOn]}>
          <View style={[s.toggleThumb, dispo && s.toggleThumbOn]} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.primaryBtn, { marginTop: 8 }]}
        onPress={handleSave}
        disabled={saving}
        activeOpacity={0.88}
      >
        {saving
          ? <ActivityIndicator color="#FFFFFF" />
          : <Text style={s.primaryBtnTxt}>Créer mon compte</Text>
        }
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: C.bg,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16,
    paddingHorizontal: 24,
  },

  // Étape 1
  logoSection: { alignItems: 'center', marginBottom: 20 },
  tagline:     { fontSize: 14, color: C.muted, marginTop: 4, textAlign: 'center' },

  roleCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.bg, borderRadius: 12, padding: 18,
    marginBottom: 12, borderWidth: 1.5, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  roleIcon:  { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  roleText:  { flex: 1 },
  roleTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 3 },
  roleSub:   { fontSize: 13, color: C.muted, lineHeight: 18 },

  footerNote:{ textAlign: 'center', fontSize: 13, color: C.muted, marginTop: 32 },
  adminLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, paddingVertical: 8 },
  adminLinkTxt: { fontSize: 11, color: '#9CA3AF' },

  // Étape 2 & 3
  backBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  stepHeader: { marginBottom: 8 },
  stepIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  stepTitle:{ fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 4, letterSpacing: -0.4 },
  stepSub:  { fontSize: 14, color: C.muted, marginBottom: 24, lineHeight: 20 },

  stepDots: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  dot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  dotActive:{ backgroundColor: '#D4A017', width: 20, borderRadius: 4 },

  label: { fontSize: 12, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  input: {
    backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 14,
    fontSize: 15, color: C.text, marginBottom: 18,
  },

  suggBox:  { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginTop: -14, marginBottom: 14, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
  suggItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.bgAlt },
  suggTxt:  { fontSize: 14, color: C.text },

  selectedBadge:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: -10, marginBottom: 18, alignSelf: 'flex-start' },
  selectedBadgeTxt: { fontSize: 13, color: C.success, fontWeight: '600' },

  otpBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingVertical: 11, marginBottom: 18 },
  otpBtnTxt: { fontSize: 14, fontWeight: '600', color: C.muted },

  primaryBtn:    { backgroundColor: C.accent, borderRadius: 50, paddingVertical: 17, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  primaryBtnTxt: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  // Véhicules
  vehicleList: { gap: 10, marginBottom: 24 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: C.border },
  vehicleCardActive: { borderColor: '#1A56DB', backgroundColor: '#F0F9FF' },
  vehicleIcon:  { width: 44, height: 44, borderRadius: 10, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },
  vehicleLabel: { fontSize: 15, fontWeight: '700', color: C.muted, marginBottom: 2 },
  vehicleSub:   { fontSize: 12, color: C.muted },
  radio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  radioActive:  { borderColor: '#1A56DB' },
  radioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1A56DB' },

  dispoRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderRadius: 12, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: C.border },
  dispoLabel: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  dispoSub:   { fontSize: 12, color: C.muted },
  toggle:     { width: 48, height: 28, borderRadius: 14, backgroundColor: C.border, justifyContent: 'center', padding: 2 },
  toggleOn:   { backgroundColor: C.success },
  toggleThumb:{ width: 24, height: 24, borderRadius: 12, backgroundColor: C.bg, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15 },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
