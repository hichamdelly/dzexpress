import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, StatusBar, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp, parseDemandeTime, msToCountdown } from '../../src/context/AppContext';
import { demandesDB, agendaDB } from '../../src/db/database';
import { useReservation } from '../../src/context/ReservationContext';

const CRENEAUX_LIST = [
  { key: 'matin',      label: 'Matin',      sub: '06h–12h',  icon: 'sunny-outline' },
  { key: 'apres-midi', label: 'Après-midi', sub: '12h–18h',  icon: 'partly-sunny-outline' },
  { key: 'soir',       label: 'Soir',       sub: '18h–22h',  icon: 'moon-outline' },
];

function fmtDateYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtDateLabel(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
  warning: '#F59E0B', warningLight: '#FFFBEB',
};

const STATUTS = {
  en_attente: { label: 'En attente',  color: C.warning,  bg: C.warningLight,  icon: 'time-outline' },
  acceptee:   { label: 'Acceptée',    color: '#1A56DB',  bg: '#EBF5FF',       icon: 'checkmark-circle-outline' },
  en_cours:   { label: 'En cours',    color: C.accent,   bg: C.accentLight,   icon: 'car-sport-outline' },
  livree:     { label: 'Livrée',      color: C.success,  bg: C.successLight,  icon: 'cube-outline' },
  annulee:    { label: 'Annulée',     color: C.error,    bg: C.errorLight,    icon: 'close-circle-outline' },
};

const TYPES_ICON = {
  meubles: 'grid-outline', electromenager: 'tv-outline', cartons: 'cube-outline',
  materiaux: 'construct-outline', vehicule: 'car-outline', autre: 'ellipsis-horizontal-outline',
};

function StatusPill({ statut }) {
  const st = STATUTS[statut] || STATUTS.en_attente;
  return (
    <View style={[pill.root, { backgroundColor: st.bg }]}>
      <Ionicons name={st.icon} size={11} color={st.color} style={{ marginRight: 4 }} />
      <Text style={[pill.txt, { color: st.color }]}>{st.label}</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50 },
  txt:  { fontSize: 11, fontWeight: '700' },
});

