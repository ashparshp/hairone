import React, { useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, LayoutAnimation, UIManager } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../services/api';
import { ChevronLeft, Send } from 'lucide-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

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
      // Error handled silently
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const res = await api.post(`/support/${id}/reply`, { text: reply });
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setTicket(res.data);
      setReply('');
    } catch (e) {
      // Error handled silently
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = (item.sender === 'user' && user?.role !== 'admin') || (item.sender === 'admin' && user?.role === 'admin');
    return (
      <View style={[
          styles.bubble,
          isMe ? {
            alignSelf: 'flex-end',
            backgroundColor: colors.tint,
            borderTopRightRadius: 2,
            borderTopLeftRadius: 16,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16
          } : {
            alignSelf: 'flex-start',
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            borderTopLeftRadius: 2,
            borderTopRightRadius: 16,
            borderBottomLeftRadius: 16,
            borderBottomRightRadius: 16
          }
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
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
          style={{ flex: 1 }}
          contentContainerStyle={{padding: 20}}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={[
            styles.inputContainer,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: Platform.OS === 'ios' ? Math.max(insets.bottom, 16) : 16
            }
          ]}>
            <TextInput
               style={[styles.input, {backgroundColor: colors.background, color: colors.text, borderColor: colors.border}]}
               placeholder="Type a message..."
               placeholderTextColor={colors.textMuted}
               value={reply}
               onChangeText={setReply}
               multiline
            />
            <TouchableOpacity style={[styles.sendBtn, {backgroundColor: colors.tint}]} onPress={handleSend} disabled={sending}>
                {sending ? <ActivityIndicator size="small" color="#0f172a"/> : <Send size={20} color="#0f172a" />}
            </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 16, paddingTop: 10, borderBottomWidth: 1, gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: 'bold' },

  bubble: { maxWidth: '80%', padding: 12, marginBottom: 12 },

  inputContainer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 5,
  },
  input: { flex: 1, padding: 12, borderRadius: 24, borderWidth: 1, maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }
});
