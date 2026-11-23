import React, { useState } from 'react';
import {
  Bell,
  BookOpen,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  CloudOff,
  Copy,
  Diamond,
  Download,
  FileText,
  HelpCircle,
  Landmark,
  LogOut,
  MessageSquare,
  Moon,
  PhoneCall,
  RefreshCw,
  Settings,
  Shield,
  ShieldCheck,
  Star,
  User,
  Zap,
} from 'lucide-react';
import { useFirebase } from '../contexts/FirebaseContext';
import { ComplimentCounts, DriverAccount, DriverPreferences, TripStats } from '../types/driver';
import { NotificationPermissionState } from '../utils/notifications';
import { PWAInstallButton } from './PWAInstallButton';

interface MenuViewProps {
  account: DriverAccount;
  proPoints: number;
  walletBalance: number;
  totalBusinessMiles?: number;
  tripStats: TripStats;
  compliments?: ComplimentCounts;
  streakCount?: number;
  preferences: DriverPreferences;
  notificationPermission: NotificationPermissionState;
  lastRefreshedAt: number;
  refreshCount: number;
  wakeLockActive: boolean;
  periodicSyncActive: boolean;
  isRefreshing: boolean;
  onBack: () => void;
  onOpenAccounts: () => void;
  onOpenFaceVerify: () => void;
  onToggleNightMode: () => void;
  onSignOut: () => void;
  onOpenSafety: () => void;
  onOpenPreferences: () => void;
  onOpenOpportunities: () => void;
  onOpenTrips: () => void;
  onOpenEarnings: () => void;
  onOpenInbox: () => void;
  onToggleNotifications: () => void;
  onSendTestNotification: () => void;
  onToggleBackgroundRefresh: () => void;
  onTriggerRefreshNow: () => void;
  onOpenPermissions: () => void;
  onNotifyToast: (msg: string) => void;
  onUpdateComplianceDoc?: (
    docId: string,
    nextStatus: 'verified' | 'expiring_soon' | 'expired'
  ) => void;
  onResetRestLock?: () => void;
  onExportTaxCsv?: () => void;
}

type MenuSubView =
  | null
  | 'profile'
  | 'help'
  | 'vehicles'
  | 'money'
  | 'waybill'
  | 'resources';

const RESOURCE_GUIDES = [
  {
    id: 'res-1',
    title: 'Maximizing Surge & Boost+ Zones',
    summary:
      'Purple and magenta surge clouds update every 60 seconds. Driving into a surge pill locks in the minimum pound bonus for your very next accepted trip.',
  },
  {
    id: 'res-2',
    title: 'How Trip Radar Works',
    summary:
      'Trip Radar broadcasts high-value rides (such as Heathrow & Gatwick runs) to multiple nearby drivers simultaneously. Tap Match to claim before another driver is assigned.',
  },
  {
    id: 'res-3',
    title: 'Destination Mode Filters',
    summary:
      'Set up to 2 destinations per day using the map search icon. Choose Flexible route for more matches along the way or Faster route for direct arrival.',
  },
  {
    id: 'res-4',
    title: 'Real-Time ID Check & UK PHV Rules',
    summary:
      'TfL and UK local councils require regular Real-Time ID selfie verification before going online plus a 6-hour rest break after 12 hours of driving.',
  },
];

