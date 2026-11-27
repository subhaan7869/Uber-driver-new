import {
  BusyRestaurantPin,
  CompletedTrip,
  Coordinates,
  EatsMerchantCategory,
  ExpenseEntry,
  PeakTimeSlotId,
  PeakTimeWindow,
  SurgeZone,
  UKWeatherCondition,
} from '../types/driver';
import { haversineMiles } from './localDispatch';
import { clampMapCoords, mapToLatLng, projectLatLngToMap, UK_AIRPORT_MAP_PINS } from './ukGeo';

export type UKDemandLevel = 'Peak Rush' | 'Night Surge' | 'Steady' | 'Quiet';

export interface UKDemandContext {
  activeSlotId: PeakTimeSlotId;
  activeSlotLabel: 'Morning' | 'Afternoon' | 'Evening' | 'Late Night';
  periodLabel: string;
  demandLevel: UKDemandLevel;
  dispatchMinSec: number;
  dispatchMaxSec: number;
  surgeMultiplier: number;
  isPeakBoostHours: boolean;
}

export const UK_PEAK_TIME_WINDOWS: PeakTimeWindow[] = [
  {
    id: 'morning',
    label: 'Morning',
    windowLabel: '07:00 – 10:00',
    demandLevel: 'Peak Rush',
    surgeMultiplier: 1.35,
    estHourlyRange: '£32–£44/hr',
    ridesFocus: 'Commuters, rail stations & airport drop-offs',
    eatsFocus: 'Breakfast & coffee · Pret, Greggs, McDonald’s',
    isPeak: true,
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    windowLabel: '12:00 – 16:30',
    demandLevel: 'Steady',
    surgeMultiplier: 1.2,
    estHourlyRange: '£26–£35/hr',
    ridesFocus: 'Lunch errands, retail hubs & school/hospital runs',
    eatsFocus: 'Lunch rush · Nando’s, Wagamama, Itsu & Tesco',
    isPeak: false,
  },
  {
    id: 'evening',
    label: 'Evening',
    windowLabel: '16:30 – 21:00',
    demandLevel: 'Peak Rush',
    surgeMultiplier: 1.5,
    estHourlyRange: '£38–£52/hr',
    ridesFocus: 'After-work rush, Boost+ zones & dining districts',
    eatsFocus: 'Dinner peak · Dishoom, Five Guys & PizzaExpress',
    isPeak: true,
  },
  {
    id: 'late_night',
    label: 'Late Night',
    windowLabel: '22:00 – 03:30',
    demandLevel: 'Night Surge',
    surgeMultiplier: 1.6,
    estHourlyRange: '£36–£54/hr',
    ridesFocus: 'Nightlife, gigs & weekend economy surge',
    eatsFocus: 'Late takeaways · McDonald’s 24h, KFC & Wingstop',
    isPeak: true,
  },
];

export interface UKWeatherInfo {
  condition: UKWeatherCondition;
  surgeAdd: number;
  dispatchBoostSec: number;
  advisory: string;
}

export function getUKWeatherInfo(condition: UKWeatherCondition): UKWeatherInfo {
  switch (condition) {
    case 'Heavy Rain':
      return {
        condition,
        surgeAdd: 0.25,
        dispatchBoostSec: 2,
        advisory: 'Heavy rain across UK · Wet-road surge (+0.25x) & shorter dispatches active',
      };
    case 'Light Drizzle':
      return {
        condition,
        surgeAdd: 0.12,
        dispatchBoostSec: 1,
        advisory: 'Light UK drizzle · +0.12x rain demand uplift active',
      };
    case 'Thames Fog':
      return {
        condition,
        surgeAdd: 0.15,
        dispatchBoostSec: 1,
        advisory: 'Low-visibility mist · +0.15x demand boost & extra braking distance',
      };
    default:
      return {
        condition: 'Clear',
        surgeAdd: 0,
        dispatchBoostSec: 0,
        advisory: 'Clear dry UK road conditions',
      };
  }
}

export function computeUberProTier(
  proPoints: number,
  acceptanceRate: number,
  cancellationRate: number
): 'Diamond' | 'Platinum' | 'Gold' {
  if (proPoints >= 600 && acceptanceRate >= 85 && cancellationRate <= 4) {
    return 'Diamond';
  }
  if (proPoints >= 300 && acceptanceRate >= 80 && cancellationRate <= 6) {
    return 'Platinum';
  }
  return 'Gold';
}

