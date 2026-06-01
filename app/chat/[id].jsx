import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Platform, StatusBar, KeyboardAvoidingView,
  Animated, ActivityIndicator, Alert,
} from 'react-native';
import { Audio } from 'expo-av';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { demandesDB, messagesDB } from '../../src/db/database';
import { playNotifSound } from '../../src/utils/sound';

// ── Couleurs ─────────────────────────────────────────────────
const C = {
  blue:      '#1A56DB',
  blueLight: '#EBF5FF',
  blueDark:  '#1E40AF',
  orange:    '#F97316',
  bg:        '#F8FAFC',
  white:     '#FFFFFF',
  text:      '#1E293B',
  muted:     '#64748B',
  border:    '#E2E8F0',
  green:     '#16A34A',
  red:       '#DC2626',
  redLight:  '#FEF2F2',
};

// Waveform statique déterministe (même pour tous les messages)
const WAVE = [3, 7, 11, 8, 14, 10, 6, 12, 9, 13, 5, 8, 11, 7, 4, 9, 12, 6];

function fmtDuration(sec) {
  const s = Math.round(sec || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ════════════════════════════════════════════════════════════
export default function ChatScreen() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const { user } = useApp();

  // ── État texte / messages ────────────────────────────────
  const [demande, setDemande]     = useState(null);
  const [messages, setMessages]   = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending]     = useState(false);
  const [bannerMsg, setBannerMsg] = useState(null);

  // ── État enregistrement ──────────────────────────────────
  const [recording, setRecording]         = useState(null);
  const [isRecording, setIsRecording]     = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);

  // ── État lecture vocale ──────────────────────────────────
  const [playingId, setPlayingId] = useState(null);

  // ── Refs ─────────────────────────────────────────────────
  const flatListRef   = useRef(null);
  const lastCountRef  = useRef(0);
  const intervalRef   = useRef(null);
  const recTimerRef   = useRef(null);
  const soundRef      = useRef(null);
  const bannerY       = useRef(new Animated.Value(-70)).current;
  const recPulse      = useRef(new Animated.Value(1)).current;

  const isExpéditeur = user?.type === 'expediteur';
  const myAccent     = isExpéditeur ? C.orange : C.blue;
  const headerBg     = isExpéditeur ? C.orange  : C.blueDark;

  // ── Demande ──────────────────────────────────────────────
  useEffect(() => {
    try { setDemande(demandesDB.getById(parseInt(id))); } catch (_) {}
  }, [id]);

  const otherName = isExpéditeur
    ? (demande?.transporteur_nom || 'Transporteur')
    : (demande?.expediteur_nom   || 'Expéditeur');

  // ── Nettoyage son au démontage ───────────────────────────
  useEffect(() => () => {
    soundRef.current?.unloadAsync();
    clearInterval(recTimerRef.current);
  }, []);

  // ── Bannière nouveau message ─────────────────────────────
  const showBanner = useCallback((msg) => {
    setBannerMsg(msg);
    bannerY.setValue(-70);
    Animated.sequence([
      Animated.spring(bannerY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.delay(3200),
      Animated.timing(bannerY, { toValue: -70, duration: 250, useNativeDriver: true }),
    ]).start(() => setBannerMsg(null));
  }, [bannerY]);

  // ── Chargement messages (refresh 3 s) ────────────────────
  const loadMessages = useCallback(() => {
    try {
      const msgs = messagesDB.getByDemande(parseInt(id));
      if (msgs.length > lastCountRef.current && lastCountRef.current > 0) {
        const last = msgs[msgs.length - 1];
        if (last.sender_id !== user?.id) {
          const preview = last.type === 'vocal'
            ? '🎤 Message vocal'
            : last.contenu.length > 55 ? last.contenu.slice(0, 55) + '…' : last.contenu;
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

  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
  }, [messages.length]);

  // ── Envoi texte ──────────────────────────────────────────
  const sendMessage = () => {
    const contenu = inputText.trim();
    if (!contenu || sending) return;
    setSending(true);
    try {
      messagesDB.create(parseInt(id), user.id, contenu);
      setInputText('');
      loadMessages();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSending(false);
    }
  };

  // ── Enregistrement vocal ─────────────────────────────────
  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Microphone requis', 'Active l\'accès au micro dans les paramètres.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS:     true,
        playsInSilentModeIOS:   true,
        shouldDuckAndroid:      true,
        playThroughEarpieceAndroid: false,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setIsRecording(true);
      setRecordDuration(0);

      // Pulsation du bouton
      Animated.loop(
        Animated.sequence([
          Animated.timing(recPulse, { toValue: 1.25, duration: 600, useNativeDriver: true }),
          Animated.timing(recPulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ])
      ).start();

      recTimerRef.current = setInterval(() => setRecordDuration(d => d + 1), 1000);
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de démarrer l\'enregistrement.');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    clearInterval(recTimerRef.current);
    recPulse.stopAnimation();
    recPulse.setValue(1);
    const dur = recordDuration;
    setIsRecording(false);

    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false });
      const uri = recording.getURI();
      setRecording(null);
      setRecordDuration(0);

      if (uri && dur >= 1) {                // minimum 1 seconde
        messagesDB.createVoice(parseInt(id), user.id, uri, dur);
        loadMessages();
      }
    } catch (_) {
      setRecording(null);
      setRecordDuration(0);
    }
  };

  // ── Lecture vocale ───────────────────────────────────────
  const playVoice = async (msgId, uri) => {
    try {
      // Stoppe le son en cours
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      if (playingId === msgId) { setPlayingId(null); return; }

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: false });
      const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      soundRef.current = sound;
      setPlayingId(msgId);
      sound.setOnPlaybackStatusUpdate(st => {
        if (st.didJustFinish) {
          sound.unloadAsync();
          soundRef.current = null;
          setPlayingId(null);
        }
      });
    } catch (_) {
      Alert.alert('Lecture impossible', 'Ce fichier audio ne peut pas être lu.');
      setPlayingId(null);
    }
  };

  // ── Rendu bulle ───────────────────────────────────────────
  const renderMsg = ({ item: m, index }) => {
    const isMe       = m.sender_id === user?.id;
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.sender_id !== m.sender_id);
    const showTime   = index === messages.length - 1 ||
                       messages[index + 1]?.sender_id !== m.sender_id;
    const time       = m.created_at ? m.created_at.slice(11, 16) : '';
    const isPlaying  = playingId === m.id;

    return (
      <View style={[b.row, isMe && b.rowMe]}>
        {/* Avatar */}
        {!isMe && (
          <View style={[b.avatar, !showAvatar && { opacity: 0 }]}>
            <Text style={b.avatarTxt}>
              {m.sender_nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'}
            </Text>
          </View>
        )}

        <View style={{ maxWidth: '78%' }}>
          {!isMe && showAvatar && <Text style={b.senderName}>{m.sender_nom}</Text>}

          {/* ── Bulle vocale ── */}
          {m.type === 'vocal' ? (
            <TouchableOpacity
              style={[b.bubble, b.voiceBubble,
                isMe ? [b.bubbleMe, { backgroundColor: myAccent }] : b.bubbleOther
              ]}
              onPress={() => playVoice(m.id, m.uri_fichier)}
              activeOpacity={0.8}
            >
              {/* Bouton play/pause */}
              <View style={[b.playCircle, {
                backgroundColor: isMe ? 'rgba(255,255,255,0.25)' : C.blueLight,
              }]}>
                <Text style={{ fontSize: 16, color: isMe ? 'white' : C.blue }}>
                  {isPlaying ? '⏸' : '▶'}
                </Text>
              </View>

              {/* Waveform */}
              <View style={b.waveform}>
                {WAVE.map((h, i) => (
                  <View key={i} style={[b.bar, {
                    height: h,
                    backgroundColor: isPlaying
                      ? (isMe ? 'rgba(255,255,255,0.9)' : C.blue)
                      : (isMe ? 'rgba(255,255,255,0.45)' : '#CBD5E1'),
                  }]} />
                ))}
              </View>

              {/* Durée */}
              <Text style={[b.voiceDur, { color: isMe ? 'rgba(255,255,255,0.8)' : C.muted }]}>
                {fmtDuration(m.duree)}
              </Text>
            </TouchableOpacity>

          ) : (
            /* ── Bulle texte ── */
            <View style={[b.bubble,
              isMe ? [b.bubbleMe, { backgroundColor: myAccent }] : b.bubbleOther
            ]}>
              <Text style={[b.bubbleTxt, isMe && { color: 'white' }]}>{m.contenu}</Text>
            </View>
          )}

          {showTime && (
            <Text style={[b.time, isMe && b.timeMe]}>
              {time}{isMe && (m.lu ? '  ✓✓' : '  ✓')}
            </Text>
          )}
        </View>
      </View>
    );
  };

  // ────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor={headerBg} />

      {/* ── Bannière nouveau message ── */}
      {bannerMsg && (
        <Animated.View style={[s.banner, { transform: [{ translateY: bannerY }] }]}>
          <Text style={s.bannerTxt} numberOfLines={2}>{bannerMsg}</Text>
        </Animated.View>
      )}

      {/* ── Header ── */}
      <View style={[s.header, { backgroundColor: headerBg }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>← Retour</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.nameRow}>
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
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Text style={{ fontSize: 52, marginBottom: 12 }}>💬</Text>
            <Text style={s.emptyTitle}>Démarrez la conversation</Text>
            <Text style={s.emptySub}>Tapez un message ou maintenez 🎤 pour un vocal</Text>
          </View>
        )}
        renderItem={renderMsg}
        showsVerticalScrollIndicator={false}
      />

      {/* ── Barre de saisie ── */}
      <View style={s.inputBar}>

        {/* Zone texte / indicateur enregistrement */}
        {isRecording ? (
          <View style={s.recordingBar}>
            <Animated.View style={[s.recDot, { transform: [{ scale: recPulse }] }]} />
            <Text style={s.recTimer}>{fmtDuration(recordDuration)}</Text>
            <Text style={s.recHint}>  En cours… relâchez pour envoyer</Text>
          </View>
        ) : (
          <TextInput
            style={s.input}
            placeholder="Message…"
            placeholderTextColor={C.muted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={sendMessage}
          />
        )}

        {/* Bouton micro */}
        <Animated.View style={{ transform: [{ scale: recPulse }] }}>
          <TouchableOpacity
            style={[s.micBtn, isRecording && s.micBtnActive]}
            onLongPress={startRecording}
            onPressOut={stopRecording}
            delayLongPress={200}
            activeOpacity={0.75}
          >
            <Text style={s.micIcon}>{isRecording ? '🔴' : '🎤'}</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Bouton envoyer (masqué pendant enregistrement) */}
        {!isRecording && (
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: myAccent },
              (!inputText.trim() || sending) && s.sendDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={s.sendIcon}>↑</Text>}
          </TouchableOpacity>
        )}
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

  // Bulle commune
  bubble:      { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, elevation: 1 },
  bubbleMe:    { borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#FFFFFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  bubbleTxt:   { fontSize: 15, color: '#1E293B', lineHeight: 21 },

  // Bulle vocale
  voiceBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, minWidth: 180 },
  playCircle:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  waveform:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar:         { width: 2.5, borderRadius: 2 },
  voiceDur:    { fontSize: 11, fontWeight: '700', minWidth: 30, textAlign: 'right' },

  // Timestamps
  time:        { fontSize: 10, color: '#94A3B8', marginTop: 3, marginLeft: 4 },
  timeMe:      { textAlign: 'right', marginRight: 4, marginLeft: 0 },
});

