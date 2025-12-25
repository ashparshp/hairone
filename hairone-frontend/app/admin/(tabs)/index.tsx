import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';
import { FadeInView } from '../../../components/AnimatedViews';
import { DollarSign, BarChart, ShoppingBag, Users, CheckCircle2 } from 'lucide-react-native';

export default function AdminHome() {
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/stats');
      setStats(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const renderStats = () => {
    if (!stats) return null;
    return (
        <View style={styles.statsGrid}>
            <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <View style={styles.iconBg}>
                    <CheckCircle2 size={24} color={colors.text} />
                </View>
                <Text style={[styles.statVal, {color: colors.text}]}>{stats.totalBookings}</Text>
                <Text style={[styles.statLabel, {color: colors.textMuted}]}>Total Bookings</Text>
            </View>
            <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <View style={[styles.iconBg, {backgroundColor: 'rgba(16, 185, 129, 0.1)'}]}>
                    <DollarSign size={24} color="#10b981" />
                </View>
                <Text style={[styles.statVal, {color: '#10b981'}]}>₹{stats.totalRevenue}</Text>
                <Text style={[styles.statLabel, {color: colors.textMuted}]}>Total Revenue</Text>
            </View>
            <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <View style={styles.iconBg}>
                    <ShoppingBag size={24} color={colors.text} />
                </View>
                <Text style={[styles.statVal, {color: colors.text}]}>{stats.shops}</Text>
                <Text style={[styles.statLabel, {color: colors.textMuted}]}>Active Shops</Text>
            </View>
            <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <View style={styles.iconBg}>
                     <Users size={24} color={colors.text} />
                </View>
                <Text style={[styles.statVal, {color: colors.text}]}>{stats.owners}</Text>
                <Text style={[styles.statLabel, {color: colors.textMuted}]}>Owners</Text>
            </View>
            <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <View style={styles.iconBg}>
                     <Users size={24} color={colors.text} />
                </View>
                <Text style={[styles.statVal, {color: colors.text}]}>{stats.users}</Text>
                <Text style={[styles.statLabel, {color: colors.textMuted}]}>Customers</Text>
            </View>
            <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <View style={styles.iconBg}>
                     <CheckCircle2 size={24} color={colors.text} />
                </View>
                <Text style={[styles.statVal, {color: colors.text}]}>{stats.completedBookings}</Text>
                <Text style={[styles.statLabel, {color: colors.textMuted}]}>Completed</Text>
            </View>
        </View>
    )
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <View>
             <Text style={[styles.title, {color: colors.text}]}>Hello, {user?.name}</Text>
             <Text style={[styles.subtitle, {color: colors.textMuted}]}>Here is your system overview.</Text>
         </View>
         <View style={[styles.avatar, {backgroundColor: colors.tint}]}>
             <Text style={{fontSize: 18, fontWeight: 'bold', color: '#0f172a'}}>{user?.name?.charAt(0)}</Text>
         </View>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 20}} showsVerticalScrollIndicator={false}>
          {/* Finance Link (Quick Access) */}
          <TouchableOpacity
            style={[styles.financeBanner, {backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)'}]}
            onPress={() => router.push('/admin/finance')}
          >
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                 <View style={{padding: 8, backgroundColor: '#10b981', borderRadius: 8}}>
                    <DollarSign size={24} color="#fff" />
                 </View>
                 <View>
                    <Text style={{color: colors.text, fontWeight: 'bold', fontSize: 16}}>Finance Center</Text>
                    <Text style={{color: colors.textMuted, fontSize: 12}}>Manage settlements & revenue</Text>
                 </View>
              </View>
              <Text style={{color: colors.tint, fontWeight: 'bold'}}>OPEN</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionHeader, {color: colors.textMuted}]}>Analytics</Text>

          {loading ? (
             <ActivityIndicator color={colors.tint} style={{marginTop: 50}} />
          ) : (
             <FadeInView>
                 {renderStats()}
             </FadeInView>
          )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginTop: 4 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  financeBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 24 },

  sectionHeader: { marginBottom: 16, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1, fontWeight: 'bold' },

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', padding: 16, borderRadius: 16, borderWidth: 1 },
  iconBg: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(148, 163, 184, 0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statVal: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: 12, fontWeight: '600' },
});
