import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Modal, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, CheckCircle2, Clock, X, CreditCard, DollarSign } from 'lucide-react-native';
import { FadeInView } from '../../components/AnimatedViews';
import { format } from 'date-fns';

export default function AdminFinance() {
  const router = useRouter();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

  const [generating, setGenerating] = useState(false);

  const handleGenerateSettlements = async () => {
      setGenerating(true);
      try {
          const previewRes = await api.post('/finance/preview-settlements');
          const { cutoffDate, totalPayout, totalCollection, shopCount } = previewRes.data;

          Alert.alert(
              "Preview Settlement",
              `Settling ${shopCount} shops up to ${cutoffDate}.\n\nTotal Payout: ₹${totalPayout}\nTotal Collection: ₹${totalCollection}\n\nProceed to generate?`,
              [
                  { text: "Cancel", style: "cancel", onPress: () => setGenerating(false) },
                  {
                      text: "Proceed",
                      style: "default",
                      onPress: async () => {
                          try {
                              const res = await api.post('/finance/generate-settlements');
                              Alert.alert("Success", res.data.message || "Settlements generated.");
                              // Refresh history if active
                              if (activeTab === 'history') {
                                 // Force refresh logic would go here, or just switch tab
                              }
                          } catch (e: any) {
                              Alert.alert("Error", e.response?.data?.message || "Failed to generate settlements.");
                          } finally {
                              setGenerating(false);
                          }
                      }
                  }
              ]
          );
      } catch (e: any) {
          Alert.alert("Error", e.response?.data?.message || "Failed to preview settlements.");
          setGenerating(false);
      }
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <View style={{flex: 1}}>
            <Text style={[styles.title, {color: colors.text}]}>Finance & Settlements</Text>
         </View>
         <TouchableOpacity
            onPress={handleGenerateSettlements}
            disabled={generating}
            style={{backgroundColor: colors.tint, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8}}
         >
             {generating ? <ActivityIndicator size="small" color="#000" /> : <Text style={{color: '#000', fontWeight: 'bold', fontSize: 12}}>Preview</Text>}
         </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'pending' && {borderBottomColor: colors.tint}]}
            onPress={() => setActiveTab('pending')}
          >
              <Text style={[styles.tabText, {color: activeTab === 'pending' ? colors.tint : colors.textMuted}]}>Live Pending</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && {borderBottomColor: colors.tint}]}
            onPress={() => setActiveTab('history')}
          >
              <Text style={[styles.tabText, {color: activeTab === 'history' ? colors.tint : colors.textMuted}]}>Settlements</Text>
          </TouchableOpacity>
      </View>

      {activeTab === 'pending' ? <PendingSettlementsList /> : <SettlementHistoryList />}
    </View>
  );
}

