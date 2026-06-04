'use client';

import { useEffect, useState, useMemo } from 'react';
import { Building2, Search, X, Truck, Database, BarChart3 } from 'lucide-react';
import { fetchSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';

interface FleetMasterRecord {
  id: string;
  plateNumber: string;
  fleetCategory: 'OWNED_FLEET' | 'ATTACHED_FLEET';
  vendor: string;
  subVendor: string;
  vehicleType: string;
  wheeler: string;
  rcNo: string;
  fitnessValidityFrom: string;
  fitnessValidityTo: string;
  insuranceValidityUpto: string;
  pucValidity: string;
  driverName: string;
  driverDL: string;
  dlValidityTill: string;
  driverMobile: string;
}

const FLEET_MASTER_KEY = 'tms_fleet_master';

export default function VendorMasterPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<FleetMasterRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  // Load records from synced storage
  useEffect(() => {
    // 1. Instant local load
    setRecords(readLocalValue<FleetMasterRecord[]>(FLEET_MASTER_KEY, []));

    // 2. Background Database sync
    fetchSyncedValue<FleetMasterRecord[]>(FLEET_MASTER_KEY, []).then((synced) => {
      setRecords(synced);
    });
  }, []);

  // Compute unique vendors with aggregates
  const vendorStats = useMemo(() => {
    const map: Record<string, {
      name: string;
      ownedCount: number;
      attachedCount: number;
      totalCount: number;
      subVendors: Set<string>;
      vehicles: FleetMasterRecord[];
    }> = {};

    records.forEach(r => {
      const vName = r.vendor ? r.vendor.trim() : 'Unknown Vendor';
      if (!map[vName]) {
        map[vName] = {
          name: vName,
          ownedCount: 0,
          attachedCount: 0,
          totalCount: 0,
          subVendors: new Set<string>(),
          vehicles: []
        };
      }
      map[vName].totalCount += 1;
      if (r.fleetCategory === 'OWNED_FLEET') {
        map[vName].ownedCount += 1;
      } else {
        map[vName].attachedCount += 1;
      }
      if (r.subVendor) {
        map[vName].subVendors.add(r.subVendor.trim());
      }
      map[vName].vehicles.push(r);
    });

    return Object.values(map);
  }, [records]);

  // Filter vendors by search query
  const filteredVendors = useMemo(() => {
    return vendorStats.filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Array.from(v.subVendors).some(sv => sv.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [vendorStats, searchQuery]);

  // Metrics cards values
  const totalUniqueVendors = vendorStats.length;
  const easternStevedoresTrucks = useMemo(() => {
    const es = vendorStats.find(v => v.name.toLowerCase().includes('eastern') || v.name.toLowerCase().includes('espl'));
    return es ? es.totalCount : 0;
  }, [vendorStats]);
  
  const mahaveerTrucks = useMemo(() => {
    const mv = vendorStats.find(v => v.name.toLowerCase().includes('mahaveer') || v.name.toLowerCase().includes('mahavir'));
    return mv ? mv.totalCount : 0;
  }, [vendorStats]);

  const activeVendorRecord = useMemo(() => {
    if (!selectedVendor) return null;
    return vendorStats.find(v => v.name === selectedVendor) || null;
  }, [selectedVendor, vendorStats]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Vendor Master</h2>
          <p className="text-xs text-slate-500 mt-1">Cross-vendor master directories and analytical fleet distributions</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Unique Vendors</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{totalUniqueVendors}</span>
            <span className="text-[10px] text-slate-400">active vendor profiles</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Eastern Stevedores Fleet</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-700">{easternStevedoresTrucks}</span>
            <span className="text-[10px] text-blue-500 font-semibold">vehicles registered</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Mahaveer Fleet</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-violet-700">{mahaveerTrucks}</span>
            <span className="text-[10px] text-violet-500 font-semibold">vehicles registered</span>
          </div>
        </div>
      </div>

      {/* Vendors Registry Grid & Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 shrink-0">
            <Building2 className="h-4.5 w-4.5 text-brand-primary" />
            Vendor Master Directories
          </h3>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Vendor or Sub-Vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px] bg-slate-50/20">
                <th className="px-6 py-4 whitespace-nowrap">SL.</th>
                <th className="px-6 py-4 whitespace-nowrap">Vendor Name</th>
                <th className="px-6 py-4 whitespace-nowrap">Total Fleet Count</th>
                <th className="px-6 py-4 whitespace-nowrap">Owned Vehicles</th>
                <th className="px-6 py-4 whitespace-nowrap">Attached Vehicles</th>
                <th className="px-6 py-4">Associated Sub-Vendors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredVendors.map((vendor, idx) => (
                <tr 
                  key={vendor.name} 
                  onClick={() => setSelectedVendor(vendor.name)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap font-mono font-semibold text-slate-400">{idx + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">{vendor.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {vendor.totalCount} Trucks
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">{vendor.ownedCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-violet-600">{vendor.attachedCount}</td>
                  <td className="px-6 py-4 text-slate-500 max-w-md truncate">
                    {Array.from(vendor.subVendors).join(', ') || '—'}
                  </td>
                </tr>
              ))}
              {filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-semibold">
                    No vendor directory records match search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Slide-Over Drawer */}
      {activeVendorRecord && (
        <div className="fixed inset-0 z-[150] flex justify-end bg-black/30 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-3xl h-full shadow-2xl flex flex-col animate-slide-left border-l border-slate-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <Building2 className="h-4.5 w-4.5 text-brand-primary" />
                  {activeVendorRecord.name} Profile
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">
                  Associated registered fleet: {activeVendorRecord.totalCount} vehicles
                </p>
              </div>
              <button 
                onClick={() => setSelectedVendor(null)} 
                className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Profile breakdown */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Company Owned</span>
                  <span className="text-xl font-extrabold text-blue-600 block mt-1">{activeVendorRecord.ownedCount}</span>
                </div>
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Market Attached</span>
                  <span className="text-xl font-extrabold text-violet-600 block mt-1">{activeVendorRecord.attachedCount}</span>
                </div>
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Sub-Vendors</span>
                  <span className="text-xl font-extrabold text-slate-700 block mt-1">{activeVendorRecord.subVendors.size}</span>
                </div>
              </div>

              {/* Sub-Vendors list */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Registered Sub-vendors</h4>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(activeVendorRecord.subVendors).map(sv => (
                    <span key={sv} className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600">
                      {sv}
                    </span>
                  )) || <span className="text-xs text-slate-400 italic">No sub-vendors mapped.</span>}
                </div>
              </div>

              {/* Mapped Vehicles */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Vehicle Distribution</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        <th className="px-4 py-2.5">SL.</th>
                        <th className="px-4 py-2.5">Vehicle Plate</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5">Wheeler</th>
                        <th className="px-4 py-2.5">Driver Partner</th>
                        <th className="px-4 py-2.5">Mobile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150 text-slate-600">
                      {activeVendorRecord.vehicles.map((truck, idx) => (
                        <tr key={truck.id} className="hover:bg-slate-50/50">
                          <td className="px-4 py-2.5 font-bold text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-bold font-mono text-slate-800">{truck.plateNumber}</td>
                          <td className="px-4 py-2.5">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${
                              truck.fleetCategory === 'OWNED_FLEET' ? 'bg-blue-100 text-blue-700' : 'bg-violet-100 text-violet-700'
                            }`}>
                              {truck.fleetCategory === 'OWNED_FLEET' ? 'OWNED' : 'ATTACHED'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">{truck.vehicleType}</td>
                          <td className="px-4 py-2.5">{truck.wheeler}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-700">{truck.driverName || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500">{truck.driverMobile || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
