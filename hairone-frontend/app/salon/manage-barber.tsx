import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { ChevronLeft, Trash2 } from 'lucide-react-native';

export default function ManageBarberScreen() {
  const router = useRouter();
  const { barberId } = useLocalSearchParams(); 
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [startHour, setStartHour] = useState('10:00');
  const [endHour, setEndHour] = useState('20:00');
  const [breaks, setBreaks] = useState([{ startTime: '13:00', endTime: '14:00', title: 'Lunch' }]);
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(!!barberId);

  useEffect(() => {
    // @ts-ignore
    if (barberId && user?.myShopId) {
      // @ts-ignore
      api.get(`/shops/${user.myShopId}`).then(res => {
        const barber = res.data.barbers.find((b: any) => b._id === barberId);
        if (barber) {
          setName(barber.name);
          setStartHour(barber.startHour);
          setEndHour(barber.endHour);
          setBreaks(barber.breaks || []);
        }
        setFetching(false);
      });
    } else {
        setFetching(false);
    }
  }, [barberId, user?.myShopId]);

  const handleSave = async () => {
    setLoading(true);
    try {
      // @ts-ignore
      if (!user?.myShopId) {
         Alert.alert("Error", "Shop ID missing");
         return;
      }
      
      if (barberId) {
        // UPDATE Existing
        await api.put(`/shops/barbers/${barberId}`, { startHour, endHour, breaks, isAvailable: true });
        Alert.alert("Updated", "Barber schedule updated!");
      } else {
        // CREATE New
        await api.post('/shops/barbers', {
          // @ts-ignore
          shopId: user.myShopId,
          name,
          startHour,
          endHour,
          breaks
        });
        Alert.alert("Created", "New barber added!");
      }
      router.back();
    } catch (e) {
      Alert.alert("Error", "Failed to save details.");
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const updateBreak = (index: number, field: string, value: string) => {
    const newBreaks = [...breaks];
    // @ts-ignore
    newBreaks[index][field] = value;
    setBreaks(newBreaks);
  };

  const addBreak = () => {
    setBreaks([...breaks, { startTime: '15:00', endTime: '15:30', title: 'Break' }]);
  };

  const removeBreak = (index: number) => {
    setBreaks(breaks.filter((_, i) => i !== index));
  };

  if (fetching) return <ActivityIndicator style={{marginTop: 100}} color={Colors.primary} />;

  return (
    <View style={styles.container}>
      <View style={{flexDirection:'row', alignItems:'center', marginBottom: 20}}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><ChevronLeft size={24} color="white"/></TouchableOpacity>
          <Text style={[styles.heading2, {marginLeft: 16}]}>{barberId ? 'Edit Schedule' : 'Add Barber'}</Text>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 40}}>
        {/* Name (Only editable if adding new) */}
        {!barberId && (
          <View style={styles.section}>
            <Text style={styles.label}>Barber Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor="#64748b" />
          </View>
        )}

        {/* Working Hours */}
        <View style={styles.section}>
          <Text style={styles.label}>Working Hours (24h Format)</Text>
          <View style={{flexDirection: 'row', gap: 10}}>
            <View style={{flex:1}}>
                <Text style={styles.subLabel}>Start</Text>
                <TextInput style={styles.input} value={startHour} onChangeText={setStartHour} placeholder="09:00" placeholderTextColor="#64748b" />
            </View>
            <View style={{flex:1}}>
                <Text style={styles.subLabel}>End</Text>
                <TextInput style={styles.input} value={endHour} onChangeText={setEndHour} placeholder="20:00" placeholderTextColor="#64748b" />
            </View>
          </View>
        </View>

        {/* Breaks Management */}
        <View style={styles.section}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 10}}>
             <Text style={styles.label}>Daily Breaks</Text>
             <TouchableOpacity onPress={addBreak}><Text style={{color: Colors.primary, fontWeight:'bold'}}>+ Add Break</Text></TouchableOpacity>
          </View>

          {breaks.map((br, index) => (
            <View key={index} style={styles.breakRow}>
               <TextInput 
                 style={[styles.inputSmall, {flex: 2}]} 
                 value={br.title} 
                 onChangeText={(t) => updateBreak(index, 'title', t)} 
                 placeholder="Title" placeholderTextColor="#64748b"
               />
               <TextInput 
                 style={styles.inputSmall} 
                 value={br.startTime} 
                 onChangeText={(t) => updateBreak(index, 'startTime', t)} 
                 placeholder="13:00" placeholderTextColor="#64748b"
               />
               <Text style={{color: 'white'}}>-</Text>
               <TextInput 
                 style={styles.inputSmall} 
                 value={br.endTime} 
                 onChangeText={(t) => updateBreak(index, 'endTime', t)} 
                 placeholder="14:00" placeholderTextColor="#64748b"
               />
               <TouchableOpacity onPress={() => removeBreak(index)}>
                  <Trash2 size={20} color="#ef4444" />
               </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center' },
  heading2: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  section: { marginBottom: 24 },
  label: { color: 'white', fontWeight: 'bold', marginBottom: 8 },
  subLabel: { color: Colors.textMuted, fontSize: 12, marginBottom: 4 },
  input: { backgroundColor: Colors.card, color: 'white', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  inputSmall: { flex: 1, backgroundColor: Colors.card, color: 'white', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, textAlign:'center' },
  saveBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 }
});