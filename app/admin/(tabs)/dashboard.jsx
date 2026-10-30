import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Platform, StatusBar, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { adminDB } from '../../../src/db/database';

const C = {
  bg: '#F8FAFC', card: '#FFFFFF',
  primary: '#1A56DB', accent: '#0F4D2E',
  success: '#16A34A', error: '#DC2626', warning: '#D97706', purple: '#7C3AED',
  text: '#0F172A', muted: '#64748B', border: '#E2E8F0',
};

// ── Chart à barres léger (pas de lib externe) ─────────────────
function BarChart({ data, color, height = 90 }) {
  const maxVal = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={{ height: height + 28, flexDirection: 'row', alignItems: 'flex-end', paddingTop: 4 }}>
      {data.map((item, i) => {
        const isLast = i === data.length - 1;
        const barH   = Math.max((item.value / maxVal) * height, 2);
        return (
          <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
            {item.value > 0 && (
              <Text style={{ fontSize: 8, fontWeight: '800', color: isLast ? color : C.muted }}>
                {item.value}
              </Text>
            )}
            <View style={{
              width: '75%', height: barH,
              backgroundColor: color,
              borderRadius: 4,
              opacity: isLast ? 1 : 0.38,
            }} />
            <Text style={{ fontSize: 9, color: C.muted, fontWeight: '600' }}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }) {
  return (
    <View style={kpi.card}>
      <View style={[kpi.iconBox, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={kpi.value} numberOfLines={1}>{value}</Text>
      {sub ? <Text style={kpi.sub}>{sub}</Text> : null}
      <Text style={kpi.label} numberOfLines={2}>{label}</Text>
    </View>
  );
}
const kpi = StyleSheet.create({
  card:    { flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14, gap: 4, borderWidth: 1, borderColor: C.border, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4 },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  value:   { fontSize: 22, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  sub:     { fontSize: 11, fontWeight: '700', color: C.muted },
  label:   { fontSize: 11, color: C.muted, lineHeight: 15 },
});

// ── Stat Row ──────────────────────────────────────────────────
function StatRow({ label, value, accent }) {
  return (
    <View style={st.row}>
      <Text style={st.label}>{label}</Text>
      <Text style={[st.value, accent && { color: accent }]}>{value}</Text>
    </View>
  );
}
const st = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border },
  label: { fontSize: 14, color: C.muted, flex: 1 },
  value: { fontSize: 15, fontWeight: '800', color: C.text },
});

export default function AdminDashboard() {
  const router = useRouter();

  const [kpis,    setKpis]    = useState({ coursesJour: 0, coursesCompletes: 0, caJour: 0, nouveauxUsers: 0 });
  const [stats,   setStats]   = useState({ totalExp: 0, totalTrans: 0, total: 0, completes: 0, annulees: 0, caTotal: 0 });
  const [activite,setActivite]= useState([]);
  const [chartMode, setChartMode] = useState('courses');
  const [refreshing, setRefreshing] = useState(false);
  const [adminNom, setAdminNom] = useState('Gestionnaire');

  const loadData = useCallback(() => {
    try {
      setKpis(adminDB.kpisJour());
      setStats(adminDB.statsGlobales());
      setActivite(adminDB.activite7Jours());
    } catch (_) {}
  }, []);

  useFocusEffect(useCallback(() => {
    loadData();
    AsyncStorage.getItem('dzexpress_admin_id').then(id => {
      if (id) {
        try {
          const { usersDB } = require('../../../src/db/database');
          const u = usersDB.getById(parseInt(id));
          if (u) setAdminNom(u.nom);
        } catch (_) {}
      }
    });
  }, [loadData]));

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert('Déconnexion', 'Quitter l\'espace gestionnaire ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem('dzexpress_admin_id');
          router.replace('/admin/login');
        },
      },
    ]);
  };

  const completionRate = stats.total > 0 ? Math.round((stats.completes / stats.total) * 100) : 0;
  const completionJour = kpis.coursesJour > 0 ? Math.round((kpis.coursesCompletes / kpis.coursesJour) * 100) : 0;

  const chartData = activite.map(a => ({
    label: a.label,
    value: chartMode === 'courses' ? a.courses : Math.round(a.ca / 1000),
  }));

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <View style={s.headerBadge}>
            <Ionicons name="shield-checkmark" size={11} color={C.primary} />
            <Text style={s.headerBadgeTxt}>Gestionnaire</Text>
          </View>
          <Text style={s.headerTitle}>RouteX Admin</Text>
          <Text style={s.headerSub}>Bonjour, {adminNom.split(' ')[0]}</Text>
        </View>
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={C.muted} />
        </TouchableOpacity>
      </View>

      {/* ── Section 1 : KPIs du jour ── */}
      <Text style={s.sectionTitle}>Aujourd'hui</Text>
      <View style={s.kpiGrid}>
        <KpiCard
          icon="car-sport"
          label="Courses du jour"
          value={kpis.coursesJour}
          color={C.primary}
        />
        <KpiCard
          icon="checkmark-circle"
          label="Complétées"
          value={kpis.coursesCompletes}
          sub={kpis.coursesJour > 0 ? `${completionJour}%` : undefined}
          color={C.success}
        />
      </View>
      <View style={[s.kpiGrid, { marginTop: 10 }]}>
        <KpiCard
          icon="cash"
          label="Chiffre d'affaires"
          value={kpis.caJour > 0 ? `${Math.round(kpis.caJour).toLocaleString()} DA` : '0 DA'}
          color={C.accent}
        />
        <KpiCard
          icon="person-add"
          label="Nouveaux utilisateurs"
          value={kpis.nouveauxUsers}
          color={C.purple}
        />
      </View>

      {/* ── Section 2 : Activité 7 jours ── */}
      <View style={s.card}>
        <View style={s.cardHeader}>
          <Text style={s.cardTitle}>Activité — 7 derniers jours</Text>
          <View style={s.toggleRow}>
            <TouchableOpacity
              style={[s.toggleChip, chartMode === 'courses' && s.toggleChipActive]}
              onPress={() => setChartMode('courses')}
            >
              <Text style={[s.toggleChipTxt, chartMode === 'courses' && s.toggleChipTxtActive]}>
                Courses
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleChip, chartMode === 'ca' && s.toggleChipActive]}
              onPress={() => setChartMode('ca')}
            >
              <Text style={[s.toggleChipTxt, chartMode === 'ca' && s.toggleChipTxtActive]}>
                CA (k DA)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {chartData.length > 0 ? (
          <BarChart
            data={chartData}
            color={chartMode === 'courses' ? C.primary : C.accent}
            height={90}
          />
        ) : (
          <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: C.muted, fontSize: 13 }}>Aucune donnée</Text>
          </View>
        )}
      </View>

      {/* ── Section 3 : Stats globales ── */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Statistiques globales</Text>

        <View style={s.usersRow}>
          <View style={s.userStat}>
            <Ionicons name="cube-outline" size={18} color={C.accent} />
            <Text style={s.userStatNum}>{stats.totalExp}</Text>
            <Text style={s.userStatLbl}>Expéditeurs</Text>
          </View>
          <View style={s.userDivider} />
          <View style={s.userStat}>
            <Ionicons name="car-sport-outline" size={18} color={C.primary} />
            <Text style={s.userStatNum}>{stats.totalTrans}</Text>
            <Text style={s.userStatLbl}>Chauffeurs</Text>
          </View>
          <View style={s.userDivider} />
          <View style={s.userStat}>
            <Ionicons name="people-outline" size={18} color={C.purple} />
            <Text style={s.userStatNum}>{stats.totalExp + stats.totalTrans}</Text>
            <Text style={s.userStatLbl}>Total</Text>
          </View>
        </View>

        <StatRow label="Total courses" value={stats.total} />
        <StatRow label="Courses complétées" value={stats.completes} accent={C.success} />
        <StatRow label="Courses annulées"   value={stats.annulees}  accent={C.error} />
        <StatRow label="Taux de complétion" value={`${completionRate} %`} accent={completionRate >= 70 ? C.success : C.warning} />
        <StatRow label="CA total (plateforme)" value={`${Math.round(stats.caTotal).toLocaleString()} DA`} accent={C.accent} />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: C.bg },
  content: {
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingHorizontal: 16, paddingBottom: 32, gap: 14,
  },

  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  headerBadge:  { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EBF5FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 50, alignSelf: 'flex-start', marginBottom: 6 },
  headerBadgeTxt: { fontSize: 11, fontWeight: '700', color: C.primary },
  headerTitle:  { fontSize: 24, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  headerSub:    { fontSize: 13, color: C.muted, marginTop: 2 },
  logoutBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },

  sectionTitle: { fontSize: 13, fontWeight: '800', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: -4 },

  kpiGrid: { flexDirection: 'row', gap: 10 },

  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardTitle:  { fontSize: 15, fontWeight: '800', color: C.text, marginBottom: 12 },

  toggleRow:        { flexDirection: 'row', gap: 6 },
  toggleChip:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50, borderWidth: 1.5, borderColor: C.border },
  toggleChipActive: { borderColor: C.primary, backgroundColor: '#EBF5FF' },
  toggleChipTxt:    { fontSize: 11, fontWeight: '700', color: C.muted },
  toggleChipTxtActive: { color: C.primary },

  usersRow:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  userStat:     { flex: 1, alignItems: 'center', gap: 3 },
  userStatNum:  { fontSize: 22, fontWeight: '900', color: C.text },
  userStatLbl:  { fontSize: 11, color: C.muted, fontWeight: '600' },
  userDivider:  { width: 1, height: 36, backgroundColor: C.border },
});
