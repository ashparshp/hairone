import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { LightColors, DarkColors } from '../constants/Colors';
import * as SecureStore from 'expo-secure-store';

type ThemeType = 'light' | 'dark';

interface ThemeContextData {
  theme: ThemeType;
  colors: typeof DarkColors;
  toggleTheme: () => void;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeType>(systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const stored = await SecureStore.getItemAsync('app_theme');
      if (stored === 'light' || stored === 'dark') {
        setThemeState(stored);
      }
    } catch (e) {
      console.log('Failed to load theme', e);
    }
  };

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    try {
        await SecureStore.setItemAsync('app_theme', newTheme);
    } catch (e) {
        console.log('Failed to save theme', e);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const colors = theme === 'dark' ? DarkColors : LightColors;

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
