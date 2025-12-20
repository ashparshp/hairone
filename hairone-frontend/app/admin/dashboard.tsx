import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { Check, X, LogOut, ShieldAlert, BarChart3, Store, UserCheck, Briefcase } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // TABS: 'approvals', 'reports', 'shops'
  const [activeTab, setActiveTab] = useState('approvals');

  // DATA STATES
  const [applicants, setApplicants] = useState([]);
  const [shops, setShops] = useState([]);
  const [stats, setStats] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'approvals') {
        const res = await api.get('/admin/applications');
        setApplicants(res.data);
      } else if (activeTab === 'shops') {
        const res = await api.get('/admin/shops');
        setShops(res.data);
      } else if (activeTab === 'reports') {
        const res = await api.get('/admin/stats');
        setStats(res.data);
      }
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (userId: string, action: 'approve' | 'reject') => {
    try {
      await api.post('/admin/process', { userId, action });
      Alert.alert("Success", `User ${action}d successfully.`);
      fetchData(); // Refresh list
    } catch (e) {
      Alert.alert("Error", "Action failed");
    }
  };

  const renderApplicant = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
        <View>
            <Text style={styles.bizName}>{item.businessName || 'Untitled Shop'}</Text>
            <Text style={styles.userName}>{item.name} • {item.phone}</Text>
        </View>
        <View style={styles.badge}>
            <Text style={styles.badgeText}>PENDING</Text>
        </View>
      </View>
      
      <Text style={styles.sub}>User applied to become a partner.</Text>
      
      <View style={styles.actionRow}>
         <TouchableOpacity style={styles.rejectBtn} onPress={() => handleProcess(item._id, 'reject')}>
            <X size={16} color="#ef4444" />
            <Text style={styles.rejectText}>Reject</Text>
         </TouchableOpacity>
         
         <TouchableOpacity style={styles.approveBtn} onPress={() => handleProcess(item._id, 'approve')}>
            <Check size={16} color="#0f172a" />
            <Text style={styles.approveText}>Approve</Text>
         </TouchableOpacity>
      </View>
    </View>
  );

  const renderShop = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start'}}>
        <View style={{flex:1}}>
            <Text style={styles.bizName}>{item.name}</Text>
            <Text style={styles.sub}>{item.address}</Text>
        </View>
        <View style={[styles.badge, {backgroundColor: 'rgba(16, 185, 129, 0.1)'}]}>
            <Text style={[styles.badgeText, {color: '#10b981'}]}>{item.rating} ★</Text>
        </View>
      </View>
      <View style={{marginTop: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 10}}>
          <Text style={styles.userName}>Owner: {item.ownerId?.name || 'Unknown'}</Text>
          <Text style={styles.userName}>Phone: {item.ownerId?.phone || 'N/A'}</Text>
      </View>
    </View>
  );

  const renderStats = () => {
    if (!stats) return null;
    return (
      <View style={{ gap: 16 }}>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Briefcase size={24} color={Colors.primary} />
            <Text style={styles.statVal}>{stats.totalBookings}</Text>
            <Text style={styles.statLabel}>Total Bookings</Text>
          </View>
          <View style={styles.statCard}>
             <Store size={24} color="#f472b6" />
             <Text style={styles.statVal}>{stats.activeShops}</Text>
             <Text style={styles.statLabel}>Active Shops</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
             <Text style={[styles.statVal, {color:'#10b981'}]}>₹{stats.totalRevenue}</Text>
             <Text style={styles.statLabel}>Total Revenue</Text>
          </View>
           <View style={styles.statCard}>
             <UserCheck size={24} color="#60a5fa" />
             <Text style={styles.statVal}>{stats.totalUsers}</Text>
             <Text style={styles.statLabel}>Total Users</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <View>
             <Text style={styles.title}>Admin Panel</Text>
             <Text style={styles.subtitle}>System Management</Text>
         </View>
         <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
             <LogOut size={20} color="white" />
         </TouchableOpacity>
      </View>

      {/* TABS */}
      <View style={styles.tabRow}>
         <TouchableOpacity style={[styles.tab, activeTab === 'approvals' && styles.activeTab]} onPress={() => setActiveTab('approvals')}>
            <Text style={[styles.tabText, activeTab === 'approvals' && styles.activeTabText]}>Approvals</Text>
         </TouchableOpacity>
         <TouchableOpacity style={[styles.tab, activeTab === 'reports' && styles.activeTab]} onPress={() => setActiveTab('reports')}>
            <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>Reports</Text>
         </TouchableOpacity>
         <TouchableOpacity style={[styles.tab, activeTab === 'shops' && styles.activeTab]} onPress={() => setActiveTab('shops')}>
             <Text style={[styles.tabText, activeTab === 'shops' && styles.activeTabText]}>Shops</Text>
         </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{marginTop: 50}} />
      ) : (
        <View style={{flex: 1}}>
          {activeTab === 'approvals' && (
             <FlatList
                data={applicants}
                renderItem={renderApplicant}
                keyExtractor={(item: any) => item._id}
                contentContainerStyle={{paddingBottom: 20}}
                ListEmptyComponent={
                  <View style={{alignItems: 'center', marginTop: 50, opacity: 0.5}}>
                      <ShieldAlert size={48} color="#334155" />
                      <Text style={{color: Colors.textMuted, marginTop: 10}}>No pending requests.</Text>
                  </View>
                }
             />
          )}

          {activeTab === 'shops' && (
              <FlatList
                data={shops}
                renderItem={renderShop}
                keyExtractor={(item: any) => item._id}
                contentContainerStyle={{paddingBottom: 20}}
                ListEmptyComponent={<Text style={{color: Colors.textMuted, textAlign: 'center', marginTop: 20}}>No shops found.</Text>}
              />
          )}

          {activeTab === 'reports' && (
             <ScrollView>
                {renderStats()}
             </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  subtitle: { color: '#ef4444', fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  logoutBtn: { padding: 10, backgroundColor: '#334155', borderRadius: 12 },
  
  sectionHeader: { color: Colors.textMuted, marginBottom: 16, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1, fontWeight: 'bold' },
  
  card: { backgroundColor: Colors.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  bizName: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  userName: { color: Colors.textMuted, fontSize: 14, marginTop: 2 },
  sub: { color: '#64748b', fontSize: 12, marginVertical: 12 },
  
  badge: { backgroundColor: 'rgba(234, 179, 8, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { color: '#eab308', fontSize: 10, fontWeight: 'bold' },
  
  actionRow: { flexDirection: 'row', gap: 12 },
  approveBtn: { flex: 1, backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, gap: 8 },
  approveText: { color: '#0f172a', fontWeight: 'bold' },
  rejectBtn: { flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, gap: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  rejectText: { color: '#ef4444', fontWeight: 'bold' },

  tabRow: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#1e293b', padding: 4, borderRadius: 12 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: Colors.card },
  tabText: { color: Colors.textMuted, fontWeight: 'bold' },
  activeTabText: { color: 'white' },

  statRow: { flexDirection: 'row', gap: 16 },
  statCard: { flex: 1, backgroundColor: Colors.card, padding: 20, borderRadius: 16, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statVal: { fontSize: 24, fontWeight: 'bold', color: 'white', marginVertical: 8 },
  statLabel: { color: Colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }
});