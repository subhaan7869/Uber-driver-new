import { useCallback, useEffect, useState } from 'react';
import { auth } from '../firebase';
import {
  syncCompletedTrip,
  syncDriverLedgerState,
  syncReserveBooking,
  syncTripActivity,
} from '../services/firestoreSync';
import {
  CompletedTrip,
  DriverPreferences,
  ReserveTrip,
  TripActivityEntry,
} from '../types/driver';
import { DriverLedger } from './earningsStorage';

const IDB_NAME = 'uber_driver_uk_offline_db';
const IDB_VERSION = 1;
const STORE_NAME = 'sync_outbox';
const FALLBACK_STORAGE_KEY = 'uber_driver_offline_outbox_v1';
const QUEUE_EVENT = 'uber-offline-queue-changed';

export type OfflineMutation =
  | {
      id: string;
      dedupeKey: string;
      kind: 'completed_trip';
      uid: string;
      payload: CompletedTrip;
      createdAt: number;
    }
  | {
      id: string;
      dedupeKey: string;
      kind: 'trip_activity';
      uid: string;
      payload: TripActivityEntry;
      createdAt: number;
    }
  | {
      id: string;
      dedupeKey: string;
      kind: 'reserve_booking';
      uid: string;
      payload: { reserve: ReserveTrip; statusOverride?: 'completed' | 'cancelled' };
      createdAt: number;
    }
  | {
      id: string;
      dedupeKey: string;
      kind: 'ledger_state';
      uid: string;
      payload: { ledger: DriverLedger; preferences: DriverPreferences };
      createdAt: number;
    };

export type OfflineMutationInput =
  | { kind: 'completed_trip'; dedupeKey: string; uid: string; payload: CompletedTrip }
  | { kind: 'trip_activity'; dedupeKey: string; uid: string; payload: TripActivityEntry }
  | {
      kind: 'reserve_booking';
      dedupeKey: string;
      uid: string;
      payload: { reserve: ReserveTrip; statusOverride?: 'completed' | 'cancelled' };
    }
  | {
      kind: 'ledger_state';
      dedupeKey: string;
      uid: string;
      payload: { ledger: DriverLedger; preferences: DriverPreferences };
    };

let activeFlushPromise: Promise<{ flushed: number; remaining: number }> | null = null;
let lastFlushedAtMemory: number | null = null;

function notifyQueueChanged(detail?: { pendingCount?: number; flushing?: boolean }) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(QUEUE_EVENT, { detail }));
}

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function readFallbackQueue(): OfflineMutation[] {
  try {
    const raw = localStorage.getItem(FALLBACK_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OfflineMutation[]) : [];
  } catch {
    return [];
  }
}

function writeFallbackQueue(items: OfflineMutation[]): void {
  try {
    localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(items.slice(-200)));
  } catch {
    // Ignore quota errors
  }
}

export async function getOfflineQueueItems(): Promise<OfflineMutation[]> {
  try {
    const db = await openOfflineDb();
    const items = await new Promise<OfflineMutation[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as OfflineMutation[]) || []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return readFallbackQueue().sort((a, b) => a.createdAt - b.createdAt);
  }
}

export async function getOfflineQueueCount(): Promise<number> {
  const items = await getOfflineQueueItems();
  return items.length;
}

export async function enqueueOfflineMutation(input: OfflineMutationInput): Promise<number> {
  const entry: OfflineMutation = {
    ...input,
    id: input.dedupeKey,
    createdAt: Date.now(),
  } as OfflineMutation;

  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    const existing = readFallbackQueue().filter((x) => x.id !== entry.id);
    existing.push(entry);
    writeFallbackQueue(existing);
  }

  // Ask browser/SW to trigger a sync when back online if supported
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    void navigator.serviceWorker
      .getRegistration()
      .then((reg) => {
        const regWithSync = reg as
          | (ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } })
          | undefined;
        return regWithSync?.sync?.register('uber-offline-sync');
      })
      .catch(() => {});
  }

  const count = await getOfflineQueueCount();
  notifyQueueChanged({ pendingCount: count, flushing: false });
  return count;
}

async function removeOfflineMutation(id: string): Promise<void> {
  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    writeFallbackQueue(readFallbackQueue().filter((x) => x.id !== id));
  }
}

