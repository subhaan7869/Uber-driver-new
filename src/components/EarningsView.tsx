import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Banknote,
  BatteryCharging,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Eye,
  EyeOff,
  Flame,
  Landmark,
  MoreHorizontal,
  ReceiptText,
  Route,
  Share2,
  ShieldCheck,
  Sparkles,
  Store,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  X,
} from 'lucide-react';
import { HOURLY_TRENDS } from '../data/mockDriverData';
import {
  CompletedTrip,
  DriverCostSettings,
  ExpenseEntry,
  PayoutRecord,
} from '../types/driver';
import {
  formatWeekRangeLabel,
  getAllTimeTotalFromLedger,
  getCurrentWeekDays,
  getLocalDateKey,
  getOffsetDateKey,
  getWeeklyTotalFromLedger,
} from '../utils/earningsStorage';
import { uberSounds } from '../utils/uberSounds';

export interface TripClaimDetails {
  amount: number;
  incidentLabel: string;
  photoName?: string;
  notes?: string;
}

const CLAIM_PRESETS: Array<{
  id: 'interior_spill' | 'biohazard' | 'vehicle_damage' | 'missed_toll' | 'fare_review';
  kind: 'valeting' | 'fare_review';
  label: string;
  subtitle: string;
  amount: number;
}> = [
  {
    id: 'interior_spill',
    kind: 'valeting',
    label: 'Interior Spill / Mud',
    subtitle: 'Standard UK PHV interior clean',
    amount: 40,
  },
  {
    id: 'biohazard',
    kind: 'valeting',
    label: 'Biohazard Valeting',
    subtitle: 'Deep sanitisation & downtime',
    amount: 80,
  },
  {
    id: 'vehicle_damage',
    kind: 'valeting',
    label: 'Door / Trim Damage',
    subtitle: 'Minor passenger damage repair',
    amount: 150,
  },
  {
    id: 'missed_toll',
    kind: 'fare_review',
    label: 'Missed Toll / Airport Fee',
    subtitle: 'Dartford / ULEZ / Terminal drop-off',
    amount: 7.5,
  },
  {
    id: 'fare_review',
    kind: 'fare_review',
    label: 'Fare & Wait Review',
    subtitle: 'Route diversion / heavy traffic',
    amount: 4.8,
  },
];

interface EarningsViewProps {
  weeklyEarnings: number;
  todayEarnings: number;
  walletBalance: number;
  dailyTotals: Record<string, number>;
  completedTrips: CompletedTrip[];
  expenses?: ExpenseEntry[];
  payouts?: PayoutRecord[];
  costSettings?: DriverCostSettings;
  weeklyInsuranceGbp?: number;
  onUpdateCostSettings?: (next: DriverCostSettings) => void;
  questCompletedCount: number;
  dailyGoalGbp?: number;
  weeklyGoalGbp?: number;
  onUpdateGoals?: (daily: number, weekly: number) => void;
  privacyHidden: boolean;
  onTogglePrivacy: () => void;
  onBack: () => void;
  onCashOut: (amount: number, method: 'instant' | 'bank') => void;
  onOpenOpportunities: () => void;
  onOpenTrends?: () => void;
  onOpenChargers?: () => void;
  onExportTaxCsv?: () => void;
  onShareTripReceipt?: (trip: CompletedTrip) => void;
  onFileTripClaim?: (
    tripId: string,
    kind: 'valeting' | 'fare_review',
    details?: TripClaimDetails
  ) => void;
  holidayPayAccrued?: number;
  holidayPayClaimedTotal?: number;
  engagedMinutesTotal?: number;
  onlineMinutesTotal?: number;
  onClaimHolidayPay?: () => void;
}

