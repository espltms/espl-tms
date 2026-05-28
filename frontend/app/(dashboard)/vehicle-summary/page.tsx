'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Truck } from 'lucide-react';
import { getTrips, getTrucks, getWeighTickets } from '@/app/data/dataHelper';
import {
  OperationalStatus,
  getOperationalStatusClasses,
  getOperationalStatusLabel,
  normalizeOperationalStatus,
} from '@/lib/operationalStatus';
import { fetchSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';

type TruckStatus = OperationalStatus;

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
}

interface VehicleActivityRecord {
  id: string;
  tripId?: string;
  tripNumber?: string;
  truckId?: string;
  truckPlate: string;
  model?: string;
  vendor?: string;
  subVendor?: string;
  fleetCategory?: string;
  loadedQty: number;
  receivedQty: number;
  grossWeight: number;
  tareWeight: number;
  activityDateTime: string;
  referenceNo?: string;
  uom: string;
  status: string;
  turnaroundMinutes?: number;
}

const SESSION_OPTIONS = [
  { value: 'FIRST', label: 'Session 1', range: '1-15' },
  { value: 'SECOND', label: 'Session 2', range: '16-End' },
];
const LOADING_RECORDS_KEY = 'tms_loading_records';
const VENDOR_NAMES = ['Vendor 1', 'Vendor 2', 'Vendor 3'];

const getFallbackVendorForPlate = (plateNumber: string) => {
  const total = plateNumber.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return VENDOR_NAMES[total % VENDOR_NAMES.length];
};

const formatQty = (value: number) => Number(value || 0).toLocaleString('en-IN', {
  maximumFractionDigits: 2,
});

const formatTurnaround = (minutes: number) => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '-';
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours <= 0) return `${remaining}m`;
  return `${hours}h ${remaining}m`;
};

