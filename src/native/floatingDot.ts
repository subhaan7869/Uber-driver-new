import { Capacitor, PluginListenerHandle, registerPlugin } from '@capacitor/core';
import { TripOffer } from '../types/driver';

export interface NativeBubblePermissions {
  isNative: boolean;
  overlayGranted: boolean;
  notificationsGranted: boolean;
  batteryIgnored: boolean;
}

export type BubbleActionType = 'accept' | 'decline' | 'open';

export interface BubbleTappedEvent {
  action?: BubbleActionType;
  offerId?: string;
  offerJson?: string;
  tappedAt?: number;
}

export interface NativeBubbleActionResult {
  action: BubbleActionType;
  offer: TripOffer | null;
}

interface UberFloatingBubbleNativePlugin {
  checkPermissions(): Promise<NativeBubblePermissions>;
  requestOverlayPermission(): Promise<{ openedSettings: boolean }>;
  requestNotificationPermission(): Promise<{ granted: boolean }>;
  requestBatteryOptimization(): Promise<void>;
  startOnlineService(options: { city?: string; driverName?: string }): Promise<void>;
  stopOnlineService(): Promise<void>;
  setImmersiveNavHidden(options: { hidden: boolean }): Promise<void>;
  setAppInForeground(options: { inForeground: boolean }): Promise<void>;
  showOfferOnBubble(options: {
    offerId: string;
    offerJson: string;
    fareText: string;
    title: string;
    subtitle: string;
    expiresInSec: number;
  }): Promise<void>;
  clearOfferOnBubble(): Promise<void>;
  scheduleBackgroundOffer(options: {
    delaySec: number;
    offerId: string;
    offerJson: string;
    offersQueueJson?: string;
    fareText: string;
    title: string;
    subtitle: string;
    expiresInSec: number;
  }): Promise<void>;
  cancelScheduledOffer(): Promise<void>;
  showBubblePreview(): Promise<void>;
  previewOfferCard(options: {
    offerId: string;
    offerJson: string;
    fareText: string;
    title: string;
    subtitle: string;
    expiresInSec: number;
  }): Promise<void>;
  consumePendingLaunchOffer(): Promise<{
    action?: BubbleActionType;
    offerId?: string;
    offerJson?: string;
  }>;
  addListener(
    eventName: 'bubbleTapped',
    listenerFunc: (event: BubbleTappedEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'permissionsChanged',
    listenerFunc: (perms: NativeBubblePermissions) => void
  ): Promise<PluginListenerHandle>;
}

const UberFloatingBubble = registerPlugin<UberFloatingBubbleNativePlugin>(
  'UberFloatingBubble'
);

export function isNativeAndroidApk(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function getNativeBubblePermissions(): Promise<NativeBubblePermissions> {
  if (!isNativeAndroidApk()) {
    return {
      isNative: false,
      overlayGranted: false,
      notificationsGranted: false,
      batteryIgnored: false,
    };
  }
  try {
    return await UberFloatingBubble.checkPermissions();
  } catch {
    return {
      isNative: true,
      overlayGranted: false,
      notificationsGranted: false,
      batteryIgnored: false,
    };
  }
}

export async function requestAndroidOverlayPermission(): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.requestOverlayPermission();
  } catch {
    // Ignore native error
  }
}

export async function requestAndroidNotificationPermission(): Promise<boolean> {
  if (!isNativeAndroidApk()) return false;
  try {
    const res = await UberFloatingBubble.requestNotificationPermission();
    return Boolean(res?.granted);
  } catch {
    return false;
  }
}

export async function requestAndroidBatteryOptimization(): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.requestBatteryOptimization();
  } catch {
    // Ignore native error
  }
}

export async function startNativeOnlineBubbleService(
  city: string,
  driverName: string
): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.startOnlineService({ city, driverName });
  } catch {
    // Ignore native error
  }
}

export async function stopNativeOnlineBubbleService(): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.stopOnlineService();
  } catch {
    // Ignore native error
  }
}