// --- PENDING SETTLEMENTS (Live View) ---
// Keeps the original logic for "Current Week" or "Unsettled" view
function PendingSettlementsList() {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [selectedShop, setSelectedShop] = useState<any>(null);

    const fetchStats = async () => {
        setLoading(true);
        try {
            // This endpoint might need to be kept or refactored.
            // Assuming the old endpoint still exists or we use a new one.
            // For now, let's assume the user wants the new system.
            // But "Live Pending" implies things NOT yet settled.
            // I'll keep the old call for now if it exists, otherwise this might fail.
            // Wait, I didn't change the old /admin/finance endpoint in the backend plan.
            // So it should still work for "Pending Summary".
            const res = await api.get('/admin/finance');
            setData(res.data);
        } catch (e) {
            console.log("Error fetching pending stats:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
    }, []);

    const renderItem = ({ item, index }: { item: any, index: number }) => {
        const net = item.totalPending; // +ve = Payout, -ve = Collection
        const amount = Math.abs(net);
        const payout = net > 0;

        if (amount === 0) return null;

        return (
          <FadeInView delay={index * 50}>
            <View
                style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}
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
                   <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 4}}>{item.details.bookingCount} bookings live</Text>
               </View>
            </View>
          </FadeInView>
        );
    };

    return (
        <View style={{flex: 1}}>
            <Text style={{color: colors.textMuted, textAlign:'center', marginBottom: 10, fontSize: 12}}>
                These are real-time pending amounts not yet generated into a Settlement.
            </Text>
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
                            <Text style={{color: colors.textMuted, marginTop: 12}}>No live pending balances.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

// --- SETTLEMENT HISTORY (New System) ---
function SettlementHistoryList() {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [selectedSettlement, setSelectedSettlement] = useState<any>(null);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await api.get('/finance/settlements');
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

    const renderItem = ({ item }: { item: any }) => {
        const isPayout = item.type === 'PAYOUT';
        const isCompleted = item.status === 'COMPLETED';
        return (
            <TouchableOpacity
                style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}
                onPress={() => setSelectedSettlement(item)}
            >
                <View style={{flexDirection:'row', justifyContent:'space-between', alignItems:'center'}}>
                    <View>
                        <Text style={[styles.shopName, {color: colors.text}]}>{item.shopId?.name || 'Unknown Shop'}</Text>
                        <Text style={{color: colors.textMuted, fontSize: 12}}>{format(new Date(item.createdAt), 'dd MMM yyyy')}</Text>
                        <View style={{marginTop: 4, flexDirection:'row', alignItems:'center', gap: 4}}>
                             <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: isCompleted ? '#10b981' : '#f59e0b'}} />
                             <Text style={{fontSize: 12, color: colors.textMuted}}>{item.status.replace('_', ' ')}</Text>
                        </View>
                    </View>
                    <View style={{alignItems:'flex-end'}}>
                        <Text style={[styles.amount, {color: isPayout ? '#10b981' : '#ef4444'}]}>
                            {isPayout ? '+' : '-'} ₹{item.amount.toFixed(2)}
                        </Text>
                        <Text style={{fontSize: 10, color: colors.textMuted, fontWeight:'bold'}}>{item.type}</Text>
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
                            <Text style={{color: colors.textMuted, marginTop: 12}}>No settlement history.</Text>
                        </View>
                    }
                />
            )}

            {selectedSettlement && (
                <HistoryDetailModalFixed
                    settlement={selectedSettlement}
                    visible={!!selectedSettlement}
                    onClose={() => {
                        setSelectedSettlement(null);
                        fetchHistory();
                    }}
                />
            )}
        </>
    );
}

