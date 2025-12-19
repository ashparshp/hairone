import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, CreditCard, Banknote, Smartphone, Check } from 'lucide-react-native';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const { selectedShop, selectedServices, clearBooking } = useBooking();
  const { user } = useAuth();
  
  const [paymentMethod, setPaymentMethod] = useState('Pay at Venue');
  const [loading, setLoading] = useState(false);

  // Calculate totals
  const totalPrice = selectedServices.reduce((acc, s) => acc + s.price, 0);
  const totalDuration = selectedServices.reduce((acc, s) => acc + s.duration, 0);

  const handleFinalize = async () => {
    if (!user || !selectedShop) return;
    setLoading(true);

    try {
      // Backend Request
      const payload = {
        userId: user._id,
        shopId: selectedShop._id,
        barberId: params.barberId, // Passed from Annie logic
        serviceNames: selectedServices.map(s => s.name),
        totalPrice,
        totalDuration,
        date: params.date,      // Passed from Annie logic
        startTime: params.startTime // Passed from Annie logic
      };

      await api.post('/bookings', payload);
      
      clearBooking(); // Reset context
      router.replace('/salon/success');
      
    } catch (error: any) {
      console.log(error.response?.data);
      Alert.alert("Booking Failed", "Slot might have been taken. Please try again.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const methods = [
    { id: 'Pay at Venue', icon: Banknote, desc: 'Cash or QR at the counter' },
    { id: 'UPI', icon: Smartphone, desc: 'GooglePay, PhonePe, Paytm' },
    { id: 'Credit Card', icon: CreditCard, desc: 'Visa, Mastercard' },
  ];

  return (
    <View style={styles.container}>
      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 24}}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><ChevronLeft size={24} color="white"/></TouchableOpacity>
          <Text style={[styles.heading2, {marginLeft: 16}]}>Confirm & Pay</Text>
      </View>

      <View style={styles.summaryBox}>
         <Text style={{color: Colors.textMuted, fontSize: 12}}>APPOINTMENT</Text>
         <Text style={{color: 'white', fontSize: 18, fontWeight: 'bold', marginVertical: 4}}>{params.startTime}</Text>
         <Text style={{color: Colors.primary}}>@ {selectedShop?.name}</Text>
      </View>

      <ScrollView>
        {methods.map((m) => (
          <TouchableOpacity key={m.id} style={[styles.methodCard, paymentMethod === m.id && styles.selectedCard]} onPress={() => setPaymentMethod(m.id)}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View style={[styles.iconBox, paymentMethod === m.id && {backgroundColor: Colors.primary}]}>
                <m.icon size={20} color={paymentMethod === m.id ? '#020617' : '#94a3b8'} />
              </View>
              <View>
                <Text style={[styles.methodTitle, paymentMethod === m.id && {color: Colors.primary}]}>{m.id}</Text>
                <Text style={{color: Colors.textMuted, fontSize: 12}}>{m.desc}</Text>
              </View>
            </View>
            {paymentMethod === m.id && <Check size={20} color={Colors.primary} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
         <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16}}>
            <Text style={{color: 'white', fontWeight: 'bold'}}>Total Amount</Text>
            <Text style={{color: Colors.primary, fontSize: 18, fontWeight: 'bold'}}>₹{totalPrice}</Text>
         </View>
         <TouchableOpacity onPress={handleFinalize} style={styles.btn} disabled={loading}>
            {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.btnText}>Confirm Booking</Text>}
         </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  heading2: { fontSize: 18, fontWeight: 'bold', color: 'white' },
  summaryBox: { padding: 16, backgroundColor: '#020617', borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#1e293b' },
  methodCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: Colors.card, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  selectedCard: { borderColor: Colors.primary, backgroundColor: 'rgba(245, 158, 11, 0.1)' },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1e293b', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  methodTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  footer: { marginTop: 'auto' },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, height: 50, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#020617', fontSize: 16, fontWeight: 'bold' },
});