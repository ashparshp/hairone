import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Image, Modal, KeyboardAvoidingView, Platform, TextInput, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import api from '../../../services/api';
import { Ban, ShoppingBag, ShieldAlert } from 'lucide-react-native';
import { FadeInView } from '../../../components/AnimatedViews';

export default function AdminShops() {
  const { colors, theme } = useTheme();
  const router = useRouter();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  // Suspension Modal
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');

  useFocusEffect(
    React.useCallback(() => {
        fetchData();
    }, [])
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/shops');
      setShops(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const openSuspendModal = (shopId: string) => {
    setSelectedShopId(shopId);
    setSuspendReason('');
    setSuspendModalVisible(true);
  };

  const handleSuspend = async () => {
    if (!selectedShopId || !suspendReason.trim()) return;
    try {
      await api.post(`/admin/shops/${selectedShopId}/suspend`, { reason: suspendReason });
      Alert.alert("Suspended", "Shop has been suspended and upcoming bookings cancelled.");
      setSuspendModalVisible(false);
      fetchData();
    } catch (e) {
      Alert.alert("Error", "Failed to suspend shop");
    }
  };

  const renderShop = ({ item, index }: { item: any, index: number }) => (
    <FadeInView delay={index * 50}>
    <TouchableOpacity
      style={[styles.card, {backgroundColor: colors.card, borderColor: colors.border}]}
      onPress={() => router.push(`/admin/shop/${item._id}` as any)}
    >
        <View style={{flexDirection:'row', alignItems:'center', gap: 12}}>
            <Image source={{ uri: item.image || 'https://via.placeholder.com/100' }} style={{width: 50, height: 50, borderRadius: 8}} />
            <View style={{flex:1}}>
                <Text style={[styles.bizName, {color: colors.text}]}>{item.name}</Text>
                <Text style={[styles.userName, {color: colors.textMuted}]}>{item.address}</Text>
            </View>
            {!item.isDisabled && (
              <TouchableOpacity style={styles.suspendBtn} onPress={() => openSuspendModal(item._id)}>
                <Ban size={16} color="#ef4444" />
              </TouchableOpacity>
            )}
        </View>
        <View style={{marginTop: 12, flexDirection:'row', justifyContent:'space-between'}}>
            <Text style={{color: colors.textMuted}}>Owner: {item.ownerId?.name || 'Unknown'}</Text>
            <Text style={{color: colors.textMuted}}>
              {item.isDisabled ? <Text style={{color: '#ef4444', fontWeight:'bold'}}>SUSPENDED</Text> : item.ownerId?.phone}
            </Text>
        </View>
    </TouchableOpacity>
    </FadeInView>
  );

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <Text style={[styles.headerTitle, {color: colors.text}]}>Managed Shops</Text>
      <Text style={[styles.subtitle, {color: colors.textMuted}]}>View and manage all active partners.</Text>

      {loading ? (
        <ActivityIndicator color={colors.tint} style={{marginTop: 50}} />
      ) : (
        <FlatList
            data={shops}
            renderItem={renderShop}
            keyExtractor={(item: any) => item._id}
            contentContainerStyle={{paddingBottom: 20, paddingTop: 20}}
            ListEmptyComponent={
                <View style={{alignItems: 'center', marginTop: 50, opacity: 0.5}}>
                    <ShoppingBag size={48} color={colors.textMuted} />
                    <Text style={{color: colors.textMuted, marginTop: 10}}>No active shops.</Text>
                </View>
            }
        />
      )}

      {/* Suspend Modal */}
      <Modal
        visible={suspendModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSuspendModalVisible(false)}
      >
        <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalOverlay}
        >
        <View style={[styles.modalContent, {backgroundColor: colors.card, borderColor: colors.border}]}>
            <View style={styles.modalHeader}>
                <ShieldAlert size={24} color="#ef4444" />
                <Text style={[styles.modalTitle, {color: colors.text}]}>Suspend Shop</Text>
            </View>
            <Text style={[styles.modalSub, {color: colors.textMuted}]}>
                This will hide the shop from users and cancel all upcoming bookings. Action is reversible by re-approving the owner.
            </Text>

            <TextInput
                style={[styles.input, {backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc', color: colors.text, borderColor: colors.border}]}
                placeholder="Reason for suspension..."
                placeholderTextColor={colors.textMuted}
                multiline
                value={suspendReason}
                onChangeText={setSuspendReason}
            />

            <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.cancelBtn, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]} onPress={() => setSuspendModalVisible(false)}>
                    <Text style={{color: colors.text, fontWeight: 'bold'}}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmSuspendBtn} onPress={handleSuspend}>
                    <Text style={styles.suspendText}>Confirm Suspension</Text>
                </TouchableOpacity>
            </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 14, marginBottom: 10 },

  card: { padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  bizName: { fontWeight: 'bold', fontSize: 18 },
  userName: { fontSize: 14, marginTop: 2 },
  suspendBtn: { padding: 8, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: 16, padding: 20, borderWidth: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: 'bold' },
  modalSub: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, height: 100, textAlignVertical: 'top', marginBottom: 20 },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 10 },
  confirmSuspendBtn: { flex: 1, padding: 14, alignItems: 'center', borderRadius: 10, backgroundColor: '#ef4444' },
  suspendText: { color: 'white', fontWeight: 'bold' }
});
