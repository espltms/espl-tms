'use client';

import { useEffect, useState } from 'react';
import { PackageOpen, X } from 'lucide-react';
import { getTrucks } from '@/app/data/dataHelper';
import {
  OPERATIONAL_STATUS_OPTIONS,
  OperationalStatus,
  getOperationalStatusClasses,
} from '@/lib/operationalStatus';
import { fetchSyncedValue, readLocalValue, saveSyncedValue } from '@/lib/syncedStorage';

type TruckStatus = OperationalStatus;

interface TruckData {
  id: string;
  plateNumber: string;
  model: string;
  status: TruckStatus;
}

interface LoadingRecord {
  id: string;
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

const TRUCK_STATUS_OPTIONS = OPERATIONAL_STATUS_OPTIONS;
const LOADING_RECORDS_KEY = 'tms_loading_records';
const TRUCK_STATUS_OVERRIDES_KEY = 'tms_truck_status_overrides';

const emptyUnloadingForm = {
  truckStatus: 'RECEIVED' as TruckStatus,
  receivedQty: '',
  unloadingDateTime: new Date().toISOString().slice(0, 16),
};

export default function UnloadingVehiclePage() {
  const [trucks, setTrucks] = useState<TruckData[]>(() => getTrucks());
  const [records, setRecords] = useState<LoadingRecord[]>(() => readLocalValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []));
  const [activeRecord, setActiveRecord] = useState<LoadingRecord | null>(null);
  const [form, setForm] = useState(emptyUnloadingForm);

  useEffect(() => {
    fetchSyncedValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []).then(setRecords);
  }, []);

  const formatTurnaround = (minutes?: number) => {
    if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return 'Pending';
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours <= 0) return `${remainingMinutes}m`;
    return `${hours}h ${remainingMinutes}m`;
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

  const openUnloadingModal = (record: LoadingRecord) => {
    setActiveRecord(record);
    setForm({
      truckStatus: record.unloadingTruckStatus || 'RECEIVED',
      receivedQty: record.receivedQty?.toString() || record.netWeight.toString(),
      unloadingDateTime: record.unloadingDateTime || new Date().toISOString().slice(0, 16),
    });
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeRecord) return;

    const loadingTime = new Date(activeRecord.loadingDateTime).getTime();
    const unloadingTime = new Date(form.unloadingDateTime).getTime();
    const turnaroundMinutes = Math.max(0, Math.round((unloadingTime - loadingTime) / 60000));
    const nextRecords = records.map(record =>
      record.id === activeRecord.id
        ? {
            ...record,
            receivedQty: parseFloat(form.receivedQty) || 0,
            unloadingDateTime: form.unloadingDateTime,
            turnaroundMinutes,
            unloadingTruckStatus: form.truckStatus,
            truckStatus: form.truckStatus,
          }
        : record
    );
    const nextTrucks = trucks.map(truck => truck.id === activeRecord.truckId ? { ...truck, status: form.truckStatus } : truck);

    setRecords(nextRecords);
    setTrucks(nextTrucks);
    persistRecords(nextRecords);
    persistTruckStatusOverrides(nextTrucks);
    setActiveRecord(null);
    setForm(emptyUnloadingForm);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Unloading Vehicle</h2>
        <p className="text-xs text-slate-500 mt-1">Update loaded vehicle records with received quantity, unloading time, truck status, and turnaround time</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <PackageOpen className="h-4 w-4 text-brand-primary" /> Pending & Completed Unloading
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">Loading Ref</th>
                <th className="px-6 py-4">Loaded Qty</th>
                <th className="px-6 py-4">Unloading</th>
                <th className="px-6 py-4">Turnaround</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {records.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No loading records available for unloading.</td></tr>
              ) : records.map(record => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono font-extrabold text-slate-800">{record.truckPlate}</td>
                  <td className="px-6 py-4"><div className="font-mono font-bold text-slate-700">{record.ticketNo}</div><div className="mt-0.5 text-[10px] text-slate-400">Challan: {record.challanNo}</div></td>
                  <td className="px-6 py-4 font-mono">{record.netWeight.toFixed(2)} {record.uom}</td>
                  <td className="px-6 py-4">
                    {record.unloadingDateTime ? (
                      <div><div className="font-mono font-bold text-slate-700">{record.receivedQty?.toFixed(2)} {record.uom}</div><div className="mt-0.5 text-[10px] text-slate-500">{new Date(record.unloadingDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</div></div>
                    ) : <span className="text-slate-400">Pending</span>}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{formatTurnaround(record.turnaroundMinutes)}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openUnloadingModal(record)} className={`rounded-lg border px-3 py-1.5 text-[10px] font-extrabold ${record.unloadingDateTime ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>
                      {record.unloadingDateTime ? 'Edit' : 'Unload'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activeRecord && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Unloading Vehicle</h3>
                <p className="mt-0.5 text-[10px] font-semibold uppercase text-slate-500">{activeRecord.truckPlate}</p>
              </div>
              <button onClick={() => { setActiveRecord(null); setForm(emptyUnloadingForm); }} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <Field label="Truck Status *">
                <select required value={form.truckStatus} onChange={(e) => setForm({ ...form, truckStatus: e.target.value as TruckStatus })} className={`unload-input ${getOperationalStatusClasses(form.truckStatus)}`}>
                  {TRUCK_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Received Qty *"><input type="number" step="0.01" required value={form.receivedQty} onChange={(e) => setForm({ ...form, receivedQty: e.target.value })} className="unload-input font-mono font-bold" /></Field>
                <Field label="Date & Time of Unloading *"><input type="datetime-local" required value={form.unloadingDateTime} onChange={(e) => setForm({ ...form, unloadingDateTime: e.target.value })} className="unload-input" /></Field>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Calculated Turnaround Time</div>
                <div className="mt-2 text-lg font-extrabold text-slate-800">{formatTurnaround(Math.max(0, Math.round((new Date(form.unloadingDateTime).getTime() - new Date(activeRecord.loadingDateTime).getTime()) / 60000)))}</div>
              </div>
              <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-brand-success to-emerald-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                Save Unloading Entry <PackageOpen className="h-4 w-4" />
              </button>
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
