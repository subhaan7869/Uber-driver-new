import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Layers, Route as RouteIcon } from 'lucide-react';

maplibregl.setWorkerUrl(maplibreWorkerUrl);
import {
  BusySoonZone,
  Coordinates,
  DestinationConfig,
  DriverOnlineStatus,
  MapReportPin,
  SurgeZone,
  TripOffer,
  TripStage,
  UKWeatherCondition,
} from '../types/driver';
import {
  mapToLatLng,
  nearestUKCity,
  UK_AIRPORT_MAP_PINS,
  UK_SPEED_CAMERAS,
  UK_TRAFFIC_SEGMENTS_LATLNG,
} from '../utils/ukGeo';

interface UberMapProps {
  driverPos: Coordinates;
  driverHeading: number;
  onlineStatus: DriverOnlineStatus;
  tripStage: TripStage;
  activeTrip: TripOffer | null;
  pendingOffer: TripOffer | null;
  routePolyline?: Coordinates[];
  fullRoutePolyline?: Coordinates[];
  offerTripPolyline?: Coordinates[];
  surgeZones: SurgeZone[];
  busySoonZones?: BusySoonZone[];
  mapReports: MapReportPin[];
  destination: DestinationConfig;
  showSurgeHeatmap: boolean;
  recenterSignal: number;
  isLiveGps?: boolean;
  blueGpsActive?: boolean;
  nightMode?: boolean;
  showTrafficLayer?: boolean;
  showUKZones?: boolean;
  showSpeedCameras?: boolean;
  showBusySoonZones?: boolean;
  weatherCondition?: UKWeatherCondition;
  compact?: boolean;
  hideMapControls?: boolean;
  onSelectSurgeZone?: (zone: SurgeZone) => void;
  onSelectBusySoonZone?: (zone: BusySoonZone) => void;
  onToggleMapLayers?: () => void;
}

// Keyless OpenFreeMap Carto-style vector tiles (full global coverage, zero API key required)
const OPENFREEMAP_DAY_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const OPENFREEMAP_NIGHT_STYLE = 'https://tiles.openfreemap.org/styles/dark';

const INITIAL_DARK_STUB: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#151C26' },
    },
  ],
};

let cachedLibertyStylePromise: Promise<maplibregl.StyleSpecification> | null = null;

function fetchLibertyStyle(): Promise<maplibregl.StyleSpecification> {
  if (!cachedLibertyStylePromise) {
    cachedLibertyStylePromise = fetch(OPENFREEMAP_DAY_STYLE).then((res) => {
      if (!res.ok) throw new Error(`Style fetch failed: ${res.status}`);
      return res.json() as Promise<maplibregl.StyleSpecification>;
    });
  }
  return cachedLibertyStylePromise;
}

async function getUberNightStyle(): Promise<maplibregl.StyleSpecification | string> {
  try {
    const base = await fetchLibertyStyle();
    const cloned = JSON.parse(JSON.stringify(base)) as maplibregl.StyleSpecification;
    cloned.layers = cloned.layers.map((layer) => {
      const id = layer.id.toLowerCase();
      const paint = { ...((layer.paint as Record<string, unknown>) || {}) };

      if (layer.type === 'background') {
        paint['background-color'] = '#151C26';
      } else if (layer.type === 'raster') {
        paint['raster-brightness-max'] = 0.25;
        paint['raster-saturation'] = -0.65;
      } else if (layer.type === 'fill') {
        if (id.includes('water')) {
          paint['fill-color'] = '#0C1522';
        } else if (id.includes('park') || id.includes('wood') || id.includes('grass') || id.includes('cemetery')) {
          paint['fill-color'] = '#162624';
          if ('fill-outline-color' in paint) paint['fill-outline-color'] = '#1E3330';
        } else if (id.includes('building')) {
          paint['fill-color'] = '#1F2A3A';
          if ('fill-outline-color' in paint) paint['fill-outline-color'] = '#2A394E';
        } else if (id.includes('landuse') || id.includes('landcover') || id.includes('aeroway') || id.includes('road_area')) {
          paint['fill-color'] = '#192230';
        }
      } else if (layer.type === 'fill-extrusion') {
        paint['fill-extrusion-color'] = '#212D3E';
        paint['fill-extrusion-opacity'] = 0.85;
      } else if (layer.type === 'line') {
        if (id.includes('water')) {
          paint['line-color'] = '#0D1827';
        } else if (id.includes('casing')) {
          paint['line-color'] = '#0F1520';
        } else if (id.includes('motorway')) {
          paint['line-color'] = '#4E6586';
        } else if (id.includes('trunk') || id.includes('primary') || id.includes('secondary') || id.includes('tertiary') || id.includes('link')) {
          paint['line-color'] = '#3C4E67';
        } else if (id.includes('rail')) {
          paint['line-color'] = '#2B3544';
        } else if (id.includes('boundary')) {
          paint['line-color'] = '#475569';
        } else if (id.includes('road') || id.includes('bridge') || id.includes('tunnel')) {
          paint['line-color'] = '#2B3749';
        }
      } else if (layer.type === 'symbol') {
        if ('text-color' in paint || id.includes('label') || id.includes('name') || id.includes('poi') || id.includes('place')) {
          paint['text-color'] = '#CBD5E1';
          paint['text-halo-color'] = '#0B111A';
          paint['text-halo-width'] = 1.5;
        }
      }

      return { ...layer, paint } as typeof layer;
    });
    return cloned;
  } catch {
    return OPENFREEMAP_NIGHT_STYLE;
  }
}

type GeoJSONData = Parameters<maplibregl.GeoJSONSource['setData']>[0];
type GeoJSONFeatureItem = {
  type: 'Feature';
  properties: Record<string, string | number | boolean>;
  geometry:
    | { type: 'Polygon'; coordinates: Array<Array<[number, number]>> }
    | { type: 'LineString'; coordinates: Array<[number, number]> };
};

const EMPTY_FC: GeoJSONData = {
  type: 'FeatureCollection',
  features: [],
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function createGeoCircleRing(
  lat: number,
  lng: number,
  radiusMeters: number,
  steps = 48
): Array<[number, number]> {
  const coords: Array<[number, number]> = [];
  const earthRadius = 6378137;
  const latRad = (lat * Math.PI) / 180;
  const dLat = (radiusMeters / earthRadius) * (180 / Math.PI);
  const dLng = dLat / Math.max(0.15, Math.cos(latRad));

  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * Math.PI * 2;
    coords.push([lng + Math.cos(theta) * dLng, lat + Math.sin(theta) * dLat]);
  }
  return coords;
}

