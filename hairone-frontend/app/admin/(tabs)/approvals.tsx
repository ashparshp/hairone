import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../services/api';
import { Check, X, ShieldAlert } from 'lucide-react-native';
import { FadeInView } from '../../../components/AnimatedViews';

export default function AdminApprovals() {
  const { colors } = useTheme();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);

  // Refresh data when tab is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    setLoading(true);
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
      fetchData(); // Refresh list
    } catch (e) {
      Alert.alert("Error", "Action failed");
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
            <Check size={16} color="#0f172a" />
            <Text style={styles.approveText}>Approve</Text>
         </TouchableOpacity>
      </View>
    </View>
    </FadeInView>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Text style={[styles.headerTitle, {color: colors.text}]}>Pending Applications</Text>
      <Text style={[styles.subtitle, {color: colors.textMuted}]}>Review and approve new partners.</Text>

      {loading ? (
        <ActivityIndicator color={colors.tint} style={{marginTop: 50}} />
      ) : (
        <FlatList
            data={applicants}
            renderItem={renderApplicant}
            keyExtractor={(item: any) => item._id}
            contentContainerStyle={{paddingBottom: 20, paddingTop: 20}}
            ListEmptyComponent={
                <View style={{alignItems: 'center', marginTop: 50, opacity: 0.5}}>
                    <ShieldAlert size={48} color={colors.textMuted} />
                    <Text style={{color: colors.textMuted, marginTop: 10}}>No pending requests.</Text>
                </View>
            }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginBottom: 10 },

  card: { padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  bizName: { fontWeight: 'bold', fontSize: 18 },
  userName: { fontSize: 14, marginTop: 2 },
  sub: { fontSize: 12, marginVertical: 12 },

  badge: { backgroundColor: 'rgba(234, 179, 8, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { color: '#eab308', fontSize: 10, fontWeight: 'bold' },

  actionRow: { flexDirection: 'row', gap: 12 },
  approveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, gap: 8 },
  approveText: { color: '#0f172a', fontWeight: 'bold' },
  rejectBtn: { flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, gap: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  rejectText: { color: '#ef4444', fontWeight: 'bold' },
});
