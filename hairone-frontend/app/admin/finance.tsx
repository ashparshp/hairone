import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Modal, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, CheckCircle2, AlertCircle, Clock, Calendar, User, CreditCard, X, TrendingUp } from 'lucide-react-native';
import { FadeInView } from '../../components/AnimatedViews';
import { format } from 'date-fns';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';

export default function AdminFinance() {
  const router = useRouter();
  const { colors } = useTheme();

  const layout = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'pending', title: 'Pending' },
    { key: 'online', title: 'Online (Payables)' },
    { key: 'offline', title: 'Offline (Receivables)' },
    { key: 'history', title: 'History' },
  ]);

  const PendingRoute = () => <PendingSettlementsList filter="all" />;
  const OnlineRoute = () => <PendingSettlementsList filter="online" />;
  const OfflineRoute = () => <PendingSettlementsList filter="offline" />;
  const HistoryRoute = () => <SettlementHistoryList />;

  const renderScene = SceneMap({
    pending: PendingRoute,
    online: OnlineRoute,
    offline: OfflineRoute,
    history: HistoryRoute,
  });

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Finance & Settlements</Text>
      </View>

      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        renderTabBar={props => (
            <TabBar
                {...props}
                scrollEnabled
                indicatorStyle={{ backgroundColor: colors.tint }}
                style={{ backgroundColor: colors.background }}
                labelStyle={{ fontWeight: 'bold', fontSize: 12 }}
                activeColor={colors.tint}
                inactiveColor={colors.textMuted}
            />
        )}
      />
    </View>
  );
}

// --- PENDING SETTLEMENTS ---

function PendingSettlementsList({ filter }: { filter: 'all' | 'online' | 'offline' }) {
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

    const filteredData = data.filter((item: any) => {
        if (filter === 'all') return Math.abs(item.totalPending) > 0;
        if (filter === 'online') return item.onlineBookings.length > 0; // Shops we owe money to (or just have online bookings)
        if (filter === 'offline') return item.offlineBookings.length > 0; // Shops that owe us (or just have offline bookings)
        return true;
    });

    // For 'online' tab, we strictly want to see Payables (Admin Owes Shop)?
    // Or just shops with ANY online bookings pending?
    // The user said: "separate tab for it for setttelement... detailed data"
    // Let's show shops that have relevant bookings pending.

    const renderItem = ({ item, index }: { item: any, index: number }) => {
        // Calculate sub-totals for the filter view if needed, but the main item has aggregated net.
        // If filter is online, maybe show only online stats?
        // Let's stick to showing the Shop Card, and on click show details.

        let displayAmount = item.totalPending;
        let label = "Net Balance";

        if (filter === 'online') {
            // Show how much Admin owes shop for online bookings
            // Sum of barberNetRevenue for online bookings
            const totalPayable = item.onlineBookings.reduce((sum: number, b: any) => sum + (b.barberNetRevenue || 0), 0);
             if (totalPayable === 0) return null;
             displayAmount = totalPayable;
             label = "Total Payable (Online)";
        } else if (filter === 'offline') {
            // Show how much Shop owes Admin for offline bookings
            // Sum of adminNetRevenue for offline bookings
            const totalReceivable = item.offlineBookings.reduce((sum: number, b: any) => sum + (b.adminNetRevenue || 0), 0);
            if (totalReceivable === 0) return null;
            displayAmount = -totalReceivable; // Negative to imply debt/receivable
            label = "Total Receivable (Offline)";
        }

        // Color logic
        // Net: > 0 (Admin Owes Shop, Green), < 0 (Shop Owes Admin, Red)
        // If filter is online (Payable): Always Green (Admin owes)
        // If filter is offline (Receivable): Always Red (Shop owes)

        const isGreen = displayAmount > 0;

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
                       <Text style={{color: isGreen ? '#10b981' : '#ef4444', fontWeight: 'bold'}}>
                            {label === "Net Balance"
                                ? (displayAmount > 0 ? "Admin owes Barber" : "Barber owes Admin")
                                : label
                            }
                       </Text>
                       <Text style={[styles.amount, {color: colors.text}]}>₹{Math.abs(displayAmount).toFixed(2)}</Text>
                   </View>
                   <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 4}}>
                       {filter === 'online' ? item.onlineBookings.length :
                        filter === 'offline' ? item.offlineBookings.length :
                        item.details.bookingCount} bookings pending
                   </Text>
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
                    data={filteredData}
                    renderItem={renderItem}
                    keyExtractor={(item: any) => item.shopId}
                    contentContainerStyle={{paddingBottom: 20}}
                    ListEmptyComponent={
                        <View style={{alignItems: 'center', marginTop: 50}}>
                            <CheckCircle2 size={48} color={colors.textMuted} />
                            <Text style={{color: colors.textMuted, marginTop: 12}}>No settlements found.</Text>
                        </View>
                    }
                />
            )}

            {selectedShop && (
                <PendingDetailModal
                    shop={selectedShop}
                    visible={!!selectedShop}
                    onClose={() => { setSelectedShop(null); fetchStats(); }}
                    initialFilter={filter === 'all' ? undefined : filter}
                />
            )}
        </>
    );
}

