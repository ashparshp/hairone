import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Colors from '../../constants/Colors';
import { ChevronLeft, Trash2, Calendar, Plus } from 'lucide-react-native';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ManageBarberScreen() {
  const router = useRouter();
  const { barberId } = useLocalSearchParams(); 
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [startHour, setStartHour] = useState('10:00');
  const [endHour, setEndHour] = useState('20:00');
  const [breaks, setBreaks] = useState([{ startTime: '13:00', endTime: '14:00', title: 'Lunch' }]);
  
  // New State
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>(
    DAYS.map(day => ({ day, isOpen: true, startHour: '', endHour: '', breaks: [] }))
  );
  const [specialHours, setSpecialHours] = useState<any[]>([]);

  // Modals
  const [showSpecialModal, setShowSpecialModal] = useState(false);
  const [newSpecialDate, setNewSpecialDate] = useState('');
  const [newSpecialStart, setNewSpecialStart] = useState('');
  const [newSpecialEnd, setNewSpecialEnd] = useState('');
  const [newSpecialOpen, setNewSpecialOpen] = useState(true);

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

          // Hydrate Weekly
          if (barber.weeklySchedule && barber.weeklySchedule.length > 0) {
            const merged = DAYS.map(day => {
                const found = barber.weeklySchedule.find((w: any) => w.day === day);
                return found || { day, isOpen: true, startHour: '', endHour: '', breaks: [] };
            });
            setWeeklySchedule(merged);
          }

          setSpecialHours(barber.specialHours || []);
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

      // Ensure weekly schedule has defaults if empty
      const sanitizedWeekly = weeklySchedule.map(w => ({
          ...w,
          startHour: w.startHour || startHour,
          endHour: w.endHour || endHour
      }));

      const payload = {
        name,
        startHour,
        endHour,
        breaks,
        weeklySchedule: sanitizedWeekly,
        specialHours,
        isAvailable: true
      };
      
      if (barberId) {
        await api.put(`/shops/barbers/${barberId}`, payload);
        Alert.alert("Updated", "Barber schedule updated!");
      } else {
        // @ts-ignore
        await api.post('/shops/barbers', { ...payload, shopId: user.myShopId });
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

  // Weekly Schedule Logic
  const updateWeeklyDay = (index: number, field: string, value: any) => {
     const updated = [...weeklySchedule];
     updated[index] = { ...updated[index], [field]: value };
     setWeeklySchedule(updated);
  };

  // Special Hours Logic
  const addSpecialDate = () => {
      if (!newSpecialDate) return Alert.alert("Required", "Date is required (YYYY-MM-DD)");
      setSpecialHours([...specialHours, {
          date: newSpecialDate,
          isOpen: newSpecialOpen,
          startHour: newSpecialStart || startHour,
          endHour: newSpecialEnd || endHour
      }]);
      setShowSpecialModal(false);
      setNewSpecialDate('');
  };

  const removeSpecialDate = (idx: number) => {
      setSpecialHours(specialHours.filter((_, i) => i !== idx));
  };

  if (fetching) return <ActivityIndicator style={{marginTop: 100}} color={Colors.primary} />;

  return (
    <View style={styles.container}>
      <View style={{flexDirection:'row', alignItems:'center', marginBottom: 20}}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}><ChevronLeft size={24} color="white"/></TouchableOpacity>
          <Text style={[styles.heading2, {marginLeft: 16}]}>{barberId ? 'Edit Schedule' : 'Add Barber'}</Text>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 40}} showsVerticalScrollIndicator={false}>
        {/* Name */}
        {!barberId && (
          <View style={styles.section}>
            <Text style={styles.label}>Barber Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="John Doe" placeholderTextColor="#64748b" />
          </View>
        )}

        {/* Standard Hours */}
        <View style={styles.section}>
          <Text style={styles.label}>Default Working Hours</Text>
          <View style={{flexDirection: 'row', gap: 10}}>
            <View style={{flex:1}}>
                <Text style={styles.subLabel}>Start</Text>
                <TextInput style={styles.input} value={startHour} onChangeText={setStartHour} placeholder="10:00" placeholderTextColor="#64748b" />
            </View>
            <View style={{flex:1}}>
                <Text style={styles.subLabel}>End</Text>
                <TextInput style={styles.input} value={endHour} onChangeText={setEndHour} placeholder="20:00" placeholderTextColor="#64748b" />
            </View>
          </View>
        </View>

        {/* Breaks */}
        <View style={styles.section}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 10}}>
             <Text style={styles.label}>Daily Breaks</Text>
             <TouchableOpacity onPress={addBreak}><Text style={{color: Colors.primary, fontWeight:'bold'}}>+ Add Break</Text></TouchableOpacity>
          </View>
          {breaks.map((br, index) => (
            <View key={index} style={styles.breakRow}>
               <TextInput style={[styles.inputSmall, {flex: 2}]} value={br.title} onChangeText={(t) => updateBreak(index, 'title', t)} placeholder="Title" placeholderTextColor="#64748b"/>
               <TextInput style={styles.inputSmall} value={br.startTime} onChangeText={(t) => updateBreak(index, 'startTime', t)} placeholder="13:00" placeholderTextColor="#64748b"/>
               <Text style={{color: 'white'}}>-</Text>
               <TextInput style={styles.inputSmall} value={br.endTime} onChangeText={(t) => updateBreak(index, 'endTime', t)} placeholder="14:00" placeholderTextColor="#64748b"/>
               <TouchableOpacity onPress={() => removeBreak(index)}><Trash2 size={20} color="#ef4444" /></TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Weekly Schedule */}
        <View style={styles.section}>
            <Text style={styles.label}>Weekly Schedule</Text>
            <View style={styles.card}>
                {weeklySchedule.map((day, index) => (
                    <View key={day.day} style={styles.weekRow}>
                        <View style={{width: 100}}>
                            <Text style={{color: 'white', fontWeight:'bold'}}>{day.day}</Text>
                        </View>
                        <Switch
                           value={day.isOpen}
                           onValueChange={(val) => updateWeeklyDay(index, 'isOpen', val)}
                           trackColor={{false: '#334155', true: Colors.primary}}
                        />
                        {day.isOpen ? (
                             <View style={{flexDirection:'row', gap: 6, flex: 1, justifyContent:'flex-end'}}>
                                 <TextInput
                                   style={styles.tinyInput}
                                   value={day.startHour}
                                   onChangeText={(t) => updateWeeklyDay(index, 'startHour', t)}
                                   placeholder={startHour}
                                   placeholderTextColor="#475569"
                                 />
                                 <Text style={{color:'#64748b'}}>-</Text>
                                 <TextInput
                                   style={styles.tinyInput}
                                   value={day.endHour}
                                   onChangeText={(t) => updateWeeklyDay(index, 'endHour', t)}
                                   placeholder={endHour}
                                   placeholderTextColor="#475569"
                                 />
                             </View>
                        ) : (
                            <Text style={{color: '#ef4444', marginLeft: 'auto', fontSize: 12}}>CLOSED</Text>
                        )}
                    </View>
                ))}
            </View>
        </View>

        {/* Special Hours */}
        <View style={styles.section}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 10}}>
                 <Text style={styles.label}>Special Dates / Holidays</Text>
                 <TouchableOpacity onPress={() => setShowSpecialModal(true)}><Text style={{color: Colors.primary, fontWeight:'bold'}}>+ Add Override</Text></TouchableOpacity>
            </View>

            {specialHours.length === 0 && <Text style={{color: Colors.textMuted, fontStyle:'italic'}}>No special hours set.</Text>}

            {specialHours.map((sh, idx) => (
                <View key={idx} style={styles.specialRow}>
                    <View>
                        <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                            <Calendar size={14} color={Colors.primary} />
                            <Text style={{color:'white', fontWeight:'bold'}}>{sh.date}</Text>
                        </View>
                        <Text style={{color: sh.isOpen ? '#10b981' : '#ef4444', fontSize: 12}}>
                            {sh.isOpen ? `${sh.startHour} - ${sh.endHour}` : 'CLOSED'}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={() => removeSpecialDate(idx)}>
                        <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                </View>
            ))}
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Special Date Modal */}
      <Modal visible={showSpecialModal} transparent animationType="slide">
          <View style={styles.modalBg}>
              <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Add Special Date</Text>

                  <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                  <TextInput style={styles.input} value={newSpecialDate} onChangeText={setNewSpecialDate} placeholder="2023-12-25" placeholderTextColor="#64748b"/>

                  <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginVertical: 16}}>
                      <Text style={styles.label}>Is Open?</Text>
                      <Switch value={newSpecialOpen} onValueChange={setNewSpecialOpen} />
                  </View>

                  {newSpecialOpen && (
                      <View style={{flexDirection:'row', gap: 10}}>
                          <View style={{flex:1}}>
                             <Text style={styles.subLabel}>Start</Text>
                             <TextInput style={styles.input} value={newSpecialStart} onChangeText={setNewSpecialStart} placeholder={startHour} placeholderTextColor="#64748b"/>
                          </View>
                          <View style={{flex:1}}>
                             <Text style={styles.subLabel}>End</Text>
                             <TextInput style={styles.input} value={newSpecialEnd} onChangeText={setNewSpecialEnd} placeholder={endHour} placeholderTextColor="#64748b"/>
                          </View>
                      </View>
                  )}

                  <View style={{flexDirection:'row', gap: 10, marginTop: 20}}>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor:'#334155'}]} onPress={() => setShowSpecialModal(false)}>
                          <Text style={{color:'white'}}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor:Colors.primary}]} onPress={addSpecialDate}>
                          <Text style={{color:'#0f172a', fontWeight:'bold'}}>Add</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>

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

  card: { backgroundColor: Colors.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  weekRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b', paddingBottom: 8 },
  tinyInput: { backgroundColor: '#0f172a', color: 'white', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#334155', width: 60, textAlign: 'center', fontSize: 12 },

  specialRow: { flexDirection: 'row', justifyContent:'space-between', alignItems:'center', backgroundColor: Colors.card, padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },

  saveBtn: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent:'center', padding: 20 },
  modalCard: { backgroundColor: Colors.card, padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 20, fontWeight:'bold', color:'white', marginBottom: 20 },
  modalBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems:'center' }
});