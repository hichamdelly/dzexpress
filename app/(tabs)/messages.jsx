import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Platform, StatusBar, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { messagesDB } from '../../src/db/database';

const C = {
  blue:        '#1A56DB',
  blueLight:   '#EBF5FF',
  blueDark:    '#1E40AF',
  orange:      '#F97316',
  orangeLight: '#FFF7ED',
  bg:          '#F8FAFC',
  white:       '#FFFFFF',
  text:        '#1E293B',
  muted:       '#64748B',
  border:      '#E2E8F0',
  green:       '#16A34A',
  greenLight:  '#F0FDF4',
  red:         '#DC2626',
};

const VEH_ICON = { fourgon: '🚐', camion35: '🚛', camion10: '🚚', semi: '🏗️' };

const STATUT_COLOR = {
  acceptee: C.blue,
  en_cours: C.orange,
  livree:   C.green,
  en_attente: C.muted,
  annulee:  C.red,
};

function fmtTime(isoStr) {
  if (!isoStr) return '';
  const d   = new Date(isoStr.replace(' ', 'T'));
  const now = new Date();
  const diff = now - d;
  if (diff < 60_000)  return 'À l\'instant';
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)} min`;
  if (diff < 86_400_000) return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function MessagesScreen() {
  const { user } = useApp();
  const router   = useRouter();

  const [convs, setConvs]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isExpéditeur = user?.type === 'expediteur';
  const accentColor  = isExpéditeur ? C.orange : C.blue;
  const headerBg     = isExpéditeur ? C.orange : C.blueDark;

  const load = useCallback(() => {
    if (!user) return;
    try {
      setConvs(messagesDB.getConversations(user.id));
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  if (!user) return null;

  const renderConv = ({ item: conv }) => {
    const otherName = isExpéditeur
      ? (conv.transporteur_nom || 'Transporteur')
      : conv.expediteur_nom;
    const initials = otherName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
    const hasUnread = conv.nb_unread > 0;

    return (
      <TouchableOpacity
        style={[s.convCard, hasUnread && s.convCardUnread]}
        onPress={() => router.push(`/chat/${conv.id}`)}
        activeOpacity={0.85}
      >
        {/* Avatar */}
        <View style={[s.avatar, { backgroundColor: isExpéditeur ? '#FFF7ED' : C.blueLight }]}>
          <Text style={[s.avatarTxt, { color: accentColor }]}>{initials}</Text>
          {hasUnread && (
            <View style={s.unreadDot}><Text style={s.unreadDotTxt}>{conv.nb_unread > 9 ? '9+' : conv.nb_unread}</Text></View>
          )}
        </View>

        {/* Infos */}
        <View style={s.convInfo}>
          <View style={s.convTopRow}>
            <Text style={[s.convName, hasUnread && s.convNameBold]}>{otherName}</Text>
            <Text style={s.convTime}>{fmtTime(conv.last_message_at)}</Text>
          </View>

          <View style={s.convRouteRow}>
            <Text style={s.convRoute} numberOfLines={1}>
              📍 {conv.ville_depart} → {conv.ville_arrivee}
            </Text>
            <View style={[s.statut, { backgroundColor: STATUT_COLOR[conv.statut] + '22' }]}>
              <Text style={[s.statutTxt, { color: STATUT_COLOR[conv.statut] }]}>
                {conv.statut === 'acceptee' ? '✅ Acceptée'
                  : conv.statut === 'en_cours' ? '🚛 En cours'
                  : conv.statut === 'livree'   ? '📦 Livrée'
                  : conv.statut}
              </Text>
            </View>
          </View>

          {conv.last_message && (
            <Text
              style={[s.lastMsg, hasUnread && s.lastMsgBold]}
              numberOfLines={1}
            >
              {conv.last_message}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="light-content" backgroundColor={headerBg} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: headerBg }]}>
        <Text style={s.headerTitle}>💬 Messages</Text>
        <Text style={s.headerSub}>
          {convs.length} conversation{convs.length !== 1 ? 's' : ''}
          {convs.reduce((s, c) => s + (c.nb_unread || 0), 0) > 0
            ? ` · ${convs.reduce((s, c) => s + (c.nb_unread || 0), 0)} non lu${convs.reduce((s, c) => s + c.nb_unread, 0) > 1 ? 's' : ''}`
            : ''}
        </Text>
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={accentColor} /></View>
      ) : convs.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 52, marginBottom: 14 }}>💬</Text>
          <Text style={s.emptyTitle}>Aucune conversation</Text>
          <Text style={s.emptySub}>
            Les messages apparaissent dès qu'une livraison est acceptée.
          </Text>
        </View>
      ) : (
        <FlatList
          data={convs}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 90 }}
          renderItem={renderConv}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={accentColor}
            />
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header:       { paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12, paddingBottom: 16, paddingHorizontal: 20 },
  headerTitle:  { color: 'white', fontSize: 22, fontWeight: '900' },
  headerSub:    { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 3 },

  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle:   { fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 8, textAlign: 'center' },
  emptySub:     { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },

  convCard:     { backgroundColor: C.white, borderRadius: 16, padding: 14, flexDirection: 'row', gap: 12, elevation: 1, borderWidth: 1, borderColor: C.border },
  convCardUnread:{ borderColor: C.blue, borderWidth: 1.5 },

  avatar:       { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarTxt:    { fontSize: 17, fontWeight: '900' },
  unreadDot:    { position: 'absolute', top: -3, right: -3, backgroundColor: C.red, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: C.white },
  unreadDotTxt: { color: 'white', fontSize: 10, fontWeight: '900' },

  convInfo:     { flex: 1 },
  convTopRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  convName:     { fontSize: 15, fontWeight: '700', color: C.text },
  convNameBold: { fontWeight: '900', color: C.blue },
  convTime:     { fontSize: 11, color: C.muted },

  convRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' },
  convRoute:    { fontSize: 12, color: C.muted, fontWeight: '600', flex: 1 },
  statut:       { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  statutTxt:    { fontSize: 10, fontWeight: '700' },

  lastMsg:      { fontSize: 13, color: C.muted, lineHeight: 18 },
  lastMsgBold:  { color: C.text, fontWeight: '600' },
});
