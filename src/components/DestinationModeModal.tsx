import React, { useEffect, useMemo, useState } from 'react';
import { Compass, Gauge, Loader2, LocateFixed, MapPin, Navigation, Search, X } from 'lucide-react';
import { PRESET_DESTINATIONS } from '../data/mockDriverData';
import { Coordinates, DestinationConfig } from '../types/driver';
import { haversineMiles, searchUKPlaces, UKPlaceSearchResult } from '../utils/localDispatch';
import { mapToLatLng, UK_AIRPORT_MAP_PINS, UK_CITIES } from '../utils/ukGeo';

interface DestinationCandidate {
  id: string;
  name: string;
  address: string;
  coords: Coordinates;
  isMyLocation?: boolean;
  milesAway?: number;
}

interface DestinationModeModalProps {
  destination: DestinationConfig;
  currentJobCity?: string;
  myLocationLabel?: string;
  myLocationCoords?: Coordinates;
  hasLiveGps?: boolean;
  driverPos?: Coordinates;
  onActivate: (config: DestinationConfig) => void;
  onClear: () => void;
  onClose: () => void;
}

function formatEtaFromMiles(miles: number, speedMph: number): string {
  const mins = Math.max(8, Math.round((miles / speedMph) * 60));
  const eta = new Date(Date.now() + mins * 60_000);
  const hh = eta.getHours().toString().padStart(2, '0');
  const mm = eta.getMinutes().toString().padStart(2, '0');
  return `Est. ${hh}:${mm}`;
}

