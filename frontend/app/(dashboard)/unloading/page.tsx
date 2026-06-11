'use client';

import { useEffect, useState } from 'react';
import { PackageOpen, X, Trash2 } from 'lucide-react';
import { getTrucks } from '@/app/data/dataHelper';
import {
  OPERATIONAL_STATUS_OPTIONS,
  OperationalStatus,
  getOperationalStatusClasses,
} from '@/lib/operationalStatus';
import { fetchSyncedValue, readLocalValue, saveSyncedValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import SectionExcelExport from '@/components/SectionExcelExport';
import {
  LOADING_RECORDS_KEY,
  TRUCK_STATUS_OVERRIDES_KEY,
  updateAssignedTripStatus,
  upsertTruckStatusOverride,
  isMatchingDestination,
} from '@/lib/workflowAutomation';

type TruckStatus = OperationalStatus;

interface TruckData {
  id: string;
  plateNumber: string;
  model: string;
  status: TruckStatus;
}

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
  truckStatus: TruckStatus;
  receivedQty?: number;
  unloadingDateTime?: string;
  turnaroundMinutes?: number;
  unloadingTruckStatus?: TruckStatus;
}

const getLocalDateTimeString = () => {
  const tzoffset = (new Date()).getTimezoneOffset() * 60000;
  return (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
};


const TRUCK_STATUS_OPTIONS = OPERATIONAL_STATUS_OPTIONS;
const emptyUnloadingForm = {
  truckPlate: '',
  truckStatus: 'RECEIVED' as TruckStatus,
  receivedQty: '',
  unloadingDateTime: getLocalDateTimeString(),
};

export default function UnloadingVehiclePage() {
  const { user } = useAuthStore();
  const [trucks, setTrucks] = useState<TruckData[]>(() => getTrucks());
  const [records, setRecords] = useState<LoadingRecord[]>(() => readLocalValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []));
  const [activeRecord, setActiveRecord] = useState<LoadingRecord | null>(null);
  const [form, setForm] = useState(emptyUnloadingForm);
  const [assignedTrips, setAssignedTrips] = useState<any[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    // 1. Instant local load
    setRecords(readLocalValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []));
    setAssignedTrips(readLocalValue<any[]>('tms_assigned_trips', []));

    // 2. Background Database sync
    fetchSyncedValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []).then(setRecords);
    fetchSyncedValue<any[]>('tms_assigned_trips', []).then(setAssignedTrips);
  }, []);

  const isRegionalUser = user?.role === 'REGION_ADMIN' || 
                         user?.role === 'DISPATCHER' || 
                         user?.role === 'BHAWANIPATNA_ADMIN' ||
                         user?.role === 'PARAMANANDPUR_UNLOADER' ||
                         user?.role === 'DHARAMGARH_UNLOADER';

  const userRegion = user?.role === 'PARAMANANDPUR_UNLOADER'
    ? 'Paramanandpur' 
    : user?.role === 'DHARAMGARH_UNLOADER'
      ? 'Dharamgarh' 
      : user?.role === 'BHAWANIPATNA_ADMIN'
        ? 'Bhawanipatna'
        : user?.regionName;

  const isAdmin = user?.role === 'SUPER_ADMIN' || 
                  user?.role === 'SYS_ADMIN' || 
                  user?.role === 'REGION_ADMIN' || 
                  user?.role === 'BHAWANIPATNA_ADMIN';

  const canDelete = isAdmin;
  const canEdit = isAdmin;

  const filteredRecords = records.filter(record => {
    if (isRegionalUser && userRegion) {
      const trip = assignedTrips.find(t => t.tripNumber === record.tripNumber || t.id === record.tripId);
      if (trip) {
        return isMatchingDestination(trip.destination, userRegion);
      }
      return true;
    }
    return true;
  });

  const formatTurnaround = (minutes?: number) => {
    if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return 'Pending';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours <= 0) return `${remainingMinutes}m`;
    return `${hours}h ${remainingMinutes}m`;
  };

  const getRecordTurnaround = (record: LoadingRecord) => {
    if (record.truckStatus !== 'RECEIVED') {
      const loadingTime = new Date(record.loadingDateTime).getTime();
      const now = Date.now();
      return Math.max(0, Math.round((now - loadingTime) / 60000));
    }
    return record.turnaroundMinutes;
  };

  const persistTruckStatusOverrides = (nextTrucks: TruckData[]) => {
    if (typeof window === 'undefined') return;
    const overrides = nextTrucks.reduce<Record<string, TruckStatus>>((acc, truck) => {
      acc[truck.id] = truck.status;
      return acc;
    }, {});
    saveSyncedValue(TRUCK_STATUS_OVERRIDES_KEY, overrides);
  };

  const persistRecords = (nextRecords: LoadingRecord[]) => {
    saveSyncedValue(LOADING_RECORDS_KEY, nextRecords);
  };

  const deleteRecords = (idsToDelete: string[]) => {
    const nextRecords = records.filter(r => !idsToDelete.includes(r.id));
    setRecords(nextRecords);
    persistRecords(nextRecords);
    setSelectedIds(prev => prev.filter(id => !idsToDelete.includes(id)));
  };

  const openUnloadingModal = (record: LoadingRecord) => {
    setActiveRecord(record);
    setForm({
      truckPlate: record.truckPlate,
      truckStatus: record.unloadingTruckStatus || 'RECEIVED',
      receivedQty: record.receivedQty?.toString() || record.netWeight.toString(),
      unloadingDateTime: record.unloadingDateTime || getLocalDateTimeString(),
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeRecord) return;

    const isReceived = form.truckStatus === 'RECEIVED';
    const loadingTime = new Date(activeRecord.loadingDateTime).getTime();
    const unloadingTime = new Date(form.unloadingDateTime).getTime();
    const turnaroundMinutes = Math.max(0, Math.round((unloadingTime - loadingTime) / 60000));

    const finalTruckPlate = isAdmin 
      ? form.truckPlate.toUpperCase().trim() 
      : activeRecord.truckPlate.toUpperCase().trim();

    const finalReceivedQty = isAdmin 
      ? (parseFloat(form.receivedQty) || 0) 
      : activeRecord.netWeight;

    const nextRecords = records.map(record =>
      record.id === activeRecord.id
        ? {
            ...record,
            truckPlate: finalTruckPlate,
            receivedQty: isReceived ? finalReceivedQty : undefined,
            unloadingDateTime: isReceived ? form.unloadingDateTime : undefined,
            turnaroundMinutes: isReceived ? turnaroundMinutes : undefined,
            unloadingTruckStatus: form.truckStatus,
            truckStatus: form.truckStatus,
          }
        : record
    );
    const nextTrucks = trucks.map(truck => 
      truck.id === activeRecord.truckId || truck.plateNumber.toUpperCase().trim() === activeRecord.truckPlate.toUpperCase().trim()
        ? { ...truck, status: form.truckStatus, plateNumber: finalTruckPlate } 
        : truck
    );

    setRecords(nextRecords);
    setTrucks(nextTrucks);
    persistRecords(nextRecords);
    persistTruckStatusOverrides(nextTrucks);
    
    const tripStatusToSet = isReceived ? 'RECEIVED' : form.truckStatus;
    updateAssignedTripStatus(activeRecord.tripId, activeRecord.tripNumber, tripStatusToSet);
    upsertTruckStatusOverride(activeRecord.truckId, form.truckStatus);
    
    setActiveRecord(null);
    setForm(emptyUnloadingForm);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Unloading Vehicle</h2>
          <p className="text-xs text-slate-500 mt-1">Update loaded vehicle records with received quantity, unloading time, truck status, and turnaround time</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <SectionExcelExport sectionName="Unloading Vehicle" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-brand-primary" /> Pending & Completed Unloading
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
                  <th className="w-10 px-6 py-4">
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
                <th className="px-6 py-4">SL.</th>
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">Loading Ref</th>
                <th className="px-6 py-4">Loaded Qty</th>
                <th className="px-6 py-4">Unloading</th>
                <th className="px-6 py-4">Turnaround</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isDeleteMode ? 8 : 7} className="px-6 py-8 text-center text-slate-500">
                    No loading records available for unloading.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((record, idx) => (
                  <tr key={record.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(record.id) ? 'bg-blue-50/20' : ''}`}>
                    {isDeleteMode && (
                      <td className="px-6 py-4">
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
                    <td className="px-6 py-4 font-bold text-slate-400">{idx + 1}</td>
                    <td className="px-6 py-4 font-mono font-extrabold text-slate-800">{record.truckPlate}</td>
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-slate-700">{record.ticketNo}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">Challan: {record.challanNo}</div>
                    </td>
                    <td className="px-6 py-4 font-mono">{record.netWeight.toFixed(2)} {record.uom}</td>
                    <td className="px-6 py-4">
                      {record.unloadingDateTime ? (
                        <div>
                          <div className="font-mono font-bold text-slate-700">{record.receivedQty?.toFixed(2)} {record.uom}</div>
                          <div className="mt-0.5 text-[10px] text-slate-500">
                            {new Date(record.unloadingDateTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true, dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">{formatTurnaround(getRecordTurnaround(record))}</td>
                    <td className="px-6 py-4 text-right">
                      {!record.unloadingDateTime ? (
                        <button onClick={() => openUnloadingModal(record)} className="rounded-lg border px-3 py-1.5 text-[10px] font-extrabold border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                          Unload
                        </button>
                      ) : canEdit ? (
                        <button onClick={() => openUnloadingModal(record)} className="rounded-lg border px-3 py-1.5 text-[10px] font-extrabold border-slate-200 bg-white text-slate-600 hover:bg-slate-50">
                          Edit
                        </button>
                      ) : (
                        <span className="inline-block rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[9px] font-bold text-slate-400 uppercase">
                          Unloaded
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {activeRecord && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90dvh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50 shrink-0">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Unloading Vehicle</h3>
                <p className="mt-0.5 text-[10px] font-semibold uppercase text-slate-500">{activeRecord.truckPlate}</p>
              </div>
              <button onClick={() => { setActiveRecord(null); setForm(emptyUnloadingForm); }} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto min-h-0 flex-1">
              {(() => {
                const isFieldAdmin = user?.role === 'SUPER_ADMIN' || 
                                     user?.role === 'SYS_ADMIN' || 
                                     user?.role === 'REGION_ADMIN' || 
                                     user?.role === 'BHAWANIPATNA_ADMIN';
                return (
                  <>
              <Field label="Vehicle Number *">
                <input 
                  type="text" 
                  required 
                  value={form.truckPlate} 
                  onChange={(e) => isFieldAdmin ? setForm({ ...form, truckPlate: e.target.value }) : undefined} 
                  readOnly={!isFieldAdmin}
                  className={`unload-input font-mono font-bold ${!isFieldAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  placeholder="e.g. OD08Z6368"
                />
              </Field>
              <Field label="Truck Status *">
                <select required value={form.truckStatus} onChange={(e) => setForm({ ...form, truckStatus: e.target.value as TruckStatus })} className={`unload-input ${getOperationalStatusClasses(form.truckStatus)}`}>
                  {TRUCK_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Received Qty *"><input type="number" step="0.01" required value={form.receivedQty} onChange={(e) => isFieldAdmin ? setForm({ ...form, receivedQty: e.target.value }) : undefined} readOnly={!isFieldAdmin} className={`unload-input font-mono font-bold ${!isFieldAdmin ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`} /></Field>
                <Field label="Date & Time of Unloading *"><input type="datetime-local" required value={form.unloadingDateTime} onChange={(e) => setForm({ ...form, unloadingDateTime: e.target.value })} className="unload-input" /></Field>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Calculated Turnaround Time</div>
                <div className="mt-2 text-lg font-extrabold text-slate-800">
                  {form.truckStatus !== 'RECEIVED'
                    ? formatTurnaround(Math.max(0, Math.round((Date.now() - new Date(activeRecord.loadingDateTime).getTime()) / 60000))) + ' (Running)'
                    : formatTurnaround(Math.max(0, Math.round((new Date(form.unloadingDateTime).getTime() - new Date(activeRecord.loadingDateTime).getTime()) / 60000)))}
                </div>
              </div>
              <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-brand-success to-emerald-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                Save Unloading Entry <PackageOpen className="h-4 w-4" />
              </button>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .unload-input { width: 100%; border-radius: 0.75rem; border: 1px solid #e2e8f0; background: #f8fafc; padding: 0.625rem 0.75rem; color: #1e293b; outline: none; }
        .unload-input:focus { border-color: rgb(37 99 235 / 0.65); box-shadow: 0 0 0 1px rgb(37 99 235 / 0.2); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;
}
