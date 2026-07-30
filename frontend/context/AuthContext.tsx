import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { User } from '../types';
import api, { setupAuthInterceptor } from '../services/api';
import {
  getOnboardingSkipped,
  getUserId,
  needsProfileOnboarding,
  setOnboardingSkipped,
} from '../utils/onboarding';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  onboardingReady: boolean;
  needsOnboarding: boolean;
  login: (token: string, userData: any) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
  dismissOnboarding: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [onboardingCheckDone, setOnboardingCheckDone] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  // 1. Load User on Startup
  useEffect(() => {
    const loadUser = async () => {
      try {
        let storedToken, storedUser;

        if (Platform.OS === 'web') {
           storedToken = localStorage.getItem('token');
           storedUser = localStorage.getItem('user');
        } else {
           storedToken = await SecureStore.getItemAsync('token');
           storedUser = await SecureStore.getItemAsync('user');
        }

        if (storedToken) {
          setToken(storedToken);
          try {
            const res = await api.get('/auth/me');
            setUser(res.data);
            const serialized = JSON.stringify(res.data);
            if (Platform.OS === 'web') {
              localStorage.setItem('user', serialized);
            } else {
              await SecureStore.setItemAsync('user', serialized);
            }
          } catch {
            if (Platform.OS === 'web') {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
            } else {
              await SecureStore.deleteItemAsync('token');
              await SecureStore.deleteItemAsync('user');
            }
            setToken(null);
            setUser(null);
          }
        } else if (storedUser) {
          if (Platform.OS === 'web') {
            localStorage.removeItem('user');
          } else {
            await SecureStore.deleteItemAsync('user');
          }
        }
      } catch (e) {
        console.error("Failed to load user session", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    const userId = getUserId(user);
    if (!userId) {
      setOnboardingDismissed(false);
      setOnboardingCheckDone(true);
      return;
    }

    let mounted = true;
    setOnboardingCheckDone(false);
    getOnboardingSkipped(userId).then((skipped) => {
      if (mounted) {
        setOnboardingDismissed((current) => current || skipped);
        setOnboardingCheckDone(true);
      }
    });

    return () => {
      mounted = false;
    };
  }, [user?._id, user?.id]);

  const dismissOnboarding = React.useCallback(async () => {
    const userId = getUserId(user);
    if (!userId) return;

    setOnboardingDismissed(true);
    try {
      await setOnboardingSkipped(userId);
    } catch (e) {
      console.log('Failed to persist onboarding skip', e);
    }
  }, [user]);

  const needsOnboarding = needsProfileOnboarding(user, onboardingDismissed);

  // 2. Protect Routes
  useEffect(() => {
    if (isLoading || (user && !onboardingCheckDone)) return;

    const inAuthGroup = segments[0] === '(auth)';
    const onOnboarding = inAuthGroup && String(segments[1]) === 'onboarding';

    // If NOT logged in and trying to access app -> Go to Login
    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    }
    else if (user && needsOnboarding && !onOnboarding) {
      router.replace('/(auth)/onboarding' as any);
    }
    else if (user && inAuthGroup) {
      if (user.role === 'admin') {
        router.replace('/admin/(tabs)' as any);
      } else if (user.role === 'owner') {
        router.replace('/(tabs)/dashboard');
      } else {
        router.replace('/(tabs)/home');
      }
    }
  }, [user, isLoading, onboardingCheckDone, needsOnboarding, segments]);

  // 3. Login Function (Saves to Storage)
  const login = React.useCallback(async (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
    
    if (Platform.OS === 'web') {
      localStorage.setItem('token', newToken);
      localStorage.setItem('user', JSON.stringify(newUser));
    } else {
      await SecureStore.setItemAsync('token', newToken);
      await SecureStore.setItemAsync('user', JSON.stringify(newUser));
    }
  }, []);

  // 4. Logout Function (Clears Storage)
  const logout = React.useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch (e) {
      console.log('Server logout failed; clearing local session anyway', e);
    }

    if (Platform.OS === 'web') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } else {
      await SecureStore.deleteItemAsync('token');
      await SecureStore.deleteItemAsync('user');
    }
    setToken(null);
    setUser(null);
  }, []);

  // Register the logout function with the API interceptor
  useEffect(() => {
    setupAuthInterceptor(logout);
  }, [logout]);

  const refreshUser = React.useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data) {
        setUser(res.data);
        if (Platform.OS === 'web') {
           localStorage.setItem('user', JSON.stringify(res.data));
        } else {
           await SecureStore.setItemAsync('user', JSON.stringify(res.data));
        }
      }
    } catch (e) {
      console.log('Failed to refresh user', e);
    }
  }, []);

  const value = React.useMemo(() => ({
    user,
    token,
    isLoading,
    onboardingReady: onboardingCheckDone,
    needsOnboarding,
    login,
    logout,
    refreshUser,
    dismissOnboarding,
  }), [user, token, isLoading, onboardingCheckDone, needsOnboarding, login, logout, refreshUser, dismissOnboarding]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};