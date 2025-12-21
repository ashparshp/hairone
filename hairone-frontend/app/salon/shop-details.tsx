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
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { ChevronLeft, MapPin, Save, Store, Camera } from 'lucide-react-native';

export default function ShopDetailsScreen() {
  const router = useRouter();
  const { user } = useAuth();

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

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft size={24} color="white"/>
         </TouchableOpacity>
         <Text style={styles.title}>Shop Details</Text>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 40}} showsVerticalScrollIndicator={false}>

        {/* --- SECTION 1: SHOP DETAILS --- */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Shop Details</Text>
            <View style={styles.card}>
                {/* Image Picker */}
                <Text style={styles.label}>Shop Image</Text>
                <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.previewImage} />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Camera size={32} color={Colors.textMuted} />
                      <Text style={{ color: Colors.textMuted, marginTop: 8 }}>Upload Shop Image</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Shop Name Input */}
                <Text style={styles.label}>Shop Name</Text>
                <View style={styles.inputContainer}>
                   <Store size={18} color={Colors.textMuted} style={{marginLeft: 12}} />
                   <TextInput
                      style={styles.input}
                      value={shopName}
                      onChangeText={setShopName}
                      placeholder="Enter shop name"
                      placeholderTextColor="#64748b"
                   />
                </View>

                {/* Shop Location */}
                <Text style={styles.label}>Shop Location</Text>
                <View style={styles.inputContainer}>
                   <MapPin size={18} color={Colors.textMuted} style={{marginLeft: 12}} />
                   <TextInput
                      style={styles.input}
                      value={address}
                      onChangeText={setAddress}
                      placeholder="Enter full address"
                      placeholderTextColor="#64748b"
                      multiline
                   />
                </View>

                <TouchableOpacity style={styles.locationBtn} onPress={fetchLocation}>
                    <MapPin size={14} color="white" />
                    <Text style={{color: 'white', fontWeight: 'bold', fontSize: 12}}>Use GPS Location</Text>
                </TouchableOpacity>

                {/* Shop Type */}
                <Text style={[styles.label, {marginTop: 8}]}>Shop Type</Text>
                <View style={styles.typeRow}>
                    {['male', 'female', 'unisex'].map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[styles.typeChip, shopType === t && styles.typeChipActive]}
                          onPress={() => setShopType(t as any)}
                        >
                            <Text style={[styles.typeText, shopType === t && {color: 'black', fontWeight:'bold'}]}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </View>

        {/* --- SECTION 2: SCHEDULING RULES --- */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Scheduling Rules</Text>
            <View style={styles.card}>

                <View style={styles.row}>
                    <View style={{flex: 1}}>
                        <Text style={styles.label}>Buffer Time (min)</Text>
                        <Text style={styles.helperText}>Gap after each booking</Text>
                    </View>
                    <TextInput
                        style={styles.inputSmall}
                        value={bufferTime}
                        onChangeText={setBufferTime}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor="#64748b"
                    />
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                    <View style={{flex: 1}}>
                        <Text style={styles.label}>Min Notice (min)</Text>
                        <Text style={styles.helperText}>Booking blocked if less than this</Text>
                    </View>
                    <TextInput
                        style={styles.inputSmall}
                        value={minNotice}
                        onChangeText={setMinNotice}
                        keyboardType="numeric"
                        placeholder="60"
                        placeholderTextColor="#64748b"
                    />
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                    <View style={{flex: 1}}>
                        <Text style={styles.label}>Max Notice (days)</Text>
                        <Text style={styles.helperText}>Booking blocked if further than this</Text>
                    </View>
                    <TextInput
                        style={styles.inputSmall}
                        value={maxNotice}
                        onChangeText={setMaxNotice}
                        keyboardType="numeric"
                        placeholder="30"
                        placeholderTextColor="#64748b"
                    />
                </View>

                <View style={styles.divider} />

                <View style={[styles.row, {marginBottom: 0}]}>
                    <View style={{flex: 1}}>
                        <Text style={styles.label}>Auto Approve</Text>
                        <Text style={styles.helperText}>If off, bookings are 'pending'</Text>
                    </View>
                    <Switch
                        value={autoApprove}
                        onValueChange={setAutoApprove}
                        trackColor={{false: '#334155', true: Colors.primary}}
                        thumbColor={autoApprove ? "#0f172a" : "#94a3b8"}
                    />
                </View>

                <TouchableOpacity style={styles.saveBtn} onPress={handleUpdateShop} disabled={savingShop}>
                    {savingShop ? <ActivityIndicator color="#0f172a" /> : (
                        <>
                          <Save size={18} color="#0f172a" />
                          <Text style={styles.saveBtnText}>Save Details</Text>
                        </>
                    )}
                </TouchableOpacity>

            </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white' },

  section: { marginBottom: 30 },
  sectionTitle: { color: 'white', marginBottom: 12, fontSize: 16, fontWeight:'bold' },

  card: { backgroundColor: Colors.card, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  label: { color: Colors.textMuted, fontSize: 12, marginBottom: 8, fontWeight: '600' },

  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0f172a', borderRadius: 12, borderWidth: 1, borderColor: '#334155', marginBottom: 12 },
  input: { flex: 1, color: 'white', padding: 14, fontSize: 14 },

  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#334155', alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginBottom: 16 },

  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  typeChip: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: '#0f172a' },
  typeChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  typeText: { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },

  saveBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
  saveBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },

  // Image Picker
  imagePicker: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderImage: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Scheduling Rules
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 16 },
  helperText: { color: '#64748b', fontSize: 10, marginTop: 2 },
  inputSmall: { backgroundColor: '#0f172a', color: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155', width: 80, textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 12 },
});