export default function VehicleSummaryPage() {
  const { user } = useAuthStore();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [selectedSession, setSelectedSession] = useState<'FIRST' | 'SECOND'>(() => (
    new Date().getDate() <= 15 ? 'FIRST' : 'SECOND'
  ));
  const trucks = useMemo(() => getTrucks(), []);
  const [trips, setTrips] = useState(() => getTrips());
  const weighTickets = useMemo(() => getWeighTickets(), []);
  const [loadingRecords, setLoadingRecords] = useState<LoadingRecord[]>(() => readLocalValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []));

  useEffect(() => {
    fetchSyncedValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []).then(setLoadingRecords);
  }, []);

  useEffect(() => {
    if (user?.role !== 'VENDOR') return;
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('tms_token') : null;
    if (!token) return;

    fetch('/api/trips?limit=1000', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(response => response.ok ? response.json() : { data: [] })
      .then((payload) => {
        const apiTrips = (payload.data || []) as ReturnType<typeof getTrips>;
        setTrips((currentTrips) => [
          ...apiTrips,
          ...currentTrips.filter(trip => !apiTrips.some(apiTrip => apiTrip.id === trip.id || apiTrip.tripNumber === trip.tripNumber)),
        ]);
      })
      .catch(() => {});
  }, [user?.role]);

  const activityRecords = useMemo<VehicleActivityRecord[]>(() => {
    const loadedTripKeys = new Set(
      loadingRecords
        .flatMap(record => [record.tripId, record.tripNumber])
        .filter((value): value is string => Boolean(value))
    );

    const localActivities = loadingRecords.map((record) => ({
      id: record.id,
      tripId: record.tripId,
      tripNumber: record.tripNumber,
      truckId: record.truckId,
      truckPlate: record.truckPlate,
      loadedQty: record.netWeight || 0,
      receivedQty: record.receivedQty || 0,
      grossWeight: record.grossWeight || 0,
      tareWeight: record.tareWeight || 0,
      activityDateTime: record.loadingDateTime,
      referenceNo: record.challanNo || record.ticketNo,
      uom: record.uom || 'Metric Ton',
      status: normalizeOperationalStatus(record.truckStatus),
      turnaroundMinutes: record.turnaroundMinutes,
    }));

    const datasetActivities = trips
      .filter(trip => !loadedTripKeys.has(trip.id) && !loadedTripKeys.has(trip.tripNumber))
      .map((trip) => {
        const ticket = weighTickets.find(item => item.tripNo === trip.tripNumber)
          || weighTickets.find(item => item.truckPlate === trip.truck.plateNumber);
        const truck = trucks.find(item => item.id === trip.truckId || item.plateNumber === trip.truck.plateNumber);
        const loadedQty = Number(trip.actualLoadedTons || ticket?.netTons || trip.estimatedQuantityTons || 0);
        const receivedQty = Number(trip.actualDeliveredTons || 0);
        const tareWeight = Number(ticket?.tareTons || 0);
        const grossWeight = Number(ticket?.grossTons || (loadedQty && tareWeight ? loadedQty + tareWeight : 0));

        return {
          id: trip.id,
          tripId: trip.id,
          tripNumber: trip.tripNumber,
          truckId: trip.truckId,
          truckPlate: trip.truck.plateNumber,
          model: truck?.model || trip.truck.model,
          vendor: truck?.vendor || trip.vendorName || getFallbackVendorForPlate(trip.truck.plateNumber),
          subVendor: truck?.subVendor || 'Not provided in dataset',
          fleetCategory: truck?.fleetCategory === 'ATTACHED_FLEET' ? 'Attached Fleet' : 'Owned Fleet',
          loadedQty,
          receivedQty,
          grossWeight,
          tareWeight,
          activityDateTime: trip.scheduledStartDate,
          referenceNo: ticket?.ticketNo || trip.purchaseOrder?.poNumber,
          uom: 'Metric Ton',
          status: normalizeOperationalStatus(trip.status),
        };
      });

    return [...localActivities, ...datasetActivities];
  }, [loadingRecords, trips, trucks, weighTickets]);

  const sessionRecords = activityRecords.filter((record) => {
    if (!record.activityDateTime) return false;
    const loadedAt = new Date(record.activityDateTime);
    if (Number.isNaN(loadedAt.getTime())) return false;
    const monthKey = record.activityDateTime.slice(0, 7);
    const day = loadedAt.getDate();
    const matchesSession = selectedSession === 'FIRST' ? day <= 15 : day >= 16;
    return monthKey === selectedMonth && matchesSession;
  });

  const visibleSessionRecords = user?.role === 'VENDOR'
    ? sessionRecords.filter(record => (record.vendor || getFallbackVendorForPlate(record.truckPlate)) === user.vendorName)
    : sessionRecords;

  const summaries = Object.values(visibleSessionRecords.reduce<Record<string, {
    truckId: string;
    plateNumber: string;
    model: string;
    vendor: string;
    subVendor: string;
    fleetCategory: string;
    trips: Set<string>;
    totalLoadedQty: number;
    totalReceivedQty: number;
    totalGross: number;
    totalTare: number;
    completedUnloads: number;
    turnaroundMinutes: number;
    latestStatus: string;
    uom: string;
    challans: string[];
  }>>((acc, record) => {
    const truck = trucks.find(item => item.id === record.truckId || item.plateNumber === record.truckPlate);
    const trip = trips.find(item => item.id === record.tripId || item.tripNumber === record.tripNumber);
    const key = truck?.id || record.truckId || record.truckPlate;
    if (!acc[key]) {
      acc[key] = {
        truckId: key,
        plateNumber: record.truckPlate,
        model: truck?.model || record.model || trip?.truck.model || '-',
        vendor: truck?.vendor || record.vendor || trip?.vendorName || getFallbackVendorForPlate(record.truckPlate),
        subVendor: truck?.subVendor || record.subVendor || '-',
        fleetCategory: record.fleetCategory || (truck?.fleetCategory === 'ATTACHED_FLEET' ? 'Attached Fleet' : 'Owned Fleet'),
        trips: new Set<string>(),
        totalLoadedQty: 0,
        totalReceivedQty: 0,
        totalGross: 0,
        totalTare: 0,
        completedUnloads: 0,
        turnaroundMinutes: 0,
        latestStatus: normalizeOperationalStatus(record.status),
        uom: record.uom,
        challans: [],
      };
    }

    acc[key].trips.add(record.tripId || record.tripNumber || record.id);
    acc[key].totalLoadedQty += record.loadedQty || 0;
    acc[key].totalReceivedQty += record.receivedQty || 0;
    acc[key].totalGross += record.grossWeight || 0;
    acc[key].totalTare += record.tareWeight || 0;
    acc[key].latestStatus = normalizeOperationalStatus(record.status);
    acc[key].uom = record.uom || acc[key].uom;
    if (record.referenceNo) acc[key].challans.push(record.referenceNo);
    if (record.turnaroundMinutes) {
      acc[key].completedUnloads += 1;
      acc[key].turnaroundMinutes += record.turnaroundMinutes;
    }
    return acc;
  }, {})).map(summary => ({
    ...summary,
    tripCount: summary.trips.size,
    avgTurnaround: summary.completedUnloads ? Math.round(summary.turnaroundMinutes / summary.completedUnloads) : 0,
  })).sort((a, b) => b.tripCount - a.tripCount || b.totalLoadedQty - a.totalLoadedQty);

  const totals = summaries.reduce((acc, summary) => ({
    vehicles: acc.vehicles + 1,
    trips: acc.trips + summary.tripCount,
    loadedQty: acc.loadedQty + summary.totalLoadedQty,
    receivedQty: acc.receivedQty + summary.totalReceivedQty,
  }), { vehicles: 0, trips: 0, loadedQty: 0, receivedQty: 0 });

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Vehicle Summary</h2>
          <p className="text-xs text-slate-500 mt-1">Session-wise vehicle performance for 1-15 and 16-end of each month</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Month
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="ml-2 bg-transparent text-xs font-bold text-slate-800 outline-none"
            />
          </label>
          <div className="flex rounded-xl bg-slate-100 p-1">
            {SESSION_OPTIONS.map(option => (
              <button
                key={option.value}
                onClick={() => setSelectedSession(option.value as 'FIRST' | 'SECOND')}
                className={`rounded-lg px-4 py-2 text-[10px] font-extrabold transition-all ${
                  selectedSession === option.value ? 'bg-white text-brand-primary shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {option.label} ({option.range})
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard label="Vehicles Used" value={totals.vehicles.toString()} />
        <SummaryCard label="Total Trips" value={totals.trips.toString()} />
        <SummaryCard label="Loaded Qty" value={formatQty(totals.loadedQty)} />
        <SummaryCard label="Received Qty" value={formatQty(totals.receivedQty)} />
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-brand-primary" /> Session Vehicle Summary
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Trips</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Gross / Tare</th>
                <th className="px-6 py-4">Avg TAT</th>
                <th className="px-6 py-4">Challans</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                    No vehicle activity found for this month session.
                  </td>
                </tr>
              ) : summaries.map(summary => (
                <tr key={summary.truckId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="font-mono font-extrabold text-slate-800">{summary.plateNumber}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">{summary.model} | {summary.fleetCategory}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-700">{summary.vendor}</div>
                    <div className="mt-0.5 text-[10px] text-slate-400">{summary.subVendor}</div>
                  </td>
                  <td className="px-6 py-4 font-mono font-extrabold text-slate-800">{summary.tripCount}</td>
                  <td className="px-6 py-4 font-mono">
                    <div>Loaded: <span className="font-bold text-slate-800">{formatQty(summary.totalLoadedQty)} {summary.uom}</span></div>
                    <div className="text-[10px] text-slate-500">Received: {formatQty(summary.totalReceivedQty)} {summary.uom}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600">
                    {formatQty(summary.totalGross)} / {formatQty(summary.totalTare)}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{formatTurnaround(summary.avgTurnaround)}</td>
                  <td className="px-6 py-4 text-[10px] text-slate-500">{summary.challans.slice(0, 3).join(', ') || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[9px] font-bold ${getOperationalStatusClasses(summary.latestStatus)}`}>
                      {getOperationalStatusLabel(summary.latestStatus)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <CalendarDays className="h-3.5 w-3.5 text-brand-primary" />
        {label}
      </div>
      <div className="mt-3 text-2xl font-extrabold text-slate-800">{value}</div>
    </div>
  );
}
