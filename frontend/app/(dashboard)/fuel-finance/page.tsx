'use client';

import { useEffect, useState, useMemo } from 'react';
import { Fuel, Plus, Info, Trash2, Calendar, BadgeCent, Percent, Layers } from 'lucide-react';
import { getTrucks, TruckData } from '@/app/data/dataHelper';
import { fetchSyncedValue, saveSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import { isMatchingDestination } from '@/lib/workflowAutomation';

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

const FUEL_FINANCES_KEY = 'tms_fuel_finance_entries';

export default function FuelFinancesPage() {
  const { user } = useAuthStore();
  const [trucks, setTrucks] = useState<TruckData[]>(() => getTrucks());
  const [assignedTrips, setAssignedTrips] = useState<any[]>([]);
  const [entries, setEntries] = useState<FuelFinanceEntry[]>([]);
  
  // Form states
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [service, setService] = useState<'Diesel' | 'DEF' | 'Urea'>('Diesel');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');

  useEffect(() => {
    fetchSyncedValue<FuelFinanceEntry[]>(FUEL_FINANCES_KEY, []).then(setEntries);
    fetchSyncedValue<any[]>('tms_assigned_trips', []).then(setAssignedTrips);
  }, []);

  const isRegionalUser = user?.role === 'REGION_ADMIN' || 
                         user?.role === 'PARAMANANDPUR_ADMIN' || 
                         user?.role === 'DHARAMGARH_ADMIN' ||
                         user?.role === 'BHAWANIPATNA_ADMIN';
  const userRegion = user?.role === 'PARAMANANDPUR_ADMIN'
    ? 'Paramanandpur' 
    : user?.role === 'DHARAMGARH_ADMIN' 
      ? 'Dharamgarh' 
      : user?.role === 'BHAWANIPATNA_ADMIN'
        ? 'Bhawanipatna'
        : user?.regionName;

  // Filter trucks for dropdown menu
  const dropdownTrucks = useMemo(() => {
    return trucks.filter(truck => {
      if (isRegionalUser && userRegion) {
        const trip = assignedTrips.find(t => t.truckId === truck.id || t.truck?.plateNumber === truck.plateNumber);
        return trip && isMatchingDestination(trip.destination, userRegion);
      }
      return true;
    });
  }, [trucks, isRegionalUser, userRegion, assignedTrips]);

  // Set default selected truck
  useEffect(() => {
    if (dropdownTrucks.length > 0 && !selectedTruckId) {
      setSelectedTruckId(dropdownTrucks[0].id);
    }
  }, [dropdownTrucks, selectedTruckId]);

  const selectedTruck = useMemo(() => {
    return trucks.find(t => t.id === selectedTruckId);
  }, [trucks, selectedTruckId]);

  const resolvedFleetCategory = useMemo(() => {
    return selectedTruck?.fleetCategory || 'OWNED_FLEET';
  }, [selectedTruck]);

  // Auto-calculated value
  const computedValue = useMemo(() => {
    const qtyNum = parseFloat(quantity) || 0;
    const rateNum = parseFloat(rate) || 0;
    return qtyNum * rateNum;
  }, [quantity, rate]);

  // Filtered entries for table rendering
  const filteredEntries = useMemo(() => {
    return entries.filter(entry => {
      if (isRegionalUser && userRegion) {
        const trip = assignedTrips.find(t => t.truckId === entry.truckId || t.truck?.plateNumber === entry.vehicleNo);
        if (trip) {
          return isMatchingDestination(trip.destination, userRegion);
        }
        return false;
      }
      return true;
    });
  }, [entries, isRegionalUser, userRegion, assignedTrips]);

  const summaryStats = useMemo(() => {
    const dieselTotal = filteredEntries
      .filter(e => e.service === 'Diesel')
      .reduce((sum, e) => sum + e.value, 0);
    const defTotal = filteredEntries
      .filter(e => e.service === 'DEF')
      .reduce((sum, e) => sum + e.value, 0);
    const ureaTotal = filteredEntries
      .filter(e => e.service === 'Urea')
      .reduce((sum, e) => sum + e.value, 0);
    return {
      dieselTotal,
      defTotal,
      ureaTotal,
      totalSpend: dieselTotal + defTotal + ureaTotal,
    };
  }, [filteredEntries]);

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTruck) return;

    const newEntry: FuelFinanceEntry = {
      id: `fuel-entry-${Date.now()}`,
      vehicleNo: selectedTruck.plateNumber,
      truckId: selectedTruck.id,
      fleetCategory: resolvedFleetCategory,
      date,
      service,
      quantity: parseFloat(quantity) || 0,
      rate: parseFloat(rate) || 0,
      value: computedValue,
    };

    const nextEntries = [newEntry, ...entries];
    setEntries(nextEntries);
    saveSyncedValue(FUEL_FINANCES_KEY, nextEntries);

    // Reset quantity and rate inputs
    setQuantity('');
    setRate('');
  };

  const handleDeleteEntry = (id: string) => {
    const nextEntries = entries.filter(e => e.id !== id);
    setEntries(nextEntries);
    saveSyncedValue(FUEL_FINANCES_KEY, nextEntries);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Fuel & Consumables Finances</h2>
          <p className="text-xs text-slate-500 mt-1">Manage and audit diesel, DEF, and urea transactions and consumption across your active fleet</p>
        </div>
      </div>

      {/* Metrics overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Fuel Spend</span>
          <div className="mt-3 text-2xl font-extrabold text-slate-800">{formatCurrency(summaryStats.totalSpend)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Diesel Expenses</span>
          <div className="mt-3 text-2xl font-extrabold text-emerald-600">{formatCurrency(summaryStats.dieselTotal)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">DEF Expenses</span>
          <div className="mt-3 text-2xl font-extrabold text-blue-600">{formatCurrency(summaryStats.defTotal)}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Urea Expenses</span>
          <div className="mt-3 text-2xl font-extrabold text-purple-600">{formatCurrency(summaryStats.ureaTotal)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Entry Table list */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm xl:col-span-2">
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Fuel className="h-4 w-4 text-emerald-600" /> Fuel Transaction Log
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="px-6 py-4">Vehicle No</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Service</th>
                  <th className="px-6 py-4">Qty (L)</th>
                  <th className="px-6 py-4">Rate (₹)</th>
                  <th className="px-6 py-4">Total Value</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      No fuel transactions recorded for this regional scope.
                    </td>
                  </tr>
                ) : filteredEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-extrabold text-slate-800 font-mono tracking-wider">{entry.vehicleNo}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${
                        entry.fleetCategory === 'OWNED_FLEET'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {entry.fleetCategory === 'OWNED_FLEET' ? 'Owned' : 'Attached'}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-700">{entry.service}</td>
                    <td className="px-6 py-4 font-mono">{entry.quantity.toFixed(1)} L</td>
                    <td className="px-6 py-4 font-mono">₹{entry.rate.toFixed(2)}</td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-800">{formatCurrency(entry.value)}</td>
                    <td className="px-6 py-4 text-slate-400 font-mono">{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => handleDeleteEntry(entry.id)} 
                        className="rounded-lg p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 transition-all"
                        title="Delete Entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleAddEntry} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-fit">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Plus className="h-4 w-4 text-brand-primary" /> Record Fuel Entry
          </h3>
          <p className="mt-1 text-[10px] font-semibold text-slate-400 uppercase">Input dispatch fueling details</p>

          <div className="mt-5 space-y-4 text-xs">
            <div>
              <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Vehicle No *</label>
              {dropdownTrucks.length === 0 ? (
                <div className="flex items-center gap-1.5 rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-700 font-semibold">
                  <Info className="h-4 w-4" /> No regional vehicles in transit.
                </div>
              ) : (
                <select
                  required
                  value={selectedTruckId}
                  onChange={(e) => setSelectedTruckId(e.target.value)}
                  className="fuel-input font-mono uppercase"
                >
                  {dropdownTrucks.map(truck => (
                    <option key={truck.id} value={truck.id}>
                      {truck.plateNumber} ({truck.model})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px] flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-slate-400" /> Fleet Category (Auto-resolved)
              </label>
              <input
                type="text"
                disabled
                value={resolvedFleetCategory === 'OWNED_FLEET' ? 'Owned Fleet' : 'Attached Fleet'}
                className="fuel-input bg-slate-100 font-semibold text-slate-500 cursor-not-allowed border-slate-200"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px] flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Date *
              </label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="fuel-input"
              />
            </div>

            <div>
              <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Select Service *</label>
              <select
                required
                value={service}
                onChange={(e) => setService(e.target.value as any)}
                className="fuel-input"
              >
                <option value="Diesel">Diesel</option>
                <option value="DEF">DEF</option>
                <option value="Urea">Urea</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Quantity (Liters) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="fuel-input font-mono"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Rate per Liter (₹) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="fuel-input font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px] flex items-center gap-1">
                <BadgeCent className="h-3.5 w-3.5 text-slate-400" /> Total Value (Auto-calculated)
              </label>
              <div className="fuel-input bg-slate-50 font-mono font-bold text-slate-800 text-sm border-dashed">
                {formatCurrency(computedValue)}
              </div>
            </div>

            <button
              type="submit"
              disabled={dropdownTrucks.length === 0}
              className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-4 py-3 text-xs font-extrabold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Fuel className="h-4.5 w-4.5" /> Save Fuel Record
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .fuel-input { width: 100%; border-radius: 0.75rem; border: 1px solid #e2e8f0; background: #f8fafc; padding: 0.625rem 0.75rem; color: #1e293b; outline: none; }
        .fuel-input:focus { border-color: rgb(37 99 235 / 0.65); box-shadow: 0 0 0 1px rgb(37 99 235 / 0.2); }
      `}</style>
    </div>
  );
}
