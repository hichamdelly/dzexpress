import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Platform, StatusBar,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/context/AppContext';
import { notifDB } from '../../src/db/database';
import { notifMeta } from '../../src/lib/notifications';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', text: '#0A0A0A',
  muted: '#6B7280', border: '#E2E8F0', unreadDot: '#EF4444',
};

function relTime(isoStr) {
  if (!isoStr) return '';
  const d    = new Date(isoStr.replace(' ', 'T'));
  const now  = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)  return 'À l\'instant';
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

function dayLabel(isoStr) {
  if (!isoStr) return 'Anciens';
  const d   = new Date(isoStr.replace(' ', 'T'));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (itemDay.getTime() === today.getTime()) return "Aujourd'hui";
  if (itemDay.getTime() === yesterday.getTime()) return 'Hier';
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function groupByDay(list) {
  const groups = [];
  let currentDay = null;
  for (const n of list) {
    const label = dayLabel(n.created_at);
    if (label !== currentDay) {
      currentDay = label;
      groups.push({ type: 'header', label, key: `h-${n.id}` });
    }
    groups.push({ type: 'notif', ...n, key: `n-${n.id}` });
  }
  return groups;
}

function NotifItem({ item, onPress }) {
  const meta = notifMeta(item.type);
  return (
    <TouchableOpacity
      style={[s.item, item.lu === 0 && s.itemUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={[s.iconBox, { backgroundColor: meta.color + '22' }]}>
        <Ionicons name={meta.icon} size={20} color={meta.color} />
      </View>
      <View style={s.body}>
        <View style={s.topRow}>
          <Text style={[s.label, item.lu === 0 && { color: '#0A0A0A' }]}>{meta.label}</Text>
          <Text style={s.time}>{relTime(item.created_at)}</Text>
        </View>
        <Text style={[s.msg, item.lu === 0 && { color: '#374151' }]} numberOfLines={2}>
          {item.message}
        </Text>
      </View>
      {item.lu === 0 && <View style={s.dot} />}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { user }   = useApp();
  const router     = useRouter();
  const [rows, setRows] = useState([]);

  const load = useCallback(() => {
    if (!user) return;
    const list = notifDB.getByUser(user.id);
    setRows(groupByDay(list));
  }, [user?.id]);

  useFocusEffect(useCallback(() => {
    load();
    if (user) notifDB.markAllRead(user.id);
  }, [load, user?.id]));

  const handlePress = (notif) => {
    if (notif.lu === 0) notifDB.markRead(notif.id);
    try {
      const data = notif.data_json ? JSON.parse(notif.data_json) : {};
      if (data.route) router.push(data.route);
    } catch {}
    load();
  };

  const markAll = () => {
    if (user) { notifDB.markAllRead(user.id); load(); }
  };

  const hasUnread = rows.some(r => r.type === 'notif' && r.lu === 0);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Notifications</Text>
        {hasUnread && (
          <TouchableOpacity onPress={markAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={s.markAllBtn}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      {rows.length === 0 ? (
        <View style={s.empty}>
          <View style={s.emptyIcon}>
            <Ionicons name="notifications-outline" size={32} color={C.muted} />
          </View>
          <Text style={s.emptyTitle}>Aucune notification</Text>
          <Text style={s.emptySub}>Vous serez alerté ici de toute activité sur vos demandes.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={item => item.key}
          contentContainerStyle={{ paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={s.dayLabel}>{item.label}</Text>;
            }
            return <NotifItem item={item} onPress={handlePress} />;
          }}
        />
      )}
    </View>
  );
}

const PT = Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 14;

const s = StyleSheet.create({
  screen:      { flex: 1, backgroundColor: C.bg },
  header:      {
    paddingTop: PT, paddingBottom: 14, paddingHorizontal: 20,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: C.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: C.text, letterSpacing: -0.3 },
  markAllBtn:  { fontSize: 13, fontWeight: '700', color: '#1A56DB' },

  dayLabel: {
    fontSize: 12, fontWeight: '700', color: C.muted,
    textTransform: 'uppercase', letterSpacing: 0.6,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },

  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: C.card, paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  itemUnread: { backgroundColor: '#F0F4FF' },
  iconBox: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, flexShrink: 0,
  },
  body:    { flex: 1 },
  topRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 3 },
  label:   { flex: 1, fontSize: 13, fontWeight: '700', color: C.muted },
  time:    { fontSize: 12, color: C.muted },
  msg:     { fontSize: 13, color: C.muted, lineHeight: 19 },
  dot:     {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: C.unreadDot,
    alignSelf: 'center', marginLeft: 8, flexShrink: 0,
  },

  empty:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6 },
  emptySub:   { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 21 },
});
