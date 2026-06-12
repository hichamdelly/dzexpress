import { Stack } from 'expo-router';

export default function ReservationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="depart-arrivee" />
      <Stack.Screen name="marchandise" />
      <Stack.Screen name="quantite" />
      <Stack.Screen name="vehicule" />
      <Stack.Screen name="options" />
      <Stack.Screen name="recapitulatif" />
    </Stack>
  );
}
