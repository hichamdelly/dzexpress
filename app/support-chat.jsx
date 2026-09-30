import { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../src/context/AppContext';

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981',
  bot: '#1A56DB', botLight: '#EBF5FF',
};

const BOT_NAME  = 'Support DzExpress';
const BOT_DELAY = 900; // ms

const WELCOME = "Bonjour ! Je suis l'assistant DzExpress. Comment puis-je vous aider aujourd'hui ?";

const REPONSES_AUTO = [
  {
    mots: ['annul', 'cancel'],
    texte: "Pour annuler une course : ouvrez votre demande dans l'onglet \"Mes demandes\" et appuyez sur \"Annuler\". L'annulation est gratuite dans les 5 premières minutes après acceptation.",
  },
  {
    mots: ['pay', 'prix', 'tarif', 'cost', 'combien', 'da', 'argent'],
    texte: "Le paiement s'effectue en espèces directement au transporteur à la livraison. Le paiement électronique (CIB/Edahabia) sera disponible bientôt. Le prix est calculé automatiquement selon la distance et le type de véhicule.",
  },
  {
    mots: ['transport', 'chauffeur', 'camion', 'fourgon', 'trouver', 'dispo'],
    texte: "Pour trouver un transporteur : depuis l'accueil, choisissez \"Maintenant\" pour voir les transporteurs disponibles sur la carte, ou \"Planifié\" pour publier votre demande et recevoir plusieurs offres.",
  },
  {
    mots: ['problem', 'probl', 'bug', 'erreur', 'signaler', 'plaindre'],
    texte: "Pour signaler un problème, rendez-vous dans l'écran Aide (onglet Profil → Aide & Support) et utilisez le formulaire \"Signaler un problème\". Nous traitons chaque signalement sous 24h.",
  },
  {
    mots: ['inscr', 'creer', 'compte', 'nouveau', 'register'],
    texte: "Pour créer un compte, lancez l'application et suivez les 3 étapes d'inscription : choisissez votre rôle (Expéditeur ou Transporteur), renseignez vos informations, puis vérifiez votre numéro.",
  },
  {
    mots: ['profil', 'modif', 'nom', 'tel', 'wilaya', 'vehicule'],
    texte: "Pour modifier votre profil, rendez-vous dans l'onglet \"Profil\" et appuyez sur le bouton \"Modifier\". Vous pouvez changer votre nom, téléphone, wilaya et type de véhicule.",
  },
  {
    mots: ['note', 'avis', 'evaluat', 'star', 'etoile'],
    texte: "La notation se fait après chaque livraison. Donnez une note de 1 à 5 étoiles et un commentaire. Les transporteurs avec une note > 4,5 bénéficient d'une commission réduite de 10%.",
  },
];

const FALLBACK = "Je transmets votre message à notre équipe support. Un agent vous répondra dans les plus brefs délais. Vous pouvez aussi nous appeler directement au +213 555 000 111 (7j/7, 8h–22h).";

function detectReponse(texte) {
  const lower = texte.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const r of REPONSES_AUTO) {
    if (r.mots.some(m => lower.includes(m))) return r.texte;
  }
  return FALLBACK;
}

function fmtTime(date) {
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function SupportChatScreen() {
  const router  = useRouter();
  const { user } = useApp();
  const scrollRef = useRef(null);
  const [input, setInput]       = useState('');
  const [typing, setTyping]     = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, role: 'bot', texte: WELCOME, ts: new Date() },
  ]);

  const addMessage = (msg) => setMessages(prev => [...prev, msg]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages, typing]);

  const envoyer = () => {
    const txt = input.trim();
    if (!txt) return;
    setInput('');

    const userMsg = { id: Date.now(), role: 'user', texte: txt, ts: new Date() };
    addMessage(userMsg);
    setTyping(true);

    setTimeout(() => {
      setTyping(false);
      addMessage({ id: Date.now() + 1, role: 'bot', texte: detectReponse(txt), ts: new Date() });
    }, BOT_DELAY);
  };

  const SUGGESTIONS = ['Annuler une course', 'Modes de paiement', 'Trouver un transporteur', 'Signaler un problème'];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
        <StatusBar barStyle="light-content" backgroundColor={C.primary} />

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={s.headerTitle}>{BOT_NAME}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <View style={s.onlineDot} />
              <Text style={s.onlineTxt}>En ligne · 7j/7 8h–22h</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/aide')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="help-circle-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 8 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {messages.map(msg => (
            <View key={msg.id} style={[s.msgRow, msg.role === 'user' && s.msgRowUser]}>
              {msg.role === 'bot' && (
                <View style={s.botAvatar}>
                  <Text style={s.botAvatarTxt}>DZ</Text>
                </View>
              )}
              <View style={[s.bubble, msg.role === 'user' ? s.bubbleUser : s.bubbleBot]}>
                <Text style={[s.bubbleTxt, msg.role === 'user' && { color: '#FFFFFF' }]}>{msg.texte}</Text>
                <Text style={[s.bubbleTs, msg.role === 'user' && { color: 'rgba(255,255,255,0.6)' }]}>
                  {fmtTime(msg.ts)}
                </Text>
              </View>
            </View>
          ))}

          {typing && (
            <View style={s.msgRow}>
              <View style={s.botAvatar}><Text style={s.botAvatarTxt}>DZ</Text></View>
              <View style={[s.bubble, s.bubbleBot, s.typingBubble]}>
                <View style={s.dots}>
                  <View style={[s.dot, { opacity: 0.4 }]} />
                  <View style={[s.dot, { opacity: 0.7 }]} />
                  <View style={s.dot} />
                </View>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Suggestions */}
        {messages.length === 1 && !typing && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
            {SUGGESTIONS.map(sg => (
              <TouchableOpacity key={sg} style={s.suggestion}
                onPress={() => { setInput(sg); }}>
                <Text style={s.suggestionTxt}>{sg}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Input */}
        <View style={s.inputBar}>
          <TextInput
            style={s.input}
            value={input}
            onChangeText={setInput}
            placeholder="Votre message…"
            placeholderTextColor="#9CA3AF"
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={envoyer}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[s.sendBtn, !input.trim() && s.sendBtnDisabled]}
            onPress={envoyer}
            disabled={!input.trim()}
            activeOpacity={0.85}
          >
            <Ionicons name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 14, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  onlineDot:   { width: 7, height: 7, borderRadius: 4, backgroundColor: C.success, marginRight: 5 },
  onlineTxt:   { fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: '500' },

  msgRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowUser: { flexDirection: 'row-reverse' },

  botAvatar:    { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bot, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  botAvatarTxt: { fontSize: 10, fontWeight: '900', color: '#FFFFFF' },

  bubble:     { maxWidth: '78%', borderRadius: 16, padding: 12 },
  bubbleBot:  { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderBottomLeftRadius: 4 },
  bubbleUser: { backgroundColor: C.primary, borderBottomRightRadius: 4 },
  bubbleTxt:  { fontSize: 14, color: C.text, lineHeight: 20 },
  bubbleTs:   { fontSize: 10, color: C.muted, marginTop: 5, textAlign: 'right' },

  typingBubble: { paddingVertical: 14 },
  dots:         { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: C.muted },

  suggestion:    { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border },
  suggestionTxt: { fontSize: 12, fontWeight: '600', color: C.muted },

  inputBar:        { flexDirection: 'row', alignItems: 'flex-end', padding: 12, paddingBottom: Platform.OS === 'ios' ? 28 : 12, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  input:           { flex: 1, backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: C.text, maxHeight: 100 },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  sendBtnDisabled: { backgroundColor: '#9CA3AF' },
});
