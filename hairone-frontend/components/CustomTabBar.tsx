import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { Home, CalendarDays, Heart, UserCircle, Briefcase } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface TabItem {
  id: string;
  label: string;
  icon: any;
  path: string;
}

export const CustomTabBar = ({ state, navigation, user }: any) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const tabs: TabItem[] = [
    { id: 'home', label: 'Home', icon: Home, path: '/(tabs)/home' },
    { id: 'appts', label: 'Bookings', icon: CalendarDays, path: '/(tabs)/bookings' },
    { id: 'favs', label: 'Saved', icon: Heart, path: '/(tabs)/favorites' }, // Favorites tab or similar
    { id: 'profile', label: 'Profile', icon: UserCircle, path: '/(tabs)/profile' },
  ];

  // Adjust for Owner
  if (user?.role === 'owner') {
      // Just an example adjustment, logic depends on requirement
      tabs[0] = { id: 'dashboard', label: 'My Shop', icon: Briefcase, path: '/(tabs)/dashboard' };
  }

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        borderColor: isDark ? '#1e293b' : '#f1f5f9'
      }
    ]}>
      <View style={styles.content}>
        {tabs.map((item, index) => {
          // Check active state based on route
          // Simple check: does current pathname contain the item path?
          // Or strictly equal? Expo router paths can be tricky.
          // Let's use state.index if possible, but we are building a custom UI for standard tabs.
          // Standard tab bar uses state.routes[state.index].name to determine active.

          // However, since we are mapping arbitrary items to routes that might not exactly match the state routes order
          // (e.g. Owner vs User), we need to be careful.
          // Simplest is to map the 'name' in `_layout.tsx` to these IDs.

          // Let's rely on the route names defined in _layout.tsx: 'home', 'bookings', 'profile', 'dashboard'
          // We need to match `item.id` to the route name if possible.

          // But wait, the list above uses 'appts' and 'favs'.
          // 'bookings' screen is named 'bookings'.
          // 'favorites' screen? We don't have one in tabs yet. We have 'bookings'.
          // Let's stick to the route names in `_layout.tsx`: home, bookings, profile, dashboard.

          const isActive = state.routes[state.index].name === item.id ||
                           (item.id === 'appts' && state.routes[state.index].name === 'bookings') ||
                           (item.id === 'favs' && state.routes[state.index].name === 'favorites'); // if exists

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: state.routes.find((r: any) => r.name === (item.id === 'appts' ? 'bookings' : item.id))?.key,
              canPreventDefault: true,
            });

            if (!isActive && !event.defaultPrevented) {
              // Navigate
              // Find the route name mapping
              let routeName = item.id;
              if (item.id === 'appts') routeName = 'bookings';

              navigation.navigate(routeName);
            }
          };

          const Icon = item.icon;
          const activeColor = isDark ? '#fbbf24' : '#0f172a'; // Amber-400 or Slate-900
          const inactiveColor = isDark ? '#475569' : '#94a3b8'; // Slate-600 or Slate-400

          return (
            <TouchableOpacity
              key={item.id}
              onPress={onPress}
              style={styles.tabBtn}
              activeOpacity={0.7}
            >
              <View style={[
                styles.activeIndicator,
                isActive && {
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#f1f5f9',
                  opacity: 1,
                  transform: [{ scale: 1 }]
                }
              ]} />

              <Icon
                size={22}
                color={isActive ? activeColor : inactiveColor}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <Text style={[
                styles.label,
                { color: isActive ? activeColor : inactiveColor }
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
    paddingHorizontal: 16,
    // Blur effect is tricky in RN without Expo Blur, but background opacity works ok
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    position: 'relative',
  },
  activeIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 8,
    right: 8,
    borderRadius: 16,
    opacity: 0,
    transform: [{ scale: 0.75 }],
  },
  label: {
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 4,
    textAlign: 'center',
    width: '100%',
  }
});
