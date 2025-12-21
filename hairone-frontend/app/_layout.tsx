import { Stack } from 'expo-router';
import { AuthProvider } from '../context/AuthContext';
import { BookingProvider } from '../context/BookingContext';
import { ToastProvider } from '../context/ToastContext';
import { ThemeProvider } from '../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <AuthProvider>
      <BookingProvider>
        <ThemeProvider>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="salon" />
            </Stack>
            <StatusBar style="auto" />
          </ToastProvider>
        </ThemeProvider>
      </BookingProvider>
    </AuthProvider>
  );
}