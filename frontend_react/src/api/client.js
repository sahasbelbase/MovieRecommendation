import axios from 'axios';

let rawBaseUrl = import.meta.env.VITE_API_URL || '/api';

// If a remote URL is provided without the /api path, automatically append /api
if (rawBaseUrl && rawBaseUrl.startsWith('http') && !rawBaseUrl.replace(/\/+$/, '').endsWith('/api')) {
  rawBaseUrl = `${rawBaseUrl.replace(/\/+$/, '')}/api`;
}

const api = axios.create({
  baseURL: rawBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to inject Firebase ID token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cinematch_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
