import {
  CompletedTrip,
  DestinationConfig,
  DriverPreferences,
  InboxThread,
  SurgeZone,
  TripOffer,
} from '../types/driver';
import { projectLatLngToMap } from '../utils/ukGeo';

export const INITIAL_DRIVER_PROFILE = {
  name: 'Alex Rivera',
  tier: 'Diamond',
  proPoints: 613,
  rating: 4.98,
  acceptanceRate: 96,
  cancellationRate: 2,
  vehicle: '2024 Toyota Camry Hybrid',
  vehicleColor: 'Midnight Black',
  licensePlate: 'LB24 UBR',
  city: 'London',
  nearLabel: 'Near Oxford St · Central London',
};

export const INITIAL_SURGE_ZONES: SurgeZone[] = [
  {
    id: 'sz-1',
    label: '1-4 min',
    kind: 'wait',
    coords: projectLatLngToMap(52.4862, -1.8904), // Birmingham
    intensity: 'high',
    radius: 65,
  },
  {
    id: 'sz-2',
    label: '+£12',
    kind: 'surge',
    coords: projectLatLngToMap(51.5074, -0.1278), // Central London
    intensity: 'high',
    radius: 75,
  },
  {
    id: 'sz-3',
    label: '+£4.50',
    kind: 'surge',
    coords: projectLatLngToMap(53.4808, -2.2426), // Manchester
    intensity: 'medium',
    radius: 68,
  },
  {
    id: 'sz-4',
    label: '1-25 min',
    kind: 'wait',
    coords: projectLatLngToMap(51.4545, -2.5879), // Bristol
    intensity: 'low',
    radius: 55,
  },
  {
    id: 'sz-5',
    label: '+£3',
    kind: 'surge',
    coords: projectLatLngToMap(55.9533, -3.1883), // Edinburgh
    intensity: 'high',
    radius: 60,
  },
  {
    id: 'sz-6',
    label: '£££',
    kind: 'busy',
    coords: projectLatLngToMap(53.8008, -1.5491), // Leeds
    intensity: 'low',
    radius: 50,
  },
  {
    id: 'sz-7',
    label: 'Event',
    kind: 'event',
    coords: projectLatLngToMap(55.8642, -4.2518), // Glasgow
    intensity: 'low',
    radius: 52,
  },
];

