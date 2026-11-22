import {
  Coordinates,
  DriverPreferences,
  ReserveCategory,
  ReserveTrip,
  TripOffer,
} from '../types/driver';
import {
  clampMapCoords,
  mapToLatLng,
  nearestUKCity,
  projectLatLngToMap,
  UK_AIRPORT_MAP_PINS,
  UK_CITIES,
} from './ukGeo';

export type ServicePrefsInput = Pick<
  DriverPreferences,
  'uberX' | 'comfort' | 'uberXL' | 'uberPet' | 'deliveries' | 'intercity'
>;

interface LocalPlace {
  name: string;
  area: string;
  lat: number;
  lng: number;
}

interface LocalGeoCache {
  anchorLat: number;
  anchorLng: number;
  townName: string;
  streets: LocalPlace[];
  destinations: LocalPlace[];
}

let geoCache: LocalGeoCache | null = null;
let fetchInFlightKey: string | null = null;

export function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function offsetLatLng(
  lat: number,
  lng: number,
  distanceMiles: number,
  bearingDeg: number
): { lat: number; lng: number } {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (distanceMiles * Math.cos(rad)) / 69.0;
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const dLng = (distanceMiles * Math.sin(rad)) / (69.0 * cosLat);
  return {
    lat: Number((lat + dLat).toFixed(5)),
    lng: Number((lng + dLng).toFixed(5)),
  };
}

function cleanTownName(props: Record<string, any> | undefined, fallbackCoords: Coordinates): string {
  const raw =
    props?.city ||
    props?.town ||
    props?.village ||
    props?.borough ||
    props?.suburb ||
    props?.county;
  if (typeof raw === 'string' && raw.trim().length > 1) {
    return raw.trim();
  }
  return nearestUKCity(fallbackCoords);
}

function parsePhotonFeatures(
  features: any[] | undefined,
  anchorLat: number,
  anchorLng: number,
  fallbackTown: string,
  maxRadiusMiles: number
): LocalPlace[] {
  if (!Array.isArray(features)) return [];
  const results: LocalPlace[] = [];
  const seen = new Set<string>();

  for (const feat of features) {
    const coords = feat?.geometry?.coordinates;
    const props = feat?.properties;
    if (!Array.isArray(coords) || coords.length < 2 || !props) continue;
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const dist = haversineMiles(anchorLat, anchorLng, lat, lng);
    if (dist < 0.18 || dist > maxRadiusMiles) continue;

    const streetNum = props.housenumber ? `${props.housenumber} ` : '';
    const primary =
      props.name ||
      (props.street ? `${streetNum}${props.street}` : null) ||
      props.locality ||
      props.district;
    if (!primary || typeof primary !== 'string') continue;

    const cleanName = primary.trim();
    const key = cleanName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const subArea = props.district || props.suburb || props.locality || '';
    const town = props.city || props.town || props.village || fallbackTown;
    const area = subArea && subArea !== town ? `${subArea}, ${town}` : town;

    results.push({ name: cleanName, area, lat, lng });
  }
  return results;
}

export function getResolvedLocalCityName(driverCoords: Coordinates): string {
  const ll = mapToLatLng(driverCoords);
  if (
    geoCache &&
    haversineMiles(geoCache.anchorLat, geoCache.anchorLng, ll.lat, ll.lng) <= 10
  ) {
    return geoCache.townName;
  }
  return nearestUKCity(driverCoords);
}