function formatDynamicTripTime(
  trip: CompletedTrip,
  todayKey: string,
  yesterdayKey: string
): string {
  const timePart = trip.completedAt.includes(',')
    ? trip.completedAt.split(',').slice(1).join(',').trim()
    : trip.completedAt;

  if (!trip.dateKey || trip.dateKey === todayKey) {
    return `Today, ${timePart}`;
  }
  if (trip.dateKey === yesterdayKey) {
    return `Yesterday, ${timePart}`;
  }
  const parsed = new Date(`${trip.dateKey}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return trip.completedAt;
  }
  const dateLabel = parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
  return `${dateLabel}, ${timePart}`;
}

export const EarningsView: React.FC<EarningsViewProps> = ({
  weeklyEarnings,
  todayEarnings,
  walletBalance,
  dailyTotals,
  completedTrips,
  expenses = [],
  payouts = [],
  costSettings = {
    fuelOrKwhPerMileGbp: 0.16,
    weeklyInsuranceGbp: 58,
    weeklyVehicleCostGbp: 145,
  },
  weeklyInsuranceGbp,
  onUpdateCostSettings,
  questCompletedCount,
  dailyGoalGbp = 180,
  weeklyGoalGbp = 950,
  onUpdateGoals,
  privacyHidden,
  onTogglePrivacy,
  onBack,
  onCashOut,
  onOpenOpportunities,
  onOpenTrends,
  onOpenChargers,
  onExportTaxCsv,
  onShareTripReceipt,
  onFileTripClaim,
  holidayPayAccrued = 0,
  holidayPayClaimedTotal = 0,
  engagedMinutesTotal = 42,
  onlineMinutesTotal = 60,
  onClaimHolidayPay,
}) => {
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [cashOutMethod, setCashOutMethod] = useState<'instant' | 'bank'>('instant');
  const [cashOutDone, setCashOutDone] = useState<string | null>(null);
  const [showAllTrips, setShowAllTrips] = useState(false);
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [editingGoals, setEditingGoals] = useState(false);
  const [editingCosts, setEditingCosts] = useState(false);
  const [claimModalTrip, setClaimModalTrip] = useState<CompletedTrip | null>(null);
  const [claimPresetId, setClaimPresetId] = useState<
    'interior_spill' | 'biohazard' | 'vehicle_damage' | 'missed_toll' | 'fare_review'
  >('interior_spill');
  const [claimPhotoName, setClaimPhotoName] = useState<string>('');
  const [claimNotes, setClaimNotes] = useState<string>('');
  const [copiedPayoutId, setCopiedPayoutId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [tripDayFilter, setTripDayFilter] = useState<'all' | 'today' | 'yesterday'>('all');

  const todayKey = getLocalDateKey();
  const yesterdayKey = getOffsetDateKey(-1);
  const yesterdayEarnings = dailyTotals[yesterdayKey] ?? 0;
  const allSavedEarnings = useMemo(
    () => getAllTimeTotalFromLedger(dailyTotals),
    [dailyTotals]
  );

  const weekDays = useMemo(() => {
    return getCurrentWeekDays(weekOffset).map((d) => ({
      ...d,
      amount: dailyTotals[d.dateKey] ?? 0,
    }));
  }, [dailyTotals, weekOffset]);

  const displayedWeekTotal = useMemo(
    () =>
      weekOffset === 0
        ? weeklyEarnings
        : getWeeklyTotalFromLedger(dailyTotals, weekOffset),
    [weekOffset, weeklyEarnings, dailyTotals]
  );

  const todayIdx = Math.max(
    0,
    weekDays.findIndex((d) => d.isToday)
  );
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(todayIdx);

  const maxDayAmount = Math.max(...weekDays.map((d) => d.amount), 25);
  const weekRangeLabel = useMemo(
    () => formatWeekRangeLabel(weekOffset),
    [weekOffset]
  );

  const mask = (val: string) => (privacyHidden ? '£••••' : val);

  const handleConfirmCashOut = () => {
    if (walletBalance <= 0) return;
    const fee = cashOutMethod === 'instant' ? 1.25 : 0;
    const payout = Math.max(0, walletBalance - fee);
    uberSounds.play('cashOut');
    onCashOut(walletBalance, cashOutMethod);
    setCashOutDone(
      `£${payout.toFixed(2)} sent via ${
        cashOutMethod === 'instant'
          ? 'Instant Pay (UK Visa •• 4821)'
          : 'Faster Payments Bank (•• 9014)'
      }`
    );
    setTimeout(() => {
      setShowCashOutModal(false);
      setCashOutDone(null);
    }, 1500);
  };

  const filteredTrips = useMemo(() => {
    if (tripDayFilter === 'today') {
      return completedTrips.filter((t) => !t.dateKey || t.dateKey === todayKey);
    }
    if (tripDayFilter === 'yesterday') {
      return completedTrips.filter((t) => t.dateKey === yesterdayKey);
    }
    return completedTrips;
  }, [completedTrips, tripDayFilter, todayKey, yesterdayKey]);

  const visibleTrips = showAllTrips ? filteredTrips : filteredTrips.slice(0, 6);
  const selectedDay = weekDays[selectedDayIdx] || weekDays[todayIdx] || weekDays[0];

  const mileageStats = useMemo(() => {
    let todayMiles = 0;
    let totalMiles = 0;
    for (const t of completedTrips) {
      totalMiles += t.distanceMiles;
      if (!t.dateKey || t.dateKey === todayKey) {
        todayMiles += t.distanceMiles;
      }
    }
    return {
      todayMiles: Number(todayMiles.toFixed(1)),
      totalMiles: Number(totalMiles.toFixed(1)),
      todayTaxRelief: Number((todayMiles * 0.45).toFixed(2)),
      totalTaxRelief: Number((totalMiles * 0.45).toFixed(2)),
    };
  }, [completedTrips, todayKey]);

  const efficiencyStats = useMemo(() => {
    const tripDurationSum = completedTrips.reduce((s, t) => s + t.durationMin, 0);
    const engagedMin = Math.max(engagedMinutesTotal, tripDurationSum, 15);
    const onlineMin = Math.max(onlineMinutesTotal, engagedMin);
    const engagedHours = engagedMin / 60;
    const onlineHours = onlineMin / 60;
    const tripsEarnings =
      completedTrips.length > 0
        ? completedTrips.reduce(
            (s, t) => s + (t.netPayout ?? t.fare + t.tip + (t.waitFee ?? 0)),
            0
          )
        : todayEarnings;
    const totalMiles = completedTrips.reduce((s, t) => s + t.distanceMiles, 0);
    const perEngagedHr = Number((tripsEarnings / engagedHours).toFixed(2));
    const perOnlineHr = Number((tripsEarnings / onlineHours).toFixed(2));
    const perMile = totalMiles > 0 ? Number((tripsEarnings / totalMiles).toFixed(2)) : 0;
    const peakNet = completedTrips
      .filter((t) => t.peakPeriod)
      .reduce((s, t) => s + (t.netPayout ?? t.fare + t.tip + (t.waitFee ?? 0)), 0);
    const offPeakNet = Math.max(0, tripsEarnings - peakNet);
    const peakSharePct =
      tripsEarnings > 0 ? Math.min(100, Math.round((peakNet / tripsEarnings) * 100)) : 50;
    const nlwRate = 12.21;
    const nlwSurplusPct = Math.round(((perEngagedHr - nlwRate) / nlwRate) * 100);
    return {
      perEngagedHr,
      perOnlineHr,
      perMile,
      peakNet: Number(peakNet.toFixed(2)),
      offPeakNet: Number(offPeakNet.toFixed(2)),
      peakSharePct,
      nlwRate,
      nlwSurplusPct,
      engagedMin,
    };
  }, [completedTrips, engagedMinutesTotal, onlineMinutesTotal, todayEarnings]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-[#0D0E12] pb-6">
      <div className="px-5 pt-15 lg:pt-6 pb-4 flex items-center justify-between gap-3 max-w-[680px] mx-auto">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 active:scale-95 flex items-center justify-center transition-all shrink-0"
            aria-label="Back to Map"
          >
            <ChevronLeft className="w-6 h-6 text-black dark:text-white" />
          </button>
          <h1 className="text-[32px] font-extrabold tracking-tight text-black dark:text-white">
            Earnings
          </h1>
        </div>

        <button
          type="button"
          onClick={onTogglePrivacy}
          className="h-10 px-3.5 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 active:scale-95 flex items-center gap-1.5 text-[13px] font-bold text-black dark:text-white transition-all"
          aria-label={privacyHidden ? 'Show earnings amounts' : 'Hide earnings amounts'}
        >
          {privacyHidden ? (
            <>
              <EyeOff className="w-4 h-4 text-black dark:text-white" />
              <span>Hidden</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-black dark:text-white" />
              <span>Privacy</span>
            </>
          )}
        </button>
      </div>

      <div className="px-5 space-y-5 max-w-[680px] mx-auto">
        {/* Weekly & Saved Earnings Card */}
        <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-white dark:bg-[#16181E] p-5 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWeekOffset((w) => w - 1);
                    setSelectedDayIdx(6);
                  }}
                  className="w-7 h-7 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center transition-colors"
                  aria-label="Previous week"
                  title="Previous week"
                >
                  <ChevronLeft className="w-4 h-4 text-black dark:text-white" />
                </button>
                <p className="text-[14px] font-medium text-[#545454] dark:text-neutral-400">
                  {weekRangeLabel}
                  {weekOffset === -1 ? ' (Last week)' : weekOffset < -1 ? ` (${Math.abs(weekOffset)}w ago)` : ''}
                </p>
                {weekOffset < 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.min(0, weekOffset + 1);
                      setWeekOffset(next);
                      setSelectedDayIdx(next === 0 ? todayIdx : 0);
                    }}
                    className="w-7 h-7 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center transition-colors"
                    aria-label="Next week"
                    title="Next week"
                  >
                    <ChevronRight className="w-4 h-4 text-black dark:text-white" />
                  </button>
                )}
              </div>
              <p className="text-[36px] font-extrabold tracking-tight text-black dark:text-white mt-0.5 tabular-nums">
                {mask(`£${displayedWeekTotal.toFixed(2)}`)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-1.5 bg-[#05944F] text-white text-[13px] font-bold px-2.5 py-1 rounded-md tabular-nums">
                  <span>{mask(`£${todayEarnings.toFixed(2)}`)} today</span>
                  <span className="text-white/75 text-[11px] font-semibold">· Home resets 00:00</span>
                </div>
                <div className="inline-flex items-center gap-1.5 bg-[#F3F3F3] dark:bg-white/10 text-black dark:text-white text-[12.5px] font-bold px-2.5 py-1 rounded-md tabular-nums">
                  <span>Yesterday: {mask(`£${yesterdayEarnings.toFixed(2)}`)}</span>
                </div>
              </div>
            </div>
            <div className="text-right text-[12px] text-[#545454] dark:text-neutral-400 tabular-nums shrink-0">
              <p className="font-semibold text-black dark:text-white">
                {completedTrips.length} {completedTrips.length === 1 ? 'trip' : 'trips'} saved
              </p>
              <p>Total: {mask(`£${allSavedEarnings.toFixed(2)}`)}</p>
            </div>
          </div>

          {/* Interactive 7-day real earnings bar breakdown */}
          <div className="mt-6 pt-4 border-t border-[#F0F0F0] dark:border-white/10">
            <div className="grid grid-cols-7 gap-2 items-end h-24">
              {weekDays.map((d, idx) => {
                const heightPct =
                  d.amount > 0 ? Math.max(16, (d.amount / maxDayAmount) * 100) : 6;
                const isSelected = idx === selectedDayIdx;
                return (
                  <button
                    key={d.dateKey}
                    type="button"
                    onClick={() => setSelectedDayIdx(idx)}
                    className="flex flex-col items-center justify-end h-full gap-1.5 group focus:outline-none"
                  >
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        style={{ height: `${heightPct}%` }}
                        className={`w-full max-w-[24px] rounded-t-md transition-all ${
                          isSelected
                            ? 'bg-[#276EF1]'
                            : d.amount > 0
                            ? 'bg-black/80 dark:bg-white/75 group-hover:bg-black dark:group-hover:bg-white'
                            : 'bg-[#EEEEEE] dark:bg-white/10'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-[11px] font-semibold ${
                        isSelected
                          ? 'text-[#276EF1]'
                          : d.isToday
                          ? 'text-black dark:text-white font-bold'
                          : 'text-[#6B6B6B] dark:text-neutral-400'
                      }`}
                    >
                      {d.day}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-[13px] text-[#545454] dark:text-neutral-400 tabular-nums">
              <span>
                {selectedDay.day} (
                {selectedDay.isToday
                  ? 'Today'
                  : selectedDay.isYesterday
                  ? 'Yesterday'
                  : selectedDay.dateKey}
                ) saved total
              </span>
              <span className="font-bold text-black dark:text-white">
                {mask(`£${selectedDay.amount.toFixed(2)}`)}
              </span>
            </div>
          </div>
        </div>

        {/* My Money Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[22px] font-extrabold tracking-tight text-black dark:text-white">
              My money
            </h2>
            <button
              type="button"
              onClick={() => setShowCashOutModal(true)}
              className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center transition-colors"
              aria-label="Open wallet cash out"
            >
              <ArrowRight className="w-4 h-4 text-black dark:text-white" />
            </button>
          </div>

          <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-white dark:bg-[#16181E] p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-[#545454] dark:text-neutral-400">
                  Total balance
                </p>
                <p className="text-[32px] font-extrabold tracking-tight text-black dark:text-white mt-0.5 tabular-nums">
                  {mask(
                    `£${walletBalance.toLocaleString('en-GB', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}`
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCashOutModal(true)}
                className="w-10 h-10 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center transition-colors"
                aria-label="Wallet options"
              >
                <MoreHorizontal className="w-5 h-5 text-black dark:text-white" />
              </button>
            </div>

            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                disabled={walletBalance <= 0}
                onClick={() => setShowCashOutModal(true)}
                className="px-5 h-10 rounded-full bg-black dark:bg-[#276EF1] text-white text-[14px] font-bold hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] disabled:opacity-40 transition-colors"
              >
                Cash out
              </button>
              <button
                type="button"
                onClick={() => setShowCashOutModal(true)}
                className="px-4 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 text-black dark:text-white text-[14px] font-semibold hover:bg-[#E5E5E5] dark:hover:bg-white/15 transition-colors"
              >
                Payout methods
              </button>
            </div>
          </div>
        </div>

        {/* Quest Tracker Card */}
        <button
          type="button"
          onClick={onOpenOpportunities}
          className="w-full rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181E] hover:bg-[#F3F3F3] dark:hover:bg-[#1D2028] p-4 flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-black dark:bg-[#276EF1] text-white flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-black dark:text-white">
                Quest: {Math.min(questCompletedCount, 20)} / 20 trips
              </p>
              <p className="text-[13px] text-[#545454] dark:text-neutral-400 truncate">
                {questCompletedCount >= 20
                  ? 'Quest completed! +£190 earned'
                  : `Drive ${20 - questCompletedCount} more trips to make £190 extra`}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#545454] dark:text-neutral-400 shrink-0" />
        </button>

        {/* Daily & Weekly Earnings Goal Tracker */}
        <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181E] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#E8F0FE] dark:bg-[#276EF1]/20 text-[#276EF1] flex items-center justify-center shrink-0">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-black dark:text-white">
                  Earnings Goals
                </p>
                <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 tabular-nums">
                  Daily {mask(`£${dailyGoalGbp}`)} · Weekly {mask(`£${weeklyGoalGbp}`)}
                </p>
              </div>
            </div>
            {onUpdateGoals && (
              <button
                type="button"
                onClick={() => setEditingGoals((v) => !v)}
                className="px-3 py-1 rounded-full bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-[12px] font-bold text-black dark:text-white hover:bg-[#F3F3F3] dark:hover:bg-white/15"
              >
                {editingGoals ? 'Done' : 'Edit Goal'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                label: 'Today’s Goal',
                current: todayEarnings,
                target: Math.max(1, dailyGoalGbp),
                accent: 'bg-[#05944F]',
              },
              {
                label: 'Weekly Goal',
                current: weeklyEarnings,
                target: Math.max(1, weeklyGoalGbp),
                accent: 'bg-[#276EF1]',
              },
            ].map((g) => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              const remaining = Math.max(0, g.target - g.current);
              return (
                <div
                  key={g.label}
                  className="rounded-xl bg-white dark:bg-white/5 p-3 border border-black/5 dark:border-white/5 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-[#545454] dark:text-neutral-400">
                      {g.label}
                    </span>
                    <span className="font-extrabold text-black dark:text-white tabular-nums">
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[#ECECEC] dark:bg-white/10 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${g.accent}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[11.5px] font-semibold text-black dark:text-white tabular-nums">
                    {remaining === 0
                      ? 'Target reached!'
                      : `${mask(`£${remaining.toFixed(2)}`)} left to target`}
                  </p>
                </div>
              );
            })}
          </div>

          {editingGoals && onUpdateGoals && (
            <div className="pt-2 border-t border-black/5 dark:border-white/10 space-y-2.5">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#545454] dark:text-neutral-400 mb-1.5">
                  Daily Target
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[120, 180, 250, 320].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onUpdateGoals(val, weeklyGoalGbp)}
                      className={`h-8 rounded-lg text-[12px] font-bold tabular-nums transition-colors ${
                        dailyGoalGbp === val
                          ? 'bg-black dark:bg-[#276EF1] text-white'
                          : 'bg-white dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10'
                      }`}
                    >
                      £{val}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[#545454] dark:text-neutral-400 mb-1.5">
                  Weekly Target
                </p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[650, 950, 1250, 1500].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => onUpdateGoals(dailyGoalGbp, val)}
                      className={`h-8 rounded-lg text-[12px] font-bold tabular-nums transition-colors ${
                        weeklyGoalGbp === val
                          ? 'bg-black dark:bg-[#276EF1] text-white'
                          : 'bg-white dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10'
                      }`}
                    >
                      £{val}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* UK HMRC Mileage & £0.45/mi Tax Relief Summary */}
        <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181E] p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F] flex items-center justify-center shrink-0">
                <ReceiptText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-black dark:text-white">
                  HMRC Business Mileage Relief
                </p>
                <p className="text-[11.5px] text-[#545454] dark:text-neutral-400">
                  UK simplified expenses · £0.45/mi tax-free allowance
                </p>
              </div>
            </div>
            <span className="text-[16px] font-extrabold text-[#05944F] tabular-nums">
              {mask(`£${mileageStats.totalTaxRelief.toFixed(2)}`)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5 dark:border-white/10 text-[12px] tabular-nums">
            <div className="rounded-xl bg-white dark:bg-white/5 px-3 py-2 border border-black/5 dark:border-white/5">
              <p className="text-[#545454] dark:text-neutral-400">Today</p>
              <p className="font-bold text-black dark:text-white">
                {mileageStats.todayMiles} mi · {mask(`£${mileageStats.todayTaxRelief.toFixed(2)}`)}
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-white/5 px-3 py-2 border border-black/5 dark:border-white/5">
              <p className="text-[#545454] dark:text-neutral-400">Logged Ledger Total</p>
              <p className="font-bold text-black dark:text-white">
                {mileageStats.totalMiles} mi · {mask(`£${mileageStats.totalTaxRelief.toFixed(2)}`)}
              </p>
            </div>
          </div>
          {onExportTaxCsv && (
            <button
              type="button"
              onClick={onExportTaxCsv}
              className="w-full h-10 rounded-xl bg-black dark:bg-[#276EF1] text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity"
            >
              <Download className="w-4 h-4" />
              <span>Share / Download HMRC Self-Assessment CSV</span>
            </button>
          )}
        </div>

        {/* True Net Profit Calculator (Fuel/kWh, Weekly Insurance, Vehicle Cost & Logged Receipts) */}
        {(() => {
          const totalExpenses = Number(
            expenses.reduce((s, e) => s + e.amount, 0).toFixed(2)
          );
          const todayExpenses = Number(
            expenses
              .filter((e) => e.dateKey === todayKey)
              .reduce((s, e) => s + e.amount, 0)
              .toFixed(2)
          );
          const effectiveWeeklyInsurance =
            weeklyInsuranceGbp ?? costSettings.weeklyInsuranceGbp ?? 58;
          const fuelRatePerMile = costSettings.fuelOrKwhPerMileGbp ?? 0.16;
          const weeklyVehicleLease = costSettings.weeklyVehicleCostGbp ?? 145;
          const estimatedFuelOrEnergy = Number(
            (mileageStats.totalMiles * fuelRatePerMile).toFixed(2)
          );
          const totalOverhead = Number(
            (totalExpenses + estimatedFuelOrEnergy + effectiveWeeklyInsurance + weeklyVehicleLease).toFixed(2)
          );
          const trueWeeklyNet = Number(
            (weeklyEarnings - totalOverhead).toFixed(2)
          );
          const onlineHrs = Math.max(1, onlineMinutesTotal / 60);
          const trueNetPerHr = Number((trueWeeklyNet / onlineHrs).toFixed(2));
          return (
            <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181E] p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#FFF3D6] dark:bg-amber-950/60 text-[#D97706] flex items-center justify-center shrink-0">
                    <BatteryCharging className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-black dark:text-white">
                      True Net Profit Calculator
                    </p>
                    <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 tabular-nums">
                      Deducts fuel/kWh, £{effectiveWeeklyInsurance}/wk H&R insurance & lease
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {onUpdateCostSettings && (
                    <button
                      type="button"
                      onClick={() => setEditingCosts((v) => !v)}
                      className="px-2.5 py-1 rounded-full bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-[11px] font-bold text-black dark:text-white"
                    >
                      {editingCosts ? 'Done' : 'Costs'}
                    </button>
                  )}
                  {onOpenChargers && (
                    <button
                      type="button"
                      onClick={onOpenChargers}
                      className="px-3 py-1 rounded-full bg-black dark:bg-[#276EF1] text-white text-[11.5px] font-bold shrink-0"
                    >
                      Log Charge
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-black/5 dark:border-white/10 text-[12px] tabular-nums">
                <div className="rounded-xl bg-white dark:bg-white/5 px-3 py-2 border border-black/5 dark:border-white/5">
                  <p className="text-[#545454] dark:text-neutral-400">True Weekly Net Profit</p>
                  <p
                    className={`text-[15px] font-extrabold ${
                      trueWeeklyNet >= 0 ? 'text-[#05944F]' : 'text-[#E11900]'
                    }`}
                  >
                    {mask(`${trueWeeklyNet >= 0 ? '' : '−'}£${Math.abs(trueWeeklyNet).toFixed(2)}`)}
                  </p>
                </div>
                <div className="rounded-xl bg-white dark:bg-white/5 px-3 py-2 border border-black/5 dark:border-white/5">
                  <p className="text-[#545454] dark:text-neutral-400">True Net / Online Hr</p>
                  <p className="text-[15px] font-extrabold text-black dark:text-white">
                    {mask(`£${trueNetPerHr.toFixed(2)}/hr`)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] tabular-nums">
                <div className="rounded-lg bg-white dark:bg-white/5 px-2 py-1.5 border border-black/5 dark:border-white/5">
                  <p className="text-[#545454] dark:text-neutral-400">Fuel/kWh Est</p>
                  <p className="font-bold text-black dark:text-white">
                    {mask(`£${estimatedFuelOrEnergy.toFixed(2)}`)}
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-white/5 px-2 py-1.5 border border-black/5 dark:border-white/5">
                  <p className="text-[#545454] dark:text-neutral-400">H&R Insurance</p>
                  <p className="font-bold text-black dark:text-white">
                    £{effectiveWeeklyInsurance}/wk
                  </p>
                </div>
                <div className="rounded-lg bg-white dark:bg-white/5 px-2 py-1.5 border border-black/5 dark:border-white/5">
                  <p className="text-[#545454] dark:text-neutral-400">Vehicle & Tolls</p>
                  <p className="font-bold text-black dark:text-white">
                    {mask(`£${(weeklyVehicleLease + totalExpenses).toFixed(0)}`)}
                  </p>
                </div>
              </div>

              {editingCosts && onUpdateCostSettings && (
                <div className="pt-2 border-t border-black/5 dark:border-white/10 space-y-2.5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#545454] dark:text-neutral-400 mb-1">
                      Energy / Fuel Cost per Mile
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: '£0.08/mi EV', val: 0.08 },
                        { label: '£0.16/mi Hybrid', val: 0.16 },
                        { label: '£0.22/mi Petrol', val: 0.22 },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() =>
                            onUpdateCostSettings({
                              ...costSettings,
                              fuelOrKwhPerMileGbp: opt.val,
                            })
                          }
                          className={`h-8 rounded-lg text-[11px] font-bold transition-colors ${
                            Math.abs(fuelRatePerMile - opt.val) < 0.01
                              ? 'bg-black dark:bg-[#276EF1] text-white'
                              : 'bg-white dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#545454] dark:text-neutral-400 mb-1">
                      Weekly PCO Vehicle Lease / Finance
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { label: '£0 Owned', val: 0 },
                        { label: '£145 Hybrid', val: 145 },
                        { label: '£210 EV Flex', val: 210 },
                      ].map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() =>
                            onUpdateCostSettings({
                              ...costSettings,
                              weeklyVehicleCostGbp: opt.val,
                            })
                          }
                          className={`h-8 rounded-lg text-[11px] font-bold transition-colors ${
                            weeklyVehicleLease === opt.val
                              ? 'bg-black dark:bg-[#276EF1] text-white'
                              : 'bg-white dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {expenses.length > 0 && !privacyHidden && (
                <div className="space-y-1 pt-1">
                  <p className="text-[10.5px] font-bold uppercase tracking-wide text-[#545454] dark:text-neutral-400">
                    Today logged tolls/charges: £{todayExpenses.toFixed(2)}
                  </p>
                  {expenses.slice(0, 3).map((ex) => (
                    <div
                      key={ex.id}
                      className="flex items-center justify-between text-[11.5px] text-[#545454] dark:text-neutral-400 tabular-nums"
                    >
                      <span className="truncate">
                        {ex.label} ({ex.timestamp})
                      </span>
                      <span className="font-bold text-[#E11900] shrink-0">
                        −£{ex.amount.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* Best-Hours City Demand Forecast */}
        <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181E] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FCE8E6] dark:bg-rose-950/60 text-[#E11900] flex items-center justify-center shrink-0">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-black dark:text-white">
                  Best-Hours City Forecast
                </p>
                <p className="text-[11.5px] text-[#545454] dark:text-neutral-400">
                  Peak UK demand: 16:00 – 20:00 (up to £48/hr)
                </p>
              </div>
            </div>
            {onOpenTrends && (
              <button
                type="button"
                onClick={onOpenTrends}
                className="px-3 py-1 rounded-full bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-[11.5px] font-bold text-[#276EF1] shrink-0"
              >
                Full Trends
              </button>
            )}
          </div>

          <div className="grid grid-cols-8 gap-1.5 items-end h-20 pt-1">
            {HOURLY_TRENDS.map((slot) => {
              const isPeak = slot.demand >= 85;
              return (
                <div key={slot.hour} className="flex flex-col items-center justify-end h-full gap-1">
                  <span className="text-[9.5px] font-bold text-[#545454] dark:text-neutral-400 tabular-nums">
                    {slot.label.replace('/hr', '')}
                  </span>
                  <div className="w-full flex-1 flex items-end justify-center">
                    <div
                      style={{ height: `${Math.max(18, slot.demand)}%` }}
                      className={`w-full max-w-[18px] rounded-t-md ${
                        isPeak ? 'bg-[#05944F]' : 'bg-[#276EF1]/75'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-[#545454] dark:text-neutral-400">
                    {slot.hour}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payout History & Statements */}
        <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181E] p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#E8F0FE] dark:bg-[#276EF1]/20 text-[#276EF1] flex items-center justify-center shrink-0">
                <Landmark className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-black dark:text-white">
                  Payout History & Statements
                </p>
                <p className="text-[11.5px] text-[#545454] dark:text-neutral-400">
                  {payouts.length > 0
                    ? `${payouts.length} Faster Payments / Instant Cashout${payouts.length === 1 ? '' : 's'}`
                    : 'Cash out from My Money to generate UK bank payout receipts'}
                </p>
              </div>
            </div>
            <Wallet className="w-4 h-4 text-[#545454] dark:text-neutral-400" />
          </div>

          {payouts.length > 0 && (
            <div className="space-y-2 pt-1">
              {payouts.slice(0, 4).map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-bold text-black dark:text-white truncate">
                      {p.destinationLabel}
                    </p>
                    <p className="text-[11px] text-[#545454] dark:text-neutral-400 tabular-nums">
                      {p.reference} · {p.timestamp}
                      {p.fee > 0 ? ` · £${p.fee.toFixed(2)} fee` : ' · Free Faster Pay'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[13.5px] font-extrabold text-[#05944F] tabular-nums">
                      {mask(`£${p.netAmount.toFixed(2)}`)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const summary = `Uber UK Driver Payout · Ref ${p.reference} · Net £${p.netAmount.toFixed(2)} to ${p.destinationLabel} (${p.timestamp})`;
                        void navigator.clipboard?.writeText(summary).catch(() => {});
                        setCopiedPayoutId(p.id);
                        setTimeout(() => setCopiedPayoutId((cur) => (cur === p.id ? null : cur)), 1600);
                      }}
                      className="w-8 h-8 rounded-lg bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center text-black dark:text-white"
                      aria-label="Copy payout statement"
                      title="Copy payout statement"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {copiedPayoutId && (
                <p className="text-[11px] font-semibold text-[#05944F]">
                  Payout statement copied to clipboard
                </p>
              )}
            </div>
          )}
        </div>

        {/* UK Worker Rights: 12.07% Holiday Pay & National Living Wage Comparison */}
        <div className="rounded-2xl border border-[#05944F]/25 bg-[#F2FBF6] dark:bg-emerald-950/25 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#05944F] text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-black dark:text-white truncate">
                  UK Worker Rights · 12.07% Holiday Pay
                </p>
                <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 truncate tabular-nums">
                  NLW Guarantee £{efficiencyStats.nlwRate.toFixed(2)}/hr · Accrued weekly pot
                </p>
              </div>
            </div>
            <span className="text-[18px] font-extrabold text-[#05944F] tabular-nums shrink-0">
              {mask(`£${holidayPayAccrued.toFixed(2)}`)}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[12px] tabular-nums">
            <div className="rounded-xl bg-white dark:bg-white/5 px-3 py-2 border border-black/5 dark:border-white/5">
              <p className="text-[#545454] dark:text-neutral-400">Engaged vs UK NLW</p>
              <p className="font-bold text-black dark:text-white">
                {mask(`£${efficiencyStats.perEngagedHr.toFixed(2)}/hr`)}{' '}
                <span className="text-[#05944F] text-[11px]">
                  ({efficiencyStats.nlwSurplusPct >= 0 ? `+${efficiencyStats.nlwSurplusPct}%` : `${efficiencyStats.nlwSurplusPct}%`})
                </span>
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-white/5 px-3 py-2 border border-black/5 dark:border-white/5">
              <p className="text-[#545454] dark:text-neutral-400">Claimed to Wallet</p>
              <p className="font-bold text-black dark:text-white">
                {mask(`£${holidayPayClaimedTotal.toFixed(2)}`)}
              </p>
            </div>
          </div>

          {onClaimHolidayPay && (
            <button
              type="button"
              disabled={holidayPayAccrued < 0.5}
              onClick={() => {
                uberSounds.play('cashOut');
                onClaimHolidayPay();
              }}
              className="w-full h-10 rounded-xl bg-[#05944F] hover:bg-[#047A40] disabled:opacity-40 text-white text-[13px] font-bold transition-colors tabular-nums"
            >
              {holidayPayAccrued >= 0.5
                ? `Claim ${mask(`£${holidayPayAccrued.toFixed(2)}`)} Holiday Pay to Wallet`
                : 'Complete trips to accrue Holiday Pay (min £0.50)'}
            </button>
          )}
        </div>

        {/* Weekly Efficiency Breakdown (£/Engaged Hr, £/Online Hr, £/Mile, Peak Split) */}
        <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181E] p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#E8F0FE] dark:bg-[#276EF1]/20 text-[#276EF1] flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[14px] font-bold text-black dark:text-white">
                  Weekly Efficiency Insights
                </p>
                <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 tabular-nums">
                  {efficiencyStats.engagedMin} engaged min logged across UK sessions
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
            <div className="rounded-xl bg-white dark:bg-white/5 p-2.5 border border-black/5 dark:border-white/5">
              <p className="text-[15px] font-extrabold text-black dark:text-white">
                {mask(`£${efficiencyStats.perEngagedHr.toFixed(2)}`)}
              </p>
              <p className="text-[10.5px] font-semibold text-[#545454] dark:text-neutral-400">
                / Engaged hr
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-white/5 p-2.5 border border-black/5 dark:border-white/5">
              <p className="text-[15px] font-extrabold text-black dark:text-white">
                {mask(`£${efficiencyStats.perOnlineHr.toFixed(2)}`)}
              </p>
              <p className="text-[10.5px] font-semibold text-[#545454] dark:text-neutral-400">
                / Online hr
              </p>
            </div>
            <div className="rounded-xl bg-white dark:bg-white/5 p-2.5 border border-black/5 dark:border-white/5">
              <p className="text-[15px] font-extrabold text-[#276EF1]">
                {mask(`£${efficiencyStats.perMile.toFixed(2)}`)}
              </p>
              <p className="text-[10.5px] font-semibold text-[#545454] dark:text-neutral-400">
                / Trip mile
              </p>
            </div>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11.5px] font-semibold text-[#545454] dark:text-neutral-400 tabular-nums">
              <span>Peak Rush & Night: {mask(`£${efficiencyStats.peakNet.toFixed(2)}`)}</span>
              <span>Off-Peak: {mask(`£${efficiencyStats.offPeakNet.toFixed(2)}`)}</span>
            </div>
            <div className="h-2 rounded-full bg-[#E6E6E6] dark:bg-white/10 overflow-hidden flex">
              <div
                className="h-full bg-[#276EF1] transition-all duration-500"
                style={{ width: `${efficiencyStats.peakSharePct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Recent Trips & Saved Daily History */}
        <div>
          <div className="flex items-center justify-between mb-2.5 gap-2">
            <h2 className="text-[18px] font-bold text-black dark:text-white">Completed trips</h2>
            {filteredTrips.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllTrips((v) => !v)}
                className="text-[13px] font-bold text-[#276EF1] hover:underline"
              >
                {showAllTrips ? 'Show less' : 'See all trips'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 mb-3">
            {(
              [
                { id: 'all', label: 'All saved' },
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTripDayFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors ${
                  tripDayFilter === f.id
                    ? 'bg-black dark:bg-[#276EF1] text-white'
                    : 'bg-[#F3F3F3] dark:bg-white/10 text-black dark:text-neutral-300 hover:bg-[#E5E5E5] dark:hover:bg-white/15'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {visibleTrips.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-[#D8D8D8] dark:border-white/15 bg-[#FAFAFA] dark:bg-[#16181E] text-center">
              <p className="text-[14px] font-bold text-black dark:text-white">
                {tripDayFilter === 'yesterday'
                  ? 'No trips logged yesterday'
                  : tripDayFilter === 'today'
                  ? 'No trips completed today yet'
                  : 'No trips completed yet'}
              </p>
              <p className="text-[12.5px] text-[#545454] dark:text-neutral-400 mt-1">
                Main screen earnings reset at midnight, while this page keeps every past day saved.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EEEEEE] dark:divide-white/10 border border-[#E6E6E6] dark:border-white/10 rounded-2xl bg-white dark:bg-[#16181E] overflow-hidden">
              {visibleTrips.map((trip) => {
                const isExpanded = expandedTripId === trip.id;
                const total = trip.fare + trip.tip + (trip.waitFee ?? 0) + (trip.claimAmount ?? 0);
                return (
                  <div
                    key={trip.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedTripId(isExpanded ? null : trip.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedTripId(isExpanded ? null : trip.id);
                      }
                    }}
                    className="w-full p-4 text-left hover:bg-[#FAFAFA] dark:hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-[15px] font-bold text-black dark:text-white truncate">
                            {trip.serviceName} · {trip.riderName}
                          </p>
                          {trip.paymentMethod === 'cash' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#05944F]/15 text-[#05944F] text-[10.5px] font-bold">
                              <Banknote className="w-3 h-3" />
                              Cash{trip.isMeteredFare ? ' · Metered' : ''}
                            </span>
                          )}
                          {trip.merchantName && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#E8F0FE] dark:bg-[#276EF1]/20 text-[#276EF1] dark:text-[#7AB0FF] text-[10.5px] font-bold">
                              <Store className="w-3 h-3" />
                              {trip.merchantName}
                            </span>
                          )}
                          {trip.isIntercity && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#7C3AED]/15 text-[#7C3AED] dark:text-[#C4B5FD] text-[10.5px] font-bold">
                              <Route className="w-3 h-3" />
                              Intercity
                            </span>
                          )}
                          {trip.isNoShowFee && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[#FFF3D6] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 text-[10.5px] font-bold">
                              No-Show Fee
                            </span>
                          )}
                          {trip.claimFiled && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F] text-[10.5px] font-bold">
                              <Sparkles className="w-3 h-3" />
                              {trip.claimIncidentLabel ||
                                (trip.claimFiled === 'valeting'
                                  ? 'Valeting Credited'
                                  : 'Fare Adjusted')}
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-[#545454] dark:text-neutral-400 truncate mt-0.5">
                          {trip.pickupArea} → {trip.dropoffArea}
                        </p>
                        <p className="text-[12px] text-[#757575] dark:text-neutral-500 flex items-center gap-1 mt-0.5 tabular-nums">
                          <Clock className="w-3 h-3" />
                          {formatDynamicTripTime(trip, todayKey, yesterdayKey)} · {trip.distanceMiles} mi
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[16px] font-extrabold text-black dark:text-white tabular-nums">
                          {mask(`£${total.toFixed(2)}`)}
                        </p>
                        {trip.tip > 0 && !privacyHidden && (
                          <p className="text-[11px] font-semibold text-[#05944F] tabular-nums">
                            +£{trip.tip.toFixed(2)} tip
                          </p>
                        )}
                      </div>
                    </div>

                    {isExpanded && !privacyHidden && (
                      <div className="mt-3 pt-2.5 border-t border-black/10 dark:border-white/10 text-[12px] space-y-1 text-[#545454] dark:text-neutral-400 tabular-nums">
                        <div className="flex justify-between">
                          <span>
                            {trip.isMeteredFare ? 'UK Metered Cash Fare' : 'Base + Distance Fare'}
                          </span>
                          <span className="text-black dark:text-white font-semibold">
                            £{trip.fare.toFixed(2)}
                          </span>
                        </div>
                        {(trip.waitFee ?? 0) > 0 && (
                          <div className="flex justify-between text-[#05944F]">
                            <span>Wait Time Bonus</span>
                            <span>+£{trip.waitFee!.toFixed(2)}</span>
                          </div>
                        )}
                        {(trip.claimAmount ?? 0) > 0 && (
                          <div className="flex justify-between text-[#05944F] font-semibold">
                            <span>
                              {trip.claimIncidentLabel ||
                                (trip.claimFiled === 'valeting'
                                  ? 'UK Valeting / Cleaning Payout'
                                  : 'Fare Review Adjustment')}
                            </span>
                            <span>+£{trip.claimAmount!.toFixed(2)}</span>
                          </div>
                        )}
                        {trip.claimPhotoName && (
                          <div className="flex items-center gap-1 text-[11px] text-[#276EF1]">
                            <Camera className="w-3 h-3" />
                            <span>Evidence attached: {trip.claimPhotoName}</span>
                          </div>
                        )}
                        {(trip.surchargeAmount ?? 0) > 0 && (
                          <div className="flex justify-between">
                            <span>{trip.surchargeLabel || 'UK Zone / Airport Fee'}</span>
                            <span>£{trip.surchargeAmount!.toFixed(2)}</span>
                          </div>
                        )}
                        {typeof trip.uberFee === 'number' && trip.uberFee > 0 && (
                          <div className="flex justify-between">
                            <span>Uber Service Fee (25%)</span>
                            <span>−£{trip.uberFee.toFixed(2)}</span>
                          </div>
                        )}
                        {trip.tags && trip.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {trip.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[10.5px] font-semibold text-black dark:text-neutral-200"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                        {onFileTripClaim && !trip.claimFiled && !trip.isNoShowFee && !trip.cancellationFee && (
                          <div
                            className="grid grid-cols-2 gap-2 pt-2.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setClaimPresetId('interior_spill');
                                setClaimPhotoName('');
                                setClaimNotes('');
                                setClaimModalTrip(trip);
                              }}
                              className="h-9 rounded-xl bg-[#FFF3D6] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 text-[11.5px] font-bold hover:opacity-90"
                            >
                              Incident / Cleaning Claim
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setClaimPresetId('fare_review');
                                setClaimPhotoName('');
                                setClaimNotes('');
                                setClaimModalTrip(trip);
                              }}
                              className="h-9 rounded-xl bg-[#E8F0FE] dark:bg-[#276EF1]/20 text-[#276EF1] dark:text-[#7AB0FF] text-[11.5px] font-bold hover:opacity-90"
                            >
                              Fare / Toll Review
                            </button>
                          </div>
                        )}
                        {onShareTripReceipt && (
                          <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => onShareTripReceipt(trip)}
                              className="w-full h-9 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E8E8E8] dark:hover:bg-white/15 text-black dark:text-white text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <Share2 className="w-3.5 h-3.5 text-[#276EF1]" />
                              <span>Share UK Receipt (Share Sheet)</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cash Out Modal */}
      {showCashOutModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#141416] w-full sm:max-w-[400px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[20px] font-bold text-black dark:text-white">Cash out</h3>
              <button
                type="button"
                onClick={() => setShowCashOutModal(false)}
                className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center"
                aria-label="Close cash out"
              >
                <X className="w-4 h-4 text-black dark:text-white" />
              </button>
            </div>

            {cashOutDone ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-[#05944F] mx-auto" />
                <p className="text-[17px] font-bold text-black dark:text-white">Transfer initiated</p>
                <p className="text-[13px] text-[#545454] dark:text-neutral-400">{cashOutDone}</p>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-[#F6F6F6] dark:bg-white/5 mb-4">
                  <p className="text-[13px] text-[#545454] dark:text-neutral-400">Available balance</p>
                  <p className="text-[30px] font-extrabold text-black dark:text-white tabular-nums">
                    {mask(`£${walletBalance.toFixed(2)}`)}
                  </p>
                </div>

                <div className="space-y-2 mb-5">
                  <button
                    type="button"
                    onClick={() => setCashOutMethod('instant')}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-colors ${
                      cashOutMethod === 'instant'
                        ? 'border-black dark:border-[#276EF1] bg-[#F9F9F9] dark:bg-[#1D2230]'
                        : 'border-[#EEEEEE] dark:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-bold text-black dark:text-white">
                        Instant Pay · UK Visa •• 4821
                      </span>
                      <span className="text-[13px] font-semibold text-[#545454] dark:text-neutral-400">
                        £1.25 fee
                      </span>
                    </div>
                    <p className="text-[12px] text-[#545454] dark:text-neutral-400 mt-0.5">
                      Arrives within minutes
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCashOutMethod('bank')}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-colors ${
                      cashOutMethod === 'bank'
                        ? 'border-black dark:border-[#276EF1] bg-[#F9F9F9] dark:bg-[#1D2230]'
                        : 'border-[#EEEEEE] dark:border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-bold text-black dark:text-white">
                        Faster Payments · •• 9014
                      </span>
                      <span className="text-[13px] font-semibold text-[#05944F]">Free</span>
                    </div>
                    <p className="text-[12px] text-[#545454] dark:text-neutral-400 mt-0.5">
                      1–2 hours · UK Bank
                    </p>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={walletBalance <= 0}
                  onClick={handleConfirmCashOut}
                  className="w-full h-12 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[15px] font-bold disabled:opacity-40 transition-colors"
                >
                  {walletBalance > 0
                    ? `Cash out £${(
                        walletBalance - (cashOutMethod === 'instant' ? 1.25 : 0)
                      ).toFixed(2)}`
                    : 'No balance to cash out'}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Incident, Valeting & Toll Claim Modal with Photo Evidence Upload */}
      {claimModalTrip && onFileTripClaim && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white dark:bg-[#141416] w-full sm:max-w-[420px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10 max-h-[88vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[19px] font-extrabold text-black dark:text-white">
                  File Insurance / Cleaning Claim
                </h3>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                  {claimModalTrip.serviceName} · {claimModalTrip.riderName} ({claimModalTrip.pickupArea})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setClaimModalTrip(null)}
                className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center"
                aria-label="Close claim modal"
              >
                <X className="w-4 h-4 text-black dark:text-white" />
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[#545454] dark:text-neutral-400">
                Select UK PHV Claim Category
              </p>
              {CLAIM_PRESETS.map((preset) => {
                const selected = claimPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setClaimPresetId(preset.id)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-colors ${
                      selected
                        ? 'border-black dark:border-[#276EF1] bg-[#F5F8FF] dark:bg-[#1D2230]'
                        : 'border-black/10 dark:border-white/10 bg-white dark:bg-white/5'
                    }`}
                  >
                    <div>
                      <p className="text-[13px] font-bold text-black dark:text-white">
                        {preset.label}
                      </p>
                      <p className="text-[11px] text-[#545454] dark:text-neutral-400">
                        {preset.subtitle}
                      </p>
                    </div>
                    <span className="text-[13.5px] font-extrabold text-[#05944F] tabular-nums">
                      +£{preset.amount.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#545454] dark:text-neutral-400 mb-1.5">
                Photo Evidence (Optional)
              </label>
              <label className="w-full h-11 px-3 rounded-xl border border-dashed border-black/20 dark:border-white/20 bg-[#FAFAFA] dark:bg-white/5 flex items-center justify-between gap-2 cursor-pointer text-[12px] font-semibold text-black dark:text-white">
                <span className="flex items-center gap-2 truncate">
                  <Camera className="w-4 h-4 text-[#276EF1] shrink-0" />
                  <span className="truncate">
                    {claimPhotoName || 'Attach vehicle / receipt photo (JPG/PNG)'}
                  </span>
                </span>
                <span className="text-[#276EF1] font-bold shrink-0">Choose</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setClaimPhotoName(f.name);
                  }}
                />
              </label>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#545454] dark:text-neutral-400 mb-1.5">
                Incident / Toll Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={claimNotes}
                onChange={(e) => setClaimNotes(e.target.value)}
                placeholder="e.g. Rear seat spill after Soho pickup, photo taken prior to valeting"
                className="w-full px-3 py-2 rounded-xl border border-black/15 dark:border-white/15 bg-white dark:bg-white/5 text-[12.5px] text-black dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#276EF1]"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                const chosen =
                  CLAIM_PRESETS.find((p) => p.id === claimPresetId) ?? CLAIM_PRESETS[0];
                onFileTripClaim(claimModalTrip.id, chosen.kind, {
                  amount: chosen.amount,
                  incidentLabel: chosen.label,
                  photoName: claimPhotoName || undefined,
                  notes: claimNotes.trim() || undefined,
                });
                setClaimModalTrip(null);
              }}
              className="w-full h-12 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[14.5px] font-bold transition-colors"
            >
              Submit Claim (+£
              {(
                CLAIM_PRESETS.find((p) => p.id === claimPresetId)?.amount ?? 40
              ).toFixed(2)}
              )
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
