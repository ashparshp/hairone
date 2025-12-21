import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, KeyboardAvoidingView, ScrollView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { ChevronLeft, User, Clock, Plus, X, Check, Search } from 'lucide-react-native';
import { formatLocalDate } from '../../utils/date';

export default function ShopScheduleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [barbers, setBarbers] = useState([]); // For dropdown
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [blockDate, setBlockDate] = useState(() => formatLocalDate(new Date()));
  const [blockTime, setBlockTime] = useState('');
  const [blockDuration, setBlockDuration] = useState('30');
  const [blockType, setBlockType] = useState<'walk-in'|'blocked'>('walk-in');
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [blockNotes, setBlockNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const today = formatLocalDate(new Date());

  const fetchSchedule = async () => {
    // @ts-ignore
    if (!user?.myShopId) return;
    try {
      // @ts-ignore
      const res = await api.get(`/bookings/shop/${user.myShopId}?date=${today}`);
      setBookings(res.data);

      // Also fetch barbers for the dropdown
      // @ts-ignore
      const shopRes = await api.get(`/shops/${user.myShopId}`);
      setBarbers(shopRes.data.barbers);
      if (shopRes.data.barbers.length > 0) {
          setSelectedBarberId(shopRes.data.barbers[0]._id);
      }
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

  const handleCreateBlock = async () => {
      if (!blockTime || !blockDuration) return Alert.alert("Missing Fields", "Time and Duration are required");

      setSubmitting(true);
      try {
          // @ts-ignore
          await api.post('/bookings', {
              // @ts-ignore
              shopId: user.myShopId,
              barberId: selectedBarberId,
              date: blockDate,
              startTime: blockTime,
              totalDuration: parseInt(blockDuration),
              type: blockType,
              serviceNames: [blockType === 'walk-in' ? 'Walk-in Customer' : 'Blocked Slot'],
              totalPrice: 0,
              notes: blockNotes
          });
          Alert.alert("Success", "Slot added successfully");
          setShowModal(false);
          fetchSchedule();

          // Reset
          setBlockTime('');
          setBlockNotes('');
      } catch (e: any) {
          Alert.alert("Error", e.response?.data?.message || "Failed to create slot");
      } finally {
          setSubmitting(false);
      }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
      try {
          await api.patch(`/bookings/${bookingId}/status`, { status: newStatus });
          fetchSchedule(); // Refresh
      } catch (e) {
          Alert.alert("Error", "Failed to update status");
      }
  };

  const renderBooking = ({ item }: { item: any }) => (
    <View style={[styles.card, item.type === 'blocked' && { borderColor: '#ef4444', opacity: 0.8 }]}>
       <View style={styles.timeCol}>
          <Text style={styles.timeText}>{item.startTime}</Text>
          <Text style={styles.dateText}>{item.date === today ? 'Today' : item.date}</Text>
          {item.type === 'blocked' && <Text style={{color:'#ef4444', fontSize:10, fontWeight:'bold', marginTop:4}}>BLOCKED</Text>}
          {item.type === 'walk-in' && <Text style={{color:'#f59e0b', fontSize:10, fontWeight:'bold', marginTop:4}}>WALK-IN</Text>}
          {item.status === 'checked-in' && <Text style={{color:'#10b981', fontSize:10, fontWeight:'bold', marginTop:4}}>CHECKED-IN</Text>}
          {item.status === 'completed' && <Text style={{color:'#10b981', fontSize:10, fontWeight:'bold', marginTop:4}}>DONE</Text>}
          {item.status === 'no-show' && <Text style={{color:'#ef4444', fontSize:10, fontWeight:'bold', marginTop:4}}>NO-SHOW</Text>}
       </View>

       <View style={styles.detailsCol}>
          <View style={{flexDirection:'row', justifyContent:'space-between'}}>
             <Text style={styles.customerName}>
                 {item.userId?.phone ? `User: ${item.userId.phone}` : (item.notes || (item.type === 'blocked' ? 'Blocked' : 'Walk-in'))}
             </Text>
             {item.totalPrice > 0 && <View style={styles.priceTag}><Text style={styles.priceText}>₹{item.totalPrice}</Text></View>}
          </View>
          
          <View style={styles.barberRow}>
             <User size={12} color={Colors.primary} />
             <Text style={styles.barberName}>Assigned to: {item.barberId?.name}</Text>
          </View>

          <Text style={styles.services}>{item.serviceNames.join(', ')}</Text>

          {/* Pending Actions */}
          {item.status === 'pending' && (
              <View style={{flexDirection:'row', gap: 10, marginTop: 12}}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleStatusUpdate(item._id, 'upcoming')}>
                      <Check size={14} color="white" />
                      <Text style={{color:'white', fontWeight:'bold', fontSize: 12}}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleStatusUpdate(item._id, 'cancelled')}>
                      <X size={14} color="white" />
                      <Text style={{color:'white', fontWeight:'bold', fontSize: 12}}>Reject</Text>
                  </TouchableOpacity>
              </View>
          )}

          {/* Upcoming: Check In / No-Show */}
          {item.status === 'upcoming' && (
              <View style={{flexDirection:'row', gap: 10, marginTop: 12}}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleStatusUpdate(item._id, 'checked-in')}>
                      <Check size={14} color="white" />
                      <Text style={{color:'white', fontWeight:'bold', fontSize: 12}}>Check In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.rejectBtn, {backgroundColor: '#64748b', borderColor: '#475569'}]} onPress={() => handleStatusUpdate(item._id, 'no-show')}>
                      <X size={14} color="white" />
                      <Text style={{color:'white', fontWeight:'bold', fontSize: 12}}>No Show</Text>
                  </TouchableOpacity>
              </View>
          )}

          {/* Checked-in: Complete */}
          {item.status === 'checked-in' && (
              <View style={{flexDirection:'row', gap: 10, marginTop: 12}}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleStatusUpdate(item._id, 'completed')}>
                      <Check size={14} color="white" />
                      <Text style={{color:'white', fontWeight:'bold', fontSize: 12}}>Complete</Text>
                  </TouchableOpacity>
              </View>
          )}

          {item.status === 'cancelled' && <Text style={{color:'#ef4444', fontSize:12, marginTop:6, fontStyle:'italic'}}>Cancelled</Text>}
          {item.status === 'completed' && <Text style={{color:'#10b981', fontSize:12, marginTop:6, fontStyle:'italic'}}>Completed</Text>}
          {item.status === 'no-show' && <Text style={{color:'#ef4444', fontSize:12, marginTop:6, fontStyle:'italic'}}>Marked as No-Show</Text>}
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
         <TouchableOpacity onPress={() => setShowModal(true)} style={styles.addBtn}>
             <Plus size={20} color="#0f172a" />
             <Text style={styles.addBtnText}>Block / Walk-in</Text>
         </TouchableOpacity>
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

      {/* Block/Walk-in Modal */}
      <Modal visible={showModal} transparent animationType="fade">
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBg}>
              <View style={styles.modalCard}>
                  <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>Add Slot</Text>
                      <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeBtn}>
                          <Text style={{color: Colors.textMuted, fontSize: 14, fontWeight: 'bold'}}>Close</Text>
                      </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
                      <View style={styles.segmentContainer}>
                          <TouchableOpacity
                            style={[styles.segmentBtn, blockType === 'walk-in' && styles.segmentBtnActive]}
                            onPress={() => setBlockType('walk-in')}
                          >
                              <Text style={[styles.segmentText, blockType === 'walk-in' && {color: '#0f172a', fontWeight: 'bold'}]}>Walk-in</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.segmentBtn, blockType === 'blocked' && styles.segmentBtnActive]}
                            onPress={() => setBlockType('blocked')}
                          >
                              <Text style={[styles.segmentText, blockType === 'blocked' && {color: '#0f172a', fontWeight: 'bold'}]}>Block Time</Text>
                          </TouchableOpacity>
                      </View>

                      <View style={{flexDirection:'row', gap: 12, marginBottom: 16}}>
                          <View style={{flex:1}}>
                             <Text style={styles.label}>Time (HH:mm)</Text>
                             <TextInput style={styles.input} value={blockTime} onChangeText={setBlockTime} placeholder="14:30" placeholderTextColor="#64748b"/>
                          </View>
                          <View style={{flex:1}}>
                             <Text style={styles.label}>Duration (min)</Text>
                             <TextInput style={styles.input} value={blockDuration} onChangeText={setBlockDuration} keyboardType="numeric" />
                          </View>
                      </View>

                      <Text style={styles.label}>Assign Barber</Text>
                      <View style={{flexDirection:'row', flexWrap:'wrap', gap: 8, marginTop: 8, marginBottom: 16}}>
                          {barbers.map((b: any) => (
                              <TouchableOpacity
                                key={b._id}
                                style={[styles.chip, selectedBarberId === b._id && styles.chipActive]}
                                onPress={() => setSelectedBarberId(b._id)}
                              >
                                  <Text style={{color: selectedBarberId === b._id ? '#0f172a' : Colors.textMuted, fontSize: 12}}>{b.name}</Text>
                              </TouchableOpacity>
                          ))}
                      </View>

                      <Text style={styles.label}>Notes / Customer Name</Text>
                      <TextInput
                        style={[styles.input, {height: 80, textAlignVertical: 'top'}]}
                        value={blockNotes}
                        onChangeText={setBlockNotes}
                        placeholder={blockType === 'walk-in' ? "Customer Name" : "Reason for blocking"}
                        placeholderTextColor="#64748b"
                        multiline
                      />

                      <View style={{flexDirection:'row', gap: 12, marginTop: 24}}>
                          <TouchableOpacity style={[styles.modalBtn, {backgroundColor:'#334155'}]} onPress={() => setShowModal(false)}>
                              <Text style={{color:'white', fontWeight: '600'}}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.modalBtn, {backgroundColor:Colors.primary}]} onPress={handleCreateBlock} disabled={submitting}>
                              {submitting ? <ActivityIndicator color="#0f172a"/> : <Text style={{color:'#0f172a', fontWeight:'bold'}}>Create Slot</Text>}
                          </TouchableOpacity>
                      </View>
                  </ScrollView>
              </View>
          </KeyboardAvoidingView>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', color: 'white', marginLeft: 16, flex: 1 },
  addBtn: { flexDirection:'row', alignItems:'center', backgroundColor: Colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  addBtnText: { color: '#0f172a', fontWeight:'bold', fontSize: 12 },

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

  approveBtn: { flexDirection:'row', alignItems:'center', gap: 4, backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  rejectBtn: { flexDirection:'row', alignItems:'center', gap: 4, backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent:'center', padding: 20 },
  modalCard: { backgroundColor: Colors.card, padding: 20, borderRadius: 20, maxHeight: '80%', width: '100%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight:'bold', color:'white' },
  closeBtn: { padding: 4 },
  modalBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems:'center' },
  label: { color: Colors.textMuted, fontSize: 12, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: '#0f172a', color: 'white', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155', fontSize: 14 },

  segmentContainer: { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: '#334155' },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentBtnActive: { backgroundColor: Colors.primary },
  segmentText: { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },

  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a' },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary }
});