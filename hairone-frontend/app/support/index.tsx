import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';
import { ChevronLeft, Plus, MessageSquare, Clock } from 'lucide-react-native';
import { FadeInView } from '../../components/AnimatedViews';

export default function SupportListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);

  // Create Form
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const res = await api.get('/support/my');
      setTickets(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!subject.trim() || !message.trim()) return showToast("Please fill all fields", "error");
    setSubmitting(true);
    try {
      await api.post('/support', { subject, message });
      setCreateModal(false);
      setSubject(''); setMessage('');
      fetchTickets();
      showToast("Ticket Created", "success");
    } catch (e) {
      showToast("Failed to create ticket", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => (
    <FadeInView delay={index * 100}>
      <TouchableOpacity
        style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}
        onPress={() => router.push(`/support/${item._id}` as any)}
      >
         <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}>
             <Text style={[styles.subject, {color: colors.text}]}>{item.subject}</Text>
             <Text style={[styles.status, {color: item.status === 'open' ? '#10b981' : colors.textMuted}]}>{item.status.toUpperCase()}</Text>
         </View>
         <Text style={{color: colors.textMuted, fontSize: 12}} numberOfLines={1}>{item.messages[item.messages.length - 1]?.text}</Text>
         <View style={{marginTop: 8, flexDirection:'row', alignItems:'center', gap: 4}}>
             <Clock size={12} color={colors.textMuted} />
             <Text style={{color: colors.textMuted, fontSize: 10}}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
         </View>
      </TouchableOpacity>
    </FadeInView>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Help & Support</Text>
         <TouchableOpacity onPress={() => setCreateModal(true)} style={[styles.addBtn, {backgroundColor: colors.tint}]}>
             <Plus size={20} color="#0f172a" />
         </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.tint} style={{marginTop: 50}} />
      ) : (
        <FlatList
          data={tickets}
          renderItem={renderItem}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={{padding: 20}}
          ListEmptyComponent={
            <View style={styles.empty}>
               <MessageSquare size={48} color={colors.textMuted} />
               <Text style={{color: colors.textMuted, marginTop: 16}}>No tickets yet.</Text>
            </View>
          }
        />
      )}

      {/* Create Modal */}
      <Modal visible={createModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, {backgroundColor: colors.card}]}>
                  <Text style={[styles.modalTitle, {color: colors.text}]}>New Ticket</Text>

                  <Text style={[styles.label, {color: colors.textMuted}]}>Subject</Text>
                  <TextInput
                    style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
                    placeholder="Issue with booking..."
                    placeholderTextColor={colors.textMuted}
                    value={subject}
                    onChangeText={setSubject}
                  />

                  <Text style={[styles.label, {color: colors.textMuted}]}>Message</Text>
                  <TextInput
                    style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border, height: 100, textAlignVertical:'top'}]}
                    placeholder="Describe your issue..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    value={message}
                    onChangeText={setMessage}
                  />

                  <View style={{flexDirection:'row', gap: 10, marginTop: 20}}>
                      <TouchableOpacity style={[styles.btn, {backgroundColor: colors.border}]} onPress={() => setCreateModal(false)}>
                          <Text style={{color: colors.text}}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btn, {backgroundColor: colors.tint}]} onPress={handleCreate} disabled={submitting}>
                          {submitting ? <ActivityIndicator color="#0f172a"/> : <Text style={{color: '#0f172a', fontWeight:'bold'}}>Submit Ticket</Text>}
                      </TouchableOpacity>
                  </View>
              </View>
          </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  title: { fontSize: 24, fontWeight: 'bold', marginLeft: 16, flex: 1 },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  card: { padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  subject: { fontWeight: 'bold', fontSize: 16 },
  status: { fontSize: 10, fontWeight: 'bold' },
  empty: { alignItems: 'center', marginTop: 100, opacity: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  modalContent: { padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  label: { fontSize: 12, fontWeight: 'bold', marginBottom: 6 },
  input: { padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  btn: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center' }
});