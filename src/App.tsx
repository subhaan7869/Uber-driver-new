import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BarChart2,
  Bell,
  Camera,
  CheckCircle2,
  ChevronUp,
  Coffee,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  Diamond,
  Eye,
  EyeOff,
  Flame,
  GitMerge,
  LayoutGrid,
  List,
  LocateFixed,
  MapPin,
  MessageSquarePlus,
  Mic,
  Moon,
  MoreHorizontal,
  Plane,
  Radar,
  RefreshCw,
  Route,
  Search,
  Shield,
  SlidersHorizontal,
  Sun,
  Timer,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AccountModal } from './components/AccountModal';
import { ActiveTripSheet } from './components/ActiveTripSheet';
import { BootScreen } from './components/BootScreen';
import { BottomNav } from './components/BottomNav';
import { DestinationModeModal } from './components/DestinationModeModal';
import { DynamicIsland } from './components/DynamicIsland';
import { EarningsView } from './components/EarningsView';
import { FaceVerificationModal } from './components/FaceVerificationModal';
import { HomeMenuView } from './components/HomeMenuView';
import { InboxView } from './components/InboxView';
import { MapReportModal } from './components/MapReportModal';
import { MenuView } from './components/MenuView';
import { OfflineIndicator } from './components/OfflineIndicator';
import { OpportunitiesModal } from './components/OpportunitiesModal';
import { PermissionsModal } from './components/PermissionsModal';
import { PreferencesSheet } from './components/PreferencesSheet';
import { PWAInstallButton } from './components/PWAInstallButton';
import { RapidChargersModal } from './components/RapidChargersModal';
import { ReserveView } from './components/ReserveView';
import { SafetyToolkitModal } from './components/SafetyToolkitModal';
import { TripOfferModal } from './components/TripOfferModal';
import { TripsMenuView } from './components/TripsMenuView';
import { UberMap } from './components/UberMap';
import { useFirebase } from './contexts/FirebaseContext';
import {
  BUSY_SOON_ZONES,
  DEFAULT_DESTINATION,
  INITIAL_INBOX_THREADS,
  INITIAL_PREFERENCES,
  INITIAL_SURGE_ZONES,
} from './data/mockDriverData';
import { useBackgroundRefresh } from './hooks/useBackgroundRefresh';
import {
  ensureUserProfile,
  subscribeDriverCloudData,
  syncCompletedTrip,
  syncDriverLedgerState,
  syncDriverPreferencesState,
  syncReserveBooking,
  syncTripActivity,
  syncUserProfileMetrics,
} from './services/firestoreSync';
import {
  BusySoonZone,
  CompletedTrip,
  ComputedRoute,
  Coordinates,
  DestinationConfig,
  DriverAccount,
  DriverCostSettings,
  DriverOnlineStatus,
  DriverPreferences,
  ExpenseEntry,
  InboxThread,
  InsurancePolicyInfo,
  MainTab,
  MapReportCategory,
  MapReportPin,
  NavManeuverKind,
  NavProvider,
  PayoutRecord,
  ReserveTrip,
  SurgeZone,
  TripActivityEntry,
  TripActivityStatus,
  TripFilterRules,
  TripOffer,
  TripStage,
  UKWeatherCondition,
} from './types/driver';
import {
  buildDefaultComplianceDocs,
  buildDefaultInsurancePolicy,
  exportAccountBackupCode,
  getActiveAccountId,
  importAccountBackupCode,
  isExplicitlySignedOut,
  loadAccounts,
  loadRememberedLogin,
  RememberedLogin,
  saveAccounts,
  saveRememberedLogin,
  setActiveAccountId,
  storeBrowserCredential,
} from './utils/authStorage';
import {
  DEFAULT_COMPLIMENTS,
  DriverLedger,
  EMPTY_TRIP_STATS,
  getLocalDateKey,
  getWeeklyTotalFromLedger,
  loadDriverLedger,
  saveDriverLedger,
} from './utils/earningsStorage';
import {
  getNotificationPermission,
  NotificationPermissionState,
  requestNotificationPermission,
  sendDriverNotification,
} from './utils/notifications';
import { APP_UPDATE_EVENT } from './utils/autoUpdater';
import {
  cancelNativeScheduledOffer,
  clearOfferFromNativeBubble,
  consumePendingNativeLaunchOffer,
  getNativeBubblePermissions,
  isNativeAndroidApk,
  listenToNativeBubbleTap,
  listenToNativePermissionsChanged,
  NativeBubbleActionResult,
  NativeBubblePermissions,
  previewNativeFloatingBubble,
  previewNativeFloatingOfferCard,
  pushOfferToNativeBubble,
  requestAndroidBatteryOptimization,
  requestAndroidNotificationPermission,
  requestAndroidOverlayPermission,
  requestPinAndroidWidget,
  scheduleNativeBackgroundOffer,
  setNativeBubbleAlertMode,
  setNativeImmersiveNavHidden,
  startNativeOnlineBubbleService,
  stopNativeOnlineBubbleService,
  syncAndroidAutoState,
  syncAndroidWidgetState,
  syncNativeAppForeground,
} from './native/floatingDot';
import { triggerHaptic, uberSounds } from './utils/uberSounds';
import {
  driverVoiceController,
  isSpeechRecognitionSupported,
  VoiceDriverCommand,
} from './utils/voiceCommands';
import {
  clampMapCoords,
  isWithinUKBounds,
  mapToLatLng,
  nearestUKCity,
  projectLatLngToMap,
  UK_SPEED_CAMERAS,
} from './utils/ukGeo';
import {
  buildLocalOfferPool,
  generateLocalReserveTrips,
  generateLocalTripOffer,
  getResolvedLocalCityName,
  haversineMiles,
  prefetchLocalPlaces,
  ServicePrefsInput,
} from './utils/localDispatch';
import {
  computeUberProTier,
  detectUKZoneSurcharge,
  getNearbyAirportQueuePin,
  getStickySurgeAtCoords,
  getUKDemandContext,
} from './utils/ukRealism';
import {
  buildFallbackUKRoute,
  fetchUKRoute,
  speakNavInstruction,
} from './utils/ukRouting';
import { carBluetoothMedia } from './utils/carBluetoothMedia';
import {
  clearLaunchShortcutParam,
  parseLaunchShortcutAction,
  shareCompletedTripReceipt,
  shareLiveTripStatus,
  shareOrDownloadHMRCTaxCsv,
  ShortcutLaunchAction,
  subscribeToWebPush,
  updateAppIconBadge,
} from './utils/iosPwa';
import {
  enqueueOfflineMutation,
  OfflineMutationInput,
  useOfflineQueue,
} from './utils/offlineQueue';
import { formatOnlineTimer } from './utils/timeFormat';

function matchesTripFilter(offer: TripOffer, rules?: TripFilterRules): boolean {
  if (!rules || !rules.enabled) return true;
  const totalMiles = Math.max(0.5, offer.pickupMiles + offer.tripMiles);
  const perMile = offer.fare / totalMiles;
  if (offer.fare < rules.minFareGbp) return false;
  if (perMile < rules.minPerMileGbp) return false;
  if (offer.pickupMiles > rules.maxPickupMiles) return false;
  if (offer.rating < rules.minRiderRating) return false;
  return true;
}

function lerpAngle(fromDeg: number, toDeg: number, t: number): number {
  const diff = ((((toDeg - fromDeg) % 360) + 540) % 360) - 180;
  return fromDeg + diff * t;
}

function getCityStartCoords(city: string): Coordinates {
  const c = city.toLowerCase();
  if (c.includes('manchester')) return projectLatLngToMap(53.4808, -2.2426);
  if (c.includes('birmingham')) return projectLatLngToMap(52.4862, -1.8904);
  if (c.includes('edinburgh')) return projectLatLngToMap(55.9533, -3.1883);
  if (c.includes('glasgow')) return projectLatLngToMap(55.8642, -4.2518);
  return projectLatLngToMap(51.5074, -0.1278);
}

function isFaceVerifiedRecently(account: DriverAccount | null): boolean {
  if (!account || account.lastFaceVerifiedAt === null) return false;
  return Date.now() - account.lastFaceVerifiedAt < 12 * 60 * 60 * 1000;
}

