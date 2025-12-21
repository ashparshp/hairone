import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, Send } from 'lucide-react-native';

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const fetchTicket = async () => {
    try {
      const res = await api.get(`/support/${id}`);
      setTicket(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/support/${id}/reply`, { text: reply });
      setTicket(res.data);
      setReply('');
    } catch (e) {
      console.log(e);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = (item.sender === 'user' && user?.role !== 'admin') || (item.sender === 'admin' && user?.role === 'admin');
    return (
      <View style={[
          styles.bubble,
          isMe ? { alignSelf: 'flex-end', backgroundColor: colors.tint } : { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }
      ]}>
          <Text style={{color: isMe ? '#0f172a' : colors.text}}>{item.text}</Text>
          <Text style={{fontSize: 10, color: isMe ? 'rgba(0,0,0,0.5)' : colors.textMuted, marginTop: 4, alignSelf:'flex-end'}}>
              {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </Text>
      </View>
    );
  };

  if (loading) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.tint} /></View>;

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={[styles.header, {borderBottomColor: colors.border}]}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <View>
             <Text style={[styles.title, {color: colors.text}]}>{ticket?.subject}</Text>
             <Text style={{color: colors.textMuted, fontSize: 12}}>Ticket #{ticket?._id?.slice(-6)}</Text>
         </View>
      </View>

      <FlatList
        ref={listRef}
        data={ticket?.messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => index.toString()}
        contentContainerStyle={{padding: 20}}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <View style={[styles.inputContainer, {backgroundColor: colors.card, borderTopColor: colors.border}]}>
          <TextInput
             style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
             placeholder="Type a message..."
             placeholderTextColor={colors.textMuted}
             value={reply}
             onChangeText={setReply}
          />
          <TouchableOpacity style={[styles.sendBtn, {backgroundColor: colors.tint}]} onPress={handleSend} disabled={sending}>
              {sending ? <ActivityIndicator size="small" color="#0f172a"/> : <Send size={20} color="#0f172a" />}
          </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: 'bold' },

  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 12 },

  inputContainer: { flexDirection: 'row', padding: 16, borderTopWidth: 1, alignItems: 'center', gap: 10 },
  input: { flex: 1, padding: 12, borderRadius: 24, borderWidth: 1, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }
});