function PendingDetailModal({ shop, visible, onClose, initialFilter }: { shop: any, visible: boolean, onClose: () => void, initialFilter?: 'online' | 'offline' }) {
    const { colors } = useTheme();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [settling, setSettling] = useState(false);
    const [tab, setTab] = useState<'all'|'online'|'offline'>(initialFilter || 'all');

    useEffect(() => {
        if (visible) fetchDetails();
    }, [visible]);

    const fetchDetails = async () => {
        try {
            // Note: Currently getting ALL pending. We can filter client side.
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
        // Settle ALL for now.
        Alert.alert(
            "Confirm Settlement",
            `Mark all ${bookings.length} bookings as settled? This will create a permanent settlement record.`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Confirm",
                    style: 'destructive',
                    onPress: async () => {
                        setSettling(true);
                        try {
                            await api.post('/admin/finance/settle', { shopId: shop.shopId });
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

    const isOweToAdmin = shop.totalPending < 0; // Note: totalPending > 0 means Admin Owes Shop. < 0 means Shop Owes Admin.

    // Filter displayed bookings
    const displayedBookings = bookings.filter((b: any) => {
        if (tab === 'online') return b.amountCollectedBy === 'ADMIN';
        if (tab === 'offline') return b.amountCollectedBy === 'BARBER';
        return true;
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

                {/* Sub-Tabs for Modal */}
                <View style={{flexDirection:'row', marginBottom: 16, backgroundColor: colors.card, padding: 4, borderRadius: 8}}>
                    {['all', 'online', 'offline'].map((t) => (
                        <TouchableOpacity
                            key={t}
                            style={{flex: 1, paddingVertical: 8, alignItems:'center', borderRadius: 6, backgroundColor: tab === t ? colors.background : 'transparent'}}
                            onPress={() => setTab(t as any)}
                        >
                            <Text style={{color: tab === t ? colors.tint : colors.textMuted, fontWeight:'bold', textTransform:'capitalize'}}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={[styles.summaryBox, {backgroundColor: colors.card, borderColor: colors.border}]}>
                    <Text style={{color: colors.text, fontWeight: 'bold', fontSize: 18}}>{shop.shopName}</Text>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 8}}>
                         <Text style={{color: colors.textMuted}}>Net Balance</Text>
                         <Text style={{color: shop.totalPending > 0 ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: 18}}>
                             {shop.totalPending > 0 ? "Admin owes Barber" : "Barber owes Admin"} ₹{Math.abs(shop.totalPending).toFixed(2)}
                         </Text>
                    </View>
                </View>

                {loading ? <ActivityIndicator color={colors.tint} style={{marginTop: 20}} /> : (
                    <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 100}}>
                        <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>Booking Breakdown ({displayedBookings.length})</Text>
                        {displayedBookings.map((b: any, i) => (
                            <View key={i} style={[styles.rowCard, {borderColor: colors.border}]}>
                                <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                    <Text style={{color: colors.text, fontWeight:'bold'}}>{format(new Date(b.date), 'dd MMM')} • {b.startTime}</Text>
                                    <View style={{backgroundColor: b.amountCollectedBy === 'ADMIN' ? '#dbeafe' : '#fef9c3', paddingHorizontal: 6, borderRadius: 4}}>
                                        <Text style={{fontSize: 10, color: b.amountCollectedBy === 'ADMIN' ? '#1e40af' : '#854d0e', fontWeight:'bold'}}>
                                            {b.amountCollectedBy === 'ADMIN' ? 'PAID ONLINE' : 'CASH'}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 2}}>
                                    {b.serviceNames.join(', ')} • {b.userId?.name || 'Guest'}
                                </Text>

                                {/* Detailed Financial Breakdown */}
                                <View style={{marginTop: 8, padding: 8, backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderRadius: 8}}>
                                    <Row label="Service Cost" value={`₹${b.originalPrice}`} colors={colors} />
                                    <Row label="Discount" value={`-₹${b.discountAmount}`} colors={colors} colorValue="#ef4444" />
                                    <Row label="Admin Comm" value={`₹${b.adminCommission}`} colors={colors} />
                                    <View style={{height: 1, backgroundColor: colors.border, marginVertical: 4}} />
                                    <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                         <Text style={{color: colors.textMuted, fontSize: 12}}>Net {b.amountCollectedBy === 'ADMIN' ? 'Payable' : 'Receivable'}</Text>
                                         <Text style={{fontWeight:'bold', color: b.amountCollectedBy === 'ADMIN' ? '#10b981' : '#ef4444', fontSize: 12}}>
                                             ₹{b.amountCollectedBy === 'ADMIN' ? b.barberNetRevenue : b.adminNetRevenue}
                                         </Text>
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
                        {settling ? <ActivityIndicator color="black" /> : <Text style={styles.btnText}>Mark All as Settled</Text>}
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

const Row = ({ label, value, colors, colorValue }: any) => (
    <View style={{flexDirection:'row', justifyContent:'space-between'}}>
        <Text style={{color: colors.textMuted, fontSize: 12}}>{label}</Text>
        <Text style={{color: colorValue || colors.text, fontSize: 12}}>{value}</Text>
    </View>
);

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

  summaryBox: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  sectionTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 'bold', marginBottom: 12, marginTop: 12 },

  rowCard: { padding: 12, borderBottomWidth: 1, marginBottom: 8 },

  footer: { padding: 20, position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1 },
  fullBtn: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { fontWeight: 'bold', color: '#0f172a', fontSize: 16 }
});
