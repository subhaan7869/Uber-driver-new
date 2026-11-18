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
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[20px] font-bold text-black">Destination Mode</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center"
            aria-label="Close Destination Mode"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 text-[#545454] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            placeholder="Where are you heading?"
            className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#F3F3F3] text-[14px] font-medium text-black placeholder:text-[#757575] focus:outline-none focus:ring-2 focus:ring-black"
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
                  ? 'bg-[#F3F3F3] ring-1 ring-black/15'
                  : 'hover:bg-[#FAFAFA]'
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-white border border-black/10 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4 text-black" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-black truncate">{item.name}</p>
                <p className="text-[12px] text-[#545454] truncate">{item.address}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Route Type Cards (1:1 Match to Image 1: Flexible route vs Faster route) */}
        <p className="text-[13px] font-semibold text-[#545454] mb-2.5">
          Choose route priority (2 of 2 daily filters left)
        </p>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            type="button"
            onClick={() => setRouteType('flexible')}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              routeType === 'flexible'
                ? 'border-black bg-white shadow-sm'
                : 'border-[#EEEEEE] bg-[#FAFAFA] hover:border-black/30'
            }`}
          >
            {/* Triple upward arrows icon matching Image 1 */}
            <div className="mb-3 text-black">
              <Navigation className="w-6 h-6 -rotate-45 stroke-[2.2]" />
            </div>
            <p className="text-[16px] font-bold text-black leading-snug">
              Flexible route
            </p>
            <p className="text-[13px] text-[#545454] mt-1 leading-snug">
              Higher chance of rides
            </p>
            <p className="text-[13px] font-semibold text-black mt-2 tabular-nums">
              {chosen.flexibleTime}
            </p>
          </button>

          <button
            type="button"
            onClick={() => setRouteType('faster')}
            className={`p-4 rounded-2xl border-2 text-left transition-all ${
              routeType === 'faster'
                ? 'border-black bg-white shadow-sm'
                : 'border-[#EEEEEE] bg-[#FAFAFA] hover:border-black/30'
            }`}
          >
            <div className="mb-3 text-black">
              <Gauge className="w-6 h-6 stroke-[2.2]" />
            </div>
            <p className="text-[16px] font-bold text-black leading-snug">
              Faster route
            </p>
            <p className="text-[13px] text-[#545454] mt-1 leading-snug">
              Lower chance of rides
            </p>
            <p className="text-[13px] font-semibold text-black mt-2 tabular-nums">
              {chosen.fasterTime}
            </p>
          </button>
        </div>

        <div className="flex gap-2.5">
          {destination.active && (
            <button
              type="button"
              onClick={onClear}
              className="flex-1 h-12 rounded-xl bg-[#EEEEEE] hover:bg-[#E2E2E2] text-[15px] font-bold text-black transition-colors"
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
