import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function SalonLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ 
      headerShown: false,
      contentStyle: { backgroundColor: colors.background }
    }}>
      <Stack.Screen name="[id]" />
      <Stack.Screen name="booking" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="success" options={{ gestureEnabled: false }} />
    </Stack>
  );
}