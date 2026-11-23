import React, { useState } from 'react';
import { BatteryCharging, CheckCircle2, Fuel, MapPin, X, Zap } from 'lucide-react';
import { Coordinates } from '../types/driver';
import {
  getNearbyUKChargers,
  getUKFuelStations,
  UKFuelStation,
  UKRapidCharger,
} from '../utils/ukRealism';

interface RapidChargersModalProps {
  driverPos: Coordinates;
  batteryPct: number;
  isEV?: boolean;
  onSelectCharge: (payload: {
    label: string;
    category: 'charging' | 'fuel';
    amount: number;
    kwhOrLitres: number;
  }) => void;
  onClose: () => void;
}

export const RapidChargersModal: React.FC<RapidChargersModalProps> = ({
  driverPos,
  batteryPct,
  isEV = true,
  onSelectCharge,
  onClose,
}) => {
  const [fuelLitres, setFuelLitres] = useState(25);
  const chargers = getNearbyUKChargers(driverPos, batteryPct);
  const fuelStations = getUKFuelStations(driverPos, batteryPct);

  const handleChargeStation = (station: UKRapidCharger) => {
    onSelectCharge({
      label: `${station.network} ${station.powerKw}kW (${station.name})`,
      category: 'charging',
      amount: station.estCostGbp,
      kwhOrLitres: station.kwhAdded,
    });
    onClose();
  };

  const handleFuelStation = (station: UKFuelStation) => {
    onSelectCharge({
      label: `${station.brand} ${station.fuelGrade} (${station.litresNeeded}L)`,
      category: 'fuel',
      amount: station.estCostGbp,
      kwhOrLitres: station.litresNeeded,
    });
    onClose();
  };

  const handleLogPetrol = () => {
    const fuelCost = Number((fuelLitres * 1.44).toFixed(2));
    onSelectCharge({
      label: `UK Unleaded / Hybrid Refuel (${fuelLitres}L)`,
      category: 'fuel',
      amount: fuelCost,
      kwhOrLitres: fuelLitres,
    });
    onClose();
  };

  const fuelSection = (
    <div className="space-y-2.5">
      <p className="text-[12px] font-bold uppercase tracking-wide text-[#545454] dark:text-neutral-400">
        Nearby UK Fuel Forecourts (Fills Tank to 100%)
      </p>
      {fuelStations.map((station) => (
        <button
          key={station.id}
          type="button"
          onClick={() => handleFuelStation(station)}
          className="w-full p-3.5 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] hover:bg-[#FFFBEB] dark:hover:bg-amber-950/30 flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Fuel className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
              <p className="text-[14.5px] font-bold text-black dark:text-white truncate">
                {station.brand} · {station.fuelGrade}
              </p>
            </div>
            <p className="text-[12px] text-[#545454] dark:text-neutral-400 flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {station.name} · {station.distanceMiles} mi
            </p>
            <p className="text-[11px] font-semibold text-[#D97706] mt-1 tabular-nums">
              +{station.litresNeeded}L @ £{station.pricePerLitre.toFixed(2)}/L
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-block px-3 py-1.5 rounded-xl bg-[#D97706] text-white text-[13px] font-extrabold tabular-nums">
              £{station.estCostGbp.toFixed(2)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );

  const evSection = (
    <div className="space-y-2.5">
      <p className="text-[12px] font-bold uppercase tracking-wide text-[#545454] dark:text-neutral-400">
        Nearby UK Rapid EV Hubs (Restores 100%)
      </p>
      {chargers.map((station) => (
        <button
          key={station.id}
          type="button"
          onClick={() => handleChargeStation(station)}
          className="w-full p-3.5 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] hover:bg-[#F0F7FF] dark:hover:bg-[#1D2536] flex items-center justify-between gap-3 text-left transition-colors"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#05944F] shrink-0" />
              <p className="text-[14.5px] font-bold text-black dark:text-white truncate">
                {station.network} · {station.powerKw}kW
              </p>
            </div>
            <p className="text-[12px] text-[#545454] dark:text-neutral-400 flex items-center gap-1 mt-0.5 truncate">
              <MapPin className="w-3 h-3 shrink-0" />
              {station.name} · {station.distanceMiles} mi (~{station.estMinutes} min)
            </p>
            <p className="text-[11px] font-semibold text-[#276EF1] mt-1 tabular-nums">
              +{station.kwhAdded} kWh @ £{station.pricePerKwh.toFixed(2)}/kWh
            </p>
          </div>
          <div className="text-right shrink-0">
            <span className="inline-block px-3 py-1.5 rounded-xl bg-black dark:bg-[#276EF1] text-white text-[13px] font-extrabold tabular-nums">
              £{station.estCostGbp.toFixed(2)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-[#141416] w-full sm:max-w-[440px] rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl border border-black/10 dark:border-white/10 max-h-[88vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isEV
                  ? 'bg-[#E6F4EA] dark:bg-emerald-950/60 text-[#05944F]'
                  : 'bg-[#FFF3D6] dark:bg-amber-950/60 text-[#D97706]'
              }`}
            >
              {isEV ? <BatteryCharging className="w-5 h-5" /> : <Fuel className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-[19px] font-extrabold text-black dark:text-white">
                {isEV ? 'UK Rapid Chargers & Fuel' : 'UK Fuel Forecourts & EV Hubs'}
              </h3>
              <p className="text-[12px] text-[#545454] dark:text-neutral-400 tabular-nums">
                {isEV ? 'EV Battery' : 'Fuel Tank'}: {batteryPct}% (~{Math.round((batteryPct / 100) * (isEV ? 250 : 380))} mi)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center"
            aria-label="Close charging stations"
          >
            <X className="w-4 h-4 text-black dark:text-white" />
          </button>
        </div>

        {isEV ? (
          <>
            {evSection}
            {fuelSection}
          </>
        ) : (
          <>
            {fuelSection}
            {evSection}
          </>
        )}

        {/* Quick Custom Litre Receipt */}
        <div className="p-4 rounded-2xl border border-[#E6E6E6] dark:border-white/10 bg-[#FAFAFA] dark:bg-[#1B1D22] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-[#D97706]" />
              <span className="text-[13.5px] font-bold text-black dark:text-white">
                Custom Fuel Receipt (£1.44/L)
              </span>
            </div>
            <span className="text-[13px] font-extrabold text-black dark:text-white tabular-nums">
              {fuelLitres}L · £{(fuelLitres * 1.44).toFixed(2)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[15, 25, 35, 45].map((litres) => (
              <button
                key={litres}
                type="button"
                onClick={() => setFuelLitres(litres)}
                className={`h-8 rounded-lg text-[12px] font-bold tabular-nums transition-colors ${
                  fuelLitres === litres
                    ? 'bg-black dark:bg-[#276EF1] text-white'
                    : 'bg-white dark:bg-white/10 text-black dark:text-white border border-black/10 dark:border-white/10'
                }`}
              >
                {litres}L
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleLogPetrol}
            className="w-full h-10 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Log Refuel & Restore Range to 100%</span>
          </button>
        </div>
      </div>
    </div>
  );
};
