import { useFocusEffect, useRouter } from "expo-router";
import {
  Briefcase,
  Calendar,
  ChevronRight,
  Clock,
  MapPin,
  Settings,
  Star,
  User,
  UserPlus,
  Store,
  Scissors,
  TrendingUp,
  ShieldAlert,
  RotateCcw,
  Home
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
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { FadeInView } from "../../components/AnimatedViews";
import api from "../../services/api";
import type { Barber } from "../../types";

export default function DashboardScreen() {
  const { user, refreshUser } = useAuth();
  const { colors, theme } = useTheme();
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
      refreshUser();
      fetchShopData();
    }, [])
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
    color,
  }: any) => (
    <TouchableOpacity style={[styles.actionCard, {backgroundColor: colors.card, borderColor: colors.border}]} onPress={onPress}>
      <View style={[styles.actionIcon, { backgroundColor: color || colors.tint }]}>
        <Icon size={24} color="#0f172a" />
      </View>
      <View>
        <Text style={[styles.actionTitle, {color: colors.text}]}>{title}</Text>
        <Text style={[styles.actionSub, {color: colors.textMuted}]}>{sub}</Text>
      </View>
      <ChevronRight
        size={20}
        color={colors.textMuted}
        style={{ marginLeft: "auto" }}
      />
    </TouchableOpacity>
  );

  const renderBarber = ({ item, index }: { item: any, index: number }) => (
    <FadeInView delay={index * 100}>
    <TouchableOpacity
      style={[styles.barberCard, {backgroundColor: colors.card, borderColor: colors.border}]}
      onPress={() =>
        router.push({
          pathname: "/salon/manage-barber",
          params: { barberId: item._id },
        } as any)
      }
    >
      <View style={styles.barberRow}>
        <View style={[styles.avatar, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}>
          <User size={20} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.barberName, {color: colors.text}]}>{item.name}</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: 4,
              gap: 6,
            }}
          >
            <Clock size={12} color={colors.textMuted} />
            <Text style={[styles.barberTime, {color: colors.textMuted}]}>
              {item.startHour} - {item.endHour}
            </Text>
            {item.isAvailable ? (
              <View style={{flexDirection: 'row', gap: 4}}>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>ON DUTY</Text>
                  </View>
                  {item.isHomeServiceAvailable && (
                      <View style={[styles.statusBadge, {backgroundColor: 'rgba(245, 158, 11, 0.1)'}]}>
                          <Home size={10} color="#f59e0b" />
                      </View>
                  )}
                  {item.isShopServiceAvailable !== false && (
                      <View style={[styles.statusBadge, {backgroundColor: 'rgba(59, 130, 246, 0.1)'}]}>
                          <Store size={10} color="#3b82f6" />
                      </View>
                  )}
              </View>
            ) : (
              <View
                style={[styles.statusBadge, { backgroundColor: theme === 'dark' ? "#334155" : "#e2e8f0" }]}
              >
                <Text style={[styles.statusText, { color: theme === 'dark' ? "#94a3b8" : "#64748b" }]}>
                  OFF
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={[styles.editBtn, {backgroundColor: theme === 'dark' ? '#334155' : '#e2e8f0'}]}>
          <Settings size={16} color={colors.text} />
        </View>
      </View>
    </TouchableOpacity>
    </FadeInView>
  );

  if (loading)
    return (
      <View style={[styles.center, {backgroundColor: colors.background}]}>
        <ActivityIndicator size="large" color={colors.tint} />
      </View>
    );

  // --- SUSPENDED STATE ---
  // @ts-ignore
  if (user?.applicationStatus === 'suspended') {
    const handleReapply = async () => {
      try {
        setLoading(true);
        // @ts-ignore
        const res = await api.post('/admin/reapply');
        // Refresh local user state if possible, or force logout/reload
        // Since we can't easily update Context user deep from here without a reload mechanism,
        // we might need to alert the user.
        // Ideally: update user context.
        alert("Re-application submitted. Please wait for admin approval.");
        fetchShopData(); // This might not refresh context user role immediately
      } catch (e) {
        alert("Failed to reapply");
      } finally {
        setLoading(false);
      }
    };

    return (
      <View style={[styles.welcomeContainer, {backgroundColor: colors.background}]}>
         <View style={styles.welcomeContent}>
            <View style={[styles.iconCircle, {backgroundColor: 'rgba(239, 68, 68, 0.1)'}]}>
               <ShieldAlert size={48} color="#ef4444" />
            </View>
            <Text style={[styles.welcomeTitle, {color: colors.text}]}>Account Suspended</Text>
            <Text style={[styles.welcomeSub, {color: colors.textMuted}]}>
               Your shop has been suspended by the administrator.
            </Text>

            {/* @ts-ignore */}
            {user?.suspensionReason && (
               <View style={styles.reasonBox}>
                  <Text style={styles.reasonLabel}>Reason:</Text>
                  {/* @ts-ignore */}
                  <Text style={styles.reasonText}>{user.suspensionReason}</Text>
               </View>
            )}

            <TouchableOpacity
               style={[styles.createBtn, {backgroundColor: colors.tint, marginTop: 20, flexDirection:'row', gap: 8, alignItems:'center'}]}
               onPress={handleReapply}
            >
               <RotateCcw size={20} color="#0f172a" />
               <Text style={styles.createBtnText}>Request Review</Text>
            </TouchableOpacity>
         </View>
      </View>
    );
  }

  // --- NO SHOP STATE (Welcome Screen) ---
  if (!shop)
    return (
      <View style={[styles.welcomeContainer, {backgroundColor: colors.background}]}>
        <View style={styles.welcomeContent}>
          <View style={[styles.iconCircle, {backgroundColor: 'rgba(245, 158, 11, 0.1)'}]}>
            <Briefcase size={48} color={colors.tint} />
          </View>
          <Text style={[styles.welcomeTitle, {color: colors.text}]}>Welcome Partner!</Text>
          <Text style={[styles.welcomeSub, {color: colors.textMuted}]}>
            You have been approved. Create your digital storefront to start
            managing bookings and growing your business.
          </Text>

          <TouchableOpacity
            style={[styles.createBtn, {backgroundColor: colors.tint}]}
            onPress={() => router.push("/salon/create-shop" as any)}
          >
            <Text style={styles.createBtnText}>Create Shop Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );

  // --- DASHBOARD STATE ---
  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.shopName, {color: colors.text}]}>{shop.name}</Text>
          <View style={styles.locationRow}>
            <MapPin size={12} color={colors.textMuted} />
            <Text style={[styles.shopLocation, {color: colors.textMuted}]} numberOfLines={1}>
              {shop.address}
            </Text>
          </View>
        </View>
        <View style={[styles.ratingBox, {backgroundColor: colors.tint}]}>
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
            tintColor={colors.tint}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* QUICK ACTIONS GRID */}
        <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>Quick Actions</Text>
        <View style={styles.grid}>
          <ActionCard
            icon={Calendar}
            title="Today's Schedule"
            sub="View appointments"
            onPress={() => router.push("/salon/shop-schedule" as any)}
          />
          <ActionCard
            icon={Store}
            title="Shop Details"
            sub="Edit name, image & location"
            color="#f472b6"
            onPress={() => router.push("/salon/shop-details" as any)}
          />
          <ActionCard
            icon={Scissors}
            title="Services Menu"
            sub="Manage services & pricing"
            color="#60a5fa"
            onPress={() => router.push("/salon/manage-services" as any)}
          />
          <ActionCard
            icon={TrendingUp}
            title="Revenue Stats"
            sub="View earnings & reports"
            color="#10b981"
            onPress={() => router.push("/salon/revenue-stats" as any)}
          />
        </View>

        {/* TEAM SECTION */}
        <View style={styles.teamHeader}>
          <Text style={[styles.sectionTitle, {color: colors.textMuted}]}>My Team ({barbers.length})</Text>
          <TouchableOpacity
            style={styles.addBarberBtn}
            onPress={() => router.push("/salon/manage-barber" as any)}
          >
            <UserPlus size={16} color={colors.tint} />
            <Text style={[styles.addBarberText, {color: colors.tint}]}>Add New</Text>
          </TouchableOpacity>
        </View>

        {barbers.length === 0 ? (
          <View style={[styles.emptyState, {borderColor: colors.border}]}>
            <Text style={{ color: colors.textMuted }}>
              No team members added yet.
            </Text>
          </View>
        ) : (
          <View>
            {barbers.map((item, index) => (
              <View key={item._id}>{renderBarber({ item, index })}</View>
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
    padding: 20,
    paddingTop: 60,
  },
  center: {
    flex: 1,
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
  shopName: { fontSize: 26, fontWeight: "bold" },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  shopLocation: { fontSize: 14, maxWidth: 200 },
  ratingBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  ratingText: { fontSize: 12, fontWeight: "bold", color: "black" },

  // Sections
  sectionTitle: {
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
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionTitle: { fontWeight: "bold", fontSize: 16 },
  actionSub: { fontSize: 12, marginTop: 2 },

  // Team Section
  teamHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  addBarberBtn: { flexDirection: "row", alignItems: "center", gap: 6 },
  addBarberText: { fontWeight: "bold", fontSize: 14 },

  // Barber Card
  barberCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  barberRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  barberName: { fontWeight: "bold", fontSize: 16 },
  barberTime: { fontSize: 12 },
  statusBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: { color: "#10b981", fontSize: 10, fontWeight: "bold" },
  editBtn: {
    marginLeft: "auto",
    padding: 8,
    borderRadius: 8,
  },

  emptyState: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
  },

  // Welcome / No Shop State
  welcomeContainer: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  welcomeContent: { alignItems: "center" },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 12,
  },
  welcomeSub: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 40,
  },
  createBtn: {
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 16,
  },
  createBtnText: { color: "#0f172a", fontWeight: "bold", fontSize: 18 },

  reasonBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    width: '100%',
    marginBottom: 10
  },
  reasonLabel: { color: '#ef4444', fontWeight: 'bold', marginBottom: 4 },
  reasonText: { color: '#ef4444' }
});
