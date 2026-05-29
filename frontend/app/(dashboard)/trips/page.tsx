'use client';

import { useState, useEffect } from 'react';
import { 
  Truck, 
  MapPin, 
  User, 
  FileText, 
  Plus, 
  QrCode, 
  AlertTriangle, 
  X, 
  Calendar,
  CheckCircle,
  FileCheck2,
  Trash2
} from 'lucide-react';

interface PurchaseOrder {
  id: string;
  poNumber: string;
  clientName: string;
  commodity: string;
  totalQuantityTons: number;
  allocatedQuantityTons: number;
  ratePerTon: number;
  status: string;
}

interface Trip {
  id: string;
  tripNumber: string;
  truckId?: string;
  driverId?: string;
  source: string;
  destination: string;
  distanceKm: number;
  estimatedQuantityTons: number | string;
  actualLoadedTons?: number | string;
  actualDeliveredTons?: number | string;
  status: string;
  scheduledStartDate: string;
  vendorName?: string;
  vehicleType?: string;
  driver: { fullName: string; phone: string };
  truck: { plateNumber: string; model: string };
  purchaseOrder: { poNumber: string; clientName: string; commodity: string };
}

import { getTrips, getPurchaseOrders, getDrivers, getTrucks } from '@/app/data/dataHelper';
import { fetchSyncedValue, saveSyncedValue } from '@/lib/syncedStorage';
import { getOperationalStatusClasses, getOperationalStatusLabel, OPERATIONAL_STATUS_OPTIONS, OperationalStatus } from '@/lib/operationalStatus';

const VEHICLE_TYPES = ['Tipper', 'Dalla', 'Tanker', 'Flatbed', 'Container Carrier', 'Bulker'];
const COMMODITIES = ['Fly Ash', 'Coal', 'FMCG', 'Other'];
const VENDOR_OPTIONS = ['Vendor 1', 'Vendor 2', 'Vendor 3'];
const ASSIGNED_TRIPS_KEY = 'tms_assigned_trips';

