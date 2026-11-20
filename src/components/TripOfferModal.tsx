import React, { useEffect, useState } from 'react';
import { Route, Star, User, X } from 'lucide-react';
import { TripOffer } from '../types/driver';

interface TripOfferModalProps {
  offer: TripOffer;
  onAccept: (offer: TripOffer) => void;
  onDecline: (offer: TripOffer) => void;
  onMoveToRadarMatch?: (offer: TripOffer) => void;
  onRadarMatchFailed?: (offer: TripOffer) => void;
  initialMatchingId?: string | null;
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
  onMoveToRadarMatch,
  onRadarMatchFailed,
  initialMatchingId = null,
  radarOffers = [],
  showRadarList = false,
  radarRefreshSecLeft = 60,
  onDeclineRadarItem,
  onCloseRadarList,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(offer.expiresInSec);
  const [matchingId, setMatchingId] = useState<string | null>(initialMatchingId);
  const [matchingSecLeft, setMatchingSecLeft] = useState<number>(initialMatchingId ? 10 : 0);

  useEffect(() => {
    setSecondsLeft(offer.expiresInSec);
  }, [offer.id, offer.expiresInSec]);

  useEffect(() => {
    if (initialMatchingId) {
      setMatchingId(initialMatchingId);
      setMatchingSecLeft(10);
    } else if (!showRadarList) {
      setMatchingId(null);
      setMatchingSecLeft(0);
    }
  }, [initialMatchingId, showRadarList]);

