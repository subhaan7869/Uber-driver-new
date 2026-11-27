import {
  Coordinates,
  DestinationConfig,
  DriverPreferences,
  EatsMerchantCategory,
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
import { detectUKZoneSurcharge, getUKTaxiMeterRates } from './ukRealism';

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

function bearingBetweenDeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export interface UKPlaceSearchResult {
  name: string;
  address: string;
  coords: Coordinates;
}

export async function searchUKPlaces(
  query: string,
  biasLatLng?: { lat: number; lng: number }
): Promise<UKPlaceSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const params = new URLSearchParams({
    q: trimmed,
    limit: '7',
    lang: 'en',
    bbox: '-8.6,49.8,2.1,60.9',
  });
  if (biasLatLng) {
    params.set('lat', String(biasLatLng.lat));
    params.set('lon', String(biasLatLng.lng));
  }
  try {
    const res = await fetch(`https://photon.komoot.io/api/?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    const features = Array.isArray(data?.features) ? data.features : [];
    const results: UKPlaceSearchResult[] = [];
    const seen = new Set<string>();
    for (const feat of features) {
      const coords = feat?.geometry?.coordinates;
      const props = feat?.properties;
      if (!Array.isArray(coords) || coords.length < 2 || !props) continue;
      const lng = Number(coords[0]);
      const lat = Number(coords[1]);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const name = String(props.name || props.street || props.city || props.town || '').trim();
      if (!name) continue;
      const cityPart = props.city || props.town || props.county || 'UK';
      const postcodePart = props.postcode ? ` ${props.postcode}` : '';
      const address = [props.street, cityPart].filter(Boolean).join(', ') + postcodePart;
      const key = `${name.toLowerCase()}|${String(cityPart).toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        name,
        address: address || cityPart,
        coords: clampMapCoords(projectLatLngToMap(lat, lng)),
      });
    }
    return results;
  } catch {
    return [];
  }
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

const CITY_CURATED_PLACES: Record<
  string,
  { streets: string[]; destinations: string[] }
> = {
  manchester: {
    streets: [
      'Deansgate',
      'Oxford Road',
      'Portland Street',
      'Whitworth Street West',
      'Great Ancoats Street',
      'Peter Street',
      'Mosley Street',
      'Wilmslow Road',
      'Chapel Street, Salford',
      'Oldham Road',
    ],
    destinations: [
      'Manchester Piccadilly Station',
      'Spinningfields Square',
      'Salford Quays MediaCityUK',
      'Trafford Centre Orient Way',
      'Northern Quarter Stevenson Sq',
      'Manchester Airport T2',
      'Didsbury Village Tram Stop',
      'Etihad Campus Gate 1',
      'Old Trafford Forecourt',
      'Manchester Royal Infirmary',
    ],
  },
  london: {
    streets: [
      'Oxford Street',
      'Baker Street',
      'Regent Street',
      'Piccadilly',
      'Marylebone High St',
      'Victoria Street',
      'Kingsway',
      'Bishopsgate',
      'Fulham Road',
      'Kensington High St',
    ],
    destinations: [
      'Paddington Station Taxi Rank',
      'King’s Cross St Pancras',
      'Canary Wharf Jubilee Plaza',
      'Victoria Coach Forecourt',
      'Covent Garden Piazza',
      'London Bridge Station',
      'Waterloo Station Exit 4',
      'Stratford International',
    ],
  },
  birmingham: {
    streets: [
      'New Street',
      'Corporation Street',
      'Broad Street',
      'Colmore Row',
      'Hagley Road',
      'Bristol Road',
      'Digbeth High St',
      'Moor Street Queensway',
    ],
    destinations: [
      'Birmingham New Street Grand Central',
      'Bullring & St Martin’s',
      'Brindleyplace Canalside',
      'Edgbaston Priory Gate',
      'Birmingham Airport BHX',
      'Aston University Campus',
    ],
  },
  liverpool: {
    streets: [
      'Lime Street',
      'Bold Street',
      'Lord Street',
      'Dale Street',
      'Hope Street',
      'Castle Street',
    ],
    destinations: [
      'Liverpool Lime Street Station',
      'Royal Albert Dock',
      'Liverpool ONE Paradise St',
      'Anfield Stadium Main Stand',
      'Liverpool John Lennon Airport',
    ],
  },
  leeds: {
    streets: [
      'Briggate',
      'The Headrow',
      'Boar Lane',
      'Park Row',
      'Wellington Street',
      'Woodhouse Lane',
    ],
    destinations: [
      'Leeds City Rail Station',
      'Trinity Leeds Arcade',
      'Leeds Dock Waterfront',
      'First Direct Arena',
      'Headingley Stadium',
    ],
  },
};

