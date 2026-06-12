import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, StatusBar, Alert, Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const CODE_LEN = 4;

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
  warning: '#F59E0B', warningLight: '#FFFBEB',
};

export default function OTPScreen() {
  const { phone } = useLocalSearchParams();
  const router    = useRouter();

  const [simCode]             = useState(() => String(Math.floor(1000 + Math.random() * 9000)));
  const [digits, setDigits]   = useState(['', '', '', '']);
  const [error, setError]     = useState('');
  const [verified, setVerified] = useState(false);
  const refs = useRef([]);

  const handleChange = (val, idx) => {
    const clean = val.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    setError('');
    if (clean && idx < CODE_LEN - 1) refs.current[idx + 1]?.focus();
  };

  const handleKey = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx] && idx > 0) {
      refs.current[idx - 1]?.focus();
    }
  };

  const verify = () => {
    const entered = digits.join('');
    if (entered.length < CODE_LEN) { setError('Entre les 4 chiffres du code.'); return; }
    if (entered === simCode) {
      Keyboard.dismiss();
      setVerified(true);
    } else {
      setError('Code incorrect. Réessaie.');
      setDigits(['', '', '', '']);
      refs.current[0]?.focus();
    }
  };

  const resend = () => Alert.alert('Code renvoyé', `Mode démo — code : ${simCode}`);

  if (verified) return (
    <View style={[s.root, s.center]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={s.successIcon}>
        <Ionicons name="checkmark" size={36} color={C.success} />
      </View>
      <Text style={s.successTitle}>Numéro vérifié</Text>
      <Text style={s.successSub}>
        Ton numéro <Text style={{ fontWeight: '700', color: C.text }}>{phone}</Text>{'\n'}a bien été confirmé.
      </Text>
      <TouchableOpacity style={s.doneBtn} onPress={() => router.back()}>
        <Text style={s.doneBtnTxt}>Continuer</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Ionicons name="arrow-back" size={22} color={C.primary} />
      </TouchableOpacity>

      <View style={s.center}>
        <View style={s.phoneIcon}>
          <Ionicons name="phone-portrait-outline" size={32} color={C.accent} />
        </View>

        <Text style={s.title}>Vérification SMS</Text>
        <Text style={s.sub}>
          Code envoyé au{'\n'}
          <Text style={{ fontWeight: '700', color: C.text }}>{phone || 'ton numéro'}</Text>
        </Text>

        <View style={s.simBadge}>
          <Ionicons name="construct-outline" size={13} color={C.warning} style={{ marginRight: 6 }} />
          <Text style={s.simTxt}>Mode démo — code : {simCode}</Text>
        </View>

        <View style={s.codeRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={r => refs.current[i] = r}
              style={[s.box, d && s.boxFilled, !!error && s.boxError]}
              value={d}
              onChangeText={t => handleChange(t, i)}
              onKeyPress={e => handleKey(e, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
              textAlign="center"
            />
          ))}
        </View>

        {!!error && (
          <View style={s.errorRow}>
            <Ionicons name="alert-circle-outline" size={14} color={C.error} style={{ marginRight: 4 }} />
            <Text style={s.errorTxt}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={s.verifyBtn} onPress={verify}>
          <Text style={s.verifyBtnTxt}>Vérifier le code</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.resendBtn} onPress={resend}>
          <Text style={s.resendTxt}>Renvoyer le code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn:{ width: 40, height: 40, borderRadius: 20, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },

  phoneIcon: { width: 72, height: 72, borderRadius: 20, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title:  { fontSize: 26, fontWeight: '700', color: C.text, marginBottom: 10, textAlign: 'center', letterSpacing: -0.5 },
  sub:    { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },

  simBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.warningLight, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 28, borderWidth: 1, borderColor: '#FDE68A' },
  simTxt:   { fontSize: 13, color: C.warning, fontWeight: '600' },

  codeRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  box:     { width: 62, height: 68, borderRadius: 12, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt, fontSize: 28, fontWeight: '700', color: C.text, textAlign: 'center' },
  boxFilled:{ borderColor: C.accent, backgroundColor: C.accentLight },
  boxError: { borderColor: C.error, backgroundColor: C.errorLight },

  errorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  errorTxt: { color: C.error, fontSize: 13, fontWeight: '600' },

  verifyBtn:    { width: '100%', backgroundColor: C.primary, borderRadius: 50, paddingVertical: 17, alignItems: 'center', marginTop: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  verifyBtnTxt: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

  resendBtn: { marginTop: 18, paddingVertical: 8 },
  resendTxt: { color: C.muted, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },

  successIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: C.successLight, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { fontSize: 26, fontWeight: '700', color: C.text, marginBottom: 10, textAlign: 'center' },
  successSub:   { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  doneBtn:      { backgroundColor: C.success, borderRadius: 50, paddingVertical: 16, paddingHorizontal: 52, alignItems: 'center' },
  doneBtnTxt:   { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
