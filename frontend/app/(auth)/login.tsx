import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FadeInView, SlideInView } from "../../components/AnimatedViews";
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

const formatPhoneDisplay = (phone: string) => {
  if (phone.length !== 10) return phone;
  return `${phone.slice(0, 5)} ${phone.slice(5)}`;
};

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [step, setStep] = useState<1 | 2>(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const verifyingRef = useRef(false);
  const phoneValid = Boolean(normalizeIndianPhone(phone));

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    } else if (timer === 0) {
      setCanResend(true);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

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

  const handleSendOtp = async (isResend = false) => {
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

      setTimer(30);
      setCanResend(false);
      setOtp("");

      if (!isResend) setStep(2);
      else showToast("Code resent", "success");
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
    setStep(1);
    setOtp("");
    setTimer(30);
    setCanResend(false);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
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
            <FadeInView style={styles.brand}>
              <Logo width={220} height={86} />
            </FadeInView>

            {step === 1 ? (
              <SlideInView from="right" key="phone-step" style={styles.form}>
                <Text style={[styles.title, { color: colors.text }]}>
                  Welcome back
                </Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  Enter your mobile number to receive a login code.
                </Text>

                <Text style={[styles.label, { color: colors.textMuted }]}>
                  Mobile Number
                </Text>
                <PhoneNumberField
                  value={phone}
                  onChangeText={handlePhoneChange}
                  editable={!loading}
                  autoFocus
                  onSubmitEditing={() => {
                    if (phoneValid && !loading) handleSendOtp(false);
                  }}
                />

                <ScalePress
                  onPress={() => handleSendOtp(false)}
                  disabled={loading || !phoneValid}
                  accessibilityRole="button"
                  accessibilityLabel="Continue"
                  accessibilityState={{ disabled: loading || !phoneValid }}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: colors.tint,
                      opacity: loading || !phoneValid ? 0.45 : 1,
                    },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.actionPrimaryText} />
                  ) : (
                    <Text
                      style={[
                        styles.btnText,
                        { color: colors.actionPrimaryText },
                      ]}
                    >
                      Continue
                    </Text>
                  )}
                </ScalePress>
              </SlideInView>
            ) : (
              <SlideInView from="right" key="otp-step" style={styles.form}>
                <Text style={[styles.title, { color: colors.text }]}>
                  Enter OTP
                </Text>
                <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                  We sent a 4-digit code to{" "}
                  <Text style={{ color: colors.text, fontWeight: "700" }}>
                    +91 {formatPhoneDisplay(phone)}
                  </Text>
                </Text>

                <TouchableOpacity
                  onPress={handleChangeNumber}
                  disabled={loading}
                  hitSlop={12}
                  style={styles.editRow}
                >
                  <Text style={[styles.editText, { color: colors.tint }]}>
                    Change number
                  </Text>
                </TouchableOpacity>

                <OtpCodeInput
                  value={otp}
                  onChangeText={setOtp}
                  editable={!loading}
                />

                <ScalePress
                  onPress={handleLogin}
                  disabled={loading || otp.length !== 4}
                  accessibilityRole="button"
                  accessibilityLabel="Verify and login"
                  accessibilityState={{
                    disabled: loading || otp.length !== 4,
                  }}
                  style={[
                    styles.btn,
                    {
                      backgroundColor: colors.tint,
                      opacity: loading || otp.length !== 4 ? 0.45 : 1,
                    },
                  ]}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.actionPrimaryText} />
                  ) : (
                    <Text
                      style={[
                        styles.btnText,
                        { color: colors.actionPrimaryText },
                      ]}
                    >
                      Verify & Login
                    </Text>
                  )}
                </ScalePress>

                <View style={styles.resendWrap}>
                  {canResend ? (
                    <TouchableOpacity
                      onPress={() => handleSendOtp(true)}
                      disabled={loading}
                      hitSlop={10}
                    >
                      <Text
                        style={[styles.resendAction, { color: colors.tint }]}
                      >
                        Resend code
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <Text
                      style={[styles.resendWait, { color: colors.textMuted }]}
                    >
                      Resend code in {timer}s
                    </Text>
                  )}
                </View>
              </SlideInView>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xxl,
  },
  brand: {
    alignItems: "center",
    marginBottom: Spacing.xxl + Spacing.sm,
  },
  form: {
    width: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  label: {
    marginBottom: Spacing.sm,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  btn: {
    paddingVertical: Spacing.lg,
    borderRadius: Spacing.round.lg,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 54,
  },
  btnText: {
    fontWeight: "700",
    fontSize: 16,
  },
  editRow: {
    alignSelf: "flex-start",
    marginTop: -Spacing.md,
    marginBottom: Spacing.xl,
  },
  editText: {
    fontSize: 14,
    fontWeight: "700",
  },
  resendWrap: {
    marginTop: Spacing.xl,
    alignItems: "center",
    minHeight: 24,
  },
  resendAction: {
    fontWeight: "700",
    fontSize: 15,
  },
  resendWait: {
    fontSize: 14,
  },
});
