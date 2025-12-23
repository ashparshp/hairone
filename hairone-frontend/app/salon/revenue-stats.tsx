import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, ScrollView, Alert, Linking, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { ChevronLeft, Info, Wallet, TrendingUp, TrendingDown, Clock, X } from 'lucide-react-native';
import { format } from 'date-fns';

export default function ShopRevenueStats() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'overview' | 'settlements'>('overview');

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Revenue & Settlements</Text>
      </View>

      <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && {borderBottomColor: colors.tint}]}
            onPress={() => setActiveTab('overview')}
          >
              <Text style={[styles.tabText, {color: activeTab === 'overview' ? colors.tint : colors.textMuted}]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'settlements' && {borderBottomColor: colors.tint}]}
            onPress={() => setActiveTab('settlements')}
          >
              <Text style={[styles.tabText, {color: activeTab === 'settlements' ? colors.tint : colors.textMuted}]}>Settlements</Text>
          </TouchableOpacity>
      </View>

      {activeTab === 'overview' ? <RevenueOverview /> : <SettlementsList />}
    </View>
  );
}

function RevenueOverview() {
    const { colors } = useTheme();
    const { user } = useAuth();
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user?.myShopId) fetchStats();
    }, [user]);

    const fetchStats = async () => {
        try {
            const shopId = typeof user?.myShopId === 'object' ? user.myShopId._id : user?.myShopId;
            if (!shopId) return;

            // Fetch summary using existing shop routes if available
            // Fallback to basic pending stats from finance
            const res = await api.get(`/shops/${shopId}/finance/summary`);
            setStats(res.data);
        } catch (e) {
            console.log(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <ActivityIndicator color={colors.tint} style={{marginTop: 50}} />;

    return (
        <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 20}}>
            <View style={{backgroundColor: colors.card, padding: 20, borderRadius: 12, marginBottom: 12}}>
                 <Text style={{color: colors.textMuted}}>Total Earnings</Text>
                 <Text style={{color: colors.text, fontSize: 32, fontWeight: 'bold'}}>₹{(stats?.totalRevenue || 0).toFixed(2)}</Text>
            </View>

            <View style={{flexDirection: 'row', gap: 12}}>
                 <View style={{flex: 1, backgroundColor: colors.card, padding: 16, borderRadius: 12}}>
                     <Text style={{color: colors.textMuted, fontSize: 12}}>Pending Payouts</Text>
                     <Text style={{color: '#10b981', fontSize: 20, fontWeight: 'bold'}}>₹{(stats?.pendingPayout || 0).toFixed(2)}</Text>
                 </View>
                 <View style={{flex: 1, backgroundColor: colors.card, padding: 16, borderRadius: 12}}>
                     <Text style={{color: colors.textMuted, fontSize: 12}}>Pending Dues</Text>
                     <Text style={{color: '#ef4444', fontSize: 20, fontWeight: 'bold'}}>₹{(stats?.pendingCollection || 0).toFixed(2)}</Text>
                 </View>
            </View>
        </ScrollView>
    );
}

function SettlementsList() {
    const { colors } = useTheme();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSettlement, setSelectedSettlement] = useState<any>(null);

    const fetchSettlements = async () => {
        setLoading(true);
        try {
            const res = await api.get('/finance/settlements');
            setData(res.data);
        } catch (e) {
            console.log(e);
            Alert.alert("Error", "Failed to fetch settlements.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettlements();
    }, []);

    const renderItem = ({ item }: { item: any }) => {
        const isPayout = item.type === 'PAYOUT'; // Admin pays Shop
        const isCollection = item.type === 'COLLECTION'; // Shop pays Admin
        const isCompleted = item.status === 'COMPLETED';
        const isPending = item.status.includes('PENDING');

        // Color Logic
        // Payout (Incoming): Green
        // Collection (Outgoing): Red
        const amountColor = isPayout ? '#10b981' : '#ef4444';
        const icon = isPayout ? <TrendingUp size={20} color={amountColor} /> : <TrendingDown size={20} color={amountColor} />;

        return (
            <TouchableOpacity
                style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}
                onPress={() => setSelectedSettlement(item)}
            >
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                    <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: isPayout ? '#d1fae5' : '#fee2e2', alignItems: 'center', justifyContent: 'center'}}>
                        {icon}
                    </View>
                    <View style={{flex: 1}}>
                        <Text style={{color: colors.text, fontWeight: 'bold', fontSize: 16}}>{format(new Date(item.createdAt), 'dd MMM yyyy')}</Text>
                        <Text style={{color: colors.textMuted, fontSize: 12}}>{item.status.replace('_', ' ')}</Text>
                    </View>
                    <View style={{alignItems: 'flex-end'}}>
                        <Text style={{color: amountColor, fontWeight: 'bold', fontSize: 16}}>
                            {isPayout ? '+' : '-'} ₹{item.amount.toFixed(2)}
                        </Text>
                        {isPending && isCollection && (
                             <View style={{backgroundColor: '#ef4444', paddingHorizontal: 6, borderRadius: 4, marginTop: 4}}>
                                 <Text style={{color: 'white', fontSize: 10, fontWeight: 'bold'}}>PAY NOW</Text>
                             </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <>
            {loading ? (
                <ActivityIndicator size="large" color={colors.tint} style={{marginTop: 50}} />
            ) : (
                <FlatList
                    data={data}
                    renderItem={renderItem}
                    keyExtractor={(item: any) => item._id}
                    contentContainerStyle={{paddingBottom: 20}}
                    ListEmptyComponent={
                        <View style={{alignItems: 'center', marginTop: 50}}>
                            <Clock size={48} color={colors.textMuted} />
                            <Text style={{color: colors.textMuted, marginTop: 12}}>No settlement history found.</Text>
                        </View>
                    }
                />
            )}

            {selectedSettlement && (
                <SettlementDetailModal
                    settlement={selectedSettlement}
                    visible={!!selectedSettlement}
                    onClose={() => { setSelectedSettlement(null); fetchSettlements(); }}
                />
            )}
        </>
    );
}

