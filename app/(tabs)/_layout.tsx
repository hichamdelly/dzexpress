import { View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/context/AppContext';
import { useNotifications } from '../../src/hooks/useNotifications';
import { useMessagesBadge } from '../../src/hooks/useMessagesBadge';
import { NotifBanner } from '../../src/components/NotifBanner';

export default function TabLayout() {
  const { user }                          = useApp();
  const router                            = useRouter();
  const isT                               = user?.type === 'transporteur';
  const { unread, banner, dismissBanner } = useNotifications(user?.id);
  const msgUnread                         = useMessagesBadge(user?.id);

  const handleBannerPress = (notif: any) => {
    dismissBanner();
    try {
      const data = notif?.data_json ? JSON.parse(notif.data_json) : {};
      if (data.route) router.push(data.route as any);
      else router.push('/notifications' as any);
    } catch {
      router.push('/notifications' as any);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <NotifBanner notification={banner} onDismiss={dismissBanner} onPress={handleBannerPress} />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor:   '#0A0A0A',
          tabBarInactiveTintColor: '#9CA3AF',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor:  '#F3F4F6',
            borderTopWidth:  1,
            height:          60,
            paddingBottom:   8,
            paddingTop:      6,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: isT ? 'Disponibles' : 'Accueil',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={isT ? 'search' : (focused ? 'home' : 'home-outline')} size={22} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="suivi"
          options={{
            title: isT ? 'Mes courses' : 'Mes demandes',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={isT ? (focused ? 'car-sport' : 'car-sport-outline') : (focused ? 'list' : 'list-outline')} size={22} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'chatbubble-ellipses' : 'chatbubble-ellipses-outline'} size={22} color={color} />
            ),
            tabBarBadge: msgUnread > 0 ? (msgUnread > 9 ? '9+' : msgUnread) : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#EF4444', fontSize: 10, fontWeight: '700',
              minWidth: 17, height: 17, borderRadius: 9, lineHeight: 17,
            },
          }}
        />

        <Tabs.Screen
          name="notifications"
          options={{
            title: 'Alertes',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
            ),
            tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#EF4444', fontSize: 10, fontWeight: '700',
              minWidth: 17, height: 17, borderRadius: 9, lineHeight: 17,
            },
          }}
        />

        <Tabs.Screen
          name="profil"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={24} color={color} />
            ),
          }}
        />

        {/* Fichiers cachés */}
        <Tabs.Screen name="expediteur"   options={{ href: null }} />
        <Tabs.Screen name="transporteur" options={{ href: null }} />
        <Tabs.Screen name="connexion"    options={{ href: null }} />
        <Tabs.Screen name="proposer"     options={{ href: null }} />
      </Tabs>
    </View>
  );
}
