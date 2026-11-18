import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Car,
  Construction,
  Flame,
  GitMerge,
  MinusCircle,
  ShieldAlert,
} from 'lucide-react';
import {
  Coordinates,
  DestinationConfig,
  DriverOnlineStatus,
  MapReportPin,
  SurgeZone,
  TripOffer,
  TripStage,
} from '../types/driver';
import { nearestUKCity, UK_CITIES, UK_SVG_PATHS } from '../utils/ukGeo';

interface UberMapProps {
  driverPos: Coordinates;
  driverHeading: number;
  onlineStatus: DriverOnlineStatus;
  tripStage: TripStage;
  activeTrip: TripOffer | null;
  pendingOffer: TripOffer | null;
  routePolyline?: Coordinates[];
  surgeZones: SurgeZone[];
  mapReports: MapReportPin[];
  destination: DestinationConfig;
  showSurgeHeatmap: boolean;
  recenterSignal: number;
  isLiveGps?: boolean;
  nightMode?: boolean;
  compact?: boolean;
  onSelectSurgeZone?: (zone: SurgeZone) => void;
}

export const UberMap: React.FC<UberMapProps> = ({
  driverPos,
  driverHeading,
  onlineStatus,
  tripStage,
  activeTrip,
  pendingOffer,
  routePolyline,
  surgeZones,
  mapReports,
  destination,
  showSurgeHeatmap,
  recenterSignal,
  isLiveGps = false,
  nightMode = false,
  compact = false,
  onSelectSurgeZone,
}) => {
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(compact ? 0.9 : 1.05);
  const [isPanning, setIsPanning] = useState(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastPinchDistRef = useRef<number | null>(null);
  const lastRecenterRef = useRef(recenterSignal);

  const clampZoom = (value: number) =>
    Math.max(0.65, Math.min(4.2, Number(value.toFixed(2))));

  const clampPan = (x: number, y: number, currentZoom: number) => {
    const limit = Math.round(420 * Math.max(1, currentZoom));
    return {
      x: Math.max(-limit, Math.min(limit, x)),
      y: Math.max(-limit, Math.min(limit, y)),
    };
  };

  // Reset pan smoothly when recenter is triggered
  if (lastRecenterRef.current !== recenterSignal) {
    lastRecenterRef.current = recenterSignal;
    if (pan.x !== 0 || pan.y !== 0) {
      setPan({ x: 0, y: 0 });
    }
    setZoom(tripStage !== 'idle' ? 2.1 : 1.05);
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

    const isDropoff = tripStage === 'enroute' || tripStage === 'dropoff_arrived';
    const endCoord = isDropoff ? trip.dropoffCoords : trip.pickupCoords;
    const pinLabel = isDropoff ? 'Dropoff' : `Pickup ${trip.riderName}`;

    if (routePolyline && routePolyline.length >= 2) {
      const dPath = [driverPos, ...routePolyline.slice(1)]
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');
      return {
        start: driverPos,
        end: routePolyline[routePolyline.length - 1] ?? endCoord,
        pathD: dPath,
        pinLabel,
        isDropoff,
      };
    }

    const midX = (driverPos.x + endCoord.x) / 2 + (isDropoff ? 6 : -4);
    const midY = (driverPos.y + endCoord.y) / 2 - (isDropoff ? 5 : 0);
    return {
      start: driverPos,
      end: endCoord,
      pathD: `M ${driverPos.x} ${driverPos.y} Q ${midX} ${midY} ${endCoord.x} ${endCoord.y}`,
      pinLabel,
      isDropoff,
    };
  }, [activeTrip, pendingOffer, tripStage, driverPos, routePolyline]);

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

  // Focus camera smoothly; when zoomed out (<= 1.2), keep whole UK nicely framed
  const cameraFollowWeight = zoom > 1.3 ? 0.85 : 0.22;
  const offsetX = (500 - driverPos.x) * cameraFollowWeight;
  const offsetY = (500 - driverPos.y) * cameraFollowWeight;

  const defaultZoom = tripStage !== 'idle' ? 2.1 : 1.05;
  const nearCityLabel = useMemo(() => nearestUKCity(driverPos), [driverPos]);

  // Inverse scale factor for UI overlays so surge pills & puck stay crisp at any UK zoom level
  const invScale = Math.max(0.45, Math.min(1.15, 1 / Math.sqrt(zoom)));

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      className={`relative w-full h-full overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing transition-colors duration-300 ${
        nightMode ? 'bg-[#0B1520]' : 'bg-[#B9D5EE]'
      }`}
    >
      {/* Zoom In / Zoom Out Controls (Clear of Top Search Icon) */}
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
          {Math.abs(zoom - defaultZoom) > 0.08 && (
            <button
              type="button"
              onClick={() => {
                setZoom(defaultZoom);
                setPan({ x: 0, y: 0 });
              }}
              className="px-2 py-1 rounded-full bg-black/85 dark:bg-[#276EF1] text-white text-[10px] font-bold tabular-nums shadow-md hover:bg-black active:scale-95 transition-all"
              aria-label="Reset map zoom"
              title="Reset zoom"
            >
              {zoom.toFixed(1)}×
            </button>
          )}
        </div>
      )}

      {/* Transformable Whole-UK Map World */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
          transition: isPanning ? 'none' : 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          className="relative w-[1000px] h-[1000px] shrink-0"
          style={{
            transform: `translate3d(${offsetX}px, ${offsetY}px, 0)`,
            transition:
              tripStage === 'pickup' || tripStage === 'enroute'
                ? 'none'
                : 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Whole UK Vector Map in Identical Uber Vector Style */}
          <svg
            viewBox="0 0 1000 1000"
            className="w-full h-full block"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
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

            {/* Surrounding Seas (North Sea, Irish Sea, English Channel, Atlantic) */}
            <rect width="1000" height="1000" fill={nightMode ? '#0B1520' : '#B9D5EE'} />

            {/* Neighboring Landmasses (Muted Republic of Ireland & Northern France) */}
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

            {/* Great Britain & Northern Ireland Main Landmass */}
            <path
              d={UK_SVG_PATHS.greatBritain}
              fill={nightMode ? '#151D26' : '#E9ECEF'}
              stroke={nightMode ? '#222E3C' : '#D5DCE4'}
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d={UK_SVG_PATHS.northernIreland}
              fill={nightMode ? '#151D26' : '#E9ECEF'}
              stroke={nightMode ? '#222E3C' : '#D5DCE4'}
              strokeWidth="2"
              strokeLinejoin="round"
            />

            {/* UK National Parks & Green Belts */}
            <g fill={nightMode ? '#13271D' : '#CDE5D0'} opacity="0.9">
              {UK_SVG_PATHS.parks.map((pk, idx) => (
                <ellipse
                  key={`park-${idx}`}
                  cx={pk.cx}
                  cy={pk.cy}
                  rx={pk.rx}
                  ry={pk.ry}
                />
              ))}
            </g>

            {/* River Thames */}
            <path
              d={UK_SVG_PATHS.thames}
              fill="none"
              stroke={nightMode ? '#0D2238' : '#B9D5EE'}
              strokeWidth="3.5"
              strokeLinecap="round"
            />

            {/* Urban City Street Grids around London, Manchester & Birmingham when zoomed in */}
            <g
              stroke={nightMode ? '#222D3A' : '#FFFFFF'}
              strokeWidth="1.4"
              opacity={nightMode ? '0.85' : '0.7'}
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

            {/* UK Motorway Network (White/Slate Roads + Subtle Motorway Blue Core) */}
            <g
              stroke={nightMode ? '#243242' : '#FFFFFF'}
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
              stroke={nightMode ? '#3C69AD' : '#92B4E3'}
              strokeWidth="1.6"
              strokeOpacity={nightMode ? '0.85' : '0.7'}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            >
              {UK_SVG_PATHS.motorways.map((d, idx) => (
                <path key={`mwb-${idx}`} d={d} />
              ))}
            </g>

            {/* Surge Heatmap Blobs */}
            {showSurgeHeatmap &&
              surgeZones.map((zone) => {
                if (zone.kind === 'busy' || zone.kind === 'event') return null;
                const fillId =
                  zone.intensity === 'high'
                    ? 'url(#surgeHigh)'
                    : zone.intensity === 'medium'
                    ? 'url(#surgeMed)'
                    : 'url(#surgeLow)';
                return (
                  <circle
                    key={`heat-${zone.id}`}
                    cx={zone.coords.x}
                    cy={zone.coords.y}
                    r={zone.radius}
                    fill={fillId}
                  />
                );
              })}

            {/* UK City Labels */}
            <g
              fill={nightMode ? '#8EA0B5' : '#5F6872'}
              fontFamily="Plus Jakarta Sans, sans-serif"
              letterSpacing="0.03em"
            >
              {UK_CITIES.map((city) => {
                if (!city.major && zoom < 1.25) return null;
                return (
                  <g key={city.name}>
                    <circle
                      cx={city.coords.x}
                      cy={city.coords.y}
                      r={city.major ? 2.4 : 1.7}
                      fill={nightMode ? '#8EA0B5' : '#5F6872'}
                      opacity="0.55"
                    />
                    <text
                      x={city.coords.x + 5}
                      y={city.coords.y + 3}
                      fontSize={city.major ? '8.5' : '6.8'}
                      fontWeight={city.major ? '700' : '600'}
                    >
                      {city.name}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* UK Motorway Shields */}
            <g fontFamily="Plus Jakarta Sans, sans-serif" fontSize="6.5" fontWeight="700">
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

            {/* Active Trip / Pending Offer Route Line (Road-Snapped Polyline) */}
            {routePoints && (
              <g>
                <path
                  d={routePoints.pathD}
                  fill="none"
                  stroke={nightMode ? 'rgba(91,155,248,0.28)' : 'rgba(0,0,0,0.18)'}
                  strokeWidth={6.5 * invScale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={routePoints.pathD}
                  fill="none"
                  stroke={
                    routePoints.isDropoff
                      ? nightMode
                        ? '#5B9BF8'
                        : '#000000'
                      : '#276EF1'
                  }
                  strokeWidth={3.6 * invScale}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={routePoints.end.x}
                  cy={routePoints.end.y}
                  r={5.5 * invScale}
                  fill={routePoints.isDropoff ? '#000000' : '#05944F'}
                  stroke="#FFFFFF"
                  strokeWidth={1.8 * invScale}
                />
              </g>
            )}

            {/* Destination Mode Line if active */}
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
                    transform: `translate(-50%, -50%) scale(${invScale})`,
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

          {/* Route Endpoint Floating Label */}
          {routePoints && (
            <div
              style={{
                left: `${routePoints.end.x}px`,
                top: `${routePoints.end.y - 12 * invScale}px`,
                transform: `translate(-50%, -100%) scale(${invScale})`,
              }}
              className="absolute bg-black text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-lg whitespace-nowrap pointer-events-none"
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
                transform: `translate(-50%, -50%) scale(${invScale})`,
              }}
              className="absolute z-10 flex flex-col items-center"
            >
              {renderReportIcon(pin.category)}
            </div>
          ))}

          {/* Driver Live Location Puck */}
          <div
            style={{
              left: `${driverPos.x}px`,
              top: `${driverPos.y}px`,
              transform: `translate(-50%, -50%) scale(${invScale})`,
              transition:
                tripStage === 'pickup' || tripStage === 'enroute'
                  ? 'none'
                  : 'left 450ms linear, top 450ms linear',
            }}
            className="absolute z-20 pointer-events-none"
          >
            {(onlineStatus === 'online' || isLiveGps) && tripStage === 'idle' && (
              <div className="absolute -inset-3.5 rounded-full bg-[#276EF1]/25 animate-go-pulse" />
            )}
            <div
              style={{ transform: `rotate(${driverHeading}deg)` }}
              className={`w-10 h-10 rounded-full bg-white dark:bg-[#1E2028] border-[3px] shadow-lg flex items-center justify-center ${
                isLiveGps
                  ? 'border-[#276EF1]'
                  : nightMode
                  ? 'border-white'
                  : 'border-black'
              }`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3L4.5 19.5L12 16L19.5 19.5L12 3Z"
                  fill={isLiveGps ? '#276EF1' : nightMode ? '#FFFFFF' : '#000000'}
                />
              </svg>
            </div>
          </div>

          {/* Near Live UK Location Badge */}
          {tripStage === 'idle' && (
            <div
              style={{
                left: `${driverPos.x}px`,
                top: `${driverPos.y + 22 * invScale}px`,
                transform: `translate(-50%, 0) scale(${invScale})`,
              }}
              className="absolute z-10 pointer-events-none text-[10.5px] font-bold text-[#1F2937] dark:text-white bg-white/90 dark:bg-[#181A20]/90 backdrop-blur-xs px-2.5 py-0.5 rounded-full shadow-xs border border-black/10 dark:border-white/15 whitespace-nowrap flex items-center gap-1.5"
            >
              {isLiveGps && (
                <span className="w-2 h-2 rounded-full bg-[#276EF1] animate-pulse" />
              )}
              <span>
                {isLiveGps ? `Live GPS · ${nearCityLabel}` : `Near ${nearCityLabel} · UK`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