export async function setNativeImmersiveNavHidden(hidden: boolean): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.setImmersiveNavHidden({ hidden });
  } catch {
    // Ignore native error
  }
}

export async function syncNativeAppForeground(inForeground: boolean): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.setAppInForeground({ inForeground });
  } catch {
    // Ignore native error
  }
}

function serializeOfferForNative(offer: TripOffer) {
  return {
    offerId: offer.id,
    offerJson: JSON.stringify(offer),
    fareText: `£${offer.fare.toFixed(0)}`,
    title: `${offer.serviceName} · £${offer.fare.toFixed(2)}`,
    subtitle: `${offer.pickupArea.split(',')[0]} → ${offer.dropoffArea.split('·')[0].trim()} (${offer.pickupMinutes}m)`,
    expiresInSec: offer.expiresInSec || 15,
  };
}

export async function pushOfferToNativeBubble(offer: TripOffer): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.showOfferOnBubble(serializeOfferForNative(offer));
  } catch {
    // Ignore native error
  }
}

export async function clearOfferFromNativeBubble(): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.clearOfferOnBubble();
  } catch {
    // Ignore native error
  }
}

export async function scheduleNativeBackgroundOffer(
  delaySec: number,
  offer: TripOffer,
  queueOffers?: TripOffer[]
): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.scheduleBackgroundOffer({
      delaySec,
      offersQueueJson: queueOffers && queueOffers.length > 0 ? JSON.stringify(queueOffers) : undefined,
      ...serializeOfferForNative(offer),
    });
  } catch {
    // Ignore native error
  }
}

export async function cancelNativeScheduledOffer(): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.cancelScheduledOffer();
  } catch {
    // Ignore native error
  }
}

export async function previewNativeFloatingBubble(): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.showBubblePreview();
  } catch {
    // Ignore native error
  }
}

export async function previewNativeFloatingOfferCard(offer: TripOffer): Promise<void> {
  if (!isNativeAndroidApk()) return;
  try {
    await UberFloatingBubble.previewOfferCard(serializeOfferForNative(offer));
  } catch {
    // Ignore native error
  }
}

export async function consumePendingNativeLaunchOffer(): Promise<NativeBubbleActionResult | null> {
  if (!isNativeAndroidApk()) return null;
  try {
    const res = await UberFloatingBubble.consumePendingLaunchOffer();
    let parsed: TripOffer | null = null;
    if (res?.offerJson) {
      parsed = JSON.parse(res.offerJson) as TripOffer;
    }
    if (res?.action || parsed) {
      return {
        action: res?.action ?? 'open',
        offer: parsed,
      };
    }
  } catch {
    // Ignore parse/native error
  }
  return null;
}

export function listenToNativeBubbleTap(
  onAction: (result: NativeBubbleActionResult) => void
): () => void {
  if (!isNativeAndroidApk()) return () => {};

  let handle: PluginListenerHandle | null = null;
  let cancelled = false;

  void UberFloatingBubble.addListener('bubbleTapped', (event) => {
    let parsed: TripOffer | null = null;
    if (event?.offerJson) {
      try {
        parsed = JSON.parse(event.offerJson) as TripOffer;
      } catch {
        parsed = null;
      }
    }
    onAction({
      action: event?.action ?? 'open',
      offer: parsed,
    });
  }).then((h) => {
    if (cancelled) {
      void h.remove();
    } else {
      handle = h;
    }
  });

  return () => {
    cancelled = true;
    if (handle) {
      void handle.remove();
    }
  };
}

export function listenToNativePermissionsChanged(
  onChanged: (perms: NativeBubblePermissions) => void
): () => void {
  if (!isNativeAndroidApk()) return () => {};

  let handle: PluginListenerHandle | null = null;
  let cancelled = false;

  void UberFloatingBubble.addListener('permissionsChanged', (perms) => {
    onChanged(perms);
  }).then((h) => {
    if (cancelled) {
      void h.remove();
    } else {
      handle = h;
    }
  });

  return () => {
    cancelled = true;
    if (handle) {
      void handle.remove();
    }
  };
}
