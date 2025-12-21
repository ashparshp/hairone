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
  const { theme, colors } = useTheme();
  const isDark = theme === 'dark';

  let tabs: TabItem[] = [];

  if (user?.role === 'owner') {
    tabs = [
      { id: 'dashboard', label: 'My Shop', icon: Briefcase, path: '/(tabs)/dashboard' },
      { id: 'profile', label: 'Profile', icon: UserCircle, path: '/(tabs)/profile' }
    ];
  } else {
    tabs = [
      { id: 'home', label: 'Home', icon: Home, path: '/(tabs)/home' },
      { id: 'appts', label: 'Bookings', icon: CalendarDays, path: '/(tabs)/bookings' },
      { id: 'favs', label: 'Saved', icon: Heart, path: '/(tabs)/favorites' },
      { id: 'profile', label: 'Profile', icon: UserCircle, path: '/(tabs)/profile' },
    ];
  }

  return (
    <View style={[
      styles.container,
      {
        // UPDATED: Use colors.card (Zinc) instead of Slate for background
        // Using rgba for potential blur effect support if needed, or fallback to solid colors.card
        backgroundColor: isDark ? 'rgba(24, 24, 27, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
        borderColor: colors.border
      }
    ]}>
      <View style={styles.content}>
        {tabs.map((item, index) => {
          const isActive = state.routes[state.index].name === item.id ||
                           (item.id === 'appts' && state.routes[state.index].name === 'bookings') ||
                           (item.id === 'favs' && state.routes[state.index].name === 'favorites');

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: state.routes.find((r: any) => r.name === (item.id === 'appts' ? 'bookings' : item.id))?.key,
              canPreventDefault: true,
            });

            if (!isActive && !event.defaultPrevented) {
              let routeName = item.id;
              if (item.id === 'appts') routeName = 'bookings';
              if (item.id === 'favs') routeName = 'favorites';
              navigation.navigate(routeName);
            }
          };

          const Icon = item.icon;
          // UPDATED: Use colors.tint and colors.text/textMuted
          const activeColor = colors.tint; 
          const inactiveColor = colors.textMuted; 

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
                  // UPDATED: Use colors.tint with low opacity for indicator
                  backgroundColor: isDark ? 'rgba(251, 191, 36, 0.15)' : '#f1f5f9', 
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
