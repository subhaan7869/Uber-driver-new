import { ComputedRoute, Coordinates, NavManeuverKind, RouteStep } from '../types/driver';
import { clampMapCoords, mapToLatLng, projectLatLngToMap } from './ukGeo';

function osrmToManeuver(type?: string, modifier?: string): NavManeuverKind {
  if (type === 'arrive') return 'arrive';
  if (type === 'roundabout' || type === 'rotary' || type === 'exit roundabout') {
    return 'roundabout';
  }
  if (type === 'merge' || type === 'on ramp' || type === 'off ramp') {
    return 'merge';
  }
  if (modifier && modifier.includes('left')) return 'turn-left';
  if (modifier && modifier.includes('right')) return 'turn-right';
  return 'straight';
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
    s.includes('HIGH ST')
  ) {
    return 20;
  }
  return 30;
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
  const bend = Math.min(18, Math.max(4, dist * 0.14));

  const points: Coordinates[] = [];
  const totalPts = 14;
  for (let i = 0; i <= totalPts; i++) {
    const t = i / totalPts;
    const arc = Math.sin(t * Math.PI) * bend;
    points.push(
      clampMapCoords({
        x: Number((from.x + dx * t + perpX * arc).toFixed(1)),
        y: Number((from.y + dy * t + perpY * arc).toFixed(1)),
      })
    );
  }

  const isLong = dist > 22;
  const midRoad = isLong ? 'M4 / A40 Corridor' : 'Regent St (A4201)';
  const steps: RouteStep[] = [
    {
      id: 'step-0',
      maneuver: 'turn-right',
      instruction: `Turn right toward ${midRoad}`,
      streetName: midRoad,
      distanceMeters: Math.max(250, Math.round(dist * 120)),
      speedLimitMph: 20,
      waypointIndex: 0,
    },
    {
      id: 'step-1',
      maneuver: isLong ? 'merge' : 'roundabout',
      instruction: isLong
        ? `Merge onto ${midRoad}`
        : `At roundabout, take 2nd exit onto ${midRoad}`,
      streetName: midRoad,
      distanceMeters: Math.max(400, Math.round(dist * 240)),
      speedLimitMph: isLong ? 50 : 30,
      waypointIndex: 4,
    },
    {
      id: 'step-2',
      maneuver: 'turn-left',
      instruction: `Turn left onto ${destinationLabel}`,
      streetName: destinationLabel,
      distanceMeters: Math.max(180, Math.round(dist * 90)),
      speedLimitMph: 20,
      waypointIndex: 10,
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

    // Downsample smoothly to max 45 waypoints for 60fps animation
    const stride = Math.max(1, Math.floor(rawCoords.length / 42));
    const sampled: Coordinates[] = [];
    for (let i = 0; i < rawCoords.length; i += stride) {
      const [lng, lat] = rawCoords[i];
      sampled.push(clampMapCoords(projectLatLngToMap(lat, lng)));
    }
    const lastRaw = rawCoords[rawCoords.length - 1];
    sampled.push(clampMapCoords(projectLatLngToMap(lastRaw[1], lastRaw[0])));

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
