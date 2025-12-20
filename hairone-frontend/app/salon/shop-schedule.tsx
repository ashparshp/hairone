import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { ChevronLeft, User, Clock, CheckCircle, XCircle } from 'lucide-react-native';

export default function ShopScheduleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const fetchSchedule = async () => {
    // @ts-ignore
    if (!user?.myShopId) return;
    try {
      // @ts-ignore
      const res = await api.get(`/bookings/shop/${user.myShopId}?date=${today}`);
      setBookings(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, []);

  const handleStatusUpdate = async (bookingId: string, status: 'completed' | 'no-show') => {
    try {
      await api.patch(`/bookings/${bookingId}/status`, { status });
      fetchSchedule(); // Refresh list
    } catch (e) {
      Alert.alert("Error", "Failed to update status");
    }
  };

  const renderBooking = ({ item }: { item: any }) => (
    <View style={styles.card}>
       <View style={styles.timeCol}>
          <Text style={styles.timeText}>{item.startTime}</Text>
          <Text style={styles.dateText}>{item.date === today ? 'Today' : item.date}</Text>
       </View>

       <View style={styles.detailsCol}>
          <View style={{flexDirection:'row', justifyContent:'space-between'}}>
             <Text style={styles.customerName}>User: {item.userId?.phone || 'Guest'}</Text>
             <View style={styles.priceTag}><Text style={styles.priceText}>₹{item.totalPrice}</Text></View>
          </View>
          
          <View style={styles.barberRow}>
             <User size={12} color={Colors.primary} />
             <Text style={styles.barberName}>Assigned to: {item.barberId?.name}</Text>
          </View>

          <Text style={styles.services}>{item.serviceNames.join(', ')}</Text>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            {item.status === 'upcoming' ? (
              <>
                <TouchableOpacity style={styles.noshowBtn} onPress={() => handleStatusUpdate(item._id, 'no-show')}>
                   <XCircle size={14} color="#ef4444" />
                   <Text style={styles.noshowText}>No-Show</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.completeBtn} onPress={() => handleStatusUpdate(item._id, 'completed')}>
                   <CheckCircle size={14} color="#0f172a" />
                   <Text style={styles.completeText}>Complete</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={[
                styles.statusBadge,
                { backgroundColor: item.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' :
                                   item.status === 'no-show' ? 'rgba(239, 68, 68, 0.1)' : '#f1f5f9' }
              ]}>
                <Text style={{
                   fontWeight: 'bold',
                   fontSize: 12,
                   color: item.status === 'completed' ? '#10b981' :
                          item.status === 'no-show' ? '#ef4444' : '#64748b'
                }}>
                  {item.status.toUpperCase()}
                </Text>
              </View>
            )}
          </View>
       </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft size={24} color="white"/>
         </TouchableOpacity>
         <Text style={styles.title}>Today's Schedule</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{marginTop: 50}} color={Colors.primary} />
      ) : (
        <FlatList 
          data={bookings}
          renderItem={renderBooking}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={{padding: 20}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchSchedule();}} tintColor={Colors.primary} />}
          ListEmptyComponent={
            <View style={{alignItems:'center', marginTop: 100}}>
                <Clock size={48} color="#334155" />
                <Text style={{color: Colors.textMuted, marginTop: 16}}>No bookings for today yet.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: 'white', marginLeft: 16 },
  card: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: 12, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  timeCol: { backgroundColor: '#1e293b', padding: 16, alignItems: 'center', justifyContent: 'center', width: 80, borderRightWidth: 1, borderRightColor: Colors.border },
  timeText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  dateText: { color: Colors.textMuted, fontSize: 10, marginTop: 4 },
  detailsCol: { flex: 1, padding: 12 },
  customerName: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  barberRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  barberName: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  services: { color: Colors.textMuted, fontSize: 12, marginTop: 6 },
  priceTag: { backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  priceText: { color: '#10b981', fontSize: 10, fontWeight: 'bold' },

  actionRow: { flexDirection: 'row', marginTop: 12, gap: 10 },
  completeBtn: { flex: 1, backgroundColor: Colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 8, gap: 6 },
  completeText: { color: '#0f172a', fontWeight: 'bold', fontSize: 12 },
  noshowBtn: { flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.1)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, borderRadius: 8, gap: 6, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  noshowText: { color: '#ef4444', fontWeight: 'bold', fontSize: 12 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }
});