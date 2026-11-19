import { Coordinates } from '../types/driver';

const LAT_MAX = 58.7;
const LAT_MIN = 49.85;
const PX_PER_LAT = 870 / (LAT_MAX - LAT_MIN); // ~98.305
const PX_PER_LNG = PX_PER_LAT * 0.588; // ~57.803 at ~54 deg N
const CENTER_LNG = -2.3;
const CENTER_X = 520;
const TOP_Y = 65;

export function projectLatLngToMap(lat: number, lng: number): Coordinates {
  const x = CENTER_X + (lng - CENTER_LNG) * PX_PER_LNG;
  const y = TOP_Y + (LAT_MAX - lat) * PX_PER_LAT;
  return {
    x: Number(x.toFixed(1)),
    y: Number(y.toFixed(1)),
  };
}

export function mapToLatLng(coords: Coordinates): { lat: number; lng: number } {
  const lat = LAT_MAX - (coords.y - TOP_Y) / PX_PER_LAT;
  const lng = CENTER_LNG + (coords.x - CENTER_X) / PX_PER_LNG;
  return {
    lat: Number(lat.toFixed(5)),
    lng: Number(lng.toFixed(5)),
  };
}

export function isWithinUKBounds(lat: number, lng: number): boolean {
  return lat >= 49.5 && lat <= 60.9 && lng >= -8.6 && lng <= 2.3;
}

export function clampMapCoords(coords: Coordinates): Coordinates {
  return {
    x: Math.max(-400, Math.min(1400, coords.x)),
    y: Math.max(-400, Math.min(1400, coords.y)),
  };
}

export interface UKCity {
  name: string;
  lat: number;
  lng: number;
  coords: Coordinates;
  major?: boolean;
}

const RAW_UK_CITIES: Array<{
  name: string;
  lat: number;
  lng: number;
  major?: boolean;
}> = [
  { name: 'LONDON', lat: 51.5074, lng: -0.1278, major: true },
  { name: 'BIRMINGHAM', lat: 52.4862, lng: -1.8904, major: true },
  { name: 'MANCHESTER', lat: 53.4808, lng: -2.2426, major: true },
  { name: 'LIVERPOOL', lat: 53.4084, lng: -2.9916 },
  { name: 'LEEDS', lat: 53.8008, lng: -1.5491, major: true },
  { name: 'SHEFFIELD', lat: 53.3811, lng: -1.4701 },
  { name: 'BRISTOL', lat: 51.4545, lng: -2.5879, major: true },
  { name: 'CARDIFF', lat: 51.4816, lng: -3.1791, major: true },
  { name: 'NEWCASTLE', lat: 54.9783, lng: -1.6178, major: true },
  { name: 'EDINBURGH', lat: 55.9533, lng: -3.1883, major: true },
  { name: 'GLASGOW', lat: 55.8642, lng: -4.2518, major: true },
  { name: 'BELFAST', lat: 54.5973, lng: -5.9301, major: true },
  { name: 'ABERDEEN', lat: 57.1497, lng: -2.0943 },
  { name: 'INVERNESS', lat: 57.4778, lng: -4.2247 },
  { name: 'OXFORD', lat: 51.752, lng: -1.2577 },
  { name: 'CAMBRIDGE', lat: 52.2053, lng: 0.1218 },
  { name: 'NOTTINGHAM', lat: 52.9548, lng: -1.1581 },
  { name: 'SOUTHAMPTON', lat: 50.9097, lng: -1.4044 },
  { name: 'BRIGHTON', lat: 50.8225, lng: -0.1372 },
  { name: 'PLYMOUTH', lat: 50.3755, lng: -4.1427 },
  { name: 'NORWICH', lat: 52.6309, lng: 1.2974 },
  { name: 'YORK', lat: 53.9591, lng: -1.0815 },
  { name: 'BATH', lat: 51.3758, lng: -2.3599 },
  { name: 'READING', lat: 51.4543, lng: -0.9781 },
  { name: 'MILTON KEYNES', lat: 52.0406, lng: -0.7594 },
];

export const UK_CITIES: UKCity[] = RAW_UK_CITIES.map((c) => ({
  ...c,
  coords: projectLatLngToMap(c.lat, c.lng),
}));

