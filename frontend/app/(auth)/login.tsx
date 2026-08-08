import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import LoginHero from "../../components/auth/LoginHero";
import OtpCodeInput from "../../components/auth/OtpCodeInput";
import PhoneNumberField from "../../components/auth/PhoneNumberField";
import Logo from "../../components/Logo";
import { ScalePress } from "../../components/ScalePress";
import { Spacing } from "../../constants/Spacing";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import api from "../../services/api";
import { normalizeIndianPhone } from "../../utils/phone";

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const verifyingRef = useRef(false);
  const phoneValid = Boolean(normalizeIndianPhone(phone));
  const sheetColor = theme === "dark" ? colors.background : "#ffffff";
  const canSubmit =
    !loading && (step === 1 ? phoneValid : otp.length === 4);

  useEffect(() => {
    if (step === 2 && otp.length === 4 && !loading && !verifyingRef.current) {
      handleLogin();
    }
  }, [otp, step]);

  const handlePhoneChange = (text: string) => {
    const normalized = normalizeIndianPhone(text);
    if (normalized) {
      setPhone(normalized);
      return;
    }
    setPhone(text.replace(/\D/g, "").slice(0, 12));
  };

  const handleSendOtp = async () => {
    const normalized = normalizeIndianPhone(phone);
    if (!normalized) {
      showToast("Please enter a valid 10-digit mobile number", "error");
      return;
    }

    setPhone(normalized);
    setLoading(true);
    Keyboard.dismiss();

    try {
      await api.post("/auth/otp", { phone: normalized });
      setOtp("");
      setStep(2);
    } catch (e: any) {
      console.log("OTP Error:", e);
      let msg = "Something went wrong.";
      if (e.response) msg = e.response.data.message || "Server Error";
      else if (e.request) msg = "Network Error.";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (otp.length !== 4 || verifyingRef.current) return;

    const normalized = normalizeIndianPhone(phone);
    if (!normalized) {
      showToast("Please enter a valid 10-digit mobile number", "error");
      setStep(1);
      return;
    }

    verifyingRef.current = true;
    setLoading(true);
    try {
      const res = await api.post("/auth/verify", { phone: normalized, otp });
      const { token, user } = res.data;
      await login(token, user);
    } catch (e: any) {
      console.log("Login Error", e);
      setOtp("");
      const msg = e.response?.data?.message || "Invalid OTP";
      showToast(msg, "error");
      if (typeof msg === "string" && msg.toLowerCase().includes("suspended")) {
        setStep(1);
      }
    } finally {
      setLoading(false);
      verifyingRef.current = false;
    }
  };

  const handleChangeNumber = () => {
    if (step !== 2 || loading) return;
    setStep(1);
    setOtp("");
  };

  return (
    <View style={[styles.root, { backgroundColor: sheetColor }]}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <LoginHero sheetColor={sheetColor}>
            <TouchableOpacity
              onPress={handleChangeNumber}
              activeOpacity={step === 2 ? 0.7 : 1}
              disabled={step !== 2}
              style={styles.logoWrap}
            >
              <Logo width={240} height={94} color="#0f172a" />
            </TouchableOpacity>
          </LoginHero>

          <View style={[styles.sheet, { backgroundColor: sheetColor }]}>
            <View style={styles.form}>
              {step === 1 ? (
                <PhoneNumberField
                  value={phone}
                  onChangeText={handlePhoneChange}
                  editable={!loading}
                  autoFocus
                  onSubmitEditing={() => {
                    if (phoneValid && !loading) handleSendOtp();
                  }}
                />
              ) : (
                <OtpCodeInput
                  value={otp}
                  onChangeText={setOtp}
                  editable={!loading}
                />
              )}

              <ScalePress
                onPress={() =>
                  step === 1 ? handleSendOtp() : handleLogin()
                }
                disabled={!canSubmit}
                style={[
                  styles.btn,
                  {
                    backgroundColor: colors.tint,
                    opacity: canSubmit ? 1 : 0.4,
                  },
                ]}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.btnText}>
                    {step === 1 ? "Continue" : "Verify"}
                  </Text>
                )}
              </ScalePress>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <SafeAreaView edges={["bottom"]} style={{ backgroundColor: sheetColor }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  logoWrap: {
    alignItems: "center",
  },
  sheet: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl + Spacing.sm,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xxl,
  },
  form: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    marginTop: Spacing.sm,
  },
  btn: {
    marginTop: Spacing.xxl + Spacing.md,
    minHeight: 54,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  btnText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 17,
  },
});
