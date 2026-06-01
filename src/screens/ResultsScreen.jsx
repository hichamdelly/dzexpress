// src/screens/ResultsScreen.jsx
// ============================================================
//  Écran Résultats — Liste des trajets disponibles
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { tripsAPI } from '../lib/supabase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const C = {
  green: '#1B6E44', greenLight: '#E8F5EE',
  gold: '#C8922A', goldLight: '#FDF3E3',
  red: '#D4373E', redLight: '#FDECEA',
  bg: '#F7F8FA', white: '#FFFFFF',
  text: '#1A1A2E', muted: '#6B7280', border: '#E5E7EB',
};

const FILTERS = [
  { key: 'all',        label: 'Tous' },
  { key: 'morning',    label: '☀️ Matin' },
  { key: 'cheap',      label: '💰 Pas cher' },
  { key: 'top_rated',  label: '⭐ Top noté' },
  { key: 'women',      label: '👩 Femmes' },
];

// Carte d'un trajet
function TripCard({ trip, onPress }) {
  const driver = trip.driver;
  const initials = driver?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

  const avatarColors = ['#E8F5EE', '#FDF3E3', '#FDECEA', '#EDE9FE', '#E6F1FB'];
  const textColors   = ['#1B6E44', '#C8922A', '#D4373E', '#533CAB', '#185FA5'];
  const colorIdx = driver?.full_name?.charCodeAt(0) % avatarColors.length || 0;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.85}>
      <View style={s.cardHeader}>
        <View style={s.driverInfo}>
          {driver?.avatar_url ? (
            <Image source={{ uri: driver.avatar_url }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, { backgroundColor: avatarColors[colorIdx] }]}>
              <Text style={[s.avatarText, { color: textColors[colorIdx] }]}>{initials}</Text>
            </View>
          )}
          <View>
            <Text style={s.driverName}>{driver?.full_name || 'Conducteur'}</Text>
            <Text style={s.driverRating}>
              ⭐ {driver?.rating?.toFixed(1) || '0.0'} · {driver?.total_reviews || 0} avis
            </Text>
          </View>
        </View>
        <View style={s.priceBlock}>
          <Text style={s.price}>{trip.price_per_seat?.toLocaleString()}</Text>
          <Text style={s.priceSub}>DA / pers.</Text>
        </View>
      </View>

      <View style={s.route}>
        <View>
          <Text style={s.city}>{trip.from_city}</Text>
          <Text style={s.time}>{trip.departure_time?.slice(0, 5)}</Text>
        </View>
        <View style={s.routeMid}>
          <View style={s.routeLine} />
          <Ionicons name="car-outline" size={16} color={C.muted} />
          <View style={s.routeLine} />
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={s.city}>{trip.to_city}</Text>
          <Text style={s.time}>
            {trip.estimated_duration
              ? `${Math.floor(trip.estimated_duration / 60)}h${String(trip.estimated_duration % 60).padStart(2, '0')}`
              : '--'}
          </Text>
        </View>
      </View>

      <View style={s.cardMeta}>
        <View style={s.metaItem}>
          <Ionicons name="people-outline" size={14} color={C.muted} />
          <Text style={s.metaText}>{trip.available_seats} place{trip.available_seats > 1 ? 's' : ''}</Text>
        </View>
        {trip.ac_available && (
          <View style={s.metaItem}>
            <Ionicons name="snow-outline" size={14} color={C.muted} />
            <Text style={s.metaText}>Clim</Text>
          </View>
        )}
        {driver?.is_verified && (
          <View style={[s.badge, { backgroundColor: C.greenLight }]}>
            <Text style={[s.badgeText, { color: C.green }]}>✓ Vérifié</Text>
          </View>
        )}
        {trip.women_only && (
          <View style={[s.badge, { backgroundColor: C.redLight }]}>
            <Text style={[s.badgeText, { color: C.red }]}>Femmes ✓</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function ResultsScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { from, to, date, seats } = params;

  const [trips, setTrips]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter]       = useState('all');
  const [error, setError]         = useState(null);

  const fetchTrips = useCallback(async () => {
    try {
      setError(null);
      const data = await tripsAPI.search({ from_city: from, to_city: to, date, seats });
      setTrips(data || []);
    } catch (e) {
      setError('Impossible de charger les trajets. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [from, to, date, seats]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  // Filtrage local
  const filtered = trips.filter(t => {
    if (filter === 'morning') return parseInt(t.departure_time) < 12;
    if (filter === 'cheap')   return t.price_per_seat < 1000;
    if (filter === 'top_rated') return (t.driver?.rating || 0) >= 4.5;
    if (filter === 'women')   return t.women_only;
    return true;
  });

  const dateFormatted = format(new Date(date), 'EEEE d MMMM', { locale: fr });

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="white" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerRoute}>{from} → {to}</Text>
          <Text style={s.headerSub}>{dateFormatted} · {seats} passager{seats > 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Filtres */}
      <View style={s.filtersContainer}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={f => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[s.filterChip, filter === item.key && s.filterChipActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[s.filterText, filter === item.key && s.filterTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Résultats */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.green} />
          <Text style={s.loadingText}>Recherche en cours…</Text>
        </View>
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="wifi-outline" size={48} color={C.muted} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity style={s.retryBtn} onPress={fetchTrips}>
            <Text style={s.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 48 }}>🚗</Text>
          <Text style={s.emptyTitle}>Aucun trajet trouvé</Text>
          <Text style={s.emptyText}>
            Pas de trajet {from} → {to} pour cette date.{'\n'}
            Essayez une autre date ou revenez plus tard.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={t => t.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 90 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchTrips(); }}
              tintColor={C.green}
            />
          }
          renderItem={({ item }) => (
            <TripCard
              trip={item}
              onPress={() => navigation.navigate('Booking', { trip: item })}
            />
          )}
          ListHeaderComponent={
            <Text style={s.resultsCount}>
              {filtered.length} trajet{filtered.length > 1 ? 's' : ''} disponible{filtered.length > 1 ? 's' : ''}
            </Text>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },
  center:          { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },

  header:          { backgroundColor: C.green, flexDirection: 'row', alignItems: 'center',
                     gap: 12, paddingHorizontal: 16,
                     paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 14 },
  backBtn:         { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)',
                     alignItems: 'center', justifyContent: 'center' },
  headerRoute:     { color: 'white', fontSize: 16, fontWeight: '700' },
  headerSub:       { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },

  filtersContainer:{ paddingVertical: 12 },
  filterChip:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
                     borderWidth: 1.5, borderColor: C.border, backgroundColor: C.white },
  filterChipActive:{ backgroundColor: C.green, borderColor: C.green },
  filterText:      { fontSize: 12, fontWeight: '500', color: C.text },
  filterTextActive:{ color: 'white' },

  resultsCount:    { fontSize: 13, color: C.muted, marginBottom: 4 },

  card:            { backgroundColor: C.white, borderRadius: 14, padding: 16,
                     shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
                     shadowOpacity: 0.07, shadowRadius: 8, elevation: 3 },
  cardHeader:      { flexDirection: 'row', justifyContent: 'space-between',
                     alignItems: 'center', marginBottom: 12 },
  driverInfo:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:          { width: 44, height: 44, borderRadius: 22,
                     alignItems: 'center', justifyContent: 'center' },
  avatarText:      { fontSize: 16, fontWeight: '700' },
  driverName:      { fontSize: 14, fontWeight: '600', color: C.text },
  driverRating:    { fontSize: 12, color: C.gold, marginTop: 1 },
  priceBlock:      { alignItems: 'flex-end' },
  price:           { fontSize: 20, fontWeight: '700', color: C.green },
  priceSub:        { fontSize: 11, color: C.muted },

  route:           { flexDirection: 'row', alignItems: 'center',
                     justifyContent: 'space-between', marginBottom: 10 },
  city:            { fontSize: 15, fontWeight: '700', color: C.text },
  time:            { fontSize: 12, color: C.muted, marginTop: 2 },
  routeMid:        { flex: 1, flexDirection: 'row', alignItems: 'center',
                     justifyContent: 'center', gap: 4, paddingHorizontal: 8 },
  routeLine:       { flex: 1, height: 1, backgroundColor: C.border },

  cardMeta:        { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  metaItem:        { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:        { fontSize: 12, color: C.muted },
  badge:           { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText:       { fontSize: 11, fontWeight: '600' },

  loadingText:     { fontSize: 14, color: C.muted, marginTop: 8 },
  errorText:       { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 22 },
  retryBtn:        { backgroundColor: C.green, paddingHorizontal: 24, paddingVertical: 10,
                     borderRadius: 10, marginTop: 8 },
  retryText:       { color: 'white', fontWeight: '600' },
  emptyTitle:      { fontSize: 18, fontWeight: '700', color: C.text },
  emptyText:       { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 22 },
});
