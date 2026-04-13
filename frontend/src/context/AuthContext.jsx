import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../services/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser({
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || ''
        });
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const syncUserProfile = async (firebaseUser, fallbackName = 'User') => {
    const userPayload = {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || fallbackName,
      email: firebaseUser.email || ''
    };

    const userRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await setDoc(userRef, {
        ...userPayload,
        createdAt: serverTimestamp()
      });
    }

    setUser({
      id: firebaseUser.uid,
      ...userPayload,
      photoURL: firebaseUser.photoURL || ''
    });

    return userPayload;
  };

  const signInWithGoogle = async () => {
    setActionLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return syncUserProfile(result.user, 'User');
    } finally {
      setActionLoading(false);
    }
  };

  const signUpWithEmail = async ({ name, email, password }) => {
    setActionLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (name?.trim()) {
        await updateProfile(result.user, { displayName: name.trim() });
      }
      return syncUserProfile(result.user, name?.trim() || 'User');
    } finally {
      setActionLoading(false);
    }
  };

  const signInWithEmail = async ({ email, password }) => {
    setActionLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return syncUserProfile(result.user, 'User');
    } finally {
      setActionLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const value = useMemo(
    () => ({
      user,
      authLoading,
      loading: actionLoading,
      isAuthenticated: Boolean(user?.uid),
      signInWithGoogle,
      signUpWithEmail,
      signInWithEmail,
      logout
    }),
    [user, authLoading, actionLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
