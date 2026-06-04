'use client';

import { useEffect, useState, useMemo } from 'react';
import { ShieldCheck, Search, X, Truck, Database, UserCheck, Edit } from 'lucide-react';
import { fetchSyncedValue, readLocalValue, saveSyncedValue } from '@/lib/syncedStorage';
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

interface SubVendorProfile {
  name: string;
  mobile: string;
  gstin: string;
  pan: string;
}

type ImportedSheet = {
  id: string;
  fileName: string;
  importedAt: string;
  headers: string[];
  rows: string[][];
};

const FLEET_MASTER_KEY = 'tms_fleet_master';
const SUBVENDOR_PROFILES_KEY = 'tms_subvendor_profiles';

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function SubVendorMasterPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<FleetMasterRecord[]>([]);
  const [profiles, setProfiles] = useState<SubVendorProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubVendor, setSelectedSubVendor] = useState<string | null>(null);

  // Edit State
  const [editingSubVendor, setEditingSubVendor] = useState<{
    originalName: string;
    name: string;
    mobile: string;
    gstin: string;
    pan: string;
  } | null>(null);

  const canEdit = user?.role === 'SUPER_ADMIN' || 
                  user?.role === 'SYS_ADMIN' || 
                  user?.role === 'REGION_ADMIN' || 
                  user?.role === 'PARAMANANDPUR_ADMIN' || 
                  user?.role === 'DHARAMGARH_ADMIN' || 
                  user?.role === 'BHAWANIPATNA_ADMIN';

  // Load records from synced storage
  useEffect(() => {
    // 1. Instant local load
    setRecords(readLocalValue<FleetMasterRecord[]>(FLEET_MASTER_KEY, []));
    setProfiles(readLocalValue<SubVendorProfile[]>(SUBVENDOR_PROFILES_KEY, []));

    // 2. Background Database sync
    fetchSyncedValue<FleetMasterRecord[]>(FLEET_MASTER_KEY, []).then((synced) => {
      setRecords(synced);
    });
    fetchSyncedValue<SubVendorProfile[]>(SUBVENDOR_PROFILES_KEY, []).then((synced) => {
      setProfiles(synced);
    });
  }, []);

  /* ── Excel import listener ── */
  useEffect(() => {
    const getCellValue = (headers: string[], row: string[], aliases: string[]) => {
      const normalizedAliases = aliases.map(normalizeHeader);
      const index = headers.findIndex(header => normalizedAliases.includes(normalizeHeader(header)));
      const value = index >= 0 ? row[index] : '';
      return value && String(value).trim() ? String(value).trim() : '-';
    };

    const handleExcelImport = (event: Event) => {
      const detail = (event as CustomEvent<{ sectionName: string; import: ImportedSheet }>).detail;
      if (!detail || detail.sectionName !== 'Sub-Vendor Master') return;

      const importedProfiles = detail.import.rows.map((row): SubVendorProfile => {
        const name = getCellValue(detail.import.headers, row, ['sub vendor', 'sub vendor name', 'name', 'owner', 'owner name']).trim();
        const mobile = getCellValue(detail.import.headers, row, ['mobile', 'mobile no', 'mobile number', 'phone', 'contact']);
        const gstin = getCellValue(detail.import.headers, row, ['gstin', 'gstin no', 'gst', 'tax id']);
        const pan = getCellValue(detail.import.headers, row, ['pan', 'pan no', 'pan number']);

        return {
          name: name === '-' ? 'Unknown Sub-Vendor' : name,
          mobile: mobile === '-' ? '' : mobile,
          gstin: gstin === '-' ? '' : gstin,
          pan: pan === '-' ? '' : pan
        };
      }).filter(p => p.name !== 'Unknown Sub-Vendor');

      if (importedProfiles.length === 0) return;

      setProfiles(prev => {
        const next = [...prev];
        importedProfiles.forEach(imp => {
          const idx = next.findIndex(p => p.name.toLowerCase() === imp.name.toLowerCase());
          if (idx >= 0) {
            // Overwrite existing data
            next[idx] = {
              ...next[idx],
              mobile: imp.mobile !== '' ? imp.mobile : next[idx].mobile,
              gstin: imp.gstin !== '' ? imp.gstin : next[idx].gstin,
              pan: imp.pan !== '' ? imp.pan : next[idx].pan,
            };
          } else {
            // Append new profile at the end
            next.push(imp);
          }
        });
        saveSyncedValue(SUBVENDOR_PROFILES_KEY, next);
        return next;
      });
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, []);

  // Compute unique sub-vendors with aggregates
  const subVendorStats = useMemo(() => {
    const map: Record<string, {
      name: string;
      mobile: string;
      gstin: string;
      pan: string;
      parentVendors: Set<string>;
      totalCount: number;
      vehicleTypes: Set<string>;
      vehicles: FleetMasterRecord[];
    }> = {};

    // 1. Initialize from stored profiles to keep order and structure
    profiles.forEach(p => {
      const key = p.name.trim();
      map[key] = {
        name: key,
        mobile: p.mobile || '-',
        gstin: p.gstin || '-',
        pan: p.pan || '-',
        parentVendors: new Set<string>(),
        totalCount: 0,
        vehicleTypes: new Set<string>(),
        vehicles: []
      };
    });

    // 2. Aggregate from fleet master records
    records.forEach(r => {
      const svName = r.subVendor ? r.subVendor.trim() : 'Unknown Sub-Vendor';
      if (!map[svName]) {
        map[svName] = {
          name: svName,
          mobile: '-',
          gstin: '-',
          pan: '-',
          parentVendors: new Set<string>(),
          totalCount: 0,
          vehicleTypes: new Set<string>(),
          vehicles: []
        };
      }
      map[svName].totalCount += 1;
      if (r.vendor && r.vendor !== '-') {
        map[svName].parentVendors.add(r.vendor.trim());
      }
      if (r.vehicleType && r.vehicleType !== '-') {
        map[svName].vehicleTypes.add(r.vehicleType.trim());
      }
      map[svName].vehicles.push(r);
    });

    // Return in order of profiles first, then any other aggregated ones
    const list: typeof map[string][] = [];
    const addedKeys = new Set<string>();

    profiles.forEach(p => {
      const key = p.name.trim();
      if (map[key]) {
        list.push(map[key]);
        addedKeys.add(key);
      }
    });

    Object.keys(map).forEach(key => {
      if (!addedKeys.has(key)) {
        list.push(map[key]);
      }
    });

    return list;
  }, [records, profiles]);

  // Filter sub-vendors by search query
  const filteredSubVendors = useMemo(() => {
    return subVendorStats.filter(sv => 
      sv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sv.mobile.includes(searchQuery) ||
      sv.gstin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sv.pan.toLowerCase().includes(searchQuery.toLowerCase()) ||
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

  const handleEditClick = (e: React.MouseEvent, subVendor: typeof subVendorStats[0]) => {
    e.stopPropagation(); // Avoid opening drawer
    setEditingSubVendor({
      originalName: subVendor.name,
      name: subVendor.name,
      mobile: subVendor.mobile === '-' ? '' : subVendor.mobile,
      gstin: subVendor.gstin === '-' ? '' : subVendor.gstin,
      pan: subVendor.pan === '-' ? '' : subVendor.pan
    });
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubVendor) return;

    setProfiles(prev => {
      const next = [...prev];
      const idx = next.findIndex(p => p.name.toLowerCase() === editingSubVendor.originalName.toLowerCase());
      const updatedProfile = {
        name: editingSubVendor.name.trim(),
        mobile: editingSubVendor.mobile.trim() || '-',
        gstin: editingSubVendor.gstin.trim().toUpperCase() || '-',
        pan: editingSubVendor.pan.trim().toUpperCase() || '-',
      };

      if (idx >= 0) {
        next[idx] = updatedProfile;
      } else {
        next.push(updatedProfile);
      }
      saveSyncedValue(SUBVENDOR_PROFILES_KEY, next);
      return next;
    });

    setEditingSubVendor(null);
  };

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
              placeholder="Search Sub-Vendor, GSTIN, PAN or Mobile..."
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
                <th className="px-6 py-4 whitespace-nowrap">Mobile No</th>
                <th className="px-6 py-4 whitespace-nowrap">GSTIN No</th>
                <th className="px-6 py-4 whitespace-nowrap">PAN No</th>
                <th className="px-6 py-4 whitespace-nowrap">Parent Vendor Companies</th>
                <th className="px-6 py-4 whitespace-nowrap">Registered Fleet Size</th>
                <th className="px-6 py-4">Vehicle Distributions</th>
                {canEdit && <th className="px-6 py-4 text-right">Actions</th>}
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
                  <td className="px-6 py-4 whitespace-nowrap font-mono">{subVendor.mobile}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono uppercase">{subVendor.gstin}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono uppercase">{subVendor.pan}</td>
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
                  {canEdit && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => handleEditClick(e, subVendor)}
                        className="rounded-lg p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all"
                        title="Edit Details"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredSubVendors.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 9 : 8} className="px-6 py-12 text-center text-slate-400 font-semibold">
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
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
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

              {/* Sub-Vendor Credentials Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1.5">Company Credentials</div>
                <div className="grid grid-cols-3 gap-4 font-mono">
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Mobile No</span>
                    <span className="text-xs font-semibold text-slate-800">{activeSubVendorRecord.mobile}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">GSTIN No</span>
                    <span className="text-xs font-semibold text-slate-800 uppercase">{activeSubVendorRecord.gstin}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">PAN No</span>
                    <span className="text-xs font-semibold text-slate-800 uppercase">{activeSubVendorRecord.pan}</span>
                  </div>
                </div>
              </div>

              {/* Mapped Vehicles */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Vehicle Master Listing</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
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
                    <tbody className="divide-y divide-slate-155 text-slate-600 bg-white">
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

      {/* Edit Modal */}
      {editingSubVendor && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in animate-duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit className="h-4.5 w-4.5 text-brand-primary" /> Edit Sub-Vendor Credentials
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Update {editingSubVendor.originalName}</p>
              </div>
              <button onClick={() => setEditingSubVendor(null)} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Sub-Vendor Name *</label>
                <input 
                  type="text" 
                  required
                  value={editingSubVendor.name} 
                  onChange={(e) => setEditingSubVendor({...editingSubVendor, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Mobile No</label>
                <input 
                  type="text" 
                  placeholder="e.g. +91 98765 43210"
                  value={editingSubVendor.mobile} 
                  onChange={(e) => setEditingSubVendor({...editingSubVendor, mobile: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">GSTIN No</label>
                  <input 
                    type="text" 
                    placeholder="22AAAAA0000A1Z5"
                    value={editingSubVendor.gstin} 
                    onChange={(e) => setEditingSubVendor({...editingSubVendor, gstin: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">PAN No</label>
                  <input 
                    type="text" 
                    placeholder="ABCDE1234F"
                    value={editingSubVendor.pan} 
                    onChange={(e) => setEditingSubVendor({...editingSubVendor, pan: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono uppercase"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setEditingSubVendor(null)} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-[2] rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
