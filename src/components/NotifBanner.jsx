import { useEffect, useRef } from 'react';
import { Animated, View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TOP_OFFSET = Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight || 24) + 6;

function getIcon(message) {
  if (!message) return 'notifications';
  if (message.includes('annul')) return 'close-circle';
  if (message.includes('accept') || message.includes('Accepté')) return 'checkmark-circle';
  if (message.includes('livr')) return 'cube';
  if (message.includes('message') || message.includes('Message')) return 'chatbubble';
  if (message.includes('urgent') || message.includes('Urgent')) return 'flash';
  return 'notifications';
}

export function NotifBanner({ notification, onDismiss }) {
  const slideY  = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    if (!notification) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    slideY.setValue(-100);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 70, friction: 11 }),
      Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]).start();
    timerRef.current = setTimeout(animateOut, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification?.id]);

  const animateOut = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(slideY,  { toValue: -100, duration: 260, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0,    duration: 200, useNativeDriver: true }),
    ]).start(() => onDismiss?.());
  };

  if (!notification) return null;

  const iconName = getIcon(notification.message);
  // Strip leading emoji chars for clean display
  const cleanMsg = notification.message?.replace(/^[\u{1F000}-\u{1FFFF}\u{2600}-\u{27FF}✅❌🚀📤💬🔔⚠️]\s*/u, '') || '';

  return (
    <Animated.View style={[s.container, { top: TOP_OFFSET, transform: [{ translateY: slideY }], opacity }]}>
      <View style={s.iconWrap}>
        <Ionicons name={iconName} size={18} color="#F97316" />
      </View>
      <Text style={s.message} numberOfLines={2}>{cleanMsg || notification.message}</Text>
      <TouchableOpacity onPress={animateOut} hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }} style={s.closeBtn}>
        <Ionicons name="close" size={16} color="#9CA3AF" />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    position: 'absolute', left: 16, right: 16, zIndex: 9999, elevation: 20,
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(249,115,22,0.15)',
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  message: { flex: 1, fontSize: 13, fontWeight: '600', color: '#FFFFFF', lineHeight: 19 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 8,
  },
});