function getCuratedCityPool(townName: string): { streets: string[]; destinations: string[] } {
  const lower = townName.toLowerCase();
  for (const [key, pool] of Object.entries(CITY_CURATED_PLACES)) {
    if (lower.includes(key)) return pool;
  }
  return {
    streets: FALLBACK_LOCAL_STREETS,
    destinations: FALLBACK_LOCAL_DESTINATIONS,
  };
}

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

interface EatsCatalogEntry {
  name: string;
  category: EatsMerchantCategory;
  collectionHint: string;
  requiresAgeCheck?: boolean;
}

const UK_EATS_CATALOG: EatsCatalogEntry[] = [
  { name: "Nando's", category: 'restaurant', collectionHint: 'Collect from hot-shelf counter · Seal intact' },
  { name: 'Tesco Express', category: 'grocery', collectionHint: '2x chilled grocery bags · Ask till #2', requiresAgeCheck: true },
  { name: 'Wagamama', category: 'restaurant', collectionHint: 'Collect from Delivery Hatch · Keep upright' },
  { name: "Sainsbury's Local", category: 'grocery', collectionHint: 'Rapid Grocery pickup shelf · Check receipt', requiresAgeCheck: true },
  { name: 'Dishoom', category: 'restaurant', collectionHint: 'Collect from kitchen dispatch window' },
  { name: 'Co-op Food', category: 'grocery', collectionHint: 'Basket waiting behind checkout · Bring thermal bag' },
  { name: 'Five Guys', category: 'restaurant', collectionHint: 'Fries cooked fresh on driver arrival' },
  { name: 'Boots Pharmacy', category: 'pharmacy', collectionHint: 'Ask healthcare counter for Uber Eats parcel', requiresAgeCheck: true },
  { name: 'Franco Manca', category: 'restaurant', collectionHint: 'Keep sourdough pizza boxes flat' },
  { name: 'Morrisons Daily', category: 'grocery', collectionHint: 'Pickup bay at store entrance' },
  { name: 'Wingstop UK', category: 'restaurant', collectionHint: 'Show courier code at Wingstop counter' },
  { name: 'M&S Simply Food', category: 'grocery', collectionHint: 'Chilled dine-in bags at Customer Desk' },
  { name: 'Pret A Manger', category: 'restaurant', collectionHint: 'Coffee & bag waiting on Partner Shelf' },
  { name: 'Greggs', category: 'restaurant', collectionHint: 'Hot bake bag sealed behind till' },
  { name: 'Tortilla', category: 'restaurant', collectionHint: 'Ready on Click & Collect rack' },
  { name: 'Asda Express', category: 'grocery', collectionHint: 'Forecourt Express counter collection', requiresAgeCheck: true },
  { name: 'Leon', category: 'restaurant', collectionHint: 'Partner pickup window on right' },
  { name: 'Waitrose Little', category: 'grocery', collectionHint: 'Priority grocery crate at service desk' },
  { name: 'Itsu', category: 'restaurant', collectionHint: 'Cold sushi & hot broth packed separately' },
  { name: "McDonald's", category: 'restaurant', collectionHint: 'Delivery bay #1 · Check drink seal' },
  { name: 'KFC', category: 'restaurant', collectionHint: 'Collect from Driver Waiting Area' },
  { name: 'PizzaExpress', category: 'restaurant', collectionHint: 'Ask host desk for Uber Eats bag' },
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
  surgeLockedBonus?: number;
  boostBonus?: number;
  ccAlreadyPaidToday?: boolean;
  airportQueueCode?: string;
  areaPreference?: DriverPreferences['areaPreference'];
  destination?: DestinationConfig | null;
  isEV?: boolean;
  acceptCashJobs?: boolean;
}

