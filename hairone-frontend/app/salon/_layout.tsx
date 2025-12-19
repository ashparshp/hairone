import { Stack } from 'expo-router';
import Colors from '../../constants/Colors';

export default function SalonLayout() {
  return (
    <Stack screenOptions={{ 
      headerShown: false,
      contentStyle: { backgroundColor: Colors.background }
    }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="booking" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="success" options={{ gestureEnabled: false }} />
    </Stack>
  );
}