export const MenuView: React.FC<MenuViewProps> = ({
  account,
  proPoints,
  walletBalance,
  totalBusinessMiles = 0,
  tripStats,
  compliments = {
    greatConversation: 142,
    spotlessCar: 198,
    expertNavigation: 164,
    aboveAndBeyond: 49,
  },
  streakCount = 0,
  preferences,
  notificationPermission,
  lastRefreshedAt,
  refreshCount,
  wakeLockActive,
  periodicSyncActive,
  isRefreshing,
  onBack,
  onOpenAccounts,
  onOpenFaceVerify,
  onToggleNightMode,
  onSignOut,
  onOpenSafety,
  onOpenPreferences,
  onOpenOpportunities,
  onOpenTrips,
  onOpenEarnings,
  onOpenInbox,
  onToggleNotifications,
  onSendTestNotification,
  onToggleBackgroundRefresh,
  onTriggerRefreshNow,
  onOpenPermissions,
  onNotifyToast,
  onUpdateComplianceDoc,
  onResetRestLock,
  onExportTaxCsv,
}) => {
  const {
    user: googleUser,
    authLoading,
    syncStatus,
    lastCloudSyncAt,
    signInWithGoogle,
    signOutGoogle,
  } = useFirebase();
  const [subView, setSubView] = useState<MenuSubView>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState('veh-1');
  const [openGuideId, setOpenGuideId] = useState<string | null>('res-1');
  const [profileSection, setProfileSection] = useState<'metrics' | 'perks'>('metrics');
  const [waybillId, setWaybillId] = useState('UK-PHV-994120');
  const [walkaroundChecks, setWalkaroundChecks] = useState<Record<string, boolean>>({
    tyres: true,
    lights: true,
    roundels: true,
    kit: false,
  });

  const vehiclesList = [
    {
      id: 'veh-1',
      name: account.vehicle,
      color: account.vehicleColor,
      plate: account.licensePlate,
      eligible: 'UberX · Comfort · Green',
    },
    {
      id: 'veh-2',
      name: '2024 Tesla Model 3 Long Range',
      color: 'Pearl White',
      plate: 'LD24 EVX',
      eligible: 'UberX · Comfort Electric · Green',
    },
  ];

  const activeVehicle =
    vehiclesList.find((v) => v.id === selectedVehicleId) || vehiclesList[0];

  const isFaceVerifiedRecently =
    account.lastFaceVerifiedAt !== null &&
    Date.now() - account.lastFaceVerifiedAt < 12 * 60 * 60 * 1000;

  const totalDrivingCapMin = 12 * 60;
  const remainingMin = Math.max(0, totalDrivingCapMin - account.drivingMinutesUsedToday);
  const remHours = Math.floor(remainingMin / 60);
  const remMins = remainingMin % 60;

  const lastSyncLabel = new Date(lastRefreshedAt).toLocaleTimeString('en-GB', {
    hour: '2-digit',
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
      <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-[#0E0F12] overflow-hidden">
        <div className="px-4 pt-15 lg:pt-4 pb-3.5 border-b border-[#EEEEEE] dark:border-white/10 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSubView(null)}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 active:scale-95 flex items-center justify-center transition-all"
            aria-label="Back to Menu"
          >
            <ChevronLeft className="w-6 h-6 text-black dark:text-white" />
          </button>
          <h2 className="text-[18px] font-bold text-black dark:text-white">{titles[subView]}</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {subView === 'profile' && (
            <>
              <div className="p-5 rounded-2xl bg-black dark:bg-[#192030] text-white">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-[18px] font-bold">{account.name}</p>
                    <p className="text-[13px] text-white/75 flex items-center gap-1">
                      <Diamond className="w-3.5 h-3.5 fill-[#276EF1] text-[#276EF1]" />
                      Uber Pro {account.tier} · {proPoints} pts
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/15 text-center tabular-nums">
                  <div>
                    <p className="text-[18px] font-bold">★ {account.rating.toFixed(2)}</p>
                    <p className="text-[11px] text-white/70">Rating</p>
                  </div>
                  <div>
                    <p className="text-[18px] font-bold">{account.acceptanceRate}%</p>
                    <p className="text-[11px] text-white/70">Acceptance</p>
                  </div>
                  <div>
                    <p className="text-[18px] font-bold">{account.cancellationRate}%</p>
                    <p className="text-[11px] text-white/70">Cancellation</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F3F3F3] dark:bg-white/10">
                <button
                  type="button"
                  onClick={() => setProfileSection('metrics')}
                  className={`h-9 rounded-lg text-[13px] font-bold transition-colors ${
                    profileSection === 'metrics'
                      ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
                      : 'text-[#545454] dark:text-neutral-400'
                  }`}
                >
                  Compliments
                </button>
                <button
                  type="button"
                  onClick={() => setProfileSection('perks')}
                  className={`h-9 rounded-lg text-[13px] font-bold transition-colors ${
                    profileSection === 'perks'
                      ? 'bg-white dark:bg-[#22242A] text-black dark:text-white shadow-xs'
                      : 'text-[#545454] dark:text-neutral-400'
                  }`}
                >
                  {account.tier} Perks
                </button>
              </div>

              {profileSection === 'metrics' ? (
                <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-white dark:bg-[#16181D] space-y-3 text-[14px]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-black dark:text-white">Live Rider Compliments</p>
                    {streakCount > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full bg-[#FFF3D6] dark:bg-amber-950/60 text-[#B45309] dark:text-amber-300 text-[11px] font-bold tabular-nums">
                        {streakCount}/3 Trip Streak
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 tabular-nums">
                    {[
                      { label: 'Spotless Car', count: compliments.spotlessCar },
                      { label: 'Expert Navigation', count: compliments.expertNavigation },
                      { label: 'Great Conversation', count: compliments.greatConversation },
                      { label: 'Above & Beyond', count: compliments.aboveAndBeyond },
                    ].map((badge) => (
                      <div
                        key={badge.label}
                        className="p-2.5 rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-black/5 dark:border-white/5"
                      >
                        <p className="text-[18px] font-extrabold text-black dark:text-white">
                          {badge.count}
                        </p>
                        <p className="text-[11.5px] text-[#545454] dark:text-neutral-400">
                          {badge.label}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-white dark:bg-[#16181D] space-y-2 text-[14px]">
                  <p className="font-bold text-black dark:text-white">Active {account.tier} Benefits</p>
                  <p className="text-[#545454] dark:text-neutral-400">
                    Priority Airport Re-match · 6% Cashback on EV/Fuel · 24/7 UK Phone Support
                  </p>
                </div>
              )}
            </>
          )}

          {subView === 'help' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#F6F6F6] dark:bg-[#16181D]">
                <p className="text-[15px] font-bold text-black dark:text-white mb-1">
                  24/7 Priority {account.tier} Support
                </p>
                <p className="text-[13px] text-[#545454] dark:text-neutral-400 leading-relaxed">
                  Get instant assistance with trip fare adjustments, lost items, or UK PHV documents.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSubView(null);
                  onOpenInbox();
                }}
                className="w-full p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 hover:bg-[#FAFAFA] dark:hover:bg-white/5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="w-5 h-5 text-[#276EF1]" />
                  <div>
                    <p className="text-[15px] font-bold text-black dark:text-white">Open Support Inbox</p>
                    <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                      Reply to open fare review & cancellation threads
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
              </button>

              <button
                type="button"
                onClick={() =>
                  onNotifyToast(`Priority ${account.tier} Support callback requested (1 min wait)`)
                }
                className="w-full p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 hover:bg-[#FAFAFA] dark:hover:bg-white/5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <PhoneCall className="w-5 h-5 text-[#05944F]" />
                  <div>
                    <p className="text-[15px] font-bold text-black dark:text-white">Call UK Driver Support</p>
                    <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                      Average wait time under 60 seconds
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
              </button>

              <button
                type="button"
                onClick={() => onNotifyToast('Fare review form submitted for most recent trip')}
                className="w-full p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 hover:bg-[#FAFAFA] dark:hover:bg-white/5 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-black dark:text-white" />
                  <div>
                    <p className="text-[15px] font-bold text-black dark:text-white">Review a trip fare</p>
                    <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                      Request toll, wait-time, or detour check
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
              </button>
            </div>
          )}

          {subView === 'vehicles' && (
            <div className="space-y-3">
              <p className="text-[13px] font-semibold text-[#545454] dark:text-neutral-400">
                Tap a vehicle to set it active for dispatches
              </p>
              {vehiclesList.map((veh) => {
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
                        ? 'border-black dark:border-[#276EF1] bg-[#FAFAFA] dark:bg-[#192338]'
                        : 'border-[#E6E6E6] dark:border-white/10 hover:bg-[#FAFAFA] dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded ${
                          isSelected
                            ? 'text-[#05944F] bg-[#E6F4EA] dark:bg-emerald-950/60'
                            : 'text-[#545454] dark:text-neutral-400 bg-[#EEEEEE] dark:bg-white/10'
                        }`}
                      >
                        {isSelected ? 'Active Vehicle' : 'Tap to Select'}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-[#05944F] stroke-[3]" />}
                    </div>
                    <p className="text-[16px] font-bold text-black dark:text-white">{veh.name}</p>
                    <p className="text-[13px] text-[#545454] dark:text-neutral-400 mt-0.5">
                      {veh.color} · Plate {veh.plate}
                    </p>
                    <p className="text-[12px] font-semibold text-[#276EF1] mt-1">
                      {veh.eligible}
                    </p>
                  </button>
                );
              })}

              <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-white dark:bg-[#16181D] space-y-3 text-[13.5px]">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-[#545454] dark:text-neutral-400">
                    UK PHV Compliance Vault
                  </p>
                  <span className="text-[11px] font-bold text-[#276EF1]">
                    Required to go online
                  </span>
                </div>
                {(account.complianceDocs ?? []).map((docItem) => {
                  const isExpired = docItem.status === 'expired';
                  const isExpiring = docItem.status === 'expiring_soon';
                  return (
                    <div
                      key={docItem.id}
                      className="p-3 rounded-xl bg-[#FAFAFA] dark:bg-white/5 border border-black/5 dark:border-white/10 flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-black dark:text-white truncate">
                          {docItem.title}
                        </p>
                        <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 truncate">
                          {docItem.subtitle}
                        </p>
                        <p
                          className={`text-[11px] font-bold mt-0.5 tabular-nums ${
                            isExpired
                              ? 'text-[#E11900]'
                              : isExpiring
                              ? 'text-[#D97706]'
                              : 'text-[#05944F]'
                          }`}
                        >
                          {isExpired
                            ? 'Expired · Upload renewal to drive'
                            : isExpiring
                            ? `Expiring in ${docItem.daysRemaining} days`
                            : `Approved · ${docItem.daysRemaining} days remaining`}
                        </p>
                      </div>
                      {onUpdateComplianceDoc && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateComplianceDoc(
                              docItem.id,
                              isExpired || isExpiring ? 'verified' : 'expired'
                            )
                          }
                          className={`px-2.5 h-8 rounded-lg text-[11.5px] font-bold shrink-0 whitespace-nowrap transition-colors ${
                            isExpired || isExpiring
                              ? 'bg-[#276EF1] text-white hover:bg-[#1E5CD4]'
                              : 'bg-[#F3F3F3] dark:bg-white/10 text-[#545454] dark:text-neutral-300 hover:bg-[#E5E5E5]'
                          }`}
                        >
                          {isExpired || isExpiring ? 'Upload / Renew' : 'Test Expiry'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Vehicle Maintenance & Service Health */}
              <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-bold text-black dark:text-white">
                    Maintenance & Service Health
                  </p>
                  <span className="text-[11.5px] font-bold px-2 py-0.5 rounded bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F]">
                    Roadworthy
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5">
                    <p className="text-[14px] font-extrabold text-black dark:text-white">2,450 mi</p>
                    <p className="text-[11px] text-[#545454] dark:text-neutral-400">Next Service</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5">
                    <p className="text-[14px] font-extrabold text-[#05944F]">5.8 mm</p>
                    <p className="text-[11px] text-[#545454] dark:text-neutral-400">Tyre Tread</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-black/5 dark:border-white/5">
                    <p className="text-[14px] font-extrabold text-[#276EF1]">78%</p>
                    <p className="text-[11px] text-[#545454] dark:text-neutral-400">Brake Life</p>
                  </div>
                </div>
              </div>

              {/* Pre-Shift Walkaround Check */}
              <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-white dark:bg-[#16181D] space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[14px] font-bold text-black dark:text-white">
                    Daily PHV Walkaround Check
                  </p>
                  <span className="text-[11.5px] font-bold text-[#276EF1] tabular-nums">
                    {Object.values(walkaroundChecks).filter(Boolean).length}/4 checked
                  </span>
                </div>
                {[
                  { id: 'tyres', label: 'Tyres, tread depth (>1.6mm) & wheel nuts' },
                  { id: 'lights', label: 'Headlights, brake lights & indicators' },
                  { id: 'roundels', label: 'Front & rear TfL / Council PHV discs visible' },
                  { id: 'kit', label: 'First-aid kit, hi-vis vest & phone mount' },
                ].map((item) => {
                  const checked = !!walkaroundChecks[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setWalkaroundChecks((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }));
                        onNotifyToast(
                          checked ? 'Walkaround item unchecked' : 'Walkaround item verified'
                        );
                      }}
                      className="w-full flex items-center justify-between gap-3 py-1.5 text-left"
                    >
                      <span className="text-[13px] font-medium text-black dark:text-neutral-200">
                        {item.label}
                      </span>
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center border shrink-0 transition-colors ${
                          checked
                            ? 'bg-[#05944F] border-[#05944F] text-white'
                            : 'border-[#CCCCCC] dark:border-white/25'
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {subView === 'money' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-[#F6F6F6] dark:bg-[#16181D]">
                <p className="text-[13px] text-[#545454] dark:text-neutral-400">Available Wallet Balance</p>
                <p className="text-[30px] font-extrabold text-black dark:text-white tabular-nums mt-0.5">
                  £{walletBalance.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-white dark:bg-[#16181D] space-y-2 text-[14px]">
                <div className="flex justify-between">
                  <span className="font-bold text-black dark:text-white">HMRC Business Mileage</span>
                  <span className="font-bold text-[#05944F] tabular-nums">
                    {totalBusinessMiles.toFixed(1)} mi · £{(totalBusinessMiles * 0.45).toFixed(2)} relief
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-black dark:text-white">Instant Pay Debit</span>
                  <span className="text-[#545454] dark:text-neutral-400">UK Visa •• 4821</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-black dark:text-white">Faster Payments Bank</span>
                  <span className="text-[#545454] dark:text-neutral-400">Sort 20-00-00 · •• 9014</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSubView(null);
                  onOpenEarnings();
                }}
                className="w-full h-12 rounded-xl bg-black dark:bg-[#276EF1] text-white text-[14px] font-bold hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] transition-colors"
              >
                Open Earnings & Cash Out
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onExportTaxCsv) {
                    onExportTaxCsv();
                  } else {
                    onNotifyToast(
                      `2026 HMRC Summary: £${(totalBusinessMiles * 0.45).toFixed(2)} mileage relief ready`
                    );
                  }
                }}
                className="w-full h-12 rounded-xl bg-[#F3F3F3] dark:bg-white/10 text-black dark:text-white text-[14px] font-bold hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center gap-2 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download HMRC Tax CSV
              </button>
            </div>
          )}

          {subView === 'waybill' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-white dark:bg-[#16181D] space-y-2.5 text-[14px]">
                <p className="font-bold text-black dark:text-white">UK Private Hire Waybill · Active</p>
                <p className="text-[#545454] dark:text-neutral-400">Waybill ID: {waybillId}</p>
                <p className="text-[#545454] dark:text-neutral-400">Driver: {account.name}</p>
                <p className="text-[#545454] dark:text-neutral-400">PHV Badge: {account.phvBadge}</p>
                <p className="text-[#545454] dark:text-neutral-400">Vehicle: {activeVehicle.name}</p>
                <p className="text-[#545454] dark:text-neutral-400">Plate: {activeVehicle.plate}</p>
              </div>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(waybillId).catch(() => {});
                    onNotifyToast(`Copied Waybill ID ${waybillId}`);
                  }}
                  className="flex-1 h-11 rounded-xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-[13px] font-bold text-black dark:text-white flex items-center justify-center gap-1.5"
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
                  className="flex-1 h-11 rounded-xl bg-black dark:bg-[#276EF1] hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] text-[13px] font-bold text-white flex items-center justify-center gap-1.5"
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
                    className="w-full p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-white dark:bg-[#16181D] hover:bg-[#FAFAFA] dark:hover:bg-white/5 text-left transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-bold text-black dark:text-white">{guide.title}</p>
                      <ChevronDown
                        className={`w-4 h-4 text-[#545454] dark:text-neutral-400 transition-transform shrink-0 ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                    {isOpen && (
                      <p className="text-[13px] text-[#545454] dark:text-neutral-400 leading-relaxed mt-2">
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
    <div className="flex-1 min-h-0 overflow-y-auto bg-white dark:bg-[#0E0F12] pb-6">
      {/* Top Bar with Back Button + Switch Driver Account */}
      <div className="px-5 pt-15 lg:pt-5 pb-1 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 active:scale-95 flex items-center justify-center transition-all"
            aria-label="Back to Map"
          >
            <ChevronLeft className="w-6 h-6 text-black dark:text-white" />
          </button>
          <span className="text-[16px] font-bold text-black dark:text-white">Menu</span>
        </div>

        <button
          type="button"
          onClick={onOpenAccounts}
          className="px-3.5 py-2 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-[12.5px] font-bold text-black dark:text-white"
        >
          Switch Account
        </button>
      </div>

      {/* Driver Profile & Uber Pro Stats Header */}
      <button
        type="button"
        onClick={() => setSubView('profile')}
        className="w-full px-5 pt-3 pb-4 flex items-center justify-between gap-3 text-left hover:bg-[#FAFAFA] dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-14 h-14 rounded-full bg-[#EEEEEE] dark:bg-white/10 flex items-center justify-center shrink-0 border border-black/10 dark:border-white/10">
            <User className="w-7 h-7 text-black dark:text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-extrabold text-black dark:text-white truncate">
              {account.name}
            </h1>
            <div className="flex items-center gap-2.5 text-[13px] font-bold text-black dark:text-neutral-200 mt-0.5 tabular-nums">
              <span className="inline-flex items-center gap-1">
                <Star className="w-3.5 h-3.5 fill-current" />
                {account.rating.toFixed(2)}
              </span>
              <span className="text-[#CCCCCC] dark:text-neutral-600">|</span>
              <span>{account.acceptanceRate}%</span>
              <span className="text-[#CCCCCC] dark:text-neutral-600">|</span>
              <span>{account.cancellationRate}%</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-black dark:bg-[#276EF1] text-white px-2.5 py-1 rounded-full text-[12px] font-bold shrink-0 tabular-nums">
          <Diamond className="w-3.5 h-3.5 fill-white text-white" />
          {proPoints}
        </div>
      </button>

      {/* 3 Action Tiles: Help, Safety, Settings */}
      <div className="px-5 grid grid-cols-3 gap-3 mb-4">
        <button
          type="button"
          onClick={() => setSubView('help')}
          className="h-24 rounded-2xl bg-[#F3F3F3] dark:bg-[#16181D] hover:bg-[#E8E8E8] dark:hover:bg-white/10 active:scale-[0.98] flex flex-col items-center justify-center gap-2 transition-all"
        >
          <HelpCircle className="w-6 h-6 text-black dark:text-white stroke-[2.2]" />
          <span className="text-[14px] font-bold text-black dark:text-white">Help</span>
        </button>

        <button
          type="button"
          onClick={onOpenSafety}
          className="h-24 rounded-2xl bg-[#F3F3F3] dark:bg-[#16181D] hover:bg-[#E8E8E8] dark:hover:bg-white/10 active:scale-[0.98] flex flex-col items-center justify-center gap-2 transition-all"
        >
          <Shield className="w-6 h-6 text-black dark:text-white stroke-[2.2]" />
          <span className="text-[14px] font-bold text-black dark:text-white">Safety</span>
        </button>

        <button
          type="button"
          onClick={onOpenPreferences}
          className="h-24 rounded-2xl bg-[#F3F3F3] dark:bg-[#16181D] hover:bg-[#E8E8E8] dark:hover:bg-white/10 active:scale-[0.98] flex flex-col items-center justify-center gap-2 transition-all"
        >
          <Settings className="w-6 h-6 text-black dark:text-white stroke-[2.2]" />
          <span className="text-[14px] font-bold text-black dark:text-white">Settings</span>
        </button>
      </div>

      {/* Trips Menu Entry Card */}
      <div className="px-5 mb-4 space-y-2.5">
        <button
          type="button"
          onClick={onOpenTrips}
          className="w-full p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] hover:bg-[#F3F3F3] dark:hover:bg-white/5 flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-black dark:bg-[#276EF1] text-white flex items-center justify-center shrink-0">
              <Car className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-black dark:text-white">Trips</p>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400 tabular-nums truncate">
                {tripStats.totalReceived} received · {tripStats.accepted} accepted ·{' '}
                {tripStats.declined} declined
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B6B6B] shrink-0" />
        </button>

        {/* Cloud Firestore Sync Card */}
        <div className="p-3.5 rounded-2xl border border-[#276EF1]/25 bg-[#F4F8FF] dark:bg-[#161F33] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#276EF1] text-white flex items-center justify-center shrink-0">
              {googleUser ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-black dark:text-white truncate">
                {googleUser ? `Cloud Sync · ${googleUser.displayName || 'Connected'}` : 'Cloud Backup Offline'}
              </p>
              <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 truncate">
                {googleUser
                  ? syncStatus === 'syncing'
                    ? 'Syncing ledger & trips to Firestore...'
                    : lastCloudSyncAt
                    ? `Synced ${new Date(lastCloudSyncAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · ${googleUser.email}`
                    : googleUser.email
                  : 'Connect Google to sync earnings, trips & reserves'}
              </p>
            </div>
          </div>
          {googleUser ? (
            <button
              type="button"
              disabled={authLoading}
              onClick={() => void signOutGoogle()}
              className="px-2.5 h-8 rounded-lg bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 text-[11.5px] font-bold text-[#E11900] dark:text-red-300 shrink-0"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              disabled={authLoading}
              onClick={() => void signInWithGoogle()}
              className="px-3 h-8 rounded-lg bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[12px] font-bold shrink-0"
            >
              {authLoading ? '...' : 'Google Sync'}
            </button>
          )}
        </div>
      </div>

      {/* Night Mode, Face ID Check & UK Driving Hours */}
      <div className="px-5 mb-5 space-y-2.5">
        <h2 className="text-[17px] font-extrabold text-black dark:text-white">
          Driver Appearance & Verification
        </h2>

        {/* Night Mode Toggle Card */}
        <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0">
              <Moon className="w-4 h-4 text-[#276EF1]" />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-black dark:text-white">Night Mode</p>
              <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 truncate">
                {preferences.nightMode ? 'Dark Uber map & cockpit active' : 'Daylight map theme active'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleNightMode}
            aria-label="Toggle Night Mode"
            className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
              preferences.nightMode ? 'bg-[#276EF1]' : 'bg-[#DCDCDC] dark:bg-white/20'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                preferences.nightMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Real-Time ID Check (Face Verify) Card */}
        <button
          type="button"
          onClick={onOpenFaceVerify}
          className="w-full rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] hover:bg-[#F3F3F3] dark:hover:bg-white/5 p-3.5 flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0">
              <ShieldCheck
                className={`w-4 h-4 ${isFaceVerifiedRecently ? 'text-[#05944F]' : 'text-[#276EF1]'}`}
              />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-black dark:text-white">
                Real-Time ID Check (Face Verify)
              </p>
              <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 truncate">
                {isFaceVerifiedRecently
                  ? `Verified today · ${account.phvBadge}`
                  : 'Required before going online in the UK'}
              </p>
            </div>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-[11.5px] font-bold shrink-0 ${
              isFaceVerifiedRecently
                ? 'bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F]'
                : 'bg-[#276EF1] text-white'
            }`}
          >
            {isFaceVerifiedRecently ? 'Verified' : 'Verify'}
          </span>
        </button>

        {/* UK 12h Driving Time Indicator */}
        <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0">
              <Clock className={`w-4 h-4 ${remainingMin <= 0 ? 'text-[#E11900]' : 'text-[#05944F]'}`} />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-black dark:text-white">UK Driving Time Limit</p>
              <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 truncate">
                {remainingMin <= 0
                  ? '12h daily limit reached · 6h mandatory UK rest'
                  : '12h legal UK daily driving allowance'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[13px] font-extrabold tabular-nums ${
                remainingMin <= 0 ? 'text-[#E11900]' : 'text-black dark:text-white'
              }`}
            >
              {remHours}h {remMins}m left
            </span>
            {onResetRestLock && account.drivingMinutesUsedToday > 0 && (
              <button
                type="button"
                onClick={onResetRestLock}
                className="px-2.5 h-7 rounded-lg bg-[#276EF1] text-white text-[11px] font-bold"
              >
                6h Rest
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications & Background App Refresh Controls */}
      <div className="px-5 mb-5 space-y-2.5">
        <h2 className="text-[17px] font-extrabold text-black dark:text-white">
          Alerts & Background Refresh
        </h2>

        <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4 text-[#276EF1]" />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-black dark:text-white">Driver Notifications</p>
                <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 truncate">
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
                preferences.notificationsEnabled ? 'bg-[#276EF1]' : 'bg-[#DCDCDC] dark:bg-white/20'
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
            className="w-full h-9 rounded-xl bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 hover:bg-[#F3F3F3] dark:hover:bg-white/15 active:scale-[0.99] text-[12.5px] font-bold text-black dark:text-white transition-all"
          >
            Send Test Trip Notification
          </button>
        </div>

        <div className="rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#16181D] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 flex items-center justify-center shrink-0">
                <RefreshCw
                  className={`w-4 h-4 text-[#05944F] ${
                    isRefreshing ? 'animate-spin' : ''
                  }`}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-black dark:text-white">Background App Refresh</p>
                <p className="text-[11.5px] text-[#545454] dark:text-neutral-400 truncate tabular-nums">
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
                preferences.backgroundAppRefresh ? 'bg-[#05944F]' : 'bg-[#DCDCDC] dark:bg-white/20'
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
              className="flex-1 h-9 rounded-xl bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 hover:bg-[#F3F3F3] dark:hover:bg-white/15 active:scale-[0.99] text-[12.5px] font-bold text-black dark:text-white transition-all"
            >
              Sync Now
            </button>
            <button
              type="button"
              onClick={onOpenPermissions}
              className="flex-1 h-9 rounded-xl bg-black dark:bg-[#276EF1] hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] active:scale-[0.99] text-[12.5px] font-bold text-white transition-all"
            >
              Accept Permissions
            </button>
          </div>
        </div>
      </div>

      {/* More ways to earn */}
      <div className="px-5 mb-5">
        <h2 className="text-[19px] font-extrabold text-black dark:text-white mb-2">
          More ways to earn
        </h2>
        <button
          type="button"
          onClick={onOpenOpportunities}
          className="w-full py-3.5 flex items-center justify-between border-b border-[#EEEEEE] dark:border-white/10 hover:bg-[#FAFAFA] dark:hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <Zap className="w-5 h-5 text-black dark:text-white" />
            <span className="text-[16px] font-semibold text-black dark:text-white">Opportunities</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
        </button>
      </div>

      {/* Manager, Money, Resources, Waybill, Switch / Sign Out */}
      <div className="px-5 divide-y divide-[#EEEEEE] dark:divide-white/10">
        <button
          type="button"
          onClick={() => setSubView('vehicles')}
          className="w-full py-3.5 flex items-center justify-between hover:bg-[#FAFAFA] dark:hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <Car className="w-5 h-5 text-black dark:text-white" />
            <div>
              <p className="text-[16px] font-semibold text-black dark:text-white">Vehicles & Documents</p>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400">{activeVehicle.name}</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
        </button>

        <button
          type="button"
          onClick={() => setSubView('money')}
          className="w-full py-3.5 flex items-center justify-between hover:bg-[#FAFAFA] dark:hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <Landmark className="w-5 h-5 text-black dark:text-white" />
            <span className="text-[16px] font-semibold text-black dark:text-white">Tax & Payouts</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
        </button>

        <button
          type="button"
          onClick={() => setSubView('waybill')}
          className="w-full py-3.5 flex items-center justify-between hover:bg-[#FAFAFA] dark:hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <FileText className="w-5 h-5 text-black dark:text-white" />
            <span className="text-[16px] font-semibold text-black dark:text-white">Waybill</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
        </button>

        <button
          type="button"
          onClick={() => setSubView('resources')}
          className="w-full py-3.5 flex items-center justify-between hover:bg-[#FAFAFA] dark:hover:bg-white/5 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <BookOpen className="w-5 h-5 text-black dark:text-white" />
            <span className="text-[16px] font-semibold text-black dark:text-white">Resources</span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#6B6B6B]" />
        </button>

        <PWAInstallButton variant="row" />

        <button
          type="button"
          onClick={onSignOut}
          className="w-full py-3.5 flex items-center justify-between hover:bg-[#FEECEB]/50 dark:hover:bg-red-950/30 transition-colors text-left"
        >
          <div className="flex items-center gap-3.5">
            <LogOut className="w-5 h-5 text-[#E11900]" />
            <span className="text-[16px] font-semibold text-[#E11900]">
              Sign Out ({account.name})
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-[#E11900]" />
        </button>
      </div>
    </div>
  );
};

