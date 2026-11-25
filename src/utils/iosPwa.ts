import { CompletedTrip, TripOffer } from '../types/driver';
import { buildHMRCTaxCsvFile } from './ukRealism';

export type ShortcutLaunchAction =
  | 'online'
  | 'offline'
  | 'earnings'
  | 'radar'
  | 'reserve'
  | 'inbox';

export interface AppleShortcutItem {
  action: ShortcutLaunchAction;
  label: string;
  siriPhrase: string;
  url: string;
}

export interface WebPushStatus {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  hasVapidKey: boolean;
  endpoint?: string;
}

const PUSH_SUB_STORAGE_KEY = 'uber_driver_webpush_sub_v1';

export function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua);
  const isIpadDesktopMode =
    navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1;
  return isAppleMobile || isIpadDesktopMode;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia?.('(display-mode: standalone)').matches === true
  );
}

/**
 * Updates the Home Screen app icon badge count on iOS 16.4+ / Chrome / Edge PWAs.
 */
export async function updateAppIconBadge(count: number): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & {
    setAppBadge?: (contents?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };

  try {
    const cleanCount = Math.max(0, Math.round(count));
    if (cleanCount > 0 && typeof nav.setAppBadge === 'function') {
      await nav.setAppBadge(cleanCount);
      return true;
    }
    if (cleanCount === 0 && typeof nav.clearAppBadge === 'function') {
      await nav.clearAppBadge();
      return true;
    }
  } catch {
    // Some browsers deny setAppBadge unless notifications permission is granted
  }
  return false;
}

/**
 * Parses Apple Shortcuts / Home Screen Quick Action URL parameters.
 * Example: ?action=online, ?action=offline, ?action=earnings, ?action=radar, ?action=reserve, ?action=inbox
 */
export function parseLaunchShortcutAction(searchString?: string): ShortcutLaunchAction | null {
  if (typeof window === 'undefined') return null;
  const search = searchString ?? window.location.search;
  if (!search) return null;

  try {
    const params = new URLSearchParams(search);
    const raw = (params.get('action') || params.get('tab') || '').trim().toLowerCase();
    if (
      raw === 'online' ||
      raw === 'offline' ||
      raw === 'earnings' ||
      raw === 'radar' ||
      raw === 'reserve' ||
      raw === 'inbox'
    ) {
      return raw;
    }
  } catch {
    // Ignore malformed query string
  }
  return null;
}

export function clearLaunchShortcutParam(): void {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.has('action') || url.searchParams.has('tab')) {
      url.searchParams.delete('action');
      url.searchParams.delete('tab');
      const next = `${url.pathname}${url.search}${url.hash}`;
      window.history.replaceState({}, '', next || '/');
    }
  } catch {
    // Ignore history error
  }
}

export function buildAppleShortcutItems(): AppleShortcutItem[] {
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'https://uber-driver-uk.vercel.app';

  return [
    {
      action: 'online',
      label: 'Go Online',
      siriPhrase: '"Hey Siri, Go online on Uber"',
      url: `${origin}/?action=online`,
    },
    {
      action: 'offline',
      label: 'Go Offline',
      siriPhrase: '"Hey Siri, Go offline on Uber"',
      url: `${origin}/?action=offline`,
    },
    {
      action: 'radar',
      label: 'Open Trip Radar',
      siriPhrase: '"Hey Siri, Check Trip Radar"',
      url: `${origin}/?action=radar`,
    },
    {
      action: 'earnings',
      label: 'Today’s Earnings',
      siriPhrase: '"Hey Siri, Show my Uber earnings"',
      url: `${origin}/?action=earnings`,
    },
    {
      action: 'reserve',
      label: 'Uber Reserve Queue',
      siriPhrase: '"Hey Siri, Check Uber Reserve"',
      url: `${origin}/?action=reserve`,
    },
    {
      action: 'inbox',
      label: 'Driver Inbox',
      siriPhrase: '"Hey Siri, Open Uber Inbox"',
      url: `${origin}/?action=inbox`,
    },
  ];
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function getConfiguredVapidKey(): string | undefined {
  try {
    const val = import.meta.env.VITE_VAPID_PUBLIC_KEY;
    return typeof val === 'string' && val.trim().length > 20 ? val.trim() : undefined;
  } catch {
    return undefined;
  }
}

export async function getWebPushStatus(): Promise<WebPushStatus> {
  const hasVapidKey = Boolean(getConfiguredVapidKey());
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    !('serviceWorker' in navigator)
  ) {
    return {
      supported: false,
      permission: 'unsupported',
      subscribed: false,
      hasVapidKey,
    };
  }

  const permission = Notification.permission;
  if (!('PushManager' in window)) {
    return {
      supported: false,
      permission,
      subscribed: false,
      hasVapidKey,
    };
  }

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return {
      supported: true,
      permission,
      subscribed: Boolean(sub),
      hasVapidKey,
      endpoint: sub?.endpoint,
    };
  } catch {
    return {
      supported: true,
      permission,
      subscribed: false,
      hasVapidKey,
    };
  }
}

