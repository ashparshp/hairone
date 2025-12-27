import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, RefreshControl, Modal, TextInput, Alert, KeyboardAvoidingView, ScrollView, Platform, SectionList, Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FadeInView } from '../../components/AnimatedViews';
import api from '../../services/api';
import { ChevronLeft, User, Clock, Plus, X, Check, Calendar as CalendarIcon, Filter, Phone, MapPin, Home } from 'lucide-react-native';
import { formatLocalDate } from '../../utils/date';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function ShopScheduleScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();

  const [bookings, setBookings] = useState([]);
  const [barbers, setBarbers] = useState([]); // For dropdown
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter State
  const [activeFilter, setActiveFilter] = useState('today'); // 'today', 'upcoming', 'history', 'custom'
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [blockDate, setBlockDate] = useState(() => formatLocalDate(new Date()));
  const [blockTime, setBlockTime] = useState('');
  const [blockDuration, setBlockDuration] = useState('30');
  const [blockType, setBlockType] = useState<'walk-in'|'blocked'>('walk-in');
  const [selectedBarberId, setSelectedBarberId] = useState('');
  const [blockNotes, setBlockNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Check-In PIN Modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [checkInBookingId, setCheckInBookingId] = useState<string | null>(null);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  const todayStr = formatLocalDate(new Date());

  // Helper to safely get shopId
  // @ts-ignore
  const getShopId = () => typeof user?.myShopId === 'object' ? user.myShopId._id : user?.myShopId;

  const fetchSchedule = async () => {
    const shopId = getShopId();
    if (!shopId) return;

    try {
      let url = `/bookings/shop/${shopId}`;
      const params = new URLSearchParams();

      if (activeFilter === 'today') {
        params.append('date', todayStr);
      } else if (activeFilter === 'upcoming') {
        params.append('startDate', todayStr);
      } else if (activeFilter === 'history') {
        const past = new Date();
        past.setDate(past.getDate() - 30);
        params.append('startDate', formatLocalDate(past));
        params.append('endDate', formatLocalDate(new Date())); 
      } else if (activeFilter === 'custom') {
        params.append('startDate', formatLocalDate(startDate));
        params.append('endDate', formatLocalDate(endDate));
      }

      // @ts-ignore
      const res = await api.get(`${url}?${params.toString()}`);
      setBookings(res.data);

      // Also fetch barbers for the dropdown
      // @ts-ignore
      const shopRes = await api.get(`/shops/${shopId}`);
      setBarbers(shopRes.data.barbers);
      if (shopRes.data.barbers.length > 0 && !selectedBarberId) {
          setSelectedBarberId(shopRes.data.barbers[0]._id);
      }
    } catch (e) {
      console.log(e);
      showToast("Failed to fetch schedule", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [activeFilter, startDate, endDate]);

  const handleCreateBlock = async () => {
      if (!blockTime || !blockDuration) {
          showToast("Time and Duration are required", "error");
          return;
      }

      setSubmitting(true);
      try {
          const shopId = getShopId();
          // @ts-ignore
          await api.post('/bookings', {
              shopId: shopId,
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

          // Reset
          setBlockTime('');
          setBlockNotes('');
      } catch (e: any) {
          showToast(e.response?.data?.message || "Failed to create slot", "error");
      } finally {
          setSubmitting(false);
      }
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: string, pin?: string) => {
      try {
          const payload: any = { status: newStatus };
          if (pin) payload.bookingKey = pin;

          await api.patch(`/bookings/${bookingId}/status`, payload);
          fetchSchedule(); // Refresh
          showToast(`Status updated to ${newStatus}`, "success");

          if (newStatus === 'checked-in') {
              setShowPinModal(false);
              setEnteredPin('');
              setCheckInBookingId(null);
              setPinError('');
          }
      } catch (e: any) {
          if (e.response?.status === 403 && pin) {
              setPinError("Incorrect PIN");
          } else {
              showToast(e.response?.data?.message || "Failed to update status", "error");
          }
      }
  };

  const promptCheckIn = (bookingId: string) => {
      setCheckInBookingId(bookingId);
      setEnteredPin('');
      setPinError('');
      setShowPinModal(true);
  };

  const groupBookingsByDate = (bookings: any[]) => {
      const grouped: any = {};
      bookings.forEach(b => {
          if (!grouped[b.date]) grouped[b.date] = [];
          grouped[b.date].push(b);
      });

      const keys = Object.keys(grouped).sort();

      return keys.map(date => ({
          title: date === todayStr ? 'Today' : date,
          data: grouped[date]
      }));
  };

  const renderSectionHeader = ({ section: { title } }: any) => (
      <View style={[styles.sectionHeader, {backgroundColor: colors.background}]}>
          <Text style={[styles.sectionHeaderText, {color: colors.text}]}>{title}</Text>
      </View>
  );

  const renderBooking = ({ item, index }: { item: any, index: number }) => (
    <FadeInView delay={index * 50}>
    <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}, item.type === 'blocked' && { borderColor: '#ef4444', opacity: 0.8 }]}>
       <View style={[styles.timeCol, {backgroundColor: theme === 'dark' ? '#1e293b' : '#e2e8f0', borderColor: colors.border}]}>
          <Text style={[styles.timeText, {color: colors.text}]}>{item.startTime}</Text>
          {item.type === 'blocked' && <Text style={{color:'#ef4444', fontSize:10, fontWeight:'bold', marginTop:4}}>BLOCKED</Text>}
          {item.type === 'walk-in' && <Text style={{color: colors.tint, fontSize:10, fontWeight:'bold', marginTop:4}}>WALK-IN</Text>}

          {item.isHomeService && (
              <View style={[styles.badge, {backgroundColor: colors.tint, marginTop: 6}]}>
                  <Home size={10} color="black" />
                  <Text style={{color:'black', fontSize:9, fontWeight:'bold'}}>HOME</Text>
              </View>
          )}

          {item.status === 'checked-in' && <Text style={{color:'#10b981', fontSize:10, fontWeight:'bold', marginTop:4}}>CHECKED-IN</Text>}
          {item.status === 'completed' && <Text style={{color:'#10b981', fontSize:10, fontWeight:'bold', marginTop:4}}>DONE</Text>}
          {item.status === 'no-show' && <Text style={{color:'#ef4444', fontSize:10, fontWeight:'bold', marginTop:4}}>NO-SHOW</Text>}
       </View>

       <View style={styles.detailsCol}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems: 'flex-start'}}>
             <View style={{flex: 1, paddingRight: 8}}>
                 <Text style={[styles.customerName, {color: colors.text}]}>
                     {item.userId?.name || (item.type === 'blocked' ? 'Blocked Slot' : 'Guest Customer')}
                 </Text>
                 {item.userId?.phone && (
                     <TouchableOpacity onPress={() => Linking.openURL(`tel:${item.userId.phone}`)} style={{flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4}}>
                         <Phone size={12} color={colors.tint} />
                         <Text style={{color: colors.tint, fontSize: 12, textDecorationLine: 'underline'}}>{item.userId.phone}</Text>
                     </TouchableOpacity>
                 )}
                 {item.isHomeService && item.deliveryAddress && (
                     <TouchableOpacity
                        style={{marginTop: 6, flexDirection: 'row', gap: 6, alignItems:'flex-start'}}
                        onPress={() => {
                            if (item.deliveryAddress?.coordinates?.lat) {
                                const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
                                const latLng = `${item.deliveryAddress.coordinates.lat},${item.deliveryAddress.coordinates.lng}`;
                                const label = item.deliveryAddress.line1 || 'Customer Location';
                                const url = Platform.select({
                                    ios: `${scheme}${label}@${latLng}`,
                                    android: `${scheme}${latLng}(${label})`
                                });
                                Linking.openURL(url!);
                            }
                        }}
                     >
                         <MapPin size={14} color="#f59e0b" style={{marginTop: 2}} />
                         <Text style={{color: colors.text, fontSize: 12, flex: 1}} numberOfLines={2}>
                             {item.deliveryAddress.line1 || 'Location set'}
                         </Text>
                     </TouchableOpacity>
                 )}
                 {item.notes && <Text style={{color: colors.textMuted, fontSize: 10, marginTop: 4, fontStyle:'italic'}}>"{item.notes}"</Text>}
             </View>
             {item.totalPrice > 0 && <View style={styles.priceTag}><Text style={styles.priceText}>₹{item.totalPrice}</Text></View>}
          </View>
          
          <View style={styles.barberRow}>
             <User size={12} color={colors.tint} />
             <Text style={[styles.barberName, {color: colors.tint}]}>Assigned to: {item.barberId?.name}</Text>
          </View>

          <View style={{marginTop: 6}}>
             {item.serviceNames.map((svc: string, idx: number) => (
                 <Text key={idx} style={[styles.services, {color: colors.text}]}>• {svc}</Text>
             ))}
          </View>

          {/* Actions based on status */}
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

          {item.status === 'upcoming' && (
              <View style={{flexDirection:'row', gap: 10, marginTop: 12}}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => promptCheckIn(item._id)}>
                      <Check size={14} color="white" />
                      <Text style={{color:'white', fontWeight:'bold', fontSize: 12}}>Check In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.rejectBtn, {backgroundColor: '#64748b', borderColor: '#475569'}]} onPress={() => handleStatusUpdate(item._id, 'no-show')}>
                      <X size={14} color="white" />
                      <Text style={{color:'white', fontWeight:'bold', fontSize: 12}}>No Show</Text>
                  </TouchableOpacity>
              </View>
          )}

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
    </FadeInView>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Shop Schedule</Text>
         <TouchableOpacity onPress={() => setShowModal(true)} style={[styles.addBtn, {backgroundColor: colors.tint}]}>
             <Plus size={20} color="#0f172a" />
             <Text style={styles.addBtnText}>Block / Walk-in</Text>
         </TouchableOpacity>
      </View>

      {/* FILTER TABS */}
      <View style={{paddingHorizontal: 20, marginBottom: 10}}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap: 8}}>
              {['today', 'upcoming', 'history', 'custom'].map(filter => (
                  <TouchableOpacity
                    key={filter}
                    style={[
                        styles.filterChip,
                        { backgroundColor: activeFilter === filter ? colors.tint : (theme === 'dark' ? '#1e293b' : '#e2e8f0') }
                    ]}
                    onPress={() => setActiveFilter(filter)}
                  >
                      <Text style={{
                          color: activeFilter === filter ? '#0f172a' : colors.textMuted,
                          fontWeight: 'bold',
                          textTransform: 'capitalize'
                      }}>
                          {filter}
                      </Text>
                  </TouchableOpacity>
              ))}
          </ScrollView>

          {activeFilter === 'custom' && (
              <View style={{flexDirection:'row', alignItems:'center', gap: 10, marginTop: 10}}>
                  <TouchableOpacity onPress={() => setShowStartPicker(true)} style={[styles.dateInput, {borderColor: colors.border}]}>
                      <CalendarIcon size={14} color={colors.textMuted} />
                      <Text style={{color: colors.text}}>{formatLocalDate(startDate)}</Text>
                  </TouchableOpacity>
                  <Text style={{color: colors.textMuted}}>to</Text>
                  <TouchableOpacity onPress={() => setShowEndPicker(true)} style={[styles.dateInput, {borderColor: colors.border}]}>
                      <CalendarIcon size={14} color={colors.textMuted} />
                      <Text style={{color: colors.text}}>{formatLocalDate(endDate)}</Text>
                  </TouchableOpacity>
              </View>
          )}
      </View>

      {showStartPicker && (
        <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
                setShowStartPicker(Platform.OS === 'ios');
                if (selectedDate) setStartDate(selectedDate);
            }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={(event, selectedDate) => {
                setShowEndPicker(Platform.OS === 'ios');
                if (selectedDate) setEndDate(selectedDate);
            }}
        />
      )}

      {loading ? (
        <ActivityIndicator style={{marginTop: 50}} color={colors.tint} />
      ) : (
        <SectionList
          sections={groupBookingsByDate(bookings)}
          keyExtractor={(item: any) => item._id}
          renderItem={renderBooking}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={{padding: 20, paddingBottom: 100}}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchSchedule();}} tintColor={colors.tint} />}
          ListEmptyComponent={
            <View style={{alignItems:'center', marginTop: 100}}>
                <Clock size={48} color={colors.textMuted} />
                <Text style={{color: colors.textMuted, marginTop: 16}}>No bookings found.</Text>
            </View>
          }
          stickySectionHeadersEnabled={false}
        />
      )}

      {/* PIN Verification Modal */}
      <Modal visible={showPinModal} transparent animationType="fade">
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{flex: 1}}
          >
            <View style={styles.modalBg}>
                <View style={[styles.modalCard, {backgroundColor: colors.card, maxWidth: 320}]}>
                    <Text style={[styles.modalTitle, {color: colors.text}]}>Verify Booking</Text>
                    {pinError ? (
                        <Text style={{color: '#ef4444', marginBottom: 16, fontWeight: 'bold'}}>{pinError}</Text>
                    ) : (
                        <Text style={{color: colors.textMuted, marginBottom: 16}}>Ask the customer for their 4-digit PIN.</Text>
                    )}

                    <TextInput
                      style={[styles.input, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: pinError ? '#ef4444' : colors.border, textAlign: 'center', fontSize: 24, letterSpacing: 8}]}
                      value={enteredPin}
                      onChangeText={(t) => { setEnteredPin(t); setPinError(''); }}
                      placeholder="0000"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={4}
                    />

                    <View style={{flexDirection:'row', gap: 10, marginTop: 20}}>
                        <TouchableOpacity style={[styles.modalBtn, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]} onPress={() => setShowPinModal(false)}>
                            <Text style={{color: colors.text}}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.modalBtn, {backgroundColor: colors.tint}]}
                          onPress={() => checkInBookingId && handleStatusUpdate(checkInBookingId, 'checked-in', enteredPin)}
                        >
                            <Text style={{color:'#0f172a', fontWeight:'bold'}}>Verify</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
          </KeyboardAvoidingView>
      </Modal>

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
                  <View style={[styles.segmentContainer, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9', borderColor: colors.border}]}>
                      <TouchableOpacity
                        style={[styles.segmentBtn, blockType === 'walk-in' && {backgroundColor: colors.tint}]}
                        onPress={() => setBlockType('walk-in')}
                      >
                          <Text style={[styles.segmentText, {color: colors.textMuted}, blockType === 'walk-in' && {color: '#0f172a', fontWeight: 'bold'}]}>Walk-in</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.segmentBtn, blockType === 'blocked' && {backgroundColor: colors.tint}]}
                        onPress={() => setBlockType('blocked')}
                      >
                          <Text style={[styles.segmentText, {color: colors.textMuted}, blockType === 'blocked' && {color: '#0f172a', fontWeight: 'bold'}]}>Block Time</Text>
                      </TouchableOpacity>
                  </View>

                  <View style={{flexDirection:'row', gap: 10}}>
                      <View style={{flex:1}}>
                         <Text style={[styles.label, {color: colors.textMuted}]}>Time (HH:mm)</Text>
                         <TextInput
                            style={[styles.input, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                            value={blockTime}
                            onChangeText={setBlockTime}
                            placeholder="14:30"
                            placeholderTextColor={colors.textMuted}
                         />
                      </View>
                      <View style={{flex:1}}>
                         <Text style={[styles.label, {color: colors.textMuted}]}>Duration (min)</Text>
                         <TextInput
                            style={[styles.input, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
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
                            style={[styles.chip, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', borderColor: colors.border}, selectedBarberId === b._id && {backgroundColor: colors.tint, borderColor: colors.tint}]}
                            onPress={() => setSelectedBarberId(b._id)}
                          >
                              <Text style={{color: selectedBarberId === b._id ? '#0f172a' : colors.textMuted}}>{b.name}</Text>
                          </TouchableOpacity>
                      ))}
                  </View>

                  <Text style={[styles.label, {color: colors.textMuted}]}>Notes / Customer Name</Text>
                  <TextInput
                    style={[styles.input, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                    value={blockNotes}
                    onChangeText={setBlockNotes}
                    placeholder="Reason or Name"
                    placeholderTextColor={colors.textMuted}
                  />

                  <View style={{flexDirection:'row', gap: 10, marginTop: 20}}>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]} onPress={() => setShowModal(false)}>
                          <Text style={{color: colors.text}}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: colors.tint}]} onPress={handleCreateBlock} disabled={submitting}>
                          {submitting ? <ActivityIndicator color="#0f172a"/> : <Text style={{color:'#0f172a', fontWeight:'bold'}}>Create</Text>}
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
  addBtnText: { color: '#0f172a', fontWeight:'bold', fontSize: 12 },

  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  dateInput: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, flex: 1 },

  sectionHeader: { paddingVertical: 8, paddingHorizontal: 20, marginBottom: 8 },
  sectionHeaderText: { fontWeight: 'bold', fontSize: 18 },

  card: { flexDirection: 'row', borderRadius: 12, marginBottom: 12, overflow: 'hidden', borderWidth: 1 },
  timeCol: { padding: 16, alignItems: 'center', justifyContent: 'center', width: 80, borderRightWidth: 1 },
  timeText: { fontWeight: 'bold', fontSize: 16 },
  detailsCol: { flex: 1, padding: 12 },
  customerName: { fontWeight: 'bold', fontSize: 14 },
  barberRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  barberName: { fontSize: 12, fontWeight: '600' },
  services: { fontSize: 12, marginTop: 6 },
  priceTag: { backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  priceText: { color: '#10b981', fontSize: 10, fontWeight: 'bold' },

  approveBtn: { flexDirection:'row', alignItems:'center', gap: 4, backgroundColor: '#10b981', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  rejectBtn: { flexDirection:'row', alignItems:'center', gap: 4, backgroundColor: '#ef4444', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },

  // Modal
  modalBg: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    justifyContent:'center', 
    alignItems: 'center', // FIXED: Centers the modal horizontally
    padding: 20 
  },
  modalCard: { padding: 20, borderRadius: 16, maxHeight: '80%', width: '100%' },
  modalTitle: { fontSize: 20, fontWeight:'bold', marginBottom: 20 },
  modalBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems:'center' },
  label: { fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: { padding: 12, borderRadius: 8, borderWidth: 1 },

  segmentContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 20, borderWidth: 1 },
  segmentBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentText: { fontSize: 14, fontWeight: '500' },

  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },

  badge: { flexDirection:'row', alignItems:'center', gap: 2, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
});
