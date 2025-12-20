import { AlertTriangle, Calendar, Clock, MapPin, Phone, QrCode, RefreshCw, Star, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Image, Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Colors from '../../constants/Colors';
import { useBooking } from '../../context/BookingContext';
import { formatLocalDate } from '../../utils/date';

export default function BookingsScreen() {
  const { myBookings, cancelBooking, fetchBookings } = useBooking();
  const [activeTab, setActiveTab] = useState('upcoming'); 
  
  // Refresh on mount
  useEffect(() => {
    if(fetchBookings) fetchBookings();
  }, []);
  
  // --- MODAL STATES ---
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [rating, setRating] = useState(0);
  
  const [cancelData, setCancelData] = useState({ title: '', message: '', refundAmount: 0, isLate: false });

  // --- FIX: SAFE CHECK (myBookings || []) ---
  const safeBookings = myBookings || [];

  const upcomingBookings = safeBookings.filter((b: any) => b.status === 'upcoming');
  const pastBookings = safeBookings.filter((b: any) => b.status === 'completed' || b.status === 'cancelled');
  const displayList = activeTab === 'upcoming' ? upcomingBookings : pastBookings;

  const openReview = (booking: any) => {
    setSelectedBooking(booking);
    setRating(0);
    setReviewModalVisible(true);
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
    const bookingDateTime = parseBookingDateTime(booking.date, booking.startTime || booking.time); // Handle both key names
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
            message: "You are cancelling more than 2 hours in advance.",
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

// hairone-frontend/app/(tabs)/bookings.tsx

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
    <View style={styles.container}>
        <View style={{paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20}}>
            <Text style={styles.heading1}>My Bookings</Text>
        </View>

        <View style={styles.tabWrapper}>
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]} 
                    onPress={() => setActiveTab('upcoming')}
                >
                    <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>Upcoming</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, activeTab === 'history' && styles.activeTab]} 
                    onPress={() => setActiveTab('history')}
                >
                    <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>History</Text>
                </TouchableOpacity>
            </View>
        </View>

        <ScrollView contentContainerStyle={{padding: 20}}>
            {displayList.length === 0 && (
               <View style={styles.emptyState}>
                   <Calendar size={48} color="#334155" />
                   <Text style={{color: Colors.textMuted, marginTop: 16}}>No {activeTab} bookings found.</Text>
               </View>
            )}

            {displayList.map((booking: any) => (
                <View key={booking._id || booking.id} style={styles.bookingCard}>
                    {/* Header Row */}
                    <View style={styles.topRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{booking.barberId?.name || 'Barber'}</Text>
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                            {/* Inside displayList.map loop... */}
                            {booking.status === 'upcoming' && (
                                <>
                                    <TouchableOpacity 
                                        style={styles.miniIconBtn} 
                                        // Pass the populated owner phone number
                                        onPress={() => handleCall(booking.shopId?.ownerId?.phone)}
                                    >
                                        <Phone size={14} color="white" />
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={styles.miniIconBtn} 
                                        // Pass the coordinates and shop name
                                        onPress={() => handleMap(
                                            booking.shopId?.coordinates?.lat, 
                                            booking.shopId?.coordinates?.lng, 
                                            booking.shopId?.name
                                        )}
                                    >
                                        <MapPin size={14} color="white" />
                                    </TouchableOpacity>
                                </>
                            )}
                            <View style={[styles.statusBadge, 
                                { backgroundColor: booking.status === 'upcoming' ? 'rgba(245, 158, 11, 0.15)' : (booking.status === 'cancelled' ? 'rgba(239, 68, 68, 0.15)' : '#1e293b') }
                            ]}>
                                <Text style={{
                                    color: booking.status === 'upcoming' ? Colors.primary : (booking.status === 'cancelled' ? '#ef4444' : Colors.textMuted), 
                                    fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase'
                                }}>
                                    {booking.status}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <Text style={styles.cardSub}>Booking ID: {booking.bookingKey || '####'}</Text>
                    <View style={styles.divider} />

                    <View style={styles.infoRow}>
                        <View style={styles.iconText}>
                            <Calendar size={14} color={Colors.textMuted} />
                            <Text style={styles.infoText}>{booking.date}</Text>
                        </View>
                        <View style={styles.iconText}>
                            <Clock size={14} color={Colors.textMuted} />
                            <Text style={[styles.infoText, {color: Colors.primary}]}>{booking.startTime}</Text>
                        </View>
                        <View style={[styles.iconText, {marginLeft: 'auto'}]}>
                             <Text style={{color: 'white', fontWeight: 'bold'}}>₹{booking.totalPrice}</Text>
                        </View>
                    </View>

                    <View style={styles.servicesContainer}>
                        {booking.serviceNames && booking.serviceNames.map((s: any, idx: number) => (
                            <Text key={idx} style={styles.serviceText}>• {s}</Text>
                        ))}
                    </View>

                    <View style={styles.cardFooter}>
                        <View style={{flexDirection: 'row', alignItems: 'center'}}>
                            <Image source={{uri: booking.barberId?.avatar || "https://ui-avatars.com/api/?name=Staff"}} style={{width: 24, height: 24, borderRadius: 12, marginRight: 8}} />
                            <Text style={{color: 'white', fontSize: 12}}>{booking.barberId?.name}</Text>
                        </View>
                        
                        <View style={{flexDirection: 'row', gap: 10}}>
                            {booking.status === 'upcoming' ? (
                               <>
                                 <TouchableOpacity style={styles.cancelBtnSmall} onPress={() => initiateCancel(booking)}>
                                    <Text style={{color: '#f87171', fontSize: 12, fontWeight: 'bold'}}>Cancel</Text>
                                 </TouchableOpacity>
                                 <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => openTicket(booking)}>
                                    <QrCode size={14} color="#020617" style={{marginRight: 4}}/>
                                    <Text style={styles.primaryBtnText}>Ticket</Text>
                                 </TouchableOpacity>
                               </>
                            ) : (
                               <>
                                 {booking.status !== 'cancelled' && (
                                     <>
                                        <TouchableOpacity style={styles.secondaryBtnSmall}>
                                            <RefreshCw size={14} color="white" style={{marginRight: 4}}/>
                                            <Text style={{color: 'white', fontSize: 12, fontWeight: 'bold'}}>Rebook</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={styles.primaryBtnSmall} onPress={() => openReview(booking)}>
                                            <Text style={styles.primaryBtnText}>Rate</Text>
                                        </TouchableOpacity>
                                     </>
                                 )}
                               </>
                            )}
                        </View>
                    </View>
                </View>
            ))}
        </ScrollView>
    </View>

    {/* --- 1. TICKET MODAL --- */}
    <Modal visible={ticketModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, {alignItems: 'center'}]}>
                <View style={{width: '100%', flexDirection: 'row', justifyContent: 'flex-end'}}>
                    <TouchableOpacity onPress={() => setTicketModalVisible(false)}><X size={24} color="white" /></TouchableOpacity>
                </View>
                <Text style={styles.heading2}>E-Ticket</Text>
                <Text style={{color: Colors.textMuted, marginBottom: 20}}>Scan at counter</Text>
                <View style={{backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 20}}>
                    <QrCode size={150} color="black" />
                </View>
                <View style={styles.ticketInfoBox}>
                    <Text style={{color: Colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1}}>Booking PIN</Text>
                    <Text style={{color: Colors.primary, fontSize: 32, fontWeight: 'bold', letterSpacing: 4, marginVertical: 4}}>{selectedBooking?.bookingKey || '####'}</Text>
                </View>
                <TouchableOpacity style={styles.submitBtn} onPress={() => setTicketModalVisible(false)}>
                    <Text style={{color: '#020617', fontWeight: 'bold'}}>Close Ticket</Text>
                </TouchableOpacity>
            </View>
        </View>
    </Modal>

    {/* --- 2. CUSTOM ALERT MODAL (CANCEL) --- */}
    <Modal visible={cancelModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
            <View style={styles.alertContent}>
                <View style={[styles.alertIconBox, { backgroundColor: cancelData.isLate ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)' }]}>
                    <AlertTriangle size={32} color={cancelData.isLate ? '#ef4444' : Colors.primary} />
                </View>
                
                <Text style={[styles.heading2, {marginTop: 16, textAlign: 'center'}]}>{cancelData.title}</Text>
                
                <Text style={{color: Colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 24, lineHeight: 20}}>
                    {cancelData.message}
                </Text>

                <View style={styles.refundBox}>
                    <Text style={{color: Colors.textMuted, fontSize: 12, textTransform: 'uppercase'}}>Refund Amount</Text>
                    <Text style={{color: 'white', fontSize: 24, fontWeight: 'bold'}}>₹{cancelData.refundAmount}</Text>
                </View>

                <View style={{flexDirection: 'row', gap: 12, width: '100%'}}>
                    <TouchableOpacity style={styles.alertBtnSecondary} onPress={() => setCancelModalVisible(false)}>
                        <Text style={{color: 'white', fontWeight: '600'}}>Keep</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.alertBtnDestructive} onPress={confirmCancel}>
                        <Text style={{color: '#ef4444', fontWeight: '600'}}>Yes, Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    </Modal>

    {/* --- 3. REVIEW MODAL --- */}
    <Modal visible={reviewModalVisible} transparent animationType="fade">
       <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
             <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
                <Text style={styles.heading2}>Rate Experience</Text>
                <TouchableOpacity onPress={() => setReviewModalVisible(false)}><X size={24} color="white" /></TouchableOpacity>
             </View>
             <Text style={{color: Colors.textMuted, marginBottom: 20}}>Rate your experience at {selectedBooking?.barberId?.name}</Text>
             <View style={{flexDirection: 'row', justifyContent: 'center', marginBottom: 24, gap: 10}}>
                {[1,2,3,4,5].map(star => (
                   <TouchableOpacity key={star} onPress={() => setRating(star)}>
                      <Star size={32} color={star <= rating ? Colors.primary : '#334155'} fill={star <= rating ? Colors.primary : 'transparent'} />
                   </TouchableOpacity>
                ))}
             </View>
             <TouchableOpacity style={styles.submitBtn} onPress={() => setReviewModalVisible(false)}>
                <Text style={{color: '#020617', fontWeight: 'bold'}}>Submit Review</Text>
             </TouchableOpacity>
          </View>
       </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  heading1: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  heading2: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  tabWrapper: { paddingHorizontal: 20, marginBottom: 10 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0f172a', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#1e293b' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#1e293b' },
  tabText: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  activeTabText: { color: 'white' },
  emptyState: { alignItems: 'center', marginTop: 60, opacity: 0.5 },
  bookingCard: { backgroundColor: Colors.card, padding: 16, borderRadius: 16, marginBottom: 16, borderWidth: 1, borderColor: Colors.border },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { color: 'white', fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 8 },
  cardSub: { color: Colors.textMuted, fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  miniIconBtn: { backgroundColor: '#334155', width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: '#1e293b', marginVertical: 12 },
  infoRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  iconText: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { color: 'white', fontSize: 13, fontWeight: '500' },
  servicesContainer: { backgroundColor: '#020617', padding: 10, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#1e293b' },
  serviceText: { color: '#cbd5e1', fontSize: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  primaryBtnSmall: { backgroundColor: Colors.primary, paddingHorizontal: 16, height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnSmall: { backgroundColor: '#334155', paddingHorizontal: 16, height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  cancelBtnSmall: { backgroundColor: 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 16, height: 36, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  primaryBtnText: { color: '#020617', fontSize: 12, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: Colors.card, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, width: '100%' },
  submitBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', width: '100%' },
  ticketInfoBox: { alignItems: 'center', marginBottom: 24 },
  alertContent: { backgroundColor: Colors.card, padding: 24, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  alertIconBox: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  refundBox: { backgroundColor: '#020617', width: '100%', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#1e293b' },
  alertBtnSecondary: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#334155', alignItems: 'center' },
  alertBtnDestructive: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
});