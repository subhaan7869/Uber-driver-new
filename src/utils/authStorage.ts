import { DriverAccount } from '../types/driver';

const ACCOUNTS_KEY = 'uber_driver_accounts_v1';
const ACCOUNTS_BACKUP_KEY = 'uber_driver_accounts_backup_v1';
const ACTIVE_ACCOUNT_ID_KEY = 'uber_driver_active_account_id_v1';
const REMEMBERED_LOGIN_KEY = 'uber_driver_remembered_login_v1';

export interface RememberedLogin {
  accountId: string;
  name: string;
  email: string;
  password: string;
  city: string;
  rememberMe: boolean;
  lastSignedInAt: number;
}

export const DEFAULT_ACCOUNTS: DriverAccount[] = [
  {
    id: 'acct-alex',
    name: 'Alex Rivera',
    email: 'alex.rivera@uberuk.demo',
    password: 'password123',
    tier: 'Diamond',
    proPoints: 613,
    rating: 4.98,
    acceptanceRate: 96,
    cancellationRate: 2,
    vehicle: '2024 Toyota Camry Hybrid',
    vehicleColor: 'Midnight Black',
    licensePlate: 'LB24 UBR',
    phvBadge: 'TfL-PHV-88412',
    city: 'London',
    lastFaceVerifiedAt: null,
    drivingMinutesUsedToday: 118,
    batteryPct: 86,
  },
  {
    id: 'acct-sarah',
    name: 'Sarah Patel',
    email: 'sarah.patel@uberuk.demo',
    password: 'password123',
    tier: 'Platinum',
    proPoints: 410,
    rating: 4.95,
    acceptanceRate: 91,
    cancellationRate: 3,
    vehicle: '2024 Kia Niro EV',
    vehicleColor: 'Pearl White',
    licensePlate: 'MN24 EVZ',
    phvBadge: 'MCC-PHV-30219',
    city: 'Manchester',
    lastFaceVerifiedAt: null,
    drivingMinutesUsedToday: 64,
    batteryPct: 78,
  },
];

export function loadAccounts(): DriverAccount[] {
  for (const key of [ACCOUNTS_KEY, ACCOUNTS_BACKUP_KEY]) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((acct) => ({
            ...acct,
            batteryPct: typeof acct.batteryPct === 'number' ? acct.batteryPct : 84,
          }));
        }
      }
    } catch {
      // Ignore storage read errors
    }
  }
  return DEFAULT_ACCOUNTS;
}

export function saveAccounts(accounts: DriverAccount[]): void {
  try {
    const serialized = JSON.stringify(accounts);
    localStorage.setItem(ACCOUNTS_KEY, serialized);
    localStorage.setItem(ACCOUNTS_BACKUP_KEY, serialized);
  } catch {
    // Ignore storage write errors
  }
}

export function getActiveAccountId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_ID_KEY);
  } catch {
    return DEFAULT_ACCOUNTS[0].id;
  }
}

export function setActiveAccountId(accountId: string | null): void {
  try {
    if (accountId === null) {
      localStorage.setItem(ACTIVE_ACCOUNT_ID_KEY, '__signed_out__');
    } else {
      localStorage.setItem(ACTIVE_ACCOUNT_ID_KEY, accountId);
    }
  } catch {
    // Ignore storage write errors
  }
}

export function isExplicitlySignedOut(): boolean {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_ID_KEY) === '__signed_out__';
  } catch {
    return false;
  }
}

export function loadRememberedLogin(): RememberedLogin | null {
  try {
    const raw = localStorage.getItem(REMEMBERED_LOGIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RememberedLogin;
    if (!parsed || typeof parsed.email !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveRememberedLogin(payload: RememberedLogin | null): void {
  try {
    if (!payload || !payload.rememberMe) {
      localStorage.removeItem(REMEMBERED_LOGIN_KEY);
      return;
    }
    localStorage.setItem(REMEMBERED_LOGIN_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage write errors
  }
}

export async function storeBrowserCredential(
  email: string,
  password: string,
  name: string
): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      credentials?: {
        store?: (cred: unknown) => Promise<void>;
      };
    };
    const PasswordCred = (window as unknown as {
      PasswordCredential?: new (data: { id: string; password: string; name?: string }) => unknown;
    }).PasswordCredential;
    if (nav.credentials?.store && PasswordCred) {
      const cred = new PasswordCred({ id: email, password, name });
      await nav.credentials.store(cred);
    }
  } catch {
    // Ignore unsupported browser credential store errors
  }
}

export function exportAccountBackupCode(
  account: DriverAccount,
  ledger?: unknown
): string {
  const payload = JSON.stringify({ v: 1, account, ledger });
  const bytes = new TextEncoder().encode(payload);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `UBR1:${btoa(binary)}`;
}

export function importAccountBackupCode(
  code: string
): { account: DriverAccount; ledger?: unknown } | null {
  try {
    const trimmed = code.trim();
    if (!trimmed.startsWith('UBR1:')) return null;
    const b64 = trimmed.slice(5);
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(jsonStr);
    if (!parsed?.account?.id || !parsed?.account?.email || !parsed?.account?.name) {
      return null;
    }
    return {
      account: parsed.account as DriverAccount,
      ledger: parsed.ledger,
    };
  } catch {
    return null;
  }
}
