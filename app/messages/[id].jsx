import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Platform, StatusBar, KeyboardAvoidingView,
  Animated, ActivityIndicator, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { demandesDB, messagesDB } from '../../src/db/database';
import { playNotifSound } from '../../src/utils/sound';

const C = {
  blue:        '#1A56DB',
  blueLight:   '#EBF5FF',
  blueDark:    '#1E40AF',
  orange:      '#0F4D2E',
  orangeLight: '#E8F2EC',
  bg:          '#F8FAFC',
  white:       '#FFFFFF',
  text:        '#1E293B',
  muted:       '#64748B',
  border:      '#E2E8F0',
  green:       '#16A34A',
  greenLight:  '#F0FDF4',
  red:         '#DC2626',
};

export default function ChatScreen() {
  const { id }    = useLocalSearchParams();
  const router    = useRouter();
  const { user }  = useApp();

  const [demande, setDemande]     = useState(null);
  const [messages, setMessages]   = useState([]);
  const [text, setText]           = useState('');
  const [sending, setSending]     = useState(false);
  const [bannerMsg, setBannerMsg] = useState(null);

  const flatListRef  = useRef(null);
  const lastCountRef = useRef(0);
  const intervalRef  = useRef(null);
  const bannerY      = useRef(new Animated.Value(-70)).current;

  const isExpéditeur = user?.type === 'expediteur';
  const myAccent     = isExpéditeur ? C.orange : C.blue;

  // ── Demande ──────────────────────────────────────────────────
  useEffect(() => {
    try {
      const d = demandesDB.getById(parseInt(id));
      setDemande(d);
    } catch (_) {}
  }, [id]);

  const otherName = isExpéditeur
    ? (demande?.transporteur_nom || 'Chauffeur')
    : (demande?.expediteur_nom  || 'Expéditeur');

  // ── Bannière nouveau message ─────────────────────────────────
  const showBanner = useCallback((msg) => {
    setBannerMsg(msg);
    bannerY.setValue(-70);
    Animated.sequence([
      Animated.spring(bannerY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.delay(3200),
      Animated.timing(bannerY, { toValue: -70, duration: 250, useNativeDriver: true }),
    ]).start(() => setBannerMsg(null));
  }, [bannerY]);

  // ── Chargement + refresh messages ────────────────────────────
  const loadMessages = useCallback(() => {
    try {
      const msgs = messagesDB.getByDemande(parseInt(id));

      // Détecte nouveaux messages de l'autre personne
      if (msgs.length > lastCountRef.current && lastCountRef.current > 0) {
        const last = msgs[msgs.length - 1];
        if (last.sender_id !== user?.id) {
          const preview = last.contenu.length > 55
            ? last.contenu.slice(0, 55) + '…'
            : last.contenu;
          showBanner(`💬 ${last.sender_nom} : ${preview}`);
          playNotifSound();
        }
      }
      lastCountRef.current = msgs.length;
      setMessages(msgs);
      messagesDB.markRead(parseInt(id), user?.id);
    } catch (_) {}
  }, [id, user?.id, showBanner]);

  useFocusEffect(useCallback(() => {
    loadMessages();
    intervalRef.current = setInterval(loadMessages, 3000);
    return () => clearInterval(intervalRef.current);
  }, [loadMessages]));

  // ── Scroll vers le bas à chaque nouveau message ───────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ── Envoi ────────────────────────────────────────────────────
  const sendMessage = () => {
    const contenu = text.trim();
    if (!contenu || sending) return;
    setSending(true);
    try {
      messagesDB.create(parseInt(id), user.id, contenu);
      setText('');
      loadMessages();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSending(false);
    }
  };

  // ── Rendu bulle ───────────────────────────────────────────────
  const renderMsg = ({ item: m, index }) => {
    const isMe    = m.sender_id === user?.id;
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.sender_id !== m.sender_id);
    const showTime   = index === messages.length - 1 ||
                       messages[index + 1]?.sender_id !== m.sender_id;
    const time = m.created_at
      ? m.created_at.slice(11, 16)
      : '';

    return (
      <View style={[b.row, isMe && b.rowMe]}>
        {!isMe && (
          <View style={[b.avatar, !showAvatar && { opacity: 0 }]}>
            <Text style={b.avatarTxt}>
              {m.sender_nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
            </Text>
          </View>
        )}
        <View style={{ maxWidth: '78%' }}>
          {!isMe && showAvatar && (
            <Text style={b.senderName}>{m.sender_nom}</Text>
          )}
          <View style={[b.bubble, isMe ? [b.bubbleMe, { backgroundColor: myAccent }] : b.bubbleOther]}>
            <Text style={[b.bubbleTxt, isMe && { color: 'white' }]}>{m.contenu}</Text>
          </View>
          {showTime && (
            <Text style={[b.time, isMe && b.timeMe]}>
              {time}
              {isMe && (m.lu ? '  ✓✓' : '  ✓')}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.blueDark} />

      {/* ── Bannière nouveau message ── */}
      {bannerMsg && (
        <Animated.View style={[s.banner, { transform: [{ translateY: bannerY }] }]}>
          <Text style={s.bannerTxt} numberOfLines={2}>{bannerMsg}</Text>
        </Animated.View>
      )}

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: isExpéditeur ? C.orange : C.blueDark }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>← Retour</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.headerNameRow}>
            <View style={s.onlineDot} />
            <Text style={s.headerName} numberOfLines={1}>{otherName}</Text>
          </View>
          {demande && (
            <Text style={s.headerRoute} numberOfLines={1}>
              {demande.ville_depart} → {demande.ville_arrivee}
            </Text>
          )}
        </View>
      </View>

      {/* ── Liste messages ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => String(m.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 16, gap: 2 }}
        ListEmptyComponent={() => (
          <View style={s.emptyBox}>
            <Text style={{ fontSize: 52, marginBottom: 12 }}>💬</Text>
            <Text style={s.emptyTitle}>Démarrez la conversation</Text>
            <Text style={s.emptySub}>Écrivez votre premier message ci-dessous</Text>
          </View>
        )}
        renderItem={renderMsg}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Barre de saisie ── */}
      <View style={s.inputBar}>
        <TextInput
          style={s.input}
          placeholder="Votre message…"
          placeholderTextColor={C.muted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[s.sendBtn, { backgroundColor: myAccent }, (!text.trim() || sending) && s.sendBtnDisabled]}
          onPress={sendMessage}
          disabled={!text.trim() || sending}
          activeOpacity={0.85}
        >
          {sending
            ? <ActivityIndicator color="white" size="small" />
            : <Text style={s.sendIcon}>↑</Text>
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ── Styles bulles ────────────────────────────────────────────
const b = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4, gap: 8 },
  rowMe:       { flexDirection: 'row-reverse' },
  avatar:      { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EBF5FF', alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  avatarTxt:   { fontSize: 11, fontWeight: '900', color: '#1A56DB' },
  senderName:  { fontSize: 11, fontWeight: '700', color: '#64748B', marginLeft: 4, marginBottom: 3 },
  bubble:      { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, elevation: 1 },
  bubbleMe:    { borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  bubbleTxt:   { fontSize: 15, color: '#1E293B', lineHeight: 21 },
  time:        { fontSize: 10, color: '#94A3B8', marginTop: 3, marginLeft: 4 },
  timeMe:      { textAlign: 'right', marginRight: 4, marginLeft: 0 },
});

const s = StyleSheet.create({
  header:      { paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:     { paddingVertical: 4 },
  backTxt:     { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700' },
  headerCenter:{ flex: 1 },
  headerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  onlineDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  headerName:  { fontSize: 16, fontWeight: '900', color: 'white' },
  headerRoute: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  banner:      { position: 'absolute', top: Platform.OS === 'ios' ? 100 : (StatusBar.currentHeight || 24) + 70, left: 12, right: 12, zIndex: 100, backgroundColor: 'rgba(30,41,59,0.92)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  bannerTxt:   { color: 'white', fontSize: 13, fontWeight: '700', lineHeight: 19 },

  emptyBox:    { alignItems: 'center', paddingTop: 80 },
  emptyTitle:  { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  emptySub:    { fontSize: 14, color: '#64748B', textAlign: 'center' },

  inputBar:    { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 10, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingBottom: Platform.OS === 'ios' ? 28 : 12 },
  input:       { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#1E293B', maxHeight: 120 },
  sendBtn:     { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  sendBtnDisabled: { opacity: 0.4 },
  sendIcon:    { fontSize: 20, color: 'white', fontWeight: '900', lineHeight: 24 },
});
