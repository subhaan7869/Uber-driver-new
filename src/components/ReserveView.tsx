import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  ChevronLeft,
  Clock,
  Navigation,
  Plane,
  RefreshCw,
  Star,
  Trash2,
} from 'lucide-react';
import { ReserveCategory, ReserveTrip } from '../types/driver';

interface ReserveViewProps {
  localCity: string;
  availableReserves: ReserveTrip[];
  scheduledReserves: ReserveTrip[];
  onAcceptReserve: (trip: ReserveTrip) => void;
  onCancelReserve: (tripId: string) => void;
  onStartReserveTrip: (trip: ReserveTrip) => void;
  onRefreshReserves: () => void;
  onBack: () => void;
}

export const ReserveView: React.FC<ReserveViewProps> = ({
  localCity,
  availableReserves,
  scheduledReserves,
  onAcceptReserve,
  onCancelReserve,
  onStartReserveTrip,
  onRefreshReserves,
  onBack,
}) => {
  const [subTab, setSubTab] = useState<'available' | 'scheduled'>(
    scheduledReserves.length > 0 ? 'scheduled' : 'available'
  );
  const [categoryFilter, setCategoryFilter] = useState<'all' | ReserveCategory>('all');
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);

  const filteredAvailable = useMemo(() => {
    if (categoryFilter === 'all') return availableReserves;
    return availableReserves.filter((r) => r.category === categoryFilter);
  }, [availableReserves, categoryFilter]);

  const scheduledTotalGbp = useMemo(
    () => scheduledReserves.reduce((sum, item) => sum + item.estimatedFare, 0),
    [scheduledReserves]
  );

  const formatHourlyEst = (trip: ReserveTrip) => {
    const totalHours = Math.max(0.25, (trip.pickupMinutes + trip.tripMinutes) / 60);
    return Math.round(trip.estimatedFare / totalHours);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-[#0E0F12] overflow-hidden">
      {/* Top App Bar */}
      <div className="px-5 pt-15 lg:pt-5 pb-3 border-b border-[#EEEEEE] dark:border-white/10 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="w-11 h-11 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 active:scale-95 flex items-center justify-center transition-all shrink-0"
            aria-label="Back to Map"
          >
            <ChevronLeft className="w-6 h-6 text-black dark:text-white" />
          </button>
          <div className="min-w-0">
            <h1 className="text-[18px] font-extrabold text-black dark:text-white truncate">
              Uber Reserve
            </h1>
            <p className="text-[12px] text-[#545454] dark:text-neutral-400 truncate">
              Pre-booked rides around {localCity}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onRefreshReserves}
          className="h-11 px-3.5 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-[12.5px] font-bold text-black dark:text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-95 transition-all"
          aria-label="Refresh Reserve requests"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Sub-Tabs & Category Filters */}
      <div className="px-5 pt-3.5 pb-3 border-b border-[#EEEEEE] dark:border-white/10 shrink-0">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F3F3F3] dark:bg-white/10 rounded-xl">
            <button
              type="button"
              onClick={() => setSubTab('available')}
              className={`min-h-[44px] rounded-lg text-[13.5px] font-bold transition-colors whitespace-nowrap px-3 tabular-nums ${
                subTab === 'available'
                  ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
                  : 'text-[#545454] dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }`}
            >
              Available ({availableReserves.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('scheduled')}
              className={`min-h-[44px] rounded-lg text-[13.5px] font-bold transition-colors whitespace-nowrap px-3 tabular-nums ${
                subTab === 'scheduled'
                  ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
                  : 'text-[#545454] dark:text-neutral-400 hover:text-black dark:hover:text-white'
              }`}
            >
              Scheduled ({scheduledReserves.length})
            </button>
          </div>

          {subTab === 'available' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
              {(
                [
                  { id: 'all', label: 'All Trips' },
                  { id: 'airport', label: 'Airport' },
                  { id: 'local', label: 'Local' },
                  { id: 'executive', label: 'Executive' },
                ] as const
              ).map((item) => {
                const active = categoryFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setCategoryFilter(item.id)}
                    className={`min-h-[40px] px-4 rounded-lg text-[12.5px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                      active
                        ? 'bg-black dark:bg-[#276EF1] text-white'
                        : 'bg-[#F3F3F3] dark:bg-white/10 text-[#545454] dark:text-neutral-300 hover:bg-[#E7E7E7] dark:hover:bg-white/15'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Scrollable Feed */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="max-w-5xl mx-auto space-y-4">
          {subTab === 'scheduled' && scheduledReserves.length > 0 && (
            <div className="p-4 rounded-2xl border border-[#276EF1]/25 bg-[#F4F8FF] dark:bg-[#192338] flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12.5px] font-semibold text-[#545454] dark:text-neutral-300">
                  Locked-in Reserve Earnings ({scheduledReserves.length}{' '}
                  {scheduledReserves.length === 1 ? 'trip' : 'trips'})
                </p>
                <p className="text-[24px] font-extrabold text-black dark:text-white tabular-nums leading-tight mt-0.5">
                  £{scheduledTotalGbp.toFixed(2)}
                </p>
              </div>
              <p className="text-[12px] text-[#545454] dark:text-neutral-300 max-w-xs">
                Go online 40 min before pickup to lock your reservation and avoid reassignment.
              </p>
            </div>
          )}

          {subTab === 'available' ? (
            filteredAvailable.length === 0 ? (
              <div className="p-8 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center mx-auto">
                  <CalendarClock className="w-6 h-6 text-[#545454] dark:text-neutral-300" />
                </div>
                <p className="text-[16px] font-bold text-black dark:text-white">
                  No matching Reserve trips right now
                </p>
                <p className="text-[13px] text-[#545454] dark:text-neutral-400">
                  Switch filter or refresh to load new pre-booked requests around {localCity}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('all');
                    onRefreshReserves();
                  }}
                  className="min-h-[44px] px-5 rounded-xl bg-black dark:bg-[#276EF1] text-white text-[13.5px] font-bold hover:opacity-90 transition-opacity"
                >
                  Refresh Local Requests
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAvailable.map((trip) => (
                  <div
                    key={trip.id}
                    className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      {/* Header metadata & Guaranteed Fare */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#276EF1] tabular-nums">
                            {trip.category === 'airport' ? (
                              <Plane className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{trip.dayLabel}, {trip.timeLabel}</span>
                          </div>
                          <h2 className="text-[16px] font-extrabold text-black dark:text-white mt-0.5 truncate">
                            {trip.serviceName}
                          </h2>
                          <p className="text-[12px] text-[#545454] dark:text-neutral-400 tabular-nums mt-0.5">
                            {trip.riderName} · {trip.rating.toFixed(2)}{' '}
                            <Star className="w-3 h-3 inline -mt-0.5 fill-current text-[#FFC043]" /> · Online by {trip.onlineByLabel}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-[24px] font-extrabold text-black dark:text-white tabular-nums leading-none">
                            £{trip.estimatedFare.toFixed(2)}
                          </p>
                          <p className="text-[11.5px] font-semibold text-[#05944F] tabular-nums mt-1">
                            +£{trip.reserveFee.toFixed(2)} fee incl.
                          </p>
                        </div>
                      </div>

                      {/* Route Timeline */}
                      <div className="pt-2.5 border-t border-[#EAEAEA] dark:border-white/10 flex gap-3">
                        <div className="flex flex-col items-center pt-1.5 shrink-0">
                          <span className="w-2.5 h-2.5 bg-black dark:bg-white rounded-[2px]" />
                          <span className="w-[1.5px] flex-1 bg-[#D4D4D4] dark:bg-white/20 my-1 min-h-[22px]" />
                          <span className="w-2.5 h-2.5 border-2 border-black dark:border-white bg-white dark:bg-[#16181D] rounded-[2px]" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2.5">
                          <div>
                            <p className="text-[13.5px] font-bold text-black dark:text-white truncate">
                              {trip.pickupAddress}
                            </p>
                            <p className="text-[12px] text-[#545454] dark:text-neutral-400 tabular-nums truncate">
                              {trip.pickupArea} · {trip.pickupMinutes} min ({trip.pickupMiles} mi away)
                            </p>
                          </div>
                          <div>
                            <p className="text-[13.5px] font-bold text-black dark:text-white truncate">
                              {trip.dropoffAddress}
                            </p>
                            <p className="text-[12px] text-[#545454] dark:text-neutral-400 tabular-nums truncate">
                              {trip.dropoffArea} · {trip.tripMinutes} min ({trip.tripMiles} mi) · ~£{formatHourlyEst(trip)}/hr
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Flight / Wait note */}
                      <p className="text-[12px] text-[#545454] dark:text-neutral-400 tabular-nums">
                        {trip.flightNumber ? `Flight ${trip.flightNumber} · ` : ''}
                        {trip.waitIncludedMin} min wait time included
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onAcceptReserve(trip);
                        setSubTab('scheduled');
                      }}
                      className="w-full min-h-[44px] rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[14px] font-bold flex items-center justify-center gap-2 transition-colors active:scale-[0.98] whitespace-nowrap"
                    >
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Accept Reserve</span>
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : scheduledReserves.length === 0 ? (
            <div className="p-8 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 text-[#545454] dark:text-neutral-300" />
              </div>
              <p className="text-[16px] font-bold text-black dark:text-white">
                No scheduled Reserve trips yet
              </p>
              <p className="text-[13px] text-[#545454] dark:text-neutral-400 max-w-sm mx-auto">
                Lock in guaranteed-fare trips in advance from the Available tab.
              </p>
              <button
                type="button"
                onClick={() => setSubTab('available')}
                className="min-h-[44px] px-5 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[13.5px] font-bold transition-colors"
              >
                Browse Available Trips
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scheduledReserves.map((trip) => {
                const isConfirmingCancel = confirmCancelId === trip.id;
                return (
                  <div
                    key={trip.id}
                    className="p-4 rounded-2xl border border-[#05944F]/30 bg-white dark:bg-[#16181D] flex flex-col justify-between gap-4 shadow-xs"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-[12px] font-bold text-[#05944F] tabular-nums">
                            <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                            <span>Confirmed · {trip.dayLabel}, {trip.timeLabel}</span>
                          </div>
                          <h2 className="text-[16px] font-extrabold text-black dark:text-white mt-0.5 truncate">
                            {trip.serviceName}
                          </h2>
                          <p className="text-[12px] text-[#545454] dark:text-neutral-400 tabular-nums mt-0.5">
                            {trip.riderName} · Go online by {trip.onlineByLabel}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-[24px] font-extrabold text-black dark:text-white tabular-nums leading-none">
                            £{trip.estimatedFare.toFixed(2)}
                          </p>
                          <p className="text-[11.5px] font-semibold text-[#545454] dark:text-neutral-400 tabular-nums mt-1">
                            {trip.tripMiles} mi · {trip.tripMinutes} min
                          </p>
                        </div>
                      </div>

                      <div className="pt-2.5 border-t border-[#EAEAEA] dark:border-white/10 flex gap-3">
                        <div className="flex flex-col items-center pt-1.5 shrink-0">
                          <span className="w-2.5 h-2.5 bg-black dark:bg-white rounded-[2px]" />
                          <span className="w-[1.5px] flex-1 bg-[#D4D4D4] dark:bg-white/20 my-1 min-h-[22px]" />
                          <span className="w-2.5 h-2.5 border-2 border-black dark:border-white bg-white dark:bg-[#16181D] rounded-[2px]" />
                        </div>
                        <div className="flex-1 min-w-0 space-y-2.5">
                          <div>
                            <p className="text-[13.5px] font-bold text-black dark:text-white truncate">
                              {trip.pickupAddress}
                            </p>
                            <p className="text-[12px] text-[#545454] dark:text-neutral-400 truncate">
                              {trip.pickupArea}
                            </p>
                          </div>
                          <div>
                            <p className="text-[13.5px] font-bold text-black dark:text-white truncate">
                              {trip.dropoffAddress}
                            </p>
                            <p className="text-[12px] text-[#545454] dark:text-neutral-400 truncate">
                              {trip.dropoffArea}
                            </p>
                          </div>
                        </div>
                      </div>

                      {trip.flightNumber && (
                        <p className="text-[12px] text-[#276EF1] font-semibold">
                          Flight {trip.flightNumber} tracked · {trip.waitIncludedMin} min wait included
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => onStartReserveTrip(trip)}
                        className="flex-1 min-h-[44px] px-4 rounded-xl bg-black dark:bg-[#276EF1] hover:opacity-90 text-white text-[13.5px] font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] whitespace-nowrap"
                      >
                        <Navigation className="w-4 h-4" />
                        <span>Start Pickup Now</span>
                      </button>

                      {isConfirmingCancel ? (
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmCancelId(null);
                            onCancelReserve(trip.id);
                          }}
                          className="min-h-[44px] px-3.5 rounded-xl bg-[#E11900] hover:bg-[#C11400] text-white text-[13px] font-bold whitespace-nowrap transition-colors"
                        >
                          Confirm Cancel
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmCancelId(trip.id)}
                          className="min-h-[44px] min-w-[44px] px-3 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-[#545454] dark:text-neutral-300 flex items-center justify-center transition-colors"
                          aria-label="Cancel reservation"
                          title="Cancel reservation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
