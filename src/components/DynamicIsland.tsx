import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronUp,
  MapPin,
  Navigation,
  Power,
  Radar,
  ShieldCheck,
} from 'lucide-react';
import { DriverOnlineStatus, TripOffer, TripStage } from '../types/driver';
import { formatOnlineTimer } from '../utils/timeFormat';

interface DynamicIslandProps {
  onlineStatus: DriverOnlineStatus;
  onlineElapsedSec?: number;
  tripStage: TripStage;
  activeTrip: TripOffer | null;
  pendingOffer: TripOffer | null;
  gpsPermissionState: 'idle' | 'active' | 'denied';
  gpsExplicitlyAccepted: boolean;
  realCoords: { lat: number; lng: number } | null;
  liveEtaCountdown?: string;
  liveDistanceRemaining?: string;
  liveProgressPct?: number;
  todayEarnings: number;
  privacyHidden: boolean;
  onToggleOnline: () => void;
  onReturnToMap: () => void;
  onOpenPermissions: () => void;
  onEnableBlueGps?: () => void;
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({
  onlineStatus,
  onlineElapsedSec = 0,
  tripStage,
  activeTrip,
  pendingOffer,
  gpsPermissionState,
  gpsExplicitlyAccepted,
  realCoords,
  liveEtaCountdown,
  liveDistanceRemaining,
  liveProgressPct = 0,
  todayEarnings,
  privacyHidden,
  onToggleOnline,
  onReturnToMap,
  onOpenPermissions,
  onEnableBlueGps,
}) => {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handleOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, [expanded]);

  const isLocationActive =
    onlineStatus === 'online' ||
    tripStage !== 'idle' ||
    realCoords !== null ||
    gpsPermissionState === 'active' ||
    gpsExplicitlyAccepted;
  const isTripActive = activeTrip !== null && tripStage !== 'idle';

  const statusLabel = isTripActive
    ? tripStage === 'waiting'
      ? `Waiting · ${activeTrip.riderName}`
      : tripStage === 'dropoff_arrived'
      ? `Arrived · ${activeTrip.riderName}`
      : tripStage === 'completed'
      ? 'Trip Complete'
      : activeTrip.riderName
    : pendingOffer
    ? `${pendingOffer.serviceName} · £${pendingOffer.fare.toFixed(2)}`
    : onlineStatus === 'online'
    ? 'Online · GPS'
    : realCoords || gpsExplicitlyAccepted || gpsPermissionState === 'active'
    ? 'GPS Active'
    : 'Uber Driver';

