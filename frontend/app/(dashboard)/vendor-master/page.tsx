'use client';

import { useEffect, useState, useMemo } from 'react';
import { Building2, Search, X, Truck, Database, BarChart3, Edit, FileSpreadsheet } from 'lucide-react';
import { fetchSyncedValue, readLocalValue, saveSyncedValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import { normalizeVendorName } from '@/lib/operationalStatus';

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

interface VendorProfile {
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
const VENDOR_PROFILES_KEY = 'tms_vendor_profiles';

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export default function VendorMasterPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<FleetMasterRecord[]>([]);
  const [profiles, setProfiles] = useState<VendorProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  // Edit State
  const [editingVendor, setEditingVendor] = useState<{
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
    setProfiles(readLocalValue<VendorProfile[]>(VENDOR_PROFILES_KEY, []));

    // 2. Background Database sync
    fetchSyncedValue<FleetMasterRecord[]>(FLEET_MASTER_KEY, []).then((synced) => {
      setRecords(synced);
    });
    fetchSyncedValue<VendorProfile[]>(VENDOR_PROFILES_KEY, []).then((synced) => {
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
      if (!detail || detail.sectionName !== 'Vendor Master') return;

      const importedProfiles = detail.import.rows.map((row): VendorProfile => {
        const name = normalizeVendorName(getCellValue(detail.import.headers, row, ['vendor', 'vendor name', 'name', 'company', 'vendor company']));
        const mobile = getCellValue(detail.import.headers, row, ['mobile', 'mobile no', 'mobile number', 'phone', 'contact']);
        const gstin = getCellValue(detail.import.headers, row, ['gstin', 'gstin no', 'gst', 'tax id']);
        const pan = getCellValue(detail.import.headers, row, ['pan', 'pan no', 'pan number']);

        return {
          name: name === '-' ? 'Unknown Vendor' : name,
          mobile: mobile === '-' ? '' : mobile,
          gstin: gstin === '-' ? '' : gstin,
          pan: pan === '-' ? '' : pan
        };
      }).filter(p => p.name !== 'Unknown Vendor');

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
        saveSyncedValue(VENDOR_PROFILES_KEY, next);
        return next;
      });
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, []);

  // Compute unique vendors with aggregates
  const vendorStats = useMemo(() => {
    const map: Record<string, {
      name: string;
      mobile: string;
      gstin: string;
      pan: string;
      ownedCount: number;
      attachedCount: number;
      totalCount: number;
      subVendors: Set<string>;
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
        ownedCount: 0,
        attachedCount: 0,
        totalCount: 0,
        subVendors: new Set<string>(),
        vehicles: []
      };
    });

    // 2. Aggregate from fleet master records
    records.forEach(r => {
      const vName = r.vendor ? r.vendor.trim() : 'Unknown Vendor';
      if (!map[vName]) {
        map[vName] = {
          name: vName,
          mobile: '-',
          gstin: '-',
          pan: '-',
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
      if (r.subVendor && r.subVendor !== '-') {
        map[vName].subVendors.add(r.subVendor.trim());
      }
      map[vName].vehicles.push(r);
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

  // Filter vendors by search query
  const filteredVendors = useMemo(() => {
    return vendorStats.filter(v => 
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.mobile.includes(searchQuery) ||
      v.gstin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.pan.toLowerCase().includes(searchQuery.toLowerCase()) ||
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

  const handleEditClick = (e: React.MouseEvent, vendor: typeof vendorStats[0]) => {
    e.stopPropagation(); // Avoid opening drawer
    setEditingVendor({
      originalName: vendor.name,
      name: vendor.name,
      mobile: vendor.mobile === '-' ? '' : vendor.mobile,
      gstin: vendor.gstin === '-' ? '' : vendor.gstin,
      pan: vendor.pan === '-' ? '' : vendor.pan
    });
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor) return;

    setProfiles(prev => {
      const next = [...prev];
      const idx = next.findIndex(p => p.name.toLowerCase() === editingVendor.originalName.toLowerCase());
      const updatedProfile = {
        name: normalizeVendorName(editingVendor.name.trim()),
        mobile: editingVendor.mobile.trim() || '-',
        gstin: editingVendor.gstin.trim().toUpperCase() || '-',
        pan: editingVendor.pan.trim().toUpperCase() || '-',
      };

      if (idx >= 0) {
        next[idx] = updatedProfile;
      } else {
        next.push(updatedProfile);
      }
      saveSyncedValue(VENDOR_PROFILES_KEY, next);
      return next;
    });

    setEditingVendor(null);
  };

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
              placeholder="Search Vendor, GSTIN, PAN or Mobile..."
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
                <th className="px-6 py-4 whitespace-nowrap">Mobile No</th>
                <th className="px-6 py-4 whitespace-nowrap">GSTIN No</th>
                <th className="px-6 py-4 whitespace-nowrap">PAN No</th>
                <th className="px-6 py-4 whitespace-nowrap">Total Fleet Count</th>
                <th className="px-6 py-4 whitespace-nowrap">Owned Vehicles</th>
                <th className="px-6 py-4 whitespace-nowrap">Attached Vehicles</th>
                <th className="px-6 py-4">Associated Sub-Vendors</th>
                {canEdit && <th className="px-6 py-4 text-right">Actions</th>}
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
                  <td className="px-6 py-4 whitespace-nowrap font-mono">{vendor.mobile}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono uppercase">{vendor.gstin}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-mono uppercase">{vendor.pan}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                      {vendor.totalCount} Trucks
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-600">{vendor.ownedCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-violet-600">{vendor.attachedCount}</td>
                  <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                    {Array.from(vendor.subVendors).join(', ') || '—'}
                  </td>
                  {canEdit && (
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={(e) => handleEditClick(e, vendor)}
                        className="rounded-lg p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all"
                        title="Edit Details"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredVendors.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 10 : 9} className="px-6 py-12 text-center text-slate-400 font-semibold">
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
        <div className="fixed inset-0 z-[150] flex justify-end bg-black/30 backdrop-blur-xs animate-fade-in animate-duration-200">
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
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
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

              {/* Vendor Profile Cards */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 pb-1.5">Company Credentials</div>
                <div className="grid grid-cols-3 gap-4 font-mono">
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">Mobile No</span>
                    <span className="text-xs font-semibold text-slate-800">{activeVendorRecord.mobile}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">GSTIN No</span>
                    <span className="text-xs font-semibold text-slate-800 uppercase">{activeVendorRecord.gstin}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-bold text-slate-400 uppercase">PAN No</span>
                    <span className="text-xs font-semibold text-slate-800 uppercase">{activeVendorRecord.pan}</span>
                  </div>
                </div>
              </div>

              {/* Sub-Vendors list */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Registered Sub-vendors</h4>
                <div className="flex flex-wrap gap-1.5">
                  {activeVendorRecord.subVendors.size > 0 ? Array.from(activeVendorRecord.subVendors).map(sv => (
                    <span key={sv} className="rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 animate-fade-in">
                      {sv}
                    </span>
                  )) : <span className="text-[10px] text-slate-400 italic">No sub-vendors mapped.</span>}
                </div>
              </div>

              {/* Mapped Vehicles */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">Vehicle Distribution</h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
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
                    <tbody className="divide-y divide-slate-150 text-slate-600 bg-white">
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

      {/* Edit Modal */}
      {editingVendor && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in animate-duration-200">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Edit className="h-4.5 w-4.5 text-brand-primary" /> Edit Vendor Credentials
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Update {editingVendor.originalName}</p>
              </div>
              <button onClick={() => setEditingVendor(null)} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleEditSave} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Vendor Name *</label>
                <input 
                  type="text" 
                  required
                  value={editingVendor.name} 
                  onChange={(e) => setEditingVendor({...editingVendor, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Mobile No</label>
                <input 
                  type="text" 
                  placeholder="e.g. +91 98765 43210"
                  value={editingVendor.mobile} 
                  onChange={(e) => setEditingVendor({...editingVendor, mobile: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">GSTIN No</label>
                  <input 
                    type="text" 
                    placeholder="22AAAAA0000A1Z5"
                    value={editingVendor.gstin} 
                    onChange={(e) => setEditingVendor({...editingVendor, gstin: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">PAN No</label>
                  <input 
                    type="text" 
                    placeholder="ABCDE1234F"
                    value={editingVendor.pan} 
                    onChange={(e) => setEditingVendor({...editingVendor, pan: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono uppercase"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setEditingVendor(null)} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
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
