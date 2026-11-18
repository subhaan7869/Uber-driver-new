import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUp,
  BarChart2,
  Bell,
  CheckCircle2,
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
import { SafetyToolkitModal } from './components/SafetyToolkitModal';
import { TripOfferModal } from './components/TripOfferModal';
import { UberMap } from './components/UberMap';
import {
  DEFAULT_DESTINATION,
  INITIAL_INBOX_THREADS,
  INITIAL_PREFERENCES,
  INITIAL_SURGE_ZONES,
  SAMPLE_TRIP_OFFERS,
} from './data/mockDriverData';
import { useBackgroundRefresh } from './hooks/useBackgroundRefresh';
import {
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
  SurgeZone,
  TripOffer,
  TripStage,
} from './types/driver';
import {
  getActiveAccountId,
  isExplicitlySignedOut,
  loadAccounts,
  saveAccounts,
  setActiveAccountId,
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
import { uberSounds } from './utils/uberSounds';
import {
  clampMapCoords,
  isWithinUKBounds,
  nearestUKCity,
  projectLatLngToMap,
} from './utils/ukGeo';
import {
  buildFallbackUKRoute,
  fetchUKRoute,
  speakNavInstruction,
} from './utils/ukRouting';

const ALL_RADAR_POOL = SAMPLE_TRIP_OFFERS.filter((o) => o.type === 'radar');

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
  const [isSignedOut, setIsSignedOut] = useState<boolean>(() => isExplicitlySignedOut());
  const [activeAccountIdState, setActiveAccountIdState] = useState<string>(() => {
    const savedId = getActiveAccountId();
    const list = loadAccounts();
    if (savedId && list.some((a) => a.id === savedId)) return savedId;
    return list[0].id;
  });

  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === activeAccountIdState) ?? accounts[0] ?? null,
    [accounts, activeAccountIdState]
  );

  useEffect(() => {
    saveAccounts(accounts);
  }, [accounts]);

  // Primary navigation & online status
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [onlineStatus, setOnlineStatus] = useState<DriverOnlineStatus>('offline');
  const [tripStage, setTripStage] = useState<TripStage>('idle');

  // Map & Driver GPS state (defaults to active account's UK city)
  const [driverPos, setDriverPos] = useState<Coordinates>(() =>
    getCityStartCoords(activeAccount?.city ?? 'London')
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
  const [activeTrip, setActiveTrip] = useState<TripOffer | null>(null);
  const [activeRoute, setActiveRoute] = useState<ComputedRoute | null>(null);
  const [routeWpIdx, setRouteWpIdx] = useState<number>(0);
  const [currentStepIdx, setCurrentStepIdx] = useState<number>(0);
  const [tripWaitFee, setTripWaitFee] = useState<number>(0);
  const [showRadarList, setShowRadarList] = useState<boolean>(false);
  const [radarBatchIdx, setRadarBatchIdx] = useState<number>(0);
  const [radarOffers, setRadarOffers] = useState<TripOffer[]>(() =>
    ALL_RADAR_POOL.slice(0, 2)
  );
  const [radarRefreshSecLeft, setRadarRefreshSecLeft] = useState<number>(60);
  const [nextOfferSecLeft, setNextOfferSecLeft] = useState<number | null>(null);

  const [legStartDistPx, setLegStartDistPx] = useState<number>(150);
  const [navNowMs, setNavNowMs] = useState<number>(() => Date.now());
  const [gpsPermissionState, setGpsPermissionState] = useState<'idle' | 'active' | 'denied'>('idle');
  const [gpsExplicitlyAccepted, setGpsExplicitlyAccepted] = useState<boolean>(false);
  const [realCoords, setRealCoords] = useState<{ lat: number; lng: number } | null>(null);

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
    return () => clearInterval(id);
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
    if (realCoords !== null || gpsPermissionState === 'active') count += 1;
    if (preferences.notificationsEnabled && notificationPermission === 'granted') count += 1;
    if (preferences.backgroundAppRefresh) count += 1;
    return count;
  }, [
    realCoords,
    gpsPermissionState,
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
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, speed } = pos.coords;
        setGpsPermissionState('active');
        setRealCoords({ lat: latitude, lng: longitude });

        if (typeof speed === 'number' && !Number.isNaN(speed)) {
          setLiveSpeedMph(Math.max(0, Math.round(speed * 2.23694)));
        }

        if (tripStageRef.current === 'idle' && isWithinUKBounds(latitude, longitude)) {
          setDriverPos(clampMapCoords(projectLatLngToMap(latitude, longitude)));
          if (typeof heading === 'number' && !Number.isNaN(heading)) {
            setDriverHeading(heading);
          }
        }
      },
      () => {
        setGpsPermissionState('denied');
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [onlineStatus, tripStage, gpsExplicitlyAccepted]);

  // Play looping Uber Driver dispatch ping while an offer is on screen
  useEffect(() => {
    if (pendingOffer && tripStage === 'idle') {
      uberSounds.startDispatchLoop();
    } else {
      uberSounds.stopDispatchLoop();
    }
    return () => {
      uberSounds.stopDispatchLoop();
    };
  }, [pendingOffer, tripStage]);

  // Trip Radar 60-second auto-refresh when online
  const rotateRadarOffers = useCallback((nextBatch: number) => {
    if (ALL_RADAR_POOL.length === 0) return;
    const first = ALL_RADAR_POOL[nextBatch % ALL_RADAR_POOL.length];
    const second = ALL_RADAR_POOL[(nextBatch + 1) % ALL_RADAR_POOL.length];
    const list = first.id === second.id ? [first] : [first, second];
    setRadarOffers(list);
  }, []);

  useEffect(() => {
    if (onlineStatus !== 'online') {
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
  }, [onlineStatus, rotateRadarOffers]);

  // Random job request timer within 5 minutes (15s - 300s) when online & idle
  useEffect(() => {
    if (onlineStatus !== 'online' || tripStage !== 'idle' || pendingOffer || showRadarList) {
      setNextOfferSecLeft(null);
      return;
    }

    const randomDelaySec = Math.floor(Math.random() * 285) + 15;
    setNextOfferSecLeft(randomDelaySec);

    const countdownInterval = setInterval(() => {
      setNextOfferSecLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(countdownInterval);
          const next = SAMPLE_TRIP_OFFERS[offerIndex % SAMPLE_TRIP_OFFERS.length];
          setPendingOffer(next);
          setOfferIndex((i) => i + 1);
          pushDriverAlert(
            `${next.type === 'radar' ? 'Trip Radar' : 'Exclusive'} · £${next.fare.toFixed(2)}`,
            `${next.serviceName} · ${next.riderName} (${next.pickupMinutes} min away)`,
            `offer-${next.id}`,
            () => setActiveTab('home')
          );
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownInterval);
  }, [onlineStatus, tripStage, pendingOffer, showRadarList, offerIndex, pushDriverAlert]);

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

    const isDropoffLeg = tripStage === 'enroute' || tripStage === 'dropoff_arrived';
    const start = isDropoffLeg ? trip.pickupCoords : driverPosRef.current;
    const end = isDropoffLeg ? trip.dropoffCoords : trip.pickupCoords;
    const label = isDropoffLeg ? trip.dropoffAddress : trip.pickupAddress;

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
  }, [activeTrip, pendingOffer, tripStage]);

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

  // Smooth 60fps requestAnimationFrame polyline navigation during pickup & enroute
  const headingRef = useRef<number>(driverHeading);
  headingRef.current = driverHeading;
  const routeWpIdxRef = useRef<number>(routeWpIdx);
  routeWpIdxRef.current = routeWpIdx;

  useEffect(() => {
    if (!activeTrip) return;
    if (tripStage !== 'pickup' && tripStage !== 'enroute') return;

    const poly =
      activeRoute && activeRoute.polyline.length >= 2
        ? activeRoute.polyline
        : [
            driverPosRef.current,
            tripStage === 'pickup' ? activeTrip.pickupCoords : activeTrip.dropoffCoords,
          ];

    let rafId = 0;
    let lastTime = performance.now();
    let lastClockUpdate = lastTime;

    const stepFrame = (now: number) => {
      const dtSec = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      if (now - lastClockUpdate > 250) {
        lastClockUpdate = now;
        setNavNowMs(Date.now());
      }

      setDriverPos((prev) => {
        let wpIdx = Math.min(routeWpIdxRef.current, poly.length - 1);
        let wp = poly[wpIdx];
        let dx = wp.x - prev.x;
        let dy = wp.y - prev.y;
        let dist = Math.hypot(dx, dy);

        while (dist < 1.8 && wpIdx < poly.length - 1) {
          wpIdx += 1;
          wp = poly[wpIdx];
          dx = wp.x - prev.x;
          dy = wp.y - prev.y;
          dist = Math.hypot(dx, dy);
        }

        if (wpIdx !== routeWpIdxRef.current) {
          routeWpIdxRef.current = wpIdx;
          setRouteWpIdx(wpIdx);

          if (activeRoute && activeRoute.steps.length > 0) {
            let nextStepIdx = 0;
            for (let i = 0; i < activeRoute.steps.length; i++) {
              if (wpIdx >= activeRoute.steps[i].waypointIndex) {
                nextStepIdx = i;
              }
            }
            setCurrentStepIdx(nextStepIdx);
          }
        }

        if (wpIdx === poly.length - 1 && dist < 1.8) {
          return prev;
        }

        const targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
        const smoothHeading = lerpAngle(headingRef.current, targetAngle, Math.min(1, dtSec * 7));
        headingRef.current = smoothHeading;
        setDriverHeading(smoothHeading);

        // Smooth continuous UK road speed
        const totalPolyDist = Math.max(20, legStartDistPx);
        const speedMapUnits = Math.max(4.5, Math.min(18, totalPolyDist * 0.14));
        const moveDist = Math.min(dist, speedMapUnits * dtSec);
        return {
          x: prev.x + (dx / dist) * moveDist,
          y: prev.y + (dy / dist) * moveDist,
        };
      });

      rafId = requestAnimationFrame(stepFrame);
    };

    rafId = requestAnimationFrame(stepFrame);
    return () => cancelAnimationFrame(rafId);
  }, [activeTrip, tripStage, activeRoute, legStartDistPx]);

  // Real-time dynamic ETA, turn-by-turn instruction, next-step preview & UK speed limit
  const liveNav = useMemo(() => {
    if (!activeTrip || (tripStage !== 'pickup' && tripStage !== 'enroute')) {
      return null;
    }

    const isPickup = tripStage === 'pickup';
    const target = isPickup ? activeTrip.pickupCoords : activeTrip.dropoffCoords;
    const totalMiles = isPickup ? activeTrip.pickupMiles : activeTrip.tripMiles;
    const totalMinutes = isPickup ? activeTrip.pickupMinutes : activeTrip.tripMinutes;
    const totalSeconds = Math.max(30, totalMinutes * 60);

    const currentDistPx = Math.hypot(target.x - driverPos.x, target.y - driverPos.y);
    const ratioRemaining =
      legStartDistPx > 0 ? Math.min(1, Math.max(0, currentDistPx / legStartDistPx)) : 0;
    const progressPct = Math.round((1 - ratioRemaining) * 100);

    const remainingSeconds = Math.max(0, Math.round(totalSeconds * ratioRemaining));
    const remainingMiles = Math.max(0, totalMiles * ratioRemaining);

    const isArriving = currentDistPx < 4.5 || remainingSeconds <= 4;

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
      : `${Math.max(50, Math.round((remainingMiles * 5280) / 50) * 50)} ft`;

    const etaClockTime = new Date(navNowMs + remainingSeconds * 1000).toLocaleTimeString(
      'en-GB',
      { hour: '2-digit', minute: '2-digit' }
    );

    const steps = activeRoute?.steps ?? [];
    const currentStep = steps[Math.min(currentStepIdx, Math.max(0, steps.length - 1))];
    const nextStep =
      currentStepIdx + 1 < steps.length ? steps[currentStepIdx + 1] : null;

    const maneuverKind: NavManeuverKind = isArriving
      ? 'arrive'
      : currentStep?.maneuver ?? 'straight';

    const maneuverTitle = isArriving
      ? isPickup
        ? 'Arrived at pickup'
        : 'Arrived at dropoff'
      : currentStep?.instruction ||
        `Continue toward ${isPickup ? activeTrip.pickupAddress : activeTrip.dropoffAddress}`;

    const maneuverSubtitle = isArriving
      ? isPickup
        ? activeTrip.pickupAddress
        : activeTrip.dropoffAddress
      : nextStep
      ? `Then · ${nextStep.instruction}`
      : isPickup
      ? `Pickup · ${activeTrip.pickupAddress}`
      : `Dropoff · ${activeTrip.dropoffAddress}`;

    const speedLimitMph = currentStep?.speedLimitMph ?? 30;

    return {
      isPickup,
      isArriving,
      etaCountdown,
      etaMinLabel,
      distanceRemaining,
      etaClockTime,
      progressPct,
      maneuverKind,
      maneuverTitle,
      maneuverSubtitle,
      speedLimitMph,
    };
  }, [
    activeTrip,
    tripStage,
    driverPos,
    legStartDistPx,
    navNowMs,
    activeRoute,
    currentStepIdx,
  ]);

  // Complete going online (after passing or already having Face Verification)
  const completeGoOnline = useCallback(() => {
    uberSounds.unlock();
    uberSounds.play('online');
    setOnlineStatus('online');
    rotateRadarOffers(radarBatchIdx);
    setRadarRefreshSecLeft(60);
    setActiveTab('home');
    showToast("You're online — Trip Radar & auto-dispatch active");
  }, [radarBatchIdx, rotateRadarOffers, showToast]);

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
      setNextOfferSecLeft(null);
      showToast("You're offline");
    }
  };

  const handleAcceptOffer = (offer: TripOffer) => {
    uberSounds.unlock();
    uberSounds.play('accept');
    setPendingOffer(null);
    setShowRadarList(false);
    setActiveTrip(offer);
    setTripWaitFee(0);
    const initialDist = Math.max(
      20,
      Math.hypot(offer.pickupCoords.x - driverPos.x, offer.pickupCoords.y - driverPos.y)
    );
    setLegStartDistPx(initialDist);
    setNavNowMs(Date.now());
    setTripStage('pickup');
    setActiveTab('home');
    setRecenterSignal((s) => s + 1);
  };

  const handleDeclineOffer = useCallback(
    (_offer: TripOffer) => {
      uberSounds.play('decline');
      setPendingOffer(null);
      showToast('Request declined');
    },
    [showToast]
  );

  const handleDeclineRadarItem = useCallback(
    (offer: TripOffer) => {
      uberSounds.play('decline');
      setRadarOffers((prev) => prev.filter((item) => item.id !== offer.id));
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
      const initialDropoffDist = Math.max(
        20,
        Math.hypot(
          activeTrip.dropoffCoords.x - activeTrip.pickupCoords.x,
          activeTrip.dropoffCoords.y - activeTrip.pickupCoords.y
        )
      );
      setLegStartDistPx(initialDropoffDist);
      setNavNowMs(Date.now());
    }
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

    const tipAmt = activeTrip.riderName === 'Joséfina' ? 2.5 : 0;
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
      dropoffArea: activeTrip.dropoffArea.split(',')[0],
      completedAt: `Today, ${timeLabel}`,
      dateKey: currentKey,
    };

    setLedger((prev) => ({
      dailyTotals: {
        ...prev.dailyTotals,
        [currentKey]: Number(
          ((prev.dailyTotals[currentKey] ?? 0) + netPayout).toFixed(2)
        ),
      },
      walletBalance: Number((prev.walletBalance + netPayout).toFixed(2)),
      proPoints: prev.proPoints + 12,
      questCompletedCount: prev.questCompletedCount + 1,
      completedTrips: [newRecord, ...prev.completedTrips],
    }));

    pushDriverAlert(
      `Trip complete · +£${netPayout.toFixed(2)} net`,
      'Saved to today’s real earnings ledger until midnight',
      `done-${newRecord.id}`,
      () => setActiveTab('earnings')
    );

    setTripStage('completed');
  };

  const handleSubmitRating = (_stars: number) => {
    setActiveTrip(null);
    setActiveRoute(null);
    setTripWaitFee(0);
    setTripStage('idle');
    if (preferences.stopNewRequests) {
      uberSounds.play('offline');
      setOnlineStatus('offline');
      setPreferences((p) => ({ ...p, stopNewRequests: false }));
      showToast('Trip completed · You are now offline');
    } else {
      showToast('Trip completed · Saved to Earnings');
    }
  };

  const handleCancelTrip = () => {
    uberSounds.play('decline');
    setActiveTrip(null);
    setActiveRoute(null);
    setTripWaitFee(0);
    setTripStage('idle');
    showToast('Trip cancelled');
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
  const handleSelectAccount = (accountId: string) => {
    const target = accounts.find((a) => a.id === accountId);
    if (!target) return;
    setActiveAccountId(accountId);
    setActiveAccountIdState(accountId);
    setIsSignedOut(false);
    setOnlineStatus('offline');
    setPendingOffer(null);
    setActiveTrip(null);
    setTripStage('idle');
    setDriverPos(getCityStartCoords(target.city));
    setRecenterSignal((s) => s + 1);
    showToast(`Signed in as ${target.name} (${target.city})`);
  };

  const handleSignInCredentials = (email: string, password: string) => {
    const match = accounts.find(
      (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password
    );
    if (!match) {
      return { ok: false, error: 'Email or password did not match any saved UK driver account.' };
    }
    handleSelectAccount(match.id);
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
    };
    const nextList = [newAcct, ...accounts];
    setAccounts(nextList);
    setActiveAccountId(newAcct.id);
    setActiveAccountIdState(newAcct.id);
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

  const handleSignOut = () => {
    uberSounds.play('offline');
    setOnlineStatus('offline');
    setPendingOffer(null);
    setActiveTrip(null);
    setTripStage('idle');
    setShowRadarList(false);
    setActiveAccountId(null);
    setIsSignedOut(true);
    showToast('Signed out');
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
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude, heading, speed } = pos.coords;
          setGpsPermissionState('active');
          setRealCoords({ lat: latitude, lng: longitude });
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
            showToast(`Live GPS active · Near ${nearestUKCity(projected)}, UK`);
          } else {
            showToast('Live GPS active (outside UK) · Previewing UK map');
          }
        },
        () => {
          setGpsPermissionState('denied');
          showToast('Location permission denied in browser — simulated UK GPS active');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setGpsPermissionState('active');
      showToast('GPS location active');
    }
  };

  const handleAcceptNotificationPermission = async () => {
    setPreferences((prev) => ({ ...prev, notificationsEnabled: true }));
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

  const formatSecMmSs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isLiveGpsInUK =
    realCoords !== null && isWithinUKBounds(realCoords.lat, realCoords.lng);

  // If user signed out, show full-screen Driver UK Sign-In Gate
  if (isSignedOut || !activeAccount) {
    return (
      <AccountModal
        accounts={accounts}
        activeAccount={activeAccount}
        isSignedOutGate
        onSelectAccount={handleSelectAccount}
        onSignInCredentials={handleSignInCredentials}
        onRegisterAccount={handleRegisterAccount}
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
        realCoords={realCoords}
        liveEtaCountdown={liveNav?.etaCountdown}
        liveDistanceRemaining={liveNav?.distanceRemaining}
        liveProgressPct={liveNav?.progressPct}
        todayEarnings={todayEarnings}
        privacyHidden={privacyHidden}
        onToggleOnline={handleToggleOnline}
        onReturnToMap={() => setActiveTab('home')}
        onOpenPermissions={() => setShowPermissionsModal(true)}
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
            surgeZones={INITIAL_SURGE_ZONES}
            mapReports={mapReports}
            destination={destination}
            showSurgeHeatmap={tripStage === 'idle'}
            recenterSignal={recenterSignal}
            isLiveGps={isLiveGpsInUK}
            nightMode={preferences.nightMode}
            onSelectSurgeZone={handleSelectSurgeZone}
          />

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
              <div className="absolute top-[54px] inset-x-4 z-20 flex justify-center pointer-events-none">
                <div className="pointer-events-auto w-full max-w-[490px] rounded-2xl bg-[#111111] text-white shadow-2xl overflow-hidden border border-white/10">
                  <div className="px-4 py-3 flex items-center gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        liveNav.isPickup ? 'bg-[#05944F]' : 'bg-[#276EF1]'
                      }`}
                    >
                      {renderManeuverIcon(liveNav.maneuverKind)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-extrabold leading-tight truncate tabular-nums">
                        {liveNav.maneuverTitle}
                      </p>
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

                  {/* Live Route Completion Progress Strip */}
                  <div className="w-full h-1 bg-white/10">
                    <div
                      className={`h-full ${
                        liveNav.isPickup ? 'bg-[#05944F]' : 'bg-[#276EF1]'
                      }`}
                      style={{ width: `${Math.max(4, liveNav.progressPct)}%` }}
                    />
                  </div>
                </div>
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
                {liveSpeedMph !== null && (
                  <div className="px-2 py-0.5 rounded-full bg-black text-white text-[11px] font-extrabold shadow-md tabular-nums">
                    {liveSpeedMph} mph
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
                handleTogglePreference('soundEffects');
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
                  showToast(`Centered on live GPS · ${nearestUKCity(projected)}`);
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
                offer={pendingOffer || radarOffers[0] || SAMPLE_TRIP_OFFERS[1]}
                onAccept={handleAcceptOffer}
                onDecline={handleDeclineOffer}
                radarOffers={radarOffers}
                showRadarList={showRadarList}
                radarRefreshSecLeft={radarRefreshSecLeft}
                onDeclineRadarItem={handleDeclineRadarItem}
                onCloseRadarList={() => setShowRadarList(false)}
              />
            </div>
          )}

          {/* ACTIVE TRIP SHEET OVERLAY */}
          {activeTrip && tripStage !== 'idle' && (
            <div className="absolute inset-x-0 bottom-0 sm:bottom-4 sm:inset-x-4 z-40 max-w-[460px] mx-auto">
              <ActiveTripSheet
                trip={activeTrip}
                stage={tripStage}
                liveEtaLabel={liveNav?.etaMinLabel}
                liveDistanceLabel={liveNav?.distanceRemaining}
                routeSteps={activeRoute?.steps}
                currentStepIdx={currentStepIdx}
                waitFeeAccrued={tripWaitFee}
                onArrivePickup={handleArrivePickup}
                onStartTrip={handleStartTrip}
                onArriveDropoff={handleArriveDropoff}
                onCompleteTrip={handleCompleteTrip}
                onSubmitRating={handleSubmitRating}
                onCancelTrip={handleCancelTrip}
                onOpenPreferences={() => setShowPreferencesModal(true)}
              />
            </div>
          )}

          {/* BOTTOM STATUS DOCK ON MAP (Centered Trip Radar with 60s refresh + Random 5m timer) */}
          {tripStage === 'idle' && !pendingOffer && !showRadarList && (
            <div className="absolute bottom-0 inset-x-0 z-20 flex justify-center pointer-events-none">
              <div className="pointer-events-auto w-full max-w-[540px] bg-white dark:bg-[#141416] rounded-t-3xl shadow-[0_-6px_24px_rgba(0,0,0,0.08)] border-t border-black/5 dark:border-white/10">
                {onlineStatus === 'online' && (
                  <div className="w-full h-1 bg-[#E8F0FE] dark:bg-white/10 overflow-hidden rounded-t-3xl">
                    <div className="w-1/2 h-full bg-[#276EF1] animate-uber-radar" />
                  </div>
                )}
                <div className="px-4 py-2.5 flex items-center justify-between gap-2">
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
                    onClick={() =>
                      onlineStatus === 'offline'
                        ? setActiveTab('hub')
                        : handleToggleOnline()
                    }
                    className="flex-1 text-center py-1 min-w-0"
                  >
                    <p className="text-[18px] font-extrabold text-black dark:text-white truncate">
                      {onlineStatus === 'offline' ? "You're offline" : 'Finding trips...'}
                    </p>
                    {onlineStatus === 'online' && (
                      <p className="text-[11.5px] font-semibold text-[#276EF1] tabular-nums truncate">
                        {nextOfferSecLeft !== null
                          ? `Next request ~${formatSecMmSs(nextOfferSecLeft)} · Tap to go offline`
                          : 'Tap to go offline'}
                      </p>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onlineStatus === 'online'
                        ? setShowRadarList(true)
                        : setOpportunitiesModalMode('opportunities')
                    }
                    className="w-11 h-11 rounded-full hover:bg-[#F3F3F3] dark:hover:bg-white/10 flex items-center justify-center shrink-0"
                    aria-label="Opportunities or Trip Radar"
                  >
                    <List className="w-5 h-5 text-black dark:text-white" />
                  </button>
                </div>

                {/* Centered Trip Radar Pill */}
                {onlineStatus === 'online' && (
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
          onSelectAccount={handleSelectAccount}
          onSignInCredentials={handleSignInCredentials}
          onRegisterAccount={handleRegisterAccount}
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
          hasRealCoords={realCoords !== null}
          backgroundAppRefresh={preferences.backgroundAppRefresh}
          wakeLockActive={wakeLockActive}
          onAcceptNotifications={handleAcceptNotificationPermission}
          onAcceptLocation={handleAcceptLocationPermission}
          onAcceptBackgroundRefresh={handleAcceptBackgroundRefresh}
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
    </div>
  );
}
