import { useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

const C = {
  blue:        '#1A56DB',
  blueLight:   '#EBF5FF',
  orange:      '#F97316',
  orangeLight: '#FFF7ED',
  bg:          '#F8FAFC',
  white:       '#FFFFFF',
  text:        '#1E293B',
  muted:       '#64748B',
  border:      '#E2E8F0',
  green:       '#16A34A',
  greenLight:  '#F0FDF4',
  star:        '#FBBF24',
};

const LABELS = ['', '😞 Très mauvais', '😕 Mauvais', '😐 Passable', '😊 Bien', '🤩 Excellent !'];

const TAGS_T = ['Ponctuel', 'Professionnel', 'Marchandise intacte', 'Bonne communication', 'Rapide'];
const TAGS_E = ['Colis bien emballé', 'Ponctuel', 'Communicatif', 'Instructions claires', 'Respectueux'];

export default function NotationScreen() {
  const { nom, type, demandeId } = useLocalSearchParams();
  const router = useRouter();

  const isRatingT = type === 'transporteur';
  const accent    = isRatingT ? C.blue : C.orange;
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

  /* ── Confirmation ── */
  if (submitted) return (
    <View style={[s.root, s.centerFull]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
      <Text style={{ fontSize: 64, marginBottom: 16 }}>⭐</Text>
      <Text style={s.successTitle}>Merci pour ta note !</Text>
      <Text style={s.successSub}>
        Ton avis aide la communauté{'\n'}DzExpress à s'améliorer 🇩🇿
      </Text>
      <TouchableOpacity
        style={[s.doneBtn, { backgroundColor: accent }]}
        onPress={() => router.replace('/(tabs)')}
      >
        <Text style={s.doneBtnTxt}>Retour à l'accueil</Text>
      </TouchableOpacity>
    </View>
  );

  /* ── Formulaire ── */
  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <Text style={{ fontSize: 52, marginBottom: 12 }}>
          {isRatingT ? '🚛' : '📦'}
        </Text>
        <Text style={s.title}>Note ta livraison</Text>
        <Text style={s.sub}>
          Comment s'est passé ton expérience avec{'\n'}
          <Text style={[s.nameHl, { color: accent }]}>{nom || 'cet utilisateur'}</Text> ?
        </Text>
      </View>

      {/* Étoiles */}
      <View style={s.starsRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity key={star} onPress={() => setRating(star)} style={s.starBtn} activeOpacity={0.7}>
            <Text style={[s.star, star <= rating && s.starOn]}>★</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.ratingLabel}>{LABELS[rating] || 'Appuie sur une étoile'}</Text>

      {/* Tags rapides */}
      <Text style={s.label}>Sélectionne ce qui s'applique</Text>
      <View style={s.tagsRow}>
        {tags.map(tag => {
          const active = comment.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[s.tag, active && { backgroundColor: isRatingT ? C.blueLight : C.orangeLight, borderColor: accent }]}
              onPress={() => {
                if (active) setComment(c => c.replace(`, ${tag}`, '').replace(tag, '').replace(/^,\s*/, ''));
                else addTag(tag);
              }}
            >
              <Text style={[s.tagTxt, active && { color: accent, fontWeight: '700' }]}>
                {active ? '✓ ' : '+ '}{tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Commentaire libre */}
      <Text style={[s.label, { marginTop: 8 }]}>Commentaire libre (optionnel)</Text>
      <TextInput
        style={s.input}
        placeholder="Partage ton expérience…"
        placeholderTextColor={C.muted}
        value={comment}
        onChangeText={setComment}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {/* Bouton soumettre */}
      <TouchableOpacity
        style={[s.submitBtn, { backgroundColor: accent }, rating === 0 && s.btnDisabled]}
        onPress={submit}
        disabled={rating === 0}
        activeOpacity={0.85}
      >
        <Text style={s.submitBtnTxt}>
          {rating === 0 ? 'Choisis une note d\'abord' : `Envoyer ⭐ ${rating}/5`}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.skipBtn} onPress={() => router.replace('/(tabs)')}>
        <Text style={s.skipTxt}>Passer pour l'instant</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg, paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 24) + 16 },
  centerFull:  { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

  header:      { alignItems: 'center', marginBottom: 24 },
  title:       { fontSize: 26, fontWeight: '900', color: C.text, marginBottom: 10 },
  sub:         { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22 },
  nameHl:      { fontWeight: '800' },

  starsRow:    { flexDirection: 'row', justifyContent: 'center', gap: 4, marginBottom: 10 },
  starBtn:     { padding: 6 },
  star:        { fontSize: 48, color: C.border },
  starOn:      { color: C.star },
  ratingLabel: { textAlign: 'center', fontSize: 16, fontWeight: '700', color: C.muted, marginBottom: 28 },

  label:       { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 },

  tagsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tag:         { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8 },
  tagTxt:      { fontSize: 13, fontWeight: '600', color: C.muted },

  input:       { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, fontSize: 15, color: C.text, minHeight: 100, marginBottom: 24 },

  submitBtn:   { borderRadius: 16, paddingVertical: 18, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6 },
  submitBtnTxt:{ color: 'white', fontSize: 17, fontWeight: '800' },
  btnDisabled: { opacity: 0.45 },

  skipBtn:     { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  skipTxt:     { color: C.muted, fontSize: 14, fontWeight: '600' },

  successTitle:{ fontSize: 26, fontWeight: '900', color: C.green, marginBottom: 10, textAlign: 'center' },
  successSub:  { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  doneBtn:     { borderRadius: 14, paddingVertical: 16, paddingHorizontal: 48, alignItems: 'center' },
  doneBtnTxt:  { color: 'white', fontSize: 17, fontWeight: '800' },
});
