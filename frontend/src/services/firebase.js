import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCE3ojPiNK01kGxGri5mmk_XROFneuqyvg',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'decisionmaking-48cba.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'decisionmaking-48cba',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'decisionmaking-48cba.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '652655215612',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:652655215612:web:bd781a6f7eb112b42be879',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-D7JX1TXH6K'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);
const storage = getStorage(app);

let analytics = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, analytics, auth, googleProvider, db, storage };
