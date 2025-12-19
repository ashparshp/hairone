import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router'; // <--- 1. Import Router
import api from '../../services/api';
import Colors from '../../constants/Colors';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter(); // <--- 2. Initialize Router
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      Alert.alert("Invalid Phone", "Please enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      console.log("Sending OTP to:", phone);
      await api.post('/auth/otp', { phone });
      setStep(2);
      Alert.alert("Success", "OTP Sent! (Use 1234)");
    } catch (e: any) {
      console.log("OTP Error:", e);
      let msg = "Something went wrong.";
      if (e.response) {
        msg = e.response.data.message || "Server Error";
      } else if (e.request) {
        msg = "Network Error. Ensure Backend is running and IP is correct.";
      }
      Alert.alert("Error sending OTP", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (otp.length !== 4) {
      Alert.alert("Invalid OTP", "Please enter the 4-digit code.");
      return;
    }

    setLoading(true);
    try {
      // 1. Call API
      const res = await api.post('/auth/verify', { phone, otp });
      const { token, user } = res.data;

      // 2. Save Login Session
      login(token, user);

      // 3. FORCE NAVIGATION TO HOME <--- The Fix
      if (user.role === 'admin') {
         router.replace('/admin/dashboard' as any);
      } else {
         router.replace('/(tabs)/home' as any);
      }

    } catch (e: any) {
      console.log("Login Error", e);
      Alert.alert("Login Failed", e.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Text style={styles.title}>HairOne</Text>
      <Text style={styles.sub}>Production Booking App</Text>

      {step === 1 ? (
        <>
          <Text style={styles.label}>Phone Number</Text>
          <TextInput 
            style={styles.input} 
            placeholder="9876543210" 
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
            value={phone}
            onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))} 
            maxLength={10}
            editable={!loading}
          />
          <TouchableOpacity style={styles.btn} onPress={handleSendOtp} disabled={loading}>
            {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.btnText}>Send OTP</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.label}>Enter OTP (Use 1234)</Text>
          <TextInput 
            style={[styles.input, { letterSpacing: 8, textAlign: 'center' }]} 
            placeholder="XXXX" 
            placeholderTextColor="#64748b"
            keyboardType="number-pad"
            value={otp}
            onChangeText={setOtp}
            maxLength={4}
            editable={!loading}
          />
          <TouchableOpacity style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.btnText}>Login</Text>}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => setStep(1)} style={{marginTop: 20}} disabled={loading}>
            <Text style={{color: Colors.primary, textAlign: 'center'}}>Change Number</Text>
          </TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', padding: 24 },
  title: { fontSize: 32, fontWeight: 'bold', color: 'white', textAlign: 'center' },
  sub: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginBottom: 40 },
  label: { color: '#cbd5e1', marginBottom: 8, fontSize: 12, fontWeight: 'bold' },
  input: { backgroundColor: Colors.card, color: 'white', padding: 16, borderRadius: 12, marginBottom: 20, fontSize: 18 },
  btn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { fontWeight: 'bold', color: '#0f172a', fontSize: 16 },
});