export async function prefetchLocalPlaces(
  lat: number,
  lng: number
): Promise<string | null> {
  if (
    geoCache &&
    haversineMiles(geoCache.anchorLat, geoCache.anchorLng, lat, lng) < 0.8
  ) {
    return geoCache.townName;
  }

  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  if (fetchInFlightKey === key) return geoCache?.townName ?? null;
  fetchInFlightKey = key;

  const fallbackCoords = projectLatLngToMap(lat, lng);
  let townName = nearestUKCity(fallbackCoords);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);

  try {
    const [revRes, poiStationRes, poiRoadRes] = await Promise.all([
      fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=en`, {
        signal: controller.signal,
      }).catch(() => null),
      fetch(
        `https://photon.komoot.io/api/?q=station&lat=${lat}&lon=${lng}&limit=8&lang=en`,
        { signal: controller.signal }
      ).catch(() => null),
      fetch(
        `https://photon.komoot.io/api/?q=road&lat=${lat}&lon=${lng}&limit=10&lang=en`,
        { signal: controller.signal }
      ).catch(() => null),
    ]);

    clearTimeout(timeout);

    if (revRes?.ok) {
      const revData = await revRes.json();
      const firstProps = revData?.features?.[0]?.properties;
      townName = cleanTownName(firstProps, fallbackCoords);
    }

    const combined: LocalPlace[] = [];
    if (poiRoadRes?.ok) {
      const roadData = await poiRoadRes.json();
      combined.push(
        ...parsePhotonFeatures(roadData?.features, lat, lng, townName, 9)
      );
    }
    if (poiStationRes?.ok) {
      const stationData = await poiStationRes.json();
      combined.push(
        ...parsePhotonFeatures(stationData?.features, lat, lng, townName, 12)
      );
    }

    const streets = combined.filter(
      (p) => haversineMiles(lat, lng, p.lat, p.lng) <= 2.4
    );
    const destinations = combined.filter(
      (p) => haversineMiles(lat, lng, p.lat, p.lng) >= 1.4
    );

    geoCache = {
      anchorLat: lat,
      anchorLng: lng,
      townName,
      streets,
      destinations,
    };

    return townName;
  } catch {
    clearTimeout(timeout);
    return null;
  } finally {
    fetchInFlightKey = null;
  }
}

const FALLBACK_LOCAL_STREETS = [
  'High Street',
  'Station Approach',
  'Victoria Road',
  'Church Lane',
  'Market Square',
  'Kings Road',
  'Park Avenue',
  'Bridge Street',
  'London Road',
  'Queensway',
];

const FALLBACK_LOCAL_DESTINATIONS = [
  'Railway Station Forecourt',
  'Town Centre Retail Park',
  'General Hospital Main Entrance',
  'Central Shopping Precinct',
  'University Campus Gate',
  'Business & Tech Park',
  'Sports & Leisure Complex',
  'Superstore Car Park',
  'Market Hall & High St',
  'Old Town Square',
];

const RIDER_NAMES = [
  'Olivia H.',
  'Marcus T.',
  'Joséfina',
  'Callum R.',
  'Priya S.',
  'Daniel K.',
  'Chloe M.',
  'Tariq A.',
  'Hannah W.',
  'Liam B.',
];

const EATS_MERCHANTS = [
  "Nando's",
  'Pret A Manger',
  'Wagamama',
  'Five Guys',
  'Greggs',
  "McDonald's",
  'Tesco Express',
  'KFC',
  'Co-op Food',
  'PizzaExpress',
];

const PET_NOTES = [
  'Travelling with my friendly Labrador on a lead (blanket brought).',
  'Small cat inside a secured travel carrier — heading to the vet.',
  '1 passenger + calm Cockapoo dog waiting by the kerb.',
  'Bringing a medium Golden Retriever — clean paws & towel ready.',
];

interface LocalOfferOptions {
  anchorCoords: Coordinates;
  realLatLng?: { lat: number; lng: number } | null;
  seedIndex: number;
  forceType?: 'exclusive' | 'radar';
  forceIntercity?: boolean;
  includeIntercity?: boolean;
  servicePrefs?: ServicePrefsInput;
}

