import React from 'react';
import {
  Car,
  Check,
  CircleDot,
  Clock,
  Compass,
  ExternalLink,
  Layers,
  Lock,
  Moon,
  Package,
  PawPrint,
  Route,
  ShieldAlert,
  Sparkles,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import { DriverPreferences, NavProvider } from '../types/driver';
import { uberSounds } from '../utils/uberSounds';

interface PreferencesSheetProps {
  preferences: DriverPreferences;
  accountTier?: 'Diamond' | 'Platinum' | 'Gold';
  onTogglePreference: (key: keyof DriverPreferences) => void;
  onSetNavProvider?: (provider: NavProvider) => void;
  onSetFloatingDotMode?: (mode: 'dot' | 'card') => void;
  onSetAreaPreference?: (area: NonNullable<DriverPreferences['areaPreference']>) => void;
  onResetDefaults: () => void;
  onClose: () => void;
}

const SERVICE_OPTIONS: Array<{
  key: keyof DriverPreferences;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'uberX',
    title: 'UberX',
    subtitle: 'Everyday affordable rides for up to 4 passengers',
    icon: <Car className="w-5 h-5 text-black dark:text-white" />,
  },
  {
    key: 'comfort',
    title: 'Comfort',
    subtitle: 'Newer cars with extra legroom & top-rated drivers',
    icon: <Sparkles className="w-5 h-5 text-black dark:text-white" />,
  },
  {
    key: 'intercity',
    title: 'Intercity (Out of City)',
    subtitle: 'Long-distance motorway runs (Oxford, Brighton, Birmingham)',
    icon: <Route className="w-5 h-5 text-[#7C3AED]" />,
  },
  {
    key: 'uberXL',
    title: 'UberXL',
    subtitle: 'Larger rides for up to 6 passengers',
    icon: <Car className="w-5 h-5 text-black dark:text-white" />,
  },
  {
    key: 'uberPet',
    title: 'Uber Pet',
    subtitle: 'Rides for passengers traveling with a pet',
    icon: <PawPrint className="w-5 h-5 text-black dark:text-white" />,
  },
  {
    key: 'deliveries',
    title: 'Deliveries (Uber Eats)',
    subtitle: 'Restaurant food & package dropoffs',
    icon: <Package className="w-5 h-5 text-black dark:text-white" />,
  },
];

