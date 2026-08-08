import { useFocusEffect, useRouter } from "expo-router";
import {
  Briefcase,
  Calendar,
  Clock,
  RotateCcw,
  Scissors,
  Settings,
  ShieldAlert,
  Store,
  TrendingUp,
  User,
  UserPlus,
} from "lucide-react-native";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { FadeInView } from "../../components/AnimatedViews";
import {
  OWNER_ACTION_COLORS,
  OwnerCard,
  OwnerGridAction,
  OwnerHeroCard,
  OwnerRatingBadge,
  OwnerScreen,
  OwnerSectionHeader,
  OwnerStatusBadge,
  ownerStyles,
} from "../../components/owner/OwnerUI";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Spacing } from "../../constants/Spacing";
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

  const fetchShopData = useCallback(async () => {
    const shopId =
      typeof user?.myShopId === "object" ? user?.myShopId?._id : user?.myShopId;

    if (!shopId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get(`/shops/${shopId}`);
      setShop(res.data.shop);
      setBarbers(res.data.barbers);
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Could not load shop data. Pull to refresh.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.myShopId]);

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      fetchShopData();
    }, [fetchShopData, refreshUser]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchShopData();
  };

  if (loading) {
    return (
      <OwnerScreen>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.tint} />
        </View>
      </OwnerScreen>
    );
  }

  // @ts-ignore
  if (user?.applicationStatus === "suspended") {
    const handleReapply = async () => {
      try {
        setLoading(true);
        // @ts-ignore
        await api.post("/admin/reapply");
        Alert.alert(
          "Submitted",
          "Re-application submitted. Please wait for admin approval.",
        );
        await refreshUser();
        fetchShopData();
      } catch {
        Alert.alert("Error", "Failed to reapply");
      } finally {
        setLoading(false);
      }
    };

    return (
      <OwnerScreen>
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeContent}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.statusDangerSoft },
              ]}
            >
              <ShieldAlert size={44} color={colors.statusDanger} />
            </View>
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              Account Suspended
            </Text>
            <Text style={[styles.welcomeSub, { color: colors.textMuted }]}>
              Your shop has been suspended by the administrator.
            </Text>
            {/* @ts-ignore */}
            {user?.suspensionReason ? (
              <View
                style={[
                  styles.reasonBox,
                  {
                    backgroundColor: colors.statusDangerSoft,
                    borderColor: colors.statusDangerBorder,
                  },
                ]}
              >
                <Text style={[styles.reasonLabel, { color: colors.statusDanger }]}>
                  Reason
                </Text>
                {/* @ts-ignore */}
                <Text style={[styles.reasonText, { color: colors.statusDanger }]}>
                  {user.suspensionReason}
                </Text>
              </View>
            ) : null}
            <TouchableOpacity
              style={[styles.primaryCta, { backgroundColor: colors.tint }]}
              onPress={handleReapply}
            >
              <RotateCcw size={18} color={colors.actionPrimaryText} />
              <Text
                style={[
                  styles.primaryCtaText,
                  { color: colors.actionPrimaryText },
                ]}
              >
                Request Review
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </OwnerScreen>
    );
  }

  if (!shop) {
    return (
      <OwnerScreen>
        <View style={styles.welcomeContainer}>
          <View style={styles.welcomeContent}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: "rgba(245, 158, 11, 0.12)" },
              ]}
            >
              <Briefcase size={44} color={colors.tint} />
            </View>
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              Welcome Partner
            </Text>
            {!!user?.businessName && (
              <Text style={[styles.businessName, { color: colors.text }]}>
                {user.businessName}
              </Text>
            )}
            <Text style={[styles.welcomeSub, { color: colors.textMuted }]}>
              You are approved. Set up your storefront to start managing
              bookings and growing your business.
            </Text>
            <TouchableOpacity
              style={[styles.primaryCta, { backgroundColor: colors.tint }]}
              onPress={() => router.push("/salon/create-shop" as any)}
            >
              <Text
                style={[
                  styles.primaryCtaText,
                  { color: colors.actionPrimaryText },
                ]}
              >
                Create Shop
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </OwnerScreen>
    );
  }

  return (
    <OwnerScreen>
      <ScrollView
        contentContainerStyle={[
          ownerStyles.screenPadding,
          ownerStyles.contentGap,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.tint}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <OwnerHeroCard
          title={shop.name}
          subtitle={shop.address}
          badge={<OwnerRatingBadge rating={shop.rating ?? "—"} />}
        />

        <View>
          <OwnerSectionHeader title="Quick Actions" />
          <View style={ownerStyles.grid}>
            <OwnerGridAction
              icon={Calendar}
              title="Schedule"
              subtitle="Today's appointments"
              tint={OWNER_ACTION_COLORS.schedule}
              onPress={() => router.push("/salon/shop-schedule" as any)}
            />
            <OwnerGridAction
              icon={Store}
              title="Shop Details"
              subtitle="Name, image, location"
              tint={OWNER_ACTION_COLORS.shop}
              onPress={() => router.push("/salon/shop-details" as any)}
            />
            <OwnerGridAction
              icon={Scissors}
              title="Services"
              subtitle="Menu and pricing"
              tint={OWNER_ACTION_COLORS.services}
              onPress={() => router.push("/salon/manage-services" as any)}
            />
            <OwnerGridAction
              icon={TrendingUp}
              title="Revenue"
              subtitle="Earnings and payouts"
              tint={OWNER_ACTION_COLORS.revenue}
              onPress={() => router.push("/salon/revenue-stats" as any)}
            />
          </View>
        </View>

        <View>
          <OwnerSectionHeader
            title={`Team (${barbers.length})`}
            action={
              <TouchableOpacity
                style={[
                  styles.addButton,
                  {
                    backgroundColor: colors.surfaceSoft,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => router.push("/salon/manage-barber" as any)}
              >
                <UserPlus size={15} color={colors.tint} />
                <Text style={[styles.addButtonText, { color: colors.tint }]}>
                  Add
                </Text>
              </TouchableOpacity>
            }
          />

          {barbers.length === 0 ? (
            <OwnerCard style={styles.emptyCard}>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No team members yet. Add your first barber to start taking
                bookings.
              </Text>
            </OwnerCard>
          ) : (
            <View style={styles.teamList}>
              {barbers.map((item, index) => (
                <FadeInView key={item._id} delay={index * 80}>
                  <TouchableOpacity
                    style={[
                      styles.teamCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: "/salon/manage-barber",
                        params: { barberId: item._id },
                      } as any)
                    }
                    activeOpacity={0.85}
                  >
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: colors.surfaceSoft },
                      ]}
                    >
                      <User size={20} color={colors.tint} />
                    </View>

                    <View style={styles.teamInfo}>
                      <Text style={[styles.barberName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      <View style={styles.teamMeta}>
                        <Clock size={12} color={colors.textMuted} />
                        <Text
                          style={[styles.teamMetaText, { color: colors.textMuted }]}
                        >
                          {item.startHour} – {item.endHour}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.teamRight}>
                      <OwnerStatusBadge
                        label={(item as any).isAvailable ? "On duty" : "Off"}
                        tone={(item as any).isAvailable ? "success" : "neutral"}
                      />
                      <View
                        style={[
                          styles.editBtn,
                          { backgroundColor: colors.surfaceSoft },
                        ]}
                      >
                        <Settings size={15} color={colors.textMuted} />
                      </View>
                    </View>
                  </TouchableOpacity>
                </FadeInView>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroMetaText: {
    flex: 1,
    fontSize: 13,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: Spacing.round.full,
    borderWidth: 1,
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  teamList: {
    gap: Spacing.md,
  },
  teamCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Spacing.round.lg,
    borderWidth: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  teamInfo: {
    flex: 1,
    gap: 4,
  },
  barberName: {
    fontSize: 16,
    fontWeight: "700",
  },
  teamMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  teamMetaText: {
    fontSize: 12,
  },
  teamRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  editBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: 20,
    fontSize: 14,
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: 80,
  },
  welcomeContent: {
    alignItems: "center",
    gap: Spacing.md,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  businessName: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  welcomeSub: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  primaryCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: Spacing.round.lg,
    width: "100%",
  },
  primaryCtaText: {
    fontSize: 16,
    fontWeight: "800",
  },
  reasonBox: {
    padding: Spacing.lg,
    borderRadius: Spacing.round.md,
    borderWidth: 1,
    width: "100%",
    gap: 4,
  },
  reasonLabel: {
    fontWeight: "700",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  reasonText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