  // Countdown for standalone incoming job card (paused while in radar list)
  useEffect(() => {
    if (showRadarList || matchingId !== null) return;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [offer.id, showRadarList, matchingId]);

  useEffect(() => {
    if (!showRadarList && matchingId === null && secondsLeft === 0) {
      onDecline(offer);
    }
  }, [secondsLeft, showRadarList, matchingId, offer, onDecline]);

  const progressPct = Math.max(0, (secondsLeft / offer.expiresInSec) * 100);

  // 10-second Trip Radar matching countdown
  useEffect(() => {
    if (matchingId === null) return;
    const t = setInterval(() => {
      setMatchingSecLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [matchingId]);

  // Resolve match cleanly once 10s countdown hits 0
  useEffect(() => {
    if (matchingId === null || matchingSecLeft > 0) return;
    const target = radarOffers.find((o) => o.id === matchingId) || offer;
    setMatchingId(null);
    // 70% chance driver wins match, 30% chance another driver matched first
    const success = Math.random() < 0.7;
    if (success) {
      onAccept(target);
    } else if (onRadarMatchFailed) {
      onRadarMatchFailed(target);
    } else if (onDeclineRadarItem) {
      onDeclineRadarItem(target);
    } else {
      onDecline(target);
    }
  }, [matchingId, matchingSecLeft, offer, radarOffers, onAccept, onRadarMatchFailed, onDeclineRadarItem, onDecline]);

  const handleAction = (targetOffer: TripOffer) => {
    if (!showRadarList && onMoveToRadarMatch) {
      onMoveToRadarMatch(targetOffer);
      return;
    }
    setMatchingId(targetOffer.id);
    setMatchingSecLeft(10);
  };

  if (showRadarList) {
    return (
      <div className="bg-white dark:bg-[#141416] rounded-t-3xl lg:rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 p-4 max-h-[75vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[18px] font-bold text-black dark:text-white">Trip Radar</h3>
              <span className="px-2 py-0.5 rounded-full bg-[#F3F3F3] dark:bg-white/10 text-[11px] font-bold text-[#545454] dark:text-neutral-300 tabular-nums">
                {matchingId ? `Matching (${matchingSecLeft}s)` : `Refreshes in ${radarRefreshSecLeft}s`}
              </span>
            </div>
            <p className="text-[13px] text-[#545454] dark:text-neutral-400">
              {matchingId
                ? 'Checking driver availability — hold tight for up to 10s...'
                : `${radarOffers.length} nearby & Intercity requests sent to multiple drivers`}
            </p>
          </div>
          <button
            type="button"
            onClick={onCloseRadarList}
            className="w-10 h-10 rounded-xl bg-[#EEEEEE] dark:bg-white/10 flex items-center justify-center hover:bg-[#E2E2E2] dark:hover:bg-white/15 transition-colors"
            aria-label="Close Trip Radar"
          >
            <X className="w-5 h-5 text-black dark:text-white" />
          </button>
        </div>

        {radarOffers.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <p className="text-[15px] font-bold text-black dark:text-white">No active Trip Radar offers</p>
            <p className="text-[13px] text-[#545454] dark:text-neutral-400 tabular-nums">
              Waiting for nearby rider demand...
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {radarOffers.map((item) => {
              const isMatchingThis = matchingId === item.id;
              return (
              <div
                key={item.id}
                className={`rounded-2xl border p-4 bg-white dark:bg-[#1B1D22] shadow-xs transition-all ${
                  isMatchingThis
                    ? 'border-[#276EF1] ring-2 ring-[#276EF1]/25'
                    : 'border-black/10 dark:border-white/10'
                }`}
              >
                {isMatchingThis && (
                  <div className="mb-2.5">
                    <div className="flex items-center justify-between text-[11.5px] font-bold text-[#276EF1] mb-1 tabular-nums">
                      <span>Matching in Trip Radar...</span>
                      <span>{matchingSecLeft}s</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#E8F0FE] dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-[#276EF1] transition-all duration-1000 ease-linear"
                        style={{ width: `${Math.max(0, (matchingSecLeft / 10) * 100)}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-1.5 gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 text-white text-[12px] font-semibold px-2.5 py-0.5 rounded-md ${
                        item.isIntercity ? 'bg-[#7A1C79]' : 'bg-black dark:bg-[#276EF1]'
                      }`}
                    >
                      {item.isIntercity ? (
                        <Route className="w-3.5 h-3.5" />
                      ) : (
                        <User className="w-3.5 h-3.5 fill-white" />
                      )}
                      {item.serviceName}
                    </span>
                    {item.isIntercity && (
                      <span className="bg-[#F3E8FF] dark:bg-purple-950/60 text-[#7A1C79] dark:text-purple-300 text-[11px] font-bold px-2 py-0.5 rounded-md">
                        Out of City
                      </span>
                    )}
                    {(item.tripMinutes >= 30 || item.tripMiles >= 20) && (
                      <span className="bg-[#FEF3C7] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-md">
                        Long Trip · {item.tripMinutes}m
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 bg-[#F3F3F3] dark:bg-white/10 text-black dark:text-white text-[12px] font-semibold px-2 py-0.5 rounded-md tabular-nums">
                      <Star className="w-3 h-3 fill-current" />
                      {item.rating.toFixed(2)}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[22px] font-extrabold text-black dark:text-white tabular-nums block leading-none">
                      £{item.fare.toFixed(2)}
                    </span>
                    <span className="text-[11px] font-bold text-[#05944F] tabular-nums">
                      £{((item.fare / Math.max(1, item.tripMinutes + item.pickupMinutes)) * 60).toFixed(0)}/hr est.
                    </span>
                  </div>
                </div>

                {(item.pinCode || item.surchargeLabel || item.intercityCorridor) && (
                  <p className="text-[11.5px] font-medium text-[#545454] dark:text-neutral-400 mt-1">
                    {[
                      item.intercityCorridor ?? null,
                      item.surchargeLabel && item.surchargeAmount
                        ? `Incl. ${item.surchargeLabel} (£${item.surchargeAmount.toFixed(2)})`
                        : null,
                      item.pinCode ? 'Rider PIN' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}

                <div className="flex items-start gap-2.5 my-3">
                  <div className="flex flex-col items-center pt-1.5">
                    <div className="w-2 h-2 rounded-full bg-black dark:bg-white" />
                    <div className="w-0.5 h-6 bg-black dark:bg-white/50 my-0.5" />
                    <div className="w-2 h-2 bg-black dark:bg-white" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2 text-[13px]">
                    <div>
                      <p className="font-semibold text-black dark:text-white">
                        {item.pickupMinutes} min ({item.pickupMiles} mi) away
                      </p>
                      <p className="text-[#545454] dark:text-neutral-400 truncate">
                        {item.pickupAddress} · {item.pickupArea}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-black dark:text-white">
                        {item.tripMinutes} min ({item.tripMiles} mi) trip
                      </p>
                      <p className="text-[#545454] dark:text-neutral-400 truncate">
                        {item.dropoffAddress} · {item.dropoffArea}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => (onDeclineRadarItem || onDecline)(item)}
                    className="col-span-1 h-11 rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-black dark:text-white text-[14px] font-bold hover:bg-[#FEECEB] hover:text-[#E11900] active:scale-[0.98] transition-all"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={matchingId === item.id}
                    onClick={() => handleAction(item)}
                    className="col-span-2 h-11 rounded-xl bg-black dark:bg-[#276EF1] text-white text-[15px] font-semibold hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] active:scale-[0.99] transition-all disabled:opacity-70"
                  >
                    {matchingId === item.id ? `Matching... (${matchingSecLeft}s)` : 'Match'}
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const isExclusive = offer.type === 'exclusive';

  return (
    <div className="bg-white dark:bg-[#141416] rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden w-full">
      {/* Countdown Progress Strip */}
      <div className="w-full h-1 bg-[#EEEEEE] dark:bg-white/10">
        <div
          className={`h-full transition-all duration-1000 ease-linear ${
            offer.isIntercity
              ? 'bg-[#7A1C79]'
              : isExclusive
              ? 'bg-[#276EF1]'
              : 'bg-black dark:bg-white'
          }`}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 text-white text-[13px] font-semibold px-2.5 py-1 rounded-md ${
                offer.isIntercity ? 'bg-[#7A1C79]' : 'bg-black dark:bg-[#276EF1]'
              }`}
            >
              {offer.isIntercity ? (
                <Route className="w-3.5 h-3.5" />
              ) : (
                <User className="w-3.5 h-3.5 fill-white" />
              )}
              {offer.serviceName}
            </span>
            {offer.isIntercity && (
              <span className="inline-flex items-center bg-[#F3E8FF] dark:bg-purple-950/60 text-[#7A1C79] dark:text-purple-300 text-[12px] font-bold px-2.5 py-1 rounded-md">
                Out of City
              </span>
            )}
            {(offer.tripMinutes >= 30 || offer.tripMiles >= 20) && (
              <span className="inline-flex items-center bg-[#FEF3C7] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 text-[12px] font-bold px-2.5 py-1 rounded-md">
                Long Trip · {offer.tripMinutes}m
              </span>
            )}
            {offer.stopAddress && (
              <span className="inline-flex items-center bg-[#FEF3C7] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 text-[12px] font-bold px-2.5 py-1 rounded-md">
                Multi-Stop
              </span>
            )}
            {isExclusive ? (
              <span className="inline-flex items-center bg-[#E8F0FE] dark:bg-[#276EF1]/20 text-[#276EF1] dark:text-[#7AB0FF] text-[13px] font-semibold px-2.5 py-1 rounded-md">
                Exclusive
              </span>
            ) : (
              <span className="inline-flex items-center bg-[#F3F3F3] dark:bg-white/10 text-[#333333] dark:text-neutral-200 text-[13px] font-semibold px-2.5 py-1 rounded-md">
                Trip Radar
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => onDecline(offer)}
            className="w-10 h-10 rounded-xl bg-[#EEEEEE] dark:bg-white/10 hover:bg-[#E2E2E2] dark:hover:bg-white/15 active:scale-95 flex items-center justify-center transition-all shrink-0"
            aria-label="Decline request"
          >
            <X className="w-5 h-5 text-black dark:text-white" />
          </button>
        </div>

        {/* Big Bold UK Fare + Upfront £/hr Rate */}
        <div className="mt-1.5 flex items-baseline gap-2.5 flex-wrap">
          <span className="text-[38px] leading-tight font-extrabold tracking-tight text-black dark:text-white tabular-nums">
            £{offer.fare.toFixed(2)}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F] text-[12px] font-bold tabular-nums">
            £{((offer.fare / Math.max(1, offer.tripMinutes + offer.pickupMinutes)) * 60).toFixed(0)}/hr est.
          </span>
          {offer.surgeBonus && (
            <span className="text-[13px] font-semibold text-[#7A1C79] dark:text-[#E879F9] tabular-nums">
              Includes +£{offer.surgeBonus.toFixed(2)} surge
            </span>
          )}
        </div>

        {/* Rider Rating + UK Extras */}
        <div className="mt-1 mb-3 flex items-center gap-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1 bg-[#F3F3F3] dark:bg-white/10 text-black dark:text-white text-[13px] font-semibold px-2 py-0.5 rounded-md tabular-nums">
            <Star className="w-3.5 h-3.5 fill-current" />
            {offer.rating.toFixed(2)}
          </span>
          {(offer.pinCode || offer.surchargeLabel || offer.intercityCorridor) && (
            <span className="text-[12px] font-medium text-[#545454] dark:text-neutral-400">
              {[
                offer.intercityCorridor ?? null,
                offer.surchargeLabel && offer.surchargeAmount
                  ? `${offer.surchargeLabel} £${offer.surchargeAmount.toFixed(2)}`
                  : null,
                offer.pinCode ? 'PIN Verified' : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </div>

        <div className="border-t border-[#EEEEEE] dark:border-white/10 pt-3 mb-4">
          {/* Vertical Route Timeline */}
          <div className="flex items-stretch gap-3">
            <div className="flex flex-col items-center py-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-black dark:bg-white shrink-0" />
              <div className="w-[2px] flex-1 bg-black dark:bg-white/50 my-1 min-h-[20px]" />
              {offer.stopAddress && (
                <>
                  <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shrink-0" />
                  <div className="w-[2px] flex-1 bg-black dark:bg-white/50 my-1 min-h-[16px]" />
                </>
              )}
              <div className="w-2.5 h-2.5 bg-black dark:bg-white shrink-0" />
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white leading-snug tabular-nums">
                  {offer.pickupMinutes} min ({offer.pickupMiles} mi) away
                </p>
                <p className="text-[13px] text-[#545454] dark:text-neutral-400 truncate">
                  {offer.pickupAddress} · {offer.pickupArea}
                </p>
              </div>
              {offer.stopAddress && (
                <div>
                  <p className="text-[13px] font-bold text-[#B45309] dark:text-amber-300 leading-snug">
                    Stop 1 · {offer.stopAddress}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white leading-snug tabular-nums">
                  {offer.tripMinutes} min ({offer.tripMiles} mi) trip
                </p>
                <p className="text-[13px] text-[#545454] dark:text-neutral-400 truncate">
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
            className="w-full h-12 rounded-xl text-[16px] font-bold text-white bg-[#276EF1] hover:bg-[#1E5CD4] transition-all active:scale-[0.98] disabled:opacity-75 tabular-nums"
          >
            {matchingId === offer.id ? `Matching... (${matchingSecLeft}s)` : (offer.isIntercity ? 'Accept Intercity Ride' : 'Accept')}
          </button>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => onDecline(offer)}
              className="col-span-1 h-12 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#FEECEB] hover:text-[#E11900] text-black dark:text-white text-[15px] font-bold transition-all active:scale-[0.98]"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={matchingId === offer.id}
              onClick={() => handleAction(offer)}
              className="col-span-2 h-12 rounded-xl text-[16px] font-bold text-white bg-black dark:bg-[#276EF1] hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] transition-all active:scale-[0.98] disabled:opacity-75 tabular-nums"
            >
              {matchingId === offer.id ? `Matching... (${matchingSecLeft}s)` : 'Match'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
