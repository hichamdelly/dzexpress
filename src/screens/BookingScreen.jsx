// src/screens/BookingScreen.jsx
// ============================================================
//  Écran Réservation — Confirmer et payer
// ============================================================

import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { bookingsAPI } from '../lib/supabase';

const C = {
  green: '#1B6E44', greenLight: '#E8F5EE',
  red: '#D4373E', gold: '#C8922A', goldLight: '#FDF3E3',
  bg: '#F7F8FA', white: '#FFFFFF',
  text: '#1A1A2E', muted: '#6B7280', border: '#E5E7EB',
};

const PAYMENT_METHODS = [
  { key: 'cash',      label: 'Espèces',          sub: 'Remis au conducteur',     icon: '💵' },
  { key: 'baridimob', label: 'BaridiMob / CCP',   sub: 'Virement instantané',     icon: '📱' },
  { key: 'edahabia',  label: 'Carte Edahabia',    sub: 'Paiement sécurisé',       icon: '💳' },
];

export default function BookingScreen() {
  const navigation = useNavigation();
  const { params } = useRoute();
  const { trip } = params;

  const [seats, setSeats]     = useState(1);
  const [payment, setPayment] = useState('cash');
  const [note, setNote]       = useState('');
  const [loading, setLoading] = useState(false);

  const driver = trip.driver;
  const total = trip.price_per_seat * seats;

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await bookingsAPI.create({
        trip_id: trip.id,
        seats_booked: seats,
        payment_method: payment,
        note: note.trim() || null,
      });

      Alert.alert(
        '✅ Réservation confirmée !',
        `Votre trajet ${trip.from_city} → ${trip.to_city} est réservé.\nLe conducteur va vous contacter.`,
        [{ text: 'Super !', onPress: () => navigation.navigate('Main') }]
      );
    } catch (e) {
      Alert.alert(
        'Erreur',
        e.message === 'duplicate key value violates unique constraint "bookings_trip_id_passenger_id_key"'
          ? 'Vous avez déjà réservé ce trajet.'
          : 'Impossible de réserver. Réessayez.',
      );
    } finally {
      setLoading(false);
    }
  };

  const initials = driver?.full_name
    ?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';

  return (
    <View style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={20} color="white" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>{trip.from_city} → {trip.to_city}</Text>
          <Text style={s.headerSub}>Réserver ce trajet</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Conducteur */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>CONDUCTEUR</Text>
          <View style={s.driverCard}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initials}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.driverName}>{driver?.full_name}</Text>
              <Text style={s.driverRating}>⭐ {driver?.rating?.toFixed(1)} · {driver?.total_reviews} avis</Text>
              <View style={s.badges}>
                {driver?.is_verified && (
                  <View style={[s.badge, { backgroundColor: C.greenLight }]}>
                    <Text style={[s.badgeText, { color: C.green }]}>✓ Vérifié</Text>
                  </View>
                )}
                <View style={[s.badge, { backgroundColor: C.goldLight }]}>
                  <Text style={[s.badgeText, { color: C.gold }]}>Ponctuel</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Itinéraire */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>ITINÉRAIRE</Text>
          <View style={s.timeline}>
            <View style={s.timelineStop}>
              <View style={[s.dot, { backgroundColor: C.green }]} />
              <Text style={s.stopTime}>{trip.departure_time?.slice(0, 5)}</Text>
              <View>
                <Text style={s.stopCity}>{trip.from_city}</Text>
                <Text style={s.stopSub}>Point de départ convenu</Text>
              </View>
            </View>
            <View style={s.timelineBar}>
              <View style={s.timelineVLine} />
              <Text style={s.timelineLabel}>
                {trip.estimated_duration
                  ? `${Math.floor(trip.estimated_duration / 60)}h${String(trip.estimated_duration % 60).padStart(2, '0')} de trajet`
                  : 'Durée estimée'}
              </Text>
            </View>
            <View style={s.timelineStop}>
              <View style={[s.dot, { backgroundColor: C.red }]} />
              <Text style={s.stopTime}>Arrivée</Text>
              <View>
                <Text style={s.stopCity}>{trip.to_city}</Text>
                <Text style={s.stopSub}>Point d'arrivée convenu</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Nombre de places */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>NOMBRE DE PLACES</Text>
          <View style={s.seatsRow}>
            <View>
              <Text style={s.seatsLabel}>Adultes</Text>
              <Text style={s.seatsSub}>Max {trip.available_seats} disponible{trip.available_seats > 1 ? 's' : ''}</Text>
            </View>
            <View style={s.qtyControl}>
              <TouchableOpacity
                style={s.qtyBtn}
                onPress={() => setSeats(Math.max(1, seats - 1))}
              >
                <Text style={s.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={s.qtyNum}>{seats}</Text>
              <TouchableOpacity
                style={s.qtyBtn}
                onPress={() => setSeats(Math.min(trip.available_seats, seats + 1))}
              >
                <Text style={s.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={s.totalBox}>
            <Text style={s.totalLabel}>Total estimé</Text>
            <Text style={s.totalAmount}>{total.toLocaleString()} DA</Text>
          </View>
        </View>

        {/* Mode de paiement */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>MODE DE PAIEMENT</Text>
          {PAYMENT_METHODS.map(m => (
            <TouchableOpacity
              key={m.key}
              style={[s.paymentOpt, payment === m.key && s.paymentOptActive]}
              onPress={() => setPayment(m.key)}
            >
              <Text style={{ fontSize: 24 }}>{m.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.paymentLabel}>{m.label}</Text>
                <Text style={s.paymentSub}>{m.sub}</Text>
              </View>
              {payment === m.key && (
                <Ionicons name="checkmark-circle" size={22} color={C.green} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Message au conducteur */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>MESSAGE (optionnel)</Text>
          <TextInput
            style={s.noteInput}
            placeholder="Ex: Je suis près de la place principale…"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
            placeholderTextColor={C.muted}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bouton de confirmation */}
      <View style={s.footer}>
        <View style={s.footerInfo}>
          <Text style={s.footerTotal}>{total.toLocaleString()} DA</Text>
          <Text style={s.footerSeats}>{seats} place{seats > 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity
          style={[s.confirmBtn, loading && { opacity: 0.7 }]}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="white" />
              <Text style={s.confirmText}>Confirmer</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: C.bg },

  header:         { backgroundColor: C.green, flexDirection: 'row', alignItems: 'center',
                    gap: 12, paddingHorizontal: 16,
                    paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 14 },
  backBtn:        { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.2)',
                    alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { color: 'white', fontSize: 16, fontWeight: '700' },
  headerSub:      { color: 'rgba(255,255,255,0.7)', fontSize: 12 },

  section:        { backgroundColor: C.white, borderRadius: 14, marginHorizontal: 16,
                    marginTop: 12, padding: 16 },
  sectionLabel:   { fontSize: 11, fontWeight: '700', color: C.muted,
                    letterSpacing: 0.5, marginBottom: 12 },

  driverCard:     { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar:         { width: 52, height: 52, borderRadius: 26,
                    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center' },
  avatarText:     { fontSize: 20, fontWeight: '700', color: C.green },
  driverName:     { fontSize: 16, fontWeight: '700', color: C.text },
  driverRating:   { fontSize: 13, color: C.gold, marginTop: 2 },
  badges:         { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge:          { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  badgeText:      { fontSize: 11, fontWeight: '600' },

  timeline:       { paddingLeft: 20 },
  timelineStop:   { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  dot:            { width: 14, height: 14, borderRadius: 7, position: 'absolute', left: -20,
                    borderWidth: 2.5, borderColor: C.white },
  stopTime:       { fontSize: 14, fontWeight: '600', color: C.text, minWidth: 52 },
  stopCity:       { fontSize: 15, fontWeight: '700', color: C.text },
  stopSub:        { fontSize: 12, color: C.muted, marginTop: 1 },
  timelineBar:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingLeft: 0 },
  timelineVLine:  { width: 2, height: 20, backgroundColor: C.border,
                    position: 'absolute', left: -14 },
  timelineLabel:  { fontSize: 12, color: C.muted, marginLeft: 8 },

  seatsRow:       { flexDirection: 'row', alignItems: 'center',
                    justifyContent: 'space-between', marginBottom: 12 },
  seatsLabel:     { fontSize: 14, fontWeight: '600', color: C.text },
  seatsSub:       { fontSize: 12, color: C.muted, marginTop: 2 },
  qtyControl:     { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn:         { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5,
                    borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText:     { fontSize: 20, fontWeight: '600', color: C.text },
  qtyNum:         { fontSize: 20, fontWeight: '700', color: C.text },
  totalBox:       { backgroundColor: C.greenLight, borderRadius: 10, padding: 12,
                    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:     { fontSize: 14, fontWeight: '600', color: C.green },
  totalAmount:    { fontSize: 18, fontWeight: '700', color: C.green },

  paymentOpt:     { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12,
                    borderRadius: 10, borderWidth: 1.5, borderColor: C.border, marginBottom: 10 },
  paymentOptActive:{ borderColor: C.green, backgroundColor: C.greenLight },
  paymentLabel:   { fontSize: 14, fontWeight: '600', color: C.text },
  paymentSub:     { fontSize: 12, color: C.muted, marginTop: 1 },

  noteInput:      { borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
                    padding: 12, fontSize: 14, color: C.text,
                    textAlignVertical: 'top', minHeight: 80 },

  footer:         { position: 'absolute', bottom: 0, left: 0, right: 0,
                    backgroundColor: C.white, flexDirection: 'row', alignItems: 'center',
                    paddingHorizontal: 16, paddingVertical: 12,
                    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
                    borderTopWidth: 1, borderTopColor: C.border,
                    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
  footerInfo:     { flex: 1 },
  footerTotal:    { fontSize: 20, fontWeight: '700', color: C.green },
  footerSeats:    { fontSize: 12, color: C.muted },
  confirmBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: C.green, borderRadius: 12,
                    paddingHorizontal: 24, paddingVertical: 14 },
  confirmText:    { color: 'white', fontSize: 16, fontWeight: '700' },
});
