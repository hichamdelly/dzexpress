import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Platform, StatusBar, RefreshControl, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { adminDB } from '../../../src/db/database';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF', primary: '#1A56DB',
  accent: '#F97316', success: '#16A34A', error: '#DC2626', warning: '#D97706',
  text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
};

const STATUTS = [
  { key: null,         label: 'Toutes' },
  { key: 'en_attente', label: 'En attente' },
  { key: 'acceptee',   label: 'Acceptée' },
  { key: 'en_cours',   label: 'En cours' },
  { key: 'livree',     label: 'Livrée' },
  { key: 'annulee',    label: 'Annulée' },
];

const STATUT_COLORS = {
  en_attente: C.warning,
  acceptee:   C.primary,
  en_cours:   C.accent,
  livree:     C.success,
  annulee:    C.error,
};

const STATUT_LABELS = {
  en_attente: 'En attente',
  acceptee:   'Acceptée',
  en_cours:   'En cours',
  livree:     'Livrée',
  annulee:    'Annulée',
};

function StatutBadge({ statut }) {
  const color = STATUT_COLORS[statut] ?? C.muted;
  return (
    <View style={[b.badge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
      <View style={[b.dot, { backgroundColor: color }]} />
      <Text style={[b.badgeTxt, { color }]}>{STATUT_LABELS[statut] ?? statut}</Text>
    </View>
  );
}
const b = StyleSheet.create({
  badge:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 50, borderWidth: 1 },
  dot:      { width: 6, height: 6, borderRadius: 3 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
});

function CourseCard({ d }) {
  const fmtDate = d.created_at ? d.created_at.slice(0, 16).replace('T', ' ') : '';
  return (
    <View style={s.card}>
      <View style={s.cardTop}>
        <View style={s.routeBlock}>
          <Text style={s.routeCity} numberOfLines={1}>{d.ville_depart}</Text>
          <Ionicons name="arrow-forward" size={12} color={C.muted} />
          <Text style={s.routeCity} numberOfLines={1}>{d.ville_arrivee}</Text>
        </View>
        <StatutBadge statut={d.statut} />
      </View>
      <View style={s.cardMeta}>
        <View style={s.metaItem}>
          <Ionicons name="cube-outline" size={12} color={C.muted} />
          <Text style={s.metaTxt}>{d.expediteur_nom ?? '—'}</Text>
        </View>
        {d.transporteur_nom ? (
          <View style={s.metaItem}>
            <Ionicons name="car-sport-outline" size={12} color={C.muted} />
            <Text style={s.metaTxt}>{d.transporteur_nom}</Text>
          </View>
        ) : null}
        {d.prix_estime ? (
          <View style={s.metaItem}>
            <Ionicons name="cash-outline" size={12} color={C.muted} />
            <Text style={s.metaTxt}>{Math.round(d.prix_estime).toLocaleString()} DA</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.cardDate}>{fmtDate}</Text>
    </View>
  );
}

export default function AdminCourses() {
  const [courses,    setCourses]    = useState([]);
  const [filtre,     setFiltre]     = useState(null);
  const [search,     setSearch]     = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadCourses = useCallback(() => {
    try { setCourses(adminDB.getDemandesActives()); } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => { loadCourses(); }, [loadCourses]));

  const onRefresh = () => { setRefreshing(true); loadCourses(); setRefreshing(false); };

  const filtered = courses.filter(d => {
    if (filtre && d.statut !== filtre) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        d.ville_depart?.toLowerCase().includes(q) ||
        d.ville_arrivee?.toLowerCase().includes(q) ||
        d.expediteur_nom?.toLowerCase().includes(q) ||
        d.transporteur_nom?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {};
  courses.forEach(d => { counts[d.statut] = (counts[d.statut] ?? 0) + 1; });

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <Text style={s.headerTitle}>Courses</Text>
        <View style={s.countBadge}>
          <Text style={s.countTxt}>{courses.length}</Text>
        </View>
      </View>

      {/* Recherche */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={C.muted} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Recherche ville, expéditeur…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={C.muted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres statut */}
      <FlatList
        horizontal
        data={STATUTS}
        keyExtractor={i => i.key ?? 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
        renderItem={({ item }) => {
          const active = filtre === item.key;
          const cnt = item.key ? (counts[item.key] ?? 0) : courses.length;
          return (
            <TouchableOpacity
              style={[s.filterChip, active && s.filterChipActive]}
              onPress={() => setFiltre(item.key)}
            >
              <Text style={[s.filterChipTxt, active && s.filterChipTxtActive]}>
                {item.label}
              </Text>
              {cnt > 0 && (
                <View style={[s.filterCnt, active && s.filterCntActive]}>
                  <Text style={[s.filterCntTxt, active && { color: C.primary }]}>{cnt}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Liste */}
      <FlatList
        data={filtered}
        keyExtractor={d => String(d.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
        renderItem={({ item }) => <CourseCard d={item} />}
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <Ionicons name="car-sport-outline" size={40} color="#D1D5DB" />
            <Text style={s.emptyTxt}>Aucune course trouvée</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingHorizontal: 16, paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: C.text },
  countBadge:  { backgroundColor: C.primary + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 50 },
  countTxt:    { fontSize: 12, fontWeight: '800', color: C.primary },

  searchRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 10, borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 16 },
  searchInput: { flex: 1, fontSize: 14, color: C.text },

  filterChip:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 50, backgroundColor: C.card, borderWidth: 1.5, borderColor: C.border },
  filterChipActive: { borderColor: C.primary, backgroundColor: '#EBF5FF' },
  filterChipTxt:    { fontSize: 12, fontWeight: '700', color: C.muted },
  filterChipTxtActive: { color: C.primary },
  filterCnt:        { backgroundColor: '#F1F5F9', width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  filterCntActive:  { backgroundColor: C.primary + '18' },
  filterCntTxt:     { fontSize: 9, fontWeight: '800', color: C.muted },

  card:      { backgroundColor: C.card, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  cardTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  routeBlock:{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 8 },
  routeCity: { fontSize: 14, fontWeight: '800', color: C.text, maxWidth: '42%' },
  cardMeta:  { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
  metaItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt:   { fontSize: 12, color: C.muted, fontWeight: '600' },
  cardDate:  { fontSize: 11, color: C.muted },

  empty:     { alignItems: 'center', paddingTop: 60, gap: 10 },
  emptyTxt:  { fontSize: 15, color: C.muted, fontWeight: '600' },
});
