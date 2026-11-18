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
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-[420px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-[#E8F0FE] flex items-center justify-center">
              <Shield className="w-5 h-5 text-[#276EF1]" />
            </div>
            <h3 className="text-[20px] font-bold text-black">Safety Toolkit</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-[#F3F3F3] hover:bg-[#E5E5E5] flex items-center justify-center"
            aria-label="Close Safety Toolkit"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        <div className="space-y-3">
          {/* 911 Emergency */}
          <div className="p-4 rounded-2xl bg-[#FEECEB] border border-[#E11900]/15">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Siren className="w-5 h-5 text-[#E11900] mt-0.5 shrink-0" />
                <div>
                  <p className="text-[15px] font-bold text-black">999 Assistance</p>
                  <p className="text-[13px] text-[#545454]">
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
              <p className="mt-2.5 text-[12px] font-semibold text-[#E11900]">
                Simulation mode: Emergency dispatch test card active — no real call placed.
              </p>
            )}
          </div>

          {/* Share My Trip */}
          <button
            type="button"
            onClick={() => onTogglePreference('shareTripStatus')}
            className="w-full p-4 rounded-2xl bg-[#F6F6F6] hover:bg-[#EEEEEE] flex items-center justify-between gap-3 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <Share2 className="w-5 h-5 text-[#276EF1] shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black">Share my trip</p>
                <p className="text-[13px] text-[#545454]">
                  Send live location link to trusted contacts
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                preferences.shareTripStatus
                  ? 'bg-[#276EF1] text-white'
                  : 'bg-white text-black border border-black/10'
              }`}
            >
              {preferences.shareTripStatus ? 'On' : 'Off'}
            </span>
          </button>

          {/* Record Audio */}
          <button
            type="button"
            onClick={() => onTogglePreference('recordAudio')}
            className="w-full p-4 rounded-2xl bg-[#F6F6F6] hover:bg-[#EEEEEE] flex items-center justify-between gap-3 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <Mic className="w-5 h-5 text-black shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black">Record audio</p>
                <p className="text-[13px] text-[#545454]">
                  Encrypted in-app trip audio recording
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                preferences.recordAudio
                  ? 'bg-[#05944F] text-white'
                  : 'bg-white text-black border border-black/10'
              }`}
            >
              {preferences.recordAudio ? 'Active' : 'Off'}
            </span>
          </button>

          {/* ADT / Speed Limit Alerts */}
          <button
            type="button"
            onClick={() => onTogglePreference('speedLimitAlerts')}
            className="w-full p-4 rounded-2xl bg-[#F6F6F6] hover:bg-[#EEEEEE] flex items-center justify-between gap-3 text-left transition-colors"
          >
            <div className="flex items-center gap-3">
              <PhoneCall className="w-5 h-5 text-black shrink-0" />
              <div>
                <p className="text-[15px] font-bold text-black">Speed limit alerts</p>
                <p className="text-[13px] text-[#545454]">
                  Show posted speed limit sign on navigation map
                </p>
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-[12px] font-bold ${
                preferences.speedLimitAlerts
                  ? 'bg-black text-white'
                  : 'bg-white text-black border border-black/10'
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
