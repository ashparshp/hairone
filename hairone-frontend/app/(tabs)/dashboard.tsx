import { useFocusEffect, useRouter } from "expo-router";
import {
  Briefcase,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Scissors,
  Settings,
  Star,
  User,
  UserPlus,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Colors from "../../constants/Colors";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import type { Barber } from "../../types";

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchShopData = async () => {
    // @ts-ignore
    if (!user?.myShopId) {
      setLoading(false);
      return;
    }
    try {
      // @ts-ignore
      const res = await api.get(`/shops/${user.myShopId}`);
      setShop(res.data.shop);
      setBarbers(res.data.barbers);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchShopData();
    }, [user]) // Re-fetch when user context changes (e.g. role update)
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchShopData();
  };

  const ActionCard = ({
    icon: Icon,
    title,
    sub,
    onPress,
    color = Colors.primary,
  }: any) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        <Icon size={24} color="#0f172a" />
      </View>
      <View>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionSub}>{sub}</Text>
      </View>
      <ChevronRight
        size={20}
        color={Colors.textMuted}
        style={{ marginLeft: "auto" }}
      />
    </TouchableOpacity>
  );

  const renderBarber = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.barberCard}
      onPress={() =>
        router.push({
          pathname: "/salon/manage-barber",
          params: { barberId: item._id },
        } as any)
      }
    >
      <View style={styles.barberRow}>
        <View style={styles.avatar}>
          <User size={20} color="white" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.barberName}>{item.name}</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 6,
            }}
          >
            <Clock size={12} color={Colors.textMuted} />
            <Text style={styles.barberTime}>
              {item.startHour} - {item.endHour}
            </Text>
            {item.isAvailable ? (
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>ON DUTY</Text>
              </View>
            ) : (
              <View
                style={[styles.statusBadge, { backgroundColor: "#334155" }]}
              >
                <Text style={[styles.statusText, { color: "#94a3b8" }]}>
                  OFF
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.editBtn}>
          <Settings size={16} color="white" />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading)
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );

  // --- NO SHOP STATE (Welcome Screen) ---
  if (!shop)
    return (
      <View style={styles.welcomeContainer}>
        <View style={styles.welcomeContent}>
          <View style={styles.iconCircle}>
            <Briefcase size={48} color={Colors.primary} />
          </View>
          <Text style={styles.welcomeTitle}>Welcome Partner!</Text>
          <Text style={styles.welcomeSub}>
            You have been approved. Create your digital storefront to start
            managing bookings and growing your business.
          </Text>

          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => router.push("/salon/create-shop" as any)}
          >
            <Text style={styles.createBtnText}>Create Shop Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

  // --- DASHBOARD STATE ---
  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.shopName}>{shop.name}</Text>
          <View style={styles.locationRow}>
            <MapPin size={12} color={Colors.textMuted} />
            <Text style={styles.shopLocation} numberOfLines={1}>
              {shop.address}
            </Text>
          </View>
        </View>
        <View style={styles.ratingBox}>
          <Star size={12} color="black" fill="black" />
          <Text style={styles.ratingText}>{shop.rating}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* QUICK ACTIONS GRID */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.grid}>
          <ActionCard
            icon={Calendar}
            title="Today's Schedule"
            sub="View appointments"
            onPress={() => router.push("/salon/shop-schedule" as any)}
          />
          <ActionCard
            icon={Briefcase}
            title="Manage Shop"
            sub="Edit details, location & services"
            color="#60a5fa"
            onPress={() => router.push("/salon/manage-services" as any)}
          />
        </View>

        {/* TEAM SECTION */}
        <View style={styles.teamHeader}>
          <Text style={styles.sectionTitle}>My Team ({barbers.length})</Text>
          <TouchableOpacity
            style={styles.addBarberBtn}
            onPress={() => router.push("/salon/manage-barber" as any)}
          >
            <UserPlus size={16} color={Colors.primary} />
            <Text style={styles.addBarberText}>Add New</Text>
          </TouchableOpacity>
        </View>

        {barbers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={{ color: Colors.textMuted }}>
              No team members added yet.
            </Text>
          </View>
        ) : (
          <View>
            {barbers.map((item) => (
              <View key={item._id}>{renderBarber({ item })}</View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
    paddingTop: 60,
  },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 30,
  },
  shopName: { fontSize: 26, fontWeight: "bold", color: "white" },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  shopLocation: { color: Colors.textMuted, fontSize: 14, maxWidth: 200 },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: { fontSize: 12, fontWeight: "bold", color: "black" },

  // Sections
  sectionTitle: {
    color: Colors.textMuted,
    marginBottom: 12,
    textTransform: "uppercase",
    fontSize: 12,
    letterSpacing: 1,
    fontWeight: "bold",
  },
  grid: { gap: 12, marginBottom: 30 },

  // Action Cards
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { color: "white", fontWeight: "bold", fontSize: 16 },
  actionSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  // Team Section
  teamHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addBarberBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  addBarberText: { color: Colors.primary, fontWeight: "bold", fontSize: 14 },

  // Barber Card
  barberCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  barberRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#334155",
    alignItems: "center",
    justifyContent: "center",
  },
  barberName: { color: "white", fontWeight: "bold", fontSize: 16 },
  barberTime: { color: Colors.textMuted, fontSize: 12 },
  statusBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: { color: "#10b981", fontSize: 10, fontWeight: "bold" },
  editBtn: {
    marginLeft: "auto",
    backgroundColor: "#334155",
    padding: 8,
    borderRadius: 8,
  },

  emptyState: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    borderRadius: 12,
  },

  // Welcome / No Shop State
  welcomeContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    padding: 20,
  },
  welcomeContent: { alignItems: "center" },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 12,
  },
  welcomeSub: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  createBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 16,
  },
  createBtnText: { color: "#0f172a", fontWeight: "bold", fontSize: 18 },
});