const s = StyleSheet.create({
  header:       { paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:      { paddingVertical: 4 },
  backTxt:      { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700' },
  headerCenter: { flex: 1 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  onlineDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  headerName:   { fontSize: 16, fontWeight: '900', color: 'white' },
  headerRoute:  { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  banner:       { position: 'absolute', top: Platform.OS === 'ios' ? 100 : (StatusBar.currentHeight || 24) + 70, left: 12, right: 12, zIndex: 100, backgroundColor: 'rgba(30,41,59,0.92)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  bannerTxt:    { color: 'white', fontSize: 13, fontWeight: '700', lineHeight: 19 },

  empty:        { alignItems: 'center', paddingTop: 80 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  emptySub:     { fontSize: 13, color: '#64748B', textAlign: 'center' },

  // Barre de saisie
  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 8, gap: 8, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingBottom: Platform.OS === 'ios' ? 28 : 8 },
  input:        { flex: 1, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#1E293B', maxHeight: 120 },

  // Indicateur enregistrement
  recordingBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: '#FECACA' },
  recDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#DC2626' },
  recTimer:     { fontSize: 15, fontWeight: '900', color: '#DC2626', marginLeft: 8 },
  recHint:      { fontSize: 12, color: '#94A3B8', flex: 1 },

  // Boutons
  micBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E2E8F0' },
  micBtnActive: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  micIcon:      { fontSize: 20 },
  sendBtn:      { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  sendDisabled: { opacity: 0.35 },
  sendIcon:     { fontSize: 20, color: 'white', fontWeight: '900', lineHeight: 24 },
});
