import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../../src/context/AppContext';
import { usersDB, gainsDB } from '../../src/db/database';
import { searchVilles } from '../../src/utils/wilayas';
import { fmtPrix } from '../../src/utils/pricing';

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

const WILAYAS = [
  'Adrar','Aïn Defla','Aïn Témouchent','Alger','Annaba',
  'Batna','Béchar','Béjaïa','Biskra','Blida','Bordj Bou Arréridj',
  'Bouira','Boumerdès','Chlef','Constantine','Djelfa','El Bayadh',
  'El Oued','El Tarf','Ghardaïa','Guelma','Illizi','Jijel',
  'Khenchela','Laghouat','Mascara','Médéa','Mila','Mostaganem',
  'Msila','Naâma','Oran','Ouargla','Oum El Bouaghi','Relizane',
  'Saïda','Sétif','Sidi Bel Abbès','Skikda','Souk Ahras',
  'Tamanrasset','Tébessa','Tiaret','Tindouf','Tipaza',
  'Tissemsilt','Tizi Ouzou','Tlemcen',
];

const VEHICULES = [
  { key: 'fourgon',  label: 'Fourgon',       icon: '🚐' },
  { key: 'camion35', label: 'Camion 3.5T',   icon: '🚛' },
  { key: 'camion10', label: 'Camion 10T',    icon: '🚚' },
  { key: 'semi',     label: 'Semi-remorque', icon: '🏗️' },
];

