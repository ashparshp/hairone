import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { Phone } from "lucide-react-native";
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
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        styles.container,
        {
          borderBottomColor: focused ? colors.tint : colors.border,
        },
      ]}
    >
      <Phone
        size={20}
        color={focused ? colors.tint : colors.textMuted}
        style={styles.icon}
      />
      <Text style={[styles.prefix, { color: colors.textMuted }]}>+91</Text>
      <TextInput
        style={[styles.input, { color: colors.text }]}
        placeholder="Mobile number"
        placeholderTextColor={colors.textMuted}
        keyboardType="phone-pad"
        value={value}
        onChangeText={onChangeText}
        maxLength={13}
        editable={editable}
        autoFocus={autoFocus}
        returnKeyType="done"
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
    alignItems: "center",
    borderBottomWidth: 1.5,
    minHeight: 52,
    paddingBottom: Spacing.sm,
  },
  icon: {
    marginRight: Spacing.md,
  },
  prefix: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    paddingVertical: Spacing.sm,
  },
});
