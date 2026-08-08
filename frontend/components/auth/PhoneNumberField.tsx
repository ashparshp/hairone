import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { Spacing } from "../../constants/Spacing";

type PhoneNumberFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  editable?: boolean;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
};

export default function PhoneNumberField({
  value,
  onChangeText,
  editable = true,
  autoFocus = false,
  onSubmitEditing,
}: PhoneNumberFieldProps) {
  const { colors } = useTheme();
  const isValid = value.length === 10;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: isValid ? colors.tint : colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.prefix,
          {
            borderRightColor: colors.border,
            backgroundColor: colors.surfaceSoft,
          },
        ]}
      >
        <Text style={[styles.prefixText, { color: colors.text }]}>+91</Text>
      </View>
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder="98765 43210"
        placeholderTextColor={colors.textMuted}
        keyboardType="phone-pad"
        value={value}
        onChangeText={onChangeText}
        maxLength={13}
        editable={editable}
        autoFocus={autoFocus}
        returnKeyType="done"
        onSubmitEditing={onSubmitEditing}
        textContentType="telephoneNumber"
        autoComplete="tel"
        accessibilityLabel="Mobile number"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1.5,
    borderRadius: Spacing.round.lg,
    overflow: "hidden",
    marginBottom: Spacing.xxl,
    minHeight: 56,
  },
  prefix: {
    paddingHorizontal: Spacing.lg,
    justifyContent: "center",
    borderRightWidth: 1,
  },
  prefixText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  input: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 1,
  },
});