type ImportedSheet = {
  id: string;
  fileName: string;
  importedAt: string;
  headers: string[];
  rows: string[][];
};

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const parseNumberCell = (value: string) => {
  const parsed = Number(String(value || '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};
const parseImportedDate = (value: string) => {
  const parsed = value === '-' ? new Date() : new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};
const normalizeImportedStatus = (value: string): OperationalStatus => {
  const normalized = value.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.includes('complete')) return 'COMPLETED';
  if (normalized.includes('receive')) return 'RECEIVED';
  if (normalized.includes('action') || normalized.includes('issue')) return 'ACTION';
  if (normalized.includes('transit') || normalized.includes('route')) return 'IN_TRANSIT';
  return 'SCHEDULED';
};

export default function TripsPage() {
  const [loading, setLoading] = useState(false);
  const [trips, setTrips] = useState<Trip[]>(() => getTrips());
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => getPurchaseOrders());
  const [drivers, setDrivers] = useState(() => getDrivers());
  const [trucks, setTrucks] = useState(() => getTrucks());

  const [modalOpen, setModalOpen] = useState(false);
  const [poId, setPoId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [truckId, setTruckId] = useState('');
  const [source, setSource] = useState('Vedanta Lanjigarh Plant');
  const [destination, setDestination] = useState('Paramanandpur Stockyard');
  const [vendorName, setVendorName] = useState(VENDOR_OPTIONS[0]);
  const [vehicleType, setVehicleType] = useState('Tipper');
  const [commodity, setCommodity] = useState('Fly Ash');
  const [tripStatus, setTripStatus] = useState<OperationalStatus>('SCHEDULED');
  const [estimatedQuantity, setEstimatedQuantity] = useState('40.00');
  const [distance, setDistance] = useState('120');
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [activeGatepass, setActiveGatepass] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const deleteTrips = (tripIds: string[]) => {
    const nextTrips = trips.filter(t => !tripIds.includes(t.id));
    setTrips(nextTrips);
    
    if (typeof window !== 'undefined') {
      const existing = JSON.parse(window.localStorage.getItem(ASSIGNED_TRIPS_KEY) || '[]') as Trip[];
      const nextSynced = existing.filter(t => !tripIds.includes(t.id));
      saveSyncedValue(ASSIGNED_TRIPS_KEY, nextSynced);
    }
    
    setSelectedIds(prev => prev.filter(id => !tripIds.includes(id)));
  };
  const ITEMS_PER_PAGE = 15;

  const totalPages = Math.ceil(trips.length / ITEMS_PER_PAGE);
  const paginatedTrips = trips.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    fetchSyncedValue<Trip[]>(ASSIGNED_TRIPS_KEY, []).then((syncedTrips) => {
      setTrips((currentTrips) => [
        ...syncedTrips,
        ...currentTrips.filter(trip => !syncedTrips.some(syncedTrip => syncedTrip.id === trip.id)),
      ]);
    });
  }, []);

  useEffect(() => {
    const getCellValue = (headers: string[], row: string[], aliases: string[]) => {
      const normalizedAliases = aliases.map(normalizeHeader);
      const index = headers.findIndex(header => normalizedAliases.includes(normalizeHeader(header)));
      const value = index >= 0 ? row[index] : '';
      return value && String(value).trim() ? String(value).trim() : '-';
    };

    const handleExcelImport = (event: Event) => {
      const detail = (event as CustomEvent<{ sectionName: string; import: ImportedSheet }>).detail;
      if (!detail || detail.sectionName !== 'Trip Dispatch & POs') return;

      const importedTrips = detail.import.rows.map((row, index): Trip => {
        const tripNumber = getCellValue(detail.import.headers, row, ['trip number', 'trip no', 'trip id', 'trip']);
        const poNumber = getCellValue(detail.import.headers, row, ['po number', 'po no', 'purchase order', 'purchase order contract', 'contract']);
        const clientName = getCellValue(detail.import.headers, row, ['client', 'client name', 'customer', 'company']);
        const commodityValue = getCellValue(detail.import.headers, row, ['commodity', 'commodities', 'material', 'cargo']);
        const driverName = getCellValue(detail.import.headers, row, ['driver', 'driver name', 'driver partner']);
        const driverPhone = getCellValue(detail.import.headers, row, ['driver phone', 'driver mobile', 'mobile', 'phone']);
        const truckPlate = getCellValue(detail.import.headers, row, ['truck', 'truck plate', 'vehicle', 'vehicle no', 'vehicle number', 'plate number', 'no plate']);
        const truckModel = getCellValue(detail.import.headers, row, ['truck model', 'model', 'vehicle model']);
        const sourceValue = getCellValue(detail.import.headers, row, ['source', 'origin', 'loading', 'loading point', 'source loading']);
        const destinationValue = getCellValue(detail.import.headers, row, ['destination', 'unloading', 'unloading point', 'destination unloading']);
        const vendorValue = getCellValue(detail.import.headers, row, ['vendor', 'vendor name']);
        const vehicleTypeValue = getCellValue(detail.import.headers, row, ['vehicle type', 'truck type', 'type']);
        const statusValue = getCellValue(detail.import.headers, row, ['status', 'trip status']);
        const qtyValue = getCellValue(detail.import.headers, row, ['estimated weight', 'estimated quantity', 'estimated tons', 'tons', 'quantity', 'qty', 'weight']);
        const loadedValue = getCellValue(detail.import.headers, row, ['loaded', 'loaded tons', 'actual loaded']);
        const distanceValue = getCellValue(detail.import.headers, row, ['distance', 'distance km', 'km']);
        const dateValue = getCellValue(detail.import.headers, row, ['date', 'scheduled date', 'start date', 'trip date']);

        return {
          id: `trip-import-${Date.now()}-${index}`,
          tripNumber: tripNumber === '-' ? `TRIP-IMP-${Date.now()}-${index + 1}` : tripNumber,
          truckId: truckPlate === '-' ? '-' : `import-truck-${truckPlate}`,
          driverId: driverName === '-' ? '-' : `import-driver-${driverName}-${index}`,
          source: sourceValue,
          destination: destinationValue,
          vendorName: vendorValue,
          vehicleType: vehicleTypeValue,
          distanceKm: parseNumberCell(distanceValue),
          estimatedQuantityTons: parseNumberCell(qtyValue),
          actualLoadedTons: loadedValue === '-' ? undefined : parseNumberCell(loadedValue),
          status: normalizeImportedStatus(statusValue),
          scheduledStartDate: parseImportedDate(dateValue),
          driver: { fullName: driverName, phone: driverPhone },
          truck: { plateNumber: truckPlate, model: truckModel },
          purchaseOrder: {
            poNumber,
            clientName,
            commodity: commodityValue,
          },
        };
      });

      if (importedTrips.length === 0) return;
      setTrips(prev => [
        ...importedTrips,
        ...prev.filter(trip => !importedTrips.some(importedTrip => importedTrip.tripNumber === trip.tripNumber)),
      ]);
      const existing = JSON.parse(window.localStorage.getItem(ASSIGNED_TRIPS_KEY) || '[]') as Trip[];
      saveSyncedValue(ASSIGNED_TRIPS_KEY, [
        ...importedTrips,
        ...existing.filter(trip => !importedTrips.some(importedTrip => importedTrip.tripNumber === trip.tripNumber)),
      ]);
      setCurrentPage(1);
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, []);

  const fetchTripsData = async () => {
    // Static offline data from helper is used
    setLoading(false);
  };

  const applyTruckSelection = (selectedTruck: typeof trucks[number]) => {
    setTruckId(selectedTruck.id);
    setVehicleType(selectedTruck.type || 'Tipper');
    if (selectedTruck.vendor) {
      setVendorName(prev => prev || selectedTruck.vendor || '');
    }
  };

  const findTruckForDriver = (selectedDriverId: string) => {
    const selectedDriver = drivers.find(driver => driver.id === selectedDriverId);
    if (!selectedDriver) return undefined;

    return trucks.find(truck => truck.id === selectedDriver.assignedTruckId)
      || trucks.find(truck => truck.plateNumber === selectedDriver.assignedTruckPlate)
      || trucks.find(truck => truck.assignedDriverId === selectedDriver.id)
      || trucks.find(truck => truck.assignedDriverName === selectedDriver.fullName)
      || (() => {
        const matchingTrip = trips.find(trip =>
          trip.driverId === selectedDriver.id || trip.driver.fullName === selectedDriver.fullName
        );
        return matchingTrip
          ? trucks.find(truck =>
              truck.id === matchingTrip.truckId || truck.plateNumber === matchingTrip.truck.plateNumber
            )
          : undefined;
      })();
  };

  const findDriverForTruck = (selectedTruckId: string) => {
    const selectedTruck = trucks.find(truck => truck.id === selectedTruckId);
    if (!selectedTruck) return undefined;

    return drivers.find(driver => driver.id === selectedTruck.assignedDriverId)
      || drivers.find(driver => driver.fullName === selectedTruck.assignedDriverName)
      || drivers.find(driver => driver.assignedTruckId === selectedTruck.id)
      || drivers.find(driver => driver.assignedTruckPlate === selectedTruck.plateNumber)
      || (() => {
        const matchingTrip = trips.find(trip =>
          trip.truckId === selectedTruck.id || trip.truck.plateNumber === selectedTruck.plateNumber
        );
        return matchingTrip
          ? drivers.find(driver =>
              driver.id === matchingTrip.driverId || driver.fullName === matchingTrip.driver.fullName
            )
          : undefined;
      })();
  };

  const handleDriverSelection = (selectedDriverId: string) => {
    setDriverId(selectedDriverId);
    const pairedTruck = findTruckForDriver(selectedDriverId);
    if (pairedTruck) {
      applyTruckSelection(pairedTruck);
    }
  };

  const handleTruckSelection = (selectedTruckId: string) => {
    setTruckId(selectedTruckId);
    const selectedTruck = trucks.find(truck => truck.id === selectedTruckId);
    if (!selectedTruck) return;

    applyTruckSelection(selectedTruck);
    const pairedDriver = findDriverForTruck(selectedTruckId);
    if (pairedDriver) {
      setDriverId(pairedDriver.id);
    }
  };

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const targetPO = purchaseOrders.find(po => po.id === poId);
    if (!targetPO) {
      setError('Select a valid Purchase Order');
      return;
    }

    const requestedQty = Number(estimatedQuantity);
    const poRemaining = Number(targetPO.totalQuantityTons) - Number(targetPO.allocatedQuantityTons);
    const selectedDriver = drivers.find(d => d.id === driverId);
    const selectedTruck = trucks.find(t => t.id === truckId);

    if (requestedQty > poRemaining) {
      setError(`PO Allocation limit exceeded. PO has only ${poRemaining.toFixed(2)} remaining tons. Requested: ${requestedQty} tons.`);
      return;
    }

    if (!selectedDriver || !selectedTruck) {
      setError('Select a valid driver and truck from the imported dataset');
      return;
    }

    const tripNumber = `TRIP-${10000 + trips.length + 1}`;
    const newTrip: Trip = {
      id: `trip-local-${Date.now()}`,
      tripNumber,
      truckId,
      driverId,
      source,
      destination,
      vendorName,
      vehicleType,
      distanceKm: Number(distance),
      estimatedQuantityTons: requestedQty,
      status: tripStatus,
      scheduledStartDate: new Date().toISOString(),
      driver: { fullName: selectedDriver.fullName, phone: selectedDriver.phone },
      truck: { plateNumber: selectedTruck.plateNumber, model: selectedTruck.model },
      purchaseOrder: {
        poNumber: targetPO.poNumber,
        clientName: targetPO.clientName,
        commodity,
      },
    };

    const persistAssignedTrip = (trip: Trip) => {
      if (typeof window === 'undefined') return;
      const existing = JSON.parse(window.localStorage.getItem(ASSIGNED_TRIPS_KEY) || '[]') as Trip[];
      saveSyncedValue(ASSIGNED_TRIPS_KEY, [trip, ...existing.filter(item => item.id !== trip.id)]);
    };

    const payload = {
      tripNumber,
      purchaseOrderId: poId,
      poNumber: targetPO.poNumber,
      driverId,
      driverName: selectedDriver.fullName,
      driverPhone: selectedDriver.phone,
      truckId,
      truckPlate: selectedTruck.plateNumber,
      source,
      destination,
      vendorName,
      vehicleType,
      commodity,
      status: tripStatus,
      distanceKm: Number(distance),
      estimatedQuantityTons: requestedQty,
      scheduledStartDate: new Date().toISOString(),
    };

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('tms_token');
      const response = await fetch(`${apiUrl}/api/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'API failed to assign trip');
      }

      setTrips(prev => [newTrip, ...prev]);
      persistAssignedTrip(newTrip);
      setPurchaseOrders(prev =>
        prev.map(po =>
          po.id === poId
            ? { ...po, allocatedQuantityTons: Number(po.allocatedQuantityTons) + requestedQty }
            : po
        )
      );
      fetchTripsData();
      setModalOpen(false);
    } catch (err: any) {
      setTrips(prev => [newTrip, ...prev]);
      persistAssignedTrip(newTrip);

      setPurchaseOrders(prev =>
        prev.map(po =>
          po.id === poId
            ? { ...po, allocatedQuantityTons: Number(po.allocatedQuantityTons) + requestedQty }
            : po
        )
      );

      setModalOpen(false);
    }
  };

  const getGatepassToken = (trip: Trip) => {
    setActiveGatepass({
      gatepassNumber: `GP-OUT-${trip.tripNumber.split('-')[1]}`,
      tripNumber: trip.tripNumber,
      clientName: trip.purchaseOrder.clientName,
      commodity: trip.purchaseOrder.commodity,
      driverName: trip.driver.fullName,
      plateNumber: trip.truck.plateNumber,
      tareWeight: '15.30 Tons',
      grossWeight: `${(15.30 + Number(trip.estimatedQuantityTons || 0)).toFixed(2)} Tons (Est)`,
      issuedAt: new Date().toLocaleDateString(),
    });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Freight Dispatch Board</h2>
          <p className="text-xs text-slate-500 mt-1">Assign vehicle routes under active client contract ceilings (India Network)</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-4 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-glass-glow"
        >
          <Plus className="h-4.5 w-4.5" /> Assign New Trip Dispatch
        </button>
      </div>

      {/* PO Progress */}
      <div className="glass-panel rounded-2xl border border-brand-slate p-6">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
          <FileCheck2 className="h-4.5 w-4.5 text-brand-primary" />
          <span>Active Purchase Orders Cap Allocation</span>
        </h3>
        
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {purchaseOrders.map(po => {
            const usagePercentage = (Number(po.allocatedQuantityTons) / Number(po.totalQuantityTons)) * 100;
            return (
              <div key={po.id} className="rounded-xl bg-white border border-[#e2e8f0] p-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold text-brand-secondary font-mono tracking-wider">{po.poNumber}</span>
                      <div className="text-xs font-bold text-slate-800 mt-1 truncate">{po.clientName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{po.commodity}</div>
                    </div>
                    <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[9px] font-bold text-brand-primary">
                      {formatCurrency(po.ratePerTon)} / Ton
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] text-slate-500 font-semibold mb-1">
                      <span>Allocated: {Number(po.allocatedQuantityTons).toLocaleString()} Tons</span>
                      <span>Total: {Number(po.totalQuantityTons).toLocaleString()} Tons</span>
                    </div>
                    <div className="h-2 w-full bg-[#e2e8f0] rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-primary to-blue-500 transition-all duration-500" 
                        style={{ width: `${usagePercentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dispatched Table */}
      <div className="glass-panel rounded-2xl border border-brand-slate overflow-hidden">
        <div className="border-b border-[#e2e8f0] bg-white/60 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active Trip dispatches</h3>
          {selectedIds.length > 0 && (
            <button
              onClick={() => deleteTrips(selectedIds)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected ({selectedIds.length})
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                <th className="w-10 px-6 py-4">
                  <input
                    type="checkbox"
                    checked={paginatedTrips.length > 0 && paginatedTrips.every(t => selectedIds.includes(t.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newSelections = [...selectedIds];
                        paginatedTrips.forEach(t => {
                          if (!newSelections.includes(t.id)) {
                            newSelections.push(t.id);
                          }
                        });
                        setSelectedIds(newSelections);
                      } else {
                        setSelectedIds(selectedIds.filter(id => !paginatedTrips.some(t => t.id === id)));
                      }
                    }}
                    className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5 cursor-pointer"
                  />
                </th>
                <th className="px-6 py-4">Trip details</th>
                <th className="px-6 py-4">Contracts Reference</th>
                <th className="px-6 py-4">Assigned Crew</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Tonnages</th>
                <th className="px-6 py-4">Trip Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] text-slate-600">
              {paginatedTrips.map(trip => (
                <tr key={trip.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(trip.id) ? 'bg-blue-50/20' : ''}`}>
                  <td className="w-10 px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(trip.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds([...selectedIds, trip.id]);
                        } else {
                          setSelectedIds(selectedIds.filter(id => id !== trip.id));
                        }
                      }}
                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5 cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <span className="font-bold text-slate-800 font-mono">{trip.tripNumber}</span>
                      <div className="text-[10px] text-slate-400 mt-1">{trip.source} → {trip.destination}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <span className="text-slate-800 font-semibold">{trip.purchaseOrder.poNumber}</span>
                      <div className="text-[10px] text-brand-primary mt-0.5">{trip.purchaseOrder.clientName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{trip.purchaseOrder.commodity}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span>{trip.driver.fullName}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5">
                        <Truck className="h-3.5 w-3.5 text-slate-400" />
                        <span>{trip.truck.plateNumber}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{trip.vehicleType || trip.truck.model}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-500">{trip.vendorName || '—'}</td>
                  <td className="px-6 py-4">
                    <div>
                      <span>Est: {trip.estimatedQuantityTons} Tons</span>
                      {trip.actualLoadedTons && (
                        <div className="text-[10px] text-slate-500 mt-0.5">Loaded: {trip.actualLoadedTons} Tons</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold ${getOperationalStatusClasses(trip.status)}`}>
                      {getOperationalStatusLabel(trip.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                    <button
                      onClick={() => getGatepassToken(trip)}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-slate bg-white px-2.5 py-1.5 hover:border-brand-primary/30 text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      <QrCode className="h-4 w-4 text-brand-primary" />
                      <span>QR Gatepass</span>
                    </button>
                    <button
                      onClick={() => deleteTrips([trip.id])}
                      className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete Trip"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {paginatedTrips.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-500">No trips found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="border-t border-[#e2e8f0] bg-white px-6 py-4 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-semibold">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, trips.length)} of {trips.length} entries
            </span>
            <div className="flex gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-[#e2e8f0] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Prev
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-[#e2e8f0] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal - Create Trip */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 border border-brand-slate shadow-glass shadow-glass-glow animate-scale-up max-h-[90dvh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-4 mb-4 shrink-0">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Assign Trip Dispatch</h3>
              <button 
                onClick={() => setModalOpen(false)}
                className="rounded-lg hover:bg-slate-100 p-1 text-slate-500 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTrip} className="space-y-4 text-xs overflow-y-auto min-h-0 flex-1 pr-1">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-brand-danger/10 border border-brand-danger/20 p-4 text-brand-danger">
                  <AlertTriangle className="h-4.5 w-4.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Purchase Order Contract</label>
                  <select 
                    required 
                    value={poId}
                    onChange={(e) => setPoId(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-3 px-3 text-slate-800 focus:outline-none focus:border-brand-primary/50"
                  >
                    <option value="">Choose active PO...</option>
                    {purchaseOrders.map(po => (
                      <option key={po.id} value={po.id}>{po.poNumber} ({po.clientName})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Estimated Weight (Tons)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={estimatedQuantity}
                    onChange={(e) => setEstimatedQuantity(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-3 px-3 text-slate-800 focus:outline-none focus:border-brand-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Trip Status</label>
                  <select
                    required
                    value={tripStatus}
                    onChange={(e) => setTripStatus(e.target.value as OperationalStatus)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-3 px-3 text-slate-800 focus:outline-none focus:border-brand-primary/50"
                  >
                    {OPERATIONAL_STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Current Status Preview</label>
                  <div className={`flex min-h-[46px] items-center rounded-xl border px-3 text-xs font-bold ${getOperationalStatusClasses(tripStatus)}`}>
                    {getOperationalStatusLabel(tripStatus)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Driver Partner</label>
                  <select 
                    required 
                    value={driverId}
                    onChange={(e) => handleDriverSelection(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-3 px-3 text-slate-800 focus:outline-none"
                  >
                    <option value="">Choose Driver...</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Truck Vehicle</label>
                  <select 
                    required 
                    value={truckId}
                    onChange={(e) => handleTruckSelection(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-3 px-3 text-slate-800 focus:outline-none"
                  >
                    <option value="">Choose Truck...</option>
                    {trucks.map(t => (
                      <option key={t.id} value={t.id}>{t.plateNumber}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Vendor</label>
                  <select
                    required
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-3 px-3 text-slate-800 focus:outline-none focus:border-brand-primary/50"
                  >
                    {VENDOR_OPTIONS.map(vendor => (
                      <option key={vendor} value={vendor}>{vendor}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Distance (Km)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-3 px-3 text-slate-800 focus:outline-none focus:border-brand-primary/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Vehicle Type</label>
                  <select
                    required
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-3 px-3 text-slate-800 focus:outline-none focus:border-brand-primary/50"
                  >
                    {VEHICLE_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Commodity</label>
                  <select
                    required
                    value={commodity}
                    onChange={(e) => setCommodity(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-3 px-3 text-slate-800 focus:outline-none focus:border-brand-primary/50"
                  >
                    {COMMODITIES.map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Source Loading</label>
                  <input
                    type="text"
                    required
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-3 px-3 text-slate-800 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Destination Unloading</label>
                  <input
                    type="text"
                    required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-white border border-[#d1d5db] rounded-xl py-3 px-3 text-slate-800 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-sm font-semibold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 font-sans font-extrabold"
              >
                Create Assignments & Release Outbound Gatepass
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Gatepass display overlay */}
      {activeGatepass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 border border-brand-slate text-center shadow-glass shadow-glass-glow animate-scale-up relative">
            
            <button 
              onClick={() => setActiveGatepass(null)}
              className="absolute right-4 top-4 rounded-lg hover:bg-slate-100 p-1 text-slate-500 hover:text-slate-900"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-primary/10 text-brand-primary mb-4">
              <QrCode className="h-8 w-8" />
            </div>

            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Digital Gatepass Ticket</h4>
            <p className="text-[10px] text-slate-400 mt-0.5">Scanned at loading terminal gate entry (FASTag enabled)</p>

            <div className="my-6 mx-auto w-40 h-40 bg-white p-3 rounded-2xl flex items-center justify-center shadow-glass relative">
              <div className="w-full h-full bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] flex flex-col justify-between items-center opacity-85">
                <div className="flex w-full justify-between">
                  <div className="w-6 h-6 border-t-4 border-l-4 border-[#09090b]"></div>
                  <div className="w-6 h-6 border-t-4 border-r-4 border-[#09090b]"></div>
                </div>
                <div className="w-14 h-14 bg-gradient-to-tr from-brand-primary to-blue-600 rounded-xl flex items-center justify-center text-white text-[9px] font-extrabold uppercase shadow-lg shadow-brand-primary/30">
                  AeroQR
                </div>
                <div className="flex w-full justify-between">
                  <div className="w-6 h-6 border-b-4 border-l-4 border-[#09090b]"></div>
                  <div className="w-6 h-6 border-b-4 border-r-4 border-[#09090b]"></div>
                </div>
              </div>
            </div>

            <div className="text-left text-xs bg-white border border-[#e2e8f0] rounded-2xl p-4 space-y-2 mb-4 font-sans">
              <div className="flex justify-between">
                <span className="text-slate-400">Pass Number:</span>
                <span className="font-mono font-bold text-brand-primary">{activeGatepass.gatepassNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Trip reference:</span>
                <span className="font-semibold text-slate-800">{activeGatepass.tripNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Driver Partner:</span>
                <span className="text-slate-800 font-semibold">{activeGatepass.driverName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Truck Plate:</span>
                <span className="text-slate-800 font-mono">{activeGatepass.plateNumber}</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-1 text-[10px] text-brand-success font-semibold uppercase tracking-wider">
              <CheckCircle className="h-3.5 w-3.5" /> SECURE DECRYPTED TICKET
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
