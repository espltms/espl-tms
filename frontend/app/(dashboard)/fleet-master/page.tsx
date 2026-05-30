'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Database, Plus, X, ArrowRight, Trash2 } from 'lucide-react';
import { fetchSyncedValue, saveSyncedValue } from '@/lib/syncedStorage';

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

type ImportedSheet = {
  id: string;
  fileName: string;
  importedAt: string;
  headers: string[];
  rows: string[][];
};

type FleetCategory = 'OWNED_FLEET' | 'ATTACHED_FLEET';

const FLEET_CATEGORY_OPTIONS: { value: FleetCategory; label: string }[] = [
  { value: 'OWNED_FLEET', label: 'Owned Fleet' },
  { value: 'ATTACHED_FLEET', label: 'Attached Fleet' },
];

const VEHICLE_TYPES = ['Tipper', 'Dalla', 'Tanker', 'Flatbed', 'Container Carrier', 'Bulker'];
const WHEELER_OPTIONS = ['6 Wheeler', '10 Wheeler', '12 Wheeler', '14 Wheeler', '16 Wheeler', '18 Wheeler', '22 Wheeler'];

const FLEET_MASTER_KEY = 'tms_fleet_master';
const ITEMS_PER_PAGE = 15;

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const emptyForm = {
  plateNumber: '',
  fleetCategory: 'OWNED_FLEET' as FleetCategory,
  vendor: '',
  subVendor: '',
  vehicleType: 'Tipper',
  wheeler: '12 Wheeler',
  rcNo: '',
  fitnessValidityFrom: '',
  fitnessValidityTo: '',
  insuranceValidityUpto: '',
  pucValidity: '',
  driverName: '',
  driverDL: '',
  dlValidityTill: '',
  driverMobile: '',
};

