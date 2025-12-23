import { AlertTriangle, Calendar, Clock, MapPin, Phone, QrCode, RefreshCw, Star, X, CheckCircle } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Image, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useBooking } from '../../context/BookingContext';
import { useTheme } from '../../context/ThemeContext';
import { FadeInView } from '../../components/AnimatedViews';
import { formatLocalDate } from '../../utils/date';
import { createReview } from '../../services/api';

export default function BookingsScreen() {
  const { myBookings, cancelBooking, fetchBookings } = useBooking();
  const { colors, theme } = useTheme();
  const [activeTab, setActiveTab] = useState('upcoming'); 
  
  // Refresh when focused
  useFocusEffect(
    useCallback(() => {
        if(fetchBookings) fetchBookings();
    }, [])
  );
  
  // --- MODAL STATES ---
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  
  const [cancelData, setCancelData] = useState({ title: '', message: '', refundAmount: 0, isLate: false });

  // --- FIX: SAFE CHECK (myBookings || []) ---
  const safeBookings = myBookings || [];

  const upcomingBookings = safeBookings.filter((b: any) => b.status === 'upcoming' || b.status === 'pending');
  const pastBookings = safeBookings.filter((b: any) => b.status === 'completed' || b.status === 'cancelled');
  const displayList = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  const openReview = (booking: any) => {
    setSelectedBooking(booking);
    setRating(0);
    setReviewComment('');
    setReviewModalVisible(true);
  };

  const submitReview = async () => {
    if (rating === 0) return alert('Please select a rating');
    setSubmittingReview(true);
    try {
        await createReview({
            bookingId: selectedBooking._id || selectedBooking.id,
            rating,
            comment: reviewComment
        });
        setReviewModalVisible(false);
        if(fetchBookings) fetchBookings(); // Refresh to hide Rate button
        alert('Thanks for your feedback!');
    } catch (error: any) {
        alert(error.response?.data?.error || 'Failed to submit review');
    } finally {
        setSubmittingReview(false);
    }
  };

  const openTicket = (booking: any) => {
    setSelectedBooking(booking);
    setTicketModalVisible(true);
  };

  // --- HELPER: Date Parsing ---
  const parseBookingDateTime = (dateStr: string, timeStr: string) => {
    try {
        const dateParts = dateStr.split('-');
        const year = parseInt(dateParts[0]);
        const month = parseInt(dateParts[1]) - 1; 
        const day = parseInt(dateParts[2]);
        const bookingDate = new Date(year, month, day);

        const cleanTimeStr = timeStr.replace(/Next Slot|Today,|In \d+ mins/gi, '').trim();
        const timeMatch = cleanTimeStr.match(/(\d+):(\d+)\s?(AM|PM)/i);
        
        if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = parseInt(timeMatch[2]);
            const ampm = timeMatch[3].toUpperCase();
            if (ampm === 'PM' && hours < 12) hours += 12;
            if (ampm === 'AM' && hours === 12) hours = 0;
            bookingDate.setHours(hours, minutes, 0, 0);
        } else {
            const now = new Date();
            const localDateStr = formatLocalDate(now);

            if (dateStr === localDateStr) {
               return new Date(now.getTime() + 60 * 60 * 1000); 
            }
        }
        return bookingDate;
    } catch (e) {
        return new Date(); 
    }
  };

  // --- CANCELLATION LOGIC ---
  const initiateCancel = (booking: any) => {
    const bookingDateTime = parseBookingDateTime(booking.date, booking.startTime || booking.time); 
    const now = new Date();
    const diffMs = bookingDateTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    // 1. Check if past
    if (diffMs < 0) {
       alert("Cannot Cancel: This appointment time has already passed.");
       return;
    }

    // 2. Prepare Data for Custom Modal
    setSelectedBooking(booking);
    
    if (diffHours >= 2) {
        setCancelData({
            title: "Full Refund",
            message: "You are cancelling in advance. No cancellation fee applies.",
            refundAmount: booking.totalPrice || booking.price,
            isLate: false
        });
    } else {
        setCancelData({
            title: "Late Cancellation",
            message: "Cancelling within 2 hours incurs a 50% fee.",
            refundAmount: (booking.totalPrice || booking.price) / 2,
            isLate: true
        });
    }

    // 3. Show Custom Modal
    setCancelModalVisible(true);
  };

  const confirmCancel = () => {
      if (selectedBooking) {
          cancelBooking(selectedBooking._id || selectedBooking.id);
          setCancelModalVisible(false);
      }
  };

// Dynamic Call Function
const handleCall = (phoneNumber: string) => {
    if (!phoneNumber) {
        alert("Phone number not available for this shop.");
        return;
    }
    Linking.openURL(`tel:${phoneNumber}`);
};

