import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const prefix = 'onboarding_skipped_';

const storageKey = (userId: string) => `${prefix}${userId}`;

export function getUserId(user: { _id?: string; id?: string } | null | undefined): string | null {
  if (!user) return null;
  const id = user._id ?? user.id;
  return id ? String(id) : null;
}

export async function getOnboardingSkipped(userId: string): Promise<boolean> {
  const key = storageKey(userId);
  if (Platform.OS === 'web') {
    return localStorage.getItem(key) === 'true';
  }
  const value = await SecureStore.getItemAsync(key);
  return value === 'true';
}

export async function setOnboardingSkipped(userId: string): Promise<void> {
  const key = storageKey(userId);
  if (Platform.OS === 'web') {
    localStorage.setItem(key, 'true');
    return;
  }
  await SecureStore.setItemAsync(key, 'true');
}

export function needsProfileOnboarding(
  user: { _id?: string; role?: string; name?: string } | null,
  dismissed: boolean,
): boolean {
  if (!user || user.role === 'admin' || dismissed) return false;
  return !user.name?.trim();
}
