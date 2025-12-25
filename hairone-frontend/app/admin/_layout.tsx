import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function AdminLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ 
      headerShown: false,
      contentStyle: { backgroundColor: colors.background }
    }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="finance" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="shop/[id]" />
    </Stack>
  );
}
