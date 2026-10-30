// Palette partagée — migration progressive : seul app/(tabs)/index.jsx l'importe
// pour l'instant, les autres écrans gardent leur constante C locale.
export const C = {
  primary: '#0A0A0A', accent: '#0F4D2E', accentLight: '#E8F2EC',
  gold: '#D4A017',
  bg: '#FFFFFF', bgAlt: '#F5F5F5', text: '#0A0A0A',
  muted: '#6B7280', border: '#E5E7EB',
  success: '#10B981', successLight: '#ECFDF5',
  error: '#EF4444', errorLight: '#FEF2F2',
  warning: '#F59E0B', warningLight: '#FFFBEB',
};
