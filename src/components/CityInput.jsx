import React, { useState, useMemo, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, ScrollView, StyleSheet } from 'react-native';
import { searchCommunes } from '../constants/communes';

/**
 * Champ de saisie de ville avec auto-complétion.
 * Props :
 *   value        — valeur contrôlée (label "Commune — Wilaya" ou nom de wilaya)
 *   onChange     — callback(label) appelé à chaque sélection (alias de onSelect)
 *   onSelect     — idem (rétro-compat)
 *   placeholder  — texte placeholder
 *   accentColor  — couleur de la bordure active
 *   zIndex       — z-index du dropdown
 */
export default function CityInput({
  placeholder,
  value,
  onSelect,
  onChange,
  accentColor = '#1A56DB',
  zIndex = 999,
}) {
  const [query, setQuery]               = useState(value || '');
  const [showSuggestions, setShowSugg]  = useState(false);
  const [focused, setFocused]           = useState(false);

  // Sync depuis l'extérieur (ex : remplissage GPS)
  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
      setShowSugg(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];
    try { return searchCommunes(query); }
    catch { return []; }
  }, [query]);

  const notify = (label) => {
    (onSelect || onChange)?.(label);
  };

  const handleSelect = (item) => {
    const label = `${item.commune} — ${item.wilaya}`;
    setQuery(label);
    setShowSugg(false);
    notify(label);
  };

  return (
    <View style={[styles.container, { zIndex }]}>
      <TextInput
        style={[
          styles.input,
          focused && { borderColor: accentColor, borderWidth: 1.5 },
        ]}
        placeholder={placeholder || 'Recherche une ville…'}
        value={query}
        onChangeText={(text) => { setQuery(text); setShowSugg(true); notify(text); }}
        onFocus={() => { setFocused(true); setShowSugg(true); }}
        onBlur={() => { setFocused(false); setTimeout(() => setShowSugg(false), 200); }}
        placeholderTextColor="#9CA3AF"
      />
      {showSuggestions && suggestions.length > 0 && (
        <View style={[styles.suggestions, { zIndex: zIndex + 1 }]}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {suggestions.map((item, index) => (
              <TouchableOpacity
                key={`${item.commune}-${item.code}-${index}`}
                style={styles.suggItem}
                onPress={() => handleSelect(item)}
              >
                <Text style={styles.commune}>{item.commune}</Text>
                <Text style={styles.wilaya}>{item.wilaya} ({item.code})</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { position: 'relative' },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#111827',
  },
  suggestions: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxHeight: 220,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  commune: { fontSize: 14, fontWeight: '600', color: '#111827' },
  wilaya:  { fontSize: 12, color: '#6B7280', marginTop: 2 },
});