  return (
    <div
      ref={containerRef}
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none"
    >
      {!expanded ? (
        /* COMPACT DYNAMIC ISLAND PILL (Fits cleanly inside iPhone notch/status safe center) */
        <div className="pointer-events-auto flex items-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Expand Dynamic Island status"
            className={`h-[32px] rounded-full bg-black text-white shadow-[0_8px_24px_rgba(0,0,0,0.32)] border flex items-center justify-between gap-2 px-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${
              isLocationActive ? 'border-[#276EF1]/55' : 'border-white/15'
            } ${
              isTripActive || pendingOffer
                ? 'min-w-[154px] max-w-[198px] sm:min-w-[196px] sm:max-w-[250px]'
                : isLocationActive
                ? 'min-w-[140px] max-w-[178px]'
                : 'min-w-[126px] max-w-[160px]'
            }`}
          >
            {/* Left slot: Authentic iOS Blue/Green Location Arrow when using GPS */}
            <div className="flex items-center gap-1.5 min-w-0">
              {isLocationActive ? (
                <span
                  className={`w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0 ${
                    tripStage === 'pickup' || tripStage === 'waiting'
                      ? 'bg-[#05944F] ring-2 ring-[#05944F]/35'
                      : 'bg-[#276EF1] ring-2 ring-[#276EF1]/45 shadow-[0_0_10px_rgba(39,110,241,0.7)]'
                  }`}
                >
                  <Navigation className="w-2.5 h-2.5 text-white fill-white -translate-x-[0.5px] translate-y-[0.5px]" />
                </span>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-[#2C2C2E] border border-white/25 shrink-0" />
              )}

              <span className="text-[11.5px] font-bold tracking-tight truncate">
                {statusLabel}
              </span>
            </div>

            {/* Right slot */}
            <div className="flex items-center gap-1 shrink-0 tabular-nums">
              {isTripActive && (tripStage === 'pickup' || tripStage === 'enroute') ? (
                <span
                  className={`text-[11.5px] font-extrabold ${
                    liveEtaCountdown === 'Arriving' ? 'text-[#05944F]' : 'text-[#5B9BF8]'
                  }`}
                >
                  {liveEtaCountdown ?? '...'}
                </span>
              ) : pendingOffer ? (
                <span className="text-[10.5px] font-extrabold text-[#5B9BF8]">Offer</span>
              ) : onlineStatus === 'online' ? (
                <span className="text-[11px] font-extrabold text-[#5B9BF8] tabular-nums">
                  {formatOnlineTimer(onlineElapsedSec)}
                </span>
              ) : isLocationActive ? (
                <div className="flex items-end gap-[2px] h-2.5">
                  <span className="w-[2px] h-1.5 bg-[#276EF1] rounded-full" />
                  <span className="w-[2px] h-2.5 bg-[#276EF1] rounded-full" />
                  <span className="w-[2px] h-2 bg-[#5B9BF8] rounded-full" />
                </div>
              ) : (
                <span className="text-[10.5px] font-semibold text-white/55">Offline</span>
              )}
            </div>
          </button>
        </div>
      ) : (
        /* EXPANDED DYNAMIC ISLAND LIVE ACTIVITY CARD */
        <div className="pointer-events-auto w-[348px] max-w-[calc(100vw-24px)] rounded-[28px] bg-[#0B0B0C] text-white p-4 shadow-[0_18px_48px_rgba(0,0,0,0.45)] border border-white/15">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                  isLocationActive
                    ? 'bg-[#276EF1] ring-2 ring-[#276EF1]/35'
                    : 'bg-white/10'
                }`}
              >
                {isLocationActive ? (
                  <Navigation className="w-4 h-4 text-white fill-white" />
                ) : (
                  <Radar className="w-4 h-4 text-white/70" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-extrabold leading-tight truncate tabular-nums">
                  {isTripActive
                    ? `${activeTrip.serviceName} · ${activeTrip.riderName}`
                    : onlineStatus === 'online'
                    ? `Online ${formatOnlineTimer(onlineElapsedSec)} · GPS`
                    : isLocationActive
                    ? 'Uber Driver · Blue GPS Active'
                    : 'Uber Driver · Offline'}
                </p>
                <p className="text-[11.5px] text-white/65 truncate mt-0.5 tabular-nums">
                  {realCoords
                    ? `GPS ${realCoords.lat.toFixed(4)}, ${realCoords.lng.toFixed(4)}`
                    : gpsPermissionState === 'denied' && isLocationActive
                    ? 'UK GPS active · Browser GPS blocked'
                    : isLocationActive
                    ? 'Blue GPS indicator active · UK'
                    : `Today: ${privacyHidden ? '£••••' : `£${todayEarnings.toFixed(2)}`}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
              aria-label="Collapse Dynamic Island"
            >
              <ChevronUp className="w-4 h-4 text-white" />
            </button>
          </div>

          {isTripActive && activeTrip ? (
            <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5">
              <div className="flex items-center justify-between text-[13px] tabular-nums">
                <span className="text-white/75 flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-[#05944F] shrink-0" />
                  <span className="truncate">
                    {tripStage === 'pickup' || tripStage === 'waiting'
                      ? activeTrip.pickupAddress
                      : activeTrip.dropoffAddress}
                  </span>
                </span>
                <span className="font-extrabold text-white shrink-0 ml-2">
                  {liveEtaCountdown ?? (tripStage === 'waiting' ? 'Waiting' : 'Arrived')}
                </span>
              </div>

              {(tripStage === 'pickup' || tripStage === 'enroute') && (
                <>
                  <div className="w-full h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className={`h-full ${
                        tripStage === 'pickup' ? 'bg-[#05944F]' : 'bg-[#276EF1]'
                      }`}
                      style={{ width: `${Math.max(6, liveProgressPct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-white/65 tabular-nums">
                    <span>{liveDistanceRemaining ?? ''} remaining</span>
                    <span>£{activeTrip.fare.toFixed(2)} payout</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
              {!isLocationActive && onEnableBlueGps ? (
                <button
                  type="button"
                  onClick={() => {
                    onEnableBlueGps();
                  }}
                  className="flex items-center gap-1.5 text-[11.5px] text-[#5B9BF8] font-bold hover:underline"
                >
                  <Navigation className="w-3.5 h-3.5 fill-[#5B9BF8] shrink-0" />
                  <span>Show Blue Icon</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onOpenPermissions();
                    setExpanded(false);
                  }}
                  className="flex items-center gap-1.5 text-[11.5px] text-white/80 hover:text-white underline-offset-2 hover:underline"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#05944F] shrink-0" />
                  <span>{isLocationActive ? 'Blue GPS active' : 'Permissions'}</span>
                </button>
              )}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    onReturnToMap();
                    setExpanded(false);
                  }}
                  className="px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25 text-[11px] font-bold text-white"
                >
                  Map
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onToggleOnline();
                    setExpanded(false);
                  }}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 ${
                    onlineStatus === 'online'
                      ? 'bg-[#E11900] text-white'
                      : 'bg-[#276EF1] text-white'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  {onlineStatus === 'online' ? 'Offline' : 'Go'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