// ── MES DEMANDES (Expéditeur) ────────────────────────────────
function MesDemandes({ user }) {
  const router = useRouter();
  const { setField, reset, setOption } = useReservation();
  const [demandes, setDemandes]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtre, setFiltre]         = useState('all');

  const fetch = useCallback(() => {
    try { setDemandes(demandesDB.getByExpediteur(user.id)); }
    catch (e) { console.log(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user.id]);

  useFocusEffect(useCallback(() => { setLoading(true); fetch(); }, [fetch]));

  const annuler = (id) =>
    Alert.alert('Annuler la demande ?', 'Elle ne sera plus visible par les transporteurs.', [
      { text: 'Non', style: 'cancel' },
      { text: 'Oui', style: 'destructive', onPress: () => { demandesDB.updateStatut(id, 'annulee'); fetch(); } },
    ]);

  const refaire = (d) => {
    reset();
    setField('departure', d.ville_depart);
    setField('arrival',   d.ville_arrivee);
    setField('categories', (d.type_marchandise || '').split(',').filter(Boolean));
    setField('mode',      d.type_demande || 'planifie');
    if (d.poids)       setField('quantite',    d.poids);
    if (d.description) setField('description', d.description);
    if (d.options_supplementaires) {
      try {
        const o = JSON.parse(d.options_supplementaires);
        if (o.etages)  setOption('etages',  o.etages);
        if (o.aide)    setOption('aide',    o.aide);
        if (o.fragile) setOption('fragile', o.fragile);
        if (o.express) setOption('express', o.express);
      } catch {}
    }
    router.push('/reservation/depart-arrivee');
  };

  const FILTRES = [
    { key: 'all',        label: 'Toutes' },
    { key: 'en_attente', label: 'En attente' },
    { key: 'acceptee',   label: 'Acceptées' },
    { key: 'en_cours',   label: 'En cours' },
    { key: 'livree',     label: 'Livrées' },
    { key: 'annulee',    label: 'Annulées' },
  ];

  const filtered = filtre === 'all' ? demandes : demandes.filter(d => d.statut === filtre);

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Mes demandes</Text>
        <View style={s.headerBadge}>
          <Text style={s.headerBadgeTxt}>{demandes.length}</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
        {FILTRES.map(f => (
          <TouchableOpacity key={f.key}
            style={[s.filterChip, filtre === f.key && s.filterChipOn]}
            onPress={() => setFiltre(f.key)}>
            <Text style={[s.filterChipTxt, filtre === f.key && s.filterChipTxtOn]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <View style={s.emptyIcon}><Ionicons name="cube-outline" size={32} color="#D1D5DB" /></View>
          <Text style={s.emptyTitle}>{filtre === 'all' ? 'Aucune demande' : 'Aucune dans cette catégorie'}</Text>
          <Text style={s.emptyDesc}>{filtre === 'all' ? 'Publie ta première demande depuis l\'onglet Accueil' : 'Essaie un autre filtre'}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={C.primary} />}
        >
          {filtered.map(d => (
            <TouchableOpacity key={d.id} style={s.card}
              onPress={() => router.push(`/demande/${d.id}`)} activeOpacity={0.92}>

              <View style={s.cardTop}>
                <View style={[s.cardIcon, { backgroundColor: C.accentLight }]}>
                  <Ionicons name={TYPES_ICON[d.type_marchandise] || 'cube-outline'} size={22} color={C.accent} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={s.cardRoute}>{d.ville_depart}  →  {d.ville_arrivee}</Text>
                  <Text style={s.cardMeta}>{d.type_marchandise}{d.poids ? ` · ${d.poids}` : ''}</Text>
                </View>
                <StatusPill statut={d.statut} />
              </View>

              <View style={s.cardInfo}>
                <View style={s.infoChip}>
                  <Ionicons name="calendar-outline" size={12} color={C.muted} style={{ marginRight: 4 }} />
                  <Text style={s.infoChipTxt}>{d.date_souhaitee}</Text>
                </View>
                {d.transporteur_nom && (
                  <View style={s.infoChip}>
                    <Ionicons name="car-sport-outline" size={12} color={C.muted} style={{ marginRight: 4 }} />
                    <Text style={s.infoChipTxt}>{d.transporteur_nom}</Text>
                  </View>
                )}
              </View>

              {d.statut === 'acceptee' && d.transporteur_nom && (
                <View style={s.acceptedBar}>
                  <Ionicons name="checkmark-circle" size={14} color={C.success} style={{ marginRight: 6 }} />
                  <Text style={s.acceptedBarTxt}>Accepté par {d.transporteur_nom}</Text>
                </View>
              )}

              {d.statut === 'en_route' && (
                <TouchableOpacity
                  style={s.suiviLiveBar}
                  onPress={(e) => { e.stopPropagation?.(); router.push(`/suivi-live/${d.id}`); }}
                  activeOpacity={0.85}
                >
                  <Ionicons name="location" size={14} color={C.accent} style={{ marginRight: 6 }} />
                  <Text style={s.suiviLiveBarTxt}>📍 Suivre ma livraison</Text>
                  <Ionicons name="chevron-forward" size={13} color={C.accent} />
                </TouchableOpacity>
              )}

              <View style={s.cardFooter}>
                <Text style={s.cardDate}>{d.created_at?.slice(0, 10)}</Text>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                  {d.statut === 'en_attente' && (
                    <TouchableOpacity onPress={() => annuler(d.id)}>
                      <Text style={s.cancelTxt}>Annuler</Text>
                    </TouchableOpacity>
                  )}
                  {d.statut === 'annulee' && (
                    <TouchableOpacity
                      style={s.refaireBtn}
                      onPress={(e) => { e.stopPropagation?.(); refaire(d); }}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="refresh-outline" size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
                      <Text style={s.refaireBtnTxt}>Refaire</Text>
                    </TouchableOpacity>
                  )}
                  <View style={s.seeBtn}>
                    <Text style={s.seeBtnTxt}>Voir</Text>
                    <Ionicons name="chevron-forward" size={13} color={C.primary} />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── MES COURSES (Transporteur) ───────────────────────────────
function MesCourses({ user }) {
  const router = useRouter();
  const [courses, setCourses]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filtre, setFiltre]         = useState('all');
  const [vue, setVue]               = useState('courses'); // 'courses' | 'agenda'

  // Agenda state
  const [agendaJour, setAgendaJour]         = useState(new Date());
  const [bloques, setBloques]               = useState([]);
  const [agendaCourses, setAgendaCourses]   = useState([]);

  const fetch = useCallback(() => {
    try {
      setCourses(demandesDB.getByTransporteur(user.id));
      setAgendaCourses(demandesDB.getForAgenda(user.id));
      setBloques(agendaDB.getByTransporteur(user.id));
    } catch (e) { console.log(e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user.id]);

  useFocusEffect(useCallback(() => { setLoading(true); fetch(); }, [fetch]));

  const toggleBloquer = (dateYMD, creneau) => {
    const estBloquer = bloques.some(b => b.date === dateYMD && b.creneau === creneau);
    if (estBloquer) {
      agendaDB.debloquer(user.id, dateYMD, creneau);
    } else {
      // Vérifie si une course est déjà sur ce créneau
      const dateLabel = dateYMD.split('-').reverse().join('/');
      const aDesCourses = agendaCourses.some(c => c.date_souhaitee === dateLabel && c.creneau === creneau);
      if (aDesCourses) { Alert.alert('Créneau occupé', 'Vous avez déjà une course confirmée sur ce créneau.'); return; }
      agendaDB.bloquer(user.id, dateYMD, creneau);
    }
    setBloques(agendaDB.getByTransporteur(user.id));
  };

  // Semaine de 7 jours à partir d'aujourd'hui
  const semaine = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d;
  });

  const FILTRES = [
    { key: 'all',      label: 'Toutes' },
    { key: 'acceptee', label: 'Acceptées' },
    { key: 'en_cours', label: 'En cours' },
    { key: 'livree',   label: 'Livrées' },
  ];

  const filtered = filtre === 'all' ? courses : courses.filter(c => c.statut === filtre);
  const actif    = courses.filter(c => ['acceptee', 'en_cours'].includes(c.statut)).length;

  const jourYMD   = fmtDateYMD(agendaJour);
  const jourLabel = agendaJour.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  // Courses du jour sélectionné (date_souhaitee au format DD/MM/YYYY)
  const jourDDMMYYYY = jourYMD.split('-').reverse().join('/');
  const coursesJour  = agendaCourses.filter(c => c.date_souhaitee === jourDDMMYYYY);

  const countdown = (c) => {
    const ms = parseDemandeTime(c.date_souhaitee, c.creneau);
    return ms ? msToCountdown(ms - Date.now()) : null;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      <View style={[s.header, { backgroundColor: C.primary }]}>
        <Text style={[s.headerTitle, { color: '#FFFFFF' }]}>Mes courses</Text>
        <View style={[s.headerBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Text style={[s.headerBadgeTxt, { color: '#FFFFFF' }]}>{actif} active{actif !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Toggle Courses / Agenda */}
      <View style={ag.toggle}>
        <TouchableOpacity style={[ag.toggleBtn, vue === 'courses' && ag.toggleBtnOn]} onPress={() => setVue('courses')}>
          <Ionicons name="car-sport-outline" size={14} color={vue === 'courses' ? '#FFFFFF' : C.muted} style={{ marginRight: 5 }} />
          <Text style={[ag.toggleTxt, vue === 'courses' && { color: '#FFFFFF' }]}>Courses</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ag.toggleBtn, vue === 'agenda' && ag.toggleBtnOn]} onPress={() => setVue('agenda')}>
          <Ionicons name="calendar-outline" size={14} color={vue === 'agenda' ? '#FFFFFF' : C.muted} style={{ marginRight: 5 }} />
          <Text style={[ag.toggleTxt, vue === 'agenda' && { color: '#FFFFFF' }]}>Agenda</Text>
        </TouchableOpacity>
      </View>

      {vue === 'agenda' ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={C.primary} />}
        >
          {/* Sélecteur de jour */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 8 }}>
            {semaine.map((d, i) => {
              const ymd = fmtDateYMD(d);
              const isSelected = ymd === jourYMD;
              const hasCourse = agendaCourses.some(c => c.date_souhaitee === ymd.split('-').reverse().join('/'));
              return (
                <TouchableOpacity key={i} style={[ag.dayBtn, isSelected && ag.dayBtnOn]} onPress={() => setAgendaJour(d)}>
                  <Text style={[ag.dayName, isSelected && { color: '#FFFFFF' }]}>
                    {d.toLocaleDateString('fr-FR', { weekday: 'short' })}
                  </Text>
                  <Text style={[ag.dayNum, isSelected && { color: '#FFFFFF' }]}>{d.getDate()}</Text>
                  {hasCourse && <View style={[ag.dayDot, isSelected && { backgroundColor: '#FFFFFF' }]} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={ag.jourTitle}>{jourLabel}</Text>

          {/* Créneaux du jour */}
          {CRENEAUX_LIST.map(cr => {
            const estBloquer = bloques.some(b => b.date === jourYMD && b.creneau === cr.key);
            const coursesCreneaux = coursesJour.filter(c => c.creneau === cr.key);
            const cd = coursesCreneaux.length > 0 ? countdown(coursesCreneaux[0]) : null;
            return (
              <View key={cr.key} style={ag.creneauRow}>
                <View style={ag.creneauLeft}>
                  <Ionicons name={cr.icon} size={18} color={estBloquer ? C.error : C.muted} />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={ag.creneauLabel}>{cr.label}</Text>
                    <Text style={ag.creneauSub}>{cr.sub}</Text>
                  </View>
                </View>
                <View style={ag.creneauRight}>
                  {coursesCreneaux.length > 0 ? (
                    <TouchableOpacity onPress={() => router.push(`/course/${coursesCreneaux[0].id}`)} activeOpacity={0.85}>
                      <View style={ag.courseBadge}>
                        <Text style={ag.courseBadgeTxt} numberOfLines={1}>
                          {coursesCreneaux[0].ville_depart} → {coursesCreneaux[0].ville_arrivee}
                        </Text>
                        {cd && <Text style={ag.courseCd}>{cd}</Text>}
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[ag.bloquerBtn, estBloquer && ag.debloquerBtn]}
                      onPress={() => toggleBloquer(jourYMD, cr.key)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={estBloquer ? 'lock-closed' : 'lock-open-outline'}
                        size={13}
                        color={estBloquer ? C.error : C.muted}
                        style={{ marginRight: 4 }}
                      />
                      <Text style={[ag.bloquerTxt, estBloquer && { color: C.error }]}>
                        {estBloquer ? 'Bloqué' : 'Bloquer'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {coursesJour.length === 0 && bloques.filter(b => b.date === jourYMD).length === 0 && (
            <View style={s.center}>
              <Text style={[s.emptyDesc, { marginTop: 8 }]}>Aucune course ce jour — tu peux bloquer des créneaux</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterBar}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
            {FILTRES.map(f => (
              <TouchableOpacity key={f.key}
                style={[s.filterChip, filtre === f.key && [s.filterChipOn, { backgroundColor: C.primary, borderColor: C.primary }]]}
                onPress={() => setFiltre(f.key)}>
                <Text style={[s.filterChipTxt, filtre === f.key && s.filterChipTxtOn]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {loading ? (
            <View style={s.center}><ActivityIndicator size="large" color={C.primary} /></View>
          ) : filtered.length === 0 ? (
            <View style={s.center}>
              <View style={s.emptyIcon}><Ionicons name="car-sport-outline" size={32} color="#D1D5DB" /></View>
              <Text style={s.emptyTitle}>Aucune course ici</Text>
              <Text style={s.emptyDesc}>Va dans «Disponibles» pour accepter des demandes</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={C.primary} />}
            >
              {filtered.map(c => {
                const cd = countdown(c);
                return (
                  <TouchableOpacity key={c.id} style={s.card}
                    onPress={() => router.push(`/course/${c.id}`)} activeOpacity={0.92}>

                    {cd && ['acceptee', 'en_cours'].includes(c.statut) && (
                      <View style={[s.hintBar, { borderColor: '#FED7AA', backgroundColor: '#FFF7ED', marginBottom: 10 }]}>
                        <Ionicons name="alarm-outline" size={14} color={C.accent} style={{ marginRight: 6 }} />
                        <Text style={[s.hintBarTxt, { color: C.accent }]}>{cd}</Text>
                      </View>
                    )}

                    <View style={s.cardTop}>
                      <View style={[s.cardIcon, { backgroundColor: C.bgAlt }]}>
                        <Ionicons name={TYPES_ICON[c.type_marchandise] || 'cube-outline'} size={22} color={C.muted} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={s.cardRoute}>{c.ville_depart}  →  {c.ville_arrivee}</Text>
                        <Text style={s.cardMeta}>{c.type_marchandise}{c.poids ? ` · ${c.poids}` : ''}</Text>
                      </View>
                      <StatusPill statut={c.statut} />
                    </View>

                    <View style={s.cardInfo}>
                      <View style={s.infoChip}>
                        <Ionicons name="calendar-outline" size={12} color={C.muted} style={{ marginRight: 4 }} />
                        <Text style={s.infoChipTxt}>{c.date_souhaitee}</Text>
                      </View>
                      <View style={s.infoChip}>
                        <Ionicons name="person-outline" size={12} color={C.muted} style={{ marginRight: 4 }} />
                        <Text style={s.infoChipTxt}>{c.expediteur_nom}</Text>
                      </View>
                    </View>

                    {c.statut === 'acceptee' && (
                      <View style={[s.hintBar, { borderColor: '#1A56DB', backgroundColor: '#EBF5FF' }]}>
                        <Ionicons name="play-circle-outline" size={14} color="#1A56DB" style={{ marginRight: 6 }} />
                        <Text style={[s.hintBarTxt, { color: '#1A56DB' }]}>Appuie pour démarrer la course</Text>
                      </View>
                    )}
                    {c.statut === 'en_cours' && (
                      <View style={[s.hintBar, { borderColor: C.accent, backgroundColor: C.accentLight }]}>
                        <Ionicons name="car-sport-outline" size={14} color={C.accent} style={{ marginRight: 6 }} />
                        <Text style={[s.hintBarTxt, { color: C.accent }]}>En cours — appuie pour marquer livré</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </>
      )}
    </View>
  );
}

export default function SuiviScreen() {
  const { user } = useApp();
  if (!user) return null;
  return user.type === 'expediteur'
    ? <MesDemandes user={user} />
    : <MesCourses user={user} />;
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIcon:  { width: 64, height: 64, borderRadius: 32, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 6, textAlign: 'center' },
  emptyDesc:  { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },

  header: {
    backgroundColor: C.primary,
    paddingTop: Platform.OS === 'ios' ? 56 : (StatusBar.currentHeight || 24) + 12,
    paddingBottom: 18, paddingHorizontal: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  headerTitle:     { color: '#FFFFFF', fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  headerBadge:     { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5 },
  headerBadgeTxt:  { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  filterBar: { backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, width: '100%', overflow: 'visible' },
  filterChip:    { paddingHorizontal: 16, paddingVertical: 8, minHeight: 36, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg, marginRight: 8 },
  filterChipOn:  { backgroundColor: C.primary, borderColor: C.primary },
  filterChipTxt: { fontSize: 13, fontWeight: '600', color: C.muted },
  filterChipTxtOn: { color: '#FFFFFF' },

  card: {
    backgroundColor: C.bg, borderRadius: 12, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  cardTop:  { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cardIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardRoute:{ fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2, letterSpacing: -0.2 },
  cardMeta: { fontSize: 12, color: C.muted, fontWeight: '500' },

  cardInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  infoChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bgAlt, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 50 },
  infoChipTxt: { fontSize: 11, color: C.muted, fontWeight: '600' },

  acceptedBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 8, padding: 10, marginBottom: 10 },
  acceptedBarTxt: { fontSize: 13, color: C.success, fontWeight: '600' },
  suiviLiveBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentLight, borderRadius: 8, padding: 10, marginBottom: 10 },
  suiviLiveBarTxt: { flex: 1, fontSize: 13, color: C.accent, fontWeight: '700' },

  hintBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, borderWidth: 1.5, padding: 10, marginBottom: 4 },
  hintBarTxt: { fontSize: 13, fontWeight: '600' },

  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  cardDate:   { fontSize: 12, color: C.muted },
  cancelTxt:     { fontSize: 13, color: C.error, fontWeight: '600' },
  seeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeBtnTxt:     { fontSize: 13, color: C.primary, fontWeight: '700' },
  refaireBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  refaireBtnTxt: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
});

const ag = StyleSheet.create({
  toggle:      { flexDirection: 'row', backgroundColor: C.bg, borderBottomWidth: 1, borderBottomColor: C.border, padding: 10, gap: 8 },
  toggleBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border },
  toggleBtnOn: { backgroundColor: C.primary, borderColor: C.primary },
  toggleTxt:   { fontSize: 13, fontWeight: '700', color: C.muted },

  dayBtn:   { width: 52, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border },
  dayBtnOn: { backgroundColor: C.primary, borderColor: C.primary },
  dayName:  { fontSize: 10, fontWeight: '600', color: C.muted, textTransform: 'capitalize', marginBottom: 3 },
  dayNum:   { fontSize: 17, fontWeight: '800', color: C.text },
  dayDot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: C.primary, marginTop: 3 },

  jourTitle: { fontSize: 15, fontWeight: '700', color: C.text, paddingHorizontal: 16, paddingVertical: 8, textTransform: 'capitalize' },

  creneauRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, marginHorizontal: 14, marginBottom: 8, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: C.border },
  creneauLeft:  { flexDirection: 'row', alignItems: 'center', flex: 1 },
  creneauLabel: { fontSize: 14, fontWeight: '700', color: C.text },
  creneauSub:   { fontSize: 11, color: C.muted, marginTop: 1 },
  creneauRight: { marginLeft: 10 },

  courseBadge:    { backgroundColor: '#EBF5FF', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 160, borderWidth: 1, borderColor: '#93C5FD' },
  courseBadgeTxt: { fontSize: 12, fontWeight: '700', color: '#1A56DB' },
  courseCd:       { fontSize: 10, color: '#1A56DB', fontWeight: '600', marginTop: 2 },

  bloquerBtn:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt },
  debloquerBtn:{ borderColor: C.error, backgroundColor: C.errorLight },
  bloquerTxt:  { fontSize: 12, fontWeight: '600', color: C.muted },
});
