import React from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { ChevronLeft } from "lucide-react-native";
import { useTheme } from "../../context/ThemeContext";
import type { AppColors } from "../../constants/Colors";
import { Spacing } from "../../constants/Spacing";

export const OWNER_ACTION_COLORS = {
  schedule: { bg: "rgba(245, 158, 11, 0.14)", icon: "#d97706" },
  shop: { bg: "rgba(244, 114, 182, 0.14)", icon: "#db2777" },
  services: { bg: "rgba(59, 130, 246, 0.14)", icon: "#2563eb" },
  revenue: { bg: "rgba(16, 185, 129, 0.14)", icon: "#059669" },
  team: { bg: "rgba(99, 102, 241, 0.14)", icon: "#4f46e5" },
} as const;

type OwnerScreenProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function OwnerScreen({ children, style }: OwnerScreenProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }, style]}>
      {children}
    </View>
  );
}

type OwnerScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
};

export function OwnerScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: OwnerScreenHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.headerRow}>
      <View style={styles.headerSide}>
        {onBack ? (
          <TouchableOpacity
            onPress={onBack}
            style={[
              styles.iconButton,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            activeOpacity={0.75}
          >
            <ChevronLeft size={22} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View style={styles.headerCenter}>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.headerSubtitle, { color: colors.textMuted }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={[styles.headerSide, styles.headerSideRight]}>{right ?? <View style={styles.headerSpacer} />}</View>
    </View>
  );
}

type OwnerHeroCardProps = {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
};

export function OwnerHeroCard({
  title,
  subtitle,
  badge,
  footer,
}: OwnerHeroCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.heroCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.heroTop}>
        <View style={styles.heroText}>
          <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.heroSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {badge}
      </View>
      {footer}
    </View>
  );
}

type OwnerSectionHeaderProps = {
  title: string;
  action?: React.ReactNode;
};

export function OwnerSectionHeader({ title, action }: OwnerSectionHeaderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {action}
    </View>
  );
}

type OwnerCardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function OwnerCard({ children, style }: OwnerCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

type OwnerGridActionProps = {
  icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  subtitle: string;
  tint: { bg: string; icon: string };
  onPress: () => void;
};

export function OwnerGridAction({
  icon: Icon,
  title,
  subtitle,
  tint,
  onPress,
}: OwnerGridActionProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.gridAction,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.gridIcon, { backgroundColor: tint.bg }]}>
        <Icon size={22} color={tint.icon} />
      </View>
      <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={1}>
        {title}
      </Text>
      <Text style={[styles.gridSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
        {subtitle}
      </Text>
    </TouchableOpacity>
  );
}

type OwnerFilterChipProps = {
  label: string;
  active: boolean;
  onPress: () => void;
};

export function OwnerFilterChip({ label, active, onPress }: OwnerFilterChipProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.filterChip,
        {
          backgroundColor: active ? colors.tint : colors.surfaceSoft,
          borderColor: active ? colors.tint : colors.border,
        },
      ]}
      activeOpacity={0.8}
    >
      <Text
        style={[
          styles.filterChipText,
          { color: active ? colors.actionPrimaryText : colors.textMuted },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

type OwnerStatusBadgeProps = {
  label: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
};

export function OwnerStatusBadge({ label, tone = "neutral" }: OwnerStatusBadgeProps) {
  const { colors } = useTheme();
  const palette = getBadgePalette(colors, tone);

  return (
    <View style={[styles.badge, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      <Text style={[styles.badgeText, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

type OwnerActionButtonProps = {
  label: string;
  onPress: () => void;
  tone?: "primary" | "success" | "danger" | "neutral";
  icon?: React.ReactNode;
  flex?: number;
};

export function OwnerActionButton({
  label,
  onPress,
  tone = "primary",
  icon,
  flex = 1,
}: OwnerActionButtonProps) {
  const { colors } = useTheme();
  const palette = getActionPalette(colors, tone);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.actionButton,
        { backgroundColor: palette.bg, borderColor: palette.border, flex },
      ]}
      activeOpacity={0.85}
    >
      {icon}
      <Text style={[styles.actionButtonText, { color: palette.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function OwnerRatingBadge({ rating }: { rating: number | string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.ratingBadge, { backgroundColor: colors.tint }]}>
      <Text style={[styles.ratingText, { color: colors.actionPrimaryText }]}>
        ★ {rating}
      </Text>
    </View>
  );
}

function getBadgePalette(colors: AppColors, tone: OwnerStatusBadgeProps["tone"]) {
  switch (tone) {
    case "success":
      return {
        bg: colors.statusSuccessSoft,
        border: colors.statusSuccessBorder,
        text: colors.statusSuccess,
      };
    case "warning":
      return {
        bg: "rgba(245, 158, 11, 0.14)",
        border: "rgba(245, 158, 11, 0.35)",
        text: colors.statusWarning,
      };
    case "danger":
      return {
        bg: colors.statusDangerSoft,
        border: colors.statusDangerBorder,
        text: colors.statusDanger,
      };
    case "info":
      return {
        bg: "rgba(59, 130, 246, 0.12)",
        border: "rgba(59, 130, 246, 0.28)",
        text: colors.statusInfo,
      };
    default:
      return {
        bg: colors.surfaceSoft,
        border: colors.border,
        text: colors.textMuted,
      };
  }
}

function getActionPalette(colors: AppColors, tone: OwnerActionButtonProps["tone"]) {
  switch (tone) {
    case "success":
      return { bg: colors.statusSuccess, border: colors.statusSuccess, text: colors.white };
    case "danger":
      return { bg: colors.statusDanger, border: colors.statusDanger, text: colors.white };
    case "neutral":
      return {
        bg: colors.surfaceSoft,
        border: colors.border,
        text: colors.text,
      };
    default:
      return {
        bg: colors.tint,
        border: colors.tint,
        text: colors.actionPrimaryText,
      };
  }
}

export const ownerStyles = StyleSheet.create({
  screenPadding: {
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: 110,
  },
  contentGap: {
    gap: Spacing.xxl,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  gridItem: {
    width: "48.5%",
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  headerSide: {
    width: 44,
    alignItems: "flex-start",
  },
  headerSideRight: {
    alignItems: "flex-end",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  heroCard: {
    borderRadius: Spacing.round.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  heroText: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  card: {
    borderRadius: Spacing.round.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  gridAction: {
    width: "48.5%",
    borderRadius: Spacing.round.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
    minHeight: 132,
  },
  gridIcon: {
    width: 44,
    height: 44,
    borderRadius: Spacing.round.md,
    alignItems: "center",
    justifyContent: "center",
  },
  gridTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  gridSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  filterChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Spacing.round.full,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Spacing.round.sm,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Spacing.round.md,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  ratingBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Spacing.round.md,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