function SettlementDetailModal({ settlement, visible, onClose }: { settlement: any, visible: boolean, onClose: () => void }) {
    const { colors } = useTheme();
    const [processing, setProcessing] = useState(false);
    const [details, setDetails] = useState<any>(null);
    const [loadingDetails, setLoadingDetails] = useState(true);

    const isCollection = settlement.type === 'COLLECTION';
    const isPending = settlement.status.includes('PENDING');

    useEffect(() => {
        if (visible) fetchDetails();
    }, [visible]);

    const fetchDetails = async () => {
        try {
            const res = await api.get(`/finance/settlements/${settlement._id}`);
            setDetails(res.data);
        } catch (e) {
            console.log("Failed to fetch details", e);
        } finally {
            setLoadingDetails(false);
        }
    };

    const handlePay = async () => {
        setProcessing(true);
        try {
            const res = await api.post(`/finance/settlements/${settlement._id}/pay`);
            if (res.data.link) {
                Linking.openURL(res.data.link);
                Alert.alert("Payment Initiated", "Please complete the payment in the browser window.");
            } else {
                 Alert.alert("Error", "No payment link returned.");
            }
        } catch (e: any) {
            Alert.alert("Error", e.response?.data?.message || "Failed to initiate payment.");
        } finally {
            setProcessing(false);
        }
    };

    return (
         <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
                 <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, {color: colors.text}]}>Settlement Details</Text>
                    <TouchableOpacity onPress={onClose} style={{padding: 4}}>
                        <X size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 40}}>
                    <View style={{alignItems: 'center', paddingVertical: 20}}>
                         <Text style={{color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 1}}>{settlement.type}</Text>
                         <Text style={{color: colors.text, fontSize: 40, fontWeight: 'bold', marginVertical: 10}}>₹{settlement.amount.toFixed(2)}</Text>

                         <View style={{backgroundColor: colors.card, padding: 16, borderRadius: 12, width: '100%', marginTop: 20}}>
                             <Text style={{color: colors.textMuted, marginBottom: 4}}>Status</Text>
                             <Text style={{color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 16}}>{settlement.status.replace('_', ' ')}</Text>

                             <Text style={{color: colors.textMuted, marginBottom: 4}}>Date</Text>
                             <Text style={{color: colors.text, fontWeight: 'bold', fontSize: 16}}>{format(new Date(settlement.createdAt), 'dd MMM yyyy, hh:mm a')}</Text>
                         </View>

                         {isCollection && isPending && (
                             <TouchableOpacity
                                style={{marginTop: 20, backgroundColor: '#ef4444', paddingVertical: 16, width: '100%', borderRadius: 12, alignItems: 'center'}}
                                onPress={handlePay}
                                disabled={processing}
                             >
                                 {processing ? <ActivityIndicator color="white" /> : <Text style={{color: 'white', fontWeight: 'bold', fontSize: 18}}>Pay Now</Text>}
                             </TouchableOpacity>
                         )}
                    </View>

                    <Text style={{color: colors.textMuted, fontWeight:'bold', marginBottom: 12, marginTop: 10}}>INCLUDED BOOKINGS</Text>

                    {loadingDetails ? (
                        <ActivityIndicator color={colors.tint} />
                    ) : details?.bookings ? (
                        details.bookings.map((b: any, i: number) => (
                             <View key={i} style={{padding: 12, borderBottomWidth: 1, borderColor: colors.border}}>
                                <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                    <Text style={{color: colors.text, fontWeight:'bold'}}>{format(new Date(b.date), 'dd MMM')} • {b.startTime}</Text>
                                    <Text style={{color: colors.text}}>₹{b.finalPrice}</Text>
                                </View>
                                <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 2}}>{b.serviceNames?.join(', ')}</Text>
                             </View>
                        ))
                    ) : (
                        <Text style={{color: colors.textMuted, textAlign:'center'}}>No booking details found.</Text>
                    )}
                </ScrollView>
            </View>
         </Modal>
    );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 24, fontWeight: 'bold' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#334155', marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontWeight: 'bold' },

  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },

  modalContainer: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
});
