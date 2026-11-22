import React, { useMemo, useState } from 'react';
import {
  Car,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Package,
  PawPrint,
  RotateCcw,
  Route,
  XCircle,
} from 'lucide-react';
import { CompletedTrip, TripActivityEntry, TripStats } from '../types/driver';

interface TripsMenuViewProps {
  tripStats: TripStats;
  completedTrips: CompletedTrip[];
  privacyHidden: boolean;
  onResetStats: () => void;
  onBack: () => void;
}

type TripsFilter = 'all' | 'accepted' | 'declined';

export const TripsMenuView: React.FC<TripsMenuViewProps> = ({
  tripStats,
  completedTrips,
  privacyHidden,
  onResetStats,
  onBack,
}) => {
  const [filter, setFilter] = useState<TripsFilter>('all');
  const [confirmReset, setConfirmReset] = useState(false);

  const decidedTotal = tripStats.accepted + tripStats.declined;
  const acceptanceRatePct =
    decidedTotal > 0 ? Math.round((tripStats.accepted / decidedTotal) * 100) : 0;
  const declineRatePct =
    decidedTotal > 0 ? Math.round((tripStats.declined / decidedTotal) * 100) : 0;

  const totalEarnedFromTrips = useMemo(
    () =>
      Number(
        completedTrips
          .reduce((sum, trip) => sum + trip.fare + trip.tip + (trip.waitFee ?? 0), 0)
          .toFixed(2)
      ),
    [completedTrips]
  );

  const filteredHistory = useMemo(() => {
    if (filter === 'accepted') {
      return tripStats.history.filter((h) => h.status === 'accepted');
    }
    if (filter === 'declined') {
      return tripStats.history.filter((h) => h.status === 'declined' || h.status === 'radar_lost');
    }
    return tripStats.history;
  }, [tripStats.history, filter]);

  const renderServiceIcon = (serviceName: string) => {
    if (serviceName === 'Uber Eats') {
      return <Package className="w-4 h-4 text-black dark:text-white" />;
    }
    if (serviceName === 'Uber Pet') {
      return <PawPrint className="w-4 h-4 text-black dark:text-white" />;
    }
    if (serviceName.toLowerCase().includes('intercity')) {
      return <Route className="w-4 h-4 text-[#7C3AED]" />;
    }
    return <Car className="w-4 h-4 text-black dark:text-white" />;
  };

  const renderStatusLabel = (entry: TripActivityEntry) => {
    if (entry.status === 'accepted') {
      return (
        <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#05944F]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Accepted
        </span>
      );
    }
    if (entry.status === 'radar_lost') {
      return (
        <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#D97706] dark:text-amber-300">
          <Clock className="w-3.5 h-3.5" />
          Radar Taken
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#E11900]">
        <XCircle className="w-3.5 h-3.5" />
        Declined
      </span>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-[#0E0F12] overflow-hidden">
      {/* Top Bar */}
      <div className="px-4 pt-15 lg:pt-4 pb-3.5 border-b border-[#EEEEEE] dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-11 h-11 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 active:scale-95 flex items-center justify-center transition-all"
            aria-label="Back"
          >
            <ChevronLeft className="w-6 h-6 text-black dark:text-white" />
          </button>
          <div>
            <h1 className="text-[19px] font-extrabold text-black dark:text-white leading-tight">
              Trips
            </h1>
            <p className="text-[12px] text-[#545454] dark:text-neutral-400">
              Job requests, accepts & declines
            </p>
          </div>
        </div>

        {tripStats.totalReceived > 0 && (
          confirmReset ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="px-3 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 text-[12px] font-bold text-black dark:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmReset(false);
                  onResetStats();
                }}
                className="px-3 h-9 rounded-full bg-[#E11900] text-white text-[12px] font-bold"
              >
                Confirm
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="px-3 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-[12px] font-bold text-black dark:text-white flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 max-w-[600px] w-full mx-auto">
        {/* 3 Primary Trip Counters: Received, Accepted, Declined */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-3.5 rounded-2xl bg-[#F6F6F6] dark:bg-[#16181D] border border-black/5 dark:border-white/10">
            <p className="text-[11.5px] font-semibold text-[#545454] dark:text-neutral-400">
              Total Received
            </p>
            <p className="text-[28px] font-extrabold text-black dark:text-white tabular-nums mt-1 leading-none">
              {tripStats.totalReceived}
            </p>
            <p className="text-[11px] text-[#545454] dark:text-neutral-400 mt-1.5">
              Jobs offered
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#E6F4EA]/75 dark:bg-emerald-950/35 border border-[#05944F]/20">
            <p className="text-[11.5px] font-semibold text-[#05944F]">
              Accepted
            </p>
            <p className="text-[28px] font-extrabold text-[#05944F] tabular-nums mt-1 leading-none">
              {tripStats.accepted}
            </p>
            <p className="text-[11px] text-[#05944F]/80 tabular-nums mt-1.5">
              {decidedTotal > 0 ? `${acceptanceRatePct}% accept rate` : '0% accept rate'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#FEECEB]/80 dark:bg-red-950/35 border border-[#E11900]/20">
            <p className="text-[11.5px] font-semibold text-[#E11900]">
              Declined
            </p>
            <p className="text-[28px] font-extrabold text-[#E11900] tabular-nums mt-1 leading-none">
              {tripStats.declined}
            </p>
            <p className="text-[11px] text-[#E11900]/80 tabular-nums mt-1.5">
              {decidedTotal > 0 ? `${declineRatePct}% declined` : '0% declined'}
            </p>
          </div>
        </div>

        {/* Acceptance Breakdown & Completed Summary */}
        <div className="p-4 rounded-2xl bg-[#FAFAFA] dark:bg-[#16181D] border border-[#E6E6E6] dark:border-white/10 space-y-2.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-bold text-black dark:text-white">Acceptance Breakdown</span>
            <span className="font-extrabold text-black dark:text-white tabular-nums">
              {tripStats.accepted} accepted · {tripStats.declined} declined
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-[#E6E6E6] dark:bg-white/10 overflow-hidden flex">
            {decidedTotal > 0 ? (
              <>
                <div
                  className="h-full bg-[#05944F] transition-all"
                  style={{ width: `${acceptanceRatePct}%` }}
                />
                <div
                  className="h-full bg-[#E11900] transition-all"
                  style={{ width: `${100 - acceptanceRatePct}%` }}
                />
              </>
            ) : (
              <div className="h-full w-0" />
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[#545454] dark:text-neutral-400 tabular-nums">
            <span>Completed: {completedTrips.length}</span>
            <span aria-hidden="true">·</span>
            <span>
              Trip total: {privacyHidden ? '£••••' : `£${totalEarnedFromTrips.toFixed(2)}`}
            </span>
            {tripStats.radarLost > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span>Radar taken by others: {tripStats.radarLost}</span>
              </>
            )}
          </div>
        </div>

        {/* Filter Segmented Control */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F3F3F3] dark:bg-white/10">
          {(
            [
              { id: 'all', label: `All (${tripStats.history.length})` },
              { id: 'accepted', label: `Accepted (${tripStats.accepted})` },
              {
                id: 'declined',
                label: `Declined (${tripStats.declined})`,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`h-9 rounded-lg text-[12.5px] font-bold transition-colors tabular-nums ${
                filter === tab.id
                  ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
                  : 'text-[#545454] dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Trip Activity Feed */}
        {filteredHistory.length === 0 ? (
          <div className="p-6 rounded-2xl bg-[#FAFAFA] dark:bg-[#16181D] border border-[#EEEEEE] dark:border-white/10 text-center space-y-1.5">
            <p className="text-[14px] font-bold text-black dark:text-white">
              {tripStats.totalReceived === 0
                ? 'No trip requests received yet'
                : `No ${filter} trips recorded yet`}
            </p>
            <p className="text-[12.5px] text-[#545454] dark:text-neutral-400">
              Go online to receive Exclusive and Trip Radar requests — every accept and decline is tracked here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#EEEEEE] dark:divide-white/10 border-t border-b border-[#EEEEEE] dark:border-white/10">
            {filteredHistory.map((entry) => {
              const typeLabel =
                entry.offerType === 'radar'
                  ? 'Trip Radar'
                  : entry.offerType === 'queued'
                  ? 'Queued Next'
                  : entry.offerType === 'reserve'
                  ? 'Reserve'
                  : 'Exclusive';
              return (
                <div
                  key={entry.id}
                  className="py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center shrink-0">
                      {renderServiceIcon(entry.serviceName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-black dark:text-white truncate">
                        {entry.serviceName} · {entry.pickupArea} → {entry.dropoffArea}
                      </p>
                      <div className="flex items-center gap-1.5 text-[12px] text-[#545454] dark:text-neutral-400 mt-0.5 tabular-nums">
                        <span>{typeLabel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{entry.timestamp}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 tabular-nums">
                    <p className="text-[14px] font-extrabold text-black dark:text-white">
                      {privacyHidden ? '£••' : `£${entry.fare.toFixed(2)}`}
                    </p>
                    <div className="mt-0.5">{renderStatusLabel(entry)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
