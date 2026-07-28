export const SharedColors = {
  primary: "#f59e0b",
  success: "#10b981",
  error: "#ef4444",
  warning: "#f59e0b",
  info: "#3b82f6",
  white: "#ffffff",
  transparent: "transparent",
  shadow: "#000000",
};

export const LightColors = {
  ...SharedColors,
  background: "#f8fafc",
  card: "#ffffff",
  text: "#0f172a",
  textMuted: "#64748b",
  border: "#e2e8f0",
  borderSoft: "#cbd5e1",
  surfaceSoft: "#f1f5f9",
  surfaceStrong: "#e2e8f0",
  tint: "#f59e0b",
  actionPrimaryText: "#0f172a",
  actionOnDanger: "#ffffff",
  statusSuccess: "#10b981",
  statusSuccessSoft: "#dcfce7",
  statusSuccessBorder: "#86efac",
  statusWarning: "#f59e0b",
  statusDanger: "#ef4444",
  statusDangerSoft: "#fee2e2",
  statusDangerBorder: "#fecaca",
  statusInfo: "#3b82f6",
  iconActive: "#0f172a",
  iconInactive: "#94a3b8",
  tabBarBackground: "rgba(255, 255, 255, 0.95)",
  tabBarBorder: "#f1f5f9",
  tagBackground: "#f8fafc",
  tagText: "#64748b",
  slotIconBackground: "#fffbeb",
  slotText: "#0f172a",
  buttonBackground: "#0f172a",
  buttonText: "#ffffff",
  ratingStar: "#fbbf24",
};

export const DarkColors = {
  ...SharedColors,
  background: "#000000", // True Black
  card: "#18181b", // Deep Zinc (was #0f172a in ShopCard which is Slate 900)
  text: "#FFFFFF", // Pure White
  textMuted: "#a1a1aa", // Silver (was #94a3b8 in ShopCard which is Slate 400)
  border: "#27272a", // Zinc 800 (was #334155 in ShopCard which is Slate 700)
  borderSoft: "#3f3f46",
  surfaceSoft: "#27272a",
  surfaceStrong: "#3f3f46",
  tint: "#fbbf24", // Vivid Gold
  actionPrimaryText: "#0f172a",
  actionOnDanger: "#ffffff",
  statusSuccess: "#22c55e",
  statusSuccessSoft: "rgba(34, 197, 94, 0.18)",
  statusSuccessBorder: "rgba(34, 197, 94, 0.35)",
  statusWarning: "#f59e0b",
  statusDanger: "#ef4444",
  statusDangerSoft: "rgba(239, 68, 68, 0.16)",
  statusDangerBorder: "rgba(239, 68, 68, 0.35)",
  statusInfo: "#60a5fa",
  iconActive: "#fbbf24",
  iconInactive: "#475569",
  tabBarBackground: "rgba(15, 23, 42, 0.95)",
  tabBarBorder: "#1e293b",
  tagBackground: "#1e293b",
  tagText: "#94a3b8",
  slotIconBackground: "rgba(245, 158, 11, 0.1)",
  slotText: "#ffffff",
  buttonBackground: "#f59e0b",
  buttonText: "#0f172a",
  ratingStar: "#fbbf24",
};

// Default export for backwards compatibility (defaulting to Dark for now)
export default DarkColors;

export type AppColors = typeof LightColors;