export function generateLocalTripOffer({
  anchorCoords,
  realLatLng,
  seedIndex,
  forceType,
  forceIntercity = false,
  includeIntercity = true,
  servicePrefs,
}: LocalOfferOptions): TripOffer {
  const baseLatLng = realLatLng ?? mapToLatLng(anchorCoords);
  const currentLat = baseLatLng.lat;
  const currentLng = baseLatLng.lng;
  const localTown = getResolvedLocalCityName(
    realLatLng ? projectLatLngToMap(currentLat, currentLng) : anchorCoords
  );

  const hasFreshCache =
    geoCache !== null &&
    haversineMiles(geoCache.anchorLat, geoCache.anchorLng, currentLat, currentLng) <= 8;

  const standardServices: Array<'UberX' | 'Comfort' | 'UberXL' | 'Uber Pet' | 'Uber Eats'> = [];
  if (servicePrefs) {
    if (servicePrefs.uberX) standardServices.push('UberX', 'UberX');
    if (servicePrefs.comfort) standardServices.push('Comfort');
    if (servicePrefs.uberXL) standardServices.push('UberXL');
    if (servicePrefs.uberPet) standardServices.push('Uber Pet');
    if (servicePrefs.deliveries) standardServices.push('Uber Eats');
  } else {
    standardServices.push('UberX', 'UberX', 'Comfort', 'UberXL');
  }

  const intercityEnabled = servicePrefs ? servicePrefs.intercity : includeIntercity;
  const isIntercity =
    forceIntercity ||
    (intercityEnabled && standardServices.length === 0) ||
    (intercityEnabled && seedIndex % 15 === 14);
  const type: 'exclusive' | 'radar' =
    forceType ?? (seedIndex % 3 === 1 ? 'radar' : 'exclusive');

  const serviceName = isIntercity
    ? 'Intercity'
    : standardServices.length > 0
    ? standardServices[seedIndex % standardServices.length]
    : 'UberX';
  const isDelivery = serviceName === 'Uber Eats';

  // 1. Pick local PICKUP within 0.35 - 1.35 miles of driver's current position
  const pickupBearing = ((seedIndex * 73 + 25) % 360);
  const fallbackPickupDist = 0.45 + ((seedIndex % 5) * 0.18);
  const pickupFallbackLL = offsetLatLng(currentLat, currentLng, fallbackPickupDist, pickupBearing);

  let pickupLat = pickupFallbackLL.lat;
  let pickupLng = pickupFallbackLL.lng;
  let pickupAddress = `${12 + ((seedIndex * 17) % 180)} ${
    FALLBACK_LOCAL_STREETS[seedIndex % FALLBACK_LOCAL_STREETS.length]
  }`;
  let pickupArea = `${localTown} Centre`;

  if (hasFreshCache && geoCache && geoCache.streets.length > 0) {
    const picked = geoCache.streets[seedIndex % geoCache.streets.length];
    pickupLat = picked.lat;
    pickupLng = picked.lng;
    pickupAddress = picked.name;
    pickupArea = picked.area;
  }

  const pickupMilesRaw = Math.max(
    0.3,
    haversineMiles(currentLat, currentLng, pickupLat, pickupLng) * 1.25
  );
  const pickupMiles = Number(pickupMilesRaw.toFixed(1));
  const pickupMinutes = Math.max(2, Math.round(pickupMiles * 3.1));

  // 2. Pick DROPOFF (local town/city for standard rides, nearest other UK city for Intercity)
  let dropoffLat = currentLat;
  let dropoffLng = currentLng;
  let dropoffAddress = FALLBACK_LOCAL_DESTINATIONS[seedIndex % FALLBACK_LOCAL_DESTINATIONS.length];
  let dropoffArea = localTown;
  let intercityCorridor: string | undefined;

  if (isIntercity) {
    // Pick nearest OTHER UK city 18–65 miles away from current location
    const candidates = UK_CITIES.map((c) => ({
      city: c,
      dist: haversineMiles(currentLat, currentLng, c.lat, c.lng),
    }))
      .filter((item) => item.dist >= 16)
      .sort((a, b) => a.dist - b.dist);

    const targetCity = candidates[(seedIndex % Math.min(3, Math.max(1, candidates.length)))];
    if (targetCity) {
      const formattedName = targetCity.city.name
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      dropoffLat = targetCity.city.lat;
      dropoffLng = targetCity.city.lng;
      dropoffAddress = `${formattedName} Rail Station & City Centre`;
      dropoffArea = `${formattedName} · Out of City`;
      intercityCorridor = `${localTown} → ${formattedName} · Out of City`;
    } else {
      const intercityLL = offsetLatLng(currentLat, currentLng, 28, (pickupBearing + 120) % 360);
      dropoffLat = intercityLL.lat;
      dropoffLng = intercityLL.lng;
      dropoffAddress = 'Regional Rail Interchange';
      dropoffArea = `${localTown} Outskirts · Out of City`;
      intercityCorridor = `${localTown} Regional Express`;
    }
  } else if (hasFreshCache && geoCache && geoCache.destinations.length > 0) {
    const destPool = geoCache.destinations.filter(
      (d) => haversineMiles(pickupLat, pickupLng, d.lat, d.lng) >= 1.3
    );
    const chosen = (destPool.length > 0 ? destPool : geoCache.destinations)[
      (seedIndex + 2) % Math.max(1, destPool.length || geoCache.destinations.length)
    ];
    if (chosen && haversineMiles(pickupLat, pickupLng, chosen.lat, chosen.lng) >= 1.0) {
      dropoffLat = chosen.lat;
      dropoffLng = chosen.lng;
      dropoffAddress = chosen.name;
      dropoffArea = chosen.area;
    } else {
      const localTripDist = 2.0 + ((seedIndex % 6) * 0.75);
      const dropLL = offsetLatLng(pickupLat, pickupLng, localTripDist, (pickupBearing + 135) % 360);
      dropoffLat = dropLL.lat;
      dropoffLng = dropLL.lng;
      dropoffAddress = FALLBACK_LOCAL_DESTINATIONS[(seedIndex + 3) % FALLBACK_LOCAL_DESTINATIONS.length];
      dropoffArea = `${localTown} Local`;
    }
  } else {
    const localTripDist = 1.9 + ((seedIndex % 6) * 0.8);
    const dropBearing = (pickupBearing + 115 + (seedIndex % 3) * 45) % 360;
    const dropLL = offsetLatLng(pickupLat, pickupLng, localTripDist, dropBearing);
    dropoffLat = dropLL.lat;
    dropoffLng = dropLL.lng;
    dropoffAddress = FALLBACK_LOCAL_DESTINATIONS[(seedIndex + 3) % FALLBACK_LOCAL_DESTINATIONS.length];
    dropoffArea = `${localTown} Local`;
  }

  if (isDelivery) {
    const merchant = EATS_MERCHANTS[seedIndex % EATS_MERCHANTS.length];
    if (!pickupAddress.toLowerCase().includes(merchant.toLowerCase())) {
      pickupAddress = `${merchant} · ${pickupAddress}`;
    }
  }

  const tripMilesRaw = Math.max(
    isDelivery ? 0.8 : 1.3,
    haversineMiles(pickupLat, pickupLng, dropoffLat, dropoffLng) * (isDelivery ? 0.92 : 1.28)
  );
  const tripMiles = Number(tripMilesRaw.toFixed(1));
  const avgSpeedMph = isIntercity ? 44 : isDelivery ? 16 : 18;
  const tripMinutes = Math.max(isDelivery ? 5 : 6, Math.round((tripMiles / avgSpeedMph) * 60));

  // Optional mid-route stop (~1 in 5 local passenger trips; never on Uber Eats)
  const hasStop = !isIntercity && !isDelivery && seedIndex % 5 === 2;
  const stopCoords = hasStop
    ? clampMapCoords(
        projectLatLngToMap(
          (pickupLat + dropoffLat) / 2 + 0.002,
          (pickupLng + dropoffLng) / 2 - 0.002
        )
      )
    : undefined;
  const stopAddress = hasStop
    ? `${FALLBACK_LOCAL_STREETS[(seedIndex + 4) % FALLBACK_LOCAL_STREETS.length]} (Quick 2m stop)`
    : undefined;

  // Realistic UK fare math per service tier
  const perMileRate =
    serviceName === 'UberXL'
      ? 2.25
      : serviceName === 'Comfort'
      ? 1.85
      : serviceName === 'Uber Pet'
      ? 1.72
      : serviceName === 'Uber Eats'
      ? 1.25
      : serviceName === 'Intercity'
      ? 1.65
      : 1.5;
  const surchargeLabel =
    serviceName === 'Uber Pet' ? 'Pet Fee' : isDelivery ? 'Hot Bag Bonus' : undefined;
  const surchargeAmount =
    serviceName === 'Uber Pet' ? 3.5 : isDelivery && seedIndex % 2 === 0 ? 1.2 : undefined;
  const surgeBonus = seedIndex % 3 === 0 ? Number((1.75 + (seedIndex % 4) * 0.75).toFixed(2)) : undefined;
  const baseFare =
    (isDelivery ? 2.85 : 3.2) +
    tripMiles * perMileRate +
    tripMinutes * (isDelivery ? 0.14 : 0.18) +
    (surchargeAmount ?? 0) +
    (surgeBonus ?? 0);
  const minFare =
    serviceName === 'UberXL'
      ? 9.5
      : serviceName === 'Uber Pet'
      ? 8.5
      : serviceName === 'Comfort'
      ? 7.8
      : isDelivery
      ? 4.6
      : 5.8;
  const fare = Number(Math.max(minFare, baseFare).toFixed(2));

  const riderName = RIDER_NAMES[seedIndex % RIDER_NAMES.length];
  const hasPin = isDelivery ? seedIndex % 3 === 0 : seedIndex % 2 === 0;
  const pinCode = hasPin
    ? String(1000 + ((seedIndex * 1373 + 4829) % 8999))
    : undefined;

  const riderNote = isDelivery
    ? `Order #UE-${4100 + ((seedIndex * 79) % 5800)} · ${
        seedIndex % 2 === 0 ? '2x Hot Bags · Leave at front door' : 'Grocery order · Ring doorbell on arrival'
      }`
    : serviceName === 'Uber Pet'
    ? PET_NOTES[seedIndex % PET_NOTES.length]
    : serviceName === 'UberXL'
    ? `Group of ${4 + (seedIndex % 3)} passengers with luggage — outside ${pickupAddress}.`
    : serviceName === 'Comfort'
    ? `Comfort preference: Quiet ride & cool cabin · ${pickupAddress}.`
    : `Waiting outside ${pickupAddress} in ${localTown}.`;

  return {
    id: `local-${type}-${isIntercity ? 'ic-' : ''}${Date.now()}-${seedIndex}`,
    type,
    serviceName,
    fare,
    rating: Number((4.86 + ((seedIndex % 13) * 0.01)).toFixed(2)),
    riderName,
    riderTrips: 45 + ((seedIndex * 37) % 480),
    pickupMinutes,
    pickupMiles,
    pickupAddress,
    pickupArea,
    tripMinutes,
    tripMiles,
    dropoffAddress,
    dropoffArea,
    pickupCoords: clampMapCoords(projectLatLngToMap(pickupLat, pickupLng)),
    dropoffCoords: clampMapCoords(projectLatLngToMap(dropoffLat, dropoffLng)),
    surgeBonus,
    pinCode,
    surchargeLabel,
    surchargeAmount,
    isIntercity,
    intercityCorridor,
    stopAddress,
    stopCoords,
    riderNote,
    expiresInSec: isIntercity ? 20 : type === 'radar' ? 18 : 15,
  };
}

