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
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, Plus, Clock, IndianRupee, Scissors, Trash2, Edit } from 'lucide-react-native';

export default function ManageServicesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  
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

  if (loading) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.tint} /></View>;

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Services Menu</Text>
      </View>
      
      <ScrollView contentContainerStyle={{paddingBottom: 40}} showsVerticalScrollIndicator={false}>
        
        {/* --- SECTION 2: SERVICES --- */}
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Services List ({services.length})</Text>
            
            {/* List of Services (Mapped instead of FlatList) */}
            <View style={{marginBottom: 20}}>
              {services.length === 0 ? (
                 <Text style={{color: colors.textMuted, fontStyle: 'italic'}}>No services added yet.</Text>
              ) : (
                 services.map((item, index) => (
                    <View key={index} style={[styles.serviceItem, {backgroundColor: colors.card, borderColor: colors.border}, item.isAvailable === false && {opacity: 0.6}]}>
                        <View style={[styles.serviceIcon, item.isAvailable === false && {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}>
                           <Scissors size={20} color={item.isAvailable !== false ? colors.tint : colors.textMuted} />
                        </View>
                        <View style={{flex: 1}}>
                            <Text style={[styles.serviceName, {color: colors.text}, item.isAvailable === false && {color: colors.textMuted, textDecorationLine: 'line-through'}]}>{item.name}</Text>
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
                        <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                             <Switch
                                value={item.isAvailable !== false}
                                onValueChange={() => handleToggleService(item._id, item.isAvailable !== false)}
                                trackColor={{false: colors.border, true: colors.tint}}
                                thumbColor={item.isAvailable !== false ? "#0f172a" : "#94a3b8"}
                             />
                             <TouchableOpacity onPress={() => startEditing(item)} style={[styles.actionBtn, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}>
                                 <Edit size={16} color={colors.text} />
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
            <View style={[styles.addForm, {backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc', borderColor: colors.border}]}>
                <View style={styles.formHeader}>
                   {editingServiceId ? (
                       <Edit size={20} color={colors.tint} />
                   ) : (
                       <Plus size={20} color={colors.tint} />
                   )}
                   <Text style={{color: colors.text, fontWeight:'bold', fontSize: 16}}>
                       {editingServiceId ? 'Edit Service' : 'Add New Service'}
                   </Text>
                   {editingServiceId && (
                       <TouchableOpacity onPress={resetServiceForm} style={{marginLeft: 'auto'}}>
                           <Text style={{color: colors.textMuted, fontSize: 12}}>Cancel</Text>
                       </TouchableOpacity>
                   )}
                </View>

                <View style={styles.inputGroup}>
                   <Text style={[styles.label, {color: colors.textMuted}]}>Service Name</Text>
                   <TextInput 
                      style={[styles.formInput, {backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', color: colors.text, borderColor: colors.border}]}
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
                          style={[styles.formInput, {backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', color: colors.text, borderColor: colors.border}]}
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
                          style={[styles.formInput, {backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', color: colors.text, borderColor: colors.border}]}
                          placeholder="30" 
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          value={newServiceDuration}
                          onChangeText={setNewServiceDuration}
                       />
                    </View>
                </View>

                <TouchableOpacity style={[styles.addBtn, {backgroundColor: colors.tint}]} onPress={handleAddOrUpdateService} disabled={addingService}>
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
  container: { flex: 1, padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1 },
  title: { fontSize: 24, fontWeight: 'bold' },
  
  section: { marginBottom: 30 },
  sectionTitle: { marginBottom: 12, fontSize: 16, fontWeight:'bold' },
  
  card: { padding: 20, borderRadius: 16, borderWidth: 1 },
  label: { fontSize: 12, marginBottom: 8, fontWeight: '600' },
  
  // Service Item
  serviceItem: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 10, borderRadius: 16, borderWidth: 1 },
  serviceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(245, 158, 11, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  serviceName: { fontWeight: 'bold', fontSize: 16 },
  serviceDetails: { fontSize: 12 },
  
  // Add Form
  addForm: { padding: 20, borderRadius: 16, borderWidth: 1, marginTop: 10 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  inputGroup: { marginBottom: 16 },
  formInput: { padding: 14, borderRadius: 12, borderWidth: 1 },
  
  addBtn: { padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  addBtnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },
  actionBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }
});
