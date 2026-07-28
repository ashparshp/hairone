import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { FadeInView } from '../../components/AnimatedViews';
import { CheckCircle, Home } from 'lucide-react-native';

export default function BookingSuccessScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <FadeInView>
        <View style={styles.content}>
            <View style={[styles.iconBox, {backgroundColor: 'rgba(16, 185, 129, 0.1)'}]}>
               <CheckCircle size={80} color="#10b981" />
            </View>

            <Text style={[styles.title, {color: colors.text}]}>Booking Confirmed!</Text>
            <Text style={[styles.sub, {color: colors.textMuted}]}>
               Your appointment has been successfully scheduled. You can view the details in your bookings tab.
            </Text>

            <TouchableOpacity
              style={[styles.btn, {backgroundColor: colors.tint}]}
              onPress={() => router.replace('/(tabs)/bookings' as any)}
            >
                <Text style={styles.btnText}>View Booking</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnOutline, {borderColor: colors.border}]}
              onPress={() => router.replace('/(tabs)/home' as any)}
            >
                <Text style={[styles.btnOutlineText, {color: colors.text}]}>Back to Home</Text>
            </TouchableOpacity>
        </View>
      </FadeInView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  content: { alignItems: 'center', width: '100%' },
  iconBox: { marginBottom: 30, borderRadius: 50, padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 10, textAlign: 'center' },
  sub: { fontSize: 16, textAlign: 'center', marginBottom: 40, paddingHorizontal: 20, lineHeight: 24 },

  btn: { width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', marginBottom: 16 },
  btnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },

  btnOutline: { width: '100%', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  btnOutlineText: { fontWeight: 'bold', fontSize: 16 }
});
