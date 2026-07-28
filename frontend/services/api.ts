import axios, { InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";
import { Alert, Platform } from "react-native";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error(
    "EXPO_PUBLIC_API_URL is not defined. Copy frontend/.env.example to frontend/.env and set your API URL.",
  );
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Auth Logout Callback Mechanism
let logoutCallback: (() => void) | null = null;
export const setupAuthInterceptor = (callback: () => void) => {
  logoutCallback = callback;
};

// Request Interceptor: Attach Token
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    let token: string | null = null;
    if (Platform.OS === 'web') {
        token = localStorage.getItem("token");
    } else {
        token = await SecureStore.getItemAsync("token");
    }

    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Global Errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (logoutCallback) {
        Alert.alert("Session Expired", "Please log in again.", [
          { text: "OK", onPress: () => logoutCallback && logoutCallback() }
        ]);
      } else {
        if (Platform.OS === 'web') {
            localStorage.removeItem("token");
        } else {
            await SecureStore.deleteItemAsync("token");
        }
        Alert.alert("Session Expired", "Please log in again.");
      }
    }

    if (error.code === "ECONNABORTED") {
      Alert.alert(
        "Connection Timeout",
        "The server is taking too long to respond."
      );
    }

    return Promise.reject(error);
  }
);

export const createReview = async (data: { bookingId: string; rating: number; comment?: string }) => {
  const response = await api.post('/reviews', data);
  return response.data;
};

export const getShopReviews = async (shopId: string, page = 1) => {
  const response = await api.get(`/reviews/shop/${shopId}?page=${page}`);
  return response.data;
};

export default api;