export function getUKDemandContext(
  now: Date = new Date(),
  weather: UKWeatherCondition = 'Clear',
  overrideSlot: PeakTimeSlotId | 'auto' = 'auto'
): UKDemandContext {
  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeFloat = hour + minute / 60;
  const isWeekend = now.getDay() === 5 || now.getDay() === 6;
  const weatherInfo = getUKWeatherInfo(weather);

  let activeSlotId: PeakTimeSlotId;
  if (overrideSlot !== 'auto') {
    activeSlotId = overrideSlot;
  } else if (timeFloat >= 4.0 && timeFloat < 12.0) {
    activeSlotId = 'morning';
  } else if (timeFloat >= 12.0 && timeFloat < 16.5) {
    activeSlotId = 'afternoon';
  } else if (timeFloat >= 16.5 && timeFloat < 21.5) {
    activeSlotId = 'evening';
  } else {
    activeSlotId = 'late_night';
  }

  let base: UKDemandContext;
  if (activeSlotId === 'morning') {
    const isMorningRush = overrideSlot === 'morning' || (timeFloat >= 6.5 && timeFloat < 10.25);
    base = {
      activeSlotId: 'morning',
      activeSlotLabel: 'Morning',
      periodLabel: isMorningRush ? 'Morning Commute Rush' : 'Mid-Morning Steady',
      demandLevel: isMorningRush ? 'Peak Rush' : 'Steady',
      dispatchMinSec: isMorningRush ? 5 : 8,
      dispatchMaxSec: isMorningRush ? 13 : 19,
      surgeMultiplier: isMorningRush ? 1.35 : 1.12,
      isPeakBoostHours: isMorningRush,
    };
  } else if (activeSlotId === 'afternoon') {
    const isLunchRush = overrideSlot === 'afternoon' || (timeFloat >= 12.0 && timeFloat < 14.5);
    base = {
      activeSlotId: 'afternoon',
      activeSlotLabel: 'Afternoon',
      periodLabel: isLunchRush ? 'Afternoon Lunch & Retail Peak' : 'Afternoon City Flow',
      demandLevel: isLunchRush ? 'Steady' : 'Steady',
      dispatchMinSec: isLunchRush ? 6 : 7,
      dispatchMaxSec: isLunchRush ? 15 : 18,
      surgeMultiplier: isLunchRush ? 1.2 : 1.12,
      isPeakBoostHours: false,
    };
  } else if (activeSlotId === 'evening') {
    base = {
      activeSlotId: 'evening',
      activeSlotLabel: 'Evening',
      periodLabel: 'Evening Peak & Boost+',
      demandLevel: 'Peak Rush',
      dispatchMinSec: 5,
      dispatchMaxSec: 12,
      surgeMultiplier: 1.5,
      isPeakBoostHours: true,
    };
  } else {
    base = {
      activeSlotId: 'late_night',
      activeSlotLabel: 'Late Night',
      periodLabel: isWeekend ? 'Weekend Night Economy' : 'Late Night Demand',
      demandLevel: 'Night Surge',
      dispatchMinSec: 5,
      dispatchMaxSec: 14,
      surgeMultiplier: isWeekend ? 1.65 : 1.5,
      isPeakBoostHours: true,
    };
  }

  return {
    ...base,
    dispatchMinSec: Math.max(4, base.dispatchMinSec - weatherInfo.dispatchBoostSec),
    dispatchMaxSec: Math.max(8, base.dispatchMaxSec - weatherInfo.dispatchBoostSec),
    surgeMultiplier: Number((base.surgeMultiplier + weatherInfo.surgeAdd).toFixed(2)),
  };
}

const EATS_RESTAURANTS_BY_SLOT: Record<
  PeakTimeSlotId,
  Array<{
    name: string;
    category: EatsMerchantCategory;
    busyTier: 'hot' | 'busy';
    estOrdersPerHr: number;
    avgPayoutGbp: number;
    prepWaitMin: number;
    peakNote: string;
  }>