function buildSurgePolygonRing(
  center: Coordinates,
  radiusPx: number,
  seed: number
): Array<[number, number]> {
  const sides = 12;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + seed * 0.35;
    const wobble = 0.84 + 0.18 * Math.sin(i * 2.1 + seed * 1.7);
    const r = radiusPx * wobble;
    const x = center.x + Math.cos(angle) * r;
    const y = center.y + Math.sin(angle) * r;
    const ll = mapToLatLng({ x, y });
    pts.push([ll.lng, ll.lat]);
  }
  if (pts.length > 0) {
    pts.push(pts[0]);
  }
  return pts;
}

function getReportBadgeHtml(category: MapReportPin['category']): string {
  const styles: Record<
    MapReportPin['category'],
    { bg: string; text: string; symbol: string; round?: boolean }
  > = {
    traffic: { bg: '#FFC043', text: '#000000', symbol: '🚗' },
    crash: { bg: '#FF6937', text: '#000000', symbol: '⚠' },
    roadwork: { bg: '#FF8038', text: '#000000', symbol: '🚧' },
    road_closed: { bg: '#E11900', text: '#FFFFFF', symbol: '⛔', round: true },
    police: { bg: '#276EF1', text: '#FFFFFF', symbol: '🛡' },
    lane_closure: { bg: '#E2E2E2', text: '#000000', symbol: '⑂', round: true },
  };
  const cfg = styles[category];
  if (cfg.round) {
    return `<div style="width:28px;height:28px;border-radius:9999px;background:${cfg.bg};color:${cfg.text};border:2px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;">${cfg.symbol}</div>`;
  }
  return `<div style="width:28px;height:28px;transform:rotate(45deg);border-radius:6px;background:${cfg.bg};color:${cfg.text};border:2px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(-45deg);font-size:12px;font-weight:800;">${cfg.symbol}</span></div>`;
}

function ensureVectorLayers(map: maplibregl.Map) {
  const ensureSource = (id: string) => {
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'geojson', data: EMPTY_FC });
    }
  };

  ensureSource('uk-zones-source');
  ensureSource('traffic-source');
  ensureSource('surge-zones-source');
  ensureSource('busy-soon-source');
  ensureSource('full-route-source');
  ensureSource('dest-route-source');
  ensureSource('active-route-source');

  if (!map.getLayer('uk-zones-fill')) {
    map.addLayer({
      id: 'uk-zones-fill',
      type: 'fill',
      source: 'uk-zones-source',
      paint: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': ['get', 'fillOpacity'],
      },
    });
  }

  if (!map.getLayer('uk-zones-line-solid')) {
    map.addLayer({
      id: 'uk-zones-line-solid',
      type: 'line',
      source: 'uk-zones-source',
      filter: ['==', ['get', 'dashed'], false],
      paint: {
        'line-color': ['get', 'strokeColor'],
        'line-width': ['get', 'lineWidth'],
      },
    });
  }

  if (!map.getLayer('uk-zones-line-dashed')) {
    map.addLayer({
      id: 'uk-zones-line-dashed',
      type: 'line',
      source: 'uk-zones-source',
      filter: ['==', ['get', 'dashed'], true],
      paint: {
        'line-color': ['get', 'strokeColor'],
        'line-width': ['get', 'lineWidth'],
        'line-dasharray': [4, 3],
      },
    });
  }

  if (!map.getLayer('traffic-line')) {
    map.addLayer({
      id: 'traffic-line',
      type: 'line',
      source: 'traffic-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 5,
        'line-opacity': 0.84,
      },
    });
  }

  if (!map.getLayer('surge-zones-fill')) {
    map.addLayer({
      id: 'surge-zones-fill',
      type: 'fill',
      source: 'surge-zones-source',
      paint: {
        'fill-color': ['get', 'fillColor'],
        'fill-opacity': ['get', 'fillOpacity'],
      },
    });
  }

  if (!map.getLayer('surge-zones-outline')) {
    map.addLayer({
      id: 'surge-zones-outline',
      type: 'line',
      source: 'surge-zones-source',
      filter: ['==', ['get', 'hasStroke'], true],
      paint: {
        'line-color': ['get', 'fillColor'],
        'line-width': 1.5,
        'line-opacity': ['get', 'strokeOpacity'],
      },
    });
  }

  if (!map.getLayer('busy-soon-fill')) {
    map.addLayer({
      id: 'busy-soon-fill',
      type: 'fill',
      source: 'busy-soon-source',
      paint: {
        'fill-color': '#F59E0B',
        'fill-opacity': ['get', 'fillOpacity'],
      },
    });
  }

  if (!map.getLayer('busy-soon-line')) {
    map.addLayer({
      id: 'busy-soon-line',
      type: 'line',
      source: 'busy-soon-source',
      paint: {
        'line-color': '#F59E0B',
        'line-width': 1.6,
        'line-dasharray': [3, 3],
      },
    });
  }

  if (!map.getLayer('full-route-line')) {
    map.addLayer({
      id: 'full-route-line',
      type: 'line',
      source: 'full-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 6,
        'line-opacity': 0.2,
      },
    });
  }

  if (!map.getLayer('dest-route-line')) {
    map.addLayer({
      id: 'dest-route-line',
      type: 'line',
      source: 'dest-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': '#276EF1',
        'line-width': 3.5,
        'line-dasharray': [3, 3],
        'line-opacity': 0.9,
      },
    });
  }

  if (!map.getLayer('active-route-casing')) {
    map.addLayer({
      id: 'active-route-casing',
      type: 'line',
      source: 'active-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'casingColor'],
        'line-width': 11,
        'line-opacity': 1,
      },
    });
  }

  if (!map.getLayer('active-route-core')) {
    map.addLayer({
      id: 'active-route-core',
      type: 'line',
      source: 'active-route-source',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': ['get', 'mainColor'],
        'line-width': 6,
        'line-opacity': 0.96,
      },
    });
  }
}

