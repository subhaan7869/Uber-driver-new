import { ComputedRoute, Coordinates, NavManeuverKind, RouteStep } from '../types/driver';
import { clampMapCoords, mapToLatLng, nearestUKCity, projectLatLngToMap } from './ukGeo';

function osrmToManeuver(type?: string, modifier?: string): NavManeuverKind {
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary' || type === 'exit roundabout') {
    return 'roundabout';
  }
  if (type === 'merge' || type === 'on ramp' || type === 'off ramp' || type === 'fork') {
    return 'merge';
  }
  if (modifier && modifier.includes('left')) return 'turn-left';
  if (modifier && modifier.includes('right')) return 'turn-right';
  return 'straight';
}

function buildLanesForManeuver(
  maneuver: NavManeuverKind
): RouteStep['lanes'] | undefined {
  switch (maneuver) {
    case 'turn-left':
      return [
        { direction: 'left', recommended: true },
        { direction: 'straight', recommended: false },
        { direction: 'right', recommended: false },
      ];
    case 'turn-right':
      return [
        { direction: 'left', recommended: false },
        { direction: 'straight', recommended: false },
        { direction: 'right', recommended: true },
      ];
    case 'roundabout':
      return [
        { direction: 'left', recommended: true },
        { direction: 'straight', recommended: true },
        { direction: 'right', recommended: false },
      ];
    case 'merge':
      return [
        { direction: 'straight', recommended: true },
        { direction: 'straight', recommended: true },
        { direction: 'right', recommended: false },
      ];
    case 'straight':
      return [
        { direction: 'left', recommended: false },
        { direction: 'straight', recommended: true },
        { direction: 'straight', recommended: true },
      ];
    default:
      return undefined;
  }
}

function formatManeuverText(
  maneuver: NavManeuverKind,
  street: string,
  modifier?: string,
  exitNum?: number
): string {
  const cleanStreet = street.trim() || 'unnamed road';
  if (maneuver === 'arrive') return `Arrive at ${cleanStreet}`;
  if (maneuver === 'roundabout') {
    return exitNum
      ? `At roundabout, take exit ${exitNum} onto ${cleanStreet}`
      : `Enter roundabout onto ${cleanStreet}`;
  }
  if (maneuver === 'merge') return `Merge onto ${cleanStreet}`;
  if (maneuver === 'turn-left') {
    return modifier === 'slight left'
      ? `Keep left onto ${cleanStreet}`
      : `Turn left onto ${cleanStreet}`;
  }
  if (maneuver === 'turn-right') {
    return modifier === 'slight right'
      ? `Keep right onto ${cleanStreet}`
      : `Turn right onto ${cleanStreet}`;
  }
  return `Continue on ${cleanStreet}`;
}

function inferUKSpeedLimit(street: string): 20 | 30 | 50 | 70 {
  const s = street.toUpperCase();
  if (/\bM\d+\b/.test(s) || s.includes('MOTORWAY')) return 70;
  if (/\bA\d{1,2}\b/.test(s) || s.includes('BYPASS') || s.includes('WAY')) return 50;
  if (
    s.includes('OXFORD') ||
    s.includes('REGENT') ||
    s.includes('SOHO') ||
    s.includes('VICTORIA') ||
    s.includes('PICCADILLY') ||
    s.includes('HIGH ST') ||
    s.includes('MARYLEBONE')
  ) {
    return 20;
  }
  return 30;
}

/**
 * Chaikin corner-smoothing + uniform arc-length resampling
 * produces silky curves and evenly spaced 60fps navigation waypoints.
 */
