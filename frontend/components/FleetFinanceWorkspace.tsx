'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Fuel, PackageOpen, Truck, Wrench } from 'lucide-react';
import { getTrucks, TruckData } from '@/app/data/dataHelper';
import {
  OPERATIONAL_STATUS_OPTIONS,
  OperationalStatus,
  getOperationalStatusClasses,
  getOperationalStatusLabel,
  normalizeOperationalStatus,
} from '@/lib/operationalStatus';
import { fetchSyncedValue, readLocalValue, saveSyncedValue } from '@/lib/syncedStorage';

type FleetCategory = 'OWNED_FLEET' | 'ATTACHED_FLEET';
type FinanceEntryType = 'REPAIR_MAINTENANCE' | 'DIESEL_ENTRY';

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
  truckStatus: OperationalStatus;
  receivedQty?: number;
  unloadingDateTime?: string;
  turnaroundMinutes?: number;
  unloadingTruckStatus?: OperationalStatus;
}

interface FleetFinanceEntry {
  id: string;
  fleetCategory: FleetCategory;
  type: FinanceEntryType;
  loadingRecordId: string;
  truckId: string;
  truckPlate: string;
  reference: string;
  description: string;
  amount: number;
  entryDate: string;
  status: OperationalStatus;
}

const LOADING_RECORDS_KEY = 'tms_loading_records';
const LOCAL_TRUCKS_KEY = 'tms_local_trucks';
const TRUCK_STATUS_OVERRIDES_KEY = 'tms_truck_status_overrides';
const FLEET_FINANCE_ENTRIES_KEY = 'tms_fleet_finance_entries';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

const getFleetLabel = (fleetCategory: FleetCategory) => (
  fleetCategory === 'OWNED_FLEET' ? 'Owned Fleet' : 'Attached Fleet'
);

const getEntryLabel = (type: FinanceEntryType) => (
  type === 'DIESEL_ENTRY' ? 'Diesel Entry' : 'Repair & Maintenance'
);