export function generateLocalTripOffer({
  anchorCoords,
  realLatLng,
  seedIndex,
  forceType,
  forceIntercity = false,
  includeIntercity = true,
  servicePrefs,
  surgeLockedBonus = 0,
  boostBonus = 0,
  ccAlreadyPaidToday = false,
  airportQueueCode,
  areaPreference = 'all',
  destination,
  isEV = false,
  acceptCashJobs = true,
}: LocalOfferOptions): TripOffer {
  const baseLatLng = realLatLng ?? mapToLatLng(anchorCoords);
  const currentLat = baseLatLng.lat;
  const currentLng = baseLatLng.lng;
  const localTown = getResolvedLocalCityName(
    realLatLng ? projectLatLngToMap(currentLat, currentLng) : anchorCoords
  );
  const curatedPool = getCuratedCityPool(localTown);

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
  const destActive = Boolean(destination?.active && destination.coords);
  const isIntercity =
    forceIntercity ||
    (!destActive &&
      ((intercityEnabled && standardServices.length === 0) ||
        (intercityEnabled && seedIndex % 15 === 14)));
  const type: 'exclusive' | 'radar' =
    forceType ?? (seedIndex % 3 === 1 ? 'radar' : 'exclusive');

  const serviceName = isIntercity
    ? 'Intercity'
    : standardServices.length > 0
    ? standardServices[seedIndex % standardServices.length]
    : 'UberX';
  const isDelivery = serviceName === 'Uber Eats';

  // 1. Pick local PICKUP within 0.35 - 1.35 miles of the driver's Job location
  const pickupBearing = ((seedIndex * 73 + 25) % 360);
  const fallbackPickupDist = 0.4 + ((seedIndex % 5) * 0.18);
  const pickupFallbackLL = offsetLatLng(currentLat, currentLng, fallbackPickupDist, pickupBearing);

  let pickupLat = pickupFallbackLL.lat;
  let pickupLng = pickupFallbackLL.lng;
  let pickupAddress = `${12 + ((seedIndex * 17) % 180)} ${
    curatedPool.streets[seedIndex % curatedPool.streets.length]
  }`;
  let pickupArea = `${localTown} Centre`;
  const airportPin = airportQueueCode
    ? UK_AIRPORT_MAP_PINS.find((ap) => ap.code === airportQueueCode)
    : undefined;

  if (airportPin && !isDelivery) {
    const apLL = mapToLatLng(airportPin.coords);
    pickupLat = apLL.lat;
    pickupLng = apLL.lng;
    pickupAddress = `${airportPin.name} Airport (${airportPin.code}) Authorised Pickup`;
    pickupArea = `${airportPin.name} Airport`;
  } else if (hasFreshCache && geoCache && geoCache.streets.length > 0) {
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

  // 2. Pick DROPOFF (Destination-guided back toward user's target/home location, Intercity, Area filter, or Local city)
  let dropoffLat = currentLat;
  let dropoffLng = currentLng;
  let dropoffAddress = curatedPool.destinations[seedIndex % curatedPool.destinations.length];
  let dropoffArea = localTown;
  let intercityCorridor: string | undefined;
  let effectiveIsIntercity = isIntercity;

  if (destActive && destination && !forceIntercity) {
    const destLL = mapToLatLng(destination.coords);
    const distToDest = haversineMiles(pickupLat, pickupLng, destLL.lat, destLL.lng);
    const toDestBearing = bearingBetweenDeg(pickupLat, pickupLng, destLL.lat, destLL.lng);
    const shortDest = destination.destinationName.split('·')[0].trim();
    const destCity = getResolvedLocalCityName(destination.coords);
    const destCurated = getCuratedCityPool(destCity);

    if (distToDest <= 5.5) {
      const jitterDist = seedIndex % 2 === 0 ? 0.25 : 0.65 + (seedIndex % 3) * 0.25;
      const nearLL = offsetLatLng(
        destLL.lat,
        destLL.lng,
        jitterDist,
        (toDestBearing + (seedIndex % 4) * 55) % 360
      );
      dropoffLat = nearLL.lat;
      dropoffLng = nearLL.lng;
      dropoffAddress =
        seedIndex % 2 === 0
          ? destination.destinationAddress || destination.destinationName
          : destCurated.destinations[seedIndex % destCurated.destinations.length];
      dropoffArea = `Near ${shortDest}`;
    } else if (destination.routeType === 'faster' || distToDest <= 14) {
      const jitterDist = 0.25 + (seedIndex % 3) * 0.3;
      const nearLL = offsetLatLng(destLL.lat, destLL.lng, jitterDist, (toDestBearing + 180) % 360);
      dropoffLat = nearLL.lat;
      dropoffLng = nearLL.lng;
      dropoffAddress = destination.destinationAddress || destination.destinationName;
      dropoffArea = `Near ${shortDest} · Toward You`;
      if (distToDest >= 16) {
        effectiveIsIntercity = true;
        intercityCorridor = `${localTown} → ${shortDest} · Return`;
      }
    } else {
      // Flexible multi-hop along the exact corridor toward destination / user's location
      const hopFraction = 0.42 + ((seedIndex % 4) * 0.12);
      const hopMiles = Math.min(Math.max(2.5, distToDest * hopFraction), 15.0);
      const hopBearing = (toDestBearing + ((seedIndex % 3) - 1) * 10 + 360) % 360;
      const hopLL = offsetLatLng(pickupLat, pickupLng, hopMiles, hopBearing);
      const hopCity = nearestUKCity(projectLatLngToMap(hopLL.lat, hopLL.lng));
      const hopPool = getCuratedCityPool(hopCity);
      dropoffLat = hopLL.lat;
      dropoffLng = hopLL.lng;
      dropoffAddress = hopPool.destinations[(seedIndex + 1) % hopPool.destinations.length];
      dropoffArea = `Toward ${shortDest} (${hopCity})`;
    }
  } else if (effectiveIsIntercity) {
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
  } else if (areaPreference && areaPreference !== 'all') {
    const isGreaterLondon = haversineMiles(currentLat, currentLng, 51.5074, -0.1278) <= 28;
    if (isGreaterLondon && areaPreference !== 'local') {
      const londonAreaBias: Record<
        'central' | 'east' | 'west',
        { lat: number; lng: number; address: string; area: string }
      > = {
        central: {
          lat: 51.5105 + ((seedIndex % 3) - 1) * 0.008,
          lng: -0.132 + ((seedIndex % 4) - 1.5) * 0.01,
          address: ['Soho Square W1D', 'Covent Garden Piazza', 'King’s Cross Concourse', 'Trafalgar Square'][
            seedIndex % 4
          ],
          area: 'Central London · Area Filter',
        },
        east: {
          lat: 51.5055 + ((seedIndex % 3) - 1) * 0.009,
          lng: -0.022 + ((seedIndex % 4) - 1.5) * 0.015,
          address: ['Canary Wharf Jubilee Plaza', 'Stratford International', 'Greenwich Pier Cutty Sark', 'ExCeL London East'][
            seedIndex % 4
          ],
          area: 'East & Canary Wharf · Area Filter',
        },
        west: {
          lat: 51.488 + ((seedIndex % 3) - 1) * 0.01,
          lng: -0.285 + ((seedIndex % 4) - 1.5) * 0.02,
          address: ['Heathrow Terminal 5 Forecourt', 'Hammersmith Broadway', 'Ealing Broadway Station', 'Paddington Basin'][
            seedIndex % 4
          ],
          area: 'West & Heathrow · Area Filter',
        },
      };
      const chosenBias = londonAreaBias[areaPreference];
      dropoffLat = chosenBias.lat;
      dropoffLng = chosenBias.lng;
      dropoffAddress = chosenBias.address;
      dropoffArea = chosenBias.area;
    } else {
      // Dynamic city-relative directional filter (works in Manchester, Birmingham, Edinburgh, etc.)
      const sectorBearing =
        areaPreference === 'east'
          ? 85 + (seedIndex % 3) * 15
          : areaPreference === 'west'
          ? 265 + (seedIndex % 3) * 15
          : areaPreference === 'central'
          ? (pickupBearing + 180) % 360
          : (pickupBearing + 120) % 360;
      const distMi = areaPreference === 'local' ? 1.3 + (seedIndex % 3) * 0.65 : 2.1 + (seedIndex % 3) * 0.85;
      const dropLL = offsetLatLng(pickupLat, pickupLng, distMi, sectorBearing);
      dropoffLat = dropLL.lat;
      dropoffLng = dropLL.lng;
      dropoffAddress = curatedPool.destinations[(seedIndex + 1) % curatedPool.destinations.length];
      dropoffArea =
        areaPreference === 'local'
          ? `${localTown} ≤3.5 mi · Local Only`
          : `${localTown} (${areaPreference.charAt(0).toUpperCase() + areaPreference.slice(1)})`;
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
      dropoffAddress = curatedPool.destinations[(seedIndex + 3) % curatedPool.destinations.length];
      dropoffArea = `${localTown} Local`;
    }
  } else {
    const localTripDist = 1.9 + ((seedIndex % 6) * 0.8);
    const dropBearing = (pickupBearing + 115 + (seedIndex % 3) * 45) % 360;
    const dropLL = offsetLatLng(pickupLat, pickupLng, localTripDist, dropBearing);
    dropoffLat = dropLL.lat;
    dropoffLng = dropLL.lng;
    dropoffAddress = curatedPool.destinations[(seedIndex + 3) % curatedPool.destinations.length];
    dropoffArea = `${localTown} Local`;
  }

  const selectedMerchant = isDelivery
    ? UK_EATS_CATALOG[seedIndex % UK_EATS_CATALOG.length]
    : undefined;

  if (isDelivery && selectedMerchant) {
    if (!pickupAddress.toLowerCase().includes(selectedMerchant.name.toLowerCase())) {
      pickupAddress = `${selectedMerchant.name} · ${pickupAddress}`;
    }
  }

  const tripMilesRaw = Math.max(
    isDelivery ? 0.8 : 1.3,
    haversineMiles(pickupLat, pickupLng, dropoffLat, dropoffLng) * (isDelivery ? 0.92 : 1.28)
  );
  const tripMiles = Number(tripMilesRaw.toFixed(1));
  const avgSpeedMph = effectiveIsIntercity ? 44 : isDelivery ? 16 : 18;
  const tripMinutes = Math.max(isDelivery ? 5 : 6, Math.round((tripMiles / avgSpeedMph) * 60));

  // Optional mid-route stop (~1 in 5 local passenger trips; never on Uber Eats)
  const hasStop = !effectiveIsIntercity && !destActive && !isDelivery && seedIndex % 5 === 2;
  const stopCoords = hasStop
    ? clampMapCoords(
        projectLatLngToMap(
          (pickupLat + dropoffLat) / 2 + 0.002,
          (pickupLng + dropoffLng) / 2 - 0.002
        )
      )
    : undefined;
  const stopAddress = hasStop
    ? `${curatedPool.streets[(seedIndex + 4) % curatedPool.streets.length]} (Quick 2m stop)`
    : undefined;

  const pickupCoordsProjected = clampMapCoords(projectLatLngToMap(pickupLat, pickupLng));
  const dropoffCoordsProjected = clampMapCoords(projectLatLngToMap(dropoffLat, dropoffLng));

  const zoneInfo = !isDelivery
    ? detectUKZoneSurcharge(pickupCoordsProjected, dropoffCoordsProjected, ccAlreadyPaidToday, isEV)
    : { appliedLondonCC: false, isAirportZone: false };

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
      : effectiveIsIntercity || serviceName === 'Intercity'
      ? 1.65
      : 1.5;

  const baseSurchargeLabel =
    serviceName === 'Uber Pet'
      ? 'Pet Fee'
      : isDelivery
      ? 'Hot Bag Bonus'
      : zoneInfo.surchargeLabel;
  const baseSurchargeAmount =
    serviceName === 'Uber Pet'
      ? 3.5
      : isDelivery && seedIndex % 2 === 0
      ? 1.2
      : zoneInfo.surchargeAmount;

  const surchargeLabel = baseSurchargeLabel;
  const surchargeAmount = baseSurchargeAmount;

  const generatedSurge =
    seedIndex % 3 === 0 ? Number((1.75 + (seedIndex % 4) * 0.75).toFixed(2)) : 0;
  const effectiveSurge = Math.max(generatedSurge, surgeLockedBonus);
  const surgeBonus = effectiveSurge > 0 ? Number(effectiveSurge.toFixed(2)) : undefined;
  const effectiveBoost = boostBonus > 0 ? Number(boostBonus.toFixed(2)) : undefined;

  const baseFare =
    (isDelivery ? 2.85 : 3.2) +
    tripMiles * perMileRate +
    tripMinutes * (isDelivery ? 0.14 : 0.18) +
    (surchargeAmount ?? 0) +
    (surgeBonus ?? 0) +
    (effectiveBoost ?? 0);
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

  const eatsOrderCode = isDelivery
    ? `#UE-${(4100 + ((seedIndex * 79) % 5800)).toString(16).toUpperCase()}`
    : undefined;

  // ~28% of eligible passenger jobs are Cash + UK Taxi Meter when Cash Jobs enabled
  const isCashJob =
    Boolean(acceptCashJobs) && !isDelivery && !effectiveIsIntercity && seedIndex % 4 === 3;
  const meterRates = isCashJob ? getUKTaxiMeterRates(serviceName) : null;
  const meteredStartEst =
    isCashJob && meterRates
      ? Number(
          (
            meterRates.flagFall +
            tripMiles * meterRates.ratePerMile +
            Math.max(1, Math.round(tripMinutes * 0.25)) * meterRates.waitPerMin +
            (surchargeAmount ?? 0)
          ).toFixed(2)
        )
      : undefined;
  const finalFare = isCashJob && meteredStartEst ? meteredStartEst : fare;

  const riderNote =
    isDelivery && selectedMerchant
      ? `Collect at ${selectedMerchant.name} (${eatsOrderCode}) · ${selectedMerchant.collectionHint}${
          selectedMerchant.requiresAgeCheck ? ' · Challenge 25 ID Check' : ''
        }`
      : isCashJob
      ? `Cash Fare (${meterRates?.tariffLabel}) · Customer paying cash in vehicle at dropoff`
      : serviceName === 'Uber Pet'
      ? PET_NOTES[seedIndex % PET_NOTES.length]
      : serviceName === 'UberXL'
      ? `Group of ${4 + (seedIndex % 3)} passengers with luggage — outside ${pickupAddress}.`
      : serviceName === 'Comfort'
      ? `Comfort preference: Quiet ride & cool cabin · ${pickupAddress}.`
      : airportPin
      ? `Flight arrival matched via ${airportPin.name} FIFO Queue · Waiting at pickup bay.`
      : `Waiting outside ${pickupAddress} in ${localTown}.`;

  return {
    id: `local-${type}-${effectiveIsIntercity ? 'ic-' : ''}${Date.now()}-${seedIndex}`,
    type,
    serviceName: effectiveIsIntercity ? 'Intercity' : serviceName,
    fare: finalFare,
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
    pickupCoords: pickupCoordsProjected,
    dropoffCoords: dropoffCoordsProjected,
    surgeBonus,
    surgeLockedBonus: surgeLockedBonus > 0 ? surgeLockedBonus : undefined,
    boostBonus: effectiveBoost,
    eatsOrderCode,
    merchantName: selectedMerchant?.name,
    merchantCategory: selectedMerchant?.category,
    requiresAgeCheck: selectedMerchant?.requiresAgeCheck,
    paymentMethod: isCashJob ? 'cash' : 'card',
    isMeteredFare: isCashJob,
    meterStartFare: meterRates?.flagFall,
    meterRatePerMile: meterRates?.ratePerMile,
    meterWaitPerMin: meterRates?.waitPerMin,
    isAirportPickup: Boolean(airportPin || zoneInfo.isAirportZone),
    inLondonCC: zoneInfo.appliedLondonCC,
    ulezStatus: zoneInfo.ulezStatus,
    pinCode,
    surchargeLabel,
    surchargeAmount,
    isIntercity: effectiveIsIntercity,
    intercityCorridor,
    stopAddress,
    stopCoords,
    riderNote,
    expiresInSec: effectiveIsIntercity ? 20 : type === 'radar' ? 18 : 15,
  };
}

export function buildLocalOfferPool(
  anchorCoords: Coordinates,
  realLatLng: { lat: number; lng: number } | null | undefined,
  includeIntercity: boolean,
  startSeed = 0,
  servicePrefs?: ServicePrefsInput,
  areaPreference?: DriverPreferences['areaPreference'],
  isEV = false,
  acceptCashJobs = true,
  destination?: DestinationConfig | null
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
        areaPreference,
        destination,
        isEV,
        acceptCashJobs,
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
