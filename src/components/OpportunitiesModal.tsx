import React, { useState } from 'react';
import { BarChart3, CalendarClock, Check, Flame, Trophy, X } from 'lucide-react';
import { HOURLY_TRENDS, OPPORTUNITIES_LIST } from '../data/mockDriverData';

interface OpportunitiesModalProps {
  initialSection?: 'opportunities' | 'trends';
  questCompletedCount: number;
  onClose: () => void;
}

export const OpportunitiesModal: React.FC<OpportunitiesModalProps> = ({
  initialSection = 'opportunities',
  questCompletedCount,
  onClose,
}) => {
  const [section, setSection] = useState<'opportunities' | 'trends'>(initialSection);
  const [enrolledIds, setEnrolledIds] = useState<string[]>(['opp-1', 'opp-2']);

  const toggleEnroll = (id: string) => {
    setEnrolledIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[20px] font-bold text-black">
            {section === 'opportunities' ? 'Opportunities' : 'Hourly Trends'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center"
            aria-label="Close modal"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Segmented toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3F3F3] rounded-xl mb-5">
          <button
            type="button"
            onClick={() => setSection('opportunities')}
            className={`h-9 rounded-lg text-[13px] font-bold transition-colors ${
              section === 'opportunities'
                ? 'bg-white text-black shadow-xs'
                : 'text-[#545454] hover:text-black'
            }`}
          >
            Quests & Boost+
          </button>
          <button
            type="button"
            onClick={() => setSection('trends')}
            className={`h-9 rounded-lg text-[13px] font-bold transition-colors ${
              section === 'trends'
                ? 'bg-white text-black shadow-xs'
                : 'text-[#545454] hover:text-black'
            }`}
          >
            Hourly Trends
          </button>
        </div>

        {section === 'opportunities' ? (
          <div className="space-y-3">
            {OPPORTUNITIES_LIST.map((opp) => {
              const isEnrolled = enrolledIds.includes(opp.id);
              const icon =
                opp.type === 'Quest' ? (
                  <Trophy className="w-5 h-5 text-black" />
                ) : opp.type === 'Boost+' ? (
                  <Flame className="w-5 h-5 text-[#276EF1]" />
                ) : (
                  <CalendarClock className="w-5 h-5 text-[#05944F]" />
                );

              const subtitle =
                opp.id === 'opp-1'
                  ? `${Math.min(questCompletedCount, 20)} of 20 trips completed · Ends Mon 4:00 AM`
                  : opp.subtitle;

              return (
                <div
                  key={opp.id}
                  className="p-4 rounded-2xl border border-[#E6E6E6] bg-white space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#F3F3F3] flex items-center justify-center shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#276EF1]">
                          {opp.type}
                        </span>
                        <span className="text-[12px] font-bold text-black tabular-nums">
                          {opp.id === 'opp-1'
                            ? `${Math.max(0, 20 - questCompletedCount)} trips left`
                            : opp.badge}
                        </span>
                      </div>
                      <p className="text-[15px] font-bold text-black mt-0.5">
                        {opp.title}
                      </p>
                      <p className="text-[13px] text-[#545454] mt-0.5">{subtitle}</p>
                    </div>
                  </div>

                  {opp.id === 'opp-1' && (
                    <div className="w-full h-2 rounded-full bg-[#EEEEEE] overflow-hidden">
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
                        ? 'bg-[#E6F4EA] text-[#05944F]'
                        : 'bg-black text-white hover:bg-neutral-800'
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
        ) : (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-[#276EF1]" />
              <p className="text-[13px] font-semibold text-[#545454]">
                London · Estimated hourly demand today
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-[#E6E6E6] bg-[#FAFAFA]">
              <div className="grid grid-cols-8 gap-2 items-end h-36 pt-4">
                {HOURLY_TRENDS.map((slot) => (
                  <div key={slot.hour} className="flex flex-col items-center h-full justify-end gap-1.5">
                    <span className="text-[10px] font-bold text-black tabular-nums">
                      {slot.label.replace('/hr', '')}
                    </span>
                    <div className="w-full flex-1 flex items-end justify-center">
                      <div
                        style={{ height: `${slot.demand}%` }}
                        className={`w-full max-w-[20px] rounded-t-md ${
                          slot.demand >= 85 ? 'bg-[#276EF1]' : 'bg-black/75'
                        }`}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-[#6B6B6B]">
                      {slot.hour}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[13px] text-[#545454] mt-3 leading-relaxed">
              Peak earnings expected between <strong className="text-black">16:00 – 20:00</strong> near Soho, Canary Wharf, and King’s Cross.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
