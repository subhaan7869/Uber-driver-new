import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  KeyRound,
  List,
  MessageSquare,
  Navigation,
  Phone,
  Send,
  SlidersHorizontal,
  Star,
  User,
  X,
} from 'lucide-react';
import { RouteStep, TripOffer, TripStage } from '../types/driver';
import { SwipeButton } from './SwipeButton';

interface ActiveTripSheetProps {
  trip: TripOffer;
  stage: TripStage;
  liveEtaLabel?: string;
  liveDistanceLabel?: string;
  routeSteps?: RouteStep[];
  currentStepIdx?: number;
  waitFeeAccrued?: number;
  onArrivePickup: () => void;
  onStartTrip: (waitFeeAccrued?: number) => void;
  onArriveDropoff: () => void;
  onCompleteTrip: () => void;
  onSubmitRating: (stars: number) => void;
  onCancelTrip: () => void;
  onOpenPreferences: () => void;
}

export const ActiveTripSheet: React.FC<ActiveTripSheetProps> = ({
  trip,
  stage,
  liveEtaLabel,
  liveDistanceLabel,
  routeSteps = [],
  currentStepIdx = 0,
  waitFeeAccrued = 0,
  onArrivePickup,
  onStartTrip,
  onArriveDropoff,
  onCompleteTrip,
  onSubmitRating,
  onCancelTrip,
  onOpenPreferences,
}) => {
  const [waitSecondsLeft, setWaitSecondsLeft] = useState(120); // 2:00 UK free wait
  const [paidWaitSeconds, setPaidWaitSeconds] = useState(0);
  const [showRiderContact, setShowRiderContact] = useState(false);
  const [showRiderProfile, setShowRiderProfile] = useState(false);
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [showPinGate, setShowPinGate] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState(5);
  const [chatLog, setChatLog] = useState<Array<{ from: 'driver' | 'rider'; text: string }>>([
    {
      from: 'rider',
      text: trip.pinCode
        ? `Hi! I'm outside ${trip.pickupAddress}. My trip PIN is ${trip.pinCode}.`
        : `Hi! I'm standing near the corner outside ${trip.pickupAddress}.`,
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    if (stage !== 'waiting') return;
    setWaitSecondsLeft(120);
    setPaidWaitSeconds(0);
    setShowPinGate(false);
    setPinInput('');
    setPinError(null);
    const interval = setInterval(() => {
      setWaitSecondsLeft((prev) => {
        if (prev > 0) return prev - 1;
        setPaidWaitSeconds((p) => p + 1);
        return 0;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

  const accruedWaitFee = Number(((paidWaitSeconds / 60) * 0.2).toFixed(2));

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setChatLog((prev) => [...prev, { from: 'driver', text: trimmed }]);
    setChatInput('');
    setTimeout(() => {
      setChatLog((prev) => [
        ...prev,
        { from: 'rider', text: 'Sounds good, walking out now!' },
      ]);
    }, 900);
  };

  const handleStartSwipeComplete = () => {
    if (trip.pinCode) {
      setShowPinGate(true);
      setPinInput('');
      setPinError(null);
      return;
    }
    onStartTrip(accruedWaitFee);
  };

  const handleVerifyPin = (codeToCheck: string) => {
    if (codeToCheck === trip.pinCode) {
      setShowPinGate(false);
      onStartTrip(accruedWaitFee);
    } else {
      setPinError('Incorrect 4-digit PIN — ask rider to check their Uber app');
    }
  };

  // Stage: Completed -> UK Fare Breakdown + Rate Rider
  if (stage === 'completed') {
    const surcharge = trip.surchargeAmount ?? 0;
    const grossTotal = Number((trip.fare + waitFeeAccrued).toFixed(2));
    const uberFee = Number((Math.max(0, trip.fare - surcharge) * 0.25).toFixed(2));
    const netDriver = Number((grossTotal - uberFee).toFixed(2));

    return (
      <div className="bg-white dark:bg-[#141416] rounded-t-3xl lg:rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 p-5">
        <div className="text-center mb-4">
          <p className="text-[13px] font-semibold text-[#05944F] mb-1">Trip completed</p>
          <h3 className="text-[28px] font-extrabold text-black dark:text-white tabular-nums">
            +£{grossTotal.toFixed(2)}
          </h3>
          <p className="text-[13px] text-[#545454] dark:text-neutral-400 mt-0.5">
            {trip.serviceName} · {trip.tripMiles} mi · {trip.tripMinutes} min
          </p>
        </div>

        {/* UK Receipt Summary */}
        <div className="rounded-xl bg-[#F6F6F6] dark:bg-white/5 p-3 mb-4 space-y-1 text-[12px] tabular-nums">
          <div className="flex justify-between text-[#545454] dark:text-neutral-400">
            <span>Gross fare {trip.surchargeLabel ? `(incl. ${trip.surchargeLabel})` : ''}</span>
            <span className="font-semibold text-black dark:text-white">£{trip.fare.toFixed(2)}</span>
          </div>
          {waitFeeAccrued > 0 && (
            <div className="flex justify-between text-[#05944F]">
              <span>Wait-time fee</span>
              <span className="font-semibold">+£{waitFeeAccrued.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-[#545454] dark:text-neutral-400">
            <span>Est. Uber service fee (25%)</span>
            <span>−£{uberFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-black/10 dark:border-white/10 font-bold text-black dark:text-white">
            <span>Net driver take-home</span>
            <span>£{netDriver.toFixed(2)}</span>
          </div>
        </div>

        <div className="border-t border-[#EEEEEE] dark:border-white/10 pt-4 mb-5">
          <p className="text-[15px] font-bold text-black dark:text-white text-center mb-3">
            Rate {trip.riderName}
          </p>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setSelectedRating(star)}
                className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[#F3F3F3] dark:hover:bg-white/10 transition-colors"
                aria-label={`Rate ${star} stars`}
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    star <= selectedRating
                      ? 'fill-black dark:fill-white text-black dark:text-white'
                      : 'text-[#CCCCCC] dark:text-neutral-600'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSubmitRating(selectedRating)}
          className="w-full h-12 rounded-xl bg-black dark:bg-[#276EF1] text-white text-[15px] font-bold hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] active:scale-[0.99] transition-all"
        >
          Done · Find Next Trip
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#141416] rounded-t-3xl lg:rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden">
      {/* Sub-modal: Contact Rider */}
      {showRiderContact && (
        <div className="p-4 border-b border-[#EEEEEE] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-black dark:text-white" />
              <span className="text-[15px] font-bold text-black dark:text-white">
                Message {trip.riderName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowRiderContact(false)}
              className="w-8 h-8 rounded-full bg-[#EEEEEE] dark:bg-white/10 flex items-center justify-center"
              aria-label="Close message drawer"
            >
              <X className="w-4 h-4 text-black dark:text-white" />
            </button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto mb-3">
            {chatLog.map((msg, idx) => (
              <div
                key={idx}
                className={`text-[13px] px-3 py-2 rounded-xl max-w-[85%] ${
                  msg.from === 'driver'
                    ? 'ml-auto bg-[#276EF1] text-white'
                    : 'bg-[#EEEEEE] dark:bg-white/10 text-black dark:text-white'
                }`}
              >
                {msg.text}
              </div>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2">
            {["I've arrived", 'Looking for you', 'Be right there'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => sendMessage(preset)}
                className="px-3 py-1.5 rounded-full bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-[12px] font-semibold text-black dark:text-white whitespace-nowrap hover:bg-[#F3F3F3] dark:hover:bg-white/15"
              >
                {preset}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(chatInput)}
              placeholder="Send a message..."
              className="flex-1 h-10 px-3 rounded-xl bg-white dark:bg-white/10 border border-black/15 dark:border-white/15 text-[14px] text-black dark:text-white focus:outline-none focus:border-black dark:focus:border-[#276EF1]"
            />
            <button
              type="button"
              onClick={() => sendMessage(chatInput)}
              className="w-10 h-10 rounded-xl bg-black dark:bg-[#276EF1] text-white flex items-center justify-center shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sub-modal: Rider Profile */}
      {showRiderProfile && (
        <div className="p-4 border-b border-[#EEEEEE] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] flex items-center justify-between">
          <div>
            <p className="text-[15px] font-bold text-black dark:text-white">{trip.riderName}</p>
            <p className="text-[13px] text-[#545454] dark:text-neutral-400 tabular-nums">
              ★ {trip.rating.toFixed(2)} rating · {trip.riderTrips} trips · Verified Rider
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRiderProfile(false)}
            className="w-8 h-8 rounded-full bg-[#EEEEEE] dark:bg-white/10 flex items-center justify-center"
            aria-label="Close rider profile"
          >
            <X className="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>
      )}

      {/* Sub-modal: Trip Details + Turn-by-Turn Route Steps + Cancel */}
      {showTripDetails && (
        <div className="p-4 border-b border-[#EEEEEE] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] space-y-3 max-h-[46vh] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h4 className="text-[15px] font-bold text-black dark:text-white">
              Route Steps & Waybill
            </h4>
            <button
              type="button"
              onClick={() => setShowTripDetails(false)}
              className="w-8 h-8 rounded-full bg-[#EEEEEE] dark:bg-white/10 flex items-center justify-center"
              aria-label="Close trip details"
            >
              <X className="w-4 h-4 text-black dark:text-white" />
            </button>
          </div>
          <div className="text-[13px] space-y-1 text-[#333333] dark:text-neutral-300">
            <p>
              <span className="font-semibold text-black dark:text-white">Pickup:</span> {trip.pickupAddress}
            </p>
            <p>
              <span className="font-semibold text-black dark:text-white">Dropoff:</span> {trip.dropoffAddress}
            </p>
            <p className="tabular-nums">
              <span className="font-semibold text-black dark:text-white">Est. Fare:</span> £{trip.fare.toFixed(2)} ({trip.serviceName})
              {trip.pinCode ? ` · PIN ${trip.pinCode}` : ''}
            </p>
          </div>

          {routeSteps.length > 0 && (
            <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-1.5">
              <p className="text-[11.5px] font-bold text-[#545454] dark:text-neutral-400 flex items-center gap-1.5">
                <Navigation className="w-3.5 h-3.5 text-[#276EF1]" />
                Turn-by-Turn UK Directions
              </p>
              {routeSteps.map((st, idx) => (
                <div
                  key={st.id}
                  className={`px-2.5 py-2 rounded-lg text-[12px] flex items-center justify-between gap-2 ${
                    idx === currentStepIdx
                      ? 'bg-[#E8F0FE] dark:bg-[#276EF1]/25 text-[#276EF1] dark:text-[#7AB0FF] font-bold'
                      : idx < currentStepIdx
                      ? 'text-[#8E8E93] line-through'
                      : 'text-black dark:text-neutral-200'
                  }`}
                >
                  <span className="truncate">{st.instruction}</span>
                  {st.distanceMeters > 0 && (
                    <span className="text-[11px] tabular-nums shrink-0 opacity-75">
                      {st.distanceMeters >= 1000
                        ? `${(st.distanceMeters / 1609.34).toFixed(1)} mi`
                        : `${st.distanceMeters} m`}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setShowTripDetails(false);
              onCancelTrip();
            }}
            className="w-full h-10 rounded-xl bg-[#FEECEB] dark:bg-red-950/50 text-[#E11900] dark:text-red-300 text-[14px] font-bold hover:bg-[#FDD8D5] transition-colors"
          >
            Cancel Trip
          </button>
        </div>
      )}

      {/* STAGE 1: PICKUP NAVIGATION */}
      {stage === 'pickup' && (
        <div className="p-4">
          <div className="w-10 h-1 bg-[#DCDCDC] dark:bg-white/20 rounded-full mx-auto mb-3 lg:hidden" />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onOpenPreferences}
              className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Driving preferences"
            >
              <SlidersHorizontal className="w-5 h-5 text-black dark:text-white" />
            </button>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-[19px] font-bold text-black dark:text-white tabular-nums">
                <span>{liveEtaLabel ?? `${trip.pickupMinutes} min`}</span>
                <span className="w-5 h-5 rounded-full bg-[#05944F] text-white inline-flex items-center justify-center">
                  <User className="w-3 h-3 fill-white" />
                </span>
                <span>{liveDistanceLabel ?? `${trip.pickupMiles} mi`}</span>
              </div>
              <p className="text-[14px] text-[#545454] dark:text-neutral-400 font-medium">
                Picking up {trip.riderName}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowTripDetails((v) => !v)}
              className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Trip details"
            >
              <List className="w-5 h-5 text-black dark:text-white" />
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-[#EEEEEE] dark:border-white/10 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowRiderContact((v) => !v)}
              className="flex-1 h-10 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E8E8E8] dark:hover:bg-white/15 text-[13px] font-semibold text-black dark:text-white flex items-center justify-center gap-1.5 transition-colors"
            >
              <Phone className="w-4 h-4" />
              Contact {trip.riderName}
            </button>
            <button
              type="button"
              onClick={onArrivePickup}
              className="flex-1 h-10 rounded-xl bg-black dark:bg-[#276EF1] hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] text-white text-[13px] font-semibold transition-colors"
            >
              Arrived at Pickup
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: WAITING FOR RIDER (+ UK Paid Wait Time & Optional 4-Digit Rider PIN Gate) */}
      {stage === 'waiting' && (
        <div className="p-4">
          {showPinGate && trip.pinCode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-[#276EF1]" />
                  <div>
                    <p className="text-[16px] font-extrabold text-black dark:text-white">
                      Enter {trip.riderName}’s 4-Digit PIN
                    </p>
                    <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                      Ask rider for PIN shown in their Uber app (hint: {trip.pinCode})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPinGate(false)}
                  className="w-8 h-8 rounded-full bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-black dark:text-white" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  value={pinInput}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
                    setPinInput(cleaned);
                    setPinError(null);
                    if (cleaned.length === 4) handleVerifyPin(cleaned);
                  }}
                  placeholder="••••"
                  className="flex-1 h-12 text-center tracking-[0.6em] text-[22px] font-extrabold rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-[#276EF1] tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => handleVerifyPin(trip.pinCode!)}
                  className="h-12 px-4 rounded-xl bg-[#E8F0FE] dark:bg-[#276EF1]/20 text-[#276EF1] text-[12.5px] font-bold whitespace-nowrap"
                >
                  Auto-fill {trip.pinCode}
                </button>
              </div>

              {pinError && (
                <p className="text-[12px] font-semibold text-[#E11900]">{pinError}</p>
              )}

              <button
                type="button"
                onClick={() => handleVerifyPin(pinInput)}
                className="w-full h-11 rounded-xl bg-[#05944F] hover:bg-[#047A40] text-white text-[14.5px] font-bold"
              >
                Verify PIN & Start Trip
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setShowTripDetails((v) => !v)}
                  className="w-10 h-10 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center"
                  aria-label="Back to map overview"
                >
                  <ChevronLeft className="w-5 h-5 text-black dark:text-white" />
                </button>

                <div className="text-center">
                  <p className="text-[16px] font-bold text-black dark:text-white">
                    {waitSecondsLeft > 0 ? 'Waiting for rider' : 'Charging wait time (£0.20/min)'}
                  </p>
                  <div
                    className={`mt-1 inline-flex items-center justify-center gap-2 px-4 py-0.5 rounded-full border-[1.5px] text-[15px] font-bold tabular-nums ${
                      waitSecondsLeft > 0
                        ? 'border-black dark:border-white text-black dark:text-white'
                        : 'border-[#05944F] text-[#05944F]'
                    }`}
                  >
                    <span>
                      {waitSecondsLeft > 0
                        ? formatTimer(waitSecondsLeft)
                        : `+${formatTimer(paidWaitSeconds)}`}
                    </span>
                    {accruedWaitFee > 0 && (
                      <span className="text-[12px]">(+£{accruedWaitFee.toFixed(2)})</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowTripDetails((v) => !v)}
                  className="w-10 h-10 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center"
                  aria-label="Trip list"
                >
                  <List className="w-5 h-5 text-black dark:text-white" />
                </button>
              </div>

              <div className="flex items-center justify-between px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowRiderContact((v) => !v)}
                  className="w-12 h-12 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center transition-colors"
                  aria-label="Call or message rider"
                >
                  <Phone className="w-5 h-5 text-black dark:text-white" />
                </button>

                <div className="text-center">
                  <span className="text-[24px] font-extrabold tracking-tight text-black dark:text-white block">
                    {trip.riderName}
                  </span>
                  {trip.pinCode && (
                    <span className="text-[11.5px] font-semibold text-[#276EF1]">
                      PIN Verification Required
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowRiderProfile((v) => !v)}
                  className="w-12 h-12 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center transition-colors"
                  aria-label="Rider profile"
                >
                  <User className="w-5 h-5 text-black dark:text-white" />
                </button>
              </div>

              <div className="mt-2">
                <SwipeButton
                  label={trip.pinCode ? `Enter PIN & Start ${trip.serviceName}` : `Start ${trip.serviceName}`}
                  onComplete={handleStartSwipeComplete}
                  variant="green"
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* STAGE 3A: EN ROUTE TO DROPOFF */}
      {stage === 'enroute' && (
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onOpenPreferences}
              className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Driving preferences"
            >
              <SlidersHorizontal className="w-5 h-5 text-black dark:text-white" />
            </button>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-[19px] font-bold text-black dark:text-white tabular-nums">
                <span>{liveEtaLabel ?? `${trip.tripMinutes} min`}</span>
                <span className="w-2.5 h-2.5 bg-black dark:bg-white inline-block" />
                <span>{liveDistanceLabel ?? `${trip.tripMiles} mi`}</span>
              </div>
              <p className="text-[14px] text-[#545454] dark:text-neutral-400 font-medium truncate max-w-[220px]">
                Dropping off {trip.riderName}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowTripDetails((v) => !v)}
              className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center transition-colors"
              aria-label="Trip details"
            >
              <List className="w-5 h-5 text-black dark:text-white" />
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-[#EEEEEE] dark:border-white/10 flex items-center justify-between gap-2">
            <span className="text-[13px] text-[#545454] dark:text-neutral-400 truncate">
              To {trip.dropoffAddress}
            </span>
            <button
              type="button"
              onClick={onArriveDropoff}
              className="px-4 h-10 rounded-xl bg-black dark:bg-[#276EF1] hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] text-white text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              Arrived at Dropoff
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3B: ARRIVED AT DROPOFF */}
      {stage === 'dropoff_arrived' && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setShowTripDetails((v) => !v)}
              className="w-10 h-10 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center"
              aria-label="Collapse dropoff sheet"
            >
              <ChevronDown className="w-5 h-5 text-black dark:text-white" />
            </button>

            <p className="text-[17px] font-bold text-black dark:text-white">
              Arrived at dropoff
            </p>

            <button
              type="button"
              onClick={() => setShowTripDetails((v) => !v)}
              className="w-10 h-10 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center"
              aria-label="Trip details"
            >
              <List className="w-5 h-5 text-black dark:text-white" />
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setShowRiderContact((v) => !v)}
              className="w-12 h-12 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center transition-colors"
              aria-label="Contact rider"
            >
              <Phone className="w-5 h-5 text-black dark:text-white" />
            </button>

            <span className="text-[24px] font-extrabold tracking-tight text-black dark:text-white">
              {trip.riderName}
            </span>

            <button
              type="button"
              onClick={() => setShowRiderProfile((v) => !v)}
              className="w-12 h-12 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center transition-colors"
              aria-label="Rider profile"
            >
              <User className="w-5 h-5 text-black dark:text-white" />
            </button>
          </div>

          <div className="mt-2">
            <SwipeButton label={`Complete ${trip.serviceName}`} onComplete={onCompleteTrip} />
          </div>
        </div>
      )}
    </div>
  );
};

