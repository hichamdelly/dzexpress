import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../src/context/AppContext';
import { ReservationProvider } from '../src/context/ReservationContext';
import { LanguageProvider } from '../src/i18n';

export default function RootLayout() {
  return (
    <LanguageProvider>
    <AppProvider>
      <ReservationProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="carte-transporteurs" />
          <Stack.Screen name="select-location" />
          <Stack.Screen name="demande/[id]" />
          <Stack.Screen name="course/[id]" />
          <Stack.Screen name="suivi-live/[id]" />
          <Stack.Screen name="paiement/[id]" />
          <Stack.Screen name="otp" />
          <Stack.Screen name="notation" />
        </Stack>
        <StatusBar style="auto" />
      </ReservationProvider>
    </AppProvider>
    </LanguageProvider>
  );
}
