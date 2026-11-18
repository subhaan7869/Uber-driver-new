import React, { useState } from 'react';
import { ChevronRight, Download, Share, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'row' | 'pill';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'row',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (variant === 'pill') {
    if (!isInstallable && !isIOS) return null;

    return (
      <>
        <button
          type="button"
          onClick={isInstallable ? install : () => setShowIOSGuide(true)}
          className="h-9 px-3.5 rounded-full bg-black text-white text-[12px] font-bold shadow-lg border border-white/15 flex items-center gap-1.5 hover:bg-neutral-800 active:scale-95 transition-all whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-[#276EF1]" />
          <span>{isInstallable ? 'Install App' : 'Install on iOS'}</span>
        </button>

        {showIOSGuide && (
          <IOSInstallModal onClose={() => setShowIOSGuide(false)} />
        )}
      </>
    );
  }

  // Menu row / card variant
  if (!isInstallable && !isIOS) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={isInstallable ? install : () => setShowIOSGuide(true)}
        className="w-full py-3.5 flex items-center justify-between hover:bg-[#FAFAFA] transition-colors text-left"
      >
        <div className="flex items-center gap-3.5">
          <div className="w-8 h-8 rounded-lg bg-[#E8F0FE] flex items-center justify-center shrink-0">
            {isInstallable ? (
              <Download className="w-4 h-4 text-[#276EF1]" />
            ) : (
              <Smartphone className="w-4 h-4 text-[#276EF1]" />
            )}
          </div>
          <div>
            <p className="text-[16px] font-semibold text-black">
              {isInstallable ? 'Install Uber Driver App' : 'Add to Home Screen'}
            </p>
            <p className="text-[12px] text-[#545454]">
              Launch full-screen with offline support
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
      </button>

      {showIOSGuide && (
        <IOSInstallModal onClose={() => setShowIOSGuide(false)} />
      )}
    </>
  );
};

const IOSInstallModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
    <div className="bg-white w-full sm:max-w-[380px] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-black/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[19px] font-bold text-black">
          Install on iPhone / iPad
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-[#F3F3F3] flex items-center justify-center"
          aria-label="Close install instructions"
        >
          <X className="w-4 h-4 text-black" />
        </button>
      </div>
      <div className="space-y-3 text-[14px] text-[#333333] leading-relaxed">
        <p className="flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-[#EEEEEE] text-black text-[12px] font-bold flex items-center justify-center shrink-0">
            1
          </span>
          <span>
            Tap the <strong className="text-black inline-flex items-center gap-1">Share <Share className="w-3.5 h-3.5 inline" /></strong> button in the Safari toolbar.
          </span>
        </p>
        <p className="flex items-start gap-2.5">
          <span className="w-6 h-6 rounded-full bg-[#EEEEEE] text-black text-[12px] font-bold flex items-center justify-center shrink-0">
            2
          </span>
          <span>
            Scroll down and tap <strong className="text-black">Add to Home Screen</strong>.
          </span>
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="mt-5 w-full h-11 rounded-xl bg-black text-white text-[14px] font-bold hover:bg-neutral-800 transition-colors"
      >
        Got it
      </button>
    </div>
  </div>
);
