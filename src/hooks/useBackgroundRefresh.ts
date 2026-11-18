import { useCallback, useEffect, useRef, useState } from 'react';
import { DriverOnlineStatus } from '../types/driver';

interface PeriodicSyncManagerLike {
  register: (tag: string, options?: { minInterval: number }) => Promise<void>;
}

interface ServiceWorkerRegistrationWithPeriodicSync
  extends ServiceWorkerRegistration {
  periodicSync?: PeriodicSyncManagerLike;
}

interface WakeLockSentinelLike {
  released: boolean;
  release: () => Promise<void>;
}

interface UseBackgroundRefreshOptions {
  enabled: boolean;
  onlineStatus: DriverOnlineStatus;
  onRefreshCycle?: () => void;
}

export function useBackgroundRefresh({
  enabled,
  onlineStatus,
  onRefreshCycle,
}: UseBackgroundRefreshOptions) {
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number>(() => Date.now());
  const [refreshCount, setRefreshCount] = useState<number>(1);
  const [periodicSyncActive, setPeriodicSyncActive] = useState<boolean>(false);
  const [wakeLockActive, setWakeLockActive] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const wakeLockRef = useRef<WakeLockSentinelLike | null>(null);
  const onRefreshRef = useRef(onRefreshCycle);
  onRefreshRef.current = onRefreshCycle;

  const triggerRefreshNow = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          reg.update().catch(() => {});
        }
      }
    } catch {
      // Ignore SW update check errors in offline mode
    }
    setLastRefreshedAt(Date.now());
    setRefreshCount((c) => c + 1);
    onRefreshRef.current?.();
    setTimeout(() => setIsRefreshing(false), 450);
  }, []);

  // Register Periodic Background Sync when available in installed PWA
  useEffect(() => {
    if (!enabled) {
      setPeriodicSyncActive(false);
      return;
    }

    let cancelled = false;
    const registerPeriodicSync = async () => {
      try {
        if (!('serviceWorker' in navigator)) return;
        const reg =
          (await navigator.serviceWorker.ready) as ServiceWorkerRegistrationWithPeriodicSync;
        if (reg.periodicSync) {
          await reg.periodicSync.register('uber-driver-bg-refresh', {
            minInterval: 15 * 60 * 1000,
          });
          if (!cancelled) setPeriodicSyncActive(true);
        }
      } catch {
        if (!cancelled) setPeriodicSyncActive(false);
      }
    };

    registerPeriodicSync();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  // Screen Wake Lock when Background App Refresh + Online are active
  useEffect(() => {
    const shouldKeepAwake = enabled && onlineStatus === 'online';

    const releaseWakeLock = async () => {
      if (wakeLockRef.current && !wakeLockRef.current.released) {
        try {
          await wakeLockRef.current.release();
        } catch {
          // Ignore release failure
        }
      }
      wakeLockRef.current = null;
      setWakeLockActive(false);
    };

    const requestWakeLock = async () => {
      if (!shouldKeepAwake) return;
      const navWithWakeLock = navigator as Navigator & {
        wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
      };
      if (!navWithWakeLock.wakeLock) return;
      try {
        const sentinel = await navWithWakeLock.wakeLock.request('screen');
        wakeLockRef.current = sentinel;
        setWakeLockActive(true);
      } catch {
        setWakeLockActive(false);
      }
    };

    if (shouldKeepAwake) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && enabled) {
        triggerRefreshNow();
        if (shouldKeepAwake) {
          requestWakeLock();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseWakeLock();
    };
  }, [enabled, onlineStatus, triggerRefreshNow]);

  // Periodic active refresh heartbeat (every 30s when enabled)
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      setLastRefreshedAt(Date.now());
      setRefreshCount((c) => c + 1);
      onRefreshRef.current?.();
    }, 30000);

    return () => clearInterval(interval);
  }, [enabled]);

  return {
    lastRefreshedAt,
    refreshCount,
    periodicSyncActive,
    wakeLockActive,
    isRefreshing,
    triggerRefreshNow,
  };
}
