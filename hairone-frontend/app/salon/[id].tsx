import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native'; // <--- Import Linking
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { ChevronLeft, Star, Clock, Check, Calendar, User, Info, Banknote, CreditCard, Heart, MapPin } from 'lucide-react-native';

export default function ShopDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user, login, token } = useAuth(); // Added login & token
  
  const bookingContext = useBooking();
  const fetchBookings = bookingContext ? bookingContext.fetchBookings : null;

  const [shop, setShop] = useState<any>(null);
  const [barbers, setBarbers] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  // --- WIZARD STATE ---
  const [step, setStep] = useState(1); 
  const [selectedServices, setSelectedServices] = useState<any[]>([]); 
  const [selectedBarberId, setSelectedBarberId] = useState<string>('any'); 
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash');
  const [bookingType, setBookingType] = useState<'earliest' | 'schedule'>('earliest'); 

  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    fetchShopDetails();
  }, [id]);

  useEffect(() => {
    if (step === 2) {
        fetchSlots();
    }
  }, [step, selectedDate, selectedBarberId]);

  useEffect(() => {
    if (bookingType === 'earliest' && slots.length > 0) {
        setSelectedTime(slots[0]);
    } else if (bookingType === 'schedule') {
        setSelectedTime(null);
    }
  }, [slots, bookingType]);

  const fetchShopDetails = async () => {
    try {
      const res = await api.get(`/shops/${id}`);
      setShop(res.data.shop);
      setBarbers(res.data.barbers);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Could not load shop details.");
    } finally {
      setLoading(false);
    }
  };

  // --- FAVORITE LOGIC ---
  const isFav = user?.favorites?.includes(id as string);

  const toggleFavorite = async () => {
    if (!user) return Alert.alert("Sign In Required", "Please login to save shops.");
    try {
      const res = await api.post('/auth/favorites', { shopId: id });
      // Update local state
      const updatedUser = { ...user, favorites: res.data };
      if (token) login(token, updatedUser);
    } catch (e) {
      console.log("Fav Error", e);
    }
  };

  const calculateDuration = () => selectedServices.reduce((sum, s) => sum + s.duration, 0);
  const calculateTotal = () => selectedServices.reduce((sum, s) => sum + s.price, 0);

  const fetchSlots = async () => {
    setLoadingSlots(true);
    setSelectedTime(null); 
    setSlots([]); 
    try {
        const dateStr = selectedDate.toISOString().split('T')[0];
        const duration = calculateDuration();
        const bId = selectedBarberId; 
        
        const res = await api.post('/shops/slots', {
            shopId: id,
            barberId: bId,
            date: dateStr,
            duration: duration
        });
        setSlots(res.data);
    } catch (e) {
        console.log("Fetch Slots Error:", e);
        Alert.alert("Notice", "Could not load slots.");
    } finally {
        setLoadingSlots(false);
    }
  };

  const toggleService = (service: any) => {
    const exists = selectedServices.find(s => s.name === service.name);
    if (exists) {
        setSelectedServices(prev => prev.filter(s => s.name !== service.name));
    } else {
        setSelectedServices(prev => [...prev, service]);
    }
  };

  const handleBook = async () => {
    if (!selectedTime) return Alert.alert("Required", "Please select a time slot.");
    if (selectedServices.length === 0) return Alert.alert("Required", "Please select at least one service.");

    try {
        setLoading(true);
        const dateStr = selectedDate.toISOString().split('T')[0];
        
        await api.post('/bookings', {
            userId: user?._id,
            shopId: shop._id,
            barberId: selectedBarberId, 
            serviceNames: selectedServices.map(s => s.name),
            totalPrice: calculateTotal(),
            totalDuration: calculateDuration(),
            date: dateStr,
            startTime: selectedTime,
            paymentMethod: paymentMethod
        });

        Alert.alert("Success", "Booking Confirmed!");
        if (fetchBookings) fetchBookings(); 
        
        router.replace('/(tabs)/bookings' as any);
    } catch (e: any) {
        console.log("Booking Error:", e);
        Alert.alert("Error", e.response?.data?.message || "Booking failed");
    } finally {
        setLoading(false);
    }
  };

  if (loading && !shop) return <View style={styles.center}><ActivityIndicator color={Colors.primary} size="large"/></View>;

  return (
    <View style={styles.container}>
      
      {/* --- STEP 1 HEADER --- */}
      {step === 1 && (
        <View style={styles.headerImageContainer}>
             <Image source={{ uri: shop?.image }} style={styles.headerImage} />
             <View style={styles.overlay} />
             
             {/* Back Button */}
             <TouchableOpacity style={styles.backBtnAbsolute} onPress={() => router.back()}>
                <ChevronLeft color="white" size={24} />
             </TouchableOpacity>

             {/* Favorite Button (NEW) */}
             <TouchableOpacity style={styles.favBtnAbsolute} onPress={toggleFavorite}>
                <Heart size={24} color={isFav ? Colors.primary : "white"} fill={isFav ? Colors.primary : "transparent"} />
             </TouchableOpacity>

             <View style={styles.shopMeta}>
                <Text style={styles.shopTitle}>{shop?.name}</Text>

                <TouchableOpacity onPress={() => {
                    const lat = shop?.coordinates?.lat;
                    const lng = shop?.coordinates?.lng;
                    const query = lat && lng ? `${lat},${lng}` : shop?.address;
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
                }}>
                    <View style={{flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4}}>
                        <MapPin size={14} color="#cbd5e1" />
                        <Text style={[styles.shopAddress, {textDecorationLine: 'underline'}]}>{shop?.address}</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.ratingBadge}>
                    <Star size={14} color="black" fill="black"/>
                    <Text style={{fontWeight:'bold', fontSize:12}}> {shop?.rating} (120+ reviews)</Text>
                </View>
             </View>
        </View>
      )}

      {/* --- NAV HEADER (Steps 2 & 3) --- */}
      {step > 1 && (
         <View style={styles.navHeader}>
            <TouchableOpacity onPress={() => setStep(step - 1)}>
                <ChevronLeft color="white" size={24} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>
                {step === 2 ? 'Select Professional & Time' : 'Review & Pay'}
            </Text>
            <View style={{width: 24}} />
         </View>
      )}

      {/* --- STEP 1: SELECT SERVICES --- */}
      {step === 1 && (
        <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20, paddingBottom: 100}}>
            <Text style={styles.sectionTitle}>Services</Text>
            {shop?.services && shop.services.map((service: any, index: number) => {
                const isSelected = selectedServices.find(s => s.name === service.name);
                return (
                    <TouchableOpacity key={index} style={[styles.serviceCard, isSelected && styles.serviceCardActive]} onPress={() => toggleService(service)}>
                        <View style={{flex: 1}}>
                            <Text style={[styles.serviceName, isSelected && {color: Colors.primary}]}>{service.name}</Text>
                            <Text style={styles.serviceDuration}>{service.duration} mins • {isSelected ? 'Selected' : 'Tap to add'}</Text>
                        </View>
                        <View style={{alignItems:'flex-end'}}>
                             <Text style={[styles.servicePrice, isSelected && {color: Colors.primary}]}>₹{service.price}</Text>
                             {isSelected && <Check size={16} color={Colors.primary} style={{marginTop: 4}}/>}
                        </View>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
      )}

      {/* --- STEP 2: BARBER & SLOT --- */}
      {step === 2 && (
        <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20, paddingBottom: 100}}>
            <Text style={styles.sectionTitle}>Choose Professional</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 24}}>
                <TouchableOpacity 
                   style={[styles.barberChip, selectedBarberId === 'any' && styles.barberChipActive]}
                   onPress={() => setSelectedBarberId('any')}
                >
                    <View style={[styles.avatarCircle, {backgroundColor: Colors.primary}]}>
                       <Star size={16} color="black" fill="black"/>
                    </View>
                    <Text style={[styles.barberName, selectedBarberId === 'any' && {color: 'black', fontWeight:'bold'}]}>Any Pro</Text>
                </TouchableOpacity>

                {barbers.map((b: any) => (
                    <TouchableOpacity 
                        key={b._id}
                        style={[styles.barberChip, selectedBarberId === b._id && styles.barberChipActive]}
                        onPress={() => setSelectedBarberId(b._id)}
                    >
                         <View style={styles.avatarCircle}><User size={16} color="white"/></View>
                         <Text style={[styles.barberName, selectedBarberId === b._id && {color: 'black', fontWeight:'bold'}]}>{b.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={styles.sectionTitle}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 24}}>
                {[0,1,2,3,4,5,6].map(days => {
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    const isSelected = d.getDate() === selectedDate.getDate();
                    return (
                        <TouchableOpacity 
                            key={days} 
                            style={[styles.dateChip, isSelected && styles.dateChipActive]}
                            onPress={() => setSelectedDate(d)}
                        >
                            <Text style={[styles.dayText, isSelected && {color: 'black'}]}>{d.toLocaleDateString('en-US', {weekday: 'short'})}</Text>
                            <Text style={[styles.dateText, isSelected && {color: 'black'}]}>{d.getDate()}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <Text style={styles.sectionTitle}>Booking Option</Text>
            <View style={styles.toggleContainer}>
                <TouchableOpacity 
                    style={[styles.toggleBtn, bookingType === 'earliest' && styles.toggleBtnActive]}
                    onPress={() => setBookingType('earliest')}
                >
                    <Text style={[styles.toggleText, bookingType === 'earliest' && { color: 'black' }]}>Earliest Available</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.toggleBtn, bookingType === 'schedule' && styles.toggleBtnActive]}
                    onPress={() => setBookingType('schedule')}
                >
                    <Text style={[styles.toggleText, bookingType === 'schedule' && { color: 'black' }]}>Custom Schedule</Text>
                </TouchableOpacity>
            </View>

            {bookingType === 'earliest' ? (
                <View style={styles.earliestCard}>
                    {loadingSlots ? (
                         <ActivityIndicator color={Colors.primary} />
                    ) : slots.length > 0 ? (
                         <View style={{flexDirection:'row', alignItems:'center', gap: 12}}>
                             <Clock size={24} color={Colors.primary} />
                             <View>
                                 <Text style={{color:'white', fontWeight:'bold', fontSize:16}}>Next Available: {slots[0]}</Text>
                             </View>
                         </View>
                    ) : (
                         <Text style={{color: Colors.textMuted}}>No slots available today.</Text>
                    )}
                </View>
            ) : (
                <>
                    <Text style={styles.sectionTitle}>Select Time</Text>
                    {loadingSlots ? (
                        <ActivityIndicator color={Colors.primary} />
                    ) : (
                        <View style={styles.slotsGrid}>
                            {slots.map((time, i) => (
                                <TouchableOpacity 
                                key={i} 
                                style={[styles.slotChip, selectedTime === time && styles.slotChipActive]}
                                onPress={() => setSelectedTime(time)}
                                >
                                    <Text style={[styles.slotText, selectedTime === time && {color: 'black', fontWeight: 'bold'}]}>{time}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </>
            )}
        </ScrollView>
      )}

      {/* --- STEP 3: SUMMARY & PAYMENT --- */}
      {step === 3 && (
         <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20}}>
            <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Booking Summary</Text>
                
                <View style={styles.summaryRow}>
                    <Calendar size={18} color={Colors.textMuted} />
                    <Text style={styles.summaryText}>{selectedDate.toDateString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Clock size={18} color={Colors.textMuted} />
                    <Text style={styles.summaryText}>{selectedTime}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <User size={18} color={Colors.textMuted} />
                    <Text style={styles.summaryText}>{selectedBarberId === 'any' ? 'Random Professional' : barbers.find((b:any) => b._id === selectedBarberId)?.name}</Text>
                </View>

                <View style={styles.divider} />
                
                {selectedServices.map((s, i) => (
                    <View key={i} style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 8}}>
                        <Text style={{color: Colors.textMuted}}>{s.name}</Text>
                        <Text style={{color: 'white'}}>₹{s.price}</Text>
                    </View>
                ))}

                <View style={[styles.divider, {backgroundColor: Colors.border}]} />
                
                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 8}}>
                    <Text style={{color: 'white', fontWeight: 'bold', fontSize: 18}}>Total</Text>
                    <Text style={{color: Colors.primary, fontWeight: 'bold', fontSize: 18}}>₹{calculateTotal()}</Text>
                </View>
            </View>

            <Text style={styles.sectionTitle}>Payment Method</Text>

            <TouchableOpacity style={[styles.paymentCard, paymentMethod === 'cash' && styles.paymentCardActive]} onPress={() => setPaymentMethod('cash')}>
                <Banknote size={24} color={paymentMethod === 'cash' ? Colors.primary : 'white'} />
                <View style={{flex: 1, marginLeft: 12}}>
                    <Text style={[styles.paymentTitle, paymentMethod === 'cash' && {color: Colors.primary}]}>Cash on Delivery</Text>
                    <Text style={styles.paymentSub}>Pay at the salon</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.paymentCard, {opacity: 0.5}]} disabled={true}>
                <CreditCard size={24} color="white" />
                <View style={{flex: 1, marginLeft: 12}}>
                    <Text style={styles.paymentTitle}>UPI / Online</Text>
                    <Text style={styles.paymentSub}>Coming Soon</Text>
                </View>
            </TouchableOpacity>

         </ScrollView>
      )}

      {selectedServices.length > 0 && (
          <View style={styles.footer}>
             <View>
                <Text style={styles.footerPrice}>₹{calculateTotal()}</Text>
                <Text style={styles.footerSub}>{selectedServices.length} services selected</Text>
             </View>
             
             {step < 3 ? (
                <TouchableOpacity 
                   style={[styles.nextBtn, (step === 2 && !selectedTime) && {opacity: 0.5}]}
                   disabled={step === 2 && !selectedTime}
                   onPress={() => setStep(step + 1)}
                >
                   <Text style={styles.nextBtnText}>Continue</Text>
                </TouchableOpacity>
             ) : (
                <TouchableOpacity style={styles.nextBtn} onPress={handleBook}>
                    {loading ? <ActivityIndicator color="black"/> : <Text style={styles.nextBtnText}>Confirm Booking</Text>}
                </TouchableOpacity>
             )}
          </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  headerImageContainer: { height: 250, width: '100%', position: 'relative' },
  headerImage: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  backBtnAbsolute: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
  favBtnAbsolute: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
  shopMeta: { position: 'absolute', bottom: 20, left: 20 },
  shopTitle: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  shopAddress: { color: '#cbd5e1', fontSize: 14, marginTop: 4 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 8 },
  navHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, backgroundColor: Colors.background, borderBottomWidth: 1, borderBottomColor: Colors.border },
  navTitle: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  sectionTitle: { color: Colors.textMuted, marginBottom: 16, marginTop: 24, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1, fontWeight: 'bold' },
  serviceCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, backgroundColor: Colors.card, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  serviceCardActive: { borderColor: Colors.primary, backgroundColor: 'rgba(234, 179, 8, 0.05)' },
  serviceName: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  serviceDuration: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  servicePrice: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  barberChip: { width: 100, padding: 12, backgroundColor: Colors.card, borderRadius: 12, marginRight: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  barberChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  barberName: { color: 'white', fontSize: 12, fontWeight: '600' },
  dateChip: { width: 60, height: 70, backgroundColor: Colors.card, borderRadius: 12, marginRight: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  dateChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  dayText: { color: Colors.textMuted, fontSize: 12, textTransform: 'uppercase' },
  dateText: { color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: { width: '30%', paddingVertical: 12, backgroundColor: Colors.card, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  slotChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotText: { color: 'white', fontSize: 14, fontWeight: '500' },
  summaryCard: { backgroundColor: Colors.card, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  summaryTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  summaryText: { color: 'white', fontSize: 14 },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 16 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#0f172a', padding: 20, paddingBottom: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border },
  footerPrice: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  footerSub: { color: Colors.textMuted, fontSize: 12 },
  nextBtn: { backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 12 },
  nextBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  paymentCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  paymentCardActive: { borderColor: Colors.primary, backgroundColor: 'rgba(234, 179, 8, 0.05)' },
  paymentTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  paymentSub: { color: Colors.textMuted, fontSize: 12 },
  toggleContainer: { flexDirection: 'row', backgroundColor: Colors.card, padding: 4, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleBtnActive: { backgroundColor: Colors.primary },
  toggleText: { color: Colors.textMuted, fontWeight: 'bold', fontSize: 14 },
  earliestCard: { backgroundColor: Colors.card, padding: 20, borderRadius: 12, borderWidth: 1, borderColor: Colors.primary, marginBottom: 24 },
});