import { useEffect, useRef } from 'react';
import {
  Animated, View, Text, TouchableOpacity,
  StyleSheet, Platform, StatusBar,
} from 'react-native';

const TOP_OFFSET = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 24) + 6;

/**
 * Bannière animée qui s'affiche en haut de l'écran.
 * - Slide depuis le haut
 * - Auto-disparaît après 4 secondes
 * - Bouton ✕ pour fermer manuellement
 *
 * Props :
 *   notification  { id, message }  — null = pas de bannière
 *   onDismiss     () => void
 */
export function NotifBanner({ notification, onDismiss }) {
  const slideY   = useRef(new Animated.Value(-130)).current;
  const opacity  = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!notification) return;

    // Annule le timer précédent si une nouvelle notif arrive
    if (timerRef.current) clearTimeout(timerRef.current);

    // Reset
    slideY.setValue(-130);
    opacity.setValue(0);

    // Slide in
    Animated.parallel([
      Animated.spring(slideY, {
        toValue:   0,
        useNativeDriver: true,
        tension:   65,
        friction:  10,
      }),
      Animated.timing(opacity, {
        toValue:  1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss après 4 s
    timerRef.current = setTimeout(animateOut, 4000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.id]);

  const animateOut = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(slideY, { toValue: -130, duration: 280, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,    duration: 220, useNativeDriver: true }),
    ]).start(() => onDismiss?.());
  };

  if (!notification) return null;

  // Choisit l'emoji d'icône en fonction du contenu
  const emoji = notification.message?.startsWith('✅') ? '✅'
              : notification.message?.startsWith('❌') ? '❌'
              : notification.message?.startsWith('🚀') ? '🚀'
              : notification.message?.startsWith('📤') ? '📤'
              : notification.message?.startsWith('💬') ? '💬'
              : '🔔';

  return (
    <Animated.View
      style={[
        s.container,
        { top: TOP_OFFSET, transform: [{ translateY: slideY }], opacity },
      ]}
    >
      {/* Barre colorée gauche */}
      <View style={s.accent} />

      {/* Icône */}
      <View style={s.iconBox}>
        <Text style={{ fontSize: 22 }}>{emoji}</Text>
      </View>

      {/* Texte */}
      <Text style={s.message} numberOfLines={2}>
        {notification.message}
      </Text>

      {/* Fermer */}
      <TouchableOpacity
        onPress={animateOut}
        hitSlop={{ top: 14, right: 14, bottom: 14, left: 14 }}
        style={s.closeBtn}
      >
        <Text style={s.closeX}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position:   'absolute',
    left:        12,
    right:       12,
    zIndex:      9999,
    elevation:   20,
    flexDirection: 'row',
    alignItems:  'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingVertical: 12,
    paddingRight: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  accent: {
    width:  4,
    alignSelf: 'stretch',
    backgroundColor: '#F97316',
    marginRight: 10,
  },
  iconBox: {
    width:  36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  message: {
    flex:       1,
    fontSize:   13,
    fontWeight: '700',
    color:      '#FFFFFF',
    lineHeight: 19,
  },
  closeBtn: {
    marginLeft: 8,
    width:  28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: {
    fontSize:   14,
    color:      'rgba(255,255,255,0.7)',
    fontWeight: '700',
  },
});
