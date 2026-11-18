export type MainTab = 'home' | 'hub' | 'earnings' | 'inbox' | 'menu';

export type DriverOnlineStatus = 'offline' | 'online';

export type TripStage =
  | 'idle'
  | 'pickup'
  | 'waiting'
  | 'enroute'
  | 'dropoff_arrived'
  | 'completed';

export type OfferType = 'exclusive' | 'radar';

export interface Coordinates {
  x: number; // 0 - 1000 map space
  y: number; // 0 - 1000 map space
}

export interface TripOffer {
  id: string;
  type: OfferType;
  serviceName: string; // e.g. 'UberX', 'Comfort', 'UberXL'
  fare: number;
  rating: number;
  riderName: string;
  riderTrips: number;
  pickupMinutes: number;
  pickupMiles: number;
  pickupAddress: string;
  pickupArea: string;
  tripMinutes: number;
  tripMiles: number;
  dropoffAddress: string;
  dropoffArea: string;
  pickupCoords: Coordinates;
  dropoffCoords: Coordinates;
  surgeBonus?: number;
  expiresInSec: number;
}

export type MapReportCategory =
  | 'traffic'
  | 'crash'
  | 'roadwork'
  | 'road_closed'
  | 'police'
  | 'lane_closure';

export interface MapReportPin {
  id: string;
  category: MapReportCategory;
  label: string;
  coords: Coordinates;
  reportedAt: string;
}

export interface SurgeZone {
  id: string;
  label: string;
  kind: 'surge' | 'wait' | 'busy' | 'event';
  coords: Coordinates;
  intensity: 'high' | 'medium' | 'low';
  radius: number;
}

export interface CompletedTrip {
  id: string;
  riderName: string;
  serviceName: string;
  fare: number;
  tip: number;
  distanceMiles: number;
  durationMin: number;
  pickupArea: string;
  dropoffArea: string;
  completedAt: string;
  dateKey?: string;
}

export interface InboxMessage {
  id: string;
  sender: 'agent' | 'driver';
  text: string;
  timestamp: string;
}

export interface InboxThread {
  id: string;
  tab: 'notifications' | 'support';
  title: string;
  preview: string;
  timeAgo: string;
  statusText?: string;
  unread: boolean;
  iconType: 'chat' | 'mail' | 'doc' | 'promo';
  messages: InboxMessage[];
}

export interface DestinationConfig {
  active: boolean;
  destinationName: string;
  destinationAddress: string;
  routeType: 'flexible' | 'faster';
  arriveBy: string;
  coords: Coordinates;
}

export interface DriverPreferences {
  uberX: boolean;
  uberXL: boolean;
  comfort: boolean;
  uberPet: boolean;
  deliveries: boolean;
  autoAccept: boolean;
  stopNewRequests: boolean;
  speedLimitAlerts: boolean;
  shareTripStatus: boolean;
  recordAudio: boolean;
  soundEffects: boolean;
  notificationsEnabled: boolean;
  backgroundAppRefresh: boolean;
}
