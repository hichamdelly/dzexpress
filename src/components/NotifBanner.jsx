import { useEffect, useRef } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { notifMeta } from '../lib/notifications';

const TOP_OFFSET = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 24) + 6;

export function NotifBanner({ notification, onDismiss, onPress }) {
  const slideY   = useRef(new Animated.Value(-120)).current;
  const opacity  = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!notification) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    slideY.setValue(-120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideY,  { toValue: 0, useNativeDriver: true, tension: 70, friction: 11 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(animateOut, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.id]);

  const animateOut = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(slideY,  { toValue: -120, duration: 260, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,    duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss?.());
  };

  const handlePress = () => {
    animateOut();
    onPress?.(notification);
  };

  if (!notification) return null;

  const meta = notifMeta(notification.type);

  return (
    <Animated.View style={[s.container, { top: TOP_OFFSET, transform: [{ translateY: slideY }], opacity }]}>
      <TouchableOpacity style={s.inner} onPress={handlePress} activeOpacity={0.9}>
        <View style={[s.iconWrap, { backgroundColor: meta.color + '28' }]}>
          <Ionicons name={meta.icon} size={18} color={meta.color} />
        </View>
        <View style={s.textBlock}>
          <Text style={s.title} numberOfLines={1}>{meta.label}</Text>
          <Text style={s.message} numberOfLines={2}>{notification.message}</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={animateOut}
        hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
        style={s.closeBtn}
      >
        <Ionicons name="close" size={15} color="#9CA3AF" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute', left: 14, right: 14, zIndex: 9999, elevation: 20,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: 14,
    paddingVertical: 10, paddingLeft: 10, paddingRight: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 16,
  },
  inner:     { flex: 1, flexDirection: 'row', alignItems: 'center' },
  iconWrap:  {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', marginRight: 12, flexShrink: 0,
  },
  textBlock: { flex: 1 },
  title:     { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)', marginBottom: 2, letterSpacing: 0.3 },
  message:   { fontSize: 13, fontWeight: '600', color: '#FFFFFF', lineHeight: 18 },
  closeBtn:  {
    width: 28, height: 28, borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8, flexShrink: 0,
  },
});
