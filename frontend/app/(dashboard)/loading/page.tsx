'use client';

import { useEffect, useState } from 'react';
import { PackageCheck, Plus, Truck, X } from 'lucide-react';
import { getTrips, getTrucks } from '@/app/data/dataHelper';
import { fetchSyncedValue, readLocalValue, saveSyncedValue } from '@/lib/syncedStorage';

type TruckStatus = 'AVAILABLE' | 'ON_TRIP' | 'MAINTENANCE' | 'IN_TRANSIT' | 'RECEIVED' | 'ACTION';

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

interface AssignedTrip {
  id: string;
  tripNumber: string;
  truckId?: string;
  source: string;
  destination: string;
  estimatedQuantityTons: number;
  status?: string;
  driver: { fullName: string; phone: string };
  truck: { plateNumber: string; model: string };
  purchaseOrder: { poNumber: string; clientName: string; commodity: string };
}

const UOM_OPTIONS = ['Kg', 'Bags', 'Cases', 'Metric Ton', 'No.', 'Bulk'];
const TRUCK_STATUS_OPTIONS: { value: TruckStatus; label: string }[] = [
  { value: 'IN_TRANSIT', label: 'In transit' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'ACTION', label: 'Action' },
];
const LOADING_RECORDS_KEY = 'tms_loading_records';
const TRUCK_STATUS_OVERRIDES_KEY = 'tms_truck_status_overrides';
const ASSIGNED_TRIPS_KEY = 'tms_assigned_trips';

const emptyLoadingForm = {
  tripId: '',
  tareWeight: '',
  grossWeight: '',
  netWeight: '',
  loadingDateTime: new Date().toISOString().slice(0, 16),
  ticketNo: '',
  challanNo: '',
  uom: 'Metric Ton',
  truckStatus: 'IN_TRANSIT' as TruckStatus,
};

