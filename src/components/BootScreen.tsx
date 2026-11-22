import React, { useEffect, useState } from 'react';
import { Navigation } from 'lucide-react';

interface BootScreenProps {
  driverName?: string;
  city?: string;
  onFinish: () => void;
}

const BOOT_STEPS = [
  'Starting driver session…',
  'Syncing UK map & surge zones…',
  'Dispatch ready',
];

export const BootScreen: React.FC<BootScreenProps> = ({ driverName, city, onFinish }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [exiting, setExiting] = useState(false);
  const onFinishRef = React.useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      setStepIdx(2);
      const t1 = window.setTimeout(() => setExiting(true), 240);
      const t2 = window.setTimeout(() => onFinishRef.current(), 440);
      return () => {
        window.clearTimeout(t1);
        window.clearTimeout(t2);
      };
    }

    const tStep1 = window.setTimeout(() => setStepIdx(1), 480);
    const tStep2 = window.setTimeout(() => setStepIdx(2), 1020);
    const tFade = window.setTimeout(() => setExiting(true), 1380);
    const tDone = window.setTimeout(() => onFinishRef.current(), 1680);

    return () => {
      window.clearTimeout(tStep1);
      window.clearTimeout(tStep2);
      window.clearTimeout(tFade);
      window.clearTimeout(tDone);
    };
  }, []);

  const dismissNow = () => {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(() => onFinishRef.current(), 200);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Uber Driver"
      onClick={dismissNow}
      className={`fixed inset-0 z-[120] bg-black text-white flex flex-col items-center justify-between px-6 py-12 select-none transition-opacity duration-300 ${
        exiting ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="h-8" />

      {/* Center Uber Driver Emblem + Wordmark + Compositor Progress Bar */}
      <div className="flex flex-col items-center text-center max-w-xs w-full animate-boot-reveal">
        <div className="w-[84px] h-[84px] rounded-[24px] bg-[#141416] border border-white/15 flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.65)] mb-7">
          <div className="w-12 h-12 rounded-2xl bg-black border border-[#276EF1]/50 flex items-center justify-center">
            <Navigation className="w-6 h-6 text-white fill-white -translate-x-[0.5px] translate-y-[0.5px]" />
          </div>
        </div>

        <h1 className="text-[42px] font-extrabold tracking-tight leading-none text-white">
          Uber
        </h1>
        <p className="mt-2 text-[15px] font-semibold tracking-[0.18em] text-[#5B9BF8]">
          Driver UK
        </p>

        <div className="mt-9 w-48 h-1 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full w-full bg-[#276EF1] origin-left animate-boot-progress" />
        </div>

        <p className="mt-3.5 text-[13px] font-medium text-white/65 min-h-[20px]">
          {BOOT_STEPS[stepIdx]}
        </p>
      </div>

      {/* Bottom Driver Context + Skip Hint */}
      <div className="flex flex-col items-center gap-2 text-center">
        {driverName ? (
          <p className="text-[13px] font-medium text-white/60">
            {driverName}
            {city ? ` · ${city}` : ''}
          </p>
        ) : (
          <p className="text-[13px] font-medium text-white/50">UK Driver Partner</p>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismissNow();
          }}
          className="px-4 py-2 text-[12px] font-semibold text-white/45 hover:text-white/80 transition-colors"
        >
          Tap anywhere to continue
        </button>
      </div>
    </div>
  );
};
