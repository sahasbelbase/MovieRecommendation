import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDemoKeyForLocalTestingOnly123456",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "movierecomendation.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "movierecomendation",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "movierecomendation.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123456789:web:abcdef"
};

let app;
let auth = null;
let googleProvider = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
} catch (error) {
  console.warn("Firebase initialization warning (running in guest-friendly mode):", error);
}

export { auth, googleProvider };
