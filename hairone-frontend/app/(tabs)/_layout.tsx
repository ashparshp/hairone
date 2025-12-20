import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { Home, Calendar, User, Briefcase } from 'lucide-react-native';
import Colors from '../../constants/Colors';
import { ActivityIndicator, View } from 'react-native';

export default function TabLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <View style={{flex:1, backgroundColor: Colors.background, justifyContent:'center'}}><ActivityIndicator /></View>;
  }

  // 1. If ADMIN -> Redirect out of Tabs to Admin Stack
  if (user?.role === 'admin') {
    return <Redirect href="/admin/dashboard" />;
  }

  return (
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: Colors.background, borderTopColor: Colors.border },
      tabBarActiveTintColor: Colors.primary,
      headerShown: false
    }}>

      {/* OWNER: Dashboard first */}
      {user?.role === 'owner' && (
        <Tabs.Screen name="dashboard" options={{
          title: 'My Shop',
          href: '/(tabs)/dashboard',
          tabBarIcon: ({color}) => <Briefcase color={color} size={24} />
        }} />
      )}

      {/* USER TABS */}
      <Tabs.Screen name="home" options={{
        title: 'Explore',
        // Hide if Owner (Owners manage, don't usually book via this flow in this specific UI)
        href: user?.role === 'owner' ? null : '/(tabs)/home',
        tabBarIcon: ({color}) => <Home color={color} size={24} />
      }} />

      <Tabs.Screen name="bookings" options={{
        title: 'Bookings',
        href: user?.role === 'owner' ? null : '/(tabs)/bookings',
        tabBarIcon: ({color}) => <Calendar color={color} size={24} />
      }} />

      <Tabs.Screen name="profile" options={{
        title: 'Profile',
        tabBarIcon: ({color}) => <User color={color} size={24} />
      }} />

      {/* NON-OWNER: Dashboard last (hidden) */}
      {user?.role !== 'owner' && (
        <Tabs.Screen name="dashboard" options={{
          title: 'My Shop',
          href: null,
          tabBarIcon: ({color}) => <Briefcase color={color} size={24} />
        }} />
      )}
    </Tabs>
  );
}