export const SAMPLE_TRIP_OFFERS: TripOffer[] = [
  {
    id: 'offer-josefina',
    type: 'exclusive',
    serviceName: 'UberX',
    fare: 12.15,
    rating: 4.95,
    riderName: 'Joséfina',
    riderTrips: 312,
    pickupMinutes: 2,
    pickupMiles: 1.1,
    pickupAddress: '215 Oxford St',
    pickupArea: 'Soho, London',
    tripMinutes: 7,
    tripMiles: 1.8,
    dropoffAddress: '84 Victoria St',
    dropoffArea: 'Westminster, London',
    pickupCoords: projectLatLngToMap(51.515, -0.141),
    dropoffCoords: projectLatLngToMap(51.497, -0.135),
    surgeBonus: 2.25,
    expiresInSec: 15,
  },
  {
    id: 'offer-radar-1',
    type: 'radar',
    serviceName: 'UberX',
    fare: 29.31,
    rating: 4.99,
    riderName: 'Marcus T.',
    riderTrips: 540,
    pickupMinutes: 4,
    pickupMiles: 0.4,
    pickupAddress: '12 Regent St',
    pickupArea: 'Piccadilly, London',
    tripMinutes: 32,
    tripMiles: 16.3,
    dropoffAddress: 'Heathrow Terminal 5 Departures',
    dropoffArea: 'London Heathrow Airport',
    pickupCoords: projectLatLngToMap(51.509, -0.134),
    dropoffCoords: projectLatLngToMap(51.47, -0.454),
    expiresInSec: 18,
  },
  {
    id: 'offer-exclusive-2',
    type: 'exclusive',
    serviceName: 'Comfort',
    fare: 18.8,
    rating: 4.92,
    riderName: 'Elena K.',
    riderTrips: 128,
    pickupMinutes: 3,
    pickupMiles: 0.9,
    pickupAddress: 'Piccadilly Station',
    pickupArea: 'Manchester City Centre',
    tripMinutes: 18,
    tripMiles: 9.2,
    dropoffAddress: 'Manchester Airport T2',
    dropoffArea: 'Ringway, Manchester',
    pickupCoords: projectLatLngToMap(53.477, -2.23),
    dropoffCoords: projectLatLngToMap(53.358, -2.273),
    surgeBonus: 3.0,
    expiresInSec: 15,
  },
  {
    id: 'offer-radar-2',
    type: 'radar',
    serviceName: 'UberXL',
    fare: 36.45,
    rating: 4.97,
    riderName: 'David & Priya',
    riderTrips: 215,
    pickupMinutes: 4,
    pickupMiles: 1.1,
    pickupAddress: 'Liverpool St Station',
    pickupArea: 'City of London',
    tripMinutes: 28,
    tripMiles: 14.4,
    dropoffAddress: 'Gatwick North Terminal',
    dropoffArea: 'West Sussex, RH6',
    pickupCoords: projectLatLngToMap(51.517, -0.082),
    dropoffCoords: projectLatLngToMap(51.153, -0.182),
    expiresInSec: 18,
  },
  {
    id: 'offer-radar-3',
    type: 'radar',
    serviceName: 'UberX',
    fare: 15.6,
    rating: 4.94,
    riderName: 'Oliver B.',
    riderTrips: 189,
    pickupMinutes: 3,
    pickupMiles: 0.6,
    pickupAddress: 'New Street Station',
    pickupArea: 'Birmingham Central',
    tripMinutes: 14,
    tripMiles: 4.1,
    dropoffAddress: 'Bullring & Grand Central',
    dropoffArea: 'Solihull / Edgbaston',
    pickupCoords: projectLatLngToMap(52.477, -1.899),
    dropoffCoords: projectLatLngToMap(52.412, -1.778),
    expiresInSec: 18,
  },
  {
    id: 'offer-radar-4',
    type: 'radar',
    serviceName: 'Comfort',
    fare: 22.9,
    rating: 4.96,
    riderName: 'Amelia W.',
    riderTrips: 402,
    pickupMinutes: 5,
    pickupMiles: 1.2,
    pickupAddress: 'Waverley Bridge',
    pickupArea: 'Edinburgh Old Town',
    tripMinutes: 21,
    tripMiles: 7.6,
    dropoffAddress: 'Edinburgh Airport Plaza',
    dropoffArea: 'Ingliston, Edinburgh',
    pickupCoords: projectLatLngToMap(55.952, -3.19),
    dropoffCoords: projectLatLngToMap(55.95, -3.372),
    expiresInSec: 18,
  },
];

export const INITIAL_COMPLETED_TRIPS: CompletedTrip[] = [];

export const HOURLY_TRENDS = [
  { hour: '6a', demand: 65, label: '£28/hr' },
  { hour: '8a', demand: 92, label: '£42/hr' },
  { hour: '10a', demand: 58, label: '£24/hr' },
  { hour: '12p', demand: 74, label: '£31/hr' },
  { hour: '2p', demand: 62, label: '£26/hr' },
  { hour: '4p', demand: 88, label: '£39/hr' },
  { hour: '6p', demand: 98, label: '£48/hr' },
  { hour: '8p', demand: 82, label: '£36/hr' },
];

