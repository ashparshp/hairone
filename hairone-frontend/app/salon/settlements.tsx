import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, Info } from 'lucide-react-native';
import { format } from 'date-fns';
import { FadeInView } from '../../components/AnimatedViews';

export default function ShopSettlementScreen() {
    const router = useRouter();
    const { user } = useAuth();
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);
    const [activeTab, setActiveTab] = useState<'online' | 'offline'>('online');

    // Stats
    const [summary, setSummary] = useState({
        adminOwesShop: 0,
        shopOwesAdmin: 0,
        net: 0
    });

    useEffect(() => {
        fetchDetails();
    }, []);

    const fetchDetails = async () => {
        try {
            // @ts-ignore
            const res = await api.get(`/shops/${user.myShopId}/finance/pending`);
            const data = res.data;
            setBookings(data);
            calculateSummary(data);
        } catch (e) {
            console.log(e);
        } finally {
            setLoading(false);
        }
    };

    const calculateSummary = (data: any[]) => {
        let adminOwes = 0;
        let shopOwes = 0;

        data.forEach(b => {
            if (b.amountCollectedBy === 'ADMIN') {
                adminOwes += (Number(b.barberNetRevenue) || 0);
            } else {
                shopOwes += (Number(b.adminNetRevenue) || 0);
            }
        });

        setSummary({
            adminOwesShop: adminOwes,
            shopOwesAdmin: shopOwes,
            net: adminOwes - shopOwes
        });
    };

    const filteredBookings = bookings.filter(b =>
        activeTab === 'online' ? b.amountCollectedBy === 'ADMIN' : b.amountCollectedBy === 'BARBER'
    );

    const renderItem = ({ item }: { item: any }) => {
        const isOnline = item.amountCollectedBy === 'ADMIN';
        // For Online: Show "Payout" (Barber Net). For Offline: Show "Commission" (Admin Net).
        const relevantAmount = isOnline ? item.barberNetRevenue : item.adminNetRevenue;

        return (
            <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
                <View style={{flexDirection:'row', justifyContent:'space-between', marginBottom: 8}}>
                    <Text style={{color: colors.text, fontWeight:'bold'}}>
                        {format(new Date(item.date), 'dd MMM')} • {item.startTime}
                    </Text>
                    <View style={{backgroundColor: isOnline ? '#dbeafe' : '#fef9c3', paddingHorizontal: 6, borderRadius: 4}}>
                         <Text style={{fontSize: 10, color: isOnline ? '#1e40af' : '#854d0e', fontWeight:'bold'}}>
                             {isOnline ? 'ONLINE' : 'CASH'}
                         </Text>
                    </View>
                </View>

                <Text style={{color: colors.textMuted, fontSize: 12, marginBottom: 8}}>
                    {item.serviceNames.join(', ')} • {item.userId?.name || 'Guest'}
                </Text>

                <View style={styles.divider} />

                {/* Detailed Breakdown */}
                <View style={styles.row}>
                    <Text style={{color: colors.textMuted, fontSize: 12}}>Total Bill</Text>
                    <Text style={{color: colors.text, fontSize: 12}}>₹{item.finalPrice}</Text>
                </View>
                <View style={styles.row}>
                    <Text style={{color: colors.textMuted, fontSize: 12}}>Discount</Text>
                    <Text style={{color: colors.text, fontSize: 12}}>- ₹{item.discountAmount || 0}</Text>
                </View>
                 <View style={styles.row}>
                    <Text style={{color: colors.textMuted, fontSize: 12}}>Commission</Text>
                    <Text style={{color: colors.text, fontSize: 12}}>- ₹{item.adminCommission || 0}</Text>
                </View>

                <View style={[styles.divider, {marginVertical: 4}]} />

                <View style={styles.row}>
                    <Text style={{color: colors.text, fontWeight:'bold'}}>
                        {isOnline ? "Net Payout" : "Commission Due"}
                    </Text>
                    <Text style={{color: isOnline ? '#10b981' : '#ef4444', fontWeight:'bold'}}>
                        ₹{Number(relevantAmount || 0).toFixed(2)}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, {backgroundColor: colors.background}]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={colors.text}/>
                </TouchableOpacity>
                <Text style={[styles.title, {color: colors.text}]}>Settlement Details</Text>
            </View>

            {/* Summary Header */}
            <View style={[styles.summaryCard, {backgroundColor: colors.card, borderColor: summary.net >= 0 ? '#10b981' : '#ef4444'}]}>
                 <Text style={{color: colors.textMuted, fontSize: 12, textTransform:'uppercase'}}>Net Balance</Text>
                 <Text style={{color: summary.net >= 0 ? '#10b981' : '#ef4444', fontSize: 28, fontWeight:'bold'}}>
                     {summary.net >= 0 ? '+' : '-'} ₹{Math.abs(summary.net).toFixed(2)}
                 </Text>
                 <Text style={{color: colors.textMuted, fontSize: 12, marginTop: 4}}>
                     {summary.net >= 0 ? "Admin owes you" : "You owe Admin"}
                 </Text>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'online' && {borderBottomColor: colors.tint}]}
                    onPress={() => setActiveTab('online')}
                >
                    <Text style={[styles.tabText, {color: activeTab === 'online' ? colors.tint : colors.textMuted}]}>
                        Online (Receivables)
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'offline' && {borderBottomColor: colors.tint}]}
                    onPress={() => setActiveTab('offline')}
                >
                    <Text style={[styles.tabText, {color: activeTab === 'offline' ? colors.tint : colors.textMuted}]}>
                        Offline (Payables)
                    </Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color={colors.tint} style={{marginTop: 50}} />
            ) : (
                <FlatList
                    data={filteredBookings}
                    renderItem={renderItem}
                    keyExtractor={(item) => item._id}
                    contentContainerStyle={{paddingBottom: 40}}
                    ListEmptyComponent={
                        <View style={{alignItems:'center', marginTop: 50}}>
                            <Info size={40} color={colors.textMuted} />
                            <Text style={{color: colors.textMuted, marginTop: 12}}>No pending bookings in this category.</Text>
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
    title: { fontSize: 20, fontWeight: 'bold' },

    summaryCard: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 20, alignItems:'center' },

    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#334155', marginBottom: 12 },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabText: { fontWeight: 'bold', fontSize: 12 },

    card: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    divider: { height: 1, backgroundColor: '#334155', marginVertical: 8, opacity: 0.5 }
});
