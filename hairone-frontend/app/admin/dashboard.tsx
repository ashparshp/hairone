import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { Check, X, LogOut, ShieldAlert } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const res = await api.get('/admin/applications');
      setApplicants(res.data);
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
      fetchApplications(); // Refresh list
    } catch (e) {
      Alert.alert("Error", "Action failed");
    }
  };

  const renderApplicant = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
        <View>
            <Text style={styles.bizName}>{item.businessName || 'Untitled Shop'}</Text>
            <Text style={styles.userName}>{item.phone}</Text>
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <View>
             <Text style={styles.title}>Admin Panel</Text>
             <Text style={styles.subtitle}>Manage Approvals</Text>
         </View>
         <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
             <LogOut size={20} color="white" />
         </TouchableOpacity>
      </View>

      <Text style={styles.sectionHeader}>Pending Applications ({applicants.length})</Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{marginTop: 50}} />
      ) : (
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
  rejectText: { color: '#ef4444', fontWeight: 'bold' }
});