> = {
  morning: [
    { name: 'Pret A Manger', category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 16, avgPayoutGbp: 7.4, prepWaitMin: 2, peakNote: 'Morning coffee & pastry rush' },
    { name: 'Greggs', category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 19, avgPayoutGbp: 6.5, prepWaitMin: 2, peakNote: 'Breakfast baps & hot drinks' },
    { name: "McDonald's", category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 21, avgPayoutGbp: 7.2, prepWaitMin: 3, peakNote: 'Breakfast McMuffin surge' },
    { name: 'Leon', category: 'restaurant', busyTier: 'busy', estOrdersPerHr: 11, avgPayoutGbp: 7.9, prepWaitMin: 3, peakNote: 'Commuter office orders' },
    { name: 'Tesco Express', category: 'grocery', busyTier: 'busy', estOrdersPerHr: 10, avgPayoutGbp: 8.6, prepWaitMin: 4, peakNote: 'Morning grocery top-ups' },
    { name: 'Boots Pharmacy', category: 'pharmacy', busyTier: 'busy', estOrdersPerHr: 8, avgPayoutGbp: 9.1, prepWaitMin: 3, peakNote: 'Rapid health & essentials' },
  ],
  afternoon: [
    { name: "Nando's", category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 15, avgPayoutGbp: 8.9, prepWaitMin: 4, peakNote: 'Afternoon lunch & peri-peri orders' },
    { name: 'Wagamama', category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 14, avgPayoutGbp: 9.4, prepWaitMin: 4, peakNote: 'Busy kitchen hatch · Doubles likely' },
    { name: 'Itsu', category: 'restaurant', busyTier: 'busy', estOrdersPerHr: 12, avgPayoutGbp: 7.6, prepWaitMin: 2, peakNote: 'Quick lunch bag collection' },
    { name: 'Tortilla', category: 'restaurant', busyTier: 'busy', estOrdersPerHr: 11, avgPayoutGbp: 7.8, prepWaitMin: 2, peakNote: 'High street burrito rush' },
    { name: "Sainsbury's Local", category: 'grocery', busyTier: 'busy', estOrdersPerHr: 9, avgPayoutGbp: 8.5, prepWaitMin: 3, peakNote: 'Afternoon snack & grocery drops' },
    { name: 'Five Guys', category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 13, avgPayoutGbp: 9.2, prepWaitMin: 5, peakNote: 'Fresh fries cooked on arrival' },
  ],
  evening: [
    { name: 'Dishoom', category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 18, avgPayoutGbp: 10.6, prepWaitMin: 4, peakNote: 'Evening dinner hotspot · High tips' },
    { name: 'Wingstop UK', category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 20, avgPayoutGbp: 9.8, prepWaitMin: 4, peakNote: 'Peak dinner orders · Stacked drops' },
    { name: 'Five Guys', category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 17, avgPayoutGbp: 9.5, prepWaitMin: 5, peakNote: 'Steady double-order queue' },
    { name: "Nando's", category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 19, avgPayoutGbp: 9.2, prepWaitMin: 4, peakNote: 'Hot shelf full · Minimal wait' },
    { name: 'PizzaExpress', category: 'restaurant', busyTier: 'busy', estOrdersPerHr: 12, avgPayoutGbp: 9.9, prepWaitMin: 5, peakNote: 'Family dinner deliveries' },
    { name: 'Co-op Food', category: 'grocery', busyTier: 'busy', estOrdersPerHr: 11, avgPayoutGbp: 8.4, prepWaitMin: 3, peakNote: 'Evening meal-deal baskets' },
  ],
  late_night: [
    { name: "McDonald's", category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 24, avgPayoutGbp: 9.4, prepWaitMin: 4, peakNote: 'Late-night delivery bay #1 surging' },
    { name: 'KFC', category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 18, avgPayoutGbp: 9.1, prepWaitMin: 4, peakNote: 'High-demand late bucket orders' },
    { name: 'Wingstop UK', category: 'restaurant', busyTier: 'hot', estOrdersPerHr: 16, avgPayoutGbp: 10.2, prepWaitMin: 5, peakNote: 'Late-night boost active' },
    { name: 'Franco Manca', category: 'restaurant', busyTier: 'busy', estOrdersPerHr: 11, avgPayoutGbp: 9.6, prepWaitMin: 4, peakNote: 'Late sourdough pizza runs' },
    { name: 'Asda Express', category: 'grocery', busyTier: 'busy', estOrdersPerHr: 10, avgPayoutGbp: 8.9, prepWaitMin: 3, peakNote: '24h forecourt night snacks' },
    { name: 'Morrisons Daily', category: 'grocery', busyTier: 'busy', estOrdersPerHr: 9, avgPayoutGbp: 8.4, prepWaitMin: 3, peakNote: 'Late essentials & chilled bags' },
  ],
};

