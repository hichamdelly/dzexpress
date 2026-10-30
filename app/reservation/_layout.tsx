import { Stack } from 'expo-router';

export default function ReservationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="etape1" />
      <Stack.Screen name="etape2" />
      <Stack.Screen name="etape3" />
    </Stack>
  );
}
