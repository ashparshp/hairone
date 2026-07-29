import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { BookingProvider } from '../context/BookingContext';
import { ToastProvider } from '../context/ToastContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { LocationProvider } from '../context/LocationContext';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import SplashScreenComponent from '../components/SplashScreen';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { isLoading } = useAuth();
  const { theme } = useTheme();
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage.getItem('TEST_MODE')) {
        setIsSplashVisible(false);
        return;
    }

    if (!isLoading) {
      // Keep splash visible for at least a moment or until loading finishes
      const timer = setTimeout(async () => {
        await SplashScreen.hideAsync();
        setIsSplashVisible(false);
      }, 500); // Reduced splash time for faster open
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (isSplashVisible) {
    return (
      <>
        <SplashScreenComponent />
        <StatusBar style="light" />
      </>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="salon" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="support" />
        <Stack.Screen name="admin" />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <BookingProvider>
        <ThemeProvider>
          <LocationProvider>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
          </LocationProvider>
        </ThemeProvider>
      </BookingProvider>
    </AuthProvider>
  );
}