import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { getWalletHistory } from "../services/wallet";
import { WalletTransaction } from "../types/wallet";
import {
  ChevronLeft,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
} from "lucide-react-native";
import { FadeInView } from "../components/AnimatedViews";

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (iso: string) => {
  const date = new Date(iso);
  return date.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function WalletScreen() {
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { user, refreshUser } = useAuth();
  const isDark = theme === "dark";

  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadWallet = async (pageNum = 1, append = false) => {
    try {
      const data = await getWalletHistory(pageNum);
      setBalance(data.balance);
      setHasMore(data.pagination.hasMore);
      setPage(data.pagination.page);
      setTransactions((prev) =>
        append ? [...prev, ...data.transactions] : data.transactions,
      );
      setLoadError(null);
      await refreshUser();
    } catch (e) {
      console.log("Wallet fetch error", e);
      if (!append) {
        setLoadError("Could not load wallet. Pull to refresh.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadWallet(1, false);
    }, []),
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadWallet(1, false);
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    loadWallet(page + 1, true);
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: WalletTransaction;
    index: number;
  }) => {
    const isCredit = item.type === "credit";
    const Icon = isCredit ? ArrowDownLeft : ArrowUpRight;
    const amountColor = isCredit ? "#10b981" : "#ef4444";
    const prefix = isCredit ? "+" : "−";

    return (
      <FadeInView delay={Math.min(index * 40, 200)}>
        <View
          style={[
            styles.txCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.txIcon,
              {
                backgroundColor: isCredit
                  ? "rgba(16, 185, 129, 0.12)"
                  : "rgba(239, 68, 68, 0.12)",
              },
            ]}
          >
            <Icon size={18} color={amountColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.txTitle, { color: colors.text }]}>
              {item.reasonLabel}
            </Text>
            {item.note ? (
              <Text
                style={[styles.txNote, { color: colors.textMuted }]}
                numberOfLines={2}
              >
                {item.note}
              </Text>
            ) : null}
            <Text style={[styles.txDate, { color: colors.textMuted }]}>
              {formatDate(item.createdAt)} · {formatTime(item.createdAt)}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.txAmount, { color: amountColor }]}>
              {prefix}₹{item.amount.toFixed(2)}
            </Text>
            <Text style={[styles.txBalance, { color: colors.textMuted }]}>
              Bal ₹{item.balanceAfter.toFixed(2)}
            </Text>
          </View>
        </View>
      </FadeInView>
    );
  };

  if (user && user.role !== "user") {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={["top"]}>
        <View style={styles.center}>
          <Text style={{ color: colors.text, textAlign: "center", paddingHorizontal: 24 }}>
            Wallet is only available for customer accounts.
          </Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.tint }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.backBtn,
            { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" },
          ]}
        >
          <ChevronLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Account Credit
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View
        style={[
          styles.balanceCard,
          {
            backgroundColor: isDark ? "#1e293b" : "#0f172a",
          },
        ]}
      >
        <View style={styles.balanceIconWrap}>
          <Wallet size={22} color="#facc15" />
        </View>
        <Text style={styles.balanceLabel}>Available balance</Text>
        <Text style={styles.balanceValue}>₹{balance.toFixed(2)}</Text>
        <Text style={styles.balanceHint}>
          Use at checkout on your next booking
        </Text>
      </View>

      <View style={styles.listHeader}>
        <Receipt size={16} color={colors.textMuted} />
        <Text style={[styles.listTitle, { color: colors.textMuted }]}>
          Transaction history
        </Text>
      </View>

      {loadError && !loading && (
        <Text style={{ color: "#ef4444", textAlign: "center", marginBottom: 12, paddingHorizontal: 20 }}>
          {loadError}
        </Text>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.tint} size="large" />
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.tint}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Wallet size={40} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                No transactions yet
              </Text>
              <Text style={[styles.emptySub, { color: colors.textMuted }]}>
                Credits from cancellations or failed bookings will appear here.
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator
                style={{ marginVertical: 16 }}
                color={colors.tint}
              />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  balanceCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  balanceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(250, 204, 21, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  balanceLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginBottom: 4,
  },
  balanceValue: {
    color: "#ffffff",
    fontSize: 36,
    fontWeight: "800",
    marginBottom: 8,
  },
  balanceHint: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    textAlign: "center",
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
  },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  txTitle: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  txNote: { fontSize: 12, lineHeight: 16, marginBottom: 4 },
  txDate: { fontSize: 11 },
  txAmount: { fontSize: 15, fontWeight: "700" },
  txBalance: { fontSize: 11, marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20 },
});
