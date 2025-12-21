import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FadeInView } from '../../components/AnimatedViews';
import api from '../../services/api';
import { Scissors, Phone, Lock, ChevronRight } from 'lucide-react-native';

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
      <FadeInView style={styles.content}>

        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: colors.card, shadowColor: colors.tint }]}>
            <Scissors size={40} color={colors.tint} />
          </View>
          <Text style={[styles.title, {color: colors.text}]}>HairOne</Text>
          <Text style={[styles.sub, {color: colors.textMuted}]}>Book Haircut in seconds</Text>
        </View>

        {step === 1 ? (
          <View style={styles.form}>
            <Text style={[styles.label, {color: colors.textMuted}]}>Mobile Number</Text>

            <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
              <Phone size={20} color={colors.textMuted} />
              <Text style={[styles.prefix, { color: colors.text }]}>+91</Text>
              <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
              <TextInput
                style={[styles.inputField, { color: colors.text }]}
                placeholder="9876543210"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={phone}
                onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ''))}
                maxLength={10}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, {backgroundColor: colors.tint, shadowColor: colors.tint}]}
              onPress={handleSendOtp}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#0f172a" />
              ) : (
                <View style={styles.btnContent}>
                  <Text style={styles.btnText}>Continue</Text>
                  <ChevronRight size={20} color="#0f172a" style={{marginLeft: 4}}/>
                </View>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
             <Text style={[styles.label, {color: colors.textMuted}]}>Verification Code</Text>
             <Text style={[styles.helperText, {color: colors.textMuted}]}>Sent to +91 {phone} (Use 1234)</Text>

            <View style={[styles.inputRow, { borderBottomColor: colors.border }]}>
              <Lock size={20} color={colors.textMuted} />
              <TextInput
                style={[styles.inputField, { color: colors.text, textAlign: 'center', letterSpacing: 8, fontSize: 24 }]}
                placeholder="••••"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                maxLength={4}
                editable={!loading}
                autoFocus
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, {backgroundColor: colors.tint, shadowColor: colors.tint}]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.btnText}>Login</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setStep(1)} style={styles.changeNumberLink} disabled={loading}>
              <Text style={{color: colors.tint, textAlign: 'center', fontWeight: '600'}}>Change Mobile Number</Text>
            </TouchableOpacity>
          </View>
        )}
      </FadeInView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 32 },

  header: { alignItems: 'center', marginBottom: 40 },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  title: { fontSize: 36, fontWeight: '800', textAlign: 'center', marginBottom: 8, letterSpacing: -1 },
  sub: { fontSize: 16, textAlign: 'center' },

  form: { width: '100%' },
  label: { marginBottom: 12, fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
  helperText: { marginBottom: 20, fontSize: 14 },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    marginBottom: 32,
    paddingBottom: 8,
    height: 50,
  },
  prefix: {
    fontSize: 20,
    fontWeight: '600',
    marginLeft: 12,
    marginRight: 12,
  },
  verticalDivider: {
    width: 1,
    height: 24,
    marginRight: 12,
  },
  inputField: {
    flex: 1,
    fontSize: 20,
    fontWeight: '500',
    padding: 0, // Reset default padding
  },

  btn: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  btnContent: { flexDirection: 'row', alignItems: 'center' },
  btnText: { fontWeight: 'bold', color: '#0f172a', fontSize: 18 },

  changeNumberLink: { marginTop: 24, padding: 8 },
});
