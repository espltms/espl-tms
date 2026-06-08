'use client';

import { useEffect, useState, useMemo } from 'react';
import { Fuel, Plus, Info, Trash2, Calendar, BadgeCent, Percent, Layers } from 'lucide-react';
import { getTrucks, TruckData } from '@/app/data/dataHelper';
import { fetchSyncedValue, saveSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import { isMatchingDestination } from '@/lib/workflowAutomation';
import { normalizeVendorName } from '@/lib/operationalStatus';
import SectionExcelExport from '@/components/SectionExcelExport';
import SectionExcelImport from '@/components/SectionExcelImport';

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

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

const parseImportedDateToYYYYMMDD = (value: string | number | undefined | null): string => {
  if (value === undefined || value === null) return '';
  const str = String(value).trim();
  if (!str || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return '';
  }

  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 100000) {
    const jsDate = new Date((num - 25569) * 86400 * 1000);
    return jsDate.toISOString().split('T')[0];
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) {
    const parts = str.replace(/[/\s.]+/g, '-').split('-');
    if (parts.length === 3) {
      const p0 = parts[0];
      const p1 = parts[1];
      const p2 = parts[2];

      if (p0.length === 4) {
        const mm = parseInt(p1, 10);
        if (mm >= 1 && mm <= 12) {
          return `${p0}-${p1.padStart(2, '0')}-${p2.padStart(2, '0')}`;
        }
      }
      if (p2.length === 4) {
        return `${p2}-${p1.padStart(2, '0')}-${p0.padStart(2, '0')}`;
      }
    }
    return '';
  }
  return parsed.toISOString().split('T')[0];
};

