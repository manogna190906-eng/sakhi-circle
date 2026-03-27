import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.API_BASE_URL ?? 'http://localhost:3000',
  timeout: 10_000,
});

// Attach JWT from storage on every request
api.interceptors.request.use(async (config) => {
  // In production, retrieve token from SecureStore / AsyncStorage
  const token = (global as any).__authToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Emit event for navigation layer to redirect to login
      (global as any).__onAuthExpired?.();
    }
    return Promise.reject(err);
  },
);