export const DestinationModeModal: React.FC<DestinationModeModalProps> = ({
  destination,
  currentJobCity = 'Current Area',
  myLocationLabel = 'My Location',
  myLocationCoords,
  hasLiveGps = false,
  driverPos,
  onActivate,
  onClear,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(
    myLocationCoords ? 'my-location' : `preset-${PRESET_DESTINATIONS[0].name}`
  );
  const [routeType, setRouteType] = useState<'flexible' | 'faster'>(destination.routeType);
  const [remoteResults, setRemoteResults] = useState<UKPlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const driverLatLng = useMemo(
    () => (driverPos ? mapToLatLng(driverPos) : undefined),
    [driverPos]
  );

  const calcMilesAway = useMemo(() => {
    return (coords: Coordinates): number | undefined => {
      if (!driverLatLng) return undefined;
      const targetLL = mapToLatLng(coords);
      return Number(
        haversineMiles(driverLatLng.lat, driverLatLng.lng, targetLL.lat, targetLL.lng).toFixed(1)
      );
    };
  }, [driverLatLng]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRemoteResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void searchUKPlaces(trimmed, driverLatLng).then((results) => {
        if (cancelled) return;
        setRemoteResults(results);
        setSearching(false);
      });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, driverLatLng]);

  const myLocationCandidate: DestinationCandidate | null = useMemo(() => {
    if (!myLocationCoords) return null;
    return {
      id: 'my-location',
      name: `Near ${myLocationLabel}`,
      address: hasLiveGps
        ? `Your live GPS area · From ${currentJobCity}`
        : `Home base (${myLocationLabel}) · From ${currentJobCity}`,
      coords: myLocationCoords,
      isMyLocation: true,
      milesAway: calcMilesAway(myLocationCoords),
    };
  }, [myLocationCoords, myLocationLabel, hasLiveGps, currentJobCity, calcMilesAway]);

  const candidates: DestinationCandidate[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list: DestinationCandidate[] = [];
    const seen = new Set<string>();

    const pushCandidate = (item: DestinationCandidate) => {
      const key = item.name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push(item);
    };

    if (myLocationCandidate && (!q || `${myLocationCandidate.name} ${myLocationCandidate.address}`.toLowerCase().includes(q))) {
      pushCandidate(myLocationCandidate);
    }

    if (q.length >= 2) {
      for (const r of remoteResults) {
        pushCandidate({
          id: `remote-${r.name}-${r.address}`,
          name: r.name,
          address: r.address,
          coords: r.coords,
          milesAway: calcMilesAway(r.coords),
        });
      }

      for (const ap of UK_AIRPORT_MAP_PINS) {
        const label = `${ap.name} Airport (${ap.code})`;
        if (label.toLowerCase().includes(q) || ap.code.toLowerCase().includes(q)) {
          pushCandidate({
            id: `airport-${ap.code}`,
            name: label,
            address: `UK Airport Authorised Pickup · ${ap.name}`,
            coords: ap.coords,
            milesAway: calcMilesAway(ap.coords),
          });
        }
      }

      for (const city of UK_CITIES) {
        const formatted = city.name
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
        if (formatted.toLowerCase().includes(q)) {
          pushCandidate({
            id: `city-${city.name}`,
            name: `${formatted} City Centre`,
            address: `${formatted}, UK`,
            coords: city.coords,
            milesAway: calcMilesAway(city.coords),
          });
        }
      }
    }

    for (const d of PRESET_DESTINATIONS) {
      if (!q || d.name.toLowerCase().includes(q) || d.address.toLowerCase().includes(q)) {
        pushCandidate({
          id: `preset-${d.name}`,
          name: d.name,
          address: d.address,
          coords: d.coords,
          milesAway: calcMilesAway(d.coords),
        });
      }
    }

    return list;
  }, [query, myLocationCandidate, remoteResults, calcMilesAway]);

  const chosen = useMemo(() => {
    return (
      candidates.find((c) => c.id === selectedId) ??
      candidates[0] ??
      myLocationCandidate ?? {
        id: 'fallback',
        name: PRESET_DESTINATIONS[0].name,
        address: PRESET_DESTINATIONS[0].address,
        coords: PRESET_DESTINATIONS[0].coords,
        milesAway: calcMilesAway(PRESET_DESTINATIONS[0].coords),
      }
    );
  }, [candidates, selectedId, myLocationCandidate, calcMilesAway]);

  const milesNum = chosen.milesAway ?? 12;
  const flexibleEta = formatEtaFromMiles(milesNum, 24);
  const fasterEta = formatEtaFromMiles(milesNum, 36);

  const activateTarget = (target: DestinationCandidate, mode: 'flexible' | 'faster') => {
    const m = target.milesAway ?? 12;
    onActivate({
      active: true,
      destinationName: target.name,
      destinationAddress: target.address,
      routeType: mode,
      arriveBy: mode === 'flexible' ? formatEtaFromMiles(m, 24) : formatEtaFromMiles(m, 36),
      coords: target.coords,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#141416] w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-[20px] font-bold text-black dark:text-white">Destination Mode</h3>
            <p className="text-[12px] font-medium text-[#545454] dark:text-neutral-400">
              Job pickup area: {currentJobCity}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
            aria-label="Close Destination Mode"
          >
            <X className="w-5 h-5 text-black dark:text-white" />
          </button>
        </div>

        {/* 1-Tap Jobs From Job Location -> Near My Location */}
        {myLocationCandidate && (
          <div className="mb-4 p-3.5 rounded-2xl bg-[#EEF4FF] dark:bg-[#192338] border border-[#276EF1]/25 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#276EF1] text-white flex items-center justify-center shrink-0">
              <LocateFixed className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-extrabold text-black dark:text-white truncate">
                Jobs to {myLocationCandidate.name}
              </p>
              <p className="text-[12px] text-[#4B5563] dark:text-neutral-300 truncate tabular-nums">
                From {currentJobCity}
                {myLocationCandidate.milesAway !== undefined
                  ? ` · ${myLocationCandidate.milesAway} mi away`
                  : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => activateTarget(myLocationCandidate, routeType)}
              className="h-11 px-3.5 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[13px] font-bold shrink-0 active:scale-95 transition-all"
            >
              Route Me
            </button>
          </div>
        )}

        {/* UK Live Search Input */}
        <div className="relative mb-3.5">
          <Search className="w-4 h-4 text-[#545454] dark:text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search UK town, street or airport (e.g. Manchester)"
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-[14px] font-medium text-black dark:text-white placeholder:text-[#757575] dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-[#276EF1]"
          />
          {searching && (
            <Loader2 className="w-4 h-4 text-[#276EF1] animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
          )}
        </div>

        {/* Destinations List */}
        <div className="space-y-1.5 mb-5 max-h-[210px] overflow-y-auto pr-0.5">
          {candidates.map((item) => {
            const isSelected = chosen.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full min-h-[48px] flex items-center gap-3 p-2.5 rounded-xl text-left transition-colors ${
                  isSelected
                    ? 'bg-[#F3F3F3] dark:bg-white/10 ring-1 ring-black/15 dark:ring-white/25'
                    : 'hover:bg-[#FAFAFA] dark:hover:bg-white/5'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border ${
                    item.isMyLocation
                      ? 'bg-[#276EF1]/15 border-[#276EF1]/35 text-[#276EF1]'
                      : 'bg-white dark:bg-white/10 border-black/10 dark:border-white/10 text-black dark:text-white'
                  }`}
                >
                  {item.isMyLocation ? (
                    <Compass className="w-4 h-4" />
                  ) : (
                    <MapPin className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-black dark:text-white truncate">
                    {item.name}
                  </p>
                  <p className="text-[12px] text-[#545454] dark:text-neutral-400 truncate tabular-nums">
                    {item.address}
                    {item.milesAway !== undefined ? ` · ${item.milesAway} mi` : ''}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Route Type Cards */}
        <p className="text-[13px] font-semibold text-[#545454] dark:text-neutral-400 mb-2.5">
          How should jobs route from {currentJobCity}?
        </p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setRouteType('flexible')}
            className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
              routeType === 'flexible'
                ? 'border-black dark:border-[#276EF1] bg-white dark:bg-[#1B2230] shadow-sm'
                : 'border-[#EEEEEE] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] hover:border-black/30'
            }`}
          >
            <div className="mb-2.5 text-black dark:text-white">
              <Navigation className="w-5 h-5 -rotate-45 stroke-[2.2]" />
            </div>
            <p className="text-[15px] font-bold text-black dark:text-white leading-snug">
              Jobs toward target
            </p>
            <p className="text-[12px] text-[#545454] dark:text-neutral-400 mt-1 leading-snug">
              Step-by-step rides moving closer
            </p>
            <p className="text-[12px] font-semibold text-black dark:text-white mt-2 tabular-nums">
              {flexibleEta}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setRouteType('faster')}
            className={`p-3.5 rounded-2xl border-2 text-left transition-all ${
              routeType === 'faster'
                ? 'border-black dark:border-[#276EF1] bg-white dark:bg-[#1B2230] shadow-sm'
                : 'border-[#EEEEEE] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] hover:border-black/30'
            }`}
          >
            <div className="mb-2.5 text-black dark:text-white">
              <Gauge className="w-5 h-5 stroke-[2.2]" />
            </div>
            <p className="text-[15px] font-bold text-black dark:text-white leading-snug">
              Direct to target
            </p>
            <p className="text-[12px] text-[#545454] dark:text-neutral-400 mt-1 leading-snug">
              Dropoff right near destination
            </p>
            <p className="text-[12px] font-semibold text-black dark:text-white mt-2 tabular-nums">
              {fasterEta}
            </p>
          </button>
        </div>

        <div className="flex gap-2.5">
          {destination.active && (
            <button
              type="button"
              onClick={onClear}
              className="flex-1 h-12 rounded-xl bg-[#EEEEEE] dark:bg-white/10 hover:bg-[#E2E2E2] dark:hover:bg-white/15 text-[15px] font-bold text-black dark:text-white transition-colors"
            >
              Turn Off
            </button>
          )}
          <button
            type="button"
            onClick={() => activateTarget(chosen, routeType)}
            className="flex-1 h-12 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-[15px] font-bold text-white transition-colors"
          >
            Set Destination
          </button>
        </div>
      </div>
    </div>
  );
};
