import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { CheckCircle, Home } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FadeInView } from "../../components/AnimatedViews";
import { BookingTicket } from "../../components/BookingTicket";
import { useAuth } from "../../context/AuthContext";
import { useBooking } from "../../context/BookingContext";
import { useTheme } from "../../context/ThemeContext";
import { Spacing } from "../../constants/Spacing";
import api from "../../services/api";

type ReceiptBooking = {
  _id?: string;
  id?: string;
  bookingKey?: string;
  date?: string;
  startTime?: string;
  status?: string;
  finalPrice?: number;
  totalPrice?: number;
  walletCreditApplied?: number;
  amountDue?: number;
  paymentMethod?: string;
  serviceNames?: string[];
  shopId?: { name?: string; address?: string } | string;
  barberId?: { name?: string } | string;
};

export default function BookingSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, theme } = useTheme();
  const { user } = useAuth();
  const { myBookings, fetchBookings } = useBooking();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = Array.isArray(params.bookingId)
    ? params.bookingId[0]
    : params.bookingId;

  const [booking, setBooking] = useState<ReceiptBooking | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!bookingId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        await fetchBookings();

        let found =
          (myBookings || []).find(
            (item: any) =>
              item?._id === bookingId || item?.id === bookingId,
          ) || null;

        if (!found && user?._id) {
          const res = await api.get(`/bookings/user/${user._id}`);
          const list = res.data || [];
          found =
            list.find(
              (item: any) =>
                item?._id === bookingId || item?.id === bookingId,
            ) || null;
        }

        if (mounted) setBooking(found);
      } catch {
        if (mounted) {
          const fallback =
            (myBookings || []).find(
              (item: any) =>
                item?._id === bookingId || item?.id === bookingId,
            ) || null;
          setBooking(fallback);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
    // Intentionally only re-run when bookingId / user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId, user?._id]);

  const shopName = useMemo(() => {
    if (!booking?.shopId) return "Your salon";
    if (typeof booking.shopId === "string") return "Your salon";
    return booking.shopId.name || "Your salon";
  }, [booking]);

  const displayPrice =
    booking?.finalPrice ?? booking?.totalPrice ?? null;
  const paymentLabel = (booking?.paymentMethod || "").toUpperCase();
  const isPending = booking?.status === "pending";

  const goBookings = () => {
    if (user?.role === "owner") {
      router.replace("/(tabs)/dashboard" as any);
      return;
    }
    if (user?.role === "admin") {
      router.replace("/admin/(tabs)" as any);
      return;
    }
    router.replace("/(tabs)/bookings" as any);
  };

  const goHome = () => {
    if (user?.role === "owner") {
      router.replace("/(tabs)/dashboard" as any);
      return;
    }
    if (user?.role === "admin") {
      router.replace("/admin/(tabs)" as any);
      return;
    }
    router.replace("/(tabs)/home" as any);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.lg,
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <FadeInView>
          <View style={styles.hero}>
            <View
              style={[
                styles.iconBox,
                { backgroundColor: colors.statusSuccessSoft },
              ]}
            >
              <CheckCircle size={56} color={colors.statusSuccess} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {isPending ? "Booking requested" : "Booking confirmed"}
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              {isPending
                ? "The salon will confirm your slot. Keep this ticket ready."
                : "Your appointment is locked in. Show this ticket at the counter."}
            </Text>
          </View>
        </FadeInView>

        {loading ? (
          <ActivityIndicator
            color={colors.tint}
            style={{ marginVertical: Spacing.xxl }}
          />
        ) : (
          <FadeInView delay={120}>
            <View
              style={[
                styles.ticketShell,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ]}
            >
              <BookingTicket
                bookingId={booking?._id || booking?.id || bookingId}
                bookingKey={booking?.bookingKey}
                shopName={shopName}
                date={booking?.date}
                startTime={booking?.startTime}
              />

              {!!booking?.serviceNames?.length && (
                <View
                  style={[
                    styles.servicesBox,
                    {
                      backgroundColor:
                        theme === "dark"
                          ? colors.surfaceSoft
                          : colors.surfaceSoft,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {booking.serviceNames.map((name) => (
                    <Text
                      key={name}
                      style={[styles.serviceLine, { color: colors.textMuted }]}
                    >
                      • {name}
                    </Text>
                  ))}
                </View>
              )}

              {(displayPrice != null || paymentLabel) && (
                <View style={styles.priceRow}>
                  {displayPrice != null && (
                    <Text style={[styles.price, { color: colors.text }]}>
                      ₹{Number(displayPrice).toFixed(2)}
                    </Text>
                  )}
                  {!!paymentLabel && (
                    <Text style={[styles.payMethod, { color: colors.textMuted }]}>
                      {paymentLabel === "ONLINE"
                        ? "Paid online"
                        : paymentLabel === "CASH"
                          ? "Pay at salon"
                          : paymentLabel}
                      {(booking?.walletCreditApplied || 0) > 0
                        ? ` · ₹${Number(booking?.walletCreditApplied).toFixed(2)} credit`
                        : ""}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </FadeInView>
        )}

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.tint }]}
            onPress={goBookings}
          >
            <Text
              style={[
                styles.primaryBtnText,
                { color: colors.actionPrimaryText },
              ]}
            >
              View bookings
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={goHome}
          >
            <Home size={16} color={colors.text} />
            <Text style={[styles.secondaryBtnText, { color: colors.text }]}>
              Back home
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  hero: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  iconBox: {
    borderRadius: 48,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  sub: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  ticketShell: {
    borderWidth: 1,
    borderRadius: Spacing.round.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  servicesBox: {
    width: "100%",
    borderWidth: 1,
    borderRadius: Spacing.round.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: 4,
  },
  serviceLine: {
    fontSize: 13,
    lineHeight: 20,
  },
  priceRow: {
    width: "100%",
    marginTop: Spacing.lg,
    alignItems: "center",
    gap: 4,
  },
  price: {
    fontSize: 22,
    fontWeight: "800",
  },
  payMethod: {
    fontSize: 12,
    fontWeight: "600",
  },
  actions: {
    gap: Spacing.md,
  },
  primaryBtn: {
    width: "100%",
    paddingVertical: Spacing.lg,
    borderRadius: Spacing.round.lg,
    alignItems: "center",
  },
  primaryBtnText: {
    fontWeight: "800",
    fontSize: 16,
  },
  secondaryBtn: {
    width: "100%",
    paddingVertical: Spacing.lg,
    borderRadius: Spacing.round.lg,
    alignItems: "center",
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  secondaryBtnText: {
    fontWeight: "700",
    fontSize: 15,
  },
});
