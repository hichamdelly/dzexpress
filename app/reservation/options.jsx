import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Platform, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useReservation, ProgressBar } from '../../src/context/ReservationContext';
import { calculerPrix, calculerSurge, fmtPrix, TARIFS_BASE } from '../../src/utils/pricing';
import { getDistanceKmPrecise as getDistanceKm } from '../../src/utils/distance';
import { demandesDB } from '../../src/db/database';

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
};

function OptionToggle({ icon, title, sub, value, onToggle, last }) {
  return (
    <TouchableOpacity
      style={[opt.row, last && { borderBottomWidth: 0 }]}
      onPress={onToggle}
      activeOpacity={0.8}
    >
      <View style={opt.iconBox}>
        <Ionicons name={icon} size={18} color={C.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={opt.title}>{title}</Text>
        <Text style={opt.sub}>{sub}</Text>
      </View>
      <View style={[opt.toggle, value && { backgroundColor: C.success }]}>
        <View style={[opt.thumb, value && { alignSelf: 'flex-end' }]} />
      </View>
    </TouchableOpacity>
  );
}

export default function Options() {
  const router = useRouter();
  const ctx = useReservation();

  const [etages,  setEtages]  = useState(ctx.options?.etages  || 0);
  const [aide,    setAide]    = useState(ctx.options?.aide    || false);
  const [fragile, setFragile] = useState(ctx.options?.fragile || false);
  const [express, setExpress] = useState(ctx.options?.express || false);

  const km    = getDistanceKm(ctx.departure, ctx.arrival);
  const nbAct = demandesDB.countActives();
  const surge = calculerSurge(nbAct);
  const estim = km && ctx.vehicule
    ? calculerPrix(km, ctx.vehicule, { etages, aide, fragile, express, nbActives: nbAct })
    : null;

  const handleNext = () => {
    ctx.setOption('etages',  etages);
    ctx.setOption('aide',    aide);
    ctx.setOption('fragile', fragile);
    ctx.setOption('express', express);
    router.push('/reservation/recapitulatif');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Nouvelle demande</Text>
        <View style={{ width: 36 }} />
      </View>
      <ProgressBar step={5} total={6} />

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.stepLabel}>Étape 5 / 6</Text>
        <Text style={s.title}>Options</Text>
        <Text style={s.sub}>Ajoute des options spéciales si nécessaire.</Text>

        <View style={opt.section}>
          <View style={opt.row}>
            <View style={opt.iconBox}>
              <Ionicons name="business-outline" size={18} color={C.muted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={opt.title}>Étages sans ascenseur</Text>
              <Text style={opt.sub}>+200 DA par étage (max 5)</Text>
            </View>
            <View style={opt.counter}>
              <TouchableOpacity style={opt.counterBtn} onPress={() => setEtages(Math.max(0, etages - 1))}>
                <Text style={opt.counterBtnTxt}>−</Text>
              </TouchableOpacity>
              <Text style={opt.counterVal}>{etages}</Text>
              <TouchableOpacity style={opt.counterBtn} onPress={() => setEtages(Math.min(5, etages + 1))}>
                <Text style={opt.counterBtnTxt}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <OptionToggle
            icon="people-outline"
            title="Aide au chargement/déchargement"
            sub="+500 DA"
            value={aide} onToggle={() => setAide(v => !v)}
          />
          <OptionToggle
            icon="warning-outline"
            title="Marchandise fragile"
            sub="+20% sur le total"
            value={fragile} onToggle={() => setFragile(v => !v)}
          />
          <OptionToggle
            icon="flash-outline"
            title="Livraison express (<2h)"
            sub="+40% sur le total"
            value={express} onToggle={() => setExpress(v => !v)}
            last
          />
        </View>

        {estim && (
          <View style={s.estimBox}>
            <View style={s.estimHeader}>
              <Ionicons name="wallet-outline" size={14} color={C.success} style={{ marginRight: 6 }} />
              <Text style={s.estimTitle}>{TARIFS_BASE[ctx.vehicule]?.label}</Text>
              {surge.hasAny && (
                <View style={s.surgeBadge}>
                  <Ionicons name="flame" size={10} color={C.error} style={{ marginRight: 3 }} />
                  <Text style={s.surgeTxt}>+{surge.pct}%</Text>
                </View>
              )}
            </View>
            <Text style={s.estimRange}>{fmtPrix(estim.min)} – {fmtPrix(estim.max)}</Text>
            <Text style={s.estimDetail}>{km} km · {estim.detail.tarifKm} DA/km</Text>
          </View>
        )}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={s.nextBtn} onPress={handleNext} activeOpacity={0.88}>
          <Text style={s.nextBtnTxt}>Récapitulatif</Text>
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center',
  },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#FFFFFF', flex: 1, textAlign: 'center' },

  content:   { padding: 20, paddingBottom: 40 },
  stepLabel: { fontSize: 12, fontWeight: '700', color: C.muted, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 },
  title:     { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 8, letterSpacing: -0.5 },
  sub:       { fontSize: 14, color: C.muted, marginBottom: 24, lineHeight: 20 },

  estimBox:    { backgroundColor: C.successLight, borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#6EE7B7', marginTop: 20 },
  estimHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  estimTitle:  { fontSize: 13, fontWeight: '700', color: C.success, flex: 1 },
  surgeBadge:  { flexDirection: 'row', alignItems: 'center', backgroundColor: C.errorLight, borderRadius: 50, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FCA5A5' },
  surgeTxt:    { fontSize: 11, fontWeight: '800', color: C.error },
  estimRange:  { fontSize: 22, fontWeight: '900', color: C.text, marginBottom: 4 },
  estimDetail: { fontSize: 12, color: C.muted },

  footer:    { padding: 16, paddingBottom: Platform.OS === 'ios' ? 34 : 16, borderTopWidth: 1, borderTopColor: C.border, backgroundColor: C.bg },
  nextBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.primary, borderRadius: 50, paddingVertical: 17 },
  nextBtnTxt:{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});

const opt = StyleSheet.create({
  section:       { backgroundColor: C.bgAlt, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, overflow: 'hidden' },
  row:           { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.border, gap: 12 },
  iconBox:       { width: 36, height: 36, borderRadius: 10, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  title:         { fontSize: 14, fontWeight: '700', color: C.text },
  sub:           { fontSize: 12, color: C.muted, marginTop: 2 },
  counter:       { flexDirection: 'row', alignItems: 'center', gap: 10 },
  counterBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  counterBtnTxt: { fontSize: 20, fontWeight: '900', color: C.text, lineHeight: 24 },
  counterVal:    { fontSize: 18, fontWeight: '900', color: C.text, minWidth: 24, textAlign: 'center' },
  toggle:        { width: 46, height: 26, borderRadius: 13, backgroundColor: '#D1D5DB', justifyContent: 'center', padding: 3 },
  thumb:         { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF', elevation: 2 },
});
