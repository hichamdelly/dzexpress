import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppProvider } from '../src/context/AppContext';

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="carte-transporteurs" />
        <Stack.Screen name="demande/[id]" />
        <Stack.Screen name="course/[id]" />
        <Stack.Screen name="otp" />
        <Stack.Screen name="notation" />
      </Stack>
      <StatusBar style="auto" />
    </AppProvider>
  );
}
