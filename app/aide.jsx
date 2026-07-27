import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Platform, StatusBar, Linking, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const C = {
  primary: '#0A0A0A', accent: '#F97316', accentLight: '#FFF3E8',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444',
};

const FAQ = [
  {
    q: 'Comment fonctionne DzExpress ?',
    a: 'DzExpress met en relation des expéditeurs (qui ont une marchandise à envoyer) et des transporteurs (qui ont un véhicule disponible). Publiez une demande, recevez des offres, choisissez votre transporteur et suivez votre livraison en temps réel.',
  },
  {
    q: 'Comment réserver un transporteur ?',
    a: "Depuis l'onglet Accueil, choisissez le mode \"Maintenant\" pour choisir un transporteur directement sur la carte, ou \"Planifié\" pour publier votre demande et recevoir des offres de plusieurs transporteurs.",
  },
  {
    q: 'Comment annuler une course ?',
    a: "Rendez-vous sur votre demande (onglet Mes demandes), ouvrez le détail et appuyez sur \"Annuler\". L'annulation est gratuite dans les 5 premières minutes. Au-delà, elle est comptabilisée dans votre historique.",
  },
  {
    q: 'Comment payer ?',
    a: "Le paiement s'effectue directement entre expéditeur et transporteur à la livraison (espèces). Le paiement électronique (CIB / Edahabia) sera disponible prochainement.",
  },
  {
    q: "Que faire si mon transporteur n'arrive pas ?",
    a: "Contactez-le via le chat de la demande. S'il ne répond pas sous 15 minutes, annulez la course sans pénalité et signalez le problème via le formulaire ci-dessous. Notre équipe interviendra sous 24h.",
  },
  {
    q: 'Comment signaler un problème ?',
    a: 'Utilisez le formulaire "Signaler un problème" en bas de cet écran, ou appelez directement notre support au +213 555 000 111. Nous traitons chaque signalement sous 24h.',
  },
  {
    q: 'Comment devenir transporteur ?',
    a: "Lors de l'inscription, sélectionnez le rôle \"Transporteur\" et renseignez les informations de votre véhicule. Vous pourrez ensuite voir et accepter des demandes de livraison dans votre zone.",
  },
  {
    q: 'Comment modifier mon profil ?',
    a: "Rendez-vous dans l'onglet Profil et appuyez sur \"Modifier\". Vous pouvez changer votre nom, téléphone, wilaya et type de véhicule.",
  },
];


function FaqItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.faqItem}>
      <TouchableOpacity style={s.faqQ} onPress={() => setOpen(v => !v)} activeOpacity={0.75}>
        <Text style={s.faqQTxt}>{question}</Text>
        <Ionicons name={open ? 'remove' : 'add'} size={20} color={C.muted} />
      </TouchableOpacity>
      {open && (
        <View style={s.faqA}>
          <Text style={s.faqATxt}>{answer}</Text>
        </View>
      )}
    </View>
  );
}

export default function AideScreen() {
  const router = useRouter();

  const callSupport = () =>
    Linking.openURL('tel:+213555000111').catch(() =>
      Alert.alert('Erreur', 'Impossible d\'ouvrir le téléphone.')
    );

  const emailSupport = () =>
    Linking.openURL('mailto:dzexpress.support@gmail.com?subject=Demande%20support%20DzExpress').catch(() =>
      Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application email.')
    );

  return (
    <View style={{ flex: 1, backgroundColor: C.bgAlt }}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Centre d'aide</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── FAQ ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="help-circle-outline" size={18} color={C.text} style={{ marginRight: 8 }} />
            <Text style={s.sectionTitle}>Questions fréquentes</Text>
          </View>
          {FAQ.map((item, i) => (
            <FaqItem key={i} question={item.q} answer={item.a} />
          ))}
        </View>

        {/* ── Nous contacter ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="call-outline" size={18} color={C.text} style={{ marginRight: 8 }} />
            <Text style={s.sectionTitle}>Nous contacter</Text>
          </View>

          <View style={s.horaires}>
            <Ionicons name="time-outline" size={14} color={C.success} style={{ marginRight: 6 }} />
            <Text style={s.horairesTxt}>Disponible 7j/7 de 8h à 22h</Text>
          </View>

          <TouchableOpacity style={[s.contactBtn, { backgroundColor: C.successLight, borderColor: '#6EE7B7' }]} onPress={callSupport} activeOpacity={0.85}>
            <Ionicons name="call-outline" size={18} color={C.success} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactBtnTitle, { color: C.success }]}>Appeler le support</Text>
              <Text style={s.contactBtnSub}>+213 555 000 111</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.success} />
          </TouchableOpacity>

          <TouchableOpacity style={[s.contactBtn, { backgroundColor: '#EFF6FF', borderColor: '#93C5FD' }]} onPress={() => router.push('/support-chat')} activeOpacity={0.85}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#1D4ED8" style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactBtnTitle, { color: '#1D4ED8' }]}>Chat avec le support</Text>
              <Text style={s.contactBtnSub}>Réponse en quelques minutes</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#1D4ED8" />
          </TouchableOpacity>

          <TouchableOpacity style={[s.contactBtn, { backgroundColor: C.accentLight, borderColor: '#FED7AA' }]} onPress={emailSupport} activeOpacity={0.85}>
            <Ionicons name="mail-outline" size={18} color={C.accent} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <Text style={[s.contactBtnTitle, { color: C.accent }]}>Envoyer un email</Text>
              <Text style={s.contactBtnSub}>dzexpress.support@gmail.com</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={C.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Signaler un problème ── */}
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Ionicons name="flag-outline" size={18} color={C.text} style={{ marginRight: 8 }} />
            <Text style={s.sectionTitle}>Signaler un problème</Text>
          </View>
          <Text style={s.signalSub}>
            Problème de paiement, comportement, bug technique, fraude… Notre équipe traite chaque signalement sous 24h.
          </Text>
          <TouchableOpacity
            style={s.signalBtn}
            onPress={() => router.push('/signalement')}
            activeOpacity={0.85}
          >
            <Ionicons name="flag" size={16} color="#FFFFFF" style={{ marginRight: 10 }} />
            <Text style={s.signalBtnTxt}>Ouvrir le formulaire de signalement</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

      </ScrollView>
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

  section: {
    backgroundColor: C.bg, margin: 16, marginBottom: 0, borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: '#F3F4F6',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, elevation: 2,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: C.text },

  faqItem: { borderBottomWidth: 1, borderBottomColor: C.border },
  faqQ:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 10 },
  faqQTxt: { flex: 1, fontSize: 14, fontWeight: '600', color: C.text, lineHeight: 20 },
  faqA:    { paddingBottom: 14, paddingRight: 8 },
  faqATxt: { fontSize: 13, color: C.muted, lineHeight: 20 },

  horaires:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.successLight, borderRadius: 8, padding: 10, marginBottom: 14, borderWidth: 1, borderColor: '#6EE7B7' },
  horairesTxt: { fontSize: 13, fontWeight: '600', color: C.success },

  contactBtn:      { flexDirection: 'row', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1.5 },
  contactBtnTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  contactBtnSub:   { fontSize: 12, color: C.muted },

  signalSub:    { fontSize: 13, color: C.muted, lineHeight: 19, marginBottom: 14 },
  signalBtn:    { flexDirection: 'row', alignItems: 'center', backgroundColor: C.error, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16 },
  signalBtnTxt: { fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
});
