import React, { useState } from 'react';
import {
  Bell,
  BookOpen,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Diamond,
  Download,
  FileText,
  HelpCircle,
  Landmark,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Settings,
  Shield,
  Star,
  User,
  Zap,
} from 'lucide-react';
import { INITIAL_DRIVER_PROFILE } from '../data/mockDriverData';
import { DriverPreferences } from '../types/driver';
import { NotificationPermissionState } from '../utils/notifications';
import { PWAInstallButton } from './PWAInstallButton';

interface MenuViewProps {
  proPoints: number;
  walletBalance: number;
  preferences: DriverPreferences;
  notificationPermission: NotificationPermissionState;
  lastRefreshedAt: number;
  refreshCount: number;
  wakeLockActive: boolean;
  periodicSyncActive: boolean;
  isRefreshing: boolean;
  onBack: () => void;
  onOpenSafety: () => void;
  onOpenPreferences: () => void;
  onOpenOpportunities: () => void;
  onOpenEarnings: () => void;
  onOpenInbox: () => void;
  onToggleNotifications: () => void;
  onSendTestNotification: () => void;
  onToggleBackgroundRefresh: () => void;
  onTriggerRefreshNow: () => void;
  onOpenPermissions: () => void;
  onNotifyToast: (msg: string) => void;
}

type MenuSubView =
  | null
  | 'profile'
  | 'help'
  | 'vehicles'
  | 'money'
  | 'waybill'
  | 'resources';

const VEHICLES_LIST = [
  {
    id: 'veh-1',
    name: INITIAL_DRIVER_PROFILE.vehicle,
    color: INITIAL_DRIVER_PROFILE.vehicleColor,
    plate: INITIAL_DRIVER_PROFILE.licensePlate,
    eligible: 'UberX · Comfort · Green',
  },
  {
    id: 'veh-2',
    name: '2023 Tesla Model 3 Long Range',
    color: 'Pearl White',
    plate: '9EVX218',
    eligible: 'UberX · Comfort Electric · Green',
  },
];

const RESOURCE_GUIDES = [
  {
    id: 'res-1',
    title: 'Maximizing Surge & Boost+ Zones',
    summary:
      'Purple and magenta surge clouds update every 60 seconds. Driving into a surge pill locks in the minimum dollar bonus for your very next accepted trip.',
  },
  {
    id: 'res-2',
    title: 'How Trip Radar Works',
    summary:
      'Trip Radar broadcasts high-value rides (such as SFO airport runs) to multiple nearby drivers simultaneously. Tap Match to claim before another driver is assigned.',
  },
  {
    id: 'res-3',
    title: 'Destination Mode Filters',
    summary:
      'Set up to 2 destinations per day using the map search icon. Choose Flexible route for more matches along the way or Faster route for direct arrival.',
  },
  {
    id: 'res-4',
    title: 'Background Refresh & Live GPS',
    summary:
      'Keeping Background App Refresh enabled maintains Screen Wake Lock while online and refreshes surge/quest data automatically when returning to the app.',
  },
];