export const PreferencesSheet: React.FC<PreferencesSheetProps> = ({
  preferences,
  accountTier = 'Diamond',
  onTogglePreference,
  onSetNavProvider,
  onSetFloatingDotMode,
  onSetAreaPreference,
  onResetDefaults,
  onClose,
}) => {
  const areaUnlocked = accountTier === 'Platinum' || accountTier === 'Diamond';
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#141416] w-full sm:max-w-[430px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10 max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[20px] font-bold text-black dark:text-white">Driving Preferences</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
            aria-label="Close Driving Preferences"
          >
            <X className="w-5 h-5 text-black dark:text-white" />
          </button>
        </div>

        <p className="text-[13px] font-semibold text-[#545454] dark:text-neutral-400 mb-3">Services</p>
        <div className="space-y-2 mb-5">
          {SERVICE_OPTIONS.map((item) => {
            const active = preferences[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onTogglePreference(item.key)}
                className={`w-full p-3.5 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all ${
                  active
                    ? 'border-black dark:border-[#276EF1] bg-[#F9F9F9] dark:bg-[#1C2230]'
                    : 'border-[#EEEEEE] dark:border-white/10 bg-white dark:bg-[#1B1D22] hover:bg-[#FAFAFA] dark:hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#EEEEEE] dark:bg-white/10 flex items-center justify-center shrink-0">
                    {item.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-black dark:text-white">{item.title}</p>
                    <p className="text-[12px] text-[#545454] dark:text-neutral-400 truncate">{item.subtitle}</p>
                  </div>
                </div>
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    active ? 'bg-[#276EF1] text-white' : 'border-2 border-[#CCCCCC] dark:border-white/25'
                  }`}
                >
                  {active && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="border-t border-[#EEEEEE] dark:border-white/10 pt-4 space-y-3.5 mb-5">
          <button
            type="button"
            onClick={() => onTogglePreference('nightMode')}
            className="w-full flex items-center justify-between py-1 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <Moon className="w-4 h-4 text-[#276EF1] shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white">Night Mode</p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                  Dark Uber map & low-glare driver cockpit
                </p>
              </div>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.nightMode ? 'bg-[#276EF1]' : 'bg-[#DCDCDC] dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.nightMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTogglePreference('voiceNavigation')}
            className="w-full flex items-center justify-between py-1 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <Volume2 className="w-4 h-4 text-[#05944F] shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white">UK Voice Navigation</p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                  Speak turn-by-turn UK directions aloud
                </p>
              </div>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.voiceNavigation ? 'bg-[#05944F]' : 'bg-[#DCDCDC] dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.voiceNavigation ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTogglePreference('rushNav')}
            className="w-full flex items-center justify-between py-1 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <Zap className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white">Rush Nav</p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                  Accelerate navigation progress to finish trips quicker
                </p>
              </div>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.rushNav ? 'bg-[#F59E0B]' : 'bg-[#DCDCDC] dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.rushNav ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTogglePreference('showTrafficLayer')}
            className="w-full flex items-center justify-between py-1 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <Layers className="w-4 h-4 text-[#05944F] shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white">Live UK Motorway Traffic</p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                  Green/amber/red flow on M1, M25, M4, M6 & M40
                </p>
              </div>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.showTrafficLayer ? 'bg-[#05944F]' : 'bg-[#DCDCDC] dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.showTrafficLayer ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTogglePreference('showUKZones')}
            className="w-full flex items-center justify-between py-1 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <Layers className="w-4 h-4 text-[#7C3AED] shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white">London CC & ULEZ Zones</p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                  Display Congestion Charge & ULEZ boundaries on map
                </p>
              </div>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.showUKZones ? 'bg-[#7C3AED]' : 'bg-[#DCDCDC] dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.showUKZones ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTogglePreference('speedCameraWarnings')}
            className="w-full flex items-center justify-between py-1 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <ShieldAlert className="w-4 h-4 text-[#E11900] shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white">Speed & Bus-Lane Cameras</p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                  Alert on UK average-speed & red-light camera traps
                </p>
              </div>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.speedCameraWarnings ? 'bg-[#E11900]' : 'bg-[#DCDCDC] dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.speedCameraWarnings ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTogglePreference('showBusySoonZones')}
            className="w-full flex items-center justify-between py-1 text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <Clock className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white">Busy Soon Forecasts</p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                  Predict upcoming stadium, airport & commuter surges
                </p>
              </div>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.showBusySoonZones ? 'bg-[#F59E0B]' : 'bg-[#DCDCDC] dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.showBusySoonZones ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          {/* Floating Dot Overlay Behavior (Dot Default vs Auto Job Card) */}
          {onSetFloatingDotMode && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-black dark:text-white flex items-center gap-1.5">
                  <CircleDot className="w-3.5 h-3.5 text-[#276EF1]" />
                  <span>Floating Dot Alert Mode</span>
                </p>
                <span className="text-[11.5px] text-[#545454] dark:text-neutral-400">
                  When minimized
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    {
                      id: 'dot',
                      title: 'Dot Only (Default)',
                      desc: 'Stay as a compact dot; tap dot to view card',
                    },
                    {
                      id: 'card',
                      title: 'Auto-Show Job Card',
                      desc: 'Pop open the full job card automatically',
                    },
                  ] as const
                ).map((opt) => {
                  const active = (preferences.floatingDotAlertMode ?? 'dot') === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSetFloatingDotMode(opt.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        active
                          ? 'bg-black dark:bg-[#276EF1] text-white border-black dark:border-[#276EF1]'
                          : 'bg-[#F6F6F6] dark:bg-white/5 text-black dark:text-white border-transparent hover:bg-[#EAEAEA] dark:hover:bg-white/10'
                      }`}
                    >
                      <p className="text-[12.5px] font-bold leading-tight">{opt.title}</p>
                      <p
                        className={`text-[10.5px] mt-0.5 leading-snug ${
                          active ? 'text-white/80' : 'text-[#545454] dark:text-neutral-400'
                        }`}
                      >
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Uber Pro Area Preference Filter (Unlocked for Platinum / Diamond) */}
          {onSetAreaPreference && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-black dark:text-white flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-[#7C3AED]" />
                  <span>Area Preference Filter</span>
                </p>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    areaUnlocked
                      ? 'bg-[#7C3AED]/15 text-[#7C3AED] dark:text-[#C4B5FD]'
                      : 'bg-[#F3F3F3] dark:bg-white/10 text-[#6B6B6B] dark:text-neutral-400'
                  }`}
                >
                  {!areaUnlocked && <Lock className="w-3 h-3" />}
                  {areaUnlocked ? `${accountTier} Unlocked` : 'Platinum / Diamond'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {(
                  [
                    { id: 'all', label: 'All UK' },
                    { id: 'central', label: 'Central' },
                    { id: 'east', label: 'East' },
                    { id: 'west', label: 'West/LHR' },
                    { id: 'local', label: 'Local' },
                  ] as const
                ).map((opt) => {
                  const active = (preferences.areaPreference ?? 'all') === opt.id;
                  const disabled = !areaUnlocked && opt.id !== 'all';
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => onSetAreaPreference(opt.id)}
                      className={`h-9 rounded-xl text-[11px] font-bold border transition-all ${
                        active
                          ? 'bg-[#7C3AED] text-white border-[#7C3AED]'
                          : disabled
                          ? 'bg-[#F3F3F3] dark:bg-white/5 text-[#A0A0A0] dark:text-neutral-600 border-transparent opacity-60 cursor-not-allowed'
                          : 'bg-[#F6F6F6] dark:bg-white/5 text-black dark:text-white border-transparent hover:bg-[#EAEAEA] dark:hover:bg-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {!areaUnlocked && (
                <p className="text-[11px] text-[#545454] dark:text-neutral-400">
                  Reach 300 Pro Points &amp; 80% Acceptance Rate (Platinum) to filter dropoff zones.
                </p>
              )}
            </div>
          )}

          {/* Navigation App Provider (Uber Nav vs 3rd-party Maps) */}
          {onSetNavProvider && (
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-black dark:text-white flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 text-[#276EF1]" />
                  <span>Navigation App</span>
                </p>
                <span className="text-[11.5px] text-[#545454] dark:text-neutral-400">
                  Active turn-by-turn
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'uber', label: 'Uber Nav' },
                    { id: 'google', label: 'Google' },
                    { id: 'waze', label: 'Waze' },
                    { id: 'apple', label: 'Apple' },
                  ] as const
                ).map((item) => {
                  const active = (preferences.navProvider ?? 'uber') === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSetNavProvider(item.id)}
                      className={`h-9 rounded-xl text-[12px] font-bold border transition-all ${
                        active
                          ? 'bg-black dark:bg-[#276EF1] text-white border-black dark:border-[#276EF1]'
                          : 'bg-[#F6F6F6] dark:bg-white/5 text-black dark:text-white border-transparent hover:bg-[#EAEAEA] dark:hover:bg-white/10'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => onTogglePreference('autoAccept')}
            className="w-full flex items-center justify-between py-1 text-left"
          >
            <div>
              <p className="text-[15px] font-bold text-black dark:text-white">Auto-accept trip requests</p>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                Automatically accept incoming Exclusive offers
              </p>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.autoAccept ? 'bg-[#276EF1]' : 'bg-[#DCDCDC] dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.autoAccept ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTogglePreference('stopNewRequests')}
            className="w-full flex items-center justify-between py-1 text-left"
          >
            <div>
              <p className="text-[15px] font-bold text-black dark:text-white">Stop new requests</p>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                Go offline automatically after current trip
              </p>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.stopNewRequests ? 'bg-[#E11900]' : 'bg-[#DCDCDC] dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.stopNewRequests ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                uberSounds.unlock();
                onTogglePreference('soundEffects');
              }}
              className="w-full flex items-center justify-between py-1 text-left"
            >
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white">Driver app sounds</p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                  Dispatch pings, online/offline chimes, and trip cues
                </p>
              </div>
              <div
                className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                  preferences.soundEffects ? 'bg-[#276EF1]' : 'bg-[#DCDCDC] dark:bg-white/20'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                    preferences.soundEffects ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
            {preferences.soundEffects && (
              <button
                type="button"
                onClick={() => {
                  uberSounds.unlock();
                  uberSounds.setEnabled(true);
                  uberSounds.play('exclusiveDispatch');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#EAEAEA] dark:hover:bg-white/15 text-[12px] font-bold text-black dark:text-white transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5 text-[#276EF1]" />
                <span>Test Exclusive Chime</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => onTogglePreference('notificationsEnabled')}
            className="w-full flex items-center justify-between py-1 text-left"
          >
            <div>
              <p className="text-[15px] font-bold text-black dark:text-white">Push notifications</p>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                Trip offers, surge alerts, and payout confirmations
              </p>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.notificationsEnabled ? 'bg-[#276EF1]' : 'bg-[#DCDCDC] dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => onTogglePreference('backgroundAppRefresh')}
            className="w-full flex items-center justify-between py-1 text-left"
          >
            <div>
              <p className="text-[15px] font-bold text-black dark:text-white">Background App Refresh</p>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400">
                Sync surge zones, keep screen awake online & periodic sync
              </p>
            </div>
            <div
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 ${
                preferences.backgroundAppRefresh ? 'bg-[#05944F]' : 'bg-[#DCDCDC] dark:bg-white/20'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white shadow-xs transition-transform ${
                  preferences.backgroundAppRefresh ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </button>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onResetDefaults}
            className="flex-1 h-11 rounded-xl bg-[#EEEEEE] dark:bg-white/10 hover:bg-[#E2E2E2] dark:hover:bg-white/15 text-[14px] font-bold text-black dark:text-white transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl bg-black dark:bg-[#276EF1] hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] text-[14px] font-bold text-white transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

