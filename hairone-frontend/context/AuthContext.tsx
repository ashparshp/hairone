import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter, useSegments } from 'expo-router';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, userData: any) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // 1. Load User on Startup
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('token');
        const storedUser = await SecureStore.getItemAsync('user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("Failed to load user session", e);
      } finally {
        setIsLoading(false); // Done loading
      }
    };

    loadUser();
  }, []);

  // 2. Protect Routes
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    // If NOT logged in and trying to access app -> Go to Login
    if (!user && !inAuthGroup) {
      router.replace('/');
    } 
    // If Logged in and on Login screen -> Go to App
    else if (user && inAuthGroup) {
      // Direct Admin to Admin Panel
      if (user.role === 'admin') {
        router.replace('/admin/dashboard' as any);
      } else {
        router.replace('/(tabs)/home');
      }
    }
  }, [user, isLoading, segments]);

  // 3. Login Function (Saves to Storage)
  const login = async (newToken: string, newUser: any) => {
    setToken(newToken);
    setUser(newUser);
    
    await SecureStore.setItemAsync('token', newToken);
    await SecureStore.setItemAsync('user', JSON.stringify(newUser));
  };

  // 4. Logout Function (Clears Storage)
  const logout = async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};