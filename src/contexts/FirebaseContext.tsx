import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import { auth, googleProvider, testConnection } from '../firebase';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  syncStatus: CloudSyncStatus;
  lastCloudSyncAt: number | null;
  setSyncStatus: (status: CloudSyncStatus) => void;
  setLastCloudSyncAt: (ts: number | null) => void;
  signInWithGoogle: () => Promise<User | null>;
  signOutGoogle: () => Promise<void>;
  clearAuthError: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('idle');
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<number | null>(null);

  useEffect(() => {
    void testConnection();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setSyncStatus('idle');
      }
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<User | null> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setUser(cred.user);
      return cred.user;
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Google Sign-In could not complete.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOutGoogle = useCallback(async (): Promise<void> => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signOut(auth);
      setUser(null);
      setSyncStatus('idle');
      setLastCloudSyncAt(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Failed to sign out of Google.');
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        authLoading,
        authError,
        syncStatus,
        lastCloudSyncAt,
        setSyncStatus,
        setLastCloudSyncAt,
        signInWithGoogle,
        signOutGoogle,
        clearAuthError,
      }}
    >
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase must be used inside FirebaseProvider');
  }
  return ctx;
}
