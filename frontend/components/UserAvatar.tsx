import React, { useState, useEffect } from "react";
import { View, Image, StyleSheet, ViewStyle } from "react-native";
import { useTheme } from "../context/ThemeContext";

interface UserAvatarProps {
  uri?: string | null;
  name?: string;
  seed?: string;
  size?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  style?: ViewStyle;
}

function getGeneratedAvatarUri(seed: string, size: number, isDark: boolean) {
  const backgroundColor = isDark ? "334155" : "e2e8f0";
  const pixelSize = Math.max(64, Math.round(size * 3));

  return `https://api.dicebear.com/9.x/lorelei/png?seed=${encodeURIComponent(seed)}&size=${pixelSize}&backgroundColor=${backgroundColor}`;
}

export function UserAvatar({
  uri,
  name,
  seed,
  size = 40,
  borderRadius,
  borderWidth = 0,
  borderColor,
  style,
}: UserAvatarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const radius = borderRadius ?? size / 2;
  const avatarSeed = seed || name?.trim() || 'hairone-user';
  const generatedUri = getGeneratedAvatarUri(avatarSeed, size, isDark);
  const [imageUri, setImageUri] = useState(uri || generatedUri);

  useEffect(() => {
    setImageUri(uri || generatedUri);
  }, [uri, generatedUri]);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: radius,
          borderWidth,
          borderColor,
          backgroundColor: isDark ? "#334155" : "#e2e8f0",
        },
        style,
      ]}
    >
      <Image
        source={{ uri: imageUri }}
        style={{ width: size, height: size, borderRadius: radius }}
        onError={() => {
          if (imageUri !== generatedUri) {
            setImageUri(generatedUri);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
