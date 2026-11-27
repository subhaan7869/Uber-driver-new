import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  CloudRain,
  ExternalLink,
  KeyRound,
  List,
  MessageSquare,
  Navigation,
  Package,
  Phone,
  PhoneCall,
  PhoneOff,
  Plane,
  Route,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Store,
  User,
  UserX,
  X,
} from 'lucide-react';
import { NavProvider, RouteStep, TripOffer, TripStage, UKWeatherCondition } from '../types/driver';
import { triggerHaptic, uberSounds } from '../utils/uberSounds';
import { mapToLatLng } from '../utils/ukGeo';
import { getAirportTerminalBay, getUKWeatherInfo } from '../utils/ukRealism';
import { SwipeButton } from './SwipeButton';
import { TaxiMeterWidget } from './TaxiMeterWidget';

interface ActiveTripSheetProps {
  trip: TripOffer;
  stage: TripStage;
  liveEtaLabel?: string;
  liveDistanceLabel?: string;
  navProgress?: number;
  routeSteps?: RouteStep[];
  currentStepIdx?: number;
  waitFeeAccrued?: number;
  stopVisited?: boolean;
  queuedOffer?: TripOffer | null;
  navProvider?: NavProvider;
  licensePlate?: string;
  weatherCondition?: UKWeatherCondition;
  trafficAlert?: { delayMin: number; routeSavedMin: number } | null;
  riderChangeOffer?: {
    kind: 'dropoff' | 'stop';
    title: string;
    subtitle: string;
    extraFare: number;
    extraMiles: number;
    extraMin: number;
  } | null;
  stackedEatsOffer?: {
    restaurantName: string;
    orderCode: string;
    extraFare: number;
    extraMiles: number;
    extraMin: number;
  } | null;
  onTakeFasterRoute?: () => void;
  onAcceptRiderChange?: () => void;
  onDeclineRiderChange?: () => void;
  onAcceptStackedEats?: () => void;
  onDeclineStackedEats?: () => void;
  onArrivePickup: () => void;
  onStartTrip: (waitFeeAccrued?: number) => void;
  onArriveStop?: () => void;
  onContinueFromStop?: () => void;
  onArriveDropoff: () => void;
  onCompleteTrip: (meteredFinalFare?: number) => void;
  onSubmitRating: (stars: number, tags: string[]) => void;
  onNoShowCancel?: (fee: number) => void;
  onAcceptQueued?: () => void;
  onDeclineQueued?: () => void;
  onCancelTrip: () => void;
  onOpenPreferences: () => void;
  onShareCompletedReceipt?: () => void;
  onExpandedChange?: (expanded: boolean) => void;
}

const RIDER_TAGS = ['Friendly', 'Ready at pickup', 'Great tipper', 'Late at curb', 'Left item'];

