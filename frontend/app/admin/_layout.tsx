import { Stack, Redirect } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

export default function AdminLayout() {
  const { colors } = useTheme();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{flex: 1, backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator color={colors.tint} size="large" />
      </View>
    );
  }

  // Security Check: Only Admin can access this layout
  if (!user || user.role !== 'admin') {
    return <Redirect href="/(auth)/login" />;
  }

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
