import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Modal, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, CheckCircle2, AlertCircle, Clock, Calendar, User, CreditCard, X, DollarSign } from 'lucide-react-native';
import { FadeInView } from '../../components/AnimatedViews';
import { format } from 'date-fns';

export default function AdminFinance() {
  const router = useRouter();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Finance & Settlements</Text>
      </View>

      <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && {borderBottomColor: colors.tint}]}
            onPress={() => setActiveTab('pending')}
          >
              <Text style={[styles.tabText, {color: activeTab === 'pending' ? colors.tint : colors.textMuted}]}>Pending Settlements</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && {borderBottomColor: colors.tint}]}
            onPress={() => setActiveTab('history')}
          >
              <Text style={[styles.tabText, {color: activeTab === 'history' ? colors.tint : colors.textMuted}]}>Settlement History</Text>
          </TouchableOpacity>
      </View>

      {activeTab === 'pending' ? <PendingSettlementsList /> : <SettlementHistoryList />}
    </View>
  );
}

// --- PENDING SETTLEMENTS ---

function PendingSettlementsList() {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [selectedShop, setSelectedShop] = useState<any>(null); // For Modal

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/finance');
            setData(res.data);
        } catch (e) {
            console.log(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const renderItem = ({ item, index }: { item: any, index: number }) => {
        const net = item.totalPending;
        const isOweToAdmin = net > 0; // Admin receives money? No.
        // calculateNet: net = adminOwesShop (Online) - shopOwesAdmin (Offline)
        // If net > 0: Admin owes Shop (Payout)
        // If net < 0: Shop owes Admin (Collection)

        // Wait, let's verify logic in FinanceController.js
        // net = adminOwesShop - shopOwesAdmin;
        // If adminOwesShop (90) > shopOwesAdmin (5) => Net = 85. (Positive).
        // Result: Admin pays Shop.
        // If adminOwesShop (0) < shopOwesAdmin (5) => Net = -5. (Negative).
        // Result: Shop pays Admin.

        const amount = Math.abs(net);
        const payout = net > 0;

        if (amount === 0) return null;

        return (
          <FadeInView delay={index * 50}>
            <TouchableOpacity
                style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}
                onPress={() => setSelectedShop(item)}
            >
               <View style={{flex: 1}}>
                   <Text style={[styles.shopName, {color: colors.text}]}>{item.shopName}</Text>
                   <Text style={{color: colors.textMuted, fontSize: 12}}>ID: {item.shopId}</Text>

                   <View style={{marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6}}>
                       {payout ? (
                           <Text style={{color: '#10b981', fontWeight: 'bold'}}>Payout Pending</Text>
                       ) : (
                           <Text style={{color: '#ef4444', fontWeight: 'bold'}}>Collection Pending</Text>
                       )}
                       <Text style={[styles.amount, {color: colors.text}]}>₹{amount.toFixed(2)}</Text>
                   </View>
                   <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 4}}>{item.details.bookingCount} bookings pending</Text>
               </View>
               <ChevronLeft size={20} color={colors.textMuted} style={{transform: [{rotate: '180deg'}]}} />
            </TouchableOpacity>
          </FadeInView>
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

            {selectedShop && (
                <PendingDetailModal
                    shop={selectedShop}
                    visible={!!selectedShop}
                    onClose={() => { setSelectedShop(null); fetchStats(); }}
                />
            )}
        </>
    );
}

