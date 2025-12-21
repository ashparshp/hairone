import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { Check, X, LogOut, ShieldAlert, BarChart, ShoppingBag, ListChecks, Ban } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'approvals' | 'reports' | 'shops'>('approvals');

  // Data State
  const [applicants, setApplicants] = useState([]);
  const [shops, setShops] = useState([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Suspension Modal
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

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

  const openSuspendModal = (shopId: string) => {
    setSelectedShopId(shopId);
    setSuspendReason('');
    setSuspendModalVisible(true);
  };

  const handleSuspend = async () => {
    if (!selectedShopId || !suspendReason.trim()) return;
    try {
      await api.post(`/admin/shops/${selectedShopId}/suspend`, { reason: suspendReason });
      Alert.alert("Suspended", "Shop has been suspended and upcoming bookings cancelled.");
      setSuspendModalVisible(false);
      fetchData();
    } catch (e) {
      Alert.alert("Error", "Failed to suspend shop");
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
        <View style={{flexDirection:'row', alignItems:'center', gap: 12}}>
            <Image source={{ uri: item.image || 'https://via.placeholder.com/100' }} style={{width: 50, height: 50, borderRadius: 8}} />
            <View style={{flex:1}}>
                <Text style={styles.bizName}>{item.name}</Text>
                <Text style={styles.userName}>{item.address}</Text>
            </View>
            {!item.isDisabled && (
              <TouchableOpacity style={styles.suspendBtn} onPress={() => openSuspendModal(item._id)}>
                <Ban size={16} color="#ef4444" />
              </TouchableOpacity>
            )}
        </View>
        <View style={{marginTop: 12, flexDirection:'row', justifyContent:'space-between'}}>
            <Text style={{color:Colors.textMuted}}>Owner: {item.ownerId?.name || 'Unknown'}</Text>
            <Text style={{color:Colors.textMuted}}>
              {item.isDisabled ? <Text style={{color: '#ef4444', fontWeight:'bold'}}>SUSPENDED</Text> : item.ownerId?.phone}
            </Text>
        </View>
    </View>
  );

  const renderStats = () => {
      if (!stats) return null;
      return (
          <ScrollView contentContainerStyle={{paddingBottom: 20}}>
              <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                      <Text style={styles.statVal}>{stats.totalBookings}</Text>
                      <Text style={styles.statLabel}>Total Bookings</Text>
                  </View>
                  <View style={styles.statCard}>
                      <Text style={[styles.statVal, {color: '#10b981'}]}>₹{stats.totalRevenue}</Text>
                      <Text style={styles.statLabel}>Total Revenue</Text>
                  </View>
                  <View style={styles.statCard}>
                      <Text style={styles.statVal}>{stats.shops}</Text>
                      <Text style={styles.statLabel}>Active Shops</Text>
                  </View>
                  <View style={styles.statCard}>
                      <Text style={styles.statVal}>{stats.owners}</Text>
                      <Text style={styles.statLabel}>Owners</Text>
                  </View>
                  <View style={styles.statCard}>
                      <Text style={styles.statVal}>{stats.users}</Text>
                      <Text style={styles.statLabel}>Customers</Text>
                  </View>
                  <View style={styles.statCard}>
                      <Text style={styles.statVal}>{stats.completedBookings}</Text>
                      <Text style={styles.statLabel}>Completed</Text>
                  </View>
              </View>
          </ScrollView>
      )
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

      {/* Tabs */}
      <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'approvals' && styles.activeTab]} onPress={() => setActiveTab('approvals')}>
              <ListChecks size={18} color={activeTab === 'approvals' ? '#0f172a' : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === 'approvals' && styles.activeTabText]}>Approvals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'reports' && styles.activeTab]} onPress={() => setActiveTab('reports')}>
              <BarChart size={18} color={activeTab === 'reports' ? '#0f172a' : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === 'reports' && styles.activeTabText]}>Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'shops' && styles.activeTab]} onPress={() => setActiveTab('shops')}>
              <ShoppingBag size={18} color={activeTab === 'shops' ? '#0f172a' : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === 'shops' && styles.activeTabText]}>Shops</Text>
          </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>
          {activeTab === 'approvals' && `Pending Applications (${applicants.length})`}
          {activeTab === 'reports' && 'System Analytics'}
          {activeTab === 'shops' && `All Shops (${shops.length})`}
      </Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{marginTop: 50}} />
      ) : (
        <>
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
                    ListEmptyComponent={
                        <View style={{alignItems: 'center', marginTop: 50, opacity: 0.5}}>
                            <ShoppingBag size={48} color="#334155" />
                            <Text style={{color: Colors.textMuted, marginTop: 10}}>No active shops.</Text>
                        </View>
                    }
                />
            )}

            {activeTab === 'reports' && renderStats()}

            {/* Suspend Modal */}
            <Modal
              visible={suspendModalVisible}
              transparent
              animationType="fade"
              onRequestClose={() => setSuspendModalVisible(false)}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.modalOverlay}
              >
                <View style={styles.modalContent}>
                   <View style={styles.modalHeader}>
                     <ShieldAlert size={24} color="#ef4444" />
                     <Text style={styles.modalTitle}>Suspend Shop</Text>
                   </View>
                   <Text style={styles.modalSub}>
                     This will hide the shop from users and cancel all upcoming bookings. Action is reversible by re-approving the owner.
                   </Text>

                   <TextInput
                      style={styles.input}
                      placeholder="Reason for suspension..."
                      placeholderTextColor={Colors.textMuted}
                      multiline
                      value={suspendReason}
                      onChangeText={setSuspendReason}
                   />

                   <View style={styles.modalActions}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={() => setSuspendModalVisible(false)}>
                         <Text style={styles.cancelText}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.confirmSuspendBtn} onPress={handleSuspend}>
                         <Text style={styles.suspendText}>Confirm Suspension</Text>
                      </TouchableOpacity>
                   </View>
                </View>
              </KeyboardAvoidingView>
            </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  subtitle: { color: Colors.primary, fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  logoutBtn: { padding: 10, backgroundColor: '#334155', borderRadius: 12 },
  
  tabContainer: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 8 },
  activeTab: { backgroundColor: Colors.primary },
  tabText: { color: Colors.textMuted, fontWeight: 'bold', fontSize: 12 },
  activeTabText: { color: '#0f172a' },

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

  // Stats Grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', backgroundColor: Colors.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  statVal: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { color: Colors.textMuted, fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold' },

  suspendBtn: { padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: Colors.card, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: Colors.border },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  modalSub: { color: Colors.textMuted, fontSize: 14, marginBottom: 20, lineHeight: 20 },
  input: { backgroundColor: '#0f172a', borderWidth: 1, borderColor: Colors.border, borderRadius: 8, padding: 12, color: 'white', height: 100, textAlignVertical: 'top', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#334155' },
  cancelText: { color: 'white', fontWeight: 'bold' },
  confirmSuspendBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#ef4444' },
  suspendText: { color: 'white', fontWeight: 'bold' }
});