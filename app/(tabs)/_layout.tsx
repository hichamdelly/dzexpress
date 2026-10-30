import { View } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/context/AppContext';
import { useNotifications } from '../../src/hooks/useNotifications';
import { NotifBanner } from '../../src/components/NotifBanner';

export default function TabLayout() {
  const { user }                          = useApp();
  const router                            = useRouter();
  const { banner, dismissBanner }         = useNotifications(user?.id);

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
            borderTopWidth:  1,
            borderTopColor:  '#E5E7EB',
            height:          80,
            paddingBottom:   12,
            paddingTop:      8,
            elevation:       10,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
          tabBarIconStyle:  { marginTop: 4 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="suivi"
          options={{
            title: 'Activité',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'list' : 'list-outline'} size={22} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="profil"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color, focused }) => (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
            ),
          }}
        />

        {/* Fichiers cachés */}
        <Tabs.Screen name="messages"      options={{ href: null }} />
        <Tabs.Screen name="notifications" options={{ href: null }} />
        <Tabs.Screen name="expediteur"   options={{ href: null }} />
        <Tabs.Screen name="transporteur" options={{ href: null }} />
        <Tabs.Screen name="connexion"    options={{ href: null }} />
        <Tabs.Screen name="proposer"     options={{ href: null }} />
      </Tabs>
    </View>
  );
}
