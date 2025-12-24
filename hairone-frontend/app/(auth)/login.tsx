import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { FadeInView } from "../../components/AnimatedViews";
import Logo from "../../components/Logo";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { useToast } from "../../context/ToastContext";
import api from "../../services/api";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);

  const otpInputRef = useRef<TextInput>(null);

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
    if (step === 2 && otp.length === 4) {
      handleLogin();
    }
  }, [otp]);

  const handleSendOtp = async (isResend = false) => {
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      showToast("Please enter a valid 10-digit mobile number", "error");
      return;
    }

    setLoading(true);
    Keyboard.dismiss();

    try {
      await api.post("/auth/otp", { phone });

      setTimer(30);
      setCanResend(false);
      setOtp("");

      if (!isResend) setStep(2);

      setTimeout(() => {
        otpInputRef.current?.focus();
      }, 150);
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
    if (otp.length !== 4) return;

    setLoading(true);
    try {
      const res = await api.post("/auth/verify", { phone, otp });
      const { token, user } = res.data;

      login(token, user);

      if (user.role === "admin") router.replace("/admin/dashboard" as any);
      else if (user.role === "owner")
        router.replace("/(tabs)/dashboard" as any);
      else router.replace("/(tabs)/home" as any);
    } catch (e: any) {
      console.log("Login Error", e);
      setOtp("");
      showToast(e.response?.data?.message || "Invalid OTP", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeNumber = () => {
    setStep(1);
    setOtp("");
    setTimer(30);
  };

  const renderOtpBoxes = () => {
    const boxes = [0, 1, 2, 3];
    return (
      <View style={styles.otpContainer}>
        {boxes.map((i) => (
          <View
            key={i}
            style={[
              styles.otpBox,
              {
                borderColor: otp.length === i ? colors.tint : colors.border,
                backgroundColor: colors.card,
                borderWidth: otp.length === i ? 2 : 1,
              },
            ]}
          >
            <Text style={[styles.otpText, { color: colors.text }]}>
              {otp[i] || ""}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <FadeInView>
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <Logo width={280} height={110} />
          <Text style={[styles.tagline, { color: colors.text }]}>
            Book a haircut in{" "}
            <Text style={[styles.highlight, { color: colors.tint }]}>
              seconds.
            </Text>
          </Text>
        </View>

        {step === 1 ? (
          <View style={{ width: "100%" }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>
              Mobile Number
            </Text>

            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.card,
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="9876543210"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={phone}
              onChangeText={(text) => setPhone(text.replace(/[^0-9]/g, ""))}
              maxLength={10}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.tint }]}
              onPress={() => handleSendOtp(false)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#f59e0b" />
              ) : (
                <Text style={styles.btnText}>Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ width: "100%", alignItems: "center" }}>
            <View style={{ flexDirection: "row", marginBottom: 20 }}>
              <Text style={{ color: colors.textMuted }}>
                Enter code sent to +91 {phone}{" "}
              </Text>
              <TouchableOpacity onPress={handleChangeNumber}>
                <Text style={{ color: colors.tint, fontWeight: "700" }}>
                  Edit
                </Text>
              </TouchableOpacity>
            </View>

            <TextInput
              ref={otpInputRef}
              style={styles.hiddenInput}
              keyboardType="number-pad"
              value={otp}
              onChangeText={(text) => {
                if (text.length <= 4) setOtp(text.replace(/[^0-9]/g, ""));
              }}
              maxLength={4}
              editable={!loading}
              autoFocus={false}
              caretHidden={true}
            />

            <TouchableOpacity
              activeOpacity={1}
              onPress={() => otpInputRef.current?.focus()}
              style={{ width: "100%", marginBottom: 30 }}
            >
              {renderOtpBoxes()}
            </TouchableOpacity>

            <View style={{ width: "100%" }}>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.tint }]}
                onPress={handleLogin}
                disabled={loading || otp.length !== 4}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.btnText}>Verify & Login</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={{ marginTop: 20 }}>
              {canResend ? (
                <TouchableOpacity
                  onPress={() => handleSendOtp(true)}
                  disabled={loading}
                >
                  <Text
                    style={{
                      color: colors.tint,
                      fontWeight: "700",
                      textAlign: "center",
                    }}
                  >
                    Resend Code
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={{ color: colors.textMuted, textAlign: "center" }}>
                  Resend in {timer}s
                </Text>
              )}
            </View>
          </View>
        )}
      </FadeInView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24 },

  tagline: {
    fontSize: 18,
    marginTop: 12,
    fontWeight: "400",
    letterSpacing: 0.5,
  },
  highlight: {
    fontWeight: "700",
    fontStyle: "italic",
  },

  label: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  input: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
    borderWidth: 1,
    width: "100%",
  },

  btn: {
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    width: "100%",
  },
  btnText: { fontWeight: "600", color: "#000000", fontSize: 16 },

  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingHorizontal: 10,
  },
  otpBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  otpText: {
    fontSize: 24,
    fontWeight: "700",
  },
});