export default function FleetFinanceWorkspace({
  fleetCategory,
}: {
  fleetCategory: FleetCategory;
}) {
  const [trucks, setTrucks] = useState<TruckData[]>(() => getTrucks());
  const [loadingRecords, setLoadingRecords] = useState<LoadingRecord[]>(() => readLocalValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []));
  const [entries, setEntries] = useState<FleetFinanceEntry[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [form, setForm] = useState({
    type: (fleetCategory === 'OWNED_FLEET' ? 'DIESEL_ENTRY' : 'REPAIR_MAINTENANCE') as FinanceEntryType,
    amount: '',
    description: '',
    entryDate: new Date().toISOString().split('T')[0],
    status: 'COMPLETED' as OperationalStatus,
  });

  useEffect(() => {
    fetchSyncedValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []).then(setLoadingRecords);
    fetchSyncedValue<TruckData[]>(LOCAL_TRUCKS_KEY, []).then((syncedTrucks) => {
      setTrucks((currentTrucks) => [
        ...syncedTrucks,
        ...currentTrucks.filter(truck => !syncedTrucks.some(syncedTruck => syncedTruck.id === truck.id)),
      ]);
    });
    fetchSyncedValue<FleetFinanceEntry[]>(FLEET_FINANCE_ENTRIES_KEY, []).then((syncedEntries) => {
      setEntries(syncedEntries.filter(entry => entry.loadingRecordId && entry.truckPlate) as FleetFinanceEntry[]);
    });
  }, []);

  const hasDateFilter = Boolean(dateRange.from || dateRange.to);
  const isWithinDateRange = (dateValue?: string) => {
    if (!dateValue) return false;
    const value = new Date(dateValue);
    if (Number.isNaN(value.getTime())) return false;
    if (dateRange.from) {
      const from = new Date(`${dateRange.from}T00:00:00`);
      if (value < from) return false;
    }
    if (dateRange.to) {
      const to = new Date(`${dateRange.to}T23:59:59`);
      if (value > to) return false;
    }
    return true;
  };

  const allUnloadedVehicles = useMemo(() => loadingRecords
    .filter(record => Boolean(record.unloadingDateTime))
    .map((record) => {
      const truck = trucks.find(item => item.id === record.truckId || item.plateNumber === record.truckPlate);
      const category = truck?.fleetCategory || 'OWNED_FLEET';
      return {
        ...record,
        truck,
        fleetCategory: category as FleetCategory,
        currentStatus: normalizeOperationalStatus(record.unloadingTruckStatus || record.truckStatus),
      };
    })
    .filter(record => record.fleetCategory === fleetCategory), [fleetCategory, loadingRecords, trucks]);

  const unloadedVehicles = allUnloadedVehicles.filter(record =>
    !hasDateFilter || isWithinDateRange(record.unloadingDateTime)
  );
  const selectedRecord = unloadedVehicles.find(record => record.id === selectedRecordId) || unloadedVehicles[0];
  const filteredEntries = entries.filter(entry =>
    entry.fleetCategory === fleetCategory &&
    (!hasDateFilter || isWithinDateRange(entry.entryDate))
  );
  const repairTotal = filteredEntries
    .filter(entry => entry.type === 'REPAIR_MAINTENANCE')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const dieselTotal = filteredEntries
    .filter(entry => entry.type === 'DIESEL_ENTRY')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const completedCount = unloadedVehicles.filter(record => record.currentStatus === 'COMPLETED').length;

  const persistRecords = (nextRecords: LoadingRecord[]) => {
    saveSyncedValue(LOADING_RECORDS_KEY, nextRecords);
  };

  const persistTruckStatusOverrides = (nextRecords: LoadingRecord[], status: OperationalStatus, truckId: string) => {
    const existing = trucks.reduce<Record<string, OperationalStatus>>((acc, truck) => {
      acc[truck.id] = normalizeOperationalStatus(truck.status);
      return acc;
    }, {});
    existing[truckId] = status;
    saveSyncedValue(TRUCK_STATUS_OVERRIDES_KEY, existing);

    setTrucks(current => current.map(truck => truck.id === truckId ? { ...truck, status } : truck));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedRecord) return;

    const nextEntry: FleetFinanceEntry = {
      id: `fleet-finance-${Date.now()}`,
      fleetCategory,
      type: form.type,
      loadingRecordId: selectedRecord.id,
      truckId: selectedRecord.truckId,
      truckPlate: selectedRecord.truckPlate,
      reference: selectedRecord.challanNo || selectedRecord.ticketNo,
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      entryDate: form.entryDate,
      status: form.status,
    };
    const nextEntries = [nextEntry, ...entries];
    const nextRecords = loadingRecords.map(record => record.id === selectedRecord.id
      ? {
          ...record,
          truckStatus: form.status,
          unloadingTruckStatus: form.status,
        }
      : record
    );

    setEntries(nextEntries);
    setLoadingRecords(nextRecords);
    saveSyncedValue(FLEET_FINANCE_ENTRIES_KEY, nextEntries);
    persistRecords(nextRecords);
    persistTruckStatusOverrides(nextRecords, form.status, selectedRecord.truckId);
    setForm({
      type: fleetCategory === 'OWNED_FLEET' ? 'DIESEL_ENTRY' : 'REPAIR_MAINTENANCE',
      amount: '',
      description: '',
      entryDate: new Date().toISOString().split('T')[0],
      status: 'COMPLETED',
    });
  };

  const entryOptions: FinanceEntryType[] = fleetCategory === 'OWNED_FLEET'
    ? ['DIESEL_ENTRY', 'REPAIR_MAINTENANCE']
    : ['REPAIR_MAINTENANCE'];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">{getFleetLabel(fleetCategory)} Finance</h2>
          <p className="mt-1 text-xs text-slate-500">
            Unloaded vehicles appear here after unloading, then finance can add entries and choose the final vehicle status.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm">
          {unloadedVehicles.length} unloaded vehicle{unloadedVehicles.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard label="Repair & Maintenance" value={formatCurrency(repairTotal)} icon={<Wrench className="h-4 w-4" />} />
        {fleetCategory === 'OWNED_FLEET' && (
          <SummaryCard label="Diesel Entry" value={formatCurrency(dieselTotal)} icon={<Fuel className="h-4 w-4" />} />
        )}
        <SummaryCard label="Completed Vehicles" value={`${completedCount}/${unloadedVehicles.length}`} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-2">
          <div className="border-b border-slate-100 px-6 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
                <PackageOpen className="h-4 w-4 text-brand-primary" /> Unloaded Vehicles
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Unloading Date</span>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(event) => setDateRange({ ...dateRange, from: event.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 outline-none focus:border-brand-primary"
                />
                <span className="text-[10px] font-bold text-slate-400">to</span>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(event) => setDateRange({ ...dateRange, to: event.target.value })}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-semibold text-slate-600 outline-none focus:border-brand-primary"
                />
                {hasDateFilter && (
                  <button
                    onClick={() => {
                      setDateRange({ from: '', to: '' });
                      setSelectedRecordId('');
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-50"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400">
                  <th className="px-6 py-3 uppercase tracking-wider">Vehicle</th>
                  <th className="px-6 py-3 uppercase tracking-wider">Trip / Challan</th>
                  <th className="px-6 py-3 uppercase tracking-wider">Received Qty</th>
                  <th className="px-6 py-3 uppercase tracking-wider">Unloaded At</th>
                  <th className="px-6 py-3 text-right uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {unloadedVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                      {hasDateFilter
                        ? 'No unloaded vehicles found for this date range.'
                        : `No unloaded ${getFleetLabel(fleetCategory).toLowerCase()} vehicles yet.`}
                    </td>
                  </tr>
                ) : unloadedVehicles.map(record => (
                  <tr
                    key={record.id}
                    onClick={() => setSelectedRecordId(record.id)}
                    className={`cursor-pointer hover:bg-slate-50 ${selectedRecord?.id === record.id ? 'bg-brand-primary/5' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-slate-400" />
                        <div>
                          <div className="font-mono font-extrabold text-slate-800">{record.truckPlate}</div>
                          <div className="text-[10px] text-slate-400">{record.truck?.model || 'Vehicle model not set'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-slate-800">{record.tripNumber || record.tripId || 'TRIP-REF'}</div>
                      <div className="text-[10px] text-slate-400">Challan: {record.challanNo || '-'}</div>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">
                      {Number(record.receivedQty || record.netWeight || 0).toFixed(2)} {record.uom}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {record.unloadingDateTime ? new Date(record.unloadingDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${getOperationalStatusClasses(record.currentStatus)}`}>
                        {getOperationalStatusLabel(record.currentStatus)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Finance Entry</h3>
          <p className="mt-1 text-[10px] font-semibold text-slate-400">
            Select an unloaded vehicle, add amount, then choose the status.
          </p>

          <div className="mt-5 space-y-4 text-xs">
            <Field label="Unloaded Vehicle">
              <select
                required
                value={selectedRecord?.id || ''}
                onChange={(event) => setSelectedRecordId(event.target.value)}
                className="fleet-finance-input"
              >
                {unloadedVehicles.map(record => (
                  <option key={record.id} value={record.id}>
                    {record.truckPlate} - {record.challanNo || record.ticketNo}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Entry Type">
              <select
                required
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as FinanceEntryType })}
                className="fleet-finance-input"
              >
                {entryOptions.map(option => (
                  <option key={option} value={option}>{getEntryLabel(option)}</option>
                ))}
              </select>
            </Field>
            <Field label="Amount">
              <input
                required
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                className="fleet-finance-input font-mono font-bold"
                placeholder="0.00"
              />
            </Field>
            <Field label="Description">
              <input
                required
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="fleet-finance-input"
                placeholder={form.type === 'DIESEL_ENTRY' ? 'Fuel slip / diesel details' : 'Repair or maintenance details'}
              />
            </Field>
            <Field label="Entry Date">
              <input
                required
                type="date"
                value={form.entryDate}
                onChange={(event) => setForm({ ...form, entryDate: event.target.value })}
                className="fleet-finance-input"
              />
            </Field>
            <Field label="Vehicle Status">
              <select
                required
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as OperationalStatus })}
                className={`fleet-finance-input ${getOperationalStatusClasses(form.status)}`}
              >
                {OPERATIONAL_STATUS_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </Field>
            <button
              type="submit"
              disabled={!selectedRecord}
              className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-4 py-3 text-xs font-extrabold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save Entry & Update Status
            </button>
          </div>
        </form>
      </div>

      {filteredEntries.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Finance Ledger</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400">
                  <th className="px-6 py-3 uppercase tracking-wider">Vehicle</th>
                  <th className="px-6 py-3 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-right uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {filteredEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3 font-mono font-bold text-slate-800">{entry.truckPlate}</td>
                    <td className="px-6 py-3 font-semibold text-slate-700">{getEntryLabel(entry.type)}</td>
                    <td className="px-6 py-3">{entry.description}</td>
                    <td className="px-6 py-3 text-slate-400">{new Date(entry.entryDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-6 py-3">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[9px] font-bold ${getOperationalStatusClasses(entry.status)}`}>
                        {getOperationalStatusLabel(entry.status)}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-bold text-slate-800">{formatCurrency(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style jsx global>{`
        .fleet-finance-input { width: 100%; border-radius: 0.75rem; border: 1px solid #e2e8f0; background: #f8fafc; padding: 0.625rem 0.75rem; color: #1e293b; outline: none; }
        .fleet-finance-input:focus { border-color: rgb(37 99 235 / 0.65); box-shadow: 0 0 0 1px rgb(37 99 235 / 0.2); }
      `}</style>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span className="text-brand-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-extrabold text-slate-800">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}
