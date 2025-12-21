import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, KeyboardAvoidingView, ScrollView, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FadeInView } from '../../components/AnimatedViews';
import api from '../../services/api';
import { ChevronLeft, User, Clock, Plus, X, Check, Search } from 'lucide-react-native';
import { formatLocalDate } from '../../utils/date';

export default function ShopScheduleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const isDark = theme === 'dark';

  const [bookings, setBookings] = useState([]);
  const [barbers, setBarbers] = useState([]); 
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
      if (!blockTime || !blockDuration) {
          showToast("Time and Duration are required", "error");
          return;
      }

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
          showToast("Slot added successfully", "success");
          setShowModal(false);
          fetchSchedule();
          setBlockTime('');
          setBlockNotes('');
      } catch (e: any) {
          showToast(e.response?.data?.message || "Failed to create slot", "error");
      } finally {
          setSubmitting(false);
      }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
      try {
          await api.patch(`/bookings/${bookingId}/status`, { status: newStatus });
          fetchSchedule(); 
          showToast(`Status updated to ${newStatus}`, "success");
      } catch (e) {
          showToast("Failed to update status", "error");
      }
  };

  const renderBooking = ({ item, index }: { item: any, index: number }) => (
    <FadeInView delay={index * 50}>
    <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}, item.type === 'blocked' && { borderColor: '#ef4444', opacity: 0.8 }]}>
       {/* UPDATED: Time column background now uses colors.background in dark mode */}
       <View style={[styles.timeCol, {backgroundColor: isDark ? colors.background : '#e2e8f0', borderColor: colors.border}]}>
          <Text style={[styles.timeText, {color: colors.text}]}>{item.startTime}</Text>
          <Text style={[styles.dateText, {color: colors.textMuted}]}>{item.date === today ? 'Today' : item.date}</Text>
          {item.type === 'blocked' && <Text style={{color:'#ef4444', fontSize:10, fontWeight:'bold', marginTop:4}}>BLOCKED</Text>}
          {item.type === 'walk-in' && <Text style={{color: colors.tint, fontSize:10, fontWeight:'bold', marginTop:4}}>WALK-IN</Text>}
          {item.status === 'checked-in' && <Text style={{color:'#10b981', fontSize:10, fontWeight:'bold', marginTop:4}}>CHECKED-IN</Text>}
          {item.status === 'completed' && <Text style={{color:'#10b981', fontSize:10, fontWeight:'bold', marginTop:4}}>DONE</Text>}
          {item.status === 'no-show' && <Text style={{color:'#ef4444', fontSize:10, fontWeight:'bold', marginTop:4}}>NO-SHOW</Text>}
       </View>

       <View style={styles.detailsCol}>
          <View style={{flexDirection:'row', justifyContent:'space-between'}}>
             <Text style={[styles.customerName, {color: colors.text}]}>
                 {item.userId?.phone ? `User: ${item.userId.phone}` : (item.notes || (item.type === 'blocked' ? 'Blocked' : 'Walk-in'))}
             </Text>
             {item.totalPrice > 0 && <View style={styles.priceTag}><Text style={styles.priceText}>₹{item.totalPrice}</Text></View>}
          </View>
          
          <View style={styles.barberRow}>
             <User size={12} color={colors.tint} />
             <Text style={[styles.barberName, {color: colors.tint}]}>Assigned to: {item.barberId?.name}</Text>
          </View>

          <Text style={[styles.services, {color: colors.textMuted}]}>{item.serviceNames.join(', ')}</Text>

          {/* Pending Actions */}
          {item.status === 'pending' && (
              <View style={{flexDirection:'row', gap: 10, marginTop: 12}}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleStatusUpdate(item._id, 'upcoming')}>
                      <Check size={14} color="#000000" />
                      <Text style={{color:'#000000', fontWeight:'bold', fontSize: 12}}>Approve</Text>
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
                      <Check size={14} color="#000000" />
                      <Text style={{color:'#000000', fontWeight:'bold', fontSize: 12}}>Check In</Text>
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
                      <Check size={14} color="#000000" />
                      <Text style={{color:'#000000', fontWeight:'bold', fontSize: 12}}>Complete</Text>
                  </TouchableOpacity>
              </View>
          )}

          {item.status === 'cancelled' && <Text style={{color:'#ef4444', fontSize:12, marginTop:6, fontStyle:'italic'}}>Cancelled</Text>}
          {item.status === 'completed' && <Text style={{color:'#10b981', fontSize:12, marginTop:6, fontStyle:'italic'}}>Completed</Text>}
          {item.status === 'no-show' && <Text style={{color:'#ef4444', fontSize:12, marginTop:6, fontStyle:'italic'}}>Marked as No-Show</Text>}
       </View>
    </View>
    </FadeInView>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Today's Schedule</Text>
         <TouchableOpacity onPress={() => setShowModal(true)} style={[styles.addBtn, {backgroundColor: colors.tint}]}>
             <Plus size={20} color="#000000" />
             <Text style={[styles.addBtnText, {color: '#000000'}]}>Block / Walk-in</Text>
         </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{marginTop: 50}} color={colors.tint} />
      ) : (
        <FlatList 
          data={bookings}
          renderItem={renderBooking}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={{padding: 20}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchSchedule();}} tintColor={colors.tint} />}
          ListEmptyComponent={
            <View style={{alignItems:'center', marginTop: 100}}>
                <Clock size={48} color={colors.textMuted} />
                <Text style={{color: colors.textMuted, marginTop: 16}}>No bookings for today yet.</Text>
            </View>
          }
        />
      )}

      {/* Block/Walk-in Modal */}
      <Modal visible={showModal} transparent animationType="slide">
          <View style={styles.modalBg}>
              <View style={[styles.modalCard, {backgroundColor: colors.card}]}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                      <Text style={[styles.modalTitle, {color: colors.text}]}>Add Slot</Text>
                      <TouchableOpacity onPress={() => setShowModal(false)}>
                          <Text style={{color: colors.textMuted, fontWeight: 'bold'}}>Close</Text>
                      </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
                  <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                  {/* UPDATED: Segment background to True Black in dark mode */}
                  <View style={[styles.segmentContainer, {backgroundColor: isDark ? colors.background : '#f1f5f9', borderColor: colors.border}]}>
                      <TouchableOpacity
                        style={[styles.segmentBtn, blockType === 'walk-in' && {backgroundColor: colors.tint}]}
                        onPress={() => setBlockType('walk-in')}
                      >
                          <Text style={[styles.segmentText, {color: colors.textMuted}, blockType === 'walk-in' && {color: '#000000', fontWeight: 'bold'}]}>Walk-in</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.segmentBtn, blockType === 'blocked' && {backgroundColor: colors.tint}]}
                        onPress={() => setBlockType('blocked')}
                      >
                          <Text style={[styles.segmentText, {color: colors.textMuted}, blockType === 'blocked' && {color: '#000000', fontWeight: 'bold'}]}>Block Time</Text>
                      </TouchableOpacity>
                  </View>

                  <View style={{flexDirection:'row', gap: 10}}>
                      <View style={{flex:1}}>
                         <Text style={[styles.label, {color: colors.textMuted}]}>Time (HH:mm)</Text>
                         {/* UPDATED: Input background to True Black in dark mode */}
                         <TextInput
                            style={[styles.input, {backgroundColor: isDark ? colors.background : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                            value={blockTime}
                            onChangeText={setBlockTime}
                            placeholder="14:30"
                            placeholderTextColor={colors.textMuted}
                         />
                      </View>
                      <View style={{flex:1}}>
                         <Text style={[styles.label, {color: colors.textMuted}]}>Duration (min)</Text>
                         <TextInput
                            style={[styles.input, {backgroundColor: isDark ? colors.background : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                            value={blockDuration}
                            onChangeText={setBlockDuration}
                            keyboardType="numeric"
                         />
                      </View>
                  </View>

                  <Text style={[styles.label, {marginTop: 12, color: colors.textMuted}]}>Assign Barber</Text>
                  <View style={{flexDirection:'row', flexWrap:'wrap', gap: 8, marginTop: 4, marginBottom: 12}}>
                      {barbers.map((b: any) => (
                          <TouchableOpacity
                            key={b._id}
                            style={[styles.chip, {backgroundColor: isDark ? colors.background : '#f8fafc', borderColor: colors.border}, selectedBarberId === b._id && {backgroundColor: colors.tint, borderColor: colors.tint}]}
                            onPress={() => setSelectedBarberId(b._id)}
                          >
                              <Text style={{color: selectedBarberId === b._id ? '#000000' : colors.textMuted}}>{b.name}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>

                  <Text style={[styles.label, {color: colors.textMuted}]}>Notes / Customer Name</Text>
                  <TextInput
                    style={[styles.input, {backgroundColor: isDark ? colors.background : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                    value={blockNotes}
                    onChangeText={setBlockNotes}
                    placeholder="Reason or Name"
                    placeholderTextColor={colors.textMuted}
                  />

                  <View style={{flexDirection:'row', gap: 10, marginTop: 20}}>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: isDark ? colors.border : '#e2e8f0'}]} onPress={() => setShowModal(false)}>
                          <Text style={{color: colors.text}}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: colors.tint}]} onPress={handleCreateBlock} disabled={submitting}>
                          {submitting ? <ActivityIndicator color="#000000"/> : <Text style={{color:'#000000', fontWeight:'bold'}}>Create</Text>}
                      </TouchableOpacity>
                  </View>
                  </KeyboardAvoidingView>
                  </ScrollView>
              </View>
          </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title: { fontSize: 20, fontWeight: 'bold', marginLeft: 16, flex: 1 },
  addBtn: { flexDirection:'row', alignItems:'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 4 },
  addBtnText: { fontWeight:'bold', fontSize: 12 },

  card: { flexDirection: 'row', borderRadius: 12, marginBottom: 12, overflow: 'hidden', borderWidth: 1 },
  timeCol: { padding: 16, alignItems: 'center', justifyContent: 'center', width: 80, borderRightWidth: 1 },
  timeText: { fontWeight: 'bold', fontSize: 16 },
  dateText: { fontSize: 10, marginTop: 4 },
  detailsCol: { flex: 1, padding: 12 },
  customerName: { fontWeight: 'bold', fontSize: 14 },
  barberRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  barberName: { fontSize: 12, fontWeight: '600' },
  services: { fontSize: 12, marginTop: 6 },
  priceTag: { backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  priceText: { color: '#10b981', fontSize: 10, fontWeight: 'bold' },

  approveBtn: { flexDirection:'row', alignItems:'center', gap: 4, backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  rejectBtn: { flexDirection:'row', alignItems:'center', gap: 4, backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent:'center', padding: 20 },
  modalCard: { padding: 20, borderRadius: 16, maxHeight: '80%', width: '100%' },
  modalTitle: { fontSize: 20, fontWeight:'bold', marginBottom: 20 },
  modalBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems:'center' },
  label: { fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: { padding: 12, borderRadius: 8, borderWidth: 1 },

  segmentContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentText: { fontSize: 14, fontWeight: '500' },

  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
});
