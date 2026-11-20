import { CompletedTrip } from '../types/driver';

const LEDGER_STORAGE_KEY = 'uber_driver_uk_ledger_v1';

export interface DriverLedger {
  dailyTotals: Record<string, number>;
  walletBalance: number;
  proPoints: number;
  questCompletedCount: number;
  completedTrips: CompletedTrip[];
}

export function getLocalDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getOffsetDateKey(daysOffset: number, baseDate: Date = new Date()): string {
  const d = new Date(baseDate);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + daysOffset);
  return getLocalDateKey(d);
}

export function getCurrentWeekDays(weekOffset = 0): Array<{
  day: string;
  dateKey: string;
  isToday: boolean;
  isYesterday: boolean;
}> {
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const yesterdayKey = getOffsetDateKey(-1, now);
  const jsDay = now.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() + diffToMonday + weekOffset * 7);

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return labels.map((label, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const key = getLocalDateKey(d);
    return {
      day: label,
      dateKey: key,
      isToday: key === todayKey,
      isYesterday: key === yesterdayKey,
    };
  });
}

export function formatWeekRangeLabel(weekOffset = 0): string {
  const week = getCurrentWeekDays(weekOffset);
  const start = new Date(`${week[0].dateKey}T00:00:00`);
  const end = new Date(`${week[6].dateKey}T00:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(start)} – ${fmt(end)}`;
}

function getLedgerKey(accountId?: string): string {
  return accountId ? `${LEDGER_STORAGE_KEY}_${accountId}` : LEDGER_STORAGE_KEY;
}

export function loadDriverLedger(
  initialDefaults: {
    proPoints: number;
    walletBalance: number;
    questCompletedCount: number;
  },
  accountId?: string
): DriverLedger {
  try {
    const raw =
      localStorage.getItem(getLedgerKey(accountId)) ||
      (accountId === 'acct-alex' ? localStorage.getItem(LEDGER_STORAGE_KEY) : null);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DriverLedger>;
      return {
        dailyTotals: parsed.dailyTotals ?? {},
        walletBalance:
          typeof parsed.walletBalance === 'number'
            ? parsed.walletBalance
            : initialDefaults.walletBalance,
        proPoints:
          typeof parsed.proPoints === 'number'
            ? parsed.proPoints
            : initialDefaults.proPoints,
        questCompletedCount:
          typeof parsed.questCompletedCount === 'number'
            ? parsed.questCompletedCount
            : initialDefaults.questCompletedCount,
        completedTrips: Array.isArray(parsed.completedTrips)
          ? parsed.completedTrips
          : [],
      };
    }
  } catch {
    // Ignore storage read error
  }

  return {
    dailyTotals: {},
    walletBalance: initialDefaults.walletBalance,
    proPoints: initialDefaults.proPoints,
    questCompletedCount: initialDefaults.questCompletedCount,
    completedTrips: [],
  };
}

export function saveDriverLedger(ledger: DriverLedger, accountId?: string): void {
  try {
    localStorage.setItem(getLedgerKey(accountId), JSON.stringify(ledger));
  } catch {
    // Ignore storage write error
  }
}

export function getWeeklyTotalFromLedger(
  dailyTotals: Record<string, number>,
  weekOffset = 0
): number {
  const week = getCurrentWeekDays(weekOffset);
  return Number(
    week
      .reduce((sum, item) => sum + (dailyTotals[item.dateKey] ?? 0), 0)
      .toFixed(2)
  );
}

export function getAllTimeTotalFromLedger(dailyTotals: Record<string, number>): number {
  return Number(
    Object.values(dailyTotals)
      .reduce((sum, val) => sum + (Number.isFinite(val) ? val : 0), 0)
      .toFixed(2)
  );
}
