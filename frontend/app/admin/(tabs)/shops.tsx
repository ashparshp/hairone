import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import api from "../../../services/api";
import { Ban, ShoppingBag, ShieldAlert, PlayCircle } from "lucide-react-native";
import { FadeInView } from "../../../components/AnimatedViews";
import { RemoteImage } from "../../../components/RemoteImage";

export default function AdminShops() {
  const { colors } = useTheme();
  const router = useRouter();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "suspended">("all");

  // Suspension Modal
  const [suspendModalVisible, setSuspendModalVisible] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, []),
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/admin/shops");
      setShops(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const openSuspendModal = (shopId: string) => {
    setSelectedShopId(shopId);
    setSuspendReason("");
    setSuspendModalVisible(true);
  };

  const handleSuspend = async () => {
    if (!selectedShopId || !suspendReason.trim()) return;
    try {
      await api.post(`/admin/shops/${selectedShopId}/suspend`, {
        reason: suspendReason,
      });
      Alert.alert(
        "Suspended",
        "Shop has been suspended and upcoming bookings cancelled.",
      );
      setSuspendModalVisible(false);
      fetchData();
    } catch (e) {
      Alert.alert("Error", "Failed to suspend shop");
    }
  };

  const handleReactivate = async (shopId: string) => {
    try {
      await api.post(`/admin/shops/${shopId}/activate`);
      Alert.alert("Success", "Shop reactivated successfully.");
      fetchData();
    } catch (e) {
      Alert.alert("Error", "Failed to reactivate shop.");
    }
  };

  const suspendedCount = shops.filter((shop: any) => shop.isDisabled).length;
  const activeCount = shops.length - suspendedCount;

  const filteredShops = shops.filter((shop: any) => {
    if (filter === "active") return !shop.isDisabled;
    if (filter === "suspended") return shop.isDisabled;
    return true;
  });

  const renderShop = ({ item, index }: { item: any; index: number }) => (
    <FadeInView delay={index * 50}>
      <TouchableOpacity
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        onPress={() => router.push(`/admin/shop/${item._id}` as any)}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <RemoteImage
            uri={item.image}
            style={{ width: 50, height: 50, borderRadius: 8 }}
            resizeMode="cover"
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bizName, { color: colors.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.userName, { color: colors.textMuted }]}>
              {item.address}
            </Text>
          </View>
          {item.isDisabled ? (
            <TouchableOpacity
              style={styles.activateBtn}
              onPress={() => handleReactivate(item._id)}
            >
              <PlayCircle size={16} color={colors.statusSuccess} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.suspendBtn}
              onPress={() => openSuspendModal(item._id)}
            >
              <Ban size={16} color={colors.statusDanger} />
            </TouchableOpacity>
          )}
        </View>
        <View
          style={{
            marginTop: 12,
            flexDirection: "row",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ color: colors.textMuted }}>
            Owner: {item.ownerId?.name || "Unknown"}
          </Text>
          <Text style={{ color: colors.textMuted }}>
            {item.isDisabled ? (
              <Text style={{ color: colors.statusDanger, fontWeight: "bold" }}>
                SUSPENDED
              </Text>
            ) : (
              item.ownerId?.phone
            )}
          </Text>
        </View>
      </TouchableOpacity>
    </FadeInView>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        Managed Shops
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Track partner status and take action with confidence.
      </Text>

      <View style={styles.summaryRow}>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Total
          </Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {shops.length}
          </Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Active
          </Text>
          <Text style={[styles.summaryValue, { color: colors.statusSuccess }]}>
            {activeCount}
          </Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Suspended
          </Text>
          <Text style={[styles.summaryValue, { color: colors.statusDanger }]}>
            {suspendedCount}
          </Text>
        </View>
      </View>

      <View style={[styles.filtersRow, { borderColor: colors.tabBarBorder }]}>
        {[
          { key: "all", label: "All" },
          { key: "active", label: "Active" },
          { key: "suspended", label: "Suspended" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.filterTab,
              filter === tab.key && {
                borderBottomColor: colors.tint,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setFilter(tab.key as any)}
          >
            <Text
              style={[
                styles.filterTabText,
                { color: filter === tab.key ? colors.tint : colors.textMuted },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.tint} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={filteredShops}
          renderItem={renderShop}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 20 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 50, opacity: 0.5 }}>
              <ShoppingBag size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 10 }}>
                No active shops.
              </Text>
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
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <ShieldAlert size={24} color={colors.statusDanger} />
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Suspend Shop
              </Text>
            </View>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              This will hide the shop from users and cancel all upcoming
              bookings. Action is reversible by re-approving the owner.
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceSoft,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Reason for suspension..."
              placeholderTextColor={colors.textMuted}
              multiline
              value={suspendReason}
              onChangeText={setSuspendReason}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  { backgroundColor: colors.surfaceStrong },
                ]}
                onPress={() => setSuspendModalVisible(false)}
              >
                <Text style={{ color: colors.text, fontWeight: "bold" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmSuspendBtn,
                  { backgroundColor: colors.statusDanger },
                ]}
                onPress={handleSuspend}
              >
                <Text
                  style={[styles.suspendText, { color: colors.actionOnDanger }]}
                >
                  Confirm Suspension
                </Text>
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
  headerTitle: { fontSize: 24, fontWeight: "bold" },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 12 },

  summaryRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  summaryLabel: { fontSize: 11, fontWeight: "600" },
  summaryValue: { fontSize: 18, fontWeight: "800", marginTop: 2 },

  filtersRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginTop: 2,
    marginBottom: 8,
  },
  filterTab: { flex: 1, alignItems: "center", paddingVertical: 10 },
  filterTabText: { fontSize: 13, fontWeight: "700" },

  card: { padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  bizName: { fontWeight: "bold", fontSize: 18 },
  userName: { fontSize: 14, marginTop: 2 },
  suspendBtn: {
    padding: 8,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 8,
  },
  activateBtn: {
    padding: 8,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderRadius: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: { borderRadius: 16, padding: 20, borderWidth: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold" },
  modalSub: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    height: 100,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  modalActions: { flexDirection: "row", gap: 12 },
  cancelBtn: { flex: 1, padding: 14, alignItems: "center", borderRadius: 10 },
  confirmSuspendBtn: {
    flex: 1,
    padding: 14,
    alignItems: "center",
    borderRadius: 10,
  },
  suspendText: { fontWeight: "bold" },
});
