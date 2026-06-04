'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, Truck } from 'lucide-react';
import { getTrips, getTrucks, getWeighTickets } from '@/app/data/dataHelper';
import {
  OperationalStatus,
  getOperationalStatusClasses,
  getOperationalStatusLabel,
  normalizeOperationalStatus,
  normalizeVendorName,
} from '@/lib/operationalStatus';
import { fetchSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';

type TruckStatus = OperationalStatus;

interface FuelFinanceEntry {
  id: string;
  vehicleNo: string;
  truckId: string;
  fleetCategory: 'OWNED_FLEET' | 'ATTACHED_FLEET';
  date: string;
  service: 'Diesel' | 'DEF' | 'Urea';
  quantity: number;
  rate: number;
  value: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);

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

const LOADING_RECORDS_KEY = 'tms_loading_records';
const VENDOR_NAMES = ['Eastern Stevedores', 'Mahaveer', 'Vendor 3'];

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
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedSubVendor, setSelectedSubVendor] = useState('');
  const [searchVehicleNo, setSearchVehicleNo] = useState('');

  const trucks = useMemo(() => getTrucks(), []);
  const [trips, setTrips] = useState(() => getTrips());
  const weighTickets = useMemo(() => getWeighTickets(), []);
  const [loadingRecords, setLoadingRecords] = useState<LoadingRecord[]>(() => readLocalValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []));
  const [fuelEntries, setFuelEntries] = useState<FuelFinanceEntry[]>([]);

  useEffect(() => {
    // 1. Instant local load
    setLoadingRecords(readLocalValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []));
    setFuelEntries(readLocalValue<FuelFinanceEntry[]>('tms_fuel_finance_entries', []));

    // 2. Background Database sync
    fetchSyncedValue<LoadingRecord[]>(LOADING_RECORDS_KEY, []).then(setLoadingRecords);
    fetchSyncedValue<FuelFinanceEntry[]>('tms_fuel_finance_entries', []).then(setFuelEntries);
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
          vendor: normalizeVendorName(truck?.vendor || trip.vendorName || getFallbackVendorForPlate(trip.truck.plateNumber)),
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

  const vendorOptions = useMemo(() => {
    const list = new Set(activityRecords.map(r => r.vendor || getFallbackVendorForPlate(r.truckPlate)).filter(Boolean));
    return Array.from(list).sort();
  }, [activityRecords]);

  const subVendorOptions = useMemo(() => {
    const list = new Set(activityRecords.map(r => r.subVendor).filter(Boolean).filter(sv => sv !== 'Not provided in dataset' && sv !== '-'));
    return Array.from(list).sort();
  }, [activityRecords]);

  const filteredRecords = useMemo(() => {
    return activityRecords.filter((record) => {
      if (record.activityDateTime) {
        const recordDate = new Date(record.activityDateTime.split('T')[0]);
        if (startDate) {
          const start = new Date(startDate);
          if (recordDate < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          if (recordDate > end) return false;
        }
      }

      const recordVendor = record.vendor || getFallbackVendorForPlate(record.truckPlate);
      if (selectedVendor && recordVendor !== selectedVendor) {
        return false;
      }

      if (selectedSubVendor && record.subVendor !== selectedSubVendor) {
        return false;
      }

      if (searchVehicleNo && !record.truckPlate.toUpperCase().includes(searchVehicleNo.toUpperCase())) {
        return false;
      }

      return true;
    });
  }, [activityRecords, startDate, endDate, selectedVendor, selectedSubVendor, searchVehicleNo]);

  const visibleRecords = useMemo(() => {
    let result = filteredRecords;
    if (user?.role?.startsWith('VENDOR')) {
      result = result.filter(record => 
        (record.vendor || getFallbackVendorForPlate(record.truckPlate)) === user.vendorName
      );
    }
    return result;
  }, [filteredRecords, user]);

  const summaries = Object.values(visibleRecords.reduce<Record<string, {
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
        vendor: normalizeVendorName(truck?.vendor || record.vendor || trip?.vendorName || getFallbackVendorForPlate(record.truckPlate)),
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
  }, {})).map(summary => {
    const vehicleFuelEntries = fuelEntries.filter(entry => 
      entry.vehicleNo.toUpperCase().replace(/[^A-Z0-9]/ig, '') === summary.plateNumber.toUpperCase().replace(/[^A-Z0-9]/ig, '')
    );
    
    const totalFuelValue = vehicleFuelEntries.reduce((sum, entry) => sum + (entry.value || 0), 0);
    const totalDieselValue = vehicleFuelEntries
      .filter(entry => entry.service === 'Diesel')
      .reduce((sum, entry) => sum + (entry.value || 0), 0);

    return {
      ...summary,
      tripCount: summary.trips.size,
      avgTurnaround: summary.completedUnloads ? Math.round(summary.turnaroundMinutes / summary.completedUnloads) : 0,
      totalFuelValue,
      totalDieselValue,
    };
  }).sort((a, b) => b.tripCount - a.tripCount || b.totalLoadedQty - a.totalLoadedQty);

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
          <p className="text-xs text-slate-500 mt-1">Comprehensive overview of vehicle trip and tonnage performance</p>
        </div>
      </div>

      {/* Date Range & Vendor/Sub-Vendor/Vehicle No Filter Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-5">
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Start Date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-brand-primary"
            />
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">End Date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-brand-primary"
            />
          </label>
          {user?.role !== 'VENDOR' ? (
            <label className="block">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Vendor</span>
              <select
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-brand-primary"
              >
                <option value="">All Vendors</option>
                {vendorOptions.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </label>
          ) : (
            <div className="hidden" />
          )}
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Sub Vendor</span>
            <select
              value={selectedSubVendor}
              onChange={(e) => setSelectedSubVendor(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-brand-primary"
            >
              <option value="">All Sub-Vendors</option>
              {subVendorOptions.map(sv => <option key={sv} value={sv}>{sv}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Vehicle No</span>
            <input
              type="text"
              placeholder="Search plate..."
              value={searchVehicleNo}
              onChange={(e) => setSearchVehicleNo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-brand-primary"
            />
          </label>
        </div>
        {(startDate || endDate || selectedVendor || selectedSubVendor || searchVehicleNo) && (
          <div className="flex justify-end pt-1">
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSelectedVendor('');
                setSelectedSubVendor('');
                setSearchVehicleNo('');
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.98]"
            >
              Clear Filters
            </button>
          </div>
        )}
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
            <BarChart3 className="h-4 w-4 text-brand-primary" /> Vehicle Summary Registry
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">SL.</th>
                <th className="px-6 py-4">Vehicle</th>
                <th className="px-6 py-4">Vendor</th>
                <th className="px-6 py-4">Trips</th>
                <th className="px-6 py-4">Quantity</th>
                <th className="px-6 py-4">Gross / Tare</th>
                <th className="px-6 py-4">Avg TAT</th>
                <th className="px-6 py-4">Challans</th>
                <th className="px-6 py-4 text-right">Total Diesel Value</th>
                <th className="px-6 py-4 text-right">Total Fuel Value</th>
                <th className="px-6 py-4 text-right">Running Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-10 text-center text-slate-500">
                    No vehicle activity found for this month session.
                  </td>
                </tr>
              ) : summaries.map((summary, idx) => (
                <tr key={summary.truckId} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-400">{idx + 1}</td>
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
                  <td className="px-6 py-4 font-mono font-bold text-slate-700 text-right">
                    {formatCurrency(summary.totalDieselValue)}
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-700 text-right">
                    {formatCurrency(summary.totalFuelValue)}
                  </td>
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