export const ActiveTripSheet: React.FC<ActiveTripSheetProps> = ({
  trip,
  stage,
  liveEtaLabel,
  liveDistanceLabel,
  navProgress = 0,
  routeSteps = [],
  currentStepIdx = 0,
  waitFeeAccrued = 0,
  stopVisited = false,
  queuedOffer = null,
  navProvider = 'uber',
  licensePlate = 'LB24 UBR',
  weatherCondition = 'Clear',
  trafficAlert = null,
  riderChangeOffer = null,
  stackedEatsOffer = null,
  onTakeFasterRoute,
  onAcceptRiderChange,
  onDeclineRiderChange,
  onAcceptStackedEats,
  onDeclineStackedEats,
  onArrivePickup,
  onStartTrip,
  onArriveStop,
  onContinueFromStop,
  onArriveDropoff,
  onCompleteTrip,
  onSubmitRating,
  onNoShowCancel,
  onAcceptQueued,
  onDeclineQueued,
  onCancelTrip,
  onOpenPreferences,
  onShareCompletedReceipt,
  onExpandedChange,
}) => {
  const [waitSecondsLeft, setWaitSecondsLeft] = useState(120); // 2:00 UK free wait
  const [paidWaitSeconds, setPaidWaitSeconds] = useState(0);
  const [liveMeterFare, setLiveMeterFare] = useState<number | undefined>(
    trip.isMeteredFare ? trip.fare : undefined
  );
  const waitExpiredSoundRef = useRef(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const touchStartYRef = useRef<number | null>(null);
  const detailsScrollRef = useRef<HTMLDivElement | null>(null);
  const [showRiderContact, setShowRiderContact] = useState(false);
  const [maskedCallActive, setMaskedCallActive] = useState(false);
  const [showRiderProfile, setShowRiderProfile] = useState(false);
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [showPinGate, setShowPinGate] = useState(false);
  const [showStartConfirm, setShowStartConfirm] = useState(false);
  const [eatsDeliveryProof, setEatsDeliveryProof] = useState<'none' | 'photo_taken' | 'handed'>('none');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [selectedRating, setSelectedRating] = useState(5);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [chatLog, setChatLog] = useState<Array<{ from: 'driver' | 'rider'; text: string }>>([
    {
      from: 'rider',
      text:
        trip.riderNote ||
        (trip.pinCode
          ? `Hi! I'm outside ${trip.pickupAddress}. My trip PIN is ${trip.pinCode}.`
          : `Hi! I'm standing near the corner outside ${trip.pickupAddress}.`),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [unreadChatCount, setUnreadChatCount] = useState(1);

  useEffect(() => {
    setChatLog([
      {
        from: 'rider',
        text:
          trip.riderNote ||
          (trip.pinCode
            ? `Hi! I'm outside ${trip.pickupAddress}. My trip PIN is ${trip.pinCode}.`
            : `Hi! I'm standing near the corner outside ${trip.pickupAddress}.`),
      },
    ]);
    setSelectedTags([]);
    setSelectedRating(5);
    setMaskedCallActive(false);
    setEatsDeliveryProof('none');
    setLiveMeterFare(trip.isMeteredFare ? trip.fare : undefined);
    setUnreadChatCount(trip.riderNote || trip.pinCode ? 1 : 0);
    setSheetExpanded(false);
    setShowTripDetails(false);
    setDragOffsetY(0);
  }, [trip.id, trip.pickupAddress, trip.pinCode, trip.riderNote, trip.isMeteredFare, trip.fare]);

  useEffect(() => {
    if (stage === 'pickup' || stage === 'enroute') {
      setSheetExpanded(false);
      setShowTripDetails(false);
      setDragOffsetY(0);
    }
  }, [stage]);

  useEffect(() => {
    const isPullUpStage = stage === 'pickup' || stage === 'enroute';
    onExpandedChange?.(isPullUpStage ? sheetExpanded : stage !== 'idle');
  }, [stage, sheetExpanded, onExpandedChange]);

  useEffect(() => {
    if (showRiderContact) {
      setUnreadChatCount(0);
    }
  }, [showRiderContact]);

  useEffect(() => {
    if (stage !== 'waiting') {
      setShowStartConfirm(false);
      waitExpiredSoundRef.current = false;
      return;
    }
    setWaitSecondsLeft(120);
    setPaidWaitSeconds(0);
    waitExpiredSoundRef.current = false;
    setShowPinGate(false);
    setShowStartConfirm(false);
    setPinInput('');
    setPinError(null);
    const interval = setInterval(() => {
      setWaitSecondsLeft((prev) => {
        if (prev > 0) {
          if (prev === 1 && !waitExpiredSoundRef.current) {
            waitExpiredSoundRef.current = true;
            uberSounds.play('waitExpired');
            triggerHaptic('alert');
          }
          return prev - 1;
        }
        setPaidWaitSeconds((p) => p + 1);
        return 0;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [stage, trip.id]);

  const accruedWaitFee = Number(((paidWaitSeconds / 60) * 0.2).toFixed(2));
  const noShowEligible = paidWaitSeconds >= 180; // 5:00 total wait (2:00 free + 3:00 paid)

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
      const lower = trimmed.toLowerCase();
      let reply = 'Got it, walking out right now!';
      if (lower.includes('hazard') || lower.includes('outside')) {
        reply = 'See your hazards flashing — coming down now!';
      } else if (lower.includes('traffic') || lower.includes('2 min')) {
        reply = 'No worries at all, take your time!';
      } else if (lower.includes('counter') || lower.includes('order')) {
        reply = 'Thanks for updating me — buzz gate 4 on arrival.';
      } else if (lower.includes('pin')) {
        reply = trip.pinCode
          ? `Cheers! Just a reminder my PIN is ${trip.pinCode}.`
          : 'Great, standing right by the kerb with my phone.';
      }
      setChatLog((prev) => [...prev, { from: 'rider', text: reply }]);
      if (!showRiderContact) {
        setUnreadChatCount((c) => c + 1);
      }
    }, 900);
  };

  const handleStartSwipeComplete = () => {
    if (trip.pinCode) {
      setShowPinGate(true);
      setPinInput('');
      setPinError(null);
      return;
    }
    setShowStartConfirm(true);
  };

  const handleVerifyPin = (codeToCheck: string) => {
    if (codeToCheck === trip.pinCode) {
      setShowPinGate(false);
      setShowStartConfirm(true);
    } else {
      setPinError('Incorrect 4-digit PIN — ask rider to check their Uber app');
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const targetCoords =
    stage === 'pickup'
      ? trip.pickupCoords
      : trip.stopCoords && !stopVisited
      ? trip.stopCoords
      : trip.dropoffCoords;
  const targetLatLng = mapToLatLng(targetCoords);
  const externalNavLabel =
    navProvider === 'google'
      ? 'Google Maps'
      : navProvider === 'waze'
      ? 'Waze'
      : navProvider === 'apple'
      ? 'Apple Maps'
      : 'Google Maps';
  const externalNavHref =
    navProvider === 'waze'
      ? `https://waze.com/ul?ll=${targetLatLng.lat},${targetLatLng.lng}&navigate=yes`
      : navProvider === 'apple'
      ? `https://maps.apple.com/?daddr=${targetLatLng.lat},${targetLatLng.lng}&dirflg=d`
      : `https://www.google.com/maps/dir/?api=1&destination=${targetLatLng.lat},${targetLatLng.lng}&travelmode=driving`;

  const airportBayInfo = getAirportTerminalBay(
    `${trip.pickupAddress} ${trip.pickupArea}`,
    trip.surchargeLabel,
    licensePlate,
    trip.id
  );
  const weatherInfo = getUKWeatherInfo(weatherCondition);

  // Stage: Completed -> UK Fare Breakdown + Rider Tags + Rate Rider
  if (stage === 'completed') {
    const surcharge = trip.surchargeAmount ?? 0;
    const effectiveFare = trip.isMeteredFare && liveMeterFare ? liveMeterFare : trip.fare;
    const grossTotal = Number((effectiveFare + waitFeeAccrued).toFixed(2));
    const uberFee = Number((Math.max(0, effectiveFare - surcharge) * 0.25).toFixed(2));
    const netDriver = Number((grossTotal - uberFee).toFixed(2));
    const hmrcRelief = Number((trip.tripMiles * 0.45).toFixed(2));

    return (
      <div className="bg-white dark:bg-[#141416] rounded-t-3xl lg:rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 p-5 max-h-[85vh] overflow-y-auto">
        <div className="text-center mb-3.5">
          <div className="inline-flex items-center gap-1.5 mb-1 flex-wrap justify-center">
            <span className="text-[13px] font-semibold text-[#05944F]">
              {trip.isIntercity
                ? 'Intercity trip completed'
                : trip.paymentMethod === 'cash'
                ? 'Cash Taxi Meter trip completed'
                : 'Trip completed'}
            </span>
            {trip.merchantName && (
              <span className="px-2 py-0.5 rounded bg-[#FFF3D6] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 text-[11px] font-bold">
                {trip.merchantName}
              </span>
            )}
          </div>
          <h3 className="text-[28px] font-extrabold text-black dark:text-white tabular-nums">
            +£{grossTotal.toFixed(2)}
          </h3>
          <p className="text-[13px] text-[#545454] dark:text-neutral-400 mt-0.5">
            {trip.serviceName} · {trip.tripMiles} mi · {trip.tripMinutes} min
            {trip.paymentMethod === 'cash' ? ' · Cash Collected' : ''}
          </p>
        </div>

        {/* UK Receipt Summary */}
        <div className="rounded-xl bg-[#F6F6F6] dark:bg-white/5 p-3 mb-4 space-y-1 text-[12px] tabular-nums">
          <div className="flex justify-between text-[#545454] dark:text-neutral-400">
            <span>
              {trip.isMeteredFare ? 'Final Metered Cash Fare' : 'Gross fare'}{' '}
              {trip.surchargeLabel ? `(incl. ${trip.surchargeLabel})` : ''}
            </span>
            <span className="font-semibold text-black dark:text-white">£{effectiveFare.toFixed(2)}</span>
          </div>
          {trip.boostBonus && trip.boostBonus > 0 && (
            <div className="flex justify-between text-[#276EF1]">
              <span>Boost+ zone bonus included</span>
              <span className="font-semibold">+£{trip.boostBonus.toFixed(2)}</span>
            </div>
          )}
          {trip.surgeBonus && trip.surgeBonus > 0 && (
            <div className="flex justify-between text-[#7A1C79] dark:text-[#E879F9]">
              <span>{trip.surgeLockedBonus ? 'Locked Sticky Surge' : 'Surge bonus'} included</span>
              <span className="font-semibold">+£{trip.surgeBonus.toFixed(2)}</span>
            </div>
          )}
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
          <div className="flex justify-between text-[11px] text-[#276EF1] font-semibold pt-0.5">
            <span>HMRC £0.45/mi business relief</span>
            <span>+£{hmrcRelief.toFixed(2)} tax-free</span>
          </div>
        </div>

        <div className="border-t border-[#EEEEEE] dark:border-white/10 pt-3.5 mb-4">
          <p className="text-[15px] font-bold text-black dark:text-white text-center mb-2.5">
            Rate {trip.riderName}
          </p>
          <div className="flex items-center justify-center gap-2 mb-3">
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

          <div className="flex flex-wrap justify-center gap-1.5">
            {RIDER_TAGS.map((tag) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-3 py-1.5 rounded-full text-[11.5px] font-bold transition-colors ${
                    active
                      ? 'bg-[#276EF1] text-white'
                      : 'bg-[#F3F3F3] dark:bg-white/10 text-black dark:text-neutral-200 hover:bg-[#E8E8E8] dark:hover:bg-white/15'
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          {onShareCompletedReceipt && (
            <button
              type="button"
              onClick={onShareCompletedReceipt}
              className="w-full h-10 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-black dark:text-white text-[13.5px] font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Share2 className="w-4 h-4 text-[#276EF1]" />
              <span>Share UK Trip Receipt</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onSubmitRating(selectedRating, selectedTags)}
            className="w-full h-12 rounded-xl bg-black dark:bg-[#276EF1] text-white text-[15px] font-bold hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] active:scale-[0.99] transition-all"
          >
            Done · Find Next Trip
          </button>
        </div>
      </div>
    );
  }

  const handleSheetTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0]?.clientY ?? null;
  };

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const currentY = e.touches[0]?.clientY ?? touchStartYRef.current;
    const deltaY = currentY - touchStartYRef.current;
    if (sheetExpanded) {
      const scrollTop = detailsScrollRef.current?.scrollTop ?? 0;
      if (deltaY > 0 && scrollTop <= 2) {
        setDragOffsetY(Math.min(72, deltaY * 0.45));
      }
    } else if (deltaY < 0) {
      setDragOffsetY(Math.max(-56, deltaY * 0.45));
    }
  };

  const handleSheetTouchEnd = (e: React.TouchEvent) => {
    if (touchStartYRef.current === null) return;
    const endY = e.changedTouches[0]?.clientY ?? touchStartYRef.current;
    const deltaY = endY - touchStartYRef.current;
    touchStartYRef.current = null;
    setDragOffsetY(0);

    if (!sheetExpanded && deltaY < -28) {
      triggerHaptic('light');
      setSheetExpanded(true);
    } else if (sheetExpanded && deltaY > 32) {
      const scrollTop = detailsScrollRef.current?.scrollTop ?? 0;
      if (scrollTop <= 8) {
        triggerHaptic('light');
        setSheetExpanded(false);
      }
    }
  };

  const isPullUpStage = stage === 'pickup' || stage === 'enroute';
  const showBackdrop = isPullUpStage && sheetExpanded;

  return (
    <div className="space-y-2 relative">
      {showBackdrop && (
        <div
          aria-hidden="true"
          onClick={() => setSheetExpanded(false)}
          className="fixed inset-0 -z-10 bg-black/35 backdrop-blur-[1px] transition-opacity"
        />
      )}

      {/* Dynamic Traffic Delay & Reroute Banner */}
      {trafficAlert && (stage === 'pickup' || stage === 'enroute') && (
        <div className="bg-[#FFFBEB] dark:bg-amber-950/95 text-black dark:text-amber-100 rounded-2xl p-3.5 shadow-xl border border-[#F59E0B]/40 flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#F59E0B] text-black flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold leading-tight">
                +{trafficAlert.delayMin} min traffic delay ahead
              </p>
              <p className="text-[11.5px] opacity-80 truncate">
                Faster alternative route available
              </p>
            </div>
          </div>
          {onTakeFasterRoute && (
            <button
              type="button"
              onClick={onTakeFasterRoute}
              className="px-3 h-9 rounded-xl bg-black dark:bg-[#F59E0B] text-white dark:text-black text-[12px] font-bold whitespace-nowrap shrink-0"
            >
              Reroute (−{trafficAlert.routeSavedMin}m)
            </button>
          )}
        </div>
      )}

      {/* Stacked / Double Uber Eats Batch Order Offer */}
      {stackedEatsOffer && (stage === 'pickup' || stage === 'waiting') && (
        <div className="bg-[#062E1F] text-white rounded-2xl p-3.5 shadow-2xl border border-[#05944F]/60 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="px-2 py-0.5 rounded bg-[#05944F] text-[10.5px] font-extrabold uppercase">
                Double Uber Eats Stack
              </span>
              <p className="text-[14.5px] font-extrabold mt-1">
                + Add {stackedEatsOffer.restaurantName} ({stackedEatsOffer.orderCode})
              </p>
              <p className="text-[12px] text-white/80">
                Along your route · +{stackedEatsOffer.extraMiles} mi · +{stackedEatsOffer.extraMin} min
              </p>
            </div>
            <span className="text-[16px] font-extrabold text-[#4ADE80] tabular-nums shrink-0">
              +£{stackedEatsOffer.extraFare.toFixed(2)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onDeclineStackedEats}
              className="h-9 rounded-xl bg-white/10 hover:bg-white/20 text-[12.5px] font-bold"
            >
              No Thanks
            </button>
            <button
              type="button"
              onClick={onAcceptStackedEats}
              className="h-9 rounded-xl bg-[#05944F] hover:bg-[#047A40] text-[12.5px] font-bold"
            >
              Accept Stack
            </button>
          </div>
        </div>
      )}

      {/* Mid-Trip Rider Destination / Stop Change Offer */}
      {riderChangeOffer && stage === 'enroute' && (
        <div className="bg-[#111827] text-white rounded-2xl p-3.5 shadow-2xl border border-[#276EF1]/50 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="px-2 py-0.5 rounded bg-[#276EF1] text-[10.5px] font-bold uppercase">
                Rider Trip Update
              </span>
              <p className="text-[14.5px] font-extrabold mt-1">{riderChangeOffer.title}</p>
              <p className="text-[12px] text-white/75">{riderChangeOffer.subtitle}</p>
            </div>
            <span className="text-[16px] font-extrabold text-[#4ADE80] tabular-nums shrink-0">
              +£{riderChangeOffer.extraFare.toFixed(2)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onDeclineRiderChange}
              className="h-9 rounded-xl bg-white/10 hover:bg-white/20 text-[12.5px] font-bold"
            >
              Keep Original
            </button>
            <button
              type="button"
              onClick={onAcceptRiderChange}
              className="h-9 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-[12.5px] font-bold"
            >
              Accept (+{riderChangeOffer.extraMiles} mi)
            </button>
          </div>
        </div>
      )}

      {/* Back-to-Back Queued Next Trip Offer */}
      {queuedOffer && stage === 'enroute' && (
        <div className="bg-[#111111] text-white rounded-2xl p-3.5 shadow-2xl border border-white/15 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-[#276EF1] text-[10.5px] font-bold">
                SMART NEXT TRIP
              </span>
              <span className="px-2 py-0.5 rounded bg-[#05944F]/25 text-[#4ADE80] text-[10.5px] font-bold tabular-nums">
                £{((queuedOffer.fare / Math.max(1, queuedOffer.tripMinutes + queuedOffer.pickupMinutes)) * 60).toFixed(0)}/hr
              </span>
              {queuedOffer.isIntercity && (
                <span className="px-2 py-0.5 rounded bg-[#7A1C79] text-[10.5px] font-bold">
                  Intercity
                </span>
              )}
            </div>
            <p className="text-[15px] font-extrabold mt-1 tabular-nums truncate">
              £{queuedOffer.fare.toFixed(2)} · {queuedOffer.serviceName} ({queuedOffer.tripMiles} mi)
            </p>
            <p className="text-[11.5px] text-white/70 truncate">
              Near drop-off · {queuedOffer.pickupAddress} → {queuedOffer.dropoffArea}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onDeclineQueued}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
              aria-label="Decline queued ride"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <button
              type="button"
              onClick={onAcceptQueued}
              className="px-3.5 h-9 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-[12.5px] font-bold"
            >
              Accept
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          transform: dragOffsetY !== 0 ? `translateY(${dragOffsetY}px)` : undefined,
        }}
        className={`bg-white dark:bg-[#141416] rounded-t-3xl lg:rounded-2xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden transition-transform duration-200 ease-out ${
          isPullUpStage && sheetExpanded ? 'max-h-[74dvh] flex flex-col' : ''
        }`}
      >
        {/* Sub-modal: Contact Rider (Chat + Masked Relay Call) */}
        {showRiderContact && (
          <div className="p-4 border-b border-[#EEEEEE] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-black dark:text-white" />
                <span className="text-[15px] font-bold text-black dark:text-white">
                  Contact {trip.riderName}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMaskedCallActive((v) => !v)}
                  className={`px-3 h-8 rounded-full text-[11.5px] font-bold flex items-center gap-1.5 transition-colors ${
                    maskedCallActive
                      ? 'bg-[#E11900] text-white'
                      : 'bg-[#05944F] text-white'
                  }`}
                >
                  {maskedCallActive ? (
                    <>
                      <PhoneOff className="w-3.5 h-3.5" />
                      End Call
                    </>
                  ) : (
                    <>
                      <PhoneCall className="w-3.5 h-3.5" />
                      Call UK Relay
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRiderContact(false)}
                  className="w-8 h-8 rounded-full bg-[#EEEEEE] dark:bg-white/10 flex items-center justify-center"
                  aria-label="Close message drawer"
                >
                  <X className="w-4 h-4 text-black dark:text-white" />
                </button>
              </div>
            </div>

            {maskedCallActive && (
              <div className="mb-3 p-2.5 rounded-xl bg-[#05944F]/15 border border-[#05944F]/30 flex items-center justify-between text-[12px]">
                <span className="font-bold text-[#05944F] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#05944F] animate-pulse" />
                  Masked Uber Relay · +44 20 7946 0821
                </span>
                <span className="text-[#545454] dark:text-neutral-300 font-semibold">Ringing…</span>
              </div>
            )}

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
              {[
                'Outside with hazard lights on',
                'Stuck at traffic lights, 2 mins',
                'Waiting at pickup pin',
                ...(trip.serviceName === 'Uber Eats' ? ['Collecting order at counter'] : ["I've arrived"]),
              ].map((preset) => (
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
              {trip.stopAddress && (
                <p>
                  <span className="font-semibold text-[#B45309] dark:text-amber-300">Stop 1:</span>{' '}
                  {trip.stopAddress}
                </p>
              )}
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <a
                href={externalNavHref}
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 rounded-xl bg-[#E8F0FE] dark:bg-[#276EF1]/20 text-[#276EF1] dark:text-[#7AB0FF] text-[13px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#D9E7FD] transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Navigate in {externalNavLabel}</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setShowTripDetails(false);
                  onCancelTrip();
                }}
                className="h-10 rounded-xl bg-[#FEECEB] dark:bg-red-950/50 text-[#E11900] dark:text-red-300 text-[13px] font-bold hover:bg-[#FDD8D5] transition-colors"
              >
                Cancel Trip
              </button>
            </div>
          </div>
        )}

        {/* STAGE 1 & STAGE 3A: PULL-UP JOB DETAILS MENU (Compact dock by default, pull/tap up for full UK job details) */}
        {isPullUpStage && (
          <div className={sheetExpanded ? 'flex flex-col min-h-0 flex-1' : ''}>
            {/* Pull-Up Grabber & Compact Summary Header (Always visible) */}
            <div
              onTouchStart={handleSheetTouchStart}
              onTouchMove={handleSheetTouchMove}
              onTouchEnd={handleSheetTouchEnd}
              className="px-4 pt-2 pb-2.5 select-none shrink-0"
            >
              <button
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setSheetExpanded((v) => !v);
                }}
                className="w-full flex flex-col items-center pb-1.5 group focus:outline-none"
                aria-expanded={sheetExpanded}
                aria-label={sheetExpanded ? 'Collapse job details' : 'Pull up job details'}
              >
                <span className="w-10 h-1.5 rounded-full bg-[#D0D0D4] dark:bg-white/25 group-hover:bg-black/40 dark:group-hover:bg-white/45 transition-colors" />
                <span className="mt-1 inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wider text-[#6E6E73] dark:text-neutral-400">
                  {sheetExpanded ? (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      <span>Pull down to map</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      <span>
                        {stage === 'enroute' && trip.paymentMethod === 'cash' && liveMeterFare
                          ? `Job details · Meter £${liveMeterFare.toFixed(2)}`
                          : 'Pull up for job details'}
                      </span>
                    </>
                  )}
                </span>
              </button>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onOpenPreferences}
                  className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
                  aria-label="Driving preferences"
                >
                  <SlidersHorizontal className="w-5 h-5 text-black dark:text-white" />
                </button>

                <button
                  type="button"
                  onClick={() => setSheetExpanded((v) => !v)}
                  className="flex-1 min-w-0 text-center py-0.5 focus:outline-none"
                >
                  <div className="flex items-center justify-center gap-1.5 text-[18px] font-extrabold text-black dark:text-white tabular-nums leading-tight">
                    <span>
                      {liveEtaLabel ??
                        `${stage === 'pickup' ? trip.pickupMinutes : trip.tripMinutes} min`}
                    </span>
                    {stage === 'pickup' ? (
                      <span className="w-4 h-4 rounded-full bg-[#05944F] text-white inline-flex items-center justify-center">
                        <User className="w-2.5 h-2.5 fill-white" />
                      </span>
                    ) : (
                      <span className="w-2.5 h-2.5 bg-black dark:bg-white inline-block" />
                    )}
                    <span>
                      {liveDistanceLabel ??
                        `${stage === 'pickup' ? trip.pickupMiles : trip.tripMiles} mi`}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#545454] dark:text-neutral-400 font-medium truncate">
                    {stage === 'pickup'
                      ? trip.serviceName === 'Uber Eats'
                        ? `Collect ${trip.eatsOrderCode || 'Uber Eats'} · ${trip.merchantName || trip.pickupAddress}`
                        : `Picking up ${trip.riderName}`
                      : trip.stopAddress && !stopVisited
                      ? `Stop 1: ${trip.stopAddress}`
                      : trip.merchantName
                      ? `Delivering ${trip.merchantName} · ${trip.dropoffAddress}`
                      : `To ${trip.dropoffAddress}`}
                  </p>
                  {!sheetExpanded && (
                    <p className="text-[11px] font-semibold text-[#276EF1] dark:text-[#7AB0FF] truncate tabular-nums mt-0.5">
                      {[
                        trip.paymentMethod === 'cash'
                          ? stage === 'enroute' && liveMeterFare
                            ? `Cash Meter £${liveMeterFare.toFixed(2)}`
                            : `Cash Est. £${trip.fare.toFixed(2)}`
                          : `£${trip.fare.toFixed(2)} ${trip.serviceName}`,
                        airportBayInfo ? `${airportBayInfo.airportCode} ${airportBayInfo.anprCode}` : null,
                        trip.requiresAgeCheck ? 'Challenge 25' : null,
                        weatherCondition !== 'Clear' ? `${weatherCondition} +${weatherInfo.surgeAdd.toFixed(2)}x` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setSheetExpanded((v) => !v);
                  }}
                  className="relative w-11 h-11 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center transition-colors shrink-0"
                  aria-label={sheetExpanded ? 'Hide job details' : 'Show job details'}
                >
                  {sheetExpanded ? (
                    <ChevronDown className="w-5 h-5 text-black dark:text-white" />
                  ) : (
                    <ChevronUp className="w-5 h-5 text-black dark:text-white" />
                  )}
                </button>
              </div>
            </div>

            {/* Keep Cash Taxi Meter mounted during enroute so timer/extras keep running seamlessly */}
            {stage === 'enroute' && trip.paymentMethod === 'cash' && trip.isMeteredFare && !sheetExpanded && (
              <div className="hidden" aria-hidden="true">
                <TaxiMeterWidget
                  trip={trip}
                  stage={stage}
                  navProgress={navProgress}
                  onFareChange={setLiveMeterFare}
                />
              </div>
            )}

            {/* Expanded Scrollable Job Details Drawer */}
            {sheetExpanded && (
              <div
                ref={detailsScrollRef}
                onTouchStart={handleSheetTouchStart}
                onTouchMove={handleSheetTouchMove}
                onTouchEnd={handleSheetTouchEnd}
                className="flex-1 min-h-0 overflow-y-auto px-4 pb-3 pt-1 space-y-2.5 border-t border-[#EEEEEE] dark:border-white/10"
              >
                {/* Live UK Weather Advisory (inside pull-up menu so map edges stay clear) */}
                {weatherCondition !== 'Clear' && (
                  <div className="bg-[#0F172A] text-white rounded-xl px-3 py-2 border border-sky-400/30 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <CloudRain className="w-4 h-4 text-sky-400 shrink-0" />
                      <p className="text-[12px] font-semibold truncate">{weatherInfo.advisory}</p>
                    </div>
                    <span className="text-sky-300 text-[11px] font-bold shrink-0 tabular-nums">
                      +{weatherInfo.surgeAdd.toFixed(2)}x
                    </span>
                  </div>
                )}

                {/* Cash Taxi Meter (Live interactive meter during enroute) */}
                {stage === 'enroute' && trip.paymentMethod === 'cash' && trip.isMeteredFare && (
                  <TaxiMeterWidget
                    trip={trip}
                    stage={stage}
                    navProgress={navProgress}
                    onFareChange={setLiveMeterFare}
                  />
                )}

                {/* Eats Store / Restaurant Pickup Details */}
                {trip.serviceName === 'Uber Eats' && trip.merchantName && (
                  <div className="p-3 rounded-xl bg-[#FFFBEB] dark:bg-amber-950/40 border border-[#F59E0B]/30 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-extrabold text-[#B45309] dark:text-amber-300">
                        <Store className="w-3.5 h-3.5" />
                        {trip.merchantName}
                        {trip.merchantCategory === 'grocery'
                          ? ' (Grocery Shop)'
                          : trip.merchantCategory === 'pharmacy'
                          ? ' (Pharmacy)'
                          : ' (Restaurant)'}
                      </span>
                      {trip.requiresAgeCheck && (
                        <span className="inline-flex items-center gap-1 text-[#E11900] dark:text-red-300 text-[10.5px] font-extrabold">
                          <ShieldAlert className="w-3 h-3" />
                          Challenge 25
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#545454] dark:text-neutral-300 leading-snug">
                      {trip.riderNote || `Order ${trip.eatsOrderCode ?? '#UE'} · Check bag seal & receipt`}
                    </p>
                  </div>
                )}

                {/* Cash Job Pickup Notice */}
                {stage === 'pickup' && trip.paymentMethod === 'cash' && (
                  <div className="px-3 py-2.5 rounded-xl bg-[#E6F4EA] dark:bg-emerald-950/50 border border-[#05944F]/30 flex items-center justify-between text-[12px]">
                    <span className="font-bold text-[#05944F] flex items-center gap-1.5">
                      <Banknote className="w-4 h-4" />
                      Cash Job · UK Taxi Meter starts on pickup
                    </span>
                    <span className="font-extrabold text-black dark:text-white tabular-nums">
                      Est. £{trip.fare.toFixed(2)}
                    </span>
                  </div>
                )}

                {/* Airport Terminal Pickup Bay + ANPR Pass */}
                {airportBayInfo && (
                  <div className="p-3 rounded-xl bg-[#E8F0FE] dark:bg-[#192338] border border-[#276EF1]/30 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#276EF1] uppercase tracking-wide">
                        <Plane className="w-3.5 h-3.5" />
                        {airportBayInfo.airportCode} Terminal Pickup Bay
                      </span>
                      <span className="inline-flex items-center gap-1 text-[#05944F] text-[11px] font-extrabold tabular-nums">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        {airportBayInfo.anprCode}
                      </span>
                    </div>
                    <p className="text-[12.5px] font-bold text-black dark:text-white leading-snug">
                      {airportBayInfo.bayLocation}
                    </p>
                    <p className="text-[11px] font-semibold text-[#545454] dark:text-neutral-300 tabular-nums">
                      Plate {airportBayInfo.plate} · {airportBayInfo.passWindow}
                    </p>
                  </div>
                )}

                {/* ULEZ & Bridge/Congestion Surcharge */}
                {trip.ulezStatus && (
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#F3F3F3] dark:bg-white/5 text-[11.5px] font-semibold text-[#276EF1]">
                    <span>{trip.ulezStatus}</span>
                    {trip.surchargeLabel && trip.surchargeAmount ? (
                      <span className="tabular-nums font-bold">
                        {trip.surchargeLabel} (+£{trip.surchargeAmount.toFixed(2)})
                      </span>
                    ) : null}
                  </div>
                )}

                {/* Waybill Summary */}
                <div className="rounded-xl bg-[#F6F6F6] dark:bg-white/5 p-3 space-y-1.5 text-[12.5px] text-[#333333] dark:text-neutral-300">
                  <div className="flex items-center justify-between font-bold text-black dark:text-white pb-1 border-b border-black/10 dark:border-white/10">
                    <span>
                      {trip.riderName} · ★ {trip.rating.toFixed(2)} ({trip.riderTrips} trips)
                    </span>
                    <span className="tabular-nums">
                      £{(stage === 'enroute' && trip.isMeteredFare && liveMeterFare ? liveMeterFare : trip.fare).toFixed(2)} · {trip.serviceName}
                    </span>
                  </div>
                  <p>
                    <span className="font-semibold text-[#05944F]">Pickup:</span> {trip.pickupAddress}, {trip.pickupArea}
                  </p>
                  {trip.stopAddress && (
                    <p>
                      <span className="font-semibold text-[#B45309] dark:text-amber-300">Stop 1:</span>{' '}
                      {trip.stopAddress}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold text-black dark:text-white">Dropoff:</span>{' '}
                    {trip.dropoffAddress}, {trip.dropoffArea}
                  </p>
                  {trip.pinCode && (
                    <p className="text-[#276EF1] font-semibold tabular-nums">
                      4-Digit Rider Verification PIN: {trip.pinCode}
                    </p>
                  )}
                </div>

                {/* Turn-by-Turn Route Steps */}
                {routeSteps.length > 0 && (
                  <div className="pt-1 space-y-1.5">
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
                            : 'bg-[#F8F8F8] dark:bg-white/5 text-black dark:text-neutral-200'
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

                {/* External Navigation & Cancel Trip */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <a
                    href={externalNavHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 rounded-xl bg-[#E8F0FE] dark:bg-[#276EF1]/20 text-[#276EF1] dark:text-[#7AB0FF] text-[12.5px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#D9E7FD] transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>{externalNavLabel}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setSheetExpanded(false);
                      onCancelTrip();
                    }}
                    className="h-11 rounded-xl bg-[#FEECEB] dark:bg-red-950/50 text-[#E11900] dark:text-red-300 text-[12.5px] font-bold hover:bg-[#FDD8D5] transition-colors"
                  >
                    Cancel Trip
                  </button>
                </div>
              </div>
            )}

            {/* Pinned Primary Action Bar */}
            <div className="px-4 pb-3.5 pt-2 border-t border-[#EEEEEE] dark:border-white/10 flex items-center justify-between gap-2 shrink-0 bg-white dark:bg-[#141416]">
              <button
                type="button"
                onClick={() => setShowRiderContact((v) => !v)}
                className="relative flex-1 h-11 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E8E8E8] dark:hover:bg-white/15 text-[13px] font-semibold text-black dark:text-white flex items-center justify-center gap-1.5 transition-colors px-2 min-w-0"
              >
                <Phone className="w-4 h-4 shrink-0" />
                <span className="truncate">Contact {trip.riderName}</span>
                {unreadChatCount > 0 && !showRiderContact && (
                  <span className="ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#276EF1] text-white text-[10.5px] font-bold flex items-center justify-center tabular-nums shrink-0">
                    {unreadChatCount}
                  </span>
                )}
              </button>
              {navProvider !== 'uber' && !sheetExpanded && (
                <a
                  href={externalNavHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-11 h-11 rounded-xl bg-[#E8F0FE] dark:bg-[#276EF1]/20 text-[#276EF1] dark:text-[#7AB0FF] flex items-center justify-center shrink-0"
                  aria-label={`Open in ${externalNavLabel}`}
                  title={`Navigate in ${externalNavLabel}`}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
              {stage === 'pickup' ? (
                <button
                  type="button"
                  onClick={onArrivePickup}
                  className="flex-1 h-11 rounded-xl bg-black dark:bg-[#276EF1] hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] text-white text-[13px] font-semibold transition-colors whitespace-nowrap px-3"
                >
                  Confirm Pickup
                </button>
              ) : trip.stopAddress && !stopVisited && onArriveStop ? (
                <button
                  type="button"
                  onClick={onArriveStop}
                  className="flex-1 h-11 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-black text-[13px] font-bold whitespace-nowrap px-3 transition-colors"
                >
                  Arrived at Stop 1
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onArriveDropoff}
                  className="flex-1 h-11 rounded-xl bg-black dark:bg-[#276EF1] hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] text-white text-[13px] font-semibold whitespace-nowrap px-3 transition-colors"
                >
                  Arrived at Dropoff
                </button>
              )}
            </div>
          </div>
        )}

        {/* STAGE 2: WAITING FOR RIDER (+ UK Paid Wait Time, Rider No-Show +£4.20 & 4-Digit Rider PIN) */}
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
                  Verify PIN & Confirm Pickup
                </button>
              </div>
            ) : showStartConfirm ? (
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-[#E6F4EA] dark:bg-emerald-950/60 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-[#05944F]" />
                    </div>
                    <div>
                      <p className="text-[17px] font-extrabold text-black dark:text-white leading-tight">
                        {trip.serviceName === 'Uber Eats'
                          ? 'Ready to start delivery?'
                          : 'Ready to start journey?'}
                      </p>
                      <p className="text-[12.5px] text-[#545454] dark:text-neutral-400">
                        {trip.serviceName === 'Uber Eats'
                          ? `Confirm ${trip.riderName}'s order is collected & ready for drop-off`
                          : `Confirm ${trip.riderName} is inside & ready for drop-off`}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStartConfirm(false)}
                    className="w-8 h-8 rounded-full bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center shrink-0"
                    aria-label="Back to waiting screen"
                  >
                    <X className="w-4 h-4 text-black dark:text-white" />
                  </button>
                </div>

                <div className="rounded-xl bg-[#F6F6F6] dark:bg-white/5 p-3 text-[12.5px] space-y-1">
                  <div className="flex items-center justify-between font-bold text-black dark:text-white">
                    <span>{trip.serviceName} · {trip.riderName}</span>
                    <span className="tabular-nums">£{trip.fare.toFixed(2)}</span>
                  </div>
                  <p className="text-[#545454] dark:text-neutral-300 truncate">
                    Dropoff: {trip.dropoffAddress}, {trip.dropoffArea}
                  </p>
                  <p className="text-[11.5px] text-[#757575] dark:text-neutral-400 tabular-nums">
                    Est. {trip.tripMinutes} min ({trip.tripMiles} mi)
                    {accruedWaitFee > 0 ? ` · +£${accruedWaitFee.toFixed(2)} wait fee` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowStartConfirm(false)}
                    className="h-11 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-[13.5px] font-bold text-black dark:text-white transition-colors"
                  >
                    Keep Waiting
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartConfirm(false);
                      onStartTrip(accruedWaitFee);
                    }}
                    className="h-11 rounded-xl bg-[#05944F] hover:bg-[#047A40] text-white text-[13.5px] font-bold transition-colors"
                  >
                    Yes, Start Journey
                  </button>
                </div>
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
                      {trip.serviceName === 'Uber Eats'
                        ? waitSecondsLeft > 0
                          ? `Collecting ${trip.eatsOrderCode || 'Uber Eats Order'}`
                          : 'Restaurant prep delay (+£0.20/min)'
                        : waitSecondsLeft > 0
                        ? 'Waiting for rider'
                        : 'Charging wait time (£0.20/min)'}
                    </p>
                    <div className="mt-1 flex items-center justify-center gap-2">
                      <div
                        className={`inline-flex items-center justify-center gap-2 px-4 py-0.5 rounded-full border-[1.5px] text-[15px] font-bold tabular-nums ${
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
                      {!noShowEligible && (
                        <button
                          type="button"
                          onClick={() => {
                            setWaitSecondsLeft(0);
                            setPaidWaitSeconds(180);
                          }}
                          className="text-[10.5px] font-bold text-[#276EF1] bg-[#E8F0FE] dark:bg-[#276EF1]/20 px-2 py-1 rounded-full"
                          title="Simulate 5:00 elapsed wait"
                        >
                          Skip 5m
                        </button>
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

                {noShowEligible && onNoShowCancel && (
                  <button
                    type="button"
                    onClick={() => onNoShowCancel(4.2)}
                    className="w-full mb-2.5 h-10 rounded-xl bg-[#FEECEB] dark:bg-red-950/50 border border-[#E11900]/25 text-[#E11900] dark:text-red-300 text-[13px] font-bold flex items-center justify-center gap-1.5 hover:bg-[#FDD8D5] transition-colors"
                  >
                    <UserX className="w-4 h-4" />
                    Rider Didn’t Show · Collect +£4.20 Fee
                  </button>
                )}

                <div className="flex items-center justify-between px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => setShowRiderContact((v) => !v)}
                    className="relative w-12 h-12 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center transition-colors"
                    aria-label="Call or message rider"
                  >
                    <Phone className="w-5 h-5 text-black dark:text-white" />
                    {unreadChatCount > 0 && !showRiderContact && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#276EF1] text-white text-[10.5px] font-bold flex items-center justify-center tabular-nums">
                        {unreadChatCount}
                      </span>
                    )}
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

                {airportBayInfo && (
                  <div className="mb-2.5 px-3 py-2 rounded-xl bg-[#E8F0FE] dark:bg-[#192338] border border-[#276EF1]/30 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11.5px] font-bold text-[#276EF1] truncate">
                        {airportBayInfo.bayLocation}
                      </p>
                      <p className="text-[10.5px] font-semibold text-[#545454] dark:text-neutral-300 tabular-nums">
                        {airportBayInfo.plate} · {airportBayInfo.passWindow}
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#05944F] text-white text-[10px] font-extrabold tabular-nums shrink-0">
                      {airportBayInfo.anprCode}
                    </span>
                  </div>
                )}

                <div className="mt-2">
                  <SwipeButton
                    label={
                      trip.pinCode
                        ? `Enter PIN & Start ${trip.serviceName}`
                        : `Start ${trip.serviceName}`
                    }
                    onComplete={handleStartSwipeComplete}
                    variant="green"
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Stage 3A enroute is handled by the Pull-Up Job Details Menu above */}

        {/* STAGE 3B: MULTI-STOP WAIT */}
        {stage === 'stop_wait' && (
          <div className="p-4">
            <div className="text-center mb-3">
              <span className="px-2.5 py-0.5 rounded-full bg-[#FEF3C7] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 text-[11px] font-bold">
                STOP 1 REACHED
              </span>
              <h4 className="text-[18px] font-extrabold text-black dark:text-white mt-1.5">
                {trip.stopAddress}
              </h4>
              <p className="text-[12.5px] text-[#545454] dark:text-neutral-400 mt-0.5">
                Final destination: {trip.dropoffAddress}
              </p>
            </div>
            <SwipeButton
              label="Continue to Final Dropoff"
              onComplete={() => onContinueFromStop?.()}
              variant="green"
            />
          </div>
        )}

        {/* STAGE 3C: ARRIVED AT DROPOFF */}
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
                {trip.serviceName === 'Uber Eats' ? 'Arrived at Delivery Address' : 'Arrived at dropoff'}
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

            <div className="flex items-center justify-between px-4 py-2.5">
              <button
                type="button"
                onClick={() => setShowRiderContact((v) => !v)}
                className="relative w-12 h-12 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center transition-colors"
                aria-label="Contact rider"
              >
                <Phone className="w-5 h-5 text-black dark:text-white" />
                {unreadChatCount > 0 && !showRiderContact && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#276EF1] text-white text-[10.5px] font-bold flex items-center justify-center tabular-nums">
                    {unreadChatCount}
                  </span>
                )}
              </button>

              <div className="text-center">
                <span className="text-[22px] font-extrabold tracking-tight text-black dark:text-white block">
                  {trip.riderName}
                </span>
                {trip.eatsOrderCode && (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-bold text-[#05944F]">
                    <Package className="w-3.5 h-3.5" />
                    Order {trip.eatsOrderCode}
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

            {trip.serviceName === 'Uber Eats' && eatsDeliveryProof === 'none' ? (
              <div className="mt-2 p-3 rounded-2xl bg-[#F6F6F6] dark:bg-white/5 border border-black/10 dark:border-white/10 space-y-2.5">
                <p className="text-[12.5px] font-bold text-black dark:text-white text-center">
                  Confirm delivery proof for {trip.eatsOrderCode || 'Uber Eats'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEatsDeliveryProof('photo_taken')}
                    className="h-11 rounded-xl bg-black dark:bg-[#276EF1] text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Photo at Door</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEatsDeliveryProof('handed')}
                    className="h-11 rounded-xl bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-black dark:text-white text-[12.5px] font-bold flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4 text-[#05944F]" />
                    <span>Handed Over</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {trip.serviceName === 'Uber Eats' && eatsDeliveryProof !== 'none' && (
                  <div className="mb-2.5 px-3 py-2 rounded-xl bg-[#E6F4EA] dark:bg-emerald-950/50 text-[#05944F] text-[12px] font-bold flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      {eatsDeliveryProof === 'photo_taken'
                        ? 'Leave-at-door photo captured'
                        : 'Handed directly to customer'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEatsDeliveryProof('none')}
                      className="underline text-[11px]"
                    >
                      Retake
                    </button>
                  </div>
                )}
                {trip.paymentMethod === 'cash' && trip.isMeteredFare && (
                  <div className="mb-3">
                    <TaxiMeterWidget
                      trip={trip}
                      stage={stage}
                      navProgress={1}
                      onFareChange={setLiveMeterFare}
                    />
                  </div>
                )}

                <div className="mt-2">
                  <SwipeButton
                    label={
                      trip.paymentMethod === 'cash' && liveMeterFare
                        ? `Collect £${liveMeterFare.toFixed(2)} Cash & Complete`
                        : `Complete ${trip.serviceName}`
                    }
                    onComplete={() => onCompleteTrip(trip.isMeteredFare ? liveMeterFare : undefined)}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
