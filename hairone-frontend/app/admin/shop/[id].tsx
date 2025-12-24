import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../services/api';
import { ArrowLeft, Ban, Calendar, CheckCircle, Clock, DollarSign, MapPin, Phone, ShieldCheck, User, Image as ImageIcon } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { FadeInView } from '../../../components/AnimatedViews';

export default function AdminShopDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors, theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [shop, setShop] = useState<any>(null);
  const [owner, setOwner] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [bookings, setBookings] = useState([]);

  const [activeTab, setActiveTab] = useState<'overview' | 'revenue' | 'bookings'>('overview');

  // Revenue State
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);
  const [customRevenue, setCustomRevenue] = useState<number | null>(null);

  useEffect(() => {
    fetchDetails();
  }, [id]);

  const fetchDetails = async () => {
    try {
      // 1. Basic Info (Public endpoint or Admin specific? Public is fine)
      const shopRes = await api.get(`/shops/${id}`);
      setShop(shopRes.data.shop);
      // We need owner details, which are populated in shopRes or fetch separately?
      // shopRes.data.shop.ownerId is just ID if not populated deep enough.
      // Actually Admin `getAllShops` populates ownerId. `getShopDetails` populates barbers.
      // Let's assume we might need to fetch user separately or trust what we have.
      // Ideally, let's hit the revenue endpoint which we just secured.

      // 2. Revenue Stats
      const revRes = await api.get(`/shops/${id}/revenue`);
      setStats(revRes.data);

      // 3. Bookings
      const bookRes = await api.get(`/admin/shops/${id}/bookings`);
      setBookings(bookRes.data);

    } catch (e) {
      Alert.alert("Error", "Failed to fetch shop details");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const calculateCustom = async () => {
    try {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");
      const res = await api.get(`/shops/${id}/revenue`, {
        params: { startDate: startStr, endDate: endStr },
      });
      setCustomRevenue(res.data.custom);
    } catch (e) {
      Alert.alert("Error", "Failed to calculate");
    }
  };

  const handleSuspend = async () => {
      // Logic for suspension could be here or passed from dashboard.
      // For now, let's keep suspension in Dashboard to avoid duplicating the modal logic
      // or implement a simple confirm here if needed.
      Alert.alert("Info", "Please use the Dashboard to suspend shops.");
  };

  if (loading) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator size="large" color={colors.tint} /></View>;

  const StatCard = ({ title, amount, color }: any) => (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderLeftColor: color }]}>
       <Text style={[styles.statTitle, {color: colors.textMuted}]}>{title}</Text>
       <Text style={[styles.statAmount, {color: colors.text}]}>₹{amount?.toLocaleString()}</Text>
    </View>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
       {/* Header */}
       <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
             <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
             <Text style={[styles.shopName, {color: colors.text}]}>{shop?.name}</Text>
             <Text style={[styles.shopAddress, {color: colors.textMuted}]}>{shop?.address}</Text>
          </View>
          <View style={[styles.statusBadge, {backgroundColor: shop?.isDisabled ? '#ef4444' : '#10b981'}]}>
             <Text style={styles.statusText}>{shop?.isDisabled ? 'SUSPENDED' : 'ACTIVE'}</Text>
          </View>
       </View>

       {/* Tabs */}
       <View style={[styles.tabs, {borderColor: colors.border}]}>
          {['overview', 'revenue', 'bookings'].map((tab) => (
             <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && {borderBottomColor: colors.tint}]}
                onPress={() => setActiveTab(tab as any)}
             >
                <Text style={[
                    styles.tabText,
                    {color: activeTab === tab ? colors.tint : colors.textMuted}
                ]}>
                    {tab.toUpperCase()}
                </Text>
             </TouchableOpacity>
          ))}
       </View>

       <ScrollView contentContainerStyle={{padding: 20}}>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
             <FadeInView>
             <View style={{gap: 20}}>
                <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
                    <Text style={[styles.sectionTitle, {color: colors.text}]}>Owner Details</Text>
                    {/* Note: In real app, we need to ensure ownerId is populated.
                        If `getShopDetails` didn't populate it deeply, we might miss phone/email here.
                        We can assume it's available or fetch it if needed.
                    */}
                    <View style={styles.row}>
                       <User size={16} color={colors.textMuted} />
                       <Text style={{color: colors.text}}>ID: {shop?.ownerId}</Text>
                    </View>
                </View>

                <TouchableOpacity
                   style={[styles.actionBtn, {backgroundColor: colors.tint}]}
                   onPress={() => router.push({ pathname: '/salon/manage-gallery', params: { shopId: id } } as any)}
                >
                    <ImageIcon size={18} color="black" />
                    <Text style={{color: 'black', fontWeight:'bold'}}>Manage Gallery</Text>
                </TouchableOpacity>

                <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
                   <Text style={[styles.sectionTitle, {color: colors.text}]}>Configuration</Text>
                   <View style={styles.infoRow}>
                      <Text style={{color: colors.textMuted}}>Type</Text>
                      <Text style={{color: colors.text, textTransform:'capitalize'}}>{shop?.type}</Text>
                   </View>
                   <View style={styles.infoRow}>
                      <Text style={{color: colors.textMuted}}>Buffer Time</Text>
                      <Text style={{color: colors.text}}>{shop?.bufferTime} mins</Text>
                   </View>
                   <View style={styles.infoRow}>
                      <Text style={{color: colors.textMuted}}>Auto Approve</Text>
                      <Text style={{color: colors.text}}>{shop?.autoApproveBookings ? 'Yes' : 'No'}</Text>
                   </View>
                </View>
             </View>
             </FadeInView>
          )}

          {/* REVENUE TAB */}
          {activeTab === 'revenue' && (
             <FadeInView>
             <View style={{gap: 16}}>
                <View style={styles.grid}>
                   <StatCard title="This Week" amount={stats?.weekly} color="#3b82f6" />
                   <StatCard title="This Month" amount={stats?.monthly} color="#8b5cf6" />
                   <StatCard title="This Year" amount={stats?.yearly} color="#10b981" />
                </View>

                <View style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}>
                   <Text style={[styles.sectionTitle, {color: colors.text}]}>Custom Calculator</Text>

                   <View style={{flexDirection:'row', gap: 12, marginVertical: 12}}>
                      <TouchableOpacity onPress={() => setShowStart(true)} style={[styles.dateInput, {borderColor: colors.border}]}>
                          <Calendar size={16} color={colors.textMuted} />
                          <Text style={{color: colors.text}}>{format(startDate, 'dd MMM')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setShowEnd(true)} style={[styles.dateInput, {borderColor: colors.border}]}>
                          <Calendar size={16} color={colors.textMuted} />
                          <Text style={{color: colors.text}}>{format(endDate, 'dd MMM')}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={{backgroundColor: colors.tint, padding: 10, borderRadius: 8, justifyContent:'center'}} onPress={calculateCustom}>
                          <Text style={{fontWeight:'bold', color: '#0f172a'}}>Go</Text>
                      </TouchableOpacity>
                   </View>

                   {(showStart || showEnd) && (Platform.OS === 'ios' || showStart) && (
                       <DateTimePicker
                          value={showStart ? startDate : endDate}
                          mode="date"
                          display="default"
                          onChange={(e, d) => {
                             if(showStart) { setShowStart(Platform.OS === 'ios'); d && setStartDate(d); }
                             else { setShowEnd(Platform.OS === 'ios'); d && setEndDate(d); }
                          }}
                       />
                   )}

                   {customRevenue !== null && (
                       <View style={{marginTop: 12, padding: 12, backgroundColor: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', borderRadius: 8}}>
                          <Text style={{color: colors.textMuted}}>Revenue for Period</Text>
                          <Text style={{fontSize: 24, fontWeight: 'bold', color: colors.tint}}>₹{customRevenue.toLocaleString()}</Text>
                       </View>
                   )}
                </View>
             </View>
             </FadeInView>
          )}

          {/* BOOKINGS TAB */}
          {activeTab === 'bookings' && (
             <FadeInView>
             <View>
                <Text style={{color: colors.textMuted, marginBottom: 12}}>Recent 50 Bookings</Text>
                {bookings.map((b: any) => (
                   <View key={b._id} style={[styles.bookingItem, {borderBottomColor: colors.border}]}>
                      <View>
                         <Text style={{color: colors.text, fontWeight:'bold'}}>{b.serviceNames?.join(', ') || 'Service'}</Text>
                         <Text style={{color: colors.textMuted, fontSize: 12}}>{b.date} • {b.startTime}</Text>
                         <Text style={{color: colors.textMuted, fontSize: 12}}>{b.userId?.name || 'Walk-in/Guest'}</Text>
                      </View>
                      <View style={{alignItems:'flex-end'}}>
                         <Text style={{color: colors.tint, fontWeight:'bold'}}>₹{b.totalPrice}</Text>
                         <Text style={{
                            color: b.status === 'completed' ? '#10b981' : b.status === 'cancelled' ? '#ef4444' : '#eab308',
                            fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', marginTop: 4
                         }}>{b.status}</Text>
                      </View>
                   </View>
                ))}
             </View>
             </FadeInView>
          )}

       </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20, gap: 12 },
  backBtn: { padding: 4 },
  shopName: { fontSize: 20, fontWeight: 'bold' },
  shopAddress: { fontSize: 12 },
  statusBadge: { marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { color: 'white', fontSize: 10, fontWeight: 'bold' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent' },
  tabText: { fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },

  card: { padding: 20, borderRadius: 12, borderWidth: 1, marginBottom: 16 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 12, fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },

  // Stats
  grid: { gap: 12, marginBottom: 16 },
  statCard: { padding: 16, borderRadius: 12, borderLeftWidth: 4 },
  statTitle: { fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 4 },
  statAmount: { fontSize: 24, fontWeight: 'bold' },

  dateInput: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderWidth: 1, borderRadius: 8, flex: 1 },

  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16, borderRadius: 12, marginBottom: 16 },

  // Bookings
  bookingItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
});
