import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FadeInView } from '../../components/AnimatedViews';
import api from '../../services/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      showToast("Please enter a valid 10-digit mobile number", "error");
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/otp', { phone });
      setStep(2);
      showToast("OTP Sent! (Use 1234)", "success");
    } catch (e: any) {
      console.log("OTP Error:", e);
      let msg = "Something went wrong.";
      if (e.response) {
        msg = e.response.data.message || "Server Error";
      } else if (e.request) {
        msg = "Network Error. Ensure Backend is running.";
      }
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (otp.length !== 4) {
      showToast("Please enter the 4-digit code", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify', { phone, otp });
      const { token, user } = res.data;

      login(token, user);

      showToast("Welcome back!", "success");

      if (user.role === 'admin') {
         router.replace('/admin/dashboard' as any);
      } else if (user.role === 'owner') {
         router.replace('/(tabs)/dashboard' as any);
      } else {
         router.replace('/(tabs)/home' as any);
      }

    } catch (e: any) {
      console.log("Login Error", e);
      showToast(e.response?.data?.message || "Invalid OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.container, {backgroundColor: colors.background}]}>
      <FadeInView>
        <Text style={[styles.title, {color: colors.tint}]}>HairOne</Text>
        <Text style={[styles.sub, {color: colors.textMuted}]}>Production Booking App</Text>

        {step === 1 ? (
          <View>
            <Text style={[styles.label, {color: colors.textMuted}]}>Phone Number</Text>
            <TextInput
              style={[styles.input, {backgroundColor: colors.card, color: colors.text, borderColor: colors.border}]}
              placeholder="9876543210"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
              maxLength={10}
              editable={!loading}
            />
            <TouchableOpacity style={[styles.btn, {backgroundColor: colors.tint}]} onPress={handleSendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#000000" /> : <Text style={styles.btnText}>Send OTP</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            <Text style={[styles.label, {color: colors.textMuted}]}>Enter OTP (Use 1234)</Text>
            <TextInput
              style={[styles.input, {backgroundColor: colors.card, color: colors.text, borderColor: colors.border, letterSpacing: 8, textAlign: 'center' }]}
              placeholder="XXXX"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={4}
              editable={!loading}
            />
            <TouchableOpacity style={[styles.btn, {backgroundColor: colors.tint}]} onPress={handleLogin} disabled={loading}>
              {loading ? <ActivityIndicator color="#000000" /> : <Text style={styles.btnText}>Login</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(1)} style={{marginTop: 20}} disabled={loading}>
              <Text style={{color: colors.tint, textAlign: 'center', fontWeight: 'bold'}}>Change Number</Text>
            </TouchableOpacity>
          </View>
        )}
      </FadeInView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', textAlign: 'center' },
  sub: { fontSize: 14, textAlign: 'center', marginBottom: 40 },
  label: { marginBottom: 8, fontSize: 12, fontWeight: 'bold' },
  input: { padding: 16, borderRadius: 12, marginBottom: 20, fontSize: 18, borderWidth: 1 },
  btn: { padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { fontWeight: 'bold', color: '#000000', fontSize: 16 },
});
