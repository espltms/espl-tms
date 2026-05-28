'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  MapPin, 
  Truck, 
  Play, 
  Pause, 
  RotateCcw, 
  Compass, 
  Users, 
  Activity, 
  HelpCircle,
  Radio
} from 'lucide-react';

import { getTrips } from '@/app/data/dataHelper';
import { normalizeOperationalStatus } from '@/lib/operationalStatus';

export default function DispatchMapPage() {
  const [simulationActive, setSimulationActive] = useState(false);
  
  // Find first active trip in the dataset
  const activeTripObj = getTrips().find(t => normalizeOperationalStatus(t.status) === 'IN_TRANSIT') || getTrips()[0];
  
  const [gpsStats, setGpsStats] = useState({
    latitude: 19.7118,
    longitude: 83.3761,
    speedKmh: 0,
    heading: 260,
    tripNumber: activeTripObj?.tripNumber || 'TRIP-NO-ACTIVE',
    distanceCovered: 0,
    etaHours: 3.5
  });

  const [activeFeeds, setActiveFeeds] = useState(() => {
    const rawActive = getTrips().filter(t => normalizeOperationalStatus(t.status) === 'IN_TRANSIT');
    return rawActive.slice(0, 5).map((t, idx) => ({
      id: String(idx + 1),
      tripNumber: t.tripNumber,
      driver: t.driver.fullName,
      plate: t.truck.plateNumber,
      speed: '62 km/h',
      status: 'TRANSMITTING'
    }));
  });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const socketRef = useRef<any>(null);
  const simIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Indian Logistics Odisha corridor: Vedanta Lanjigarh Plant to Paramanandpur / Dharamgarh
  const routePoints = [
    { lat: 19.7118, lng: 83.3761, label: 'Vedanta Lanjigarh Plant (Loading)' },
    { lat: 19.8500, lng: 83.2500, label: 'Bhawanipatna OD' }, 
    { lat: 20.0150, lng: 82.7818, label: 'Dharamgarh Terminal' },
    { lat: 20.1983, lng: 83.4735, label: 'Paramanandpur Stockyard (Unloading)' },
  ];

  const currentRouteIndex = useRef(0);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (!document.getElementById('leaflet-css')) {
      const leafletCss = document.createElement('link');
      leafletCss.id = 'leaflet-css';
      leafletCss.rel = 'stylesheet';
      leafletCss.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      leafletCss.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      leafletCss.crossOrigin = '';
      document.head.appendChild(leafletCss);
    }
    
    if (apiUrl) {
      import('socket.io-client')
        .then(({ io }) => {
          socketRef.current = io(`${apiUrl}/dispatch`, {
            transports: ['websocket'],
          });

          socketRef.current.on('connect', () => {
            console.log('Connected to dispatch websocket stream');
            socketRef.current.emit('joinTrip', { tripId: activeTripObj?.tripNumber || 'TRIP-NO-ACTIVE' });
          });

          socketRef.current.on('locationUpdated', (data: any) => {
            setGpsStats(prev => ({
              ...prev,
              latitude: Number(data.latitude),
              longitude: Number(data.longitude),
              speedKmh: Number(data.speedKmh),
              heading: Number(data.heading),
            }));

            updateMarkerPosition(data.latitude, data.longitude);
          });
        })
        .catch(() => {
          console.warn('Socket connection failed, operating offline local loop.');
        });
    }

    if (typeof window !== 'undefined' && mapContainerRef.current && !mapInstanceRef.current) {
      const L = require('leaflet');
      
      // Center map over Odisha corridor
      const map = L.map(mapContainerRef.current).setView([19.9, 83.1], 8.5);
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      const pathCoordinates = routePoints.map(p => [p.lat, p.lng]);
      L.polyline(pathCoordinates, {
        color: '#38bdf8',
        weight: 3.5,
        dashArray: '6, 9',
        opacity: 0.6
      }).addTo(map);

      // Loading Mine
      L.marker([19.7118, 83.3761]).addTo(map)
        .bindPopup('Vedanta Lanjigarh Plant<br/>Loading Terminal');

      // Unloading Port
      L.marker([20.1983, 83.4735]).addTo(map)
        .bindPopup('Paramanandpur Stockyard<br/>Unloading Weighbridge (OD)');

      const vehicleIcon = L.divIcon({
        className: 'vehicle-glow-marker',
        html: `<div class="relative flex items-center justify-center h-8 w-8 rounded-full border border-brand-primary bg-brand-primary/20 shadow-glass-glow animate-pulse">
                <div class="h-3 w-3 rounded-full bg-brand-primary shadow-lg shadow-brand-primary"></div>
               </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([19.7118, 83.3761], { icon: vehicleIcon }).addTo(map);
      vehicleMarkerRef.current = marker;
      marker.bindPopup(`${activeTripObj?.tripNumber || 'TRIP'}: Active Ash Cargo Transit`);
    }

    return () => {
      if (socketRef.current) socketRef.current.disconnect();
      stopSimulation();
    };
  }, []);

  const updateMarkerPosition = (lat: number, lng: number) => {
    if (vehicleMarkerRef.current && mapInstanceRef.current) {
      vehicleMarkerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.panTo([lat, lng]);
    }
  };

  const startSimulation = () => {
    if (simulationActive) return;
    setSimulationActive(true);

    simIntervalRef.current = setInterval(() => {
      let nextIndex = currentRouteIndex.current + 1;
      if (nextIndex >= routePoints.length) {
        nextIndex = 0;
      }
      
      currentRouteIndex.current = nextIndex;
      const targetPoint = routePoints[nextIndex];
      const speed = 45 + Math.floor(Math.random() * 15); // Local highways speed
      const heading = 240 + Math.floor(Math.random() * 20);

      const payload = {
        tripId: activeTripObj?.tripNumber || 'TRIP-NO-ACTIVE',
        latitude: targetPoint.lat,
        longitude: targetPoint.lng,
        speedKmh: speed,
        heading: heading,
      };

      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit('submitGPSPing', payload);
      } else {
        setGpsStats(prev => ({
          ...prev,
          latitude: targetPoint.lat,
          longitude: targetPoint.lng,
          speedKmh: speed,
          heading: heading,
          distanceCovered: prev.distanceCovered + 40,
          etaHours: Math.max(0.2, prev.etaHours - 0.8)
        }));
        
        updateMarkerPosition(targetPoint.lat, targetPoint.lng);
      }
    }, 4000);
  };

  const stopSimulation = () => {
    setSimulationActive(false);
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
  };

  const resetSimulation = () => {
    stopSimulation();
    currentRouteIndex.current = 0;
    const startPoint = routePoints[0];
    
    setGpsStats({
      latitude: startPoint.lat,
      longitude: startPoint.lng,
      speedKmh: 0,
      heading: 260,
      tripNumber: activeTripObj?.tripNumber || 'TRIP-NO-ACTIVE',
      distanceCovered: 0,
      etaHours: 3.5
    });

    updateMarkerPosition(startPoint.lat, startPoint.lng);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Active Dispatch Control Room</h2>
          <p className="text-xs text-slate-500 mt-1">AIS-140 standard certified real-time telemetry tracking (India Corridor)</p>
        </div>
        
        <div className="flex items-center gap-2 rounded-xl bg-brand-primary/10 border border-brand-primary/20 px-3.5 py-1.5 text-xs text-brand-primary font-semibold">
          <Radio className="h-4 w-4 animate-ping text-brand-primary" />
          <span>Control Tower Online</span>
        </div>
      </div>

      {/* Main Map Split */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        
        <div className="lg:col-span-3 rounded-3xl overflow-hidden border border-brand-slate h-[520px] shadow-glass relative bg-white">
          <div ref={mapContainerRef} className="w-full h-full z-10" />
        </div>

        {/* Real-time Simulator Panel */}
        <div className="space-y-5">
          
          <div className="glass-panel rounded-2xl border border-brand-slate p-5 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-brand-primary" />
              <span>AIS-140 Telemetry</span>
            </h3>

            <div className="text-xs bg-white border border-[#e2e8f0] rounded-xl p-4 space-y-3 font-mono">
              <div className="flex justify-between border-b border-[#e2e8f0] pb-2">
                <span className="text-slate-400">Trip Identifier:</span>
                <span className="text-slate-800 font-bold">{gpsStats.tripNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Latitude:</span>
                <span className="text-brand-primary font-bold">{gpsStats.latitude.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Longitude:</span>
                <span className="text-brand-primary font-bold">{gpsStats.longitude.toFixed(6)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Velocity:</span>
                <span className="text-brand-secondary font-bold">{gpsStats.speedKmh} km/h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Bearing:</span>
                <span className="text-slate-800 font-bold">{gpsStats.heading}°</span>
              </div>
              <div className="flex justify-between border-t border-[#e2e8f0] pt-2">
                <span className="text-slate-400">Corridor:</span>
                <span className="text-brand-success text-[10px] font-bold">Korba → Mundra</span>
              </div>
            </div>

            {/* Simulated actions */}
            <div className="space-y-2.5">
              {!simulationActive ? (
                <button
                  onClick={startSimulation}
                  className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 font-sans font-extrabold"
                >
                  <Play className="h-4 w-4 fill-background" /> Start GPS Corridor Sim
                </button>
              ) : (
                <button
                  onClick={stopSimulation}
                  className="w-full rounded-xl border border-brand-warning/30 bg-brand-warning/10 py-3 text-xs font-bold text-brand-warning hover:bg-brand-warning/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 font-sans font-extrabold"
                >
                  <Pause className="h-4 w-4 fill-brand-warning" /> Pause Simulation
                </button>
              )}

              <button
                onClick={resetSimulation}
                className="w-full rounded-xl border border-[#d1d5db] bg-white py-3 text-xs font-bold text-slate-600 hover:text-slate-900 transition-all flex items-center justify-center gap-1.5 font-sans font-semibold"
              >
                <RotateCcw className="h-4 w-4" /> Reset Corridor Route
              </button>
            </div>
          </div>

          <div className="glass-panel rounded-2xl border border-brand-slate p-5">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <Users className="h-4 w-4 text-brand-primary" />
              <span>Transmitting Terminals</span>
            </h3>

            <div className="space-y-3 text-xs">
              {activeFeeds.map(feed => (
                <div key={feed.id} className="rounded-xl bg-white border border-[#e2e8f0] p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-800 font-mono">{feed.tripNumber}</span>
                    <span className="text-[9px] font-bold text-brand-success bg-brand-success/15 px-1.5 py-0.5 rounded border border-brand-success/20 animate-pulse">
                      {feed.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">{feed.driver} ({feed.plate})</div>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
