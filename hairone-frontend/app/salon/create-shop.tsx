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
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { FadeInView } from '../../components/AnimatedViews';
import api from '../../services/api';
import { ChevronLeft, Plus, MapPin, Save, Clock, IndianRupee, Scissors, Store, Trash2, Camera, CalendarClock } from 'lucide-react-native';

export default function ManageServicesScreen() {
  const router = useRouter();
  const { user, login, token } = useAuth();
  const { showToast } = useToast();
  const { colors, theme } = useTheme();
  
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'details' | 'schedule' | 'services'>('details');

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
      setBufferTime(s.bufferTime !== undefined ? String(s.bufferTime) : '0');
      setMinNotice(s.minBookingNotice !== undefined ? String(s.minBookingNotice) : '60');
      setMaxNotice(s.maxBookingNotice !== undefined ? String(s.maxBookingNotice) : '30');
      setAutoApprove(s.autoApproveBookings !== false); // Default true
    } catch (e) {
      console.log(e);
      showToast("Failed to load shop details", "error");
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
      if (!address.trim()) return showToast("Address cannot be empty", "error");
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
            showToast("Shop details updated!", "success");
          } else {
            // Create new shop
            if (!shopName.trim()) {
              setSavingShop(false);
              return showToast("Shop Name cannot be empty", "error");
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

            showToast("Shop created successfully!", "success");
          }
      } catch (e: any) {
          console.log("Save Shop Error:", e);
          const msg = e.response?.data?.message || "Failed to save shop details.";
          showToast(msg, "error");
      } finally {
          setSavingShop(false);
      }
  };

  const fetchLocation = async () => {
      try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
              showToast("Permission denied for location", "error");
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
              showToast("Address lookup failed", "error");
          }
      } catch (e) {
          console.log(e);
          showToast("Could not fetch location", "error");
      }
  };

  const handleAddService = async () => {
    if (!newServiceName || !newServicePrice || !newServiceDuration) {
        showToast("Please fill all fields", "error");
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
        showToast("Service Added!", "success");
    } catch (e) {
        console.log(e);
        showToast("Failed to add service", "error");
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
              showToast("Service deleted", "success");
            } catch (e) {
              showToast("Failed to delete service", "error");
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
        showToast("Failed to update status", "error");
    }
  };

  if (loading) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.tint} /></View>;

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>{shop ? 'Manage Shop' : 'Create Shop'}</Text>
      </View>
      
      {/* TABS */}
      {shop && (
      <View style={[styles.tabContainer, {backgroundColor: colors.card, borderColor: colors.border}]}>
          <TouchableOpacity style={[styles.tab, activeTab === 'details' && {backgroundColor: colors.tint}]} onPress={() => setActiveTab('details')}>
              <Store size={16} color={activeTab === 'details' ? 'black' : colors.textMuted} />
              <Text style={[styles.tabText, {color: colors.textMuted}, activeTab === 'details' && styles.tabTextActive]}>Details</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'schedule' && {backgroundColor: colors.tint}]} onPress={() => setActiveTab('schedule')}>
              <CalendarClock size={16} color={activeTab === 'schedule' ? 'black' : colors.textMuted} />
              <Text style={[styles.tabText, {color: colors.textMuted}, activeTab === 'schedule' && styles.tabTextActive]}>Rules</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'services' && {backgroundColor: colors.tint}]} onPress={() => setActiveTab('services')}>
              <Scissors size={16} color={activeTab === 'services' ? 'black' : colors.textMuted} />
              <Text style={[styles.tabText, {color: colors.textMuted}, activeTab === 'services' && styles.tabTextActive]}>Services</Text>
          </TouchableOpacity>
      </View>
      )}

      <ScrollView contentContainerStyle={{paddingBottom: 40}} showsVerticalScrollIndicator={false}>
        
        {/* --- SECTION 1: SHOP DETAILS --- */}
        {(activeTab === 'details' || !shop) && (
        <FadeInView>
        <View style={styles.section}>
            {!shop && <Text style={[styles.sectionTitle, {color: colors.text}]}>Shop Details</Text>}
            <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>

                {/* Image Picker */}
                <Text style={[styles.label, {color: colors.textMuted}]}>Shop Image</Text>
                <TouchableOpacity onPress={pickImage} style={[styles.imagePicker, {borderColor: colors.border, backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9'}]}>
                  {image ? (
                    <Image source={{ uri: image }} style={styles.previewImage} />
                  ) : (
                    <View style={styles.placeholderImage}>
                      <Camera size={32} color={colors.textMuted} />
                      <Text style={{ color: colors.textMuted, marginTop: 8 }}>Upload Shop Image</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Shop Name Input */}
                <Text style={[styles.label, {color: colors.textMuted}]}>Shop Name</Text>
                <View style={[styles.inputContainer, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9', borderColor: colors.border}]}>
                   <Store size={18} color={colors.textMuted} style={{marginLeft: 12}} />
                   <TextInput
                      style={[styles.input, {color: colors.text}, shop && {color: colors.textMuted}]}
                      value={shopName}
                      onChangeText={setShopName}
                      placeholder="Enter shop name"
                      placeholderTextColor={colors.textMuted}
                      editable={!shop} 
                   />
                </View>

                <Text style={[styles.label, {color: colors.textMuted}]}>Shop Location</Text>
                <View style={[styles.inputContainer, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9', borderColor: colors.border}]}>
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

                <Text style={[styles.label, {marginTop: 8, color: colors.textMuted}]}>Shop Type</Text>
                <View style={styles.typeRow}>
                    {['male', 'female', 'unisex'].map((t) => (
                        <TouchableOpacity 
                          key={t} 
                          style={[styles.typeChip, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9', borderColor: colors.border}, shopType === t && {backgroundColor: colors.tint, borderColor: colors.tint}]}
                          onPress={() => setShopType(t as any)}
                        >
                            <Text style={[styles.typeText, {color: colors.textMuted}, shopType === t && {color: 'black', fontWeight:'bold'}]}>
                                {t.charAt(0).toUpperCase() + t.slice(1)}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.tint}]} onPress={handleUpdateShop} disabled={savingShop}>
                    {savingShop ? <ActivityIndicator color="#0f172a" /> : (
                        <>
                          <Save size={18} color="#0f172a" />
                          <Text style={styles.saveBtnText}>{shop ? 'Save Details' : 'Create Shop'}</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>
        </View>
        </FadeInView>
        )}

        {/* --- SECTION 2: SCHEDULING RULES --- */}
        {(activeTab === 'schedule' && shop) && (
        <FadeInView>
        <View style={styles.section}>
            <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>

                <View style={styles.row}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.label, {color: colors.textMuted}]}>Buffer Time (min)</Text>
                        <Text style={[styles.helperText, {color: colors.textMuted}]}>Gap after each booking</Text>
                    </View>
                    <TextInput
                        style={[styles.inputSmall, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9', color: colors.text, borderColor: colors.border}]}
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
                        style={[styles.inputSmall, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9', color: colors.text, borderColor: colors.border}]}
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
                        style={[styles.inputSmall, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f1f5f9', color: colors.text, borderColor: colors.border}]}
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

                <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.tint}]} onPress={handleUpdateShop} disabled={savingShop}>
                    {savingShop ? <ActivityIndicator color="#0f172a" /> : (
                        <>
                          <Save size={18} color="#0f172a" />
                          <Text style={styles.saveBtnText}>Update Rules</Text>
                        </>
                    )}
                </TouchableOpacity>

            </View>
        </View>
        </FadeInView>
        )}

        {/* --- SECTION 3: SERVICES --- */}
        {(activeTab === 'services' && shop) && (
        <FadeInView>
          <View style={styles.section}>
              <View style={{marginBottom: 20}}>
                {services.length === 0 ? (
                   <View style={styles.emptyServices}>
                       <Scissors size={32} color={colors.textMuted} />
                       <Text style={{color: colors.textMuted, marginTop: 8}}>No services added yet.</Text>
                   </View>
                ) : (
                   services.map((item, index) => (
                      <View key={index} style={[styles.serviceItem, {backgroundColor: colors.card, borderColor: colors.border}, !item.isAvailable && {opacity: 0.6}]}>
                          <View style={[styles.serviceIcon, {backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.1)' : '#fef3c7'}, !item.isAvailable && {backgroundColor: colors.border}]}>
                             <Scissors size={20} color={item.isAvailable ? colors.tint : colors.textMuted} />
                          </View>
                          <View style={{flex: 1}}>
                              <Text style={[styles.serviceName, {color: colors.text}, !item.isAvailable && {color: colors.textMuted, textDecorationLine: 'line-through'}]}>{item.name}</Text>
                              <View style={{flexDirection: 'row', gap: 12, marginTop: 4}}>
                                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                     <Clock size={12} color={colors.textMuted} />
                                     <Text style={[styles.serviceDetails, {color: colors.textMuted}]}>{item.duration} min</Text>
                                  </View>
                                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                     <IndianRupee size={12} color={colors.textMuted} />
                                     <Text style={[styles.serviceDetails, {color: colors.textMuted}]}>{item.price}</Text>
                                  </View>
                              </View>
                          </View>

                          <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                             <Switch
                                value={item.isAvailable !== false}
                                onValueChange={() => handleToggleService(item._id, item.isAvailable !== false)}
                                trackColor={{false: colors.border, true: colors.tint}}
                                thumbColor={item.isAvailable !== false ? "#0f172a" : colors.textMuted}
                             />
                             <TouchableOpacity onPress={() => handleDeleteService(item._id)}>
                                <Trash2 size={20} color="#ef4444" />
                             </TouchableOpacity>
                          </View>
                      </View>
                   ))
                )}
              </View>

              <View style={[styles.addForm, {backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc', borderColor: colors.border}]}>
                  <View style={styles.formHeader}>
                     <Plus size={20} color={colors.tint} />
                     <Text style={{color: colors.text, fontWeight:'bold', fontSize: 16}}>Add New Service</Text>
                  </View>

                  <View style={styles.inputGroup}>
                     <Text style={[styles.label, {color: colors.textMuted}]}>Service Name</Text>
                     <TextInput
                        style={[styles.formInput, {backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', borderColor: colors.border, color: colors.text}]}
                        placeholder="e.g. Haircut & Wash"
                        placeholderTextColor={colors.textMuted}
                        value={newServiceName}
                        onChangeText={setNewServiceName}
                     />
                  </View>

                  <View style={{flexDirection:'row', gap: 12}}>
                      <View style={[styles.inputGroup, {flex: 1}]}>
                         <Text style={[styles.label, {color: colors.textMuted}]}>Price (₹)</Text>
                         <TextInput
                            style={[styles.formInput, {backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', borderColor: colors.border, color: colors.text}]}
                            placeholder="350"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            value={newServicePrice}
                            onChangeText={setNewServicePrice}
                         />
                      </View>
                      <View style={[styles.inputGroup, {flex: 1}]}>
                         <Text style={[styles.label, {color: colors.textMuted}]}>Duration (min)</Text>
                         <TextInput
                            style={[styles.formInput, {backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', borderColor: colors.border, color: colors.text}]}
                            placeholder="30"
                            placeholderTextColor={colors.textMuted}
                            keyboardType="numeric"
                            value={newServiceDuration}
                            onChangeText={setNewServiceDuration}
                         />
                      </View>
                  </View>

                  <TouchableOpacity style={[styles.addBtn, {backgroundColor: colors.tint}]} onPress={handleAddService} disabled={addingService}>
                      {addingService ? <ActivityIndicator color="#0f172a"/> : (
                          <Text style={styles.addBtnText}>Add Service</Text>
                      )}
                  </TouchableOpacity>
              </View>
          </View>
        </FadeInView>
        )}

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
  
  tabContainer: { flexDirection: 'row', marginBottom: 20, borderRadius: 12, padding: 4, borderWidth: 1 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, gap: 8, borderRadius: 10 },
  tabText: { fontWeight: 'bold', fontSize: 14 },
  tabTextActive: { color: '#000' },

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

  // Scheduling Rules
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 16 },
  helperText: { fontSize: 10, marginTop: 2 },
  inputSmall: { padding: 12, borderRadius: 8, borderWidth: 1, width: 80, textAlign: 'center' },
  divider: { height: 1, marginVertical: 12 },

  // Image Picker
  imagePicker: { width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', marginBottom: 20, borderWidth: 1 },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderImage: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  // Service Item
  serviceItem: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 10, borderRadius: 16, borderWidth: 1 },
  serviceIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  serviceName: { fontWeight: 'bold', fontSize: 16 },
  serviceDetails: { fontSize: 12 },
  emptyServices: { alignItems: 'center', padding: 40, opacity: 0.7 },
  
  // Add Form
  addForm: { padding: 20, borderRadius: 16, borderWidth: 1, marginTop: 10 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  formInput: { padding: 14, borderRadius: 12, borderWidth: 1 },
  
  addBtn: { padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  addBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 }
});
