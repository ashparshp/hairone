import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  ScrollView,
  Switch,
  RefreshControl
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';
import { ChevronLeft, Plus, Clock, IndianRupee, Scissors, Layers, Edit } from 'lucide-react-native';
import { FadeInView } from '../../components/AnimatedViews';

export default function ManageServicesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, theme } = useTheme();
  
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [combos, setCombos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'services' | 'combos'>('services');

  useFocusEffect(
    useCallback(() => {
      fetchShop();
    }, [])
  );

  const fetchShop = async () => {
    // @ts-ignore
    if (!user?.myShopId) return;
    try {
      // @ts-ignore
      const res = await api.get(`/shops/${user.myShopId}`);
      const s = res.data.shop;
      setShop(s);
      setServices(s.services || []);
      setCombos(s.combos || []);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Failed to load shop details");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
      setRefreshing(true);
      fetchShop();
  };

  const handleToggleService = async (serviceId: string, currentStatus: boolean) => {
    try {
      const res = await api.put(`/shops/${shop._id}/services/${serviceId}`, {
        isAvailable: !currentStatus
      });
      setServices(res.data.services);
    } catch (e) {
      Alert.alert("Error", "Failed to update status");
    }
  };

  const handleToggleCombo = async (comboId: string, currentStatus: boolean) => {
      try {
          const res = await api.put(`/shops/${shop._id}/combos/${comboId}`, {
              isAvailable: !currentStatus
          });
          setCombos(res.data.combos || []);
      } catch (e) {
          Alert.alert("Error", "Failed to update status");
      }
  };

  if (loading) return <View style={[styles.center, {backgroundColor: colors.background}]}><ActivityIndicator color={colors.tint} /></View>;

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
         <TouchableOpacity onPress={() => router.back()} style={[styles.iconBtn, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <ChevronLeft size={24} color={colors.text}/>
         </TouchableOpacity>
         <Text style={[styles.title, {color: colors.text}]}>Manage Menu</Text>
         <TouchableOpacity
            onPress={() => {
                if (activeTab === 'services') router.push('/salon/service-form' as any);
                else router.push('/salon/combo-form' as any);
            }}
            style={[styles.createBtn, {backgroundColor: colors.tint}]}
         >
             <Plus size={20} color="#0f172a" />
         </TouchableOpacity>
      </View>
      
      {/* TABS */}
      <View style={styles.tabs}>
          <TouchableOpacity
             style={[styles.tab, activeTab === 'services' && { backgroundColor: colors.tint }]}
             onPress={() => setActiveTab('services')}
          >
              <Text style={[styles.tabText, activeTab === 'services' ? {color: '#000'} : {color: colors.text}]}>Services</Text>
          </TouchableOpacity>
          <TouchableOpacity
             style={[styles.tab, activeTab === 'combos' && { backgroundColor: colors.tint }]}
             onPress={() => setActiveTab('combos')}
          >
              <Text style={[styles.tabText, activeTab === 'combos' ? {color: '#000'} : {color: colors.text}]}>Combos</Text>
          </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{paddingBottom: 40}}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.tint} />}
      >
        
        {/* --- SECTION: SERVICES --- */}
        {activeTab === 'services' && (
        <FadeInView>
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Services List ({services.length})</Text>

                <View style={{marginBottom: 20}}>
                {services.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Scissors size={48} color={colors.textMuted} />
                        <Text style={{color: colors.textMuted, marginTop: 12}}>No services added yet.</Text>
                        <TouchableOpacity onPress={() => router.push('/salon/service-form' as any)} style={{marginTop: 12}}>
                            <Text style={{color: colors.tint, fontWeight:'bold'}}>Create First Service</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    services.map((item, index) => (
                        <TouchableOpacity
                            key={index}
                            style={[styles.serviceItem, {backgroundColor: colors.card, borderColor: colors.border}, item.isAvailable === false && {opacity: 0.6}]}
                            onPress={() => router.push({ pathname: '/salon/service-form', params: { id: item._id } } as any)}
                        >
                            <View style={[styles.serviceIcon, item.isAvailable === false && {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}>
                            <Scissors size={20} color={item.isAvailable !== false ? colors.tint : colors.textMuted} />
                            </View>
                            <View style={{flex: 1}}>
                                <Text style={[styles.serviceName, {color: colors.text}, item.isAvailable === false && {color: colors.textMuted, textDecorationLine: 'line-through'}]}>{item.name}</Text>
                                <View style={{flexDirection: 'row', gap: 12, marginTop: 4}}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                    <Clock size={12} color={colors.textMuted} />
                                    <Text style={[styles.serviceDetails, {color: colors.textMuted}]}>{item.duration} min</Text>
                                    </View>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                                    <IndianRupee size={12} color={colors.textMuted} />
                                    <Text style={[styles.serviceDetails, {color: colors.textMuted}]}>{item.price}</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                                <Switch
                                    value={item.isAvailable !== false}
                                    onValueChange={() => handleToggleService(item._id, item.isAvailable !== false)}
                                    trackColor={{false: colors.border, true: colors.tint}}
                                    thumbColor={item.isAvailable !== false ? "#0f172a" : "#94a3b8"}
                                />
                                <Edit size={16} color={colors.textMuted} />
                            </View>
                        </TouchableOpacity>
                    ))
                )}
                </View>
            </View>
        </FadeInView>
        )}

        {/* --- SECTION: COMBOS --- */}
        {activeTab === 'combos' && (
        <FadeInView>
            <View style={styles.section}>
                <Text style={[styles.sectionTitle, {color: colors.text}]}>Combos List ({combos.length})</Text>

                <View style={{marginBottom: 20}}>
                    {combos.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Layers size={48} color={colors.textMuted} />
                            <Text style={{color: colors.textMuted, marginTop: 12}}>No combos created yet.</Text>
                            <TouchableOpacity onPress={() => router.push('/salon/combo-form' as any)} style={{marginTop: 12}}>
                                <Text style={{color: colors.tint, fontWeight:'bold'}}>Create First Combo</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        combos.map((item, index) => (
                            <TouchableOpacity
                                key={index}
                                style={[styles.serviceItem, {backgroundColor: colors.card, borderColor: colors.border}, item.isAvailable === false && {opacity: 0.6}]}
                                onPress={() => router.push({ pathname: '/salon/combo-form', params: { id: item._id } } as any)}
                            >
                                <View style={[styles.serviceIcon, item.isAvailable === false && {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}>
                                    <Layers size={20} color={item.isAvailable !== false ? colors.tint : colors.textMuted} />
                                </View>
                                <View style={{flex: 1}}>
                                    <Text style={[styles.serviceName, {color: colors.text}, item.isAvailable === false && {color: colors.textMuted, textDecorationLine: 'line-through'}]}>{item.name}</Text>
                                    <View style={{flexDirection: 'row', gap: 12, marginTop: 4}}>
                                        <Text style={[styles.serviceDetails, {color: colors.textMuted}]}>{item.duration} min</Text>
                                        <Text style={[styles.serviceDetails, {color: colors.tint, fontWeight: 'bold'}]}>₹{item.price}</Text>
                                        <Text style={[styles.serviceDetails, {color: colors.textMuted, textDecorationLine: 'line-through'}]}>₹{item.originalPrice}</Text>
                                    </View>
                                    <Text style={{fontSize: 10, color: colors.textMuted, marginTop: 4}}>
                                        {item.items?.length || 0} services
                                    </Text>
                                </View>
                                <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                                    <Switch
                                        value={item.isAvailable !== false}
                                        onValueChange={() => handleToggleCombo(item._id, item.isAvailable !== false)}
                                        trackColor={{false: colors.border, true: colors.tint}}
                                        thumbColor={item.isAvailable !== false ? "#0f172a" : "#94a3b8"}
                                    />
                                    <Edit size={16} color={colors.textMuted} />
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </View>
            </View>
        </FadeInView>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1 },
  title: { fontSize: 24, fontWeight: 'bold', flex: 1 },
  createBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  
  tabs: { flexDirection: 'row', marginBottom: 20, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#334155' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontWeight: 'bold' },

  section: { marginBottom: 30 },
  sectionTitle: { marginBottom: 12, fontSize: 16, fontWeight:'bold' },
  
  // Service Item
  serviceItem: { flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 10, borderRadius: 16, borderWidth: 1 },
  serviceIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(245, 158, 11, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  serviceName: { fontWeight: 'bold', fontSize: 16 },
  serviceDetails: { fontSize: 12 },

  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 40 },
});
