import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ActivityIndicator, View } from 'react-native';
import { CustomTabBar } from '../../components/CustomTabBar';

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{flex:1, backgroundColor: colors.background, justifyContent:'center', alignItems:'center'}}>
        <ActivityIndicator color={colors.tint} size="large" />
      </View>
    );
  }

  // 1. If ADMIN -> Redirect out of Tabs to Admin Stack
  if (user?.role === 'admin') {
    return <Redirect href="/admin/dashboard" />;
  }

  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} user={user} />}
      screenOptions={{
        headerShown: false
      }}
    >
      {/* OWNER: Dashboard first */}
      {user?.role === 'owner' && (
        <Tabs.Screen name="dashboard" options={{
          title: 'My Shop',
          href: '/(tabs)/dashboard',
        }} />
      )}

      {/* USER TABS */}
      <Tabs.Screen name="home" options={{
        title: 'Explore',
        // Hide if Owner (Owners manage, don't usually book via this flow in this specific UI)
        href: user?.role === 'owner' ? null : '/(tabs)/home',
      }} />

      <Tabs.Screen name="bookings" options={{
        title: 'Bookings',
        href: user?.role === 'owner' ? null : '/(tabs)/bookings',
      }} />

      {/* Added Favorites Screen Route */}
      <Tabs.Screen name="favorites" options={{
        title: 'Saved',
        href: user?.role === 'owner' ? null : '/(tabs)/favorites',
      }} />

      <Tabs.Screen name="profile" options={{
        title: 'Profile',
      }} />

      {/* NON-OWNER: Dashboard last (hidden) */}
      {user?.role !== 'owner' && (
        <Tabs.Screen name="dashboard" options={{
          title: 'My Shop',
          href: null,
        }} />
      )}
    </Tabs>
  );
}
