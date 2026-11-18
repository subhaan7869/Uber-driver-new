import React from 'react';
import { Car, Check, Moon, Package, PawPrint, Sparkles, Volume2, X } from 'lucide-react';
import { DriverPreferences } from '../types/driver';

interface PreferencesSheetProps {
  preferences: DriverPreferences;
  onTogglePreference: (key: keyof DriverPreferences) => void;
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
  onTogglePreference,
  onResetDefaults,
  onClose,
}) => {
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

          <button
            type="button"
            onClick={() => onTogglePreference('soundEffects')}
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

