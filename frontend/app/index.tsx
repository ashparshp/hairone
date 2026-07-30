import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function Index() {
  const { user, isLoading, onboardingReady, needsOnboarding } = useAuth();

  if (isLoading || (user && !onboardingReady)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (needsOnboarding) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (user.role === 'admin') {
    return <Redirect href="/admin/(tabs)" />;
  }

  if (user.role === 'owner') {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
