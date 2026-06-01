// App.jsx — Point d'entrée principal de Rakib.dz
// ============================================================

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

// Écrans
import HomeScreen    from './src/screens/HomeScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import BookingScreen from './src/screens/BookingScreen';
import AuthScreen    from './src/screens/AuthScreen';

// À créer : OfferScreen, ProfileScreen, MyTripsScreen, ChatScreen
// import OfferScreen   from './src/screens/OfferScreen';
// import ProfileScreen from './src/screens/ProfileScreen';

import { supabase, authAPI } from './src/lib/supabase';

const Stack  = createNativeStackNavigator();
const Tab    = createBottomTabNavigator();

const GREEN = '#1B6E44';

// ── Onglets principaux ─────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: GREEN,
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          borderTopColor: '#E5E7EB',
          height: 60,
          paddingBottom: 8,
        },
        tabBarIcon: ({ focused, color, size }) => {
          const icons = {
            Accueil:   focused ? 'home'          : 'home-outline',
            Proposer:  focused ? 'car'            : 'car-outline',
            Trajets:   focused ? 'list'           : 'list-outline',
            Profil:    focused ? 'person-circle'  : 'person-circle-outline',
          };
          return <Ionicons name={icons[route.name]} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Accueil"  component={HomeScreen} />
      {/* <Tab.Screen name="Proposer" component={OfferScreen} /> */}
      {/* <Tab.Screen name="Trajets"  component={MyTripsScreen} /> */}
      {/* <Tab.Screen name="Profil"   component={ProfileScreen} /> */}
    </Tab.Navigator>
  );
}

// ── Navigateur principal ───────────────────────────────────
export default function App() {
  const [session, setSession]   = useState(null);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    // Vérifier la session au démarrage
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Écouter les changements de session (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => setSession(session)
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: GREEN }}>
        <ActivityIndicator size="large" color="white" />
      </View>
    );
  }

  // Non connecté → écran d'authentification
  if (!session) {
    return (
      <AuthScreen onAuthenticated={() => {}} />
    );
  }

  // Connecté → app complète
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main"    component={MainTabs} />
        <Stack.Screen name="Results" component={ResultsScreen} />
        <Stack.Screen name="Booking" component={BookingScreen} />
        {/* <Stack.Screen name="Profile" component={ProfileScreen} /> */}
        {/* <Stack.Screen name="Chat"    component={ChatScreen} /> */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
