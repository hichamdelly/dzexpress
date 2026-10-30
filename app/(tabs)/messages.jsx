import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Platform, StatusBar, ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/context/AppContext';
import { messagesDB } from '../../src/db/database';

const C = {
  primary: '#0A0A0A', accent: '#0F4D2E', accentLight: '#E8F2EC',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', error: '#EF4444',
};

const STATUT_ICON = {
  acceptee:   { icon: 'checkmark-circle', color: '#1A56DB' },
  en_cours:   { icon: 'car-sport',        color: C.accent  },
  livree:     { icon: 'cube',             color: C.success },
  en_attente: { icon: 'time-outline',     color: C.muted   },
  annulee:    { icon: 'close-circle',     color: C.error   },
};

function fmtTime(isoStr) {
  if (!isoStr) return '';
  const d   = new Date(isoStr.replace(' ', 'T'));
  const now = new Date();
  const diff = now - d;
  if (diff < 60_000)    return 'À l\'instant';
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

  const load = useCallback(() => {
    if (!user) return;
    try { setConvs(messagesDB.getConversations(user.id)); }
    catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  if (!user) return null;

  const totalUnread = convs.reduce((s, c) => s + (c.nb_unread || 0), 0);

  const renderConv = ({ item: conv }) => {
    const otherName = isExpéditeur
      ? (conv.transporteur_nom || 'Chauffeur')
      : conv.expediteur_nom;
    const initials  = otherName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
    const hasUnread = conv.nb_unread > 0;
    const statutInfo = STATUT_ICON[conv.statut] || STATUT_ICON.en_attente;

    return (
      <TouchableOpacity
        style={[s.card, hasUnread && s.cardUnread]}
        onPress={() => router.push(`/chat/${conv.id}`)}
        activeOpacity={0.9}
      >
        {/* Avatar */}
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{initials}</Text>
          {hasUnread && (
            <View style={s.unreadBadge}>
              <Text style={s.unreadBadgeTxt}>{conv.nb_unread > 9 ? '9+' : conv.nb_unread}</Text>
            </View>
          )}
        </View>

        <View style={s.info}>
          <View style={s.topRow}>
            <Text style={[s.name, hasUnread && { fontWeight: '800', color: C.text }]} numberOfLines={1}>
              {otherName}
            </Text>
            <Text style={s.time}>{fmtTime(conv.last_message_at)}</Text>
          </View>

          <View style={s.routeRow}>
            <Ionicons name="location-outline" size={11} color={C.muted} style={{ marginRight: 3 }} />
            <Text style={s.route} numberOfLines={1}>
              {conv.ville_depart} → {conv.ville_arrivee}
            </Text>
            <View style={[s.statPill, { marginLeft: 6 }]}>
              <Ionicons name={statutInfo.icon} size={10} color={statutInfo.color} />
            </View>
          </View>

          {conv.last_message ? (
            <Text style={[s.lastMsg, hasUnread && { color: C.text, fontWeight: '600' }]} numberOfLines={1}>
              {conv.last_message}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      <View style={s.header}>
        <Text style={s.headerTitle}>Messages</Text>
        {totalUnread > 0 && (
          <View style={s.unreadTotal}>
            <Text style={s.unreadTotalTxt}>{totalUnread} non lu{totalUnread > 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : convs.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color="#D1D5DB" />
          </View>
          <Text style={s.emptyTitle}>Aucune conversation</Text>
          <Text style={s.emptySub}>Les messages apparaissent dès qu'une livraison est acceptée.</Text>
        </View>
      ) : (
        <FlatList
          data={convs}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          renderItem={renderConv}
          ItemSeparatorComponent={() => null}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 18, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  unreadTotal: { backgroundColor: C.accent, borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5 },
  unreadTotalTxt: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6, textAlign: 'center' },
  emptySub:   { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },

  card: {
    flexDirection: 'row', backgroundColor: C.bg, borderRadius: 12, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 5, elevation: 1,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  cardUnread: { borderColor: C.primary, borderWidth: 1.5 },

  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: C.bgAlt,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, position: 'relative',
  },
  avatarTxt:  { fontSize: 16, fontWeight: '800', color: C.muted },
  unreadBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: C.error, borderRadius: 9,
    minWidth: 17, height: 17,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3, borderWidth: 1.5, borderColor: C.bg,
  },
  unreadBadgeTxt: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },

  info:     { flex: 1 },
  topRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  name:     { fontSize: 14, fontWeight: '700', color: C.text, flex: 1 },
  time:     { fontSize: 11, color: C.muted, marginLeft: 8 },
  routeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  route:    { fontSize: 12, color: C.muted, fontWeight: '500', flex: 1 },
  statPill: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center' },
  lastMsg:  { fontSize: 13, color: C.muted, lineHeight: 18 },
});
