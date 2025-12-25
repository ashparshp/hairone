export const SharedColors = {
  primary: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
  white: '#ffffff',
  transparent: 'transparent',
};

export const LightColors = {
  ...SharedColors,
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  tint: '#f59e0b',
  iconActive: '#0f172a',
  iconInactive: '#94a3b8',
  tabBarBackground: 'rgba(255, 255, 255, 0.95)',
  tabBarBorder: '#f1f5f9',
  tagBackground: '#f8fafc',
  tagText: '#64748b',
  slotIconBackground: '#fffbeb',
  slotText: '#0f172a',
  buttonBackground: '#0f172a',
  buttonText: '#ffffff',
  ratingStar: '#fbbf24',
};

export const DarkColors = {
  ...SharedColors,
  background: '#000000', // True Black
  card: '#18181b',       // Deep Zinc (was #0f172a in ShopCard which is Slate 900)
  text: '#FFFFFF',       // Pure White
  textMuted: '#a1a1aa',  // Silver (was #94a3b8 in ShopCard which is Slate 400)
  border: '#27272a',     // Zinc 800 (was #334155 in ShopCard which is Slate 700)
  tint: '#fbbf24',       // Vivid Gold
  iconActive: '#fbbf24',
  iconInactive: '#475569',
  tabBarBackground: 'rgba(15, 23, 42, 0.95)',
  tabBarBorder: '#1e293b',
  tagBackground: '#1e293b',
  tagText: '#94a3b8',
  slotIconBackground: 'rgba(245, 158, 11, 0.1)',
  slotText: '#ffffff',
  buttonBackground: '#f59e0b',
  buttonText: '#0f172a',
  ratingStar: '#fbbf24',
};

// Default export for backwards compatibility (defaulting to Dark for now)
export default DarkColors;