// Fixed Modal Component
function HistoryDetailModalFixed({ settlement, visible, onClose }: { settlement: any, visible: boolean, onClose: () => void }) {
    const { colors } = useTheme();
    const [processing, setProcessing] = useState(false);
    const [details, setDetails] = useState<any>(null); // For fetching full booking list
    const [loadingDetails, setLoadingDetails] = useState(true);

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

    const handleMarkComplete = async () => {
        setProcessing(true);
        try {
            await api.post(`/finance/settlements/${settlement._id}/complete`);
            Alert.alert("Success", "Settlement marked as completed.");
            onClose();
        } catch (e) {
            Alert.alert("Error", "Failed to update status.");
        } finally {
            setProcessing(false);
        }
    };

    const isPayout = settlement.type === 'PAYOUT';
    const isPending = settlement.status.includes('PENDING');

    // --- Calculation Logic ---
    let totalOnlineRevenue = 0;
    let totalCashCommission = 0;

    if (details && details.bookings) {
        details.bookings.forEach((b: any) => {
            if (b.amountCollectedBy === 'ADMIN') {
                totalOnlineRevenue += (b.barberNetRevenue || 0);
            } else {
                totalCashCommission += (b.adminNetRevenue || 0);
            }
        });
    }

    return (
         <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={[styles.modalContainer, {backgroundColor: colors.background}]}>
                 <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, {color: colors.text}]}>Settlement Receipt</Text>
                    <TouchableOpacity onPress={onClose} style={{padding: 4}}>
                        <X size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>

                <ScrollView style={{flex: 1}} contentContainerStyle={{paddingBottom: 100}}>
                    <View style={{alignItems:'center', marginVertical: 20}}>
                         <View style={{width: 60, height: 60, borderRadius: 30, backgroundColor: isPayout ? '#d1fae5' : '#fee2e2', alignItems:'center', justifyContent:'center', marginBottom: 12}}>
                             {isPayout ? <DollarSign color="#10b981" size={28} /> : <CreditCard color="#ef4444" size={28} />}
                         </View>
                         <Text style={{color: colors.textMuted, textTransform:'uppercase', letterSpacing: 1, fontSize: 12}}>{settlement.type}</Text>
                         <Text style={{color: colors.text, fontSize: 32, fontWeight:'bold'}}>₹{settlement.amount.toFixed(2)}</Text>
                         <Text style={{color: colors.textMuted, marginTop: 4}}>{format(new Date(settlement.createdAt), 'dd MMM yyyy • hh:mm a')}</Text>
                         <Text style={{color: colors.text, marginTop: 8, fontWeight:'bold', fontSize: 16, textTransform: 'uppercase'}}>{settlement.status.replace('_', ' ')}</Text>
                    </View>

                    <View style={{padding: 20, backgroundColor: colors.card, borderRadius: 12, marginBottom: 20}}>
                        <Text style={{color: colors.text, marginBottom: 8}}>Settlement ID: {settlement._id}</Text>
                        <Text style={{color: colors.text, marginBottom: 8}}>Shop: {settlement.shopId?.name}</Text>
                        <Text style={{color: colors.textMuted}}>Notes: {settlement.notes || 'Auto-generated'}</Text>

                        {!loadingDetails && details && (
                            <View style={{marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderColor: colors.border}}>
                                <Text style={{color: colors.text, fontWeight: 'bold', marginBottom: 8}}>Calculation Summary:</Text>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4}}>
                                    <Text style={{color: colors.textMuted}}>Online Revenue (Held by Admin)</Text>
                                    <Text style={{color: '#10b981'}}>+₹{totalOnlineRevenue.toFixed(2)}</Text>
                                </View>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8}}>
                                    <Text style={{color: colors.textMuted}}>Cash Commission (Owed to Admin)</Text>
                                    <Text style={{color: '#ef4444'}}>-₹{totalCashCommission.toFixed(2)}</Text>
                                </View>
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: colors.border, paddingTop: 4}}>
                                    <Text style={{color: colors.text, fontWeight: 'bold'}}>Net Settlement</Text>
                                    <Text style={{color: colors.text, fontWeight: 'bold'}}>
                                        {totalOnlineRevenue - totalCashCommission >= 0 ? '+' : '-'}₹{Math.abs(totalOnlineRevenue - totalCashCommission).toFixed(2)}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>

                    <Text style={[styles.sectionTitle, {color: colors.textMuted, marginLeft: 20}]}>Included Bookings</Text>

                    {loadingDetails ? (
                        <ActivityIndicator color={colors.tint} style={{marginTop: 20}} />
                    ) : details?.bookings ? (
                        details.bookings.map((b: any, i: number) => (
                             <View key={i} style={[styles.rowCard, {borderColor: colors.border, marginHorizontal: 20}]}>
                                <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                                    <Text style={{color: colors.text, fontWeight:'bold'}}>{format(new Date(b.date), 'dd MMM')} • {b.startTime}</Text>
                                    <Text style={{color: colors.text}}>₹{b.finalPrice}</Text>
                                </View>
                                <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 2}}>{b.serviceNames?.join(', ')}</Text>
                                <View style={{marginTop: 4, flexDirection:'row', justifyContent:'space-between'}}>
                                    <Text style={{fontSize: 10, color: b.amountCollectedBy === 'ADMIN' ? '#10b981' : '#f59e0b', fontWeight:'bold'}}>
                                        {b.amountCollectedBy === 'ADMIN' ? 'Paid Online' : 'Paid Cash'}
                                    </Text>
                                    <Text style={{fontSize: 10, color: colors.textMuted}}>
                                        Net: ₹{b.amountCollectedBy === 'ADMIN' ? b.barberNetRevenue : b.adminNetRevenue}
                                    </Text>
                                </View>
                             </View>
                        ))
                    ) : (
                        <Text style={{color: colors.textMuted, textAlign:'center', marginTop: 20}}>No details available.</Text>
                    )}
                </ScrollView>

                {isPending && isPayout && (
                    <View style={[styles.footer, {backgroundColor: colors.background, borderTopColor: colors.border}]}>
                        <TouchableOpacity
                            style={[styles.fullBtn, {backgroundColor: colors.tint}]}
                            onPress={handleMarkComplete}
                            disabled={processing}
                        >
                            {processing ? <ActivityIndicator color="black" /> : <Text style={styles.btnText}>Mark Payout Sent</Text>}
                        </TouchableOpacity>
                    </View>
                )}
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

  card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shopName: { fontWeight: 'bold', fontSize: 16 },
  amount: { fontSize: 16, fontWeight: 'bold' },

  modalContainer: { flex: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, marginTop: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },

  footer: { padding: 20, position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1 },
  fullBtn: { width: '100%', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { fontWeight: 'bold', color: '#0f172a', fontSize: 16 }
});
