import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';

export const APP_UPDATE_EVENT = 'uber-app-updating';

interface VersionManifest {
  buildId?: string;
  builtAt?: string;
}

let updateStarted = false;

async function triggerAutoRestart(reason: string): Promise<void> {
  if (updateStarted) return;
  updateStarted = true;

  try {
    window.dispatchEvent(
      new CustomEvent(APP_UPDATE_EVENT, {
        detail: { reason },
      })
    );
  } catch {
    // Ignore event dispatch error
  }

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    }
  } catch {
    // Ignore SW activation errors
  }

  // Allow any final localStorage writes and the toast banner to display briefly
  setTimeout(() => {
    window.location.reload();
  }, 950);
}

async function checkRemoteVersion(): Promise<void> {
  if (updateStarted || typeof window === 'undefined') return;
  if (import.meta.env.DEV) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
    });
    if (!res.ok) return;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return;

    const data = (await res.json()) as VersionManifest;
    const currentBuildId =
      typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : '';
    if (data?.buildId && currentBuildId && data.buildId !== currentBuildId) {
      await triggerAutoRestart('vercel-version-changed');
    }
  } catch {
    // Ignore transient network failures while offline or on poor mobile signal
  }
}

export function initAutoUpdater(): void {
  if (typeof window === 'undefined') return;
  if (Capacitor.isNativePlatform()) return;

  let swRegistration: ServiceWorkerRegistration | undefined;

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      if (!import.meta.env.DEV) {
        void updateSW(true).catch(() => {});
        void triggerAutoRestart('sw-update-ready');
      }
    },
    onRegisteredSW(_swUrl, registration) {
      swRegistration = registration;
      if (!registration) return;

      // Immediately check for updates on startup
      setTimeout(() => {
        void registration.update().catch(() => {});
        void checkRemoteVersion();
      }, 2500);
    },
  });

  // Automatically reload when a newly deployed service worker takes control
  if ('serviceWorker' in navigator && !import.meta.env.DEV) {
    let hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      void triggerAutoRestart('sw-controller-changed');
    });
  }

  const runUpdateCheck = () => {
    if (updateStarted) return;
    if (swRegistration) {
      void swRegistration.update().catch(() => {});
    }
    void checkRemoteVersion();
  };

  // Poll every 20 seconds while app is open for new GitHub -> Vercel deployments
  setInterval(runUpdateCheck, 20000);

  // Also check immediately when returning to the app or regaining connectivity
  window.addEventListener('focus', runUpdateCheck);
  window.addEventListener('online', runUpdateCheck);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      runUpdateCheck();
    }
  });
}
