'use client';

import { useEffect, useState, useMemo } from 'react';
import { ShieldCheck, Search, X, Truck, Database, UserCheck } from 'lucide-react';
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

export default function SubVendorMasterPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<FleetMasterRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubVendor, setSelectedSubVendor] = useState<string | null>(null);

  // Load records from synced storage
  useEffect(() => {
    // 1. Instant local load
    setRecords(readLocalValue<FleetMasterRecord[]>(FLEET_MASTER_KEY, []));

    // 2. Background Database sync
    fetchSyncedValue<FleetMasterRecord[]>(FLEET_MASTER_KEY, []).then((synced) => {
      setRecords(synced);
    });
  }, []);

  // Compute unique sub-vendors with aggregates
  const subVendorStats = useMemo(() => {
    const map: Record<string, {
      name: string;
      parentVendors: Set<string>;
      totalCount: number;
      vehicleTypes: Set<string>;
      vehicles: FleetMasterRecord[];
    }> = {};

    records.forEach(r => {
      const svName = r.subVendor ? r.subVendor.trim() : 'Unknown Sub-Vendor';
      if (!map[svName]) {
        map[svName] = {
          name: svName,
          parentVendors: new Set<string>(),
          totalCount: 0,
          vehicleTypes: new Set<string>(),
          vehicles: []
        };
      }
      map[svName].totalCount += 1;
      if (r.vendor) {
        map[svName].parentVendors.add(r.vendor.trim());
      }
      if (r.vehicleType) {
        map[svName].vehicleTypes.add(r.vehicleType.trim());
      }
      map[svName].vehicles.push(r);
    });

    return Object.values(map);
  }, [records]);

  // Filter sub-vendors by search query
  const filteredSubVendors = useMemo(() => {
    return subVendorStats.filter(sv => 
      sv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Array.from(sv.parentVendors).some(v => v.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [subVendorStats, searchQuery]);

  // Metrics cards values
  const totalUniqueSubVendors = subVendorStats.length;
  
  const topSubVendor = useMemo(() => {
    if (subVendorStats.length === 0) return { name: '—', totalCount: 0 };
    return subVendorStats.reduce((max, current) => current.totalCount > max.totalCount ? current : max, subVendorStats[0]);
  }, [subVendorStats]);

  const totalMarketVehicles = useMemo(() => {
    return records.filter(r => r.fleetCategory === 'ATTACHED_FLEET').length;
  }, [records]);

  const activeSubVendorRecord = useMemo(() => {
    if (!selectedSubVendor) return null;
    return subVendorStats.find(sv => sv.name === selectedSubVendor) || null;
  }, [selectedSubVendor, subVendorStats]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Sub-Vendor Master</h2>
          <p className="text-xs text-slate-500 mt-1">Registry directory for vehicle owners and subcontracted sub-vendors</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Sub-Vendors</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{totalUniqueSubVendors}</span>
            <span className="text-[10px] text-slate-400">owners/partners registered</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Attached Market Vehicles</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-700">{totalMarketVehicles}</span>
            <span className="text-[10px] text-blue-500 font-semibold">commercial attached fleet</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Top Sub-Vendor</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-violet-700">{topSubVendor.name}</span>
            <span className="text-[10px] text-violet-500 font-semibold">({topSubVendor.totalCount} Trucks)</span>
          </div>
        </div>
      </div>

      {/* Sub-Vendors Registry Grid & Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 shrink-0">
            <ShieldCheck className="h-4.5 w-4.5 text-brand-primary" />
            Sub-Vendor Registry Directory
          </h3>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search Sub-Vendor or Parent Vendor..."
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
                <th className="px-6 py-4 whitespace-nowrap">Sub-Vendor Name</th>
                <th className="px-6 py-4 whitespace-nowrap">Parent Vendor Companies</th>
                <th className="px-6 py-4 whitespace-nowrap">Registered Fleet Size</th>
                <th className="px-6 py-4">Vehicle Distributions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredSubVendors.map((subVendor, idx) => (
                <tr 
                  key={subVendor.name} 
                  onClick={() => setSelectedSubVendor(subVendor.name)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap font-mono font-semibold text-slate-400">{idx + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">{subVendor.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">
                    {Array.from(subVendor.parentVendors).join(', ') || '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-700">
                      {subVendor.totalCount} Trucks
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {Array.from(subVendor.vehicleTypes).join(', ') || '—'}
                  </td>
                </tr>
              ))}
              {filteredSubVendors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-semibold">
                    No sub-vendor directory records match search query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Slide-Over Drawer */}
      {activeSubVendorRecord && (
        <div className="fixed inset-0 z-[150] flex justify-end bg-black/30 backdrop-blur-xs animate-fade-in">
          <div className="bg-white w-full max-w-3xl h-full shadow-2xl flex flex-col animate-slide-left border-l border-slate-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-brand-primary" />
                  Sub-Vendor: {activeSubVendorRecord.name}
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">
                  Registry records count: {activeSubVendorRecord.totalCount} trucks
                </p>
              </div>
              <button 
                onClick={() => setSelectedSubVendor(null)} 
                className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Profile breakdown */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Associated Parent Vendors</span>
                  <span className="text-sm font-extrabold text-slate-800 block mt-2">
                    {Array.from(activeSubVendorRecord.parentVendors).join(', ') || 'None'}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Unique Vehicle Models</span>
                  <span className="text-sm font-extrabold text-slate-800 block mt-2">
                    {Array.from(activeSubVendorRecord.vehicleTypes).join(', ') || 'None'}
                  </span>
                </div>
              </div>

              {/* Mapped Vehicles */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Vehicle Master Listing</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        <th className="px-4 py-2.5">SL.</th>
                        <th className="px-4 py-2.5">Vehicle Plate</th>
                        <th className="px-4 py-2.5">Category</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5">Wheeler</th>
                        <th className="px-4 py-2.5">Parent Vendor</th>
                        <th className="px-4 py-2.5">Driver Name</th>
                        <th className="px-4 py-2.5">Mobile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-155 text-slate-600">
                      {activeSubVendorRecord.vehicles.map((truck, idx) => (
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
                          <td className="px-4 py-2.5 text-slate-500 font-medium">{truck.vendor || '—'}</td>
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
