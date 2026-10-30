import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const C = {
  primary: '#0A0A0A', accent: '#0F4D2E', accentLight: '#E8F2EC',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  star: '#F59E0B',
};

const LABELS = ['', 'Très mauvais', 'Mauvais', 'Passable', 'Bien', 'Excellent'];

const TAGS_T = ['Ponctuel', 'Professionnel', 'Marchandise intacte', 'Bonne communication', 'Rapide'];
const TAGS_E = ['Colis bien emballé', 'Ponctuel', 'Communicatif', 'Instructions claires', 'Respectueux'];

export default function NotationScreen() {
  const { nom, type, demandeId } = useLocalSearchParams();
  const router = useRouter();

  const isRatingT = type === 'transporteur';
  const tags      = isRatingT ? TAGS_T : TAGS_E;

  const [rating,    setRating]    = useState(0);
  const [comment,   setComment]   = useState('');
  const [submitted, setSubmitted] = useState(false);

  const addTag = tag => setComment(c => c ? `${c}, ${tag}` : tag);

  const submit = () => {
    if (rating === 0) return;
    // TODO: persist rating to DB when backend ready
    setSubmitted(true);
  };

  if (submitted) return (
    <View style={[s.root, { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <View style={s.successIcon}>
        <Ionicons name="star" size={36} color={C.star} />
      </View>
      <Text style={s.successTitle}>Merci pour ta note !</Text>
      <Text style={s.successSub}>Ton avis aide la communauté RouteX à s'améliorer.</Text>
      <TouchableOpacity style={s.doneBtn} onPress={() => router.replace('/(tabs)')}>
        <Text style={s.doneBtnTxt}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
        <Ionicons name="arrow-back" size={20} color={C.primary} />
      </TouchableOpacity>

      {/* Header */}
      <View style={s.header}>
        <View style={[s.avatarBox, { backgroundColor: isRatingT ? '#EBF5FF' : C.accentLight }]}>
          <Ionicons name={isRatingT ? 'car-sport-outline' : 'cube-outline'} size={28} color={isRatingT ? '#1A56DB' : C.accent} />
        </View>
        <Text style={s.title}>Note ta livraison</Text>
        <Text style={s.sub}>
          Comment s'est passé ton expérience avec{'\n'}
          <Text style={{ fontWeight: '700', color: C.text }}>{nom || 'cet utilisateur'}</Text> ?
        </Text>
      </View>

      {/* Étoiles */}
      <View style={s.starsRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} onPress={() => setRating(star)} style={s.starBtn} activeOpacity={0.7}>
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={44}
              color={star <= rating ? C.star : '#D1D5DB'}
            />
          </TouchableOpacity>
        ))}
      </View>
      {rating > 0 && (
        <Text style={s.ratingLabel}>{LABELS[rating]}</Text>
      )}

      {/* Séparateur */}
      <View style={s.divider} />

      {/* Tags rapides */}
      <Text style={s.label}>Sélectionne ce qui s'applique</Text>
      <View style={s.tagsRow}>
        {tags.map(tag => {
          const active = comment.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[s.tag, active && { backgroundColor: C.accentLight, borderColor: C.accent }]}
              onPress={() => {
                if (active) setComment(c => c.replace(`, ${tag}`, '').replace(tag, '').replace(/^,\s*/, ''));
                else addTag(tag);
              }}
            >
              {active && <Ionicons name="checkmark" size={12} color={C.accent} style={{ marginRight: 4 }} />}
              <Text style={[s.tagTxt, active && { color: C.accent, fontWeight: '700' }]}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Commentaire libre */}
      <Text style={[s.label, { marginTop: 8 }]}>Commentaire (optionnel)</Text>
      <TextInput
        style={s.input}
        placeholder="Partage ton expérience…"
        placeholderTextColor="#9CA3AF"
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[s.submitBtn, rating === 0 && s.btnDisabled]}
        onPress={submit}
        disabled={rating === 0}
        activeOpacity={0.88}
      >
        <Text style={s.submitBtnTxt}>
          {rating === 0 ? 'Choisis une note d\'abord' : `Envoyer ma note — ${rating}/5`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.skipBtn} onPress={() => router.replace('/(tabs)')}>
        <Text style={s.skipTxt}>Passer pour l'instant</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },

  header:    { alignItems: 'center', marginBottom: 28 },
  avatarBox: { width: 72, height: 72, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title:     { fontSize: 26, fontWeight: '700', color: C.text, marginBottom: 8, letterSpacing: -0.5 },
  sub:       { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22 },

  starsRow:    { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 10 },
  starBtn:     { padding: 4 },
  ratingLabel: { textAlign: 'center', fontSize: 16, fontWeight: '600', color: C.text, marginBottom: 24 },

  divider: { height: 1, backgroundColor: C.border, marginVertical: 24 },

  label:   { fontSize: 12, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  tag:     { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 50, paddingHorizontal: 14, paddingVertical: 8 },
  tagTxt:  { fontSize: 13, fontWeight: '600', color: C.muted },

  input: { backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: C.text, minHeight: 100, marginBottom: 24 },

  submitBtn:    { backgroundColor: C.accent, borderRadius: 50, paddingVertical: 17, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 2 },
  submitBtnTxt: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  btnDisabled:  { opacity: 0.4 },

  skipBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  skipTxt: { color: C.muted, fontSize: 14, fontWeight: '500' },

  successIcon:  { width: 88, height: 88, borderRadius: 44, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { fontSize: 26, fontWeight: '700', color: C.text, marginBottom: 10, textAlign: 'center' },
  successSub:   { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 36 },
  doneBtn:      { backgroundColor: C.accent, borderRadius: 50, paddingVertical: 16, paddingHorizontal: 52, alignItems: 'center' },
  doneBtnTxt:   { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