export const MenuView: React.FC<MenuViewProps> = ({
  proPoints,
  walletBalance,
  preferences,
  notificationPermission,
  lastRefreshedAt,
  refreshCount,
  wakeLockActive,
  periodicSyncActive,
  isRefreshing,
  onBack,
  onOpenSafety,
  onOpenPreferences,
  onOpenOpportunities,
  onOpenEarnings,
  onOpenInbox,
  onToggleNotifications,
  onSendTestNotification,
  onToggleBackgroundRefresh,
  onTriggerRefreshNow,
  onOpenPermissions,
  onNotifyToast,
}) => {
  const [subView, setSubView] = useState<MenuSubView>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('veh-1');
  const [openGuideId, setOpenGuideId] = useState<string | null>('res-1');
  const [profileSection, setProfileSection] = useState<'metrics' | 'perks'>('metrics');
  const [waybillId, setWaybillId] = useState('UK-PHV-994120');

  const activeVehicle =
    VEHICLES_LIST.find((v) => v.id === selectedVehicleId) || VEHICLES_LIST[0];

  const lastSyncLabel = new Date(lastRefreshedAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

  if (subView) {
    const titles: Record<Exclude<MenuSubView, null>, string> = {
      profile: 'Uber Pro Profile',
      help: 'Help & Support',
      vehicles: 'Vehicles & Documents',
      money: 'Tax & Payout Methods',
      waybill: 'Electronic Waybill',
      resources: 'Driver Learning Center',
    };

    return (
      <div className="flex-1 min-h-0 flex flex-col bg-white overflow-hidden">
        <div className="px-4 pt-15 lg:pt-4 pb-3.5 border-b border-[#EEEEEE] flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSubView(null)}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] active:scale-95 flex items-center justify-center transition-all"
            aria-label="Back to Menu"
          >
            <ChevronLeft className="w-6 h-6 text-black" />
          </button>
          <h2 className="text-[18px] font-bold text-black">{titles[subView]}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {subView === 'profile' && (
            <>
              <div className="p-5 rounded-2xl bg-black text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-[18px] font-bold">{INITIAL_DRIVER_PROFILE.name}</p>
                    <p className="text-[13px] text-white/75 flex items-center gap-1">
                      <Diamond className="w-3.5 h-3.5 fill-[#276EF1] text-[#276EF1]" />
                      Uber Pro {INITIAL_DRIVER_PROFILE.tier} · {proPoints} pts
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/15 text-center tabular-nums">
                  <div>
                    <p className="text-[18px] font-bold">★ {INITIAL_DRIVER_PROFILE.rating}</p>
                    <p className="text-[11px] text-white/70">Rating</p>
                  </div>
                  <div>
                    <p className="text-[18px] font-bold">{INITIAL_DRIVER_PROFILE.acceptanceRate}%</p>
                    <p className="text-[11px] text-white/70">Acceptance</p>
                  </div>
                  <div>
                    <p className="text-[18px] font-bold">{INITIAL_DRIVER_PROFILE.cancellationRate}%</p>
                    <p className="text-[11px] text-white/70">Cancellation</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F3F3F3]">
                <button
                  type="button"
                  onClick={() => setProfileSection('metrics')}
                  className={`h-9 rounded-lg text-[13px] font-bold transition-colors ${
                    profileSection === 'metrics'
                      ? 'bg-white text-black shadow-xs'
                      : 'text-[#545454]'
                  }`}
                >
                  Compliments
                </button>
                <button
                  type="button"
                  onClick={() => setProfileSection('perks')}
                  className={`h-9 rounded-lg text-[13px] font-bold transition-colors ${
                    profileSection === 'perks'
                      ? 'bg-white text-black shadow-xs'
                      : 'text-[#545454]'
                  }`}
                >
                  Diamond Perks
                </button>
              </div>

              {profileSection === 'metrics' ? (
                <div className="p-4 rounded-2xl border border-[#E6E6E6] space-y-2 text-[14px]">
                  <p className="font-bold text-black">Rider compliment badges</p>
                  <p className="text-[#545454]">
                    Great Conversation (142) · Spotless Car (198) · Expert Navigation (164)
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-[#E6E6E6] space-y-2 text-[14px]">
                  <p className="font-bold text-black">Active Diamond Benefits</p>
                  <p className="text-[#545454]">
                    Priority Airport Re-match · 6% Cashback on EV/Gas · 24/7 Diamond Phone Support
                  </p>
                </div>
              )}
            </>
          )}

          {subView === 'help' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#F6F6F6]">
                <p className="text-[15px] font-bold text-black mb-1">
                  24/7 Priority Diamond Support
                </p>
                <p className="text-[13px] text-[#545454] leading-relaxed">
                  Get instant assistance with trip fare adjustments, lost items, or account documents.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSubView(null);
                  onOpenInbox();
                }}
                className="w-full p-4 rounded-2xl border border-[#E6E6E6] hover:bg-[#FAFAFA] flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-[#276EF1]" />
                  <div>
                    <p className="text-[15px] font-bold text-black">Open Support Inbox</p>
                    <p className="text-[12px] text-[#545454]">
                      Reply to open fare review & cancellation threads
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
              </button>

              <button
                type="button"
                onClick={() =>
                  onNotifyToast('Priority Diamond Support callback requested (1 min wait)')
                }
                className="w-full p-4 rounded-2xl border border-[#E6E6E6] hover:bg-[#FAFAFA] flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <PhoneCall className="w-5 h-5 text-[#05944F]" />
                  <div>
                    <p className="text-[15px] font-bold text-black">Call Diamond Support</p>
                    <p className="text-[12px] text-[#545454]">Average wait time under 60 seconds</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
              </button>

              <button
                type="button"
                onClick={() => onNotifyToast('Fare review form submitted for most recent trip')}
                className="w-full p-4 rounded-2xl border border-[#E6E6E6] hover:bg-[#FAFAFA] flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-black" />
                  <div>
                    <p className="text-[15px] font-bold text-black">Review a trip fare</p>
                    <p className="text-[12px] text-[#545454]">Request toll, wait-time, or detour check</p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
              </button>
            </div>
          )}

          {subView === 'vehicles' && (
            <div className="space-y-3">
              <p className="text-[13px] font-semibold text-[#545454]">
                Tap a vehicle to set it active for dispatches
              </p>
              {VEHICLES_LIST.map((veh) => {
                const isSelected = veh.id === selectedVehicleId;
                return (
                  <button
                    key={veh.id}
                    type="button"
                    onClick={() => {
                      setSelectedVehicleId(veh.id);
                      onNotifyToast(`Active vehicle switched to ${veh.name}`);
                    }}
                    className={`w-full p-4 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-black bg-[#FAFAFA]'
                        : 'border-[#E6E6E6] hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${
                          isSelected
                            ? 'text-[#05944F] bg-[#E6F4EA]'
                            : 'text-[#545454] bg-[#EEEEEE]'
                        }`}
                      >
                        {isSelected ? 'Active Vehicle' : 'Tap to Select'}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-[#05944F] stroke-[3]" />}
                    </div>
                    <p className="text-[16px] font-bold text-black">{veh.name}</p>
                    <p className="text-[13px] text-[#545454] mt-0.5">
                      {veh.color} · License Plate {veh.plate}
                    </p>
                    <p className="text-[12px] font-semibold text-[#276EF1] mt-1">
                      {veh.eligible}
                    </p>
                  </button>
                );
              })}

              <div className="p-4 rounded-2xl border border-[#E6E6E6] space-y-2.5 text-[14px]">
                <div className="flex justify-between">
                  <span className="font-medium text-black">Driver’s License</span>
                  <span className="font-bold text-[#05944F]">Verified</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-black">Vehicle Insurance</span>
                  <span className="font-bold text-[#05944F]">Verified</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-black">Annual Inspection</span>
                  <span className="font-bold text-[#05944F]">Approved</span>
                </div>
              </div>
            </div>
          )}

          {subView === 'money' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#F6F6F6]">
                <p className="text-[13px] text-[#545454]">Available Wallet Balance</p>
                <p className="text-[30px] font-extrabold text-black tabular-nums mt-0.5">
                  £{walletBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-[#E6E6E6] space-y-2 text-[14px]">
                <div className="flex justify-between">
                  <span className="font-bold text-black">Instant Pay Debit</span>
                  <span className="text-[#545454]">UK Visa •• 4821</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-black">Faster Payments Bank</span>
                  <span className="text-[#545454]">Sort 20-00-00 · •• 9014</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSubView(null);
                  onOpenEarnings();
                }}
                className="w-full h-12 rounded-xl bg-black text-white text-[14px] font-bold hover:bg-neutral-800 transition-colors"
              >
                Open Earnings & Cash Out
              </button>

              <button
                type="button"
                onClick={() => onNotifyToast('2026 HMRC Self-Assessment Tax Summary ready')}
                className="w-full h-12 rounded-xl bg-[#F3F3F3] text-black text-[14px] font-bold hover:bg-[#E5E5E5] flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download HMRC Tax Summary
              </button>
            </div>
          )}

          {subView === 'waybill' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl border border-[#E6E6E6] space-y-2.5 text-[14px]">
                <p className="font-bold text-black">TfL Private Hire Waybill · Active</p>
                <p className="text-[#545454]">Waybill ID: {waybillId}</p>
                <p className="text-[#545454]">Driver: {INITIAL_DRIVER_PROFILE.name}</p>
                <p className="text-[#545454]">Vehicle: {activeVehicle.name}</p>
                <p className="text-[#545454]">Plate: {activeVehicle.plate}</p>
                <p className="text-[#545454]">Hire & Reward Policy: #UBR-994120-UK</p>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(waybillId).catch(() => {});
                    onNotifyToast(`Copied Waybill ID ${waybillId}`);
                  }}
                  className="flex-1 h-11 rounded-xl bg-[#F3F3F3] hover:bg-[#E5E5E5] text-[13px] font-bold text-black flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-4 h-4" />
                  Copy ID
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextId = `UK-PHV-${Math.floor(100000 + Math.random() * 899999)}`;
                    setWaybillId(nextId);
                    onNotifyToast('Waybill refreshed');
                  }}
                  className="flex-1 h-11 rounded-xl bg-black hover:bg-neutral-800 text-[13px] font-bold text-white flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>
          )}

          {subView === 'resources' && (
            <div className="space-y-2.5">
              {RESOURCE_GUIDES.map((guide) => {
                const isOpen = openGuideId === guide.id;
                return (
                  <button
                    key={guide.id}
                    type="button"
                    onClick={() => setOpenGuideId(isOpen ? null : guide.id)}
                    className="w-full p-4 rounded-2xl border border-[#E6E6E6] hover:bg-[#FAFAFA] text-left transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-bold text-black">{guide.title}</p>
                      <ChevronDown
                        className={`w-4 h-4 text-[#545454] transition-transform shrink-0 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                    {isOpen && (
                      <p className="text-[13px] text-[#545454] leading-relaxed mt-2">
                        {guide.summary}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-white pb-6">
      {/* Top Bar with Back Button to Map */}
      <div className="px-5 pt-15 lg:pt-5 pb-1 flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] active:scale-95 flex items-center justify-center transition-all"
          aria-label="Back to Map"
        >
          <ChevronLeft className="w-6 h-6 text-black" />
        </button>
        <span className="text-[16px] font-bold text-black">Menu</span>
      </div>

      {/* Driver Profile & Uber Pro Stats Header */}
      <button
        type="button"
        onClick={() => setSubView('profile')}
        className="w-full px-5 pt-3 pb-4 flex items-center justify-between gap-3 text-left hover:bg-[#FAFAFA] transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-14 h-14 rounded-full bg-[#EEEEEE] flex items-center justify-center shrink-0 border border-black/10">
            <User className="w-7 h-7 text-black" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold text-black truncate">
              {INITIAL_DRIVER_PROFILE.name}
            </h1>
            <div className="flex items-center gap-2.5 text-[13px] font-bold text-black mt-0.5 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-black" />
                {INITIAL_DRIVER_PROFILE.rating}
              </span>
              <span className="text-[#CCCCCC]">|</span>
              <span>{INITIAL_DRIVER_PROFILE.acceptanceRate}%</span>
              <span className="text-[#CCCCCC]">|</span>
              <span>{INITIAL_DRIVER_PROFILE.cancellationRate}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-black text-white px-2.5 py-1 rounded-full text-[12px] font-bold shrink-0 tabular-nums">
          <Diamond className="w-3.5 h-3.5 fill-[#276EF1] text-[#276EF1]" />
          {proPoints}
        </div>
      </button>

      {/* 3 Action Tiles: Help, Safety, Settings */}
      <div className="px-5 grid grid-cols-3 gap-3 mb-5">
        <button
          type="button"
          onClick={() => setSubView('help')}
          className="h-24 rounded-2xl bg-[#F3F3F3] hover:bg-[#E8E8E8] active:scale-[0.98] flex flex-col items-center justify-center gap-2 transition-all"
        >
          <HelpCircle className="w-6 h-6 text-black stroke-[2.2]" />
          <span className="text-[14px] font-bold text-black">Help</span>
        </button>

        <button
          type="button"
          onClick={onOpenSafety}
          className="h-24 rounded-2xl bg-[#F3F3F3] hover:bg-[#E8E8E8] active:scale-[0.98] flex flex-col items-center justify-center gap-2 transition-all"
        >
          <Shield className="w-6 h-6 text-black stroke-[2.2]" />
          <span className="text-[14px] font-bold text-black">Safety</span>
        </button>

        <button
          type="button"
          onClick={onOpenPreferences}
          className="h-24 rounded-2xl bg-[#F3F3F3] hover:bg-[#E8E8E8] active:scale-[0.98] flex flex-col items-center justify-center gap-2 transition-all"
        >
          <Settings className="w-6 h-6 text-black stroke-[2.2]" />
          <span className="text-[14px] font-bold text-black">Settings</span>
        </button>
      </div>

      {/* Notifications & Background App Refresh Controls */}
      <div className="px-5 mb-5 space-y-2.5">
        <h2 className="text-[17px] font-extrabold text-black">
          Alerts & Background Refresh
        </h2>

        <div className="rounded-2xl border border-[#E6E6E6] bg-[#FAFAFA] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white border border-black/5 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-[#276EF1]" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-black">Driver Notifications</p>
                <p className="text-[11.5px] text-[#545454] truncate">
                  {notificationPermission === 'granted'
                    ? 'OS & in-app trip alerts active'
                    : notificationPermission === 'denied'
                    ? 'Browser blocked · in-app banner active'
                    : 'Tap toggle to enable push alerts'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleNotifications}
              aria-label="Toggle driver notifications"
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.notificationsEnabled ? 'bg-[#276EF1]' : 'bg-[#DCDCDC]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <button
            type="button"
            onClick={onSendTestNotification}
            className="w-full h-9 rounded-xl bg-white border border-black/10 hover:bg-[#F3F3F3] active:scale-[0.99] text-[12.5px] font-bold text-black transition-all"
          >
            Send Test Trip Notification
          </button>
        </div>

        <div className="rounded-2xl border border-[#E6E6E6] bg-[#FAFAFA] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white border border-black/5 flex items-center justify-center shrink-0">
                <RefreshCw
                  className={`w-4 h-4 text-[#05944F] ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-black">Background App Refresh</p>
                <p className="text-[11.5px] text-[#545454] truncate tabular-nums">
                  {preferences.backgroundAppRefresh
                    ? `Synced ${lastSyncLabel} · #${refreshCount}${
                        wakeLockActive ? ' · Wake Lock' : ''
                      }${periodicSyncActive ? ' · Periodic' : ''}`
                    : 'Paused — manual refresh only'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onToggleBackgroundRefresh}
              aria-label="Toggle Background App Refresh"
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.backgroundAppRefresh ? 'bg-[#05944F]' : 'bg-[#DCDCDC]'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.backgroundAppRefresh ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onTriggerRefreshNow}
              className="flex-1 h-9 rounded-xl bg-white border border-black/10 hover:bg-[#F3F3F3] active:scale-[0.99] text-[12.5px] font-bold text-black transition-all"
            >
              Sync Now
            </button>
            <button
              type="button"
              onClick={onOpenPermissions}
              className="flex-1 h-9 rounded-xl bg-black hover:bg-neutral-800 active:scale-[0.99] text-[12.5px] font-bold text-white transition-all"
            >
              Accept Permissions
            </button>
          </div>
        </div>
      </div>

      {/* More ways to earn */}
      <div className="px-5 mb-5">
        <h2 className="text-[19px] font-extrabold text-black mb-2">
          More ways to earn
        </h2>
        <button
          type="button"
          onClick={onOpenOpportunities}
          className="w-full py-3.5 flex items-center justify-between border-b border-[#EEEEEE] hover:bg-[#FAFAFA] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <Zap className="w-5 h-5 text-black" />
            <span className="text-[16px] font-semibold text-black">Opportunities</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
        </button>
      </div>

      {/* Manager, Money, Resources, Waybill */}
      <div className="px-5 divide-y divide-[#EEEEEE]">
        <button
          type="button"
          onClick={() => setSubView('vehicles')}
          className="w-full py-3.5 flex items-center justify-between hover:bg-[#FAFAFA] transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <Car className="w-5 h-5 text-black" />
            <div>
              <p className="text-[16px] font-semibold text-black">Vehicles & Documents</p>
              <p className="text-[12px] text-[#545454]">{activeVehicle.name}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
        </button>

        <button
          type="button"
          onClick={() => setSubView('money')}
          className="w-full py-3.5 flex items-center justify-between hover:bg-[#FAFAFA] transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <Landmark className="w-5 h-5 text-black" />
            <span className="text-[16px] font-semibold text-black">Tax & Payouts</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
        </button>

        <button
          type="button"
          onClick={() => setSubView('waybill')}
          className="w-full py-3.5 flex items-center justify-between hover:bg-[#FAFAFA] transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <FileText className="w-5 h-5 text-black" />
            <span className="text-[16px] font-semibold text-black">Waybill</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
        </button>

        <button
          type="button"
          onClick={() => setSubView('resources')}
          className="w-full py-3.5 flex items-center justify-between hover:bg-[#FAFAFA] transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <BookOpen className="w-5 h-5 text-black" />
            <span className="text-[16px] font-semibold text-black">Resources</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
        </button>

        <PWAInstallButton variant="row" />
      </div>
    </div>
  );
};
