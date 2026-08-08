import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Home, CalendarDays, Heart, UserCircle, Briefcase } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { Spacing } from '../constants/Spacing';

interface TabItem {
  id: string;
  label: string;
  icon: any;
  /** Route name registered in (tabs)/_layout.tsx */
  routeName: string;
}

const routeNameForTab = (item: TabItem) => item.routeName;

export const CustomTabBar = ({ state, navigation, user }: any) => {
  const { colors } = useTheme();

  let tabs: TabItem[] = [];

  if (user?.role === 'owner') {
    tabs = [
      { id: 'dashboard', label: 'My Shop', icon: Briefcase, routeName: 'dashboard' },
      { id: 'profile', label: 'Profile', icon: UserCircle, routeName: 'profile' },
    ];
  } else {
    tabs = [
      { id: 'home', label: 'Home', icon: Home, routeName: 'home' },
      { id: 'appts', label: 'Bookings', icon: CalendarDays, routeName: 'bookings' },
      { id: 'favs', label: 'Saved', icon: Heart, routeName: 'favorites' },
      { id: 'profile', label: 'Profile', icon: UserCircle, routeName: 'profile' },
    ];
  }

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: colors.tabBarBackground,
        borderColor: colors.tabBarBorder
      }
    ]}>
      <View style={styles.content}>
        {tabs.map((item) => {
          const routeName = routeNameForTab(item);
          const isActive = state.routes[state.index].name === routeName;

          const onPress = () => {
            const target = state.routes.find((r: any) => r.name === routeName);
            const event = navigation.emit({
              type: 'tabPress',
              target: target?.key,
              canPreventDefault: true,
            });

            if (!isActive && !event.defaultPrevented) {
              navigation.navigate(routeName);
            }
          };

          const Icon = item.icon;
          const activeColor = colors.iconActive;
          const inactiveColor = colors.iconInactive;

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
                  backgroundColor: colors.slotIconBackground,
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
    paddingBottom: Platform.OS === 'ios' ? Spacing.xxl : Spacing.sm,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
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
    borderRadius: Spacing.round.lg,
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
