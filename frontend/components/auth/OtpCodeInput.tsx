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
        accessibilityRole="button"
        accessibilityLabel="Enter OTP"
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
                  borderColor: active
                    ? colors.tint
                    : filled
                      ? colors.borderSoft
                      : colors.border,
                  backgroundColor: colors.card,
                  borderWidth: active ? 2 : 1.5,
                },
              ]}
            >
              <Text style={[styles.digit, { color: colors.text }]}>
                {value[i] || ""}
              </Text>
              {active && !filled ? (
                <View
                  style={[styles.caret, { backgroundColor: colors.tint }]}
                />
              ) : null}
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
    marginBottom: Spacing.xxl,
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
    gap: Spacing.md,
  },
  box: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 72,
    borderRadius: Spacing.round.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  digit: {
    fontSize: 26,
    fontWeight: "700",
  },
  caret: {
    position: "absolute",
    width: 2,
    height: 24,
    borderRadius: 1,
    opacity: 0.9,
  },
});
