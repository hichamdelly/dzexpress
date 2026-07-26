import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Platform, StatusBar, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { adminDB } from '../../src/db/database';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', primary: '#1A56DB',
  text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
  error: '#DC2626', errorLight: '#FEF2F2',
};

export default function AdminLoginScreen() {
  const router = useRouter();
  const [tel, setTel]         = useState('');
  const [mdp, setMdp]         = useState('');
  const [showMdp, setShowMdp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur]   = useState('');

  const handleLogin = async () => {
    setErreur('');
    if (!tel.trim() || !mdp.trim()) {
      setErreur('Remplis tous les champs.');
      return;
    }
    setLoading(true);
    try {
      const admin = adminDB.login(tel.trim(), mdp.trim());
      if (!admin) {
        setErreur('Identifiants incorrects. Vérifie ton téléphone et mot de passe.');
        return;
      }
      await AsyncStorage.setItem('dzexpress_admin_id', String(admin.id));
      router.replace('/admin/dashboard');
    } catch (e) {
      setErreur('Erreur de connexion : ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={20} color={C.muted} />
      </TouchableOpacity>

      {/* Logo */}
      <View style={s.logoSection}>
        <View style={s.logoBadge}>
          <View style={s.logoInner}>
            <Text style={s.logoDz}>Dz</Text>
          </View>
          <Text style={s.logoExpress}>Express</Text>
        </View>
        <View style={s.adminBadge}>
          <Ionicons name="shield-checkmark" size={12} color={C.primary} />
          <Text style={s.adminBadgeTxt}>Espace Gestionnaire</Text>
        </View>
      </View>

      <Text style={s.title}>Connexion Admin</Text>
      <Text style={s.sub}>Accès réservé aux gestionnaires DzExpress</Text>

      {/* Card formulaire */}
      <View style={s.card}>
        <Text style={s.label}>Téléphone</Text>
        <TextInput
          style={s.input}
          placeholder="+213 555 000 000"
          placeholderTextColor="#9CA3AF"
          value={tel}
          onChangeText={t => { setTel(t); setErreur(''); }}
          keyboardType="phone-pad"
          autoCapitalize="none"
        />

        <Text style={s.label}>Mot de passe</Text>
        <View style={s.passwordRow}>
          <TextInput
            style={[s.input, { flex: 1, marginBottom: 0 }]}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            value={mdp}
            onChangeText={t => { setMdp(t); setErreur(''); }}
            secureTextEntry={!showMdp}
            autoCapitalize="none"
          />
          <TouchableOpacity style={s.eyeBtn} onPress={() => setShowMdp(v => !v)}>
            <Ionicons name={showMdp ? 'eye-off-outline' : 'eye-outline'} size={20} color={C.muted} />
          </TouchableOpacity>
        </View>

        {!!erreur && (
          <View style={s.errBox}>
            <Ionicons name="alert-circle-outline" size={14} color={C.error} />
            <Text style={s.errTxt}>{erreur}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.loginBtn, loading && { opacity: 0.7 }]}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading
            ? <ActivityIndicator color="#FFFFFF" />
            : <>
                <Ionicons name="log-in-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={s.loginBtnTxt}>Se connecter</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* Hint dev */}
      <View style={s.hint}>
        <Ionicons name="information-circle-outline" size={14} color={C.muted} />
        <Text style={s.hintTxt}>
          {'Compte de test : +213555000000 / admin123'}
        </Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: {
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16,
    paddingHorizontal: 24, paddingBottom: 40,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: 32,
  },

  logoSection: { alignItems: 'center', marginBottom: 32, gap: 10 },
  logoBadge:   { flexDirection: 'row', alignItems: 'center' },
  logoInner:   { backgroundColor: '#F97316', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginRight: 5 },
  logoDz:      { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  logoExpress: { fontSize: 22, fontWeight: '800', color: C.text, letterSpacing: -0.5 },
  adminBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#EBF5FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50 },
  adminBadgeTxt: { fontSize: 12, fontWeight: '700', color: C.primary },

  title: { fontSize: 24, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 6, letterSpacing: -0.5 },
  sub:   { fontSize: 14, color: C.muted, textAlign: 'center', marginBottom: 28, lineHeight: 20 },

  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  label:       { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  input:       { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: C.text, marginBottom: 16 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  eyeBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

  errBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.errorLight, borderRadius: 8, padding: 10, marginBottom: 14 },
  errTxt: { fontSize: 13, color: C.error, flex: 1, fontWeight: '600' },

  loginBtn:    { backgroundColor: C.primary, borderRadius: 12, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  loginBtnTxt: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  hint:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, justifyContent: 'center' },
  hintTxt: { fontSize: 12, color: C.muted, fontStyle: 'italic' },
});
