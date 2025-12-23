import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext'; // Import Theme
import { SlideInView } from '../../components/AnimatedViews'; // Import Animation
import api from '../../services/api';
import { ChevronLeft, Star, Clock, Check, Calendar, User, Info, Banknote, CreditCard, Heart, MapPin } from 'lucide-react-native';
import { formatLocalDate } from '../../utils/date';

export default function ShopDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user, login, token } = useAuth();
  const { showToast } = useToast();
  const { colors, theme } = useTheme(); // Use Theme
  
  const bookingContext = useBooking();
  const fetchBookings = bookingContext ? bookingContext.fetchBookings : null;

  const [shop, setShop] = useState<any>(null);
  const [barbers, setBarbers] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState({ userDiscountRate: 0, isPaymentTestMode: false });

  // --- WIZARD STATE ---
  const [step, setStep] = useState(1); 
  const [selectedServices, setSelectedServices] = useState<any[]>([]); 
  const [selectedBarberId, setSelectedBarberId] = useState<string>('any'); 
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'online'>('cash');
  const [bookingType, setBookingType] = useState<'earliest' | 'schedule'>('earliest'); 

  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const isSlotValid = (time: string) => {
    if (!shop) return true;

    const today = new Date();
    const isToday = selectedDate.getDate() === today.getDate() &&
                    selectedDate.getMonth() === today.getMonth() &&
                    selectedDate.getFullYear() === today.getFullYear();

    if (!isToday) return true;

    const [hours, minutes] = time.split(':').map(Number);
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hours, minutes, 0, 0);

    const minNotice = shop.minBookingNotice || 0;
    const cutoff = new Date(currentTime.getTime() + minNotice * 60000);

    return slotDate > cutoff;
  };

  useEffect(() => {
    if (selectedTime && !isSlotValid(selectedTime)) {
        setSelectedTime(null);
    }
  }, [currentTime, selectedTime]);

  useEffect(() => {
    fetchShopDetails();
    fetchConfig();
  }, [id]);

  const fetchConfig = async () => {
     try {
         const res = await api.get('/shops/config');
         if(res.data) setConfig(res.data);
     } catch(e) { console.log('Config fetch error', e); }
  };

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
      showToast("Could not load shop details.", "error");
    } finally {
      setLoading(false);
    }
  };

  // --- FAVORITE LOGIC ---
  const isFav = user?.favorites?.includes(id as string);

  const toggleFavorite = async () => {
    if (!user) return showToast("Please login to save shops", "error");
    try {
      const res = await api.post('/auth/favorites', { shopId: id });
      // Update local state
      const updatedUser = { ...user, favorites: res.data };
      if (token) login(token, updatedUser);
      const isNowFav = updatedUser.favorites.includes(id as string);
      showToast(isNowFav ? "Added to favorites" : "Removed from favorites", "success");
    } catch (e) {
      console.log("Fav Error", e);
    }
  };

  /**
   * Calculates the total duration of selected services.
   * Robustly parses duration to ensure numerical addition, preventing string concatenation.
   */
  const calculateDuration = () => selectedServices.reduce((sum, s) => {
    const val = parseInt(s.duration, 10);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  /**
   * Calculates the total price of selected services.
   * Robustly parses price to ensure numerical addition.
   */
  const calculateTotal = () => selectedServices.reduce((sum, s) => {
    const val = parseFloat(s.price);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const fetchSlots = async () => {
    setLoadingSlots(true);
    setSelectedTime(null); 
    setSlots([]); 
    try {
        const dateStr = formatLocalDate(selectedDate);

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
        showToast("Could not load slots.", "error");
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
    if (!selectedTime) return showToast("Please select a time slot", "error");
    if (selectedServices.length === 0) return showToast("Please select at least one service", "error");

    try {
        setLoading(true);
        const dateStr = formatLocalDate(selectedDate);
        
        await api.post('/bookings', {
            userId: user?._id,
            shopId: shop._id,
            barberId: selectedBarberId, 
            serviceNames: selectedServices.map(s => s.name),
            totalPrice: calculateTotal(),
            totalDuration: calculateDuration(),
            date: dateStr,
            startTime: selectedTime,
            paymentMethod: paymentMethod === 'online' ? 'ONLINE' : 'CASH'
        });

        showToast("Booking Confirmed!", "success");
        if (fetchBookings) fetchBookings(); 
        
        router.replace('/(tabs)/bookings' as any);
    } catch (e: any) {
        console.log("Booking Error:", e);
        showToast(e.response?.data?.message || "Booking failed", "error");
    } finally {
        setLoading(false);
    }
  };

  if (loading && !shop) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.tint} size="large"/></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* --- STEP 1 HEADER --- */}
      {step === 1 && (
        <View style={styles.headerImageContainer}>
             <Image source={{ uri: shop?.image }} style={styles.headerImage} />
             <View style={styles.overlay} />
             
             {/* Back Button */}
             <TouchableOpacity style={styles.backBtnAbsolute} onPress={() => router.back()}>
                <ChevronLeft color="white" size={24} />
             </TouchableOpacity>

             {/* Favorite Button */}
             <TouchableOpacity style={styles.favBtnAbsolute} onPress={toggleFavorite}>
                <Heart size={24} color={isFav ? colors.tint : "white"} fill={isFav ? colors.tint : "transparent"} />
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

                <View style={[styles.ratingBadge, {backgroundColor: colors.tint}]}>
                    <Star size={14} color="black" fill="black"/>
                    <Text style={{fontWeight:'bold', fontSize:12, color:'black'}}> {shop?.rating} (120+ reviews)</Text>
                </View>
             </View>
        </View>
      )}

      {/* --- NAV HEADER (Steps 2 & 3) --- */}
      {step > 1 && (
         <View style={[styles.navHeader, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setStep(step - 1)}>
                <ChevronLeft color={colors.text} size={24} />
            </TouchableOpacity>
            <Text style={[styles.navTitle, { color: colors.text }]}>
                {step === 2 ? 'Select Professional & Time' : 'Review & Pay'}
            </Text>
            <View style={{width: 24}} />
         </View>
      )}

      {/* --- STEP 1: SELECT SERVICES --- */}
      {step === 1 && (
        <SlideInView key="step1" from="right" style={{flex: 1}}>
        <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20, paddingBottom: 140}}>
            <Text style={[styles.sectionTitle, {color: colors.textMuted, marginTop: 0}]}>Services</Text>
            {shop?.services && shop.services.filter((s: any) => s.isAvailable !== false).map((service: any, index: number) => {
                const isSelected = selectedServices.find(s => s.name === service.name);
                return (
                    <TouchableOpacity key={index} style={[styles.serviceCard, {backgroundColor: colors.card, borderColor: colors.border}, isSelected && {borderColor: colors.tint, backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.1)'}]} onPress={() => toggleService(service)}>
                        <View style={{flex: 1}}>
                            <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                                <Text style={[styles.serviceName, {color: colors.text}, isSelected && {color: colors.tint}]}>{service.name}</Text>
                                {config.userDiscountRate > 0 && (
                                    <View style={{backgroundColor: '#10b981', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4}}>
                                        <Text style={{color: 'white', fontSize: 10, fontWeight: 'bold'}}>{config.userDiscountRate}% OFF</Text>
                                    </View>
                                )}
                            </View>
                            <Text style={[styles.serviceDuration, {color: colors.textMuted}]}>{service.duration} mins • {isSelected ? 'Selected' : 'Tap to add'}</Text>
                        </View>
                        <View style={{alignItems:'flex-end'}}>
                             {config.userDiscountRate > 0 ? (
                                <View style={{alignItems: 'flex-end'}}>
                                    <Text style={[styles.servicePrice, {color: colors.text}, isSelected && {color: colors.tint}]}>
                                        ₹{Math.round(service.price * (1 - config.userDiscountRate / 100))}
                                    </Text>
                                    <Text style={{textDecorationLine: 'line-through', color: colors.textMuted, fontSize: 12}}>
                                        ₹{service.price}
                                    </Text>
                                </View>
                             ) : (
                                <Text style={[styles.servicePrice, {color: colors.text}, isSelected && {color: colors.tint}]}>₹{service.price}</Text>
                             )}
                             {isSelected && <Check size={16} color={colors.tint} style={{marginTop: 4}}/>}
                        </View>
                    </TouchableOpacity>
                );
            })}
        </ScrollView>
        </SlideInView>
      )}

      {/* --- STEP 2: BARBER & SLOT --- */}
      {step === 2 && (
        <SlideInView key="step2" from="right" style={{flex: 1}}>
        <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20, paddingBottom: 160}}>
            <Text style={[styles.sectionTitle, {color: colors.textMuted, marginTop: 0}]}>Choose Professional</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 24}}>
                <TouchableOpacity 
                   style={[styles.barberChip, {backgroundColor: colors.card, borderColor: colors.border}, selectedBarberId === 'any' && {backgroundColor: colors.tint, borderColor: colors.tint}]}
                   onPress={() => setSelectedBarberId('any')}
                >
                    <View style={[styles.avatarCircle, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}, selectedBarberId === 'any' && {backgroundColor: 'rgba(255,255,255,0.2)'}]}>
                       <Star size={16} color={selectedBarberId === 'any' ? 'black' : colors.text} fill={selectedBarberId === 'any' ? 'black' : 'transparent'}/>
                    </View>
                    <Text style={[styles.barberName, {color: colors.text}, selectedBarberId === 'any' && {color: 'black', fontWeight:'bold'}]}>Any Pro</Text>
                </TouchableOpacity>

                {barbers.map((b: any) => (
                    <TouchableOpacity 
                        key={b._id}
                        style={[styles.barberChip, {backgroundColor: colors.card, borderColor: colors.border}, selectedBarberId === b._id && {backgroundColor: colors.tint, borderColor: colors.tint}]}
                        onPress={() => setSelectedBarberId(b._id)}
                    >
                         <View style={[styles.avatarCircle, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}, selectedBarberId === b._id && {backgroundColor: 'rgba(255,255,255,0.2)'}]}>
                            <User size={16} color={selectedBarberId === b._id ? 'black' : colors.text}/>
                         </View>
                         <Text style={[styles.barberName, {color: colors.text}, selectedBarberId === b._id && {color: 'black', fontWeight:'bold'}]}>{b.name}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom: 24}}>
                {[0,1,2,3,4,5,6].map(days => {
                    const d = new Date();
                    d.setDate(d.getDate() + days);
                    const isSelected = d.getDate() === selectedDate.getDate();
                    return (
                        <TouchableOpacity 
                            key={days} 
                            style={[styles.dateChip, {backgroundColor: colors.card, borderColor: colors.border}, isSelected && {backgroundColor: colors.tint, borderColor: colors.tint}]}
                            onPress={() => setSelectedDate(d)}
                        >
                            <Text style={[styles.dayText, {color: colors.textMuted}, isSelected && {color: 'black'}]}>{d.toLocaleDateString('en-US', {weekday: 'short'})}</Text>
                            <Text style={[styles.dateText, {color: colors.text}, isSelected && {color: 'black'}]}>{d.getDate()}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>Booking Option</Text>
            <View style={[styles.toggleContainer, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <TouchableOpacity 
                    style={[styles.toggleBtn, bookingType === 'earliest' && {backgroundColor: colors.tint}]}
                    onPress={() => setBookingType('earliest')}
                >
                    <Text style={[styles.toggleText, {color: colors.textMuted}, bookingType === 'earliest' && { color: 'black' }]}>Earliest Available</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.toggleBtn, bookingType === 'schedule' && {backgroundColor: colors.tint}]}
                    onPress={() => setBookingType('schedule')}
                >
                    <Text style={[styles.toggleText, {color: colors.textMuted}, bookingType === 'schedule' && { color: 'black' }]}>Custom Schedule</Text>
                </TouchableOpacity>
            </View>

            {bookingType === 'earliest' ? (
                <View style={[styles.earliestCard, {backgroundColor: colors.card, borderColor: colors.tint}]}>
                    {loadingSlots ? (
                         <ActivityIndicator color={colors.tint} />
                    ) : slots.length > 0 ? (
                         <View style={{flexDirection:'row', alignItems:'center', gap: 12}}>
                             <Clock size={24} color={colors.tint} />
                             <View>
                                 <Text style={{color: colors.text, fontWeight:'bold', fontSize:16}}>Next Available: {slots[0]}</Text>
                             </View>
                         </View>
                    ) : (
                         <Text style={{color: colors.textMuted}}>No slots available today.</Text>
                    )}
                </View>
            ) : (
                <>
                    <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>Select Time</Text>
                    {loadingSlots ? (
                        <ActivityIndicator color={colors.tint} />
                    ) : (
                        <View style={styles.slotsGrid}>
                            {slots.filter(isSlotValid).map((time, i) => (
                                <TouchableOpacity 
                                key={i} 
                                style={[styles.slotChip, {backgroundColor: colors.card, borderColor: colors.border}, selectedTime === time && {backgroundColor: colors.tint, borderColor: colors.tint}]}
                                onPress={() => setSelectedTime(time)}
                                >
                                    <Text style={[styles.slotText, {color: colors.text}, selectedTime === time && {color: 'black', fontWeight: 'bold'}]}>{time}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </>
            )}
        </ScrollView>
        </SlideInView>
      )}

      {/* --- STEP 3: SUMMARY & PAYMENT --- */}
      {step === 3 && (
         <SlideInView key="step3" from="right" style={{flex: 1}}>
         <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20}}>
            <View style={[styles.summaryCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <Text style={[styles.summaryTitle, {color: colors.text}]}>Booking Summary</Text>
                
                <View style={styles.summaryRow}>
                    <Calendar size={18} color={colors.textMuted} />
                    <Text style={[styles.summaryText, {color: colors.text}]}>{selectedDate.toDateString()}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <Clock size={18} color={colors.textMuted} />
                    <Text style={[styles.summaryText, {color: colors.text}]}>{selectedTime}</Text>
                </View>
                <View style={styles.summaryRow}>
                    <User size={18} color={colors.textMuted} />
                    <Text style={[styles.summaryText, {color: colors.text}]}>{selectedBarberId === 'any' ? 'Random Professional' : barbers.find((b:any) => b._id === selectedBarberId)?.name}</Text>
                </View>

                <View style={[styles.divider, {backgroundColor: colors.border}]} />
                
                {selectedServices.map((s, i) => (
                    <View key={i} style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 8}}>
                        <Text style={{color: colors.textMuted}}>{s.name}</Text>
                        <Text style={{color: colors.text}}>₹{s.price}</Text>
                    </View>
                ))}

                <View style={[styles.divider, {backgroundColor: colors.border}]} />
                
                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 8}}>
                    <Text style={{color: colors.textMuted}}>Subtotal</Text>
                    <Text style={{color: colors.text}}>₹{calculateTotal()}</Text>
                </View>
                {config.userDiscountRate > 0 && (
                    <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 8}}>
                        <Text style={{color: '#10b981'}}>Discount ({config.userDiscountRate}%)</Text>
                        <Text style={{color: '#10b981'}}>- ₹{(calculateTotal() * (config.userDiscountRate / 100)).toFixed(2)}</Text>
                    </View>
                )}
                <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 8}}>
                    <Text style={{color: colors.text, fontWeight: 'bold', fontSize: 18}}>Total Payable</Text>
                    <Text style={{color: colors.tint, fontWeight: 'bold', fontSize: 18}}>
                        ₹{Math.round(calculateTotal() * (1 - config.userDiscountRate / 100))}
                    </Text>
                </View>
            </View>

            <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>Payment Method</Text>

            <TouchableOpacity style={[styles.paymentCard, {backgroundColor: colors.card, borderColor: colors.border}, paymentMethod === 'cash' && {borderColor: colors.tint, backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.1)'}]} onPress={() => setPaymentMethod('cash')}>
                <Banknote size={24} color={paymentMethod === 'cash' ? colors.tint : colors.text} />
                <View style={{flex: 1, marginLeft: 12}}>
                    <Text style={[styles.paymentTitle, {color: colors.text}, paymentMethod === 'cash' && {color: colors.tint}]}>Cash on Delivery</Text>
                    <Text style={[styles.paymentSub, {color: colors.textMuted}]}>Pay at the salon</Text>
                </View>
                {paymentMethod === 'cash' && <View style={[styles.checkCircle, {borderColor: colors.tint}]}><View style={[styles.checkInner, {backgroundColor: colors.tint}]}/></View>}
            </TouchableOpacity>

            {config.isPaymentTestMode ? (
                <TouchableOpacity
                   style={[styles.paymentCard, {backgroundColor: colors.card, borderColor: colors.border}, paymentMethod === 'online' && {borderColor: colors.tint, backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.1)'}]}
                   onPress={() => setPaymentMethod('online')}
                >
                    <CreditCard size={24} color={paymentMethod === 'online' ? colors.tint : colors.text} />
                    <View style={{flex: 1, marginLeft: 12}}>
                        <Text style={[styles.paymentTitle, {color: colors.text}, paymentMethod === 'online' && {color: colors.tint}]}>Pay Online (Test)</Text>
                        <Text style={[styles.paymentSub, {color: colors.textMuted}]}>Simulate Online Payment</Text>
                    </View>
                    {paymentMethod === 'online' && <View style={[styles.checkCircle, {borderColor: colors.tint}]}><View style={[styles.checkInner, {backgroundColor: colors.tint}]}/></View>}
                </TouchableOpacity>
            ) : (
                <TouchableOpacity style={[styles.paymentCard, {backgroundColor: colors.card, borderColor: colors.border, opacity: 0.5}]} disabled={true}>
                    <CreditCard size={24} color={colors.text} />
                    <View style={{flex: 1, marginLeft: 12}}>
                        <Text style={[styles.paymentTitle, {color: colors.text}]}>UPI / Online</Text>
                        <Text style={[styles.paymentSub, {color: colors.textMuted}]}>Coming Soon</Text>
                    </View>
                </TouchableOpacity>
            )}

         </ScrollView>
         </SlideInView>
      )}

      {selectedServices.length > 0 && (
          <View style={[styles.footer, {backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', borderTopColor: colors.border}]}>
             <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <View>
                    <Text style={[styles.footerSub, {color: colors.textMuted}]}>{selectedServices.length} services</Text>
                    <Text style={[styles.footerPrice, {color: colors.text}]}>
                        ₹{config.userDiscountRate > 0
                           ? Math.round(calculateTotal() * (1 - config.userDiscountRate / 100))
                           : calculateTotal()}
                    </Text>
                </View>

                {step < 3 ? (
                    <TouchableOpacity
                    style={[styles.nextBtn, {backgroundColor: colors.tint}, (step === 2 && !selectedTime) && {opacity: 0.5}]}
                    disabled={step === 2 && !selectedTime}
                    onPress={() => setStep(step + 1)}
                    >
                    <Text style={styles.nextBtnText}>Continue</Text>
                    <ChevronLeft size={16} color="#0f172a" style={{transform: [{rotate: '180deg'}]}} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.nextBtn, {backgroundColor: colors.tint}]} onPress={handleBook}>
                        {loading ? <ActivityIndicator color="black"/> : <Text style={styles.nextBtnText}>Confirm Booking</Text>}
                    </TouchableOpacity>
                )}
             </View>
          </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerImageContainer: { height: 250, width: '100%', position: 'relative' },
  headerImage: { width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  backBtnAbsolute: { position: 'absolute', top: 50, left: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
  favBtnAbsolute: { position: 'absolute', top: 50, right: 20, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 },
  shopMeta: { position: 'absolute', bottom: 20, left: 20 },
  shopTitle: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  shopAddress: { color: '#cbd5e1', fontSize: 14, marginTop: 4 },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 8 },
  navHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1 },
  navTitle: { fontSize: 18, fontWeight: 'bold' },
  sectionTitle: { marginBottom: 16, marginTop: 24, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1, fontWeight: 'bold' },
  serviceCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  serviceName: { fontWeight: 'bold', fontSize: 16 },
  serviceDuration: { fontSize: 12, marginTop: 4 },
  servicePrice: { fontWeight: 'bold', fontSize: 16 },
  barberChip: { width: 100, padding: 12, borderRadius: 12, marginRight: 12, alignItems: 'center', borderWidth: 1 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  barberName: { fontSize: 12, fontWeight: '600' },
  dateChip: { width: 60, height: 70, borderRadius: 12, marginRight: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dayText: { fontSize: 12, textTransform: 'uppercase' },
  dateText: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: { width: '30%', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  slotText: { fontSize: 14, fontWeight: '500' },
  summaryCard: { padding: 20, borderRadius: 16, borderWidth: 1 },
  summaryTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  summaryText: { fontSize: 14 },
  divider: { height: 1, marginVertical: 16 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40, borderTopWidth: 1 },
  footerPrice: { fontSize: 24, fontWeight: 'bold' },
  footerSub: { fontSize: 12, textTransform: 'uppercase' },
  nextBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  paymentCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  paymentTitle: { fontWeight: 'bold', fontSize: 16 },
  paymentSub: { fontSize: 12 },
  checkCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkInner: { width: 10, height: 10, borderRadius: 5 },
  toggleContainer: { flexDirection: 'row', padding: 4, borderRadius: 12, marginBottom: 24, borderWidth: 1 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleText: { fontWeight: 'bold', fontSize: 14 },
  earliestCard: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 24 },
});
