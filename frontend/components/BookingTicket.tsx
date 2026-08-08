import React, { useState } from "react";
import {
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { QrCode as QrIcon, Share2 } from "lucide-react-native";
import { useTheme } from "../context/ThemeContext";
import { Spacing } from "../constants/Spacing";
import { buildTicketQrValue } from "../utils/ticket";
import { useToast } from "../context/ToastContext";

type BookingTicketProps = {
  bookingId?: string | null;
  bookingKey?: string | null;
  shopName?: string | null;
  date?: string | null;
  startTime?: string | null;
  compact?: boolean;
};

export function BookingTicket({
  bookingId,
  bookingKey,
  shopName,
  date,
  startTime,
  compact = false,
}: BookingTicketProps) {
  const { colors, theme } = useTheme();
  const { showToast } = useToast();
  const [qrFailed, setQrFailed] = useState(false);

  const pin = (bookingKey || "").toString().trim();
  const qrValue = buildTicketQrValue(bookingId, pin);
  const showQr = Boolean(pin || bookingId) && !qrFailed;
  const qrSize = compact ? 140 : 180;

  const sharePin = async () => {
    if (!pin) {
      showToast("PIN not available yet", "error");
      return;
    }
    try {
      await Share.share({
        message: shopName
          ? `HairOne booking at ${shopName}\nPIN: ${pin}${date ? `\n${date} ${startTime || ""}` : ""}`
          : `HairOne booking PIN: ${pin}`,
      });
    } catch {
      showToast("Could not share PIN", "error");
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={[styles.kicker, { color: colors.textMuted }]}>
        Show at salon check-in
      </Text>

      <View
        style={[
          styles.pinCard,
          {
            backgroundColor: theme === "dark" ? colors.surfaceSoft : colors.surfaceSoft,
            borderColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.pinLabel, { color: colors.textMuted }]}>
          Booking PIN
        </Text>
        <Text style={[styles.pinValue, { color: colors.tint }]}>
          {pin || "————"}
        </Text>
        <Text style={[styles.pinHint, { color: colors.textMuted }]}>
          Tell this code to the salon if QR is not scanned
        </Text>
      </View>

      <View
        style={[
          styles.qrCard,
          {
            backgroundColor: "#ffffff",
            borderColor: colors.border,
          },
        ]}
      >
        {showQr ? (
          <QRCode
            value={qrValue}
            size={qrSize}
            backgroundColor="#ffffff"
            color="#0f172a"
            onError={() => setQrFailed(true)}
          />
        ) : (
          <View style={styles.qrFallback}>
            <QrIcon size={48} color="#94a3b8" />
            <Text style={styles.qrFallbackText}>
              {pin
                ? "QR unavailable — use your PIN above"
                : "Ticket details loading…"}
            </Text>
          </View>
        )}
      </View>

      {(shopName || date) && (
        <View style={styles.meta}>
          {!!shopName && (
            <Text style={[styles.metaTitle, { color: colors.text }]} numberOfLines={2}>
              {shopName}
            </Text>
          )}
          {(date || startTime) && (
            <Text style={[styles.metaSub, { color: colors.textMuted }]}>
              {[date, startTime].filter(Boolean).join(" · ")}
            </Text>
          )}
        </View>
      )}

      {!!pin && (
        <TouchableOpacity
          style={[styles.shareBtn, { borderColor: colors.border }]}
          onPress={sharePin}
          accessibilityRole="button"
          accessibilityLabel="Share booking PIN"
        >
          <Share2 size={16} color={colors.text} />
          <Text style={[styles.shareText, { color: colors.text }]}>Share PIN</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    alignItems: "center",
  },
  kicker: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
  },
  pinCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: Spacing.round.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  pinLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  pinValue: {
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: 8,
    marginTop: Spacing.sm,
  },
  pinHint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  qrCard: {
    padding: Spacing.lg,
    borderRadius: Spacing.round.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    minHeight: 160,
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  qrFallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    maxWidth: 200,
  },
  qrFallbackText: {
    color: "#64748b",
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  meta: {
    alignItems: "center",
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  metaTitle: {
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  metaSub: {
    fontSize: 13,
    marginTop: 4,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Spacing.round.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  shareText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
