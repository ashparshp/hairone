import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useBooking } from '../../context/BookingContext';
import { ChevronLeft, Calendar, Clock } from 'lucide-react-native';
import { FadeInView } from '../../components/AnimatedViews';

export default function BookingScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { myBookings, fetchBookings } = useBooking();

  useEffect(() => {
    if (fetchBookings) fetchBookings();
  }, []);

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <FadeInView delay={index * 100}>
      <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
         <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
            <Text style={[styles.shopName, {color: colors.text}]}>{item.shopId?.name || 'Shop'}</Text>
            <Text style={[styles.status, {color: item.status === 'upcoming' ? colors.tint : colors.textMuted}]}>{item.status.toUpperCase()}</Text>
         </View>
         <View style={{flexDirection: 'row', gap: 12}}>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <Calendar size={14} color={colors.textMuted} />
                <Text style={{color: colors.textMuted}}>{item.date}</Text>
            </View>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <Clock size={14} color={colors.textMuted} />
                <Text style={{color: colors.textMuted}}>{item.startTime}</Text>
            </View>
         </View>
      </View>
    </FadeInView>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>My Bookings</Text>
      </View>

      <FlatList
        data={myBookings}
        renderItem={renderItem}
        keyExtractor={(item: any) => item._id || item.id}
        contentContainerStyle={{paddingBottom: 20}}
        ListEmptyComponent={
            <View style={styles.center}>
                <Text style={{color: colors.textMuted}}>No bookings found.</Text>
            </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1 },
  title: { fontSize: 24, fontWeight: 'bold' },
  center: { alignItems: 'center', marginTop: 50 },

  card: { padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  shopName: { fontWeight: 'bold', fontSize: 16 },
  status: { fontSize: 12, fontWeight: 'bold' }
});
