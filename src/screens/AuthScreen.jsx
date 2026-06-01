// src/screens/AuthScreen.jsx
// ============================================================
//  Écran Connexion — OTP par numéro de téléphone algérien
// ============================================================

import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import { authAPI } from '../lib/supabase';

const C = {
  green: '#1B6E44', greenLight: '#E8F5EE',
  bg: '#F7F8FA', white: '#FFFFFF',
  text: '#1A1A2E', muted: '#6B7280', border: '#E5E7EB',
};

export default function AuthScreen({ onAuthenticated }) {
  const [step, setStep]       = useState('phone');  // 'phone' | 'otp'
  const [phone, setPhone]     = useState('');
  const [formatted, setFormatted] = useState('');
  const [otp, setOtp]         = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const otpRefs               = useRef([]);

  const handleSendOTP = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 9) {
      Alert.alert('Numéro invalide', 'Entrez votre numéro algérien (ex: 0770 123 456)');
      return;
    }
    setLoading(true);
    try {
      const fmt = await authAPI.sendOTP(cleaned);
      setFormatted(fmt);
      setStep('otp');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible d\'envoyer le SMS. Vérifiez votre numéro.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (val, idx) => {
    const newOtp = [...otp];
    newOtp[idx] = val;
    setOtp(newOtp);
    if (val && idx < 5) otpRefs.current[idx + 1]?.focus();
    if (!val && idx > 0) otpRefs.current[idx - 1]?.focus();
    if (newOtp.every(d => d !== '')) {
      verifyCode(newOtp.join(''));
    }
  };

  const verifyCode = async (code) => {
    setLoading(true);
    try {
      await authAPI.verifyOTP(formatted, code);
      onAuthenticated();
    } catch (e) {
      Alert.alert('Code incorrect', 'Le code entré est invalide ou expiré.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header vert */}
      <View style={s.hero}>
        <Text style={s.logo}>🚗 Rakib.dz</Text>
        <Text style={s.heroTitle}>
          {step === 'phone' ? 'Bienvenue !' : 'Vérification'}
        </Text>
        <Text style={s.heroSub}>
          {step === 'phone'
            ? 'Covoiturage partout en Algérie'
            : `Code envoyé au ${formatted}`}
        </Text>
      </View>

      <View style={s.card}>
        {step === 'phone' ? (
          <>
            <Text style={s.label}>Votre numéro de téléphone</Text>
            <View style={s.phoneRow}>
              <View style={s.prefix}>
                <Text style={s.prefixText}>🇩🇿 +213</Text>
              </View>
              <TextInput
                style={s.phoneInput}
                placeholder="0770 123 456"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                maxLength={12}
                placeholderTextColor={C.muted}
                autoFocus
              />
            </View>
            <Text style={s.hint}>
              Un SMS avec un code de vérification vous sera envoyé.
            </Text>
            <TouchableOpacity
              style={[s.btn, loading && { opacity: 0.7 }]}
              onPress={handleSendOTP}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="white" />
                : <Text style={s.btnText}>Recevoir le code SMS →</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.label}>Entrez le code à 6 chiffres</Text>
            <View style={s.otpRow}>
              {otp.map((digit, i) => (
                <TextInput
                  key={i}
                  ref={r => otpRefs.current[i] = r}
                  style={[s.otpBox, digit && s.otpBoxFilled]}
                  value={digit}
                  onChangeText={v => handleOtpChange(v.slice(-1), i)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                />
              ))}
            </View>
            {loading && (
              <ActivityIndicator color={C.green} style={{ marginTop: 16 }} />
            )}
            <TouchableOpacity
              style={s.resendBtn}
              onPress={() => { setStep('phone'); setOtp(['','','','','','']); }}
            >
              <Text style={s.resendText}>← Changer de numéro</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={s.terms}>
        En continuant, vous acceptez les conditions d'utilisation de Rakib.dz
      </Text>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: C.bg },
  hero:        { backgroundColor: C.green, paddingTop: Platform.OS === 'ios' ? 80 : 60,
                 paddingBottom: 40, paddingHorizontal: 24, alignItems: 'center' },
  logo:        { color: 'white', fontSize: 28, fontWeight: '800', marginBottom: 12 },
  heroTitle:   { color: 'white', fontSize: 24, fontWeight: '700', marginBottom: 6 },
  heroSub:     { color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center' },

  card:        { backgroundColor: C.white, borderRadius: 20, marginHorizontal: 16,
                 marginTop: -20, padding: 24,
                 shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                 shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  label:       { fontSize: 14, fontWeight: '600', color: C.text, marginBottom: 12 },

  phoneRow:    { flexDirection: 'row', gap: 10, marginBottom: 12 },
  prefix:      { backgroundColor: C.greenLight, borderRadius: 10, paddingHorizontal: 14,
                 paddingVertical: 12, justifyContent: 'center' },
  prefixText:  { fontSize: 14, fontWeight: '600', color: C.green },
  phoneInput:  { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
                 paddingHorizontal: 14, fontSize: 16, color: C.text },
  hint:        { fontSize: 12, color: C.muted, marginBottom: 20, lineHeight: 18 },

  btn:         { backgroundColor: C.green, borderRadius: 12, paddingVertical: 14,
                 alignItems: 'center', justifyContent: 'center' },
  btnText:     { color: 'white', fontSize: 16, fontWeight: '700' },

  otpRow:      { flexDirection: 'row', gap: 10, justifyContent: 'center', marginBottom: 20 },
  otpBox:      { width: 44, height: 54, borderRadius: 10, borderWidth: 1.5,
                 borderColor: C.border, textAlign: 'center', fontSize: 22,
                 fontWeight: '700', color: C.text, backgroundColor: C.bg },
  otpBoxFilled:{ borderColor: C.green, backgroundColor: C.greenLight },

  resendBtn:   { alignSelf: 'center', padding: 8, marginTop: 8 },
  resendText:  { color: C.green, fontSize: 14, fontWeight: '600' },

  terms:       { textAlign: 'center', fontSize: 11, color: C.muted,
                 marginTop: 20, paddingHorizontal: 32, lineHeight: 18 },
});
