import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter, useFocusEffect } from 'expo-router';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { Plus, Clock, Settings, User, Calendar, Briefcase } from 'lucide-react-native';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [barbers, setBarbers] = useState([]);
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Reload data every time screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchShopData();
    }, [])
  );

  const fetchShopData = async () => {
    // @ts-ignore
    if (!user?.myShopId) {
      setLoading(false);
      return;
    }
    try {
      // @ts-ignore
      const res = await api.get(`/shops/${user.myShopId}`);
      setShop(res.data.shop);
      setBarbers(res.data.barbers);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const renderBarber = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={{flexDirection:'row', alignItems:'center'}}>
        <View style={styles.avatar}>
           <User size={20} color="white" />
        </View>
        <View style={{flex:1}}>
           <Text style={styles.name}>{item.name}</Text>
           <View style={{flexDirection:'row', alignItems:'center', marginTop:4}}>
             <Clock size={12} color={Colors.textMuted} />
             <Text style={styles.time}>{item.startHour} - {item.endHour}</Text>
           </View>
        </View>
        <TouchableOpacity 
          style={styles.editBtn} 
          onPress={() => router.push({
            pathname: '/salon/manage-barber',
            params: { barberId: item._id }
          } as any)}
        >
          <Settings size={16} color="white" />
          <Text style={styles.editText}>Manage</Text>
        </TouchableOpacity>
      </View>
      
      {item.breaks && item.breaks.length > 0 && (
        <View style={styles.breakBadge}>
           <Text style={styles.breakText}>Break: {item.breaks[0].startTime} - {item.breaks[0].endTime}</Text>
        </View>
      )}
    </View>
  );

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.primary}/></View>;

  // --- NEW LOGIC: If no shop found, show "Create Shop" button ---
  if (!shop) return (
    <View style={styles.center}>
      <Briefcase size={64} color={Colors.primary} style={{marginBottom: 20}} />
      <Text style={{color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 10}}>Welcome Partner!</Text>
      <Text style={{color: Colors.textMuted, textAlign: 'center', marginBottom: 30, paddingHorizontal: 40}}>
          You are approved. Set up your shop profile to start accepting bookings.
      </Text>
      
      {/* This button links to the Create Shop screen */}
      <TouchableOpacity 
          style={styles.primaryBtn} 
          onPress={() => router.push('/salon/create-shop' as any)}
      >
         <Text style={styles.btnText}>Create Shop Now</Text>
      </TouchableOpacity>
    </View>
  );

  // --- EXISTING LOGIC: If shop exists, show Dashboard ---
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
            <Text style={styles.title}>{shop.name}</Text>
            <Text style={styles.sub}>Owner Dashboard</Text>
        </View>
        <View style={{flexDirection:'row', gap: 10}}>
          <TouchableOpacity style={[styles.addBtn, {backgroundColor: '#334155'}]} onPress={() => router.push('/salon/shop-schedule' as any)}>
             <Calendar size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/salon/manage-barber' as any)}>
             <Plus size={24} color="#0f172a" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>My Team ({barbers.length})</Text>
      
      <FlatList 
        data={barbers}
        renderItem={renderBarber}
        keyExtractor={(item: any) => item._id}
        contentContainerStyle={{paddingBottom: 100}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  sub: { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  addBtn: { backgroundColor: Colors.primary, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: Colors.textMuted, marginBottom: 16, textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 },
  card: { backgroundColor: Colors.card, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  name: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  time: { color: Colors.textMuted, fontSize: 12, marginLeft: 6 },
  editBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#334155', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 6 },
  editText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  breakBadge: { marginTop: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  breakText: { color: '#ef4444', fontSize: 10, fontWeight: 'bold' },
  primaryBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, marginTop: 20, paddingHorizontal: 30 },
  btnText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 }
});