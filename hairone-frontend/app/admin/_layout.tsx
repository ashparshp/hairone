import { Stack } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';

export default function AdminLayout() {
  const { colors } = useTheme();

  return (
    <Stack screenOptions={{ 
      headerShown: false,
      contentStyle: { backgroundColor: colors.background }
    }}>
      <Stack.Screen name="dashboard" />
    </Stack>
  );
}