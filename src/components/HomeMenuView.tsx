import React from 'react';
import {
  ArrowRight,
  BarChart2,
  BatteryCharging,
  Bell,
  Car,
  ChevronLeft,
  Clock,
  Eye,
  EyeOff,
  Menu as MenuIcon,
  Moon,
  Plane,
  Power,
  Radar,
  Route,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  User,
} from 'lucide-react';
import { BUSY_SOON_ZONES, UK_AIRPORT_QUEUES } from '../data/mockDriverData';
import { DriverAccount, DriverOnlineStatus, DriverPreferences, TripStats } from '../types/driver';
import { formatOnlineTimer } from '../utils/timeFormat';

interface HomeMenuViewProps {
  account: DriverAccount;
  onlineStatus: DriverOnlineStatus;
  onlineElapsedSec?: number;
  todayEarnings: number;
  privacyHidden: boolean;
  questCompletedCount: number;
  tripStats: TripStats;
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
  onOpenTrips: () => void;
  onOpenEarnings: () => void;
  onOpenAccountMenu: () => void;
  onOpenTripRadar: () => void;
  onOpenPermissions: () => void;
  onDispatchIntercity: () => void;
  onRechargeVehicle: () => void;
}

export const HomeMenuView: React.FC<HomeMenuViewProps> = ({
  account,
  onlineStatus,
  onlineElapsedSec = 0,
  todayEarnings,
  privacyHidden,
  questCompletedCount,
  tripStats,
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
  onOpenTrips,
  onOpenEarnings,
  onOpenAccountMenu,
  onOpenTripRadar,
  onOpenPermissions,
  onDispatchIntercity,
  onRechargeVehicle,
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
            <p className="text-[14px] text-[#545454] dark:text-neutral-400 font-medium tabular-nums">
              {onlineStatus === 'offline'
                ? `Ready to go in ${account.city}?`
                : `Online ${formatOnlineTimer(onlineElapsedSec)} · Finding trips across ${account.city}`}
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
              <span className="text-[14px] font-bold text-black dark:text-white flex items-center gap-2 min-w-0 truncate">
                <Radar className="w-4 h-4 text-[#276EF1] shrink-0" />
                <span className="truncate">
                  Dispatch ·{' '}
                  {[
                    preferences.uberX ? 'UberX' : null,
                    preferences.comfort ? 'Comfort' : null,
                    preferences.uberXL ? 'UberXL' : null,
                    preferences.uberPet ? 'Uber Pet' : null,
                    preferences.deliveries ? 'Uber Eats' : null,
                    preferences.intercity ? 'Intercity' : null,
                  ]
                    .filter(Boolean)
                    .join(', ') || 'UberX'}
                </span>
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

        {/* Trips Accepted / Declined / Total Received Card */}
        <button
          type="button"
          onClick={onOpenTrips}
          className="w-full p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] hover:bg-[#F3F3F3] dark:hover:bg-white/5 flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-black dark:bg-[#276EF1] text-white flex items-center justify-center shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-black dark:text-white">Trips Activity</p>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400 tabular-nums truncate">
                {tripStats.totalReceived} received · {tripStats.accepted} accepted ·{' '}
                {tripStats.declined} declined
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#545454] dark:text-neutral-400 shrink-0" />
        </button>

        {/* EV Battery / Fuel Range Tracker */}
        {(() => {
          const batteryPct = account.batteryPct ?? 84;
          const rangeMiles = Math.round((batteryPct / 100) * 250);
          return (
            <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="font-bold text-black dark:text-white flex items-center gap-1.5">
                  <BatteryCharging
                    className={`w-4 h-4 ${
                      batteryPct <= 25 ? 'text-[#E11900]' : 'text-[#05944F]'
                    }`}
                  />
                  EV Battery / Fuel Range
                </span>
                <span className="font-extrabold text-black dark:text-white tabular-nums">
                  {batteryPct}% · ~{rangeMiles} mi
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#E6E6E6] dark:bg-white/10 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    batteryPct <= 25 ? 'bg-[#E11900]' : 'bg-[#05944F]'
                  }`}
                  style={{ width: `${batteryPct}%` }}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 truncate">
                  {batteryPct <= 25
                    ? 'Low range — rapid charge recommended before Intercity'
                    : 'Ready for local & Intercity motorway runs'}
                </p>
                {batteryPct < 98 && (
                  <button
                    type="button"
                    onClick={onRechargeVehicle}
                    className="px-2.5 py-1 rounded-full bg-[#05944F] text-white text-[11px] font-bold whitespace-nowrap shrink-0 hover:bg-[#047A40]"
                  >
                    Rapid Charge (100%)
                  </button>
                )}
              </div>
            </div>
          );
        })()}

        {/* Intercity Out-of-City Quick Dispatch */}
        <button
          type="button"
          onClick={onDispatchIntercity}
          className="w-full p-4 rounded-2xl border border-[#7C3AED]/35 bg-[#F5F3FF] dark:bg-[#231A38] hover:bg-[#EDE9FE] dark:hover:bg-[#2B2046] flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center shrink-0">
              <Route className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[14px] font-bold text-black dark:text-white">
                  Intercity Out-of-City Job
                </p>
                <span className="px-1.5 py-0.5 rounded bg-[#7C3AED] text-white text-[10px] font-extrabold uppercase">
                  UK
                </span>
              </div>
              <p className="text-[12px] text-[#545454] dark:text-neutral-300 truncate">
                London → Oxford, Brighton, Birmingham & Manchester → Leeds
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-black dark:bg-[#7C3AED] text-white text-[12px] font-bold shrink-0 whitespace-nowrap">
            Get Job
          </span>
        </button>

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

        {/* Busy Soon Predictive UK Hotspots */}
        <div className="p-4 rounded-2xl border border-[#F59E0B]/30 bg-[#FFFBEB] dark:bg-amber-950/25 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#D97706] dark:text-amber-300" />
              <p className="text-[14px] font-bold text-black dark:text-white">Busy Soon Forecasts</p>
            </div>
            <button
              type="button"
              onClick={() => onOpenOpportunities('trends')}
              className="text-[12px] font-bold text-[#B45309] dark:text-amber-300 hover:underline"
            >
              View Trends
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {BUSY_SOON_ZONES.slice(0, 3).map((bz) => (
              <button
                key={bz.id}
                type="button"
                onClick={onBackToMap}
                className="p-2.5 rounded-xl bg-white/85 dark:bg-black/25 border border-black/5 dark:border-white/10 text-left hover:bg-white dark:hover:bg-black/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[12px] font-extrabold text-[#B45309] dark:text-amber-300 tabular-nums">
                    In {bz.minutesUntilBusy}m
                  </span>
                  <span className="text-[11px] font-bold text-[#05944F] tabular-nums">
                    {bz.expectedBoost}
                  </span>
                </div>
                <p className="text-[12.5px] font-bold text-black dark:text-white truncate mt-0.5">
                  {bz.area}
                </p>
                <p className="text-[11px] text-[#545454] dark:text-neutral-400 truncate">
                  {bz.reason}
                </p>
              </button>
            ))}
          </div>
        </div>

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

