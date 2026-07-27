import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Platform, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/context/AppContext';
import { usersDB, gainsDB } from '../../src/db/database';
import { searchVilles } from '../../src/utils/wilayas';
import { fmtPrix } from '../../src/utils/pricing';
import { useLanguage } from '../../src/i18n';

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
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
  { key: 'herbine',    label: 'Herbine',          icon: 'cart-outline' },
  { key: 'utilitaire', label: 'Utilitaire léger', icon: 'car-outline' },
  { key: 'fourgon',    label: 'Fourgon',          icon: 'car-sport-outline' },
  { key: 'camion35',   label: 'Camion 3.5T',      icon: 'bus-outline' },
  { key: 'camion10',   label: 'Camion 10T',        icon: 'cube-outline' },
  { key: 'semi',       label: 'Semi-remorque',    icon: 'construct-outline' },
];

export default function ProfilScreen() {
  const { user, logout, refreshUser } = useApp();
  const router = useRouter();
  const { locale, setLanguage } = useLanguage();

  const [editing, setEditing]   = useState(false);
  const [nom, setNom]           = useState(user?.nom || '');
  const [tel, setTel]           = useState(user?.telephone || '');
  const [wilaya, setWilaya]     = useState(user?.wilaya || '');
  const [wilayaQ, setWilayaQ]   = useState('');
  const [showW, setShowW]       = useState(false);
  const [vehicule, setVehicule] = useState(user?.vehicule || '');
  const [dispo, setDispo]       = useState(user?.disponible === 1);
  const [heureEnLigne, setHeureEnLigne] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [gains, setGains]       = useState(null);

  useEffect(() => {
    if (user?.type === 'transporteur') {
      try {
        setGains(gainsDB.getStats(user.id));
        const u = usersDB.getById(user.id);
        setDispo(u?.disponible === 1);
        setHeureEnLigne(u?.disponible === 1 ? u?.heure_mise_en_ligne : null);
      } catch (_) {}
    }
  }, [user?.id]);

  const isT      = user?.type === 'transporteur';
  const initials = user?.nom?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const wilayaSugg = wilayaQ.length > 0 ? searchVilles(wilayaQ, WILAYAS) : [];

  const handleSave = async () => {
    if (!nom.trim())           return Alert.alert('Requis', 'Entre ton nom.');
    if (!wilaya)               return Alert.alert('Requis', 'Choisis ta wilaya.');
    if (isT && !vehicule)      return Alert.alert('Requis', 'Choisis le type de véhicule.');
    setSaving(true);
    try {
      usersDB.update(user.id, {
        nom: nom.trim(), telephone: tel.trim(), wilaya,
        vehicule: isT ? vehicule : null,
        disponible: dispo ? 1 : 0,
      });
      refreshUser();
      setEditing(false);
      Alert.alert('Profil mis à jour', 'Tes informations ont été sauvegardées.');
    } catch (e) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleDispo = () => {
    const nv = !dispo;
    const now = nv ? new Date().toISOString() : null;
    setDispo(nv);
    setHeureEnLigne(nv ? now : null);
    try { usersDB.setDisponible(user.id, nv ? 1 : 0, now); } catch (_) {}
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
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarTxt}>{initials}</Text>
        </View>
        <Text style={s.userName}>{user.nom}</Text>
        <View style={s.typeBadge}>
          <Ionicons name={isT ? 'car-sport-outline' : 'cube-outline'} size={13} color="#FFFFFF" style={{ marginRight: 5 }} />
          <Text style={s.typeBadgeTxt}>{isT ? 'Transporteur' : 'Expéditeur'}</Text>
        </View>
        {isT && (
          <View style={[p.onlineBadge, { backgroundColor: dispo ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.1)' }]}>
            <View style={[p.onlineDot, { backgroundColor: dispo ? '#10B981' : '#9CA3AF' }]} />
            <Text style={[p.onlineTxt, { color: dispo ? '#10B981' : 'rgba(255,255,255,0.6)' }]}>
              {dispo ? 'En ligne' : 'Hors ligne'}
            </Text>
            {dispo && heureEnLigne && (() => {
              const mins = Math.floor((Date.now() - new Date(heureEnLigne).getTime()) / 60000);
              if (mins < 1) return null;
              const label = mins < 60
                ? `${mins} min`
                : (() => { const h = Math.floor(mins / 60), m = mins % 60; return m > 0 ? `${h}h${m.toString().padStart(2,'0')}` : `${h}h`; })();
              return <Text style={p.onlineSince}>{`  ·  depuis ${label}`}</Text>;
            })()}
          </View>
        )}
      </View>

      {/* Toggle disponibilité */}
      {isT && (
        <TouchableOpacity style={[s.dispoCard, dispo && { borderColor: C.success }]} onPress={toggleDispo} activeOpacity={0.85}>
          <View style={[s.dispoIndicator, { backgroundColor: dispo ? C.success : '#9CA3AF' }]} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={s.dispoTitle}>{dispo ? 'Disponible' : 'Non disponible'}</Text>
            <Text style={s.dispoSub}>{dispo ? 'Tu reçois de nouvelles demandes' : 'Tu ne reçois pas de demandes'}</Text>
          </View>
          <View style={[s.toggle, dispo && { backgroundColor: C.success }]}>
            <View style={[s.toggleThumb, dispo && { alignSelf: 'flex-end' }]} />
          </View>
        </TouchableOpacity>
      )}

      {/* Dashboard gains */}
      {isT && gains !== null && (
        <View style={[s.section, { marginTop: 12, marginBottom: 0 }]}>
          <View style={s.sectionHeader}>
            <Ionicons name="wallet-outline" size={16} color={C.text} style={{ marginRight: 8 }} />
            <Text style={s.sectionTitle}>Mes gains</Text>
          </View>
          <View style={g.grid}>
            <GainCell label="Aujourd'hui" amount={gains.today} />
            <View style={g.sep} />
            <GainCell label="Cette semaine" amount={gains.semaine} />
            <View style={g.sep} />
            <GainCell label="Ce mois" amount={gains.mois} />
          </View>
          <View style={g.footer}>
            <Text style={g.footerTxt}>
              Total :{' '}
              <Text style={{ fontWeight: '900', color: C.primary }}>{fmtPrix(gains.total)}</Text>
              {'  ·  '}
              {gains.nbCourses} course{gains.nbCourses !== 1 ? 's' : ''}
            </Text>
          </View>
          <View style={g.commissionRow}>
            <Ionicons name="information-circle-outline" size={13} color={C.muted} style={{ marginRight: 5 }} />
            <Text style={g.commissionTxt}>Commission 15% (10% si note &gt; 4,5)</Text>
          </View>
        </View>
      )}

      {/* Infos profil */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Ionicons name="person-outline" size={16} color={C.text} style={{ marginRight: 8 }} />
          <Text style={s.sectionTitle}>Mon profil</Text>
          {!editing && (
            <TouchableOpacity style={s.editBtn} onPress={() => {
              setNom(user.nom); setTel(user.telephone || '');
              setWilaya(user.wilaya); setVehicule(user.vehicule || '');
              setDispo(user.disponible === 1); setEditing(true);
            }}>
              <Ionicons name="pencil-outline" size={14} color={C.muted} />
              <Text style={s.editBtnTxt}>Modifier</Text>
            </TouchableOpacity>
          )}
        </View>

        {editing ? (
          <View>
            <FieldLabel>Nom complet</FieldLabel>
            <TextInput style={s.input} value={nom} onChangeText={setNom} placeholderTextColor="#9CA3AF" />

            <FieldLabel>Téléphone</FieldLabel>
            <TextInput style={s.input} value={tel} onChangeText={setTel} keyboardType="phone-pad" placeholderTextColor="#9CA3AF" />

            <FieldLabel>Wilaya</FieldLabel>
            <TextInput
              style={s.input}
              value={wilayaQ || wilaya}
              placeholder="Rechercher une wilaya…"
              placeholderTextColor="#9CA3AF"
              onChangeText={t => { setWilayaQ(t); setWilaya(''); setShowW(true); }}
              onFocus={() => setShowW(true)}
            />
            {showW && wilayaSugg.length > 0 && (
              <View style={s.suggBox}>
                {wilayaSugg.map(w => (
                  <TouchableOpacity key={w} style={s.suggItem}
                    onPress={() => { setWilaya(w); setWilayaQ(''); setShowW(false); }}>
                    <Ionicons name="location-outline" size={13} color={C.muted} style={{ marginRight: 8 }} />
                    <Text style={s.suggTxt}>{w}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {wilaya ? (
              <View style={s.selectedRow}>
                <Ionicons name="checkmark-circle" size={14} color={C.success} style={{ marginRight: 4 }} />
                <Text style={s.selectedTxt}>{wilaya}</Text>
              </View>
            ) : null}

            {isT && (
              <>
                <FieldLabel>Type de véhicule</FieldLabel>
                <View style={s.vehicleGrid}>
                  {VEHICULES.map(v => {
                    const active = vehicule === v.key;
                    return (
                      <TouchableOpacity key={v.key}
                        style={[s.vehicleChip, active && { backgroundColor: C.accentLight, borderColor: C.accent }]}
                        onPress={() => setVehicule(v.key)}>
                        <Ionicons name={v.icon} size={18} color={active ? C.accent : C.muted} />
                        <Text style={[s.vehicleChipTxt, active && { color: C.accent }]}>{v.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <View style={s.editBtns}>
              <TouchableOpacity style={s.cancelEditBtn} onPress={() => setEditing(false)}>
                <Text style={s.cancelEditTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={s.saveBtnTxt}>Enregistrer</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.infoList}>
            <InfoRow iconName="person-outline" label="Nom" value={user.nom} />
            <InfoRow iconName="call-outline" label="Téléphone" value={user.telephone} />
            <InfoRow iconName="location-outline" label="Wilaya" value={user.wilaya} />
            {isT && user.vehicule && (
              <InfoRow
                iconName={VEHICULES.find(v => v.key === user.vehicule)?.icon || 'car-sport-outline'}
                label="Véhicule"
                value={VEHICULES.find(v => v.key === user.vehicule)?.label || user.vehicule}
              />
            )}
            <TouchableOpacity style={s.otpBtn}
              onPress={() => router.push(`/otp?phone=${encodeURIComponent(user.telephone || '')}`)}>
              <Ionicons name="shield-checkmark-outline" size={16} color={C.accent} style={{ marginRight: 8 }} />
              <Text style={s.otpBtnTxt}>Vérifier mon numéro</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Langue */}
      <View style={[s.section, { marginTop: 8 }]}>
        <View style={s.sectionHeader}>
          <Ionicons name="language-outline" size={16} color={C.text} style={{ marginRight: 8 }} />
          <Text style={s.sectionTitle}>Langue / اللغة</Text>
        </View>
        <View style={s.langRow}>
          <TouchableOpacity
            style={[s.langBtn, locale === 'fr' && s.langBtnActive]}
            onPress={() => setLanguage('fr')}
            activeOpacity={0.8}
          >
            <Text style={[s.langBtnTxt, locale === 'fr' && s.langBtnTxtActive]}>FR</Text>
            <Text style={[s.langBtnLabel, locale === 'fr' && s.langBtnTxtActive]}>Français</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.langBtn, locale === 'ar' && s.langBtnActive]}
            onPress={() => setLanguage('ar')}
            activeOpacity={0.8}
          >
            <Text style={[s.langBtnTxt, locale === 'ar' && s.langBtnTxtActive]}>AR</Text>
            <Text style={[s.langBtnLabel, locale === 'ar' && s.langBtnTxtActive]}>العربية</Text>
          </TouchableOpacity>
        </View>
        {locale === 'ar' && (
          <Text style={s.langNote}>
            {'قد يتطلب تفعيل اتجاه RTL إعادة تشغيل التطبيق'}
          </Text>
        )}
      </View>

      {/* Signaler un problème */}
      <TouchableOpacity style={s.aideBtn} onPress={() => router.push('/signalement')} activeOpacity={0.85}>
        <View style={s.aideBtnLeft}>
          <View style={[s.aideBtnIcon, { backgroundColor: C.errorLight }]}>
            <Ionicons name="flag-outline" size={20} color={C.error} />
          </View>
          <View>
            <Text style={s.aideBtnTitle}>Signaler un problème</Text>
            <Text style={s.aideBtnSub}>Paiement, comportement, bug, fraude…</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </TouchableOpacity>

      {/* Aide & Support */}
      <TouchableOpacity style={s.aideBtn} onPress={() => router.push('/aide')} activeOpacity={0.85}>
        <View style={s.aideBtnLeft}>
          <View style={[s.aideBtnIcon, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="help-circle-outline" size={20} color="#1D4ED8" />
          </View>
          <View>
            <Text style={s.aideBtnTitle}>Aide & Support</Text>
            <Text style={s.aideBtnSub}>FAQ, nous contacter, chat support</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.muted} />
      </TouchableOpacity>

      {/* À propos */}
      <View style={[s.section, { marginTop: 8 }]}>
        <View style={s.sectionHeader}>
          <Ionicons name="information-circle-outline" size={16} color={C.text} style={{ marginRight: 8 }} />
          <Text style={s.sectionTitle}>À propos</Text>
        </View>
        <View style={s.aboutCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <View style={s.logoBadge}><Text style={s.logoDz}>Dz</Text></View>
            <Text style={s.logoExpress}>Express</Text>
          </View>
          <Text style={s.aboutDesc}>
            Plateforme de transport de marchandises en Algérie.{'\n'}
            Simple · Rapide · 100% Algérien
          </Text>
          <Text style={s.aboutVersion}>Version 1.0.0</Text>
        </View>
      </View>

      {/* Déconnexion */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={20} color={C.error} style={{ marginRight: 8 }} />
        <Text style={s.logoutTxt}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function FieldLabel({ children }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

function InfoRow({ iconName, label, value }) {
  return (
    <View style={row.root}>
      <View style={row.iconWrap}>
        <Ionicons name={iconName} size={18} color={C.muted} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={row.label}>{label}</Text>
        <Text style={row.value}>{value || '—'}</Text>
      </View>
    </View>
  );
}

function GainCell({ label, amount }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={g.cellLabel}>{label}</Text>
      <Text style={g.cellAmt}>{fmtPrix(amount)}</Text>
    </View>
  );
}

const row = StyleSheet.create({
  root:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconWrap:{ width: 34, height: 34, borderRadius: 10, backgroundColor: C.bgAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  label:   { fontSize: 11, color: C.muted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  value:   { fontSize: 15, color: C.text, fontWeight: '600' },
});

const g = StyleSheet.create({
  grid:        { flexDirection: 'row', paddingVertical: 14 },
  sep:         { width: 1, backgroundColor: C.border },
  cellLabel:   { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 },
  cellAmt:     { fontSize: 20, fontWeight: '900', color: C.text, letterSpacing: -0.5 },
  footer:      { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12, alignItems: 'center' },
  footerTxt:   { fontSize: 13, color: C.muted, fontWeight: '600' },
  commissionRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.border },
  commissionTxt: { fontSize: 12, color: C.muted, fontWeight: '500', flex: 1 },
});

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bgAlt },

  header: {
    backgroundColor: C.primary,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 70 : (StatusBar.currentHeight || 24) + 24,
    paddingBottom: 28, paddingHorizontal: 24,
  },
  avatar:     { width: 78, height: 78, borderRadius: 39, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  avatarTxt:  { fontSize: 28, fontWeight: '900', color: '#FFFFFF' },
  userName:   { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 10, letterSpacing: -0.4 },
  typeBadge:  { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 50 },
  typeBadgeTxt: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },

  dispoCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg,
    marginHorizontal: 16, marginTop: 16, borderRadius: 12, padding: 16,
    borderWidth: 1.5, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, elevation: 2,
  },
  dispoIndicator: { width: 10, height: 10, borderRadius: 5 },
  dispoTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  dispoSub:   { fontSize: 13, color: C.muted },
  toggle:     { width: 48, height: 28, borderRadius: 14, backgroundColor: '#D1D5DB', justifyContent: 'center', padding: 3 },
  toggleThumb:{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', elevation: 2, shadowColor: '#000', shadowOpacity: 0.15 },

  section: {
    backgroundColor: C.bg, margin: 16, borderRadius: 12, padding: 18,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, elevation: 2,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle:  { fontSize: 15, fontWeight: '700', color: C.text, flex: 1 },

  editBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: C.bgAlt },
  editBtnTxt: { fontSize: 13, fontWeight: '600', color: C.muted },

  infoList: {},
  fieldLabel: { fontSize: 11, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  input: { backgroundColor: C.bgAlt, borderWidth: 1.5, borderColor: C.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.text, marginBottom: 14 },

  suggBox:  { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 10, marginTop: -10, marginBottom: 10, overflow: 'hidden', elevation: 4 },
  suggItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.bgAlt },
  suggTxt:  { fontSize: 14, color: C.text },

  selectedRow: { flexDirection: 'row', alignItems: 'center', marginTop: -8, marginBottom: 14 },
  selectedTxt: { fontSize: 13, color: C.success, fontWeight: '700' },

  vehicleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  vehicleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bgAlt },
  vehicleChipTxt: { fontSize: 13, fontWeight: '600', color: C.muted },

  editBtns:     { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelEditBtn:{ flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  cancelEditTxt:{ fontSize: 14, fontWeight: '700', color: C.muted },
  saveBtn:      { flex: 2, backgroundColor: C.primary, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  saveBtnTxt:   { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  otpBtn:    { flexDirection: 'row', alignItems: 'center', marginTop: 14, paddingVertical: 13, paddingHorizontal: 14, borderWidth: 1.5, borderColor: C.border, borderRadius: 10, backgroundColor: C.bgAlt },
  otpBtnTxt: { fontSize: 14, fontWeight: '700', color: C.accent },

  aboutCard:    { backgroundColor: C.bgAlt, borderRadius: 10, padding: 14 },
  logoBadge:    { backgroundColor: C.accent, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, marginRight: 5 },
  logoDz:       { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  logoExpress:  { color: C.text, fontSize: 16, fontWeight: '800' },
  aboutDesc:    { fontSize: 13, color: C.muted, lineHeight: 20, marginBottom: 8 },
  aboutVersion: { fontSize: 11, color: '#D1D5DB', fontWeight: '500' },

  langRow:         { flexDirection: 'row', gap: 10, paddingTop: 4 },
  langBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg },
  langBtnActive:   { borderColor: C.text, backgroundColor: C.text },
  langBtnTxt:      { fontSize: 13, fontWeight: '800', color: C.muted },
  langBtnLabel:    { fontSize: 14, fontWeight: '600', color: C.muted },
  langBtnTxtActive:{ color: '#FFFFFF' },
  langNote:        { fontSize: 11, color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: 16 },

  aideBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.bg, marginHorizontal: 16, marginTop: 8, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, elevation: 2 },
  aideBtnLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  aideBtnIcon:  { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  aideBtnTitle: { fontSize: 15, fontWeight: '700', color: C.text, marginBottom: 2 },
  aideBtnSub:   { fontSize: 12, color: C.muted },

  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    margin: 16, backgroundColor: C.errorLight, borderRadius: 12,
    paddingVertical: 16, borderWidth: 1.5, borderColor: '#FCA5A5',
  },
  logoutTxt: { fontSize: 15, fontWeight: '700', color: C.error },
});

// Online badge styles
const p = StyleSheet.create({
  onlineBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 50, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10 },
  onlineDot:   { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
  onlineTxt:   { fontSize: 13, fontWeight: '700', letterSpacing: -0.1 },
  onlineSince: { fontSize: 12, fontWeight: '500', color: 'rgba(16,185,129,0.7)' },
});