export function getBusyEatsRestaurantsNear(
  driverCoords: Coordinates,
  slotId: PeakTimeSlotId,
  cityName: string
): BusyRestaurantPin[] {
  const ll = mapToLatLng(driverCoords);
  // Quantize anchor so pins stay fixed on local streets while cruising small distances
  const anchorLat = Math.round(ll.lat * 110) / 110;
  const anchorLng = Math.round(ll.lng * 80) / 80;
  const cosLat = Math.max(0.2, Math.cos((anchorLat * Math.PI) / 180));
  const catalog = EATS_RESTAURANTS_BY_SLOT[slotId] ?? EATS_RESTAURANTS_BY_SLOT.evening;
  const offsets: Array<{ miles: number; deg: number }> = [
    { miles: 0.38, deg: 35 },
    { miles: 0.62, deg: 145 },
    { miles: 0.54, deg: 240 },
    { miles: 0.85, deg: 310 },
    { miles: 1.15, deg: 85 },
    { miles: 1.32, deg: 195 },
  ];

  return catalog.map((item, idx) => {
    const off = offsets[idx % offsets.length];
    const rad = (off.deg * Math.PI) / 180;
    const lat = anchorLat + (off.miles * Math.cos(rad)) / 69.0;
    const lng = anchorLng + (off.miles * Math.sin(rad)) / (69.0 * cosLat);
    return {
      id: `eats-hotspot-${slotId}-${idx}-${cityName.toLowerCase().replace(/\s+/g, '-')}`,
      name: item.name,
      category: item.category,
      coords: clampMapCoords(projectLatLngToMap(lat, lng)),
      busyTier: item.busyTier,
      estOrdersPerHr: item.estOrdersPerHr,
      avgPayoutGbp: item.avgPayoutGbp,
      prepWaitMin: item.prepWaitMin,
      peakNote: `${cityName} · ${item.peakNote}`,
    };
  });
}

export interface UKZoneSurchargeResult {
  surchargeLabel?: string;
  surchargeAmount?: number;
  appliedLondonCC: boolean;
  isAirportZone: boolean;
  airportCode?: string;
  ulezStatus?: string;
  zoneExpenseCategory?: 'congestion' | 'toll';
  zoneExpenseLabel?: string;
  zoneExpenseAmount?: number;
}

export interface UKTaxiMeterRates {
  tariffLabel: 'Tariff 1 · Day' | 'Tariff 2 · Night & Weekend';
  flagFall: number;
  ratePerMile: number;
  waitPerMin: number;
}

export function getUKTaxiMeterRates(
  serviceName: string,
  now: Date = new Date()
): UKTaxiMeterRates {
  const hour = now.getHours();
  const day = now.getDay();
  const isNightOrWeekend = hour >= 22 || hour < 6 || day === 0 || day === 6;
  const premiumBoost =
    serviceName === 'UberXL' ? 1.32 : serviceName === 'Comfort' ? 1.15 : 1.0;

  return {
    tariffLabel: isNightOrWeekend ? 'Tariff 2 · Night & Weekend' : 'Tariff 1 · Day',
    flagFall: Number(((isNightOrWeekend ? 4.4 : 3.6) * premiumBoost).toFixed(2)),
    ratePerMile: Number(((isNightOrWeekend ? 2.85 : 2.35) * premiumBoost).toFixed(2)),
    waitPerMin: isNightOrWeekend ? 0.5 : 0.4,
  };
}