// Dynamic Map Function
const handleMap = (lat: number, lng: number, label: string) => {
    if (!lat || !lng) {
        alert("Location coordinates not available.");
        return;
    }

    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${lat},${lng}`;
    const labelEncoded = label ? encodeURIComponent(label) : 'Shop Location';
    
    const url = Platform.select({
        ios: `${scheme}${labelEncoded}@${latLng}`,
        android: `${scheme}${latLng}(${labelEncoded})`
    });

    if (url) {
        Linking.openURL(url);
    }
};

  return (
    <>
    <View style={[styles.container, {backgroundColor: colors.background}]}>
        <View style={{paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20}}>
            <Text style={[styles.heading1, {color: colors.text}]}>My Bookings</Text>
        </View>

        <View style={styles.tabWrapper}>
            <View style={[styles.tabContainer, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9', borderColor: colors.border}]}>
                <TouchableOpacity 
                    style={[
                        styles.tab, 
                        activeTab === 'upcoming' && { 
                            backgroundColor: colors.tint,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.2,
                            shadowRadius: 1.41,
                            elevation: 2
                        }
                    ]}
                    onPress={() => setActiveTab('upcoming')}
                >
                    <Text style={[
                        styles.tabText, 
                        {color: colors.textMuted}, 
                        activeTab === 'upcoming' && {color: '#000', fontWeight: 'bold'}
                    ]}>Upcoming</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[
                        styles.tab, 
                        activeTab === 'history' && { 
                            backgroundColor: colors.tint,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.2,
                            shadowRadius: 1.41,
                            elevation: 2
                        }
                    ]}
                    onPress={() => setActiveTab('history')}
                >
                    <Text style={[
                        styles.tabText, 
                        {color: colors.textMuted}, 
                        activeTab === 'history' && {color: '#000', fontWeight: 'bold'}
                    ]}>History</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* Added paddingBottom: 120 to allow scrolling past bottom nav */}
        <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 120}}>
            {displayList.length === 0 && (
               <View style={styles.emptyState}>
                   <Calendar size={48} color={colors.textMuted} />
                   <Text style={{color: colors.textMuted, marginTop: 16}}>No {activeTab} bookings found.</Text>
               </View>
            )}

            {displayList.map((booking: any, index: number) => {
                
                // --- STATUS BADGE LOGIC ---
                let badgeBg = theme === 'dark' ? '#1e293b' : '#f1f5f9';
                let badgeText = colors.textMuted;

                if (booking.status === 'upcoming' || booking.status === 'pending') {
                    badgeBg = theme === 'dark' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.2)';
                    badgeText = colors.tint;
                } else if (booking.status === 'cancelled') {
                    // Brighter red for visibility in dark mode
                    badgeBg = theme === 'dark' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)';
                    badgeText = theme === 'dark' ? '#f87171' : '#ef4444'; 
                }

                return (
                <FadeInView key={booking._id || booking.id} delay={index * 100}>
                <View style={[styles.bookingCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                    {/* Header Row */}
                    <View style={styles.topRow}>
                        <Text style={[styles.cardTitle, {color: colors.text}]} numberOfLines={1}>{booking.barberId?.name || 'Barber'}</Text>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                            {(booking.status === 'upcoming' || booking.status === 'pending') && (
                                <>
                                    <TouchableOpacity 
                                        style={[styles.miniIconBtn, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}
                                        onPress={() => handleCall(booking.shopId?.ownerId?.phone)}
                                    >
                                        <Phone size={14} color={colors.text} />
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={[styles.miniIconBtn, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}
                                        onPress={() => handleMap(
                                            booking.shopId?.coordinates?.lat, 
                                            booking.shopId?.coordinates?.lng, 
                                            booking.shopId?.name
                                        )}
                                    >
                                        <MapPin size={14} color={colors.text} />
                                    </TouchableOpacity>
                                </>
                            )}
                            
                            <View style={[styles.statusBadge, { backgroundColor: badgeBg }]}>
                                <Text style={{
                                    color: badgeText,
                                    fontSize: 10, 
                                    fontWeight: 'bold', 
                                    textTransform: 'uppercase'
                                }}>
                                    {booking.status}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Text style={[styles.cardSub, {color: colors.textMuted}]}>Booking ID: {booking.bookingKey || '####'}</Text>
                    <View style={[styles.divider, {backgroundColor: colors.border}]} />

                    <View style={styles.infoRow}>
                        <View style={styles.iconText}>
                            <Calendar size={14} color={colors.textMuted} />
                            <Text style={[styles.infoText, {color: colors.text}]}>{booking.date}</Text>
                        </View>
                        <View style={styles.iconText}>
                            <Clock size={14} color={colors.textMuted} />
                            <Text style={[styles.infoText, {color: colors.tint}]}>{booking.startTime}</Text>
                        </View>
                        <View style={[styles.iconText, {marginLeft: 'auto'}]}>
                             <Text style={{color: colors.text, fontWeight: 'bold'}}>₹{booking.totalPrice}</Text>
                        </View>
                    </View>

                    <View style={[styles.servicesContainer, {backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc', borderColor: colors.border}]}>
                        {booking.serviceNames && booking.serviceNames.map((s: string, idx: number) => {
                            const isCombo = s.includes('(') && s.includes(')');
                            return (
                                <Text key={idx} style={[styles.serviceText, {color: isCombo ? colors.text : colors.textMuted, fontWeight: isCombo ? '500' : 'normal'}]}>
                                    • {s}
                                </Text>
                            );
                        })}
                    </View>

                    <View style={styles.cardFooter}>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Image source={{uri: booking.barberId?.avatar || "https://ui-avatars.com/api/?name=Staff"}} style={{width: 24, height: 24, borderRadius: 12, marginRight: 8}} />
                            <Text style={{color: colors.text, fontSize: 12}}>{booking.barberId?.name}</Text>
                        </View>
                        
                        <View style={{flexDirection: 'row', gap: 10}}>
                            {(booking.status === 'upcoming' || booking.status === 'pending') ? (
                               <>
                                 <TouchableOpacity style={styles.cancelBtnSmall} onPress={() => initiateCancel(booking)}>
                                    <Text style={{color: '#ffffff', fontSize: 12, fontWeight: 'bold'}}>Cancel</Text>
                                 </TouchableOpacity>
                                 
                                 <TouchableOpacity style={[styles.primaryBtnSmall, {backgroundColor: colors.tint}]} onPress={() => openTicket(booking)}>
                                    <QrCode size={14} color="#020617" style={{marginRight: 4}}/>
                                    <Text style={styles.primaryBtnText}>Ticket</Text>
                                 </TouchableOpacity>
                               </>
                            ) : (
                               <>
                                 {booking.status !== 'cancelled' && (
                                     <>
                                        <TouchableOpacity style={[styles.secondaryBtnSmall, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}>
                                            <RefreshCw size={14} color={colors.text} style={{marginRight: 4}}/>
                                            <Text style={{color: colors.text, fontSize: 12, fontWeight: 'bold'}}>Rebook</Text>
                                        </TouchableOpacity>
                                        {!booking.isRated && (
                                            <TouchableOpacity style={[styles.primaryBtnSmall, {backgroundColor: colors.tint}]} onPress={() => openReview(booking)}>
                                                <Text style={styles.primaryBtnText}>Rate</Text>
                                            </TouchableOpacity>
                                        )}
                                     </>
                                 )}
                               </>
                            )}
                        </View>
                    </View>
                </View>
                </FadeInView>
            )})}
        </ScrollView>
    </View>

    {/* --- 1. TICKET MODAL --- */}
    <Modal visible={ticketModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {alignItems: 'center', backgroundColor: colors.card, borderColor: colors.border}]}>
                <View style={{width: '100%', flexDirection: 'row', justifyContent: 'flex-end'}}>
                    <TouchableOpacity onPress={() => setTicketModalVisible(false)}><X size={24} color={colors.text} /></TouchableOpacity>
                </View>
                <Text style={[styles.heading2, {color: colors.text}]}>E-Ticket</Text>
                <Text style={{color: colors.textMuted, marginBottom: 20}}>Scan at counter</Text>
                <View style={{backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 20}}>
                    <QrCode size={150} color="black" />
                </View>
                <View style={styles.ticketInfoBox}>
                    <Text style={{color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1}}>Booking PIN</Text>
                    <Text style={{color: colors.tint, fontSize: 32, fontWeight: 'bold', letterSpacing: 4, marginVertical: 4}}>{selectedBooking?.bookingKey || '####'}</Text>
                </View>
                <TouchableOpacity style={[styles.submitBtn, {backgroundColor: colors.tint}]} onPress={() => setTicketModalVisible(false)}>
                    <Text style={{color: '#020617', fontWeight: 'bold'}}>Close Ticket</Text>
                </TouchableOpacity>
            </View>
        </View>
    </Modal>

    {/* --- 2. CUSTOM ALERT MODAL (CANCEL) --- */}
    <Modal visible={cancelModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={[styles.alertContent, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <View style={[
                    styles.alertIconBox, 
                    { backgroundColor: cancelData.isLate ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)' }
                ]}>
                    {cancelData.isLate ? (
                        <AlertTriangle size={32} color="#ef4444" />
                    ) : (
                        <CheckCircle size={32} color="#10b981" />
                    )}
                </View>
                
                <Text style={[styles.heading2, {marginTop: 16, textAlign: 'center', color: colors.text}]}>{cancelData.title}</Text>
                
                <Text style={{color: colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20}}>
                    {cancelData.message}
                </Text>

                <View style={[styles.refundBox, {backgroundColor: theme === 'dark' ? '#020617' : '#f8fafc', borderColor: colors.border}]}>
                    <Text style={{color: colors.textMuted, fontSize: 12, textTransform: 'uppercase'}}>Refund Amount</Text>
                    <Text style={{color: colors.text, fontSize: 24, fontWeight: 'bold'}}>₹{cancelData.refundAmount}</Text>
                </View>

                <View style={{flexDirection: 'row', gap: 12, width: '100%'}}>
                    <TouchableOpacity style={[styles.alertBtnSecondary, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]} onPress={() => setCancelModalVisible(false)}>
                        <Text style={{color: colors.text, fontWeight: '600'}}>Keep</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.alertBtnDestructive} onPress={confirmCancel}>
                        <Text style={{color: '#ffffff', fontWeight: 'bold'}}>Yes, Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </Modal>

    {/* --- 3. REVIEW MODAL --- */}
    <Modal visible={reviewModalVisible} transparent animationType="fade">
       <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {backgroundColor: colors.card, borderColor: colors.border}]}>
             <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
                <Text style={[styles.heading2, {color: colors.text}]}>Rate Experience</Text>
                <TouchableOpacity onPress={() => setReviewModalVisible(false)}><X size={24} color={colors.text} /></TouchableOpacity>
             </View>
             <Text style={{color: colors.textMuted, marginBottom: 20}}>Rate your experience at {selectedBooking?.barberId?.name}</Text>
             <View style={{flexDirection: 'row', justifyContent: 'center', marginBottom: 24, gap: 10}}>
                {[1,2,3,4,5].map(star => (
                   <TouchableOpacity key={star} onPress={() => setRating(star)}>
                      <Star size={32} color={star <= rating ? colors.tint : (theme === 'dark' ? '#334155' : '#cbd5e1')} fill={star <= rating ? colors.tint : 'transparent'} />
                   </TouchableOpacity>
                ))}
             </View>

             <TextInput
                style={[styles.input, {backgroundColor: theme === 'dark' ? '#1e293b' : '#f1f5f9', color: colors.text, borderColor: colors.border}]}
                placeholder="Share your experience (optional)..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                value={reviewComment}
                onChangeText={setReviewComment}
             />

             <TouchableOpacity style={[styles.submitBtn, {backgroundColor: colors.tint, opacity: submittingReview ? 0.7 : 1}]} onPress={submitReview} disabled={submittingReview}>
                {submittingReview ? <ActivityIndicator color="#020617" /> : <Text style={{color: '#020617', fontWeight: 'bold'}}>Submit Review</Text>}
             </TouchableOpacity>
          </View>
       </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heading1: { fontSize: 28, fontWeight: 'bold' },
  heading2: { fontSize: 18, fontWeight: 'bold' },
  tabWrapper: { paddingHorizontal: 20, marginBottom: 10 },
  tabContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabText: { fontSize: 14, fontWeight: '600' },
  emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.5 },
  bookingCard: { padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 8 },
  cardSub: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  miniIconBtn: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, marginVertical: 12 },
  infoRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  iconText: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, fontWeight: '500' },
  servicesContainer: { padding: 10, borderRadius: 8, marginBottom: 12, borderWidth: 1 },
  serviceText: { fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  primaryBtnSmall: { paddingHorizontal: 16, height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnSmall: { paddingHorizontal: 16, height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  
  cancelBtnSmall: { 
    backgroundColor: '#ef4444', 
    paddingHorizontal: 16, 
    height: 36, 
    borderRadius: 18, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  
  primaryBtnText: { color: '#020617', fontSize: 12, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modalContent: { padding: 24, borderRadius: 16, borderWidth: 1, width: '100%' },
  submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center', width: '100%' },
  ticketInfoBox: { alignItems: 'center', marginBottom: 24 },
  alertContent: { padding: 24, borderRadius: 24, alignItems: 'center', borderWidth: 1 },
  alertIconBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  refundBox: { width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 24, borderWidth: 1 },
  alertBtnSecondary: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  
  alertBtnDestructive: { 
    flex: 1, 
    paddingVertical: 14, 
    borderRadius: 12, 
    backgroundColor: '#ef4444', 
    alignItems: 'center' 
  },
  
  input: { width: '100%', padding: 12, borderRadius: 8, marginBottom: 20, textAlignVertical: 'top', borderWidth: 1 },
});
