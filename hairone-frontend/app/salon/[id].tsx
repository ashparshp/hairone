import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Linking } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext'; // Import Theme
import { SlideInView } from '../../components/AnimatedViews'; // Import Animation
import api, { getShopReviews } from '../../services/api';
import { ChevronLeft, Star, Clock, Check, Calendar, User, Info, Banknote, CreditCard, Heart, MapPin, Layers, MessageSquare } from 'lucide-react-native';
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
  const [reviews, setReviews] = useState<any[]>([]);
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

  // TABS
  const [activeTab, setActiveTab] = useState<'services' | 'combos' | 'reviews'>('services');

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

      // Fetch reviews
      try {
        const reviewsRes = await getShopReviews(id as string);
        setReviews(reviewsRes.reviews);
      } catch (err) { console.log('Reviews fetch error', err); }

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
   * Calculates the total price of selected services/combos.
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

  const toggleService = (item: any, isCombo = false) => {
    // Determine unique key (Combos might share names with services?)
    // Let's rely on checking if item is already in list.
    // If Combo, we treat it as a single item in the list, but flag it?
    // We'll just add it to selectedServices.

    // Check if exists
    const exists = selectedServices.find(s => s.name === item.name && s._id === item._id);

    if (exists) {
        setSelectedServices(prev => prev.filter(s => s._id !== item._id));
    } else {
        // If Combo, ensure we store `originalPrice`
        const newItem = { ...item, type: isCombo ? 'combo' : 'service' };
        setSelectedServices(prev => [...prev, newItem]);
    }
  };

  const getServiceNamesFromIds = (ids: string[]) => {
      if (!shop?.services || !ids) return '';
      return ids.map(id => shop.services.find((s:any) => s._id === id)?.name).filter(Boolean).join(', ');
  };

  const getServiceObjectsFromIds = (ids: string[]) => {
      if (!shop?.services || !ids) return [];
      return ids.map(id => shop.services.find((s:any) => s._id === id)).filter(Boolean);
  };

  const handleBook = async () => {
    if (!selectedTime) return showToast("Please select a time slot", "error");
    if (selectedServices.length === 0) return showToast("Please select at least one service", "error");

    try {
        setLoading(true);
        const dateStr = formatLocalDate(selectedDate);
        
        // Construct Descriptive Service Names
        const serviceNames = selectedServices.map(s => {
            if (s.type === 'combo' && s.items && s.items.length > 0) {
                const itemNames = getServiceNamesFromIds(s.items);
                return `${s.name} (${itemNames})`;
            }
            return s.name;
        });

        await api.post('/bookings', {
            userId: user?._id,
            shopId: shop._id,
            barberId: selectedBarberId, 
            serviceNames: serviceNames,
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
                    <Text style={{fontWeight:'bold', fontSize:12, color:'black'}}> {shop?.rating || 0} ({shop?.reviewCount || 0} reviews)</Text>
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
        <View style={{flex: 1}}>
            {/* TABS */}
            <View style={[styles.tabs, {borderColor: colors.border, backgroundColor: colors.card, marginHorizontal: 20, marginTop: 20}]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'services' && { backgroundColor: colors.tint }]}
                    onPress={() => setActiveTab('services')}
                >
                    <Text style={[styles.tabText, activeTab === 'services' ? {color: '#000'} : {color: colors.text}]}>Services</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'combos' && { backgroundColor: colors.tint }]}
                    onPress={() => setActiveTab('combos')}
                >
                    <Text style={[styles.tabText, activeTab === 'combos' ? {color: '#000'} : {color: colors.text}]}>Combos</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'reviews' && { backgroundColor: colors.tint }]}
                    onPress={() => setActiveTab('reviews')}
                >
                    <Text style={[styles.tabText, activeTab === 'reviews' ? {color: '#000'} : {color: colors.text}]}>Reviews</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20, paddingBottom: 140}}>

                {/* SERVICES LIST */}
                {activeTab === 'services' && (
                    <>
                    <Text style={[styles.sectionTitle, {color: colors.textMuted, marginTop: 0}]}>Services</Text>
                    {shop?.services && shop.services.filter((s: any) => s.isAvailable !== false).map((service: any, index: number) => {
                        const isSelected = selectedServices.find(s => s._id === service._id);
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
                                                ₹{(service.price * (1 - config.userDiscountRate / 100)).toFixed(2)}
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
                    {(!shop?.services || shop.services.length === 0) && <Text style={{color: colors.textMuted, fontStyle: 'italic'}}>No services available.</Text>}
                    </>
                )}

                {/* COMBOS LIST */}
                {activeTab === 'combos' && (
                    <>
                    <Text style={[styles.sectionTitle, {color: colors.textMuted, marginTop: 0}]}>Combos</Text>
                    {shop?.combos && shop.combos.filter((c: any) => c.isAvailable !== false).map((combo: any, index: number) => {
                        const isSelected = selectedServices.find(s => s._id === combo._id);
                        return (
                            <TouchableOpacity 
                                key={index} 
                                style={[
                                    styles.serviceCard, 
                                    { backgroundColor: colors.card, borderColor: colors.border }, 
                                    isSelected && { 
                                        borderColor: colors.tint, 
                                        backgroundColor: theme === 'dark' ? '#1e293b' : '#fff7ed' 
                                    }
                                ]} 
                                onPress={() => toggleService(combo, true)}
                            >
                                <View style={{flex: 1}}>
                                    <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                                        <Layers size={16} color={colors.tint} />
                                        <Text style={[styles.serviceName, {color: colors.text}, isSelected && {color: colors.tint}]}>{combo.name}</Text>
                                    </View>

                                    <View style={{flexDirection: 'row', gap: 8, marginTop: 4}}>
                                        {config.userDiscountRate > 0 && (
                                            <View style={{backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}>
                                                <Text style={{color: 'white', fontSize: 10, fontWeight: 'bold'}}>{config.userDiscountRate}% OFF</Text>
                                            </View>
                                        )}
                                        {combo.originalPrice > combo.price && (
                                            <View style={{backgroundColor: '#ef4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4}}>
                                                <Text style={{color: 'white', fontSize: 10, fontWeight: 'bold'}}>
                                                    Save ₹{combo.originalPrice - combo.price}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    <Text style={[styles.serviceDuration, {color: colors.textMuted}]}>{combo.duration} mins • {combo.items?.length || 0} items</Text>
                                    
                                    {!isSelected && (
                                        <Text style={{fontSize: 11, color: colors.textMuted, marginTop: 6, fontStyle:'italic'}}>
                                            Includes: {getServiceNamesFromIds(combo.items)}
                                        </Text>
                                    )}

                                    {isSelected && (
                                        <View style={{
                                            marginTop: 12, 
                                            padding: 12, 
                                            backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', 
                                            borderRadius: 8,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            overflow: 'hidden'
                                        }}>
                                            <Text style={{color: colors.text, fontWeight: '700', marginBottom: 10, fontSize: 13}}>Package Breakdown</Text>
                                            
                                            {getServiceObjectsFromIds(combo.items).map((s: any, i: number) => (
                                                <View key={i} style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6}}>
                                                    <Text style={{color: colors.textMuted, fontSize: 13, flex: 1}}>• {s.name}</Text>
                                                    <Text style={{color: colors.textMuted, fontSize: 13}}>₹{s.price}</Text>
                                                </View>
                                            ))}
                                            
                                            <View style={{height: 1, backgroundColor: colors.border, marginVertical: 8}} />
                                            
                                            <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2}}>
                                                <Text style={{color: colors.textMuted, fontSize: 12}}>Total Value</Text>
                                                <Text style={{color: colors.textMuted, fontSize: 12, textDecorationLine: 'line-through'}}>₹{combo.originalPrice}</Text>
                                            </View>
                                            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                                                <Text style={{color: colors.text, fontWeight:'600', fontSize: 13}}>Combo Price</Text>
                                                <Text style={{color: colors.text, fontWeight:'600', fontSize: 13}}>₹{combo.price}</Text>
                                            </View>
                                            
                                            {config.userDiscountRate > 0 && (
                                                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 4}}>
                                                    <Text style={{color: '#10b981', fontSize: 12}}>Extra Discount ({config.userDiscountRate}%)</Text>
                                                    <Text style={{color: '#10b981', fontSize: 12}}>-₹{(combo.price * config.userDiscountRate / 100).toFixed(2)}</Text>
                                                </View>
                                            )}
                                            
                                            <View style={{
                                                flexDirection: 'row', 
                                                justifyContent: 'space-between', 
                                                marginTop: 8, 
                                                paddingTop: 8, 
                                                borderTopWidth: 1, 
                                                borderTopColor: colors.border, 
                                                borderStyle: 'dashed'
                                            }}>
                                                <Text style={{color: colors.tint, fontWeight:'bold'}}>Final Price</Text>
                                                <Text style={{color: colors.tint, fontWeight:'bold'}}>₹{(combo.price * (1 - config.userDiscountRate / 100)).toFixed(2)}</Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                                
                                <View style={{alignItems:'flex-end', paddingLeft: 8}}>
                                    <View style={{alignItems: 'flex-end'}}>
                                        <Text style={[styles.servicePrice, {color: colors.text}, isSelected && {color: colors.tint}]}>
                                            ₹{(combo.price * (1 - config.userDiscountRate / 100)).toFixed(2)}
                                        </Text>

                                        {config.userDiscountRate > 0 && (
                                            <Text style={{textDecorationLine: 'line-through', color: colors.textMuted, fontSize: 11}}>
                                                ₹{combo.price}
                                            </Text>
                                        )}

                                        {combo.originalPrice > combo.price && (
                                            <Text style={{color: colors.textMuted, fontSize: 10, marginTop: 2}}>
                                                ₹{combo.originalPrice}
                                            </Text>
                                        )}
                                    </View>
                                    {/* FIXED: Removed invalid 'weight' prop and used 'strokeWidth' instead */}
                                    {isSelected && <Check size={18} color={colors.tint} style={{marginTop: 8}} strokeWidth={3}/>}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    {(!shop?.combos || shop.combos.length === 0) && <Text style={{color: colors.textMuted, fontStyle: 'italic', padding: 20, textAlign:'center'}}>No combos available.</Text>}
                    </>
                )}

                {/* REVIEWS LIST */}
                {activeTab === 'reviews' && (
                    <>
                    <Text style={[styles.sectionTitle, {color: colors.textMuted, marginTop: 0}]}>Customer Reviews</Text>
                    {reviews.map((rev, index) => (
                        <View key={index} style={[styles.reviewCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                            <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 8}}>
                                <Image source={{uri: rev.userId?.avatar || `https://ui-avatars.com/api/?name=${rev.userId?.name || 'User'}`}} style={{width: 32, height: 32, borderRadius: 16, marginRight: 8}} />
                                <View>
                                    <Text style={{color: colors.text, fontWeight: 'bold'}}>{rev.userId?.name || 'User'}</Text>
                                    <View style={{flexDirection: 'row'}}>
                                        {[1,2,3,4,5].map(s => (
                                            <Star key={s} size={10} color={s <= rev.rating ? colors.tint : colors.textMuted} fill={s <= rev.rating ? colors.tint : 'transparent'} />
                                        ))}
                                    </View>
                                </View>
                                <Text style={{marginLeft: 'auto', color: colors.textMuted, fontSize: 10}}>{new Date(rev.createdAt).toLocaleDateString()}</Text>
                            </View>
                            {rev.comment && <Text style={{color: colors.text, fontSize: 13}}>{rev.comment}</Text>}
                        </View>
                    ))}
                    {reviews.length === 0 && (
                        <View style={{alignItems: 'center', padding: 20}}>
                            <MessageSquare size={48} color={colors.textMuted} />
                            <Text style={{color: colors.textMuted, marginTop: 10}}>No reviews yet.</Text>
                        </View>
                    )}
                    </>
                )}

            </ScrollView>
        </View>
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
            
            <View style={[styles.summaryCard, {backgroundColor: colors.card, borderColor: colors.border, padding: 0, overflow: 'hidden'}]}>
                <View style={{padding: 20, backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc', borderBottomWidth: 1, borderBottomColor: colors.border}}>
                    <Text style={[styles.summaryTitle, {color: colors.text, fontSize: 20, marginBottom: 4}]}>Booking Summary</Text>
                    <Text style={{color: colors.textMuted, fontSize: 13}}>Please review your appointment details</Text>
                </View>
                
                <View style={{padding: 20}}>
                    {/* Appointment Info */}
                    <View style={{flexDirection: 'row', gap: 12, marginBottom: 20}}>
                        <View style={{flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9', alignItems: 'center'}}>
                            <Calendar size={20} color={colors.tint} style={{marginBottom: 8}} />
                            <Text style={{color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold'}}>Date</Text>
                            <Text style={{color: colors.text, fontWeight: 'bold', marginTop: 2}}>{selectedDate.toLocaleDateString('en-US', {day: 'numeric', month: 'short'})}</Text>
                        </View>
                        <View style={{flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9', alignItems: 'center'}}>
                            <Clock size={20} color={colors.tint} style={{marginBottom: 8}} />
                            <Text style={{color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold'}}>Time</Text>
                            <Text style={{color: colors.text, fontWeight: 'bold', marginTop: 2}}>{selectedTime}</Text>
                        </View>
                        <View style={{flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9', alignItems: 'center'}}>
                            <User size={20} color={colors.tint} style={{marginBottom: 8}} />
                            <Text style={{color: colors.textMuted, fontSize: 11, textTransform: 'uppercase', fontWeight: 'bold'}}>Pro</Text>
                            <Text style={{color: colors.text, fontWeight: 'bold', marginTop: 2, textAlign: 'center', fontSize: 12}} numberOfLines={1}>
                                {selectedBarberId === 'any' ? 'Any' : barbers.find((b:any) => b._id === selectedBarberId)?.name?.split(' ')[0]}
                            </Text>
                        </View>
                    </View>

                    {/* Dashed Divider */}
                    <View style={{height: 1, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 1, marginBottom: 20}} />

                    {/* Services List */}
                    <Text style={{color: colors.textMuted, fontSize: 12, fontWeight: 'bold', marginBottom: 12, textTransform: 'uppercase'}}>Services Selected</Text>
                    {selectedServices.map((s, i) => (
                        <View key={i} style={{marginBottom: 12}}>
                            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems: 'flex-start'}}>
                                <View style={{flex: 1, paddingRight: 8}}>
                                    <Text style={{color: colors.text, fontWeight: '600', fontSize: 15}}>{s.name}</Text>
                                    {s.type === 'combo' && (
                                        <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 2}}>
                                            Package: {getServiceNamesFromIds(s.items)}
                                        </Text>
                                    )}
                                    <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 2}}>{s.duration} mins</Text>
                                </View>
                                <Text style={{color: colors.text, fontWeight: '600', fontSize: 15}}>₹{s.price}</Text>
                            </View>
                        </View>
                    ))}

                    {/* Dashed Divider */}
                    <View style={{height: 1, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 1, marginVertical: 16}} />
                    
                    {/* Price Breakdown */}
                    <View style={{gap: 8}}>
                        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                            <Text style={{color: colors.textMuted}}>Item Total</Text>
                            <Text style={{color: colors.text}}>₹{calculateTotal().toFixed(2)}</Text>
                        </View>
                        {config.userDiscountRate > 0 && (
                            <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                <Text style={{color: '#10b981'}}>Member Discount ({config.userDiscountRate}%)</Text>
                                <Text style={{color: '#10b981'}}>- ₹{(calculateTotal() * (config.userDiscountRate / 100)).toFixed(2)}</Text>
                            </View>
                        )}
                        <View style={{flexDirection:'row', justifyContent:'space-between', marginTop: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border}}>
                            <Text style={{color: colors.text, fontWeight: 'bold', fontSize: 18}}>To Pay</Text>
                            <Text style={{color: colors.tint, fontWeight: 'bold', fontSize: 22}}>
                                ₹{(calculateTotal() * (1 - config.userDiscountRate / 100)).toFixed(2)}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* Payment Methods */}
            <Text style={[styles.sectionTitle, {color: colors.textMuted, marginTop: 24}]}>Payment Method</Text>

            <View style={{gap: 12}}>
                <TouchableOpacity 
                    style={[
                        styles.paymentCard, 
                        { backgroundColor: colors.card, borderColor: colors.border, padding: 16, borderRadius: 12, borderWidth: 1 }, 
                        paymentMethod === 'cash' && { borderColor: colors.tint, backgroundColor: theme === 'dark' ? '#1e293b' : '#fff7ed' }
                    ]} 
                    onPress={() => setPaymentMethod('cash')}
                >
                    <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: paymentMethod === 'cash' ? colors.tint : (theme === 'dark' ? '#334155' : '#f1f5f9'), alignItems: 'center', justifyContent: 'center'}}>
                        <Banknote size={20} color={paymentMethod === 'cash' ? '#000' : colors.textMuted} />
                    </View>
                    <View style={{flex: 1, marginLeft: 12}}>
                        <Text style={[styles.paymentTitle, {color: colors.text, fontSize: 16}, paymentMethod === 'cash' && {color: colors.tint}]}>Cash at Salon</Text>
                        <Text style={[styles.paymentSub, {color: colors.textMuted}]}>Pay after service</Text>
                    </View>
                    {paymentMethod === 'cash' && (
                        <View style={{backgroundColor: colors.tint, borderRadius: 12, padding: 4}}>
                            <Check size={14} color="black" strokeWidth={3} />
                        </View>
                    )}
                </TouchableOpacity>

                {config.isPaymentTestMode ? (
                    <TouchableOpacity
                    style={[
                        styles.paymentCard, 
                        { backgroundColor: colors.card, borderColor: colors.border, padding: 16, borderRadius: 12, borderWidth: 1 }, 
                        paymentMethod === 'online' && { borderColor: colors.tint, backgroundColor: theme === 'dark' ? '#1e293b' : '#fff7ed' }
                    ]}
                    onPress={() => setPaymentMethod('online')}
                    >
                        <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: paymentMethod === 'online' ? colors.tint : (theme === 'dark' ? '#334155' : '#f1f5f9'), alignItems: 'center', justifyContent: 'center'}}>
                            <CreditCard size={20} color={paymentMethod === 'online' ? '#000' : colors.textMuted} />
                        </View>
                        <View style={{flex: 1, marginLeft: 12}}>
                            <Text style={[styles.paymentTitle, {color: colors.text, fontSize: 16}, paymentMethod === 'online' && {color: colors.tint}]}>Pay Online</Text>
                            <Text style={[styles.paymentSub, {color: colors.textMuted}]}>UPI, Cards, Netbanking (Test)</Text>
                        </View>
                         {paymentMethod === 'online' && (
                            <View style={{backgroundColor: colors.tint, borderRadius: 12, padding: 4}}>
                                <Check size={14} color="black" strokeWidth={3} />
                            </View>
                        )}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.paymentCard, {backgroundColor: colors.card, borderColor: colors.border, padding: 16, borderRadius: 12, borderWidth: 1, opacity: 0.6}]} disabled={true}>
                        <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: theme === 'dark' ? '#334155' : '#f1f5f9', alignItems: 'center', justifyContent: 'center'}}>
                            <CreditCard size={20} color={colors.textMuted} />
                        </View>
                        <View style={{flex: 1, marginLeft: 12}}>
                            <Text style={[styles.paymentTitle, {color: colors.textMuted}]}>Pay Online</Text>
                            <Text style={[styles.paymentSub, {color: colors.textMuted}]}>Currently Unavailable</Text>
                        </View>
                    </TouchableOpacity>
                )}
            </View>

         </ScrollView>
         </SlideInView>
      )}

      {selectedServices.length > 0 && (
          <View style={[styles.footer, {backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', borderTopColor: colors.border}]}>
             <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                <View>
                    <Text style={[styles.footerSub, {color: colors.textMuted}]}>{selectedServices.length} items</Text>
                    <Text style={[styles.footerPrice, {color: colors.text}]}>
                        ₹{config.userDiscountRate > 0
                           ? (calculateTotal() * (1 - config.userDiscountRate / 100)).toFixed(2)
                           : calculateTotal().toFixed(2)}
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

  // TABS
  tabs: { flexDirection: 'row', borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontWeight: 'bold' },

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
  reviewCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
});
