import React from 'react';
import { RefreshCw, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface OfflineIndicatorProps {
  pendingSyncCount?: number;
  isFlushing?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  pendingSyncCount = 0,
  isFlushing = false,
}) => {
  const isOnline = useOnlineStatus();

  if (isOnline && (!isFlushing || pendingSyncCount === 0)) {
    return null;
  }

  if (isOnline && isFlushing && pendingSyncCount > 0) {
    return (
      <div className="fixed top-[54px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-[#276EF1] px-4 py-1.5 text-[12px] font-bold text-white shadow-lg whitespace-nowrap">
        <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />
        <span>
          Back online — Syncing {pendingSyncCount} queued {pendingSyncCount === 1 ? 'change' : 'changes'}...
        </span>
      </div>
    );
  }

  return (
    <div className="fixed top-[54px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-[#DE8300] px-4 py-1.5 text-[12px] font-bold text-white shadow-lg whitespace-nowrap">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        {pendingSyncCount > 0
          ? `Offline Mode — ${pendingSyncCount} queued for cloud sync`
          : 'Offline Mode — Cached app data active'}
      </span>
    </div>
  );
};
