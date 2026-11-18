import React, { useState } from 'react';
import { BarChart3, CalendarClock, Check, Flame, Plane, Trophy, X } from 'lucide-react';
import { HOURLY_TRENDS, OPPORTUNITIES_LIST, UK_AIRPORT_QUEUES } from '../data/mockDriverData';

interface OpportunitiesModalProps {
  initialSection?: 'opportunities' | 'trends' | 'airports';
  questCompletedCount: number;
  onClose: () => void;
}

export const OpportunitiesModal: React.FC<OpportunitiesModalProps> = ({
  initialSection = 'opportunities',
  questCompletedCount,
  onClose,
}) => {
  const [section, setSection] = useState<'opportunities' | 'trends' | 'airports'>(initialSection);
  const [enrolledIds, setEnrolledIds] = useState<string[]>(['opp-1', 'opp-2']);

  const toggleEnroll = (id: string) => {
    setEnrolledIds((prev) =>
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
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-[#276EF1]" />
              <p className="text-[13px] font-semibold text-[#545454] dark:text-neutral-400">
                London · Estimated hourly demand today
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22]">
              <div className="grid grid-cols-8 gap-2 items-end h-36 pt-4">
                {HOURLY_TRENDS.map((slot) => (
                  <div key={slot.hour} className="flex flex-col items-center h-full justify-end gap-1.5">
                    <span className="text-[10px] font-bold text-black dark:text-white tabular-nums">
                      {slot.label.replace('/hr', '')}
                    </span>
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        style={{ height: `${slot.demand}%` }}
                        className={`w-full max-w-[20px] rounded-t-md ${
                          slot.demand >= 85 ? 'bg-[#276EF1]' : 'bg-black/75 dark:bg-white/70'
                        }`}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-[#6B6B6B] dark:text-neutral-400">
                      {slot.hour}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[13px] text-[#545454] dark:text-neutral-400 mt-3 leading-relaxed">
              Peak earnings expected between <strong className="text-black dark:text-white">16:00 – 20:00</strong> near Soho, Canary Wharf, and King’s Cross.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[12.5px] text-[#545454] dark:text-neutral-400">
              Live FIFO waiting bays across UK airports. Diamond drivers receive priority airport rematch.
            </p>
            {UK_AIRPORT_QUEUES.map((aq) => (
              <div
                key={aq.id}
                className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] flex items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-black dark:bg-white/10 text-white flex items-center justify-center shrink-0">
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