export function buildLocalOfferPool(
  anchorCoords: Coordinates,
  realLatLng: { lat: number; lng: number } | null | undefined,
  includeIntercity: boolean,
  startSeed = 0,
  servicePrefs?: ServicePrefsInput
): TripOffer[] {
  const offers: TripOffer[] = [];
  for (let i = 0; i < 6; i++) {
    offers.push(
      generateLocalTripOffer({
        anchorCoords,
        realLatLng,
        seedIndex: startSeed + i,
        includeIntercity,
        servicePrefs,
      })
    );
  }
  return offers;
}

const RESERVE_FLIGHT_CODES = ['BA 1432', 'EZY 8421', 'VS 0045', 'LS 0312', 'FR 2918', 'KL 1074'];

function formatHm(ms: number): string {
  const d = new Date(ms);
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

function getReserveDayLabel(ms: number, nowMs: number): string {
  const target = new Date(ms);
  const now = new Date(nowMs);
  if (
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate()
  ) {
    return 'Today';
  }
  const tomorrow = new Date(nowMs + 24 * 60 * 60 * 1000);
  if (
    target.getFullYear() === tomorrow.getFullYear() &&
    target.getMonth() === tomorrow.getMonth() &&
    target.getDate() === tomorrow.getDate()
  ) {
    return 'Tomorrow';
  }
  return target.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function generateLocalReserveTrips(
  anchorCoords: Coordinates,
  realLatLng: { lat: number; lng: number } | null | undefined,
  startSeed = 0,
  count = 6,
  servicePrefs?: ServicePrefsInput
): ReserveTrip[] {
  const baseLatLng = realLatLng ?? mapToLatLng(anchorCoords);
  const currentLat = baseLatLng.lat;
  const currentLng = baseLatLng.lng;
  const localTown = getResolvedLocalCityName(
    realLatLng ? projectLatLngToMap(currentLat, currentLng) : anchorCoords
  );

  // Nearest UK airport relative to driver's position
  const sortedAirports = UK_AIRPORT_MAP_PINS.map((ap) => {
    const apLL = mapToLatLng(ap.coords);
    return {
      ...ap,
      lat: apLL.lat,
      lng: apLL.lng,
      dist: haversineMiles(currentLat, currentLng, apLL.lat, apLL.lng),
    };
  }).sort((a, b) => a.dist - b.dist);

  const nowMs = Date.now();
  // Round baseline to next 15-min slot + 45 mins
  const slotBaseMs = Math.ceil((nowMs + 45 * 60 * 1000) / (15 * 60 * 1000)) * (15 * 60 * 1000);
  const offsetsMin = [0, 75, 165, 285, 690, 960, 1140, 1320];

  const categories: ReserveCategory[] = ['airport', 'local', 'executive', 'airport', 'local', 'executive'];
  const reserveOptions: ReserveTrip['serviceName'][] = [];
  if (!servicePrefs || servicePrefs.uberX) reserveOptions.push('Reserve · UberX');
  if (!servicePrefs || servicePrefs.comfort) reserveOptions.push('Reserve · Comfort', 'Reserve · Executive');
  if (servicePrefs?.uberXL) reserveOptions.push('Reserve · UberXL');
  if (reserveOptions.length === 0) reserveOptions.push('Reserve · UberX');

  const pickServiceForCategory = (category: ReserveCategory, seed: number): ReserveTrip['serviceName'] => {
    if (servicePrefs?.uberXL && seed % 3 === 1) return 'Reserve · UberXL';
    if (category === 'local' && reserveOptions.includes('Reserve · UberX')) return 'Reserve · UberX';
    if (category === 'airport' && reserveOptions.includes('Reserve · Comfort')) return 'Reserve · Comfort';
    if (category === 'executive' && reserveOptions.includes('Reserve · Executive')) return 'Reserve · Executive';
    return reserveOptions[seed % reserveOptions.length];
  };

  const results: ReserveTrip[] = [];

  for (let i = 0; i < count; i++) {
    const seed = startSeed + i;
    const category = categories[seed % categories.length];
    const baseOffer = generateLocalTripOffer({
      anchorCoords,
      realLatLng,
      seedIndex: seed + 10,
      forceType: 'exclusive',
      includeIntercity: false,
      servicePrefs,
    });

    const scheduledAtMs = slotBaseMs + offsetsMin[i % offsetsMin.length] * 60 * 1000;
    const onlineByMs = scheduledAtMs - 40 * 60 * 1000;

    let dropoffAddress = baseOffer.dropoffAddress;
    let dropoffArea = baseOffer.dropoffArea;
    let dropoffCoords = baseOffer.dropoffCoords;
    let tripMiles = Math.max(4.2, Number((baseOffer.tripMiles * 1.45).toFixed(1)));
    let tripMinutes = Math.max(12, Math.round(tripMiles * 2.2));
    let flightNumber: string | undefined;

    if (category === 'airport' && sortedAirports[0]) {
      const nearestAp = sortedAirports[seed % Math.min(2, sortedAirports.length)];
      const apMiles = Math.max(6.5, Number((nearestAp.dist * 1.24).toFixed(1)));
      if (apMiles <= 68) {
        dropoffAddress = `${nearestAp.name} Airport (${nearestAp.code}) Departures`;
        dropoffArea = `${nearestAp.name} Airport`;
        dropoffCoords = nearestAp.coords;
        tripMiles = apMiles;
        tripMinutes = Math.max(18, Math.round(apMiles * 1.55));
      } else {
        dropoffAddress = `${localTown} Central Rail Station`;
        dropoffArea = `${localTown} · Station`;
      }
      flightNumber = RESERVE_FLIGHT_CODES[seed % RESERVE_FLIGHT_CODES.length];
    } else if (category === 'executive') {
      dropoffAddress = `${localTown} Business Quarter / Station`;
      dropoffArea = `${localTown} Executive`;
      tripMiles = Math.max(6.0, Number((baseOffer.tripMiles * 1.6).toFixed(1)));
      tripMinutes = Math.max(16, Math.round(tripMiles * 2.1));
    }

    const chosenService = pickServiceForCategory(category, seed);
    const reserveFee =
      chosenService === 'Reserve · Executive'
        ? 10.0
        : chosenService === 'Reserve · UberXL'
        ? 9.0
        : category === 'airport'
        ? 8.0
        : 6.0;
    const ratePerMile =
      chosenService === 'Reserve · Executive'
        ? 2.4
        : chosenService === 'Reserve · UberXL'
        ? 2.3
        : category === 'airport'
        ? 1.9
        : 1.65;
    const estimatedFare = Number(
      Math.max(16.5, reserveFee + 4.5 + tripMiles * ratePerMile + tripMinutes * 0.2).toFixed(2)
    );

    results.push({
      id: `reserve-slot-${seed}`,
      category,
      serviceName: chosenService,
      scheduledAtMs,
      dayLabel: getReserveDayLabel(scheduledAtMs, nowMs),
      timeLabel: formatHm(scheduledAtMs),
      onlineByLabel: formatHm(onlineByMs),
      estimatedFare,
      reserveFee,
      rating: baseOffer.rating,
      riderName: baseOffer.riderName,
      riderTrips: baseOffer.riderTrips,
      pickupMinutes: baseOffer.pickupMinutes,
      pickupMiles: baseOffer.pickupMiles,
      pickupAddress: baseOffer.pickupAddress,
      pickupArea: baseOffer.pickupArea,
      dropoffAddress,
      dropoffArea,
      tripMiles,
      tripMinutes,
      pickupCoords: baseOffer.pickupCoords,
      dropoffCoords,
      flightNumber,
      waitIncludedMin: 15,
      pinCode: seed % 2 === 0 ? baseOffer.pinCode : undefined,
      riderNote: flightNumber
        ? `Flight ${flightNumber} · Pre-booked ${localTown} pickup (15 min wait included)`
        : `Pre-booked Reserve pickup in ${localTown} · 15 min wait included`,
      status: 'available',
    });
  }

  return results.sort((a, b) => a.scheduledAtMs - b.scheduledAtMs);
}
