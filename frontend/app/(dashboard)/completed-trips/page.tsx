'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  PackageCheck, 
  Search, 
  X, 
  RefreshCw, 
  Scale,
  Trash2
} from 'lucide-react';
import { fetchSyncedValue, readLocalValue, saveSyncedValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import { 
  LOADING_RECORDS_KEY, 
  isMatchingDestination 
} from '@/lib/workflowAutomation';
import { getOperationalStatusClasses, getOperationalStatusLabel } from '@/lib/operationalStatus';

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

export default function CompletedTripsPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<LoadingRecord[]>([]);
  const [assignedTrips, setAssignedTrips] = useState<Trip[]>([]);
  const [fleetMaster, setFleetMaster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const isAdmin = user?.role === 'SUPER_ADMIN' || 
                  user?.role === 'SYS_ADMIN' || 
                  user?.role === 'REGION_ADMIN' || 
                  user?.role === 'PARAMANANDPUR_ADMIN' || 
                  user?.role === 'DHARAMGARH_ADMIN' || 
                  user?.role === 'BHAWANIPATNA_ADMIN';
  const canDelete = isAdmin;

  const persistRecords = (nextRecords: LoadingRecord[]) => {
    saveSyncedValue(LOADING_RECORDS_KEY, nextRecords);
  };

  const deleteRecords = (idsToDelete: string[]) => {
    const nextRecords = records.filter(r => !idsToDelete.includes(r.id));
    setRecords(nextRecords);
    persistRecords(nextRecords);
    setSelectedIds(prev => prev.filter(id => !idsToDelete.includes(id)));
  };

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
      const localFleet = readLocalValue<any[]>('tms_fleet_master', []);
      setRecords(localRecords);
      setAssignedTrips(localTrips);
      setFleetMaster(localFleet);

      // Sync from DB
      const syncedRecords = await fetchSyncedValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []);
      const syncedTrips = await fetchSyncedValue<Trip[]>('tms_assigned_trips', []);
      const syncedFleet = await fetchSyncedValue<any[]>('tms_fleet_master', []);
      setRecords(syncedRecords);
      setAssignedTrips(syncedTrips);
      setFleetMaster(syncedFleet);
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

  // 2. Filter for completed trips (truck running status is RECEIVED)
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

  const completedRecords = useMemo(() => {
    return records.filter(record => {
      // Filter for unloaded/received status representing a completed trip
      const isCompleted = record.truckStatus === 'RECEIVED' || record.unloadingTruckStatus === 'RECEIVED' || !!record.unloadingDateTime;
      if (!isCompleted) return false;

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
    return completedRecords.filter(record => {
      const cleanSearch = vehicleSearch.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const cleanPlate = record.truckPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const matchesVehicle = !cleanSearch || cleanPlate.includes(cleanSearch);
      
      const matchesChallan = !challanSearch || record.challanNo.toUpperCase().includes(challanSearch.toUpperCase());
      
      return matchesVehicle && matchesChallan;
    });
  }, [completedRecords, vehicleSearch, challanSearch]);

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
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Completed Trips Summary</h2>
          <p className="text-xs text-slate-500 mt-1">Audit complete transit parameters, turnaround cycles, and received quantities for all completed trips</p>
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
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Completed Trips</span>
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
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <PackageCheck className="h-4.5 w-4.5 text-brand-primary" /> Registry Entries ({filteredRecords.length})
          </h3>
          {canDelete && (
            <div className="flex items-center gap-2 shrink-0">
              {isDeleteMode ? (
                <>
                  {selectedIds.length > 0 && (
                    <button
                      onClick={() => {
                        deleteRecords(selectedIds);
                        setIsDeleteMode(false);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors shadow-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Selected ({selectedIds.length})
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsDeleteMode(false);
                      setSelectedIds([]);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsDeleteMode(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  Select to Delete
                </button>
              )}
            </div>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                {isDeleteMode && (
                  <th className="w-10 px-5 py-4">
                    <input
                      type="checkbox"
                      checked={filteredRecords.length > 0 && filteredRecords.every(r => selectedIds.includes(r.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSelections = [...selectedIds];
                          filteredRecords.forEach(r => {
                            if (!newSelections.includes(r.id)) {
                              newSelections.push(r.id);
                            }
                          });
                          setSelectedIds(newSelections);
                        } else {
                          setSelectedIds(selectedIds.filter(id => !filteredRecords.some(r => r.id === id)));
                        }
                      }}
                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">Vehicle No</th>
                <th className="px-5 py-4">PO</th>
                <th className="px-5 py-4">Challan No</th>
                <th className="px-5 py-4">Ticket No</th>
                <th className="px-5 py-4">Date of Received</th>
                <th className="px-5 py-4">Running Status</th>
                <th className="px-5 py-4">Vendor</th>
                <th className="px-5 py-4">Sub Vendor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isDeleteMode ? 10 : 9} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    {loading ? (
                      <span className="flex items-center justify-center gap-2 text-slate-400">
                        <Scale className="h-4 w-4 animate-spin text-brand-primary" /> Synchronizing data logs...
                      </span>
                    ) : (
                      'No matching completed trip records found.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, idx) => {
                  const matchedTrip = assignedTrips.find(
                    t => t.tripNumber === record.tripNumber || t.id === record.tripId
                  );

                  const matchedTruck = fleetMaster.find(
                    t => t.plateNumber?.toUpperCase().replace(/[^A-Z0-9]/g, '') === record.truckPlate.toUpperCase().replace(/[^A-Z0-9]/g, '')
                  );
                  const subVendor = matchedTruck?.subVendor || '—';

                  return (
                    <tr key={record.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(record.id) ? 'bg-blue-50/20' : ''}`}>
                      {isDeleteMode && (
                        <td className="px-5 py-4">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(record.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds([...selectedIds, record.id]);
                              } else {
                                setSelectedIds(selectedIds.filter(id => id !== record.id));
                              }
                            }}
                            className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5 cursor-pointer"
                          />
                        </td>
                      )}
                      <td className="px-5 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                      <td className="px-5 py-4 font-mono font-extrabold text-slate-800 uppercase tracking-wider">
                        {record.truckPlate}
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-700">
                        {matchedTrip?.purchaseOrder?.poNumber || '—'}
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-700">
                        {record.challanNo}
                      </td>
                      <td className="px-5 py-4 font-mono font-semibold text-slate-600">
                        {record.ticketNo}
                      </td>
                      <td className="px-5 py-4">
                        {record.unloadingDateTime ? (
                          <div className="font-semibold text-slate-700">
                            {new Date(record.unloadingDateTime).toLocaleString('en-IN', { 
                              timeZone: 'Asia/Kolkata', 
                              hour12: true, 
                              dateStyle: 'medium', 
                              timeStyle: 'short' 
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${getOperationalStatusClasses(record.unloadingTruckStatus || record.truckStatus || 'RECEIVED')}`}>
                          {getOperationalStatusLabel(record.unloadingTruckStatus || record.truckStatus || 'RECEIVED')}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {matchedTrip?.vendorName || '—'}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {subVendor}
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
