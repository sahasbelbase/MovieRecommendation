import axios from 'axios';

// The production backend hosted on Render
const PROD_API_URL = 'https://movierecommendation-t8yr.onrender.com/api';

let rawBaseUrl = import.meta.env.VITE_API_URL;

if (!rawBaseUrl) {
  // If running in production (e.g. on Cloudflare Pages or external domain), connect directly to Render backend
  if (typeof window !== 'undefined' && !window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
    rawBaseUrl = PROD_API_URL;
  } else {
    rawBaseUrl = '/api';
  }
}

// If a remote URL is provided without the /api path, automatically append /api
if (rawBaseUrl && rawBaseUrl.startsWith('http') && !rawBaseUrl.replace(/\/+$/, '').endsWith('/api')) {
  rawBaseUrl = `${rawBaseUrl.replace(/\/+$/, '')}/api`;
}

const api = axios.create({
  baseURL: rawBaseUrl,
  timeout: 15000,
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

export const getWsUrl = (path) => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (rawBaseUrl && rawBaseUrl.startsWith('http')) {
    const wsProto = rawBaseUrl.startsWith('https:') ? 'wss:' : 'ws:';
    const host = new URL(rawBaseUrl).host;
    return `${wsProto}//${host}/api${cleanPath}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/api${cleanPath}`;
};

export default api;
