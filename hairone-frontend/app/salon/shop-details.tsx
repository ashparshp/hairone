import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
  Switch
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, MapPin, Save, Store, Camera, Image as ImageIcon } from 'lucide-react-native';
import { FadeInView } from '../../components/AnimatedViews';

export default function ShopDetailsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme } = useTheme();

  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Shop Details State
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{lat: number, lng: number} | null>(null);
  const [shopType, setShopType] = useState<'male'|'female'|'unisex'>('unisex');
  const [image, setImage] = useState<string | null>(null);
  const [savingShop, setSavingShop] = useState(false);

  // Scheduling Rules State
  const [bufferTime, setBufferTime] = useState('0');
  const [minNotice, setMinNotice] = useState('60');
  const [maxNotice, setMaxNotice] = useState('30');
  const [autoApprove, setAutoApprove] = useState(true);
  const [blockCustomBookings, setBlockCustomBookings] = useState(false);

  // Home Service State
  const [homeServiceAvailable, setHomeServiceAvailable] = useState(false);
  const [radiusKm, setRadiusKm] = useState('5');
  const [travelFee, setTravelFee] = useState('0');
  const [minOrderValue, setMinOrderValue] = useState('0');
  const [lateCancelFee, setLateCancelFee] = useState('50');
  const [paymentPreference, setPaymentPreference] = useState<'ALL'|'ONLINE_ONLY'>('ALL');

  useEffect(() => {
    fetchShop();
  }, []);

  const fetchShop = async () => {
    // @ts-ignore
    if (!user?.myShopId) {
      setLoading(false);
      return;
    }
    try {
      // @ts-ignore
      const res = await api.get(`/shops/${user.myShopId}`);
      const s = res.data.shop;
      setShop(s);
      setShopName(s.name || '');
      setAddress(s.address);
      if (s.coordinates && s.coordinates.lat) {
          setCoords(s.coordinates);
      }
      setShopType(s.type || 'unisex');
      setImage(s.image || null);

      // Scheduling
      setBufferTime(s.bufferTime !== undefined ? String(s.bufferTime) : '0');
      setMinNotice(s.minBookingNotice !== undefined ? String(s.minBookingNotice) : '60');
      setMaxNotice(s.maxBookingNotice !== undefined ? String(s.maxBookingNotice) : '30');
      setAutoApprove(s.autoApproveBookings !== false);

      // Home Service
      if (s.homeService) {
        setHomeServiceAvailable(s.homeService.isAvailable || false);
        setRadiusKm(String(s.homeService.radiusKm || 5));
        setTravelFee(String(s.homeService.travelFee || 0));
        setMinOrderValue(String(s.homeService.minOrderValue || 0));
        setLateCancelFee(String(s.homeService.lateCancellationFeePercent || 50));
        setPaymentPreference(s.homeService.paymentPreference || 'ALL');
      }
      setBlockCustomBookings(s.blockCustomBookings || false);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to load shop details");
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleUpdateShop = async () => {
      if (!shopName.trim()) return Alert.alert("Required", "Shop Name cannot be empty");
      if (!address.trim()) return Alert.alert("Required", "Address cannot be empty");

      setSavingShop(true);

      try {
          const formData = new FormData();
          formData.append('name', shopName);
          formData.append('address', address);
          formData.append('type', shopType);

          // Scheduling
          formData.append('bufferTime', bufferTime);
          formData.append('minBookingNotice', minNotice);
          formData.append('maxBookingNotice', maxNotice);
          // @ts-ignore
          formData.append('autoApproveBookings', autoApprove);
          // @ts-ignore
          formData.append('blockCustomBookings', blockCustomBookings);

          // Home Service
          const homeService = {
              isAvailable: homeServiceAvailable,
              radiusKm: Number(radiusKm),
              travelFee: Number(travelFee),
              minOrderValue: Number(minOrderValue),
              lateCancellationFeePercent: Number(lateCancelFee),
              paymentPreference: paymentPreference
          };
          // We need to send this as JSON usually, but formData handles strings.
          // Since our backend logic for 'homeService' checks req.body.homeService, which might be flattened or not depending on parser.
          // For multipart/form-data with nested objects, it's tricky.
          // Best to stringify if backend parses it, or send flattened keys.
          // The backend code used `const hs = req.body.homeService` which implies it expects the object.
          // In Express + Multer, simple fields are available. Complex objects need manual parsing if sent as JSON string.
          // Let's send a JSON string and assume backend can parse it or we adjust backend if needed.
          // Wait, backend logic: `if (req.body.homeService) ...`.
          // If we append `homeService` as stringified JSON, we might need `JSON.parse` on backend or middleware.
          // However, standard `multer` doesn't auto-parse JSON in fields.
          // Let's send flattened keys to be safe, OR backend update.
          // Actually, let's just assume `api` client (axios/fetch) + express body parser works if not using file upload.
          // BUT we are using file upload (image).
          // So we should append specific keys like `homeService[isAvailable]`.
          // OR, since my backend code did `req.body.homeService` directly, it might be safer to send it as a JSON string and update backend to parse it if string.
          // BUT, I can't update backend easily now without more steps.
          // Let's use the dot notation for FormData which `body-parser` (extended) often handles, but `multer` is simpler.
          // Actually, let's just modify the backend to check if it's a string and parse it.
          // WAIT, I already modified the backend code: `// We expect req.body.homeService to be an object (or parsed string if from FormData)`
          // I wrote comments but didn't implement the parsing logic explicitly!
          // I should fix backend or send simple keys.
          // Let's send flattened keys: `homeService[radiusKm]`. Express `body-parser` with `extended: true` parses this into objects!

          formData.append('homeService[isAvailable]', String(homeServiceAvailable));
          formData.append('homeService[radiusKm]', radiusKm);
          formData.append('homeService[travelFee]', travelFee);
          formData.append('homeService[minOrderValue]', minOrderValue);
          formData.append('homeService[lateCancellationFeePercent]', lateCancelFee);
          formData.append('homeService[paymentPreference]', paymentPreference);

          if (coords) {
              formData.append('lat', String(coords.lat));
              formData.append('lng', String(coords.lng));
          }

          if (image && (!shop || image !== shop.image)) {
             const filename = image.split('/').pop() || 'shop-image.jpg';
             let match = /\.(\w+)$/.exec(filename);
             let type = match ? `image/${match[1]}` : `image/jpeg`;

             // @ts-ignore
             formData.append('image', {
               uri: image,
               name: filename,
               type: type
             });
          }

          const res = await api.put(`/shops/${shop._id}`, formData, {
              headers: { 'Content-Type': 'multipart/form-data' },
          });
          setShop(res.data);
          Alert.alert("Success", "Shop details updated!");
          router.back();
      } catch (e: any) {
          console.log("Save Shop Error:", e);
          const msg = e.response?.data?.message || "Failed to save shop details.";
          Alert.alert("Error", msg);
      } finally {
          setSavingShop(false);
      }
  };

  const fetchLocation = async () => {
      try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
              Alert.alert("Permission Denied", "Allow location access to use this feature.");
              return;
          }

          const location = await Location.getCurrentPositionAsync({});
          const { latitude, longitude } = location.coords;
          setCoords({ lat: latitude, lng: longitude });

          // Reverse Geocode
          const geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (geocode.length > 0) {
              const g = geocode[0];
              const newAddr = `${g.street || ''} ${g.city || ''}, ${g.region || ''} ${g.postalCode || ''}`.trim();
              setAddress(newAddr);
          } else {
              Alert.alert("Notice", "Location found but address lookup failed.");
          }
      } catch (e) {
          console.log(e);
          Alert.alert("Error", "Could not fetch location.");
      }
  };

  if (loading) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.tint} /></View>;

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Shop Details</Text>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 40}} showsVerticalScrollIndicator={false}>

        {/* --- SECTION 1: SHOP DETAILS --- */}
        <FadeInView>
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Shop Details</Text>
            <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
                {/* Image Picker */}
                <Text style={[styles.label, {color: colors.textMuted}]}>Shop Image</Text>
                <TouchableOpacity onPress={pickImage} style={[styles.imagePicker, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', borderColor: colors.border}]}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.previewImage} />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Camera size={32} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, marginTop: 8 }}>Upload Shop Image</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Manage Gallery Button */}
                <TouchableOpacity
                    style={[styles.galleryBtn, { backgroundColor: colors.tint, borderColor: colors.tint }]}
                    onPress={() => router.push('/salon/manage-gallery' as any)}
                >
                    <ImageIcon size={18} color="black" />
                    <Text style={{ color: 'black', fontWeight: 'bold' }}>Manage Photo Gallery</Text>
                </TouchableOpacity>

                {/* Shop Name Input */}
                <Text style={[styles.label, {color: colors.textMuted}]}>Shop Name</Text>
                <View style={[styles.inputContainer, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', borderColor: colors.border}]}>
                   <Store size={18} color={colors.textMuted} style={{marginLeft: 12}} />
                   <TextInput
                      style={[styles.input, {color: colors.text}]}
                      value={shopName}
                      onChangeText={setShopName}
                      placeholder="Enter shop name"
                      placeholderTextColor={colors.textMuted}
                   />
                </View>

                {/* Shop Location */}
                <Text style={[styles.label, {color: colors.textMuted}]}>Shop Location</Text>
                <View style={[styles.inputContainer, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', borderColor: colors.border}]}>
                   <MapPin size={18} color={colors.textMuted} style={{marginLeft: 12}} />
                   <TextInput
                      style={[styles.input, {color: colors.text}]}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="Enter full address"
                      placeholderTextColor={colors.textMuted}
                      multiline
                   />
                </View>

                <TouchableOpacity style={[styles.locationBtn, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]} onPress={fetchLocation}>
                    <MapPin size={14} color={theme === 'dark' ? 'white' : 'black'} />
                    <Text style={{color: theme === 'dark' ? 'white' : 'black', fontWeight: 'bold', fontSize: 12}}>Use GPS Location</Text>
                </TouchableOpacity>

                {/* Shop Type */}
                <Text style={[styles.label, {marginTop: 8, color: colors.textMuted}]}>Shop Type</Text>
                <View style={styles.typeRow}>
                    {['male', 'female', 'unisex'].map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.typeChip, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', borderColor: colors.border}, shopType === t && {backgroundColor: colors.tint, borderColor: colors.tint}]}
                          onPress={() => setShopType(t as any)}
                        >
                            <Text style={[styles.typeText, {color: colors.textMuted}, shopType === t && {color: 'black', fontWeight:'bold'}]}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </View>
        </FadeInView>

        {/* --- SECTION 2: SCHEDULING RULES --- */}
        <FadeInView delay={200}>
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Scheduling Rules</Text>
            <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>

                <View style={styles.row}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.label, {color: colors.textMuted}]}>Buffer Time (min)</Text>
                        <Text style={[styles.helperText, {color: colors.textMuted}]}>Gap after each booking</Text>
                    </View>
                    <TextInput
                        style={[styles.inputSmall, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                        value={bufferTime}
                        onChangeText={setBufferTime}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>

                <View style={[styles.divider, {backgroundColor: colors.border}]} />

                <View style={styles.row}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.label, {color: colors.textMuted}]}>Min Notice (min)</Text>
                        <Text style={[styles.helperText, {color: colors.textMuted}]}>Booking blocked if less than this</Text>
                    </View>
                    <TextInput
                        style={[styles.inputSmall, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                        value={minNotice}
                        onChangeText={setMinNotice}
                        keyboardType="numeric"
                        placeholder="60"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>

                <View style={[styles.divider, {backgroundColor: colors.border}]} />

                <View style={styles.row}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.label, {color: colors.textMuted}]}>Max Notice (days)</Text>
                        <Text style={[styles.helperText, {color: colors.textMuted}]}>Booking blocked if further than this</Text>
                    </View>
                    <TextInput
                        style={[styles.inputSmall, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                        value={maxNotice}
                        onChangeText={setMaxNotice}
                        keyboardType="numeric"
                        placeholder="30"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>

                <View style={[styles.divider, {backgroundColor: colors.border}]} />

                <View style={[styles.row, {marginBottom: 0}]}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.label, {color: colors.textMuted}]}>Auto Approve</Text>
                        <Text style={[styles.helperText, {color: colors.textMuted}]}>If off, bookings are 'pending'</Text>
                    </View>
                    <Switch
                        value={autoApprove}
                        onValueChange={setAutoApprove}
                        trackColor={{false: colors.border, true: colors.tint}}
                        thumbColor={autoApprove ? "#0f172a" : colors.textMuted}
                    />
                </View>

            </View>
        </View>
        </FadeInView>

        {/* --- SECTION 3: HOME SERVICE --- */}
        <FadeInView delay={300}>
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Home Service Configuration</Text>
            <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>

                <View style={styles.row}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.label, {color: colors.textMuted}]}>Enable Home Services</Text>
                        <Text style={[styles.helperText, {color: colors.textMuted}]}>Offer services at customer's location</Text>
                    </View>
                    <Switch
                        value={homeServiceAvailable}
                        onValueChange={setHomeServiceAvailable}
                        trackColor={{false: colors.border, true: colors.tint}}
                        thumbColor={homeServiceAvailable ? "#0f172a" : colors.textMuted}
                    />
                </View>

                {homeServiceAvailable && (
                  <>
                    <View style={[styles.divider, {backgroundColor: colors.border}]} />

                    <View style={styles.row}>
                        <View style={{flex: 1}}>
                            <Text style={[styles.label, {color: colors.textMuted}]}>Service Radius (km)</Text>
                        </View>
                        <TextInput
                            style={[styles.inputSmall, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                            value={radiusKm}
                            onChangeText={setRadiusKm}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={[styles.divider, {backgroundColor: colors.border}]} />

                    <View style={styles.row}>
                        <View style={{flex: 1}}>
                            <Text style={[styles.label, {color: colors.textMuted}]}>Travel Fee</Text>
                        </View>
                        <TextInput
                            style={[styles.inputSmall, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                            value={travelFee}
                            onChangeText={setTravelFee}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={[styles.divider, {backgroundColor: colors.border}]} />

                    <View style={styles.row}>
                        <View style={{flex: 1}}>
                            <Text style={[styles.label, {color: colors.textMuted}]}>Min Order Value</Text>
                        </View>
                        <TextInput
                            style={[styles.inputSmall, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                            value={minOrderValue}
                            onChangeText={setMinOrderValue}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={[styles.divider, {backgroundColor: colors.border}]} />

                    <View style={styles.row}>
                        <View style={{flex: 1}}>
                            <Text style={[styles.label, {color: colors.textMuted}]}>Late Cancellation Fee (%)</Text>
                            <Text style={[styles.helperText, {color: colors.textMuted}]}>If cancelled &lt; 2 hrs before</Text>
                        </View>
                        <TextInput
                            style={[styles.inputSmall, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                            value={lateCancelFee}
                            onChangeText={setLateCancelFee}
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={[styles.divider, {backgroundColor: colors.border}]} />

                     <Text style={[styles.label, {marginTop: 8, color: colors.textMuted}]}>Payment Preference</Text>
                     <View style={styles.typeRow}>
                         {['ALL', 'ONLINE_ONLY'].map((t) => (
                             <TouchableOpacity
                               key={t}
                               style={[styles.typeChip, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', borderColor: colors.border}, paymentPreference === t && {backgroundColor: colors.tint, borderColor: colors.tint}]}
                               onPress={() => setPaymentPreference(t as any)}
                             >
                                 <Text style={[styles.typeText, {color: colors.textMuted}, paymentPreference === t && {color: 'black', fontWeight:'bold'}]}>
                                     {t === 'ONLINE_ONLY' ? 'Online Only' : 'Any Method'}
                                 </Text>
                             </TouchableOpacity>
                         ))}
                     </View>
                  </>
                )}

                <View style={[styles.divider, {backgroundColor: colors.border}]} />

                <View style={[styles.row, {marginBottom: 0}]}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.label, {color: colors.textMuted}]}>Block Custom Bookings</Text>
                        <Text style={[styles.helperText, {color: colors.textMuted}]}>Only allow 'Earliest Available'</Text>
                    </View>
                    <Switch
                        value={blockCustomBookings}
                        onValueChange={setBlockCustomBookings}
                        trackColor={{false: colors.border, true: colors.tint}}
                        thumbColor={blockCustomBookings ? "#0f172a" : colors.textMuted}
                    />
                </View>

                <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.tint}]} onPress={handleUpdateShop} disabled={savingShop}>
                    {savingShop ? <ActivityIndicator color="#0f172a" /> : (
                        <>
                          <Save size={18} color="#0f172a" />
                          <Text style={styles.saveBtnText}>Save Details</Text>
                        </>
                    )}
                </TouchableOpacity>

            </View>
        </View>
        </FadeInView>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1 },
  title: { fontSize: 24, fontWeight: 'bold' },

  section: { marginBottom: 30 },
  sectionTitle: { marginBottom: 12, fontSize: 16, fontWeight:'bold' },

  card: { padding: 20, borderRadius: 16, borderWidth: 1 },
  label: { fontSize: 12, marginBottom: 8, fontWeight: '600' },

  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  input: { flex: 1, padding: 14, fontSize: 14 },

  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 16 },

  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeChip: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  typeText: { fontSize: 12, fontWeight: '500' },

  saveBtn: { padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
  saveBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },

  // Image Picker
  imagePicker: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 12, borderWidth: 1 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderImage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  galleryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1 },

  // Scheduling Rules
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 16 },
  helperText: { fontSize: 10, marginTop: 2 },
  inputSmall: { padding: 12, borderRadius: 8, borderWidth: 1, width: 80, textAlign: 'center' },
  divider: { height: 1, marginVertical: 12 },
});
