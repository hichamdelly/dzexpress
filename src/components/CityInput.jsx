import React, { useState, useMemo, useEffect } from 'react';
import { View, TextInput, TouchableOpacity, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { searchCommunes } from '../constants/communes';

/**
 * Champ de saisie de ville avec auto-complétion.
 * Props : value, onChange, onSelect, placeholder, accentColor, zIndex
 */
export default function CityInput({ placeholder, value, onSelect, onChange, accentColor = '#F97316', zIndex = 999 }) {
  const [query, setQuery]             = useState(value || '');
  const [showSuggestions, setShowSugg] = useState(false);
  const [focused, setFocused]         = useState(false);

  useEffect(() => {
    if (value !== undefined && value !== query) {
      setQuery(value);
      setShowSugg(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];
    try { return searchCommunes(query); } catch { return []; }
  }, [query]);

  const notify = (label) => (onSelect || onChange)?.(label);

  const handleSelect = (item) => {
    const label = `${item.commune} — ${item.wilaya}`;
    setQuery(label);
    setShowSugg(false);
    notify(label);
  };

  return (
    <View style={[s.container, { zIndex }]}>
      <View style={[s.inputWrap, focused && { borderColor: accentColor }]}>
        <Ionicons name="location-outline" size={16} color={focused ? accentColor : '#9CA3AF'} style={s.inputIcon} />
        <TextInput
          style={s.input}
          placeholder={placeholder || 'Recherche une ville…'}
          value={query}
          onChangeText={(text) => { setQuery(text); setShowSugg(true); notify(text); }}
          onFocus={() => { setFocused(true); setShowSugg(true); }}
          onBlur={() => { setFocused(false); setTimeout(() => setShowSugg(false), 200); }}
          placeholderTextColor="#9CA3AF"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); notify(''); setShowSugg(false); }} style={s.clearBtn}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>
      {showSuggestions && suggestions.length > 0 && (
        <View style={[s.suggestions, { zIndex: zIndex + 1 }]}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {suggestions.map((item, index) => (
              <TouchableOpacity
                key={`${item.commune}-${item.code}-${index}`}
                style={[s.suggItem, index === suggestions.length - 1 && { borderBottomWidth: 0 }]}
                onPress={() => handleSelect(item)}
              >
                <Ionicons name="location-outline" size={14} color="#9CA3AF" style={{ marginRight: 8, marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={s.commune}>{item.commune}</Text>
                  <Text style={s.wilaya}>{item.wilaya} ({item.code})</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { position: 'relative', marginBottom: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderWidth: 1.5, borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 13,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: '#0A0A0A', padding: 0 },
  clearBtn: { padding: 2 },
  suggestions: {
    position: 'absolute', top: 50, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderRadius: 8,
    borderWidth: 1, borderColor: '#E5E7EB',
    maxHeight: 220, elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8,
  },
  suggItem: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F5F5F5',
  },
  commune: { fontSize: 14, fontWeight: '600', color: '#0A0A0A' },
  wilaya:  { fontSize: 12, color: '#6B7280', marginTop: 1 },
});
