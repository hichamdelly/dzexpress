import { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, StatusBar, Alert, Keyboard,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

const CODE_LEN = 4;

const C = {
  blue:      '#1A56DB',
  blueLight: '#EBF5FF',
  bg:        '#F8FAFC',
  white:     '#FFFFFF',
  text:      '#1E293B',
  muted:     '#64748B',
  border:    '#E2E8F0',
  green:     '#16A34A',
  greenLight:'#F0FDF4',
  red:       '#DC2626',
  yellow:    '#92400E',
  yellowBg:  '#FFFBEB',
  yellowBorder: '#FDE68A',
};

export default function OTPScreen() {
  const { phone } = useLocalSearchParams();
  const router    = useRouter();

  const [simCode]           = useState(() => String(Math.floor(1000 + Math.random() * 9000)));
  const [digits, setDigits] = useState(['', '', '', '']);
  const [error, setError]   = useState('');
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

  const resend = () => Alert.alert('Code renvoyé', `SMS simulé — code : ${simCode}`);

  /* ── Succès ── */
  if (verified) return (
    <View style={[s.root, s.center]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <Text style={{ fontSize: 64, marginBottom: 16 }}>✅</Text>
      <Text style={s.successTitle}>Numéro vérifié !</Text>
      <Text style={s.successSub}>
        Ton numéro <Text style={{ fontWeight: '800', color: C.text }}>{phone}</Text>{'\n'}
        a bien été confirmé.
      </Text>
      <TouchableOpacity style={s.doneBtn} onPress={() => router.back()}>
        <Text style={s.doneBtnTxt}>Continuer →</Text>
      </TouchableOpacity>
    </View>
  );

  /* ── Saisie ── */
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backTxt}>← Retour</Text>
      </TouchableOpacity>

      <View style={s.center}>
        <Text style={{ fontSize: 48, marginBottom: 14 }}>📱</Text>
        <Text style={s.title}>Vérification SMS</Text>
        <Text style={s.sub}>
          Code envoyé au{'\n'}
          <Text style={{ fontWeight: '800', color: C.text }}>{phone || 'ton numéro'}</Text>
        </Text>

        {/* Badge démo */}
        <View style={s.simBadge}>
          <Text style={s.simTxt}>🔧 Mode démo — code SMS : {simCode}</Text>
        </View>

        {/* Cases OTP */}
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

        {!!error && <Text style={s.errorTxt}>{error}</Text>}

        <TouchableOpacity style={s.verifyBtn} onPress={verify}>
          <Text style={s.verifyBtnTxt}>Vérifier le code ✓</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.resendBtn} onPress={resend}>
          <Text style={s.resendTxt}>Renvoyer le code</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16, paddingHorizontal: 24 },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn:      { marginBottom: 8 },
  backTxt:      { fontSize: 15, color: C.blue, fontWeight: '600' },

  title:        { fontSize: 26, fontWeight: '900', color: C.text, marginBottom: 10, textAlign: 'center' },
  sub:          { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 20 },

  simBadge:     { backgroundColor: C.yellowBg, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 28, borderWidth: 1, borderColor: C.yellowBorder },
  simTxt:       { fontSize: 13, color: C.yellow, fontWeight: '600' },

  codeRow:      { flexDirection: 'row', gap: 12, marginBottom: 16 },
  box:          { width: 62, height: 70, borderRadius: 14, borderWidth: 2, borderColor: C.border, backgroundColor: C.white, fontSize: 28, fontWeight: '900', color: C.text, textAlign: 'center', elevation: 1 },
  boxFilled:    { borderColor: C.blue, backgroundColor: C.blueLight },
  boxError:     { borderColor: C.red },
  errorTxt:     { color: C.red, fontSize: 13, fontWeight: '600', marginBottom: 12 },

  verifyBtn:    { width: '100%', backgroundColor: C.blue, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  verifyBtnTxt: { color: 'white', fontSize: 17, fontWeight: '800' },
  resendBtn:    { marginTop: 16, paddingVertical: 8 },
  resendTxt:    { color: C.blue, fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },

  successTitle: { fontSize: 26, fontWeight: '900', color: C.green, marginBottom: 10, textAlign: 'center' },
  successSub:   { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  doneBtn:      { backgroundColor: C.green, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48, alignItems: 'center' },
  doneBtnTxt:   { color: 'white', fontSize: 17, fontWeight: '800' },
});
