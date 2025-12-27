import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Switch, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { FadeInView } from '../../components/AnimatedViews';
import api from '../../services/api';
import { ChevronLeft, Trash2, Calendar, Plus } from 'lucide-react-native';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ManageBarberScreen() {
  const router = useRouter();
  const { barberId } = useLocalSearchParams(); 
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();

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

  // Availability Flags
  const [isAvailable, setIsAvailable] = useState(true); // Global
  const [isShopServiceAvailable, setIsShopServiceAvailable] = useState(true);
  const [isHomeServiceAvailable, setIsHomeServiceAvailable] = useState(true);

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
          setIsAvailable(barber.isAvailable !== false);
          setIsShopServiceAvailable(barber.isShopServiceAvailable !== false);
          setIsHomeServiceAvailable(barber.isHomeServiceAvailable !== false);

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
         showToast("Shop ID missing", "error");
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
        isAvailable,
        isShopServiceAvailable,
        isHomeServiceAvailable
      };
      
      if (barberId) {
        await api.put(`/shops/barbers/${barberId}`, payload);
        showToast("Barber schedule updated!", "success");
      } else {
        // @ts-ignore
        await api.post('/shops/barbers', { ...payload, shopId: user.myShopId });
        showToast("New barber added!", "success");
      }
      router.back();
    } catch (e) {
      showToast("Failed to save details.", "error");
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
      if (!newSpecialDate) return showToast("Date is required (YYYY-MM-DD)", "error");
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

  if (fetching) return <View style={[styles.centerLoading, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.tint} /></View>;

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={{flexDirection:'row', alignItems:'center', marginBottom: 20}}>
          <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card}]}>
            <ChevronLeft size={24} color={colors.text}/>
          </TouchableOpacity>
          <Text style={[styles.heading2, {color: colors.text, marginLeft: 16}]}>{barberId ? 'Edit Schedule' : 'Add Barber'}</Text>
      </View>

      <ScrollView contentContainerStyle={{paddingBottom: 40}} showsVerticalScrollIndicator={false}>
        {/* Name */}
        {!barberId && (
          <FadeInView>
          <View style={styles.section}>
            <Text style={[styles.label, {color: colors.text}]}>Barber Name</Text>
            <TextInput
                style={[styles.input, {backgroundColor: colors.card, color: colors.text, borderColor: colors.border}]}
                value={name}
                onChangeText={setName}
                placeholder="John Doe"
                placeholderTextColor={colors.textMuted}
            />
          </View>
          </FadeInView>
        )}

        {/* Standard Hours */}
        <FadeInView delay={100}>
        <View style={styles.section}>
          <Text style={[styles.label, {color: colors.text}]}>Default Working Hours</Text>
          <View style={{flexDirection: 'row', gap: 10}}>
            <View style={{flex:1}}>
                <Text style={[styles.subLabel, {color: colors.textMuted}]}>Start</Text>
                <TextInput
                    style={[styles.input, {backgroundColor: colors.card, color: colors.text, borderColor: colors.border}]}
                    value={startHour}
                    onChangeText={setStartHour}
                    placeholder="10:00"
                    placeholderTextColor={colors.textMuted}
                />
            </View>
            <View style={{flex:1}}>
                <Text style={[styles.subLabel, {color: colors.textMuted}]}>End</Text>
                <TextInput
                    style={[styles.input, {backgroundColor: colors.card, color: colors.text, borderColor: colors.border}]}
                    value={endHour}
                    onChangeText={setEndHour}
                    placeholder="20:00"
                    placeholderTextColor={colors.textMuted}
                />
            </View>
          </View>
        </View>
        </FadeInView>

        {/* Breaks */}
        <FadeInView delay={200}>
        <View style={styles.section}>
          <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 10}}>
             <Text style={[styles.label, {color: colors.text}]}>Daily Breaks</Text>
             <TouchableOpacity onPress={addBreak}><Text style={{color: colors.tint, fontWeight:'bold'}}>+ Add Break</Text></TouchableOpacity>
          </View>
          {breaks.map((br, index) => (
            <View key={index} style={styles.breakRow}>
               <TextInput style={[styles.inputSmall, {backgroundColor: colors.card, color: colors.text, borderColor: colors.border, flex: 2}]} value={br.title} onChangeText={(t) => updateBreak(index, 'title', t)} placeholder="Title" placeholderTextColor={colors.textMuted}/>
               <TextInput style={[styles.inputSmall, {backgroundColor: colors.card, color: colors.text, borderColor: colors.border}]} value={br.startTime} onChangeText={(t) => updateBreak(index, 'startTime', t)} placeholder="13:00" placeholderTextColor={colors.textMuted}/>
               <Text style={{color: colors.text}}>-</Text>
               <TextInput style={[styles.inputSmall, {backgroundColor: colors.card, color: colors.text, borderColor: colors.border}]} value={br.endTime} onChangeText={(t) => updateBreak(index, 'endTime', t)} placeholder="14:00" placeholderTextColor={colors.textMuted}/>
               <TouchableOpacity onPress={() => removeBreak(index)}><Trash2 size={20} color="#ef4444" /></TouchableOpacity>
            </View>
          ))}
        </View>
        </FadeInView>

        {/* Weekly Schedule */}
        <FadeInView delay={300}>
        <View style={styles.section}>
            <Text style={[styles.label, {color: colors.text}]}>Weekly Schedule</Text>
            <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
                {weeklySchedule.map((day, index) => (
                    <View key={day.day} style={[styles.weekRow, {borderBottomColor: theme === 'dark' ? '#1e293b' : '#e2e8f0'}]}>
                        <View style={{width: 100}}>
                            <Text style={{color: colors.text, fontWeight:'bold'}}>{day.day}</Text>
                        </View>
                        <Switch
                           value={day.isOpen}
                           onValueChange={(val) => updateWeeklyDay(index, 'isOpen', val)}
                           trackColor={{false: colors.border, true: colors.tint}}
                        />
                        {day.isOpen ? (
                             <View style={{flexDirection:'row', gap: 6, flex: 1, justifyContent:'flex-end'}}>
                                 <TextInput
                                   style={[styles.tinyInput, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                                   value={day.startHour}
                                   onChangeText={(t) => updateWeeklyDay(index, 'startHour', t)}
                                   placeholder={startHour}
                                   placeholderTextColor={colors.textMuted}
                                 />
                                 <Text style={{color: colors.textMuted}}>-</Text>
                                 <TextInput
                                   style={[styles.tinyInput, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                                   value={day.endHour}
                                   onChangeText={(t) => updateWeeklyDay(index, 'endHour', t)}
                                   placeholder={endHour}
                                   placeholderTextColor={colors.textMuted}
                                 />
                             </View>
                        ) : (
                            <Text style={{color: '#ef4444', marginLeft: 'auto', fontSize: 12}}>CLOSED</Text>
                        )}
                    </View>
                ))}
            </View>
        </View>
        </FadeInView>

        {/* Special Hours */}
        <FadeInView delay={400}>
        <View style={styles.section}>
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: 10}}>
                 <Text style={[styles.label, {color: colors.text}]}>Special Dates / Holidays</Text>
                 <TouchableOpacity onPress={() => setShowSpecialModal(true)}><Text style={{color: colors.tint, fontWeight:'bold'}}>+ Add Override</Text></TouchableOpacity>
            </View>

            {specialHours.length === 0 && <Text style={{color: colors.textMuted, fontStyle:'italic'}}>No special hours set.</Text>}

            {specialHours.map((sh, idx) => (
                <View key={idx} style={[styles.specialRow, {backgroundColor: colors.card, borderColor: colors.border}]}>
                    <View>
                        <View style={{flexDirection:'row', alignItems:'center', gap: 6}}>
                            <Calendar size={14} color={colors.tint} />
                            <Text style={{color: colors.text, fontWeight:'bold'}}>{sh.date}</Text>
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
        </FadeInView>

        {/* Availability Settings */}
        <FadeInView delay={500}>
        <View style={styles.section}>
            <Text style={[styles.label, {color: colors.text}]}>Availability Settings</Text>
            <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>

                <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, {color: colors.text}]}>Active (Global)</Text>
                    <Switch value={isAvailable} onValueChange={setIsAvailable} />
                </View>
                <View style={[styles.divider, {backgroundColor: colors.border}]} />

                <View style={styles.switchRow}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.switchLabel, {color: colors.text}]}>Shop Services</Text>
                        <Text style={{color: colors.textMuted, fontSize: 10}}>Can accept walk-ins/shop bookings</Text>
                    </View>
                    <Switch value={isShopServiceAvailable} onValueChange={setIsShopServiceAvailable} />
                </View>
                <View style={[styles.divider, {backgroundColor: colors.border}]} />

                <View style={styles.switchRow}>
                    <View style={{flex: 1}}>
                        <Text style={[styles.switchLabel, {color: colors.text}]}>Home Services</Text>
                        <Text style={{color: colors.textMuted, fontSize: 10}}>Can be booked for home visits</Text>
                    </View>
                    <Switch value={isHomeServiceAvailable} onValueChange={setIsHomeServiceAvailable} />
                </View>

            </View>
        </View>
        </FadeInView>

        <TouchableOpacity style={[styles.saveBtn, {backgroundColor: colors.tint}]} onPress={handleSave} disabled={loading}>
          {loading ? <ActivityIndicator color="#0f172a" /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      </ScrollView>

      {/* Special Date Modal */}
      <Modal visible={showSpecialModal} transparent animationType="slide">
          <View style={styles.modalBg}>
              <View style={[styles.modalCard, {backgroundColor: colors.card}]}>
                  <Text style={[styles.modalTitle, {color: colors.text}]}>Add Special Date</Text>

                  <Text style={[styles.label, {color: colors.text}]}>Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={[styles.input, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                    value={newSpecialDate}
                    onChangeText={setNewSpecialDate}
                    placeholder="2023-12-25"
                    placeholderTextColor={colors.textMuted}
                  />

                  <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginVertical: 16}}>
                      <Text style={[styles.label, {color: colors.text}]}>Is Open?</Text>
                      <Switch value={newSpecialOpen} onValueChange={setNewSpecialOpen} />
                  </View>

                  {newSpecialOpen && (
                      <View style={{flexDirection:'row', gap: 10}}>
                          <View style={{flex:1}}>
                             <Text style={[styles.subLabel, {color: colors.textMuted}]}>Start</Text>
                             <TextInput
                                style={[styles.input, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                                value={newSpecialStart}
                                onChangeText={setNewSpecialStart}
                                placeholder={startHour}
                                placeholderTextColor={colors.textMuted}
                             />
                          </View>
                          <View style={{flex:1}}>
                             <Text style={[styles.subLabel, {color: colors.textMuted}]}>End</Text>
                             <TextInput
                                style={[styles.input, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                                value={newSpecialEnd}
                                onChangeText={setNewSpecialEnd}
                                placeholder={endHour}
                                placeholderTextColor={colors.textMuted}
                             />
                          </View>
                      </View>
                  )}

                  <View style={{flexDirection:'row', gap: 10, marginTop: 20}}>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor:'#334155'}]} onPress={() => setShowSpecialModal(false)}>
                          <Text style={{color:'white'}}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.modalBtn, {backgroundColor: colors.tint}]} onPress={addSpecialDate}>
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
  container: { flex: 1, padding: 20, paddingTop: 60 },
  centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heading2: { fontSize: 20, fontWeight: 'bold' },
  section: { marginBottom: 24 },
  label: { fontWeight: 'bold', marginBottom: 8 },
  subLabel: { fontSize: 12, marginBottom: 4 },
  input: { padding: 16, borderRadius: 12, borderWidth: 1 },

  breakRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  inputSmall: { padding: 12, borderRadius: 8, borderWidth: 1, textAlign:'center' },

  card: { padding: 16, borderRadius: 12, borderWidth: 1 },
  weekRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderBottomWidth: 1, paddingBottom: 8 },
  tinyInput: { padding: 8, borderRadius: 6, borderWidth: 1, width: 60, textAlign: 'center', fontSize: 12 },

  specialRow: { flexDirection: 'row', justifyContent:'space-between', alignItems:'center', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1 },

  switchRow: { flexDirection: 'row', justifyContent:'space-between', alignItems:'center', paddingVertical: 4 },
  switchLabel: { fontWeight: '600' },
  divider: { height: 1, marginVertical: 12 },

  saveBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  saveText: { color: '#0f172a', fontWeight: 'bold', fontSize: 16 },

  // Modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent:'center', padding: 20 },
  modalCard: { padding: 20, borderRadius: 16 },
  modalTitle: { fontSize: 20, fontWeight:'bold', marginBottom: 20 },
  modalBtn: { flex: 1, padding: 16, borderRadius: 12, alignItems:'center' }
});
