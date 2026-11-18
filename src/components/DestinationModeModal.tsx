import React, { useState } from 'react';
import { Gauge, MapPin, Navigation, Search, X } from 'lucide-react';
import { PRESET_DESTINATIONS } from '../data/mockDriverData';
import { DestinationConfig } from '../types/driver';

interface DestinationModeModalProps {
  destination: DestinationConfig;
  onActivate: (config: DestinationConfig) => void;
  onClear: () => void;
  onClose: () => void;
}

export const DestinationModeModal: React.FC<DestinationModeModalProps> = ({
  destination,
  onActivate,
  onClear,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [routeType, setRouteType] = useState<'flexible' | 'faster'>(destination.routeType);

  const filtered = PRESET_DESTINATIONS.filter(
    (d) =>
      d.name.toLowerCase().includes(query.toLowerCase()) ||
      d.address.toLowerCase().includes(query.toLowerCase())
  );

  const chosen = filtered[selectedIdx] || PRESET_DESTINATIONS[0];

  const handleSetDestination = () => {
    onActivate({
      active: true,
      destinationName: chosen.name,
      destinationAddress: chosen.address,
      routeType,
      arriveBy: routeType === 'flexible' ? chosen.flexibleTime : chosen.fasterTime,
      coords: chosen.coords,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#141416] w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[20px] font-bold text-black dark:text-white">Destination Mode</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
            aria-label="Close Destination Mode"
          >
            <X className="w-5 h-5 text-black dark:text-white" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-[#545454] dark:text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            placeholder="Where are you heading?"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-[14px] font-medium text-black dark:text-white placeholder:text-[#757575] dark:placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-black dark:focus:ring-[#276EF1]"
          />
        </div>

        {/* Saved Destinations */}
        <div className="space-y-1.5 mb-5">
          {filtered.map((item, idx) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setSelectedIdx(idx)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                chosen.name === item.name
                  ? 'bg-[#F3F3F3] dark:bg-white/10 ring-1 ring-black/15 dark:ring-white/20'
                  : 'hover:bg-[#FAFAFA] dark:hover:bg-white/5'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-black dark:text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-black dark:text-white truncate">{item.name}</p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400 truncate">{item.address}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Route Type Cards */}
        <p className="text-[13px] font-semibold text-[#545454] dark:text-neutral-400 mb-2.5">
          Choose route priority (2 of 2 daily filters left)
        </p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setRouteType('flexible')}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              routeType === 'flexible'
                ? 'border-black dark:border-[#276EF1] bg-white dark:bg-[#1B2230] shadow-sm'
                : 'border-[#EEEEEE] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] hover:border-black/30'
            }`}
          >
            <div className="mb-3 text-black dark:text-white">
              <Navigation className="w-6 h-6 -rotate-45 stroke-[2.2]" />
            </div>
            <p className="text-[16px] font-bold text-black dark:text-white leading-snug">
              Flexible route
            </p>
            <p className="text-[13px] text-[#545454] dark:text-neutral-400 mt-1 leading-snug">
              Higher chance of rides
            </p>
            <p className="text-[13px] font-semibold text-black dark:text-white mt-2 tabular-nums">
              {chosen.flexibleTime}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setRouteType('faster')}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              routeType === 'faster'
                ? 'border-black dark:border-[#276EF1] bg-white dark:bg-[#1B2230] shadow-sm'
                : 'border-[#EEEEEE] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] hover:border-black/30'
            }`}
          >
            <div className="mb-3 text-black dark:text-white">
              <Gauge className="w-6 h-6 stroke-[2.2]" />
            </div>
            <p className="text-[16px] font-bold text-black dark:text-white leading-snug">
              Faster route
            </p>
            <p className="text-[13px] text-[#545454] dark:text-neutral-400 mt-1 leading-snug">
              Lower chance of rides
            </p>
            <p className="text-[13px] font-semibold text-black dark:text-white mt-2 tabular-nums">
              {chosen.fasterTime}
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
            onClick={handleSetDestination}
            className="flex-1 h-12 rounded-xl bg-[#276EF1] hover:bg-[#1E5CD4] text-[15px] font-bold text-white transition-colors"
          >
            Set Destination
          </button>
        </div>
      </div>
    </div>
  );
};