export function nearestUKCity(coords: Coordinates): string {
  let best = UK_CITIES[0];
  let minDist = Infinity;
  for (const city of UK_CITIES) {
    const d = Math.hypot(city.coords.x - coords.x, city.coords.y - coords.y);
    if (d < minDist) {
      minDist = d;
      best = city;
    }
  }
  return best.name
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function polyToPath(points: Array<[number, number]>): string {
  return (
    points
      .map(([lat, lng], i) => {
        const p = projectLatLngToMap(lat, lng);
        return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
      })
      .join(' ') + ' Z'
  );
}

function lineToPath(points: Array<[number, number]>): string {
  return points
    .map(([lat, lng], i) => {
      const p = projectLatLngToMap(lat, lng);
      return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
    })
    .join(' ');
}

const GREAT_BRITAIN_COAST: Array<[number, number]> = [
  [58.64, -3.07],
  [58.45, -3.09],
  [57.86, -3.99],
  [57.58, -4.12],
  [57.69, -2.0],
  [57.15, -2.08],
  [56.46, -2.97],
  [56.28, -2.59],
  [56.0, -3.2],
  [55.77, -2.0],
  [55.02, -1.42],
  [54.69, -1.2],
  [54.48, -0.61],
  [54.1, -0.1],
  [53.57, 0.1],
  [53.05, 0.3],
  [52.95, 0.5],
  [52.48, 1.76],
  [51.95, 1.3],
  [51.5, 0.85],
  [51.38, 1.44],
  [51.12, 1.32],
  [50.92, 0.96],
  [50.76, 0.28],
  [50.81, -0.14],
  [50.79, -1.09],
  [50.71, -1.87],
  [50.56, -2.45],
  [50.61, -3.38],
  [50.36, -4.14],
  [49.96, -5.2],
  [50.07, -5.71],
  [50.55, -4.95],
  [51.2, -4.12],
  [51.45, -2.8],
  [51.48, -3.17],
  [51.61, -3.94],
  [51.71, -5.2],
  [52.2, -4.4],
  [52.78, -4.65],
  [53.32, -4.6],
  [53.35, -3.5],
  [53.43, -3.03],
  [53.8, -3.05],
  [54.05, -2.85],
  [54.55, -3.6],
  [54.95, -3.3],
  [54.85, -4.95],
  [55.47, -4.63],
  [55.94, -4.9],
  [55.42, -5.6],
  [56.41, -5.47],
  [56.82, -5.1],
  [57.28, -5.8],
  [57.9, -5.16],
  [58.55, -5.0],
  [58.59, -3.52],
];

const NORTHERN_IRELAND_COAST: Array<[number, number]> = [
  [55.25, -6.5],
  [55.2, -6.05],
  [54.85, -5.8],
  [54.65, -5.9],
  [54.45, -5.48],
  [54.08, -6.05],
  [54.22, -6.7],
  [54.35, -7.85],
  [54.72, -7.6],
  [55.02, -7.32],
];

const ISLE_OF_WIGHT: Array<[number, number]> = [
  [50.76, -1.3],
  [50.69, -1.08],
  [50.58, -1.29],
  [50.67, -1.56],
];

const ISLE_OF_MAN: Array<[number, number]> = [
  [54.41, -4.38],
  [54.25, -4.33],
  [54.06, -4.66],
  [54.22, -4.74],
];

const ANGLESEY: Array<[number, number]> = [
  [53.41, -4.45],
  [53.35, -4.11],
  [53.17, -4.2],
  [53.26, -4.55],
];

const SKYE: Array<[number, number]> = [
  [57.69, -6.2],
  [57.48, -6.05],
  [57.15, -5.85],
  [57.28, -6.45],
  [57.5, -6.6],
];

const REPUBLIC_OF_IRELAND_SUGGESTED: Array<[number, number]> = [
  [55.3, -7.3],
  [55.25, -6.5],
  [55.02, -7.32],
  [54.72, -7.6],
  [54.35, -7.85],
  [54.22, -6.7],
  [54.08, -6.05],
  [53.35, -6.2],
  [52.25, -6.3],
  [51.6, -8.5],
  [53.2, -9.0],
  [54.3, -8.6],
];

const FRANCE_CHANNEL_EDGE: Array<[number, number]> = [
  [49.8, 0.2],
  [50.95, 1.85],
  [51.1, 2.5],
  [49.6, 2.5],
];

export const UK_SPEED_CAMERAS: Array<{
  id: string;
  label: string;
  limitMph: 20 | 30 | 50 | 70;
  kind: 'speed' | 'bus_lane';
  coords: Coordinates;
}> = [
  {
    id: 'cam-1',
    label: 'Oxford St Bus Lane Camera',
    limitMph: 20,
    kind: 'bus_lane',
    coords: projectLatLngToMap(51.514, -0.145),
  },
  {
    id: 'cam-2',
    label: 'M40 Average Speed Camera',
    limitMph: 70,
    kind: 'speed',
    coords: projectLatLngToMap(51.63, -0.78),
  },
  {
    id: 'cam-3',
    label: 'M25 Heathrow Variable Camera',
    limitMph: 50,
    kind: 'speed',
    coords: projectLatLngToMap(51.48, -0.49),
  },
  {
    id: 'cam-4',
    label: 'M1 Junction 14 Speed Camera',
    limitMph: 70,
    kind: 'speed',
    coords: projectLatLngToMap(52.05, -0.73),
  },
  {
    id: 'cam-5',
    label: 'Manchester Piccadilly Bus Gate',
    limitMph: 20,
    kind: 'bus_lane',
    coords: projectLatLngToMap(53.475, -2.236),
  },
];

export const UK_AIRPORT_MAP_PINS = [
  { code: 'LHR', name: 'Heathrow', coords: projectLatLngToMap(51.47, -0.454) },
  { code: 'LGW', name: 'Gatwick', coords: projectLatLngToMap(51.153, -0.182) },
  { code: 'MAN', name: 'Manchester', coords: projectLatLngToMap(53.358, -2.273) },
  { code: 'BHX', name: 'Birmingham', coords: projectLatLngToMap(52.453, -1.748) },
  { code: 'EDI', name: 'Edinburgh', coords: projectLatLngToMap(55.95, -3.372) },
];

export const UK_SVG_PATHS = {
  greatBritain: polyToPath(GREAT_BRITAIN_COAST),
  northernIreland: polyToPath(NORTHERN_IRELAND_COAST),
  isleOfWight: polyToPath(ISLE_OF_WIGHT),
  isleOfMan: polyToPath(ISLE_OF_MAN),
  anglesey: polyToPath(ANGLESEY),
  skye: polyToPath(SKYE),
  irelandMuted: polyToPath(REPUBLIC_OF_IRELAND_SUGGESTED),
  franceMuted: polyToPath(FRANCE_CHANNEL_EDGE),
  urbanAreas: [
    // Greater London urban footprint
    { ...projectLatLngToMap(51.507, -0.128), rx: 21, ry: 17 },
    // Greater Manchester
    { ...projectLatLngToMap(53.48, -2.24), rx: 14, ry: 11 },
    // West Midlands / Birmingham
    { ...projectLatLngToMap(52.48, -1.89), rx: 14, ry: 11 },
    // West Yorkshire / Leeds
    { ...projectLatLngToMap(53.8, -1.55), rx: 12, ry: 9 },
    // Glasgow / Clyde
    { ...projectLatLngToMap(55.86, -4.25), rx: 12, ry: 9 },
    // Bristol / Cardiff
    { ...projectLatLngToMap(51.46, -2.65), rx: 10, ry: 8 },
  ],
  parks: [
    { ...projectLatLngToMap(57.05, -3.6), rx: 32, ry: 22 }, // Cairngorms
    { ...projectLatLngToMap(56.15, -4.65), rx: 20, ry: 22 }, // Loch Lomond
    { ...projectLatLngToMap(54.46, -3.08), rx: 22, ry: 20 }, // Lake District
    { ...projectLatLngToMap(54.23, -2.15), rx: 22, ry: 18 }, // Yorkshire Dales
    { ...projectLatLngToMap(52.9, -3.88), rx: 20, ry: 22 }, // Snowdonia
    { ...projectLatLngToMap(53.33, -1.78), rx: 18, ry: 20 }, // Peak District
    { ...projectLatLngToMap(51.88, -3.43), rx: 20, ry: 12 }, // Brecon Beacons
    { ...projectLatLngToMap(51.83, -1.85), rx: 18, ry: 16 }, // Cotswolds
    { ...projectLatLngToMap(50.57, -3.92), rx: 18, ry: 15 }, // Dartmoor
  ],
  rivers: [
    // Thames
    lineToPath([
      [51.72, -1.7],
      [51.55, -0.8],
      [51.5, -0.12],
      [51.49, 0.6],
    ]),
    // Severn
    lineToPath([
      [52.5, -3.2],
      [52.18, -2.22],
      [51.86, -2.24],
      [51.48, -2.75],
    ]),
    // Trent
    lineToPath([
      [52.82, -1.65],
      [52.95, -1.14],
      [53.45, -0.78],
      [53.7, -0.68],
    ]),
    // Clyde
    lineToPath([
      [55.67, -3.78],
      [55.85, -4.25],
      [55.94, -4.75],
    ]),
    // Tyne
    lineToPath([
      [54.96, -2.1],
      [54.97, -1.62],
      [55.01, -1.43],
    ]),
  ],
  primaryARoads: [
    // A303 West Country
    lineToPath([
      [51.18, -1.55],
      [51.03, -2.4],
      [50.72, -3.48],
    ]),
    // A55 North Wales
    lineToPath([
      [53.19, -2.89],
      [53.28, -3.8],
      [53.3, -4.6],
    ]),
    // A14 East-West Midlands
    lineToPath([
      [52.37, -1.18],
      [52.23, 0.12],
      [52.05, 1.15],
    ]),
    // M27 South Coast
    lineToPath([
      [50.92, -1.48],
      [50.85, -1.08],
      [50.83, -0.4],
    ]),
  ],
  motorways: [
    // M25 Orbital London
    lineToPath([
      [51.68, -0.25],
      [51.66, 0.2],
      [51.45, 0.25],
      [51.27, 0.05],
      [51.31, -0.45],
      [51.55, -0.52],
      [51.68, -0.25],
    ]),
    // M1: London -> Leeds
    lineToPath([
      [51.55, -0.22],
      [52.04, -0.75],
      [52.63, -1.14],
      [52.95, -1.2],
      [53.38, -1.42],
      [53.8, -1.55],
    ]),
    // M6 / M74: Birmingham -> Glasgow
    lineToPath([
      [52.49, -1.89],
      [52.81, -2.11],
      [53.38, -2.5],
      [53.48, -2.24],
      [53.76, -2.7],
      [54.89, -2.93],
      [55.86, -4.25],
    ]),
    // M4: London -> Swansea
    lineToPath([
      [51.49, -0.28],
      [51.45, -0.98],
      [51.51, -2.56],
      [51.48, -3.18],
      [51.62, -3.94],
    ]),
    // M5: Birmingham -> Plymouth
    lineToPath([
      [52.49, -1.89],
      [52.19, -2.2],
      [51.45, -2.62],
      [50.72, -3.52],
      [50.37, -4.14],
    ]),
    // M40: London -> Oxford -> Birmingham
    lineToPath([
      [51.54, -0.4],
      [51.76, -1.2],
      [52.45, -1.85],
    ]),
    // A1(M): London -> Edinburgh
    lineToPath([
      [51.62, -0.2],
      [52.57, -0.26],
      [53.52, -1.13],
      [53.95, -1.12],
      [54.97, -1.61],
      [55.77, -2.02],
      [55.95, -3.19],
    ]),
    // M62: Liverpool -> Hull
    lineToPath([
      [53.41, -2.99],
      [53.48, -2.24],
      [53.77, -1.55],
      [53.74, -0.4],
    ]),
    // M8: Glasgow <-> Edinburgh
    lineToPath([
      [55.86, -4.25],
      [55.9, -3.7],
      [55.95, -3.19],
    ]),
    // A9: Edinburgh -> Inverness
    lineToPath([
      [55.95, -3.2],
      [56.39, -3.43],
      [57.05, -4.05],
      [57.48, -4.22],
    ]),
    // M11 / A11: London -> Norwich
    lineToPath([
      [51.58, 0.02],
      [52.2, 0.12],
      [52.63, 1.3],
    ]),
    // M23 / M3 / M20
    lineToPath([
      [51.46, -0.15],
      [51.14, -0.17],
      [50.82, -0.14],
    ]),
    lineToPath([
      [51.45, -0.4],
      [51.25, -1.1],
      [50.91, -1.4],
    ]),
    lineToPath([
      [51.42, 0.15],
      [51.27, 0.52],
      [51.12, 1.3],
    ]),
  ],
  trafficSegments: [
    // M25 West Heathrow congestion (red)
    {
      d: lineToPath([
        [51.38, -0.5],
        [51.5, -0.52],
        [51.6, -0.44],
      ]),
      level: 'heavy' as const,
    },
    // M1 Southbound near MK (amber)
    {
      d: lineToPath([
        [51.92, -0.55],
        [52.12, -0.78],
      ]),
      level: 'moderate' as const,
    },
    // M6 Birmingham Spaghetti Junction (red)
    {
      d: lineToPath([
        [52.47, -1.96],
        [52.53, -1.82],
      ]),
      level: 'heavy' as const,
    },
    // M62 Manchester -> Leeds (amber)
    {
      d: lineToPath([
        [53.48, -2.24],
        [53.63, -1.9],
      ]),
      level: 'moderate' as const,
    },
    // M40 Oxford fast flow (green)
    {
      d: lineToPath([
        [51.62, -0.8],
        [51.85, -1.25],
      ]),
      level: 'clear' as const,
    },
  ],
  londonZones: {
    congestionCenter: projectLatLngToMap(51.509, -0.128),
    ulezCenter: projectLatLngToMap(51.509, -0.128),
    dartfordCenter: projectLatLngToMap(51.464, 0.258),
  },
  shields: [
    { label: 'M1', ...projectLatLngToMap(52.5, -1.1) },
    { label: 'M6', ...projectLatLngToMap(53.9, -2.65) },
    { label: 'M4', ...projectLatLngToMap(51.47, -1.6) },
    { label: 'M40', ...projectLatLngToMap(51.82, -1.25) },
    { label: 'M25', ...projectLatLngToMap(51.67, -0.1) },
    { label: 'A1', ...projectLatLngToMap(54.4, -1.5) },
    { label: 'M62', ...projectLatLngToMap(53.68, -1.85) },
    { label: 'M8', ...projectLatLngToMap(55.9, -3.75) },
  ],
};