export default function LoadingVehiclePage() {
  const [trucks, setTrucks] = useState<TruckData[]>(() => getTrucks());
  const [assignedTrips, setAssignedTrips] = useState<AssignedTrip[]>(() => getTrips());
  const [records, setRecords] = useState<LoadingRecord[]>(() => readLocalValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []));
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyLoadingForm);

  useEffect(() => {
    fetchSyncedValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []).then(setRecords);
    fetchSyncedValue<AssignedTrip[]>(ASSIGNED_TRIPS_KEY, []).then((syncedTrips) => {
      setAssignedTrips((currentTrips) => [
        ...syncedTrips,
        ...currentTrips.filter(trip => !syncedTrips.some(syncedTrip => syncedTrip.id === trip.id)),
      ]);
    });
  }, []);

  const selectedTrip = assignedTrips.find(trip => trip.id === form.tripId);
  const selectedTruck = selectedTrip
    ? trucks.find(truck => truck.id === selectedTrip.truckId || truck.plateNumber === selectedTrip.truck.plateNumber)
    : undefined;
  const availableTrips = assignedTrips.filter(trip =>
    !records.some(record => record.tripId === trip.id) &&
    !['COMPLETED', 'CANCELLED'].includes(trip.status || '')
  );

  const normalizeTruckStatus = (status: TruckStatus) => {
    if (status === 'ON_TRIP') return 'IN_TRANSIT';
    if (status === 'MAINTENANCE') return 'ACTION';
    if (status === 'AVAILABLE') return 'RECEIVED';
    return status;
  };

  const getTruckStatusStyle = (status: TruckStatus) => {
    const normalized = normalizeTruckStatus(status);
    if (normalized === 'IN_TRANSIT') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (normalized === 'RECEIVED') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-amber-50 text-amber-700 border-amber-200';
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

  const handleNumberChange = (field: 'tareWeight' | 'grossWeight' | 'netWeight', value: string) => {
    const nextForm = { ...form, [field]: value };
    if (field === 'tareWeight' || field === 'grossWeight') {
      const tare = parseFloat(field === 'tareWeight' ? value : nextForm.tareWeight) || 0;
      const gross = parseFloat(field === 'grossWeight' ? value : nextForm.grossWeight) || 0;
      nextForm.netWeight = gross > tare ? (gross - tare).toFixed(2) : '0.00';
    }
    setForm(nextForm);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTruck || !selectedTrip) return;

    const newRecord: LoadingRecord = {
      id: `loading-${Date.now()}`,
      tripId: selectedTrip.id,
      tripNumber: selectedTrip.tripNumber,
      truckId: selectedTruck.id,
      truckPlate: selectedTruck.plateNumber,
      tareWeight: parseFloat(form.tareWeight) || 0,
      grossWeight: parseFloat(form.grossWeight) || 0,
      netWeight: parseFloat(form.netWeight) || 0,
      loadingDateTime: form.loadingDateTime,
      ticketNo: form.ticketNo,
      challanNo: form.challanNo,
      uom: form.uom,
      truckStatus: form.truckStatus,
    };
    const nextRecords = [newRecord, ...records];
    const nextTrucks = trucks.map(truck => truck.id === selectedTruck.id ? { ...truck, status: form.truckStatus } : truck);

    setRecords(nextRecords);
    setTrucks(nextTrucks);
    persistRecords(nextRecords);
    persistTruckStatusOverrides(nextTrucks);
    setShowModal(false);
    setForm(emptyLoadingForm);
  };

  const openLoadingForTrip = (tripId = '') => {
    const trip = assignedTrips.find(item => item.id === tripId);
    const truck = trip ? trucks.find(item => item.id === trip.truckId || item.plateNumber === trip.truck.plateNumber) : undefined;
    setForm({
      ...emptyLoadingForm,
      tripId,
      truckStatus: truck ? normalizeTruckStatus(truck.status) : emptyLoadingForm.truckStatus,
    });
    setShowModal(true);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Loading Vehicle</h2>
          <p className="text-xs text-slate-500 mt-1">Select an assigned trip, then capture loading weights, ticket details, challan number, U.O.M, and truck status</p>
        </div>
        <button onClick={() => openLoadingForTrip()} className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 shadow-md">
          <Plus className="h-4 w-4" /> Add Loading Entry
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Truck className="h-4 w-4 text-brand-primary" /> Assigned Trips Ready for Loading
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Trip Details</th>
                <th className="px-6 py-4">Contract</th>
                <th className="px-6 py-4">Truck & Driver</th>
                <th className="px-6 py-4">Planned Qty</th>
                <th className="px-6 py-4 text-right">Loading</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {availableTrips.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No assigned trips waiting for loading.</td>
                </tr>
              ) : availableTrips.map(trip => (
                <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-mono font-extrabold text-slate-800">{trip.tripNumber}</div>
                    <div className="mt-1 text-[10px] text-slate-500">{trip.source} to {trip.destination}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">{trip.purchaseOrder.poNumber}</div>
                    <div className="mt-0.5 text-[10px] text-brand-primary">{trip.purchaseOrder.commodity}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-mono font-bold text-slate-800">{trip.truck.plateNumber}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500">{trip.driver.fullName}</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-700">{trip.estimatedQuantityTons} Tons</td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openLoadingForTrip(trip.id)}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[10px] font-extrabold text-blue-700 hover:bg-blue-100"
                    >
                      Load
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-brand-primary" /> Loading Records
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Trip / Vehicle</th>
                <th className="px-6 py-4">Ticket / Challan</th>
                <th className="px-6 py-4">Weights</th>
                <th className="px-6 py-4">U.O.M</th>
                <th className="px-6 py-4">Loading Time</th>
                <th className="px-6 py-4 text-right">Truck Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {records.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No loading records added yet.</td></tr>
              ) : records.map(record => (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-mono font-extrabold text-slate-800">{record.tripNumber || 'TRIP-REF'}</div>
                    <div className="mt-0.5 text-[10px] text-slate-500 font-mono">{record.truckPlate}</div>
                  </td>
                  <td className="px-6 py-4"><div className="font-mono font-bold text-slate-700">{record.ticketNo}</div><div className="mt-0.5 text-[10px] text-slate-400">Challan: {record.challanNo}</div></td>
                  <td className="px-6 py-4 font-mono"><div>Gross: <span className="font-bold text-slate-800">{record.grossWeight.toFixed(2)}</span></div><div className="text-[10px] text-slate-500">Tare: {record.tareWeight.toFixed(2)} | Net: {record.netWeight.toFixed(2)}</div></td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{record.uom}</td>
                  <td className="px-6 py-4 text-slate-500">{new Date(record.loadingDateTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                  <td className="px-6 py-4 text-right"><span className={`inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${getTruckStatusStyle(record.truckStatus)}`}>{TRUCK_STATUS_OPTIONS.find(option => option.value === normalizeTruckStatus(record.truckStatus))?.label || record.truckStatus}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div><h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Loading Vehicle</h3></div>
              <button onClick={() => { setShowModal(false); setForm(emptyLoadingForm); }} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all"><X className="h-4 w-4" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Assigned Trip *">
                  <select required value={form.tripId} onChange={(e) => {
                    const trip = assignedTrips.find(item => item.id === e.target.value);
                    const truck = trip ? trucks.find(item => item.id === trip.truckId || item.plateNumber === trip.truck.plateNumber) : undefined;
                    setForm({ ...form, tripId: e.target.value, truckStatus: truck ? normalizeTruckStatus(truck.status) : form.truckStatus });
                  }} className="load-input">
                    <option value="">Choose assigned trip...</option>
                    {availableTrips.map(trip => (
                      <option key={trip.id} value={trip.id}>
                        {trip.tripNumber} - {trip.truck.plateNumber} - {trip.purchaseOrder.commodity}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Truck Status *">
                  <select required value={form.truckStatus} onChange={(e) => setForm({ ...form, truckStatus: e.target.value as TruckStatus })} className="load-input">
                    {TRUCK_STATUS_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
              </div>
              {selectedTrip && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="grid grid-cols-1 gap-3 text-[11px] md:grid-cols-3">
                    <div><span className="block text-slate-400 font-bold uppercase">Truck</span><span className="font-mono font-bold text-slate-800">{selectedTrip.truck.plateNumber}</span></div>
                    <div><span className="block text-slate-400 font-bold uppercase">Driver</span><span className="font-bold text-slate-800">{selectedTrip.driver.fullName}</span></div>
                    <div><span className="block text-slate-400 font-bold uppercase">Commodity</span><span className="font-bold text-slate-800">{selectedTrip.purchaseOrder.commodity}</span></div>
                    <div className="md:col-span-2"><span className="block text-slate-400 font-bold uppercase">Route</span><span className="font-bold text-slate-800">{selectedTrip.source} to {selectedTrip.destination}</span></div>
                    <div><span className="block text-slate-400 font-bold uppercase">Planned Qty</span><span className="font-mono font-bold text-slate-800">{selectedTrip.estimatedQuantityTons} Tons</span></div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Field label="Tare Weight *"><input type="number" step="0.01" required value={form.tareWeight} onChange={(e) => handleNumberChange('tareWeight', e.target.value)} className="load-input font-mono font-bold" /></Field>
                <Field label="Gross Weight *"><input type="number" step="0.01" required value={form.grossWeight} onChange={(e) => handleNumberChange('grossWeight', e.target.value)} className="load-input font-mono font-bold" /></Field>
                <Field label="Net Weight *"><input type="number" step="0.01" required value={form.netWeight} onChange={(e) => handleNumberChange('netWeight', e.target.value)} className="load-input font-mono font-bold" /></Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Time & Date of Loading *"><input type="datetime-local" required value={form.loadingDateTime} onChange={(e) => setForm({ ...form, loadingDateTime: e.target.value })} className="load-input" /></Field>
                <Field label="U.O.M *"><select required value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} className="load-input">{UOM_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></Field>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Ticket No. *"><input type="text" required value={form.ticketNo} onChange={(e) => setForm({ ...form, ticketNo: e.target.value.toUpperCase() })} className="load-input uppercase font-mono" /></Field>
                <Field label="Challan No. *"><input type="text" required value={form.challanNo} onChange={(e) => setForm({ ...form, challanNo: e.target.value.toUpperCase() })} className="load-input uppercase font-mono" /></Field>
              </div>
              <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                Save Loading Entry <PackageCheck className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      <style jsx global>{`
        .load-input { width: 100%; border-radius: 0.75rem; border: 1px solid #e2e8f0; background: #f8fafc; padding: 0.625rem 0.75rem; color: #1e293b; outline: none; }
        .load-input:focus { border-color: rgb(37 99 235 / 0.65); box-shadow: 0 0 0 1px rgb(37 99 235 / 0.2); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;
}