function PendingDetailModal({ shop, visible, onClose }: { shop: any, visible: boolean, onClose: () => void }) {
    const { colors } = useTheme();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [settling, setSettling] = useState(false);
    const [filter, setFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');

    useEffect(() => {
        if (visible) fetchDetails();
    }, [visible]);

    const fetchDetails = async () => {
        try {
            const res = await api.get(`/admin/finance/pending/${shop.shopId}`);
            setBookings(res.data);
        } catch (e) {
            console.log(e);
            Alert.alert("Error", "Could not fetch details");
        } finally {
            setLoading(false);
        }
    };

    const handleSettle = async () => {
        // Filter booking IDs based on current view? Or settle all?
        // Let's settle CURRENTLY FILTERED bookings only if filter is active, or ALL?
        // User wants separate settlement.

        let idsToSettle = bookings.map((b: any) => b._id);
        if (filter === 'ONLINE') {
            idsToSettle = bookings.filter((b: any) => b.amountCollectedBy === 'ADMIN').map((b: any) => b._id);
        } else if (filter === 'OFFLINE') {
            idsToSettle = bookings.filter((b: any) => b.amountCollectedBy === 'BARBER').map((b: any) => b._id);
        }

        if (idsToSettle.length === 0) {
            Alert.alert("Info", "No bookings to settle in this category.");
            return;
        }

        Alert.alert(
            "Confirm Settlement",
            `Mark ${idsToSettle.length} bookings as settled? This will create a permanent settlement record.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                    style: 'destructive',
                    onPress: async () => {
                        setSettling(true);
                        try {
                            // We need to pass bookingIds to the backend if we want partial settlement
                            // Current backend implementation of `createSettlement` supports `bookingIds` in body.
                            await api.post('/admin/finance/settle', { shopId: shop.shopId, bookingIds: idsToSettle });
                            Alert.alert("Success", "Settlement created.");
                            onClose();
                        } catch (e) {
                            Alert.alert("Error", "Failed to settle.");
                        } finally {
                            setSettling(false);
                        }
                    }
                }
            ]
        );
    };

    const filteredBookings = bookings.filter((b: any) => {
        if (filter === 'ONLINE') return b.amountCollectedBy === 'ADMIN';
        if (filter === 'OFFLINE') return b.amountCollectedBy === 'BARBER';
        return true;
    });

    // Calculate totals for current view
    let currentTotal = 0;
    // Calculate Net for current filter
    // If ONLINE: Sum of barberNetRevenue (Positive)
    // If OFFLINE: Sum of adminNetRevenue (Negative/Owe)
    // If ALL: Net

    // Actually, let's just sum the relevant "owe" part.
    // Online -> Admin owes Shop -> barberNetRevenue
    // Offline -> Shop owes Admin -> adminNetRevenue

    let totalOnline = 0;
    let totalOffline = 0;

    bookings.forEach((b: any) => {
        if (b.amountCollectedBy === 'ADMIN') totalOnline += b.barberNetRevenue;
        if (b.amountCollectedBy === 'BARBER') totalOffline += b.adminNetRevenue;
    });

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
                <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, {color: colors.text}]}>Settlement Details</Text>
                    <TouchableOpacity onPress={onClose} style={{padding: 4}}>
                        <X size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* FILTER TABS */}
                <View style={{flexDirection: 'row', marginBottom: 16, backgroundColor: colors.card, padding: 4, borderRadius: 8}}>
                    <TouchableOpacity
                        style={[styles.filterTab, filter === 'ALL' && {backgroundColor: colors.tint}]}
                        onPress={() => setFilter('ALL')}
                    >
                        <Text style={{color: filter === 'ALL' ? '#000' : colors.text, fontWeight:'bold'}}>All</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterTab, filter === 'ONLINE' && {backgroundColor: colors.tint}]}
                        onPress={() => setFilter('ONLINE')}
                    >
                        <Text style={{color: filter === 'ONLINE' ? '#000' : colors.text, fontWeight:'bold'}}>Online (Payout)</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterTab, filter === 'OFFLINE' && {backgroundColor: colors.tint}]}
                        onPress={() => setFilter('OFFLINE')}
                    >
                        <Text style={{color: filter === 'OFFLINE' ? '#000' : colors.text, fontWeight:'bold'}}>Offline (Due)</Text>
                    </TouchableOpacity>
                </View>

                {/* SUMMARY FOR FILTER */}
                <View style={[styles.summaryBox, {backgroundColor: colors.card, borderColor: colors.border}]}>
                    {filter === 'ALL' && (
                        <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                             <View>
                                 <Text style={{color: colors.textMuted}}>Total Pending Payout</Text>
                                 <Text style={{color: '#10b981', fontWeight:'bold', fontSize: 16}}>₹{totalOnline.toFixed(2)}</Text>
                             </View>
                             <View style={{alignItems:'flex-end'}}>
                                 <Text style={{color: colors.textMuted}}>Total Pending Dues</Text>
                                 <Text style={{color: '#ef4444', fontWeight:'bold', fontSize: 16}}>₹{totalOffline.toFixed(2)}</Text>
                             </View>
                        </View>
                    )}
                    {filter === 'ONLINE' && (
                        <View>
                            <Text style={{color: colors.textMuted}}>Pending Payout (Admin owes Shop)</Text>
                            <Text style={{color: '#10b981', fontWeight:'bold', fontSize: 20}}>₹{totalOnline.toFixed(2)}</Text>
                        </View>
                    )}
                    {filter === 'OFFLINE' && (
                        <View>
                            <Text style={{color: colors.textMuted}}>Pending Dues (Shop owes Admin)</Text>
                            <Text style={{color: '#ef4444', fontWeight:'bold', fontSize: 20}}>₹{totalOffline.toFixed(2)}</Text>
                        </View>
                    )}
                </View>

                {loading ? <ActivityIndicator color={colors.tint} style={{marginTop: 20}} /> : (
                    <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 100}}>
                        <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>
                            {filteredBookings.length} Bookings
                        </Text>

                        {filteredBookings.map((b: any, i) => (
                            <View key={i} style={[styles.rowCard, {borderColor: colors.border}]}>
                                <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                    <Text style={{color: colors.text, fontWeight:'bold'}}>{format(new Date(b.date), 'dd MMM')} • {b.startTime}</Text>
                                    <View style={{backgroundColor: b.amountCollectedBy === 'ADMIN' ? '#dbeafe' : '#fef9c3', paddingHorizontal: 6, borderRadius: 4}}>
                                        <Text style={{fontSize: 10, color: b.amountCollectedBy === 'ADMIN' ? '#1e40af' : '#854d0e', fontWeight:'bold'}}>
                                            {b.amountCollectedBy === 'ADMIN' ? 'Paid Online' : 'Paid Cash'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 2}}>
                                    {b.serviceNames.join(', ')} • {b.userId?.name || 'Guest'}
                                </Text>
                                <View style={{marginTop: 8, flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                                    <Text style={{color: colors.text}}>Total: ₹{b.finalPrice}</Text>
                                    <View style={{alignItems:'flex-end'}}>
                                        {b.amountCollectedBy === 'ADMIN' ? (
                                            <>
                                                <Text style={{color: '#10b981', fontSize: 12, fontWeight:'bold'}}>Payout: ₹{b.barberNetRevenue}</Text>
                                                <Text style={{color: colors.textMuted, fontSize: 10}}>Comm: {b.adminCommission} | Disc: {b.discountAmount}</Text>
                                            </>
                                        ) : (
                                            <>
                                                <Text style={{color: '#ef4444', fontSize: 12, fontWeight:'bold'}}>Comm Due: ₹{b.adminNetRevenue}</Text>
                                                <Text style={{color: colors.textMuted, fontSize: 10}}>Comm: {b.adminCommission} | Disc: {b.discountAmount}</Text>
                                            </>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                )}

                <View style={[styles.footer, {backgroundColor: colors.background, borderTopColor: colors.border}]}>
                    <TouchableOpacity
                        style={[styles.fullBtn, {backgroundColor: colors.tint}]}
                        onPress={handleSettle}
                        disabled={settling}
                    >
                        {settling ? <ActivityIndicator color="black" /> : <Text style={styles.btnText}>
                            {filter === 'ALL' ? 'Settle All' : `Settle ${filter === 'ONLINE' ? 'Payouts' : 'Dues'}`}
                        </Text>}
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

// --- SETTLEMENT HISTORY ---

function SettlementHistoryList() {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [selectedSettlement, setSelectedSettlement] = useState<string | null>(null);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/finance/settlements');
            setData(res.data);
        } catch (e) {
            console.log(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, []);

    const renderItem = ({ item }: { item: any }) => (
        <TouchableOpacity
            style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}
            onPress={() => setSelectedSettlement(item._id)}
        >
            <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                <View>
                    <Text style={[styles.shopName, {color: colors.text}]}>{item.shopId?.name || 'Unknown Shop'}</Text>
                    <Text style={{color: colors.textMuted, fontSize: 12}}>{format(new Date(item.createdAt), 'dd MMM yyyy, hh:mm a')}</Text>
                </View>
                <View style={{alignItems:'flex-end'}}>
                    <Text style={[styles.amount, {color: item.type === 'PAYOUT' ? '#ef4444' : '#10b981'}]}>
                        {item.type === 'PAYOUT' ? '-' : '+'} ₹{item.amount.toFixed(2)}
                    </Text>
                    <Text style={{fontSize: 10, color: colors.textMuted, fontWeight:'bold'}}>{item.type}</Text>
                </View>
            </View>
        </TouchableOpacity>
    );

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
                            <Text style={{color: colors.textMuted, marginTop: 12}}>No settlement history.</Text>
                        </View>
                    }
                />
            )}

            {selectedSettlement && (
                <HistoryDetailModal
                    id={selectedSettlement}
                    visible={!!selectedSettlement}
                    onClose={() => setSelectedSettlement(null)}
                />
            )}
        </>
    );
}

function HistoryDetailModal({ id, visible, onClose }: { id: string, visible: boolean, onClose: () => void }) {
    const { colors } = useTheme();
    const [details, setDetails] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (visible) fetchDetails();
    }, [visible]);

    const fetchDetails = async () => {
        try {
            const res = await api.get(`/admin/finance/settlements/${id}`);
            setDetails(res.data);
        } catch (e) {
            console.log(e);
            Alert.alert("Error", "Could not fetch details");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
                 <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, {color: colors.text}]}>Settlement Receipt</Text>
                    <TouchableOpacity onPress={onClose} style={{padding: 4}}>
                        <X size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {loading || !details ? <ActivityIndicator color={colors.tint} style={{marginTop: 20}} /> : (
                    <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 40}}>
                        <View style={{alignItems:'center', marginVertical: 20}}>
                             <View style={{width: 60, height: 60, borderRadius: 30, backgroundColor: details.type === 'PAYOUT' ? '#fee2e2' : '#d1fae5', alignItems:'center', justifyContent:'center', marginBottom: 12}}>
                                 {details.type === 'PAYOUT' ? <CreditCard color="#ef4444" size={28} /> : <DollarSignIcon color="#10b981" size={28} />}
                             </View>
                             <Text style={{color: colors.textMuted, textTransform:'uppercase', letterSpacing: 1, fontSize: 12}}>{details.type}</Text>
                             <Text style={{color: colors.text, fontSize: 32, fontWeight:'bold'}}>₹{details.amount.toFixed(2)}</Text>
                             <Text style={{color: colors.textMuted, marginTop: 4}}>{format(new Date(details.createdAt), 'dd MMM yyyy • hh:mm a')}</Text>
                        </View>

                        <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>Included Bookings</Text>
                        {details.bookings.map((b: any, i: number) => (
                             <View key={i} style={[styles.rowCard, {borderColor: colors.border}]}>
                                <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                    <Text style={{color: colors.text, fontWeight:'bold'}}>{format(new Date(b.date), 'dd MMM')} • {b.startTime}</Text>
                                    <Text style={{color: colors.text}}>₹{b.finalPrice}</Text>
                                </View>
                                <Text style={{color: colors.textMuted, fontSize: 12}}>{b.serviceNames[0]} {b.serviceNames.length > 1 && `+${b.serviceNames.length - 1}`}</Text>
                             </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
}

// Icon helper
const DollarSignIcon = ({ color, size }: { color: string, size: number }) => (
    <Text style={{color, fontSize: size, fontWeight: 'bold'}}>$</Text>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 24, fontWeight: 'bold' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#334155', marginBottom: 20 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontWeight: 'bold' },

  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shopName: { fontWeight: 'bold', fontSize: 16 },
  amount: { fontSize: 16, fontWeight: 'bold' },

  // Modal
  modalContainer: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },

  filterTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },

  summaryBox: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  sectionTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 'bold', marginBottom: 12, marginTop: 12 },

  rowCard: { padding: 12, borderBottomWidth: 1, marginBottom: 8 },

  footer: { padding: 20, position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1 },
  fullBtn: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { fontWeight: 'bold', color: '#0f172a', fontSize: 16 }
});
