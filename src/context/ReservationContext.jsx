import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';

// ── Valeurs initiales ────────────────────────────────────────
// Flow simplifié en 3 étapes (style Camio) : départ/arrivée → marchandise
// → choix du transporteur sur la carte. Plus de véhicule/options/planning
// explicites (voir CLAUDE.md, flow "Camio" — ancien flow 6 étapes supprimé).
const INITIAL_STATE = {
  // Étape 1 — Où aller ?
  departure: '',
  arrival:   '',
  // Étape 2 — Que voulez-vous expédier ?
  categories:      [],   // plusieurs types possibles : meubles, electromenager, materiaux, marchandises, fruits_legumes, autre
  description:     '',
  aideChargement:  0,    // nombre de personnes pour l'aide au chargement (0 à 5)
  vehicule:        null, // id de src/constants/vehicules.js (ex: 'fourgon', 'camion35_plateau')
};

// ── Context ──────────────────────────────────────────────────
const ReservationContext = createContext(null);

export function ReservationProvider({ children }) {
  const [data, setData]   = useState(INITIAL_STATE);
  const [step, setStep]   = useState(1);
  const totalSteps        = 3;

  const setField = useCallback((key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  // Met à jour plusieurs champs en un seul appel : update({ categories: [...], description: '...' })
  const update = useCallback((partial) => {
    setData(prev => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setData(INITIAL_STATE);
    setStep(1);
  }, []);

  const nextStep = useCallback(() =>
    setStep(s => Math.min(s + 1, totalSteps)), [totalSteps]);

  const prevStep = useCallback(() =>
    setStep(s => Math.max(s - 1, 1)), []);

  return (
    <ReservationContext.Provider value={{
      ...data,
      step, totalSteps,
      setField, update, reset, nextStep, prevStep, setStep,
    }}>
      {children}
    </ReservationContext.Provider>
  );
}

export function useReservation() {
  const ctx = useContext(ReservationContext);
  if (!ctx) throw new Error('useReservation must be used inside ReservationProvider');
  return ctx;
}

// ── ProgressBar ──────────────────────────────────────────────
// Barre segmentée façon "stories" (3 segments pour le flow en 3 étapes).
// Usage: <ProgressBar step={2} total={3} />  ou sans props → lit le context
export function ProgressBar({ step: stepProp, total: totalProp }) {
  let step, total;
  try {
    const ctx = useContext(ReservationContext);
    step  = stepProp  ?? ctx?.step        ?? 1;
    total = totalProp ?? ctx?.totalSteps  ?? 3;
  } catch {
    step  = stepProp  ?? 1;
    total = totalProp ?? 3;
  }

  return (
    <View style={pb.row}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[pb.track, i < total - 1 && { marginRight: 4 }]}>
          <View style={[pb.fill, { width: i < step ? '100%' : '0%' }]} />
        </View>
      ))}
    </View>
  );
}

const pb = StyleSheet.create({
  row: {
    flexDirection:    'row',
    paddingHorizontal: 16,
    paddingVertical:   10,
  },
  track: {
    flex:            1,
    height:          3,
    borderRadius:    2,
    backgroundColor: '#E5E7EB',
    overflow:        'hidden',
  },
  fill: {
    height:          3,
    backgroundColor: '#0A0A0A',
  },
});
