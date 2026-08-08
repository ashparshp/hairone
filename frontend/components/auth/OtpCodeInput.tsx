import React, { useEffect, useRef } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { Spacing } from "../../constants/Spacing";

type OtpCodeInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
  length?: number;
  autoFocus?: boolean;
};

export default function OtpCodeInput({
  value,
  onChangeText,
  editable = true,
  length = 4,
  autoFocus = true,
}: OtpCodeInputProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const boxes = Array.from({ length }, (_, i) => i);

  useEffect(() => {
    if (!autoFocus) return;
    const id = setTimeout(() => inputRef.current?.focus(), 200);
    return () => clearTimeout(id);
  }, [autoFocus]);

  return (
    <View style={styles.wrap}>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        keyboardType="number-pad"
        value={value}
        onChangeText={(text) => {
          onChangeText(text.replace(/[^0-9]/g, "").slice(0, length));
        }}
        maxLength={length}
        editable={editable}
        caretHidden
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        accessibilityLabel="One time password"
      />

      <Pressable
        onPress={() => inputRef.current?.focus()}
        style={styles.boxesRow}
      >
        {boxes.map((i) => {
          const filled = Boolean(value[i]);
          const active = value.length === i;
          return (
            <View
              key={i}
              style={[
                styles.box,
                {
                  borderBottomColor:
                    active || filled ? colors.tint : colors.border,
                },
              ]}
            >
              <Text style={[styles.digit, { color: colors.text }]}>
                {value[i] || ""}
              </Text>
            </View>
          );
        })}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  boxesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.lg,
  },
  box: {
    flex: 1,
    height: 52,
    borderBottomWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontSize: 24,
    fontWeight: "700",
  },
});
