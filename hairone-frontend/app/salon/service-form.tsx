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
import { ChevronLeft, Trash2, Check, Clock, IndianRupee } from 'lucide-react-native';

export default function ServiceFormScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams(); // If id exists, we are editing
  const { user } = useAuth();
  const { colors, theme } = useTheme();

  const isEditing = !!id;
  const isDark = theme === 'dark';

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('');
  const [isHomeServiceAvailable, setIsHomeServiceAvailable] = useState(true);
  const [isAvailable, setIsAvailable] = useState(true);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEditing);

  useEffect(() => {
    if (isEditing) {
        fetchService();
    }
  }, [id]);

  const fetchService = async () => {
      // @ts-ignore
      if (!user?.myShopId) return;
      try {
          // We need to fetch the shop and find the service,
          // or if we had a direct getService endpoint.
          // Assuming we fetch shop for now.
          // @ts-ignore
          const res = await api.get(`/shops/${user.myShopId}`);
          const services = res.data.shop.services || [];
          const svc = services.find((s: any) => s._id === id);
          if (svc) {
              setName(svc.name);
              setPrice(svc.price.toString());
              setDuration(svc.duration.toString());
              setIsAvailable(svc.isAvailable !== false);
              setIsHomeServiceAvailable(svc.isHomeServiceAvailable !== false);
          } else {
              Alert.alert("Error", "Service not found");
              router.back();
          }
      } catch (e) {
          console.log(e);
          Alert.alert("Error", "Failed to load service");
      } finally {
          setFetching(false);
      }
  };

  const handleSave = async () => {
      if (!name.trim()) return Alert.alert("Required", "Please enter a service name");
      if (!price.trim()) return Alert.alert("Required", "Please enter a price");
      if (!duration.trim()) return Alert.alert("Required", "Please enter a duration");

      setLoading(true);
      try {
          // @ts-ignore
          const shopId = user?.myShopId;
          const payload = {
              name,
              price: parseInt(price),
              duration: parseInt(duration),
              isAvailable,
              isHomeServiceAvailable
          };

          if (isEditing) {
              await api.put(`/shops/${shopId}/services/${id}`, payload);
              Alert.alert("Success", "Service updated successfully");
          } else {
              await api.post(`/shops/${shopId}/services`, payload);
              Alert.alert("Success", "Service created successfully");
          }
          router.back();
      } catch (e) {
          console.log(e);
          Alert.alert("Error", "Failed to save service");
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = () => {
      Alert.alert("Delete Service", "Are you sure you want to remove this service? This cannot be undone.", [
          { text: "Cancel", style: "cancel" },
          {
              text: "Delete",
              style: "destructive",
              onPress: async () => {
                  try {
                      setLoading(true);
                      // @ts-ignore
                      await api.delete(`/shops/${user.myShopId}/services/${id}`);
                      router.back();
                  } catch (e) {
                      Alert.alert("Error", "Failed to delete service");
                      setLoading(false);
                  }
              }
          }
      ]);
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
         <Text style={[styles.title, {color: colors.text}]}>{isEditing ? 'Edit Service' : 'New Service'}</Text>
         <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveBtn}>
             {loading ? <ActivityIndicator color={colors.tint} size="small" /> : <Text style={[styles.saveText, {color: colors.tint}]}>Save</Text>}
         </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>

          <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
              <View style={styles.inputGroup}>
                  <Text style={[styles.label, {color: colors.textMuted}]}>Service Name</Text>
                  <TextInput
                      style={[styles.input, {color: colors.text, borderColor: colors.border, backgroundColor: isDark ? '#0f172a' : '#f8fafc'}]}
                      placeholder="e.g. Haircut & Beard Trim"
                      placeholderTextColor={colors.textMuted}
                      value={name}
                      onChangeText={setName}
                  />
              </View>

              <View style={styles.row}>
                  <View style={[styles.inputGroup, {flex: 1}]}>
                      <Text style={[styles.label, {color: colors.textMuted}]}>Price (₹)</Text>
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
                  <View style={{width: 16}} />
                  <View style={[styles.inputGroup, {flex: 1}]}>
                      <Text style={[styles.label, {color: colors.textMuted}]}>Duration (min)</Text>
                      <View style={[styles.inputIconWrapper, {borderColor: colors.border, backgroundColor: isDark ? '#0f172a' : '#f8fafc'}]}>
                          <Clock size={16} color={colors.textMuted} style={{marginRight: 8}}/>
                          <TextInput
                              style={[styles.inputNoBorder, {color: colors.text}]}
                              placeholder="30"
                              placeholderTextColor={colors.textMuted}
                              keyboardType="numeric"
                              value={duration}
                              onChangeText={setDuration}
                          />
                      </View>
                  </View>
              </View>
          </View>

          <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>Availability</Text>
          <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>

              <View style={styles.switchRow}>
                  <View style={{flex: 1}}>
                      <Text style={[styles.switchLabel, {color: colors.text}]}>Active</Text>
                      <Text style={[styles.switchSub, {color: colors.textMuted}]}>Show this service in your menu</Text>
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
                  <Text style={styles.deleteText}>Delete Service</Text>
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

  row: { flexDirection: 'row' },
  inputIconWrapper: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, height: 50 },
  inputNoBorder: { flex: 1, fontSize: 16, height: '100%' },

  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  switchLabel: { fontSize: 16, fontWeight: '500' },
  switchSub: { fontSize: 12, marginTop: 2 },
  divider: { height: 1, marginVertical: 16 },

  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', marginTop: 20 },
  deleteText: { color: '#ef4444', fontWeight: 'bold', fontSize: 16 }
});
