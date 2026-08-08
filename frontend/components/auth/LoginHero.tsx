import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useTheme } from "../../context/ThemeContext";

type LoginHeroProps = {
  children: React.ReactNode;
  sheetColor: string;
};

const SCREEN_H = Dimensions.get("window").height;

export default function LoginHero({ children, sheetColor }: LoginHeroProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const heroHeight = Math.max(300, Math.round(SCREEN_H * 0.42));
  const isDark = theme === "dark";

  const gradient = (
    isDark
      ? ["#6B7280", "#787F8C", "#5C6370"]
      : ["#E8EAED", "#D1D5DB", "#C0C5CE"]
  ) as [string, string, ...string[]];

  return (
    <View style={[styles.wrap, { height: heroHeight + 48 }]}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { height: heroHeight, paddingTop: insets.top }]}
      >
        <View style={styles.heroContent}>{children}</View>
      </LinearGradient>

      <Svg
        width="100%"
        height={80}
        viewBox="0 0 390 80"
        preserveAspectRatio="none"
        style={[styles.wave, { top: heroHeight - 52 }]}
      >
        <Path
          d="M0 48 C 80 48 110 14 195 14 C 280 14 310 48 390 48 L390 80 L0 80 Z"
          fill={sheetColor}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    position: "relative",
  },
  hero: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  heroContent: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 28,
    zIndex: 1,
  },
  wave: {
    position: "absolute",
    left: 0,
    right: 0,
  },
});
