import React from 'react';
import {
  ArrowRight,
  BarChart2,
  Bell,
  ChevronLeft,
  Clock,
  Eye,
  EyeOff,
  Menu as MenuIcon,
  Moon,
  Plane,
  Power,
  Radar,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  User,
} from 'lucide-react';
import { UK_AIRPORT_QUEUES } from '../data/mockDriverData';
import { DriverAccount, DriverOnlineStatus, DriverPreferences } from '../types/driver';

interface HomeMenuViewProps {
  account: DriverAccount;
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
  onToggleNightMode: () => void;
  onOpenAccounts: () => void;
  onOpenFaceVerify: () => void;
  onOpenSafety: () => void;
  onOpenPreferences: () => void;
  onOpenOpportunities: (section: 'opportunities' | 'trends' | 'airports') => void;
  onOpenEarnings: () => void;
  onOpenAccountMenu: () => void;
  onOpenTripRadar: () => void;
  onOpenPermissions: () => void;
}

export const HomeMenuView: React.FC<HomeMenuViewProps> = ({
  account,
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
  onToggleNightMode,
  onOpenAccounts,
  onOpenFaceVerify,
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

  const isFaceVerifiedRecently =
    account.lastFaceVerifiedAt !== null &&
    Date.now() - account.lastFaceVerifiedAt < 12 * 60 * 60 * 1000;

  const totalDrivingCapMin = 12 * 60;
  const remainingMin = Math.max(0, totalDrivingCapMin - account.drivingMinutesUsedToday);
  const remHours = Math.floor(remainingMin / 60);
  const remMins = remainingMin % 60;
  const drivingPct = Math.min(100, (account.drivingMinutesUsedToday / totalDrivingCapMin) * 100);

  const featuredAirport =
    account.city.toLowerCase().includes('manchester')
      ? UK_AIRPORT_QUEUES[2]
      : UK_AIRPORT_QUEUES[0];

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-[#0E0F12] overflow-hidden">
      {/* Top Bar with Back Button + Night Mode + Account Menu Shortcut */}
      <div className="px-5 pt-15 lg:pt-5 pb-3 border-b border-[#EEEEEE] dark:border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToMap}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 active:scale-95 flex items-center justify-center transition-all"
            aria-label="Back to Map"
          >
            <ChevronLeft className="w-6 h-6 text-black dark:text-white" />
          </button>
          <span className="text-[17px] font-extrabold text-black dark:text-white">Driver Home</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleNightMode}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
            aria-label={preferences.nightMode ? 'Switch to Day Mode' : 'Switch to Night Mode'}
            title={preferences.nightMode ? 'Night Mode On' : 'Day Mode'}
          >
            {preferences.nightMode ? (
              <Sun className="w-5 h-5 text-[#FFC043]" />
            ) : (
              <Moon className="w-5 h-5 text-black" />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenSafety}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
            aria-label="Safety Toolkit"
          >
            <Shield className="w-5 h-5 text-[#276EF1]" />
          </button>
          <button
            type="button"
            onClick={onOpenPreferences}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
            aria-label="Driving Preferences"
          >
            <SlidersHorizontal className="w-5 h-5 text-black dark:text-white" />
          </button>
          <button
            type="button"
            onClick={onOpenAccountMenu}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
            aria-label="Account & Settings Menu"
            title="Account Menu"
          >
            <MenuIcon className="w-5 h-5 text-black dark:text-white" />
          </button>
        </div>
      </div>

      {/* Main Scrollable Home Dashboard Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 max-w-[600px] w-full mx-auto">
        {/* Driver Account Pill + Online Headline */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold tracking-tight text-black dark:text-white">
              {onlineStatus === 'offline' ? "You're offline" : "You're online"}
            </h1>
            <p className="text-[14px] text-[#545454] dark:text-neutral-400 font-medium">
              {onlineStatus === 'offline'
                ? `Ready to go in ${account.city}?`
                : `Finding high-demand trips across ${account.city}...`}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenAccounts}
            className="px-3 py-2 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center gap-2 shrink-0"
          >
            <div className="w-6 h-6 rounded-full bg-black dark:bg-[#276EF1] text-white flex items-center justify-center">
              <User className="w-3.5 h-3.5" />
            </div>
            <span className="text-[12.5px] font-bold text-black dark:text-white max-w-[110px] truncate">
              {account.name.split(' ')[0]}
            </span>
          </button>
        </div>

        {/* Face Verification Status Card */}
        <button
          type="button"
          onClick={onOpenFaceVerify}
          className={`w-full p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-colors ${
            isFaceVerifiedRecently
              ? 'border-[#05944F]/25 bg-[#E6F4EA]/70 dark:bg-emerald-950/35'
              : 'border-[#276EF1]/30 bg-[#F4F8FF] dark:bg-[#192338]'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isFaceVerifiedRecently
                  ? 'bg-[#05944F] text-white'
                  : 'bg-[#276EF1] text-white'
              }`}
            >
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-black dark:text-white">
                {isFaceVerifiedRecently ? 'Face ID Verified' : 'Verify Face Before Going Online'}
              </p>
              <p className="text-[12px] text-[#545454] dark:text-neutral-300 truncate">
                {isFaceVerifiedRecently
                  ? `PHV check active · ${account.phvBadge}`
                  : 'Quick biometric selfie check required by TfL / UK PHV'}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-[12px] font-bold shrink-0 ${
              isFaceVerifiedRecently
                ? 'bg-[#05944F] text-white'
                : 'bg-black dark:bg-[#276EF1] text-white'
            }`}
          >
            {isFaceVerifiedRecently ? 'Verified' : 'Verify'}
          </span>
        </button>

        {onlineStatus === 'online' && (
          <div className="rounded-2xl border border-[#276EF1]/20 bg-[#F4F8FF] dark:bg-[#192338] p-4 space-y-3">
            <div className="w-full h-1.5 bg-[#DCE8FD] dark:bg-white/10 rounded-full overflow-hidden">
              <div className="w-1/2 h-full bg-[#276EF1] animate-uber-radar" />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[14px] font-bold text-black dark:text-white flex items-center gap-2">
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
              onClick={onOpenTripRadar}
              className="w-full h-11 rounded-xl bg-black dark:bg-[#276EF1] text-white text-[13.5px] font-bold hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] transition-colors flex items-center justify-between px-4 tabular-nums"
            >
              <span>Open Trip Radar ({radarCount})</span>
              <span className="text-[11.5px] text-white/75">
                Refreshes in {radarRefreshSecLeft}s
              </span>
            </button>
          </div>
        )}

        {/* UK 12-Hour Driving Time Limit Tracker */}
        <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] space-y-2">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-bold text-black dark:text-white flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-[#276EF1]" />
              UK Driving Time Remaining
            </span>
            <span className="font-extrabold text-black dark:text-white tabular-nums">
              {remHours}h {remMins}m left
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#E6E6E6] dark:bg-white/10 overflow-hidden">
            <div
              className="h-full bg-[#05944F] transition-all"
              style={{ width: `${Math.max(4, 100 - drivingPct)}%` }}
            />
          </div>
          <p className="text-[11.5px] text-[#545454] dark:text-neutral-400">
            6-hour mandatory break resets after offline rest · {account.vehicle} ({account.licensePlate})
          </p>
        </div>

        {/* System Permissions Banner */}
        <button
          type="button"
          onClick={onOpenPermissions}
          className="w-full p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] hover:bg-[#F3F3F3] dark:hover:bg-white/5 flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] dark:bg-[#276EF1]/20 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-[#276EF1]" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-black dark:text-white">
                Permissions & Dynamic Island
              </p>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400 truncate">
                {permissionsReadyCount}/3 enabled · Location GPS, Alerts & Background Refresh
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-black dark:bg-white text-white dark:text-black text-[12px] font-bold shrink-0">
            Manage
          </span>
        </button>

        {/* UK Airport FIFO Queue Preview */}
        <button
          type="button"
          onClick={() => onOpenOpportunities('airports')}
          className="w-full p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] hover:bg-[#F3F3F3] dark:hover:bg-white/5 flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-black dark:bg-white/10 text-white flex items-center justify-center shrink-0">
              <Plane className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-black dark:text-white truncate">
                {featuredAirport.airport}
              </p>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400 truncate tabular-nums">
                {featuredAirport.carsAhead} cars in queue · ~{featuredAirport.estWait} wait
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F] text-[11.5px] font-bold shrink-0">
            {featuredAirport.demand}
          </span>
        </button>

        {/* Opportunities Section */}
        <div className="border-t border-[#EEEEEE] dark:border-white/10 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[20px] font-extrabold text-black dark:text-white">Opportunities</h2>
            <button
              type="button"
              onClick={() => onOpenOpportunities('opportunities')}
              className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
              aria-label="Open Opportunities"
            >
              <ArrowRight className="w-4 h-4 text-black dark:text-white" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => onOpenOpportunities('opportunities')}
            className="w-full p-4 rounded-2xl bg-[#F6F6F6] dark:bg-[#16181D] hover:bg-[#EEEEEE] dark:hover:bg-white/5 text-left transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-bold text-black dark:text-white">
                Weekend Quest · +£190
              </span>
              <span className="text-[12px] font-bold text-[#276EF1] tabular-nums">
                {questCompletedCount}/20 trips
              </span>
            </div>
            <p className="text-[13px] text-[#545454] dark:text-neutral-400 mt-1">
              Drive {Math.max(0, 20 - questCompletedCount)} more trips to unlock bonus
            </p>
          </button>
        </div>

        {/* Today's Real Earnings Preview with Privacy Toggle */}
        <div className="border-t border-[#EEEEEE] dark:border-white/10 pt-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onOpenEarnings}
              className="flex-1 text-left group"
            >
              <p className="text-[13px] font-semibold text-[#545454] dark:text-neutral-400">
                Today’s earnings (saved until 00:00)
              </p>
              <p className="text-[26px] font-extrabold text-black dark:text-white tabular-nums mt-0.5">
                {privacyHidden ? '£••••' : `£${todayEarnings.toFixed(2)}`}{' '}
                <span className="text-[13px] font-medium text-[#545454] dark:text-neutral-400">today</span>
              </p>
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onTogglePrivacy}
                className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center transition-colors"
                aria-label={privacyHidden ? 'Show total earned' : 'Hide total earned'}
                title={privacyHidden ? 'Show total earned' : 'Hide total earned'}
              >
                {privacyHidden ? (
                  <EyeOff className="w-4 h-4 text-black dark:text-white" />
                ) : (
                  <Eye className="w-4 h-4 text-black dark:text-white" />
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
            className="w-full p-3.5 rounded-2xl border border-[#E6E6E6] dark:border-white/10 hover:bg-[#FAFAFA] dark:hover:bg-white/5 flex items-center gap-3 text-left transition-colors"
          >
            <BarChart2 className="w-5 h-5 text-black dark:text-white shrink-0" />
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-black dark:text-white">
                Explore the best times and places to drive today
              </p>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                Peak surge expected 16:00 – 20:00 across Central London
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom Go Online / Go Offline CTA */}
      <div className="p-4 border-t border-[#EEEEEE] dark:border-white/10 bg-white dark:bg-[#0E0F12] shrink-0 max-w-[600px] w-full mx-auto">
        <button
          type="button"
          onClick={onToggleOnline}
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