function smoothAndResamplePolyline(
  rawPoints: Coordinates[],
  targetCount = 72
): Coordinates[] {
  if (rawPoints.length < 2) return rawPoints;

  // Step 1: 2 passes of Chaikin corner cutting while keeping endpoints pinned
  let pts = rawPoints.map((p) => ({ ...p }));
  for (let pass = 0; pass < 2; pass++) {
    if (pts.length < 3) break;
    const next: Coordinates[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      if (i > 0) {
        next.push({
          x: a.x * 0.75 + b.x * 0.25,
          y: a.y * 0.75 + b.y * 0.25,
        });
      }
      if (i < pts.length - 2) {
        next.push({
          x: a.x * 0.25 + b.x * 0.75,
          y: a.y * 0.25 + b.y * 0.75,
        });
      }
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }

  // Step 2: Uniform arc-length resampling
  const cumDist: number[] = [0];
  let totalLen = 0;
  for (let i = 1; i < pts.length; i++) {
    totalLen += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    cumDist.push(totalLen);
  }
  if (totalLen < 0.001) return pts;

  const resampled: Coordinates[] = [];
  for (let k = 0; k < targetCount; k++) {
    const targetD = (k / (targetCount - 1)) * totalLen;
    let segIdx = 0;
    while (segIdx < cumDist.length - 2 && cumDist[segIdx + 1] < targetD) {
      segIdx++;
    }
    const segStart = cumDist[segIdx];
    const segEnd = cumDist[segIdx + 1];
    const segSpan = Math.max(0.0001, segEnd - segStart);
    const t = Math.max(0, Math.min(1, (targetD - segStart) / segSpan));
    const a = pts[segIdx];
    const b = pts[segIdx + 1];
    resampled.push(
      clampMapCoords({
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
      })
    );
  }

  return resampled;
}

function getRegionalCorridorRoad(
  from: Coordinates,
  destinationLabel: string,
  isLong: boolean
): { entryRoad: string; trunkRoad: string; speedLimit: 30 | 50 | 70 } {
  const destUpper = destinationLabel.toUpperCase();
  const originCity = nearestUKCity(from).toUpperCase();

  if (destUpper.includes('OXFORD')) {
    return { entryRoad: 'A40 Westway', trunkRoad: 'M40 Westbound', speedLimit: 70 };
  }
  if (destUpper.includes('BRIGHTON')) {
    return { entryRoad: 'A23 Brixton Hill', trunkRoad: 'M23 Southbound', speedLimit: 70 };
  }
  if (destUpper.includes('BIRMINGHAM') && isLong) {
    return { entryRoad: 'A41 Hendon Way', trunkRoad: 'M1 / M40 Northbound', speedLimit: 70 };
  }
  if (destUpper.includes('LEEDS')) {
    return { entryRoad: 'A57 Mancunian Way', trunkRoad: 'M62 Eastbound', speedLimit: 70 };
  }
  if (destUpper.includes('HEATHROW')) {
    return { entryRoad: 'A4 Cromwell Rd', trunkRoad: 'M4 Westbound', speedLimit: 70 };
  }
  if (destUpper.includes('GATWICK')) {
    return { entryRoad: 'A23 Purley Way', trunkRoad: 'M23 Airport Link', speedLimit: 70 };
  }
  if (originCity.includes('MANCHESTER')) {
    return {
      entryRoad: 'Deansgate (A56)',
      trunkRoad: isLong ? 'M56 Motorway' : 'Princess Pkwy (A5103)',
      speedLimit: isLong ? 70 : 50,
    };
  }
  if (originCity.includes('EDINBURGH')) {
    return {
      entryRoad: 'Princes St',
      trunkRoad: isLong ? 'A8 Glasgow Rd' : 'Lothian Rd',
      speedLimit: isLong ? 50 : 30,
    };
  }
  if (originCity.includes('BIRMINGHAM')) {
    return {
      entryRoad: 'Suffolk St Queensway',
      trunkRoad: isLong ? 'M42 South' : 'Bristol Rd (A38)',
      speedLimit: isLong ? 70 : 30,
    };
  }
  return {
    entryRoad: 'Regent St (A4201)',
    trunkRoad: isLong ? 'M4 / A40 Corridor' : 'Park Lane (A4202)',
    speedLimit: isLong ? 70 : 30,
  };
}

export function buildFallbackUKRoute(
  from: Coordinates,
  to: Coordinates,
  destinationLabel: string
): ComputedRoute {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const perpX = dist > 0 ? -dy / dist : 0;
  const perpY = dist > 0 ? dx / dist : 0;
  const bend = Math.min(18, Math.max(3.5, dist * 0.16));

  // Build an S-curve + roundabout bend profile so driving turns feel realistic
  const controlPts: Coordinates[] = [];
  const rawSteps = 12;
  for (let i = 0; i <= rawSteps; i++) {
    const t = i / rawSteps;
    const sCurve = Math.sin(t * Math.PI) * bend + Math.sin(t * Math.PI * 2) * (bend * 0.28);
    controlPts.push(
      clampMapCoords({
        x: from.x + dx * t + perpX * sCurve,
        y: from.y + dy * t + perpY * sCurve,
      })
    );
  }

  const points = smoothAndResamplePolyline(controlPts, 72);
  const isLong = dist > 18;
  const { entryRoad, trunkRoad, speedLimit } = getRegionalCorridorRoad(
    from,
    destinationLabel,
    isLong
  );

  const steps: RouteStep[] = [
    {
      id: 'step-0',
      maneuver: 'turn-right',
      instruction: `Turn right onto ${entryRoad}`,
      streetName: entryRoad,
      distanceMeters: Math.max(220, Math.round(dist * 90)),
      speedLimitMph: 20,
      waypointIndex: 0,
      lanes: buildLanesForManeuver('turn-right'),
    },
    {
      id: 'step-1',
      maneuver: isLong ? 'merge' : 'roundabout',
      instruction: isLong
        ? `Merge onto ${trunkRoad}`
        : `At roundabout, take 2nd exit onto ${trunkRoad}`,
      streetName: trunkRoad,
      distanceMeters: Math.max(450, Math.round(dist * 240)),
      speedLimitMph: speedLimit,
      waypointIndex: 18,
      lanes: buildLanesForManeuver(isLong ? 'merge' : 'roundabout'),
    },
    {
      id: 'step-2',
      maneuver: 'turn-left',
      instruction: `Turn left toward ${destinationLabel}`,
      streetName: destinationLabel,
      distanceMeters: Math.max(200, Math.round(dist * 100)),
      speedLimitMph: 30,
      waypointIndex: 48,
      lanes: buildLanesForManeuver('turn-left'),
    },
    {
      id: 'step-3',
      maneuver: 'arrive',
      instruction: `Arrive at ${destinationLabel}`,
      streetName: destinationLabel,
      distanceMeters: 0,
      speedLimitMph: 20,
      waypointIndex: points.length - 1,
    },
  ];

  return {
    polyline: points,
    steps,
    totalDistanceMeters: Math.max(800, Math.round(dist * 450)),
    totalDurationSec: Math.max(90, Math.round(dist * 28)),
    source: 'uk-corridor',
  };
}

export async function fetchUKRoute(
  from: Coordinates,
  to: Coordinates,
  destinationLabel: string
): Promise<ComputedRoute> {
  const start = mapToLatLng(from);
  const end = mapToLatLng(to);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2600);

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('OSRM failed');
    const data = await res.json();
    const route = data?.routes?.[0];
    const rawCoords: Array<[number, number]> | undefined = route?.geometry?.coordinates;
    if (!rawCoords || rawCoords.length < 2) throw new Error('No geometry');

    const projectedRaw = rawCoords.map(([lng, lat]) =>
      clampMapCoords(projectLatLngToMap(lat, lng))
    );
    const sampled = smoothAndResamplePolyline(projectedRaw, 76);

    const legSteps = route.legs?.[0]?.steps ?? [];
    const steps: RouteStep[] = legSteps.map((st: any, idx: number) => {
      const maneuverKind = osrmToManeuver(st.maneuver?.type, st.maneuver?.modifier);
      const streetName =
        (st.name && String(st.name).trim()) ||
        (idx === legSteps.length - 1 ? destinationLabel : 'UK Trunk Road');
      const ratio = legSteps.length > 1 ? idx / (legSteps.length - 1) : 0;
      const wpIdx = Math.min(sampled.length - 1, Math.round(ratio * (sampled.length - 1)));
      return {
        id: `osrm-step-${idx}`,
        maneuver: maneuverKind,
        instruction: formatManeuverText(
          maneuverKind,
          streetName,
          st.maneuver?.modifier,
          st.maneuver?.exit
        ),
        streetName,
        distanceMeters: Math.round(st.distance ?? 150),
        speedLimitMph: inferUKSpeedLimit(streetName),
        waypointIndex: wpIdx,
        lanes: buildLanesForManeuver(maneuverKind),
      };
    });

    if (steps.length === 0) {
      return buildFallbackUKRoute(from, to, destinationLabel);
    }

    return {
      polyline: sampled,
      steps,
      totalDistanceMeters: Math.round(route.distance ?? 1500),
      totalDurationSec: Math.round(route.duration ?? 240),
      source: 'osrm',
    };
  } catch {
    clearTimeout(timeout);
    return buildFallbackUKRoute(from, to, destinationLabel);
  }
}

export function speakNavInstruction(text: string, enabled: boolean): void {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'en-GB';
    utter.rate = 1.02;
    utter.pitch = 1.0;
    utter.volume = 0.9;
    window.speechSynthesis.speak(utter);
  } catch {
    // Ignore speech synthesis failures
  }
}
