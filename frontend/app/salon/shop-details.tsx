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
import { MapPin, Save, Store, Camera, Image as ImageIcon } from 'lucide-react-native';
import {
  OwnerCard,
  OwnerScreen,
  OwnerScreenHeader,
  OwnerSectionHeader,
  ownerStyles,
} from '../../components/owner/OwnerUI';

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

  if (loading) {
    return (
      <OwnerScreen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.tint} />
        </View>
      </OwnerScreen>
    );
  }

  return (
    <OwnerScreen>
      <OwnerScreenHeader title="Shop Details" subtitle="Profile & scheduling" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[ownerStyles.screenPadding, { paddingTop: 0, gap: 24 }]}
        showsVerticalScrollIndicator={false}
      >

        <View>
        <OwnerSectionHeader title="Shop profile" />
        <OwnerCard>
                {/* Image Picker */}
                <Text style={[styles.label, {color: colors.textMuted}]}>Shop Image</Text>
                <TouchableOpacity style={[styles.imagePicker, {backgroundColor: colors.surfaceSoft, borderColor: colors.border}]} onPress={pickImage}>
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
                <View style={[styles.inputContainer, {backgroundColor: colors.surfaceSoft, borderColor: colors.border}]}>
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
                <View style={[styles.inputContainer, {backgroundColor: colors.surfaceSoft, borderColor: colors.border}]}>
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

                <TouchableOpacity style={[styles.locationBtn, {backgroundColor: colors.surfaceSoft}]} onPress={fetchLocation}>
                    <MapPin size={14} color={colors.text} />
                    <Text style={{color: colors.text, fontWeight: '700', fontSize: 12}}>Use GPS location</Text>
                </TouchableOpacity>

                {/* Shop Type */}
                <Text style={[styles.label, {marginTop: 8, color: colors.textMuted}]}>Shop Type</Text>
                <View style={styles.typeRow}>
                    {['male', 'female', 'unisex'].map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.typeChip, {backgroundColor: colors.surfaceSoft, borderColor: colors.border}, shopType === t && {backgroundColor: colors.tint, borderColor: colors.tint}]}
                          onPress={() => setShopType(t as any)}
                        >
                            <Text style={[styles.typeText, {color: colors.textMuted}, shopType === t && {color: 'black', fontWeight:'bold'}]}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
        </OwnerCard>
        </View>

        <View>
        <OwnerSectionHeader title="Scheduling rules" />
        <OwnerCard>

                <View style={styles.row}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.label, {color: colors.textMuted}]}>Buffer Time (min)</Text>
                        <Text style={[styles.helperText, {color: colors.textMuted}]}>Gap after each booking</Text>
                    </View>
                    <TextInput
                        style={[styles.inputSmall, {backgroundColor: colors.surfaceSoft, color: colors.text, borderColor: colors.border}]}
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
                        style={[styles.inputSmall, {backgroundColor: colors.surfaceSoft, color: colors.text, borderColor: colors.border}]}
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
                        style={[styles.inputSmall, {backgroundColor: colors.surfaceSoft, color: colors.text, borderColor: colors.border}]}
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
                        <Text style={[styles.helperText, {color: colors.textMuted}]}>If off, bookings are pending</Text>
                    </View>
                    <Switch
                        value={autoApprove}
                        onValueChange={setAutoApprove}
                        trackColor={{false: colors.border, true: colors.tint}}
                        thumbColor={autoApprove ? "#0f172a" : colors.textMuted}
                    />
                </View>

                <View style={[styles.divider, {backgroundColor: colors.border}]} />

                <View style={[styles.row, {marginBottom: 0}]}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.label, {color: colors.textMuted}]}>Block Custom Bookings</Text>
                        <Text style={[styles.helperText, {color: colors.textMuted}]}>Only allow Earliest Available</Text>
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

        </OwnerCard>
        </View>

      </ScrollView>
    </OwnerScreen>
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
