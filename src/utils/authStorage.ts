import { DriverAccount } from '../types/driver';

const ACCOUNTS_KEY = 'uber_driver_accounts_v1';
const ACTIVE_ACCOUNT_ID_KEY = 'uber_driver_active_account_id_v1';

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
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
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
  return DEFAULT_ACCOUNTS;
}

export function saveAccounts(accounts: DriverAccount[]): void {
  try {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
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
