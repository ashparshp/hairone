import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { Booking } from '../../types';

export default function MyBookingsScreen() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBookings = async () => {
    if (!user) return;
    try {
      const res = await api.get(`/bookings/user/${user._id}`);
      setBookings(res.data);
    } catch (e) {
      console.log('Error fetching bookings', e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={{flexDirection:'row', justifyContent:'space-between'}}>
         <Text style={styles.barberName}>{item.barberId?.name || 'Unknown Barber'}</Text>
         <Text style={[styles.status, { color: item.status === 'upcoming' ? Colors.primary : Colors.textMuted }]}>
            {item.status.toUpperCase()}
         </Text>
      </View>
      <Text style={{color: 'white', fontSize: 12}}>Service: {item.serviceNames.join(', ')}</Text>
      <View style={styles.divider} />
      <View style={{flexDirection:'row', justifyContent:'space-between'}}>
          <Text style={{color: 'white', fontWeight:'bold'}}>{item.date}</Text>
          <Text style={{color: 'white', fontWeight:'bold'}}>{item.startTime}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>My Bookings</Text>
      <FlatList 
        data={bookings}
        renderItem={renderItem}
        keyExtractor={item => item._id}
        contentContainerStyle={{padding: 20}}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchBookings();}} tintColor={Colors.primary} />}
        ListEmptyComponent={<Text style={{color: Colors.textMuted, textAlign:'center', marginTop: 50}}>No bookings yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 60 },
  header: { fontSize: 24, fontWeight: 'bold', color: 'white', paddingHorizontal: 20, marginBottom: 10 },
  card: { backgroundColor: Colors.card, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  barberName: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  status: { fontSize: 12, fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 12 }
});