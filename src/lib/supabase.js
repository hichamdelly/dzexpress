// src/lib/supabase.js
// ============================================================
//  Configuration Supabase — Rakib.dz
//  Remplacez VOTRE_URL et VOTRE_ANON_KEY par vos vraies clés
//  (disponibles dans votre projet Supabase > Settings > API)
// ============================================================

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const SUPABASE_URL = 'https://dyerxzkipqtxkyysfeaa.supabase.co';  // ← remplacer
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR5ZXJ4emtpcHF0eGt5eXNmZWFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzMDk4MTIsImV4cCI6MjA5Mzg4NTgxMn0.yC_omxCln6AY1IIIjZJRlmfkAbj9ZYiIBytLblqsemM';               // ← remplacer

// Stockage sécurisé des tokens d'authentification sur le téléphone
const ExpoSecureStoreAdapter = {
  getItem: (key) => SecureStore.getItemAsync(key),
  setItem: (key, value) => SecureStore.setItemAsync(key, value),
  removeItem: (key) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ============================================================
//  API TRIPS — Fonctions pour les trajets
// ============================================================

export const tripsAPI = {

  // Rechercher des trajets
  search: async ({ from_city, to_city, date, seats = 1 }) => {
    const { data, error } = await supabase
      .from('trips')
      .select(`
        *,
        driver:users!driver_id (
          id, full_name, avatar_url, rating, total_reviews, is_verified
        ),
        vehicle:vehicles!vehicle_id (
          brand, model, color, type
        )
      `)
      .eq('from_city', from_city)
      .eq('to_city', to_city)
      .eq('departure_date', date)
      .eq('status', 'active')
      .gte('available_seats', seats)
      .order('departure_time', { ascending: true });

    if (error) throw error;
    return data;
  },

  // Récupérer un trajet par ID
  getById: async (id) => {
    const { data, error } = await supabase
      .from('trips')
      .select(`
        *,
        driver:users!driver_id (*),
        vehicle:vehicles!vehicle_id (*),
        bookings (
          id, status, seats_booked,
          passenger:users!passenger_id (id, full_name, avatar_url, rating)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Créer un trajet (conducteur)
  create: async (tripData) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('trips')
      .insert({ ...tripData, driver_id: user.id })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Mes trajets (comme conducteur)
  myTripsAsDriver: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('trips')
      .select(`*, bookings(count)`)
      .eq('driver_id', user.id)
      .order('departure_date', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Villes disponibles (pour l'autocomplete)
  getCities: () => [
    'Adrar', 'Aïn Defla', 'Aïn Témouchent', 'Alger', 'Annaba',
    'Batna', 'Béchar', 'Béjaïa', 'Biskra', 'Blida',
    'Bordj Bou Arréridj', 'Bouira', 'Boumerdès',
    'Chlef', 'Constantine',
    'Djelfa',
    'El Bayadh', 'El Oued', 'El Tarf',
    'Ghardaïa', 'Guelma',
    'Illizi',
    'Jijel',
    'Khenchela',
    'Laghouat',
    'Mascara', 'Médéa', 'Mila', 'Mostaganem', 'Msila',
    'Naâma',
    'Oran', 'Ouargla', 'Oum El Bouaghi',
    'Relizane',
    'Saïda', 'Sétif', 'Sidi Bel Abbès', 'Skikda', 'Souk Ahras',
    'Tamanrasset', 'Tébessa', 'Tiaret', 'Tindouf', 'Tipaza',
    'Tissemsilt', 'Tizi Ouzou', 'Tlemcen',
  ],
};

// ============================================================
//  API BOOKINGS — Fonctions pour les réservations
// ============================================================

export const bookingsAPI = {

  // Réserver un trajet
  create: async ({ trip_id, seats_booked, payment_method, note }) => {
    const { data: { user } } = await supabase.auth.getUser();

    // Récupérer le prix
    const { data: trip } = await supabase
      .from('trips')
      .select('price_per_seat')
      .eq('id', trip_id)
      .single();

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        trip_id,
        passenger_id: user.id,
        seats_booked,
        total_price: trip.price_per_seat * seats_booked,
        payment_method,
        note,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Mes réservations (comme passager)
  myBookings: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        trip:trips (
          *,
          driver:users!driver_id (full_name, avatar_url, rating, phone)
        )
      `)
      .eq('passenger_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Confirmer/annuler une réservation (conducteur)
  updateStatus: async (bookingId, status) => {
    const { data, error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};

// ============================================================
//  API AUTH — Authentification par numéro algérien
// ============================================================

export const authAPI = {

  // Envoyer OTP SMS
  sendOTP: async (phone) => {
    // Formater le numéro : 0770123456 → +213770123456
    const formatted = phone.startsWith('0')
      ? '+213' + phone.slice(1)
      : phone;

    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    if (error) throw error;
    return formatted;
  },

  // Vérifier le code OTP
  verifyOTP: async (phone, token) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    if (error) throw error;
    return data;
  },

  // Créer/mettre à jour le profil après connexion
  upsertProfile: async (profileData) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('users')
      .upsert({ id: user.id, phone: user.phone, ...profileData })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Récupérer le profil connecté
  getProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error) throw error;
    return data;
  },

  // Déconnexion
  signOut: () => supabase.auth.signOut(),
};

// ============================================================
//  API MESSAGES — Messagerie temps réel
// ============================================================

export const messagesAPI = {

  // Envoyer un message
  send: async (bookingId, receiverId, content) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from('messages')
      .insert({
        booking_id: bookingId,
        sender_id: user.id,
        receiver_id: receiverId,
        content,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Écouter les nouveaux messages en temps réel
  subscribe: (bookingId, callback) => {
    return supabase
      .channel(`messages:${bookingId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `booking_id=eq.${bookingId}`,
      }, callback)
      .subscribe();
  },

  // Charger les messages d'une réservation
  getByBooking: async (bookingId) => {
    const { data, error } = await supabase
      .from('messages')
      .select(`*, sender:users!sender_id(full_name, avatar_url)`)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },
};