export function detectUKZoneSurcharge(
  pickupCoords: Coordinates,
  dropoffCoords: Coordinates,
  ccAlreadyPaidToday: boolean,
  isEV = false
): UKZoneSurchargeResult {
  const pickupLL = mapToLatLng(pickupCoords);
  const dropoffLL = mapToLatLng(dropoffCoords);
  const inGreaterLondon =
    haversineMiles(pickupLL.lat, pickupLL.lng, 51.5074, -0.1278) <= 13.5 ||
    haversineMiles(dropoffLL.lat, dropoffLL.lng, 51.5074, -0.1278) <= 13.5;
  const ulezStatus = inGreaterLondon
    ? isEV
      ? 'London ULEZ Exempt (Zero-Emission EV)'
      : 'London ULEZ Compliant (Euro 6 Hybrid)'
    : undefined;

  // Check Stansted (STN) & Luton (LTN) Airports
  const pStn = haversineMiles(pickupLL.lat, pickupLL.lng, 51.886, 0.2389);
  const dStn = haversineMiles(dropoffLL.lat, dropoffLL.lng, 51.886, 0.2389);
  if (pStn <= 2.4 || dStn <= 2.4) {
    return {
      surchargeLabel: 'Stansted (STN) Express Drop-off Fee',
      surchargeAmount: 7.0,
      appliedLondonCC: false,
      isAirportZone: true,
      airportCode: 'STN',
      ulezStatus,
    };
  }
  const pLtn = haversineMiles(pickupLL.lat, pickupLL.lng, 51.8763, -0.3717);
  const dLtn = haversineMiles(dropoffLL.lat, dropoffLL.lng, 51.8763, -0.3717);
  if (pLtn <= 2.4 || dLtn <= 2.4) {
    return {
      surchargeLabel: 'Luton (LTN) Priority Set-Down Fee',
      surchargeAmount: 5.0,
      appliedLondonCC: false,
      isAirportZone: true,
      airportCode: 'LTN',
      ulezStatus,
    };
  }

  // Check UK Airports
  for (const ap of UK_AIRPORT_MAP_PINS) {
    const apLL = mapToLatLng(ap.coords);
    const pDist = haversineMiles(pickupLL.lat, pickupLL.lng, apLL.lat, apLL.lng);
    const dDist = haversineMiles(dropoffLL.lat, dropoffLL.lng, apLL.lat, apLL.lng);
    if (pDist <= 2.2 || dDist <= 2.2) {
      const fee =
        ap.code === 'LGW'
          ? 6.0
          : ap.code === 'MAN'
          ? 4.5
          : 5.0;
      return {
        surchargeLabel: `${ap.name} Airport Terminal Fee`,
        surchargeAmount: fee,
        appliedLondonCC: false,
        isAirportZone: true,
        airportCode: ap.code,
        ulezStatus,
      };
    }
  }

  // Dartford Crossing (M25 / A282 Dart Charge) east of Greater London
  const pDart = haversineMiles(pickupLL.lat, pickupLL.lng, 51.465, 0.258);
  const dDart = haversineMiles(dropoffLL.lat, dropoffLL.lng, 51.465, 0.258);
  const crossesEastThames =
    (pickupLL.lng >= 0.08 || dropoffLL.lng >= 0.08) &&
    ((pickupLL.lat >= 51.472 && dropoffLL.lat <= 51.456) ||
      (dropoffLL.lat >= 51.472 && pickupLL.lat <= 51.456));
  if (pDart <= 3.2 || dDart <= 3.2 || crossesEastThames) {
    return {
      surchargeLabel: 'Dartford Crossing (Dart Charge)',
      surchargeAmount: 2.5,
      appliedLondonCC: false,
      isAirportZone: false,
      zoneExpenseCategory: 'toll',
      zoneExpenseLabel: 'Dartford Crossing (M25 A282) Toll',
      zoneExpenseAmount: 2.5,
    };
  }

  // Regional Clean Air Zones (Birmingham £8 / Bristol £9) when driving non-EV
  if (!isEV) {
    const pBham = haversineMiles(pickupLL.lat, pickupLL.lng, 52.481, -1.896);
    const dBham = haversineMiles(dropoffLL.lat, dropoffLL.lng, 52.481, -1.896);
    if (pBham <= 2.0 || dBham <= 2.0) {
      return {
        surchargeLabel: 'Birmingham Clean Air Zone (CAZ)',
        surchargeAmount: 8.0,
        appliedLondonCC: false,
        isAirportZone: false,
        zoneExpenseCategory: 'congestion',
        zoneExpenseLabel: 'Birmingham CAZ Class D Charge',
        zoneExpenseAmount: 8.0,
      };
    }
    const pBris = haversineMiles(pickupLL.lat, pickupLL.lng, 51.453, -2.592);
    const dBris = haversineMiles(dropoffLL.lat, dropoffLL.lng, 51.453, -2.592);
    if (pBris <= 2.0 || dBris <= 2.0) {
      return {
        surchargeLabel: 'Bristol Clean Air Zone (CAZ)',
        surchargeAmount: 9.0,
        appliedLondonCC: false,
        isAirportZone: false,
        zoneExpenseCategory: 'congestion',
        zoneExpenseLabel: 'Bristol CAZ Charge',
        zoneExpenseAmount: 9.0,
      };
    }
  }

  // Central London Congestion Charge ring (~1.85 mi from Charing Cross)
  const ccCenterLat = 51.509;
  const ccCenterLng = -0.128;
  const pCcDist = haversineMiles(pickupLL.lat, pickupLL.lng, ccCenterLat, ccCenterLng);
  const dCcDist = haversineMiles(dropoffLL.lat, dropoffLL.lng, ccCenterLat, ccCenterLng);
  if (pCcDist <= 1.85 || dCcDist <= 1.85) {
    if (!ccAlreadyPaidToday) {
      return {
        surchargeLabel: 'Central London CC Zone',
        surchargeAmount: 15.0,
        appliedLondonCC: true,
        isAirportZone: false,
        ulezStatus,
      };
    }
    return {
      surchargeLabel: 'London CC Covered Today',
      surchargeAmount: 1.0,
      appliedLondonCC: false,
      isAirportZone: false,
      ulezStatus,
    };
  }

  return {
    appliedLondonCC: false,
    isAirportZone: false,
    ulezStatus,
  };
}