export default function ProfilScreen() {
  const { user, logout, refreshUser } = useApp();
  const router = useRouter();

  const [editing, setEditing]   = useState(false);
  const [nom, setNom]           = useState(user?.nom || '');
  const [tel, setTel]           = useState(user?.telephone || '');
  const [wilaya, setWilaya]     = useState(user?.wilaya || '');
  const [wilayaQ, setWilayaQ]   = useState('');
  const [showW, setShowW]       = useState(false);
  const [vehicule, setVehicule] = useState(user?.vehicule || '');
  const [dispo, setDispo]       = useState(user?.disponible === 1);
  const [saving, setSaving]     = useState(false);
  const [gains, setGains]       = useState(null);

  useEffect(() => {
    if (user?.type === 'transporteur') {
      try { setGains(gainsDB.getStats(user.id)); } catch (_) {}
    }
  }, [user?.id]);

  const isT = user?.type === 'transporteur';
  const accentColor = isT ? C.blue : C.orange;

  const initials = user?.nom
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  const wilayaSugg = wilayaQ.length > 0
    ? searchVilles(wilayaQ, WILAYAS)
    : [];

  const handleSave = async () => {
    if (!nom.trim())  return Alert.alert('Requis', 'Entre ton nom.');
    if (!wilaya)      return Alert.alert('Requis', 'Choisis ta wilaya.');
    if (isT && !vehicule) return Alert.alert('Requis', 'Choisis le type de véhicule.');

    setSaving(true);
    try {
      usersDB.update(user.id, {
        nom: nom.trim(), telephone: tel.trim(), wilaya,
        vehicule: isT ? vehicule : null,
        disponible: dispo ? 1 : 0,
      });
      refreshUser();
      setEditing(false);
      Alert.alert('✅ Profil mis à jour', 'Labès ! Tes infos sont sauvegardées.');
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleDispo = () => {
    const newVal = !dispo;
    setDispo(newVal);
    usersDB.update(user.id, {
      nom: user.nom, telephone: user.telephone, wilaya: user.wilaya,
      vehicule: user.vehicule, disponible: newVal ? 1 : 0,
    });
    refreshUser();
  };

  const handleLogout = () =>
    Alert.alert('Se déconnecter ?', 'Tu devras recréer ton profil.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnecter', style: 'destructive', onPress: logout },
    ]);

  if (!user) return null;

  return (
    <ScrollView style={s.root} contentContainerStyle={{ paddingBottom: 80 }}>
      <StatusBar barStyle="light-content" backgroundColor={isT ? C.blueDark : C.orange} />

      {/* Header */}
      <View style={[s.header, { backgroundColor: isT ? C.blueDark : C.orange }]}>
        <View style={[s.avatar, { borderColor: isT ? C.blue : C.orange }]}>
          <Text style={s.avatarTxt}>{initials}</Text>
        </View>
        <Text style={s.userName}>{user.nom}</Text>
        <View style={[s.typeBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={s.typeBadgeTxt}>{isT ? '🚛 Transporteur' : '📦 Expéditeur'}</Text>
        </View>
      </View>

      {/* Disponibilité (transporteur uniquement) */}
      {isT && (
        <TouchableOpacity
          style={[s.dispoCard, { borderColor: dispo ? C.green : C.border }]}
          onPress={toggleDispo}
          activeOpacity={0.85}
        >
          <View style={{ flex: 1 }}>
            <Text style={s.dispoTitle}>{dispo ? '🟢 Disponible' : '🔴 Non disponible'}</Text>
            <Text style={s.dispoSub}>
              {dispo ? 'Tu reçois de nouvelles demandes' : 'Tu ne reçois pas de demandes'}
            </Text>
          </View>
          <View style={[s.toggle, dispo && { backgroundColor: C.green }]}>
            <View style={[s.toggleThumb, dispo && s.toggleThumbOn]} />
          </View>
        </TouchableOpacity>
      )}

      {/* ── Dashboard gains (transporteur) ── */}
      {isT && gains !== null && (
        <View style={[s.section, { marginTop: 16, marginBottom: 0 }]}>
          <Text style={s.sectionTitle}>💵 Mes gains</Text>
          <View style={g.grid}>
            <View style={g.cell}>
              <Text style={g.cellLabel}>Aujourd'hui</Text>
              <Text style={g.cellAmt}>{fmtPrix(gains.today)}</Text>
            </View>
            <View style={[g.cell, g.cellBorder]}>
              <Text style={g.cellLabel}>Cette semaine</Text>
              <Text style={g.cellAmt}>{fmtPrix(gains.semaine)}</Text>
            </View>
            <View style={[g.cell, g.cellBorder]}>
              <Text style={g.cellLabel}>Ce mois</Text>
              <Text style={g.cellAmt}>{fmtPrix(gains.mois)}</Text>
            </View>
          </View>
          <View style={g.footer}>
            <Text style={g.footerTxt}>
              Total : <Text style={{ fontWeight: '900', color: C.blue }}>{fmtPrix(gains.total)}</Text>
              {'  ·  '}
              {gains.nbCourses} course{gains.nbCourses !== 1 ? 's' : ''} effectuée{gains.nbCourses !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={g.commissionInfo}>
            <Text style={g.commissionTxt}>
              Commission DzExpress : 15% (standard) — 10% si votre note &gt; 4,5 ⭐
            </Text>
          </View>
        </View>
      )}

      {/* Infos profil */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Mon profil</Text>
          {!editing && (
            <TouchableOpacity onPress={() => {
              setNom(user.nom); setTel(user.telephone);
              setWilaya(user.wilaya); setVehicule(user.vehicule || '');
              setDispo(user.disponible === 1); setEditing(true);
            }}>
              <Text style={[s.editBtn, { color: accentColor }]}>✏️ Modifier</Text>
            </TouchableOpacity>
          )}
        </View>

        {editing ? (
          <View>
            <Text style={s.label}>Nom complet</Text>
            <TextInput style={s.input} value={nom} onChangeText={setNom}
              placeholderTextColor={C.muted} />

            <Text style={s.label}>Téléphone</Text>
            <TextInput style={s.input} value={tel} onChangeText={setTel}
              keyboardType="phone-pad" placeholderTextColor={C.muted} />

            <Text style={s.label}>Wilaya</Text>
            <TextInput
              style={s.input}
              value={wilayaQ || wilaya}
              placeholder="Rechercher…"
              placeholderTextColor={C.muted}
              onChangeText={t => { setWilayaQ(t); setWilaya(''); setShowW(true); }}
              onFocus={() => setShowW(true)}
            />
            {showW && wilayaSugg.length > 0 && (
              <View style={s.suggBox}>
                {wilayaSugg.map(w => (
                  <TouchableOpacity key={w} style={s.suggItem}
                    onPress={() => { setWilaya(w); setWilayaQ(''); setShowW(false); }}>
                    <Text style={s.suggTxt}>📍 {w}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {wilaya ? <Text style={s.selectedWilaya}>✓ {wilaya}</Text> : null}

            {isT && (
              <>
                <Text style={[s.label, { marginTop: 4 }]}>Type de véhicule</Text>
                <View style={s.vehicleGrid}>
                  {VEHICULES.map(v => (
                    <TouchableOpacity key={v.key}
                      style={[s.vehicleChip, vehicule === v.key && { backgroundColor: C.blueLight, borderColor: C.blue }]}
                      onPress={() => setVehicule(v.key)}>
                      <Text style={{ fontSize: 20 }}>{v.icon}</Text>
                      <Text style={[s.vehicleChipTxt, vehicule === v.key && { color: C.blue }]}>{v.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={s.editBtns}>
              <TouchableOpacity style={s.cancelEditBtn} onPress={() => setEditing(false)}>
                <Text style={s.cancelEditTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: accentColor }]}
                onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={s.saveBtnTxt}>Enregistrer ✓</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.infoList}>
            <InfoRow icon="👤" label="Nom" value={user.nom} />
            <InfoRow icon="📞" label="Téléphone" value={user.telephone} />
            <InfoRow icon="📍" label="Wilaya" value={user.wilaya} />
            {isT && user.vehicule && (
              <InfoRow
                icon={VEHICULES.find(v => v.key === user.vehicule)?.icon || '🚛'}
                label="Véhicule"
                value={VEHICULES.find(v => v.key === user.vehicule)?.label || user.vehicule}
              />
            )}
            <TouchableOpacity
              style={[s.otpBtn, { borderColor: accentColor }]}
              onPress={() => router.push(`/otp?phone=${encodeURIComponent(user.telephone || '')}`)}
              activeOpacity={0.8}
            >
              <Text style={[s.otpBtnTxt, { color: accentColor }]}>🔐 Vérifier mon numéro</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* A propos */}
      <View style={[s.section, { marginTop: 8 }]}>
        <Text style={s.sectionTitle}>À propos</Text>
        <View style={s.aboutCard}>
          <Text style={s.aboutLogo}>🚛 DzExpress</Text>
          <Text style={s.aboutDesc}>
            Plateforme de transport de marchandises pour particuliers en Algérie.{'\n'}
            Simple · Rapide · 100% Algérien 🇩🇿
          </Text>
          <Text style={s.aboutVersion}>Version 1.0.0</Text>
        </View>
      </View>

      {/* Déconnexion */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Text style={s.logoutTxt}>🚪 Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <View style={row.root}>
      <Text style={row.icon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={row.label}>{label}</Text>
        <Text style={row.value}>{value || '—'}</Text>
      </View>
    </View>
  );
}
const row = StyleSheet.create({
  root:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 14 },
  icon:  { fontSize: 22, width: 30 },
  label: { fontSize: 11, color: C.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { fontSize: 15, color: C.text, fontWeight: '600', marginTop: 2 },
});

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.bg },
  header:      { alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 70 : (StatusBar.currentHeight || 24) + 24, paddingBottom: 28, paddingHorizontal: 24 },
  avatar:      { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', borderWidth: 3, marginBottom: 12 },
  avatarTxt:   { fontSize: 28, fontWeight: '800', color: 'white' },
  userName:    { fontSize: 22, fontWeight: '900', color: 'white', marginBottom: 8 },
  typeBadge:   { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  typeBadgeTxt:{ fontSize: 14, fontWeight: '700', color: 'white' },

  dispoCard:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, marginHorizontal: 16, marginTop: 16, borderRadius: 16, padding: 18, borderWidth: 2, elevation: 2 },
  dispoTitle:  { fontSize: 16, fontWeight: '800', color: C.text, marginBottom: 3 },
  dispoSub:    { fontSize: 13, color: C.muted },
  toggle:      { width: 52, height: 30, borderRadius: 15, backgroundColor: C.border, justifyContent: 'center', padding: 3 },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.white, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2 },
  toggleThumbOn: { alignSelf: 'flex-end' },

  section:     { backgroundColor: C.white, margin: 16, borderRadius: 18, padding: 20, elevation: 1, borderWidth: 1, borderColor: C.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle:{ fontSize: 16, fontWeight: '800', color: C.text },
  editBtn:     { fontSize: 14, fontWeight: '700' },
  infoList:    { gap: 0 },

  label:       { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input:       { backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, marginBottom: 14 },
  suggBox:     { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginTop: -10, marginBottom: 10, overflow: 'hidden', elevation: 4 },
  suggItem:    { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.bg },
  suggTxt:     { fontSize: 14, color: C.text },
  selectedWilaya: { fontSize: 13, color: C.green, fontWeight: '700', marginTop: -8, marginBottom: 14 },

  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  vehicleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg },
  vehicleChipTxt: { fontSize: 13, fontWeight: '600', color: C.muted },

  editBtns:    { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelEditBtn: { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  cancelEditTxt: { fontSize: 15, fontWeight: '700', color: C.muted },
  saveBtn:     { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  saveBtnTxt:  { color: 'white', fontSize: 15, fontWeight: '700' },

  aboutCard:   { backgroundColor: C.bg, borderRadius: 12, padding: 16 },
  aboutLogo:   { fontSize: 18, fontWeight: '900', color: C.blue, marginBottom: 8 },
  aboutDesc:   { fontSize: 13, color: C.muted, lineHeight: 20, marginBottom: 8 },
  aboutVersion:{ fontSize: 12, color: C.border },

  otpBtn:      { marginTop: 14, borderWidth: 1.5, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  otpBtnTxt:   { fontSize: 14, fontWeight: '700' },

  logoutBtn:   { margin: 16, backgroundColor: '#FEF2F2', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: '#FECACA' },
  logoutTxt:   { fontSize: 16, fontWeight: '700', color: C.red },
});

const g = StyleSheet.create({
  grid:         { flexDirection: 'row', marginTop: 14, marginBottom: 6 },
  cell:         { flex: 1, alignItems: 'center' },
  cellBorder:   { borderLeftWidth: 1, borderLeftColor: '#E2E8F0' },
  cellLabel:    { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', marginBottom: 4 },
  cellAmt:      { fontSize: 18, fontWeight: '900', color: C.blue },
  footer:       { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 10, alignItems: 'center' },
  footerTxt:    { fontSize: 13, color: C.muted, fontWeight: '600' },
  commissionInfo:{ backgroundColor: '#EBF5FF', borderRadius: 10, padding: 10, marginTop: 10, borderWidth: 1, borderColor: '#BFDBFE' },
  commissionTxt: { fontSize: 12, color: C.blue, fontWeight: '600', lineHeight: 18 },
});
