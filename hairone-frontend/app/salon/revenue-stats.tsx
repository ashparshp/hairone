import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import api from "../../services/api";
import { ChevronLeft, Calendar, DollarSign, Clock, X, TrendingUp, AlertCircle } from "lucide-react-native";
import { format } from "date-fns";
import { FadeInView } from "../../components/AnimatedViews";

export default function ShopFinanceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [settlements, setSettlements] = useState([]);

  useEffect(() => {
    fetchStats();
    fetchSettlements();
  }, []);

  const fetchStats = async () => {
    try {
      // @ts-ignore
      const res = await api.get(`/shops/${user.myShopId}/finance/summary`);
      setData(res.data);
    } catch (e) {
      console.log("Stats error", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettlements = async () => {
    try {
        // @ts-ignore
        const res = await api.get(`/shops/${user.myShopId}/finance/settlements`);
        setSettlements(res.data);
    } catch (e) {
        console.log("Settlements error", e);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );
  }

  const StatCard = ({ title, amount, color, icon }: { title: string; amount: number; color: string, icon: any }) => (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: color, borderLeftWidth: 4 }]}>
      <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start'}}>
          <View>
              <Text style={[styles.statTitle, { color: colors.textMuted }]}>{title}</Text>
              <Text style={[styles.statAmount, { color: colors.text }]}>₹{amount?.toLocaleString()}</Text>
          </View>
          <View style={{padding: 8, backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 8}}>
              {icon}
          </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Finance Dashboard</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* OVERVIEW SECTION */}
        <Text style={[styles.sectionHeader, {color: colors.text}]}>Overview</Text>
        <View style={styles.grid}>
             {/* TOTAL EARNINGS */}
             <StatCard
                title="Total Earnings"
                amount={data?.totalEarnings || 0}
                color="#3b82f6"
                icon={<TrendingUp size={20} color="#3b82f6"/>}
             />

             {/* PENDING PAYOUT (Admin owes Shop) */}
             <StatCard
                title="Pending Payout"
                amount={data?.details?.pendingPayout || 0}
                color="#10b981"
                icon={<DollarSign size={20} color="#10b981"/>}
             />

             {/* PENDING DUES (Shop owes Admin) */}
             <StatCard
                title="Pending Dues"
                amount={data?.details?.pendingDues || 0}
                color="#ef4444"
                icon={<AlertCircle size={20} color="#ef4444"/>}
             />
        </View>

        {/* NET BALANCE ALERT */}
        {data?.currentBalance !== 0 && (
            <View style={[styles.alertBox, {backgroundColor: colors.card, borderColor: data?.currentBalance > 0 ? '#10b981' : '#ef4444'}]}>
                <View style={{flexDirection:'row', gap: 12, alignItems:'center'}}>
                    {data?.currentBalance > 0
                        ? <CheckCircle2 color="#10b981" size={24}/>
                        : <AlertCircle color="#ef4444" size={24}/>
                    }
                    <View style={{flex: 1}}>
                         <Text style={{color: colors.text, fontWeight:'bold', fontSize: 16}}>
                             {data?.currentBalance > 0 ? "Payout Incoming" : "Payment Due"}
                         </Text>
                         <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 2}}>
                             {data?.currentBalance > 0
                                ? `Admin owes you ₹${data?.currentBalance.toFixed(2)}`
                                : `You owe Admin ₹${Math.abs(data?.currentBalance).toFixed(2)}`
                             }
                         </Text>
                    </View>
                    <Text style={{color: data?.currentBalance > 0 ? '#10b981' : '#ef4444', fontWeight:'bold', fontSize: 20}}>
                        ₹{Math.abs(data?.currentBalance).toFixed(2)}
                    </Text>
                </View>
            </View>
        )}

        {/* RECENT SETTLEMENTS */}
        <Text style={[styles.sectionHeader, {color: colors.text, marginTop: 24}]}>Settlement History</Text>
        {settlements.length === 0 ? (
             <View style={{alignItems:'center', marginTop: 40}}>
                 <Clock size={40} color={colors.textMuted}/>
                 <Text style={{color: colors.textMuted, marginTop: 12}}>No settlements yet.</Text>
             </View>
        ) : (
            settlements.map((item: any, i: number) => (
                <View key={i} style={[styles.historyCard, {backgroundColor: colors.card, borderColor: colors.border}]}>
                    <View>
                        <Text style={{color: colors.text, fontWeight:'bold'}}>{format(new Date(item.createdAt), 'dd MMM yyyy')}</Text>
                        <Text style={{color: colors.textMuted, fontSize: 12}}>{item.type === 'PAYOUT' ? 'Received from Admin' : 'Paid to Admin'}</Text>
                    </View>
                    <Text style={{color: item.type === 'PAYOUT' ? '#10b981' : '#ef4444', fontWeight:'bold', fontSize: 16}}>
                        {item.type === 'PAYOUT' ? '+' : '-'} ₹{item.amount.toFixed(2)}
                    </Text>
                </View>
            ))
        )}

      </ScrollView>
    </View>
  );
}

// Icon helper
const CheckCircle2 = ({ color, size }: { color: string, size: number }) => (
    <Text style={{color, fontSize: size, fontWeight: 'bold'}}>✓</Text>
);

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  center: { justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "bold" },
  scrollContent: { padding: 20 },

  sectionHeader: { fontSize: 18, fontWeight:'bold', marginBottom: 16 },

  grid: { gap: 12, marginBottom: 20 },
  statCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statTitle: { fontSize: 12, fontWeight: "600", marginBottom: 4, textTransform: "uppercase" },
  statAmount: { fontSize: 24, fontWeight: "bold" },

  alertBox: {
      padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 20
  },

  historyCard: {
      padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10,
      flexDirection: 'row', justifyContent:'space-between', alignItems:'center'
  }
});
