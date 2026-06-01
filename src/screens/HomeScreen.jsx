// src/screens/HomeScreen.jsx
// ============================================================
//  Écran Accueil — Rakib.dz
//  Barre de recherche + trajets populaires
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  TextInput, StyleSheet, Image, ActivityIndicator,
  Platform, StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { tripsAPI } from '../lib/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Couleurs de la charte Rakib.dz
const C = {
  green:      '#1B6E44',
  greenLight: '#E8F5EE',
  red:        '#D4373E',
  redLight:   '#FDECEA',
  gold:       '#C8922A',
  goldLight:  '#FDF3E3',
  bg:         '#F7F8FA',
  white:      '#FFFFFF',
  text:       '#1A1A2E',
  muted:      '#6B7280',
  border:     '#E5E7EB',
};

// Trajets populaires codés en dur (affichés avant les résultats API)
const POPULAR = [
  { from: 'Alger',      to: 'Oran',    price: 1200, duration: '6h 15' },
  { from: 'Alger',      to: 'Béjaïa',  price: 700,  duration: '2h 45' },
  { from: 'Constantine',to: 'Annaba',  price: 600,  duration: '2h 30' },
  { from: 'Tlemcen',    to: 'Alger',   price: 1500, duration: '7h 30' },
  { from: 'Oran',       to: 'Sétif',   price: 1100, duration: '5h 00' },
  { from: 'Alger',      to: 'Biskra',  price: 900,  duration: '4h 00' },
];

