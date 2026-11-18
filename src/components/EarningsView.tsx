import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  MoreHorizontal,
  Trophy,
  X,
} from 'lucide-react';
import { CompletedTrip } from '../types/driver';
import { formatWeekRangeLabel, getCurrentWeekDays } from '../utils/earningsStorage';
import { uberSounds } from '../utils/uberSounds';

interface EarningsViewProps {
  weeklyEarnings: number;
  todayEarnings: number;
  walletBalance: number;
  dailyTotals: Record<string, number>;
  completedTrips: CompletedTrip[];
  questCompletedCount: number;
  privacyHidden: boolean;
  onTogglePrivacy: () => void;
  onBack: () => void;
  onCashOut: (amount: number, method: 'instant' | 'bank') => void;
  onOpenOpportunities: () => void;
}

export const EarningsView: React.FC<EarningsViewProps> = ({
  weeklyEarnings,
  todayEarnings,
  walletBalance,
  dailyTotals,
  completedTrips,
  questCompletedCount,
  privacyHidden,
  onTogglePrivacy,
  onBack,
  onCashOut,
  onOpenOpportunities,
}) => {
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [cashOutMethod, setCashOutMethod] = useState<'instant' | 'bank'>('instant');
  const [cashOutDone, setCashOutDone] = useState<string | null>(null);
  const [showAllTrips, setShowAllTrips] = useState(false);

  const weekDays = useMemo(() => {
    return getCurrentWeekDays().map((d) => ({
      ...d,
      amount: dailyTotals[d.dateKey] ?? 0,
    }));
  }, [dailyTotals]);

  const todayIdx = Math.max(
    0,
    weekDays.findIndex((d) => d.isToday)
  );
  const [selectedDayIdx, setSelectedDayIdx] = useState<number>(todayIdx);

  const maxDayAmount = Math.max(...weekDays.map((d) => d.amount), 25);
  const weekRangeLabel = useMemo(() => formatWeekRangeLabel(), []);

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

  const visibleTrips = showAllTrips ? completedTrips : completedTrips.slice(0, 6);
  const selectedDay = weekDays[selectedDayIdx] || weekDays[todayIdx];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white pb-6">
      <div className="px-5 pt-15 lg:pt-6 pb-4 flex items-center justify-between gap-3 max-w-[680px] mx-auto">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] active:scale-95 flex items-center justify-center transition-all shrink-0"
            aria-label="Back to Map"
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>
          <h1 className="text-[32px] font-extrabold tracking-tight text-black">
            Earnings
          </h1>
        </div>

        <button
          type="button"
          onClick={onTogglePrivacy}
          className="h-10 px-3.5 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] active:scale-95 flex items-center gap-1.5 text-[13px] font-bold text-black transition-all"
          aria-label={privacyHidden ? 'Show earnings amounts' : 'Hide earnings amounts'}
        >
          {privacyHidden ? (
            <>
              <EyeOff className="w-4 h-4 text-black" />
              <span>Hidden</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 text-black" />
              <span>Privacy</span>
            </>
          )}
        </button>
      </div>

      <div className="px-5 space-y-5 max-w-[680px] mx-auto">
        {/* Weekly Earnings Card */}
        <div className="rounded-2xl border border-[#E6E6E6] bg-white p-5 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[14px] font-medium text-[#545454]">{weekRangeLabel}</p>
              <p className="text-[36px] font-extrabold tracking-tight text-black mt-0.5 tabular-nums">
                {mask(`£${weeklyEarnings.toFixed(2)}`)}
              </p>
              <div className="mt-2 inline-flex items-center gap-1.5 bg-[#05944F] text-white text-[13px] font-bold px-2.5 py-1 rounded-md tabular-nums">
                <span>{mask(`£${todayEarnings.toFixed(2)}`)} today</span>
                <span className="text-white/75 text-[11px] font-semibold">· Resets 00:00</span>
              </div>
            </div>
            <div className="text-right text-[12px] text-[#545454] tabular-nums">
              <p className="font-semibold text-black">
                {completedTrips.length} {completedTrips.length === 1 ? 'trip' : 'trips'} saved
              </p>
              <p>Real daily ledger</p>
            </div>
          </div>

          {/* Interactive 7-day real earnings bar breakdown */}
          <div className="mt-6 pt-4 border-t border-[#F0F0F0]">
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
                            ? 'bg-black/80 group-hover:bg-black'
                            : 'bg-[#EEEEEE]'
                        }`}
                      />
                    </div>
                    <span
                      className={`text-[11px] font-semibold ${
                        isSelected
                          ? 'text-[#276EF1]'
                          : d.isToday
                          ? 'text-black font-bold'
                          : 'text-[#6B6B6B]'
                      }`}
                    >
                      {d.day}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-[13px] text-[#545454] tabular-nums">
              <span>
                {selectedDay.day} ({selectedDay.isToday ? 'Today' : selectedDay.dateKey}) real total
              </span>
              <span className="font-bold text-black">
                {mask(`£${selectedDay.amount.toFixed(2)}`)}
              </span>
            </div>
          </div>
        </div>

        {/* My Money Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[22px] font-extrabold tracking-tight text-black">
              My money
            </h2>
            <button
              type="button"
              onClick={() => setShowCashOutModal(true)}
              className="w-9 h-9 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors"
              aria-label="Open wallet cash out"
            >
              <ArrowRight className="w-4 h-4 text-black" />
            </button>
          </div>

          <div className="rounded-2xl border border-[#E6E6E6] bg-white p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[14px] font-medium text-[#545454]">Total balance</p>
                <p className="text-[32px] font-extrabold tracking-tight text-black mt-0.5 tabular-nums">
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
                className="w-10 h-10 rounded-xl bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors"
                aria-label="Wallet options"
              >
                <MoreHorizontal className="w-5 h-5 text-black" />
              </button>
            </div>

            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                disabled={walletBalance <= 0}
                onClick={() => setShowCashOutModal(true)}
                className="px-5 h-10 rounded-full bg-black text-white text-[14px] font-bold hover:bg-neutral-800 disabled:opacity-40 transition-colors"
              >
                Cash out
              </button>
              <button
                type="button"
                onClick={() => setShowCashOutModal(true)}
                className="px-4 h-10 rounded-full bg-[#F3F3F3] text-black text-[14px] font-semibold hover:bg-[#E5E5E5] transition-colors"
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
          className="w-full rounded-2xl border border-[#E6E6E6] bg-[#FAFAFA] hover:bg-[#F3F3F3] p-4 flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-black">
                Quest: {Math.min(questCompletedCount, 20)} / 20 trips
              </p>
              <p className="text-[13px] text-[#545454] truncate">
                {questCompletedCount >= 20
                  ? 'Quest completed! +£190 earned'
                  : `Drive ${20 - questCompletedCount} more trips to make £190 extra`}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#545454] shrink-0" />
        </button>

        {/* Recent Trips & Real Daily Activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[18px] font-bold text-black">Completed trips</h2>
            {completedTrips.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllTrips((v) => !v)}
                className="text-[13px] font-bold text-[#276EF1] hover:underline"
              >
                {showAllTrips ? 'Show less' : 'See all trips'}
              </button>
            )}
          </div>

          {visibleTrips.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-[#D8D8D8] bg-[#FAFAFA] text-center">
              <p className="text-[14px] font-bold text-black">No trips completed today yet</p>
              <p className="text-[12.5px] text-[#545454] mt-1">
                Go online and complete a ride — your real earnings save automatically until midnight.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#EEEEEE] border border-[#E6E6E6] rounded-2xl bg-white overflow-hidden">
              {visibleTrips.map((trip) => (
                <div key={trip.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-black truncate">
                      {trip.serviceName} · {trip.riderName}
                    </p>
                    <p className="text-[12px] text-[#545454] truncate mt-0.5">
                      {trip.pickupArea} → {trip.dropoffArea}
                    </p>
                    <p className="text-[12px] text-[#757575] flex items-center gap-1 mt-0.5 tabular-nums">
                      <Clock className="w-3 h-3" />
                      {trip.completedAt} · {trip.distanceMiles} mi
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[16px] font-extrabold text-black tabular-nums">
                      {mask(`£${(trip.fare + trip.tip).toFixed(2)}`)}
                    </p>
                    {trip.tip > 0 && !privacyHidden && (
                      <p className="text-[11px] font-semibold text-[#05944F] tabular-nums">
                        +£{trip.tip.toFixed(2)} tip
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cash Out Modal */}
      {showCashOutModal && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-[400px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[20px] font-bold text-black">Cash out</h3>
              <button
                type="button"
                onClick={() => setShowCashOutModal(false)}
                className="w-9 h-9 rounded-full bg-[#F3F3F3] flex items-center justify-center"
                aria-label="Close cash out"
              >
                <X className="w-4 h-4 text-black" />
              </button>
            </div>

            {cashOutDone ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-[#05944F] mx-auto" />
                <p className="text-[17px] font-bold text-black">Transfer initiated</p>
                <p className="text-[13px] text-[#545454]">{cashOutDone}</p>
              </div>
            ) : (
              <>
                <div className="p-4 rounded-2xl bg-[#F6F6F6] mb-4">
                  <p className="text-[13px] text-[#545454]">Available balance</p>
                  <p className="text-[30px] font-extrabold text-black tabular-nums">
                    {mask(`£${walletBalance.toFixed(2)}`)}
                  </p>
                </div>

                <div className="space-y-2 mb-5">
                  <button
                    type="button"
                    onClick={() => setCashOutMethod('instant')}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-colors ${
                      cashOutMethod === 'instant'
                        ? 'border-black bg-[#F9F9F9]'
                        : 'border-[#EEEEEE]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-bold text-black">
                        Instant Pay · UK Visa •• 4821
                      </span>
                      <span className="text-[13px] font-semibold text-[#545454]">£1.25 fee</span>
                    </div>
                    <p className="text-[12px] text-[#545454] mt-0.5">Arrives within minutes</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCashOutMethod('bank')}
                    className={`w-full p-3.5 rounded-2xl border text-left transition-colors ${
                      cashOutMethod === 'bank'
                        ? 'border-black bg-[#F9F9F9]'
                        : 'border-[#EEEEEE]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-bold text-black">
                        Faster Payments · •• 9014
                      </span>
                      <span className="text-[13px] font-semibold text-[#05944F]">Free</span>
                    </div>
                    <p className="text-[12px] text-[#545454] mt-0.5">1–2 hours · UK Bank</p>
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
    </div>
  );
};
