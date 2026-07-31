import React, { createContext, useContext, useState, useEffect } from "react";
import { useColorScheme, Platform } from "react-native";
import * as SystemUI from "expo-system-ui";
import { LightColors, DarkColors, AppColors } from "../constants/Colors";
import * as SecureStore from "expo-secure-store";

type ThemeType = "light" | "dark";

interface ThemeContextData {
  theme: ThemeType;
  colors: AppColors;
  toggleTheme: () => void;
  setTheme: (theme: ThemeType) => void;
}

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeType>(
    systemScheme === "dark" ? "dark" : "light",
  );

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      let stored;
      if (Platform.OS === "web") {
        stored = localStorage.getItem("app_theme");
      } else {
        stored = await SecureStore.getItemAsync("app_theme");
      }

      if (stored === "light" || stored === "dark") {
        setThemeState(stored);
      }
    } catch (e) {
      console.log("Failed to load theme", e);
    }
  };

  const setTheme = async (newTheme: ThemeType) => {
    setThemeState(newTheme);
    try {
      if (Platform.OS === "web") {
        localStorage.setItem("app_theme", newTheme);
      } else {
        await SecureStore.setItemAsync("app_theme", newTheme);
      }
    } catch (e) {
      console.log("Failed to save theme", e);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const colors = theme === "dark" ? DarkColors : LightColors;

  useEffect(() => {
    if (Platform.OS === "web") return;
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  return (
    <ThemeContext.Provider value={{ theme, colors, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
