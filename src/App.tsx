import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BarChart2,
  Bell,
  Camera,
  CheckCircle2,
  ChevronUp,
  Compass,
  CornerUpLeft,
  CornerUpRight,
  Diamond,
  Eye,
  EyeOff,
  GitMerge,
  LayoutGrid,
  List,
  MapPin,
  MessageSquarePlus,
  Moon,
  Radar,
  RefreshCw,
  Route,
  Search,
  Shield,
  SlidersHorizontal,
  Sun,
  User,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AccountModal } from './components/AccountModal';
import { ActiveTripSheet } from './components/ActiveTripSheet';
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
import { ReserveView } from './components/ReserveView';
import { SafetyToolkitModal } from './components/SafetyToolkitModal';
import { TripOfferModal } from './components/TripOfferModal';
import { UberMap } from './components/UberMap';
import {
  BUSY_SOON_ZONES,
  DEFAULT_DESTINATION,
  INITIAL_INBOX_THREADS,
  INITIAL_PREFERENCES,
  INITIAL_SURGE_ZONES,
} from './data/mockDriverData';
import { useBackgroundRefresh } from './hooks/useBackgroundRefresh';
import {
  BusySoonZone,
  CompletedTrip,
  ComputedRoute,
  Coordinates,
  DestinationConfig,
  DriverAccount,
  DriverOnlineStatus,
  DriverPreferences,
  InboxThread,
  MainTab,
  MapReportCategory,
  MapReportPin,
  NavManeuverKind,
  NavProvider,
  ReserveTrip,
  SurgeZone,
  TripOffer,
  TripStage,
} from './types/driver';
import {
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
  DriverLedger,
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
  scheduleNativeBackgroundOffer,
  setNativeImmersiveNavHidden,
  startNativeOnlineBubbleService,
  stopNativeOnlineBubbleService,
  syncNativeAppForeground,
} from './native/floatingDot';
import { uberSounds } from './utils/uberSounds';
import {
  clampMapCoords,
  isWithinUKBounds,
  projectLatLngToMap,
  UK_SPEED_CAMERAS,
} from './utils/ukGeo';
import {
  buildLocalOfferPool,
  generateLocalReserveTrips,
  generateLocalTripOffer,
  getResolvedLocalCityName,
  prefetchLocalPlaces,
} from './utils/localDispatch';
import {
  buildFallbackUKRoute,
  fetchUKRoute,
  speakNavInstruction,
} from './utils/ukRouting';

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

  // Primary navigation & online status
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [onlineStatus, setOnlineStatus] = useState<DriverOnlineStatus>(
    () => savedSession?.onlineStatus ?? 'offline'
  );
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
  const [offerIndex, setOfferIndex] = useState<number>(0);
  const [pendingOffer, setPendingOffer] = useState<TripOffer | null>(null);
  const [activeTrip, setActiveTrip] = useState<TripOffer | null>(
    () => savedSession?.activeTrip ?? null
  );
  const [activeRoute, setActiveRoute] = useState<ComputedRoute | null>(null);
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

  useEffect(() => {
    try {
      const payload = {
        onlineStatus,
        tripStage,
        activeTrip,
        driverPos,
        navProgress,
        queuedOffer,
      };
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  }, [onlineStatus, tripStage, activeTrip, driverPos, navProgress, queuedOffer]);
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
    const rc = realCoordsRef.current;
    if (rc && isWithinUKBounds(rc.lat, rc.lng)) {
      return rc;
    }
    return undefined;
  }, []);

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

  const availableReserves = useMemo(() => {
    const generated = generateLocalReserveTrips(
      driverPos,
      isWithinUKBounds(realCoords?.lat ?? 0, realCoords?.lng ?? 0) ? realCoords : undefined,
      reserveSeed,
      6
    );
    return generated.filter((r) => !acceptedReserveIds.includes(r.id));
  }, [driverPos, realCoords, reserveSeed, localGeoVersion, acceptedReserveIds]);

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

  const prevAccountIdRef = useRef<string | undefined>(activeAccount?.id);
  useEffect(() => {
    const acctId = activeAccount?.id;
    if (!acctId || prevAccountIdRef.current === acctId) return;
    prevAccountIdRef.current = acctId;
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

  // Track UK 12-hour driving time limit while online
  useEffect(() => {
    if (onlineStatus !== 'online' || !activeAccount?.id) return;
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
    }, 60000);
    return () => clearInterval(id);
  }, [onlineStatus, activeAccount?.id]);

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

  // Play looping Uber Driver dispatch ping & sync Android floating dot on offer change
  useEffect(() => {
    if (pendingOffer && tripStage === 'idle') {
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

  const handleNativeOverlayAction = useCallback((result: NativeBubbleActionResult | null) => {
    if (!result) return;
    const { action, offer } = result;
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

    if (onlineStatus === 'online') {
      void startNativeOnlineBubbleService(
        getResolvedLocalCityName(driverPosRef.current),
        activeAccount?.name ?? 'Driver'
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
          offerIndex
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
    preferences.intercity,
    offerIndex,
    handleNativeOverlayAction,
    getActiveGpsLatLng,
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
      });
      const second = generateLocalTripOffer({
        anchorCoords: driverPosRef.current,
        realLatLng: gps,
        seedIndex: nextBatch * 2 + 1,
        forceType: 'radar',
        includeIntercity: preferences.intercity,
      });
      setRadarOffers([first, second]);
    },
    [getActiveGpsLatLng, preferences.intercity]
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

  // Job request timer when online & idle (starts hidden, triggers local job card around driver GPS)
  useEffect(() => {
    if (onlineStatus !== 'online' || tripStage !== 'idle' || pendingOffer || showRadarList) {
      setNextOfferSecLeft(null);
      return;
    }

    const randomDelaySec = Math.floor(Math.random() * 25) + 8;
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
          });
          setPendingOffer(next);
          setOfferIndex((i) => i + 1);
          pushDriverAlert(
            `${
              next.isIntercity ? 'Intercity' : next.type === 'radar' ? 'Trip Radar' : 'Exclusive'
            } · £${next.fare.toFixed(2)}`,
            `${next.serviceName} · ${next.pickupArea} → ${next.dropoffArea} (${next.pickupMinutes} min away)`,
            `offer-${next.id}`,
            () => setActiveTab('home')
          );
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [
    onlineStatus,
    tripStage,
    pendingOffer,
    showRadarList,
    offerIndex,
    preferences.intercity,
    pushDriverAlert,
    getActiveGpsLatLng,
  ]);

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
    });
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
    stopVisited,
    offerIndex,
  ]);

  // Speed & Bus-Lane Camera proximity warning during active UK navigation
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
    setOnlineStatus('online');
    setRadarOffers([]); // Trip Radar shows no job and is hidden until timer triggers
    setRadarRefreshSecLeft(60);
    setActiveTab('home');
    void startNativeOnlineBubbleService(
      getResolvedLocalCityName(driverPosRef.current),
      activeAccount?.name ?? 'Driver'
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
  }, [activeAccount?.name, nativeBubblePerms.overlayGranted, showToast]);

  const handleToggleOnline = () => {
    uberSounds.unlock();
    if (onlineStatus === 'offline') {
      if (!isFaceVerifiedRecently(activeAccount)) {
        setPendingGoOnlineAfterVerify(true);
        setShowFaceVerifyModal(true);
        return;
      }
      completeGoOnline();
    } else {
      uberSounds.play('offline');
      setOnlineStatus('offline');
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
      showToast("You're offline");
    }
  };

  const handleAcceptOffer = useCallback(
    (offer: TripOffer) => {
      uberSounds.unlock();
      uberSounds.play('accept');
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
    [activeAccount?.id]
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
    });
    setIntercityIdx((i) => i + 1);
    if (onlineStatus === 'offline') {
      setOnlineStatus('online');
    }
    setShowRadarList(false);
    setPendingOffer(offer);
    setActiveTab('home');
    setRecenterSignal((s) => s + 1);
    uberSounds.unlock();
    showToast(
      `Intercity dispatch: ${offer.pickupArea} → ${offer.dropoffArea.split('·')[0].trim()}`
    );
  }, [intercityIdx, onlineStatus, preferences.intercity, showToast, getActiveGpsLatLng]);

  const handleRechargeVehicle = useCallback(() => {
    if (!activeAccount?.id) return;
    setAccounts((prev) =>
      prev.map((acct) =>
        acct.id === activeAccount.id ? { ...acct, batteryPct: 100 } : acct
      )
    );
    showToast('EV battery rapid-charged to 100% (~250 mi range)');
  }, [activeAccount?.id, showToast]);

  const handleMoveToRadarMatch = useCallback(
    (offer: TripOffer) => {
      uberSounds.unlock();
      setPendingOffer(null);
      setRadarOffers([offer]);
      setRadarMatchingId(offer.id);
      setShowRadarList(true);
      showToast('Sent to Trip Radar — matching for 10s...');
    },
    [showToast]
  );

  const handleRadarMatchFailed = useCallback(
    (_offer: TripOffer) => {
      uberSounds.play('decline');
      setRadarMatchingId(null);
      setRadarOffers([]);
      setShowRadarList(false);
      const next = generateLocalTripOffer({
        anchorCoords: driverPosRef.current,
        realLatLng: getActiveGpsLatLng(),
        seedIndex: offerIndex + 1,
        includeIntercity: preferences.intercity,
      });
      setOfferIndex((i) => i + 1);
      showToast('Another driver matched — loading next available job...');
      setTimeout(() => {
        if (onlineStatus === 'online' && tripStageRef.current === 'idle') {
          setPendingOffer(next);
        }
      }, 700);
    },
    [onlineStatus, preferences.intercity, offerIndex, showToast, getActiveGpsLatLng]
  );

  const handleDeclineOffer = useCallback(
    (offer: TripOffer) => {
      uberSounds.play('decline');
      setPendingOffer(null);
      setRadarMatchingId(null);
      if (offer.type === 'exclusive' && activeAccount?.id) {
        setAccounts((prev) =>
          prev.map((acct) =>
            acct.id === activeAccount.id
              ? { ...acct, acceptanceRate: Math.max(50, acct.acceptanceRate - 1) }
              : acct
          )
        );
        showToast('Exclusive declined · Acceptance rate updated');
      } else {
        showToast('Request declined');
      }
    },
    [activeAccount?.id, showToast]
  );

  const handleAcceptReserve = useCallback(
    (trip: ReserveTrip) => {
      uberSounds.unlock();
      uberSounds.play('accept');
      setAcceptedReserveIds((prev) => [...prev, trip.id]);
      setScheduledReserves((prev) => {
        if (prev.some((r) => r.id === trip.id)) return prev;
        return [{ ...trip, status: 'scheduled' as const }, ...prev].sort(
          (a, b) => a.scheduledAtMs - b.scheduledAtMs
        );
      });
      showToast(`Reserve confirmed · ${trip.dayLabel}, ${trip.timeLabel}`);
    },
    [showToast]
  );

  const handleCancelReserve = useCallback(
    (tripId: string) => {
      uberSounds.play('decline');
      setScheduledReserves((prev) => prev.filter((r) => r.id !== tripId));
      showToast('Reserve trip cancelled');
    },
    [showToast]
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
          activeAccount?.name ?? 'Driver'
        );
        void setNativeImmersiveNavHidden(true);
      }
      setScheduledReserves((prev) => prev.filter((r) => r.id !== trip.id));
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
        pinCode: trip.pinCode,
        surchargeLabel: 'Uber Reserve Fee',
        surchargeAmount: trip.reserveFee,
        riderNote: trip.riderNote,
        expiresInSec: 30,
      };
      handleAcceptOffer(convertedOffer);
      showToast(`Starting Uber Reserve pickup · ${trip.pickupAddress}`);
    },
    [onlineStatus, activeAccount?.name, handleAcceptOffer, showToast]
  );

  nativeActionHandlersRef.current = {
    accept: handleAcceptOffer,
    decline: handleDeclineOffer,
    radarMatch: handleMoveToRadarMatch,
  };

  const handleDeclineRadarItem = useCallback(
    (offer: TripOffer) => {
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
    [showToast]
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

  const handleCompleteTrip = () => {
    if (!activeTrip) return;
    uberSounds.unlock();
    uberSounds.play('completeTrip');
    const currentKey = getLocalDateKey();
    setTodayDateKey(currentKey);

    const tipAmt = activeTrip.riderName === 'Joséfina' ? 2.5 : activeTrip.isIntercity ? 5.0 : 0;
    const surcharge = activeTrip.surchargeAmount ?? 0;
    const waitFee = tripWaitFee;
    const uberFee = Number((Math.max(0, activeTrip.fare - surcharge) * 0.25).toFixed(2));
    const totalGross = Number((activeTrip.fare + waitFee + tipAmt).toFixed(2));
    const netPayout = Number((totalGross - uberFee).toFixed(2));

    const timeLabel = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const newRecord: CompletedTrip = {
      id: `trip-${Date.now()}`,
      riderName: activeTrip.riderName,
      serviceName: activeTrip.serviceName,
      fare: activeTrip.fare,
      tip: tipAmt,
      waitFee,
      surchargeAmount: surcharge,
      surchargeLabel: activeTrip.surchargeLabel,
      uberFee,
      netPayout,
      distanceMiles: activeTrip.tripMiles,
      durationMin: activeTrip.tripMinutes,
      pickupArea: activeTrip.pickupArea.split(',')[0],
      dropoffArea: activeTrip.dropoffArea.split('·')[0].split(',')[0].trim(),
      completedAt: `Today, ${timeLabel}`,
      dateKey: currentKey,
      isIntercity: activeTrip.isIntercity,
    };

    setLedger((prev) => ({
      dailyTotals: {
        ...prev.dailyTotals,
        [currentKey]: Number(
          ((prev.dailyTotals[currentKey] ?? 0) + netPayout).toFixed(2)
        ),
      },
      walletBalance: Number((prev.walletBalance + netPayout).toFixed(2)),
      proPoints: prev.proPoints + (activeTrip.isIntercity ? 30 : 12),
      questCompletedCount: prev.questCompletedCount + 1,
      completedTrips: [newRecord, ...prev.completedTrips],
    }));

    // Drain EV battery / fuel based on trip distance
    if (activeAccount?.id) {
      const drainPct = Math.max(1, Math.round(activeTrip.tripMiles / 2.5));
      setAccounts((prev) =>
        prev.map((acct) =>
          acct.id === activeAccount.id
            ? { ...acct, batteryPct: Math.max(5, (acct.batteryPct ?? 84) - drainPct) }
            : acct
        )
      );
    }

    pushDriverAlert(
      `Trip complete · +£${netPayout.toFixed(2)} net`,
      'Saved to today’s real earnings ledger until midnight',
      `done-${newRecord.id}`,
      () => setActiveTab('earnings')
    );

    setTripStage('completed');
  };

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

    setActiveTrip(null);
    setActiveRoute(null);
    setTripWaitFee(0);
    setStopVisited(false);
    setQueuedOffer(null);
    setAcceptedNextOffer(null);
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
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }));
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
        completedTrips: Array.isArray(rawLedger.completedTrips)
          ? rawLedger.completedTrips
          : [],
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
      showToast('Push notifications accepted');
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

  const handleCashOut = (amount: number, _method: 'instant' | 'bank') => {
    setLedger((prev) => ({
      ...prev,
      walletBalance: Math.max(0, Number((prev.walletBalance - amount).toFixed(2))),
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

  const formatSecMmSs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isLiveGpsInUK =
    realCoords !== null && isWithinUKBounds(realCoords.lat, realCoords.lng);

  const fallbackLocalOffer = useMemo(
    () =>
      generateLocalTripOffer({
        anchorCoords: driverPos,
        realLatLng: isLiveGpsInUK ? realCoords : undefined,
        seedIndex: offerIndex,
        forceType: 'radar',
        includeIntercity: preferences.intercity,
      }),
    [driverPos, isLiveGpsInUK, realCoords, offerIndex, preferences.intercity, localGeoVersion]
  );

  // If user signed out, show full-screen Driver UK Sign-In Gate
  if (isSignedOut || !activeAccount) {
    return (
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
      <DynamicIsland
        onlineStatus={onlineStatus}
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
      <OfflineIndicator />

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
            showTrafficLayer={preferences.showTrafficLayer}
            showUKZones={preferences.showUKZones}
            showSpeedCameras={preferences.speedCameraWarnings}
            showBusySoonZones={preferences.showBusySoonZones}
            onSelectSurgeZone={handleSelectSurgeZone}
            onSelectBusySoonZone={handleSelectBusySoonZone}
            onToggleMapLayers={() => setShowMapLayersPopover((v) => !v)}
          />

          {/* Compact UK Map Layers Popover */}
          {showMapLayersPopover && (
            <div className="absolute right-16 bottom-[236px] z-30 w-56 rounded-2xl bg-white/95 dark:bg-[#16181E]/95 backdrop-blur-md p-3 shadow-2xl border border-black/10 dark:border-white/10 space-y-2">
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
            <div className="absolute top-[112px] inset-x-4 z-20 flex flex-col items-center gap-2 pointer-events-none">
              {destination.active && (
                <button
                  type="button"
                  onClick={() => setShowDestinationModal(true)}
                  className="pointer-events-auto bg-white/95 dark:bg-[#18191D]/95 backdrop-blur-md border border-black/10 dark:border-white/10 rounded-full px-4 py-1.5 shadow-md flex items-center gap-2 text-[12px] font-bold text-black dark:text-white hover:bg-white dark:hover:bg-[#22242A]"
                >
                  <MapPin className="w-3.5 h-3.5 text-[#276EF1]" />
                  <span className="truncate max-w-[200px]">
                    Heading to {destination.destinationName}
                  </span>
                  <span className="text-[#545454] dark:text-neutral-400 font-medium">
                    · {destination.routeType === 'flexible' ? 'Flexible' : 'Faster'}
                  </span>
                </button>
              )}

              <div className="pointer-events-auto flex items-center gap-2 flex-wrap justify-center">
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
                          });
                          setOfferIndex((i) => i + 1);
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

          {/* FLOATING LEFT MAP CONTROLS (Dynamic UK Speed Limit Sign + Blue Shield Safety Toolkit) */}
          <div
            className={`absolute left-4 z-20 flex flex-col items-center gap-3 ${
              tripStage === 'idle' ? 'bottom-[128px]' : 'bottom-[218px]'
            }`}
          >
            {tripStage !== 'idle' && preferences.speedLimitAlerts && (
              <div className="flex flex-col items-center gap-1.5">
                <div className="w-12 h-12 rounded-full bg-white border-[4px] border-[#E11900] shadow-md flex items-center justify-center leading-none">
                  <span className="text-[19px] font-extrabold text-black tabular-nums">
                    {liveNav?.speedLimitMph ?? 30}
                  </span>
                </div>
                {(liveSpeedMph !== null || tripStage === 'pickup' || tripStage === 'enroute') && (
                  <div
                    className={`px-2.5 py-0.5 rounded-full text-white text-[11px] font-extrabold shadow-md tabular-nums ${
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
              className="w-12 h-12 rounded-full bg-white dark:bg-[#18191D] shadow-lg border border-black/5 dark:border-white/10 flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all"
              aria-label="Safety Toolkit"
            >
              <Shield className="w-6 h-6 text-[#276EF1] stroke-[2.2]" />
            </button>
          </div>

          {/* FLOATING RIGHT MAP CONTROLS (Night Mode, Sound, Map Report, Trends, Recenter GPS) */}
          <div
            className={`absolute right-4 z-20 flex flex-col items-center gap-2.5 ${
              tripStage === 'idle' ? 'bottom-[128px]' : 'bottom-[218px]'
            }`}
          >
            <button
              type="button"
              onClick={handleToggleNightMode}
              className="w-12 h-12 rounded-full bg-white dark:bg-[#18191D] shadow-lg border border-black/5 dark:border-white/10 flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all"
              aria-label={preferences.nightMode ? 'Switch to Day Mode' : 'Switch to Night Mode'}
              title={preferences.nightMode ? 'Night Mode On' : 'Day Mode'}
            >
              {preferences.nightMode ? (
                <Sun className="w-5 h-5 text-[#FFC043]" />
              ) : (
                <Moon className="w-5 h-5 text-black" />
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
              className="w-12 h-12 rounded-full bg-white dark:bg-[#18191D] shadow-lg border border-black/5 dark:border-white/10 flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all"
              aria-label={preferences.soundEffects ? 'Mute driver sounds' : 'Unmute driver sounds'}
              title={preferences.soundEffects ? 'Sounds On' : 'Sounds Muted'}
            >
              {preferences.soundEffects ? (
                <Volume2 className="w-5 h-5 text-black dark:text-white" />
              ) : (
                <VolumeX className="w-5 h-5 text-[#E11900]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowMapReportModal(true)}
              className="w-12 h-12 rounded-full bg-white dark:bg-[#18191D] shadow-lg border border-black/5 dark:border-white/10 flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all"
              aria-label="Add a map report"
              title="Add a map report"
            >
              <MessageSquarePlus className="w-5 h-5 text-black dark:text-white" />
            </button>

            {tripStage === 'idle' && (
              <button
                type="button"
                onClick={() => setOpportunitiesModalMode('trends')}
                className="w-12 h-12 rounded-full bg-white dark:bg-[#18191D] shadow-lg border border-black/5 dark:border-white/10 flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all"
                aria-label="Hourly earnings trends"
                title="Hourly trends"
              >
                <BarChart2 className="w-5 h-5 text-black dark:text-white" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isLiveGpsInUK && realCoords && tripStage === 'idle') {
                  const projected = clampMapCoords(
                    projectLatLngToMap(realCoords.lat, realCoords.lng)
                  );
                  setDriverPos(projected);
                  showToast(`Centered on live GPS · ${getResolvedLocalCityName(projected)}`);
                }
                setRecenterSignal((s) => s + 1);
              }}
              className={`w-12 h-12 rounded-full bg-white dark:bg-[#18191D] shadow-lg border flex items-center justify-center hover:bg-[#F8F8F8] dark:hover:bg-[#22242A] active:scale-95 transition-all ${
                isLiveGpsInUK ? 'border-[#276EF1]/35' : 'border-black/5 dark:border-white/10'
              }`}
              aria-label="Recenter map"
              title="Recenter GPS"
            >
              <Compass
                className={`w-5 h-5 ${isLiveGpsInUK ? 'text-[#276EF1]' : 'text-black dark:text-white'}`}
              />
            </button>
          </div>

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

          {/* TRIP OFFER / TRIP RADAR OVERLAY */}
          {(pendingOffer || showRadarList) && tripStage === 'idle' && (
            <div className="absolute inset-x-3 bottom-4 z-40 max-w-[440px] mx-auto">
              <TripOfferModal
                offer={pendingOffer || radarOffers[0] || fallbackLocalOffer}
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
                routeSteps={activeRoute?.steps}
                currentStepIdx={currentStepIdx}
                waitFeeAccrued={tripWaitFee}
                stopVisited={stopVisited}
                queuedOffer={queuedOffer}
                navProvider={preferences.navProvider}
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
                  uberSounds.play('accept');
                  setAcceptedNextOffer(queuedOffer);
                  setQueuedOffer(null);
                  showToast(`Next ride queued (${queuedOffer.serviceName}) · Starts after dropoff`);
                }}
                onDeclineQueued={() => {
                  uberSounds.play('decline');
                  setQueuedOffer(null);
                  showToast('Queued ride declined');
                }}
                onCancelTrip={handleCancelTrip}
                onOpenPreferences={() => setShowPreferencesModal(true)}
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
                          : statusSwapOnline
                          ? "You're online"
                          : 'Finding trips...'}
                      </p>
                      {onlineStatus === 'online' && (
                        <ChevronUp className="w-4 h-4 text-[#545454] dark:text-neutral-400 shrink-0" />
                      )}
                    </div>
                    {onlineStatus === 'online' && (
                      <p className="text-[11.5px] font-semibold text-[#276EF1] tabular-nums truncate">
                        {nextOfferSecLeft !== null
                          ? `Next request ~${formatSecMmSs(nextOfferSecLeft)} · Pull up to Stop`
                          : 'Pull up for Stop menu'}
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
                      onClick={() => setShowRadarList(true)}
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
              todayEarnings={todayEarnings}
              privacyHidden={privacyHidden}
              questCompletedCount={ledger.questCompletedCount}
              preferences={preferences}
              nextOfferSecLeft={nextOfferSecLeft}
              radarRefreshSecLeft={radarRefreshSecLeft}
              radarCount={radarOffers.length}
              permissionsReadyCount={permissionsReadyCount}
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
              onOpenEarnings={() => setActiveTab('earnings')}
              onOpenAccountMenu={() => setActiveTab('menu')}
              onOpenTripRadar={() => {
                setActiveTab('home');
                setShowRadarList(true);
              }}
              onOpenPermissions={() => setShowPermissionsModal(true)}
              onDispatchIntercity={handleDispatchIntercity}
              onRechargeVehicle={handleRechargeVehicle}
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
            />
          )}

          {activeTab === 'inbox' && (
            <InboxView
              threads={inboxThreads}
              onBack={() => setActiveTab('home')}
              onMarkRead={handleMarkInboxRead}
              onReplyThread={handleReplyInbox}
            />
          )}

          {activeTab === 'menu' && (
            <MenuView
              account={activeAccount}
              proPoints={ledger.proPoints}
              walletBalance={ledger.walletBalance}
              totalBusinessMiles={totalBusinessMiles}
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
              onOpenEarnings={() => setActiveTab('earnings')}
              onOpenInbox={() => setActiveTab('inbox')}
              onToggleNotifications={handleToggleNotifications}
              onSendTestNotification={handleSendTestNotification}
              onToggleBackgroundRefresh={handleToggleBackgroundRefresh}
              onTriggerRefreshNow={handleTriggerRefreshNow}
              onOpenPermissions={() => setShowPermissionsModal(true)}
              onNotifyToast={showToast}
            />
          )}
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      {tripStage === 'idle' && !pendingOffer && !showRadarList && (
        <div className="shrink-0">
          <BottomNav
            activeTab={activeTab === 'hub' ? 'home' : activeTab}
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
            });
            setOfferIndex((i) => i + 1);
            setShowPermissionsModal(false);
            void previewNativeFloatingOfferCard(sample);
            showToast(`Overlay job card preview (${sample.pickupArea}) — tap Accept or Dot`);
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
          onActivate={(cfg) => {
            setDestination(cfg);
            setShowDestinationModal(false);
            showToast(`Destination Mode set: ${cfg.destinationName}`);
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
          onClose={() => setShowSafetyModal(false)}
        />
      )}

      {showPreferencesModal && (
        <PreferencesSheet
          preferences={preferences}
          onTogglePreference={handleTogglePreference}
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
          onResetDefaults={() => setPreferences(INITIAL_PREFERENCES)}
          onClose={() => setShowPreferencesModal(false)}
        />
      )}

      {opportunitiesModalMode && (
        <OpportunitiesModal
          initialSection={opportunitiesModalMode}
          questCompletedCount={ledger.questCompletedCount}
          onClose={() => setOpportunitiesModalMode(null)}
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
                <p className="text-[13px] text-[#545454] dark:text-neutral-400">
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
                  setShowStopMenu(false);
                  setShowPreferencesModal(true);
                }}
                className="h-12 rounded-2xl bg-[#F3F3F3] dark:bg-white/10 hover:bg-[#E5E5E5] dark:hover:bg-white/15 text-black dark:text-white text-[14px] font-bold transition-all active:scale-[0.98]"
              >
                Driving Preferences
              </button>
              <button
                type="button"
                onClick={() => setShowStopMenu(false)}
                className="h-12 rounded-2xl bg-black dark:bg-[#276EF1] text-white text-[14px] font-bold transition-all active:scale-[0.98]"
              >
                Keep Driving
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