export default function FuelFinancesPage() {
  const { user } = useAuthStore();
  const [trucks, setTrucks] = useState<TruckData[]>(() => getTrucks());
  const [assignedTrips, setAssignedTrips] = useState<any[]>([]);
  const [entries, setEntries] = useState<FuelFinanceEntry[]>([]);
  
  // Form states
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [typedTruckPlate, setTypedTruckPlate] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [service, setService] = useState<'Diesel' | 'DEF' | 'Urea'>('Diesel');
  const [quantity, setQuantity] = useState('');
  const [rate, setRate] = useState('');

  useEffect(() => {
    // 1. Instant local load
    setEntries(readLocalValue<FuelFinanceEntry[]>(FUEL_FINANCES_KEY, []));
    setAssignedTrips(readLocalValue<any[]>('tms_assigned_trips', []));

    const cachedFleetMaster = readLocalValue<any[]>('tms_fleet_master', []);
    const cachedLocalTrucks = readLocalValue<TruckData[]>('tms_local_trucks', []);

    const processTrucks = (fleetMaster: any[], localTrucks: TruckData[]) => {
      const fleetTrucks = fleetMaster.map(r => ({
        id: r.id || `fm-${r.plateNumber}`,
        plateNumber: r.plateNumber,
        model: r.vehicleType || 'Tipper',
        type: r.vehicleType || 'Tipper',
        fleetCategory: r.fleetCategory || 'OWNED_FLEET',
        capacity: '25 Tons',
        fuelCard: '-',
        health: 100,
        status: 'RECEIVED' as any,
        vendor: normalizeVendorName(r.vendor || 'Eastern Stevedores'),
        subVendor: r.subVendor || '-',
        wheeler: r.wheeler || '12 Wheeler',
        assignedDriverName: r.driverName || '-',
      }));

      setTrucks((prev) => {
        const merged = [...prev];
        localTrucks.forEach(lt => {
          const index = merged.findIndex(m => m.plateNumber.toUpperCase() === lt.plateNumber.toUpperCase());
          if (index >= 0) {
            merged[index] = { ...merged[index], ...lt };
          } else {
            merged.push(lt);
          }
        });
        fleetTrucks.forEach(ft => {
          const index = merged.findIndex(m => m.plateNumber.toUpperCase() === ft.plateNumber.toUpperCase());
          if (index >= 0) {
            merged[index] = { ...merged[index], ...ft };
          } else {
            merged.push(ft);
          }
        });
        return merged;
      });
    };

    if (cachedFleetMaster.length > 0 || cachedLocalTrucks.length > 0) {
      processTrucks(cachedFleetMaster, cachedLocalTrucks);
    }

    // 2. Background Database sync
    fetchSyncedValue<FuelFinanceEntry[]>(FUEL_FINANCES_KEY, []).then(setEntries);
    fetchSyncedValue<any[]>('tms_assigned_trips', []).then(setAssignedTrips);

    Promise.all([
      fetchSyncedValue<any[]>('tms_fleet_master', []),
      fetchSyncedValue<TruckData[]>('tms_local_trucks', []),
    ]).then(([fleetMaster, localTrucks]) => {
      processTrucks(fleetMaster, localTrucks);
    });
  }, []);

  useEffect(() => {
    const getCellValue = (headers: string[], row: string[], aliases: string[]) => {
      const normalizedAliases = aliases.map(normalizeHeader);
      const index = headers.findIndex(header => normalizedAliases.includes(normalizeHeader(header)));
      const value = index >= 0 ? row[index] : '';
      return value && String(value).trim() ? String(value).trim() : '';
    };

    const handleExcelImport = (event: Event) => {
      const detail = (event as CustomEvent<{ sectionName: string; import: { id: string; fileName: string; importedAt: string; headers: string[]; rows: string[][] } }>).detail;
      if (!detail || detail.sectionName !== 'Fuel Finances') return;

      const importedEntries = detail.import.rows.map((row, index): FuelFinanceEntry => {
        const vehicleNo = getCellValue(detail.import.headers, row, ['vehicle no', 'vehicle number', 'plate number', 'vehicle', 'truck']).toUpperCase();
        const date = parseImportedDateToYYYYMMDD(getCellValue(detail.import.headers, row, ['date', 'transaction date', 'timestamp']));
        
        const serviceVal = getCellValue(detail.import.headers, row, ['service', 'fuel type', 'consumable', 'type']).toLowerCase();
        let service: 'Diesel' | 'DEF' | 'Urea' = 'Diesel';
        if (serviceVal.includes('def')) service = 'DEF';
        else if (serviceVal.includes('urea')) service = 'Urea';
        else if (serviceVal.includes('diesel')) service = 'Diesel';

        const qtyVal = getCellValue(detail.import.headers, row, ['quantity', 'qty', 'litres', 'liters', 'volume']);
        const quantity = parseFloat(qtyVal) || 0;

        const rateVal = getCellValue(detail.import.headers, row, ['rate', 'price per unit', 'rate per unit']);
        const rate = parseFloat(rateVal) || 0;

        const valVal = getCellValue(detail.import.headers, row, ['value', 'total value', 'cost', 'total cost', 'amount']);
        const value = parseFloat(valVal) || (quantity * rate);

        // Find truckId and fleetCategory
        const matchedTruck = trucks.find(t => t.plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '') === vehicleNo.toUpperCase().replace(/[^A-Z0-9]/g, ''));
        const truckId = matchedTruck ? matchedTruck.id : `truck-auto-${vehicleNo}`;
        const fleetCategory = matchedTruck ? (matchedTruck.fleetCategory || 'OWNED_FLEET') : 'OWNED_FLEET';

        return {
          id: `fuel-import-${Date.now()}-${index}`,
          vehicleNo,
          truckId,
          fleetCategory,
          date,
          service,
          quantity,
          rate,
          value
        };
      }).filter(e => e.vehicleNo && e.vehicleNo !== '-');

      if (importedEntries.length === 0) return;

      setEntries(prev => {
        const next = [...prev];
        importedEntries.forEach(idr => {
          const cleanPlate = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '');
          const idx = next.findIndex(r => 
            cleanPlate(r.vehicleNo) === cleanPlate(idr.vehicleNo) && 
            r.date === idr.date && 
            r.service === idr.service
          );
          if (idx >= 0) {
            const merged = { ...next[idx] };
            Object.keys(idr).forEach(key => {
              const val = idr[key as keyof FuelFinanceEntry];
              if (val !== undefined && val !== '-' && val !== '') {
                (merged as any)[key] = val;
              }
            });
            next[idx] = merged;
          } else {
            next.push(idr);
          }
        });
        saveSyncedValue(FUEL_FINANCES_KEY, next);
        return next;
      });
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, [entries, trucks]);

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

  // Filter trucks for dropdown menu (running status/trip is not required, display all trucks in registry)
  const dropdownTrucks = useMemo(() => {
    return trucks;
  }, [trucks]);



  const selectedTruck = useMemo(() => {
    return trucks.find(t => t.id === selectedTruckId);
  }, [trucks, selectedTruckId]);

  const resolvedFleetCategory = useMemo(() => {
    return selectedTruck?.fleetCategory || 'OWNED_FLEET';
  }, [selectedTruck]);

  const resolvedFleetCategoryLabel = useMemo(() => {
    if (!selectedTruck) return '—';
    return selectedTruck.fleetCategory === 'OWNED_FLEET' ? 'Owned Fleet' : 'Attached Fleet';
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
        if (trip && !isMatchingDestination(trip.destination, userRegion)) {
          return false;
        }
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
    setTypedTruckPlate('');
    setSelectedTruckId('');
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
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {user?.role?.endsWith('_ADMIN') && <SectionExcelImport sectionName="Fuel Finances" />}
          <SectionExcelExport sectionName="Fuel Finances" />
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
                  <th className="px-6 py-4">SL.</th>
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
                    <td colSpan={9} className="px-6 py-8 text-center text-slate-500">
                      No fuel transactions recorded for this regional scope.
                    </td>
                  </tr>
                ) : filteredEntries.map((entry, idx) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-400">{idx + 1}</td>
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
                  <Info className="h-4 w-4" /> No vehicles available in fleet registry.
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Type vehicle no or last 4 digits e.g. 1234"
                    value={typedTruckPlate}
                    onFocus={() => { if (typedTruckPlate.trim().length >= 3) setShowSuggestions(true); }}
                    onChange={(e) => {
                      const val = e.target.value;
                      setTypedTruckPlate(val);
                      setShowSuggestions(val.trim().length >= 3);
                      
                      const normalizedVal = val.toUpperCase().replace(/[\s\-]/g, '');
                      const matched = trucks.find(t => t.plateNumber.toUpperCase().replace(/[\s\-]/g, '') === normalizedVal);
                      if (matched) {
                        setSelectedTruckId(matched.id);
                        setShowSuggestions(false);
                      } else {
                        setSelectedTruckId('');
                      }
                    }}
                    onBlur={() => {
                      // Small delay to let onMouseDown run first if suggestion is clicked
                      setTimeout(() => setShowSuggestions(false), 200);
                    }}
                    autoComplete="off"
                    className="fuel-input uppercase font-mono font-bold tracking-wider"
                  />
                  {/* Auto-suggest dropdown */}
                  {showSuggestions && typedTruckPlate.trim().length >= 3 && (() => {
                    const query = typedTruckPlate.trim().toUpperCase().replace(/[\s\-]/g, '');
                    const matches = trucks.filter(t => {
                      const plate = t.plateNumber.toUpperCase().replace(/[\s\-]/g, '');
                      return plate.includes(query) && plate !== query;
                    }).slice(0, 8);
                    if (matches.length === 0) return null;
                    return (
                      <div className="absolute z-[100] left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden animate-fade-in">
                        <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{matches.length} vehicle{matches.length > 1 ? 's' : ''} found</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {matches.map((truck) => (
                            <button
                              key={truck.id}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setTypedTruckPlate(truck.plateNumber);
                                setSelectedTruckId(truck.id);
                                setShowSuggestions(false);
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-blue-50/60 transition-colors border-b border-slate-50 last:border-0 group"
                            >
                              <span className="font-mono font-extrabold text-xs text-slate-800 tracking-wider group-hover:text-brand-primary transition-colors">
                                {truck.plateNumber}
                              </span>
                              <span className="text-[10px] text-slate-400 font-semibold truncate">
                                {truck.type || 'Vehicle'} · {truck.vendor || '—'}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div>
              <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px] flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-slate-400" /> Fleet Category (Auto-resolved)
              </label>
              <input
                type="text"
                disabled
                value={resolvedFleetCategoryLabel}
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
              disabled={!selectedTruck}
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