export interface NearbyAirportQueue {
  code: string;
  name: string;
  coords: Coordinates;
  distanceMiles: number;
}

export function getNearbyAirportQueuePin(driverCoords: Coordinates): NearbyAirportQueue | null {
  const driverLL = mapToLatLng(driverCoords);
  let best: NearbyAirportQueue | null = null;
  for (const ap of UK_AIRPORT_MAP_PINS) {
    const apLL = mapToLatLng(ap.coords);
    const dist = haversineMiles(driverLL.lat, driverLL.lng, apLL.lat, apLL.lng);
    if (dist <= 3.0 && (!best || dist < best.distanceMiles)) {
      best = {
        code: ap.code,
        name: ap.name,
        coords: ap.coords,
        distanceMiles: Number(dist.toFixed(1)),
      };
    }
  }
  return best;
}

export function getStickySurgeAtCoords(
  driverCoords: Coordinates,
  surgeZones: SurgeZone[]
): { zoneLabel: string; bonusAmount: number } | null {
  for (const zone of surgeZones) {
    if (zone.kind !== 'surge') continue;
    const distPx = Math.hypot(zone.coords.x - driverCoords.x, zone.coords.y - driverCoords.y);
    if (distPx <= Math.max(18, zone.radius * 0.85)) {
      const numeric = parseFloat(zone.label.replace(/[^0-9.]/g, ''));
      if (Number.isFinite(numeric) && numeric > 0) {
        return {
          zoneLabel: zone.label,
          bonusAmount: Number(numeric.toFixed(2)),
        };
      }
    }
  }
  return null;
}

export interface UKRapidCharger {
  id: string;
  network: string;
  name: string;
  powerKw: number;
  pricePerKwh: number;
  distanceMiles: number;
  estMinutes: number;
  estCostGbp: number;
  kwhAdded: number;
}

export function getNearbyUKChargers(
  driverCoords: Coordinates,
  currentBatteryPct: number
): UKRapidCharger[] {
  const missingPct = Math.max(10, 100 - currentBatteryPct);
  const kwhNeeded = Number(((missingPct / 100) * 68).toFixed(1));
  const cityHint = mapToLatLng(driverCoords).lat > 53 ? 'North' : 'City';

  const templates = [
    { id: 'chg-gridserve', network: 'Gridserve', name: `${cityHint} Electric Forecourt`, powerKw: 350, pricePerKwh: 0.79, distanceMiles: 1.4 },
    { id: 'chg-tesla', network: 'Tesla Supercharger', name: 'Open-to-All V4 Hub', powerKw: 250, pricePerKwh: 0.56, distanceMiles: 2.1 },
    { id: 'chg-bppulse', network: 'BP Pulse', name: 'High-Speed Taxi Bay', powerKw: 150, pricePerKwh: 0.75, distanceMiles: 0.8 },
    { id: 'chg-instavolt', network: 'InstaVolt', name: 'Retail Park Rapid Bay', powerKw: 160, pricePerKwh: 0.85, distanceMiles: 1.9 },
  ];

  return templates.map((t) => {
    const estCostGbp = Number((kwhNeeded * t.pricePerKwh).toFixed(2));
    const estMinutes = Math.max(8, Math.round((kwhNeeded / (t.powerKw * 0.48)) * 60));
    return {
      ...t,
      estCostGbp,
      estMinutes,
      kwhAdded: kwhNeeded,
    };
  });
}

