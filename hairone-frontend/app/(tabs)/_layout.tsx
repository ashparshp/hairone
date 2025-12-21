import { Tabs, Redirect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Home, CalendarDays, UserCircle, Briefcase, Heart } from 'lucide-react-native';
import { ActivityIndicator, View, Platform } from 'react-native';

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const { colors, theme } = useTheme();

  if (isLoading) {
    return <View style={{flex:1, backgroundColor: colors.background, justifyContent:'center'}}><ActivityIndicator color={colors.tint} /></View>;
  }

  // 1. If ADMIN -> Redirect out of Tabs to Admin Stack
  if (user?.role === 'admin') {
    return <Redirect href="/admin/dashboard" />;
  }

  return (
    <Tabs screenOptions={{
      tabBarStyle: {
        backgroundColor: colors.card,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        height: 60,
        paddingBottom: 5,
        paddingTop: 5,
        elevation: 0,
        shadowOpacity: 0,
      },
      tabBarItemStyle: {
        paddingVertical: 5
      },
      tabBarActiveTintColor: colors.text, // Slate 900 / White
      tabBarInactiveTintColor: colors.textMuted,
      headerShown: false,
      tabBarShowLabel: true,
      tabBarLabelStyle: { fontSize: 10, fontWeight: '500', marginBottom: 0 }
    }}>

      {/* OWNER: Dashboard first */}
      {user?.role === 'owner' && (
        <Tabs.Screen name="dashboard" options={{
          title: 'My Shop',
          href: '/(tabs)/dashboard',
          tabBarIcon: ({color, focused}) => <Briefcase color={color} size={24} strokeWidth={focused ? 2.5 : 2} />
        }} />
      )}

      {/* USER TABS */}
      <Tabs.Screen name="home" options={{
        title: 'Home',
        // Hide if Owner
        href: user?.role === 'owner' ? null : '/(tabs)/home',
        tabBarIcon: ({color, focused}) => <Home color={color} size={24} strokeWidth={focused ? 2.5 : 2} />
      }} />

      <Tabs.Screen name="bookings" options={{
        title: 'Bookings',
        href: user?.role === 'owner' ? null : '/(tabs)/bookings',
        tabBarIcon: ({color, focused}) => <CalendarDays color={color} size={24} strokeWidth={focused ? 2.5 : 2} />
      }} />

      <Tabs.Screen name="profile" options={{
        title: 'Profile',
        tabBarIcon: ({color, focused}) => <UserCircle color={color} size={24} strokeWidth={focused ? 2.5 : 2} />
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
