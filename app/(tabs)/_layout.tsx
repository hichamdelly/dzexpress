import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../src/context/AppContext';
import { useNotifications } from '../../src/hooks/useNotifications';
import { useMessagesBadge } from '../../src/hooks/useMessagesBadge';
import { NotifBanner } from '../../src/components/NotifBanner';

export default function TabLayout() {
  const { user }                          = useApp();
  const isT                               = user?.type === 'transporteur';
  const accentColor                       = isT ? '#1A56DB' : '#F97316';
  const { unread, banner, dismissBanner } = useNotifications(user?.id);
  const msgUnread                         = useMessagesBadge(user?.id);

  return (
    <View style={{ flex: 1 }}>
      {/* Bannière animée globale — visible sur tous les onglets */}
      <NotifBanner notification={banner} onDismiss={dismissBanner} />

      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor:   accentColor,
          tabBarInactiveTintColor: '#94A3B8',
          tabBarStyle: {
            backgroundColor: '#FFFFFF',
            borderTopColor:  '#E2E8F0',
            height:          62,
            paddingBottom:   8,
            paddingTop:      4,
          },
          tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: isT ? 'Disponibles' : 'Accueil',
            tabBarIcon: ({ color }) => (
              <Ionicons name={isT ? 'search' : 'home'} size={24} color={color} />
            ),
          }}
        />

        <Tabs.Screen
          name="suivi"
          options={{
            title: isT ? 'Mes courses' : 'Mes demandes',
            tabBarIcon: ({ color }) => (
              <Ionicons name={isT ? 'car' : 'list'} size={24} color={color} />
            ),
            // Badge rouge dès qu'il y a des notifications non lues
            tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#DC2626',
              fontSize:         10,
              fontWeight:       '800',
              minWidth:         18,
              height:           18,
              borderRadius:     9,
              lineHeight:       18,
            },
          }}
        />

        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color }) => (
              <Ionicons name="chatbubble-ellipses" size={24} color={color} />
            ),
            tabBarBadge: msgUnread > 0 ? (msgUnread > 9 ? '9+' : msgUnread) : undefined,
            tabBarBadgeStyle: {
              backgroundColor: '#DC2626',
              fontSize:         10,
              fontWeight:       '800',
              minWidth:         18,
              height:           18,
              borderRadius:     9,
              lineHeight:       18,
            },
          }}
        />

        <Tabs.Screen
          name="profil"
          options={{
            title: 'Profil',
            tabBarIcon: ({ color }) => (
              <Ionicons name="person-circle" size={24} color={color} />
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