export async function subscribeToWebPush(): Promise<{
  ok: boolean;
  reason: 'subscribed' | 'local_sw_ready' | 'needs_standalone_ios' | 'permission_denied' | 'unsupported';
  endpoint?: string;
}> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    if (isIosDevice() && !isStandalonePwa()) {
      return { ok: false, reason: 'needs_standalone_ios' };
    }
    return { ok: false, reason: 'unsupported' };
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    return { ok: false, reason: 'permission_denied' };
  }

  const vapidKey = getConfiguredVapidKey();
  if (!vapidKey || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: true, reason: 'local_sw_ready' };
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
    }
    try {
      localStorage.setItem(PUSH_SUB_STORAGE_KEY, JSON.stringify(sub.toJSON()));
    } catch {
      // Ignore storage error
    }
    return { ok: true, reason: 'subscribed', endpoint: sub.endpoint };
  } catch {
    return { ok: true, reason: 'local_sw_ready' };
  }
}

/**
 * Native iOS / Android Share Sheet helper for HMRC Tax Summary CSV.
 * Falls back cleanly to standard file download when Web Share files aren't supported.
 */
export async function shareOrDownloadHMRCTaxCsv(params: {
  driverName: string;
  totalBusinessMiles: number;
  completedTrips: CompletedTrip[];
  expenses: Parameters<typeof buildHMRCTaxCsvFile>[0]['expenses'];
}): Promise<{
  mode: 'shared' | 'downloaded' | 'cancelled' | 'failed';
  filename: string;
  taxReliefGbp: number;
}> {
  const built = buildHMRCTaxCsvFile(params);
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;

  if (nav && typeof nav.share === 'function') {
    try {
      const canShareFiles =
        typeof nav.canShare === 'function' && nav.canShare({ files: [built.file] });
      if (canShareFiles) {
        await nav.share({
          title: `HMRC UK Driver Tax Summary`,
          text: `Uber Driver UK HMRC Summary · ${params.totalBusinessMiles.toFixed(1)} business miles (£${built.taxReliefGbp.toFixed(2)} mileage relief)`,
          files: [built.file],
        });
        return { mode: 'shared', filename: built.filename, taxReliefGbp: built.taxReliefGbp };
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return { mode: 'cancelled', filename: built.filename, taxReliefGbp: built.taxReliefGbp };
      }
      // Fall through to browser download
    }
  }

  try {
    const url = URL.createObjectURL(built.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = built.filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { mode: 'downloaded', filename: built.filename, taxReliefGbp: built.taxReliefGbp };
  } catch {
    return { mode: 'failed', filename: built.filename, taxReliefGbp: built.taxReliefGbp };
  }
}

/**
 * Native iOS Share Sheet for sharing live GPS location, vehicle plate, and active trip status.
 */
export async function shareLiveTripStatus(params: {
  driverName: string;
  vehicle: string;
  licensePlate: string;
  city: string;
  lat: number;
  lng: number;
  activeTrip?: TripOffer | null;
  tripStage?: string;
}): Promise<'shared' | 'copied' | 'cancelled' | 'failed'> {
  const mapsUrl = `https://maps.apple.com/?ll=${params.lat.toFixed(5)},${params.lng.toFixed(5)}&q=${encodeURIComponent(
    `${params.driverName} (${params.licensePlate})`
  )}`;

  const tripLine = params.activeTrip
    ? `Active ${params.activeTrip.serviceName} trip (${params.tripStage || 'enroute'}): ${params.activeTrip.pickupArea} → ${params.activeTrip.dropoffArea}`
    : `Currently driving in ${params.city}`;

  const text = [
    `Uber Driver UK — Live Trip Safety Status`,
    `Driver: ${params.driverName}`,
    `Vehicle: ${params.vehicle} · Plate ${params.licensePlate}`,
    tripLine,
    `Live UK GPS: ${params.lat.toFixed(5)}, ${params.lng.toFixed(5)}`,
  ].join('\n');

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `Live Uber UK Trip — ${params.driverName}`,
        text,
        url: mapsUrl,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  try {
    await navigator.clipboard?.writeText(`${text}\n${mapsUrl}`);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * Native iOS Share Sheet for an individual trip receipt.
 */
export async function shareCompletedTripReceipt(trip: CompletedTrip): Promise<
  'shared' | 'copied' | 'cancelled' | 'failed'
> {
  const total = trip.fare + trip.tip + (trip.waitFee ?? 0) + (trip.claimAmount ?? 0);
  const net = trip.netPayout ?? Number((total - (trip.uberFee ?? 0)).toFixed(2));
  const relief = Number((trip.distanceMiles * 0.45).toFixed(2));

  const text = [
    `Uber Driver UK Receipt · ${trip.serviceName}`,
    `Route: ${trip.pickupArea} → ${trip.dropoffArea}`,
    `Completed: ${trip.completedAt}`,
    `Distance: ${trip.distanceMiles.toFixed(1)} mi (${trip.durationMin} min)`,
    `Gross Fare: £${trip.fare.toFixed(2)}${trip.tip > 0 ? ` (+£${trip.tip.toFixed(2)} tip)` : ''}`,
    typeof trip.uberFee === 'number' && trip.uberFee > 0
      ? `Uber Fee (25%): -£${trip.uberFee.toFixed(2)}`
      : null,
    `Net Payout: £${net.toFixed(2)}`,
    `HMRC £0.45/mi Tax Relief: £${relief.toFixed(2)}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: `Uber Trip Receipt · £${net.toFixed(2)}`,
        text,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  try {
    await navigator.clipboard?.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}