export interface UKFuelStation {
  id: string;
  brand: string;
  name: string;
  fuelGrade: string;
  pricePerLitre: number;
  distanceMiles: number;
  litresNeeded: number;
  estCostGbp: number;
}

export function getUKFuelStations(
  driverCoords: Coordinates,
  currentRangePct: number
): UKFuelStation[] {
  const missingPct = Math.max(10, 100 - currentRangePct);
  const litresNeeded = Number(Math.max(8, (missingPct / 100) * 48).toFixed(1));
  const cityHint = mapToLatLng(driverCoords).lat > 53 ? 'North' : 'Greater London';

  const stations = [
    { id: 'fuel-shell', brand: 'Shell', name: `${cityHint} Express Forecourt`, fuelGrade: 'Unleaded E10', pricePerLitre: 1.46, distanceMiles: 0.7 },
    { id: 'fuel-bp', brand: 'BP', name: 'A40 Connect Service', fuelGrade: 'Ultimate E10', pricePerLitre: 1.49, distanceMiles: 1.2 },
    { id: 'fuel-tesco', brand: 'Tesco Extra', name: 'Superstore Petrol Bar', fuelGrade: 'Clubcard E10', pricePerLitre: 1.39, distanceMiles: 1.8 },
    { id: 'fuel-esso', brand: 'Esso', name: 'High Rd PHV Stop', fuelGrade: 'Synergy E10', pricePerLitre: 1.44, distanceMiles: 1.1 },
  ];

  return stations.map((s) => ({
    ...s,
    litresNeeded,
    estCostGbp: Number((litresNeeded * s.pricePerLitre).toFixed(2)),
  }));
}

export interface AirportTerminalBayInfo {
  airportCode: string;
  bayLocation: string;
  anprCode: string;
  passWindow: string;
  plate: string;
}

export function getAirportTerminalBay(
  pickupAreaOrAddress: string,
  surchargeLabel: string | undefined,
  licensePlate: string,
  tripId: string
): AirportTerminalBayInfo | null {
  const hay = `${pickupAreaOrAddress} ${surchargeLabel ?? ''}`.toLowerCase();
  let code = '';
  let bayLocation = '';

  if (hay.includes('heathrow') || hay.includes('lhr')) {
    code = 'LHR';
    bayLocation = 'Heathrow T5 Short Stay · Level 4, Row R, Bay 42';
  } else if (hay.includes('gatwick') || hay.includes('lgw')) {
    code = 'LGW';
    bayLocation = 'Gatwick South Car Park 3 · Level 2, PHV Zone B';
  } else if (hay.includes('manchester') || hay.includes('man')) {
    code = 'MAN';
    bayLocation = 'Manchester T2 West Multi-Storey · Express Pick-Up Bay 14';
  } else if (hay.includes('birmingham') || hay.includes('bhx')) {
    code = 'BHX';
    bayLocation = 'Birmingham Express Drop & Pick · Lane 3, Bay 08';
  } else if (hay.includes('stansted') || hay.includes('stn')) {
    code = 'STN';
    bayLocation = 'Stansted Express Set-Down & PHV Bay · Zone C';
  } else if (hay.includes('luton') || hay.includes('ltn')) {
    code = 'LTN';
    bayLocation = 'Luton Priority Pick-Up · Terminal Forecourt Bay 6';
  } else if (hay.includes('edinburgh') || hay.includes('edi')) {
    code = 'EDI';
    bayLocation = 'Edinburgh Pickup Zone · Multi-Storey Ground Row C';
  } else if (hay.includes('airport')) {
    code = 'UK-AP';
    bayLocation = 'Terminal Short-Stay PHV Bay · Level 1, Row B';
  } else {
    return null;
  }

  const suffix = tripId.replace(/[^0-9A-Z]/gi, '').slice(-4).toUpperCase() || '8492';
  return {
    airportCode: code,
    bayLocation,
    anprCode: `ANPR-${code}-${suffix}`,
    passWindow: '15-min Free Barrier Exit Pass Active',
    plate: licensePlate,
  };
}