export default function App() {
  // Multi-driver User Accounts state
  const [accounts, setAccounts] = useState<DriverAccount[]>(() => loadAccounts());
  const [rememberedLogin, setRememberedLogin] = useState<RememberedLogin | null>(() =>
    loadRememberedLogin()
  );
  const [isSignedOut, setIsSignedOut] = useState<boolean>(() => isExplicitlySignedOut());
  const [activeAccountIdState, setActiveAccountIdState] = useState<string>(() => {
    const savedId = getActiveAccountId();
    const list = loadAccounts();
    if (savedId && list.some((a) => a.id === savedId)) return savedId;
    const remembered = loadRememberedLogin();
    if (remembered?.rememberMe && list.some((a) => a.id === remembered.accountId)) {
      return remembered.accountId;
    }
    return list[0].id;
  });

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountIdState) ?? accounts[0] ?? null,
    [accounts, activeAccountIdState]
  );

  useEffect(() => {
    saveAccounts(accounts);
  }, [accounts]);

  const SESSION_STORAGE_KEY = 'uber_driver_session_v6';
  const savedSession = useMemo(() => {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Boot-up screen & primary navigation / online status
  const [showBootScreen, setShowBootScreen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [onlineStatus, setOnlineStatus] = useState<DriverOnlineStatus>(
    () => savedSession?.onlineStatus ?? 'offline'
  );
  const [onlineStartedAt, setOnlineStartedAt] = useState<number | null>(() => {
    const status = savedSession?.onlineStatus ?? 'offline';
    if (status !== 'online') return null;
    return typeof savedSession?.onlineStartedAt === 'number'
      ? savedSession.onlineStartedAt
      : Date.now();
  });
  const [onlineElapsedSec, setOnlineElapsedSec] = useState<number>(() => {
    const status = savedSession?.onlineStatus ?? 'offline';
    if (status !== 'online') return 0;
    const started =
      typeof savedSession?.onlineStartedAt === 'number'
        ? savedSession.onlineStartedAt
        : Date.now();
    return Math.max(0, Math.floor((Date.now() - started) / 1000));
  });
  const [tripStage, setTripStage] = useState<TripStage>(
    () => savedSession?.tripStage ?? 'idle'
  );


  // Map & Driver GPS state (defaults to active account's UK city)
  const [driverPos, setDriverPos] = useState<Coordinates>(() =>
    savedSession?.driverPos ?? getCityStartCoords(activeAccount?.city ?? 'London')
  );
  const [driverHeading, setDriverHeading] = useState<number>(0);
  const [liveSpeedMph, setLiveSpeedMph] = useState<number | null>(null);
  const [recenterSignal, setRecenterSignal] = useState<number>(0);
  const [mapReports, setMapReports] = useState<MapReportPin[]>([]);
  const [destination, setDestination] = useState<DestinationConfig>(DEFAULT_DESTINATION);

  // Top status pill cycler (0 = Uber Pro ◆, 1 = Today's Earnings £, 2 = Quest)
  const [topPillMode, setTopPillMode] = useState<0 | 1 | 2>(1);

  // Privacy toggle for Total Earned (persisted)
  const [privacyHidden, setPrivacyHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('uber_driver_privacy_v1') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('uber_driver_privacy_v1', String(privacyHidden));
    } catch {
      // Ignore storage error
    }
  }, [privacyHidden]);

  // Offers, Trip Radar, and Working Turn-by-Turn UK Route state
  const [offerIndex, setOfferIndex] = useState<number>(() => Math.floor(Math.random() * 15));
  const [pendingOffer, setPendingOffer] = useState<TripOffer | null>(null);
  const [activeTrip, setActiveTrip] = useState<TripOffer | null>(
    () => savedSession?.activeTrip ?? null
  );
  const [activeRoute, setActiveRoute] = useState<ComputedRoute | null>(null);
  const [offerTripRoute, setOfferTripRoute] = useState<ComputedRoute | null>(null);
  const [routeWpIdx, setRouteWpIdx] = useState<number>(0);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [tripWaitFee, setTripWaitFee] = useState<number>(0);
  const [stopVisited, setStopVisited] = useState<boolean>(false);
  const [queuedOffer, setQueuedOffer] = useState<TripOffer | null>(
    () => savedSession?.queuedOffer ?? null
  );
  const [acceptedNextOffer, setAcceptedNextOffer] = useState<TripOffer | null>(null);
  const [intercityIdx, setIntercityIdx] = useState<number>(0);
  const [showMapLayersPopover, setShowMapLayersPopover] = useState<boolean>(false);
  const [showRadarList, setShowRadarList] = useState<boolean>(false);
  const [radarMatchingId, setRadarMatchingId] = useState<string | null>(null);
  const [showStopMenu, setShowStopMenu] = useState<boolean>(false);
  const [statusSwapOnline, setStatusSwapOnline] = useState<boolean>(false);
  const [radarBatchIdx, setRadarBatchIdx] = useState<number>(0);
  const [radarOffers, setRadarOffers] = useState<TripOffer[]>([]);
  const [radarRefreshSecLeft, setRadarRefreshSecLeft] = useState<number>(60);
  const [nextOfferSecLeft, setNextOfferSecLeft] = useState<number | null>(null);

  const [legStartDistPx, setLegStartDistPx] = useState<number>(150);
  const [navProgress, setNavProgress] = useState<number>(() =>
    typeof savedSession?.navProgress === 'number' ? savedSession.navProgress : 0
  );
  const [simSpeedMph, setSimSpeedMph] = useState<number>(0);
  const [navNowMs, setNavNowMs] = useState<number>(() => Date.now());

  const anchoredToLastJobRef = useRef<boolean>(Boolean(savedSession?.anchoredToLastJob));

  useEffect(() => {
    try {
      const payload = {
        onlineStatus,
        onlineStartedAt,
        tripStage,
        activeTrip,
        driverPos,
        navProgress,
        queuedOffer,
        anchoredToLastJob: anchoredToLastJobRef.current,
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [onlineStatus, onlineStartedAt, tripStage, activeTrip, driverPos, navProgress, queuedOffer]);

  // Live second-by-second online timer (stays accurate across backgrounding & reloads)
  useEffect(() => {
    if (onlineStatus !== 'online') {
      setOnlineElapsedSec(0);
      return;
    }
    const startTs = onlineStartedAt ?? Date.now();
    if (onlineStartedAt === null) {
      setOnlineStartedAt(startTs);
    }
    const syncElapsed = () => {
      setOnlineElapsedSec(Math.max(0, Math.floor((Date.now() - startTs) / 1000)));
    };
    syncElapsed();
    const id = window.setInterval(syncElapsed, 1000);
    window.addEventListener('focus', syncElapsed);
    document.addEventListener('visibilitychange', syncElapsed);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', syncElapsed);
      document.removeEventListener('visibilitychange', syncElapsed);
    };
  }, [onlineStatus, onlineStartedAt]);
  const [gpsPermissionState, setGpsPermissionState] = useState<'idle' | 'active' | 'denied'>('idle');
  const [gpsExplicitlyAccepted, setGpsExplicitlyAccepted] = useState<boolean>(() => {
    try {
      return localStorage.getItem('uber_driver_gps_accepted_v1') !== 'false';
    } catch {
      return true;
    }
  });
  const [realCoords, setRealCoords] = useState<{ lat: number; lng: number } | null>(null);
  const realCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  realCoordsRef.current = realCoords;
  const [localGeoVersion, setLocalGeoVersion] = useState<number>(0);

  const getActiveGpsLatLng = useCallback((): { lat: number; lng: number } | undefined => {
    if (anchoredToLastJobRef.current) {
      return mapToLatLng(driverPosRef.current);
    }
    const rc = realCoordsRef.current;
    if (rc && isWithinUKBounds(rc.lat, rc.lng)) {
      return rc;
    }
    return undefined;
  }, []);

  // Keep Photon street/destination cache synchronized to whichever UK job area the driver is currently positioned in
  useEffect(() => {
    if (tripStage !== 'idle') return;
    const ll = mapToLatLng(driverPos);
    void prefetchLocalPlaces(ll.lat, ll.lng).then((town) => {
      if (town) setLocalGeoVersion((v) => v + 1);
    });
  }, [driverPos, tripStage]);

  const [reserveSeed, setReserveSeed] = useState<number>(0);
  const [scheduledReserves, setScheduledReserves] = useState<ReserveTrip[]>(() => {
    try {
      const raw = localStorage.getItem('uber_driver_reserves_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });
  const [acceptedReserveIds, setAcceptedReserveIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem('uber_driver_reserves_v1', JSON.stringify(scheduledReserves));
    } catch {
      // Ignore storage error
    }
  }, [scheduledReserves]);

  useEffect(() => {
    try {
      localStorage.setItem('uber_driver_gps_accepted_v1', String(gpsExplicitlyAccepted));
    } catch {
      // Ignore storage error
    }
  }, [gpsExplicitlyAccepted]);

  // Per-account Daily Ledger (saves until local midnight & persists history per day)
  const [todayDateKey, setTodayDateKey] = useState<string>(() => getLocalDateKey());
  const [ledger, setLedger] = useState<DriverLedger>(() =>
    loadDriverLedger(
      {
        proPoints: activeAccount?.proPoints ?? 613,
        walletBalance: 1000.0,
        questCompletedCount: 16,
      },
      activeAccount?.id
    )
  );

  const {
    user: googleUser,
    authReady,
    setSyncStatus,
    setLastCloudSyncAt,
  } = useFirebase();

  const runCloudSync = useCallback(
    async (task: () => Promise<void>) => {
      if (!googleUser?.emailVerified) return;
      setSyncStatus('syncing');
      try {
        await task();
        setSyncStatus('synced');
        setLastCloudSyncAt(Date.now());
      } catch {
        setSyncStatus('error');
      }
    },
    [googleUser?.emailVerified, setSyncStatus, setLastCloudSyncAt]
  );

  const {
    pendingCount: offlinePendingCount,
    isFlushing: isOfflineFlushing,
    flushNow: flushOfflineQueueNow,
  } = useOfflineQueue(googleUser?.uid, googleUser?.emailVerified);

  const syncWithOfflineQueue = useCallback(
    async (mutation: OfflineMutationInput, onlineTask: () => Promise<void>) => {
      if (!googleUser?.emailVerified) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        await enqueueOfflineMutation(mutation);
        return;
      }
      setSyncStatus('syncing');
      try {
        await onlineTask();
        setSyncStatus('synced');
        setLastCloudSyncAt(Date.now());
      } catch {
        await enqueueOfflineMutation(mutation);
        setSyncStatus('error');
      }
    },
    [googleUser?.emailVerified, setSyncStatus, setLastCloudSyncAt]
  );

  // Realism features state (Enrolled Opportunities, Sticky Surge, Airport Queue, Traffic/Rider Changes, Chargers)
  const [enrolledOppIds, setEnrolledOppIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('uber_driver_enrolled_opps_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Ignore storage error
    }
    return ['opp-1', 'opp-2'];
  });
  useEffect(() => {
    try {
      localStorage.setItem('uber_driver_enrolled_opps_v1', JSON.stringify(enrolledOppIds));
    } catch {
      // Ignore storage error
    }
  }, [enrolledOppIds]);

  const activeBoostBonus = enrolledOppIds.includes('opp-2') ? 4.5 : 0;

  const [lockedSurgeBonus, setLockedSurgeBonus] = useState<number>(0);
  const [lockedSurgeLabel, setLockedSurgeLabel] = useState<string | null>(null);
  const [airportQueue, setAirportQueue] = useState<{
    code: string;
    name: string;
    position: number;
  } | null>(null);
  const [demandNow, setDemandNow] = useState<Date>(() => new Date());
  const WEATHER_CYCLE: UKWeatherCondition[] = ['Clear', 'Light Drizzle', 'Heavy Rain', 'Thames Fog'];
  const [weatherCondition, setWeatherCondition] = useState<UKWeatherCondition>('Clear');
  const [streakCount, setStreakCount] = useState<number>(0);

  useEffect(() => {
    const id = window.setInterval(() => setDemandNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setWeatherCondition((prev) => {
        const idx = WEATHER_CYCLE.indexOf(prev);
        return WEATHER_CYCLE[(idx + 1) % WEATHER_CYCLE.length];
      });
    }, 240000);
    return () => window.clearInterval(id);
  }, []);

  const demandContext = useMemo(
    () => getUKDemandContext(demandNow, weatherCondition),
    [demandNow, weatherCondition]
  );

  const [trafficAlert, setTrafficAlert] = useState<{
    delayMin: number;
    routeSavedMin: number;
  } | null>(null);
  const [riderChangeOffer, setRiderChangeOffer] = useState<{
    kind: 'dropoff' | 'stop';
    title: string;
    subtitle: string;
    extraFare: number;
    extraMiles: number;
    extraMin: number;
    nextCoords: Coordinates;
    nextAddress: string;
  } | null>(null);
  const [stackedEatsOffer, setStackedEatsOffer] = useState<{
    restaurantName: string;
    orderCode: string;
    extraFare: number;
    extraMiles: number;
    extraMin: number;
    stopCoords: Coordinates;
    stopAddress: string;
  } | null>(null);
  const [isOnBreak, setIsOnBreak] = useState<boolean>(false);
  const [breakSecondsLeft, setBreakSecondsLeft] = useState<number>(0);
  const delayedTipTimersRef = useRef<number[]>([]);
  const [showChargersModal, setShowChargersModal] = useState<boolean>(false);
  const [isTripSheetExpanded, setIsTripSheetExpanded] = useState<boolean>(false);
  const [showMapToolsMenu, setShowMapToolsMenu] = useState<boolean>(false);

  useEffect(() => {
    if (tripStage === 'idle') {
      setIsTripSheetExpanded(false);
    }
    setShowMapToolsMenu(false);
  }, [tripStage]);

  const prevAccountIdRef = useRef<string | undefined>(activeAccount?.id);
  const recordedReceivedIdsRef = useRef<Set<string>>(new Set());
  const resolvedOfferIdsRef = useRef<Set<string>>(new Set());
  const [tripsReturnTab, setTripsReturnTab] = useState<'hub' | 'menu'>('menu');

  useEffect(() => {
    const acctId = activeAccount?.id;
    if (!acctId || prevAccountIdRef.current === acctId) return;
    prevAccountIdRef.current = acctId;
    recordedReceivedIdsRef.current.clear();
    resolvedOfferIdsRef.current.clear();
    setLedger(
      loadDriverLedger(
        {
          proPoints: activeAccount.proPoints,
          walletBalance: activeAccount.id === 'acct-alex' ? 1000.0 : 420.0,
          questCompletedCount: activeAccount.id === 'acct-alex' ? 16 : 9,
        },
        acctId
      )
    );
  }, [activeAccount]);

  useEffect(() => {
    if (!activeAccount?.id) return;
    saveDriverLedger(ledger, activeAccount.id);
  }, [ledger, activeAccount?.id]);

  const recordOfferReceived = useCallback((offer: TripOffer) => {
    if (recordedReceivedIdsRef.current.has(offer.id)) return;
    recordedReceivedIdsRef.current.add(offer.id);
    setLedger((prev) => ({
      ...prev,
      tripStats: {
        ...prev.tripStats,
        totalReceived: prev.tripStats.totalReceived + 1,
      },
    }));
  }, []);

  const recordOfferDecision = useCallback(
    (
      offer: TripOffer,
      status: TripActivityStatus,
      offerTypeOverride?: TripActivityEntry['offerType']
    ) => {
      if (resolvedOfferIdsRef.current.has(offer.id)) return;
      resolvedOfferIdsRef.current.add(offer.id);
      const alreadyReceived = recordedReceivedIdsRef.current.has(offer.id);
      if (!alreadyReceived) {
        recordedReceivedIdsRef.current.add(offer.id);
      }
      const now = new Date();
      const entry: TripActivityEntry = {
        id: `act-${offer.id}-${now.getTime()}`,
        offerId: offer.id,
        serviceName: offer.serviceName,
        offerType: offerTypeOverride ?? offer.type,
        status,
        fare: offer.fare,
        pickupArea: offer.pickupArea,
        dropoffArea: offer.dropoffArea,
        timestamp: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        dateKey: getLocalDateKey(now),
      };
      setLedger((prev) => ({
        ...prev,
        tripStats: {
          totalReceived: prev.tripStats.totalReceived + (alreadyReceived ? 0 : 1),
          accepted: prev.tripStats.accepted + (status === 'accepted' ? 1 : 0),
          declined: prev.tripStats.declined + (status === 'declined' ? 1 : 0),
          radarLost: prev.tripStats.radarLost + (status === 'radar_lost' ? 1 : 0),
          history: [entry, ...prev.tripStats.history].slice(0, 80),
        },
      }));
      if (googleUser?.emailVerified) {
        void syncWithOfflineQueue(
          {
            kind: 'trip_activity',
            dedupeKey: `act:${entry.id}`,
            uid: googleUser.uid,
            payload: entry,
          },
          () => syncTripActivity(googleUser.uid, entry)
        );
      }
    },
    [googleUser?.emailVerified, googleUser?.uid, syncWithOfflineQueue]
  );

  const todayEarnings = ledger.dailyTotals[todayDateKey] ?? 0;
  const weeklyEarnings = useMemo(
    () => getWeeklyTotalFromLedger(ledger.dailyTotals),
    [ledger.dailyTotals]
  );

  const [inboxThreads, setInboxThreads] = useState<InboxThread[]>(INITIAL_INBOX_THREADS);
  const [preferences, setPreferences] = useState<DriverPreferences>(() => {
    try {
      const saved = localStorage.getItem('uber_driver_prefs_v1');
      if (saved) {
        return { ...INITIAL_PREFERENCES, ...JSON.parse(saved) };
      }
    } catch {
      // Ignore storage error
    }
    return INITIAL_PREFERENCES;
  });

  const servicePrefs = useMemo<ServicePrefsInput>(
    () => ({
      uberX: preferences.uberX,
      comfort: preferences.comfort,
      uberXL: preferences.uberXL,
      uberPet: preferences.uberPet,
      deliveries: preferences.deliveries,
      intercity: preferences.intercity,
    }),
    [
      preferences.uberX,
      preferences.comfort,
      preferences.uberXL,
      preferences.uberPet,
      preferences.deliveries,
      preferences.intercity,
    ]
  );

  const availableReserves = useMemo(() => {
    const generated = generateLocalReserveTrips(
      driverPos,
      !anchoredToLastJobRef.current &&
        isWithinUKBounds(realCoords?.lat ?? 0, realCoords?.lng ?? 0)
        ? realCoords
        : undefined,
      reserveSeed,
      6,
      servicePrefs
    );
    return generated.filter((r) => !acceptedReserveIds.includes(r.id));
  }, [driverPos, realCoords, reserveSeed, localGeoVersion, acceptedReserveIds, servicePrefs]);

  // Sync Tailwind v4 class-based Night Mode onto <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', preferences.nightMode);
  }, [preferences.nightMode]);

  // Modals: Accounts, Face Verification, Permissions, Map Report, Destination, Safety, Prefs, Opps
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [showFaceVerifyModal, setShowFaceVerifyModal] = useState<boolean>(false);
  const [pendingGoOnlineAfterVerify, setPendingGoOnlineAfterVerify] = useState<boolean>(false);

  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermissionState>(() => getNotificationPermission());
  const [nativeBubblePerms, setNativeBubblePerms] = useState<NativeBubblePermissions>({
    isNative: isNativeAndroidApk(),
    overlayGranted: false,
    notificationsGranted: false,
    batteryIgnored: false,
  });
  const [showPermissionsModal, setShowPermissionsModal] = useState<boolean>(false);
  const [inAppBanner, setInAppBanner] = useState<{
    title: string;
    body: string;
    onAction?: () => void;
  } | null>(null);

  const [showMapReportModal, setShowMapReportModal] = useState<boolean>(false);
  const [showDestinationModal, setShowDestinationModal] = useState<boolean>(false);
  const [showSafetyModal, setShowSafetyModal] = useState<boolean>(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState<boolean>(false);
  const [opportunitiesModalMode, setOpportunitiesModalMode] = useState<
    null | 'opportunities' | 'trends' | 'airports'
  >(null);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((prev) => (prev === msg ? null : prev));
    }, 2600);
  }, []);

  // Notify driver immediately when a new GitHub -> Vercel deployment triggers auto-restart
  useEffect(() => {
    const onUpdating = () => {
      setToastMsg('New update detected — restarting app...');
    };
    window.addEventListener(APP_UPDATE_EVENT, onUpdating);
    return () => window.removeEventListener(APP_UPDATE_EVENT, onUpdating);
  }, []);

  // Swap "You're online" and "Finding trips..." every 4 seconds when online
  useEffect(() => {
    if (onlineStatus !== 'online') {
      setStatusSwapOnline(false);
      return;
    }
    const t = setInterval(() => {
      setStatusSwapOnline((v) => !v);
    }, 4000);
    return () => clearInterval(t);
  }, [onlineStatus]);

  const pushDriverAlert = useCallback(
    (title: string, body: string, tag?: string, onAction?: () => void) => {
      if (!preferences.notificationsEnabled) return;
      setInAppBanner({ title, body, onAction });
      setTimeout(() => {
        setInAppBanner((prev) =>
          prev?.title === title && prev?.body === body ? null : prev
        );
      }, 4200);
      sendDriverNotification({ title, body, tag });
    },
    [preferences.notificationsEnabled]
  );

  useEffect(() => {
    try {
      localStorage.setItem('uber_driver_prefs_v1', JSON.stringify(preferences));
    } catch {
      // Ignore storage error
    }
  }, [preferences]);

  // Cloud Firestore real-time hydration & continuous state sync
  const ledgerRef = useRef(ledger);
  ledgerRef.current = ledger;
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const activeAccountRef = useRef(activeAccount);
  activeAccountRef.current = activeAccount;
  const cloudStateInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!authReady || !googleUser?.emailVerified || !activeAccountRef.current) {
      cloudStateInitializedRef.current = null;
      return;
    }

    const uid = googleUser.uid;
    let active = true;
    let sawCloudState = false;
    let unsubscribe = () => {};

    void (async () => {
      setSyncStatus('syncing');
      try {
        if (activeAccountRef.current) {
          await ensureUserProfile(googleUser, activeAccountRef.current);
        }
        if (!active) return;

        unsubscribe = subscribeDriverCloudData(uid, {
          onState: (cloudState) => {
            if (!active) return;
            sawCloudState = true;
            const firstHydrate = cloudStateInitializedRef.current !== uid;
            cloudStateInitializedRef.current = uid;

            setLedger((prev) => {
              const mergedDaily: Record<string, number> = { ...prev.dailyTotals };
              for (const [k, v] of Object.entries(cloudState.dailyTotals || {})) {
                mergedDaily[k] = Math.max(mergedDaily[k] ?? 0, Number(v) || 0);
              }
              return {
                ...prev,
                dailyTotals: mergedDaily,
                walletBalance: Math.max(prev.walletBalance, Number(cloudState.walletBalance) || 0),
                proPoints: Math.max(prev.proPoints, Number(cloudState.proPoints) || 0),
                questCompletedCount: Math.max(
                  prev.questCompletedCount,
                  Number(cloudState.questCompletedCount) || 0
                ),
                tripStats: {
                  ...prev.tripStats,
                  totalReceived: Math.max(
                    prev.tripStats.totalReceived,
                    Number(cloudState.totalReceived) || 0
                  ),
                  accepted: Math.max(
                    prev.tripStats.accepted,
                    Number(cloudState.acceptedCount) || 0
                  ),
                  declined: Math.max(
                    prev.tripStats.declined,
                    Number(cloudState.declinedCount) || 0
                  ),
                  radarLost: Math.max(
                    prev.tripStats.radarLost,
                    Number(cloudState.radarLostCount) || 0
                  ),
                },
              };
            });

            if (firstHydrate && cloudState.preferences) {
              setPreferences((prev) => ({
                ...prev,
                ...(cloudState.preferences as Partial<DriverPreferences>),
              }));
            }
            setSyncStatus('synced');
            setLastCloudSyncAt(Date.now());
          },
          onTrips: (cloudTrips) => {
            if (!active || cloudTrips.length === 0) return;
            setLedger((prev) => {
              const byId = new Map(prev.completedTrips.map((t) => [t.id, t]));
              for (const ct of cloudTrips) {
                if (!byId.has(ct.id)) {
                  byId.set(ct.id, ct);
                }
              }
              return {
                ...prev,
                completedTrips: Array.from(byId.values()).slice(0, 100),
              };
            });
          },
          onActivity: (cloudEntries) => {
            if (!active || cloudEntries.length === 0) return;
            setLedger((prev) => {
              const byId = new Map(prev.tripStats.history.map((e) => [e.id, e]));
              for (const ce of cloudEntries) {
                if (!byId.has(ce.id)) {
                  byId.set(ce.id, ce);
                }
              }
              return {
                ...prev,
                tripStats: {
                  ...prev.tripStats,
                  history: Array.from(byId.values()).slice(0, 80),
                },
              };
            });
          },
          onReserves: (cloudReserves) => {
            if (!active || cloudReserves.length === 0) return;
            setScheduledReserves((prev) => {
              const byId = new Map(prev.map((r) => [r.id, r]));
              for (const cr of cloudReserves) {
                if (!byId.has(cr.id)) {
                  byId.set(cr.id, cr);
                }
              }
              return Array.from(byId.values()).sort(
                (a, b) => a.scheduledAtMs - b.scheduledAtMs
              );
            });
          },
          onError: () => {
            if (active) setSyncStatus('error');
          },
        });

        window.setTimeout(() => {
          if (!active || sawCloudState) return;
          cloudStateInitializedRef.current = uid;
          void runCloudSync(() =>
            syncDriverLedgerState(uid, ledgerRef.current, preferencesRef.current)
          );
        }, 1200);
      } catch {
        if (active) setSyncStatus('error');
      }
    })();

    return () => {
      active = false;
      unsubscribe();
    };
  }, [authReady, googleUser, runCloudSync, setSyncStatus, setLastCloudSyncAt]);

  // Debounced sync of ledger + metrics + preferences to Firestore (with IndexedDB offline fallback)
  useEffect(() => {
    if (!googleUser?.emailVerified || cloudStateInitializedRef.current !== googleUser.uid) {
      return;
    }
    const timer = window.setTimeout(() => {
      void syncWithOfflineQueue(
        {
          kind: 'ledger_state',
          dedupeKey: `ledger_state:${googleUser.uid}`,
          uid: googleUser.uid,
          payload: { ledger, preferences },
        },
        async () => {
          await syncDriverLedgerState(googleUser.uid, ledger, preferences);
          await syncDriverPreferencesState(googleUser.uid, preferences);
          if (activeAccount) {
            await syncUserProfileMetrics(googleUser.uid, activeAccount);
          }
        }
      );
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [ledger, preferences, activeAccount, googleUser?.emailVerified, googleUser?.uid, syncWithOfflineQueue]);

  const checkMidnightRollover = useCallback(() => {
    const currentKey = getLocalDateKey();
    setTodayDateKey((prev) => (prev !== currentKey ? currentKey : prev));
  }, []);

  useEffect(() => {
    const id = setInterval(checkMidnightRollover, 15000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        checkMidnightRollover();
      }
    };
    window.addEventListener('focus', checkMidnightRollover);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', checkMidnightRollover);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [checkMidnightRollover]);

  // Cleanup delayed post-trip tip timers on unmount
  useEffect(() => {
    return () => {
      delayedTipTimersRef.current.forEach((t) => window.clearTimeout(t));
      delayedTipTimersRef.current = [];
    };
  }, []);

  // Automatically recalculate Uber Pro tier (Gold / Platinum / Diamond) from Pro Points & Rates
  useEffect(() => {
    if (!activeAccount?.id) return;
    const computedTier = computeUberProTier(
      ledger.proPoints,
      activeAccount.acceptanceRate,
      activeAccount.cancellationRate
    );
    if (computedTier !== activeAccount.tier || ledger.proPoints !== activeAccount.proPoints) {
      setAccounts((prev) =>
        prev.map((acct) =>
          acct.id === activeAccount.id
            ? { ...acct, tier: computedTier, proPoints: ledger.proPoints }
            : acct
        )
      );
    }
  }, [
    activeAccount?.id,
    activeAccount?.tier,
    activeAccount?.proPoints,
    activeAccount?.acceptanceRate,
    activeAccount?.cancellationRate,
    ledger.proPoints,
  ]);

  // Coffee Break countdown timer while online
  useEffect(() => {
    if (onlineStatus !== 'online' || !isOnBreak) return;
    const timer = window.setInterval(() => {
      setBreakSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsOnBreak(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [onlineStatus, isOnBreak]);

  // Track UK 12-hour driving time limit & online hours while online & not paused on break
  useEffect(() => {
    if (onlineStatus !== 'online' || isOnBreak || !activeAccount?.id) return;
    const id = setInterval(() => {
      setAccounts((prev) =>
        prev.map((acct) =>
          acct.id === activeAccount.id
            ? {
                ...acct,
                drivingMinutesUsedToday: Math.min(12 * 60, acct.drivingMinutesUsedToday + 1),
              }
            : acct
        )
      );
      setLedger((prev) => ({
        ...prev,
        onlineMinutesTotal: (prev.onlineMinutesTotal ?? 60) + 1,
      }));
    }, 60000);
    return () => clearInterval(id);
  }, [onlineStatus, isOnBreak, activeAccount?.id]);

  const {
    lastRefreshedAt,
    refreshCount,
    periodicSyncActive,
    wakeLockActive,
    isRefreshing,
    triggerRefreshNow,
  } = useBackgroundRefresh({
    enabled: preferences.backgroundAppRefresh,
    onlineStatus,
    onRefreshCycle: () => {
      setNavNowMs(Date.now());
      checkMidnightRollover();
    },
  });

  const unreadInboxCount = useMemo(
    () => inboxThreads.filter((t) => t.unread).length,
    [inboxThreads]
  );

  // Sync iOS 16.4+ / PWA Home Screen App Icon Badge count (unread inbox + scheduled reserves)
  useEffect(() => {
    const count = preferences.notificationsEnabled
      ? unreadInboxCount + scheduledReserves.length
      : 0;
    void updateAppIconBadge(count);
  }, [unreadInboxCount, scheduledReserves.length, preferences.notificationsEnabled]);

  const permissionsReadyCount = useMemo(() => {
    let count = 0;
    if (realCoords !== null || gpsPermissionState === 'active' || gpsExplicitlyAccepted) {
      count += 1;
    }
    if (
      preferences.notificationsEnabled &&
      (notificationPermission === 'granted' ||
        notificationPermission === 'denied' ||
        notificationPermission === 'unsupported')
    ) {
      count += 1;
    }
    if (preferences.backgroundAppRefresh) count += 1;
    return count;
  }, [
    realCoords,
    gpsPermissionState,
    gpsExplicitlyAccepted,
    preferences.notificationsEnabled,
    notificationPermission,
    preferences.backgroundAppRefresh,
  ]);

  // Preload & sync sound effects preference
  useEffect(() => {
    uberSounds.preload();
    return () => uberSounds.stopDispatchLoop();
  }, []);

  useEffect(() => {
    uberSounds.setEnabled(preferences.soundEffects);
  }, [preferences.soundEffects]);

  // Auto-enable live GPS on load if browser location permission was already granted
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('permissions' in navigator)) return;
    let active = true;
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (!active) return;
        if (status.state === 'granted') {
          setGpsExplicitlyAccepted(true);
        } else if (status.state === 'denied') {
          setGpsPermissionState('denied');
        }
      })
      .catch(() => {
        // Older iOS Safari fallback
      });
    return () => {
      active = false;
    };
  }, []);

  const tripStageRef = useRef<TripStage>(tripStage);
  tripStageRef.current = tripStage;

  // Foreground Geolocation tracking while online, active trip, or explicitly accepted
  useEffect(() => {
    const needsLocation =
      onlineStatus === 'online' || tripStage !== 'idle' || gpsExplicitlyAccepted;
    if (!needsLocation) {
      setGpsPermissionState('idle');
      return;
    }

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGpsPermissionState('active');
      return;
    }

    setGpsPermissionState('active');
    const applyPosition = (pos: GeolocationPosition) => {
      const { latitude, longitude, heading, speed } = pos.coords;
      setGpsPermissionState('active');
      const coords = { lat: latitude, lng: longitude };
      realCoordsRef.current = coords;
      setRealCoords(coords);

      if (typeof speed === 'number' && !Number.isNaN(speed)) {
        setLiveSpeedMph(Math.max(0, Math.round(speed * 2.23694)));
      }

      if (isWithinUKBounds(latitude, longitude)) {
        if (!anchoredToLastJobRef.current) {
          void prefetchLocalPlaces(latitude, longitude).then(() => {
            setLocalGeoVersion((v) => v + 1);
          });
          if (tripStageRef.current === 'idle') {
            setDriverPos(clampMapCoords(projectLatLngToMap(latitude, longitude)));
            if (typeof heading === 'number' && !Number.isNaN(heading)) {
              setDriverHeading(heading);
            }
          }
        }
      }
    };

    // Instant coarse/cached GPS fix so the driver pin & local jobs lock onto real location immediately
    navigator.geolocation.getCurrentPosition(
      applyPosition,
      () => {
        // Fine watchPosition below handles fallback & permission state
      },
      { enableHighAccuracy: false, maximumAge: 120000, timeout: 4500 }
    );

    const watchId = navigator.geolocation.watchPosition(
      applyPosition,
      () => {
        setGpsPermissionState('denied');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [onlineStatus, tripStage, gpsExplicitlyAccepted]);

  // Play looping Uber Driver dispatch ping + unique surge/cash chimes + haptics
  useEffect(() => {
    if (pendingOffer && tripStage === 'idle') {
      if (pendingOffer.paymentMethod === 'cash') {
        uberSounds.play('cashDispatch');
        triggerHaptic('cash');
      } else if ((pendingOffer.surgeBonus ?? 0) >= 4) {
        uberSounds.play('highSurgeDispatch');
        triggerHaptic('dispatch');
      } else {
        triggerHaptic('dispatch');
      }
      uberSounds.startDispatchLoop(pendingOffer.type === 'radar' ? 'radar' : 'exclusive');
      void pushOfferToNativeBubble(pendingOffer);
    } else {
      uberSounds.stopDispatchLoop();
      void clearOfferFromNativeBubble();
    }
    return () => {
      uberSounds.stopDispatchLoop();
    };
  }, [pendingOffer, tripStage]);

  // Android APK: sync online service, floating dot visibility, background offer trigger, & tap-to-open
  const pendingOfferRef = useRef<TripOffer | null>(pendingOffer);
  pendingOfferRef.current = pendingOffer;
  const nextOfferSecLeftRef = useRef<number | null>(nextOfferSecLeft);
  nextOfferSecLeftRef.current = nextOfferSecLeft;
  const onlineStatusRef = useRef<DriverOnlineStatus>(onlineStatus);
  onlineStatusRef.current = onlineStatus;
  const nativeActionHandlersRef = useRef<{
    accept: (offer: TripOffer) => void;
    decline: (offer: TripOffer) => void;
    radarMatch: (offer: TripOffer) => void;
  } | null>(null);

  const nativeTripHandlersRef = useRef<{
    arrivePickup: () => void;
    startTrip: () => void;
    arriveStop: () => void;
    continueFromStop: () => void;
    arriveDropoff: () => void;
    completeTrip: () => void;
  } | null>(null);

  const toggleOnlineRef = useRef<() => void>(() => {});

  const handleNativeOverlayAction = useCallback((result: NativeBubbleActionResult | null) => {
    if (!result) return;
    const { action, offer } = result;
    if (action === 'toggle_online') {
      setActiveTab('home');
      toggleOnlineRef.current();
      return;
    }
    if (action === 'open_earnings') {
      setActiveTab('earnings');
      return;
    }
    if (action === 'trip_arrive_pickup') {
      nativeTripHandlersRef.current?.arrivePickup();
      return;
    }
    if (action === 'trip_start') {
      nativeTripHandlersRef.current?.startTrip();
      return;
    }
    if (action === 'trip_arrive_stop') {
      nativeTripHandlersRef.current?.arriveStop();
      return;
    }
    if (action === 'trip_continue_stop') {
      nativeTripHandlersRef.current?.continueFromStop();
      return;
    }
    if (action === 'trip_arrive_dropoff') {
      nativeTripHandlersRef.current?.arriveDropoff();
      return;
    }
    if (action === 'trip_complete') {
      nativeTripHandlersRef.current?.completeTrip();
      return;
    }
    if (action === 'decline') {
      if (offer) {
        nativeActionHandlersRef.current?.decline(offer);
      } else {
        setPendingOffer(null);
      }
      return;
    }
    setActiveTab('home');
    if (!offer || tripStageRef.current !== 'idle') return;
    if (action === 'accept') {
      if (offer.type === 'radar') {
        nativeActionHandlersRef.current?.radarMatch(offer);
      } else {
        nativeActionHandlersRef.current?.accept(offer);
      }
      return;
    }
    if (!pendingOfferRef.current) {
      setPendingOffer(offer);
    }
  }, []);

  useEffect(() => {
    if (!isNativeAndroidApk()) return;

    const refreshPerms = () => {
      void getNativeBubblePermissions().then((perms) => {
        setNativeBubblePerms(perms);
      });
    };

    refreshPerms();
    void setNativeImmersiveNavHidden(onlineStatus === 'online');
    void setNativeBubbleAlertMode(preferences.floatingDotAlertMode ?? 'dot');

    if (onlineStatus === 'online') {
      void startNativeOnlineBubbleService(
        getResolvedLocalCityName(driverPosRef.current),
        activeAccount?.name ?? 'Driver',
        preferences.floatingDotAlertMode ?? 'dot'
      );
    }

    const handleVisibility = () => {
      const inFg = !document.hidden;
      void syncNativeAppForeground(inFg);

      if (inFg) {
        refreshPerms();
        void cancelNativeScheduledOffer();
        void consumePendingNativeLaunchOffer().then((launchRes) => {
          handleNativeOverlayAction(launchRes);
        });
      } else if (
        onlineStatusRef.current === 'online' &&
        tripStageRef.current === 'idle' &&
        !pendingOfferRef.current
      ) {
        const activePool = buildLocalOfferPool(
          driverPosRef.current,
          getActiveGpsLatLng(),
          preferences.intercity,
          offerIndex,
          servicePrefs,
          preferences.areaPreference,
          Boolean(activeAccount?.isEV),
          preferences.acceptCashJobs ?? true,
          destination
        );
        const upcoming = activePool[0];
        if (upcoming) {
          const delaySec = Math.max(4, nextOfferSecLeftRef.current ?? 9);
          void scheduleNativeBackgroundOffer(delaySec, upcoming, activePool);
        }
      }
    };

    const removeTapListener = listenToNativeBubbleTap((actionResult) => {
      handleNativeOverlayAction(actionResult);
    });

    const removePermsListener = listenToNativePermissionsChanged((perms) => {
      setNativeBubblePerms(perms);
    });

    void consumePendingNativeLaunchOffer().then((launchRes) => {
      handleNativeOverlayAction(launchRes);
    });

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', refreshPerms);

    return () => {
      removeTapListener();
      removePermsListener();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', refreshPerms);
    };
  }, [
    onlineStatus,
    activeAccount?.name,
    activeAccount?.isEV,
    preferences.intercity,
    preferences.areaPreference,
    preferences.acceptCashJobs,
    preferences.floatingDotAlertMode,
    servicePrefs,
    offerIndex,
    destination,
    handleNativeOverlayAction,
    getActiveGpsLatLng,
  ]);

  // Keep Android Home Screen Widget updated in real time
  useEffect(() => {
    if (!isNativeAndroidApk()) return;
    const cityLabel = getResolvedLocalCityName(driverPos) || activeAccount?.city || 'London';
    void syncAndroidWidgetState({
      online: onlineStatus === 'online',
      earningsText: privacyHidden ? '£••••' : `£${todayEarnings.toFixed(2)}`,
      city: cityLabel,
      driverName: activeAccount?.name ?? 'Uber Driver UK',
      questStreakText: `Quest ${Math.min(ledger.questCompletedCount, 20)}/20 · Streak ${streakCount}/3`,
      demandText: `${demandContext.demandLevel} · ${weatherCondition}`,
    });
  }, [
    onlineStatus,
    todayEarnings,
    privacyHidden,
    driverPos,
    activeAccount?.city,
    activeAccount?.name,
    ledger.questCompletedCount,
    streakCount,
    demandContext.demandLevel,
    weatherCondition,
  ]);

  // Trip Radar 60-second auto-refresh when online (localized to driver's position)
  const rotateRadarOffers = useCallback(
    (nextBatch: number) => {
      const gps = getActiveGpsLatLng();
      const first = generateLocalTripOffer({
        anchorCoords: driverPosRef.current,
        realLatLng: gps,
        seedIndex: nextBatch * 2,
        forceType: 'radar',
        includeIntercity: preferences.intercity,
        servicePrefs,
        surgeLockedBonus: lockedSurgeBonus,
        boostBonus: activeBoostBonus,
        ccAlreadyPaidToday: ledger.ccPaidDateKey === todayDateKey,
        areaPreference: preferences.areaPreference,
        destination,
        isEV: Boolean(activeAccount?.isEV),
        acceptCashJobs: preferences.acceptCashJobs ?? true,
      });
      const second = generateLocalTripOffer({
        anchorCoords: driverPosRef.current,
        realLatLng: gps,
        seedIndex: nextBatch * 2 + 1,
        forceType: 'radar',
        includeIntercity: preferences.intercity,
        servicePrefs,
        surgeLockedBonus: lockedSurgeBonus,
        boostBonus: activeBoostBonus,
        ccAlreadyPaidToday: ledger.ccPaidDateKey === todayDateKey,
        areaPreference: preferences.areaPreference,
        destination,
        isEV: Boolean(activeAccount?.isEV),
        acceptCashJobs: preferences.acceptCashJobs ?? true,
      });
      setRadarOffers([first, second]);
    },
    [
      getActiveGpsLatLng,
      preferences.intercity,
      preferences.areaPreference,
      preferences.acceptCashJobs,
      destination,
      activeAccount?.isEV,
      servicePrefs,
      lockedSurgeBonus,
      activeBoostBonus,
      ledger.ccPaidDateKey,
      todayDateKey,
    ]
  );

  useEffect(() => {
    if (onlineStatus !== 'online' || radarOffers.length === 0) {
      setRadarRefreshSecLeft(60);
      return;
    }

    const tick = setInterval(() => {
      setRadarRefreshSecLeft((prev) => {
        if (prev <= 1) {
          setRadarBatchIdx((b) => {
            const next = b + 1;
            rotateRadarOffers(next);
            return next;
          });
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [onlineStatus, radarOffers.length, rotateRadarOffers]);

  // Job request timer when online, idle, and not on Coffee Break
  useEffect(() => {
    if (
      onlineStatus !== 'online' ||
      isOnBreak ||
      tripStage !== 'idle' ||
      pendingOffer ||
      showRadarList
    ) {
      setNextOfferSecLeft(null);
      return;
    }

    const span = Math.max(1, demandContext.dispatchMaxSec - demandContext.dispatchMinSec + 1);
    const randomDelaySec = demandContext.dispatchMinSec + Math.floor(Math.random() * span);
    setNextOfferSecLeft(randomDelaySec);

    const countdownInterval = setInterval(() => {
      setNextOfferSecLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(countdownInterval);
          const next = generateLocalTripOffer({
            anchorCoords: driverPosRef.current,
            realLatLng: getActiveGpsLatLng(),
            seedIndex: offerIndex,
            includeIntercity: preferences.intercity,
            servicePrefs,
            surgeLockedBonus: lockedSurgeBonus,
            boostBonus: activeBoostBonus,
            ccAlreadyPaidToday: ledger.ccPaidDateKey === todayDateKey,
            airportQueueCode: airportQueue?.position === 1 ? airportQueue.code : undefined,
            areaPreference: preferences.areaPreference,
            destination,
            isEV: Boolean(activeAccount?.isEV),
            acceptCashJobs: preferences.acceptCashJobs ?? true,
          });
          setOfferIndex((i) => i + 1);
          const passesFilter = matchesTripFilter(next, preferences.tripFilter);

          if (!passesFilter && preferences.tripFilter?.enabled && preferences.tripFilter?.autoDeclineBelowTarget) {
            recordOfferDecision(next, 'declined');
            showToast(`Filtered out: ${next.serviceName} £${next.fare.toFixed(2)} (below target)`);
            return null;
          }

          if (preferences.autoAccept && next.type === 'exclusive' && passesFilter) {
            recordOfferDecision(next, 'accepted');
            uberSounds.play('accept');
            triggerHaptic('accept');
            setLockedSurgeBonus(0);
            setLockedSurgeLabel(null);
            setPendingOffer(null);
            setActiveTrip(next);
            setStopVisited(false);
            const initialDist = Math.max(
              20,
              Math.hypot(
                next.pickupCoords.x - driverPosRef.current.x,
                next.pickupCoords.y - driverPosRef.current.y
              )
            );
            setLegStartDistPx(initialDist);
            setNavNowMs(Date.now());
            setTripStage('pickup');
            setActiveTab('home');
            setRecenterSignal((s) => s + 1);
            showToast(`Auto-accepted ${next.serviceName} · £${next.fare.toFixed(2)}`);
          } else {
            recordOfferReceived(next);
            setPendingOffer(next);
            pushDriverAlert(
              `${
                next.paymentMethod === 'cash'
                  ? 'Cash · Metered'
                  : next.isIntercity
                  ? 'Intercity'
                  : next.type === 'radar'
                  ? 'Trip Radar'
                  : 'Exclusive'
              } · £${next.fare.toFixed(2)}`,
              `${next.serviceName}${next.merchantName ? ` (${next.merchantName})` : ''} · ${next.pickupArea} → ${next.dropoffArea} (${next.pickupMinutes} min away)`,
              `offer-${next.id}`,
              () => setActiveTab('home')
            );
          }
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [
    onlineStatus,
    isOnBreak,
    tripStage,
    pendingOffer,
    showRadarList,
    offerIndex,
    preferences.intercity,
    preferences.autoAccept,
    preferences.areaPreference,
    preferences.acceptCashJobs,
    preferences.tripFilter,
    destination,
    activeAccount?.isEV,
    servicePrefs,
    demandContext.dispatchMinSec,
    demandContext.dispatchMaxSec,
    lockedSurgeBonus,
    activeBoostBonus,
    ledger.ccPaidDateKey,
    todayDateKey,
    airportQueue?.position,
    airportQueue?.code,
    pushDriverAlert,
    getActiveGpsLatLng,
    showToast,
    recordOfferReceived,
    recordOfferDecision,
  ]);

  // Sticky Surge Lock when driver enters a surge zone while online & idle
  useEffect(() => {
    if (onlineStatus !== 'online' || tripStage !== 'idle') return;
    const hit = getStickySurgeAtCoords(driverPos, INITIAL_SURGE_ZONES);
    if (hit && hit.bonusAmount > lockedSurgeBonus) {
      setLockedSurgeBonus(hit.bonusAmount);
      setLockedSurgeLabel(hit.zoneLabel);
      showToast(`Sticky Surge Locked: +£${hit.bonusAmount.toFixed(2)} guaranteed on next trip`);
    }
  }, [driverPos, onlineStatus, tripStage, lockedSurgeBonus, showToast]);

  // Live Airport FIFO Waiting Queue progression near UK airport bays
  useEffect(() => {
    if (onlineStatus !== 'online') {
      setAirportQueue(null);
      return;
    }
    if (tripStage !== 'idle') return;
    const nearbyAp = getNearbyAirportQueuePin(driverPos);
    if (!nearbyAp) {
      setAirportQueue(null);
      return;
    }
    setAirportQueue((prev) => {
      if (prev && prev.code === nearbyAp.code) return prev;
      return {
        code: nearbyAp.code,
        name: nearbyAp.name,
        position: Math.floor(Math.random() * 6) + 5,
      };
    });
  }, [driverPos, onlineStatus, tripStage]);

  useEffect(() => {
    if (onlineStatus !== 'online' || tripStage !== 'idle' || !airportQueue || airportQueue.position <= 1) {
      return;
    }
    const timer = window.setInterval(() => {
      setAirportQueue((prev) => {
        if (!prev || prev.position <= 1) return prev;
        const nextPos = prev.position - 1;
        if (nextPos === 1) {
          showToast(`${prev.code} Airport Queue #1 — Next terminal pickup ready!`);
        }
        return { ...prev, position: nextPos };
      });
    }, 8000);
    return () => window.clearInterval(timer);
  }, [onlineStatus, tripStage, airportQueue?.code, airportQueue?.position, showToast]);

  // Dynamic Traffic Delays & Live Rerouting during enroute phase
  useEffect(() => {
    if (tripStage !== 'enroute' || !activeTrip) {
      setTrafficAlert(null);
      return;
    }
    const tripId = activeTrip.id;
    const shouldTrigger = activeTrip.tripMinutes >= 5 && Math.random() < 0.4;
    if (!shouldTrigger) return;

    const timer = window.setTimeout(() => {
      if (tripStageRef.current !== 'enroute') return;
      const delayMin = 4 + Math.floor(Math.random() * 5);
      const routeSavedMin = 3 + Math.floor(Math.random() * 4);
      setTrafficAlert({ delayMin, routeSavedMin });
      showToast(`Traffic delay ahead (+${delayMin} min) on ${tripId.slice(-4)} — reroute ready`);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [tripStage, activeTrip?.id, activeTrip?.tripMinutes, showToast]);

  // Mid-Trip Rider Change (added Stop 1 or extended dropoff) during enroute
  useEffect(() => {
    if (
      tripStage !== 'enroute' ||
      !activeTrip ||
      activeTrip.stopCoords ||
      activeTrip.isIntercity ||
      activeTrip.serviceName === 'Uber Eats'
    ) {
      setRiderChangeOffer(null);
      return;
    }
    if (Math.random() >= 0.28) return;

    const timer = window.setTimeout(() => {
      if (tripStageRef.current !== 'enroute' || !activeTrip) return;
      const isStop = Math.random() < 0.5;
      const dx = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 14);
      const dy = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 14);
      const nextCoords = clampMapCoords({
        x: activeTrip.dropoffCoords.x + dx,
        y: activeTrip.dropoffCoords.y + dy,
      });
      const extraMiles = Number((1.1 + Math.random() * 1.4).toFixed(1));
      const extraMin = 4 + Math.floor(Math.random() * 4);
      const extraFare = Number((extraMiles * 2.35 + extraMin * 0.25).toFixed(2));
      const cityShort = getResolvedLocalCityName(nextCoords);

      setRiderChangeOffer({
        kind: isStop ? 'stop' : 'dropoff',
        title: isStop ? 'Add quick stop (Tesco Express)' : `Extend dropoff to ${cityShort} High St`,
        subtitle: isStop
          ? `${activeTrip.riderName} requested a 2-min drop-in stop`
          : `${activeTrip.riderName} updated destination +${extraMiles} mi further`,
        extraFare,
        extraMiles,
        extraMin,
        nextCoords,
        nextAddress: isStop ? `Tesco Express, ${cityShort}` : `${cityShort} High St & Rail`,
      });
    }, 12000);

    return () => window.clearTimeout(timer);
  }, [tripStage, activeTrip?.id, activeTrip?.stopCoords, activeTrip?.isIntercity, activeTrip?.serviceName]);

  // Stacked / Double Uber Eats Batch Offer while collecting food at pickup/waiting
  useEffect(() => {
    if (
      !activeTrip ||
      activeTrip.serviceName !== 'Uber Eats' ||
      activeTrip.stopCoords ||
      (tripStage !== 'pickup' && tripStage !== 'waiting')
    ) {
      setStackedEatsOffer(null);
      return;
    }
    if (Math.random() >= 0.72) return;

    const timer = window.setTimeout(() => {
      if (tripStageRef.current !== 'pickup' && tripStageRef.current !== 'waiting') return;
      const dx = (Math.random() > 0.5 ? 1 : -1) * (6 + Math.random() * 10);
      const dy = (Math.random() > 0.5 ? 1 : -1) * (6 + Math.random() * 10);
      const stopCoords = clampMapCoords({
        x: (activeTrip.pickupCoords.x + activeTrip.dropoffCoords.x) / 2 + dx,
        y: (activeTrip.pickupCoords.y + activeTrip.dropoffCoords.y) / 2 + dy,
      });
      const cityShort = getResolvedLocalCityName(stopCoords);
      const batchRestaurants = ['Pret A Manger', 'Wagamama', "Nando's", 'Five Guys', 'Greggs'];
      const restaurantName = batchRestaurants[Math.floor(Math.random() * batchRestaurants.length)];
      const orderCode = `#UE-${Math.floor(1000 + Math.random() * 8999).toString(16).toUpperCase()}`;
      const extraMiles = Number((0.9 + Math.random() * 1.1).toFixed(1));
      const extraMin = 4 + Math.floor(Math.random() * 4);
      const extraFare = Number((3.6 + extraMiles * 1.35).toFixed(2));

      setStackedEatsOffer({
        restaurantName,
        orderCode,
        extraFare,
        extraMiles,
        extraMin,
        stopCoords,
        stopAddress: `${restaurantName} · ${cityShort} High St`,
      });
      uberSounds.play('dispatch');
    }, 5500);

    return () => window.clearTimeout(timer);
  }, [tripStage, activeTrip?.id, activeTrip?.serviceName, activeTrip?.stopCoords]);

  // Mid-Approach Rider Cancellation (~1 in 12 pickups cancels en route to pickup, +£4.50 fee)
  useEffect(() => {
    if (
      tripStage !== 'pickup' ||
      !activeTrip ||
      activeTrip.id.startsWith('active-res-') ||
      activeTrip.serviceName === 'Uber Eats'
    ) {
      return;
    }
    if (Math.random() >= 1 / 12) return;

    const delayMs = 7500 + Math.floor(Math.random() * 3500);
    const timer = window.setTimeout(() => {
      if (tripStageRef.current !== 'pickup' || !activeTrip) return;
      const fee = 4.5;
      const currentKey = getLocalDateKey();
      setTodayDateKey(currentKey);
      const timeLabel = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });

      const cancelFeeRecord: CompletedTrip = {
        id: `rcancel-${Date.now()}`,
        riderName: activeTrip.riderName,
        serviceName: activeTrip.serviceName,
        fare: fee,
        tip: 0,
        waitFee: 0,
        netPayout: fee,
        cancellationFee: true,
        distanceMiles: 0,
        durationMin: 3,
        pickupArea: activeTrip.pickupArea.split(',')[0],
        dropoffArea: 'Rider Cancelled (Pickup Fee)',
        completedAt: `Today, ${timeLabel}`,
        dateKey: currentKey,
        isNoShowFee: false,
      };

      setLedger((prev) => ({
        ...prev,
        dailyTotals: {
          ...prev.dailyTotals,
          [currentKey]: Number(((prev.dailyTotals[currentKey] ?? 0) + fee).toFixed(2)),
        },
        walletBalance: Number((prev.walletBalance + fee).toFixed(2)),
        completedTrips: [cancelFeeRecord, ...prev.completedTrips],
      }));

      if (googleUser?.emailVerified) {
        void syncWithOfflineQueue(
          {
            kind: 'completed_trip',
            dedupeKey: `trip:${cancelFeeRecord.id}`,
            uid: googleUser.uid,
            payload: cancelFeeRecord,
          },
          () => syncCompletedTrip(googleUser.uid, cancelFeeRecord)
        );
      }

      uberSounds.play('decline');
      setActiveTrip(null);
      setActiveRoute(null);
      setTripWaitFee(0);
      setStopVisited(false);
      setQueuedOffer(null);
      setAcceptedNextOffer(null);
      setTrafficAlert(null);
      setRiderChangeOffer(null);
      setTripStage('idle');
      pushDriverAlert(
        `Rider cancelled pickup · +£${fee.toFixed(2)} fee`,
        '0% driver cancel impact · Fee added to Today’s Earnings',
        cancelFeeRecord.id,
        () => setActiveTab('earnings')
      );
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [tripStage, activeTrip?.id, googleUser?.emailVerified, googleUser?.uid, pushDriverAlert, syncWithOfflineQueue]);

  // Compute road-snapped UK turn-by-turn route (OSRM with instant fallback)
  const driverPosRef = useRef<Coordinates>(driverPos);
  driverPosRef.current = driverPos;
  const lastSpokenStepIdRef = useRef<string | null>(null);

  useEffect(() => {
    const trip = activeTrip || pendingOffer;
    if (!trip) {
      setActiveRoute(null);
      setRouteWpIdx(0);
      setCurrentStepIdx(0);
      return;
    }

    const isDropoffPhase =
      tripStage === 'enroute' || tripStage === 'stop_wait' || tripStage === 'dropoff_arrived';
    let start: Coordinates = driverPosRef.current;
    let end: Coordinates = trip.pickupCoords;
    let label: string = trip.pickupAddress;

    if (isDropoffPhase) {
      if (trip.stopCoords && !stopVisited) {
        start = trip.pickupCoords;
        end = trip.stopCoords;
        label = trip.stopAddress || 'Stop 1';
      } else {
        start = trip.stopCoords && stopVisited ? trip.stopCoords : trip.pickupCoords;
        end = trip.dropoffCoords;
        label = trip.dropoffAddress;
      }
    }

    let cancelled = false;
    const fallback = buildFallbackUKRoute(start, end, label);
    setActiveRoute(fallback);
    setRouteWpIdx(0);
    setCurrentStepIdx(0);
    lastSpokenStepIdRef.current = null;

    fetchUKRoute(start, end, label).then((computed) => {
      if (cancelled) return;
      setActiveRoute(computed);
      setRouteWpIdx(0);
      setCurrentStepIdx(0);
    });

    return () => {
      cancelled = true;
    };
  }, [activeTrip, pendingOffer, tripStage, stopVisited]);

  // Compute Pickup -> Dropoff preview leg while an incoming job card is displayed on the map
  useEffect(() => {
    if (!pendingOffer || activeTrip || tripStage !== 'idle') {
      setOfferTripRoute(null);
      return;
    }

    let cancelled = false;
    const pickup = pendingOffer.pickupCoords;
    const stop = pendingOffer.stopCoords;
    const dropoff = pendingOffer.dropoffCoords;

    if (stop) {
      const fb1 = buildFallbackUKRoute(pickup, stop, pendingOffer.stopAddress || 'Stop 1');
      const fb2 = buildFallbackUKRoute(stop, dropoff, pendingOffer.dropoffAddress);
      setOfferTripRoute({
        polyline: [...fb1.polyline, ...fb2.polyline.slice(1)],
        steps: [...fb1.steps, ...fb2.steps],
        totalDistanceMeters: fb1.totalDistanceMeters + fb2.totalDistanceMeters,
        totalDurationSec: fb1.totalDurationSec + fb2.totalDurationSec,
        source: fb1.source,
      });

      Promise.all([
        fetchUKRoute(pickup, stop, pendingOffer.stopAddress || 'Stop 1'),
        fetchUKRoute(stop, dropoff, pendingOffer.dropoffAddress),
      ]).then(([leg1, leg2]) => {
        if (cancelled) return;
        setOfferTripRoute({
          polyline: [...leg1.polyline, ...leg2.polyline.slice(1)],
          steps: [...leg1.steps, ...leg2.steps],
          totalDistanceMeters: leg1.totalDistanceMeters + leg2.totalDistanceMeters,
          totalDurationSec: leg1.totalDurationSec + leg2.totalDurationSec,
          source: leg1.source === 'osrm' && leg2.source === 'osrm' ? 'osrm' : 'uk-corridor',
        });
      });
    } else {
      const fallback = buildFallbackUKRoute(pickup, dropoff, pendingOffer.dropoffAddress);
      setOfferTripRoute(fallback);
      fetchUKRoute(pickup, dropoff, pendingOffer.dropoffAddress).then((computed) => {
        if (cancelled) return;
        setOfferTripRoute(computed);
      });
    }

    return () => {
      cancelled = true;
    };
  }, [pendingOffer, activeTrip, tripStage]);

  // Speak turn-by-turn instruction aloud whenever current step advances during active nav
  useEffect(() => {
    if (!activeTrip || (tripStage !== 'pickup' && tripStage !== 'enroute')) return;
    if (!activeRoute || activeRoute.steps.length === 0) return;
    const step = activeRoute.steps[Math.min(currentStepIdx, activeRoute.steps.length - 1)];
    if (!step) return;
    const key = `${tripStage}-${step.id}`;
    if (lastSpokenStepIdRef.current !== key) {
      lastSpokenStepIdRef.current = key;
      speakNavInstruction(step.instruction, preferences.voiceNavigation);
    }
  }, [activeTrip, tripStage, activeRoute, currentStepIdx, preferences.voiceNavigation]);

  // Smooth 60fps arc-length polyline navigation with lookahead steering & cornering speed
  const headingRef = useRef<number>(driverHeading);
  headingRef.current = driverHeading;
  const rushNavRef = useRef<boolean>(preferences.rushNav);
  rushNavRef.current = preferences.rushNav;
  const navProgressRef = useRef<number>(navProgress);
  const prevNavLegSigRef = useRef<string>(`${activeTrip?.id ?? ''}|${tripStage}|${stopVisited}`);

  useEffect(() => {
    const nextSig = `${activeTrip?.id ?? ''}|${tripStage}|${stopVisited}`;
    if (prevNavLegSigRef.current !== nextSig) {
      prevNavLegSigRef.current = nextSig;
      navProgressRef.current = 0;
      setNavProgress(0);
      setSimSpeedMph(0);
    }
  }, [activeTrip?.id, tripStage, stopVisited]);

  useEffect(() => {
    if (!activeTrip) return;
    if (tripStage !== 'pickup' && tripStage !== 'enroute') return;

    const fallbackTarget =
      tripStage === 'pickup'
        ? activeTrip.pickupCoords
        : activeTrip.stopCoords && !stopVisited
        ? activeTrip.stopCoords
        : activeTrip.dropoffCoords;
    const poly =
      activeRoute && activeRoute.polyline.length >= 2
        ? activeRoute.polyline
        : [driverPosRef.current, fallbackTarget];

    // Precompute cumulative arc-length along the smoothed UK polyline
    const cumDist: number[] = [0];
    let totalLen = 0;
    for (let i = 1; i < poly.length; i++) {
      totalLen += Math.hypot(poly[i].x - poly[i - 1].x, poly[i].y - poly[i - 1].y);
      cumDist.push(totalLen);
    }
    if (totalLen < 0.05) return;

    const sampleAt = (prog: number): { x: number; y: number; wpIdx: number } => {
      const clamped = Math.max(0, Math.min(1, prog));
      const targetD = clamped * totalLen;
      let seg = 0;
      while (seg < cumDist.length - 2 && cumDist[seg + 1] < targetD) {
        seg++;
      }
      const span = Math.max(0.0001, cumDist[seg + 1] - cumDist[seg]);
      const t = Math.max(0, Math.min(1, (targetD - cumDist[seg]) / span));
      return {
        x: poly[seg].x + (poly[seg + 1].x - poly[seg].x) * t,
        y: poly[seg].y + (poly[seg + 1].y - poly[seg].y) * t,
        wpIdx: seg,
      };
    };

    const isPickup = tripStage === 'pickup';
    const baseDurationSec = isPickup
      ? Math.max(26, Math.min(68, activeTrip.pickupMinutes * 8))
      : Math.max(
          38,
          Math.min(115, (activeTrip.isIntercity ? 62 : 34) + activeTrip.tripMinutes * 2.1)
        );

    let rafId = 0;
    let lastTime = performance.now();
    let lastUiSync = lastTime;
    let lastWpSynced = -1;
    let currentSpeedMph = 0;

    const stepFrame = (now: number) => {
      const dtSec = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      const prog = navProgressRef.current;
      if (prog < 1) {
        const curSample = sampleAt(prog);
        const lookSample = sampleAt(Math.min(1, prog + 0.032));
        const dx = lookSample.x - curSample.x;
        const dy = lookSample.y - curSample.y;
        const lookDist = Math.hypot(dx, dy);

        let cornerFactor = 1;
        if (lookDist > 0.001) {
          const targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
          const angDiff = Math.abs((((targetAngle - headingRef.current) % 360) + 540) % 360 - 180);
          cornerFactor = Math.max(0.55, 1 - (angDiff / 90) * 0.42);
          const smoothHeading = lerpAngle(
            headingRef.current,
            targetAngle,
            1 - Math.exp(-dtSec * 6.5)
          );
          headingRef.current = smoothHeading;
          setDriverHeading(smoothHeading);
        }

        // Gentle launch & arrival braking profile + optional Rush Nav multiplier
        const launchRamp = prog < 0.08 ? 0.38 + (prog / 0.08) * 0.62 : 1;
        const arriveRamp = prog > 0.9 ? Math.max(0.28, (1 - prog) / 0.1) : 1;
        const rushMultiplier = rushNavRef.current ? 3.8 : 1;
        const speedMult = launchRamp * arriveRamp * cornerFactor * rushMultiplier;

        const nextProg = Math.min(1, prog + (dtSec / baseDurationSec) * speedMult);
        navProgressRef.current = nextProg;

        const nextSample = sampleAt(nextProg);
        setDriverPos({ x: nextSample.x, y: nextSample.y });

        // Determine active route step + realistic UK speedometer mph
        const steps = activeRoute?.steps ?? [];
        let activeStepIdx = 0;
        for (let i = 0; i < steps.length; i++) {
          if (nextSample.wpIdx >= steps[i].waypointIndex) {
            activeStepIdx = i;
          }
        }
        const limitMph =
          activeTrip.isIntercity && !isPickup
            ? 70
            : steps[activeStepIdx]?.speedLimitMph ?? 30;
        const targetMph = nextProg >= 0.995 ? 0 : limitMph * (0.94 * speedMult);
        currentSpeedMph += (targetMph - currentSpeedMph) * (1 - Math.exp(-dtSec * 4.5));

        if (nextSample.wpIdx !== lastWpSynced) {
          lastWpSynced = nextSample.wpIdx;
          setRouteWpIdx(nextSample.wpIdx);
          if (steps.length > 0) {
            setCurrentStepIdx(activeStepIdx);
          }
        }

        if (now - lastUiSync > 180 || nextProg >= 1) {
          lastUiSync = now;
          setNavProgress(nextProg);
          setSimSpeedMph(Math.max(0, Math.round(currentSpeedMph)));
          setNavNowMs(Date.now());
        }
      }

      if (navProgressRef.current < 1) {
        rafId = requestAnimationFrame(stepFrame);
      }
    };

    rafId = requestAnimationFrame(stepFrame);
    return () => cancelAnimationFrame(rafId);
  }, [activeTrip, tripStage, activeRoute, stopVisited]);

  // Real-time dynamic ETA, turn-by-turn instruction, distance-to-turn, lanes & UK speed limit
  const liveNav = useMemo(() => {
    if (!activeTrip || (tripStage !== 'pickup' && tripStage !== 'enroute')) {
      return null;
    }

    const isPickup = tripStage === 'pickup';
    const isHeadingToStop = !isPickup && Boolean(activeTrip.stopCoords) && !stopVisited;
    const totalMiles = isPickup
      ? activeTrip.pickupMiles
      : isHeadingToStop
      ? Number((activeTrip.tripMiles * 0.45).toFixed(1))
      : activeTrip.tripMiles;
    const totalMinutes = isPickup
      ? activeTrip.pickupMinutes
      : isHeadingToStop
      ? Math.max(2, Math.round(activeTrip.tripMinutes * 0.45))
      : activeTrip.tripMinutes;
    const totalSeconds = Math.max(30, totalMinutes * 60);

    const ratioRemaining = Math.max(0, Math.min(1, 1 - navProgress));
    const progressPct = Math.round(navProgress * 100);

    const remainingSeconds = Math.max(0, Math.round(totalSeconds * ratioRemaining));
    const remainingMiles = Math.max(0, totalMiles * ratioRemaining);

    const isArriving = navProgress >= 0.97 || remainingSeconds <= 4;

    const etaCountdown = isArriving
      ? 'Arriving'
      : `${Math.floor(remainingSeconds / 60)}:${(remainingSeconds % 60)
          .toString()
          .padStart(2, '0')}`;

    const etaMinLabel = isArriving
      ? '< 1 min'
      : `${Math.max(1, Math.ceil(remainingSeconds / 60))} min`;

    const distanceRemaining = isArriving
      ? 'Arrived'
      : remainingMiles >= 0.2
      ? `${remainingMiles.toFixed(1)} mi`
      : `${Math.max(50, Math.round((remainingMiles * 1760) / 20) * 20)} yds`;

    const etaClockTime = new Date(navNowMs + remainingSeconds * 1000).toLocaleTimeString(
      'en-GB',
      { hour: '2-digit', minute: '2-digit' }
    );

    const steps = activeRoute?.steps ?? [];
    const polyCount = Math.max(2, activeRoute?.polyline.length ?? 2);
    const currentStep = steps[Math.min(currentStepIdx, Math.max(0, steps.length - 1))];
    const nextStep =
      currentStepIdx + 1 < steps.length ? steps[currentStepIdx + 1] : null;

    // Calculate distance-to-next-turn in UK yards / miles
    const nextTurnProg = nextStep
      ? Math.min(1, nextStep.waypointIndex / (polyCount - 1))
      : 1;
    const milesToTurn = Math.max(0, totalMiles * Math.max(0, nextTurnProg - navProgress));
    const distanceToTurnLabel = isArriving
      ? 'Now'
      : milesToTurn >= 0.35
      ? `${milesToTurn.toFixed(1)} mi`
      : `${Math.max(40, Math.round((milesToTurn * 1760) / 20) * 20)} yds`;

    const maneuverKind: NavManeuverKind = isArriving
      ? 'arrive'
      : currentStep?.maneuver ?? 'straight';

    const targetAddressLabel = isPickup
      ? activeTrip.pickupAddress
      : isHeadingToStop
      ? activeTrip.stopAddress || 'Stop 1'
      : activeTrip.dropoffAddress;

    const maneuverTitle = isArriving
      ? isPickup
        ? 'Arrived at pickup'
        : isHeadingToStop
        ? 'Arrived at Stop 1'
        : 'Arrived at dropoff'
      : currentStep?.instruction || `Continue toward ${targetAddressLabel}`;

    const maneuverSubtitle = isArriving
      ? targetAddressLabel
      : nextStep
      ? `Then · ${nextStep.instruction}`
      : isPickup
      ? `Pickup · ${activeTrip.pickupAddress}`
      : isHeadingToStop
      ? `Stop 1 · ${activeTrip.stopAddress}`
      : `Dropoff · ${activeTrip.dropoffAddress}`;

    const speedLimitMph = activeTrip.isIntercity && !isPickup ? 70 : currentStep?.speedLimitMph ?? 30;

    return {
      isPickup,
      isHeadingToStop,
      isArriving,
      etaCountdown,
      etaMinLabel,
      distanceRemaining,
      distanceToTurnLabel,
      etaClockTime,
      progressPct,
      remainingSeconds,
      remainingMiles,
      milesToTurn,
      maneuverKind,
      maneuverTitle,
      maneuverSubtitle,
      speedLimitMph,
      lanes: isArriving ? undefined : currentStep?.lanes,
    };
  }, [
    activeTrip,
    tripStage,
    stopVisited,
    navProgress,
    navNowMs,
    activeRoute,
    currentStepIdx,
  ]);

  // Auto-queue Back-to-Back Next Ride when 75% into final dropoff leg
  const queuedForTripIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      !activeTrip ||
      tripStage !== 'enroute' ||
      !liveNav ||
      liveNav.progressPct < 75 ||
      queuedOffer ||
      acceptedNextOffer ||
      preferences.stopNewRequests ||
      (activeTrip.stopCoords && !stopVisited) ||
      queuedForTripIdRef.current === activeTrip.id
    ) {
      return;
    }

    queuedForTripIdRef.current = activeTrip.id;
    const candidate = generateLocalTripOffer({
      anchorCoords: activeTrip.dropoffCoords,
      seedIndex: offerIndex + 1,
      includeIntercity: preferences.intercity,
      servicePrefs,
      boostBonus: activeBoostBonus,
      ccAlreadyPaidToday: ledger.ccPaidDateKey === todayDateKey,
      areaPreference: preferences.areaPreference,
      destination,
      isEV: Boolean(activeAccount?.isEV),
    });
    recordOfferReceived(candidate);
    setQueuedOffer(candidate);
    uberSounds.play(candidate.type === 'exclusive' ? 'exclusiveDispatch' : 'dispatch');
  }, [
    activeTrip,
    tripStage,
    liveNav,
    queuedOffer,
    acceptedNextOffer,
    preferences.stopNewRequests,
    preferences.intercity,
    preferences.areaPreference,
    destination,
    activeAccount?.isEV,
    servicePrefs,
    stopVisited,
    offerIndex,
    recordOfferReceived,
    activeBoostBonus,
    ledger.ccPaidDateKey,
    todayDateKey,
  ]);

  // Speed & Bus-Lane Camera proximity warning + audio chime & haptic during active UK navigation
  const nearbySpeedCamera = useMemo(() => {
    if (
      !activeTrip ||
      (tripStage !== 'pickup' && tripStage !== 'enroute') ||
      !preferences.speedCameraWarnings
    ) {
      return null;
    }
    let best: (typeof UK_SPEED_CAMERAS)[number] | null = null;
    let bestDist = 26;
    for (const cam of UK_SPEED_CAMERAS) {
      const d = Math.hypot(cam.coords.x - driverPos.x, cam.coords.y - driverPos.y);
      if (d < bestDist) {
        bestDist = d;
        best = cam;
      }
    }
    return best;
  }, [activeTrip, tripStage, preferences.speedCameraWarnings, driverPos]);

  const warnedCameraIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (nearbySpeedCamera) {
      if (warnedCameraIdRef.current !== nearbySpeedCamera.id) {
        warnedCameraIdRef.current = nearbySpeedCamera.id;
        uberSounds.play('cameraAlert');
        triggerHaptic('alert');
      }
    } else {
      warnedCameraIdRef.current = null;
    }
  }, [nearbySpeedCamera]);

  // iPhone Lock Screen & Car Bluetooth MediaSession controls
  useEffect(() => {
    const cityLabel = getResolvedLocalCityName(driverPos) || activeAccount?.city || 'London';
    carBluetoothMedia.sync(
      {
        enabled: Boolean(preferences.carBluetoothMedia),
        onlineStatus,
        tripStage,
        activeTrip,
        maneuverTitle: liveNav?.maneuverTitle,
        maneuverSubtitle: liveNav?.maneuverSubtitle,
        distanceToTurn: liveNav?.distanceToTurnLabel,
        etaMinLabel: liveNav?.etaMinLabel,
        distanceRemaining: liveNav?.distanceRemaining,
        cityLabel,
        voiceMuted: !preferences.voiceNavigation,
      },
      {
        onSpeakTurn: () => {
          const text = liveNav?.maneuverTitle
            ? `${liveNav.distanceToTurnLabel || ''} ${liveNav.maneuverTitle}`.trim()
            : onlineStatus === 'online'
            ? `You are online in ${cityLabel}, finding UK trips.`
            : 'Uber Driver is offline.';
          speakNavInstruction(text, true);
        },
        onToggleVoiceMute: () => {
          setPreferences((prev) => {
            const nextVoice = !prev.voiceNavigation;
            showToast(nextVoice ? 'Voice navigation unmuted' : 'Voice navigation muted');
            return { ...prev, voiceNavigation: nextVoice };
          });
        },
        onSpeakStatus: () => {
          const summary =
            activeTrip && liveNav
              ? `${liveNav.etaMinLabel} remaining, ${liveNav.distanceRemaining}, ${activeTrip.serviceName} trip for ${activeTrip.riderName}.`
              : onlineStatus === 'online'
              ? `Online in ${cityLabel}. Today earnings ${todayEarnings.toFixed(2)} pounds.`
              : `Offline in ${cityLabel}.`;
          speakNavInstruction(summary, true);
        },
      }
    );
  }, [
    preferences.carBluetoothMedia,
    preferences.voiceNavigation,
    onlineStatus,
    tripStage,
    activeTrip,
    liveNav,
    driverPos,
    activeAccount?.city,
    todayEarnings,
    showToast,
  ]);

  useEffect(() => {
    return () => carBluetoothMedia.stop();
  }, []);

  const totalBusinessMiles = useMemo(
    () =>
      Number(
        ledger.completedTrips
          .reduce((sum, trip) => sum + trip.distanceMiles, 0)
          .toFixed(1)
      ),
    [ledger.completedTrips]
  );

  // Complete going online (after passing or already having Face Verification)
  const completeGoOnline = useCallback(() => {
    uberSounds.unlock();
    uberSounds.play('online');
    const now = Date.now();
    setOnlineStatus('online');
    setOnlineStartedAt(now);
    setOnlineElapsedSec(0);
    setRadarOffers([]); // Trip Radar shows no job and is hidden until timer triggers
    setRadarRefreshSecLeft(60);
    setActiveTab('home');
    void startNativeOnlineBubbleService(
      getResolvedLocalCityName(driverPosRef.current),
      activeAccount?.name ?? 'Driver',
      preferences.floatingDotAlertMode ?? 'dot'
    );
    void setNativeImmersiveNavHidden(true);
    // In mobile/Samsung browsers (non-APK), hide system Back/Home navigation bar while Online
    if (
      !isNativeAndroidApk() &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(pointer: coarse)').matches &&
      !document.fullscreenElement &&
      document.documentElement?.requestFullscreen
    ) {
      void document.documentElement
        .requestFullscreen({ navigationUI: 'hide' })
        .catch(() => {});
    }
    if (isNativeAndroidApk() && !nativeBubblePerms.overlayGranted) {
      setShowPermissionsModal(true);
      showToast("Online · Tap 'Allow' on Floating Uber Dot so it shows when minimised");
      return;
    }
    showToast("You're online — Trip Radar active");
  }, [activeAccount?.name, nativeBubblePerms.overlayGranted, preferences.floatingDotAlertMode, showToast]);

  const handleToggleOnline = () => {
    uberSounds.unlock();
    if (onlineStatus === 'offline') {
      if (activeAccount?.insurancePolicy?.status === 'lapsed') {
        uberSounds.play('decline');
        showToast('Hire & Reward Insurance lapsed — renew in Menu → Vehicles & Documents');
        setActiveTab('menu');
        return;
      }
      const expiredDoc = activeAccount?.complianceDocs?.find((d) => d.status === 'expired');
      if (expiredDoc) {
        uberSounds.play('decline');
        showToast(`Renew expired ${expiredDoc.title} in Menu → Vehicles & Documents`);
        setActiveTab('menu');
        return;
      }
      const isAtDrivingCap =
        (activeAccount?.drivingMinutesUsedToday ?? 0) >= 12 * 60 ||
        ((activeAccount?.restLockedUntil ?? 0) > Date.now());
      if (isAtDrivingCap) {
        uberSounds.play('decline');
        if (activeAccount?.id && !activeAccount.restLockedUntil) {
          setAccounts((prev) =>
            prev.map((acct) =>
              acct.id === activeAccount.id
                ? { ...acct, restLockedUntil: Date.now() + 6 * 60 * 60 * 1000 }
                : acct
            )
          );
        }
        showToast('12h UK driving cap reached · Complete 6h Rest in Menu to drive');
        setActiveTab('menu');
        return;
      }
      if (!isFaceVerifiedRecently(activeAccount)) {
        setPendingGoOnlineAfterVerify(true);
        setShowFaceVerifyModal(true);
        return;
      }
      completeGoOnline();
    } else {
      const finalElapsedLabel = formatOnlineTimer(onlineElapsedSec);
      uberSounds.play('offline');
      setOnlineStatus('offline');
      setOnlineStartedAt(null);
      setOnlineElapsedSec(0);
      setIsOnBreak(false);
      setBreakSecondsLeft(0);
      setStreakCount(0);
      setPendingOffer(null);
      setShowRadarList(false);
      setRadarMatchingId(null);
      setRadarOffers([]);
      setNextOfferSecLeft(null);
      void stopNativeOnlineBubbleService();
      void setNativeImmersiveNavHidden(false);
      if (!isNativeAndroidApk() && document.fullscreenElement && document.exitFullscreen) {
        void document.exitFullscreen().catch(() => {});
      }
      showToast(`You're offline · Online ${finalElapsedLabel}`);
    }
  };

  toggleOnlineRef.current = handleToggleOnline;

  // Apple Shortcuts / Home Screen Quick Actions / Web Push notification deep links
  const pendingLaunchActionRef = useRef<ShortcutLaunchAction | null>(
    parseLaunchShortcutAction()
  );

  const runShortcutAction = useCallback(
    (action: ShortcutLaunchAction) => {
      if (action === 'online') {
        setActiveTab('home');
        if (onlineStatusRef.current === 'offline') {
          toggleOnlineRef.current();
        } else {
          showToast("You're already online");
        }
        return;
      }
      if (action === 'offline') {
        setActiveTab('home');
        if (onlineStatusRef.current === 'online') {
          toggleOnlineRef.current();
        } else {
          showToast("You're already offline");
        }
        return;
      }
      if (action === 'earnings') {
        setActiveTab('earnings');
        return;
      }
      if (action === 'reserve') {
        setActiveTab('reserve');
        return;
      }
      if (action === 'inbox') {
        setActiveTab('inbox');
        return;
      }
      if (action === 'radar') {
        setActiveTab('home');
        if (onlineStatusRef.current === 'offline') {
          showToast('Go Online to view live Trip Radar requests');
        } else {
          setShowRadarList(true);
        }
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (showBootScreen || isSignedOut || !activeAccount) return;
    const action = pendingLaunchActionRef.current;
    if (!action) return;
    pendingLaunchActionRef.current = null;
    clearLaunchShortcutParam();
    const t = window.setTimeout(() => runShortcutAction(action), 220);
    return () => window.clearTimeout(t);
  }, [showBootScreen, isSignedOut, activeAccount, runShortcutAction]);

  useEffect(() => {
    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UBER_PUSH_CLICK' && typeof event.data?.url === 'string') {
        try {
          const parsedUrl = new URL(event.data.url, window.location.origin);
          const action = parseLaunchShortcutAction(parsedUrl.search);
          if (action) {
            runShortcutAction(action);
          }
        } catch {
          // Ignore malformed notification URL
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', onSwMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', onSwMessage);
  }, [runShortcutAction]);

  const handleToggleBreak = useCallback(() => {
    if (onlineStatus !== 'online') return;
    if (isOnBreak) {
      setIsOnBreak(false);
      setBreakSecondsLeft(0);
      showToast('Break ended — finding UK trips again');
    } else {
      setIsOnBreak(true);
      setBreakSecondsLeft(20 * 60);
      setPendingOffer(null);
      showToast('Coffee Break active (20:00) · Online timer & Airport FIFO preserved');
    }
  }, [onlineStatus, isOnBreak, showToast]);

  const handleAcceptOffer = useCallback(
    (offer: TripOffer) => {
      recordOfferDecision(
        offer,
        'accepted',
        offer.id.startsWith('active-res-') ? 'reserve' : offer.type
      );
      uberSounds.unlock();
      uberSounds.play('accept');
      setLockedSurgeBonus(0);
      setLockedSurgeLabel(null);
      setPendingOffer(null);
      setShowRadarList(false);
      setRadarMatchingId(null);
      setRadarOffers([]);
      setQueuedOffer(null);
      setAcceptedNextOffer(null);
      setStopVisited(false);
      setActiveTrip(offer);
      setTripWaitFee(0);

      // Slightly improve Acceptance Rate when accepting Exclusive offers
      if (offer.type === 'exclusive' && activeAccount?.id) {
        setAccounts((prev) =>
          prev.map((acct) =>
            acct.id === activeAccount.id
              ? { ...acct, acceptanceRate: Math.min(100, acct.acceptanceRate + 1) }
              : acct
          )
        );
      }

      const initialDist = Math.max(
        20,
        Math.hypot(offer.pickupCoords.x - driverPosRef.current.x, offer.pickupCoords.y - driverPosRef.current.y)
      );
      setLegStartDistPx(initialDist);
      setNavNowMs(Date.now());
      setTripStage('pickup');
      setActiveTab('home');
      setRecenterSignal((s) => s + 1);
    },
    [activeAccount?.id, recordOfferDecision]
  );

  const handleDispatchIntercity = useCallback(() => {
    if (!preferences.intercity) {
      setPreferences((p) => ({ ...p, intercity: true }));
    }
    const offer = generateLocalTripOffer({
      anchorCoords: driverPosRef.current,
      realLatLng: getActiveGpsLatLng(),
      seedIndex: intercityIdx,
      forceIntercity: true,
      includeIntercity: true,
      servicePrefs,
      surgeLockedBonus: lockedSurgeBonus,
      boostBonus: activeBoostBonus,
      ccAlreadyPaidToday: ledger.ccPaidDateKey === todayDateKey,
      isEV: Boolean(activeAccount?.isEV),
      acceptCashJobs: preferences.acceptCashJobs ?? true,
    });
    setIntercityIdx((i) => i + 1);
    if (onlineStatus === 'offline') {
      setOnlineStatus('online');
      setOnlineStartedAt(Date.now());
      setOnlineElapsedSec(0);
    }
    setShowRadarList(false);
    recordOfferReceived(offer);
    setPendingOffer(offer);
    setActiveTab('home');
    setRecenterSignal((s) => s + 1);
    uberSounds.unlock();
    showToast(
      `Intercity dispatch: ${offer.pickupArea} → ${offer.dropoffArea.split('·')[0].trim()}`
    );
  }, [
    intercityIdx,
    onlineStatus,
    preferences.intercity,
    servicePrefs,
    lockedSurgeBonus,
    activeBoostBonus,
    ledger.ccPaidDateKey,
    todayDateKey,
    activeAccount?.isEV,
    showToast,
    getActiveGpsLatLng,
    recordOfferReceived,
  ]);

  const handleRechargeVehicle = useCallback(() => {
    if (!activeAccount?.id) return;
    setAccounts((prev) =>
      prev.map((acct) =>
        acct.id === activeAccount.id ? { ...acct, batteryPct: 100 } : acct
      )
    );
    showToast(
      activeAccount.isEV
        ? 'EV battery rapid-charged to 100% (~250 mi range)'
        : 'Fuel tank refuelled to 100% (~420 mi range)'
    );
  }, [activeAccount?.id, activeAccount?.isEV, showToast]);

  const handleSelectCharge = useCallback(
    (payload: {
      label: string;
      category: 'charging' | 'fuel';
      amount: number;
      kwhOrLitres: number;
    }) => {
      if (!activeAccount?.id) return;
      const currentKey = getLocalDateKey();
      const timeLabel = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const entry: ExpenseEntry = {
        id: `exp-${Date.now()}`,
        label: payload.label,
        category: payload.category,
        amount: payload.amount,
        kwhOrLitres: payload.kwhOrLitres,
        dateKey: currentKey,
        timestamp: timeLabel,
      };
      setAccounts((prev) =>
        prev.map((acct) =>
          acct.id === activeAccount.id ? { ...acct, batteryPct: 100 } : acct
        )
      );
      setLedger((prev) => ({
        ...prev,
        expenses: [entry, ...(prev.expenses ?? [])].slice(0, 60),
      }));
      showToast(
        `${payload.category === 'fuel' ? 'Refuelled' : 'Charged'} to 100% · −£${payload.amount.toFixed(2)} expense logged`
      );
    },
    [activeAccount?.id, showToast]
  );

  const handleTakeFasterRoute = useCallback(() => {
    if (!activeTrip || !trafficAlert) return;
    const saved = trafficAlert.routeSavedMin;
    setActiveTrip((prev) =>
      prev
        ? {
            ...prev,
            tripMinutes: Math.max(2, prev.tripMinutes - saved),
            trafficDelayMin: undefined,
          }
        : null
    );
    setTrafficAlert(null);
    uberSounds.play('accept');
    showToast(`Rerouted around congestion · Saved ${saved} min`);
  }, [activeTrip, trafficAlert, showToast]);

  const handleAcceptRiderChange = useCallback(() => {
    if (!activeTrip || !riderChangeOffer) return;
    uberSounds.play('accept');
    setActiveTrip((prev) => {
      if (!prev) return null;
      const nextFare = Number((prev.fare + riderChangeOffer.extraFare).toFixed(2));
      const nextMiles = Number((prev.tripMiles + riderChangeOffer.extraMiles).toFixed(1));
      const nextMin = prev.tripMinutes + riderChangeOffer.extraMin;
      if (riderChangeOffer.kind === 'stop') {
        return {
          ...prev,
          fare: nextFare,
          tripMiles: nextMiles,
          tripMinutes: nextMin,
          stopAddress: riderChangeOffer.nextAddress,
          stopCoords: riderChangeOffer.nextCoords,
        };
      }
      return {
        ...prev,
        fare: nextFare,
        tripMiles: nextMiles,
        tripMinutes: nextMin,
        dropoffAddress: riderChangeOffer.nextAddress,
        dropoffCoords: riderChangeOffer.nextCoords,
      };
    });
    showToast(
      `Rider update accepted · +£${riderChangeOffer.extraFare.toFixed(2)} added`
    );
    setRiderChangeOffer(null);
  }, [activeTrip, riderChangeOffer, showToast]);

  const handleDeclineRiderChange = useCallback(() => {
    uberSounds.play('decline');
    setRiderChangeOffer(null);
    showToast('Kept original destination route');
  }, [showToast]);

  const handleAcceptStackedEats = useCallback(() => {
    if (!activeTrip || !stackedEatsOffer) return;
    uberSounds.play('accept');
    setActiveTrip((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        fare: Number((prev.fare + stackedEatsOffer.extraFare).toFixed(2)),
        tripMiles: Number((prev.tripMiles + stackedEatsOffer.extraMiles).toFixed(1)),
        tripMinutes: prev.tripMinutes + stackedEatsOffer.extraMin,
        stopAddress: stackedEatsOffer.stopAddress,
        stopCoords: stackedEatsOffer.stopCoords,
        eatsOrderCode: `${prev.eatsOrderCode || '#UE-MAIN'} + ${stackedEatsOffer.orderCode}`,
      };
    });
    showToast(`Stacked ${stackedEatsOffer.restaurantName} · +£${stackedEatsOffer.extraFare.toFixed(2)}`);
    setStackedEatsOffer(null);
  }, [activeTrip, stackedEatsOffer, showToast]);

  const handleDeclineStackedEats = useCallback(() => {
    uberSounds.play('decline');
    setStackedEatsOffer(null);
    showToast('Kept single Uber Eats order');
  }, [showToast]);

  const handleMoveToRadarMatch = useCallback(
    (offer: TripOffer) => {
      uberSounds.unlock();
      recordOfferReceived(offer);
      setPendingOffer(null);
      setRadarOffers([offer]);
      setRadarMatchingId(offer.id);
      setShowRadarList(true);
      showToast('Sent to Trip Radar — matching for 10s...');
    },
    [showToast, recordOfferReceived]
  );

  const handleRadarMatchFailed = useCallback(
    (failedOffer: TripOffer) => {
      recordOfferDecision(failedOffer, 'radar_lost', 'radar');
      uberSounds.play('decline');
      setRadarMatchingId(null);
      setRadarOffers([]);
      setShowRadarList(false);
      const next = generateLocalTripOffer({
        anchorCoords: driverPosRef.current,
        realLatLng: getActiveGpsLatLng(),
        seedIndex: offerIndex + 1,
        includeIntercity: preferences.intercity,
        servicePrefs,
        surgeLockedBonus: lockedSurgeBonus,
        boostBonus: activeBoostBonus,
        ccAlreadyPaidToday: ledger.ccPaidDateKey === todayDateKey,
        areaPreference: preferences.areaPreference,
        destination,
        isEV: Boolean(activeAccount?.isEV),
      });
      setOfferIndex((i) => i + 1);
      showToast('Another driver matched — loading next available job...');
      setTimeout(() => {
        if (onlineStatus === 'online' && tripStageRef.current === 'idle') {
          recordOfferReceived(next);
          setPendingOffer(next);
        }
      }, 700);
    },
    [
      onlineStatus,
      preferences.intercity,
      preferences.areaPreference,
      destination,
      activeAccount?.isEV,
      servicePrefs,
      offerIndex,
      lockedSurgeBonus,
      activeBoostBonus,
      ledger.ccPaidDateKey,
      todayDateKey,
      showToast,
      getActiveGpsLatLng,
      recordOfferDecision,
      recordOfferReceived,
    ]
  );

  const handleDeclineOffer = useCallback(
    (offer: TripOffer) => {
      recordOfferDecision(offer, 'declined');
      uberSounds.play('decline');
      setPendingOffer(null);
      setRadarMatchingId(null);
      if (offer.type === 'exclusive' && activeAccount?.id) {
        setStreakCount(0);
        setAccounts((prev) =>
          prev.map((acct) =>
            acct.id === activeAccount.id
              ? { ...acct, acceptanceRate: Math.max(50, acct.acceptanceRate - 1) }
              : acct
          )
        );
        showToast(
          streakCount > 0
            ? 'Exclusive declined · Streak reset & acceptance updated'
            : 'Exclusive declined · Acceptance rate updated'
        );
      } else {
        showToast('Request declined');
      }
    },
    [activeAccount?.id, showToast, recordOfferDecision, streakCount]
  );

  const handleAcceptReserve = useCallback(
    (trip: ReserveTrip) => {
      uberSounds.unlock();
      uberSounds.play('accept');
      const scheduledTrip: ReserveTrip = { ...trip, status: 'scheduled' };
      setAcceptedReserveIds((prev) => [...prev, trip.id]);
      setScheduledReserves((prev) => {
        if (prev.some((r) => r.id === trip.id)) return prev;
        return [scheduledTrip, ...prev].sort(
          (a, b) => a.scheduledAtMs - b.scheduledAtMs
        );
      });
      if (googleUser?.emailVerified) {
        void syncWithOfflineQueue(
          {
            kind: 'reserve_booking',
            dedupeKey: `res:${scheduledTrip.id}:scheduled`,
            uid: googleUser.uid,
            payload: { reserve: scheduledTrip },
          },
          () => syncReserveBooking(googleUser.uid, scheduledTrip)
        );
      }
      showToast(`Reserve confirmed · ${trip.dayLabel}, ${trip.timeLabel}`);
    },
    [googleUser?.emailVerified, googleUser?.uid, syncWithOfflineQueue, showToast]
  );

  const handleCancelReserve = useCallback(
    (tripId: string) => {
      uberSounds.play('decline');
      const target = scheduledReserves.find((r) => r.id === tripId);
      setScheduledReserves((prev) => prev.filter((r) => r.id !== tripId));
      if (target && googleUser?.emailVerified) {
        void syncWithOfflineQueue(
          {
            kind: 'reserve_booking',
            dedupeKey: `res:${target.id}:cancelled`,
            uid: googleUser.uid,
            payload: { reserve: target, statusOverride: 'cancelled' },
          },
          () => syncReserveBooking(googleUser.uid, target, 'cancelled')
        );
      }
      showToast('Reserve trip cancelled');
    },
    [scheduledReserves, googleUser?.emailVerified, googleUser?.uid, syncWithOfflineQueue, showToast]
  );

  const handleRefreshReserves = useCallback(() => {
    setAcceptedReserveIds([]);
    setReserveSeed((s) => s + 6);
    showToast(`Refreshed Uber Reserve trips near ${getResolvedLocalCityName(driverPosRef.current)}`);
  }, [showToast]);

  const handleStartReserveTrip = useCallback(
    (trip: ReserveTrip) => {
      uberSounds.unlock();
      if (onlineStatus === 'offline') {
        setOnlineStatus('online');
        void startNativeOnlineBubbleService(
          getResolvedLocalCityName(driverPosRef.current),
          activeAccount?.name ?? 'Driver',
          preferences.floatingDotAlertMode ?? 'dot'
        );
        void setNativeImmersiveNavHidden(true);
      }
      setScheduledReserves((prev) => prev.filter((r) => r.id !== trip.id));
      if (googleUser?.emailVerified) {
        void syncWithOfflineQueue(
          {
            kind: 'reserve_booking',
            dedupeKey: `res:${trip.id}:completed`,
            uid: googleUser.uid,
            payload: { reserve: trip, statusOverride: 'completed' },
          },
          () => syncReserveBooking(googleUser.uid, trip, 'completed')
        );
      }
      const convertedOffer: TripOffer = {
        id: `active-${trip.id}`,
        type: 'exclusive',
        serviceName: trip.serviceName,
        fare: trip.estimatedFare,
        rating: trip.rating,
        riderName: trip.riderName,
        riderTrips: trip.riderTrips,
        pickupMinutes: trip.pickupMinutes,
        pickupMiles: trip.pickupMiles,
        pickupAddress: trip.pickupAddress,
        pickupArea: trip.pickupArea,
        tripMinutes: trip.tripMinutes,
        tripMiles: trip.tripMiles,
        dropoffAddress: trip.dropoffAddress,
        dropoffArea: trip.dropoffArea,
        pickupCoords: trip.pickupCoords,
        dropoffCoords: trip.dropoffCoords,
        surgeBonus: trip.reserveFee,
        boostBonus: activeBoostBonus,
        pinCode: trip.pinCode,
        surchargeLabel: 'Uber Reserve Fee',
        surchargeAmount: trip.reserveFee,
        riderNote: trip.riderNote,
        expiresInSec: 30,
      };
      handleAcceptOffer(convertedOffer);
      showToast(`Starting Uber Reserve pickup · ${trip.pickupAddress}`);
    },
    [
      onlineStatus,
      activeAccount?.name,
      preferences.floatingDotAlertMode,
      activeBoostBonus,
      googleUser?.emailVerified,
      googleUser?.uid,
      runCloudSync,
      handleAcceptOffer,
      showToast,
    ]
  );

  nativeActionHandlersRef.current = {
    accept: handleAcceptOffer,
    decline: handleDeclineOffer,
    radarMatch: handleMoveToRadarMatch,
  };

  const handleDeclineRadarItem = useCallback(
    (offer: TripOffer) => {
      recordOfferDecision(offer, 'declined', 'radar');
      uberSounds.play('decline');
      setRadarMatchingId(null);
      setRadarOffers((prev) => {
        const nextList = prev.filter((item) => item.id !== offer.id);
        if (nextList.length === 0) {
          setShowRadarList(false);
        }
        return nextList;
      });
      showToast(`Declined ${offer.serviceName} (£${offer.fare.toFixed(2)})`);
    },
    [showToast, recordOfferDecision]
  );

  const handleArrivePickup = () => {
    if (!activeTrip) return;
    setDriverPos(activeTrip.pickupCoords);
    setTripStage('waiting');
  };

  const handleStartTrip = (waitFeeAccrued = 0) => {
    uberSounds.unlock();
    uberSounds.play('startTrip');
    setTripWaitFee(waitFeeAccrued);
    if (activeTrip) {
      const nextTarget =
        activeTrip.stopCoords && !stopVisited
          ? activeTrip.stopCoords
          : activeTrip.dropoffCoords;
      const initialDropoffDist = Math.max(
        20,
        Math.hypot(
          nextTarget.x - activeTrip.pickupCoords.x,
          nextTarget.y - activeTrip.pickupCoords.y
        )
      );
      setLegStartDistPx(initialDropoffDist);
      setNavNowMs(Date.now());
    }
    setTripStage('enroute');
    setRecenterSignal((s) => s + 1);
  };

  const handleArriveStop = () => {
    if (!activeTrip?.stopCoords) return;
    setDriverPos(activeTrip.stopCoords);
    setStopVisited(true);
    setTripStage('stop_wait');
    showToast('Arrived at Stop 1 · Waiting for rider');
  };

  const handleContinueFromStop = () => {
    if (!activeTrip) return;
    uberSounds.play('startTrip');
    const fromCoords = activeTrip.stopCoords ?? activeTrip.pickupCoords;
    const remainingDist = Math.max(
      20,
      Math.hypot(
        activeTrip.dropoffCoords.x - fromCoords.x,
        activeTrip.dropoffCoords.y - fromCoords.y
      )
    );
    setLegStartDistPx(remainingDist);
    setNavNowMs(Date.now());
    setTripStage('enroute');
    setRecenterSignal((s) => s + 1);
  };

  const handleArriveDropoff = () => {
    if (!activeTrip) return;
    setDriverPos(activeTrip.dropoffCoords);
    setTripStage('dropoff_arrived');
  };

  const handleCompleteTrip = (meteredFinalFare?: number) => {
    if (!activeTrip) return;
    uberSounds.unlock();
    uberSounds.play('completeTrip');
    triggerHaptic('accept');
    const currentKey = getLocalDateKey();
    setTodayDateKey(currentKey);
    setTrafficAlert(null);
    setRiderChangeOffer(null);

    const effectiveFare =
      activeTrip.isMeteredFare && typeof meteredFinalFare === 'number' && meteredFinalFare > 0
        ? Number(meteredFinalFare.toFixed(2))
        : activeTrip.fare;

    const tipAmt = activeTrip.riderName === 'Joséfina' ? 2.5 : activeTrip.isIntercity ? 5.0 : 0;
    const surcharge = activeTrip.surchargeAmount ?? 0;
    const boostBonus = activeTrip.boostBonus ?? 0;
    const waitFee = tripWaitFee;
    const uberFee = Number((Math.max(0, effectiveFare - surcharge) * 0.25).toFixed(2));
    const totalGross = Number((effectiveFare + waitFee + tipAmt).toFixed(2));
    const netPayout = Number((totalGross - uberFee).toFixed(2));

    const timeLabel = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newRecord: CompletedTrip = {
      id: `trip-${Date.now()}`,
      riderName: activeTrip.riderName,
      serviceName: activeTrip.serviceName,
      fare: effectiveFare,
      tip: tipAmt,
      waitFee,
      surchargeAmount: surcharge,
      surchargeLabel: activeTrip.surchargeLabel,
      uberFee,
      netPayout,
      boostBonus: boostBonus > 0 ? boostBonus : undefined,
      tollOrZoneFee: surcharge > 0 ? surcharge : undefined,
      distanceMiles: activeTrip.tripMiles,
      durationMin: activeTrip.tripMinutes,
      pickupArea: activeTrip.pickupArea.split(',')[0],
      dropoffArea: activeTrip.dropoffArea.split('·')[0].split(',')[0].trim(),
      completedAt: `Today, ${timeLabel}`,
      dateKey: currentKey,
      isIntercity: activeTrip.isIntercity,
      paymentMethod: activeTrip.paymentMethod ?? 'card',
      isMeteredFare: activeTrip.isMeteredFare,
      meteredFare: activeTrip.isMeteredFare ? effectiveFare : undefined,
      merchantName: activeTrip.merchantName,
      merchantCategory: activeTrip.merchantCategory,
      peakPeriod: demandContext.isPeakBoostHours || demandContext.demandLevel === 'Night Surge',
    };

    const questEnrolled = enrolledOppIds.includes('opp-1');
    let questBonusAwarded = 0;
    let streakBonusAwarded = 0;
    if (onlineStatus === 'online') {
      const nextStreak = streakCount + 1;
      if (nextStreak >= 3) {
        streakBonusAwarded = 12.0;
        setStreakCount(0);
      } else {
        setStreakCount(nextStreak);
      }
    }
    const holidayAdd = Number(((Math.max(0, netPayout - tipAmt)) * 0.1207).toFixed(2));

    setLedger((prev) => {
      const nextQuestCount = prev.questCompletedCount + 1;
      const nextCycle = Math.floor(nextQuestCount / 20);
      const prevCycle = prev.questPaidCycleCount ?? 0;
      const awarded = questEnrolled && nextQuestCount >= 20 && nextCycle > prevCycle ? 190.0 : 0;
      questBonusAwarded = awarded;

      const ccTriggered = Boolean(activeTrip.inLondonCC) && prev.ccPaidDateKey !== currentKey;
      const zoneResult = detectUKZoneSurcharge(
        activeTrip.pickupCoords,
        activeTrip.dropoffCoords,
        prev.ccPaidDateKey === currentKey,
        Boolean(activeAccount?.isEV)
      );
      const addedExpenses: ExpenseEntry[] = [];
      if (ccTriggered) {
        addedExpenses.push({
          id: `exp-cc-${Date.now()}`,
          label: 'Central London Congestion Charge · Daily Pass',
          category: 'congestion',
          amount: 15.0,
          dateKey: currentKey,
          timestamp: timeLabel,
        });
      }
      if (zoneResult.zoneExpenseAmount && zoneResult.zoneExpenseLabel && zoneResult.zoneExpenseCategory) {
        addedExpenses.push({
          id: `exp-zone-${Date.now() + 1}`,
          label: zoneResult.zoneExpenseLabel,
          category: zoneResult.zoneExpenseCategory,
          amount: zoneResult.zoneExpenseAmount,
          dateKey: currentKey,
          timestamp: timeLabel,
        });
      }
      const nextExpenses =
        addedExpenses.length > 0
          ? [...addedExpenses, ...(prev.expenses ?? [])].slice(0, 60)
          : prev.expenses ?? [];

      return {
        ...prev,
        dailyTotals: {
          ...prev.dailyTotals,
          [currentKey]: Number(
            ((prev.dailyTotals[currentKey] ?? 0) + netPayout + awarded + streakBonusAwarded).toFixed(2)
          ),
        },
        walletBalance: Number((prev.walletBalance + netPayout + awarded + streakBonusAwarded).toFixed(2)),
        proPoints: prev.proPoints + (activeTrip.isIntercity ? 30 : 12),
        questCompletedCount: nextQuestCount,
        questPaidCycleCount: awarded > 0 ? nextCycle : prevCycle,
        ccPaidDateKey: ccTriggered ? currentKey : prev.ccPaidDateKey,
        holidayPayAccrued: Number(((prev.holidayPayAccrued ?? 0) + holidayAdd).toFixed(2)),
        engagedMinutesTotal: (prev.engagedMinutesTotal ?? 42) + activeTrip.tripMinutes,
        expenses: nextExpenses,
        completedTrips: [newRecord, ...prev.completedTrips],
      };
    });

    if (googleUser?.emailVerified) {
      void syncWithOfflineQueue(
        {
          kind: 'completed_trip',
          dedupeKey: `trip:${newRecord.id}`,
          uid: googleUser.uid,
          payload: newRecord,
        },
        () => syncCompletedTrip(googleUser.uid, newRecord)
      );
    }

    if (questBonusAwarded > 0) {
      pushDriverAlert(
        'Weekend Quest Completed! +£190.00',
        '20/20 trips completed — bonus credited to wallet & today’s earnings',
        `quest-${Date.now()}`,
        () => setActiveTab('earnings')
      );
    }

    if (streakBonusAwarded > 0) {
      pushDriverAlert(
        '3-Trip Streak Completed! +£12.00',
        'Consecutive trip series bonus credited to wallet & today’s earnings',
        `streak-${Date.now()}`,
        () => setActiveTab('earnings')
      );
    }

    // Drain EV battery / fuel based on trip distance + alert when <= 20%
    if (activeAccount?.id) {
      const drainPct = Math.max(1, Math.round(activeTrip.tripMiles / 2.5));
      const nextPct = Math.max(5, (activeAccount.batteryPct ?? 84) - drainPct);
      setAccounts((prev) =>
        prev.map((acct) =>
          acct.id === activeAccount.id ? { ...acct, batteryPct: nextPct } : acct
        )
      );
      if (nextPct <= 20) {
        pushDriverAlert(
          activeAccount.isEV ? `Low EV range (${nextPct}%)` : `Low fuel range (${nextPct}%)`,
          activeAccount.isEV
            ? 'Tap to locate nearby UK rapid chargers & hubs'
            : 'Tap to locate nearby Shell, BP & Tesco Extra forecourts',
          'low-battery',
          () => setShowChargersModal(true)
        );
      }
    }

    pushDriverAlert(
      `Trip complete · +£${netPayout.toFixed(2)} net`,
      'Saved to today’s real earnings ledger until midnight',
      `done-${newRecord.id}`,
      () => setActiveTab('earnings')
    );

    // Delayed Post-Trip Rider Tip (15-28s later)
    if (tipAmt === 0 && Math.random() < 0.45) {
      const delayedTip = Number((2.0 + Math.floor(Math.random() * 5) * 0.75).toFixed(2));
      const delayedDelayMs = 15000 + Math.floor(Math.random() * 13000);
      const riderLabel = activeTrip.riderName;
      const targetTripId = newRecord.id;
      const tipTimer = window.setTimeout(() => {
        setLedger((prev) => ({
          ...prev,
          dailyTotals: {
            ...prev.dailyTotals,
            [currentKey]: Number(((prev.dailyTotals[currentKey] ?? 0) + delayedTip).toFixed(2)),
          },
          walletBalance: Number((prev.walletBalance + delayedTip).toFixed(2)),
          completedTrips: prev.completedTrips.map((item) =>
            item.id === targetTripId
              ? {
                  ...item,
                  tip: Number((item.tip + delayedTip).toFixed(2)),
                  netPayout: Number(((item.netPayout ?? netPayout) + delayedTip).toFixed(2)),
                }
              : item
          ),
        }));
        uberSounds.play('completeTrip');
        pushDriverAlert(
          `${riderLabel} added a £${delayedTip.toFixed(2)} tip!`,
          'Post-trip tip credited directly to your wallet & today’s earnings',
          `tip-${targetTripId}`,
          () => setActiveTab('earnings')
        );
      }, delayedDelayMs);
      delayedTipTimersRef.current.push(tipTimer);
    }

    // Delayed 5★ Rider Compliment Badge (6-9s later, 55% chance)
    if (Math.random() < 0.55) {
      const badgePool = [
        { key: 'spotlessCar' as const, label: 'Spotless Car' },
        { key: 'expertNavigation' as const, label: 'Expert Navigation' },
        { key: 'greatConversation' as const, label: 'Great Conversation' },
        { key: 'aboveAndBeyond' as const, label: 'Above & Beyond' },
      ];
      const chosen = badgePool[Math.floor(Math.random() * badgePool.length)];
      const riderLabel = activeTrip.riderName;
      const compTimer = window.setTimeout(() => {
        setLedger((prev) => {
          const baseComp = prev.compliments ?? { ...DEFAULT_COMPLIMENTS };
          return {
            ...prev,
            compliments: {
              ...baseComp,
              [chosen.key]: baseComp[chosen.key] + 1,
            },
          };
        });
        pushDriverAlert(
          `${riderLabel} left 5★ · ${chosen.label}`,
          'Added to your Uber Pro rider compliment badges',
          `comp-${newRecord.id}`,
          () => setActiveTab('menu')
        );
      }, 6500 + Math.floor(Math.random() * 2500));
      delayedTipTimersRef.current.push(compTimer);
    }

    // Occasional Auto Lost Property Report (14% chance for non-Eats rides)
    if (activeTrip.serviceName !== 'Uber Eats' && Math.random() < 0.14) {
      const items = [
        'iPhone 15 Pro Max',
        'Black Leather Wallet',
        'AirPods Pro Case',
        'House Keys on Fob',
      ];
      const itemLabel = items[Math.floor(Math.random() * items.length)];
      const riderLabel = activeTrip.riderName;
      const lostTripId = newRecord.id;
      const lostTimer = window.setTimeout(() => {
        const lostThread: InboxThread = {
          id: `thread-auto-lost-${lostTripId}`,
          tab: 'support',
          title: `Lost Item · ${itemLabel} (${riderLabel})`,
          preview: 'Tap to confirm return for +£15.00 UK return fee',
          timeAgo: 'Just now',
          statusText: 'Action required',
          unread: true,
          iconType: 'chat',
          lostItemReturn: {
            tripId: lostTripId,
            riderName: riderLabel,
            itemLabel,
            feeAmount: 15.0,
            returned: false,
          },
          messages: [
            {
              id: `msg-auto-lost-${lostTripId}`,
              sender: 'agent',
              text: `${riderLabel} reported leaving their ${itemLabel} in your vehicle after your trip. Tap below once returned to receive the £15.00 UK Lost Property return fee.`,
              timestamp: 'Just now',
            },
          ],
        };
        setInboxThreads((prev) => [lostThread, ...prev]);
        pushDriverAlert(
          `${riderLabel} left ${itemLabel} in vehicle`,
          'Open Inbox to confirm return for +£15.00 UK return fee',
          `lost-${lostTripId}`,
          () => setActiveTab('inbox')
        );
      }, 19000 + Math.floor(Math.random() * 6000));
      delayedTipTimersRef.current.push(lostTimer);
    }

    setStackedEatsOffer(null);
    setTripStage('completed');
  };

  nativeTripHandlersRef.current = {
    arrivePickup: handleArrivePickup,
    startTrip: () => handleStartTrip(tripWaitFee),
    arriveStop: handleArriveStop,
    continueFromStop: handleContinueFromStop,
    arriveDropoff: handleArriveDropoff,
    completeTrip: () => handleCompleteTrip(),
  };

  const offerExpiryRef = useRef<{ offerId: string; expiresAtMs: number }>({
    offerId: '',
    expiresAtMs: 0,
  });

  // Keep real Android Auto head unit screen & navigation map synced in real time
  useEffect(() => {
    if (!isNativeAndroidApk()) return;

    if (pendingOffer) {
      if (offerExpiryRef.current.offerId !== pendingOffer.id) {
        offerExpiryRef.current = {
          offerId: pendingOffer.id,
          expiresAtMs: Date.now() + Math.max(5, pendingOffer.expiresInSec || 15) * 1000,
        };
      }
    } else if (offerExpiryRef.current.offerId) {
      offerExpiryRef.current = { offerId: '', expiresAtMs: 0 };
    }

    const cityLabel = getResolvedLocalCityName(driverPos) || activeAccount?.city || 'London';
    const rawPoly = activeRoute?.polyline ?? [];
    let routePoints: Array<[number, number]> = [];
    if (rawPoly.length > 0) {
      const stride = Math.max(1, Math.floor(rawPoly.length / 44));
      routePoints = rawPoly
        .filter((_, idx) => idx % stride === 0 || idx === rawPoly.length - 1)
        .map((pt) => [Number(pt.x.toFixed(2)), Number(pt.y.toFixed(2))]);
    }

    const surgePoints: Array<[number, number, string]> = INITIAL_SURGE_ZONES.map((z) => [
      Number(z.coords.x.toFixed(2)),
      Number(z.coords.y.toFixed(2)),
      z.label,
    ]);

    void syncAndroidAutoState({
      online: onlineStatus === 'online',
      city: cityLabel,
      driverName: activeAccount?.name ?? 'Uber Driver UK',
      earningsText: privacyHidden ? '£••••' : `£${todayEarnings.toFixed(2)}`,
      questStreakText: `Quest ${Math.min(ledger.questCompletedCount, 20)}/20 · Streak ${streakCount}/3`,
      demandText: `${demandContext.demandLevel} · ${weatherCondition}`,
      tripStage,
      driverX: driverPos.x,
      driverY: driverPos.y,
      driverHeading,
      hasOffer: Boolean(pendingOffer && tripStage === 'idle'),
      offerId: pendingOffer?.id ?? '',
      offerJson: pendingOffer ? JSON.stringify(pendingOffer) : '',
      offerType: pendingOffer?.type ?? 'exclusive',
      offerServiceName: pendingOffer?.serviceName ?? 'UberX',
      offerFareText: pendingOffer ? `£${pendingOffer.fare.toFixed(2)}` : '£0.00',
      offerRatingText: pendingOffer ? pendingOffer.rating.toFixed(2) : '4.92',
      offerPickupMin: pendingOffer?.pickupMinutes ?? 4,
      offerPickupMiles: pendingOffer?.pickupMiles ?? 1.1,
      offerPickupAddress: pendingOffer?.pickupAddress ?? '',
      offerTripMin: pendingOffer?.tripMinutes ?? 15,
      offerTripMiles: pendingOffer?.tripMiles ?? 4.2,
      offerDropoffAddress: pendingOffer?.dropoffAddress ?? '',
      offerSurchargeLabel: pendingOffer?.surchargeLabel ?? '',
      offerExpiresAtMs: pendingOffer ? offerExpiryRef.current.expiresAtMs : 0,
      activeTripId: activeTrip?.id ?? '',
      activeServiceName: activeTrip?.serviceName ?? 'UberX',
      activeRiderName: activeTrip?.riderName ?? 'Rider',
      activeFareText: activeTrip ? `£${activeTrip.fare.toFixed(2)}` : '£0.00',
      activePickupAddress: activeTrip?.pickupAddress ?? '',
      activeStopAddress: activeTrip?.stopAddress ?? '',
      activeDropoffAddress: activeTrip?.dropoffAddress ?? '',
      activeStopVisited: stopVisited,
      activePinCode: activeTrip?.pinCode ?? '',
      etaMinLabel: liveNav?.etaMinLabel ?? '',
      distanceRemaining: liveNav?.distanceRemaining ?? '',
      remainingSeconds: liveNav?.remainingSeconds ?? 0,
      remainingMiles: liveNav?.remainingMiles ?? 0,
      milesToTurn: liveNav?.milesToTurn ?? 0,
      maneuverKind: liveNav?.maneuverKind ?? 'straight',
      maneuverTitle: liveNav?.maneuverTitle ?? '',
      maneuverSubtitle: liveNav?.maneuverSubtitle ?? '',
      speedLimitMph: liveNav?.speedLimitMph ?? 30,
      routePoints,
      surgePoints,
      pickupX: activeTrip?.pickupCoords.x ?? 0,
      pickupY: activeTrip?.pickupCoords.y ?? 0,
      stopX: activeTrip?.stopCoords?.x ?? 0,
      stopY: activeTrip?.stopCoords?.y ?? 0,
      dropoffX: activeTrip?.dropoffCoords.x ?? 0,
      dropoffY: activeTrip?.dropoffCoords.y ?? 0,
      hasStopCoords: Boolean(activeTrip?.stopCoords),
    });
  }, [
    onlineStatus,
    driverPos,
    driverHeading,
    activeAccount?.city,
    activeAccount?.name,
    privacyHidden,
    todayEarnings,
    ledger.questCompletedCount,
    streakCount,
    demandContext.demandLevel,
    weatherCondition,
    tripStage,
    pendingOffer,
    activeTrip,
    stopVisited,
    liveNav,
    activeRoute,
  ]);

  const handleSubmitRating = (_stars: number, tags: string[] = []) => {
    if (tags.length > 0) {
      setLedger((prev) => {
        const [latest, ...rest] = prev.completedTrips;
        if (!latest) return prev;
        return {
          ...prev,
          completedTrips: [{ ...latest, tags }, ...rest],
        };
      });
    }

    if (tags.includes('Left item') && activeTrip) {
      const lostThread: InboxThread = {
        id: `thread-lost-${Date.now()}`,
        tab: 'support',
        title: `Lost item return (${activeTrip.riderName})`,
        preview: 'Return item for £15.00 UK return fee',
        timeAgo: 'Just now',
        statusText: 'Action required',
        unread: true,
        iconType: 'chat',
        lostItemReturn: {
          tripId: activeTrip.id,
          riderName: activeTrip.riderName,
          itemLabel: 'Personal item left on rear seat',
          feeAmount: 15.0,
          returned: false,
        },
        messages: [
          {
            id: `msg-lost-${Date.now()}`,
            sender: 'agent',
            text: `You flagged a left item from your ${activeTrip.serviceName} trip with ${activeTrip.riderName}. Coordinate return in-app to receive the £15.00 UK returned-item fee.`,
            timestamp: 'Just now',
          },
        ],
      };
      setInboxThreads((prev) => [lostThread, ...prev]);
      showToast('Lost item thread opened in Inbox (+£15.00 return fee eligible)');
    }

    // Anchor driver position to the previous job's dropoff area so GPS watch does not pull them back
    let arrivedAtDestinationTarget = false;
    if (activeTrip) {
      const dropoffCoords = activeTrip.dropoffCoords;
      anchoredToLastJobRef.current = true;
      driverPosRef.current = dropoffCoords;
      setDriverPos(dropoffCoords);
      const dropLatLng = mapToLatLng(dropoffCoords);
      void prefetchLocalPlaces(dropLatLng.lat, dropLatLng.lng).then(() => {
        setLocalGeoVersion((v) => v + 1);
      });

      if (destination.active) {
        const destLatLng = mapToLatLng(destination.coords);
        if (haversineMiles(dropLatLng.lat, dropLatLng.lng, destLatLng.lat, destLatLng.lng) <= 2.2) {
          arrivedAtDestinationTarget = true;
          setDestination(DEFAULT_DESTINATION);
        }
      }
    }

    const nextQueued = acceptedNextOffer;
    setActiveTrip(null);
    setActiveRoute(null);
    setTripWaitFee(0);
    setStopVisited(false);
    setQueuedOffer(null);
    setAcceptedNextOffer(null);
    setTripStage('idle');

    if (preferences.stopNewRequests) {
      uberSounds.play('offline');
      setOnlineStatus('offline');
      setPreferences((p) => ({ ...p, stopNewRequests: false }));
      showToast('Trip completed · You are now offline');
    } else if (nextQueued) {
      handleAcceptOffer(nextQueued);
      showToast(`Starting queued ride · ${nextQueued.riderName}`);
    } else if (arrivedAtDestinationTarget) {
      showToast(`Arrived near ${destination.destinationName} · Destination Mode complete`);
    } else if (!tags.includes('Left item')) {
      showToast('Trip completed · Saved to Earnings');
    }
  };

  const handleNoShowCancel = (fee: number) => {
    if (!activeTrip) return;
    uberSounds.play('completeTrip');
    const currentKey = getLocalDateKey();
    setTodayDateKey(currentKey);
    const timeLabel = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const noShowRecord: CompletedTrip = {
      id: `noshow-${Date.now()}`,
      riderName: activeTrip.riderName,
      serviceName: activeTrip.serviceName,
      fare: fee,
      tip: 0,
      waitFee: 0,
      netPayout: fee,
      distanceMiles: 0,
      durationMin: 5,
      pickupArea: activeTrip.pickupArea.split(',')[0],
      dropoffArea: 'Rider No-Show Fee',
      completedAt: `Today, ${timeLabel}`,
      dateKey: currentKey,
      isNoShowFee: true,
    };

    setLedger((prev) => ({
      ...prev,
      dailyTotals: {
        ...prev.dailyTotals,
        [currentKey]: Number(((prev.dailyTotals[currentKey] ?? 0) + fee).toFixed(2)),
      },
      walletBalance: Number((prev.walletBalance + fee).toFixed(2)),
      completedTrips: [noShowRecord, ...prev.completedTrips],
    }));

    if (googleUser?.emailVerified) {
      void syncWithOfflineQueue(
        {
          kind: 'completed_trip',
          dedupeKey: `trip:${noShowRecord.id}`,
          uid: googleUser.uid,
          payload: noShowRecord,
        },
        () => syncCompletedTrip(googleUser.uid, noShowRecord)
      );
    }

    setActiveTrip(null);
    setActiveRoute(null);
    setTripWaitFee(0);
    setStopVisited(false);
    setQueuedOffer(null);
    setAcceptedNextOffer(null);
    setTrafficAlert(null);
    setRiderChangeOffer(null);
    setTripStage('idle');
    showToast(`Rider no-show fee +£${fee.toFixed(2)} added (0% cancel impact)`);
  };

  const handleCancelTrip = () => {
    uberSounds.play('decline');
    if (activeAccount?.id) {
      setAccounts((prev) =>
        prev.map((acct) =>
          acct.id === activeAccount.id
            ? { ...acct, cancellationRate: Math.min(25, acct.cancellationRate + 1) }
            : acct
        )
      );
    }
    setActiveTrip(null);
    setActiveRoute(null);
    setTripWaitFee(0);
    setStopVisited(false);
    setQueuedOffer(null);
    setAcceptedNextOffer(null);
    setTrafficAlert(null);
    setRiderChangeOffer(null);
    setTripStage('idle');
    showToast('Trip cancelled · Cancellation rate updated');
  };

  const handleAddMapReport = (category: MapReportCategory, label: string) => {
    uberSounds.play('mapReport');
    const pin: MapReportPin = {
      id: `rep-${Date.now()}`,
      category,
      label,
      coords: {
        x: driverPos.x + (Math.random() * 28 - 14),
        y: driverPos.y - 32,
      },
      reportedAt: 'Just now',
    };
    setMapReports((prev) => [...prev, pin]);
    setShowMapReportModal(false);
    showToast(`${label} reported on map — thanks for helping drivers`);
  };

  const handleTogglePreference = (key: keyof DriverPreferences) => {
    const SERVICE_KEYS: Array<keyof ServicePrefsInput> = [
      'uberX',
      'comfort',
      'intercity',
      'uberXL',
      'uberPet',
      'deliveries',
    ];
    const SERVICE_LABELS: Partial<Record<keyof DriverPreferences, string>> = {
      uberX: 'UberX',
      comfort: 'Comfort',
      intercity: 'Intercity',
      uberXL: 'UberXL',
      uberPet: 'Uber Pet',
      deliveries: 'Uber Eats',
    };

    const isServiceKey = (SERVICE_KEYS as Array<keyof DriverPreferences>).includes(key);
    if (isServiceKey && preferences[key]) {
      const enabledCount = SERVICE_KEYS.filter((k) => Boolean(preferences[k])).length;
      if (enabledCount <= 1) {
        showToast('Keep at least one trip service active');
        return;
      }
    }

    const nextPrefs = { ...preferences, [key]: !preferences[key] };
    setPreferences(nextPrefs);

    if (isServiceKey) {
      const label = SERVICE_LABELS[key] || String(key);
      showToast(`${label} ${nextPrefs[key] ? 'enabled for dispatch' : 'paused'}`);
      if (radarOffers.length > 0) {
        const nextServiceFilter: ServicePrefsInput = {
          uberX: nextPrefs.uberX,
          comfort: nextPrefs.comfort,
          uberXL: nextPrefs.uberXL,
          uberPet: nextPrefs.uberPet,
          deliveries: nextPrefs.deliveries,
          intercity: nextPrefs.intercity,
        };
        const gps = getActiveGpsLatLng();
        setRadarOffers([
          generateLocalTripOffer({
            anchorCoords: driverPosRef.current,
            realLatLng: gps,
            seedIndex: radarBatchIdx * 2,
            forceType: 'radar',
            includeIntercity: nextPrefs.intercity,
            servicePrefs: nextServiceFilter,
            areaPreference: nextPrefs.areaPreference,
            destination,
            isEV: Boolean(activeAccount?.isEV),
            acceptCashJobs: nextPrefs.acceptCashJobs ?? true,
          }),
          generateLocalTripOffer({
            anchorCoords: driverPosRef.current,
            realLatLng: gps,
            seedIndex: radarBatchIdx * 2 + 1,
            forceType: 'radar',
            includeIntercity: nextPrefs.intercity,
            servicePrefs: nextServiceFilter,
            areaPreference: nextPrefs.areaPreference,
            destination,
            isEV: Boolean(activeAccount?.isEV),
            acceptCashJobs: nextPrefs.acceptCashJobs ?? true,
          }),
        ]);
      }
    }
  };

  const handleToggleNightMode = () => {
    setPreferences((prev) => {
      const next = !prev.nightMode;
      showToast(next ? 'Night Mode enabled' : 'Day Mode enabled');
      return { ...prev, nightMode: next };
    });
  };

  // Account Handlers
  const handleSelectAccount = (accountId: string, rememberMe = true, targetOverride?: DriverAccount) => {
    const target = targetOverride ?? accounts.find((a) => a.id === accountId);
    if (!target) return;
    setActiveAccountId(accountId);
    setActiveAccountIdState(accountId);
    if (rememberMe) {
      const remembered: RememberedLogin = {
        accountId: target.id,
        name: target.name,
        email: target.email,
        password: target.password,
        city: target.city,
        rememberMe: true,
        lastSignedInAt: Date.now(),
      };
      saveRememberedLogin(remembered);
      setRememberedLogin(remembered);
    } else {
      saveRememberedLogin(null);
      setRememberedLogin(null);
    }
    anchoredToLastJobRef.current = false;
    setIsSignedOut(false);
    setOnlineStatus('offline');
    setPendingOffer(null);
    setActiveTrip(null);
    setTripStage('idle');
    setDriverPos(getCityStartCoords(target.city));
    setRecenterSignal((s) => s + 1);
    showToast(`Signed in as ${target.name} (${target.city})`);
  };

  const handleSignInCredentials = (email: string, password: string, rememberMe = true) => {
    const match = accounts.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    );
    if (!match) {
      return { ok: false, error: 'Email or password did not match any saved UK driver account.' };
    }
    handleSelectAccount(match.id, rememberMe);
    if (rememberMe) {
      void storeBrowserCredential(match.email, match.password, match.name);
    }
    return { ok: true };
  };

  const handleRegisterAccount = (payload: {
    name: string;
    email: string;
    password: string;
    city: string;
    vehicle: string;
    licensePlate: string;
    phvBadge: string;
    rememberMe?: boolean;
  }) => {
    if (accounts.some((a) => a.email.toLowerCase() === payload.email.toLowerCase())) {
      return { ok: false, error: 'A driver account with that email already exists.' };
    }
    const newAcct: DriverAccount = {
      id: `acct-${Date.now()}`,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      tier: 'Gold',
      proPoints: 180,
      rating: 5.0,
      acceptanceRate: 100,
      cancellationRate: 0,
      vehicle: payload.vehicle,
      vehicleColor: 'Obsidian Black',
      licensePlate: payload.licensePlate,
      phvBadge: payload.phvBadge,
      city: payload.city,
      lastFaceVerifiedAt: null,
      drivingMinutesUsedToday: 0,
      batteryPct: 100,
      isEV:
        payload.vehicle.toLowerCase().includes('ev') ||
        payload.vehicle.toLowerCase().includes('tesla'),
      complianceDocs: buildDefaultComplianceDocs(payload.phvBadge),
      insurancePolicy: buildDefaultInsurancePolicy(
        `acct-${Date.now()}`,
        payload.city,
        payload.vehicle.toLowerCase().includes('ev') ||
          payload.vehicle.toLowerCase().includes('tesla')
      ),
      restLockedUntil: null,
    };
    const nextList = [newAcct, ...accounts];
    setAccounts(nextList);
    saveAccounts(nextList);
    setActiveAccountId(newAcct.id);
    setActiveAccountIdState(newAcct.id);

    const shouldRemember = payload.rememberMe !== false;
    if (shouldRemember) {
      const remembered: RememberedLogin = {
        accountId: newAcct.id,
        name: newAcct.name,
        email: newAcct.email,
        password: newAcct.password,
        city: newAcct.city,
        rememberMe: true,
        lastSignedInAt: Date.now(),
      };
      saveRememberedLogin(remembered);
      setRememberedLogin(remembered);
      void storeBrowserCredential(newAcct.email, newAcct.password, newAcct.name);
    } else {
      saveRememberedLogin(null);
      setRememberedLogin(null);
    }

    setIsSignedOut(false);
    setOnlineStatus('offline');
    setPendingOffer(null);
    setActiveTrip(null);
    setTripStage('idle');
    setDriverPos(getCityStartCoords(newAcct.city));
    setRecenterSignal((s) => s + 1);
    showToast(`Welcome aboard, ${newAcct.name}!`);
    return { ok: true };
  };

  const handleExportBackupCode = (account: DriverAccount): string => {
    const targetLedger =
      account.id === activeAccount?.id
        ? ledger
        : loadDriverLedger(
            {
              proPoints: account.proPoints,
              walletBalance: account.id === 'acct-alex' ? 1000.0 : 420.0,
              questCompletedCount: account.id === 'acct-alex' ? 16 : 9,
            },
            account.id
          );
    return exportAccountBackupCode(account, targetLedger);
  };

  const handleRestoreBackupCode = (code: string): { ok: boolean; error?: string } => {
    const parsed = importAccountBackupCode(code);
    if (!parsed) {
      return { ok: false, error: 'Invalid or corrupted UBR1 backup key.' };
    }
    const restoredAcct = parsed.account;
    setAccounts((prev) => {
      const exists = prev.some((a) => a.id === restoredAcct.id);
      const next = exists
        ? prev.map((a) => (a.id === restoredAcct.id ? restoredAcct : a))
        : [restoredAcct, ...prev];
      saveAccounts(next);
      return next;
    });

    if (parsed.ledger && typeof parsed.ledger === 'object') {
      const rawLedger = parsed.ledger as Partial<DriverLedger>;
      const restoredTrips = Array.isArray(rawLedger.completedTrips)
        ? rawLedger.completedTrips
        : [];
      const restoredLedger: DriverLedger = {
        dailyTotals: rawLedger.dailyTotals ?? {},
        walletBalance:
          typeof rawLedger.walletBalance === 'number' ? rawLedger.walletBalance : 0,
        proPoints:
          typeof rawLedger.proPoints === 'number'
            ? rawLedger.proPoints
            : restoredAcct.proPoints,
        questCompletedCount:
          typeof rawLedger.questCompletedCount === 'number'
            ? rawLedger.questCompletedCount
            : 0,
        completedTrips: restoredTrips,
        expenses: Array.isArray(rawLedger.expenses) ? rawLedger.expenses : [],
        ccPaidDateKey: rawLedger.ccPaidDateKey ?? null,
        questPaidCycleCount:
          typeof rawLedger.questPaidCycleCount === 'number'
            ? rawLedger.questPaidCycleCount
            : 0,
        tripStats: rawLedger.tripStats
          ? {
              totalReceived:
                typeof rawLedger.tripStats.totalReceived === 'number'
                  ? rawLedger.tripStats.totalReceived
                  : restoredTrips.length,
              accepted:
                typeof rawLedger.tripStats.accepted === 'number'
                  ? rawLedger.tripStats.accepted
                  : restoredTrips.length,
              declined:
                typeof rawLedger.tripStats.declined === 'number'
                  ? rawLedger.tripStats.declined
                  : 0,
              radarLost:
                typeof rawLedger.tripStats.radarLost === 'number'
                  ? rawLedger.tripStats.radarLost
                  : 0,
              history: Array.isArray(rawLedger.tripStats.history)
                ? rawLedger.tripStats.history
                : [],
            }
          : {
              ...EMPTY_TRIP_STATS,
              totalReceived: restoredTrips.length,
              accepted: restoredTrips.length,
              history: [],
            },
      };
      saveDriverLedger(restoredLedger, restoredAcct.id);
      prevAccountIdRef.current = restoredAcct.id;
      setLedger(restoredLedger);
    }

    handleSelectAccount(restoredAcct.id, true, restoredAcct);
    void storeBrowserCredential(restoredAcct.email, restoredAcct.password, restoredAcct.name);
    showToast(`Restored driver account for ${restoredAcct.name}`);
    return { ok: true };
  };

  const handleSignOut = () => {
    uberSounds.play('offline');
    setOnlineStatus('offline');
    setPendingOffer(null);
    setActiveTrip(null);
    setTripStage('idle');
    setShowRadarList(false);
    setActiveAccountId(null);
    setIsSignedOut(true);
    showToast('Signed out · Saved credentials remembered');
  };

  const handleFaceVerified = () => {
    if (activeAccount) {
      const now = Date.now();
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === activeAccount.id ? { ...a, lastFaceVerifiedAt: now } : a
        )
      );
    }
    setShowFaceVerifyModal(false);
    if (pendingGoOnlineAfterVerify) {
      setPendingGoOnlineAfterVerify(false);
      completeGoOnline();
    } else {
      showToast('Face ID verified · PHV check complete');
    }
  };

  const handleAcceptLocationPermission = () => {
    setGpsExplicitlyAccepted(true);
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      showToast('Blue GPS icon active — locating UK GPS...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, heading, speed } = pos.coords;
          setGpsPermissionState('active');
          const coords = { lat: latitude, lng: longitude };
          realCoordsRef.current = coords;
          setRealCoords(coords);
          if (typeof speed === 'number' && !Number.isNaN(speed)) {
            setLiveSpeedMph(Math.max(0, Math.round(speed * 2.23694)));
          }
          if (isWithinUKBounds(latitude, longitude)) {
            const projected = clampMapCoords(projectLatLngToMap(latitude, longitude));
            if (tripStageRef.current === 'idle') {
              setDriverPos(projected);
              if (typeof heading === 'number' && !Number.isNaN(heading)) {
                setDriverHeading(heading);
              }
            }
            setRecenterSignal((s) => s + 1);
            void prefetchLocalPlaces(latitude, longitude).then((town) => {
              setLocalGeoVersion((v) => v + 1);
              showToast(`Live GPS active · ${town || getResolvedLocalCityName(projected)}, UK`);
            });
          } else {
            showToast('Blue GPS active (outside UK) · Previewing UK map');
          }
        },
        () => {
          setGpsPermissionState('denied');
          showToast('Blue GPS icon enabled (using UK GPS)');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsPermissionState('active');
      showToast('Blue GPS icon active');
    }
  };

  const handleAcceptNotificationPermission = async () => {
    setPreferences((prev) => ({ ...prev, notificationsEnabled: true }));
    if (isNativeAndroidApk()) {
      const granted = await requestAndroidNotificationPermission();
      const updated = await getNativeBubblePermissions();
      setNativeBubblePerms(updated);
      if (granted) {
        showToast('Android trip notifications enabled');
        return;
      }
    }
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      const pushRes = await subscribeToWebPush();
      if (pushRes.reason === 'subscribed') {
        showToast('Web Push notifications & App Icon Badges active');
      } else {
        showToast('Alerts & App Icon Badges accepted');
      }
    } else if (perm === 'denied') {
      showToast('Browser notifications blocked — in-app alert banner enabled');
    } else {
      showToast('In-app notifications enabled');
    }
  };

  const handleAcceptBackgroundRefresh = async () => {
    setPreferences((prev) => ({ ...prev, backgroundAppRefresh: true }));
    await triggerRefreshNow();
    showToast('Background App Refresh & Wake Lock enabled');
  };

  const handleAcceptAllPermissions = async () => {
    handleAcceptLocationPermission();
    await handleAcceptNotificationPermission();
    await handleAcceptBackgroundRefresh();
    if (isNativeAndroidApk() && !nativeBubblePerms.overlayGranted) {
      await requestAndroidOverlayPermission();
      showToast('Allow "Display over other apps" for Uber Driver, then press Back');
      return;
    }
    setShowPermissionsModal(false);
  };

  const handleToggleNotifications = async () => {
    const nextValue = !preferences.notificationsEnabled;
    setPreferences((prev) => ({ ...prev, notificationsEnabled: nextValue }));
    if (nextValue) {
      await handleAcceptNotificationPermission();
    } else {
      showToast('Notifications muted');
    }
  };

  const handleSendTestNotification = async () => {
    uberSounds.unlock();
    uberSounds.play('message');
    if (!preferences.notificationsEnabled) {
      setPreferences((prev) => ({ ...prev, notificationsEnabled: true }));
    }
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    const title = 'New UberX Surge · +£12.00';
    const body = 'High demand near Soho · Tap to return to Map';
    setInAppBanner({
      title,
      body,
      onAction: () => setActiveTab('home'),
    });
    setTimeout(() => {
      setInAppBanner((prev) => (prev?.title === title ? null : prev));
    }, 4500);
    await sendDriverNotification({ title, body, tag: 'test-alert' });
  };

  const handleToggleBackgroundRefresh = () => {
    const nextValue = !preferences.backgroundAppRefresh;
    setPreferences((prev) => ({ ...prev, backgroundAppRefresh: nextValue }));
    showToast(
      nextValue
        ? 'Background App Refresh enabled (Wake Lock & auto-sync)'
        : 'Background App Refresh paused'
    );
  };

  const handleTriggerRefreshNow = async () => {
    await triggerRefreshNow();
    rotateRadarOffers(radarBatchIdx + 1);
    setRadarBatchIdx((b) => b + 1);
    setRadarRefreshSecLeft(60);
    showToast('Trip Radar, surge zones & ledger synced');
  };

  const handleCashOut = (amount: number, method: 'instant' | 'bank') => {
    const fee = method === 'instant' ? 1.25 : 0;
    const netAmount = Math.max(0, Number((amount - fee).toFixed(2)));
    const now = new Date();
    const payoutRec: PayoutRecord = {
      id: `pay-${now.getTime()}`,
      amount: Number(amount.toFixed(2)),
      fee,
      netAmount,
      method,
      destinationLabel:
        method === 'instant' ? 'UK Visa Debit •• 4821' : 'Faster Payments UK •• 9014',
      reference: `UBR-${now.getTime().toString().slice(-6)}`,
      timestamp: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
      dateKey: getLocalDateKey(now),
    };
    setLedger((prev) => ({
      ...prev,
      walletBalance: Math.max(0, Number((prev.walletBalance - amount).toFixed(2))),
      payouts: [payoutRec, ...(prev.payouts ?? [])].slice(0, 40),
    }));
  };

  const handleMarkInboxRead = (threadId: string) => {
    setInboxThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, unread: false } : t))
    );
  };

  const handleReplyInbox = (threadId: string, text: string) => {
    uberSounds.play('message');
    setInboxThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        return {
          ...t,
          preview: `You: ${text}`,
          timeAgo: 'Just now',
          statusText: 'Sent to Uber Support',
          unread: false,
          messages: [
            ...t.messages,
            {
              id: `msg-${Date.now()}`,
              sender: 'driver',
              text,
              timestamp: 'Just now',
            },
          ],
        };
      })
    );
  };

  const handleSelectSurgeZone = (zone: SurgeZone) => {
    if (zone.kind === 'surge') {
      showToast(`Surge zone active: ${zone.label} minimum extra on next trip`);
    } else if (zone.kind === 'wait') {
      showToast(`Estimated wait time in this area: ${zone.label}`);
    } else if (zone.kind === 'event') {
      showToast('High demand nearby due to local UK event');
    } else {
      showToast('Busy pickup area (£££)');
    }
  };

  const handleSelectBusySoonZone = (zone: BusySoonZone) => {
    showToast(
      `Busy Soon (${zone.area}): ${zone.expectedBoost} expected in ${zone.minutesUntilBusy} min · ${zone.reason}`
    );
  };

  const handleFileTripClaim = useCallback(
    (
      tripId: string,
      kind: 'valeting' | 'fare_review',
      details?: { amount: number; incidentLabel: string; photoName?: string; notes?: string }
    ) => {
      const trip = ledger.completedTrips.find((t) => t.id === tripId);
      if (!trip || trip.claimFiled) return;
      const amount = details?.amount ?? (kind === 'valeting' ? 40.0 : 4.8);
      const incidentLabel =
        details?.incidentLabel ??
        (kind === 'valeting' ? 'UK Valeting / Cleaning Payout' : 'Fare Review Adjustment');
      const targetKey = trip.dateKey || todayDateKey;

      setLedger((prev) => ({
        ...prev,
        dailyTotals: {
          ...prev.dailyTotals,
          [targetKey]: Number(((prev.dailyTotals[targetKey] ?? 0) + amount).toFixed(2)),
        },
        walletBalance: Number((prev.walletBalance + amount).toFixed(2)),
        completedTrips: prev.completedTrips.map((item) =>
          item.id === tripId
            ? {
                ...item,
                claimFiled: kind,
                claimAmount: amount,
                claimIncidentLabel: incidentLabel,
                claimPhotoName: details?.photoName,
                claimNotes: details?.notes,
                netPayout: Number(((item.netPayout ?? item.fare) + amount).toFixed(2)),
              }
            : item
        ),
      }));

      const claimThread: InboxThread = {
        id: `thread-claim-${Date.now()}`,
        tab: 'support',
        title: `${incidentLabel} Approved (+£${amount.toFixed(2)})`,
        preview: `${trip.pickupArea} → ${trip.dropoffArea} · Credited to wallet`,
        timeAgo: 'Just now',
        statusText: 'Approved & Paid',
        unread: true,
        iconType: 'doc',
        messages: [
          {
            id: `msg-claim-${Date.now()}`,
            sender: 'agent',
            text: `Your UK PHV claim (${incidentLabel}${
              details?.photoName ? ` · photo: ${details.photoName}` : ''
            }) for ${trip.serviceName} (${trip.riderName}) has been approved for £${amount.toFixed(
              2
            )} and credited to your wallet.${details?.notes ? ` Note: ${details.notes}` : ''}`,
            timestamp: 'Just now',
          },
        ],
      };
      setInboxThreads((prev) => [claimThread, ...prev]);
      uberSounds.play('completeTrip');
      showToast(`${incidentLabel} approved · +£${amount.toFixed(2)} credited`);
    },
    [ledger.completedTrips, todayDateKey, showToast]
  );

  const handleCycleWeather = useCallback(() => {
    setWeatherCondition((prev) => {
      const idx = WEATHER_CYCLE.indexOf(prev);
      const next = WEATHER_CYCLE[(idx + 1) % WEATHER_CYCLE.length];
      showToast(`UK Weather: ${next}`);
      return next;
    });
  }, [showToast]);

  const handleClaimHolidayPay = useCallback(() => {
    const pot = Number((ledger.holidayPayAccrued ?? 0).toFixed(2));
    if (pot < 0.5) return;
    const currentKey = getLocalDateKey();
    setLedger((prev) => ({
      ...prev,
      dailyTotals: {
        ...prev.dailyTotals,
        [currentKey]: Number(((prev.dailyTotals[currentKey] ?? 0) + pot).toFixed(2)),
      },
      walletBalance: Number((prev.walletBalance + pot).toFixed(2)),
      holidayPayAccrued: 0,
      holidayPayClaimedTotal: Number(((prev.holidayPayClaimedTotal ?? 0) + pot).toFixed(2)),
    }));
    showToast(`£${pot.toFixed(2)} Holiday Pay credited to your Wallet`);
  }, [ledger.holidayPayAccrued, showToast]);

  const handleConfirmLostItemReturn = useCallback(
    (threadId: string) => {
      const target = inboxThreads.find((t) => t.id === threadId);
      if (!target?.lostItemReturn || target.lostItemReturn.returned) return;
      const fee = target.lostItemReturn.feeAmount;
      const currentKey = getLocalDateKey();

      setLedger((prev) => ({
        ...prev,
        dailyTotals: {
          ...prev.dailyTotals,
          [currentKey]: Number(((prev.dailyTotals[currentKey] ?? 0) + fee).toFixed(2)),
        },
        walletBalance: Number((prev.walletBalance + fee).toFixed(2)),
      }));

      setInboxThreads((prev) =>
        prev.map((t) =>
          t.id === threadId && t.lostItemReturn
            ? {
                ...t,
                unread: false,
                statusText: `Returned · +£${fee.toFixed(2)} Paid`,
                preview: `${t.lostItemReturn.itemLabel} returned (+£${fee.toFixed(2)} credited)`,
                lostItemReturn: { ...t.lostItemReturn, returned: true },
                messages: [
                  ...t.messages,
                  {
                    id: `msg-returned-${Date.now()}`,
                    sender: 'agent',
                    text: `Thank you! Lost property return confirmed for ${t.lostItemReturn.riderName}. £${fee.toFixed(2)} has been credited to your wallet.`,
                    timestamp: 'Just now',
                  },
                ],
              }
            : t
        )
      );
      uberSounds.play('completeTrip');
      showToast(`Lost item return confirmed · +£${fee.toFixed(2)} credited`);
    },
    [inboxThreads, showToast]
  );

  const handleUpdateComplianceDoc = useCallback(
    (docId: string, nextStatus: 'verified' | 'expiring_soon' | 'expired') => {
      if (!activeAccount?.id) return;
      setAccounts((prev) =>
        prev.map((acct) => {
          if (acct.id !== activeAccount.id) return acct;
          const updatedDocs = (acct.complianceDocs ?? buildDefaultComplianceDocs(acct.phvBadge)).map(
            (docItem) =>
              docItem.id === docId
                ? {
                    ...docItem,
                    status: nextStatus,
                    daysRemaining: nextStatus === 'verified' ? 180 : nextStatus === 'expiring_soon' ? 14 : 0,
                  }
                : docItem
          );
          return { ...acct, complianceDocs: updatedDocs };
        })
      );
      showToast(
        nextStatus === 'verified'
          ? 'UK document renewed & verified'
          : 'Simulated expired document — test going online gate'
      );
    },
    [activeAccount?.id, showToast]
  );

  const handleUpdateInsurancePolicy = useCallback(
    (policy: InsurancePolicyInfo) => {
      if (!activeAccount?.id) return;
      const mappedDocStatus: 'verified' | 'expiring_soon' | 'expired' =
        policy.status === 'lapsed'
          ? 'expired'
          : policy.status === 'expiring_soon'
          ? 'expiring_soon'
          : 'verified';

      setAccounts((prev) =>
        prev.map((acct) => {
          if (acct.id !== activeAccount.id) return acct;
          const updatedDocs = (acct.complianceDocs ?? buildDefaultComplianceDocs(acct.phvBadge)).map(
            (docItem) =>
              docItem.id === 'doc-insurance'
                ? {
                    ...docItem,
                    subtitle: `${policy.insurer} · ${policy.coverType}`,
                    daysRemaining: policy.daysRemaining,
                    status: mappedDocStatus,
                  }
                : docItem
          );
          return { ...acct, insurancePolicy: policy, complianceDocs: updatedDocs };
        })
      );
      setPreferences((prev) => ({
        ...prev,
        costSettings: {
          fuelOrKwhPerMileGbp: prev.costSettings?.fuelOrKwhPerMileGbp ?? 0.16,
          weeklyInsuranceGbp: policy.weeklyPremiumGbp,
          weeklyVehicleCostGbp: prev.costSettings?.weeklyVehicleCostGbp ?? 145,
        },
      }));
      showToast(
        policy.status === 'lapsed'
          ? 'PHV Insurance marked lapsed — driving gated until renewed'
          : `Insurance certificate active (${policy.insurer})`
      );
    },
    [activeAccount?.id, showToast]
  );

  // Hands-free Driver Voice Command controller & quick handler
  const [voiceStatus, setVoiceStatus] = useState<{ listening: boolean; lastHeard?: string }>({
    listening: false,
  });

  const handleVoiceDriverCommand = useCallback(
    (cmd: VoiceDriverCommand) => {
      if (cmd === 'accept') {
        if (pendingOfferRef.current && tripStageRef.current === 'idle') {
          handleAcceptOffer(pendingOfferRef.current);
        } else if (queuedOffer) {
          recordOfferDecision(queuedOffer, 'accepted', 'queued');
          uberSounds.play('accept');
          setAcceptedNextOffer(queuedOffer);
          setQueuedOffer(null);
          showToast(`Voice accepted queued ${queuedOffer.serviceName}`);
        } else {
          showToast('Voice: no incoming job offer to accept');
        }
        return;
      }
      if (cmd === 'decline') {
        if (pendingOfferRef.current && tripStageRef.current === 'idle') {
          handleDeclineOffer(pendingOfferRef.current);
        } else {
          showToast('Voice: no incoming offer to decline');
        }
        return;
      }
      if (cmd === 'go_online') {
        if (onlineStatusRef.current === 'offline') {
          toggleOnlineRef.current();
        } else {
          showToast('Voice: already online');
        }
        return;
      }
      if (cmd === 'go_offline') {
        if (onlineStatusRef.current === 'online' && tripStageRef.current === 'idle') {
          toggleOnlineRef.current();
        } else {
          showToast('Voice: finish active trip before going offline');
        }
        return;
      }
      if (cmd === 'navigate') {
        setRecenterSignal((s) => s + 1);
        const navText = liveNav?.maneuverTitle
          ? `${liveNav.distanceToTurnLabel || ''} ${liveNav.maneuverTitle}`.trim()
          : 'Map recentered on your UK position.';
        speakNavInstruction(navText, true);
        showToast('Voice: Navigation instruction read');
        return;
      }
      if (cmd === 'read_message') {
        const noteText =
          activeTrip?.riderNote ||
          inboxThreads.find((t) => t.unread)?.preview ||
          'No unread rider notes or support messages.';
        speakNavInstruction(noteText, true);
        showToast('Voice: Reading latest rider note');
      }
    },
    [
      handleAcceptOffer,
      handleDeclineOffer,
      queuedOffer,
      recordOfferDecision,
      liveNav?.maneuverTitle,
      liveNav?.distanceToTurnLabel,
      activeTrip?.riderNote,
      inboxThreads,
      showToast,
    ]
  );

  const voiceHandlerRef = useRef(handleVoiceDriverCommand);
  voiceHandlerRef.current = handleVoiceDriverCommand;

  useEffect(() => {
    if (!preferences.voiceCommandsEnabled || onlineStatus !== 'online') {
      driverVoiceController.stop();
      setVoiceStatus({ listening: false });
      return;
    }
    driverVoiceController.start(
      (cmd, transcript) => {
        setVoiceStatus({ listening: true, lastHeard: transcript });
        voiceHandlerRef.current(cmd);
      },
      (listening, lastHeard) => {
        setVoiceStatus((prev) => ({ listening, lastHeard: lastHeard ?? prev.lastHeard }));
      }
    );
    return () => driverVoiceController.stop();
  }, [preferences.voiceCommandsEnabled, onlineStatus]);

  const handleResetRestLock = useCallback(() => {
    if (!activeAccount?.id) return;
    setAccounts((prev) =>
      prev.map((acct) =>
        acct.id === activeAccount.id
          ? { ...acct, drivingMinutesUsedToday: 0, restLockedUntil: null }
          : acct
      )
    );
    showToast('6-hour mandatory UK rest completed · 12h allowance reset');
  }, [activeAccount?.id, showToast]);

  const handleExportTaxCsv = useCallback(async () => {
    const res = await shareOrDownloadHMRCTaxCsv({
      driverName: activeAccount?.name ?? 'UK Partner Driver',
      totalBusinessMiles,
      completedTrips: ledger.completedTrips,
      expenses: ledger.expenses ?? [],
    });
    if (res.mode === 'shared') {
      showToast(`Shared ${res.filename} (£${res.taxReliefGbp.toFixed(2)} HMRC relief)`);
    } else if (res.mode === 'downloaded') {
      showToast(`Exported ${res.filename} (£${res.taxReliefGbp.toFixed(2)} HMRC relief)`);
    } else if (res.mode === 'failed') {
      showToast(`HMRC Summary ready: £${res.taxReliefGbp.toFixed(2)} mileage relief`);
    }
  }, [activeAccount?.name, totalBusinessMiles, ledger.completedTrips, ledger.expenses, showToast]);

  const handleShareLiveTrip = useCallback(async () => {
    const coords = getActiveGpsLatLng() ?? mapToLatLng(driverPosRef.current);
    const city = getResolvedLocalCityName(driverPosRef.current) || activeAccount?.city || 'London';
    const result = await shareLiveTripStatus({
      driverName: activeAccount?.name ?? 'UK Partner Driver',
      vehicle: activeAccount?.vehicle ?? '2024 Toyota Camry Hybrid',
      licensePlate: activeAccount?.licensePlate ?? 'LB24 UBR',
      city,
      lat: coords.lat,
      lng: coords.lng,
      activeTrip,
      tripStage,
    });
    if (result === 'shared') {
      showToast('Live UK trip & GPS shared');
    } else if (result === 'copied') {
      showToast('Live trip & GPS link copied to clipboard');
    }
  }, [activeAccount, activeTrip, tripStage, getActiveGpsLatLng, showToast]);

  const handleShareTripReceipt = useCallback(
    async (trip: CompletedTrip) => {
      const result = await shareCompletedTripReceipt(trip);
      if (result === 'shared') {
        showToast('UK trip receipt shared');
      } else if (result === 'copied') {
        showToast('UK trip receipt copied to clipboard');
      }
    },
    [showToast]
  );

  const formatSecMmSs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isLiveGpsInUK =
    realCoords !== null && isWithinUKBounds(realCoords.lat, realCoords.lng);

  const currentJobCity = useMemo(
    () => getResolvedLocalCityName(driverPos),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [driverPos, localGeoVersion]
  );

  const myLocationCoords = useMemo(
    () =>
      isLiveGpsInUK && realCoords
        ? clampMapCoords(projectLatLngToMap(realCoords.lat, realCoords.lng))
        : getCityStartCoords(activeAccount?.city ?? 'London'),
    [isLiveGpsInUK, realCoords, activeAccount?.city]
  );

  const myLocationLabel = useMemo(() => {
    if (isLiveGpsInUK && realCoords) {
      return nearestUKCity(myLocationCoords);
    }
    return activeAccount?.city || 'London';
  }, [isLiveGpsInUK, realCoords, myLocationCoords, activeAccount?.city]);

  const milesFromMyLocation = useMemo(() => {
    const dLL = mapToLatLng(driverPos);
    const mLL = mapToLatLng(myLocationCoords);
    return Number(haversineMiles(dLL.lat, dLL.lng, mLL.lat, mLL.lng).toFixed(1));
  }, [driverPos, myLocationCoords]);

  const fallbackLocalOffer = useMemo(
    () =>
      generateLocalTripOffer({
        anchorCoords: driverPos,
        realLatLng: !anchoredToLastJobRef.current && isLiveGpsInUK ? realCoords : undefined,
        seedIndex: offerIndex,
        forceType: 'radar',
        includeIntercity: preferences.intercity,
        servicePrefs,
        surgeLockedBonus: lockedSurgeBonus,
        boostBonus: activeBoostBonus,
        ccAlreadyPaidToday: ledger.ccPaidDateKey === todayDateKey,
        areaPreference: preferences.areaPreference,
        destination,
        isEV: Boolean(activeAccount?.isEV),
        acceptCashJobs: preferences.acceptCashJobs ?? true,
      }),
    [
      driverPos,
      isLiveGpsInUK,
      realCoords,
      offerIndex,
      preferences.intercity,
      preferences.areaPreference,
      preferences.acceptCashJobs,
      destination,
      activeAccount?.isEV,
      servicePrefs,
      localGeoVersion,
      lockedSurgeBonus,
      activeBoostBonus,
      ledger.ccPaidDateKey,
      todayDateKey,
    ]
  );

  // If user signed out, show full-screen Driver UK Sign-In Gate
  if (isSignedOut || !activeAccount) {
    return (
      <>
        {showBootScreen && (
          <BootScreen
            driverName={rememberedLogin?.name}
            city={activeAccount?.city}
            onFinish={() => setShowBootScreen(false)}
          />
        )}
        <AccountModal
          accounts={accounts}
          activeAccount={activeAccount}
          rememberedLogin={rememberedLogin}
          isSignedOutGate
          onSelectAccount={handleSelectAccount}
          onSignInCredentials={handleSignInCredentials}
          onRegisterAccount={handleRegisterAccount}
          onExportBackupCode={handleExportBackupCode}
          onRestoreBackupCode={handleRestoreBackupCode}
          onSignOut={handleSignOut}
        />
      </>
    );
  }

  const renderManeuverIcon = (kind: NavManeuverKind) => {
    switch (kind) {
      case 'turn-left':
        return <CornerUpLeft className="w-5 h-5 text-white stroke-[2.5]" />;
      case 'turn-right':
        return <CornerUpRight className="w-5 h-5 text-white stroke-[2.5]" />;
      case 'roundabout':
        return <RefreshCw className="w-5 h-5 text-white stroke-[2.5]" />;
      case 'merge':
        return <GitMerge className="w-5 h-5 text-white stroke-[2.5]" />;
      case 'arrive':
        return <MapPin className="w-5 h-5 text-white stroke-[2.5]" />;
      default:
        return <ArrowUp className="w-5 h-5 text-white stroke-[2.5]" />;
    }
  };

  const remainingRoutePolyline =
    activeRoute && activeRoute.polyline.length >= 2
      ? activeRoute.polyline.slice(Math.min(routeWpIdx, activeRoute.polyline.length - 1))
      : undefined;

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-[#F6F6F6] dark:bg-[#0E0F12] overflow-hidden">
      {preferences.nightShieldEnabled && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[45] bg-[#0B0802]/35"
        />
      )}
      {showBootScreen && (
        <BootScreen
          driverName={activeAccount?.name}
          city={activeAccount?.city}
          onFinish={() => setShowBootScreen(false)}
        />
      )}
      <DynamicIsland
        onlineStatus={onlineStatus}
        onlineElapsedSec={onlineElapsedSec}
        tripStage={tripStage}
        activeTrip={activeTrip}
        pendingOffer={pendingOffer}
        gpsPermissionState={gpsPermissionState}
        gpsExplicitlyAccepted={gpsExplicitlyAccepted}
        realCoords={realCoords}
        liveEtaCountdown={liveNav?.etaCountdown}
        liveDistanceRemaining={liveNav?.distanceRemaining}
        liveProgressPct={liveNav?.progressPct}
        todayEarnings={todayEarnings}
        privacyHidden={privacyHidden}
        onToggleOnline={handleToggleOnline}
        onReturnToMap={() => setActiveTab('home')}
        onOpenPermissions={() => setShowPermissionsModal(true)}
        onEnableBlueGps={handleAcceptLocationPermission}
      />
      <OfflineIndicator pendingSyncCount={offlinePendingCount} isFlushing={isOfflineFlushing} />

      {/* Root-Level Toast Notification */}
      {toastMsg && (
        <div className="fixed top-[56px] left-1/2 -translate-x-1/2 z-50 bg-black dark:bg-[#1E2026] text-white text-[13px] font-semibold px-4 py-2.5 rounded-full shadow-xl border border-white/10 flex items-center gap-2 whitespace-nowrap max-w-[92%]">
          <CheckCircle2 className="w-4 h-4 text-[#05944F] shrink-0" />
          <span className="truncate">{toastMsg}</span>
        </div>
      )}

      {/* Root-Level Push / In-App Notification Banner */}
      {inAppBanner && (
        <div className="fixed top-[56px] left-1/2 -translate-x-1/2 z-50 w-[min(92vw,390px)]">
          <div className="rounded-2xl bg-[#111111] text-white p-3.5 shadow-2xl border border-white/15 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#276EF1] flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-white" />
            </div>
            <button
              type="button"
              onClick={() => {
                inAppBanner.onAction?.();
                setInAppBanner(null);
              }}
              className="flex-1 min-w-0 text-left"
            >
              <p className="text-[13.5px] font-extrabold leading-tight truncate">
                {inAppBanner.title}
              </p>
              <p className="text-[12px] text-white/75 truncate mt-0.5">
                {inAppBanner.body}
              </p>
            </button>
            <button
              type="button"
              onClick={() => setInAppBanner(null)}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          FULL-BLEED MAP WORKSPACE (When activeTab === 'home')
          ===================================================================== */}
      {activeTab === 'home' ? (
        <div className="relative flex-1 min-h-0 w-full overflow-hidden">
          <UberMap
            driverPos={driverPos}
            driverHeading={driverHeading}
            onlineStatus={onlineStatus}
            tripStage={tripStage}
            activeTrip={activeTrip}
            pendingOffer={pendingOffer}
            routePolyline={remainingRoutePolyline}
            fullRoutePolyline={activeRoute?.polyline}
            offerTripPolyline={offerTripRoute?.polyline}
            surgeZones={INITIAL_SURGE_ZONES}
            busySoonZones={BUSY_SOON_ZONES}
            mapReports={mapReports}
            destination={destination}
            showSurgeHeatmap={tripStage === 'idle'}
            recenterSignal={recenterSignal}
            isLiveGps={isLiveGpsInUK}
            blueGpsActive={
              isLiveGpsInUK ||
              gpsExplicitlyAccepted ||
              gpsPermissionState === 'active' ||
              onlineStatus === 'online'
            }
            nightMode={preferences.nightMode}
            weatherCondition={weatherCondition}
            showTrafficLayer={preferences.showTrafficLayer}
            showUKZones={preferences.showUKZones}
            showSpeedCameras={preferences.speedCameraWarnings}
            showBusySoonZones={preferences.showBusySoonZones}
            hideMapControls={
              (tripStage === 'idle' && (Boolean(pendingOffer) || showRadarList)) ||
              (tripStage !== 'idle' &&
                (isTripSheetExpanded ||
                  tripStage === 'waiting' ||
                  tripStage === 'stop_wait' ||
                  tripStage === 'dropoff_arrived' ||
                  tripStage === 'completed'))
            }
            onSelectSurgeZone={handleSelectSurgeZone}
            onSelectBusySoonZone={handleSelectBusySoonZone}
            onToggleMapLayers={() => {
              setShowMapToolsMenu(false);
              setShowMapLayersPopover((v) => !v);
            }}
          />

          {/* Compact UK Map Layers Popover */}
          {showMapLayersPopover && (
            <div
              className={`absolute right-16 z-30 w-56 rounded-2xl bg-white/95 dark:bg-[#16181E]/95 backdrop-blur-md p-3 shadow-2xl border border-black/10 dark:border-white/10 space-y-2 ${
                tripStage === 'idle' ? 'top-[116px]' : 'top-[214px]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-extrabold text-black dark:text-white">
                  UK Map Layers
                </span>
                <button
                  type="button"
                  onClick={() => setShowMapLayersPopover(false)}
                  className="text-[11px] font-bold text-[#276EF1]"
                >
                  Done
                </button>
              </div>
              <button
                type="button"
                onClick={() => handleTogglePreference('showTrafficLayer')}
                className="w-full flex items-center justify-between text-[12px] font-semibold text-black dark:text-neutral-200 py-1"
              >
                <span>Live Motorway Traffic</span>
                <span className={preferences.showTrafficLayer ? 'text-[#05944F]' : 'text-neutral-400'}>
                  {preferences.showTrafficLayer ? 'ON' : 'OFF'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleTogglePreference('showUKZones')}
                className="w-full flex items-center justify-between text-[12px] font-semibold text-black dark:text-neutral-200 py-1"
              >
                <span>London CC & ULEZ Zones</span>
                <span className={preferences.showUKZones ? 'text-[#7C3AED]' : 'text-neutral-400'}>
                  {preferences.showUKZones ? 'ON' : 'OFF'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleTogglePreference('speedCameraWarnings')}
                className="w-full flex items-center justify-between text-[12px] font-semibold text-black dark:text-neutral-200 py-1"
              >
                <span>Speed & Bus Cameras</span>
                <span className={preferences.speedCameraWarnings ? 'text-[#E11900]' : 'text-neutral-400'}>
                  {preferences.speedCameraWarnings ? 'ON' : 'OFF'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleTogglePreference('showBusySoonZones')}
                className="w-full flex items-center justify-between text-[12px] font-semibold text-black dark:text-neutral-200 py-1"
              >
                <span>Busy Soon Forecasts</span>
                <span className={preferences.showBusySoonZones ? 'text-[#D97706]' : 'text-neutral-400'}>
                  {preferences.showBusySoonZones ? 'ON' : 'OFF'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleCycleWeather}
                className="w-full flex items-center justify-between text-[12px] font-semibold text-black dark:text-neutral-200 py-1 border-t border-black/10 dark:border-white/10 pt-2"
              >
                <span>UK Weather Surge</span>
                <span className="text-[#276EF1] font-bold">{weatherCondition}</span>
              </button>
            </div>
          )}

          {/* TOP BAR OVERLAY ON MAP */}
          {tripStage === 'idle' ? (
            <div className="absolute top-[54px] inset-x-4 z-20 flex items-center justify-between pointer-events-none">
              {/* Left Button: Opens Separate Driver Home Menu */}
              <button
                type="button"
                onClick={() => setActiveTab('hub')}
                className="pointer-events-auto relative w-12 h-12 rounded-full bg-white dark:bg-[#18191D] shadow-lg border border-black/5 dark:border-white/10 flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all"
                aria-label="Open Driver Home Menu"
                title="Driver Home Menu"
              >
                <LayoutGrid className="w-5 h-5 text-black dark:text-white" />
                {unreadInboxCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 rounded-full bg-[#276EF1] text-white text-[11px] font-bold flex items-center justify-center tabular-nums shadow-xs">
                    {unreadInboxCount}
                  </span>
                )}
              </button>

              {/* Center Status Pill + Privacy Eye Toggle for Total Earned */}
              <div className="pointer-events-auto flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setTopPillMode((m) => ((m + 1) % 3) as 0 | 1 | 2)}
                  title="Tap to switch between Today's Earnings, Uber Pro, and Quest"
                  className="h-11 px-5 rounded-full bg-black dark:bg-[#18191D] text-white shadow-xl border border-white/15 flex items-center gap-2 hover:bg-neutral-900 active:scale-95 transition-all"
                >
                  {topPillMode === 0 && (
                    <>
                      <Diamond className="w-4 h-4 fill-[#276EF1] text-[#276EF1]" />
                      <span className="text-[18px] font-extrabold tracking-tight tabular-nums">
                        {ledger.proPoints}
                      </span>
                    </>
                  )}
                  {topPillMode === 1 && (
                    <>
                      <span className="text-[#05944F] text-[17px] font-extrabold">£</span>
                      <span className="text-[18px] font-extrabold tracking-tight tabular-nums">
                        {privacyHidden ? '••••' : todayEarnings.toFixed(2)}
                      </span>
                    </>
                  )}
                  {topPillMode === 2 && (
                    <>
                      <span className="text-[16px] font-extrabold tabular-nums">
                        {ledger.questCompletedCount}
                      </span>
                      <span className="text-white/40">|</span>
                      <span className="text-[16px] font-extrabold text-[#05944F] tabular-nums">
                        20
                      </span>
                    </>
                  )}
                </button>

                {/* Privacy Toggle Button right beside Total Earned */}
                <button
                  type="button"
                  onClick={() => setPrivacyHidden((v) => !v)}
                  className="w-11 h-11 rounded-full bg-white dark:bg-[#18191D] shadow-lg border border-black/5 dark:border-white/10 flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all"
                  aria-label={privacyHidden ? 'Show total earned' : 'Hide total earned'}
                  title={privacyHidden ? 'Show total earned' : 'Hide total earned'}
                >
                  {privacyHidden ? (
                    <EyeOff className="w-4 h-4 text-black dark:text-white" />
                  ) : (
                    <Eye className="w-4 h-4 text-black dark:text-white" />
                  )}
                </button>
              </div>

              {/* Right: Account Switcher + Destination Mode Search Button */}
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(true)}
                  className="w-11 h-11 rounded-full bg-white dark:bg-[#18191D] shadow-lg border border-black/5 dark:border-white/10 flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all"
                  aria-label="Driver Account"
                  title={`Driver: ${activeAccount.name}`}
                >
                  <User className="w-4 h-4 text-black dark:text-white" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowDestinationModal(true)}
                  className={`w-12 h-12 rounded-full shadow-lg border flex items-center justify-center active:scale-95 transition-all ${
                    destination.active
                      ? 'bg-[#276EF1] border-[#276EF1] text-white'
                      : 'bg-white dark:bg-[#18191D] border-black/5 dark:border-white/10 text-black dark:text-white hover:bg-[#F8F8F8] dark:hover:bg-[#22242A]'
                  }`}
                  aria-label="Destination Mode"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            /* ACTIVE TRIP TURN-BY-TURN TOP NAVIGATION BANNER */
            activeTrip &&
            liveNav && (
              <div className="absolute top-[54px] inset-x-4 z-20 flex flex-col items-center gap-2 pointer-events-none">
                <div className="pointer-events-auto w-full max-w-[490px] rounded-2xl bg-[#111111] text-white shadow-2xl overflow-hidden border border-white/10">
                  <div className="px-4 py-3 flex items-center gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        liveNav.isPickup
                          ? 'bg-[#05944F]'
                          : activeTrip.isIntercity
                          ? 'bg-[#7C3AED]'
                          : 'bg-[#276EF1]'
                      }`}
                    >
                      {renderManeuverIcon(liveNav.maneuverKind)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-extrabold text-[#5B9BF8] tabular-nums shrink-0">
                          {liveNav.distanceToTurnLabel}
                        </span>
                        <span className="text-white/35">·</span>
                        <p className="text-[15.5px] font-extrabold leading-tight truncate tabular-nums">
                          {liveNav.maneuverTitle}
                        </p>
                        {preferences.recordAudio && (
                          <span className="px-1.5 py-0.5 rounded bg-[#E11900] text-white text-[9.5px] font-extrabold uppercase shrink-0">
                            REC · Audio
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-white/75 truncate mt-0.5">
                        {liveNav.maneuverSubtitle}
                      </p>
                    </div>

                    {/* Dynamic Real-Time ETA Countdown & Distance Remaining */}
                    <div className="pl-3.5 border-l border-white/15 text-right shrink-0 tabular-nums">
                      <div className="flex items-baseline justify-end gap-1">
                        <span
                          className={`text-[19px] font-extrabold leading-none ${
                            liveNav.isArriving ? 'text-[#05944F]' : 'text-white'
                          }`}
                        >
                          {liveNav.etaCountdown}
                        </span>
                      </div>
                      <p className="text-[11.5px] font-semibold text-white/75 mt-1 whitespace-nowrap">
                        {liveNav.distanceRemaining} · {liveNav.etaClockTime}
                      </p>
                    </div>
                  </div>

                  {/* UK Lane Guidance Strip */}
                  {liveNav.lanes && liveNav.lanes.length > 0 && (
                    <div className="px-4 py-1.5 bg-white/5 border-t border-white/10 flex items-center justify-between gap-2">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-white/55">
                        Lane guidance
                      </span>
                      <div className="flex items-center gap-2">
                        {liveNav.lanes.map((lane, idx) => (
                          <div
                            key={`lane-${idx}`}
                            className={`w-6 h-6 rounded-md flex items-center justify-center ${
                              lane.recommended
                                ? 'bg-[#276EF1]/30 border border-[#5B9BF8]/60 text-white'
                                : 'bg-white/5 text-white/30'
                            }`}
                          >
                            {lane.direction === 'left' ? (
                              <CornerUpLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                            ) : lane.direction === 'right' ? (
                              <CornerUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                            ) : (
                              <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Live Route Completion Progress Strip */}
                  <div className="w-full h-1 bg-white/10">
                    <div
                      className={`h-full ${
                        liveNav.isPickup
                          ? 'bg-[#05944F]'
                          : activeTrip.isIntercity
                          ? 'bg-[#7C3AED]'
                          : 'bg-[#276EF1]'
                      }`}
                      style={{ width: `${Math.max(4, liveNav.progressPct)}%` }}
                    />
                  </div>
                </div>

                {/* Live UK Speed Camera Proximity Alert */}
                {nearbySpeedCamera && (
                  <div className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-[#111111]/95 text-white border border-[#E11900]/70 shadow-lg flex items-center gap-2 text-[12px] font-bold">
                    <Camera className="w-3.5 h-3.5 text-[#E11900]" />
                    <span>{nearbySpeedCamera.label}</span>
                  </div>
                )}
              </div>
            )
          )}

          {/* Active Destination Mode Banner, Permissions Pill & Optional Install Pill */}
          {tripStage === 'idle' && (
            <div className="absolute top-[112px] inset-x-14 z-20 flex flex-col items-center gap-2 pointer-events-none">
              {destination.active && (
                <button
                  type="button"
                  onClick={() => setShowDestinationModal(true)}
                  className="pointer-events-auto bg-white/95 dark:bg-[#18191D]/95 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-full px-4 py-1.5 shadow-md flex items-center gap-2 text-[12px] font-bold text-black dark:text-white hover:bg-white dark:hover:bg-[#22242A]"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#276EF1]" />
                  <span className="truncate max-w-[200px]">
                    {currentJobCity} → {destination.destinationName}
                  </span>
                  <span className="text-[#545454] dark:text-neutral-400 font-medium">
                    · {destination.routeType === 'flexible' ? 'Toward' : 'Direct'}
                  </span>
                </button>
              )}

              {!destination.active &&
                !pendingOffer &&
                !showRadarList &&
                (anchoredToLastJobRef.current || milesFromMyLocation >= 1.5) && (
                  <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        setDestination({
                          active: true,
                          destinationName: `Near ${myLocationLabel}`,
                          destinationAddress: isLiveGpsInUK
                            ? `${myLocationLabel} · Live GPS Area`
                            : `${myLocationLabel} City Centre`,
                          routeType: 'flexible',
                          arriveBy: 'Toward My Location',
                          coords: myLocationCoords,
                        });
                        showToast(
                          `Routing jobs from ${currentJobCity} toward ${myLocationLabel}`
                        );
                      }}
                      className="h-9 px-3.5 rounded-full bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[12px] font-bold shadow-lg flex items-center gap-1.5 active:scale-95 transition-all whitespace-nowrap"
                    >
                      <LocateFixed className="w-3.5 h-3.5" />
                      <span>Jobs → Near {myLocationLabel}</span>
                    </button>

                    {anchoredToLastJobRef.current && isLiveGpsInUK && realCoords && (
                      <button
                        type="button"
                        onClick={() => {
                          anchoredToLastJobRef.current = false;
                          const projected = clampMapCoords(
                            projectLatLngToMap(realCoords.lat, realCoords.lng)
                          );
                          driverPosRef.current = projected;
                          setDriverPos(projected);
                          setRecenterSignal((s) => s + 1);
                          showToast(`Moved back to live GPS · ${myLocationLabel}`);
                        }}
                        className="h-9 px-3 rounded-full bg-white/95 dark:bg-[#18191D]/95 backdrop-blur-md text-black dark:text-white text-[11.5px] font-bold shadow-md border border-black/10 dark:border-white/10 flex items-center gap-1.5 active:scale-95 transition-all whitespace-nowrap"
                      >
                        <Compass className="w-3.5 h-3.5 text-[#276EF1]" />
                        <span>Use Live GPS</span>
                      </button>
                    )}
                  </div>
                )}

              <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-center">
                {onlineStatus === 'online' && !pendingOffer && !showRadarList && (
                  <>
                    <button
                      type="button"
                      onClick={() => setOpportunitiesModalMode('trends')}
                      className="h-9 px-3 rounded-full bg-white/95 dark:bg-[#18191D]/95 backdrop-blur-md text-black dark:text-white text-[11.5px] font-bold shadow-md border border-black/10 dark:border-white/10 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Flame className="w-3.5 h-3.5 text-[#D97706]" />
                      <span>{demandContext.demandLevel}</span>
                    </button>
                    {(() => {
                      const shiftMin = Math.max(0, activeAccount.drivingMinutesUsedToday ?? 0);
                      const shiftHrs = Math.floor(shiftMin / 60);
                      const shiftRemMin = shiftMin % 60;
                      const estHourly = Math.round(
                        todayEarnings / Math.max(0.5, shiftMin / 60)
                      );
                      return (
                        <button
                          type="button"
                          onClick={() => setActiveTab('hub')}
                          className="h-9 px-3 rounded-full bg-black/90 dark:bg-[#18191D]/95 text-white text-[11.5px] font-bold shadow-md border border-white/15 flex items-center gap-1.5 whitespace-nowrap tabular-nums"
                          title="UK 12h PHV shift driving allowance"
                        >
                          <Timer className="w-3.5 h-3.5 text-[#05944F]" />
                          <span>
                            Shift {shiftHrs}h {shiftRemMin}m/12h
                            {!privacyHidden ? ` · £${estHourly}/hr` : ''}
                          </span>
                        </button>
                      );
                    })()}
                  </>
                )}
                {onlineStatus === 'online' && streakCount > 0 && !pendingOffer && !showRadarList && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('hub')}
                    className="h-9 px-3 rounded-full bg-[#FFF3D6] dark:bg-amber-950/90 text-[#B45309] dark:text-amber-300 text-[11.5px] font-extrabold shadow-md border border-[#F59E0B]/30 flex items-center gap-1 whitespace-nowrap tabular-nums"
                  >
                    <span>Streak {streakCount}/3 · +£12</span>
                  </button>
                )}
                {lockedSurgeBonus > 0 && !pendingOffer && !showRadarList && (
                  <div className="h-9 px-3 rounded-full bg-[#7C3AED] text-white text-[11.5px] font-extrabold shadow-lg flex items-center gap-1.5 whitespace-nowrap tabular-nums">
                    <span>
                      +£{lockedSurgeBonus.toFixed(2)} {lockedSurgeLabel ? `(${lockedSurgeLabel})` : 'Locked'}
                    </span>
                  </div>
                )}
                {airportQueue && onlineStatus === 'online' && !pendingOffer && !showRadarList && (
                  <button
                    type="button"
                    onClick={() => setOpportunitiesModalMode('airports')}
                    className="h-9 px-3 rounded-full bg-[#276EF1] text-white text-[11.5px] font-extrabold shadow-lg flex items-center gap-1.5 whitespace-nowrap tabular-nums"
                  >
                    <Plane className="w-3.5 h-3.5" />
                    <span>
                      {airportQueue.code} Queue #{airportQueue.position}
                    </span>
                  </button>
                )}
                {!pendingOffer && !showRadarList && (
                  <button
                    type="button"
                    onClick={handleDispatchIntercity}
                    className="h-9 px-3.5 rounded-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-[12px] font-bold shadow-lg flex items-center gap-1.5 active:scale-95 transition-all whitespace-nowrap"
                  >
                    <Route className="w-3.5 h-3.5" />
                    <span>Intercity Job</span>
                  </button>
                )}
                {isNativeAndroidApk() && !nativeBubblePerms.overlayGranted && (
                  <button
                    type="button"
                    onClick={() => setShowPermissionsModal(true)}
                    className="h-9 px-3.5 rounded-full bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[12px] font-bold shadow-lg flex items-center gap-1.5 active:scale-95 transition-all whitespace-nowrap"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Enable Floating Dot</span>
                  </button>
                )}
                {isNativeAndroidApk() &&
                  nativeBubblePerms.overlayGranted &&
                  onlineStatus === 'online' &&
                  !pendingOffer &&
                  !showRadarList && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          void previewNativeFloatingBubble();
                          showToast('Floating Uber dot active for 8s — drag anywhere!');
                        }}
                        className="h-9 px-3.5 rounded-full bg-black text-white border border-[#276EF1]/70 text-[12px] font-bold shadow-lg flex items-center gap-1.5 active:scale-95 transition-all whitespace-nowrap"
                      >
                        <Compass className="w-3.5 h-3.5 text-[#5B9BF8]" />
                        <span>Test Dot</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const sample = generateLocalTripOffer({
                            anchorCoords: driverPosRef.current,
                            realLatLng: getActiveGpsLatLng(),
                            seedIndex: offerIndex,
                            includeIntercity: preferences.intercity,
                            servicePrefs,
                            surgeLockedBonus: lockedSurgeBonus,
                            boostBonus: activeBoostBonus,
                            ccAlreadyPaidToday: ledger.ccPaidDateKey === todayDateKey,
                            areaPreference: preferences.areaPreference,
                            destination,
                            isEV: Boolean(activeAccount?.isEV),
                            acceptCashJobs: preferences.acceptCashJobs ?? true,
                          });
                          setOfferIndex((i) => i + 1);
                          recordOfferReceived(sample);
                          void previewNativeFloatingOfferCard(sample);
                          showToast(`Overlay job card open (${sample.pickupArea}) — tap Accept or X!`);
                        }}
                        className="h-9 px-3.5 rounded-full bg-[#276EF1] hover:bg-[#1E5CD4] text-white text-[12px] font-bold shadow-lg flex items-center gap-1.5 active:scale-95 transition-all whitespace-nowrap"
                      >
                        <span>Test Job Card</span>
                      </button>
                    </>
                  )}
                {permissionsReadyCount < 3 && (
                  <button
                    type="button"
                    onClick={() => setShowPermissionsModal(true)}
                    className="h-9 px-3.5 rounded-full bg-white dark:bg-[#18191D] text-black dark:text-white text-[12px] font-bold shadow-lg border border-black/10 dark:border-white/10 flex items-center gap-1.5 hover:bg-[#F3F3F3] dark:hover:bg-[#22242A] active:scale-95 transition-all whitespace-nowrap"
                  >
                    <Bell className="w-3.5 h-3.5 text-[#276EF1]" />
                    <span>Enable Alerts & GPS ({permissionsReadyCount}/3)</span>
                  </button>
                )}
                <PWAInstallButton variant="pill" />
              </div>
            </div>
          )}

          {/* FLOATING LEFT & RIGHT MAP CONTROLS (Hidden when sheets/offers occupy the map) */}
          {(() => {
            const hideBottomSideControls =
              (tripStage === 'idle' && (Boolean(pendingOffer) || showRadarList)) ||
              (tripStage !== 'idle' &&
                (isTripSheetExpanded ||
                  tripStage === 'waiting' ||
                  tripStage === 'stop_wait' ||
                  tripStage === 'dropoff_arrived' ||
                  tripStage === 'completed' ||
                  Boolean(queuedOffer || riderChangeOffer || stackedEatsOffer || trafficAlert)));

            if (hideBottomSideControls) return null;

            return (
              <>
                {/* FLOATING LEFT MAP CONTROLS (Dynamic UK Speed Limit Sign + Blue Shield Safety Toolkit) */}
                <div
                  className={`absolute left-3.5 z-20 flex flex-col items-center gap-2.5 ${
                    tripStage === 'idle' ? 'bottom-[120px]' : 'bottom-[162px]'
                  }`}
                >
                  {tripStage !== 'idle' && preferences.speedLimitAlerts && (
                    <div className="flex flex-col items-center gap-1">
                      <div className="w-11 h-11 rounded-full bg-white border-[4px] border-[#E11900] shadow-md flex items-center justify-center leading-none">
                        <span className="text-[17px] font-extrabold text-black tabular-nums">
                          {liveNav?.speedLimitMph ?? 30}
                        </span>
                      </div>
                      {(liveSpeedMph !== null || tripStage === 'pickup' || tripStage === 'enroute') && (
                        <div
                          className={`px-2 py-0.5 rounded-full text-white text-[10.5px] font-extrabold shadow-md tabular-nums ${
                            (liveSpeedMph ?? simSpeedMph) > (liveNav?.speedLimitMph ?? 30)
                              ? 'bg-[#E11900]'
                              : 'bg-black'
                          }`}
                        >
                          {liveSpeedMph ?? simSpeedMph} mph
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowSafetyModal(true)}
                    className="w-11 h-11 rounded-full bg-white dark:bg-[#18191D] shadow-lg border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all"
                    aria-label="Safety Toolkit"
                  >
                    <Shield className="w-5 h-5 text-[#276EF1] stroke-[2.2]" />
                  </button>
                </div>

                {/* FLOATING RIGHT MAP CONTROLS (Compact 3-button dock: Quick Tools Tray, Map Report, Recenter GPS) */}
                <div
                  className={`absolute right-3.5 z-20 flex flex-col items-center gap-2 ${
                    tripStage === 'idle' ? 'bottom-[120px]' : 'bottom-[162px]'
                  }`}
                >
                  {/* Map Tools Button + Horizontal Pop-out Tray (Night Mode, Sound, Trends) */}
                  <div className="relative">
                    {showMapToolsMenu && (
                      <div className="absolute right-12 top-0 flex items-center gap-1.5 p-1 rounded-full bg-white/95 dark:bg-[#18191D]/95 backdrop-blur-md shadow-xl border border-black/10 dark:border-white/10">
                        <button
                          type="button"
                          onClick={handleToggleNightMode}
                          className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/20 flex items-center justify-center active:scale-95 transition-all"
                          aria-label={preferences.nightMode ? 'Switch to Day Mode' : 'Switch to Night Mode'}
                          title={preferences.nightMode ? 'Night Mode On' : 'Day Mode'}
                        >
                          {preferences.nightMode ? (
                            <Sun className="w-4 h-4 text-[#FFC043]" />
                          ) : (
                            <Moon className="w-4 h-4 text-black" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            uberSounds.unlock();
                            const willEnable = !preferences.soundEffects;
                            handleTogglePreference('soundEffects');
                            if (willEnable) {
                              uberSounds.setEnabled(true);
                              uberSounds.play('exclusiveDispatch');
                            }
                          }}
                          className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/20 flex items-center justify-center active:scale-95 transition-all"
                          aria-label={preferences.soundEffects ? 'Mute driver sounds' : 'Unmute driver sounds'}
                          title={preferences.soundEffects ? 'Sounds On' : 'Sounds Muted'}
                        >
                          {preferences.soundEffects ? (
                            <Volume2 className="w-4 h-4 text-black dark:text-white" />
                          ) : (
                            <VolumeX className="w-4 h-4 text-[#E11900]" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setShowMapToolsMenu(false);
                            setOpportunitiesModalMode('trends');
                          }}
                          className="w-9 h-9 rounded-full bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/20 flex items-center justify-center active:scale-95 transition-all"
                          aria-label="Hourly earnings trends"
                          title="Hourly trends"
                        >
                          <BarChart2 className="w-4 h-4 text-black dark:text-white" />
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        setShowMapLayersPopover(false);
                        setShowMapToolsMenu((v) => !v);
                      }}
                      className={`w-10 h-10 rounded-full shadow-lg border flex items-center justify-center active:scale-95 transition-all ${
                        showMapToolsMenu
                          ? 'bg-black dark:bg-[#276EF1] text-white border-transparent'
                          : 'bg-white dark:bg-[#18191D] text-black dark:text-white border-black/10 dark:border-white/10 hover:bg-[#F8F8F8] dark:hover:bg-[#22242A]'
                      }`}
                      aria-label="Map tools: night mode, sound and trends"
                      title="Night Mode, Sound & Trends"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMapToolsMenu(false);
                      setShowMapReportModal(true);
                    }}
                    className="w-10 h-10 rounded-full bg-white dark:bg-[#18191D] shadow-lg border border-black/10 dark:border-white/10 flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all"
                    aria-label="Add a map report"
                    title="Add a map report"
                  >
                    <MessageSquarePlus className="w-4 h-4 text-black dark:text-white" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowMapToolsMenu(false);
                      if (anchoredToLastJobRef.current) {
                        showToast(
                          `Centered on previous job area · ${getResolvedLocalCityName(driverPos)}`
                        );
                      } else if (isLiveGpsInUK && realCoords && tripStage === 'idle') {
                        const projected = clampMapCoords(
                          projectLatLngToMap(realCoords.lat, realCoords.lng)
                        );
                        setDriverPos(projected);
                        showToast(`Centered on live GPS · ${getResolvedLocalCityName(projected)}`);
                      }
                      setRecenterSignal((s) => s + 1);
                    }}
                    className={`w-11 h-11 rounded-full bg-white dark:bg-[#18191D] shadow-lg border flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all ${
                      isLiveGpsInUK ? 'border-[#276EF1]/35' : 'border-black/10 dark:border-white/10'
                    }`}
                    aria-label="Recenter map"
                    title="Recenter GPS"
                  >
                    <Compass
                      className={`w-5 h-5 ${isLiveGpsInUK ? 'text-[#276EF1]' : 'text-black dark:text-white'}`}
                    />
                  </button>
                </div>
              </>
            );
          })()}

          {/* ICONIC CIRCULAR BLUE "GO" BUTTON ON MAP */}
          {onlineStatus === 'offline' && tripStage === 'idle' && (
            <div className="absolute bottom-[106px] left-1/2 -translate-x-1/2 z-20">
              <button
                type="button"
                onClick={handleToggleOnline}
                className="relative w-[86px] h-[86px] rounded-full bg-[#276EF1] hover:bg-[#1E5CD4] active:scale-95 text-white shadow-2xl flex items-center justify-center transition-all focus:outline-none"
                aria-label="Go online"
              >
                <span className="absolute inset-1.5 rounded-full border-2 border-white/40 pointer-events-none" />
                <span className="text-[26px] font-extrabold tracking-tight">Go</span>
              </button>
            </div>
          )}

          {/* VOICE COMMANDS QUICK STRIP (iOS Safari fallback tap chips + Web Speech indicator) */}
          {preferences.voiceCommandsEnabled &&
            onlineStatus === 'online' &&
            !showRadarList &&
            !isTripSheetExpanded &&
            (tripStage === 'idle' || tripStage === 'pickup' || tripStage === 'enroute') && (
              <div
                className={`absolute z-30 flex justify-center pointer-events-none ${
                  pendingOffer
                    ? 'top-[108px] inset-x-12'
                    : tripStage !== 'idle'
                    ? 'bottom-[166px] inset-x-16'
                    : 'bottom-[204px] inset-x-16'
                }`}
              >
              <div className="pointer-events-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/90 dark:bg-[#18191D]/95 text-white border border-white/15 shadow-xl text-[11px] font-bold">
                <span className="inline-flex items-center gap-1 pr-1.5 border-r border-white/15">
                  <Mic
                    className={`w-3.5 h-3.5 ${
                      voiceStatus.listening ? 'text-[#05944F] animate-pulse' : 'text-[#5B9BF8]'
                    }`}
                  />
                  <span>
                    {voiceStatus.listening
                      ? voiceStatus.lastHeard
                        ? `"${voiceStatus.lastHeard.slice(0, 14)}"`
                        : 'Listening'
                      : isSpeechRecognitionSupported()
                      ? 'Voice'
                      : 'Voice Chips'}
                  </span>
                </span>
                {pendingOffer && tripStage === 'idle' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleVoiceDriverCommand('accept')}
                      className="px-2 py-0.5 rounded-full bg-[#05944F] text-white"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVoiceDriverCommand('decline')}
                      className="px-2 py-0.5 rounded-full bg-[#E11900] text-white"
                    >
                      Decline
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => handleVoiceDriverCommand('read_message')}
                      className="px-2 py-0.5 rounded-full bg-white/15 hover:bg-white/25"
                    >
                      Read Note
                    </button>
                    {tripStage === 'idle' ? (
                      <button
                        type="button"
                        onClick={() => handleVoiceDriverCommand('go_offline')}
                        className="px-2 py-0.5 rounded-full bg-[#E11900]/80 hover:bg-[#E11900]"
                      >
                        Go Offline
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleVoiceDriverCommand('navigate')}
                        className="px-2 py-0.5 rounded-full bg-[#276EF1] hover:bg-[#1E5CD4]"
                      >
                        Speak Turn
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* TRIP OFFER / TRIP RADAR OVERLAY */}
          {(pendingOffer || showRadarList) && tripStage === 'idle' && (
            <div className="absolute inset-x-3 bottom-4 z-40 max-w-[440px] mx-auto">
              <TripOfferModal
                offer={pendingOffer || radarOffers[0] || fallbackLocalOffer}
                tripFilter={preferences.tripFilter}
                onAccept={handleAcceptOffer}
                onDecline={handleDeclineOffer}
                onMoveToRadarMatch={handleMoveToRadarMatch}
                onRadarMatchFailed={handleRadarMatchFailed}
                initialMatchingId={radarMatchingId}
                radarOffers={radarOffers}
                showRadarList={showRadarList}
                radarRefreshSecLeft={radarRefreshSecLeft}
                onDeclineRadarItem={handleDeclineRadarItem}
                onCloseRadarList={() => {
                  setShowRadarList(false);
                  setRadarMatchingId(null);
                }}
              />
            </div>
          )}

          {/* ACTIVE TRIP SHEET OVERLAY */}
          {activeTrip && tripStage !== 'idle' && (
            <div className="absolute inset-x-0 bottom-2 sm:bottom-6 sm:inset-x-4 z-40 max-w-[460px] mx-auto pb-[env(safe-area-inset-bottom,0px)]">
              <ActiveTripSheet
                trip={activeTrip}
                stage={tripStage}
                liveEtaLabel={liveNav?.etaMinLabel}
                liveDistanceLabel={liveNav?.distanceRemaining}
                navProgress={navProgress}
                routeSteps={activeRoute?.steps}
                currentStepIdx={currentStepIdx}
                waitFeeAccrued={tripWaitFee}
                stopVisited={stopVisited}
                queuedOffer={queuedOffer}
                navProvider={preferences.navProvider}
                licensePlate={activeAccount.licensePlate}
                weatherCondition={weatherCondition}
                trafficAlert={trafficAlert}
                riderChangeOffer={riderChangeOffer}
                stackedEatsOffer={stackedEatsOffer}
                onTakeFasterRoute={handleTakeFasterRoute}
                onAcceptRiderChange={handleAcceptRiderChange}
                onDeclineRiderChange={handleDeclineRiderChange}
                onAcceptStackedEats={handleAcceptStackedEats}
                onDeclineStackedEats={handleDeclineStackedEats}
                onArrivePickup={handleArrivePickup}
                onStartTrip={handleStartTrip}
                onArriveStop={handleArriveStop}
                onContinueFromStop={handleContinueFromStop}
                onArriveDropoff={handleArriveDropoff}
                onCompleteTrip={handleCompleteTrip}
                onSubmitRating={handleSubmitRating}
                onNoShowCancel={handleNoShowCancel}
                onAcceptQueued={() => {
                  if (!queuedOffer) return;
                  recordOfferDecision(queuedOffer, 'accepted', 'queued');
                  uberSounds.play('accept');
                  setAcceptedNextOffer(queuedOffer);
                  setQueuedOffer(null);
                  showToast(`Next ride queued (${queuedOffer.serviceName}) · Starts after dropoff`);
                }}
                onDeclineQueued={() => {
                  if (queuedOffer) {
                    recordOfferDecision(queuedOffer, 'declined', 'queued');
                  }
                  uberSounds.play('decline');
                  setQueuedOffer(null);
                  showToast('Queued ride declined');
                }}
                onCancelTrip={handleCancelTrip}
                onOpenPreferences={() => setShowPreferencesModal(true)}
                onExpandedChange={setIsTripSheetExpanded}
                onShareCompletedReceipt={() => {
                  const surcharge = activeTrip.surchargeAmount ?? 0;
                  const uberFee = Number((Math.max(0, activeTrip.fare - surcharge) * 0.25).toFixed(2));
                  const netPayout = Number((activeTrip.fare + tripWaitFee - uberFee).toFixed(2));
                  void handleShareTripReceipt({
                    id: activeTrip.id,
                    riderName: activeTrip.riderName,
                    serviceName: activeTrip.serviceName,
                    fare: activeTrip.fare,
                    tip: 0,
                    waitFee: tripWaitFee,
                    uberFee,
                    netPayout,
                    distanceMiles: activeTrip.tripMiles,
                    durationMin: activeTrip.tripMinutes,
                    pickupArea: activeTrip.pickupArea.split(',')[0],
                    dropoffArea: activeTrip.dropoffArea.split('·')[0].split(',')[0].trim(),
                    completedAt: 'Just now',
                  });
                }}
              />
            </div>
          )}

          {/* BOTTOM STATUS DOCK ON MAP (Pull-Up Menu when Online + Swapping Online/Finding Trips Text) */}
          {tripStage === 'idle' && !pendingOffer && !showRadarList && (
            <div className="absolute bottom-0 inset-x-0 z-20 flex justify-center pointer-events-none">
              <div
                onTouchStart={(e) => {
                  if (onlineStatus === 'online') {
                    (e.currentTarget as HTMLDivElement).dataset.touchY = String(
                      e.touches[0].clientY
                    );
                  }
                }}
                onTouchEnd={(e) => {
                  if (onlineStatus !== 'online') return;
                  const startY = Number(
                    (e.currentTarget as HTMLDivElement).dataset.touchY || '0'
                  );
                  const endY = e.changedTouches[0]?.clientY ?? startY;
                  if (startY - endY > 24) {
                    setShowStopMenu(true);
                  }
                }}
                className="pointer-events-auto w-full max-w-[540px] bg-white dark:bg-[#141416] rounded-t-3xl shadow-[0_-6px_24px_rgba(0,0,0,0.08)] border-t border-black/5 dark:border-white/10"
              >
                {onlineStatus === 'online' && (
                  <div className="w-full h-1 bg-[#E8F0FE] dark:bg-white/10 overflow-hidden rounded-t-3xl">
                    <div className="w-1/2 h-full bg-[#276EF1] animate-uber-radar" />
                  </div>
                )}

                {/* Visible Pull-Up Grabber Handle when Online */}
                {onlineStatus === 'online' && (
                  <button
                    type="button"
                    onClick={() => setShowStopMenu(true)}
                    className="w-full pt-2 pb-0.5 flex flex-col items-center justify-center group"
                    aria-label="Open pull-up menu"
                  >
                    <span className="w-11 h-1.5 rounded-full bg-black/20 dark:bg-white/25 group-hover:bg-black/35 dark:group-hover:bg-white/40 transition-colors" />
                  </button>
                )}

                <div className="px-4 py-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPreferencesModal(true)}
                    className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center shrink-0"
                    aria-label="Driving Preferences"
                  >
                    <SlidersHorizontal className="w-5 h-5 text-black dark:text-white" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (onlineStatus === 'offline') {
                        setActiveTab('hub');
                      } else {
                        setShowStopMenu(true);
                      }
                    }}
                    className="flex-1 text-center py-1 min-w-0 flex flex-col items-center"
                  >
                    <div className="inline-flex items-center gap-1.5 max-w-full">
                      <p className="text-[18px] font-extrabold text-black dark:text-white truncate">
                        {onlineStatus === 'offline'
                          ? "You're offline"
                          : isOnBreak
                          ? 'On Coffee Break'
                          : statusSwapOnline
                          ? "You're online"
                          : 'Finding trips...'}
                      </p>
                      {onlineStatus === 'online' && (
                        <ChevronUp className="w-4 h-4 text-[#545454] dark:text-neutral-400 shrink-0" />
                      )}
                    </div>
                    {onlineStatus === 'online' && (
                      <p
                        className={`text-[11.5px] font-semibold tabular-nums truncate ${
                          isOnBreak ? 'text-[#D97706]' : 'text-[#276EF1]'
                        }`}
                      >
                        {isOnBreak
                          ? `Break ${formatSecMmSs(breakSecondsLeft)} · Dispatches paused`
                          : `Online ${formatOnlineTimer(onlineElapsedSec)} · ${
                              nextOfferSecLeft !== null
                                ? `Next request ~${formatSecMmSs(nextOfferSecLeft)}`
                                : 'Pull up to Stop'
                            }`}
                      </p>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onlineStatus === 'online'
                        ? setShowStopMenu(true)
                        : setOpportunitiesModalMode('opportunities')
                    }
                    className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center shrink-0"
                    aria-label={onlineStatus === 'online' ? 'Open driver pull-up menu' : 'Opportunities'}
                  >
                    {onlineStatus === 'online' ? (
                      <ChevronUp className="w-5 h-5 text-black dark:text-white" />
                    ) : (
                      <List className="w-5 h-5 text-black dark:text-white" />
                    )}
                  </button>
                </div>

                {/* Centered Trip Radar Pill - hidden when no jobs */}
                {onlineStatus === 'online' && radarOffers.length > 0 && (
                  <div className="px-4 pb-3 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        radarOffers.forEach(recordOfferReceived);
                        setShowRadarList(true);
                      }}
                      className="h-9 px-4 rounded-full bg-black dark:bg-[#276EF1] text-white text-[12.5px] font-bold flex items-center gap-2 hover:bg-neutral-800 dark:hover:bg-[#1E5CD4] active:scale-95 transition-all shadow-md tabular-nums"
                    >
                      <Radar className="w-3.5 h-3.5 text-[#5B9BF8] dark:text-white" />
                      <span>Trip Radar ({radarOffers.length})</span>
                      <span className="text-white/50">·</span>
                      <span className="text-[11px] text-white/75">
                        {radarRefreshSecLeft}s
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* =====================================================================
           SEPARATE FULL-SCREEN TAB VIEWS (Home Menu Hub, Earnings, Inbox, Menu)
           ===================================================================== */
        <div className="flex-1 min-h-0 flex flex-col bg-white dark:bg-[#0E0F12] overflow-hidden">
          {activeTab === 'hub' && (
            <HomeMenuView
              account={activeAccount}
              onlineStatus={onlineStatus}
              onlineElapsedSec={onlineElapsedSec}
              todayEarnings={todayEarnings}
              privacyHidden={privacyHidden}
              questCompletedCount={ledger.questCompletedCount}
              tripStats={ledger.tripStats}
              preferences={preferences}
              nextOfferSecLeft={nextOfferSecLeft}
              radarRefreshSecLeft={radarRefreshSecLeft}
              radarCount={radarOffers.length}
              permissionsReadyCount={permissionsReadyCount}
              demandContext={demandContext}
              airportQueue={airportQueue}
              lockedSurgeAmount={lockedSurgeBonus}
              isOnBreak={isOnBreak}
              breakSecondsLeft={breakSecondsLeft}
              onToggleBreak={handleToggleBreak}
              onResetRestLock={handleResetRestLock}
              onBackToMap={() => setActiveTab('home')}
              onToggleOnline={handleToggleOnline}
              onTogglePrivacy={() => setPrivacyHidden((v) => !v)}
              onToggleNightMode={handleToggleNightMode}
              onOpenAccounts={() => setShowAccountModal(true)}
              onOpenFaceVerify={() => {
                setPendingGoOnlineAfterVerify(false);
                setShowFaceVerifyModal(true);
              }}
              onOpenSafety={() => setShowSafetyModal(true)}
              onOpenPreferences={() => setShowPreferencesModal(true)}
              onOpenOpportunities={(section) => setOpportunitiesModalMode(section)}
              onOpenTrips={() => {
                setTripsReturnTab('hub');
                setActiveTab('trips');
              }}
              onOpenEarnings={() => setActiveTab('earnings')}
              onOpenAccountMenu={() => setActiveTab('menu')}
              onOpenTripRadar={() => {
                radarOffers.forEach(recordOfferReceived);
                setActiveTab('home');
                setShowRadarList(true);
              }}
              onOpenPermissions={() => setShowPermissionsModal(true)}
              onDispatchIntercity={handleDispatchIntercity}
              onRechargeVehicle={handleRechargeVehicle}
              onOpenChargers={() => setShowChargersModal(true)}
              weatherCondition={weatherCondition}
              onCycleWeather={handleCycleWeather}
              streakCount={streakCount}
            />
          )}

          {activeTab === 'trips' && (
            <TripsMenuView
              tripStats={ledger.tripStats}
              completedTrips={ledger.completedTrips}
              privacyHidden={privacyHidden}
              onResetStats={() => {
                recordedReceivedIdsRef.current.clear();
                resolvedOfferIdsRef.current.clear();
                setLedger((prev) => ({
                  ...prev,
                  tripStats: { ...EMPTY_TRIP_STATS, history: [] },
                }));
                showToast('Trip counters reset');
              }}
              onBack={() => setActiveTab(tripsReturnTab)}
            />
          )}

          {activeTab === 'reserve' && (
            <ReserveView
              localCity={getResolvedLocalCityName(driverPos)}
              availableReserves={availableReserves}
              scheduledReserves={scheduledReserves}
              onAcceptReserve={handleAcceptReserve}
              onCancelReserve={handleCancelReserve}
              onStartReserveTrip={handleStartReserveTrip}
              onRefreshReserves={handleRefreshReserves}
              onBack={() => setActiveTab('home')}
            />
          )}

          {activeTab === 'earnings' && (
            <EarningsView
              weeklyEarnings={weeklyEarnings}
              todayEarnings={todayEarnings}
              walletBalance={ledger.walletBalance}
              dailyTotals={ledger.dailyTotals}
              completedTrips={ledger.completedTrips}
              expenses={ledger.expenses}
              payouts={ledger.payouts}
              costSettings={preferences.costSettings}
              weeklyInsuranceGbp={activeAccount.insurancePolicy?.weeklyPremiumGbp}
              onUpdateCostSettings={(nextCost: DriverCostSettings) => {
                setPreferences((prev) => ({ ...prev, costSettings: nextCost }));
                showToast('Vehicle & fuel cost assumptions updated');
              }}
              questCompletedCount={ledger.questCompletedCount}
              dailyGoalGbp={preferences.dailyGoalGbp}
              weeklyGoalGbp={preferences.weeklyGoalGbp}
              onUpdateGoals={(daily, weekly) => {
                setPreferences((prev) => ({
                  ...prev,
                  dailyGoalGbp: daily,
                  weeklyGoalGbp: weekly,
                }));
                showToast(`Goals updated: £${daily}/day · £${weekly}/wk`);
              }}
              privacyHidden={privacyHidden}
              onTogglePrivacy={() => setPrivacyHidden((v) => !v)}
              onBack={() => setActiveTab('home')}
              onCashOut={handleCashOut}
              onOpenOpportunities={() => setOpportunitiesModalMode('opportunities')}
              onOpenTrends={() => setOpportunitiesModalMode('trends')}
              onOpenChargers={() => setShowChargersModal(true)}
              onExportTaxCsv={handleExportTaxCsv}
              onShareTripReceipt={handleShareTripReceipt}
              onFileTripClaim={handleFileTripClaim}
              holidayPayAccrued={ledger.holidayPayAccrued ?? 0}
              holidayPayClaimedTotal={ledger.holidayPayClaimedTotal ?? 0}
              engagedMinutesTotal={ledger.engagedMinutesTotal ?? 42}
              onlineMinutesTotal={ledger.onlineMinutesTotal ?? 60}
              onClaimHolidayPay={handleClaimHolidayPay}
            />
          )}

          {activeTab === 'inbox' && (
            <InboxView
              threads={inboxThreads}
              onBack={() => setActiveTab('home')}
              onMarkRead={handleMarkInboxRead}
              onReplyThread={handleReplyInbox}
              onConfirmLostItemReturn={handleConfirmLostItemReturn}
            />
          )}

          {activeTab === 'menu' && (
            <MenuView
              account={activeAccount}
              proPoints={ledger.proPoints}
              walletBalance={ledger.walletBalance}
              totalBusinessMiles={totalBusinessMiles}
              tripStats={ledger.tripStats}
              compliments={ledger.compliments}
              streakCount={streakCount}
              preferences={preferences}
              notificationPermission={notificationPermission}
              lastRefreshedAt={lastRefreshedAt}
              refreshCount={refreshCount}
              wakeLockActive={wakeLockActive}
              periodicSyncActive={periodicSyncActive}
              isRefreshing={isRefreshing}
              onBack={() => setActiveTab('home')}
              onOpenAccounts={() => setShowAccountModal(true)}
              onOpenFaceVerify={() => {
                setPendingGoOnlineAfterVerify(false);
                setShowFaceVerifyModal(true);
              }}
              onToggleNightMode={handleToggleNightMode}
              onSignOut={handleSignOut}
              onOpenSafety={() => setShowSafetyModal(true)}
              onOpenPreferences={() => setShowPreferencesModal(true)}
              onOpenOpportunities={() => setOpportunitiesModalMode('opportunities')}
              onOpenTrips={() => {
                setTripsReturnTab('menu');
                setActiveTab('trips');
              }}
              onOpenEarnings={() => setActiveTab('earnings')}
              onOpenInbox={() => setActiveTab('inbox')}
              onToggleNotifications={handleToggleNotifications}
              onSendTestNotification={handleSendTestNotification}
              onToggleBackgroundRefresh={handleToggleBackgroundRefresh}
              onTriggerRefreshNow={handleTriggerRefreshNow}
              onOpenPermissions={() => setShowPermissionsModal(true)}
              onNotifyToast={showToast}
              onUpdateComplianceDoc={handleUpdateComplianceDoc}
              onUpdateInsurancePolicy={handleUpdateInsurancePolicy}
              onResetRestLock={handleResetRestLock}
              onExportTaxCsv={handleExportTaxCsv}
              offlinePendingCount={offlinePendingCount}
              isOfflineFlushing={isOfflineFlushing}
              onFlushOfflineQueue={() => {
                void flushOfflineQueueNow().then((r) => {
                  if (r.flushed > 0) {
                    showToast(`Synced ${r.flushed} queued item(s) to Firestore`);
                  } else if (r.remaining > 0) {
                    showToast('Still offline or sign in with Google Sync to upload queue');
                  }
                });
              }}
            />
          )}
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      {tripStage === 'idle' && !pendingOffer && !showRadarList && (
        <div className="shrink-0">
          <BottomNav
            activeTab={activeTab === 'hub' ? 'home' : activeTab === 'trips' ? 'menu' : activeTab}
            unreadInboxCount={unreadInboxCount}
            scheduledReserveCount={scheduledReserves.length}
            onChangeTab={setActiveTab}
          />
        </div>
      )}

      {/* =====================================================================
          SHARED OVERLAY MODALS
          ===================================================================== */}
      {showAccountModal && (
        <AccountModal
          accounts={accounts}
          activeAccount={activeAccount}
          rememberedLogin={rememberedLogin}
          onSelectAccount={handleSelectAccount}
          onSignInCredentials={handleSignInCredentials}
          onRegisterAccount={handleRegisterAccount}
          onExportBackupCode={handleExportBackupCode}
          onRestoreBackupCode={handleRestoreBackupCode}
          onSignOut={handleSignOut}
          onClose={() => setShowAccountModal(false)}
        />
      )}

      {showFaceVerifyModal && (
        <FaceVerificationModal
          account={activeAccount}
          reason={
            pendingGoOnlineAfterVerify
              ? 'Take a quick selfie for UK TfL / PHV identity verification before going online.'
              : 'Verify your driver identity using the front camera biometric oval.'
          }
          onVerified={handleFaceVerified}
          onCancel={() => {
            setShowFaceVerifyModal(false);
            setPendingGoOnlineAfterVerify(false);
          }}
        />
      )}

      {showPermissionsModal && (
        <PermissionsModal
          notificationPermission={notificationPermission}
          notificationsEnabled={preferences.notificationsEnabled}
          gpsPermissionState={gpsPermissionState}
          gpsExplicitlyAccepted={gpsExplicitlyAccepted}
          hasRealCoords={realCoords !== null}
          backgroundAppRefresh={preferences.backgroundAppRefresh}
          wakeLockActive={wakeLockActive}
          nativeBubblePerms={nativeBubblePerms}
          onAcceptNotifications={handleAcceptNotificationPermission}
          onAcceptLocation={handleAcceptLocationPermission}
          onAcceptBackgroundRefresh={handleAcceptBackgroundRefresh}
          onRequestAndroidOverlay={() => {
            void requestAndroidOverlayPermission();
          }}
          onRequestAndroidBattery={() => {
            void requestAndroidBatteryOptimization();
          }}
          onPreviewFloatingDot={() => {
            void previewNativeFloatingBubble();
            showToast('Floating Uber dot visible for 8s — drag anywhere!');
          }}
          onPreviewFloatingJobCard={() => {
            const sample = generateLocalTripOffer({
              anchorCoords: driverPosRef.current,
              realLatLng: getActiveGpsLatLng(),
              seedIndex: offerIndex,
              includeIntercity: preferences.intercity,
              servicePrefs,
              areaPreference: preferences.areaPreference,
              destination,
              isEV: Boolean(activeAccount?.isEV),
              acceptCashJobs: preferences.acceptCashJobs ?? true,
            });
            setOfferIndex((i) => i + 1);
            setShowPermissionsModal(false);
            void previewNativeFloatingOfferCard(sample);
            showToast(`Overlay job card preview (${sample.pickupArea}) — tap Accept or Dot`);
          }}
          onPinAndroidWidget={() => {
            void requestPinAndroidWidget().then((supported) => {
              if (supported) {
                showToast('Confirm on your home screen to pin the Uber Driver widget');
              } else {
                showToast('Long-press your Android home screen → Widgets → Uber Driver');
              }
            });
          }}
          onAcceptAll={handleAcceptAllPermissions}
          onClose={() => setShowPermissionsModal(false)}
        />
      )}

      {showMapReportModal && (
        <MapReportModal
          onSelectCategory={handleAddMapReport}
          onClose={() => setShowMapReportModal(false)}
        />
      )}

      {showDestinationModal && (
        <DestinationModeModal
          destination={destination}
          currentJobCity={currentJobCity}
          myLocationLabel={myLocationLabel}
          myLocationCoords={myLocationCoords}
          hasLiveGps={isLiveGpsInUK}
          driverPos={driverPos}
          onActivate={(cfg) => {
            setDestination(cfg);
            setShowDestinationModal(false);
            showToast(`Jobs from ${currentJobCity} → ${cfg.destinationName}`);
          }}
          onClear={() => {
            setDestination(DEFAULT_DESTINATION);
            setShowDestinationModal(false);
            showToast('Destination Mode turned off');
          }}
          onClose={() => setShowDestinationModal(false)}
        />
      )}

      {showSafetyModal && (
        <SafetyToolkitModal
          preferences={preferences}
          onTogglePreference={handleTogglePreference}
          onShareLiveTripNow={handleShareLiveTrip}
          onClose={() => setShowSafetyModal(false)}
        />
      )}

      {showPreferencesModal && (
        <PreferencesSheet
          preferences={preferences}
          accountTier={activeAccount.tier}
          onTogglePreference={handleTogglePreference}
          onUpdateTripFilter={(nextFilter: TripFilterRules) => {
            setPreferences((prev) => ({ ...prev, tripFilter: nextFilter }));
            showToast(
              nextFilter.enabled
                ? `Trip Filter active: min £${nextFilter.minFareGbp.toFixed(2)} · £${nextFilter.minPerMileGbp.toFixed(2)}/mi`
                : 'Trip Filter rules paused'
            );
          }}
          onSetFloatingDotMode={(mode: 'dot' | 'card') => {
            setPreferences((prev) => ({ ...prev, floatingDotAlertMode: mode }));
            void setNativeBubbleAlertMode(mode);
            showToast(
              mode === 'dot'
                ? 'Floating bubble set to Dot Only (Default)'
                : 'Floating bubble set to Auto-Show Job Card'
            );
          }}
          onSetAreaPreference={(area) => {
            setPreferences((prev) => ({ ...prev, areaPreference: area }));
            const labels: Record<string, string> = {
              all: 'All UK Areas',
              central: 'Central London',
              east: 'East & Canary Wharf',
              west: 'West & Heathrow',
              local: 'Local Area Only',
            };
            showToast(`Area preference: ${labels[area] || area}`);
          }}
          onSetNavProvider={(provider: NavProvider) => {
            setPreferences((prev) => ({ ...prev, navProvider: provider }));
            showToast(
              `Navigation set to ${
                provider === 'uber'
                  ? 'Uber In-App Nav'
                  : provider === 'google'
                  ? 'Google Maps'
                  : provider === 'waze'
                  ? 'Waze'
                  : 'Apple Maps'
              }`
            );
          }}
          onResetDefaults={() => {
            setPreferences(INITIAL_PREFERENCES);
            void setNativeBubbleAlertMode(INITIAL_PREFERENCES.floatingDotAlertMode);
          }}
          onClose={() => setShowPreferencesModal(false)}
        />
      )}

      {opportunitiesModalMode && (
        <OpportunitiesModal
          initialSection={opportunitiesModalMode}
          questCompletedCount={ledger.questCompletedCount}
          enrolledIds={enrolledOppIds}
          activeAirportQueueCode={airportQueue?.code ?? null}
          onJoinAirportQueue={(code, airportName) => {
            setAirportQueue({
              code,
              name: airportName,
              position: Math.floor(Math.random() * 5) + 4,
            });
            showToast(`Checked in to ${code} Virtual Queue · Bump protection active`);
          }}
          onToggleEnroll={(id) => {
            setEnrolledOppIds((prev) => {
              const removing = prev.includes(id);
              const next = removing ? prev.filter((item) => item !== id) : [...prev, id];
              showToast(
                removing ? 'Opted out of promotion' : 'Enrolled — auto-payouts active!'
              );
              return next;
            });
          }}
          onClose={() => setOpportunitiesModalMode(null)}
        />
      )}

      {showChargersModal && activeAccount && (
        <RapidChargersModal
          driverPos={driverPos}
          batteryPct={activeAccount.batteryPct ?? 84}
          isEV={Boolean(activeAccount.isEV)}
          onSelectCharge={handleSelectCharge}
          onClose={() => setShowChargersModal(false)}
        />
      )}

      {showStopMenu && (
        <div
          onClick={() => setShowStopMenu(false)}
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-end justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[540px] bg-white dark:bg-[#141416] rounded-t-3xl px-6 pt-3 pb-7 space-y-5 shadow-2xl border-t border-black/10 dark:border-white/10"
          >
            <div className="flex justify-center">
              <span className="w-12 h-1.5 rounded-full bg-black/15 dark:bg-white/25" />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[20px] font-extrabold text-black dark:text-white">
                  {statusSwapOnline ? "You're online" : 'Finding trips...'}
                </h3>
                <p className="text-[13px] font-semibold text-[#276EF1] tabular-nums mt-0.5">
                  Time online · {formatOnlineTimer(onlineElapsedSec)}
                </p>
                <p className="text-[12px] text-[#545454] dark:text-neutral-400 mt-0.5">
                  Tap Stop to go offline and pause incoming trip requests
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowStopMenu(false)}
                className="w-10 h-10 rounded-full bg-[#F3F3F3] dark:bg-white/10 flex items-center justify-center font-bold text-black dark:text-white"
                aria-label="Close pull-up menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Circular Red "Stop" Button matching Circular Blue "Go" Button */}
            <div className="py-2 flex flex-col items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowStopMenu(false);
                  handleToggleOnline();
                }}
                className="relative w-[92px] h-[92px] rounded-full bg-[#E11900] hover:bg-[#C51500] active:scale-95 text-white shadow-2xl flex items-center justify-center transition-all focus:outline-none"
                aria-label="Stop and go offline"
              >
                <span className="absolute inset-1.5 rounded-full border-2 border-white/40 pointer-events-none" />
                <span className="text-[24px] font-extrabold tracking-tight">Stop</span>
              </button>
              <span className="text-[12px] font-semibold text-[#545454] dark:text-neutral-400">
                Go offline
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  handleToggleBreak();
                  setShowStopMenu(false);
                }}
                className={`h-12 rounded-2xl text-[13.5px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                  isOnBreak
                    ? 'bg-[#05944F] text-white'
                    : 'bg-[#FFF3D6] dark:bg-amber-950/70 text-[#B45309] dark:text-amber-300'
                }`}
              >
                <Coffee className="w-4 h-4" />
                <span>{isOnBreak ? `Resume (${formatSecMmSs(breakSecondsLeft)})` : 'Coffee Break'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowStopMenu(false);
                  setShowPreferencesModal(true);
                }}
                className="h-12 rounded-2xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-black dark:text-white text-[13.5px] font-bold transition-all active:scale-[0.98]"
              >
                Preferences
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowStopMenu(false)}
              className="w-full h-11 rounded-2xl bg-black dark:bg-[#276EF1] text-white text-[14px] font-bold transition-all active:scale-[0.98]"
            >
              Keep Driving
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
