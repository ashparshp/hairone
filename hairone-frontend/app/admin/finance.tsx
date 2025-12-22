import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, DollarSign, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { FadeInView } from '../../components/AnimatedViews';

export default function AdminFinance() {
  const router = useRouter();
  const { colors, theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState([]);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await api.get('/admin/finance');
      setData(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSettle = async (shopId: string) => {
      setSettlingId(shopId);
      try {
          await api.post('/admin/settle', { shopId });
          Alert.alert("Success", "Settlement marked as complete.");
          fetchStats();
      } catch (e) {
          Alert.alert("Error", "Failed to settle.");
      } finally {
          setSettlingId(null);
      }
  };

  const renderItem = ({ item, index }: { item: any, index: number }) => {
      const isOweToAdmin = item.totalPending > 0;
      const isOweToShop = item.totalPending < 0;
      const amount = Math.abs(item.totalPending);

      if (amount === 0) return null;

      return (
        <FadeInView delay={index * 50}>
          <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
             <View style={{flex: 1}}>
                 <Text style={[styles.shopName, {color: colors.text}]}>{item.shopName}</Text>
                 <Text style={{color: colors.textMuted, fontSize: 12}}>ID: {item.shopId}</Text>

                 <View style={{marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6}}>
                     {isOweToAdmin ? (
                         <Text style={{color: '#ef4444', fontWeight: 'bold'}}>Barber owes Admin</Text>
                     ) : (
                         <Text style={{color: '#10b981', fontWeight: 'bold'}}>Admin owes Barber</Text>
                     )}
                     <Text style={[styles.amount, {color: colors.text}]}>₹{amount.toFixed(2)}</Text>
                 </View>
             </View>

             <TouchableOpacity
                style={[styles.settleBtn, {backgroundColor: colors.tint}]}
                onPress={() => handleSettle(item.shopId)}
                disabled={settlingId === item.shopId}
             >
                {settlingId === item.shopId ? <ActivityIndicator size="small" color="#0f172a"/> : <Text style={styles.settleText}>Mark Settled</Text>}
             </TouchableOpacity>
          </View>
        </FadeInView>
      );
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Finance & Settlements</Text>
      </View>

      <View style={styles.infoBox}>
          <AlertCircle size={16} color={colors.textMuted} />
          <Text style={{color: colors.textMuted, fontSize: 12, flex: 1}}>
              Shows net pending balance from completed bookings. "Mark Settled" clears the balance (assumes external payment made).
          </Text>
      </View>

      {loading ? (
          <ActivityIndicator size="large" color={colors.tint} style={{marginTop: 50}} />
      ) : (
          <FlatList
             data={data}
             renderItem={renderItem}
             keyExtractor={(item: any) => item.shopId}
             contentContainerStyle={{paddingBottom: 20}}
             ListEmptyComponent={
                 <View style={{alignItems: 'center', marginTop: 50}}>
                     <CheckCircle2 size={48} color={colors.textMuted} />
                     <Text style={{color: colors.textMuted, marginTop: 12}}>All balances settled.</Text>
                 </View>
             }
          />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 24, fontWeight: 'bold' },

  infoBox: { flexDirection: 'row', gap: 8, marginBottom: 20, padding: 12, backgroundColor: 'rgba(148, 163, 184, 0.1)', borderRadius: 8 },

  card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  shopName: { fontWeight: 'bold', fontSize: 16 },
  amount: { fontSize: 18, fontWeight: 'bold' },

  settleBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  settleText: { color: '#0f172a', fontWeight: 'bold', fontSize: 12 }
});
