import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-[54px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full bg-[#DE8300] px-4 py-1.5 text-[12px] font-bold text-white shadow-lg whitespace-nowrap">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Offline Mode — Cached app data active</span>
    </div>
  );
};
