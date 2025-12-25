import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { Settings, LogOut, DollarSign, ChevronRight, Moon, Sun } from 'lucide-react-native';

export default function AdminMenu() {
  const { colors, theme, toggleTheme } = useTheme();
  const { logout } = useAuth();
  const router = useRouter();

  const menuItems = [
      {
          label: 'Finance & Settlements',
          icon: <DollarSign size={20} color={colors.text} />,
          action: () => router.push('/admin/finance'),
          showChevron: true
      },
      {
          label: 'System Settings',
          icon: <Settings size={20} color={colors.text} />,
          action: () => router.push('/admin/settings'),
          showChevron: true
      }
  ];

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Text style={[styles.headerTitle, {color: colors.text}]}>Menu</Text>

      <ScrollView contentContainerStyle={{paddingTop: 20}}>
          <View style={[styles.section, {backgroundColor: colors.card, borderColor: colors.border}]}>
             {menuItems.map((item, index) => (
                 <TouchableOpacity
                    key={index}
                    style={[styles.menuItem, index < menuItems.length - 1 && {borderBottomWidth: 1, borderBottomColor: colors.border}]}
                    onPress={item.action}
                 >
                     <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                         {item.icon}
                         <Text style={[styles.menuText, {color: colors.text}]}>{item.label}</Text>
                     </View>
                     {item.showChevron && <ChevronRight size={20} color={colors.textMuted} />}
                 </TouchableOpacity>
             ))}
          </View>

          <View style={[styles.section, {backgroundColor: colors.card, borderColor: colors.border}]}>
             <View style={styles.menuItem}>
                 <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                     {theme === 'dark' ? <Moon size={20} color={colors.text} /> : <Sun size={20} color={colors.text} />}
                     <Text style={[styles.menuText, {color: colors.text}]}>Dark Mode</Text>
                 </View>
                 <Switch
                    value={theme === 'dark'}
                    onValueChange={toggleTheme}
                    trackColor={{false: '#334155', true: colors.tint}}
                    thumbColor={'#fff'}
                 />
             </View>
          </View>

          <TouchableOpacity style={[styles.logoutBtn, {backgroundColor: '#ef4444'}]} onPress={logout}>
              <LogOut size={20} color="white" />
              <Text style={{color: 'white', fontWeight: 'bold', fontSize: 16}}>Logout</Text>
          </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },

  section: { borderRadius: 16, borderWidth: 1, overflow: 'hidden', marginBottom: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  menuText: { fontSize: 16, fontWeight: '600' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, gap: 8 }
});
