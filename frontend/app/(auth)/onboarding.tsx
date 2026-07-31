import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Mail, User } from 'lucide-react-native';
import { FadeInView } from '../../components/AnimatedViews';
import { UserAvatar } from '../../components/UserAvatar';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import api from '../../services/api';

export default function OnboardingScreen() {
  const { user, token, login, dismissOnboarding } = useAuth();
  const router = useRouter();
  const { colors, theme } = useTheme();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const goToApp = () => {
    if (user?.role === 'admin') {
      router.replace('/admin/(tabs)' as any);
      return;
    }
    if (user?.role === 'owner') {
      router.replace('/(tabs)/dashboard');
      return;
    }
    router.replace('/(tabs)/home');
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      setAvatar(result.assets[0].uri);
    }
  };

  const handleSkip = async () => {
    setSkipping(true);
    try {
      await dismissOnboarding();
      goToApp();
    } catch (e) {
      console.log(e);
      showToast('Could not skip setup', 'error');
    } finally {
      setSkipping(false);
    }
  };

  const handleContinue = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('Please enter your name', 'error');
      return;
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      showToast('Please enter a valid email', 'error');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('name', trimmedName);
      formData.append('email', email.trim());
      formData.append('gender', gender);

      if (avatar) {
        const filename = avatar.split('/').pop() || 'avatar.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';
        // @ts-ignore
        formData.append('avatar', { uri: avatar, name: filename, type });
      }

      const res = await api.put('/auth/profile', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (token) {
        await login(token, { ...user, ...res.data });
      }
      goToApp();
    } catch (e) {
      console.log(e);
      showToast('Failed to save profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <View style={styles.topBar}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              onPress={handleSkip}
              disabled={skipping || saving}
              style={styles.skipBtn}
            >
              {skipping ? (
                <ActivityIndicator color={colors.textMuted} size="small" />
              ) : (
                <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <FadeInView>
              <Text style={[styles.title, { color: colors.text }]}>Set up your profile</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>
                Tell us a bit about yourself so salons can recognize you.
              </Text>

              <View style={styles.avatarSection}>
                <TouchableOpacity onPress={pickImage} style={styles.avatarPicker}>
                  <UserAvatar
                    uri={avatar}
                    name={name}
                    size={108}
                    borderWidth={2}
                    borderColor={colors.border}
                  />
                  <View style={[styles.camIcon, { backgroundColor: colors.tint }]}>
                    <Camera size={16} color="#0f172a" />
                  </View>
                </TouchableOpacity>
                <Text style={[styles.avatarHint, { color: colors.textMuted }]}>
                  Add a profile photo (optional)
                </Text>
              </View>

              <Text style={[styles.label, { color: colors.textMuted }]}>Full Name</Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                    borderColor: colors.border,
                  },
                ]}
              >
                <User size={20} color={colors.textMuted} style={{ marginLeft: 12 }} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your name"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
              </View>

              <Text style={[styles.label, { color: colors.textMuted }]}>Email (optional)</Text>
              <View
                style={[
                  styles.inputContainer,
                  {
                    backgroundColor: theme === 'dark' ? '#0f172a' : '#f8fafc',
                    borderColor: colors.border,
                  },
                ]}
              >
                <Mail size={20} color={colors.textMuted} style={{ marginLeft: 12 }} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <Text style={[styles.label, { color: colors.textMuted }]}>Gender</Text>
              <View style={styles.genderRow}>
                {(['male', 'female', 'other'] as const).map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.genderChip,
                      {
                        backgroundColor: gender === option ? colors.tint : 'transparent',
                        borderColor: gender === option ? colors.tint : colors.border,
                      },
                    ]}
                    onPress={() => setGender(option)}
                  >
                    <Text
                      style={{
                        color: gender === option ? '#0f172a' : colors.text,
                        fontWeight: 'bold',
                        textTransform: 'capitalize',
                      }}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.continueBtn, { backgroundColor: colors.tint, opacity: saving ? 0.85 : 1 }]}
                onPress={handleContinue}
                disabled={saving || skipping}
              >
                {saving ? (
                  <ActivityIndicator color="#0f172a" />
                ) : (
                  <Text style={styles.continueBtnText}>Continue</Text>
                )}
              </TouchableOpacity>
            </FadeInView>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safeArea: { flex: 1 },
  keyboardView: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  skipBtn: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 48,
    alignItems: 'flex-end',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarPicker: {
    position: 'relative',
  },
  camIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarHint: {
    marginTop: 12,
    fontSize: 13,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 28,
  },
  genderChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  continueBtn: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  continueBtnText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },
});