export const UberMap: React.FC<UberMapProps> = ({
  driverPos,
  driverHeading,
  onlineStatus,
  tripStage,
  activeTrip,
  pendingOffer,
  routePolyline,
  fullRoutePolyline,
  offerTripPolyline,
  surgeZones,
  busySoonZones = [],
  mapReports,
  destination,
  showSurgeHeatmap,
  recenterSignal,
  isLiveGps = false,
  blueGpsActive = false,
  nightMode = false,
  showTrafficLayer = true,
  showUKZones = true,
  showSpeedCameras = true,
  showBusySoonZones = true,
  weatherCondition = 'Clear',
  compact = false,
  hideMapControls = false,
  onSelectSurgeZone,
  onSelectBusySoonZone,
  onToggleMapLayers,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const zoneMarkersRef = useRef<maplibregl.Marker[]>([]);
  const routeMarkersRef = useRef<maplibregl.Marker[]>([]);
  const pinMarkersRef = useRef<maplibregl.Marker[]>([]);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [styleEpoch, setStyleEpoch] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(compact ? 11 : 13);
  const [hasManualPan, setHasManualPan] = useState<boolean>(false);
  const [navCamera3D, setNavCamera3D] = useState<boolean>(true);
  const [routeOverviewMode, setRouteOverviewMode] = useState<boolean>(false);

  const isNavigatingActive = tripStage === 'pickup' || tripStage === 'enroute';
  const isNav3DActive = !compact && isNavigatingActive && navCamera3D && !routeOverviewMode;
  const isIntercityActive = Boolean((activeTrip || pendingOffer)?.isIntercity);
  const defaultZoom = tripStage !== 'idle' ? (isIntercityActive ? 11.5 : 15.75) : 13;

  const nearCityLabel = useMemo(() => nearestUKCity(driverPos), [driverPos]);

  const onSelectSurgeRef = useRef(onSelectSurgeZone);
  onSelectSurgeRef.current = onSelectSurgeZone;
  const onSelectBusySoonRef = useRef(onSelectBusySoonZone);
  onSelectBusySoonRef.current = onSelectBusySoonZone;

  const manualPanRef = useRef(hasManualPan);
  manualPanRef.current = hasManualPan;

  const currentNightModeRef = useRef(nightMode);
  const driverHeadingRef = useRef(driverHeading);
  driverHeadingRef.current = driverHeading;

  const prevTripStageRef = useRef(tripStage);
  const prevRecenterRef = useRef(recenterSignal);
  const prevNav3DRef = useRef(isNav3DActive);
  const prevPendingOfferIdRef = useRef<string | null>(pendingOffer?.id ?? null);
  const isEasingUntilRef = useRef<number>(0);

  const styleReqIdRef = useRef(0);

  // Initialize MapLibre GL JS World Map with keyless OpenFreeMap Carto-style vector basemap
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialLatLng = mapToLatLng(driverPos);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: nightMode ? INITIAL_DARK_STUB : OPENFREEMAP_DAY_STYLE,
      center: [initialLatLng.lng, initialLatLng.lat],
      zoom: compact ? 11 : 13,
      minZoom: 1.5,
      maxZoom: 19,
      attributionControl: compact ? false : { compact: true },
      interactive: !compact,
      dragRotate: !compact,
      pitchWithRotate: !compact,
    });

    mapRef.current = map;
    currentNightModeRef.current = nightMode;

    if (nightMode) {
      const reqId = ++styleReqIdRef.current;
      getUberNightStyle().then((nightSpec) => {
        if (mapRef.current === map && styleReqIdRef.current === reqId) {
          map.setStyle(nightSpec);
        }
      });
    }

    map.on('error', (evt) => {
      if (evt?.error) {
        console.warn('[UberMap] MapLibre error:', evt.error);
      }
    });

    map.on('style.load', () => {
      ensureVectorLayers(map);
      setStyleEpoch((v) => v + 1);
    });

    map.on('dragstart', () => {
      setHasManualPan(true);
    });

    map.on('zoomend', () => {
      setZoomLevel(Number(map.getZoom().toFixed(2)));
    });

    map.on('rotate', () => {
      const el = driverMarkerRef.current?.getElement();
      const rotator = el?.querySelector('[data-driver-rotator]') as HTMLElement | null;
      if (rotator) {
        rotator.style.transform = `rotate(${driverHeadingRef.current - map.getBearing()}deg)`;
      }
    });

    const ro = new ResizeObserver(() => {
      map.resize();
    });
    ro.observe(containerRef.current);

    return () => {
      styleReqIdRef.current += 1;
      ro.disconnect();
      zoneMarkersRef.current.forEach((m) => m.remove());
      routeMarkersRef.current.forEach((m) => m.remove());
      pinMarkersRef.current.forEach((m) => m.remove());
      driverMarkerRef.current?.remove();
      zoneMarkersRef.current = [];
      routeMarkersRef.current = [];
      pinMarkersRef.current = [];
      driverMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seamlessly switch OpenFreeMap Liberty (day) <-> High-contrast Uber Dark (night)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (currentNightModeRef.current === nightMode) return;
    currentNightModeRef.current = nightMode;
    const reqId = ++styleReqIdRef.current;
    if (nightMode) {
      getUberNightStyle().then((nightSpec) => {
        if (mapRef.current === map && styleReqIdRef.current === reqId) {
          map.setStyle(nightSpec);
        }
      });
    } else {
      map.setStyle(OPENFREEMAP_DAY_STYLE);
    }
  }, [nightMode]);

  // Handle recenter signal, tripStage transitions, pending offer bounds & 2D/3D camera toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const pendingOfferId = pendingOffer?.id ?? null;
    const stageChanged = prevTripStageRef.current !== tripStage;
    const recenterChanged = prevRecenterRef.current !== recenterSignal;
    const nav3DChanged = prevNav3DRef.current !== isNav3DActive;
    const offerChanged = prevPendingOfferIdRef.current !== pendingOfferId;
    const wasOfferOpen = prevPendingOfferIdRef.current !== null;

    prevTripStageRef.current = tripStage;
    prevRecenterRef.current = recenterSignal;
    prevNav3DRef.current = isNav3DActive;
    prevPendingOfferIdRef.current = pendingOfferId;

    if (pendingOffer && !activeTrip && tripStage === 'idle' && (offerChanged || recenterChanged || stageChanged)) {
      setHasManualPan(false);
      setRouteOverviewMode(false);
      const pts: [number, number][] = [
        driverPos,
        pendingOffer.pickupCoords,
        ...(pendingOffer.stopCoords ? [pendingOffer.stopCoords] : []),
        pendingOffer.dropoffCoords,
        ...(routePolyline || []),
        ...(offerTripPolyline || []),
      ].map((p) => {
        const ll = mapToLatLng(p);
        return [ll.lng, ll.lat] as [number, number];
      });
      const bounds = new maplibregl.LngLatBounds(pts[0], pts[0]);
      pts.forEach((pt) => bounds.extend(pt));
      const ch = containerRef.current?.clientHeight || 740;
      const topPad = Math.min(115, Math.round(ch * 0.16));
      const bottomPad = Math.min(410, Math.round(ch * 0.52));
      isEasingUntilRef.current = performance.now() + 550;
      map.fitBounds(bounds, {
        padding: { top: topPad, bottom: bottomPad, left: 48, right: 48 },
        maxZoom: 14.2,
        pitch: 0,
        bearing: 0,
        duration: 500,
      });
    } else if (recenterChanged || stageChanged || (offerChanged && wasOfferOpen && !pendingOffer)) {
      setHasManualPan(false);
      setRouteOverviewMode(false);
      const ll = mapToLatLng(driverPos);
      const targetZoom = tripStage !== 'idle' ? (isIntercityActive ? 11.5 : 15.75) : 13;
      isEasingUntilRef.current = performance.now() + 480;
      map.easeTo({
        center: [ll.lng, ll.lat],
        zoom: targetZoom,
        pitch: isNav3DActive ? 52 : 0,
        bearing: isNav3DActive ? driverHeading : 0,
        padding: isNav3DActive
          ? { top: 210, bottom: 110, left: 0, right: 0 }
          : { top: 0, bottom: 0, left: 0, right: 0 },
        duration: 450,
      });
    } else if (nav3DChanged && !manualPanRef.current && !routeOverviewMode) {
      const ll = mapToLatLng(driverPos);
      isEasingUntilRef.current = performance.now() + 410;
      map.easeTo({
        center: [ll.lng, ll.lat],
        pitch: isNav3DActive ? 52 : 0,
        bearing: isNav3DActive ? driverHeading : 0,
        padding: isNav3DActive
          ? { top: 210, bottom: 110, left: 0, right: 0 }
          : { top: 0, bottom: 0, left: 0, right: 0 },
        duration: 380,
      });
    }
  }, [
    recenterSignal,
    tripStage,
    activeTrip,
    pendingOffer,
    routePolyline,
    offerTripPolyline,
    driverPos,
    driverHeading,
    isIntercityActive,
    isNav3DActive,
    routeOverviewMode,
  ]);

  // Smooth camera tracking along real streets during active navigation
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (manualPanRef.current) return;

    if (routeOverviewMode && (fullRoutePolyline?.length || routePolyline?.length)) {
      const pts = (fullRoutePolyline && fullRoutePolyline.length >= 2
        ? fullRoutePolyline
        : routePolyline || []
      ).map((p) => {
        const ll = mapToLatLng(p);
        return [ll.lng, ll.lat] as [number, number];
      });
      if (pts.length >= 2) {
        const bounds = new maplibregl.LngLatBounds(pts[0], pts[0]);
        pts.forEach((pt) => bounds.extend(pt));
        isEasingUntilRef.current = performance.now() + 480;
        map.fitBounds(bounds, {
          padding: 72,
          maxZoom: 15,
          pitch: 0,
          bearing: 0,
          duration: 450,
        });
      }
      return;
    }

    if (performance.now() < isEasingUntilRef.current) return;

    if (isNavigatingActive) {
      const ll = mapToLatLng(driverPos);
      map.jumpTo({
        center: [ll.lng, ll.lat],
        bearing: isNav3DActive ? driverHeading : 0,
        pitch: isNav3DActive ? 52 : 0,
        padding: isNav3DActive
          ? { top: 210, bottom: 110, left: 0, right: 0 }
          : { top: 0, bottom: 0, left: 0, right: 0 },
      });
    } else if (compact) {
      const ll = mapToLatLng(driverPos);
      map.jumpTo({ center: [ll.lng, ll.lat], pitch: 0, bearing: 0 });
    }
  }, [
    driverPos,
    driverHeading,
    isNavigatingActive,
    isNav3DActive,
    routeOverviewMode,
    fullRoutePolyline,
    routePolyline,
    compact,
  ]);

  // Update London Zones, Traffic Corridors, Surge Heat Polygons & Busy Soon Rings
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleEpoch === 0) return;
    ensureVectorLayers(map);

    zoneMarkersRef.current.forEach((m) => m.remove());
    zoneMarkersRef.current = [];

    // 1. UK Zones (ULEZ & Congestion Charge)
    const zonesSource = map.getSource('uk-zones-source') as maplibregl.GeoJSONSource | undefined;
    if (zonesSource) {
      if (showUKZones) {
        const ulezRing = createGeoCircleRing(51.5074, -0.1278, 16500);
        const ccRing = createGeoCircleRing(51.509, -0.128, 2600);
        zonesSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                fillColor: '#05944F',
                fillOpacity: nightMode ? 0.08 : 0.06,
                strokeColor: '#05944F',
                lineWidth: 1.5,
                dashed: true,
              },
              geometry: { type: 'Polygon', coordinates: [ulezRing] },
            },
            {
              type: 'Feature',
              properties: {
                fillColor: '#E11900',
                fillOpacity: nightMode ? 0.13 : 0.09,
                strokeColor: '#E11900',
                lineWidth: 1.8,
                dashed: false,
              },
              geometry: { type: 'Polygon', coordinates: [ccRing] },
            },
          ],
        });

        if (zoomLevel >= 11) {
          const ccEl = document.createElement('div');
          ccEl.innerHTML = `<div style="background:#E11900;color:#fff;font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);pointer-events:none;">CC</div>`;
          const ccMarker = new maplibregl.Marker({ element: ccEl, anchor: 'center' })
            .setLngLat([-0.128, 51.524])
            .addTo(map);
          zoneMarkersRef.current.push(ccMarker);
        }
      } else {
        zonesSource.setData(EMPTY_FC);
      }
    }

    // 2. Traffic Corridors
    const trafficSource = map.getSource('traffic-source') as maplibregl.GeoJSONSource | undefined;
    if (trafficSource) {
      if (showTrafficLayer) {
        trafficSource.setData({
          type: 'FeatureCollection',
          features: UK_TRAFFIC_SEGMENTS_LATLNG.map((seg) => ({
            type: 'Feature',
            properties: {
              color:
                seg.level === 'heavy'
                  ? '#E11900'
                  : seg.level === 'moderate'
                  ? '#F59E0B'
                  : '#05944F',
            },
            geometry: {
              type: 'LineString',
              coordinates: seg.points.map(([lat, lng]) => [lng, lat]),
            },
          })),
        });
      } else {
        trafficSource.setData(EMPTY_FC);
      }
    }

    // 3. Surge Heat Polygons
    const surgeSource = map.getSource('surge-zones-source') as maplibregl.GeoJSONSource | undefined;
    if (surgeSource) {
      if (showSurgeHeatmap) {
        const features: GeoJSONFeatureItem[] = [];
        surgeZones.forEach((zone, idx) => {
          if (zone.kind === 'busy' || zone.kind === 'event') return;
          const fillColor =
            zone.intensity === 'high'
              ? '#D91B5C'
              : zone.intensity === 'medium'
              ? '#A020F0'
              : '#F59E0B';
          features.push(
            {
              type: 'Feature',
              properties: {
                fillColor,
                fillOpacity: nightMode ? 0.25 : 0.19,
                hasStroke: false,
                strokeOpacity: 0,
              },
              geometry: {
                type: 'Polygon',
                coordinates: [buildSurgePolygonRing(zone.coords, zone.radius, idx + 1)],
              },
            },
            {
              type: 'Feature',
              properties: {
                fillColor,
                fillOpacity: nightMode ? 0.34 : 0.25,
                hasStroke: true,
                strokeOpacity: nightMode ? 0.5 : 0.38,
              },
              geometry: {
                type: 'Polygon',
                coordinates: [buildSurgePolygonRing(zone.coords, zone.radius * 0.56, idx + 4)],
              },
            }
          );
        });
        surgeSource.setData({ type: 'FeatureCollection', features });
      } else {
        surgeSource.setData(EMPTY_FC);
      }
    }

    // 4. Busy Soon Rings
    const busySoonSource = map.getSource('busy-soon-source') as maplibregl.GeoJSONSource | undefined;
    if (busySoonSource) {
      if (showBusySoonZones && tripStage === 'idle') {
        busySoonSource.setData({
          type: 'FeatureCollection',
          features: busySoonZones.map((bz) => {
            const ll = mapToLatLng(bz.coords);
            return {
              type: 'Feature',
              properties: {
                fillOpacity: nightMode ? 0.1 : 0.12,
              },
              geometry: {
                type: 'Polygon',
                coordinates: [createGeoCircleRing(ll.lat, ll.lng, 1900)],
              },
            };
          }),
        });
      } else {
        busySoonSource.setData(EMPTY_FC);
      }
    }
  }, [
    styleEpoch,
    showUKZones,
    showTrafficLayer,
    showSurgeHeatmap,
    showBusySoonZones,
    surgeZones,
    busySoonZones,
    tripStage,
    nightMode,
    zoomLevel,
  ]);

  // Update Route Lines, Stop Pin, Endpoint Badge & Destination Line
  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleEpoch === 0) return;
    ensureVectorLayers(map);

    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];

    const fullSource = map.getSource('full-route-source') as maplibregl.GeoJSONSource | undefined;
    const activeSource = map.getSource('active-route-source') as maplibregl.GeoJSONSource | undefined;
    const destSource = map.getSource('dest-route-source') as maplibregl.GeoJSONSource | undefined;

    const trip = activeTrip || pendingOffer;
    const isOfferPreview = Boolean(pendingOffer && !activeTrip && tripStage === 'idle');
    if (trip && isOfferPreview) {
      const approachPts: Coordinates[] =
        routePolyline && routePolyline.length >= 2
          ? [driverPos, ...routePolyline.slice(1)]
          : [driverPos, trip.pickupCoords];
      const approachLngLats = approachPts.map((p) => {
        const ll = mapToLatLng(p);
        return [ll.lng, ll.lat] as [number, number];
      });

      const tripPts: Coordinates[] =
        offerTripPolyline && offerTripPolyline.length >= 2
          ? offerTripPolyline
          : trip.stopCoords
          ? [trip.pickupCoords, trip.stopCoords, trip.dropoffCoords]
          : [trip.pickupCoords, trip.dropoffCoords];
      const tripLngLats = tripPts.map((p) => {
        const ll = mapToLatLng(p);
        return [ll.lng, ll.lat] as [number, number];
      });

      const isIntercity = Boolean(trip.isIntercity);
      const tripMainColor = isIntercity ? '#9333EA' : nightMode ? '#5B9BF8' : '#000000';
      const tripCasingColor = isIntercity
        ? 'rgba(122,28,121,0.34)'
        : nightMode
        ? 'rgba(91,155,248,0.34)'
        : 'rgba(0,0,0,0.22)';

      if (fullSource) fullSource.setData(EMPTY_FC);
      if (destSource) destSource.setData(EMPTY_FC);
      if (activeSource) {
        activeSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {
                mainColor: '#05944F',
                casingColor: 'rgba(5,148,79,0.22)',
              },
              geometry: { type: 'LineString', coordinates: approachLngLats },
            },
            {
              type: 'Feature',
              properties: {
                mainColor: tripMainColor,
                casingColor: tripCasingColor,
              },
              geometry: { type: 'LineString', coordinates: tripLngLats },
            },
          ],
        });
      }

      const pickupLL = mapToLatLng(trip.pickupCoords);
      const pickupShort = trip.pickupArea.split('·')[0].trim();
      const pickupEl = document.createElement('div');
      pickupEl.style.pointerEvents = 'none';
      pickupEl.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          <div style="position:absolute;bottom:22px;background:#05944F;color:#fff;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.3);">Pickup · ${escapeHtml(
            pickupShort
          )}</div>
          <div style="width:15px;height:15px;border-radius:9999px;background:#05944F;border:2.5px solid #FFFFFF;box-shadow:0 2px 8px rgba(0,0,0,0.34);"></div>
        </div>
      `;
      routeMarkersRef.current.push(
        new maplibregl.Marker({ element: pickupEl, anchor: 'center' })
          .setLngLat([pickupLL.lng, pickupLL.lat])
          .addTo(map)
      );

      if (trip.stopCoords) {
        const stopLL = mapToLatLng(trip.stopCoords);
        const stopEl = document.createElement('div');
        stopEl.style.pointerEvents = 'none';
        stopEl.innerHTML = `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="position:absolute;bottom:20px;background:#F59E0B;color:#000;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:6px;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.25);">Stop 1</div>
            <div style="width:14px;height:14px;border-radius:9999px;background:#F59E0B;border:2.5px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
          </div>
        `;
        routeMarkersRef.current.push(
          new maplibregl.Marker({ element: stopEl, anchor: 'center' })
            .setLngLat([stopLL.lng, stopLL.lat])
            .addTo(map)
        );
      }

      const dropoffLL = mapToLatLng(trip.dropoffCoords);
      const dropoffShort = trip.dropoffArea.split('·')[0].trim();
      const dropoffLabel = isIntercity
        ? `${dropoffShort} (Intercity)`
        : `Dropoff · ${dropoffShort}`;
      const dropoffEl = document.createElement('div');
      dropoffEl.style.pointerEvents = 'none';
      dropoffEl.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          <div style="position:absolute;bottom:22px;background:${
            isIntercity ? '#7A1C79' : '#000000'
          };color:#fff;font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:8px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.3);">${escapeHtml(
            dropoffLabel
          )}</div>
          <div style="width:15px;height:15px;border-radius:3px;background:${
            isIntercity ? '#9333EA' : '#000000'
          };border:2.5px solid #FFFFFF;box-shadow:0 2px 8px rgba(0,0,0,0.34);"></div>
        </div>
      `;
      routeMarkersRef.current.push(
        new maplibregl.Marker({ element: dropoffEl, anchor: 'center' })
          .setLngLat([dropoffLL.lng, dropoffLL.lat])
          .addTo(map)
      );
    } else if (trip) {
      const isDropoff =
        tripStage === 'enroute' || tripStage === 'stop_wait' || tripStage === 'dropoff_arrived';
      const endCoord = isDropoff ? trip.dropoffCoords : trip.pickupCoords;
      const pinLabel = isDropoff
        ? trip.isIntercity
          ? `${trip.dropoffArea.split('·')[0].trim()} (Intercity)`
          : 'Dropoff'
        : `Pickup ${trip.riderName}`;

      if (fullSource) {
        if (fullRoutePolyline && fullRoutePolyline.length >= 2) {
          fullSource.setData({
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { color: nightMode ? '#FFFFFF' : '#0F172A' },
                geometry: {
                  type: 'LineString',
                  coordinates: fullRoutePolyline.map((p) => {
                    const ll = mapToLatLng(p);
                    return [ll.lng, ll.lat];
                  }),
                },
              },
            ],
          });
        } else {
          fullSource.setData(EMPTY_FC);
        }
      }

      const activePts: Coordinates[] =
        routePolyline && routePolyline.length >= 2
          ? [driverPos, ...routePolyline.slice(1)]
          : [driverPos, endCoord];

      const activeLngLats = activePts.map((p) => {
        const ll = mapToLatLng(p);
        return [ll.lng, ll.lat] as [number, number];
      });

      const isIntercity = Boolean(trip.isIntercity);
      const mainColor = isIntercity
        ? '#9333EA'
        : isDropoff
        ? nightMode
          ? '#5B9BF8'
          : '#000000'
        : '#276EF1';
      const casingColor = isIntercity
        ? 'rgba(122,28,121,0.34)'
        : nightMode
        ? 'rgba(91,155,248,0.34)'
        : 'rgba(0,0,0,0.22)';

      if (activeSource) {
        activeSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { mainColor, casingColor },
              geometry: { type: 'LineString', coordinates: activeLngLats },
            },
          ],
        });
      }

      if (destSource) destSource.setData(EMPTY_FC);

      if (trip.stopCoords) {
        const stopLL = mapToLatLng(trip.stopCoords);
        const stopEl = document.createElement('div');
        stopEl.style.pointerEvents = 'none';
        stopEl.innerHTML = `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
            <div style="position:absolute;bottom:20px;background:#F59E0B;color:#000;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:6px;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.25);">Stop 1</div>
            <div style="width:14px;height:14px;border-radius:9999px;background:#F59E0B;border:2.5px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>
          </div>
        `;
        routeMarkersRef.current.push(
          new maplibregl.Marker({ element: stopEl, anchor: 'center' })
            .setLngLat([stopLL.lng, stopLL.lat])
            .addTo(map)
        );
      }

      const endLngLat = activeLngLats[activeLngLats.length - 1];
      const dotColor = isIntercity ? '#9333EA' : isDropoff ? '#000000' : '#05944F';
      const endEl = document.createElement('div');
      endEl.style.pointerEvents = 'none';
      endEl.innerHTML = `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          <div style="position:absolute;bottom:22px;background:${
            isIntercity ? '#7A1C79' : '#000000'
          };color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:8px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.3);">${escapeHtml(
            pinLabel
          )}</div>
          <div style="width:16px;height:16px;border-radius:9999px;background:${dotColor};border:2.5px solid #FFFFFF;box-shadow:0 2px 8px rgba(0,0,0,0.34);"></div>
        </div>
      `;
      routeMarkersRef.current.push(
        new maplibregl.Marker({ element: endEl, anchor: 'center' })
          .setLngLat(endLngLat)
          .addTo(map)
      );
    } else if (destination.active) {
      if (fullSource) fullSource.setData(EMPTY_FC);
      if (activeSource) activeSource.setData(EMPTY_FC);

      const startLL = mapToLatLng(driverPos);
      const destLL = mapToLatLng(destination.coords);
      if (destSource) {
        destSource.setData({
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [startLL.lng, startLL.lat],
                  [destLL.lng, destLL.lat],
                ],
              },
            },
          ],
        });
      }

      const destEl = document.createElement('div');
      destEl.style.pointerEvents = 'none';
      destEl.innerHTML = `<div style="width:14px;height:14px;border-radius:9999px;background:#276EF1;border:2.5px solid #FFFFFF;box-shadow:0 2px 8px rgba(0,0,0,0.32);"></div>`;
      routeMarkersRef.current.push(
        new maplibregl.Marker({ element: destEl, anchor: 'center' })
          .setLngLat([destLL.lng, destLL.lat])
          .addTo(map)
      );
    } else {
      if (fullSource) fullSource.setData(EMPTY_FC);
      if (activeSource) activeSource.setData(EMPTY_FC);
      if (destSource) destSource.setData(EMPTY_FC);
    }
  }, [
    styleEpoch,
    activeTrip,
    pendingOffer,
    tripStage,
    routePolyline,
    fullRoutePolyline,
    offerTripPolyline,
    driverPos,
    destination,
    nightMode,
  ]);

  // Render Interactive Surge Pills, Busy Soon Chips, Airports, Speed Cameras & Map Reports
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    pinMarkersRef.current.forEach((m) => m.remove());
    pinMarkersRef.current = [];

    if (tripStage === 'idle') {
      surgeZones.forEach((zone) => {
        const ll = mapToLatLng(zone.coords);
        const bg =
          zone.kind === 'surge'
            ? '#7A1C79'
            : zone.kind === 'wait'
            ? zone.intensity === 'high'
              ? '#D6223A'
              : '#DE8300'
            : zone.kind === 'event'
            ? '#276EF1'
            : '#8F9AA6';
        const prefix =
          zone.kind === 'wait'
            ? zone.intensity === 'high'
              ? '» '
              : '› '
            : zone.kind === 'event'
            ? '🔥 '
            : '';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.cssText = `background:${bg};color:#fff;padding:2px 9px;border-radius:9999px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.28);border:1px solid rgba(255,255,255,0.2);cursor:pointer;`;
        btn.textContent = `${prefix}${zone.label}`;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectSurgeRef.current?.(zone);
        });

        pinMarkersRef.current.push(
          new maplibregl.Marker({ element: btn, anchor: 'center' })
            .setLngLat([ll.lng, ll.lat])
            .addTo(map)
        );
      });

      if (showBusySoonZones && !pendingOffer) {
        busySoonZones.forEach((bz) => {
          const ll = mapToLatLng(bz.coords);
          const wrap = document.createElement('div');
          wrap.style.cssText = 'position:relative;pointer-events:auto;';
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.style.cssText =
            'transform:translateY(-18px);background:#FEF3C7;color:#92400E;border:1px solid rgba(245,158,11,0.55);padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.18);cursor:pointer;';
          btn.textContent = `⏱ ${bz.area.split(' ')[0]} · ${bz.minutesUntilBusy}m`;
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            onSelectBusySoonRef.current?.(bz);
          });
          wrap.appendChild(btn);

          pinMarkersRef.current.push(
            new maplibregl.Marker({ element: wrap, anchor: 'center' })
              .setLngLat([ll.lng, ll.lat])
              .addTo(map)
          );
        });
      }
    }

    if (zoomLevel >= 9) {
      UK_AIRPORT_MAP_PINS.forEach((ap) => {
        const ll = mapToLatLng(ap.coords);
        const el = document.createElement('div');
        el.style.cssText =
          'background:rgba(0,0,0,0.82);color:#fff;font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:5px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);pointer-events:none;';
        el.textContent = `✈ ${ap.code}`;
        pinMarkersRef.current.push(
          new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([ll.lng, ll.lat])
            .addTo(map)
        );
      });
    }

    if (showSpeedCameras && zoomLevel >= 11) {
      UK_SPEED_CAMERAS.forEach((cam) => {
        const ll = mapToLatLng(cam.coords);
        const el = document.createElement('div');
        el.title = `${cam.label} (${cam.limitMph} mph)`;
        el.style.cssText =
          'width:22px;height:22px;border-radius:9999px;background:#fff;border:2px solid #E11900;box-shadow:0 2px 6px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;font-size:11px;pointer-events:none;';
        el.textContent = '📷';
        pinMarkersRef.current.push(
          new maplibregl.Marker({ element: el, anchor: 'center' })
            .setLngLat([ll.lng, ll.lat])
            .addTo(map)
        );
      });
    }

    mapReports.forEach((pin) => {
      const ll = mapToLatLng(pin.coords);
      const el = document.createElement('div');
      el.style.pointerEvents = 'none';
      el.innerHTML = getReportBadgeHtml(pin.category);
      pinMarkersRef.current.push(
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([ll.lng, ll.lat])
          .addTo(map)
      );
    });
  }, [
    tripStage,
    surgeZones,
    busySoonZones,
    showBusySoonZones,
    pendingOffer,
    zoomLevel,
    showSpeedCameras,
    mapReports,
  ]);

  // Persistent 60fps Driver Puck Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const ll = mapToLatLng(driverPos);
    const gpsBlue = isLiveGps || blueGpsActive;
    const ringBorder = gpsBlue ? '#276EF1' : nightMode ? '#FFFFFF' : '#000000';
    const arrowFill = gpsBlue ? '#276EF1' : nightMode ? '#FFFFFF' : '#000000';
    const bgPuck = nightMode ? '#1E2028' : '#FFFFFF';
    const relativeRotation = driverHeading - map.getBearing();

    const pulseHtml =
      (onlineStatus === 'online' || gpsBlue) && tripStage === 'idle'
        ? `<div class="animate-go-pulse" style="position:absolute;inset:-14px;border-radius:9999px;background:rgba(39,110,241,0.28);"></div>`
        : '';
    const coneHtml = isNavigatingActive
      ? `<svg width="92" height="92" viewBox="0 0 92 92" style="position:absolute;top:-50px;left:50%;transform:translateX(-50%);pointer-events:none;">
          <defs>
            <linearGradient id="mlNavBeamGrad" x1="50%" y1="100%" x2="50%" y2="0%">
              <stop offset="0%" stop-color="#276EF1" stop-opacity="0.45" />
              <stop offset="100%" stop-color="#276EF1" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path d="M46 72 L14 8 Q46 0 78 8 Z" fill="url(#mlNavBeamGrad)" />
        </svg>`
      : '';
    const badgeHtml =
      tripStage === 'idle'
        ? `<div style="position:absolute;top:46px;left:50%;transform:translateX(-50%);background:${
            nightMode ? 'rgba(24,26,32,0.92)' : 'rgba(255,255,255,0.94)'
          };color:${
            nightMode ? '#fff' : '#1F2937'
          };padding:2px 9px;border-radius:9999px;font-size:10.5px;font-weight:700;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.18);border:1px solid rgba(0,0,0,0.08);display:flex;align-items:center;gap:5px;">
            ${
              gpsBlue
                ? '<span style="width:7px;height:7px;border-radius:9999px;background:#276EF1;display:inline-block;"></span>'
                : ''
            }
            <span>${escapeHtml(
              isLiveGps
                ? `Live GPS · ${nearCityLabel}`
                : gpsBlue
                ? `GPS Active · ${nearCityLabel}`
                : `Near ${nearCityLabel} · UK`
            )}</span>
          </div>`
        : '';

    const innerHtml = `
      <div style="position:relative;width:40px;height:40px;pointer-events:none;">
        ${pulseHtml}
        <div data-driver-rotator style="position:relative;width:40px;height:40px;transform:rotate(${relativeRotation}deg);display:flex;align-items:center;justify-content:center;">
          ${coneHtml}
          <div style="position:relative;width:40px;height:40px;border-radius:9999px;background:${bgPuck};border:3px solid ${ringBorder};box-shadow:0 6px 18px rgba(0,0,0,0.34);display:flex;align-items:center;justify-content:center;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L4.5 19.5L12 16L19.5 19.5L12 3Z" fill="${arrowFill}" />
            </svg>
          </div>
        </div>
        ${badgeHtml}
      </div>
    `;

    const stateSig = `${onlineStatus}|${tripStage}|${gpsBlue}|${nightMode}|${isLiveGps}|${nearCityLabel}`;

    if (!driverMarkerRef.current) {
      const el = document.createElement('div');
      el.style.zIndex = '20';
      el.style.pointerEvents = 'none';
      el.dataset.stateSig = stateSig;
      el.innerHTML = innerHtml;

      driverMarkerRef.current = new maplibregl.Marker({
        element: el,
        anchor: 'center',
        rotationAlignment: 'viewport',
        pitchAlignment: 'viewport',
      })
        .setLngLat([ll.lng, ll.lat])
        .addTo(map);
    } else {
      driverMarkerRef.current.setLngLat([ll.lng, ll.lat]);
      const el = driverMarkerRef.current.getElement();
      if (el.dataset.stateSig !== stateSig) {
        el.dataset.stateSig = stateSig;
        el.innerHTML = innerHtml;
      } else {
        const rotator = el.querySelector('[data-driver-rotator]') as HTMLElement | null;
        if (rotator) {
          rotator.style.transform = `rotate(${relativeRotation}deg)`;
        }
      }
    }
  }, [
    driverPos,
    driverHeading,
    onlineStatus,
    tripStage,
    isLiveGps,
    blueGpsActive,
    nightMode,
    isNavigatingActive,
    nearCityLabel,
  ]);

  const handleZoomIn = () => {
    isEasingUntilRef.current = performance.now() + 250;
    mapRef.current?.zoomIn({ duration: 220 });
  };

  const handleZoomOut = () => {
    isEasingUntilRef.current = performance.now() + 250;
    mapRef.current?.zoomOut({ duration: 220 });
  };

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    setHasManualPan(false);
    setRouteOverviewMode(false);
    const ll = mapToLatLng(driverPos);
    const use3D = !compact && isNavigatingActive && navCamera3D;
    isEasingUntilRef.current = performance.now() + 430;
    map.easeTo({
      center: [ll.lng, ll.lat],
      zoom: defaultZoom,
      pitch: use3D ? 52 : 0,
      bearing: use3D ? driverHeading : 0,
      padding: use3D
        ? { top: 210, bottom: 110, left: 0, right: 0 }
        : { top: 0, bottom: 0, left: 0, right: 0 },
      duration: 400,
    });
  };

  return (
    <div
      className={`relative w-full h-full overflow-hidden select-none transition-colors duration-300 ${
        nightMode ? 'bg-[#09131D]' : 'bg-[#E5E3DF]'
      }`}
    >
      {/* Keyless MapLibre GL + OpenFreeMap Carto-Style Global Vector Map */}
      <div ref={containerRef} className="w-full h-full z-0 isolate" />

      {/* UK Weather Atmospheric Overlay */}
      {!compact && weatherCondition !== 'Clear' && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-500 ${
            weatherCondition === 'Heavy Rain'
              ? 'weather-rain-overlay bg-slate-900/15 opacity-90'
              : weatherCondition === 'Light Drizzle'
              ? 'weather-rain-overlay opacity-45'
              : 'bg-slate-200/25 dark:bg-slate-800/25 backdrop-blur-[1px]'
          }`}
        />
      )}

      {/* Zoom In / Zoom Out + 3D Camera + Map Layers Controls (positioned clear of Top Nav & Bottom Controls) */}
      {!compact && !hideMapControls && (
        <div
          className={`flex flex-col items-center gap-1.5 absolute right-3.5 z-20 ${
            tripStage === 'idle' ? 'top-[116px]' : 'top-[214px]'
          }`}
        >
          <div className="flex flex-col w-10 rounded-2xl overflow-hidden bg-white dark:bg-[#1E2028] shadow-lg border border-black/10 dark:border-white/10 divide-y divide-black/10 dark:divide-white/10">
            <button
              type="button"
              onClick={handleZoomIn}
              className="w-10 h-10 flex items-center justify-center text-[19px] font-bold text-black dark:text-white hover:bg-[#F8F8F8] dark:hover:bg-[#2A2D38] active:scale-95 transition-all"
              aria-label="Zoom in map"
              title="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="w-10 h-10 flex items-center justify-center text-[19px] font-bold text-black dark:text-white hover:bg-[#F8F8F8] dark:hover:bg-[#2A2D38] active:scale-95 transition-all"
              aria-label="Zoom out map"
              title="Zoom out"
            >
              −
            </button>
          </div>
          {isNavigatingActive && (
            <div className="flex flex-col w-10 rounded-2xl overflow-hidden bg-white dark:bg-[#1E2028] shadow-lg border border-black/10 dark:border-white/10 divide-y divide-black/10 dark:divide-white/10">
              <button
                type="button"
                onClick={() => {
                  setRouteOverviewMode(false);
                  setNavCamera3D((v) => !v);
                }}
                className={`w-10 h-9 text-[11px] font-extrabold flex items-center justify-center active:scale-95 transition-all ${
                  navCamera3D && !routeOverviewMode
                    ? 'bg-[#276EF1] text-white'
                    : 'text-black dark:text-white hover:bg-[#F8F8F8] dark:hover:bg-[#2A2D38]'
                }`}
                aria-label={navCamera3D ? 'Switch to flat 2D map' : 'Switch to 3D chase cam'}
                title={navCamera3D ? '3D Chase Cam' : '2D Flat Map'}
              >
                {navCamera3D && !routeOverviewMode ? '3D' : '2D'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !routeOverviewMode;
                  setRouteOverviewMode(next);
                  setHasManualPan(false);
                  if (!next) {
                    const ll = mapToLatLng(driverPos);
                    const use3D = !compact && isNavigatingActive && navCamera3D;
                    isEasingUntilRef.current = performance.now() + 430;
                    mapRef.current?.easeTo({
                      center: [ll.lng, ll.lat],
                      zoom: defaultZoom,
                      pitch: use3D ? 52 : 0,
                      bearing: use3D ? driverHeading : 0,
                      padding: use3D
                        ? { top: 210, bottom: 110, left: 0, right: 0 }
                        : { top: 0, bottom: 0, left: 0, right: 0 },
                      duration: 400,
                    });
                  }
                }}
                className={`w-10 h-9 flex items-center justify-center active:scale-95 transition-all ${
                  routeOverviewMode
                    ? 'bg-black dark:bg-[#276EF1] text-white'
                    : 'text-black dark:text-white hover:bg-[#F8F8F8] dark:hover:bg-[#2A2D38]'
                }`}
                aria-label={routeOverviewMode ? 'Return to Turn-by-Turn' : 'Show Full Route Overview'}
                title={routeOverviewMode ? 'Back to Turn-by-Turn' : 'Route Overview'}
              >
                <RouteIcon className="w-4 h-4" />
              </button>
            </div>
          )}
          {onToggleMapLayers && (
            <button
              type="button"
              onClick={onToggleMapLayers}
              className={`w-10 h-10 rounded-full shadow-lg border flex items-center justify-center active:scale-95 transition-all ${
                showTrafficLayer || showUKZones
                  ? 'bg-white dark:bg-[#1E2028] border-[#276EF1]/35 text-[#276EF1]'
                  : 'bg-white dark:bg-[#1E2028] border-black/10 dark:border-white/10 text-black dark:text-white'
              }`}
              aria-label="Toggle UK traffic and ULEZ layers"
              title="UK Traffic & ULEZ Layers"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
          {(Math.abs(zoomLevel - defaultZoom) > 0.75 || hasManualPan) && (
            <button
              type="button"
              onClick={handleRecenter}
              className="px-2 py-1 rounded-full bg-black/85 dark:bg-[#276EF1] text-white text-[10px] font-bold tabular-nums shadow-md hover:bg-black active:scale-95 transition-all whitespace-nowrap"
              aria-label="Re-center map"
              title="Re-center & reset zoom"
            >
              {hasManualPan ? 'Center' : `z${zoomLevel.toFixed(1)}`}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
