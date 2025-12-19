import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { ChevronLeft, Plus, Trash2, MapPin } from 'lucide-react-native';

export default function ManageServicesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Service State
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('');
  const [addingService, setAddingService] = useState(false);

  useEffect(() => {
    fetchShop();
  }, []);

  const fetchShop = async () => {
    if (!user?.myShopId) return;
    try {
      const res = await api.get(`/shops/${user.myShopId}`);
      setShop(res.data.shop);
      setServices(res.data.shop.services || []);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to load shop details");
    } finally {
      setLoading(false);
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

  const fetchLocation = () => {
      // Mock Location Fetch
      Alert.alert("Location Fetched", "Updated address to: 123 Mock Location, New York");
      // In a real app, update state here.
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft size={24} color="white"/>
         </TouchableOpacity>
         <Text style={styles.title}>Manage Shop</Text>
      </View>

      {/* Address Section */}
      <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shop Location</Text>
          <View style={styles.card}>
              <Text style={{color: 'white', fontSize: 16, marginBottom: 8}}>{shop?.address}</Text>
              <TouchableOpacity style={styles.locationBtn} onPress={fetchLocation}>
                  <MapPin size={16} color="white" />
                  <Text style={{color: 'white', fontWeight: 'bold'}}>Update from Current Location</Text>
              </TouchableOpacity>
          </View>
      </View>

      {/* Services Section */}
      <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>

          <FlatList
            data={services}
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
                <View style={styles.serviceItem}>
                    <View>
                        <Text style={styles.serviceName}>{item.name}</Text>
                        <Text style={styles.serviceDetails}>{item.duration} mins • ₹{item.price}</Text>
                    </View>
                </View>
            )}
            contentContainerStyle={{marginBottom: 16}}
          />

          {/* Add Service Form */}
          <View style={styles.addForm}>
              <Text style={{color: 'white', fontWeight:'bold', marginBottom: 12}}>Add New Service</Text>
              <TextInput
                  style={styles.input}
                  placeholder="Service Name (e.g. Haircut)"
                  placeholderTextColor={Colors.textMuted}
                  value={newServiceName}
                  onChangeText={setNewServiceName}
              />
              <View style={{flexDirection:'row', gap: 10}}>
                  <TextInput
                      style={[styles.input, {flex:1}]}
                      placeholder="Price (₹)"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="numeric"
                      value={newServicePrice}
                      onChangeText={setNewServicePrice}
                  />
                  <TextInput
                      style={[styles.input, {flex:1}]}
                      placeholder="Duration (min)"
                      placeholderTextColor={Colors.textMuted}
                      keyboardType="numeric"
                      value={newServiceDuration}
                      onChangeText={setNewServiceDuration}
                  />
              </View>
              <TouchableOpacity style={styles.addBtn} onPress={handleAddService} disabled={addingService}>
                  {addingService ? <ActivityIndicator color="#0f172a"/> : (
                      <>
                        <Plus size={18} color="#0f172a" />
                        <Text style={styles.addBtnText}>Add Service</Text>
                      </>
                  )}
              </TouchableOpacity>
          </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  section: { marginBottom: 30 },
  sectionTitle: { color: Colors.textMuted, marginBottom: 12, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1, fontWeight:'bold' },
  card: { backgroundColor: Colors.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, marginTop: 8 },
  serviceItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: Colors.card, marginBottom: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border },
  serviceName: { color: 'white', fontWeight: 'bold' },
  serviceDetails: { color: Colors.textMuted, fontSize: 12 },
  addForm: { backgroundColor: '#1e293b', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  input: { backgroundColor: Colors.background, color: 'white', padding: 12, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  addBtn: { backgroundColor: Colors.primary, padding: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, marginTop: 4 },
  addBtnText: { color: '#0f172a', fontWeight: 'bold' }
});