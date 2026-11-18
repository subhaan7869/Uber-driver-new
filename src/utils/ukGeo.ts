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

export function isWithinUKBounds(lat: number, lng: number): boolean {
  return lat >= 49.5 && lat <= 60.9 && lng >= -8.6 && lng <= 2.3;
}

export function clampMapCoords(coords: Coordinates): Coordinates {
  return {
    x: Math.max(40, Math.min(960, coords.x)),
    y: Math.max(40, Math.min(960, coords.y)),
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
  const title =
    best.name.charAt(0).toUpperCase() + best.name.slice(1).toLowerCase();
  return title;
}

// Coastal polygons projected cleanly from real UK lat/lng waypoints
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
  [58.64, -3.07], // John o' Groats
  [58.45, -3.09], // Wick
  [57.86, -3.99], // Dornoch Firth
  [57.58, -4.12], // Moray Firth
  [57.69, -2.0],  // Fraserburgh
  [57.15, -2.08], // Aberdeen
  [56.46, -2.97], // Dundee
  [56.28, -2.59], // Fife Ness
  [56.0, -3.2],   // Firth of Forth
  [55.77, -2.0],  // Berwick-upon-Tweed
  [55.02, -1.42], // Tynemouth
  [54.69, -1.2],  // Hartlepool
  [54.48, -0.61], // Whitby
  [54.1, -0.1],   // Flamborough Head
  [53.57, 0.1],   // Spurn Point / Humber
  [53.05, 0.3],   // The Wash East
  [52.95, 0.5],   // North Norfolk
  [52.48, 1.76],  // Lowestoft
  [51.95, 1.3],   // Felixstowe
  [51.5, 0.85],   // Thames Estuary North
  [51.38, 1.44],  // Margate
  [51.12, 1.32],  // Dover
  [50.92, 0.96],  // Dungeness
  [50.76, 0.28],  // Eastbourne
  [50.81, -0.14], // Brighton
  [50.79, -1.09], // Portsmouth
  [50.71, -1.87], // Bournemouth
  [50.56, -2.45], // Weymouth
  [50.61, -3.38], // Exmouth
  [50.36, -4.14], // Plymouth
  [49.96, -5.2],  // Lizard Point
  [50.07, -5.71], // Land's End
  [50.55, -4.95], // Cornwall North
  [51.2, -4.12],  // Ilfracombe
  [51.45, -2.8],  // Severn Estuary / Avonmouth
  [51.48, -3.17], // Cardiff
  [51.61, -3.94], // Swansea
  [51.71, -5.2],  // Pembroke
  [52.2, -4.4],   // Cardigan Bay
  [52.78, -4.65], // Llyn Peninsula
  [53.32, -4.6],  // Anglesey
  [53.35, -3.5],  // North Wales
  [53.43, -3.03], // Liverpool / Mersey
  [53.8, -3.05],  // Blackpool
  [54.05, -2.85], // Morecambe Bay
  [54.55, -3.6],  // Cumbria / Whitehaven
  [54.95, -3.3],  // Solway Firth
  [54.85, -4.95], // Stranraer
  [55.47, -4.63], // Ayr
  [55.94, -4.9],  // Firth of Clyde
  [55.42, -5.6],  // Kintyre
  [56.41, -5.47], // Oban
  [56.82, -5.1],  // Fort William
  [57.28, -5.8],  // Skye Coast
  [57.9, -5.16],  // Ullapool
  [58.55, -5.0],  // Cape Wrath
  [58.59, -3.52], // Thurso
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

export const UK_SVG_PATHS = {
  greatBritain: polyToPath(GREAT_BRITAIN_COAST),
  northernIreland: polyToPath(NORTHERN_IRELAND_COAST),
  irelandMuted: polyToPath(REPUBLIC_OF_IRELAND_SUGGESTED),
  franceMuted: polyToPath(FRANCE_CHANNEL_EDGE),
  parks: [
    // Cairngorms
    { cx: projectLatLngToMap(57.05, -3.6).x, cy: projectLatLngToMap(57.05, -3.6).y, rx: 32, ry: 22 },
    // Loch Lomond
    { cx: projectLatLngToMap(56.15, -4.65).x, cy: projectLatLngToMap(56.15, -4.65).y, rx: 20, ry: 22 },
    // Lake District
    { cx: projectLatLngToMap(54.46, -3.08).x, cy: projectLatLngToMap(54.46, -3.08).y, rx: 22, ry: 20 },
    // Yorkshire Dales
    { cx: projectLatLngToMap(54.23, -2.15).x, cy: projectLatLngToMap(54.23, -2.15).y, rx: 22, ry: 18 },
    // Snowdonia / Eryri
    { cx: projectLatLngToMap(52.9, -3.88).x, cy: projectLatLngToMap(52.9, -3.88).y, rx: 20, ry: 22 },
    // Peak District
    { cx: projectLatLngToMap(53.33, -1.78).x, cy: projectLatLngToMap(53.33, -1.78).y, rx: 18, ry: 20 },
    // Brecon Beacons
    { cx: projectLatLngToMap(51.88, -3.43).x, cy: projectLatLngToMap(51.88, -3.43).y, rx: 20, ry: 12 },
    // Cotswolds
    { cx: projectLatLngToMap(51.83, -1.85).x, cy: projectLatLngToMap(51.83, -1.85).y, rx: 18, ry: 16 },
    // Dartmoor
    { cx: projectLatLngToMap(50.57, -3.92).x, cy: projectLatLngToMap(50.57, -3.92).y, rx: 18, ry: 15 },
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
    // M1: London -> Milton Keynes -> Leicester -> Sheffield -> Leeds
    lineToPath([
      [51.55, -0.22],
      [52.04, -0.75],
      [52.63, -1.14],
      [52.95, -1.2],
      [53.38, -1.42],
      [53.8, -1.55],
    ]),
    // M6: Birmingham -> Manchester -> Preston -> Carlisle -> M74 Glasgow
    lineToPath([
      [52.49, -1.89],
      [52.81, -2.11],
      [53.38, -2.5],
      [53.48, -2.24],
      [53.76, -2.7],
      [54.89, -2.93],
      [55.86, -4.25],
    ]),
    // M4: London -> Reading -> Bristol -> Cardiff -> Swansea
    lineToPath([
      [51.49, -0.28],
      [51.45, -0.98],
      [51.51, -2.56],
      [51.48, -3.18],
      [51.62, -3.94],
    ]),
    // M5: Birmingham -> Worcester -> Bristol -> Exeter -> Plymouth A38
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
    // A1(M): London -> Peterborough -> York -> Newcastle -> Edinburgh
    lineToPath([
      [51.62, -0.2],
      [52.57, -0.26],
      [53.52, -1.13],
      [53.95, -1.12],
      [54.97, -1.61],
      [55.77, -2.02],
      [55.95, -3.19],
    ]),
    // M62: Liverpool -> Manchester -> Leeds -> Hull
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
    // A9: Edinburgh/Perth -> Inverness
    lineToPath([
      [55.95, -3.2],
      [56.39, -3.43],
      [57.05, -4.05],
      [57.48, -4.22],
    ]),
    // A11/M11: London -> Cambridge -> Norwich
    lineToPath([
      [51.58, 0.02],
      [52.2, 0.12],
      [52.63, 1.3],
    ]),
    // M23/A23 & M3: London -> Brighton & Southampton
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
  ],
  thames: lineToPath([
    [51.72, -1.7],
    [51.55, -0.8],
    [51.5, -0.12],
    [51.49, 0.6],
  ]),
  shields: [
    { label: 'M1', ...projectLatLngToMap(52.5, -1.1) },
    { label: 'M6', ...projectLatLngToMap(53.9, -2.65) },
    { label: 'M4', ...projectLatLngToMap(51.47, -1.6) },
    { label: 'M25', ...projectLatLngToMap(51.67, -0.1) },
    { label: 'A1', ...projectLatLngToMap(54.4, -1.5) },
    { label: 'M8', ...projectLatLngToMap(55.9, -3.75) },
  ],
};
