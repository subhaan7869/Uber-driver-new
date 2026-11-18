import React from 'react';
import { Banknote, Home, Mail, Menu } from 'lucide-react';
import { MainTab } from '../types/driver';

interface BottomNavProps {
  activeTab: MainTab;
  unreadInboxCount: number;
  onChangeTab: (tab: MainTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  unreadInboxCount,
  onChangeTab,
}) => {
  const items: Array<{
    id: MainTab;
    label: string;
    icon: (active: boolean) => React.ReactNode;
    badge?: number;
  }> = [
    {
      id: 'home',
      label: 'Home',
      icon: (active) => (
        <Home
          className={`w-[22px] h-[22px] ${
            active
              ? 'text-black dark:text-white fill-black dark:fill-white'
              : 'text-[#6B6B6B] dark:text-neutral-400'
          }`}
        />
      ),
    },
    {
      id: 'earnings',
      label: 'Earnings',
      icon: (active) => (
        <Banknote
          className={`w-[22px] h-[22px] ${
            active
              ? 'text-black dark:text-white stroke-[2.4]'
              : 'text-[#6B6B6B] dark:text-neutral-400'
          }`}
        />
      ),
    },
    {
      id: 'inbox',
      label: 'Inbox',
      badge: unreadInboxCount,
      icon: (active) => (
        <Mail
          className={`w-[22px] h-[22px] ${
            active
              ? 'text-black dark:text-white fill-black/15 dark:fill-white/20 stroke-[2.4]'
              : 'text-[#6B6B6B] dark:text-neutral-400'
          }`}
        />
      ),
    },
    {
      id: 'menu',
      label: 'Menu',
      icon: (active) => (
        <Menu
          className={`w-[22px] h-[22px] ${
            active
              ? 'text-black dark:text-white stroke-[2.6]'
              : 'text-[#6B6B6B] dark:text-neutral-400'
          }`}
        />
      ),
    },
  ];

  return (
    <nav
      aria-label="Primary navigation"
      className="w-full bg-white dark:bg-[#141416] border-t border-[#EAEAEA] dark:border-white/10 grid grid-cols-4 h-[64px] shrink-0 z-30"
    >
      {items.map((item) => {
        const active = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChangeTab(item.id)}
            className="relative flex flex-col items-center justify-center gap-1 min-h-[44px] focus:outline-none hover:bg-[#F8F8F8] dark:hover:bg-white/5 transition-colors"
          >
            <div className="relative">
              {item.icon(active)}
              {item.badge && item.badge > 0 ? (
                <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#276EF1] text-white text-[10px] font-bold flex items-center justify-center tabular-nums leading-none">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              ) : null}
            </div>
            <span
              className={`text-[11px] leading-none tracking-tight whitespace-nowrap ${
                active
                  ? 'font-bold text-black dark:text-white'
                  : 'font-medium text-[#6B6B6B] dark:text-neutral-400'
              }`}
            >
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
