import React, { useState, useMemo, useEffect } from 'react';
import {
  View, TextInput, TouchableOpacity, Text, Modal, FlatList,
  StyleSheet, SafeAreaView, Platform, StatusBar, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { searchCommunes } from '../constants/communes';
import { nearestWilaya } from '../utils/wilayas';
import { trouverCommuneExacte } from '../lib/geocoding';
import { registerPicker } from '../lib/locationPicker';

/**
 * Champ de saisie de ville avec auto-complétion.
 * La sélection se fait dans un Modal plein écran (pas de liste en
 * position absolue) : ça évite tout conflit de scroll imbriqué quand
 * CityInput est utilisé dans un écran qui a déjà son propre ScrollView.
 *
 * Props : value, onChange, onSelect, placeholder, accentColor
 */
export default function CityInput({ placeholder, value, onSelect, onChange, accentColor = '#0F4D2E' }) {
  const router = useRouter();
  const [query,        setQuery]        = useState(value || '');
  const [modalVisible, setModalVisible] = useState(false);
  const [search,       setSearch]       = useState('');
  const [loadingGPS,   setLoadingGPS]   = useState(false);

  useEffect(() => {
    if (value !== undefined && value !== query) setQuery(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const suggestions = useMemo(() => {
    if (!search || search.length < 2) return [];
    try { return searchCommunes(search); } catch { return []; }
  }, [search]);

  const notify = (label) => (onSelect || onChange)?.(label);

  const openModal = () => {
    setSearch('');
    setModalVisible(true);
  };

  const closeModal = () => setModalVisible(false);

  const handleSelect = (item) => {
    const label = `${item.commune} — ${item.wilaya}`;
    setQuery(label);
    setModalVisible(false);
    setSearch('');
    notify(label);
  };

  const handleClear = () => {
    setQuery('');
    notify('');
  };

  // Détection GPS → commune exacte via géocodage inverse (OpenCage), avec
  // repli automatique sur la wilaya la plus proche (100% hors-ligne) si
  // la clé est absente ou la requête réseau échoue.
  const detecterPosition = async () => {
    try {
      setLoadingGPS(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Active la géolocalisation pour utiliser cette fonctionnalité.');
        return;
      }
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;

      const label = await trouverCommuneExacte(latitude, longitude)
        || nearestWilaya(latitude, longitude);

      if (!label) {
        Alert.alert('Position introuvable', 'Saisis ta ville manuellement.');
        return;
      }
      setQuery(label);
      setModalVisible(false);
      notify(label);
    } catch {
      Alert.alert('Erreur', 'Impossible de récupérer ta position. Vérifie que le GPS est activé.');
    } finally {
      setLoadingGPS(false);
    }
  };

  // Ouvre le sélecteur plein écran (carte + pin central, style Uber).
  // Le résultat revient via le registre locationPicker (voir sa doc) car
  // expo-router ne transporte pas de fonctions dans ses params de route.
  const handleChooseOnMap = () => {
    const pickId = registerPicker((label) => {
      if (label) {
        setQuery(label);
        notify(label);
      }
    });
    setModalVisible(false);
    router.push({ pathname: '/select-location', params: { pickId, accentColor } });
  };

  return (
    <View style={s.container}>
      <TouchableOpacity style={s.inputWrap} onPress={openModal} activeOpacity={0.75}>
        <Ionicons name="location-outline" size={16} color={query ? accentColor : '#9CA3AF'} style={s.inputIcon} />
        <Text style={[s.inputText, !query && s.inputPlaceholder]} numberOfLines={1}>
          {query || placeholder || 'Recherche une ville…'}
        </Text>
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={s.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={detecterPosition}
          disabled={loadingGPS}
          style={s.gpsBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Utiliser ma position"
        >
          {loadingGPS
            ? <ActivityIndicator size="small" color={accentColor} />
            : <Ionicons name="navigate" size={16} color={accentColor} />
          }
        </TouchableOpacity>
      </TouchableOpacity>

      {loadingGPS && (
        <Text style={s.gpsHint}>📍 Recherche de votre position exacte…</Text>
      )}

      <Modal visible={modalVisible} animationType="slide" onRequestClose={closeModal}>
        <SafeAreaView style={s.modal}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={closeModal} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color="#0A0A0A" />
            </TouchableOpacity>
            <Text style={s.modalTitle}>Choisir une ville</Text>
            <View style={{ width: 34 }} />
          </View>

          <View style={s.searchWrap}>
            <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Commune ou wilaya…"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={s.mapPickerBtn} onPress={handleChooseOnMap} activeOpacity={0.8}>
            <View style={[s.mapPickerIcon, { backgroundColor: `${accentColor}1A` }]}>
              <Ionicons name="map-outline" size={16} color={accentColor} />
            </View>
            <Text style={[s.mapPickerTxt, { color: accentColor }]}>Choisir sur la carte</Text>
            <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
          </TouchableOpacity>

          <FlatList
            data={suggestions}
            keyExtractor={(item, index) => `${item.commune}-${item.code}-${index}`}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            contentContainerStyle={suggestions.length === 0 && { flex: 1 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.item} onPress={() => handleSelect(item)} activeOpacity={0.7}>
                <View style={s.itemIcon}>
                  <Ionicons name="location-outline" size={16} color={accentColor} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemCommune}>{item.commune}</Text>
                  <Text style={s.itemWilaya}>{item.wilaya} ({item.code})</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={s.empty}>
                <Ionicons name="location-outline" size={28} color="#D1D5DB" style={{ marginBottom: 10 }} />
                <Text style={s.emptyText}>
                  {search.length < 2
                    ? 'Tape au moins 2 lettres pour rechercher'
                    : `Aucune ville trouvée pour "${search}"`}
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { marginBottom: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 13,
  },
  inputIcon: { marginRight: 8 },
  inputText: { flex: 1, fontSize: 14, color: '#0A0A0A' },
  inputPlaceholder: { color: '#9CA3AF' },
  clearBtn: { padding: 2, marginLeft: 6 },
  gpsBtn:   { padding: 4, marginLeft: 8 },
  gpsHint:  { fontSize: 12, color: '#6B7280', marginTop: 6, marginLeft: 2 },

  modal: { flex: 1, backgroundColor: '#FFFFFF' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 12) : 4,
    paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F5F5' },
  modalTitle: { fontSize: 16, fontWeight: '800', color: '#0A0A0A' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 14, marginBottom: 6,
    backgroundColor: '#F5F5F5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#0A0A0A', padding: 0 },

  mapPickerBtn: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10,
    paddingVertical: 10, paddingHorizontal: 4,
    gap: 10,
  },
  mapPickerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mapPickerTxt:  { flex: 1, fontSize: 14, fontWeight: '700' },

  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  itemIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E8F2EC',
    alignItems: 'center', justifyContent: 'center',
  },
  itemCommune: { fontSize: 15, fontWeight: '600', color: '#0A0A0A' },
  itemWilaya:  { fontSize: 12, color: '#6B7280', marginTop: 2 },

  empty: { flex: 1, padding: 40, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
});