function csvEscape(val: string | number | undefined): string {
  const s = String(val ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildHMRCTaxCsvFile(params: {
  driverName: string;
  totalBusinessMiles: number;
  completedTrips: CompletedTrip[];
  expenses: ExpenseEntry[];
}): { file: File; filename: string; csvContent: string; taxReliefGbp: number; netProfitGbp: number } {
  const { driverName, totalBusinessMiles, completedTrips, expenses } = params;
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `HMRC-Uber-UK-Tax-Summary-${dateStr}.csv`;

  const grossTotal = completedTrips.reduce(
    (sum, t) => sum + t.fare + t.tip + (t.waitFee ?? 0) + (t.claimAmount ?? 0),
    0
  );
  const uberFeesTotal = completedTrips.reduce((sum, t) => sum + (t.uberFee ?? 0), 0);
  const expensesTotal = expenses.reduce((sum, e) => sum + e.amount, 0);
  const taxReliefGbp = Number((totalBusinessMiles * 0.45).toFixed(2));
  const netProfitGbp = Number((grossTotal - uberFeesTotal - expensesTotal).toFixed(2));

  const lines: string[] = [
    `HMRC UK Self-Assessment Driver Summary (${dateStr})`,
    `Driver,${csvEscape(driverName)}`,
    `Total Business Miles,${totalBusinessMiles.toFixed(1)}`,
    `HMRC Simplified Mileage Relief (£0.45/mi),£${taxReliefGbp.toFixed(2)}`,
    `Gross Trip Earnings + Adjustments,£${grossTotal.toFixed(2)}`,
    `Uber Service Fees (25%),-£${uberFeesTotal.toFixed(2)}`,
    `Logged Charging / Tolls / CAZ Expenses,-£${expensesTotal.toFixed(2)}`,
    `Net Taxable Take-Home Before Allowance,£${netProfitGbp.toFixed(2)}`,
    '',
    'COMPLETED TRIPS',
    'Date,Completed At,Service,Rider,Pickup,Dropoff,Distance (mi),Fare (£),Tip (£),Wait Fee (£),Claims (£),Uber Fee (£),Net Payout (£),HMRC Relief (£)',
  ];

  for (const t of completedTrips) {
    const net =
      t.netPayout ?? Number((t.fare + t.tip + (t.waitFee ?? 0) - (t.uberFee ?? 0)).toFixed(2));
    lines.push(
      [
        csvEscape(t.dateKey ?? dateStr),
        csvEscape(t.completedAt),
        csvEscape(t.serviceName),
        csvEscape(t.riderName),
        csvEscape(t.pickupArea),
        csvEscape(t.dropoffArea),
        t.distanceMiles.toFixed(1),
        t.fare.toFixed(2),
        t.tip.toFixed(2),
        (t.waitFee ?? 0).toFixed(2),
        (t.claimAmount ?? 0).toFixed(2),
        (t.uberFee ?? 0).toFixed(2),
        net.toFixed(2),
        (t.distanceMiles * 0.45).toFixed(2),
      ].join(',')
    );
  }

  if (expenses.length > 0) {
    lines.push('', 'LOGGED EXPENSES', 'Date,Time,Category,Description,Amount (£)');
    for (const ex of expenses) {
      lines.push(
        [
          csvEscape(ex.dateKey),
          csvEscape(ex.timestamp),
          csvEscape(ex.category),
          csvEscape(ex.label),
          ex.amount.toFixed(2),
        ].join(',')
      );
    }
  }

  const csvContent = lines.join('\n');
  const file = new File([csvContent], filename, { type: 'text/csv;charset=utf-8' });
  return { file, filename, csvContent, taxReliefGbp, netProfitGbp };
}

export function downloadHMRCTaxCsv(params: {
  driverName: string;
  totalBusinessMiles: number;
  completedTrips: CompletedTrip[];
  expenses: ExpenseEntry[];
}): { ok: boolean; filename: string; taxReliefGbp: number; netProfitGbp: number } {
  const { file, filename, taxReliefGbp, netProfitGbp } = buildHMRCTaxCsvFile(params);
  try {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { ok: true, filename, taxReliefGbp, netProfitGbp };
  } catch {
    return { ok: false, filename, taxReliefGbp, netProfitGbp };
  }
}
