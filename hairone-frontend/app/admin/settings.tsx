import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Switch, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, Save, Settings, DollarSign, Percent, AlertCircle } from 'lucide-react-native';

export default function AdminSettings() {
  const router = useRouter();
  const { colors, theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [adminCommission, setAdminCommission] = useState('');
  const [userDiscount, setUserDiscount] = useState('');
  const [maxCashBookings, setMaxCashBookings] = useState('');
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await api.get('/admin/config');
      if (res.data) {
          setAdminCommission(String(res.data.adminCommissionRate));
          setUserDiscount(String(res.data.userDiscountRate));
          setMaxCashBookings(String(res.data.maxCashBookingsPerMonth || 5));
          setTestMode(res.data.isPaymentTestMode);
      }
    } catch (e) {
      Alert.alert("Error", "Failed to fetch settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/admin/config', {
          adminCommissionRate: parseFloat(adminCommission),
          userDiscountRate: parseFloat(userDiscount),
          maxCashBookingsPerMonth: parseInt(maxCashBookings),
          isPaymentTestMode: testMode
      });
      Alert.alert("Success", "Settings updated successfully");
    } catch (e) {
      Alert.alert("Error", "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
      return (
          <View style={[styles.container, styles.center, {backgroundColor: colors.background}]}>
              <ActivityIndicator color={colors.tint} />
          </View>
      )
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>System Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.section, {backgroundColor: colors.card, borderColor: colors.border}]}>
             <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10}}>
                <Settings size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Global Rates</Text>
             </View>

             <View style={styles.inputGroup}>
                <Text style={[styles.label, {color: colors.textMuted}]}>Admin Commission (%)</Text>
                <View style={[styles.inputWrapper, {borderColor: colors.border, backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'}]}>
                    <Percent size={16} color={colors.textMuted} />
                    <TextInput
                        style={[styles.input, {color: colors.text}]}
                        value={adminCommission}
                        onChangeText={setAdminCommission}
                        keyboardType="numeric"
                        placeholder="10"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>
                <Text style={styles.hint}>Taken from the total booking price.</Text>
             </View>

             <View style={styles.inputGroup}>
                <Text style={[styles.label, {color: colors.textMuted}]}>User Discount (%)</Text>
                <View style={[styles.inputWrapper, {borderColor: colors.border, backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'}]}>
                    <Percent size={16} color={colors.textMuted} />
                    <TextInput
                        style={[styles.input, {color: colors.text}]}
                        value={userDiscount}
                        onChangeText={setUserDiscount}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>
                <Text style={styles.hint}>Subsidy given to user (Paid by Admin from Commission).</Text>
             </View>
          </View>

          <View style={[styles.section, {backgroundColor: colors.card, borderColor: colors.border}]}>
             <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10}}>
                <AlertCircle size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Limits & Restrictions</Text>
             </View>

             <View style={styles.inputGroup}>
                <Text style={[styles.label, {color: colors.textMuted}]}>Max Cash Bookings / Month</Text>
                <View style={[styles.inputWrapper, {borderColor: colors.border, backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc'}]}>
                    <Text style={{fontSize: 16, fontWeight: 'bold', color: colors.textMuted}}>#</Text>
                    <TextInput
                        style={[styles.input, {color: colors.text}]}
                        value={maxCashBookings}
                        onChangeText={setMaxCashBookings}
                        keyboardType="numeric"
                        placeholder="5"
                        placeholderTextColor={colors.textMuted}
                    />
                </View>
                <Text style={styles.hint}>Limit per user for cash payments to reduce no-shows.</Text>
             </View>
          </View>

          <View style={[styles.section, {backgroundColor: colors.card, borderColor: colors.border}]}>
             <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10}}>
                <DollarSign size={20} color={colors.tint} />
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Payment Gateway</Text>
             </View>

             <View style={styles.row}>
                <View style={{flex: 1}}>
                    <Text style={[styles.rowLabel, {color: colors.text}]}>Test Mode</Text>
                    <Text style={[styles.rowSub, {color: colors.textMuted}]}>Enable "Simulate Payment" in user app.</Text>
                </View>
                <Switch
                    value={testMode}
                    onValueChange={setTestMode}
                    trackColor={{false: '#334155', true: colors.tint}}
                    thumbColor={'#fff'}
                />
             </View>
          </View>

          <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.tint}]} onPress={handleSave} disabled={saving}>
             {saving ? <ActivityIndicator color="#0f172a" /> : (
                 <>
                    <Save size={20} color="#0f172a" />
                    <Text style={styles.saveText}>Save Changes</Text>
                 </>
             )}
          </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20, gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 24, fontWeight: 'bold' },
  content: { padding: 20 },

  section: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold' },

  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, marginBottom: 8, fontWeight: '600' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 48, gap: 8 },
  input: { flex: 1, fontSize: 16, fontWeight: 'bold' },
  hint: { fontSize: 12, color: '#64748b', marginTop: 4 },

  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 16, fontWeight: 'bold' },
  rowSub: { fontSize: 12, marginTop: 2 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12, gap: 8, marginTop: 10 },
  saveText: { fontSize: 16, fontWeight: 'bold', color: '#0f172a' }
});
