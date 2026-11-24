import React from 'react';
import {
  BatteryCharging,
  Bell,
  CheckCircle2,
  Layers,
  LayoutGrid,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';
import { NativeBubblePermissions } from '../native/floatingDot';
import { NotificationPermissionState } from '../utils/notifications';

interface PermissionsModalProps {
  notificationPermission: NotificationPermissionState;
  notificationsEnabled: boolean;
  gpsPermissionState: 'idle' | 'active' | 'denied';
  gpsExplicitlyAccepted: boolean;
  hasRealCoords: boolean;
  backgroundAppRefresh: boolean;
  wakeLockActive: boolean;
  nativeBubblePerms?: NativeBubblePermissions;
  onAcceptNotifications: () => void;
  onAcceptLocation: () => void;
  onAcceptBackgroundRefresh: () => void;
  onRequestAndroidOverlay?: () => void;
  onRequestAndroidBattery?: () => void;
  onPreviewFloatingDot?: () => void;
  onPreviewFloatingJobCard?: () => void;
  onPinAndroidWidget?: () => void;
  onAcceptAll: () => void;
  onClose: () => void;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  notificationPermission,
  notificationsEnabled,
  gpsPermissionState,
  gpsExplicitlyAccepted,
  hasRealCoords,
  backgroundAppRefresh,
  wakeLockActive,
  nativeBubblePerms,
  onAcceptNotifications,
  onAcceptLocation,
  onAcceptBackgroundRefresh,
  onRequestAndroidOverlay,
  onRequestAndroidBattery,
  onPreviewFloatingDot,
  onPreviewFloatingJobCard,
  onPinAndroidWidget,
  onAcceptAll,
  onClose,
}) => {
  const notifGranted =
    notificationsEnabled &&
    (notificationPermission === 'granted' ||
      notificationPermission === 'denied' ||
      notificationPermission === 'unsupported' ||
      Boolean(nativeBubblePerms?.isNative && nativeBubblePerms.notificationsGranted));
  const locationGranted =
    hasRealCoords || gpsPermissionState === 'active' || gpsExplicitlyAccepted;
  const isAndroidApk = Boolean(nativeBubblePerms?.isNative);

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#141416] w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#E8F0FE] dark:bg-[#276EF1]/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#276EF1]" />
            </div>
            <div>
              <h3 className="text-[19px] font-extrabold text-black dark:text-white leading-tight">
                Enable Driver Permissions
              </h3>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                Required for live alerts, floating Uber dot & background sync
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
            aria-label="Close permissions"
          >
            <X className="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>

        <div className="space-y-3 my-4">
          {/* 1. Location + Dynamic Island Blue Indicator */}
          <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#276EF1] text-white flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(39,110,241,0.4)]">
                <Navigation className="w-5 h-5 fill-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold text-black dark:text-white">
                  Dynamic Island & Blue GPS Icon
                </p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400 leading-snug mt-0.5">
                  {gpsPermissionState === 'denied' && gpsExplicitlyAccepted
                    ? 'Blue icon active · Browser blocked raw GPS, using UK GPS'
                    : 'Shows the blue GPS arrow on the Dynamic Island & UK map'}
                </p>
              </div>
            </div>
            {locationGranted ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E8F0FE] dark:bg-[#276EF1]/20 text-[#276EF1] dark:text-[#5B9BF8] text-[12px] font-bold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {hasRealCoords ? 'Live GPS' : 'Blue On'}
              </span>
            ) : (
              <button
                type="button"
                onClick={onAcceptLocation}
                className="px-3.5 py-2 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[12.5px] font-bold shrink-0"
              >
                Allow
              </button>
            )}
          </div>

          {/* 2. Push Notifications */}
          <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-black dark:bg-white/15 text-white flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold text-black dark:text-white">
                  Trip & Surge Notifications
                </p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400 leading-snug mt-0.5">
                  {notificationPermission === 'denied' || notificationPermission === 'unsupported'
                    ? 'In-app alert banner enabled'
                    : 'Receive instant Trip Radar, Exclusive & payout alerts'}
                </p>
              </div>
            </div>
            {notifGranted ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F] text-[12px] font-bold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {notificationPermission === 'granted' || nativeBubblePerms?.notificationsGranted
                  ? 'Allowed'
                  : 'In-App On'}
              </span>
            ) : (
              <button
                type="button"
                onClick={onAcceptNotifications}
                className="px-3.5 py-2 rounded-xl bg-black dark:bg-[#276EF1] hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] text-white text-[12.5px] font-bold shrink-0"
              >
                Allow
              </button>
            )}
          </div>

          {/* 3. Background App Refresh & Wake Lock */}
          <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#05944F] text-white flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold text-black dark:text-white">
                  Background App Refresh
                </p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400 leading-snug mt-0.5">
                  Refreshes Trip Radar, syncs daily ledger & keeps screen awake
                  {wakeLockActive ? ' (Wake Lock on)' : ''}
                </p>
              </div>
            </div>
            {backgroundAppRefresh ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F] text-[12px] font-bold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                On
              </span>
            ) : (
              <button
                type="button"
                onClick={onAcceptBackgroundRefresh}
                className="px-3.5 py-2 rounded-xl bg-[#05944F] hover:bg-[#047A40] text-white text-[12.5px] font-bold shrink-0"
              >
                Enable
              </button>
            )}
          </div>

          {/* 4. Android Floating Dot Overlay & Battery (APK mode) */}
          <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-black dark:bg-[#276EF1] text-white flex items-center justify-center shrink-0">
                  {isAndroidApk ? (
                    <Layers className="w-5 h-5" />
                  ) : (
                    <Smartphone className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[14.5px] font-bold text-black dark:text-white">
                    Floating Uber Dot (Display Over Apps)
                  </p>
                  <p className="text-[12px] text-[#545454] dark:text-neutral-400 leading-snug mt-0.5">
                    {isAndroidApk
                      ? 'Shows a draggable Uber dot over Waze/Maps and opens straight to incoming job offers on tap.'
                      : 'Android APK feature — included in the Capacitor project & GitHub Actions APK builder.'}
                  </p>
                </div>
              </div>
              {isAndroidApk ? (
                nativeBubblePerms?.overlayGranted ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F] text-[12px] font-bold shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Granted
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onRequestAndroidOverlay}
                    className="px-3.5 py-2 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[12.5px] font-bold shrink-0"
                  >
                    Allow
                  </button>
                )
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[11px] font-bold text-[#545454] dark:text-neutral-300 shrink-0">
                  APK Ready
                </span>
              )}
            </div>

            {isAndroidApk && (
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                {!nativeBubblePerms?.batteryIgnored && onRequestAndroidBattery && (
                  <button
                    type="button"
                    onClick={onRequestAndroidBattery}
                    className="flex-1 min-w-[140px] h-9 rounded-xl bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-[12px] font-bold text-black dark:text-white flex items-center justify-center gap-1.5"
                  >
                    <BatteryCharging className="w-3.5 h-3.5 text-[#05944F]" />
                    Unrestricted Battery
                  </button>
                )}
                {nativeBubblePerms?.overlayGranted && onPreviewFloatingDot && (
                  <button
                    type="button"
                    onClick={onPreviewFloatingDot}
                    className="flex-1 min-w-[110px] h-9 rounded-xl bg-black dark:bg-white/15 text-white text-[12px] font-bold"
                  >
                    Preview Dot
                  </button>
                )}
                {nativeBubblePerms?.overlayGranted && onPreviewFloatingJobCard && (
                  <button
                    type="button"
                    onClick={onPreviewFloatingJobCard}
                    className="flex-1 min-w-[125px] h-9 rounded-xl bg-[#276EF1] text-white text-[12px] font-bold"
                  >
                    Preview Job Card
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 5. Android Home Screen Widget */}
          <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#05944F] text-white flex items-center justify-center shrink-0">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold text-black dark:text-white">
                  Android Home Screen Widget
                </p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400 leading-snug mt-0.5">
                  {isAndroidApk
                    ? 'Shows live Online status, Today’s Earnings, Quest/Streak & Go Online button.'
                    : 'Included in Android APK — long-press Android home screen → Widgets → Uber Driver.'}
                </p>
              </div>
            </div>
            {isAndroidApk && onPinAndroidWidget ? (
              <button
                type="button"
                onClick={onPinAndroidWidget}
                className="px-3.5 py-2 rounded-xl bg-[#05944F] hover:bg-[#047A40] text-white text-[12.5px] font-bold shrink-0"
              >
                Add Widget
              </button>
            ) : (
              <span className="px-2.5 py-1 rounded-full bg-black/5 dark:bg-white/10 text-[11px] font-bold text-[#545454] dark:text-neutral-300 shrink-0">
                APK Ready
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-12 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-[14px] font-bold text-black dark:text-white transition-colors"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onAcceptAll}
            className="flex-1 h-12 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[15px] font-bold transition-colors"
          >
            Accept & Enable All
          </button>
        </div>
      </div>
    </div>
  );
};