export const INITIAL_INBOX_THREADS: InboxThread[] = [
  {
    id: 'thread-1',
    tab: 'support',
    title: 'Driver fare review',
    preview: 'Agent: one of the co-riders was...',
    timeAgo: '2 min ago',
    statusText: 'Awaiting response',
    unread: true,
    iconType: 'chat',
    messages: [
      {
        id: 'm1',
        sender: 'driver',
        text: 'Hi, the route had a Thames bridge diversion and took 11 extra minutes during peak traffic.',
        timestamp: '10:02',
      },
      {
        id: 'm2',
        sender: 'agent',
        text: 'Agent: one of the co-riders was added mid-trip and our team is verifying the GPS detour mileage. Can you confirm if the second stop was requested in-app?',
        timestamp: '10:06',
      },
    ],
  },
  {
    id: 'thread-2',
    tab: 'support',
    title: 'Cancellation fee not received',
    preview: 'You: I haven’t received the corr...',
    timeAgo: '18 min ago',
    unread: false,
    iconType: 'mail',
    messages: [
      {
        id: 'm3',
        sender: 'driver',
        text: 'You: I haven’t received the corresponding cancellation fee after waiting 6 minutes at Paddington Station.',
        timestamp: '09:48',
      },
      {
        id: 'm4',
        sender: 'agent',
        text: 'Thanks for flagging this. We checked the pickup timer logs and issued a £4.15 wait-time adjustment to your Wallet.',
        timestamp: '09:54',
      },
    ],
  },
  {
    id: 'thread-3',
    tab: 'notifications',
    title: 'Weekend Quest unlocked: +£190',
    preview: 'Complete 20 trips before Monday 04:00 to earn an extra £190.',
    timeAgo: '1 hr ago',
    unread: true,
    iconType: 'promo',
    messages: [
      {
        id: 'm5',
        sender: 'agent',
        text: 'Your Weekend Quest is active! You have completed 16 of 20 trips. Drive 4 more trips before Monday 04:00 to automatically receive your £190 bonus.',
        timestamp: '09:00',
      },
    ],
  },
  {
    id: 'thread-4',
    tab: 'notifications',
    title: 'TfL PHV inspection verified',
    preview: 'Your 2024 Toyota Camry Hybrid PHV licence is approved through Nov 2027.',
    timeAgo: 'Yesterday',
    unread: true,
    iconType: 'doc',
    messages: [
      {
        id: 'm6',
        sender: 'agent',
        text: 'Great news — your annual TfL Private Hire vehicle inspection certificate has been approved and added to your Driver Manager.',
        timestamp: 'Yesterday, 16:15',
      },
    ],
  },
];

export const PRESET_DESTINATIONS: Array<{
  name: string;
  address: string;
  flexibleTime: string;
  fasterTime: string;
  coords: { x: number; y: number };
}> = [
  {
    name: 'London · Central / Heathrow T5',
    address: 'Heathrow AVP Rideshare Park, TW6',
    flexibleTime: 'Arrive by 11:20',
    fasterTime: 'Arrive by 11:05',
    coords: projectLatLngToMap(51.47, -0.454),
  },
  {
    name: 'Manchester Piccadilly / Airport',
    address: 'Piccadilly Station Approach, M1 2PB',
    flexibleTime: 'Arrive by 13:45',
    fasterTime: 'Arrive by 13:15',
    coords: projectLatLngToMap(53.4808, -2.2426),
  },
  {
    name: 'Birmingham New Street',
    address: 'Navigation St, Birmingham B2 4QA',
    flexibleTime: 'Arrive by 12:30',
    fasterTime: 'Arrive by 12:10',
    coords: projectLatLngToMap(52.4862, -1.8904),
  },
  {
    name: 'Edinburgh Waverley',
    address: 'Waverley Bridge, Edinburgh EH1 1BQ',
    flexibleTime: 'Arrive by 16:40',
    fasterTime: 'Arrive by 16:05',
    coords: projectLatLngToMap(55.9533, -3.1883),
  },
];

export const INITIAL_PREFERENCES: DriverPreferences = {
  uberX: true,
  uberXL: false,
  comfort: true,
  uberPet: false,
  deliveries: false,
  autoAccept: false,
  stopNewRequests: false,
  speedLimitAlerts: true,
  shareTripStatus: false,
  recordAudio: false,
  soundEffects: true,
  notificationsEnabled: true,
  backgroundAppRefresh: true,
};

export const DEFAULT_DESTINATION: DestinationConfig = {
  active: false,
  destinationName: 'London · Heathrow T5',
  destinationAddress: 'Heathrow AVP Rideshare Park, TW6',
  routeType: 'flexible',
  arriveBy: 'Arrive by 11:20',
  coords: projectLatLngToMap(51.47, -0.454),
};

export const OPPORTUNITIES_LIST = [
  {
    id: 'opp-1',
    type: 'Quest',
    title: 'Weekend Quest: +£190 extra',
    subtitle: '16 of 20 trips completed · Ends Mon 04:00',
    badge: '4 trips left',
    highlight: true,
  },
  {
    id: 'opp-2',
    type: 'Boost+',
    title: '+£4.50 per trip in Central London',
    subtitle: 'Today · 17:00 – 20:00',
    badge: 'Enrolled',
    highlight: false,
  },
  {
    id: 'opp-3',
    type: 'Reservation',
    title: 'Airport Reservation · Comfort',
    subtitle: 'Tomorrow 04:30 · Soho to Heathrow T5',
    badge: '£54.20 est.',
    highlight: false,
  },
];
