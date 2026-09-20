import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDPmjs8sj8jw-azGMPPZZzQjPhXaN8I3Bc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "movierecomandation-60b84.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "movierecomandation-60b84",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "movierecomandation-60b84.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "860521141567",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:860521141567:web:b317595dba43f1092d2f8a",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-CF1JWPGWC5"
};

let app;
let auth = null;
let googleProvider = null;
let db = null;
let analytics = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();
  googleProvider.addScope('https://www.googleapis.com/auth/drive.appdata');
  googleProvider.addScope('https://www.googleapis.com/auth/drive.file');
  googleProvider.setCustomParameters({
    prompt: 'select_account'
  });
  db = getFirestore(app);

  // Initialize analytics if supported in current browser environment
  if (typeof window !== 'undefined') {
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    }).catch(() => {});
  }
} catch (error) {
  console.warn("Firebase initialization notice:", error);
}

export { app, auth, googleProvider, db, analytics };
