import React from 'react';
import { Bell, CheckCircle2, Navigation, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { NotificationPermissionState } from '../utils/notifications';

interface PermissionsModalProps {
  notificationPermission: NotificationPermissionState;
  notificationsEnabled: boolean;
  gpsPermissionState: 'idle' | 'active' | 'denied';
  hasRealCoords: boolean;
  backgroundAppRefresh: boolean;
  wakeLockActive: boolean;
  onAcceptNotifications: () => void;
  onAcceptLocation: () => void;
  onAcceptBackgroundRefresh: () => void;
  onAcceptAll: () => void;
  onClose: () => void;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  notificationPermission,
  notificationsEnabled,
  gpsPermissionState,
  hasRealCoords,
  backgroundAppRefresh,
  wakeLockActive,
  onAcceptNotifications,
  onAcceptLocation,
  onAcceptBackgroundRefresh,
  onAcceptAll,
  onClose,
}) => {
  const notifGranted =
    notificationsEnabled && notificationPermission === 'granted';
  const locationGranted =
    hasRealCoords || gpsPermissionState === 'active';

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#E8F0FE] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#276EF1]" />
            </div>
            <div>
              <h3 className="text-[19px] font-extrabold text-black leading-tight">
                Enable Driver Permissions
              </h3>
              <p className="text-[12px] text-[#545454]">
                Required for live alerts, GPS indicator & sync
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center"
            aria-label="Close permissions"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        <div className="space-y-3 my-4">
          {/* 1. Location + Dynamic Island Blue Indicator */}
          <div className="p-4 rounded-2xl border border-[#E6E6E6] bg-[#FAFAFA] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#276EF1] text-white flex items-center justify-center shrink-0">
                <Navigation className="w-5 h-5 fill-white rotate-45" />
              </div>
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold text-black">
                  Location & Blue GPS Indicator
                </p>
                <p className="text-[12px] text-[#545454] leading-snug mt-0.5">
                  Shows real iOS Dynamic Island / status bar blue GPS arrow while driving
                </p>
              </div>
            </div>
            {locationGranted ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E6F4EA] text-[#05944F] text-[12px] font-bold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Active
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
          <div className="p-4 rounded-2xl border border-[#E6E6E6] bg-[#FAFAFA] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold text-black">
                  Trip & Surge Notifications
                </p>
                <p className="text-[12px] text-[#545454] leading-snug mt-0.5">
                  {notificationPermission === 'denied'
                    ? 'Blocked by browser settings · in-app banner enabled'
                    : 'Receive instant Trip Radar, Exclusive & payout alerts'}
                </p>
              </div>
            </div>
            {notifGranted ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E6F4EA] text-[#05944F] text-[12px] font-bold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Allowed
              </span>
            ) : (
              <button
                type="button"
                onClick={onAcceptNotifications}
                className="px-3.5 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-[12.5px] font-bold shrink-0"
              >
                {notificationPermission === 'denied' ? 'In-App On' : 'Allow'}
              </button>
            )}
          </div>

          {/* 3. Background App Refresh & Wake Lock */}
          <div className="p-4 rounded-2xl border border-[#E6E6E6] bg-[#FAFAFA] flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#05944F] text-white flex items-center justify-center shrink-0">
                <RefreshCw className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[14.5px] font-bold text-black">
                  Background App Refresh
                </p>
                <p className="text-[12px] text-[#545454] leading-snug mt-0.5">
                  Refreshes Trip Radar every 60s, syncs daily ledger & keeps screen awake
                  {wakeLockActive ? ' (Wake Lock on)' : ''}
                </p>
              </div>
            </div>
            {backgroundAppRefresh ? (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E6F4EA] text-[#05944F] text-[12px] font-bold shrink-0">
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
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-12 rounded-xl bg-[#F3F3F3] hover:bg-[#E5E5E5] text-[14px] font-bold text-black transition-colors"
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
