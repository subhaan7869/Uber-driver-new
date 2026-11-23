import { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  CompletedTrip,
  DriverAccount,
  DriverPreferences,
  ReserveTrip,
  TripActivityEntry,
  TripStats,
} from '../types/driver';
import { DriverLedger, getLocalDateKey } from '../utils/earningsStorage';

export const DRIVER_LEDGER_STATE_ID = 'driver_ledger';

export function sanitizeFirestoreId(raw: string, fallbackPrefix = 'item'): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}_${Date.now()}`;
}

function clampStr(val: string | undefined, maxLen: number, fallback: string): string {
  const s = (val ?? '').trim();
  if (!s) return fallback.slice(0, maxLen);
  return s.slice(0, maxLen);
}

function clampNum(val: number | undefined, min: number, max: number, fallback: number): number {
  const n = typeof val === 'number' && Number.isFinite(val) ? val : fallback;
  return Math.min(max, Math.max(min, n));
}

function sanitizeDailyTotals(dailyTotals: Record<string, number>): Record<string, number> {
  const entries = Object.entries(dailyTotals)
    .filter(([k, v]) => /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(k) && typeof v === 'number' && Number.isFinite(v))
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 400);
  const out: Record<string, number> = {};
  for (const [k, v] of entries) {
    out[k] = Number(Math.max(0, v).toFixed(2));
  }
  return out;
}

function sanitizePreferencesMap(prefs: DriverPreferences): Record<string, unknown> {
  const entries = Object.entries(prefs).slice(0, 40);
  const out: Record<string, unknown> = {};
  for (const [k, v] of entries) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export interface CloudUserProfileDoc {
  uid: string;
  displayName: string;
  email: string;
  city: string;
  tier: 'Diamond' | 'Platinum' | 'Gold';
  vehicle: string;
  vehicleColor: string;
  licensePlate: string;
  phvBadge: string;
  rating: number;
  proPoints: number;
  acceptanceRate: number;
  cancellationRate: number;
  drivingMinutesUsedToday: number;
}

export interface CloudLedgerStateDoc {
  ownerUid: string;
  walletBalance: number;
  proPoints: number;
  questCompletedCount: number;
  totalReceived: number;
  acceptedCount: number;
  declinedCount: number;
  radarLostCount: number;
  dailyTotals: Record<string, number>;
  preferences: Partial<DriverPreferences>;
}

function toTimestampMs(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  return Date.now();
}

export async function ensureUserProfile(
  firebaseUser: User,
  localAccount: DriverAccount
): Promise<CloudUserProfileDoc | null> {
  if (!firebaseUser.emailVerified) return null;
  const uid = sanitizeFirestoreId(firebaseUser.uid, 'driver');
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as CloudUserProfileDoc;
    }

    const payload = {
      uid,
      displayName: clampStr(firebaseUser.displayName || localAccount.name, 80, 'UK Partner Driver'),
      email: clampStr(firebaseUser.email || localAccount.email, 120, 'driver@uberuk.co.uk'),
      city: clampStr(localAccount.city, 60, 'London'),
      tier: (['Diamond', 'Platinum', 'Gold'].includes(localAccount.tier)
        ? localAccount.tier
        : 'Gold') as 'Diamond' | 'Platinum' | 'Gold',
      vehicle: clampStr(localAccount.vehicle, 80, '2024 Toyota Camry Hybrid'),
      vehicleColor: clampStr(localAccount.vehicleColor, 40, 'Midnight Black'),
      licensePlate: clampStr(localAccount.licensePlate, 20, 'LB24 UBR'),
      phvBadge: clampStr(localAccount.phvBadge, 32, 'TfL-PHV-88421'),
      rating: clampNum(localAccount.rating, 1, 5, 4.98),
      proPoints: clampNum(localAccount.proPoints, 0, 1000000, 0),
      acceptanceRate: clampNum(localAccount.acceptanceRate, 0, 100, 100),
      cancellationRate: clampNum(localAccount.cancellationRate, 0, 100, 0),
      drivingMinutesUsedToday: clampNum(localAccount.drivingMinutesUsedToday, 0, 1440, 0),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(ref, payload);
    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncUserProfileMetrics(
  uidRaw: string,
  account: DriverAccount
): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  const uid = sanitizeFirestoreId(uidRaw, 'driver');
  const path = `users/${uid}`;
  const ref = doc(db, 'users', uid);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, {
      tier: (['Diamond', 'Platinum', 'Gold'].includes(account.tier)
        ? account.tier
        : 'Gold') as 'Diamond' | 'Platinum' | 'Gold',
      rating: clampNum(account.rating, 1, 5, 4.98),
      proPoints: clampNum(account.proPoints, 0, 1000000, 0),
      acceptanceRate: clampNum(account.acceptanceRate, 0, 100, 100),
      cancellationRate: clampNum(account.cancellationRate, 0, 100, 0),
      drivingMinutesUsedToday: clampNum(account.drivingMinutesUsedToday, 0, 1440, 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncDriverLedgerState(
  uidRaw: string,
  ledger: DriverLedger,
  preferences: DriverPreferences
): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  const uid = sanitizeFirestoreId(uidRaw, 'driver');
  const path = `users/${uid}/state/${DRIVER_LEDGER_STATE_ID}`;
  const ref = doc(db, 'users', uid, 'state', DRIVER_LEDGER_STATE_ID);

  const sanitizedDaily = sanitizeDailyTotals(ledger.dailyTotals);
  const sanitizedPrefs = sanitizePreferencesMap(preferences);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ownerUid: uid,
        walletBalance: clampNum(ledger.walletBalance, 0, 1000000, 0),
        proPoints: clampNum(ledger.proPoints, 0, 1000000, 0),
        questCompletedCount: clampNum(ledger.questCompletedCount, 0, 10000, 0),
        totalReceived: clampNum(ledger.tripStats.totalReceived, 0, 1000000, 0),
        acceptedCount: clampNum(ledger.tripStats.accepted, 0, 1000000, 0),
        declinedCount: clampNum(ledger.tripStats.declined, 0, 1000000, 0),
        radarLostCount: clampNum(ledger.tripStats.radarLost, 0, 1000000, 0),
        dailyTotals: sanitizedDaily,
        preferences: sanitizedPrefs,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    await updateDoc(ref, {
      walletBalance: clampNum(ledger.walletBalance, 0, 1000000, 0),
      proPoints: clampNum(ledger.proPoints, 0, 1000000, 0),
      questCompletedCount: clampNum(ledger.questCompletedCount, 0, 10000, 0),
      dailyTotals: sanitizedDaily,
      totalReceived: clampNum(ledger.tripStats.totalReceived, 0, 1000000, 0),
      acceptedCount: clampNum(ledger.tripStats.accepted, 0, 1000000, 0),
      declinedCount: clampNum(ledger.tripStats.declined, 0, 1000000, 0),
      radarLostCount: clampNum(ledger.tripStats.radarLost, 0, 1000000, 0),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncDriverPreferencesState(
  uidRaw: string,
  preferences: DriverPreferences
): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  const uid = sanitizeFirestoreId(uidRaw, 'driver');
  const path = `users/${uid}/state/${DRIVER_LEDGER_STATE_ID}`;
  const ref = doc(db, 'users', uid, 'state', DRIVER_LEDGER_STATE_ID);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    await updateDoc(ref, {
      preferences: sanitizePreferencesMap(preferences),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncCompletedTrip(uidRaw: string, trip: CompletedTrip): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  const uid = sanitizeFirestoreId(uidRaw, 'driver');
  const tripId = sanitizeFirestoreId(trip.id, 'trip');
  const path = `users/${uid}/trips/${tripId}`;
  const ref = doc(db, 'users', uid, 'trips', tripId);

  const dateKey =
    trip.dateKey && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(trip.dateKey)
      ? trip.dateKey
      : getLocalDateKey();

  const timeLabel = trip.completedAt.includes(',')
    ? trip.completedAt.split(',').slice(1).join(',').trim()
    : trip.completedAt;

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) return; // Trips are immutable

    await setDoc(ref, {
      ownerUid: uid,
      tripId,
      riderName: clampStr(trip.riderName, 80, 'Rider'),
      serviceName: clampStr(trip.serviceName, 40, 'UberX'),
      fare: clampNum(trip.fare, 0, 50000, 0),
      tip: clampNum(trip.tip, 0, 5000, 0),
      waitFee: clampNum(trip.waitFee, 0, 5000, 0),
      netPayout: clampNum(trip.netPayout ?? trip.fare, 0, 55000, 0),
      distanceMiles: clampNum(trip.distanceMiles, 0, 2000, 0),
      durationMin: clampNum(trip.durationMin, 0, 1440, 1),
      pickupArea: clampStr(trip.pickupArea, 100, 'Local Area'),
      dropoffArea: clampStr(trip.dropoffArea, 100, 'Dropoff Area'),
      completedAtLabel: clampStr(timeLabel, 24, 'Today'),
      dateKey,
      isIntercity: Boolean(trip.isIntercity),
      isNoShowFee: Boolean(trip.isNoShowFee),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncTripActivity(
  uidRaw: string,
  entry: TripActivityEntry
): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  const uid = sanitizeFirestoreId(uidRaw, 'driver');
  const activityId = sanitizeFirestoreId(entry.id, 'act');
  const offerId = sanitizeFirestoreId(entry.offerId, 'offer');
  const path = `users/${uid}/activity/${activityId}`;
  const ref = doc(db, 'users', uid, 'activity', activityId);

  const dateKey =
    entry.dateKey && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(entry.dateKey)
      ? entry.dateKey
      : getLocalDateKey();

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) return; // Immutable audit log

    await setDoc(ref, {
      ownerUid: uid,
      offerId,
      serviceName: clampStr(entry.serviceName, 40, 'UberX'),
      offerType: entry.offerType,
      status: entry.status,
      fare: clampNum(entry.fare, 0, 50000, 0),
      pickupArea: clampStr(entry.pickupArea, 100, 'Local Area'),
      dropoffArea: clampStr(entry.dropoffArea, 100, 'Dropoff Area'),
      timestampLabel: clampStr(entry.timestamp, 24, '00:00'),
      dateKey,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncReserveBooking(
  uidRaw: string,
  reserve: ReserveTrip,
  statusOverride?: 'completed' | 'cancelled'
): Promise<void> {
  if (!auth.currentUser?.emailVerified) return;
  const uid = sanitizeFirestoreId(uidRaw, 'driver');
  const reserveId = sanitizeFirestoreId(reserve.id, 'res');
  const path = `users/${uid}/reserves/${reserveId}`;
  const ref = doc(db, 'users', uid, 'reserves', reserveId);

  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      if (statusOverride) return;
      const pickupLL = await import('../utils/ukGeo').then((m) => m.mapToLatLng(reserve.pickupCoords));
      const dropLL = await import('../utils/ukGeo').then((m) => m.mapToLatLng(reserve.dropoffCoords));
      await setDoc(ref, {
        ownerUid: uid,
        reserveId,
        category: reserve.category,
        serviceName: clampStr(reserve.serviceName, 40, 'Reserve · UberX'),
        scheduledAtMs: clampNum(reserve.scheduledAtMs, 1000000000000, 9999999999999, Date.now() + 3600000),
        dayLabel: clampStr(reserve.dayLabel, 32, 'Today'),
        timeLabel: clampStr(reserve.timeLabel, 16, '12:00'),
        onlineByLabel: clampStr(reserve.onlineByLabel, 16, '11:20'),
        estimatedFare: clampNum(reserve.estimatedFare, 0, 50000, 20),
        reserveFee: clampNum(reserve.reserveFee, 0, 5000, 6),
        riderName: clampStr(reserve.riderName, 80, 'Rider'),
        pickupAddress: clampStr(reserve.pickupAddress, 120, 'High Street'),
        pickupArea: clampStr(reserve.pickupArea, 100, 'London'),
        dropoffAddress: clampStr(reserve.dropoffAddress, 120, 'Station Forecourt'),
        dropoffArea: clampStr(reserve.dropoffArea, 100, 'London'),
        tripMiles: clampNum(reserve.tripMiles, 0, 2000, 5),
        tripMinutes: clampNum(reserve.tripMinutes, 0, 1440, 15),
        pickupLat: clampNum(pickupLL.lat, -90, 90, 51.5074),
        pickupLng: clampNum(pickupLL.lng, -180, 180, -0.1278),
        dropoffLat: clampNum(dropLL.lat, -90, 90, 51.47),
        dropoffLng: clampNum(dropLL.lng, -180, 180, -0.454),
        status: 'scheduled',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (
      statusOverride &&
      (snap.data().status === 'scheduled')
    ) {
      await updateDoc(ref, {
        status: statusOverride,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface CloudHydrationCallbacks {
  onProfile?: (profile: CloudUserProfileDoc) => void;
  onState?: (state: CloudLedgerStateDoc) => void;
  onTrips?: (trips: CompletedTrip[]) => void;
  onActivity?: (entries: TripActivityEntry[], statsMeta?: Partial<TripStats>) => void;
  onReserves?: (reserves: ReserveTrip[]) => void;
  onError?: (err: unknown) => void;
}

export function subscribeDriverCloudData(
  uidRaw: string,
  callbacks: CloudHydrationCallbacks
): () => void {
  if (!auth.currentUser?.emailVerified) {
    return () => {};
  }

  const uid = sanitizeFirestoreId(uidRaw, 'driver');

  const unsubProfile = onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.exists()) {
        callbacks.onProfile?.(snap.data() as CloudUserProfileDoc);
      }
    },
    (error) => {
      callbacks.onError?.(error);
      handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    }
  );

  const unsubState = onSnapshot(
    doc(db, 'users', uid, 'state', DRIVER_LEDGER_STATE_ID),
    (snap) => {
      if (snap.exists()) {
        callbacks.onState?.(snap.data() as CloudLedgerStateDoc);
      }
    },
    (error) => {
      callbacks.onError?.(error);
      handleFirestoreError(error, OperationType.GET, `users/${uid}/state/${DRIVER_LEDGER_STATE_ID}`);
    }
  );

  const tripsQuery = query(
    collection(db, 'users', uid, 'trips'),
    where('ownerUid', '==', uid),
    limit(100)
  );
  const unsubTrips = onSnapshot(
    tripsQuery,
    (snap) => {
      const list: Array<{ ts: number; item: CompletedTrip }> = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          ts: toTimestampMs(data.createdAt),
          item: {
            id: String(data.tripId || d.id),
            riderName: String(data.riderName || 'Rider'),
            serviceName: String(data.serviceName || 'UberX'),
            fare: Number(data.fare ?? 0),
            tip: Number(data.tip ?? 0),
            waitFee: Number(data.waitFee ?? 0),
            netPayout: Number(data.netPayout ?? data.fare ?? 0),
            distanceMiles: Number(data.distanceMiles ?? 0),
            durationMin: Number(data.durationMin ?? 0),
            pickupArea: String(data.pickupArea || 'Local Area'),
            dropoffArea: String(data.dropoffArea || 'Dropoff Area'),
            completedAt: `${data.dateKey === getLocalDateKey() ? 'Today' : String(data.dateKey || 'Today')}, ${String(data.completedAtLabel || '12:00')}`,
            dateKey: String(data.dateKey || getLocalDateKey()),
            isIntercity: Boolean(data.isIntercity),
            isNoShowFee: Boolean(data.isNoShowFee),
          },
        });
      });
      list.sort((a, b) => b.ts - a.ts);
      callbacks.onTrips?.(list.map((x) => x.item));
    },
    (error) => {
      callbacks.onError?.(error);
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/trips`);
    }
  );

  const activityQuery = query(
    collection(db, 'users', uid, 'activity'),
    where('ownerUid', '==', uid),
    limit(80)
  );
  const unsubActivity = onSnapshot(
    activityQuery,
    (snap) => {
      const list: Array<{ ts: number; item: TripActivityEntry }> = [];
      snap.forEach((d) => {
        const data = d.data();
        list.push({
          ts: toTimestampMs(data.createdAt),
          item: {
            id: d.id,
            offerId: String(data.offerId || d.id),
            serviceName: String(data.serviceName || 'UberX'),
            offerType: (data.offerType || 'exclusive') as TripActivityEntry['offerType'],
            status: (data.status || 'accepted') as TripActivityEntry['status'],
            fare: Number(data.fare ?? 0),
            pickupArea: String(data.pickupArea || 'Local Area'),
            dropoffArea: String(data.dropoffArea || 'Dropoff Area'),
            timestamp: String(data.timestampLabel || '12:00'),
            dateKey: String(data.dateKey || getLocalDateKey()),
          },
        });
      });
      list.sort((a, b) => b.ts - a.ts);
      callbacks.onActivity?.(list.map((x) => x.item));
    },
    (error) => {
      callbacks.onError?.(error);
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/activity`);
    }
  );

  const reservesQuery = query(
    collection(db, 'users', uid, 'reserves'),
    where('ownerUid', '==', uid),
    limit(40)
  );
  const unsubReserves = onSnapshot(
    reservesQuery,
    async (snap) => {
      const { projectLatLngToMap } = await import('../utils/ukGeo');
      const reserves: ReserveTrip[] = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.status !== 'scheduled') return;
        reserves.push({
          id: String(data.reserveId || d.id),
          category: (data.category || 'local') as ReserveTrip['category'],
          serviceName: (data.serviceName || 'Reserve · UberX') as ReserveTrip['serviceName'],
          scheduledAtMs: Number(data.scheduledAtMs ?? Date.now() + 3600000),
          dayLabel: String(data.dayLabel || 'Today'),
          timeLabel: String(data.timeLabel || '12:00'),
          onlineByLabel: String(data.onlineByLabel || '11:20'),
          estimatedFare: Number(data.estimatedFare ?? 20),
          reserveFee: Number(data.reserveFee ?? 6),
          rating: 4.96,
          riderName: String(data.riderName || 'Rider'),
          riderTrips: 140,
          pickupMinutes: 4,
          pickupMiles: 1.0,
          pickupAddress: String(data.pickupAddress || 'High Street'),
          pickupArea: String(data.pickupArea || 'London'),
          dropoffAddress: String(data.dropoffAddress || 'Station Forecourt'),
          dropoffArea: String(data.dropoffArea || 'London'),
          tripMiles: Number(data.tripMiles ?? 5),
          tripMinutes: Number(data.tripMinutes ?? 15),
          pickupCoords: projectLatLngToMap(
            Number(data.pickupLat ?? 51.5074),
            Number(data.pickupLng ?? -0.1278)
          ),
          dropoffCoords: projectLatLngToMap(
            Number(data.dropoffLat ?? 51.47),
            Number(data.dropoffLng ?? -0.454)
          ),
          waitIncludedMin: 15,
          status: 'scheduled',
        });
      });
      reserves.sort((a, b) => a.scheduledAtMs - b.scheduledAtMs);
      callbacks.onReserves?.(reserves);
    },
    (error) => {
      callbacks.onError?.(error);
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/reserves`);
    }
  );

  return () => {
    unsubProfile();
    unsubState();
    unsubTrips();
    unsubActivity();
    unsubReserves();
  };
}
