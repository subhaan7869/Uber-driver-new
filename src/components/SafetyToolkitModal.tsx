import React, { useState } from 'react';
import { Mic, PhoneCall, Share2, Shield, Siren, X } from 'lucide-react';
import { DriverPreferences } from '../types/driver';

interface SafetyToolkitModalProps {
  preferences: DriverPreferences;
  onTogglePreference: (key: keyof DriverPreferences) => void;
  onClose: () => void;
}

export const SafetyToolkitModal: React.FC<SafetyToolkitModalProps> = ({
  preferences,
  onTogglePreference,
  onClose,
}) => {
  const [emergencyConfirmed, setEmergencyConfirmed] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#141416] w-full sm:max-w-[420px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#E8F0FE] dark:bg-[#276EF1]/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#276EF1]" />
            </div>
            <h3 className="text-[20px] font-bold text-black dark:text-white">Safety Toolkit</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 flex items-center justify-center"
            aria-label="Close Safety Toolkit"
          >
            <X className="w-5 h-5 text-black dark:text-white" />
          </button>
        </div>

        <div className="space-y-3">
          {/* 999 Emergency */}
          <div className="p-4 rounded-2xl bg-[#FEECEB] dark:bg-red-950/40 border border-[#E11900]/15 dark:border-red-500/20">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Siren className="w-5 h-5 text-[#E11900] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[15px] font-bold text-black dark:text-white">999 Assistance</p>
                  <p className="text-[13px] text-[#545454] dark:text-neutral-300">
                    Share live GPS coordinates & vehicle details with dispatchers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEmergencyConfirmed((v) => !v)}
                className={`px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap transition-colors ${
                  emergencyConfirmed
                    ? 'bg-black text-white'
                    : 'bg-[#E11900] text-white hover:bg-[#C11400]'
                }`}
              >
                {emergencyConfirmed ? 'Cancel Alert' : 'Call 999'}
              </button>
            </div>
            {emergencyConfirmed && (
              <p className="mt-2.5 text-[12px] font-semibold text-[#E11900] dark:text-red-300">
                Simulation mode: Emergency dispatch test card active — no real call placed.
              </p>
            )}
          </div>

          {/* Share My Trip */}
          <button
            type="button"
            onClick={() => onTogglePreference('shareTripStatus')}
            className="w-full p-4 rounded-2xl bg-[#F6F6F6] dark:bg-[#1B1D22] hover:bg-[#EEEEEE] dark:hover:bg-white/10 flex items-center justify-between gap-3 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <Share2 className="w-5 h-5 text-[#276EF1] shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white">Share my trip</p>
                <p className="text-[13px] text-[#545454] dark:text-neutral-400">
                  Send live location link to trusted contacts
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                preferences.shareTripStatus
                  ? 'bg-[#276EF1] text-white'
                  : 'bg-white dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10'
              }`}
            >
              {preferences.shareTripStatus ? 'On' : 'Off'}
            </span>
          </button>

          {/* Record Audio */}
          <button
            type="button"
            onClick={() => onTogglePreference('recordAudio')}
            className="w-full p-4 rounded-2xl bg-[#F6F6F6] dark:bg-[#1B1D22] hover:bg-[#EEEEEE] dark:hover:bg-white/10 flex items-center justify-between gap-3 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-black dark:text-white shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white">Record audio</p>
                <p className="text-[13px] text-[#545454] dark:text-neutral-400">
                  Encrypted in-app trip audio recording
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                preferences.recordAudio
                  ? 'bg-[#05944F] text-white'
                  : 'bg-white dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10'
              }`}
            >
              {preferences.recordAudio ? 'Active' : 'Off'}
            </span>
          </button>

          {/* Speed Limit Alerts */}
          <button
            type="button"
            onClick={() => onTogglePreference('speedLimitAlerts')}
            className="w-full p-4 rounded-2xl bg-[#F6F6F6] dark:bg-[#1B1D22] hover:bg-[#EEEEEE] dark:hover:bg-white/10 flex items-center justify-between gap-3 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <PhoneCall className="w-5 h-5 text-black dark:text-white shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black dark:text-white">Speed limit alerts</p>
                <p className="text-[13px] text-[#545454] dark:text-neutral-400">
                  Show posted UK speed limit sign on navigation map
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                preferences.speedLimitAlerts
                  ? 'bg-black dark:bg-[#276EF1] text-white'
                  : 'bg-white dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10'
              }`}
            >
              {preferences.speedLimitAlerts ? 'On' : 'Off'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
