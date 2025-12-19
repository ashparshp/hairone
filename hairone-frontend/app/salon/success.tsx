import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle } from 'lucide-react-native';
import Colors from '../../constants/Colors';

export default function SuccessScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
        <CheckCircle size={80} color={Colors.success} />
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.sub}>You can view details in your bookings tab.</Text>
        
        <TouchableOpacity onPress={() => router.replace('/(tabs)/bookings')} style={styles.btn}>
            <Text style={styles.btnText}>Go to My Bookings</Text>
        </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginTop: 20 },
  sub: { color: Colors.textMuted, textAlign: 'center', marginTop: 8, marginBottom: 40 },
  btn: { backgroundColor: Colors.card, paddingHorizontal: 32, paddingVertical: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  btnText: { color: 'white', fontWeight: 'bold' }
});