async function executeOfflineMutation(item: OfflineMutation): Promise<void> {
  switch (item.kind) {
    case 'completed_trip':
      await syncCompletedTrip(item.uid, item.payload);
      return;
    case 'trip_activity':
      await syncTripActivity(item.uid, item.payload);
      return;
    case 'reserve_booking':
      await syncReserveBooking(
        item.uid,
        item.payload.reserve,
        item.payload.statusOverride
      );
      return;
    case 'ledger_state':
      await syncDriverLedgerState(
        item.uid,
        item.payload.ledger,
        item.payload.preferences
      );
      return;
  }
}

export async function flushOfflineQueue(
  currentUid?: string
): Promise<{ flushed: number; remaining: number }> {
  if (activeFlushPromise) return activeFlushPromise;

  activeFlushPromise = (async () => {
    const items = await getOfflineQueueItems();
    if (items.length === 0) {
      return { flushed: 0, remaining: 0 };
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { flushed: 0, remaining: items.length };
    }

    const activeUser = auth.currentUser;
    if (!activeUser?.emailVerified || (currentUid && activeUser.uid !== currentUid)) {
      return { flushed: 0, remaining: items.length };
    }

    notifyQueueChanged({ pendingCount: items.length, flushing: true });
    let flushed = 0;

    for (const item of items) {
      if (item.uid !== activeUser.uid) continue;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) break;

      try {
        await executeOfflineMutation(item);
        await removeOfflineMutation(item.id);
        flushed += 1;
      } catch {
        // Stop draining on connectivity error and preserve remaining FIFO queue
        break;
      }
    }

    if (flushed > 0) {
      lastFlushedAtMemory = Date.now();
    }
    const remaining = await getOfflineQueueCount();
    notifyQueueChanged({ pendingCount: remaining, flushing: false });
    return { flushed, remaining };
  })();

  try {
    return await activeFlushPromise;
  } finally {
    activeFlushPromise = null;
  }
}

export function useOfflineQueue(uid?: string, emailVerified?: boolean) {
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isFlushing, setIsFlushing] = useState<boolean>(false);
  const [lastFlushedAt, setLastFlushedAt] = useState<number | null>(lastFlushedAtMemory);

  const refreshCount = useCallback(async () => {
    const count = await getOfflineQueueCount();
    setPendingCount(count);
    return count;
  }, []);

  const flushNow = useCallback(async () => {
    if (!uid || !emailVerified) return { flushed: 0, remaining: pendingCount };
    setIsFlushing(true);
    try {
      const res = await flushOfflineQueue(uid);
      setPendingCount(res.remaining);
      if (res.flushed > 0) {
        setLastFlushedAt(Date.now());
      }
      return res;
    } finally {
      setIsFlushing(false);
    }
  }, [uid, emailVerified, pendingCount]);

  useEffect(() => {
    void refreshCount();
    const onQueueEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ pendingCount?: number; flushing?: boolean }>).detail;
      if (typeof detail?.flushing === 'boolean') {
        setIsFlushing(detail.flushing);
      }
      if (typeof detail?.pendingCount === 'number') {
        setPendingCount(detail.pendingCount);
      } else {
        void refreshCount();
      }
      if (lastFlushedAtMemory) {
        setLastFlushedAt(lastFlushedAtMemory);
      }
    };
    window.addEventListener(QUEUE_EVENT, onQueueEvent);
    return () => window.removeEventListener(QUEUE_EVENT, onQueueEvent);
  }, [refreshCount]);

  useEffect(() => {
    if (uid && emailVerified && typeof navigator !== 'undefined' && navigator.onLine !== false) {
      void flushNow();
    }
  }, [uid, emailVerified, flushNow]);

  useEffect(() => {
    const onOnline = () => {
      void flushNow();
    };
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UBER_FLUSH_OFFLINE_QUEUE') {
        void flushNow();
      }
    };

    window.addEventListener('online', onOnline);
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => {
      window.removeEventListener('online', onOnline);
      navigator.serviceWorker?.removeEventListener('message', onSwMessage);
    };
  }, [flushNow]);

  return {
    pendingCount,
    isFlushing,
    lastFlushedAt,
    flushNow,
    refreshCount,
  };
}
