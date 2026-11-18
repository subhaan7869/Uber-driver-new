import React from 'react';
import {
  AlertTriangle,
  Car,
  Construction,
  GitMerge,
  MinusCircle,
  ShieldAlert,
  X,
} from 'lucide-react';
import { MapReportCategory } from '../types/driver';

interface MapReportModalProps {
  onSelectCategory: (category: MapReportCategory, label: string) => void;
  onClose: () => void;
}

const REPORT_ITEMS: Array<{
  category: MapReportCategory;
  label: string;
  renderIcon: () => React.ReactNode;
}> = [
  {
    category: 'traffic',
    label: 'Traffic',
    renderIcon: () => (
      <div className="w-12 h-12 rotate-45 rounded-xl bg-[#FFC043] border-2 border-black/80 flex items-center justify-center shadow-xs">
        <Car className="w-6 h-6 text-black -rotate-45" />
      </div>
    ),
  },
  {
    category: 'crash',
    label: 'Crash',
    renderIcon: () => (
      <div className="w-12 h-12 rotate-45 rounded-xl bg-[#FF6937] border-2 border-black/80 flex items-center justify-center shadow-xs">
        <AlertTriangle className="w-6 h-6 text-black -rotate-45" />
      </div>
    ),
  },
  {
    category: 'roadwork',
    label: 'Roadwork',
    renderIcon: () => (
      <div className="w-12 h-12 rotate-45 rounded-xl bg-[#FF8038] border-2 border-black/80 flex items-center justify-center shadow-xs">
        <Construction className="w-6 h-6 text-black -rotate-45" />
      </div>
    ),
  },
  {
    category: 'road_closed',
    label: 'Road closed',
    renderIcon: () => (
      <div className="w-14 h-14 rounded-full bg-[#E11900] border-2 border-white shadow-sm flex items-center justify-center">
        <MinusCircle className="w-8 h-8 text-white fill-white/15" />
      </div>
    ),
  },
  {
    category: 'police',
    label: 'Police',
    renderIcon: () => (
      <div className="w-12 h-12 rotate-45 rounded-xl bg-[#5B9BF8] border-2 border-black/80 flex items-center justify-center shadow-xs">
        <ShieldAlert className="w-6 h-6 text-black -rotate-45" />
      </div>
    ),
  },
  {
    category: 'lane_closure',
    label: 'Lane closure',
    renderIcon: () => (
      <div className="w-14 h-14 rounded-full bg-[#EEEEEE] border border-black/10 flex items-center justify-center">
        <GitMerge className="w-6 h-6 text-black" />
      </div>
    ),
  },
];

export const MapReportModal: React.FC<MapReportModalProps> = ({
  onSelectCategory,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-[380px] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-black/10">
        <div className="flex items-center justify-between mb-6">
          <div className="w-9" />
          <h3 className="text-[19px] font-bold text-black text-center">
            Add a map report
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center transition-colors"
            aria-label="Close map report"
          >
            <X className="w-4 h-4 text-black" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-y-7 gap-x-4 pb-2">
          {REPORT_ITEMS.map((item) => (
            <button
              key={item.category}
              type="button"
              onClick={() => onSelectCategory(item.category, item.label)}
              className="flex flex-col items-center gap-3 group focus:outline-none"
            >
              <div className="h-16 flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition-transform">
                {item.renderIcon()}
              </div>
              <span className="text-[13px] font-semibold text-black">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
