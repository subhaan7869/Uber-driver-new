import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  auth,
  fetchAuthorizedDomains,
  googleProvider,
  isHostnameAuthorized,
  testConnection,
} from '../firebase';
import { isIosDevice, isStandalonePwa } from '../utils/iosPwa';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

interface FirebaseContextValue {
  user: User | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  unauthorizedHostname: string | null;
  isDomainAuthorized: boolean | null;
  syncStatus: CloudSyncStatus;
  lastCloudSyncAt: number | null;
  setSyncStatus: (status: CloudSyncStatus) => void;
  setLastCloudSyncAt: (ts: number | null) => void;
  signInWithGoogle: () => Promise<User | null>;
  signOutGoogle: () => Promise<void>;
  clearAuthError: () => void;
}

const FirebaseContext = createContext<FirebaseContextValue | undefined>(undefined);

function formatUnauthorizedDomainError(hostname: string): string {
  return `Google Sign-In is blocked on "${hostname}" because this domain is not in Firebase Console → Authentication → Settings → Authorized domains.`;
}

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => auth.currentUser);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unauthorizedHostname, setUnauthorizedHostname] = useState<string | null>(null);
  const [isDomainAuthorized, setIsDomainAuthorized] = useState<boolean | null>(null);
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('idle');
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<number | null>(null);

  useEffect(() => {
    void testConnection();
    void getRedirectResult(auth).catch(() => {
      // Ignore empty or stale redirect state on boot
    });

    if (typeof window !== 'undefined' && window.location?.hostname) {
      const host = window.location.hostname;
      void fetchAuthorizedDomains().then((domains) => {
        if (!domains) return;
        const allowed = isHostnameAuthorized(host, domains);
        setIsDomainAuthorized(allowed);
        setUnauthorizedHostname(allowed ? null : host);
      });
    }

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
    const currentHost =
      typeof window !== 'undefined' && window.location?.hostname
        ? window.location.hostname
        : '';

    if (isDomainAuthorized === false && currentHost) {
      setUnauthorizedHostname(currentHost);
      setAuthError(formatUnauthorizedDomainError(currentHost));
      return null;
    }

    setAuthLoading(true);
    setAuthError(null);
    setUnauthorizedHostname(null);

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setUser(cred.user);
      return cred.user;
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code || '')
          : '';
      const msg =
        error instanceof Error ? error.message : 'Google Sign-In could not complete.';

      if (code === 'auth/unauthorized-domain' || msg.includes('unauthorized-domain')) {
        const host = currentHost || 'this domain';
        setIsDomainAuthorized(false);
        setUnauthorizedHostname(host);
        setAuthError(formatUnauthorizedDomainError(host));
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          isIosDevice()
            ? 'Safari blocked the Google Sign-In popup. Tap Allow if prompted, or try opening the app in Safari.'
            : 'Browser blocked the Google Sign-In popup. Allow popups for this site and try again.'
        );
      } else if (
        code === 'auth/web-storage-unsupported' ||
        code === 'auth/operation-not-supported-in-this-environment'
      ) {
        setAuthError(
          'Browser privacy settings blocked sign-in storage. Ensure cookies/website data are enabled.'
        );
      } else if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
        if (isIosDevice() && isStandalonePwa()) {
          setAuthError(
            'iPhone Home Screen apps isolate Safari sign-in windows. Open this link in Safari if Google Sign-In does not return automatically.'
          );
        }
      } else if (code !== 'auth/cancelled-popup-request') {
        setAuthError(msg);
      }
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, [isDomainAuthorized]);

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

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  return (
    <FirebaseContext.Provider
      value={{
        user,
        authReady,
        authLoading,
        authError,
        unauthorizedHostname,
        isDomainAuthorized,
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
