import React from 'react';
import {
  ArrowRight,
  BarChart2,
  Bell,
  ChevronLeft,
  Eye,
  EyeOff,
  Menu as MenuIcon,
  Power,
  Radar,
  Shield,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { DriverOnlineStatus, DriverPreferences } from '../types/driver';

interface HomeMenuViewProps {
  onlineStatus: DriverOnlineStatus;
  todayEarnings: number;
  privacyHidden: boolean;
  questCompletedCount: number;
  preferences: DriverPreferences;
  nextOfferSecLeft: number | null;
  radarRefreshSecLeft: number;
  radarCount: number;
  permissionsReadyCount: number;
  onBackToMap: () => void;
  onToggleOnline: () => void;
  onTogglePrivacy: () => void;
  onOpenSafety: () => void;
  onOpenPreferences: () => void;
  onOpenOpportunities: (section: 'opportunities' | 'trends') => void;
  onOpenEarnings: () => void;
  onOpenAccountMenu: () => void;
  onOpenTripRadar: () => void;
  onOpenPermissions: () => void;
}

export const HomeMenuView: React.FC<HomeMenuViewProps> = ({
  onlineStatus,
  todayEarnings,
  privacyHidden,
  questCompletedCount,
  preferences,
  nextOfferSecLeft,
  radarRefreshSecLeft,
  radarCount,
  permissionsReadyCount,
  onBackToMap,
  onToggleOnline,
  onTogglePrivacy,
  onOpenSafety,
  onOpenPreferences,
  onOpenOpportunities,
  onOpenEarnings,
  onOpenAccountMenu,
  onOpenTripRadar,
  onOpenPermissions,
}) => {
  const formatMmSs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
      {/* Top Bar with Back Button + Account Menu Shortcut */}
      <div className="px-5 pt-15 lg:pt-5 pb-3 border-b border-[#EEEEEE] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToMap}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] active:scale-95 flex items-center justify-center transition-all"
            aria-label="Back to Map"
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>
          <span className="text-[17px] font-extrabold text-black">Driver Home</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenSafety}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center"
            aria-label="Safety Toolkit"
          >
            <Shield className="w-5 h-5 text-[#276EF1]" />
          </button>
          <button
            type="button"
            onClick={onOpenPreferences}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center"
            aria-label="Driving Preferences"
          >
            <SlidersHorizontal className="w-5 h-5 text-black" />
          </button>
          <button
            type="button"
            onClick={onOpenAccountMenu}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center"
            aria-label="Account & Settings Menu"
            title="Account Menu"
          >
            <MenuIcon className="w-5 h-5 text-black" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Home Dashboard Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 max-w-[600px] w-full mx-auto">
        <div>
          <h1 className="text-[28px] font-extrabold tracking-tight text-black">
            {onlineStatus === 'offline' ? "You're offline" : "You're online"}
          </h1>
          <p className="text-[14px] text-[#545454] font-medium">
            {onlineStatus === 'offline'
              ? 'Ready to go?'
              : 'Finding high-demand trips across London...'}
          </p>
        </div>

        {onlineStatus === 'online' && (
          <div className="rounded-2xl border border-[#276EF1]/20 bg-[#F4F8FF] p-4 space-y-3">
            <div className="w-full h-1.5 bg-[#DCE8FD] rounded-full overflow-hidden">
              <div className="w-1/2 h-full bg-[#276EF1] animate-uber-radar" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-bold text-black flex items-center gap-2">
                <Radar className="w-4 h-4 text-[#276EF1]" />
                Dispatch active · {preferences.uberX ? 'UberX' : 'Custom'}
              </span>
              <span className="text-[12px] font-bold text-[#276EF1] tabular-nums">
                {nextOfferSecLeft !== null
                  ? `Next offer ~${formatMmSs(nextOfferSecLeft)}`
                  : 'Scanning...'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                onOpenTripRadar();
              }}
              className="w-full h-11 rounded-xl bg-black text-white text-[13.5px] font-bold hover:bg-neutral-800 transition-colors flex items-center justify-between px-4 tabular-nums"
            >
              <span>Open Trip Radar ({radarCount})</span>
              <span className="text-[11.5px] text-white/75">
                Refreshes in {radarRefreshSecLeft}s
              </span>
            </button>
          </div>
        )}

        {/* System Permissions Banner (Notifications, Background Refresh, Blue GPS / Dynamic Island) */}
        <button
          type="button"
          onClick={onOpenPermissions}
          className="w-full p-4 rounded-2xl border border-[#E6E6E6] bg-[#FAFAFA] hover:bg-[#F3F3F3] flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-[#276EF1]" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-black">
                Permissions & Dynamic Island
              </p>
              <p className="text-[12px] text-[#545454] truncate">
                {permissionsReadyCount}/3 enabled · Location GPS, Alerts & Background Refresh
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-black text-white text-[12px] font-bold shrink-0">
            Manage
          </span>
        </button>

        {/* Opportunities Section */}
        <div className="border-t border-[#EEEEEE] pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[20px] font-extrabold text-black">Opportunities</h2>
            <button
              type="button"
              onClick={() => onOpenOpportunities('opportunities')}
              className="w-9 h-9 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center"
              aria-label="Open Opportunities"
            >
              <ArrowRight className="w-4 h-4 text-black" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenOpportunities('opportunities')}
            className="w-full p-4 rounded-2xl bg-[#F6F6F6] hover:bg-[#EEEEEE] text-left transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-black">
                Weekend Quest · +£190
              </span>
              <span className="text-[12px] font-bold text-[#276EF1] tabular-nums">
                {questCompletedCount}/20 trips
              </span>
            </div>
            <p className="text-[13px] text-[#545454] mt-1">
              Drive {Math.max(0, 20 - questCompletedCount)} more trips to unlock bonus
            </p>
          </button>
        </div>

        {/* Today's Real Earnings Preview with Privacy Toggle */}
        <div className="border-t border-[#EEEEEE] pt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onOpenEarnings}
              className="flex-1 text-left group"
            >
              <p className="text-[13px] font-semibold text-[#545454]">
                Today’s earnings (saved until 00:00)
              </p>
              <p className="text-[26px] font-extrabold text-black tabular-nums mt-0.5">
                {privacyHidden ? '£••••' : `£${todayEarnings.toFixed(2)}`}{' '}
                <span className="text-[13px] font-medium text-[#545454]">today</span>
              </p>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onTogglePrivacy}
                className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors"
                aria-label={privacyHidden ? 'Show total earned' : 'Hide total earned'}
                title={privacyHidden ? 'Show total earned' : 'Hide total earned'}
              >
                {privacyHidden ? (
                  <EyeOff className="w-4 h-4 text-black" />
                ) : (
                  <Eye className="w-4 h-4 text-black" />
                )}
              </button>
              <button
                type="button"
                onClick={onOpenEarnings}
                className="text-[13px] font-bold text-[#276EF1] hover:underline px-2 py-2"
              >
                Details →
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenOpportunities('trends')}
            className="w-full p-3.5 rounded-2xl border border-[#E6E6E6] hover:bg-[#FAFAFA] flex items-center gap-3 text-left transition-colors"
          >
            <BarChart2 className="w-5 h-5 text-black shrink-0" />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-black">
                Explore the best times and places to drive today
              </p>
              <p className="text-[12px] text-[#545454]">
                Peak surge expected 16:00 – 20:00 across Central London
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Go Online / Go Offline CTA */}
      <div className="p-4 border-t border-[#EEEEEE] bg-white shrink-0 max-w-[600px] w-full mx-auto">
        <button
          type="button"
          onClick={() => {
            onToggleOnline();
            if (onlineStatus === 'offline') {
              onBackToMap();
            }
          }}
          className={`w-full h-13 rounded-full text-[16px] font-bold flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] ${
            onlineStatus === 'offline'
              ? 'bg-[#276EF1] hover:bg-[#1E5CD4] text-white shadow-lg shadow-[#276EF1]/20'
              : 'bg-[#E11900] hover:bg-[#C11400] text-white'
          }`}
        >
          {onlineStatus === 'offline' ? (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Go Online</span>
            </>
          ) : (
            <>
              <Power className="w-5 h-5" />
              <span>Go Offline</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
