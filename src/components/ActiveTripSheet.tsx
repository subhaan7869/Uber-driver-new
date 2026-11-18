import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  List,
  MessageSquare,
  Phone,
  Send,
  SlidersHorizontal,
  Star,
  User,
  X,
} from 'lucide-react';
import { TripOffer, TripStage } from '../types/driver';
import { SwipeButton } from './SwipeButton';

interface ActiveTripSheetProps {
  trip: TripOffer;
  stage: TripStage;
  liveEtaLabel?: string;
  liveDistanceLabel?: string;
  onArrivePickup: () => void;
  onStartTrip: () => void;
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
  onArrivePickup,
  onStartTrip,
  onArriveDropoff,
  onCompleteTrip,
  onSubmitRating,
  onCancelTrip,
  onOpenPreferences,
}) => {
  const [waitSeconds, setWaitSeconds] = useState(90); // Starts at 1:30 like Image 3!
  const [showRiderContact, setShowRiderContact] = useState(false);
  const [showRiderProfile, setShowRiderProfile] = useState(false);
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [chatLog, setChatLog] = useState<Array<{ from: 'driver' | 'rider'; text: string }>>([
    { from: 'rider', text: `Hi! I'm standing near the corner outside ${trip.pickupAddress}.` },
  ]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    if (stage !== 'waiting') return;
    setWaitSeconds(90);
    const interval = setInterval(() => {
      setWaitSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [stage]);

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

  // Stage: Completed -> Rate Rider
  if (stage === 'completed') {
    return (
      <div className="bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl border border-black/10 p-5">
        <div className="text-center mb-4">
          <p className="text-[13px] font-semibold text-[#05944F] mb-1">Trip completed</p>
          <h3 className="text-[28px] font-extrabold text-black tabular-nums">
            +£{trip.fare.toFixed(2)}
          </h3>
          <p className="text-[14px] text-[#545454] mt-0.5">
            {trip.serviceName} · {trip.tripMiles} mi · {trip.tripMinutes} min
          </p>
        </div>

        <div className="border-t border-[#EEEEEE] pt-4 mb-5">
          <p className="text-[15px] font-bold text-black text-center mb-3">
            Rate {trip.riderName}
          </p>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setSelectedRating(star)}
                className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[#F3F3F3] transition-colors"
                aria-label={`Rate ${star} stars`}
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    star <= selectedRating
                      ? 'fill-black text-black'
                      : 'text-[#CCCCCC]'
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onSubmitRating(selectedRating)}
          className="w-full h-12 rounded-xl bg-black text-white text-[15px] font-bold hover:bg-neutral-800 active:scale-[0.99] transition-all"
        >
          Done · Find Next Trip
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-t-3xl lg:rounded-2xl shadow-2xl border border-black/10 overflow-hidden">
      {/* Sub-modal: Contact Rider */}
      {showRiderContact && (
        <div className="p-4 border-b border-[#EEEEEE] bg-[#FAFAFA]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-black" />
              <span className="text-[15px] font-bold text-black">
                Message {trip.riderName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowRiderContact(false)}
              className="w-8 h-8 rounded-full bg-[#EEEEEE] flex items-center justify-center"
              aria-label="Close message drawer"
            >
              <X className="w-4 h-4 text-black" />
            </button>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto mb-3">
            {chatLog.map((msg, idx) => (
              <div
                key={idx}
                className={`text-[13px] px-3 py-2 rounded-xl max-w-[85%] ${
                  msg.from === 'driver'
                    ? 'ml-auto bg-[#276EF1] text-white'
                    : 'bg-[#EEEEEE] text-black'
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
                className="px-3 py-1.5 rounded-full bg-white border border-black/10 text-[12px] font-semibold text-black whitespace-nowrap hover:bg-[#F3F3F3]"
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
              className="flex-1 h-10 px-3 rounded-xl bg-white border border-black/15 text-[14px] focus:outline-none focus:border-black"
            />
            <button
              type="button"
              onClick={() => sendMessage(chatInput)}
              className="w-10 h-10 rounded-xl bg-black text-white flex items-center justify-center shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Sub-modal: Rider Profile */}
      {showRiderProfile && (
        <div className="p-4 border-b border-[#EEEEEE] bg-[#FAFAFA] flex items-center justify-between">
          <div>
            <p className="text-[15px] font-bold text-black">{trip.riderName}</p>
            <p className="text-[13px] text-[#545454] tabular-nums">
              ★ {trip.rating.toFixed(2)} rating · {trip.riderTrips} trips · Verified Rider
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRiderProfile(false)}
            className="w-8 h-8 rounded-full bg-[#EEEEEE] flex items-center justify-center"
            aria-label="Close rider profile"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>
      )}

      {/* Sub-modal: Trip Details / Waybill / Cancel */}
      {showTripDetails && (
        <div className="p-4 border-b border-[#EEEEEE] bg-[#FAFAFA] space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[15px] font-bold text-black">Trip Planner & Waybill</h4>
            <button
              type="button"
              onClick={() => setShowTripDetails(false)}
              className="w-8 h-8 rounded-full bg-[#EEEEEE] flex items-center justify-center"
              aria-label="Close trip details"
            >
              <X className="w-4 h-4 text-black" />
            </button>
          </div>
          <div className="text-[13px] space-y-1.5 text-[#333333]">
            <p>
              <span className="font-semibold text-black">Pickup:</span> {trip.pickupAddress}
            </p>
            <p>
              <span className="font-semibold text-black">Dropoff:</span> {trip.dropoffAddress}
            </p>
            <p className="tabular-nums">
              <span className="font-semibold text-black">Estimated Payout:</span> £{trip.fare.toFixed(2)} ({trip.serviceName})
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowTripDetails(false);
              onCancelTrip();
            }}
            className="w-full h-10 rounded-xl bg-[#FEECEB] text-[#E11900] text-[14px] font-bold hover:bg-[#FDD8D5] transition-colors"
          >
            Cancel Trip
          </button>
        </div>
      )}

      {/* STAGE 1: PICKUP NAVIGATION (Matches Image 3 Top Card) */}
      {stage === 'pickup' && (
        <div className="p-4">
          <div className="w-10 h-1 bg-[#DCDCDC] rounded-full mx-auto mb-3 lg:hidden" />
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onOpenPreferences}
              className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] flex items-center justify-center transition-colors"
              aria-label="Driving preferences"
            >
              <SlidersHorizontal className="w-5 h-5 text-black" />
            </button>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-[19px] font-bold text-black tabular-nums">
                <span>{liveEtaLabel ?? `${trip.pickupMinutes} min`}</span>
                <span className="w-5 h-5 rounded-full bg-[#05944F] text-white inline-flex items-center justify-center">
                  <User className="w-3 h-3 fill-white" />
                </span>
                <span>{liveDistanceLabel ?? `${trip.pickupMiles} mi`}</span>
              </div>
              <p className="text-[14px] text-[#545454] font-medium">
                Picking up {trip.riderName}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowTripDetails((v) => !v)}
              className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] flex items-center justify-center transition-colors"
              aria-label="Trip details"
            >
              <List className="w-5 h-5 text-black" />
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-[#EEEEEE] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowRiderContact((v) => !v)}
              className="flex-1 h-10 rounded-xl bg-[#F3F3F3] hover:bg-[#E8E8E8] text-[13px] font-semibold text-black flex items-center justify-center gap-1.5 transition-colors"
            >
              <Phone className="w-4 h-4" />
              Contact {trip.riderName}
            </button>
            <button
              type="button"
              onClick={onArrivePickup}
              className="flex-1 h-10 rounded-xl bg-black hover:bg-neutral-800 text-white text-[13px] font-semibold transition-colors"
            >
              Arrived at Pickup
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: WAITING FOR RIDER (Matches Image 3 Bottom Card) */}
      {stage === 'waiting' && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setShowTripDetails((v) => !v)}
              className="w-10 h-10 rounded-full hover:bg-[#F3F3F3] flex items-center justify-center"
              aria-label="Back to map overview"
            >
              <ChevronLeft className="w-5 h-5 text-black" />
            </button>

            <div className="text-center">
              <p className="text-[16px] font-bold text-black">Waiting for rider</p>
              <div className="mt-1 inline-flex items-center justify-center px-4 py-0.5 rounded-full border-[1.5px] border-black text-[15px] font-bold text-black tabular-nums">
                {formatTimer(waitSeconds)}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowTripDetails((v) => !v)}
              className="w-10 h-10 rounded-full hover:bg-[#F3F3F3] flex items-center justify-center"
              aria-label="Trip list"
            >
              <List className="w-5 h-5 text-black" />
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setShowRiderContact((v) => !v)}
              className="w-12 h-12 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors"
              aria-label="Call or message rider"
            >
              <Phone className="w-5 h-5 text-black" />
            </button>

            <span className="text-[24px] font-extrabold tracking-tight text-black">
              {trip.riderName}
            </span>

            <button
              type="button"
              onClick={() => setShowRiderProfile((v) => !v)}
              className="w-12 h-12 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors"
              aria-label="Rider profile"
            >
              <User className="w-5 h-5 text-black" />
            </button>
          </div>

          <div className="mt-2">
            <SwipeButton label={`Start ${trip.serviceName}`} onComplete={onStartTrip} variant="green" />
          </div>
        </div>
      )}

      {/* STAGE 3A: EN ROUTE TO DROPOFF */}
      {stage === 'enroute' && (
        <div className="p-4">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onOpenPreferences}
              className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] flex items-center justify-center transition-colors"
              aria-label="Driving preferences"
            >
              <SlidersHorizontal className="w-5 h-5 text-black" />
            </button>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 text-[19px] font-bold text-black tabular-nums">
                <span>{liveEtaLabel ?? `${trip.tripMinutes} min`}</span>
                <span className="w-2.5 h-2.5 bg-black inline-block" />
                <span>{liveDistanceLabel ?? `${trip.tripMiles} mi`}</span>
              </div>
              <p className="text-[14px] text-[#545454] font-medium truncate max-w-[220px]">
                Dropping off {trip.riderName}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowTripDetails((v) => !v)}
              className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] flex items-center justify-center transition-colors"
              aria-label="Trip details"
            >
              <List className="w-5 h-5 text-black" />
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-[#EEEEEE] flex items-center justify-between gap-2">
            <span className="text-[13px] text-[#545454] truncate">
              To {trip.dropoffAddress}
            </span>
            <button
              type="button"
              onClick={onArriveDropoff}
              className="px-4 h-10 rounded-xl bg-black hover:bg-neutral-800 text-white text-[13px] font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              Arrived at Dropoff
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3B: ARRIVED AT DROPOFF (Matches Image 1 & 2 Exact Card!) */}
      {stage === 'dropoff_arrived' && (
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setShowTripDetails((v) => !v)}
              className="w-10 h-10 rounded-full hover:bg-[#F3F3F3] flex items-center justify-center"
              aria-label="Collapse dropoff sheet"
            >
              <ChevronDown className="w-5 h-5 text-black" />
            </button>

            <p className="text-[17px] font-bold text-black">Arrived at dropoff</p>

            <button
              type="button"
              onClick={() => setShowTripDetails((v) => !v)}
              className="w-10 h-10 rounded-full hover:bg-[#F3F3F3] flex items-center justify-center"
              aria-label="Trip details"
            >
              <List className="w-5 h-5 text-black" />
            </button>
          </div>

          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setShowRiderContact((v) => !v)}
              className="w-12 h-12 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors"
              aria-label="Contact rider"
            >
              <Phone className="w-5 h-5 text-black" />
            </button>

            <span className="text-[24px] font-extrabold tracking-tight text-black">
              {trip.riderName}
            </span>

            <button
              type="button"
              onClick={() => setShowRiderProfile((v) => !v)}
              className="w-12 h-12 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors"
              aria-label="Rider profile"
            >
              <User className="w-5 h-5 text-black" />
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
