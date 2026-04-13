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
import { bootstrapUserRealtimeData } from '../services/salesDataService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        console.info('[Auth] Login success', {
          uid: firebaseUser.uid,
          email: firebaseUser.email || ''
        });

        setUser({
          id: firebaseUser.uid,
          uid: firebaseUser.uid,
          name: firebaseUser.displayName || 'User',
          email: firebaseUser.email || '',
          photoURL: firebaseUser.photoURL || ''
        });

        syncUserProfile(firebaseUser, firebaseUser.displayName || 'User')
          .catch((error) => {
            console.error('[Auth] Firestore user sync failed', {
              code: error?.code || '',
              message: error?.message || String(error || '')
            });
          })
          .finally(() => setAuthLoading(false));
        return;
      } else {
        console.info('[Auth] Logged out');
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

    try {
      const userRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        await setDoc(userRef, {
          ...userPayload,
          createdAt: serverTimestamp()
        });
        console.info('[Auth] Firestore write success: user created', {
          uid: firebaseUser.uid
        });
      } else {
        console.info('[Auth] Firestore user exists, skipping create', {
          uid: firebaseUser.uid
        });
      }
    } catch (error) {
      console.error('[Auth] Firestore user write error', {
        code: error?.code || '',
        message: error?.message || String(error || ''),
        uid: firebaseUser.uid
      });
    }

    setUser({
      id: firebaseUser.uid,
      ...userPayload,
      photoURL: firebaseUser.photoURL || ''
    });

    return userPayload;
  };

  useEffect(() => {
    if (!user?.uid) {
      return () => {};
    }

    let cancelled = false;

    (async () => {
      try {
        const created = await bootstrapUserRealtimeData({
          userId: user.uid,
          userName: auth.currentUser?.displayName || user.name || 'User',
          userEmail: auth.currentUser?.email || user.email || ''
        });

        if (!cancelled) {
          console.info('[Auth] Bootstrap pipeline complete', {
            uid: user.uid,
            created
          });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('[Auth] Bootstrap pipeline error', {
            code: error?.code || '',
            message: error?.message || String(error || ''),
            uid: user.uid
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const signInWithGoogle = async () => {
    setActionLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const payload = await syncUserProfile(result.user, 'User');
      console.info('[Auth] Google login success', { uid: result.user.uid });
      return payload;
    } catch (error) {
      console.error('[Auth] Google login failed', {
        code: error?.code || '',
        message: error?.message || String(error || '')
      });
      throw error;
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
      const payload = await syncUserProfile(result.user, name?.trim() || 'User');
      console.info('[Auth] Email signup success', { uid: result.user.uid });
      return payload;
    } catch (error) {
      console.error('[Auth] Email signup failed', {
        code: error?.code || '',
        message: error?.message || String(error || '')
      });
      throw error;
    } finally {
      setActionLoading(false);
    }
  };

  const signInWithEmail = async ({ email, password }) => {
    setActionLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const payload = await syncUserProfile(result.user, 'User');
      console.info('[Auth] Email login success', { uid: result.user.uid });
      return payload;
    } catch (error) {
      console.error('[Auth] Email login failed', {
        code: error?.code || '',
        message: error?.message || String(error || '')
      });
      throw error;
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
