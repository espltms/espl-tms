'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  PackageCheck, 
  Search, 
  X, 
  Truck, 
  Calendar, 
  User, 
  Clock, 
  TrendingDown, 
  RefreshCw, 
  Scale, 
  FileText,
  MapPin,
  HelpCircle
} from 'lucide-react';
import { fetchSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import { 
  LOADING_RECORDS_KEY, 
  isMatchingDestination 
} from '@/lib/workflowAutomation';

interface LoadingRecord {
  id: string;
  tripId?: string;
  tripNumber?: string;
  truckId: string;
  truckPlate: string;
  tareWeight: number;
  grossWeight: number;
  netWeight: number;
  loadingDateTime: string;
  ticketNo: string;
  challanNo: string;
  uom: string;
  truckStatus: string;
  receivedQty?: number;
  unloadingDateTime?: string;
  turnaroundMinutes?: number;
  unloadingTruckStatus?: string;
}

interface Trip {
  id: string;
  tripNumber: string;
  source: string;
  destination: string;
  distanceKm: number;
  estimatedQuantityTons: number | string;
  vendorName?: string;
  vehicleType?: string;
  driver: { fullName: string; phone: string };
  truck: { plateNumber: string; model: string };
  purchaseOrder: { poNumber: string; clientName: string; commodity: string };
}

export default function UnloadedTripsPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<LoadingRecord[]>([]);
  const [assignedTrips, setAssignedTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  // Search states
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [challanSearch, setChallanSearch] = useState('');

  // 1. Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch local values first
      const localRecords = readLocalValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []);
      const localTrips = readLocalValue<Trip[]>('tms_assigned_trips', []);
      setRecords(localRecords);
      setAssignedTrips(localTrips);

      // Sync from DB
      const syncedRecords = await fetchSyncedValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []);
      const syncedTrips = await fetchSyncedValue<Trip[]>('tms_assigned_trips', []);
      setRecords(syncedRecords);
      setAssignedTrips(syncedTrips);
    } catch (e) {
      console.error("Error loading registry details:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatTurnaround = (minutes?: number) => {
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return '—';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours <= 0) return `${remainingMinutes}m`;
    return `${hours}h ${remainingMinutes}m`;
  };

  // 2. Filter for unloaded trucks (running status is RECEIVED / unloaded)
  const isRegionalUser = user?.role === 'REGION_ADMIN' || 
                         user?.role === 'DISPATCHER' || 
                         user?.role === 'PARAMANANDPUR_ADMIN' || 
                         user?.role === 'DHARAMGARH_ADMIN' ||
                         user?.role === 'BHAWANIPATNA_ADMIN' ||
                         user?.role === 'PARAMANANDPUR_UNLOADER' ||
                         user?.role === 'DHARAMGARH_UNLOADER';

  const userRegion = user?.role === 'PARAMANANDPUR_ADMIN' || user?.role === 'PARAMANANDPUR_UNLOADER'
    ? 'Paramanandpur' 
    : user?.role === 'DHARAMGARH_ADMIN' || user?.role === 'DHARAMGARH_UNLOADER'
      ? 'Dharamgarh' 
      : user?.role === 'BHAWANIPATNA_ADMIN'
        ? 'Bhawanipatna'
        : user?.regionName;

  const unloadedRecords = useMemo(() => {
    return records.filter(record => {
      // Filter for unloaded status
      const isUnloaded = record.truckStatus === 'RECEIVED' || record.unloadingTruckStatus === 'RECEIVED' || !!record.unloadingDateTime;
      if (!isUnloaded) return false;

      // Filter by region if regional admin
      if (isRegionalUser && userRegion) {
        const trip = assignedTrips.find(t => t.tripNumber === record.tripNumber || t.id === record.tripId);
        if (trip) {
          return isMatchingDestination(trip.destination, userRegion);
        }
      }
      return true;
    });
  }, [records, assignedTrips, isRegionalUser, userRegion]);

  // 3. Apply vehicle and challan searches
  const filteredRecords = useMemo(() => {
    return unloadedRecords.filter(record => {
      const cleanSearch = vehicleSearch.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanPlate = record.truckPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const matchesVehicle = !cleanSearch || cleanPlate.includes(cleanSearch);
      
      const matchesChallan = !challanSearch || record.challanNo.toUpperCase().includes(challanSearch.toUpperCase());
      
      return matchesVehicle && matchesChallan;
    });
  }, [unloadedRecords, vehicleSearch, challanSearch]);

  // 4. Aggregates calculation
  const stats = useMemo(() => {
    const totalCount = filteredRecords.length;
    
    const totalLoaded = filteredRecords.reduce((acc, r) => acc + r.netWeight, 0);
    const totalReceived = filteredRecords.reduce((acc, r) => acc + (r.receivedQty || r.netWeight), 0);
    
    // Total leakage
    const totalLoss = filteredRecords.reduce((acc, r) => {
      const diff = r.receivedQty ? Math.max(0, r.netWeight - r.receivedQty) : 0;
      return acc + diff;
    }, 0);

    // Turnaround times
    const turnarounds = filteredRecords
      .map(r => r.turnaroundMinutes)
      .filter((t): t is number => typeof t === 'number' && t > 0);
    const avgTurnaround = turnarounds.length > 0
      ? Math.round(turnarounds.reduce((sum, t) => sum + t, 0) / turnarounds.length)
      : 0;

    return {
      totalCount,
      totalLoaded,
      totalReceived,
      totalLoss,
      avgTurnaround
    };
  }, [filteredRecords]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Title & Refresh Button */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Unloaded Trips Summary</h2>
          <p className="text-xs text-slate-500 mt-1">Audit complete transit parameters, turnaround cycles, and received quantities for all unloaded vehicles</p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm disabled:opacity-60 shrink-0 self-start md:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh Records'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Unloaded Vehicles</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalCount}</span>
            <span className="text-[10px] text-slate-400">fully received</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Loaded Quantity</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalLoaded.toFixed(2)}</span>
            <span className="text-[10px] text-slate-400">Metric Tons</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Received Quantity</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">{stats.totalReceived.toFixed(2)}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">{stats.totalLoss > 0 ? `-${stats.totalLoss.toFixed(2)} loss` : '0 loss'}</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Turnaround Cycle</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-brand-primary">{formatTurnaround(stats.avgTurnaround)}</span>
            <span className="text-[10px] text-slate-400">per complete trip</span>
          </div>
        </div>
      </div>

      {/* Advanced Search Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search & Filter Registries</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 max-w-2xl">
          {/* Vehicle Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={vehicleSearch}
              onChange={(e) => setVehicleSearch(e.target.value)}
              placeholder="Search by Vehicle No (e.g. OD-08)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-9 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary/50 transition-colors uppercase font-mono font-semibold"
            />
            {vehicleSearch && (
              <button 
                onClick={() => setVehicleSearch('')}
                className="absolute right-3 top-3.5 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Challan Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={challanSearch}
              onChange={(e) => setChallanSearch(e.target.value)}
              placeholder="Search by Challan No (e.g. PA0001)"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-9 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary/50 transition-colors uppercase font-mono font-semibold"
            />
            {challanSearch && (
              <button 
                onClick={() => setChallanSearch('')}
                className="absolute right-3 top-3.5 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <PackageCheck className="h-4.5 w-4.5 text-brand-primary" /> Registry Entries ({filteredRecords.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">Vehicle</th>
                <th className="px-5 py-4">References</th>
                <th className="px-5 py-4">Transit Details</th>
                <th className="px-5 py-4">Corporate Client</th>
                <th className="px-5 py-4">weighment metrics</th>
                <th className="px-5 py-4">Turnaround cycle</th>
                <th className="px-5 py-4 text-right">Filing DateTime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2 text-slate-400">
                        <Scale className="h-4 w-4 animate-spin text-brand-primary" /> Synchronizing data logs...
                      </span>
                    ) : (
                      'No matching unloaded trip records found.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, idx) => {
                  const matchedTrip = assignedTrips.find(
                    t => t.tripNumber === record.tripNumber || t.id === record.tripId
                  );

                  const loadedQty = record.netWeight;
                  const receivedQty = record.receivedQty ?? loadedQty;
                  const weightLoss = Math.max(0, loadedQty - receivedQty);

                  return (
                    <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4 text-slate-400 shrink-0" />
                          <div>
                            <div className="font-mono font-extrabold text-slate-800 leading-none">{record.truckPlate}</div>
                            {matchedTrip?.truck?.model && (
                              <div className="text-[10px] text-slate-400 mt-1">{matchedTrip.truck.model}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3 text-slate-400" />
                          <span className="font-semibold text-slate-500">Challan:</span>
                          <span className="font-mono font-bold text-slate-700">{record.challanNo}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <span>Ticket:</span>
                          <span className="font-mono font-semibold">{record.ticketNo}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 space-y-1">
                        <div className="flex items-center gap-1 text-slate-700 font-semibold">
                          <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>{matchedTrip?.source || 'Lanjigarh'}</span>
                          <span className="text-slate-400">→</span>
                          <span>{matchedTrip?.destination || 'Stockyard'}</span>
                        </div>
                        {matchedTrip?.vendorName && (
                          <div className="text-[9px] font-bold text-brand-secondary bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 w-fit uppercase font-sans">
                            {matchedTrip.vendorName}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {matchedTrip ? (
                          <div>
                            <div className="font-bold text-slate-800 leading-none">{matchedTrip.purchaseOrder.clientName}</div>
                            <div className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">{matchedTrip.purchaseOrder.commodity}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="text-slate-500">Loaded:</div>
                          <div className="font-mono font-bold text-slate-700">{loadedQty.toFixed(2)} {record.uom}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-slate-500">Received:</div>
                          <div className="font-mono font-extrabold text-emerald-700">{receivedQty.toFixed(2)} {record.uom}</div>
                        </div>
                        {weightLoss > 0 && (
                          <div className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5 w-fit flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" /> Leakage: {weightLoss.toFixed(2)} {record.uom}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-700">{formatTurnaround(record.turnaroundMinutes)}</span>
                        </div>
                        <div className="text-[9px] text-slate-400 mt-0.5 uppercase font-semibold">Unloaded turnaround</div>
                      </td>
                      <td className="px-5 py-4 text-right">
                        {record.unloadingDateTime ? (
                          <div className="space-y-1">
                            <div className="font-mono font-bold text-slate-700 leading-none">
                              {new Date(record.unloadingDateTime).toLocaleString('en-IN', { 
                                timeZone: 'Asia/Kolkata', 
                                hour12: true, 
                                dateStyle: 'medium', 
                                timeStyle: 'short' 
                              })}
                            </div>
                            <div className="text-[9px] text-slate-400 uppercase font-semibold">Unloaded timestamp</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Pending</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
