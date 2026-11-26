import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, Calculator, Pause, Play, Plus } from 'lucide-react';
import { TripOffer, TripStage } from '../types/driver';
import { getUKTaxiMeterRates } from '../utils/ukRealism';

interface TaxiMeterWidgetProps {
  trip: TripOffer;
  stage: TripStage;
  navProgress?: number; // 0..1 when enroute
  onFareChange?: (fare: number) => void;
}

export const TaxiMeterWidget: React.FC<TaxiMeterWidgetProps> = ({
  trip,
  stage,
  navProgress = 0,
  onFareChange,
}) => {
  const defaultRates = useMemo(() => getUKTaxiMeterRates(trip.serviceName), [trip.serviceName]);
  const [tariff, setTariff] = useState<'t1' | 't2'>(
    defaultRates.tariffLabel.startsWith('Tariff 2') ? 't2' : 't1'
  );
  const [waitRunning, setWaitRunning] = useState(false);
  const [waitSec, setWaitSec] = useState(0);
  const [extrasGbp, setExtrasGbp] = useState(0);
  const [simElapsedSec, setSimElapsedSec] = useState(0);
  const [cashTendered, setCashTendered] = useState<number | null>(null);

  useEffect(() => {
    setWaitRunning(false);
    setWaitSec(0);
    setExtrasGbp(0);
    setSimElapsedSec(0);
    setCashTendered(null);
  }, [trip.id]);

  // Auto-run wait meter on stop_wait, or pause at dropoff_arrived
  useEffect(() => {
    if (stage === 'stop_wait') {
      setWaitRunning(true);
    } else if (stage === 'dropoff_arrived' || stage === 'completed') {
      setWaitRunning(false);
    }
  }, [stage]);

  useEffect(() => {
    if (stage !== 'enroute' && stage !== 'stop_wait' && stage !== 'waiting') return;
    const t = window.setInterval(() => {
      if (stage === 'enroute') {
        setSimElapsedSec((s) => s + 1);
      }
      if (waitRunning) {
        setWaitSec((w) => w + 1);
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, [stage, waitRunning]);

  const flagFall =
    trip.meterStartFare ?? (tariff === 't2' ? 4.4 : 3.6);
  const baseRatePerMile =
    trip.meterRatePerMile ?? (tariff === 't2' ? 2.85 : 2.35);
  const ratePerMile =
    tariff === 't2' && defaultRates.tariffLabel.startsWith('Tariff 1')
      ? Number((baseRatePerMile * 1.2).toFixed(2))
      : tariff === 't1' && defaultRates.tariffLabel.startsWith('Tariff 2')
      ? Number((baseRatePerMile / 1.2).toFixed(2))
      : baseRatePerMile;
  const waitPerMin = tariff === 't2' ? 0.5 : 0.4;

  // Compute progress miles along route (or full tripMiles at dropoff_arrived)
  const effectiveMiles =
    stage === 'dropoff_arrived' || stage === 'completed'
      ? trip.tripMiles
      : stage === 'waiting'
      ? 0
      : Math.min(
          trip.tripMiles,
          Math.max(
            Number((trip.tripMiles * navProgress).toFixed(2)),
            Number(((simElapsedSec / Math.max(12, trip.tripMinutes * 1.6)) * trip.tripMiles).toFixed(2))
          )
        );

  const distanceFare = effectiveMiles * ratePerMile;
  const waitFare = (waitSec / 60) * waitPerMin;
  const surcharge = trip.surchargeAmount ?? 0;

  const liveMeterTotal = Number(
    Math.max(
      flagFall,
      flagFall + distanceFare + waitFare + extrasGbp + surcharge
    ).toFixed(2)
  );

  useEffect(() => {
    onFareChange?.(liveMeterTotal);
  }, [liveMeterTotal, onFareChange]);

  const formatMmSs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const changeDue =
    cashTendered !== null ? Number((cashTendered - liveMeterTotal).toFixed(2)) : null;

  return (
    <div className="rounded-2xl bg-[#101318] text-white border border-white/15 p-3.5 shadow-lg space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-[#05944F] flex items-center justify-center shrink-0">
            <Banknote className="w-4 h-4 text-white" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#4ADE80] flex items-center gap-1.5">
              <span>UK Cash Taxi Meter</span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
            </p>
            <p className="text-[11px] text-white/65 tabular-nums truncate">
              Flag £{flagFall.toFixed(2)} · £{ratePerMile.toFixed(2)}/mi · Wait £{waitPerMin.toFixed(2)}/m
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTariff((t) => (t === 't1' ? 't2' : 't1'))}
          className="px-2.5 h-7 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-bold text-[#FFC043] shrink-0"
        >
          {tariff === 't1' ? 'Tariff 1 (Day)' : 'Tariff 2 (Night)'}
        </button>
      </div>

      {/* Digital LED Meter Readout */}
      <div className="rounded-xl bg-black/75 border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/55">
            {stage === 'dropoff_arrived' ? 'Final Cash Due' : 'Running Meter'}
          </p>
          <p className="text-[30px] leading-none font-extrabold text-[#4ADE80] font-mono tabular-nums mt-0.5">
            £{liveMeterTotal.toFixed(2)}
          </p>
        </div>
        <div className="text-right text-[11.5px] font-mono tabular-nums text-white/80 space-y-0.5">
          <p>
            Dist: <span className="font-bold text-white">{effectiveMiles.toFixed(2)} mi</span>
          </p>
          <p>
            Wait: <span className="font-bold text-white">{formatMmSs(waitSec)}</span>
            {extrasGbp > 0 && (
              <span className="text-[#FFC043]"> · +£{extrasGbp.toFixed(2)}</span>
            )}
          </p>
        </div>
      </div>

      {stage !== 'dropoff_arrived' ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setWaitRunning((v) => !v)}
            className={`h-9 rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
              waitRunning
                ? 'bg-[#F59E0B] text-black'
                : 'bg-white/10 hover:bg-white/15 text-white'
            }`}
          >
            {waitRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{waitRunning ? 'Pause Wait' : 'Meter Wait'}</span>
          </button>
          <button
            type="button"
            onClick={() => setExtrasGbp((e) => Number((e + 2).toFixed(2)))}
            className="h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[12px] font-bold flex items-center justify-center gap-1 transition-colors tabular-nums"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>£2.00 Extra (Bags)</span>
          </button>
        </div>
      ) : (
        <div className="pt-1 space-y-2">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-bold text-white/80 flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-[#4ADE80]" />
              Cash Tendered &amp; Change Calculator
            </span>
            {changeDue !== null && (
              <span
                className={`font-extrabold tabular-nums ${
                  changeDue >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'
                }`}
              >
                {changeDue >= 0
                  ? `Give Change: £${changeDue.toFixed(2)}`
                  : `Short: £${Math.abs(changeDue).toFixed(2)}`}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'Exact', amount: liveMeterTotal },
              { label: '£10', amount: 10 },
              { label: '£20', amount: 20 },
              { label: '£50', amount: 50 },
            ].map((opt) => {
              const active = cashTendered === opt.amount;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setCashTendered(opt.amount)}
                  className={`h-9 rounded-lg text-[12px] font-bold tabular-nums transition-colors ${
                    active
                      ? 'bg-[#05944F] text-white'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
