import { Stack } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { BookingProvider } from '../context/BookingContext';
import { ToastProvider } from '../context/ToastContext';
import { ThemeProvider } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import SplashScreen from '../components/SplashScreen';

function AppContent() {
  const { isLoading } = useAuth();
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      // Keep splash visible for at least a moment or until loading finishes
      const timer = setTimeout(() => {
        setIsSplashVisible(false);
      }, 2000); // 2 seconds minimum splash for branding effect
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  if (isSplashVisible) {
    return <SplashScreen />;
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="salon" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <BookingProvider>
        <ThemeProvider>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
        </ThemeProvider>
      </BookingProvider>
    </AuthProvider>
  );
}