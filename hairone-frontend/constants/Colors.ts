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
  background: '#0f172a',
  card: '#1e293b',
  text: '#ffffff',
  textMuted: '#cbd5e1',
  border: '#334155',
  tint: '#f59e0b',
};

// Default export for backwards compatibility (defaulting to Dark for now)
export default DarkColors;
