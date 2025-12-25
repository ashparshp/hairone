import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../services/api';
import { MessageSquare } from 'lucide-react-native';
import { FadeInView } from '../../../components/AnimatedViews';

export default function AdminSupport() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/support/all');
      setTickets(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const renderTicket = ({ item, index }: { item: any, index: number }) => (
    <FadeInView delay={index * 50}>
      <TouchableOpacity
        style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}
        onPress={() => router.push(`/support/${item._id}` as any)}
      >
         <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}>
             <Text style={[styles.bizName, {color: colors.text, fontSize: 16}]}>{item.subject}</Text>
             <Text style={[styles.status, {color: item.status === 'open' ? '#10b981' : colors.textMuted}]}>{item.status.toUpperCase()}</Text>
         </View>
         <Text style={{color: colors.textMuted, fontSize: 12, marginBottom: 8}}>User: {item.userId?.name} ({item.userId?.phone})</Text>
         <Text style={{color: colors.text, fontSize: 14}} numberOfLines={1}>{item.messages[item.messages.length - 1]?.text}</Text>
      </TouchableOpacity>
    </FadeInView>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Text style={[styles.headerTitle, {color: colors.text}]}>Support Tickets</Text>
      <Text style={[styles.subtitle, {color: colors.textMuted}]}>Help users resolve their issues.</Text>

      {loading ? (
        <ActivityIndicator color={colors.tint} style={{marginTop: 50}} />
      ) : (
         <FlatList
            data={tickets}
            renderItem={renderTicket}
            keyExtractor={(item: any) => item._id}
            contentContainerStyle={{paddingBottom: 20, paddingTop: 20}}
            ListEmptyComponent={
                <View style={{alignItems: 'center', marginTop: 50, opacity: 0.5}}>
                    <MessageSquare size={48} color={colors.textMuted} />
                    <Text style={{color: colors.textMuted, marginTop: 10}}>No tickets.</Text>
                </View>
            }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginBottom: 10 },

  card: { padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  bizName: { fontWeight: 'bold', fontSize: 18 },
  status: { fontSize: 10, fontWeight: 'bold' },
});