export default function FleetMasterPage() {
  const [records, setRecords] = useState<FleetMasterRecord[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);

  const totalPages = Math.ceil(records.length / ITEMS_PER_PAGE);
  const paginatedRecords = records.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const ownedCount = records.filter(r => r.fleetCategory === 'OWNED_FLEET').length;
  const attachedCount = records.filter(r => r.fleetCategory === 'ATTACHED_FLEET').length;

  /* ── Load from synced storage ── */
  useEffect(() => {
    fetchSyncedValue<FleetMasterRecord[]>(FLEET_MASTER_KEY, []).then((synced) => {
      setRecords(synced);
    });
  }, []);

  /* ── Persist helper ── */
  const persistRecords = (next: FleetMasterRecord[]) => {
    saveSyncedValue(FLEET_MASTER_KEY, next);
  };

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
      if (!detail || detail.sectionName !== 'Fleet Master') return;

      const importedRecords = detail.import.rows.map((row, index): FleetMasterRecord => {
        const plateNumber = getCellValue(detail.import.headers, row, ['vehicle no', 'vehicle_no', 'plate number', 'vehicle number', 'vehicle no.']).toUpperCase();
        const fleetCategoryVal = getCellValue(detail.import.headers, row, ['fleet category', 'category']);
        const vendor = getCellValue(detail.import.headers, row, ['vendor', 'vendor name', 'vendor company']);
        const subVendor = getCellValue(detail.import.headers, row, ['sub vendor', 'sub-vendor', 'sub_vendor', 'subvendor', 'owner', 'owner name']);
        const vehicleType = getCellValue(detail.import.headers, row, ['vehicle type', 'truck type', 'type']);
        const wheeler = getCellValue(detail.import.headers, row, ['wheeler', 'wheelers', 'no of wheels']);
        const rcNo = getCellValue(detail.import.headers, row, ['rc no', 'rc number', 'rc', 'registration']);
        const fitnessFrom = getCellValue(detail.import.headers, row, ['fitness validity from', 'fitness from', 'fitness start']);
        const fitnessTo = getCellValue(detail.import.headers, row, ['fitness validity to', 'fitness to', 'fitness end', 'fitness expiry']);
        const insuranceUpto = getCellValue(detail.import.headers, row, ['insurance validity upto', 'insurance validity', 'insurance upto', 'insurance expiry', 'insurance']);
        const pucValidity = getCellValue(detail.import.headers, row, ['puc validity', 'puc', 'puc expiry']);
        const driverName = getCellValue(detail.import.headers, row, ['name of the driver', 'driver name', 'driver', 'name of driver']);
        const driverDL = getCellValue(detail.import.headers, row, ['dl', 'dl no', 'dl number', 'driving license', 'license', 'licence']);
        const dlValidityTill = getCellValue(detail.import.headers, row, ['dl validity till', 'dl validity', 'dl expiry', 'license expiry']);
        const driverMobile = getCellValue(detail.import.headers, row, ['mob no of the driver', 'mob no', 'mobile', 'mobile no', 'phone', 'driver phone', 'driver mobile', 'contact']);

        return {
          id: `fm-import-${Date.now()}-${index}`,
          plateNumber: plateNumber === '-' ? `VEH-${Date.now()}-${index}` : plateNumber,
          fleetCategory: (fleetCategoryVal.toLowerCase().includes('attached') ? 'ATTACHED_FLEET' : 'OWNED_FLEET') as FleetCategory,
          vendor,
          subVendor,
          vehicleType: vehicleType === '-' ? 'Tipper' : vehicleType,
          wheeler: wheeler === '-' ? '12 Wheeler' : wheeler,
          rcNo,
          fitnessValidityFrom: fitnessFrom,
          fitnessValidityTo: fitnessTo,
          insuranceValidityUpto: insuranceUpto,
          pucValidity,
          driverName,
          driverDL,
          dlValidityTill,
          driverMobile,
        };
      });

      if (importedRecords.length === 0) return;

      setRecords(prev => {
        const next = [
          ...importedRecords,
          ...prev.filter(r => !importedRecords.some(ir => ir.plateNumber === r.plateNumber)),
        ];
        persistRecords(next);
        return next;
      });
      setCurrentPage(1);
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, []);

  /* ── Add record handler ── */
  const handleAddRecord = (e: React.FormEvent) => {
    e.preventDefault();

    const newRecord: FleetMasterRecord = {
      id: `fm-local-${Date.now()}`,
      plateNumber: form.plateNumber.toUpperCase(),
      fleetCategory: form.fleetCategory,
      vendor: form.vendor || '-',
      subVendor: form.subVendor || '-',
      vehicleType: form.vehicleType,
      wheeler: form.wheeler,
      rcNo: form.rcNo || '-',
      fitnessValidityFrom: form.fitnessValidityFrom || '-',
      fitnessValidityTo: form.fitnessValidityTo || '-',
      insuranceValidityUpto: form.insuranceValidityUpto || '-',
      pucValidity: form.pucValidity || '-',
      driverName: form.driverName || '-',
      driverDL: form.driverDL || '-',
      dlValidityTill: form.dlValidityTill || '-',
      driverMobile: form.driverMobile || '-',
    };

    const next = [newRecord, ...records];
    setRecords(next);
    persistRecords(next);
    setForm(emptyForm);
    setModalOpen(false);
  };

  /* ── Delete handler ── */
  const deleteRecords = (ids: string[]) => {
    const next = records.filter(r => !ids.includes(r.id));
    setRecords(next);
    persistRecords(next);
    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Fleet Master</h2>
          <p className="text-xs text-slate-500 mt-1">Central master database for all fleet vehicles, documents, and assigned crew</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-md"
        >
          <Plus className="h-4.5 w-4.5" /> Add Vehicle
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Vehicles</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{records.length}</span>
            <span className="text-[10px] text-slate-400">registered in master</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Owned Fleet</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-700">{ownedCount}</span>
            <span className="text-[10px] text-blue-500 font-semibold">company-owned vehicles</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Attached Fleet</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-violet-700">{attachedCount}</span>
            <span className="text-[10px] text-violet-500 font-semibold">vendor-attached vehicles</span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Database className="h-4.5 w-4.5 text-brand-primary" />
            Fleet Master Registry
          </h3>
          <div className="flex items-center gap-2">
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
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                {isDeleteMode && (
                  <th className="w-10 px-4 py-4">
                    <input
                      type="checkbox"
                      checked={paginatedRecords.length > 0 && paginatedRecords.every(r => selectedIds.includes(r.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSelections = [...selectedIds];
                          paginatedRecords.forEach(r => {
                            if (!newSelections.includes(r.id)) {
                              newSelections.push(r.id);
                            }
                          });
                          setSelectedIds(newSelections);
                        } else {
                          setSelectedIds(selectedIds.filter(id => !paginatedRecords.some(r => r.id === id)));
                        }
                      }}
                      className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-4 py-4 whitespace-nowrap">SL.</th>
                <th className="px-4 py-4 whitespace-nowrap">Vehicle No</th>
                <th className="px-4 py-4 whitespace-nowrap">Fleet Category</th>
                <th className="px-4 py-4 whitespace-nowrap">Vendor</th>
                <th className="px-4 py-4 whitespace-nowrap">Sub-Vendor</th>
                <th className="px-4 py-4 whitespace-nowrap">Vehicle Type</th>
                <th className="px-4 py-4 whitespace-nowrap">Wheeler</th>
                <th className="px-4 py-4 whitespace-nowrap">RC No</th>
                <th className="px-4 py-4 whitespace-nowrap">Fitness From</th>
                <th className="px-4 py-4 whitespace-nowrap">Fitness To</th>
                <th className="px-4 py-4 whitespace-nowrap">Insurance Upto</th>
                <th className="px-4 py-4 whitespace-nowrap">PUC Validity</th>
                <th className="px-4 py-4 whitespace-nowrap">Driver Name</th>
                <th className="px-4 py-4 whitespace-nowrap">DL</th>
                <th className="px-4 py-4 whitespace-nowrap">DL Validity</th>
                <th className="px-4 py-4 whitespace-nowrap">Driver Mobile</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {paginatedRecords.map((record, idx) => (
                <tr key={record.id} className={`hover:bg-slate-50/50 transition-colors ${selectedIds.includes(record.id) ? 'bg-blue-50/20' : ''}`}>
                  {isDeleteMode && (
                    <td className="w-10 px-4 py-4">
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
                  <td className="px-4 py-4 font-bold text-slate-400">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                  <td className="px-4 py-4 font-extrabold text-slate-800 font-mono tracking-wider whitespace-nowrap">{record.plateNumber}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-bold whitespace-nowrap ${
                      record.fleetCategory === 'OWNED_FLEET'
                        ? 'border-blue-200 bg-blue-50 text-blue-700'
                        : 'border-violet-200 bg-violet-50 text-violet-700'
                    }`}>
                      {FLEET_CATEGORY_OPTIONS.find(o => o.value === record.fleetCategory)?.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-semibold text-slate-700 whitespace-nowrap">{record.vendor}</td>
                  <td className="px-4 py-4 text-slate-500 whitespace-nowrap">{record.subVendor}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{record.vehicleType}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{record.wheeler}</td>
                  <td className="px-4 py-4 font-mono text-slate-500 whitespace-nowrap">{record.rcNo}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{record.fitnessValidityFrom}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{record.fitnessValidityTo}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{record.insuranceValidityUpto}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{record.pucValidity}</td>
                  <td className="px-4 py-4 font-semibold text-slate-700 whitespace-nowrap">{record.driverName}</td>
                  <td className="px-4 py-4 font-mono text-slate-500 whitespace-nowrap">{record.driverDL}</td>
                  <td className="px-4 py-4 whitespace-nowrap">{record.dlValidityTill}</td>
                  <td className="px-4 py-4 font-mono whitespace-nowrap">{record.driverMobile}</td>
                </tr>
              ))}
              {paginatedRecords.length === 0 && (
                <tr>
                  <td colSpan={isDeleteMode ? 18 : 17} className="px-6 py-8 text-center text-slate-500">No fleet master records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="border-t border-[#e2e8f0] bg-white px-6 py-4 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-semibold">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, records.length)} of {records.length} entries
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

      {/* Modal - Add Vehicle */}
      {modalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Add Vehicle to Fleet Master</h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Register a new vehicle record in the master database</p>
              </div>
              <button onClick={() => { setModalOpen(false); setForm(emptyForm); }} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddRecord} className="p-6 space-y-5 text-xs">
              {/* Vehicle Information */}
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="mb-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  <Database className="h-4 w-4 text-brand-primary" /> Vehicle Information
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Field label="Vehicle No *">
                    <input type="text" required placeholder="e.g. OD-08-AB-1234" value={form.plateNumber} onChange={(e) => setForm({...form, plateNumber: e.target.value})} className="fleet-master-input uppercase font-mono" />
                  </Field>
                  <Field label="Fleet Category">
                    <select value={form.fleetCategory} onChange={(e) => setForm({...form, fleetCategory: e.target.value as FleetCategory})} className="fleet-master-input">
                      {FLEET_CATEGORY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Vendor">
                    <input type="text" placeholder="Vendor company name" value={form.vendor} onChange={(e) => setForm({...form, vendor: e.target.value})} className="fleet-master-input" />
                  </Field>
                  <Field label="Sub-Vendor">
                    <input type="text" placeholder="Sub vendor / owner name" value={form.subVendor} onChange={(e) => setForm({...form, subVendor: e.target.value})} className="fleet-master-input" />
                  </Field>
                  <Field label="Vehicle Type">
                    <select value={form.vehicleType} onChange={(e) => setForm({...form, vehicleType: e.target.value})} className="fleet-master-input">
                      {VEHICLE_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </Field>
                  <Field label="Wheeler">
                    <select value={form.wheeler} onChange={(e) => setForm({...form, wheeler: e.target.value})} className="fleet-master-input">
                      {WHEELER_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                    </select>
                  </Field>
                  <Field label="RC No">
                    <input type="text" placeholder="RC document number" value={form.rcNo} onChange={(e) => setForm({...form, rcNo: e.target.value})} className="fleet-master-input uppercase font-mono" />
                  </Field>
                </div>
              </section>

              {/* Document Validity */}
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="mb-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Validity &amp; Documents
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Field label="Fitness Validity From">
                    <input type="date" value={form.fitnessValidityFrom} onChange={(e) => setForm({...form, fitnessValidityFrom: e.target.value})} className="fleet-master-input" />
                  </Field>
                  <Field label="Fitness Validity To">
                    <input type="date" value={form.fitnessValidityTo} onChange={(e) => setForm({...form, fitnessValidityTo: e.target.value})} className="fleet-master-input" />
                  </Field>
                  <Field label="Insurance Validity Upto">
                    <input type="date" value={form.insuranceValidityUpto} onChange={(e) => setForm({...form, insuranceValidityUpto: e.target.value})} className="fleet-master-input" />
                  </Field>
                  <Field label="PUC Validity">
                    <input type="date" value={form.pucValidity} onChange={(e) => setForm({...form, pucValidity: e.target.value})} className="fleet-master-input" />
                  </Field>
                </div>
              </section>

              {/* Driver Details */}
              <section className="rounded-2xl border border-slate-200 p-4">
                <h4 className="mb-4 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
                  Assigned Driver
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Field label="Name of the Driver">
                    <input type="text" placeholder="Driver full name" value={form.driverName} onChange={(e) => setForm({...form, driverName: e.target.value})} className="fleet-master-input" />
                  </Field>
                  <Field label="DL (Driving License)">
                    <input type="text" placeholder="DL number" value={form.driverDL} onChange={(e) => setForm({...form, driverDL: e.target.value.toUpperCase()})} className="fleet-master-input uppercase font-mono" />
                  </Field>
                  <Field label="DL Validity Till">
                    <input type="date" value={form.dlValidityTill} onChange={(e) => setForm({...form, dlValidityTill: e.target.value})} className="fleet-master-input" />
                  </Field>
                  <Field label="Mobile No of the Driver">
                    <input type="tel" placeholder="+91 98765 43210" value={form.driverMobile} onChange={(e) => setForm({...form, driverMobile: e.target.value})} className="fleet-master-input" />
                  </Field>
                </div>
              </section>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => { setModalOpen(false); setForm(emptyForm); }} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-[2] rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                  Add Vehicle <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .fleet-master-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 0.625rem 0.75rem;
          color: #1e293b;
          outline: none;
          font-size: 0.75rem;
        }
        .fleet-master-input:focus {
          border-color: rgb(37 99 235 / 0.65);
          box-shadow: 0 0 0 1px rgb(37 99 235 / 0.2);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
