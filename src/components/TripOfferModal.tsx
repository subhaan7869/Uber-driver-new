import React, { useEffect, useState } from 'react';
import { Star, User, X } from 'lucide-react';
import { TripOffer } from '../types/driver';

interface TripOfferModalProps {
  offer: TripOffer;
  onAccept: (offer: TripOffer) => void;
  onDecline: (offer: TripOffer) => void;
  radarOffers?: TripOffer[];
  showRadarList?: boolean;
  radarRefreshSecLeft?: number;
  onDeclineRadarItem?: (offer: TripOffer) => void;
  onCloseRadarList?: () => void;
}

export const TripOfferModal: React.FC<TripOfferModalProps> = ({
  offer,
  onAccept,
  onDecline,
  radarOffers = [],
  showRadarList = false,
  radarRefreshSecLeft = 60,
  onDeclineRadarItem,
  onCloseRadarList,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(offer.expiresInSec);
  const [matchingId, setMatchingId] = useState<string | null>(null);

  useEffect(() => {
    setSecondsLeft(offer.expiresInSec);
    setMatchingId(null);
  }, [offer.id, offer.expiresInSec]);

  useEffect(() => {
    if (showRadarList) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onDecline(offer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [offer, onDecline, showRadarList]);

  const progressPct = Math.max(0, (secondsLeft / offer.expiresInSec) * 100);

  const handleAction = (targetOffer: TripOffer) => {
    if (targetOffer.type === 'radar') {
      setMatchingId(targetOffer.id);
      setTimeout(() => {
        onAccept(targetOffer);
      }, 650);
    } else {
      onAccept(targetOffer);
    }
  };

  if (showRadarList) {
    return (
      <div className="bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl border border-black/10 p-4 max-h-[75vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[18px] font-bold text-black">Trip Radar</h3>
              <span className="px-2 py-0.5 rounded-full bg-[#F3F3F3] text-[11px] font-bold text-[#545454] tabular-nums">
                Refreshes in {radarRefreshSecLeft}s
              </span>
            </div>
            <p className="text-[13px] text-[#545454]">
              {radarOffers.length} nearby requests sent to multiple drivers
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseRadarList}
            className="w-10 h-10 rounded-xl bg-[#EEEEEE] flex items-center justify-center hover:bg-[#E2E2E2] transition-colors"
            aria-label="Close Trip Radar"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {radarOffers.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-[15px] font-bold text-black">No active Trip Radar offers</p>
            <p className="text-[13px] text-[#545454] tabular-nums">
              Refreshing automatically in {radarRefreshSecLeft}s...
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {radarOffers.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-black/10 p-4 bg-white shadow-xs"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 bg-black text-white text-[12px] font-semibold px-2.5 py-0.5 rounded-md">
                      <User className="w-3.5 h-3.5 fill-white" />
                      {item.serviceName}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-[#F3F3F3] text-black text-[12px] font-semibold px-2 py-0.5 rounded-md tabular-nums">
                      <Star className="w-3 h-3 fill-black" />
                      {item.rating.toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[22px] font-extrabold text-black tabular-nums">
                    £{item.fare.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-start gap-2.5 my-3">
                  <div className="flex flex-col items-center pt-1.5">
                    <div className="w-2 h-2 rounded-full bg-black" />
                    <div className="w-0.5 h-6 bg-black my-0.5" />
                    <div className="w-2 h-2 bg-black" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2 text-[13px]">
                    <div>
                      <p className="font-semibold text-black">
                        {item.pickupMinutes} min ({item.pickupMiles} mi) away
                      </p>
                      <p className="text-[#545454] truncate">{item.pickupAddress}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-black">
                        {item.tripMinutes} min ({item.tripMiles} mi) trip
                      </p>
                      <p className="text-[#545454] truncate">{item.dropoffAddress}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => (onDeclineRadarItem || onDecline)(item)}
                    className="col-span-1 h-11 rounded-xl bg-[#F3F3F3] text-black text-[14px] font-bold hover:bg-[#FEECEB] hover:text-[#E11900] active:scale-[0.98] transition-all"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={matchingId === item.id}
                    onClick={() => handleAction(item)}
                    className="col-span-2 h-11 rounded-xl bg-black text-white text-[15px] font-semibold hover:bg-neutral-800 active:scale-[0.99] transition-all disabled:opacity-70"
                  >
                    {matchingId === item.id ? 'Matching...' : 'Match'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const isExclusive = offer.type === 'exclusive';

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-black/10 overflow-hidden w-full">
      {/* Countdown Progress Strip */}
      <div className="w-full h-1 bg-[#EEEEEE]">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            isExclusive ? 'bg-[#276EF1]' : 'bg-black'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-4">
        {/* Top Row: UberX pill + Exclusive/Radar pill + Close X */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 bg-black text-white text-[13px] font-semibold px-2.5 py-1 rounded-md">
              <User className="w-3.5 h-3.5 fill-white" />
              {offer.serviceName}
            </span>
            {isExclusive ? (
              <span className="inline-flex items-center bg-[#E8F0FE] text-[#276EF1] text-[13px] font-semibold px-2.5 py-1 rounded-md">
                Exclusive
              </span>
            ) : (
              <span className="inline-flex items-center bg-[#F3F3F3] text-[#333333] text-[13px] font-semibold px-2.5 py-1 rounded-md">
                Trip Radar
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onDecline(offer)}
            className="w-10 h-10 rounded-xl bg-[#EEEEEE] hover:bg-[#E2E2E2] active:scale-95 flex items-center justify-center transition-all shrink-0"
            aria-label="Decline request"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Big Bold UK Fare */}
        <div className="mt-1.5 flex items-baseline gap-2.5">
          <span className="text-[38px] leading-tight font-extrabold tracking-tight text-black tabular-nums">
            £{offer.fare.toFixed(2)}
          </span>
          {offer.surgeBonus && (
            <span className="text-[13px] font-semibold text-[#7A1C79] tabular-nums">
              Includes +£{offer.surgeBonus.toFixed(2)} surge
            </span>
          )}
        </div>

        {/* Rider Rating Pill */}
        <div className="mt-1 mb-3">
          <span className="inline-flex items-center gap-1 bg-[#F3F3F3] text-black text-[13px] font-semibold px-2 py-0.5 rounded-md tabular-nums">
            <Star className="w-3.5 h-3.5 fill-black" />
            {offer.rating.toFixed(2)}
          </span>
        </div>

        <div className="border-t border-[#EEEEEE] pt-3 mb-4">
          {/* Vertical Route Timeline */}
          <div className="flex items-stretch gap-3">
            <div className="flex flex-col items-center py-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-black shrink-0" />
              <div className="w-[2px] flex-1 bg-black my-1 min-h-[24px]" />
              <div className="w-2.5 h-2.5 bg-black shrink-0" />
            </div>

            <div className="flex-1 min-w-0 space-y-3">
              <div>
                <p className="text-[15px] font-bold text-black leading-snug tabular-nums">
                  {offer.pickupMinutes} min ({offer.pickupMiles} mi) away
                </p>
                <p className="text-[13px] text-[#545454] truncate">
                  {offer.pickupAddress} · {offer.pickupArea}
                </p>
              </div>
              <div>
                <p className="text-[15px] font-bold text-black leading-snug tabular-nums">
                  {offer.tripMinutes} min ({offer.tripMiles} mi) trip
                </p>
                <p className="text-[13px] text-[#545454] truncate">
                  {offer.dropoffAddress} · {offer.dropoffArea}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {isExclusive ? (
          <button
            type="button"
            disabled={matchingId === offer.id}
            onClick={() => handleAction(offer)}
            className="w-full h-12 rounded-xl text-[16px] font-bold text-white bg-[#276EF1] hover:bg-[#1E5CD4] transition-all active:scale-[0.98] disabled:opacity-75"
          >
            Accept
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => onDecline(offer)}
              className="col-span-1 h-12 rounded-xl bg-[#F3F3F3] hover:bg-[#FEECEB] hover:text-[#E11900] text-black text-[15px] font-bold transition-all active:scale-[0.98]"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={matchingId === offer.id}
              onClick={() => handleAction(offer)}
              className="col-span-2 h-12 rounded-xl text-[16px] font-bold text-white bg-black hover:bg-neutral-800 transition-all active:scale-[0.98] disabled:opacity-75"
            >
              {matchingId === offer.id ? 'Matching...' : 'Match'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
