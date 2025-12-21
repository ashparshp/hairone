import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, CreditCard, Banknote, Smartphone, Check } from 'lucide-react-native';
import { useBooking } from '../../context/BookingContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const { selectedShop, selectedServices, clearBooking } = useBooking();
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  
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
      router.replace('/salon/success' as any);
      
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
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 24}}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card}]}>
              <ChevronLeft size={24} color={colors.text}/>
          </TouchableOpacity>
          <Text style={[styles.heading2, {marginLeft: 16, color: colors.text}]}>Confirm & Pay</Text>
      </View>

      <View style={[styles.summaryBox, {backgroundColor: colors.card, borderColor: colors.border}]}>
         <Text style={{color: colors.textMuted, fontSize: 12}}>APPOINTMENT</Text>
         <Text style={{color: colors.text, fontSize: 18, fontWeight: 'bold', marginVertical: 4}}>{params.startTime}</Text>
         <Text style={{color: colors.tint}}>@ {selectedShop?.name}</Text>
      </View>

      <ScrollView>
        {methods.map((m) => (
          <TouchableOpacity key={m.id} style={[styles.methodCard, {backgroundColor: colors.card, borderColor: colors.border}, paymentMethod === m.id && {borderColor: colors.tint, backgroundColor: theme === 'dark' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.1)'}]} onPress={() => setPaymentMethod(m.id)}>
            <View style={{flexDirection: 'row', alignItems: 'center'}}>
              <View style={[styles.iconBox, {backgroundColor: theme === 'dark' ? '#1e293b' : '#f1f5f9'}, paymentMethod === m.id && {backgroundColor: colors.tint}]}>
                <m.icon size={20} color={paymentMethod === m.id ? '#020617' : colors.textMuted} />
              </View>
              <View>
                <Text style={[styles.methodTitle, {color: colors.text}, paymentMethod === m.id && {color: colors.tint}]}>{m.id}</Text>
                <Text style={{color: colors.textMuted, fontSize: 12}}>{m.desc}</Text>
              </View>
            </View>
            {paymentMethod === m.id && <Check size={20} color={colors.tint} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.footer}>
         <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16}}>
            <Text style={{color: colors.text, fontWeight: 'bold'}}>Total Amount</Text>
            <Text style={{color: colors.tint, fontSize: 18, fontWeight: 'bold'}}>₹{totalPrice}</Text>
         </View>
         <TouchableOpacity onPress={handleFinalize} style={[styles.btn, {backgroundColor: colors.tint}]} disabled={loading}>
            {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.btnText}>Confirm Booking</Text>}
         </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heading2: { fontSize: 18, fontWeight: 'bold' },
  summaryBox: { padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1 },
  methodCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  iconBox: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  methodTitle: { fontWeight: 'bold', fontSize: 16 },
  footer: { marginTop: 'auto' },
  btn: { borderRadius: 12, height: 50, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#020617', fontSize: 16, fontWeight: 'bold' },
});
