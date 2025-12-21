import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { Check, X, LogOut, ShieldAlert, BarChart, ShoppingBag, ListChecks, Ban, MessageSquare } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { FadeInView } from '../../components/AnimatedViews';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const { colors, theme } = useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const [activeTab, setActiveTab] = useState<'approvals' | 'reports' | 'shops' | 'support'>('approvals');

  // Data State
  const [applicants, setApplicants] = useState([]);
  const [shops, setShops] = useState([]);
  const [stats, setStats] = useState<any>(null);
  const [tickets, setTickets] = useState([]);
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
      } else if (activeTab === 'support') {
        const res = await api.get('/support/all');
        setTickets(res.data);
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
      fetchData(); 
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

  const renderApplicant = ({ item, index }: { item: any, index: number }) => (
    <FadeInView delay={index * 50}>
    <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
        <View>
            <Text style={[styles.bizName, {color: colors.text}]}>{item.businessName || 'Untitled Shop'}</Text>
            <Text style={[styles.userName, {color: colors.textMuted}]}>{item.name} • {item.phone}</Text>
        </View>
        <View style={styles.badge}>
            <Text style={styles.badgeText}>PENDING</Text>
        </View>
      </View>
      
      <Text style={[styles.sub, {color: colors.textMuted}]}>User applied to become a partner.</Text>
      
      <View style={styles.actionRow}>
         <TouchableOpacity style={styles.rejectBtn} onPress={() => handleProcess(item._id, 'reject')}>
            <X size={16} color="#ef4444" />
            <Text style={styles.rejectText}>Reject</Text>
         </TouchableOpacity>
         
         <TouchableOpacity style={[styles.approveBtn, {backgroundColor: colors.tint}]} onPress={() => handleProcess(item._id, 'approve')}>
            <Check size={16} color="#000000" />
            <Text style={[styles.approveText, {color: '#000000'}]}>Approve</Text>
         </TouchableOpacity>
      </View>
    </View>
    </FadeInView>
  );

  const renderShop = ({ item, index }: { item: any, index: number }) => (
    <FadeInView delay={index * 50}>
    <TouchableOpacity
      style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}
      onPress={() => router.push(`/admin/shop/${item._id}` as any)}
    >
        <View style={{flexDirection:'row', alignItems:'center', gap: 12}}>
            <Image source={{ uri: item.image || 'https://via.placeholder.com/100' }} style={{width: 50, height: 50, borderRadius: 8}} />
            <View style={{flex:1}}>
                <Text style={[styles.bizName, {color: colors.text}]}>{item.name}</Text>
                <Text style={[styles.userName, {color: colors.textMuted}]}>{item.address}</Text>
            </View>
            {!item.isDisabled && (
              <TouchableOpacity style={styles.suspendBtn} onPress={() => openSuspendModal(item._id)}>
                <Ban size={16} color="#ef4444" />
              </TouchableOpacity>
            )}
        </View>
        <View style={{marginTop: 12, flexDirection:'row', justifyContent:'space-between'}}>
            <Text style={{color: colors.textMuted}}>Owner: {item.ownerId?.name || 'Unknown'}</Text>
            <Text style={{color: colors.textMuted}}>
              {item.isDisabled ? <Text style={{color: '#ef4444', fontWeight:'bold'}}>SUSPENDED</Text> : item.ownerId?.phone}
            </Text>
        </View>
    </TouchableOpacity>
    </FadeInView>
  );

  const renderTicket = ({ item, index }: { item: any, index: number }) => (
    <FadeInView delay={index * 50}>
      <TouchableOpacity
        style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}
        onPress={() => router.push(`/support/${item._id}` as any)}
      >
         <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}>
             <Text style={[styles.bizName, {color: colors.text, fontSize: 16}]}>{item.subject}</Text>
             <Text style={[styles.status, {color: item.status === 'open' ? '#10b981' : colors.textMuted}]}>{item.status.toUpperCase()}</Text>
         </View>
         <Text style={{color: colors.textMuted, fontSize: 12, marginBottom: 8}}>User: {item.userId?.name} ({item.userId?.phone})</Text>
         <Text style={{color: colors.text, fontSize: 14}} numberOfLines={1}>{item.messages[item.messages.length - 1]?.text}</Text>
      </TouchableOpacity>
    </FadeInView>
  );

  const renderStats = () => {
      if (!stats) return null;
      return (
          <ScrollView contentContainerStyle={{paddingBottom: 20}}>
              <FadeInView>
              <View style={styles.statsGrid}>
                  <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                      <Text style={[styles.statVal, {color: colors.text}]}>{stats.totalBookings}</Text>
                      <Text style={[styles.statLabel, {color: colors.textMuted}]}>Total Bookings</Text>
                  </View>
                  <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                      <Text style={[styles.statVal, {color: '#10b981'}]}>₹{stats.totalRevenue}</Text>
                      <Text style={[styles.statLabel, {color: colors.textMuted}]}>Total Revenue</Text>
                  </View>
                  <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                      <Text style={[styles.statVal, {color: colors.text}]}>{stats.shops}</Text>
                      <Text style={[styles.statLabel, {color: colors.textMuted}]}>Active Shops</Text>
                  </View>
                  <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                      <Text style={[styles.statVal, {color: colors.text}]}>{stats.owners}</Text>
                      <Text style={[styles.statLabel, {color: colors.textMuted}]}>Owners</Text>
                  </View>
                  <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                      <Text style={[styles.statVal, {color: colors.text}]}>{stats.users}</Text>
                      <Text style={[styles.statLabel, {color: colors.textMuted}]}>Customers</Text>
                  </View>
                  <View style={[styles.statCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                      <Text style={[styles.statVal, {color: colors.text}]}>{stats.completedBookings}</Text>
                      <Text style={[styles.statLabel, {color: colors.textMuted}]}>Completed</Text>
                  </View>
              </View>
              </FadeInView>
          </ScrollView>
      )
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <View>
             <Text style={[styles.title, {color: colors.text}]}>Admin Panel</Text>
             <Text style={[styles.subtitle, {color: colors.tint}]}>System Management</Text>
         </View>
         {/* UPDATED: Logout button background matches Zinc theme */}
         <TouchableOpacity style={[styles.logoutBtn, {backgroundColor: isDark ? colors.border : '#e2e8f0'}]} onPress={logout}>
             <LogOut size={20} color={colors.text} />
         </TouchableOpacity>
      </View>

      {/* Tabs */}
      {/* UPDATED: Tab container uses dynamic colors for Pure Black/Zinc contrast */}
      <View style={[styles.tabContainer, {backgroundColor: isDark ? colors.card : '#f1f5f9'}]}>
          <TouchableOpacity style={[styles.tab, activeTab === 'approvals' && {backgroundColor: colors.tint}]} onPress={() => setActiveTab('approvals')}>
              <ListChecks size={18} color={activeTab === 'approvals' ? '#000000' : colors.textMuted} />
              <Text style={[styles.tabText, {color: colors.textMuted}, activeTab === 'approvals' && {color: '#000000'}]}>Approvals</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'reports' && {backgroundColor: colors.tint}]} onPress={() => setActiveTab('reports')}>
              <BarChart size={18} color={activeTab === 'reports' ? '#000000' : colors.textMuted} />
              <Text style={[styles.tabText, {color: colors.textMuted}, activeTab === 'reports' && {color: '#000000'}]}>Reports</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'shops' && {backgroundColor: colors.tint}]} onPress={() => setActiveTab('shops')}>
              <ShoppingBag size={18} color={activeTab === 'shops' ? '#000000' : colors.textMuted} />
              <Text style={[styles.tabText, {color: colors.textMuted}, activeTab === 'shops' && {color: '#000000'}]}>Shops</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'support' && {backgroundColor: colors.tint}]} onPress={() => setActiveTab('support')}>
              <MessageSquare size={18} color={activeTab === 'support' ? '#000000' : colors.textMuted} />
              <Text style={[styles.tabText, {color: colors.textMuted}, activeTab === 'support' && {color: '#000000'}]}>Support</Text>
          </TouchableOpacity>
      </View>

      <Text style={[styles.sectionHeader, {color: colors.textMuted}]}>
          {activeTab === 'approvals' && `Pending Applications (${applicants.length})`}
          {activeTab === 'reports' && 'System Analytics'}
          {activeTab === 'shops' && `All Shops (${shops.length})`}
          {activeTab === 'support' && `Support Tickets (${tickets.length})`}
      </Text>

      {loading ? (
        <ActivityIndicator color={colors.tint} style={{marginTop: 50}} />
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
                            <ShieldAlert size={48} color={colors.textMuted} />
                            <Text style={{color: colors.textMuted, marginTop: 10}}>No pending requests.</Text>
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
                            <ShoppingBag size={48} color={colors.textMuted} />
                            <Text style={{color: colors.textMuted, marginTop: 10}}>No active shops.</Text>
                        </View>
                    }
                />
            )}

            {activeTab === 'support' && (
                 <FlatList
                    data={tickets}
                    renderItem={renderTicket}
                    keyExtractor={(item: any) => item._id}
                    contentContainerStyle={{paddingBottom: 20}}
                    ListEmptyComponent={
                        <View style={{alignItems: 'center', marginTop: 50, opacity: 0.5}}>
                            <MessageSquare size={48} color={colors.textMuted} />
                            <Text style={{color: colors.textMuted, marginTop: 10}}>No tickets.</Text>
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
                <View style={[styles.modalContent, {backgroundColor: colors.card, borderColor: colors.border}]}>
                   <View style={styles.modalHeader}>
                     <ShieldAlert size={24} color="#ef4444" />
                     <Text style={[styles.modalTitle, {color: colors.text}]}>Suspend Shop</Text>
                   </View>
                   <Text style={[styles.modalSub, {color: colors.textMuted}]}>
                     This will hide the shop from users and cancel all upcoming bookings. Action is reversible by re-approving the owner.
                   </Text>

                   <TextInput
                      // UPDATED: Input background changed to True Black (colors.background)
                      style={[styles.input, {backgroundColor: isDark ? colors.background : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                      placeholder="Reason for suspension..."
                      placeholderTextColor={colors.textMuted}
                      multiline
                      value={suspendReason}
                      onChangeText={setSuspendReason}
                   />

                   <View style={styles.modalActions}>
                      {/* UPDATED: Cancel button background matches Zinc theme */}
                      <TouchableOpacity style={[styles.cancelBtn, {backgroundColor: isDark ? colors.border : '#e2e8f0'}]} onPress={() => setSuspendModalVisible(false)}>
                         <Text style={{color: colors.text, fontWeight: 'bold'}}>Cancel</Text>
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
  container: { flex: 1, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold' },
  subtitle: { fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
  logoutBtn: { padding: 10, borderRadius: 12 },
  tabContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 20 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 8, gap: 8 },
  tabText: { fontWeight: 'bold', fontSize: 12 },
  sectionHeader: { marginBottom: 16, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1, fontWeight: 'bold' },
  card: { padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  bizName: { fontWeight: 'bold', fontSize: 18 },
  userName: { fontSize: 14, marginTop: 2 },
  sub: { fontSize: 12, marginVertical: 12 },
  status: { fontSize: 10, fontWeight: 'bold' },
  badge: { backgroundColor: 'rgba(234, 179, 8, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { color: '#eab308', fontSize: 10, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', gap: 12 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, gap: 8 },
  approveText: { fontWeight: 'bold' },
  rejectBtn: { flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, gap: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  rejectText: { color: '#ef4444', fontWeight: 'bold' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '48%', padding: 16, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold' },
  suspendBtn: { padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 16, padding: 20, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalSub: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, height: 100, textAlignVertical: 'top', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 10 },
  confirmSuspendBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#ef4444' },
  suspendText: { color: 'white', fontWeight: 'bold' }
});
