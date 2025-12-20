import axios from "axios";
import * as SecureStore from "expo-secure-store";

// REPLACE 'localhost' or '10.0.2.2' with your actual IP '192.168.1.39'
const API_URL = "http://192.168.1.39:8080/api";

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;


// import axios from "axios";
// import * as SecureStore from "expo-secure-store";
// import { Alert } from "react-native";

// // 1. Use the environment variable
// const API_URL = process.env.EXPO_PUBLIC_API_URL;

// const api = axios.create({
//   baseURL: API_URL,
//   timeout: 10000,
//   headers: {
//     "Content-Type": "application/json",
//   },
// });

// // Request Interceptor: Attach Token
// api.interceptors.request.use(async (config) => {
//   const token = await SecureStore.getItemAsync("token");
//   if (token) {
//     config.headers.Authorization = `Bearer ${token}`;
//   }
//   return config;
// }, (error) => Promise.reject(error));

// // Response Interceptor: Handle Global Errors
// api.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     // If the server returns 401 (Unauthorized), the token is likely expired
//     if (error.response?.status === 401) {
//       await SecureStore.deleteItemAsync("token");
//       Alert.alert("Session Expired", "Please log in again.");
//       // Tip: You can trigger a logout logic here to redirect to Login screen
//     }
    
//     // Handle specific production errors (Server down, Timeout)
//     if (error.code === 'ECONNABORTED') {
//       Alert.alert("Connection Timeout", "The server is taking too long to respond.");
//     }

//     return Promise.reject(error);
//   }
// );

// export default api;