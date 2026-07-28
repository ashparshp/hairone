import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useTheme } from "../../../context/ThemeContext";
import api from "../../../services/api";
import { Check, X, ShieldAlert } from "lucide-react-native";
import { FadeInView } from "../../../components/AnimatedViews";

export default function AdminApprovals() {
  const { colors } = useTheme();
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  const pendingCount = applicants.filter(
    (item: any) => item.applicationStatus === "pending",
  ).length;
  const approvedCount = applicants.filter(
    (item: any) => item.applicationStatus === "approved",
  ).length;
  const rejectedCount = applicants.filter(
    (item: any) => item.applicationStatus === "rejected",
  ).length;

  // Refresh data when tab is focused or activeTab changes
  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [activeTab]),
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const endpoint =
        activeTab === "pending"
          ? "/admin/applications"
          : "/admin/applications?status=history";
      const res = await api.get(endpoint);
      setApplicants(res.data);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const handleProcess = async (
    userId: string,
    action: "approve" | "reject",
  ) => {
    try {
      await api.post("/admin/process", { userId, action });
      Alert.alert("Success", `User ${action}d successfully.`);
      fetchData(); // Refresh list
    } catch (e) {
      Alert.alert("Error", "Action failed");
    }
  };

  const renderApplicant = ({ item, index }: { item: any; index: number }) => {
    const isPending = item.applicationStatus === "pending";
    const statusColor =
      item.applicationStatus === "approved"
        ? colors.statusSuccess
        : item.applicationStatus === "rejected"
          ? colors.statusDanger
          : colors.statusWarning;

    return (
      <FadeInView delay={index * 50}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <View>
              <Text style={[styles.bizName, { color: colors.text }]}>
                {item.businessName || "Untitled Shop"}
              </Text>
              <Text style={[styles.userName, { color: colors.textMuted }]}>
                {item.name || "Unknown Owner"} • {item.phone}
              </Text>
            </View>
            <View
              style={[styles.badge, { backgroundColor: `${statusColor}20` }]}
            >
              <Text style={[styles.badgeText, { color: statusColor }]}>
                {item.applicationStatus.toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={[styles.sub, { color: colors.textMuted }]}>
            Requested role: Shop Partner
          </Text>

          {isPending && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[
                  styles.rejectBtn,
                  {
                    backgroundColor: colors.statusDangerSoft,
                    borderColor: colors.statusDangerBorder,
                  },
                ]}
                onPress={() => handleProcess(item._id, "reject")}
              >
                <X size={16} color={colors.statusDanger} />
                <Text
                  style={[styles.rejectText, { color: colors.statusDanger }]}
                >
                  Reject Request
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.approveBtn, { backgroundColor: colors.tint }]}
                onPress={() => handleProcess(item._id, "approve")}
              >
                <Check size={16} color={colors.actionPrimaryText} />
                <Text
                  style={[
                    styles.approveText,
                    { color: colors.actionPrimaryText },
                  ]}
                >
                  Approve Owner
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </FadeInView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.headerTitle, { color: colors.text }]}>
        Partner Applications
      </Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        Validate requests quickly and keep onboarding quality high.
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
            {applicants.length}
          </Text>
        </View>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>
            Pending
          </Text>
          <Text style={[styles.summaryValue, { color: colors.statusWarning }]}>
            {pendingCount}
          </Text>
        </View>
      </View>

      {activeTab === "history" && (
        <View
          style={[
            styles.historyLegend,
            { backgroundColor: colors.surfaceSoft, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.legendItem, { color: colors.statusSuccess }]}>
            Approved: {approvedCount}
          </Text>
          <Text style={[styles.legendItem, { color: colors.statusDanger }]}>
            Rejected: {rejectedCount}
          </Text>
        </View>
      )}

      {/* Tabs */}
      <View style={[styles.tabs, { borderColor: colors.tabBarBorder }]}>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "pending" && {
              borderBottomColor: colors.tint,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab("pending")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === "pending" ? colors.tint : colors.textMuted,
              },
            ]}
          >
            Pending ({pendingCount})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tab,
            activeTab === "history" && {
              borderBottomColor: colors.tint,
              borderBottomWidth: 2,
            },
          ]}
          onPress={() => setActiveTab("history")}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === "history" ? colors.tint : colors.textMuted,
              },
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.tint} style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={applicants}
          renderItem={renderApplicant}
          keyExtractor={(item: any) => item._id}
          contentContainerStyle={{ paddingBottom: 20, paddingTop: 20 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 50, opacity: 0.5 }}>
              <ShieldAlert size={48} color={colors.textMuted} />
              <Text style={{ color: colors.textMuted, marginTop: 10 }}>
                No requests found.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 60 },
  headerTitle: { fontSize: 24, fontWeight: "bold" },
  subtitle: { fontSize: 13, marginTop: 4, marginBottom: 12 },

  summaryRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryLabel: { fontSize: 12, fontWeight: "600" },
  summaryValue: { fontSize: 20, fontWeight: "800", marginTop: 2 },

  historyLegend: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  legendItem: { fontSize: 12, fontWeight: "700" },

  card: { padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  bizName: { fontWeight: "bold", fontSize: 18 },
  userName: { fontSize: 14, marginTop: 2 },
  sub: { fontSize: 12, marginVertical: 12 },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 10, fontWeight: "bold" },

  tabs: { flexDirection: "row", borderBottomWidth: 1, marginTop: 8 },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabText: { fontWeight: "bold", fontSize: 14 },

  actionRow: { flexDirection: "row", gap: 12 },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  approveText: { fontWeight: "bold" },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
  },
  rejectText: { fontWeight: "bold" },
});
