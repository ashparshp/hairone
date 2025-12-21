export const SharedColors = {
  primary: '#f59e0b',
  success: '#10b981',
  error: '#ef4444',
};

export const LightColors = {
  ...SharedColors,
  background: '#f8fafc',
  card: '#ffffff',
  text: '#0f172a',
  textMuted: '#64748b',
  border: '#e2e8f0',
  tint: '#f59e0b',
};

export const DarkColors = {
  ...SharedColors,
  background: '#000000', // True Black
  card: '#18181b',       // Deep Zinc
  text: '#FFFFFF',       // Pure White
  textMuted: '#a1a1aa',  // Silver
  border: '#27272a',     // Zinc 800
  tint: '#fbbf24',       // Vivid Gold
};

// Default export for backwards compatibility (defaulting to Dark for now)
export default DarkColors;
