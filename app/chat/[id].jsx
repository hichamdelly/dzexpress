import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, Platform, StatusBar, KeyboardAvoidingView,
  Animated, ActivityIndicator, Alert,
} from 'react-native';
import {
  AudioModule, RecordingPresets, createAudioPlayer, setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { demandesDB, messagesDB, notifDB } from '../../src/db/database';
import { NT } from '../../src/lib/notifications';
import { playNotifSound } from '../../src/utils/sound';

const MAX_REC_SECS = 120;

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
};

const WAVE = [3, 7, 11, 8, 14, 10, 6, 12, 9, 13, 5, 8, 11, 7, 4, 9, 12, 6];

function fmtDuration(sec) {
  const s = Math.round(sec || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function ChatScreen() {
  const { id }   = useLocalSearchParams();
  const router   = useRouter();
  const { user } = useApp();

  const [demande, setDemande]       = useState(null);
  const [messages, setMessages]     = useState([]);
  const [inputText, setInputText]   = useState('');
  const [sending, setSending]       = useState(false);
  const [bannerMsg, setBannerMsg]   = useState(null);

  const [recording, setRecording]           = useState(null);
  const [isRecording, setIsRecording]       = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [playingId, setPlayingId]           = useState(null);

  const flatListRef      = useRef(null);
  const lastCountRef     = useRef(0);
  const intervalRef      = useRef(null);
  const recTimerRef      = useRef(null);
  const soundRef         = useRef(null);
  const recordingRef     = useRef(null);   // miroir ref de recording state
  const recDurationRef   = useRef(0);      // miroir ref de recordDuration state
  const bannerY          = useRef(new Animated.Value(-70)).current;
  const recPulse         = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    try { setDemande(demandesDB.getById(parseInt(id))); } catch (_) {}
  }, [id]);

  const otherName = user?.type === 'expediteur'
    ? (demande?.transporteur_nom || 'Transporteur')
    : (demande?.expediteur_nom   || 'Expéditeur');

  useEffect(() => () => {
    try { soundRef.current?.remove(); } catch (_) {}
    clearInterval(recTimerRef.current);
  }, []);

  const showBanner = useCallback((msg) => {
    setBannerMsg(msg);
    bannerY.setValue(-70);
    Animated.sequence([
      Animated.spring(bannerY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.delay(3200),
      Animated.timing(bannerY, { toValue: -70, duration: 250, useNativeDriver: true }),
    ]).start(() => setBannerMsg(null));
  }, [bannerY]);

  const loadMessages = useCallback(() => {
    try {
      const msgs = messagesDB.getByDemande(parseInt(id));
      if (msgs.length > lastCountRef.current && lastCountRef.current > 0) {
        const last = msgs[msgs.length - 1];
        if (last.sender_id !== user?.id) {
          const preview = last.type === 'vocal'
            ? 'Message vocal'
            : last.contenu.length > 55 ? last.contenu.slice(0, 55) + '…' : last.contenu;
          showBanner(`${last.sender_nom} : ${preview}`);
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

  const sendMessage = () => {
    const contenu = inputText.trim();
    if (!contenu || sending) return;
    setSending(true);
    try {
      messagesDB.create(parseInt(id), user.id, contenu);
      const dem = demandesDB.getById(parseInt(id));
      if (dem) {
        const recipientId = dem.expediteur_id === user.id ? dem.transporteur_id : dem.expediteur_id;
        if (recipientId) {
          const preview = contenu.length > 50 ? contenu.substring(0, 50) + '…' : contenu;
          notifDB.create(recipientId, `${user.nom} : ${preview}`, NT.NOUVEAU_MESSAGE, { route: `/chat/${id}` });
        }
      }
      setInputText('');
      loadMessages();
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSending(false);
    }
  };

  // Micro disponible seulement si la course est en cours
  const canVoice = ['acceptee', 'en_route'].includes(demande?.statut);

  const cancelRecordingRef = useRef(false);

  const startRecording = async () => {
    if (!canVoice) return;
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Microphone requis', "Active l'accès au micro dans les paramètres.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, interruptionMode: 'duckOthers', shouldRouteThroughEarpiece: false });
      const rec = new AudioModule.AudioRecorder(RecordingPresets.HIGH_QUALITY);
      await rec.prepareToRecordAsync();
      rec.record();
      cancelRecordingRef.current = false;
      recordingRef.current = rec;
      recDurationRef.current = 0;
      setRecording(rec);
      setIsRecording(true);
      setRecordDuration(0);
      Animated.loop(
        Animated.sequence([
          Animated.timing(recPulse, { toValue: 1.22, duration: 600, useNativeDriver: true }),
          Animated.timing(recPulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
        ])
      ).start();
      recTimerRef.current = setInterval(() => {
        recDurationRef.current += 1;
        setRecordDuration(recDurationRef.current);
      }, 1000);
    } catch {
      Alert.alert('Erreur', "Impossible de démarrer l'enregistrement.");
    }
  };

  const stopRecording = async (cancelled = false) => {
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    clearInterval(recTimerRef.current);
    recPulse.stopAnimation();
    recPulse.setValue(1);
    const dur = recDurationRef.current;
    const shouldDiscard = cancelled || cancelRecordingRef.current;
    setIsRecording(false);
    try {
      await rec.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false });
      const uri = rec.uri;
      setRecording(null);
      recDurationRef.current = 0;
      setRecordDuration(0);
      if (uri && dur >= 1 && !shouldDiscard) {
        messagesDB.createVoice(parseInt(id), user.id, uri, dur);
        const dem = demandesDB.getById(parseInt(id));
        if (dem) {
          const recipientId = dem.expediteur_id === user.id ? dem.transporteur_id : dem.expediteur_id;
          if (recipientId) notifDB.create(recipientId, `${user.nom} vous a envoyé un message vocal`, NT.NOUVEAU_MESSAGE, { route: `/chat/${id}` });
        }
        loadMessages();
      }
    } catch {
      setRecording(null);
      recDurationRef.current = 0;
      setRecordDuration(0);
    }
  };

  const cancelRecording = () => {
    cancelRecordingRef.current = true;
    stopRecording(true);
  };

  // Auto-stop à 2 minutes
  useEffect(() => {
    if (isRecording && recordDuration >= MAX_REC_SECS) {
      stopRecording();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordDuration, isRecording]);

  const playVoice = async (msgId, uri) => {
    try {
      if (soundRef.current) {
        soundRef.current.remove();
        soundRef.current = null;
      }
      if (playingId === msgId) { setPlayingId(null); return; }
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: false });
      const player = createAudioPlayer({ uri });
      soundRef.current = player;
      setPlayingId(msgId);
      player.addListener('playbackStatusUpdate', st => {
        if (st.didJustFinish) {
          player.remove();
          if (soundRef.current === player) soundRef.current = null;
          setPlayingId(null);
        }
      });
      player.play();
    } catch {
      Alert.alert('Lecture impossible', 'Ce fichier audio ne peut pas être lu.');
      setPlayingId(null);
    }
  };

  const renderMsg = ({ item: m, index }) => {
    const isMe       = m.sender_id === user?.id;
    const showAvatar = !isMe && (index === 0 || messages[index - 1]?.sender_id !== m.sender_id);
    const showTime   = index === messages.length - 1 || messages[index + 1]?.sender_id !== m.sender_id;
    const time       = m.created_at ? m.created_at.slice(11, 16) : '';
    const isPlaying  = playingId === m.id;

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
          {!isMe && showAvatar && <Text style={b.senderName}>{m.sender_nom}</Text>}
          {m.type === 'vocal' ? (
            <TouchableOpacity
              style={[b.bubble, b.voiceBubble, isMe ? [b.bubbleMe, { backgroundColor: C.primary }] : b.bubbleOther]}
              onPress={() => playVoice(m.id, m.uri_fichier)}
              activeOpacity={0.8}
            >
              <View style={[b.playCircle, { backgroundColor: isMe ? 'rgba(255,255,255,0.18)' : C.bgAlt }]}>
                <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={isMe ? '#FFFFFF' : C.primary} />
              </View>
              <View style={b.waveform}>
                {WAVE.map((h, i) => (
                  <View key={i} style={[b.bar, {
                    height: h,
                    backgroundColor: isPlaying
                      ? (isMe ? 'rgba(255,255,255,0.9)' : C.primary)
                      : (isMe ? 'rgba(255,255,255,0.4)' : C.border),
                  }]} />
                ))}
              </View>
              <Text style={[b.voiceDur, { color: isMe ? 'rgba(255,255,255,0.75)' : C.muted }]}>
                {fmtDuration(m.duree)}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[b.bubble, isMe ? [b.bubbleMe, { backgroundColor: C.primary }] : b.bubbleOther]}>
              <Text style={[b.bubbleTxt, isMe && { color: '#FFFFFF' }]}>{m.contenu}</Text>
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

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bgAlt }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {bannerMsg && (
        <Animated.View style={[s.banner, { transform: [{ translateY: bannerY }] }]}>
          <Ionicons name="chatbubble-ellipses" size={14} color="#FFFFFF" style={{ marginRight: 7 }} />
          <Text style={s.bannerTxt} numberOfLines={2}>{bannerMsg}</Text>
        </Animated.View>
      )}

      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
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

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => String(m.id)}
        contentContainerStyle={{ padding: 12, paddingBottom: 16, gap: 2 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <View style={s.emptyIconBox}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color="#D1D5DB" />
            </View>
            <Text style={s.emptyTitle}>Démarrez la conversation</Text>
            <Text style={s.emptySub}>
              {canVoice
                ? 'Tapez un message ou maintenez le micro pour un vocal'
                : 'Tapez un message pour démarrer la conversation'}
            </Text>
          </View>
        )}
        renderItem={renderMsg}
        showsVerticalScrollIndicator={false}
      />

      {isRecording && (
        <View style={s.recHintBar}>
          <Animated.View style={[s.recHintDot, { transform: [{ scale: recPulse }] }]} />
          <Text style={s.recHintTxt} numberOfLines={1}>
            {'Enregistrement...  Relâchez pour envoyer'}
          </Text>
          <TouchableOpacity style={s.recCancelBtn} onPress={cancelRecording}>
            <Text style={s.recCancelTxt}>Annuler</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.inputBar}>
        {isRecording ? (
          <View style={s.recordingBar}>
            <Animated.View style={[s.recDot, { transform: [{ scale: recPulse }] }]} />
            <Text style={s.recTimer}>{fmtDuration(recordDuration)}</Text>
            <Text style={s.recProgress}>
              {'  ·  Max '}
              {fmtDuration(MAX_REC_SECS - recordDuration)}
              {' restant'}
            </Text>
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

        {canVoice && (
          <Animated.View style={{ transform: [{ scale: recPulse }] }}>
            <TouchableOpacity
              style={[s.micBtn, isRecording && s.micBtnActive]}
              onLongPress={startRecording}
              onPressOut={() => { if (isRecording) stopRecording(); }}
              delayLongPress={200}
              activeOpacity={0.75}
            >
              <Ionicons
                name={isRecording ? 'radio-button-on' : 'mic-outline'}
                size={20}
                color={isRecording ? C.error : C.muted}
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        {!isRecording && (
          <TouchableOpacity
            style={[s.sendBtn, (!inputText.trim() || sending) && s.sendDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.85}
          >
            {sending
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Ionicons name="arrow-up" size={20} color="#FFFFFF" />}
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const b = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4, gap: 8 },
  rowMe:       { flexDirection: 'row-reverse' },
  avatar:      { width: 32, height: 32, borderRadius: 16, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  avatarTxt:   { fontSize: 11, fontWeight: '900', color: C.accent },
  senderName:  { fontSize: 11, fontWeight: '700', color: C.muted, marginLeft: 4, marginBottom: 3 },
  bubble:      { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, elevation: 1 },
  bubbleMe:    { borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: C.bg, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: C.border },
  bubbleTxt:   { fontSize: 15, color: C.text, lineHeight: 21 },
  voiceBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 12, minWidth: 180 },
  playCircle:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  waveform:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 2 },
  bar:         { width: 2.5, borderRadius: 2 },
  voiceDur:    { fontSize: 11, fontWeight: '700', minWidth: 30, textAlign: 'right' },
  time:        { fontSize: 10, color: C.muted, marginTop: 3, marginLeft: 4 },
  timeMe:      { textAlign: 'right', marginRight: 4, marginLeft: 0 },
});

const s = StyleSheet.create({
  header:       { backgroundColor: C.primary, paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 14, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerCenter: { flex: 1 },
  nameRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  onlineDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ADE80' },
  headerName:   { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  headerRoute:  { fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: '600' },

  banner:       { position: 'absolute', top: Platform.OS === 'ios' ? 100 : (StatusBar.currentHeight || 24) + 70, left: 12, right: 12, zIndex: 100, backgroundColor: 'rgba(10,10,10,0.92)', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, elevation: 12, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  bannerTxt:    { color: '#FFFFFF', fontSize: 13, fontWeight: '700', lineHeight: 19, flex: 1 },

  empty:        { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIconBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: C.text },
  emptySub:     { fontSize: 13, color: C.muted, textAlign: 'center', paddingHorizontal: 24, lineHeight: 19 },

  recHintBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.errorLight, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#FECACA', gap: 8 },
  recHintDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: C.error },
  recHintTxt:   { flex: 1, fontSize: 12, fontWeight: '700', color: C.error },
  recCancelBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 50, backgroundColor: 'rgba(239,68,68,0.12)' },
  recCancelTxt: { fontSize: 12, fontWeight: '800', color: C.error },

  inputBar:     { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 10, paddingVertical: 8, gap: 8, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: Platform.OS === 'ios' ? 28 : 8 },
  input:        { flex: 1, backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: C.text, maxHeight: 120 },
  recordingBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: C.errorLight, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: '#FECACA' },
  recDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: C.error },
  recTimer:     { fontSize: 15, fontWeight: '900', color: C.error, marginLeft: 8 },
  recProgress:  { fontSize: 11, color: C.muted, flex: 1 },
  micBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.border },
  micBtnActive: { backgroundColor: C.errorLight, borderColor: '#FECACA' },
  sendBtn:      { width: 44, height: 44, borderRadius: 22, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4 },
  sendDisabled: { opacity: 0.35 },
});
