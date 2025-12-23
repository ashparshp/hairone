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
  Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, Plus, Clock, IndianRupee, Scissors, Trash2, Edit, Layers, Check } from 'lucide-react-native';

export default function ManageServicesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'services' | 'combos'>('services');

  // Service Form State
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('');
  const [addingService, setAddingService] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);

  // Combo Form State
  const [newComboName, setNewComboName] = useState('');
  const [newComboPrice, setNewComboPrice] = useState('');
  const [selectedComboServices, setSelectedComboServices] = useState<string[]>([]); // Service IDs
  const [addingCombo, setAddingCombo] = useState(false);
  const [editingComboId, setEditingComboId] = useState<string | null>(null);

  // Computed Combo values
  const [comboOriginalPrice, setComboOriginalPrice] = useState(0);
  const [comboDuration, setComboDuration] = useState(0);

  useEffect(() => {
    fetchShop();
  }, []);

  // Effect to calculate Original Price and Duration whenever selected services change
  useEffect(() => {
      if (services.length > 0) {
          let totalOriginal = 0;
          let totalDur = 0;
          selectedComboServices.forEach(sId => {
              const svc = services.find(s => s._id === sId);
              if (svc) {
                  totalOriginal += svc.price;
                  totalDur += svc.duration;
              }
          });
          setComboOriginalPrice(totalOriginal);
          setComboDuration(totalDur);
      }
  }, [selectedComboServices, services]);

  const fetchShop = async () => {
    // @ts-ignore
    if (!user?.myShopId) return;
    try {
      // @ts-ignore
      const res = await api.get(`/shops/${user.myShopId}`);
      const s = res.data.shop;
      setShop(s);
      setServices(s.services || []);
      setCombos(s.combos || []);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to load shop details");
    } finally {
      setLoading(false);
    }
  };

  // --- SERVICE ACTIONS ---
  const handleAddOrUpdateService = async () => {
    if (!newServiceName || !newServicePrice || !newServiceDuration) {
        Alert.alert("Missing Fields", "Please fill all fields.");
        return;
    }

    setAddingService(true);
    try {
        let res;
        if (editingServiceId) {
            res = await api.put(`/shops/${shop._id}/services/${editingServiceId}`, {
                name: newServiceName,
                price: parseInt(newServicePrice),
                duration: parseInt(newServiceDuration)
            });
            Alert.alert("Success", "Service Updated!");
        } else {
            res = await api.post(`/shops/${shop._id}/services`, {
                name: newServiceName,
                price: parseInt(newServicePrice),
                duration: parseInt(newServiceDuration)
            });
            Alert.alert("Success", "Service Added!");
        }
        setShop(res.data);
        setServices(res.data.services);
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

  const handleDeleteService = (serviceId: string) => {
      Alert.alert("Delete Service", "Are you sure?", [
          { text: "Cancel", style: "cancel" },
          {
              text: "Delete", style: "destructive",
              onPress: async () => {
                  try {
                      const res = await api.delete(`/shops/${shop._id}/services/${serviceId}`);
                      setShop(res.data);
                      setServices(res.data.services);
                      if (editingServiceId === serviceId) resetServiceForm();
                  } catch (e) {
                      Alert.alert("Error", "Failed to delete service");
                  }
              }
          }
      ]);
  };

  const resetServiceForm = () => {
      setNewServiceName('');
      setNewServicePrice('');
      setNewServiceDuration('');
      setEditingServiceId(null);
  };

  const startEditingService = (service: any) => {
      setNewServiceName(service.name);
      setNewServicePrice(service.price.toString());
      setNewServiceDuration(service.duration.toString());
      setEditingServiceId(service._id);
      setActiveTab('services');
  };

  // --- COMBO ACTIONS ---
  const handleAddOrUpdateCombo = async () => {
      if (!newComboName || !newComboPrice || selectedComboServices.length < 2) {
          Alert.alert("Missing Fields", "Please enter name, price and select at least 2 services.");
          return;
      }

      setAddingCombo(true);
      try {
          const payload = {
              name: newComboName,
              price: parseInt(newComboPrice),
              originalPrice: comboOriginalPrice,
              duration: comboDuration,
              items: selectedComboServices
          };

          let res;
          if (editingComboId) {
              res = await api.put(`/shops/${shop._id}/combos/${editingComboId}`, payload);
              Alert.alert("Success", "Combo Updated!");
          } else {
              res = await api.post(`/shops/${shop._id}/combos`, payload);
              Alert.alert("Success", "Combo Added!");
          }
          setShop(res.data);
          setCombos(res.data.combos || []);
          resetComboForm();
      } catch (e) {
          console.log(e);
          Alert.alert("Error", editingComboId ? "Failed to update combo." : "Failed to add combo.");
      } finally {
          setAddingCombo(false);
      }
  };

  const handleToggleCombo = async (comboId: string, currentStatus: boolean) => {
      try {
          const res = await api.put(`/shops/${shop._id}/combos/${comboId}`, {
              isAvailable: !currentStatus
          });
          setShop(res.data);
          setCombos(res.data.combos || []);
      } catch (e) {
          Alert.alert("Error", "Failed to update status");
      }
  };

  const handleDeleteCombo = (comboId: string) => {
      Alert.alert("Delete Combo", "Are you sure?", [
          { text: "Cancel", style: "cancel" },
          {
              text: "Delete", style: "destructive",
              onPress: async () => {
                  try {
                      const res = await api.delete(`/shops/${shop._id}/combos/${comboId}`);
                      setShop(res.data);
                      setCombos(res.data.combos || []);
                      if (editingComboId === comboId) resetComboForm();
                  } catch (e) {
                      Alert.alert("Error", "Failed to delete combo");
                  }
              }
          }
      ]);
  };

  const resetComboForm = () => {
      setNewComboName('');
      setNewComboPrice('');
      setSelectedComboServices([]);
      setEditingComboId(null);
  };

  const startEditingCombo = (combo: any) => {
      setNewComboName(combo.name);
      setNewComboPrice(combo.price.toString());
      setSelectedComboServices(combo.items || []);
      setEditingComboId(combo._id);
      setActiveTab('combos');
  };

  const toggleServiceInCombo = (serviceId: string) => {
      setSelectedComboServices(prev => {
          if (prev.includes(serviceId)) return prev.filter(id => id !== serviceId);
          return [...prev, serviceId];
      });
  };

  // --- RENDER ---

  if (loading) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.tint} /></View>;

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Manage Menu</Text>
      </View>
      
      {/* TABS */}
      <View style={styles.tabs}>
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
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 40}} showsVerticalScrollIndicator={false}>
        
        {/* --- SECTION: SERVICES --- */}
        {activeTab === 'services' && (
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: colors.text}]}>Services List ({services.length})</Text>
            
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
                             <TouchableOpacity onPress={() => startEditingService(item)} style={[styles.actionBtn, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}>
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
                   {editingServiceId ? <Edit size={20} color={colors.tint} /> : <Plus size={20} color={colors.tint} />}
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
        )}

        {/* --- SECTION: COMBOS --- */}
        {activeTab === 'combos' && (
        <View style={styles.section}>
             <Text style={[styles.sectionTitle, {color: colors.text}]}>Combos List ({combos.length})</Text>

             <View style={{marginBottom: 20}}>
                {combos.length === 0 ? (
                   <Text style={{color: colors.textMuted, fontStyle: 'italic'}}>No combos created yet.</Text>
                ) : (
                    combos.map((item, index) => (
                        <View key={index} style={[styles.serviceItem, {backgroundColor: colors.card, borderColor: colors.border}, item.isAvailable === false && {opacity: 0.6}]}>
                             <View style={[styles.serviceIcon, item.isAvailable === false && {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}>
                                <Layers size={20} color={item.isAvailable !== false ? colors.tint : colors.textMuted} />
                             </View>
                             <View style={{flex: 1}}>
                                 <Text style={[styles.serviceName, {color: colors.text}, item.isAvailable === false && {color: colors.textMuted, textDecorationLine: 'line-through'}]}>{item.name}</Text>
                                 <View style={{flexDirection: 'row', gap: 12, marginTop: 4}}>
                                     <Text style={[styles.serviceDetails, {color: colors.textMuted}]}>{item.duration} min</Text>
                                     <Text style={[styles.serviceDetails, {color: colors.tint, fontWeight: 'bold'}]}>₹{item.price}</Text>
                                     <Text style={[styles.serviceDetails, {color: colors.textMuted, textDecorationLine: 'line-through'}]}>₹{item.originalPrice}</Text>
                                 </View>
                                 <Text style={{fontSize: 10, color: colors.textMuted, marginTop: 4}}>
                                     {item.items?.length || 0} services
                                 </Text>
                             </View>
                             <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                                  <Switch
                                     value={item.isAvailable !== false}
                                     onValueChange={() => handleToggleCombo(item._id, item.isAvailable !== false)}
                                     trackColor={{false: colors.border, true: colors.tint}}
                                     thumbColor={item.isAvailable !== false ? "#0f172a" : "#94a3b8"}
                                  />
                                  <TouchableOpacity onPress={() => startEditingCombo(item)} style={[styles.actionBtn, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}>
                                      <Edit size={16} color={colors.text} />
                                  </TouchableOpacity>
                                  <TouchableOpacity onPress={() => handleDeleteCombo(item._id)} style={[styles.actionBtn, {backgroundColor: 'rgba(239, 68, 68, 0.2)'}]}>
                                      <Trash2 size={16} color="#ef4444" />
                                  </TouchableOpacity>
                             </View>
                        </View>
                    ))
                )}
             </View>

             {/* Add/Edit Combo Form */}
             <View style={[styles.addForm, {backgroundColor: theme === 'dark' ? '#1e293b' : '#f8fafc', borderColor: colors.border}]}>
                <View style={styles.formHeader}>
                   {editingComboId ? <Edit size={20} color={colors.tint} /> : <Plus size={20} color={colors.tint} />}
                   <Text style={{color: colors.text, fontWeight:'bold', fontSize: 16}}>
                       {editingComboId ? 'Edit Combo' : 'Create New Combo'}
                   </Text>
                   {editingComboId && (
                       <TouchableOpacity onPress={resetComboForm} style={{marginLeft: 'auto'}}>
                           <Text style={{color: colors.textMuted, fontSize: 12}}>Cancel</Text>
                       </TouchableOpacity>
                   )}
                </View>

                <View style={styles.inputGroup}>
                   <Text style={[styles.label, {color: colors.textMuted}]}>Combo Name</Text>
                   <TextInput
                      style={[styles.formInput, {backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', color: colors.text, borderColor: colors.border}]}
                      placeholder="e.g. Grooming Package"
                      placeholderTextColor={colors.textMuted}
                      value={newComboName}
                      onChangeText={setNewComboName}
                   />
                </View>

                <View style={styles.inputGroup}>
                   <Text style={[styles.label, {color: colors.textMuted}]}>Select Services (at least 2)</Text>
                   <ScrollView style={{maxHeight: 150, borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 8}}>
                       {services.map(svc => {
                           const isSelected = selectedComboServices.includes(svc._id);
                           return (
                               <TouchableOpacity
                                   key={svc._id}
                                   onPress={() => toggleServiceInCombo(svc._id)}
                                   style={{
                                       flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
                                       borderBottomWidth: 1, borderBottomColor: colors.border
                                   }}
                               >
                                   <View style={{
                                       width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: colors.textMuted,
                                       alignItems: 'center', justifyContent: 'center', marginRight: 10,
                                       backgroundColor: isSelected ? colors.tint : 'transparent'
                                   }}>
                                       {isSelected && <Check size={14} color="#000" />}
                                   </View>
                                   <Text style={{color: colors.text, flex: 1}}>{svc.name}</Text>
                                   <Text style={{color: colors.textMuted}}>₹{svc.price}</Text>
                               </TouchableOpacity>
                           )
                       })}
                   </ScrollView>
                </View>

                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
                    <Text style={{color: colors.textMuted}}>Total Duration: {comboDuration} min</Text>
                    <Text style={{color: colors.textMuted}}>Original Price: ₹{comboOriginalPrice}</Text>
                </View>

                <View style={styles.inputGroup}>
                   <Text style={[styles.label, {color: colors.textMuted}]}>Combo Price (Final Price for User)</Text>
                   <TextInput
                      style={[styles.formInput, {backgroundColor: theme === 'dark' ? '#0f172a' : '#ffffff', color: colors.text, borderColor: colors.border}]}
                      placeholder="e.g. 500"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={newComboPrice}
                      onChangeText={setNewComboPrice}
                   />
                </View>

                <TouchableOpacity style={[styles.addBtn, {backgroundColor: colors.tint}]} onPress={handleAddOrUpdateCombo} disabled={addingCombo}>
                    {addingCombo ? <ActivityIndicator color="#0f172a"/> : (
                        <Text style={styles.addBtnText}>{editingComboId ? 'Update Combo' : 'Add Combo'}</Text>
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
  container: { flex: 1, padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1 },
  title: { fontSize: 24, fontWeight: 'bold' },
  
  tabs: { flexDirection: 'row', marginBottom: 20, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontWeight: 'bold' },

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