export default function HomeScreen() {
  const navigation = useNavigation();
  const [from, setFrom]       = useState('');
  const [to, setTo]           = useState('');
  const [date, setDate]       = useState(format(new Date(), 'yyyy-MM-dd'));
  const [seats, setSeats]     = useState(1);

  const today = format(new Date(), 'EEEE d MMMM', { locale: fr });

  const handleSearch = () => {
    if (!from.trim() || !to.trim()) return;
    navigation.navigate('Results', { from, to, date, seats });
  };

  const swapCities = () => {
    setFrom(to);
    setTo(from);
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.green} />

      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Rakib.dz 🚗</Text>
          <Text style={s.headerSub}>{today}</Text>
        </View>
        <TouchableOpacity
          style={s.profileBtn}
          onPress={() => navigation.navigate('Profile')}
        >
          <Ionicons name="person-circle-outline" size={32} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroTitle}>Voyagez ensemble 🇩🇿</Text>
          <Text style={s.heroSub}>Trouvez un trajet partout en Algérie</Text>
        </View>

        {/* Carte de recherche */}
        <View style={s.searchCard}>

          {/* Départ */}
          <View style={s.inputRow}>
            <View style={[s.inputIcon, { backgroundColor: C.greenLight }]}>
              <Ionicons name="location" size={18} color={C.green} />
            </View>
            <TextInput
              style={s.input}
              placeholder="Ville de départ"
              value={from}
              onChangeText={setFrom}
              placeholderTextColor={C.muted}
            />
          </View>

          {/* Swap */}
          <View style={s.swapRow}>
            <View style={s.dividerLine} />
            <TouchableOpacity style={s.swapBtn} onPress={swapCities}>
              <Ionicons name="swap-vertical" size={16} color={C.muted} />
            </TouchableOpacity>
            <View style={s.dividerLine} />
          </View>

          {/* Destination */}
          <View style={s.inputRow}>
            <View style={[s.inputIcon, { backgroundColor: C.redLight }]}>
              <Ionicons name="navigate" size={18} color={C.red} />
            </View>
            <TextInput
              style={s.input}
              placeholder="Destination"
              value={to}
              onChangeText={setTo}
              placeholderTextColor={C.muted}
            />
          </View>

          {/* Date & Places */}
          <View style={s.metaRow}>
            <TouchableOpacity style={s.metaInput}>
              <Ionicons name="calendar-outline" size={16} color={C.muted} />
              <Text style={s.metaText}>{format(new Date(date), 'dd/MM/yyyy')}</Text>
            </TouchableOpacity>
            <View style={s.seatsControl}>
              <TouchableOpacity
                onPress={() => setSeats(Math.max(1, seats - 1))}
                style={s.seatsBtn}
              >
                <Text style={s.seatsBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.seatsNum}>{seats} place{seats > 1 ? 's' : ''}</Text>
              <TouchableOpacity
                onPress={() => setSeats(Math.min(6, seats + 1))}
                style={s.seatsBtn}
              >
                <Text style={s.seatsBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Bouton Rechercher */}
          <TouchableOpacity style={s.searchBtn} onPress={handleSearch}>
            <Ionicons name="search" size={18} color="white" />
            <Text style={s.searchBtnText}>Rechercher un trajet</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { val: '48k+', label: 'Voyageurs' },
            { val: '12k+', label: 'Trajets/mois' },
            { val: '48',   label: 'Wilayas' },
          ].map((s2) => (
            <View key={s2.label} style={s.statCard}>
              <Text style={s.statVal}>{s2.val}</Text>
              <Text style={s.statLabel}>{s2.label}</Text>
            </View>
          ))}
        </View>

        {/* Trajets populaires */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Trajets populaires</Text>
          {POPULAR.map((trip, i) => (
            <TouchableOpacity
              key={i}
              style={s.popularCard}
              onPress={() => {
                setFrom(trip.from);
                setTo(trip.to);
              }}
            >
              <View style={s.popularRoute}>
                <Text style={s.popularCity}>{trip.from}</Text>
                <Ionicons name="arrow-forward" size={14} color={C.muted} />
                <Text style={s.popularCity}>{trip.to}</Text>
              </View>
              <View style={s.popularRight}>
                <Text style={s.popularPrice}>{trip.price.toLocaleString()} DA</Text>
                <Text style={s.popularDuration}>{trip.duration}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },

  header:         { backgroundColor: C.green, flexDirection: 'row',
                    alignItems: 'center', justifyContent: 'space-between',
                    paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 54 : 40,
                    paddingBottom: 16 },
  headerTitle:    { color: 'white', fontSize: 22, fontWeight: '700' },
  headerSub:      { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  profileBtn:     { padding: 4 },

  hero:           { backgroundColor: C.green, paddingHorizontal: 20,
                    paddingBottom: 28, alignItems: 'center' },
  heroTitle:      { color: 'white', fontSize: 24, fontWeight: '700', marginBottom: 6 },
  heroSub:        { color: 'rgba(255,255,255,0.75)', fontSize: 14 },

  searchCard:     { backgroundColor: C.white, borderRadius: 16,
                    marginHorizontal: 16, marginTop: -16, padding: 16,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 },

  inputRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  inputIcon:      { width: 36, height: 36, borderRadius: 18,
                    alignItems: 'center', justifyContent: 'center' },
  input:          { flex: 1, borderWidth: 1.5, borderColor: C.border,
                    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
                    fontSize: 14, color: C.text },

  swapRow:        { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  dividerLine:    { flex: 1, height: 1, backgroundColor: C.border },
  swapBtn:        { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5,
                    borderColor: C.border, backgroundColor: C.white,
                    alignItems: 'center', justifyContent: 'center' },

  metaRow:        { flexDirection: 'row', gap: 10, marginBottom: 14 },
  metaInput:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
                    borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
                    paddingHorizontal: 12, paddingVertical: 10 },
  metaText:       { fontSize: 13, color: C.text },
  seatsControl:   { flex: 1, flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'center', gap: 14,
                    borderWidth: 1.5, borderColor: C.border, borderRadius: 10 },
  seatsBtn:       { paddingHorizontal: 14, paddingVertical: 10 },
  seatsBtnText:   { fontSize: 20, color: C.text, fontWeight: '600' },
  seatsNum:       { fontSize: 14, color: C.text, fontWeight: '600' },

  searchBtn:      { backgroundColor: C.green, borderRadius: 12, paddingVertical: 14,
                    flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'center', gap: 8 },
  searchBtnText:  { color: 'white', fontSize: 15, fontWeight: '700' },

  statsRow:       { flexDirection: 'row', marginHorizontal: 16, marginTop: 16, gap: 10 },
  statCard:       { flex: 1, backgroundColor: C.white, borderRadius: 12,
                    padding: 14, alignItems: 'center',
                    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  statVal:        { fontSize: 20, fontWeight: '700', color: C.green },
  statLabel:      { fontSize: 11, color: C.muted, marginTop: 2 },

  section:        { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle:   { fontSize: 17, fontWeight: '700', color: C.text, marginBottom: 12 },

  popularCard:    { backgroundColor: C.white, borderRadius: 12, padding: 14,
                    flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 10,
                    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  popularRoute:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  popularCity:    { fontSize: 15, fontWeight: '600', color: C.text },
  popularRight:   { alignItems: 'flex-end' },
  popularPrice:   { fontSize: 15, fontWeight: '700', color: C.green },
  popularDuration:{ fontSize: 11, color: C.muted, marginTop: 2 },
});
