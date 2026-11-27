import React, { useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  Check,
  Clock,
  Flame,
  MapPin,
  Plane,
  Route,
  Trophy,
  Utensils,
  X,
} from 'lucide-react';
import {
  HOURLY_TRENDS,
  OPPORTUNITIES_LIST,
  PEAK_EVENTS_SCHEDULE,
  UK_AIRPORT_QUEUES,
} from '../data/mockDriverData';
import { PeakTimeSlotId } from '../types/driver';
import { UK_PEAK_TIME_WINDOWS, UKDemandContext } from '../utils/ukRealism';

interface OpportunitiesModalProps {
  initialSection?: 'opportunities' | 'trends' | 'airports';
  questCompletedCount: number;
  enrolledIds?: string[];
  activeAirportQueueCode?: string | null;
  currentDemand?: UKDemandContext;
  selectedPeakSlot?: PeakTimeSlotId | 'auto';
  onSelectPeakSlot?: (slot: PeakTimeSlotId | 'auto') => void;
  eatsEnabled?: boolean;
  cityName?: string;
  onJoinAirportQueue?: (code: string, airportName: string) => void;
  onToggleEnroll?: (id: string) => void;
  onClose: () => void;
}

export const OpportunitiesModal: React.FC<OpportunitiesModalProps> = ({
  initialSection = 'opportunities',
  questCompletedCount,
  enrolledIds: controlledEnrolledIds,
  activeAirportQueueCode = null,
  currentDemand,
  selectedPeakSlot = 'auto',
  onSelectPeakSlot,
  eatsEnabled = false,
  cityName = 'UK',
  onJoinAirportQueue,
  onToggleEnroll,
  onClose,
}) => {
  const [section, setSection] = useState<'opportunities' | 'trends' | 'airports'>(initialSection);
  const [localEnrolledIds, setLocalEnrolledIds] = useState<string[]>(['opp-1', 'opp-2']);
  const [expandedAirportId, setExpandedAirportId] = useState<string | null>('lhr');
  const enrolledIds = controlledEnrolledIds ?? localEnrolledIds;

  const toggleEnroll = (id: string) => {
    if (onToggleEnroll) {
      onToggleEnroll(id);
      return;
    }
    setLocalEnrolledIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#141416] w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[20px] font-bold text-black dark:text-white">
            {section === 'opportunities'
              ? 'Opportunities'
              : section === 'trends'
              ? 'Hourly Trends'
              : 'UK Airport Queues'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-black dark:text-white" />
          </button>
        </div>

        {/* Segmented toggle */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-[#F3F3F3] dark:bg-white/10 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => setSection('opportunities')}
            className={`h-9 rounded-lg text-[12.5px] font-bold transition-colors ${
              section === 'opportunities'
                ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
                : 'text-[#545454] dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Quests & Boost+
          </button>
          <button
            type="button"
            onClick={() => setSection('trends')}
            className={`h-9 rounded-lg text-[12.5px] font-bold transition-colors ${
              section === 'trends'
                ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
                : 'text-[#545454] dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Hourly Trends
          </button>
          <button
            type="button"
            onClick={() => setSection('airports')}
            className={`h-9 rounded-lg text-[12.5px] font-bold transition-colors ${
              section === 'airports'
                ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
                : 'text-[#545454] dark:text-neutral-400 hover:text-black dark:hover:text-white'
            }`}
          >
            Airports
          </button>
        </div>

        {section === 'opportunities' ? (
          <div className="space-y-3">
            {OPPORTUNITIES_LIST.map((opp) => {
              const isEnrolled = enrolledIds.includes(opp.id);
              const icon =
                opp.type === 'Quest' ? (
                  <Trophy className="w-5 h-5 text-black dark:text-white" />
                ) : opp.type === 'Intercity' ? (
                  <Route className="w-5 h-5 text-[#7C3AED]" />
                ) : opp.type === 'Boost+' ? (
                  <Flame className="w-5 h-5 text-[#276EF1]" />
                ) : (
                  <CalendarClock className="w-5 h-5 text-[#05944F]" />
                );

              const subtitle =
                opp.id === 'opp-1'
                  ? `${Math.min(questCompletedCount, 20)} of 20 trips completed · Ends Mon 04:00`
                  : opp.subtitle;

              return (
                <div
                  key={opp.id}
                  className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-white dark:bg-[#1B1D22] space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#276EF1]">
                          {opp.type}
                        </span>
                        <span className="text-[12px] font-bold text-black dark:text-white tabular-nums">
                          {opp.id === 'opp-1'
                            ? `${Math.max(0, 20 - questCompletedCount)} trips left`
                            : opp.badge}
                        </span>
                      </div>
                      <p className="text-[15px] font-bold text-black dark:text-white mt-0.5">
                        {opp.title}
                      </p>
                      <p className="text-[13px] text-[#545454] dark:text-neutral-400 mt-0.5">{subtitle}</p>
                    </div>
                  </div>

                  {opp.id === 'opp-1' && (
                    <div className="w-full h-2 rounded-full bg-[#EEEEEE] dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#276EF1] transition-all"
                        style={{
                          width: `${Math.min(100, (questCompletedCount / 20) * 100)}%`,
                        }}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleEnroll(opp.id)}
                    className={`w-full h-10 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      isEnrolled
                        ? 'bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F]'
                        : 'bg-black dark:bg-[#276EF1] text-white hover:bg-neutral-800 dark:hover:bg-[#1E5CD4]'
                    }`}
                  >
                    {isEnrolled && <Check className="w-4 h-4 stroke-[2.5]" />}
                    {isEnrolled
                      ? opp.type === 'Reservation'
                        ? 'Reserved'
                        : 'Enrolled'
                      : opp.type === 'Reservation'
                      ? 'Accept Reservation'
                      : 'Sign up'}
                  </button>
                </div>
              );
            })}
          </div>
        ) : section === 'trends' ? (
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <BarChart3 className="w-4 h-4 text-[#276EF1] shrink-0" />
                <p className="text-[13px] font-semibold text-[#545454] dark:text-neutral-400 truncate">
                  {cityName} · Peak Busy Times Today
                </p>
              </div>
              {selectedPeakSlot !== 'auto' && onSelectPeakSlot && (
                <button
                  type="button"
                  onClick={() => onSelectPeakSlot('auto')}
                  className="text-[12px] font-bold text-[#276EF1] hover:underline whitespace-nowrap shrink-0"
                >
                  Use Live Time
                </button>
              )}
            </div>

            {/* Morning / Afternoon / Evening / Late Night Peak Busy Times */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {UK_PEAK_TIME_WINDOWS.map((win) => {
                const isActive = currentDemand?.activeSlotId === win.id;
                const isPinned = selectedPeakSlot === win.id;
                return (
                  <button
                    key={win.id}
                    type="button"
                    onClick={() =>
                      onSelectPeakSlot?.(isPinned ? 'auto' : win.id)
                    }
                    className={`min-h-[44px] p-3 rounded-2xl border text-left transition-all ${
                      isActive
                        ? 'border-[#276EF1] bg-[#EEF4FF] dark:bg-[#192338] shadow-xs'
                        : 'border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] hover:border-black/25 dark:hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-[14px] font-extrabold text-black dark:text-white">
                        {win.label}
                      </span>
                      <span
                        className={`text-[11px] font-extrabold tabular-nums ${
                          isActive
                            ? 'text-[#276EF1]'
                            : win.isPeak
                            ? 'text-[#D97706] dark:text-amber-300'
                            : 'text-[#545454] dark:text-neutral-400'
                        }`}
                      >
                        {win.surgeMultiplier.toFixed(2)}x
                      </span>
                    </div>
                    <p className="text-[11.5px] font-medium text-[#545454] dark:text-neutral-400 mt-0.5 tabular-nums flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>{win.windowLabel}</span>
                    </p>
                    <p className="text-[12px] font-bold text-black dark:text-white mt-1.5 tabular-nums">
                      {win.estHourlyRange}
                      {isActive ? ' · Active' : ''}
                    </p>
                    <p className="text-[11px] text-[#545454] dark:text-neutral-400 mt-0.5 line-clamp-1">
                      {eatsEnabled ? win.eatsFocus : win.ridesFocus}
                    </p>
                  </button>
                );
              })}
            </div>

            {eatsEnabled && (
              <div className="mb-4 p-3 rounded-2xl border border-[#EA580C]/25 bg-[#FFF7ED] dark:bg-orange-950/30 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shrink-0">
                  <Utensils className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-black dark:text-white">
                    Busy restaurant icons active on map
                  </p>
                  <p className="text-[11.5px] text-[#545454] dark:text-neutral-300 truncate">
                    {UK_PEAK_TIME_WINDOWS.find(
                      (w) => w.id === (currentDemand?.activeSlotId ?? 'evening')
                    )?.eatsFocus}
                  </p>
                </div>
              </div>
            )}

            <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22]">
              <div className="grid grid-cols-8 gap-2 items-end h-36 pt-4">
                {HOURLY_TRENDS.map((slot) => {
                  const slotSelected = currentDemand?.activeSlotId === slot.slotId;
                  return (
                    <div key={slot.hour} className="flex flex-col items-center h-full justify-end gap-1.5">
                      <span className="text-[10px] font-bold text-black dark:text-white tabular-nums">
                        {slot.label.replace('/hr', '')}
                      </span>
                      <div className="w-full flex-1 flex items-end justify-center">
                        <div
                          style={{ height: `${slot.demand}%` }}
                          className={`w-full max-w-[20px] rounded-t-md transition-colors ${
                            slotSelected
                              ? eatsEnabled
                                ? 'bg-[#EA580C]'
                                : 'bg-[#276EF1]'
                              : slot.demand >= 85
                              ? 'bg-[#276EF1]/60'
                              : 'bg-black/65 dark:bg-white/55'
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[11px] font-semibold ${
                          slotSelected
                            ? 'text-black dark:text-white font-bold'
                            : 'text-[#6B6B6B] dark:text-neutral-400'
                        }`}
                      >
                        {slot.hour}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-[12.5px] text-[#545454] dark:text-neutral-400 mt-3 leading-relaxed">
              Tap <strong className="text-black dark:text-white">Morning</strong>,{' '}
              <strong className="text-black dark:text-white">Afternoon</strong>,{' '}
              <strong className="text-black dark:text-white">Evening</strong>, or{' '}
              <strong className="text-black dark:text-white">Late Night</strong> above to preview demand surge &amp; Eats hotspots.
            </p>

            <div className="mt-5 space-y-2.5">
              <p className="text-[13px] font-bold text-black dark:text-white">
                Upcoming UK Peak Events
              </p>
              {PEAK_EVENTS_SCHEDULE.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3.5 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] flex items-start justify-between gap-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-bold text-black dark:text-white truncate">
                      {ev.venue}
                    </p>
                    <p className="text-[12px] text-[#545454] dark:text-neutral-400 flex items-center gap-1 mt-0.5 truncate">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {ev.area} · {ev.time}
                    </p>
                  </div>
                  <span className="text-[11.5px] font-bold text-[#7C3AED] dark:text-[#C4B5FD] whitespace-nowrap shrink-0">
                    {ev.surgeEst}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12.5px] text-[#545454] dark:text-neutral-400">
              Live FIFO holding bays, flight arrivals feed &amp; UK Short-Trip Queue Bump Protection (keep your priority spot after short drop-offs under 3 mi).
            </p>
            {UK_AIRPORT_QUEUES.map((aq) => {
              const isQueuedHere = activeAirportQueueCode === aq.code;
              const isFlightsOpen = expandedAirportId === aq.id;
              return (
                <div
                  key={aq.id}
                  className={`p-4 rounded-2xl border space-y-2.5 transition-colors ${
                    isQueuedHere
                      ? 'border-[#276EF1] bg-[#E8F0FE]/60 dark:bg-[#192338]'
                      : 'border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isQueuedHere
                            ? 'bg-[#276EF1] text-white'
                            : 'bg-black dark:bg-white/10 text-white'
                        }`}
                      >
                        <Plane className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[14.5px] font-bold text-black dark:text-white truncate">
                          {aq.airport}
                        </p>
                        <p className="text-[12px] text-[#545454] dark:text-neutral-400 truncate">
                          {aq.zone}
                        </p>
                        <p className="text-[12px] font-semibold text-[#276EF1] mt-1 tabular-nums">
                          {aq.carsAhead} cars ahead · ~{aq.estWait} wait
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold shrink-0 ${
                        aq.demand === 'High'
                          ? 'bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F]'
                          : 'bg-[#FFF3D6] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300'
                      }`}
                    >
                      {aq.demand}
                    </span>
                  </div>

                  {aq.flightWave && (
                    <div className="pt-2 border-t border-black/5 dark:border-white/10 flex items-center justify-between gap-2 text-[11.5px]">
                      <span className="font-semibold text-black dark:text-neutral-200 truncate">
                        {aq.flightWave}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-[#276EF1]/15 text-[#276EF1] dark:text-[#7AB0FF] font-bold whitespace-nowrap shrink-0 tabular-nums">
                        {aq.peakWindow}
                      </span>
                    </div>
                  )}

                  {Array.isArray(aq.incomingFlights) && aq.incomingFlights.length > 0 && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setExpandedAirportId(isFlightsOpen ? null : aq.id)}
                        className="text-[11.5px] font-bold text-[#276EF1] hover:underline"
                      >
                        {isFlightsOpen ? 'Hide live flight arrivals' : `View ${aq.incomingFlights.length} live arrivals`}
                      </button>
                      {isFlightsOpen && (
                        <div className="mt-2 rounded-xl bg-white dark:bg-black/30 border border-black/5 dark:border-white/10 divide-y divide-black/5 dark:divide-white/10 text-[11.5px] tabular-nums">
                          {aq.incomingFlights.map((fl) => (
                            <div key={fl.flight} className="px-3 py-2 flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <span className="font-extrabold text-black dark:text-white">{fl.flight}</span>{' '}
                                <span className="text-[#545454] dark:text-neutral-400">from {fl.origin} ({fl.terminal})</span>
                              </div>
                              <div className="shrink-0 text-right">
                                <span className="font-bold text-[#05944F]">{fl.eta}</span>
                                <span className="text-[10.5px] text-[#545454] dark:text-neutral-400 ml-1.5">· {fl.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {onJoinAirportQueue && (
                    <button
                      type="button"
                      onClick={() => onJoinAirportQueue(aq.code, aq.airport)}
                      className={`w-full h-10 rounded-xl text-[12.5px] font-bold transition-colors ${
                        isQueuedHere
                          ? 'bg-[#05944F] text-white'
                          : 'bg-black dark:bg-[#276EF1] text-white hover:opacity-90'
                      }`}
                    >
                      {isQueuedHere
                        ? `In Virtual Queue (${aq.code}) · Bump Protection Active`
                        : `Join ${aq.code} Virtual Queue & Navigate`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

