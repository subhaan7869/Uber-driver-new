import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Car,
  Clock,
  Construction,
  Flame,
  GitMerge,
  Layers,
  MinusCircle,
  Plane,
  Route as RouteIcon,
  ShieldAlert,
} from 'lucide-react';
import {
  BusySoonZone,
  Coordinates,
  DestinationConfig,
  DriverOnlineStatus,
  MapReportPin,
  SurgeZone,
  TripOffer,
  TripStage,
} from '../types/driver';
import {
  nearestUKCity,
  UK_AIRPORT_MAP_PINS,
  UK_CITIES,
  UK_SPEED_CAMERAS,
  UK_SVG_PATHS,
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
  compact?: boolean;
  onSelectSurgeZone?: (zone: SurgeZone) => void;
  onSelectBusySoonZone?: (zone: BusySoonZone) => void;
  onToggleMapLayers?: () => void;
}

function buildSurgePolygonPoints(
  cx: number,
  cy: number,
  radius: number,
  seed: number
): string {
  const sides = 8;
  const pts: string[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + seed * 0.35;
    const wobble = 0.84 + 0.18 * Math.sin(i * 2.1 + seed * 1.7);
    const r = radius * wobble;
    const x = (cx + Math.cos(angle) * r).toFixed(1);
    const y = (cy + Math.sin(angle) * r).toFixed(1);
    pts.push(`${x},${y}`);
  }
  return pts.join(' ');
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
  compact = false,
  onSelectSurgeZone,
  onSelectBusySoonZone,
  onToggleMapLayers,
}) => {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(compact ? 0.9 : 1.05);
  const [isPanning, setIsPanning] = useState(false);
  const [navCamera3D, setNavCamera3D] = useState(true);
  const [routeOverviewMode, setRouteOverviewMode] = useState(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef<number | null>(null);
  const lastRecenterRef = useRef(recenterSignal);

  const clampZoom = (value: number) =>
    Math.max(0.65, Math.min(4.8, Number(value.toFixed(2))));

  const clampPan = (x: number, y: number, currentZoom: number) => {
    const limit = Math.round(440 * Math.max(1, currentZoom));
    return {
      x: Math.max(-limit, Math.min(limit, x)),
      y: Math.max(-limit, Math.min(limit, y)),
    };
  };

  if (lastRecenterRef.current !== recenterSignal) {
    lastRecenterRef.current = recenterSignal;
    if (pan.x !== 0 || pan.y !== 0) {
      setPan({ x: 0, y: 0 });
    }
    const isIntercityActive = Boolean((activeTrip || pendingOffer)?.isIntercity);
    setZoom(tripStage !== 'idle' ? (isIntercityActive ? 1.55 : 2.75) : 1.05);
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);

    if (activePointersRef.current.size === 1) {
      setIsPanning(true);
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      lastPinchDistRef.current = null;
    } else if (activePointersRef.current.size === 2) {
      setIsPanning(true);
      const pts = Array.from(activePointersRef.current.values());
      lastPinchDistRef.current = Math.hypot(
        pts[0].x - pts[1].x,
        pts[0].y - pts[1].y
      );
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 2) {
      const pts = Array.from(activePointersRef.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (lastPinchDistRef.current && lastPinchDistRef.current > 0) {
        const ratio = dist / lastPinchDistRef.current;
        setZoom((z) => clampZoom(z * ratio));
      }
      lastPinchDistRef.current = dist;
      return;
    }

    if (!isPanning || activePointersRef.current.size !== 1) return;
    const dx = e.clientX - lastPointerRef.current.x;
    const dy = e.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    setPan((prev) => clampPan(prev.x + dx, prev.y + dy, zoom));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);
    if (activePointersRef.current.size < 2) {
      lastPinchDistRef.current = null;
    }
    if (activePointersRef.current.size === 1) {
      const remaining = Array.from(activePointersRef.current.values())[0];
      lastPointerRef.current = { x: remaining.x, y: remaining.y };
      setIsPanning(true);
    } else if (activePointersRef.current.size === 0) {
      setIsPanning(false);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (compact) return;
    const delta = -e.deltaY * 0.0022;
    setZoom((z) => clampZoom(z + delta));
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setZoom((z) => (z >= 2.8 ? 1.05 : clampZoom(z + 0.55)));
  };

  const routePoints = useMemo(() => {
    const trip = activeTrip || pendingOffer;
    if (!trip) return null;

    const isDropoff =
      tripStage === 'enroute' || tripStage === 'stop_wait' || tripStage === 'dropoff_arrived';
    const endCoord = isDropoff ? trip.dropoffCoords : trip.pickupCoords;
    const pinLabel = isDropoff
      ? trip.isIntercity
        ? `${trip.dropoffArea.split('·')[0].trim()} (Intercity)`
        : 'Dropoff'
      : `Pickup ${trip.riderName}`;

    const fullPathD =
      fullRoutePolyline && fullRoutePolyline.length >= 2
        ? fullRoutePolyline
            .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
            .join(' ')
        : null;

    if (routePolyline && routePolyline.length >= 2) {
      const dPath = [driverPos, ...routePolyline.slice(1)]
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');
      return {
        start: driverPos,
        end: routePolyline[routePolyline.length - 1] ?? endCoord,
        stop: trip.stopCoords ?? null,
        stopLabel: trip.stopAddress ? 'Stop 1' : null,
        pathD: dPath,
        fullPathD,
        pinLabel,
        isDropoff,
        isIntercity: Boolean(trip.isIntercity),
      };
    }

    const midX = (driverPos.x + endCoord.x) / 2 + (isDropoff ? 6 : -4);
    const midY = (driverPos.y + endCoord.y) / 2 - (isDropoff ? 5 : 0);
    return {
      start: driverPos,
      end: endCoord,
      stop: trip.stopCoords ?? null,
      stopLabel: trip.stopAddress ? 'Stop 1' : null,
      pathD: `M ${driverPos.x} ${driverPos.y} Q ${midX} ${midY} ${endCoord.x} ${endCoord.y}`,
      fullPathD,
      pinLabel,
      isDropoff,
      isIntercity: Boolean(trip.isIntercity),
    };
  }, [activeTrip, pendingOffer, tripStage, driverPos, routePolyline, fullRoutePolyline]);

  const renderReportIcon = (category: MapReportPin['category']) => {
    switch (category) {
      case 'traffic':
        return (
          <div className="w-7 h-7 rotate-45 rounded-md bg-[#FFC043] border-2 border-white shadow-md flex items-center justify-center">
            <Car className="w-3.5 h-3.5 text-black -rotate-45" />
          </div>
        );
      case 'crash':
        return (
          <div className="w-7 h-7 rotate-45 rounded-md bg-[#FF6937] border-2 border-white shadow-md flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5 text-black -rotate-45" />
          </div>
        );
      case 'roadwork':
        return (
          <div className="w-7 h-7 rotate-45 rounded-md bg-[#FF8038] border-2 border-white shadow-md flex items-center justify-center">
            <Construction className="w-3.5 h-3.5 text-black -rotate-45" />
          </div>
        );
      case 'road_closed':
        return (
          <div className="w-7 h-7 rounded-full bg-[#E11900] border-2 border-white shadow-md flex items-center justify-center">
            <MinusCircle className="w-4 h-4 text-white" />
          </div>
        );
      case 'police':
        return (
          <div className="w-7 h-7 rotate-45 rounded-md bg-[#276EF1] border-2 border-white shadow-md flex items-center justify-center">
            <ShieldAlert className="w-3.5 h-3.5 text-white -rotate-45" />
          </div>
        );
      case 'lane_closure':
        return (
          <div className="w-7 h-7 rounded-full bg-[#E2E2E2] border-2 border-white shadow-md flex items-center justify-center">
            <GitMerge className="w-3.5 h-3.5 text-black" />
          </div>
        );
    }
  };

  const isNavigatingActive = tripStage === 'pickup' || tripStage === 'enroute';
  const isNav3DActive = !compact && isNavigatingActive && navCamera3D && !routeOverviewMode;
  const hasManualPan = Math.abs(pan.x) > 10 || Math.abs(pan.y) > 10;

  const cameraFollowWeight = isNavigatingActive ? (routeOverviewMode ? 0.65 : 1.0) : zoom > 1.3 ? 0.85 : 0.22;
  const offsetX = (500 - driverPos.x) * cameraFollowWeight;
  const offsetY = (500 - driverPos.y) * cameraFollowWeight;

  const mapRotationDeg = isNav3DActive ? -driverHeading : 0;
  const counterRotationDeg = -mapRotationDeg;

  const defaultZoom =
    tripStage !== 'idle'
      ? (activeTrip || pendingOffer)?.isIntercity
        ? 1.55
        : 2.75
      : 1.05;
  const nearCityLabel = useMemo(() => nearestUKCity(driverPos), [driverPos]);
  const invScale = Math.max(0.36, Math.min(1.15, 1 / Math.sqrt(zoom)));

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      className={`relative w-full h-full overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing transition-colors duration-300 ${
        nightMode ? 'bg-[#09131D]' : 'bg-[#B4D1EC]'
      }`}
    >
      {/* Zoom In / Zoom Out + 3D Camera + Map Layers Controls */}
      {!compact && (
        <div
          className={`flex flex-col items-center gap-1.5 absolute right-4 z-20 ${
            tripStage === 'idle' ? 'top-[122px]' : 'top-[148px]'
          }`}
        >
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z + 0.35))}
            className="w-11 h-11 rounded-full bg-white dark:bg-[#1E2028] shadow-lg border border-black/5 dark:border-white/10 flex items-center justify-center text-[20px] font-bold text-black dark:text-white hover:bg-[#F8F8F8] dark:hover:bg-[#2A2D38] active:scale-95 transition-all"
            aria-label="Zoom in map"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => clampZoom(z - 0.35))}
            className="w-11 h-11 rounded-full bg-white dark:bg-[#1E2028] shadow-lg border border-black/5 dark:border-white/10 flex items-center justify-center text-[20px] font-bold text-black dark:text-white hover:bg-[#F8F8F8] dark:hover:bg-[#2A2D38] active:scale-95 transition-all"
            aria-label="Zoom out map"
            title="Zoom out"
          >
            −
          </button>
          {isNavigatingActive && (
            <>
              <button
                type="button"
                onClick={() => {
                  setRouteOverviewMode(false);
                  setNavCamera3D((v) => !v);
                }}
                className={`w-11 h-11 rounded-full shadow-lg border text-[11px] font-extrabold flex items-center justify-center active:scale-95 transition-all ${
                  navCamera3D && !routeOverviewMode
                    ? 'bg-[#276EF1] border-[#276EF1] text-white'
                    : 'bg-white dark:bg-[#1E2028] border-black/5 dark:border-white/10 text-black dark:text-white'
                }`}
                aria-label={navCamera3D ? 'Switch to North-Up 2D map' : 'Switch to 3D Heading-Up nav'}
                title={navCamera3D ? '3D Heading-Up Nav' : '2D North-Up Map'}
              >
                {navCamera3D && !routeOverviewMode ? '3D' : '2D'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !routeOverviewMode;
                  setRouteOverviewMode(next);
                  setPan({ x: 0, y: 0 });
                  if (next) {
                    setZoom(1.45);
                  } else {
                    setZoom(defaultZoom);
                  }
                }}
                className={`w-11 h-11 rounded-full shadow-lg border flex items-center justify-center active:scale-95 transition-all ${
                  routeOverviewMode
                    ? 'bg-black dark:bg-[#276EF1] border-black dark:border-[#276EF1] text-white'
                    : 'bg-white dark:bg-[#1E2028] border-black/5 dark:border-white/10 text-black dark:text-white'
                }`}
                aria-label={routeOverviewMode ? 'Return to Turn-by-Turn Chase Cam' : 'Show Full Route Overview'}
                title={routeOverviewMode ? 'Back to Turn-by-Turn' : 'Route Overview'}
              >
                <RouteIcon className="w-4 h-4" />
              </button>
            </>
          )}
          {onToggleMapLayers && (
            <button
              type="button"
              onClick={onToggleMapLayers}
              className={`w-11 h-11 rounded-full shadow-lg border flex items-center justify-center active:scale-95 transition-all ${
                showTrafficLayer || showUKZones
                  ? 'bg-white dark:bg-[#1E2028] border-[#276EF1]/35 text-[#276EF1]'
                  : 'bg-white dark:bg-[#1E2028] border-black/5 dark:border-white/10 text-black dark:text-white'
              }`}
              aria-label="Toggle UK traffic and ULEZ layers"
              title="UK Traffic & ULEZ Layers"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}
          {(Math.abs(zoom - defaultZoom) > 0.08 || hasManualPan) && (
            <button
              type="button"
              onClick={() => {
                setZoom(defaultZoom);
                setPan({ x: 0, y: 0 });
              }}
              className="px-2 py-1 rounded-full bg-black/85 dark:bg-[#276EF1] text-white text-[10px] font-bold tabular-nums shadow-md hover:bg-black active:scale-95 transition-all whitespace-nowrap"
              aria-label="Re-center map"
              title="Re-center & reset zoom"
            >
              {hasManualPan ? 'Re-center' : `${zoom.toFixed(1)}×`}
            </button>
          )}
        </div>
      )}

      {/* Transformable Whole-UK Map World (supports 3D Heading-Up Chase Cam during Nav) */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `perspective(950px) rotateX(${isNav3DActive ? 24 : 0}deg) translate3d(${pan.x}px, ${
            pan.y + (isNav3DActive ? 54 : 0)
          }px, 0) scale(${zoom})`,
          transition: isPanning
            ? 'none'
            : 'transform 340ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          className="relative w-[1000px] h-[1000px] shrink-0"
          style={{
            transformOrigin: '500px 500px',
            transform: `rotate(${mapRotationDeg}deg)`,
            transition: isNavigatingActive
              ? 'none'
              : 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          <div
            className="relative w-[1000px] h-[1000px]"
            style={{
              transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
              transition: isNavigatingActive
                ? 'none'
                : 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Whole UK Vector Map in Uber Vector Style */}
            <svg
              viewBox="0 0 1000 1000"
              className="w-full h-full block"
              xmlns="http://www.w3.org/2000/svg"
            >
            <defs>
              <radialGradient id="seaDepth" cx="52%" cy="55%" r="60%">
                <stop offset="0%" stopColor={nightMode ? '#0F1F2E' : '#C6DFF4'} />
                <stop offset="100%" stopColor={nightMode ? '#08111B' : '#A9CAE7'} />
              </radialGradient>
              <radialGradient id="surgeHigh" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#D91B5C" stopOpacity="0.46" />
                <stop offset="50%" stopColor="#EE4B2B" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#FF8800" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="surgeMed" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#A020F0" stopOpacity="0.34" />
                <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="surgeLow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Surrounding Seas */}
            <rect width="1000" height="1000" fill="url(#seaDepth)" />

            {/* Subtle Coastal Shelf Glow */}
            <path
              d={UK_SVG_PATHS.greatBritain}
              fill="none"
              stroke={nightMode ? '#142A3E' : '#D4E7F7'}
              strokeWidth="12"
              strokeLinejoin="round"
              opacity="0.65"
            />

            {/* Neighboring Landmasses */}
            <path
              d={UK_SVG_PATHS.irelandMuted}
              fill={nightMode ? '#10151C' : '#DFE3E7'}
              stroke={nightMode ? '#1B232E' : '#CFD5DC'}
              strokeWidth="1.5"
            />
            <path
              d={UK_SVG_PATHS.franceMuted}
              fill={nightMode ? '#10151C' : '#DFE3E7'}
              stroke={nightMode ? '#1B232E' : '#CFD5DC'}
              strokeWidth="1.5"
            />

            {/* Great Britain, Northern Ireland & UK Islands */}
            {[
              UK_SVG_PATHS.greatBritain,
              UK_SVG_PATHS.northernIreland,
              UK_SVG_PATHS.isleOfWight,
              UK_SVG_PATHS.isleOfMan,
              UK_SVG_PATHS.anglesey,
              UK_SVG_PATHS.skye,
            ].map((d, idx) => (
              <path
                key={`land-${idx}`}
                d={d}
                fill={nightMode ? '#151D26' : '#ECEFF2'}
                stroke={nightMode ? '#243140' : '#CFD7E0'}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            ))}

            {/* UK National Parks & Green Belts */}
            <g fill={nightMode ? '#13271D' : '#CFE6D2'} opacity="0.92">
              {UK_SVG_PATHS.parks.map((pk, idx) => (
                <ellipse
                  key={`park-${idx}`}
                  cx={pk.x}
                  cy={pk.y}
                  rx={pk.rx}
                  ry={pk.ry}
                />
              ))}
            </g>

            {/* Urban City Shading */}
            <g fill={nightMode ? '#1B2430' : '#E0E4E9'} opacity="0.8">
              {UK_SVG_PATHS.urbanAreas.map((u, idx) => (
                <ellipse key={`urban-${idx}`} cx={u.x} cy={u.y} rx={u.rx} ry={u.ry} />
              ))}
            </g>

            {/* Major UK Rivers (Thames, Severn, Trent, Clyde, Tyne) */}
            <g
              fill="none"
              stroke={nightMode ? '#0D2238' : '#B4D1EC'}
              strokeWidth="2.6"
              strokeLinecap="round"
            >
              {UK_SVG_PATHS.rivers.map((d, idx) => (
                <path key={`river-${idx}`} d={d} />
              ))}
            </g>

            {/* Urban City Street Grids around London & Manchester */}
            <g
              stroke={nightMode ? '#24303E' : '#FFFFFF'}
              strokeWidth="1.25"
              opacity={nightMode ? '0.85' : '0.75'}
              fill="none"
            >
              {[-18, -12, -6, 0, 6, 12, 18].map((d) => (
                <React.Fragment key={`lon-grid-${d}`}>
                  <line x1={646 + d} y1={752} x2={646 + d} y2={792} />
                  <line x1={624} y1={772 + d} x2={668} y2={772 + d} />
                  <line x1={523 + d * 0.7} y1={565} x2={523 + d * 0.7} y2={592} />
                  <line x1={510} y1={578 + d * 0.7} x2={536} y2={578 + d * 0.7} />
                </React.Fragment>
              ))}
            </g>

            {/* Primary A-Roads */}
            <g
              stroke={nightMode ? '#1F2B38' : '#F8FAFC'}
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            >
              {UK_SVG_PATHS.primaryARoads.map((d, idx) => (
                <path key={`aroad-${idx}`} d={d} />
              ))}
            </g>

            {/* UK Motorway Network (White/Slate Casing + Motorway Blue Core) */}
            <g
              stroke={nightMode ? '#253445' : '#FFFFFF'}
              strokeWidth="4.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            >
              {UK_SVG_PATHS.motorways.map((d, idx) => (
                <path key={`mw-${idx}`} d={d} />
              ))}
            </g>
            <g
              stroke={nightMode ? '#3C69AD' : '#8DB1E3'}
              strokeWidth="1.6"
              strokeOpacity={nightMode ? '0.85' : '0.75'}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            >
              {UK_SVG_PATHS.motorways.map((d, idx) => (
                <path key={`mwb-${idx}`} d={d} />
              ))}
            </g>

            {/* Live UK Motorway Traffic Segments */}
            {showTrafficLayer &&
              UK_SVG_PATHS.trafficSegments.map((seg, idx) => (
                <path
                  key={`traf-${idx}`}
                  d={seg.d}
                  fill="none"
                  stroke={
                    seg.level === 'heavy'
                      ? '#E11900'
                      : seg.level === 'moderate'
                      ? '#F59E0B'
                      : '#05944F'
                  }
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  opacity="0.85"
                />
              ))}

            {/* London ULEZ & Congestion Charge Zone Rings */}
            {showUKZones && (
              <g>
                <circle
                  cx={UK_SVG_PATHS.londonZones.ulezCenter.x}
                  cy={UK_SVG_PATHS.londonZones.ulezCenter.y}
                  r="19"
                  fill={nightMode ? 'rgba(5,148,79,0.08)' : 'rgba(5,148,79,0.07)'}
                  stroke="#05944F"
                  strokeWidth="1.1"
                  strokeDasharray="3 2"
                />
                <circle
                  cx={UK_SVG_PATHS.londonZones.congestionCenter.x}
                  cy={UK_SVG_PATHS.londonZones.congestionCenter.y}
                  r="8.5"
                  fill={nightMode ? 'rgba(225,25,0,0.12)' : 'rgba(225,25,0,0.09)'}
                  stroke="#E11900"
                  strokeWidth="1.2"
                />
                {zoom >= 1.3 && (
                  <g fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800" fontSize="5">
                    <rect
                      x={UK_SVG_PATHS.londonZones.congestionCenter.x - 7}
                      y={UK_SVG_PATHS.londonZones.congestionCenter.y - 13}
                      width="14"
                      height="7"
                      rx="2"
                      fill="#E11900"
                    />
                    <text
                      x={UK_SVG_PATHS.londonZones.congestionCenter.x}
                      y={UK_SVG_PATHS.londonZones.congestionCenter.y - 8}
                      textAnchor="middle"
                      fill="#FFFFFF"
                    >
                      CC
                    </text>
                  </g>
                )}
              </g>
            )}

            {/* Surge Heatmap Polygons with Subtle Heat Shimmer Pulse */}
            {showSurgeHeatmap &&
              surgeZones.map((zone, idx) => {
                if (zone.kind === 'busy' || zone.kind === 'event') return null;
                const fillId =
                  zone.intensity === 'high'
                    ? 'url(#surgeHigh)'
                    : zone.intensity === 'medium'
                    ? 'url(#surgeMed)'
                    : 'url(#surgeLow)';
                const strokeColor =
                  zone.intensity === 'high'
                    ? '#D91B5C'
                    : zone.intensity === 'medium'
                    ? '#A020F0'
                    : '#F59E0B';
                const outerPoly = buildSurgePolygonPoints(
                  zone.coords.x,
                  zone.coords.y,
                  zone.radius,
                  idx + 1
                );
                const innerPoly = buildSurgePolygonPoints(
                  zone.coords.x,
                  zone.coords.y,
                  zone.radius * 0.56,
                  idx + 4
                );
                const delay = `${(idx * 0.55).toFixed(2)}s`;

                return (
                  <g key={`heat-${zone.id}`} className="pointer-events-none">
                    <polygon
                      points={outerPoly}
                      fill={fillId}
                      className="animate-surge-shimmer"
                      style={{ animationDelay: delay }}
                    />
                    <polygon
                      points={innerPoly}
                      fill={fillId}
                      stroke={strokeColor}
                      strokeOpacity={nightMode ? 0.34 : 0.24}
                      strokeWidth="1.2"
                      strokeLinejoin="round"
                      className="animate-surge-ripple"
                      style={{ animationDelay: delay }}
                    />
                  </g>
                );
              })}

            {/* Busy Soon Predictive Rings */}
            {showBusySoonZones &&
              tripStage === 'idle' &&
              busySoonZones.map((bz) => (
                <g key={`busy-soon-${bz.id}`} className="pointer-events-none">
                  <circle
                    cx={bz.coords.x}
                    cy={bz.coords.y}
                    r={22}
                    fill={nightMode ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.1)'}
                    stroke="#F59E0B"
                    strokeWidth="1.3"
                    strokeDasharray="3.5 3"
                    opacity="0.85"
                  />
                </g>
              ))}

            {/* UK City Labels */}
            <g
              fill={nightMode ? '#9BB0C9' : '#55606C'}
              fontFamily="Plus Jakarta Sans, sans-serif"
              letterSpacing="0.03em"
            >
              {UK_CITIES.map((city) => {
                if (!city.major && zoom < 1.2) return null;
                return (
                  <g key={city.name}>
                    <circle
                      cx={city.coords.x}
                      cy={city.coords.y}
                      r={city.major ? 2.4 : 1.7}
                      fill={nightMode ? '#9BB0C9' : '#55606C'}
                      opacity="0.6"
                    />
                    <text
                      x={city.coords.x + 5}
                      y={city.coords.y + 3}
                      fontSize={city.major ? '8.5' : '6.6'}
                      fontWeight={city.major ? '700' : '600'}
                    >
                      {city.name}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* UK Motorway Shields */}
            <g fontFamily="Plus Jakarta Sans, sans-serif" fontSize="6.2" fontWeight="700">
              {UK_SVG_PATHS.shields.map((s) => (
                <g key={s.label}>
                  <rect
                    x={s.x - 10}
                    y={s.y - 6}
                    width="20"
                    height="11"
                    rx="2.5"
                    fill="#276EF1"
                    stroke={nightMode ? '#151D26' : '#FFFFFF'}
                    strokeWidth="0.9"
                  />
                  <text x={s.x} y={s.y + 1.8} textAnchor="middle" fill="#FFFFFF">
                    {s.label}
                  </text>
                </g>
              ))}
            </g>

            {/* Active Trip / Pending Offer Route Line (faded traveled path + vibrant ahead path) */}
            {routePoints && (
              <g>
                {routePoints.fullPathD && (
                  <path
                    d={routePoints.fullPathD}
                    fill="none"
                    stroke={nightMode ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.16)'}
                    strokeWidth={4.5 * invScale}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}
                <path
                  d={routePoints.pathD}
                  fill="none"
                  stroke={
                    routePoints.isIntercity
                      ? 'rgba(122,28,121,0.3)'
                      : nightMode
                      ? 'rgba(91,155,248,0.28)'
                      : 'rgba(0,0,0,0.18)'
                  }
                  strokeWidth={6.8 * invScale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={routePoints.pathD}
                  fill="none"
                  stroke={
                    routePoints.isIntercity
                      ? '#9333EA'
                      : routePoints.isDropoff
                      ? nightMode
                        ? '#5B9BF8'
                        : '#000000'
                      : '#276EF1'
                  }
                  strokeWidth={3.8 * invScale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {routePoints.stop && (
                  <circle
                    cx={routePoints.stop.x}
                    cy={routePoints.stop.y}
                    r={4.5 * invScale}
                    fill="#F59E0B"
                    stroke="#FFFFFF"
                    strokeWidth={1.6 * invScale}
                  />
                )}
                <circle
                  cx={routePoints.end.x}
                  cy={routePoints.end.y}
                  r={5.8 * invScale}
                  fill={
                    routePoints.isIntercity
                      ? '#9333EA'
                      : routePoints.isDropoff
                      ? '#000000'
                      : '#05944F'
                  }
                  stroke="#FFFFFF"
                  strokeWidth={1.8 * invScale}
                />
              </g>
            )}

            {/* Destination Mode Line */}
            {destination.active && !routePoints && (
              <g>
                <path
                  d={`M ${driverPos.x} ${driverPos.y} L ${destination.coords.x} ${destination.coords.y}`}
                  fill="none"
                  stroke="#276EF1"
                  strokeWidth={2.5 * invScale}
                  strokeDasharray="5 5"
                  strokeLinecap="round"
                />
                <circle
                  cx={destination.coords.x}
                  cy={destination.coords.y}
                  r={5.5 * invScale}
                  fill="#276EF1"
                  stroke="#FFFFFF"
                  strokeWidth={1.8 * invScale}
                />
              </g>
            )}
          </svg>

          {/* UK Airport Badges when zoomed in */}
          {zoom >= 1.25 &&
            UK_AIRPORT_MAP_PINS.map((ap) => (
              <div
                key={ap.code}
                style={{
                  left: `${ap.coords.x}px`,
                  top: `${ap.coords.y}px`,
                  transform: `translate(-50%, -50%) rotate(${counterRotationDeg}deg) scale(${invScale * 0.9})`,
                }}
                className="absolute pointer-events-none px-1.5 py-0.5 rounded bg-black/80 text-white text-[9px] font-bold flex items-center gap-1 shadow-xs"
              >
                <Plane className="w-2.5 h-2.5 text-[#5B9BF8]" />
                <span>{ap.code}</span>
              </div>
            ))}

          {/* Speed & Bus-Lane Camera Pins */}
          {showSpeedCameras &&
            zoom >= 1.3 &&
            UK_SPEED_CAMERAS.map((cam) => (
              <div
                key={cam.id}
                title={`${cam.label} (${cam.limitMph} mph)`}
                style={{
                  left: `${cam.coords.x}px`,
                  top: `${cam.coords.y}px`,
                  transform: `translate(-50%, -50%) rotate(${counterRotationDeg}deg) scale(${invScale * 0.9})`,
                }}
                className="absolute pointer-events-none w-5 h-5 rounded-full bg-white dark:bg-[#1E2028] border-2 border-[#E11900] shadow-sm flex items-center justify-center"
              >
                <Camera className="w-2.5 h-2.5 text-[#E11900]" />
              </div>
            ))}

          {/* Surge & Demand Pills across the UK */}
          {tripStage === 'idle' &&
            surgeZones.map((zone) => {
              const styleMap: Record<SurgeZone['kind'], string> = {
                surge: 'bg-[#7A1C79] text-white shadow-md',
                wait:
                  zone.intensity === 'high'
                    ? 'bg-[#D6223A] text-white shadow-md'
                    : 'bg-[#DE8300] text-white shadow-md',
                busy: 'bg-[#8F9AA6] text-white shadow-sm',
                event: 'bg-[#276EF1] text-white shadow-md',
              };

              return (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => onSelectSurgeZone?.(zone)}
                  style={{
                    left: `${zone.coords.x}px`,
                    top: `${zone.coords.y}px`,
                    transform: `translate(-50%, -50%) rotate(${counterRotationDeg}deg) scale(${invScale})`,
                  }}
                  className={`absolute px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-tight flex items-center gap-1 whitespace-nowrap hover:brightness-110 active:scale-95 transition-all ${styleMap[zone.kind]}`}
                >
                  {zone.kind === 'wait' && (
                    <span className="text-[10px] leading-none">
                      {zone.intensity === 'high' ? '»' : '›'}
                    </span>
                  )}
                  {zone.kind === 'event' && <Flame className="w-3 h-3" />}
                  <span className="tabular-nums">{zone.label}</span>
                </button>
              );
            })}

          {/* Busy Soon Forecast Countdown Chips */}
          {showBusySoonZones &&
            tripStage === 'idle' &&
            !pendingOffer &&
            busySoonZones.map((bz) => (
              <button
                key={`bz-pill-${bz.id}`}
                type="button"
                onClick={() => onSelectBusySoonZone?.(bz)}
                style={{
                  left: `${bz.coords.x}px`,
                  top: `${bz.coords.y - 16 * invScale}px`,
                  transform: `translate(-50%, -100%) rotate(${counterRotationDeg}deg) scale(${invScale * 0.92})`,
                }}
                className="absolute px-2 py-0.5 rounded-full bg-[#FEF3C7] dark:bg-amber-950/90 text-[#92400E] dark:text-amber-200 border border-[#F59E0B]/40 text-[10px] font-bold flex items-center gap-1 shadow-sm whitespace-nowrap hover:scale-105 transition-transform"
                title={`${bz.area}: ${bz.reason} (${bz.expectedBoost})`}
              >
                <Clock className="w-2.5 h-2.5 text-[#D97706] dark:text-amber-300" />
                <span className="tabular-nums">
                  {bz.area.split(' ')[0]} · {bz.minutesUntilBusy}m
                </span>
              </button>
            ))}

          {/* Multi-Stop Floating Badge */}
          {routePoints?.stop && (
            <div
              style={{
                left: `${routePoints.stop.x}px`,
                top: `${routePoints.stop.y - 10 * invScale}px`,
                transform: `translate(-50%, -100%) rotate(${counterRotationDeg}deg) scale(${invScale})`,
              }}
              className="absolute bg-[#F59E0B] text-black text-[10.5px] font-extrabold px-2 py-0.5 rounded-md shadow-md whitespace-nowrap pointer-events-none"
            >
              Stop 1
            </div>
          )}

          {/* Route Endpoint Floating Label */}
          {routePoints && (
            <div
              style={{
                left: `${routePoints.end.x}px`,
                top: `${routePoints.end.y - 12 * invScale}px`,
                transform: `translate(-50%, -100%) rotate(${counterRotationDeg}deg) scale(${invScale})`,
              }}
              className={`absolute text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none ${
                routePoints.isIntercity ? 'bg-[#7A1C79]' : 'bg-black'
              }`}
            >
              {routePoints.pinLabel}
            </div>
          )}

          {/* Placed Map Report Hazard Pins */}
          {mapReports.map((pin) => (
            <div
              key={pin.id}
              title={`${pin.label} (${pin.reportedAt})`}
              style={{
                left: `${pin.coords.x}px`,
                top: `${pin.coords.y}px`,
                transform: `translate(-50%, -50%) rotate(${counterRotationDeg}deg) scale(${invScale})`,
              }}
              className="absolute z-10 flex flex-col items-center"
            >
              {renderReportIcon(pin.category)}
            </div>
          ))}

          {/* Driver Live Location Puck with Directional GPS Navigation Beam */}
          <div
            style={{
              left: `${driverPos.x}px`,
              top: `${driverPos.y}px`,
              transform: `translate(-50%, -50%) scale(${invScale})`,
              transition:
                isNavigatingActive
                  ? 'none'
                  : 'left 450ms linear, top 450ms linear',
            }}
            className="absolute z-20 pointer-events-none"
          >
            {(onlineStatus === 'online' || isLiveGps || blueGpsActive) && tripStage === 'idle' && (
              <div className="absolute -inset-3.5 rounded-full bg-[#276EF1]/25 animate-go-pulse" />
            )}
            <div
              style={{ transform: `rotate(${driverHeading}deg)` }}
              className="relative flex items-center justify-center"
            >
              {/* Forward GPS Field-of-View Cone during active navigation */}
              {isNavigatingActive && (
                <svg
                  width="92"
                  height="92"
                  viewBox="0 0 92 92"
                  className="absolute -top-[48px] left-1/2 -translate-x-1/2 pointer-events-none"
                >
                  <defs>
                    <linearGradient id="navBeamGrad" x1="50%" y1="100%" x2="50%" y2="0%">
                      <stop offset="0%" stopColor="#276EF1" stopOpacity="0.42" />
                      <stop offset="100%" stopColor="#276EF1" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M46 72 L14 8 Q46 0 78 8 Z" fill="url(#navBeamGrad)" />
                </svg>
              )}

              <div
                className={`relative w-10 h-10 rounded-full bg-white dark:bg-[#1E2028] border-[3px] shadow-xl flex items-center justify-center ${
                  isLiveGps || blueGpsActive
                    ? 'border-[#276EF1]'
                    : nightMode
                    ? 'border-white'
                    : 'border-black'
                }`}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3L4.5 19.5L12 16L19.5 19.5L12 3Z"
                    fill={isLiveGps || blueGpsActive ? '#276EF1' : nightMode ? '#FFFFFF' : '#000000'}
                  />
                </svg>
              </div>
            </div>
          </div>

          {/* Near Live UK Location Badge */}
          {tripStage === 'idle' && (
            <div
              style={{
                left: `${driverPos.x}px`,
                top: `${driverPos.y + 22 * invScale}px`,
                transform: `translate(-50%, 0) rotate(${counterRotationDeg}deg) scale(${invScale})`,
              }}
              className="absolute z-10 pointer-events-none text-[10.5px] font-bold text-[#1F2937] dark:text-white bg-white/90 dark:bg-[#181A20]/90 backdrop-blur-xs px-2.5 py-0.5 rounded-full shadow-xs border border-black/10 dark:border-white/15 whitespace-nowrap flex items-center gap-1.5"
            >
              {(isLiveGps || blueGpsActive) && (
                <span className="w-2 h-2 rounded-full bg-[#276EF1] animate-pulse" />
              )}
              <span>
                {isLiveGps
                  ? `Live GPS · ${nearCityLabel}`
                  : blueGpsActive
                  ? `GPS Active · ${nearCityLabel}`
                  : `Near ${nearCityLabel} · UK`}
              </span>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
};
