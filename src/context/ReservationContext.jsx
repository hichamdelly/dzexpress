import React, { createContext, useContext, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';

// ── Valeurs initiales ────────────────────────────────────────
const INITIAL_STATE = {
  // Localisation
  departure:     '',
  arrival:       '',
  // Marchandise
  category:      '',      // key TYPES_MARCHANDISE
  sousCategorie: '',      // key SOUS_CATEGORIES
  vehicule:      '',      // key TARIFS_BASE (veh recommandé ou choisi)
  // Quantité / description
  quantite:      '',      // poids texte libre
  description:   '',
  // Options supplémentaires
  options: {
    etages:  0,
    aide:    false,
    fragile: false,
    express: false,
  },
  // Planning
  mode:  'instantane',    // 'instantane' | 'planifie'
  date:  null,            // Date object
  heure: null,            // Date object
};

// ── Context ──────────────────────────────────────────────────
const ReservationContext = createContext(null);

export function ReservationProvider({ children }) {
  const [data, setData]   = useState(INITIAL_STATE);
  const [step, setStep]   = useState(1);
  const totalSteps        = 4;

  const setField = useCallback((key, value) => {
    setData(prev => ({ ...prev, [key]: value }));
  }, []);

  const setOption = useCallback((key, value) => {
    setData(prev => ({
      ...prev,
      options: { ...prev.options, [key]: value },
    }));
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
      setField, setOption, reset, nextStep, prevStep, setStep,
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
// Usage: <ProgressBar step={2} total={4} />  ou sans props → lit le context
export function ProgressBar({ step: stepProp, total: totalProp }) {
  let step, total;
  try {
    const ctx = useContext(ReservationContext);
    step  = stepProp  ?? ctx?.step        ?? 1;
    total = totalProp ?? ctx?.totalSteps  ?? 4;
  } catch {
    step  = stepProp  ?? 1;
    total = totalProp ?? 4;
  }

  const pct = Math.min(Math.max(step / total, 0), 1);

  return (
    <View style={pb.track}>
      <View style={[pb.fill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

const pb = StyleSheet.create({
  track: {
    height:          3,
    backgroundColor: '#E5E7EB',
    width:           '100%',
    overflow:        'hidden',
  },
  fill: {
    height:          3,
    backgroundColor: '#0A0A0A',
  },
});
