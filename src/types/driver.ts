export type MainTab = 'home' | 'hub' | 'trips' | 'reserve' | 'earnings' | 'inbox' | 'menu';

export type DriverOnlineStatus = 'offline' | 'online';

export type TripStage =
  | 'idle'
  | 'pickup'
  | 'waiting'
  | 'enroute'
  | 'stop_wait'
  | 'dropoff_arrived'
  | 'completed';

export type OfferType = 'exclusive' | 'radar';

export interface Coordinates {
  x: number; // 0 - 1000 map space
  y: number; // 0 - 1000 map space
}

export type NavManeuverKind =
  | 'turn-left'
  | 'turn-right'
  | 'roundabout'
  | 'merge'
  | 'straight'
  | 'arrive';

export interface RouteStep {
  id: string;
  maneuver: NavManeuverKind;
  instruction: string;
  streetName: string;
  distanceMeters: number;
  speedLimitMph: 20 | 30 | 50 | 70;
  waypointIndex: number;
  lanes?: Array<{
    direction: 'left' | 'straight' | 'right';
    recommended: boolean;
  }>;
}

export interface ComputedRoute {
  polyline: Coordinates[];
  steps: RouteStep[];
  totalDistanceMeters: number;
  totalDurationSec: number;
  source: 'osrm' | 'uk-corridor';
}

export interface ComplianceDoc {
  id: string;
  title: string;
  subtitle: string;
  daysRemaining: number;
  status: 'verified' | 'expiring_soon' | 'expired';
}

export interface DriverAccount {
  id: string;
  name: string;
  email: string;
  password: string;
  tier: 'Diamond' | 'Platinum' | 'Gold';
  proPoints: number;
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
  vehicle: string;
  vehicleColor: string;
  licensePlate: string;
  phvBadge: string;
  city: string;
  lastFaceVerifiedAt: number | null;
  drivingMinutesUsedToday: number;
  batteryPct?: number;
  isEV?: boolean;
  complianceDocs?: ComplianceDoc[];
  restLockedUntil?: number | null;
}

export type UKWeatherCondition = 'Clear' | 'Light Drizzle' | 'Heavy Rain' | 'Thames Fog';

export interface ComplimentCounts {
  greatConversation: number;
  spotlessCar: number;
  expertNavigation: number;
  aboveAndBeyond: number;
}

export interface TripOffer {
  id: string;
  type: OfferType;
  serviceName: string; // e.g. 'UberX', 'Comfort', 'UberXL', 'Intercity'
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
  pinCode?: string;
  surchargeLabel?: string;
  surchargeAmount?: number;
  isIntercity?: boolean;
  intercityCorridor?: string;
  stopAddress?: string;
  stopCoords?: Coordinates;
  riderNote?: string;
  eatsOrderCode?: string;
  boostBonus?: number;
  surgeLockedBonus?: number;
  isAirportPickup?: boolean;
  airportCode?: string;
  airportBayHint?: string;
  anprPassCode?: string;
  inLondonCC?: boolean;
  trafficDelayMin?: number;
  expiresInSec: number;
}

export type ReserveCategory = 'local' | 'airport' | 'executive';

export interface ReserveTrip {
  id: string;
  category: ReserveCategory;
  serviceName: 'Reserve · UberX' | 'Reserve · Comfort' | 'Reserve · Executive' | 'Reserve · UberXL';
  scheduledAtMs: number;
  dayLabel: string; // e.g. 'Today' | 'Tomorrow'
  timeLabel: string; // e.g. '15:30'
  onlineByLabel: string; // e.g. '14:50' (40m before pickup)
  estimatedFare: number;
  reserveFee: number;
  rating: number;
  riderName: string;
  riderTrips: number;
  pickupMinutes: number;
  pickupMiles: number;
  pickupAddress: string;
  pickupArea: string;
  dropoffAddress: string;
  dropoffArea: string;
  tripMiles: number;
  tripMinutes: number;
  pickupCoords: Coordinates;
  dropoffCoords: Coordinates;
  flightNumber?: string;
  waitIncludedMin: number;
  pinCode?: string;
  riderNote?: string;
  status: 'available' | 'scheduled';
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

export interface BusySoonZone {
  id: string;
  area: string;
  city: string;
  minutesUntilBusy: number;
  expectedBoost: string;
  reason: string;
  coords: Coordinates;
}

export type NavProvider = 'uber' | 'google' | 'waze' | 'apple';

export interface CompletedTrip {
  id: string;
  riderName: string;
  serviceName: string;
  fare: number;
  tip: number;
  waitFee?: number;
  surchargeAmount?: number;
  surchargeLabel?: string;
  uberFee?: number;
  netPayout?: number;
  boostBonus?: number;
  tollOrZoneFee?: number;
  cancellationFee?: boolean;
  distanceMiles: number;
  durationMin: number;
  pickupArea: string;
  dropoffArea: string;
  completedAt: string;
  dateKey?: string;
  isIntercity?: boolean;
  isNoShowFee?: boolean;
  tags?: string[];
  claimFiled?: 'valeting' | 'fare_review';
  claimAmount?: number;
  peakPeriod?: boolean;
}

export interface ExpenseEntry {
  id: string;
  label: string;
  category: 'charging' | 'fuel' | 'congestion' | 'toll';
  amount: number;
  kwhOrLitres?: number;
  dateKey: string;
  timestamp: string;
}

export type TripActivityStatus = 'accepted' | 'declined' | 'radar_lost';

export interface TripActivityEntry {
  id: string;
  offerId: string;
  serviceName: string;
  offerType: 'exclusive' | 'radar' | 'reserve' | 'queued';
  status: TripActivityStatus;
  fare: number;
  pickupArea: string;
  dropoffArea: string;
  timestamp: string;
  dateKey: string;
}

export interface TripStats {
  totalReceived: number;
  accepted: number;
  declined: number;
  radarLost: number;
  history: TripActivityEntry[];
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
  lostItemReturn?: {
    tripId: string;
    riderName: string;
    itemLabel: string;
    feeAmount: number;
    returned: boolean;
  };
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
  intercity: boolean;
  autoAccept: boolean;
  stopNewRequests: boolean;
  speedLimitAlerts: boolean;
  shareTripStatus: boolean;
  recordAudio: boolean;
  soundEffects: boolean;
  notificationsEnabled: boolean;
  backgroundAppRefresh: boolean;
  nightMode: boolean;
  voiceNavigation: boolean;
  showTrafficLayer: boolean;
  showUKZones: boolean;
  speedCameraWarnings: boolean;
  showBusySoonZones: boolean;
  navProvider: NavProvider;
  dailyGoalGbp: number;
  weeklyGoalGbp: number;
  rushNav: boolean;
  floatingDotAlertMode: 'dot' | 'card';
  areaPreference?: 'all' | 'central' | 'east' | 'west' | 'local';
}
