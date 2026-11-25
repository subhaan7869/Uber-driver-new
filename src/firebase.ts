import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const customAuthDomain =
  typeof import.meta !== 'undefined' &&
  typeof import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN === 'string' &&
  import.meta.env.VITE_FIREBASE_AUTH_DOMAIN.trim().length > 0
    ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN.trim()
    : firebaseConfig.authDomain;

export const effectiveFirebaseConfig = {
  ...firebaseConfig,
  authDomain: customAuthDomain,
};

export const app = initializeApp(effectiveFirebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function isHostnameAuthorized(hostname: string, authorizedDomains: string[]): boolean {
  const cleanHost = hostname.trim().toLowerCase();
  if (!cleanHost) return false;
  return authorizedDomains.some((domain) => {
    const cleanDomain = domain.trim().toLowerCase();
    if (!cleanDomain) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cleanDomain)) {
      return cleanHost === cleanDomain;
    }
    return cleanHost === cleanDomain || cleanHost.endsWith(`.${cleanDomain}`);
  });
}

export async function fetchAuthorizedDomains(): Promise<string[] | null> {
  if (!firebaseConfig.apiKey) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(firebaseConfig.apiKey)}`,
      { method: 'GET', cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { authorizedDomains?: unknown };
    if (Array.isArray(data?.authorizedDomains)) {
      return data.authorizedDomains.filter((d): d is string => typeof d === 'string');
    }
    return null;
  } catch {
    return null;
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let connectionTested = false;

export async function testConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration — the Firestore client is offline.');
    }
    // Expected permission/not-found errors on test/connection verify network connectivity succeeded.
  }
}
