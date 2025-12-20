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
  Switch,
  Image
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { ChevronLeft, Plus, MapPin, Save, Clock, IndianRupee, Scissors, Store, Trash2, Camera, CalendarClock } from 'lucide-react-native';

export default function ManageServicesScreen() {
  const router = useRouter();
  const { user, login, token } = useAuth();
  
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
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

  // New Service State
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('');
  const [addingService, setAddingService] = useState(false);

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
      setServices(s.services || []);

      // Scheduling
      setBufferTime(String(s.bufferTime || 0));
      setMinNotice(String(s.minBookingNotice || 60));
      setMaxNotice(String(s.maxBookingNotice || 30));
      setAutoApprove(s.autoApproveBookings !== false); // Default true
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
      if (!address.trim()) return Alert.alert("Required", "Address cannot be empty");
      setSavingShop(true);
      
      try {
          const formData = new FormData();
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

          if (shop && shop._id) {
            // Update existing shop
            const res = await api.put(`/shops/${shop._id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setShop(res.data);
            Alert.alert("Success", "Shop details updated!");
          } else {
            // Create new shop
            if (!shopName.trim()) {
              setSavingShop(false);
              return Alert.alert("Required", "Shop Name cannot be empty");
            }
            formData.append('name', shopName);

            const res = await api.post('/shops', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            const newShop = res.data;
            setShop(newShop);

            if (user && token) {
              login(token, { ...user, role: 'owner', myShopId: newShop._id });
            }

            Alert.alert("Success", "Shop created successfully!");
          }
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

  const handleAddService = async () => {
    if (!newServiceName || !newServicePrice || !newServiceDuration) {
        Alert.alert("Missing Fields", "Please fill all fields.");
        return;
    }

    setAddingService(true);
    try {
        const res = await api.post(`/shops/${shop._id}/services`, {
            name: newServiceName,
            price: parseInt(newServicePrice),
            duration: parseInt(newServiceDuration)
        });
        
        setShop(res.data);
        setServices(res.data.services);
        
        setNewServiceName('');
        setNewServicePrice('');
        setNewServiceDuration('');
        Alert.alert("Success", "Service Added!");
    } catch (e) {
        console.log(e);
        Alert.alert("Error", "Failed to add service.");
    } finally {
        setAddingService(false);
    }
  };

  const handleDeleteService = async (serviceId: string) => {
    Alert.alert(
      "Delete Service",
      "Are you sure you want to delete this service?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.delete(`/shops/${shop._id}/services/${serviceId}`);
              setShop(res.data);
              setServices(res.data.services);
            } catch (e) {
              Alert.alert("Error", "Failed to delete service");
            }
          }
        }
      ]
    );
  };

  const handleToggleService = async (serviceId: string, currentStatus: boolean) => {
    try {
      const res = await api.put(`/shops/${shop._id}/services/${serviceId}`, {
        isAvailable: !currentStatus
      });
      setShop(res.data);
      setServices(res.data.services);
    } catch (e) {
      Alert.alert("Error", "Failed to update status");
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft size={24} color="white"/>
         </TouchableOpacity>
         <Text style={styles.title}>{shop ? 'Manage Shop' : 'Create Shop'}</Text>
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
                      style={[styles.input, shop && {color: Colors.textMuted}]}
                      value={shopName}
                      onChangeText={setShopName}
                      placeholder="Enter shop name"
                      placeholderTextColor="#64748b"
                      editable={!shop} 
                   />
                </View>

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
                          <Text style={styles.saveBtnText}>{shop ? 'Save Details' : 'Create Shop'}</Text>
                        </>
                    )}
                </TouchableOpacity>

            </View>
        </View>

        {/* --- SECTION 3: SERVICES --- */}
        {shop && (
          <View style={styles.section}>
              <Text style={styles.sectionTitle}>Services Menu ({services.length})</Text>

              <View style={{marginBottom: 20}}>
                {services.length === 0 ? (
                   <Text style={{color: Colors.textMuted, fontStyle: 'italic'}}>No services added yet.</Text>
                ) : (
                   services.map((item, index) => (
                      <View key={index} style={[styles.serviceItem, !item.isAvailable && {opacity: 0.6}]}>
                          <View style={[styles.serviceIcon, !item.isAvailable && {backgroundColor: '#334155'}]}>
                             <Scissors size={20} color={item.isAvailable ? Colors.primary : Colors.textMuted} />
                          </View>
                          <View style={{flex: 1}}>
                              <Text style={[styles.serviceName, !item.isAvailable && {color: Colors.textMuted, textDecorationLine: 'line-through'}]}>{item.name}</Text>
                              <View style={{flexDirection: 'row', gap: 12, marginTop: 4}}>
                                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                     <Clock size={12} color={Colors.textMuted} />
                                     <Text style={styles.serviceDetails}>{item.duration} min</Text>
                                  </View>
                                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                     <IndianRupee size={12} color={Colors.textMuted} />
                                     <Text style={styles.serviceDetails}>{item.price}</Text>
                                  </View>
                              </View>
                          </View>

                          <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                             <Switch
                                value={item.isAvailable !== false}
                                onValueChange={() => handleToggleService(item._id, item.isAvailable !== false)}
                                trackColor={{false: '#334155', true: Colors.primary}}
                                thumbColor={item.isAvailable !== false ? "#0f172a" : "#94a3b8"}
                             />
                             <TouchableOpacity onPress={() => handleDeleteService(item._id)}>
                                <Trash2 size={20} color="#ef4444" />
                             </TouchableOpacity>
                          </View>
                      </View>
                   ))
                )}
              </View>

              <View style={styles.addForm}>
                  <View style={styles.formHeader}>
                     <Plus size={20} color={Colors.primary} />
                     <Text style={{color: 'white', fontWeight:'bold', fontSize: 16}}>Add New Service</Text>
                  </View>

                  <View style={styles.inputGroup}>
                     <Text style={styles.label}>Service Name</Text>
                     <TextInput
                        style={styles.formInput}
                        placeholder="e.g. Haircut & Wash"
                        placeholderTextColor="#64748b"
                        value={newServiceName}
                        onChangeText={setNewServiceName}
                     />
                  </View>

                  <View style={{flexDirection:'row', gap: 12}}>
                      <View style={[styles.inputGroup, {flex: 1}]}>
                         <Text style={styles.label}>Price (₹)</Text>
                         <TextInput
                            style={styles.formInput}
                            placeholder="350"
                            placeholderTextColor="#64748b"
                            keyboardType="numeric"
                            value={newServicePrice}
                            onChangeText={setNewServicePrice}
                         />
                      </View>
                      <View style={[styles.inputGroup, {flex: 1}]}>
                         <Text style={styles.label}>Duration (min)</Text>
                         <TextInput
                            style={styles.formInput}
                            placeholder="30"
                            placeholderTextColor="#64748b"
                            keyboardType="numeric"
                            value={newServiceDuration}
                            onChangeText={setNewServiceDuration}
                         />
                      </View>
                  </View>

                  <TouchableOpacity style={styles.addBtn} onPress={handleAddService} disabled={addingService}>
                      {addingService ? <ActivityIndicator color="#0f172a"/> : (
                          <Text style={styles.addBtnText}>Add Service</Text>
                      )}
                  </TouchableOpacity>
              </View>
          </View>
        )}

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

  // Scheduling Rules
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 16 },
  helperText: { color: '#64748b', fontSize: 10, marginTop: 2 },
  inputSmall: { backgroundColor: '#0f172a', color: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#334155', width: 80, textAlign: 'center' },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 12 },

  // Image Picker
  imagePicker: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 20, borderWidth: 1, borderColor: '#334155', backgroundColor: '#0f172a' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderImage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Service Item
  serviceItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.card, marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  serviceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(245, 158, 11, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  serviceName: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  serviceDetails: { color: Colors.textMuted, fontSize: 12 },
  
  // Add Form
  addForm: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, marginTop: 10 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  formInput: { backgroundColor: '#0f172a', color: 'white', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  
  addBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  addBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 }
});