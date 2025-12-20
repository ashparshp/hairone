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
import { ChevronLeft, Plus, MapPin, Save, Clock, IndianRupee, Scissors, Trash2, Edit } from 'lucide-react-native';

export default function ManageServicesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Service Form State
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('');
  const [addingService, setAddingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  useEffect(() => {
    fetchShop();
  }, []);

  const fetchShop = async () => {
    // @ts-ignore
    if (!user?.myShopId) return;
    try {
      // @ts-ignore
      const res = await api.get(`/shops/${user.myShopId}`);
      const s = res.data.shop;
      setShop(s);
      setServices(s.services || []);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to load shop details");
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrUpdateService = async () => {
    if (!newServiceName || !newServicePrice || !newServiceDuration) {
        Alert.alert("Missing Fields", "Please fill all fields.");
        return;
    }

    setAddingService(true);
    try {
        let res;
        if (editingServiceId) {
            // Update existing service
            res = await api.put(`/shops/${shop._id}/services/${editingServiceId}`, {
                name: newServiceName,
                price: parseInt(newServicePrice),
                duration: parseInt(newServiceDuration)
            });
            Alert.alert("Success", "Service Updated!");
        } else {
            // Add new service
            res = await api.post(`/shops/${shop._id}/services`, {
                name: newServiceName,
                price: parseInt(newServicePrice),
                duration: parseInt(newServiceDuration)
            });
            Alert.alert("Success", "Service Added!");
        }
        
        // Update local state
        setShop(res.data);
        setServices(res.data.services);
        
        // Reset form
        resetServiceForm();
    } catch (e) {
        console.log(e);
        Alert.alert("Error", editingServiceId ? "Failed to update service." : "Failed to add service.");
    } finally {
        setAddingService(false);
    }
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

  const resetServiceForm = () => {
      setNewServiceName('');
      setNewServicePrice('');
      setNewServiceDuration('');
      setEditingServiceId(null);
  };

  const startEditing = (service: any) => {
      setNewServiceName(service.name);
      setNewServicePrice(service.price.toString());
      setNewServiceDuration(service.duration.toString());
      setEditingServiceId(service._id);
  };

  const handleDeleteService = (serviceId: string) => {
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
                          if (editingServiceId === serviceId) {
                              resetServiceForm();
                          }
                      } catch (e) {
                          console.log(e);
                          Alert.alert("Error", "Failed to delete service");
                      }
                  }
              }
          ]
      );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft size={24} color="white"/>
         </TouchableOpacity>
         <Text style={styles.title}>Services Menu</Text>
      </View>
      
      <ScrollView contentContainerStyle={{paddingBottom: 40}} showsVerticalScrollIndicator={false}>
        
        {/* --- SECTION 2: SERVICES --- */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services List ({services.length})</Text>
            
            {/* List of Services (Mapped instead of FlatList) */}
            <View style={{marginBottom: 20}}>
              {services.length === 0 ? (
                 <Text style={{color: Colors.textMuted, fontStyle: 'italic'}}>No services added yet.</Text>
              ) : (
                 services.map((item, index) => (
                    <View key={index} style={[styles.serviceItem, item.isAvailable === false && {opacity: 0.6}]}>
                        <View style={[styles.serviceIcon, item.isAvailable === false && {backgroundColor: '#334155'}]}>
                           <Scissors size={20} color={item.isAvailable !== false ? Colors.primary : Colors.textMuted} />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={[styles.serviceName, item.isAvailable === false && {color: Colors.textMuted, textDecorationLine: 'line-through'}]}>{item.name}</Text>
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
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                             <Switch
                                value={item.isAvailable !== false}
                                onValueChange={() => handleToggleService(item._id, item.isAvailable !== false)}
                                trackColor={{false: '#334155', true: Colors.primary}}
                                thumbColor={item.isAvailable !== false ? "#0f172a" : "#94a3b8"}
                             />
                             <TouchableOpacity onPress={() => startEditing(item)} style={styles.actionBtn}>
                                 <Edit size={16} color="white" />
                             </TouchableOpacity>
                             <TouchableOpacity onPress={() => handleDeleteService(item._id)} style={[styles.actionBtn, {backgroundColor: 'rgba(239, 68, 68, 0.2)'}]}>
                                 <Trash2 size={16} color="#ef4444" />
                             </TouchableOpacity>
                        </View>
                    </View>
                 ))
              )}
            </View>

            {/* Add/Edit Service Form */}
            <View style={styles.addForm}>
                <View style={styles.formHeader}>
                   {editingServiceId ? (
                       <Edit size={20} color={Colors.primary} />
                   ) : (
                       <Plus size={20} color={Colors.primary} />
                   )}
                   <Text style={{color: 'white', fontWeight:'bold', fontSize: 16}}>
                       {editingServiceId ? 'Edit Service' : 'Add New Service'}
                   </Text>
                   {editingServiceId && (
                       <TouchableOpacity onPress={resetServiceForm} style={{marginLeft: 'auto'}}>
                           <Text style={{color: Colors.textMuted, fontSize: 12}}>Cancel</Text>
                       </TouchableOpacity>
                   )}
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

                <TouchableOpacity style={styles.addBtn} onPress={handleAddOrUpdateService} disabled={addingService}>
                    {addingService ? <ActivityIndicator color="#0f172a"/> : (
                        <Text style={styles.addBtnText}>{editingServiceId ? 'Update Service' : 'Add Service'}</Text>
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
  addBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' }
});