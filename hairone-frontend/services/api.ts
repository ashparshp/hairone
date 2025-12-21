import axios from "axios";
import { getItem } from "../utils/storage";

// REPLACE 'localhost' or '10.0.2.2' with your actual IP '192.168.1.39'
const API_URL = "http://192.168.1.39:8080/api";

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  const token = await getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const fullUrl = `${config.baseURL || API_URL}${config.url}`;
  console.log(`🚀 [REQ] ${config.method?.toUpperCase()} ${fullUrl}`);
  return config;
});

export default api;
