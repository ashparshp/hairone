import React, { useState, useEffect } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator , Linking, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useBooking } from '../../context/BookingContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext'; 
import { SlideInView } from '../../components/AnimatedViews'; 
import api, { getShopReviews } from '../../services/api';
import { ChevronLeft, Star, Clock, Check, Calendar, User, Banknote, CreditCard, Heart, MapPin, MessageSquare, Plus, Image as ImageIcon } from 'lucide-react-native';
import { formatLocalDate } from '../../utils/date';

export default function ShopDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user, login, token } = useAuth();
  const { showToast } = useToast();
  const { colors, theme } = useTheme(); 
  
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
  const [isHomeService, setIsHomeService] = useState(false);
  const [isHomeBookingMode, setIsHomeBookingMode] = useState(false); // Toggle for filtering services
  const [address, setAddress] = useState('');
  const [addressCoords, setAddressCoords] = useState<{lat: number, lng: number} | null>(null);

  // TABS
  const [activeTab, setActiveTab] = useState<'services' | 'combos' | 'reviews' | 'gallery'>('services');

  // GALLERY STATE
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const isDark = theme === 'dark';

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

  useEffect(() => {
      // Sync isHomeService with mode for Booking Logic
      setIsHomeService(isHomeBookingMode);
  }, [isHomeBookingMode]);

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

  const isFav = user?.favorites?.includes(id as string);

  const toggleFavorite = async () => {
    if (!user) return showToast("Please login to save shops", "error");
    try {
      const res = await api.post('/auth/favorites', { shopId: id });
      const updatedUser = { ...user, favorites: res.data };
      if (token) login(token, updatedUser);
      // const isNowFav = updatedUser.favorites.includes(id as string);
      // showToast(isNowFav ? "Added to favorites" : "Removed from favorites", "success");
    } catch (e) {
      console.log("Fav Error", e);
    }
  };

  const calculateDuration = () => selectedServices.reduce((sum, s) => {
    const val = parseInt(s.duration, 10);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const calculateTotal = () => {
      let total = selectedServices.reduce((sum, s) => {
        const val = parseFloat(s.price);
        return sum + (isNaN(val) ? 0 : val);
      }, 0);

      if (isHomeService && shop?.homeService?.travelFee) {
          total += shop.homeService.travelFee;
      }
      return total;
  };

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
    const exists = selectedServices.find(s => s.name === item.name && s._id === item._id);
    if (exists) {
        setSelectedServices(prev => prev.filter(s => s._id !== item._id));
    } else {
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

    if (isHomeService) {
        if (!address.trim()) return showToast("Please enter delivery address", "error");
        // For simulation, if coords not set, mock them near the shop or user location
        if (!addressCoords) {
            // Mock coords if not set (in real app, use Geocoding)
            // But we can check if shop has coords and just put it nearby for MVP success
             const mockCoords = {
                 lat: shop?.coordinates?.lat || 0,
                 lng: shop?.coordinates?.lng || 0
             };
             setAddressCoords(mockCoords);
        }
    }

    try {
        setLoading(true);
        const dateStr = formatLocalDate(selectedDate);
        const serviceNames = selectedServices.map(s => {
            if (s.type === 'combo' && s.items && s.items.length > 0) {
                const itemNames = getServiceNamesFromIds(s.items);
                return `${s.name} (${itemNames})`;
            }
            return s.name;
        });

        const payload: any = {
            userId: user?._id,
            shopId: shop._id,
            barberId: selectedBarberId, 
            serviceNames: serviceNames,
            totalPrice: calculateTotal(),
            totalDuration: calculateDuration(),
            date: dateStr,
            startTime: selectedTime,
            paymentMethod: paymentMethod === 'online' ? 'ONLINE' : 'CASH',
            isHomeService: isHomeService
        };

        if (isHomeService) {
            // Use mock coords if still null (should be handled above, but double check)
            const coords = addressCoords || { lat: shop.coordinates?.lat || 0, lng: shop.coordinates?.lng || 0 };
            payload.deliveryAddress = {
                line1: address,
                coordinates: coords
            };
        }

        await api.post('/bookings', payload);

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
             
             <TouchableOpacity style={styles.backBtnAbsolute} onPress={() => router.back()}>
                <ChevronLeft color="white" size={24} />
             </TouchableOpacity>

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

             {/* HOME SERVICE TOGGLE (Moved to top of Step 1) */}
             {shop?.homeService?.isAvailable && (
                 <View style={[styles.homeServiceBanner, {backgroundColor: isHomeBookingMode ? colors.tint : (isDark ? '#1e293b' : '#f1f5f9'), borderColor: isHomeBookingMode ? colors.tint : colors.border}]}>
                     <View style={{flex: 1}}>
                         <Text style={[styles.hsTitle, {color: isHomeBookingMode ? 'black' : colors.text}]}>
                             {isHomeBookingMode ? 'Booking Home Service' : 'Book Home Service?'}
                         </Text>
                         <Text style={[styles.hsSub, {color: isHomeBookingMode ? 'black' : colors.textMuted}]}>
                             {isHomeBookingMode
                                 ? `Filtering menu for home delivery (+₹${shop.homeService.travelFee})`
                                 : 'Switch to see home service menu'}
                         </Text>
                     </View>
                     <TouchableOpacity
                        style={[styles.hsToggleBtn, {backgroundColor: isHomeBookingMode ? 'black' : (isDark ? '#334155' : 'white')}]}
                        onPress={() => setIsHomeBookingMode(!isHomeBookingMode)}
                     >
                         <Text style={{color: isHomeBookingMode ? 'white' : colors.text, fontWeight: 'bold', fontSize: 12}}>
                             {isHomeBookingMode ? 'ON' : 'OFF'}
                         </Text>
                     </TouchableOpacity>
                 </View>
             )}

            {/* TABS */}
             <View style={[styles.tabs, {borderColor: colors.border, backgroundColor: colors.card, marginHorizontal: 20, marginTop: 10}]}>
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
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'gallery' && { backgroundColor: colors.tint }]}
                    onPress={() => setActiveTab('gallery')}
                >
                    <Text style={[styles.tabText, activeTab === 'gallery' ? {color: '#000'} : {color: colors.text}]}>Gallery</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20, paddingBottom: 140}}>

                {/* SERVICES LIST (BIGGER FONT ON NAME) */}
                {activeTab === 'services' && (
                    <>
                    <Text style={[styles.sectionTitle, {color: colors.textMuted, marginTop: 0}]}>Services</Text>
                    {shop?.services && shop.services
                        .filter((s: any) => s.isAvailable !== false)
                        .filter((s: any) => !isHomeBookingMode || s.isHomeServiceAvailable !== false)
                        .map((service: any, index: number) => {
                        const isSelected = selectedServices.find(s => s._id === service._id);
                        
                        // Colors
                        const cardBg = isDark ? '#000000' : '#ffffff';
                        const borderColor = isSelected ? '#10b981' : (isDark ? '#27272a' : '#e5e7eb');
                        const priceColor = isDark ? '#facc15' : '#0f172a'; // Yellow/Gold in dark mode

                        return (
                            <TouchableOpacity 
                                key={index} 
                                activeOpacity={0.9}
                                style={[styles.serviceCardNew, { backgroundColor: cardBg, borderColor: borderColor, borderWidth: isSelected ? 2 : 1 }]} 
                                onPress={() => toggleService(service)}
                            >
                                {/* TOP ROW: Service Name & Price */}
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12}}>
                                    <View style={{flex: 1, paddingRight: 10}}>
                                        {/* FONT SIZE INCREASED TO 20 */}
                                        <Text style={[styles.serviceNameNew, {color: colors.text, fontSize: 20}]}>{service.name}</Text>
                                    </View>
                                    <View style={{alignItems: 'flex-end'}}>
                                        <Text style={[styles.servicePriceNew, {color: priceColor, fontSize: 16}]}>
                                            ₹{(service.price * (1 - config.userDiscountRate / 100)).toFixed(2)}
                                        </Text>
                                        {config.userDiscountRate > 0 && (
                                            <Text style={{textDecorationLine: 'line-through', color: colors.textMuted, fontSize: 11}}>
                                                ₹{service.price}
                                            </Text>
                                        )}
                                    </View>
                                </View>

                                {/* BOTTOM ROW: Duration & Add Button */}
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                                    {/* Left: Duration & Discount Tag */}
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                            <Clock size={14} color={colors.textMuted} />
                                            <Text style={{color: colors.textMuted, fontSize: 14, fontWeight: '500'}}>{service.duration} mins</Text>
                                        </View>
                                        
                                        {config.userDiscountRate > 0 && (
                                            <View style={styles.tagDiscountSmall}>
                                                <Text style={{color: '#fff', fontSize: 9, fontWeight: 'bold'}}>{config.userDiscountRate}% OFF</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Right: Add Button */}
                                    <View style={[styles.addBtn, { backgroundColor: isSelected ? '#10b981' : (isDark ? '#27272a' : '#f1f5f9') }]}>
                                        {isSelected ? (
                                            <View style={{flexDirection:'row', alignItems:'center', gap: 4}}>
                                                <Check size={14} color="#fff" strokeWidth={3}/>
                                                <Text style={{color: '#fff', fontSize: 11, fontWeight: 'bold'}}>ADDED</Text>
                                            </View>
                                        ) : (
                                            <View style={{flexDirection:'row', alignItems:'center', gap: 4}}>
                                                <Plus size={14} color={isDark ? '#fff' : '#0f172a'} />
                                                <Text style={{color: isDark ? '#fff' : '#0f172a', fontSize: 11, fontWeight: 'bold'}}>ADD</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    {(!shop?.services || shop.services.length === 0) && <Text style={{color: colors.textMuted, fontStyle: 'italic'}}>No services available.</Text>}
                    </>
                )}

                {/* COMBOS LIST (UPDATED CARD UI) */}
                {activeTab === 'combos' && (
                    <>
                    <Text style={[styles.sectionTitle, {color: colors.textMuted, marginTop: 0}]}>Exclusive Packages</Text>
                    {shop?.combos && shop.combos
                        .filter((c: any) => c.isAvailable !== false)
                        .filter((c: any) => !isHomeBookingMode || c.isHomeServiceAvailable !== false)
                        .map((combo: any, index: number) => {
                        const isSelected = selectedServices.find(s => s._id === combo._id);
                        
                        // Calculations
                        const finalPrice = combo.price * (1 - config.userDiscountRate / 100);
                        const savings = combo.originalPrice - combo.price;
                        
                        // Colors
                        const cardBg = isDark ? '#000000' : '#ffffff';
                        const innerBg = isDark ? '#18181b' : '#f8fafc';
                        const priceColor = isDark ? '#facc15' : '#0f172a';
                        const borderColor = isSelected ? '#10b981' : (isDark ? '#27272a' : '#e5e7eb');
                        const dividerColor = isDark ? '#3f3f46' : '#cbd5e1';

                        return (
                            <TouchableOpacity 
                                key={index} 
                                activeOpacity={0.95}
                                style={[styles.comboContainer, { backgroundColor: cardBg, borderColor: borderColor, borderWidth: isSelected ? 2 : 1 }]} 
                                onPress={() => toggleService(combo, true)}
                            >
                                {/* Header Section */}
                                <View style={styles.comboHeader}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={[styles.comboTitle, { color: colors.text }]}>{combo.name}</Text>
                                        <View style={styles.comboMetaRow}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Clock size={12} color={colors.textMuted} />
                                                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textMuted }}>{combo.duration} mins</Text>
                                                <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textMuted }} />
                                                <Text style={{ fontSize: 12, fontWeight: '500', color: colors.textMuted }}>{combo.items?.length || 0} items</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Price Stack */}
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[styles.comboFinalPrice, { color: priceColor }]}>
                                            ₹{finalPrice.toFixed(2)}
                                        </Text>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            {config.userDiscountRate > 0 && (
                                                <Text style={[styles.comboStrike, { color: colors.textMuted }]}>
                                                    ₹{combo.price.toFixed(2)}
                                                </Text>
                                            )}
                                            {combo.originalPrice > combo.price && (
                                                <Text style={[styles.comboStrike, { color: colors.textMuted }]}>
                                                    ₹{combo.originalPrice.toFixed(2)}
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                </View>

                                {/* Inner Breakdown Card */}
                                <View style={[styles.comboBreakdownCard, { backgroundColor: innerBg, borderColor: isDark ? '#27272a' : '#e2e8f0' }]}>
                                    <View style={styles.comboBreakdownHeader}>
                                        <Text style={[styles.comboBreakdownTitle, {color: isDark ? '#e4e4e7' : '#334155', marginBottom: 0}]}>Package Breakdown</Text>
                                        {savings > 0 && (
                                            <View style={styles.tagSavings}>
                                                <Text style={styles.tagText}>Save ₹{savings.toFixed(2)}</Text>
                                            </View>
                                        )}
                                    </View>
                                    
                                    {/* Items List */}
                                    <View style={{ marginBottom: 16 }}>
                                        {getServiceObjectsFromIds(combo.items).map((s: any, i: number) => (
                                            <View key={i} style={styles.comboItemRow}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textMuted }} />
                                                    <Text style={{ color: isDark ? '#d4d4d8' : '#475569', fontSize: 13, fontWeight: '500' }}>{s.name}</Text>
                                                </View>
                                                <Text style={{ color: isDark ? '#ffffff' : '#1e293b', fontWeight: '600', fontSize: 13 }}>₹{s.price.toFixed(2)}</Text>
                                            </View>
                                        ))}
                                    </View>

                                    {/* Dashed Divider */}
                                    <View style={[styles.dashedDivider, { borderColor: dividerColor }]} />

                                    {/* Calculations */}
                                    <View style={{ gap: 6 }}>
                                        <View style={styles.comboCalcRow}>
                                            <Text style={{ color: colors.textMuted, fontSize: 12, fontWeight: '500' }}>Total Value</Text>
                                            <Text style={{ color: colors.textMuted, fontSize: 12, textDecorationLine: 'line-through' }}>₹{combo.originalPrice.toFixed(2)}</Text>
                                        </View>
                                        <View style={styles.comboCalcRow}>
                                            <Text style={{ color: isDark ? '#d4d4d8' : '#475569', fontSize: 13, fontWeight: '500' }}>Combo Price</Text>
                                            <Text style={{ color: isDark ? '#ffffff' : '#1e293b', fontSize: 13, fontWeight: 'bold' }}>₹{combo.price.toFixed(2)}</Text>
                                        </View>
                                        {config.userDiscountRate > 0 && (
                                            <View style={styles.comboCalcRow}>
                                                <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '500' }}>Extra Discount ({config.userDiscountRate}%)</Text>
                                                <Text style={{ color: '#10b981', fontSize: 13 }}>-₹{(combo.price * config.userDiscountRate / 100).toFixed(2)}</Text>
                                            </View>
                                        )}
                                        <View style={[styles.comboCalcRow, { marginTop: 8, alignItems: 'flex-end' }]}>
                                            <Text style={{ color: isDark ? '#ca8a04' : '#64748b', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>Final Price</Text>
                                            <Text style={{ color: priceColor, fontSize: 20, fontWeight: 'bold' }}>₹{finalPrice.toFixed(2)}</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Action Button */}
                                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                                    <View style={[styles.comboBookBtn, { backgroundColor: isSelected ? '#10b981' : (isDark ? '#eab308' : '#0f172a') }]}>
                                        <Text style={[styles.comboBookBtnText, { color: isDark ? '#000000' : '#ffffff' }]}>
                                            {isSelected ? 'Selected' : 'Book Package'}
                                        </Text>
                                        {isSelected && (
                                            <Check size={18} color={isDark ? '#000' : '#fff'} strokeWidth={3} />
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                    {(!shop?.combos || shop.combos.length === 0) && <Text style={{color: colors.textMuted, fontStyle: 'italic'}}>No combos available.</Text>}
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

                {/* GALLERY LIST */}
                {activeTab === 'gallery' && (
                    <>
                    <Text style={[styles.sectionTitle, {color: colors.textMuted, marginTop: 0}]}>Shop Portfolio</Text>

                    {shop?.gallery && shop.gallery.length > 0 ? (
                        <View style={styles.galleryGrid}>
                            {shop.gallery.map((img: string, idx: number) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.galleryItem, { borderColor: colors.border }]}
                                    onPress={() => setViewingImage(img)}
                                >
                                    <Image source={{ uri: img }} style={styles.galleryImage} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : (
                        <View style={{alignItems: 'center', padding: 20}}>
                            <ImageIcon size={48} color={colors.textMuted} />
                            <Text style={{color: colors.textMuted, marginTop: 10}}>No images in gallery.</Text>
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

            {/* Home Service Address (Only if mode enabled) */}
            {isHomeService && shop?.homeService?.isAvailable && (
                <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border, marginBottom: 24, padding: 16}]}>
                    <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                        <View style={{flex:1}}>
                            <Text style={{color: colors.text, fontWeight:'bold', fontSize: 16}}>Home Delivery</Text>
                            <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 4}}>
                                {shop.name} comes to your location (+₹{shop.homeService.travelFee})
                            </Text>
                        </View>
                    </View>

                    <View style={{marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border}}>
                            <Text style={[styles.label, {color: colors.textMuted}]}>Delivery Address</Text>
                            <View style={[styles.inputContainer, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', borderColor: colors.border}]}>
                            <MapPin size={18} color={colors.textMuted} style={{marginLeft: 12}} />
                            <TextInput // Replaced styles.input with inline or defined style
                                style={{flex: 1, padding: 14, fontSize: 14, color: colors.text}}
                                value={address}
                                onChangeText={setAddress}
                                placeholder="Enter full address"
                                placeholderTextColor={colors.textMuted}
                            />
                            </View>
                            <TouchableOpacity
                            style={{flexDirection:'row', alignItems:'center', gap: 6, marginTop: 8}}
                            onPress={() => {
                                // Simulate current location
                                setAddress("Current Location (Simulated)");
                                setAddressCoords({ lat: shop.coordinates?.lat, lng: shop.coordinates?.lng });
                            }}
                            >
                                <MapPin size={12} color={colors.tint} />
                                <Text style={{color: colors.tint, fontSize: 12, fontWeight:'bold'}}>Use Current Location</Text>
                            </TouchableOpacity>
                    </View>
                </View>
            )}

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
            
            <View style={{marginBottom: 8}}>
                <Text style={[styles.sectionTitle, {color: colors.textMuted, marginTop: 0}]}>Review Details</Text>
            </View>

            <View style={[styles.receiptCard, {backgroundColor: isDark ? '#18181b' : '#f8fafc', borderColor: isDark ? '#27272a' : '#e2e8f0'}]}>
                {/* Header Info */}
                <View style={styles.receiptHeader}>
                    <View style={styles.receiptRow}>
                        <Calendar size={16} color={colors.textMuted} />
                        <Text style={[styles.receiptText, {color: colors.text}]}>{selectedDate.toDateString()}</Text>
                    </View>
                    <View style={styles.receiptRow}>
                        <Clock size={16} color={colors.textMuted} />
                        <Text style={[styles.receiptText, {color: colors.text}]}>{selectedTime}</Text>
                    </View>
                </View>

                {/* Barber Info */}
                <View style={[styles.receiptRow, {marginBottom: 16}]}>
                    <User size={16} color={colors.textMuted} />
                    <Text style={[styles.receiptText, {color: colors.text, fontWeight: '600'}]}>
                        {selectedBarberId === 'any' ? 'Random Professional' : barbers.find((b:any) => b._id === selectedBarberId)?.name}
                    </Text>
                </View>

                {/* Divider */}
                <View style={[styles.dashedDivider, {borderColor: isDark ? '#3f3f46' : '#cbd5e1', marginBottom: 16}]} />

                {/* Service List */}
                <View style={{marginBottom: 16}}>
                    {selectedServices.map((s, i) => (
                        <View key={i} style={styles.receiptItem}>
                            <View style={{flex: 1, paddingRight: 8}}>
                                <Text style={{color: colors.text, fontWeight: '500', fontSize: 13}}>{s.name}</Text>
                                {s.type === 'combo' && (
                                    <Text style={{color: colors.textMuted, fontSize: 11, marginTop: 2}}>
                                        Combo Package
                                    </Text>
                                )}
                            </View>
                            <Text style={{color: colors.text, fontWeight: '600', fontSize: 13}}>₹{s.price.toFixed(2)}</Text>
                        </View>
                    ))}
                </View>

                {/* Divider */}
                <View style={[styles.dashedDivider, {borderColor: isDark ? '#3f3f46' : '#cbd5e1', marginBottom: 16}]} />

                {/* Total Section */}
                <View style={{gap: 6}}>
                    <View style={styles.receiptRowBetween}>
                        <Text style={{color: colors.textMuted, fontSize: 13}}>Subtotal (Services)</Text>
                        <Text style={{color: colors.text, fontSize: 13}}>
                            {/* Calculate subtotal without travel fee for display clarity if possible, but calculateTotal includes it.
                                Let's subtract fee if home service to show breakdown. */}
                             ₹{(calculateTotal() - (isHomeService ? (shop?.homeService?.travelFee || 0) : 0)).toFixed(2)}
                        </Text>
                    </View>

                    {isHomeService && (
                         <View style={styles.receiptRowBetween}>
                            <Text style={{color: colors.textMuted, fontSize: 13}}>Travel Fee</Text>
                            <Text style={{color: colors.text, fontSize: 13}}>+ ₹{(shop?.homeService?.travelFee || 0).toFixed(2)}</Text>
                        </View>
                    )}

                    {config.userDiscountRate > 0 && (
                        <View style={styles.receiptRowBetween}>
                            <Text style={{color: '#10b981', fontSize: 13}}>Discount ({config.userDiscountRate}%)</Text>
                            <Text style={{color: '#10b981', fontSize: 13}}>- ₹{(calculateTotal() * (config.userDiscountRate / 100)).toFixed(2)}</Text>
                        </View>
                    )}
                    <View style={[styles.receiptRowBetween, {marginTop: 8}]}>
                        <Text style={{color: colors.text, fontWeight: 'bold', fontSize: 16}}>Total Payable</Text>
                        <Text style={{color: isDark ? '#facc15' : '#0f172a', fontWeight: 'bold', fontSize: 20}}>
                            ₹{(calculateTotal() * (1 - config.userDiscountRate / 100)).toFixed(2)}
                        </Text>
                    </View>
                </View>
            </View>

            {/* Payment Section */}
            <Text style={[styles.sectionTitle, {color: colors.textMuted, marginTop: 24}]}>Payment Method</Text>

            <TouchableOpacity 
                activeOpacity={0.9}
                style={[
                    styles.payOption, 
                    {
                        backgroundColor: isDark ? '#18181b' : '#ffffff', 
                        borderColor: paymentMethod === 'cash' ? '#10b981' : (isDark ? '#27272a' : '#e2e8f0'),
                        borderWidth: paymentMethod === 'cash' ? 2 : 1
                    }
                ]} 
                onPress={() => setPaymentMethod('cash')}
            >
                <View style={styles.payIconBg}>
                    <Banknote size={20} color={isDark ? '#eab308' : '#ca8a04'} />
                </View>
                <View style={{flex: 1}}>
                    <Text style={[styles.payTitle, {color: colors.text}]}>Pay at Salon</Text>
                    <Text style={[styles.paySub, {color: colors.textMuted}]}>Pay at the salon after service</Text>
                </View>
                <View style={[styles.radioCircle, {borderColor: paymentMethod === 'cash' ? '#10b981' : colors.textMuted}]}>
                    {paymentMethod === 'cash' && <View style={styles.radioDot} />}
                </View>
            </TouchableOpacity>

            {config.isPaymentTestMode ? (
                <TouchableOpacity
                   activeOpacity={0.9}
                   style={[
                        styles.payOption, 
                        {
                            backgroundColor: isDark ? '#18181b' : '#ffffff', 
                            borderColor: paymentMethod === 'online' ? '#10b981' : (isDark ? '#27272a' : '#e2e8f0'),
                            borderWidth: paymentMethod === 'online' ? 2 : 1
                        }
                   ]}
                   onPress={() => setPaymentMethod('online')}
                >
                    <View style={styles.payIconBg}>
                        <CreditCard size={20} color={isDark ? '#eab308' : '#ca8a04'} />
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={[styles.payTitle, {color: colors.text}]}>Pay Online (Test)</Text>
                        <Text style={[styles.paySub, {color: colors.textMuted}]}>Simulate Online Payment</Text>
                    </View>
                    <View style={[styles.radioCircle, {borderColor: paymentMethod === 'online' ? '#10b981' : colors.textMuted}]}>
                        {paymentMethod === 'online' && <View style={styles.radioDot} />}
                    </View>
                </TouchableOpacity>
            ) : (
                <View style={[styles.payOption, {backgroundColor: isDark ? '#18181b' : '#ffffff', borderColor: isDark ? '#27272a' : '#e2e8f0', opacity: 0.5}]}>
                    <View style={[styles.payIconBg, {backgroundColor: isDark ? '#27272a' : '#f1f5f9'}]}>
                        <CreditCard size={20} color={colors.textMuted} />
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={[styles.payTitle, {color: colors.textMuted}]}>UPI / Online</Text>
                        <Text style={[styles.paySub, {color: colors.textMuted}]}>Coming Soon</Text>
                    </View>
                </View>
            )}

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
                    style={[styles.nextBtn, {backgroundColor: '#f59e0b'}, (step === 2 && !selectedTime) && {opacity: 0.5}]}
                    disabled={step === 2 && !selectedTime}
                    onPress={() => setStep(step + 1)}
                    >
                    <Text style={styles.nextBtnText}>Continue</Text>
                    <ChevronLeft size={16} color="#ffffff" style={{transform: [{rotate: '180deg'}]}} />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={[styles.nextBtn, {backgroundColor: '#f59e0b'}]} onPress={handleBook}>
                        {loading ? <ActivityIndicator color="white"/> : <Text style={styles.nextBtnText}>Confirm Booking</Text>}
                    </TouchableOpacity>
                )}
             </View>
          </View>
      )}

      {/* FULL SCREEN IMAGE VIEWER */}
      {viewingImage && (
        <View style={styles.fullScreenViewer}>
             <TouchableOpacity style={styles.viewerCloseArea} onPress={() => setViewingImage(null)} />
             <Image source={{ uri: viewingImage }} style={styles.viewerImage} resizeMode="contain" />
             <TouchableOpacity style={styles.viewerCloseBtn} onPress={() => setViewingImage(null)}>
                 <Text style={{color: 'white', fontWeight: 'bold'}}>Close</Text>
             </TouchableOpacity>
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
  
  // --- NEW SERVICE CARD STYLES ---
  serviceCardNew: {
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  serviceNameNew: {
    fontWeight: 'bold', 
    fontSize: 18,
  },
  servicePriceNew: {
    fontWeight: 'bold', 
    fontSize: 16,
  },
  tagDiscountSmall: {
    backgroundColor: '#10b981', 
    paddingHorizontal: 4, 
    paddingVertical: 2, 
    borderRadius: 4,
  },
  addBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // --- NEW COMBO CARD STYLES ---
  comboContainer: {
    borderRadius: 24,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  comboHeader: {
    padding: 20,
    paddingBottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  comboTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  comboMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  tagSavings: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: '#e11d48',
    // marginLeft removed for space-between layout
  },
  tagText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  comboFinalPrice: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  comboStrike: {
    fontSize: 12,
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  comboBreakdownCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  comboBreakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // <--- Pushes tag to the right
    marginBottom: 16,
  },
  comboBreakdownTitle: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  comboItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  dashedDivider: {
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 1,
    marginBottom: 16,
  },
  comboCalcRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  comboBookBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  comboBookBtnText: {
    fontWeight: 'bold',
    fontSize: 14,
  },

  // --- NEW STEP 3 STYLES (RECEIPT & PAYMENT) ---
  receiptCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  receiptText: {
    fontSize: 14,
  },
  receiptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  receiptRowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    gap: 12,
  },
  payIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(234, 179, 8, 0.1)', // yellow with opacity
    alignItems: 'center',
    justifyContent: 'center',
  },
  payTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    marginBottom: 2,
  },
  paySub: {
    fontSize: 12,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
  },

  // --- EXISTING WIZARD STYLES ---
  barberChip: { width: 100, padding: 12, borderRadius: 12, marginRight: 12, alignItems: 'center', borderWidth: 1 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  barberName: { fontSize: 12, fontWeight: '600' },
  dateChip: { width: 60, height: 70, borderRadius: 12, marginRight: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dayText: { fontSize: 12, textTransform: 'uppercase' },
  dateText: { fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotChip: { width: '30%', paddingVertical: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  slotText: { fontSize: 14, fontWeight: '500' },
  divider: { height: 1, marginVertical: 16 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 40, borderTopWidth: 1 },
  footerPrice: { fontSize: 24, fontWeight: 'bold' },
  footerSub: { fontSize: 12, textTransform: 'uppercase' },
  nextBtn: { paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextBtnText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  toggleContainer: { flexDirection: 'row', padding: 4, borderRadius: 12, marginBottom: 24, borderWidth: 1 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  toggleText: { fontWeight: 'bold', fontSize: 14 },
  earliestCard: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 24 },
  reviewCard: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },

  // GALLERY
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  galleryItem: { width: '48%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  galleryImage: { width: '100%', height: '100%', resizeMode: 'cover' },

  fullScreenViewer: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  viewerCloseArea: { ...StyleSheet.absoluteFillObject },
  viewerImage: { width: '100%', height: '80%' },
  viewerCloseBtn: { position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8 },

  // Toggle Switch
  toggleSwitch: { width: 44, height: 24, borderRadius: 12, padding: 2 },
  toggleKnob: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'white', shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.2, shadowRadius: 1, elevation: 2 },
  label: { fontSize: 12, marginBottom: 8, fontWeight: '600' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, marginBottom: 12 },

  // Home Service Banner
  homeServiceBanner: { marginHorizontal: 20, marginTop: 20, padding: 16, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  hsTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  hsSub: { fontSize: 12 },
  hsToggleBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, minWidth: 60, alignItems: 'center' },
});
