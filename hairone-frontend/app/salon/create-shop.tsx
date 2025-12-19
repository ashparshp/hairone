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
  Switch
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { ChevronLeft, Plus, MapPin, Save, Clock, IndianRupee, Scissors, Store, Trash2 } from 'lucide-react-native';

export default function ManageServicesScreen() {
  const router = useRouter();
  const { user, login, token } = useAuth();
  
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Shop Details State
  const [shopName, setShopName] = useState('');
  const [address, setAddress] = useState('');
  const [shopType, setShopType] = useState<'male'|'female'|'unisex'>('unisex');
  const [savingShop, setSavingShop] = useState(false);

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
      setShopType(s.type || 'unisex');
      setServices(s.services || []);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to load shop details");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShop = async () => {
      if (!address.trim()) return Alert.alert("Required", "Address cannot be empty");
      setSavingShop(true);
      try {
          if (shop && shop._id) {
            // Update existing shop
            const res = await api.put(`/shops/${shop._id}`, {
                address,
                type: shopType
            });
            setShop(res.data);
            Alert.alert("Success", "Shop details updated!");
          } else {
            // Create new shop
            if (!shopName.trim()) {
              setSavingShop(false);
              return Alert.alert("Required", "Shop Name cannot be empty");
            }

            const res = await api.post('/shops', {
              name: shopName,
              address,
              type: shopType
            });

            const newShop = res.data;
            setShop(newShop);

            // Update User Context
            if (user && token) {
              login(token, { ...user, role: 'owner', myShopId: newShop._id });
            }

            Alert.alert("Success", "Shop created successfully!");
          }
      } catch (e) {
          console.log(e);
          Alert.alert("Error", "Failed to save shop details.");
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
        
        // Update local state
        setShop(res.data);
        setServices(res.data.services);
        
        // Reset form
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

                {/* Shop Name Input - Only if creating or just to show */}
                <Text style={styles.label}>Shop Name</Text>
                <View style={styles.inputContainer}>
                   <Store size={18} color={Colors.textMuted} style={{marginLeft: 12}} />
                   <TextInput
                      style={[styles.input, shop && {color: Colors.textMuted}]}
                      value={shopName}
                      onChangeText={setShopName}
                      placeholder="Enter shop name"
                      placeholderTextColor="#64748b"
                      editable={!shop} // Only editable during creation as per requirement? Or let them edit? Backend updateShop doesn't support name update. So disable if shop exists.
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

        {/* --- SECTION 2: SERVICES --- */}
        {shop && (
          <View style={styles.section}>
              <Text style={styles.sectionTitle}>Services Menu ({services.length})</Text>

              {/* List of Services (Mapped instead of FlatList) */}
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

                          {/* Actions */}
                          <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                             <Switch
                                value={item.isAvailable !== false} // Default true if undefined
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

              {/* Add Service Form */}
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
  
  saveBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  
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