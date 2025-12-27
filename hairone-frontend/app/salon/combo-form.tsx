import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
  ScrollView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ChevronLeft, Trash2, Check, IndianRupee, Layers } from 'lucide-react-native';

export default function ComboFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const { colors, theme } = useTheme();

  const isEditing = !!id;
  const isDark = theme === 'dark';

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isHomeServiceAvailable, setIsHomeServiceAvailable] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

  const [availableServices, setAvailableServices] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // Computed
  const [originalPrice, setOriginalPrice] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
      if (availableServices.length > 0) {
          let op = 0;
          let dur = 0;
          selectedServices.forEach(sId => {
              const s = availableServices.find(as => as._id === sId);
              if (s) {
                  op += s.price;
                  dur += s.duration;
              }
          });
          setOriginalPrice(op);
          setTotalDuration(dur);
      }
  }, [selectedServices, availableServices]);

  const fetchData = async () => {
      // @ts-ignore
      if (!user?.myShopId) return;
      try {
          // @ts-ignore
          const res = await api.get(`/shops/${user.myShopId}`);
          const shopServices = res.data.shop.services || [];
          setAvailableServices(shopServices);

          if (isEditing) {
              const combos = res.data.shop.combos || [];
              const combo = combos.find((c: any) => c._id === id);
              if (combo) {
                  setName(combo.name);
                  setPrice(combo.price.toString());
                  setSelectedServices(combo.items || []);
                  setIsAvailable(combo.isAvailable !== false);
                  setIsHomeServiceAvailable(combo.isHomeServiceAvailable !== false);
              } else {
                  Alert.alert("Error", "Combo not found");
                  router.back();
              }
          }
      } catch (e) {
          console.log(e);
          Alert.alert("Error", "Failed to load data");
      } finally {
          setFetching(false);
      }
  };

  const handleSave = async () => {
      if (!name.trim()) return Alert.alert("Required", "Please enter a combo name");
      if (!price.trim()) return Alert.alert("Required", "Please enter a price");
      if (selectedServices.length < 2) return Alert.alert("Required", "Please select at least 2 services");

      setLoading(true);
      try {
          // @ts-ignore
          const shopId = user?.myShopId;
          const payload = {
              name,
              price: parseInt(price),
              originalPrice,
              duration: totalDuration,
              items: selectedServices,
              isAvailable,
              isHomeServiceAvailable
          };

          if (isEditing) {
              await api.put(`/shops/${shopId}/combos/${id}`, payload);
              Alert.alert("Success", "Combo updated successfully");
          } else {
              await api.post(`/shops/${shopId}/combos`, payload);
              Alert.alert("Success", "Combo created successfully");
          }
          router.back();
      } catch (e) {
          console.log(e);
          Alert.alert("Error", "Failed to save combo");
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = () => {
      Alert.alert("Delete Combo", "Are you sure you want to remove this combo?", [
          { text: "Cancel", style: "cancel" },
          {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                  try {
                      setLoading(true);
                      // @ts-ignore
                      await api.delete(`/shops/${user.myShopId}/combos/${id}`);
                      router.back();
                  } catch (e) {
                      Alert.alert("Error", "Failed to delete combo");
                      setLoading(false);
                  }
              }
          }
      ]);
  };

  const toggleService = (sId: string) => {
      setSelectedServices(prev => {
          if (prev.includes(sId)) return prev.filter(id => id !== sId);
          return [...prev, sId];
      });
  };

  if (fetching) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.tint} /></View>;

  return (
    <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, {backgroundColor: colors.background}]}
    >
      {/* HEADER */}
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>{isEditing ? 'Edit Combo' : 'New Combo'}</Text>
         <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveBtn}>
             {loading ? <ActivityIndicator color={colors.tint} size="small" /> : <Text style={[styles.saveText, {color: colors.tint}]}>Save</Text>}
         </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

          <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
              <View style={styles.inputGroup}>
                  <Text style={[styles.label, {color: colors.textMuted}]}>Combo Name</Text>
                  <TextInput
                      style={[styles.input, {color: colors.text, borderColor: colors.border, backgroundColor: isDark ? '#0f172a' : '#f8fafc'}]}
                      placeholder="e.g. Grooming Package"
                      placeholderTextColor={colors.textMuted}
                      value={name}
                      onChangeText={setName}
                  />
              </View>

              <View style={styles.inputGroup}>
                  <Text style={[styles.label, {color: colors.textMuted}]}>Combo Price (₹)</Text>
                  <View style={[styles.inputIconWrapper, {borderColor: colors.border, backgroundColor: isDark ? '#0f172a' : '#f8fafc'}]}>
                      <IndianRupee size={16} color={colors.textMuted} style={{marginRight: 8}}/>
                      <TextInput
                          style={[styles.inputNoBorder, {color: colors.text}]}
                          placeholder="0"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="numeric"
                          value={price}
                          onChangeText={setPrice}
                      />
                  </View>
              </View>

              <View style={styles.statsRow}>
                  <Text style={{color: colors.textMuted, fontSize: 12}}>Original Value: <Text style={{fontWeight:'bold', color: colors.text}}>₹{originalPrice}</Text></Text>
                  <Text style={{color: colors.textMuted, fontSize: 12}}>Total Time: <Text style={{fontWeight:'bold', color: colors.text}}>{totalDuration} min</Text></Text>
              </View>
          </View>

          <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>Included Services</Text>
          <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border, padding: 0, overflow: 'hidden'}]}>
              {availableServices.length === 0 ? (
                  <View style={{padding: 20}}>
                      <Text style={{color: colors.textMuted}}>No services available. Create services first.</Text>
                  </View>
              ) : (
                  availableServices.map((svc, idx) => {
                      const isSelected = selectedServices.includes(svc._id);
                      return (
                          <TouchableOpacity
                              key={svc._id}
                              onPress={() => toggleService(svc._id)}
                              style={[
                                  styles.serviceRow,
                                  {borderBottomColor: colors.border, borderBottomWidth: idx === availableServices.length - 1 ? 0 : 1}
                              ]}
                          >
                              <View style={[styles.checkbox, {borderColor: isSelected ? colors.tint : colors.textMuted, backgroundColor: isSelected ? colors.tint : 'transparent'}]}>
                                  {isSelected && <Check size={14} color="#000" />}
                              </View>
                              <View style={{flex: 1}}>
                                  <Text style={[styles.serviceName, {color: colors.text}]}>{svc.name}</Text>
                                  <Text style={{color: colors.textMuted, fontSize: 12}}>₹{svc.price} • {svc.duration} min</Text>
                              </View>
                          </TouchableOpacity>
                      )
                  })
              )}
          </View>

          <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>Availability</Text>
          <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>

              <View style={styles.switchRow}>
                  <View style={{flex: 1}}>
                      <Text style={[styles.switchLabel, {color: colors.text}]}>Active</Text>
                      <Text style={[styles.switchSub, {color: colors.textMuted}]}>Show this combo in your menu</Text>
                  </View>
                  <Switch
                      value={isAvailable}
                      onValueChange={setIsAvailable}
                      trackColor={{false: colors.border, true: colors.tint}}
                      thumbColor={isAvailable ? "#0f172a" : "#94a3b8"}
                  />
              </View>

              <View style={[styles.divider, {backgroundColor: colors.border}]} />

              <View style={styles.switchRow}>
                  <View style={{flex: 1}}>
                      <Text style={[styles.switchLabel, {color: colors.text}]}>Home Service</Text>
                      <Text style={[styles.switchSub, {color: colors.textMuted}]}>Available for home visits</Text>
                  </View>
                  <Switch
                      value={isHomeServiceAvailable}
                      onValueChange={setIsHomeServiceAvailable}
                      trackColor={{false: colors.border, true: colors.tint}}
                      thumbColor={isHomeServiceAvailable ? "#0f172a" : "#94a3b8"}
                  />
              </View>

          </View>

          {isEditing && (
              <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                  <Trash2 size={20} color="#ef4444" />
                  <Text style={styles.deleteText}>Delete Combo</Text>
              </TouchableOpacity>
          )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { padding: 8, marginLeft: -8 },
  title: { fontSize: 20, fontWeight: 'bold' },
  saveBtn: { padding: 8, marginRight: -8 },
  saveText: { fontWeight: 'bold', fontSize: 16 },

  content: { padding: 20, paddingBottom: 40 },

  card: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 12, marginLeft: 4 },

  inputGroup: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  input: { padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 16 },

  inputIconWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, height: 50 },
  inputNoBorder: { flex: 1, fontSize: 16, height: '100%' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },

  serviceRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  serviceName: { fontWeight: '600', fontSize: 14, marginBottom: 2 },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  switchLabel: { fontSize: 16, fontWeight: '500' },
  switchSub: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, marginVertical: 16 },

  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', marginTop: 20 },
  deleteText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 }
});
