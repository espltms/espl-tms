'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  Wrench, 
  Plus, 
  Trash2, 
  Eye, 
  Calendar, 
  BadgeCent, 
  Info, 
  X, 
  ArrowRight,
  Disc,
  ClipboardList,
  TrendingUp,
  Percent,
  CheckCircle,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { getTrucks, TruckData } from '@/app/data/dataHelper';
import { fetchSyncedValue, saveSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import { isMatchingDestination } from '@/lib/workflowAutomation';
import SectionExcelExport from '@/components/SectionExcelExport';

interface RepairMaintenanceEntry {
  id: string;
  vehicleNo: string;
  truckId?: string;
  natureOfRM: string;
  dateOfOccurrence: string;
  placeOfOccurrence: string;
  priorIntimation: 'YES' | 'NO';
  rmPoint: string;
  particulars: string;
  taxable: number;
  cgst: number;
  sgst: number;
  total: number;
  billNoDate: string;
  initialClaim: number;
  discount: number;
  negotiatedClaim: number;
  createdAt: string;
}

interface TyreWorkshopEntry {
  id: string;
  vehicleNo: string;
  truckId?: string;
  date: string;
  tyreSerialNo: string;
  brand: string;
  size: string;
  position: 'Front Left' | 'Front Right' | 'Rear Left Inner' | 'Rear Left Outer' | 'Rear Right Inner' | 'Rear Right Outer' | 'Spare';
  actionTaken: 'New Fitting' | 'Rotation' | 'Retreading' | 'Puncture Repair' | 'Discarded';
  odometerReading: number;
  cost: number;
  createdAt: string;
}

const REPAIR_MAINTENANCE_KEY = 'tms_repair_maintenance_entries';
const TYRE_WORKSHOP_KEY = 'tms_tyre_workshop_entries';

export default function MaintenancePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'REPAIR_MAINTENANCE' | 'TYRE_WORKSHOP'>('REPAIR_MAINTENANCE');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; title?: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'REPAIR' | 'TYRE' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
  
  const [trucks, setTrucks] = useState<TruckData[]>(() => getTrucks());
  const [assignedTrips, setAssignedTrips] = useState<any[]>([]);
  
  // Data lists
  const [repairEntries, setRepairEntries] = useState<RepairMaintenanceEntry[]>([]);
  const [tyreEntries, setTyreEntries] = useState<TyreWorkshopEntry[]>([]);
  
  // Modals visibility
  const [repairModalOpen, setRepairModalOpen] = useState(false);
  const [tyreModalOpen, setTyreModalOpen] = useState(false);
  const [selectedRepairDetail, setSelectedRepairDetail] = useState<RepairMaintenanceEntry | null>(null);

  // Form states - Repair & Maintenance
  const [rmTruckId, setRmTruckId] = useState('');
  const [rmCustomVehicleNo, setRmCustomVehicleNo] = useState('');
  const [rmNatureOfRM, setRmNatureOfRM] = useState('');
  const [rmDateOfOccurrence, setRmDateOfOccurrence] = useState(new Date().toISOString().split('T')[0]);
  const [rmPlaceOfOccurrence, setRmPlaceOfOccurrence] = useState('');
  const [rmPriorIntimation, setRmPriorIntimation] = useState<'YES' | 'NO'>('NO');
  const [rmPoint, setRmPoint] = useState('');
  const [rmParticulars, setRmParticulars] = useState('');
  const [rmTaxable, setRmTaxable] = useState('');
  const [rmCgst, setRmCgst] = useState('');
  const [rmSgst, setRmSgst] = useState('');
  const [rmBillNoDate, setRmBillNoDate] = useState('');
  const [rmInitialClaim, setRmInitialClaim] = useState('');
  const [rmDiscount, setRmDiscount] = useState('');
  const [rmNegotiatedClaim, setRmNegotiatedClaim] = useState('');

  // Form states - Tyre Workshop
  const [tyreTruckId, setTyreTruckId] = useState('');
  const [tyreCustomVehicleNo, setTyreCustomVehicleNo] = useState('');
  const [tyreDate, setTyreDate] = useState(new Date().toISOString().split('T')[0]);
  const [tyreSerialNo, setTyreSerialNo] = useState('');
  const [tyreBrand, setTyreBrand] = useState('');
  const [tyreSize, setTyreSize] = useState('');
  const [tyrePosition, setTyrePosition] = useState<TyreWorkshopEntry['position']>('Front Left');
  const [tyreActionTaken, setTyreActionTaken] = useState<TyreWorkshopEntry['actionTaken']>('New Fitting');
  const [tyreOdometerReading, setTyreOdometerReading] = useState('');
  const [tyreCost, setTyreCost] = useState('');

  useEffect(() => {
    // 1. Instant local load
    setRepairEntries(readLocalValue<RepairMaintenanceEntry[]>(REPAIR_MAINTENANCE_KEY, []));
    setTyreEntries(readLocalValue<TyreWorkshopEntry[]>(TYRE_WORKSHOP_KEY, []));
    setAssignedTrips(readLocalValue<any[]>('tms_assigned_trips', []));

    // 2. Background Database sync
    fetchSyncedValue<RepairMaintenanceEntry[]>(REPAIR_MAINTENANCE_KEY, []).then(setRepairEntries);
    fetchSyncedValue<TyreWorkshopEntry[]>(TYRE_WORKSHOP_KEY, []).then(setTyreEntries);
    fetchSyncedValue<any[]>('tms_assigned_trips', []).then(setAssignedTrips);
  }, []);

  // Regional configurations
  const isRegionalUser = user?.role === 'REGION_ADMIN' || 
                         user?.role === 'BHAWANIPATNA_ADMIN';
  const userRegion = user?.role === 'BHAWANIPATNA_ADMIN'
    ? 'Bhawanipatna'
    : user?.regionName;

  // Filter trucks based on regional scopes
  const dropdownTrucks = useMemo(() => {
    return trucks.filter(truck => {
      if (isRegionalUser && userRegion) {
        const trip = assignedTrips.find(t => t.truckId === truck.id || t.truck?.plateNumber === truck.plateNumber);
        return trip && isMatchingDestination(trip.destination, userRegion);
      }
      return true;
    });
  }, [trucks, isRegionalUser, userRegion, assignedTrips]);

  // Handle select default vehicle
  useEffect(() => {
    if (dropdownTrucks.length > 0) {
      if (!rmTruckId) setRmTruckId(dropdownTrucks[0].id);
      if (!tyreTruckId) setTyreTruckId(dropdownTrucks[0].id);
    } else {
      if (!rmTruckId) setRmTruckId('CUSTOM');
      if (!tyreTruckId) setTyreTruckId('CUSTOM');
    }
  }, [dropdownTrucks, rmTruckId, tyreTruckId]);

  // Live Auto-Calculation of R&M Bill Total
  const computedRmTotal = useMemo(() => {
    const tax = parseFloat(rmTaxable) || 0;
    const cgstVal = parseFloat(rmCgst) || 0;
    const sgstVal = parseFloat(rmSgst) || 0;
    return tax + cgstVal + sgstVal;
  }, [rmTaxable, rmCgst, rmSgst]);

  // Filter list data scope
  const filteredRepairEntries = useMemo(() => {
    return repairEntries.filter(entry => {
      if (isRegionalUser && userRegion) {
        const trip = assignedTrips.find(t => t.truckId === entry.truckId || t.truck?.plateNumber === entry.vehicleNo);
        if (trip) {
          return isMatchingDestination(trip.destination, userRegion);
        }
        return false;
      }
      return true;
    });
  }, [repairEntries, isRegionalUser, userRegion, assignedTrips]);

  const filteredTyreEntries = useMemo(() => {
    return tyreEntries.filter(entry => {
      if (isRegionalUser && userRegion) {
        const trip = assignedTrips.find(t => t.truckId === entry.truckId || t.truck?.plateNumber === entry.vehicleNo);
        if (trip) {
          return isMatchingDestination(trip.destination, userRegion);
        }
        return false;
      }
      return true;
    });
  }, [tyreEntries, isRegionalUser, userRegion, assignedTrips]);

  // Summary Metrics calculations
  const repairMetrics = useMemo(() => {
    const totalSpend = filteredRepairEntries.reduce((sum, e) => sum + e.total, 0);
    const totalClaims = filteredRepairEntries.reduce((sum, e) => sum + e.negotiatedClaim, 0);
    const totalDiscounts = filteredRepairEntries.reduce((sum, e) => sum + e.discount, 0);
    const uniqueVehicles = new Set(filteredRepairEntries.map(e => e.vehicleNo)).size;
    return {
      totalSpend,
      totalClaims,
      totalDiscounts,
      avgCost: uniqueVehicles > 0 ? totalSpend / uniqueVehicles : 0,
    };
  }, [filteredRepairEntries]);

  const tyreMetrics = useMemo(() => {
    const totalSpend = filteredTyreEntries.reduce((sum, e) => sum + e.cost, 0);
    const totalTasks = filteredTyreEntries.length;
    const itemsReplaced = filteredTyreEntries.filter(e => e.actionTaken === 'New Fitting' || e.actionTaken === 'Retreading').length;
    const avgCost = totalTasks > 0 ? totalSpend / totalTasks : 0;
    return {
      totalSpend,
      totalTasks,
      itemsReplaced,
      avgCost,
    };
  }, [filteredTyreEntries]);

  // Submission Handlers
  const handleAddRepairEntry = (e: React.FormEvent) => {
    e.preventDefault();
    let finalVehicleNo = rmCustomVehicleNo.trim().toUpperCase();
    let finalTruckId = undefined;

    if (rmTruckId !== 'CUSTOM') {
      const matched = trucks.find(t => t.id === rmTruckId);
      if (matched) {
        finalVehicleNo = matched.plateNumber;
        finalTruckId = matched.id;
      }
    }

    if (!finalVehicleNo) {
      setToast({ message: 'Please specify a valid Vehicle Number.', type: 'error' });
      return;
    }

    const newEntry: RepairMaintenanceEntry = {
      id: `rm-entry-${Date.now()}`,
      vehicleNo: finalVehicleNo,
      truckId: finalTruckId,
      natureOfRM: rmNatureOfRM,
      dateOfOccurrence: rmDateOfOccurrence,
      placeOfOccurrence: rmPlaceOfOccurrence,
      priorIntimation: rmPriorIntimation,
      rmPoint: rmPoint,
      particulars: rmParticulars,
      taxable: parseFloat(rmTaxable) || 0,
      cgst: parseFloat(rmCgst) || 0,
      sgst: parseFloat(rmSgst) || 0,
      total: computedRmTotal,
      billNoDate: rmBillNoDate,
      initialClaim: parseFloat(rmInitialClaim) || 0,
      discount: parseFloat(rmDiscount) || 0,
      negotiatedClaim: parseFloat(rmNegotiatedClaim) || 0,
      createdAt: new Date().toISOString()
    };

    const updated = [newEntry, ...repairEntries];
    setRepairEntries(updated);
    saveSyncedValue(REPAIR_MAINTENANCE_KEY, updated);
    setRepairModalOpen(false);
    setToast({ message: "Repair entry saved successfully.", type: 'success' });

    // Reset fields
    setRmCustomVehicleNo('');
    setRmNatureOfRM('');
    setRmPlaceOfOccurrence('');
    setRmPriorIntimation('NO');
    setRmPoint('');
    setRmParticulars('');
    setRmTaxable('');
    setRmCgst('');
    setRmSgst('');
    setRmBillNoDate('');
    setRmInitialClaim('');
    setRmDiscount('');
    setRmNegotiatedClaim('');
  };

  const handleAddTyreEntry = (e: React.FormEvent) => {
    e.preventDefault();
    let finalVehicleNo = tyreCustomVehicleNo.trim().toUpperCase();
    let finalTruckId = undefined;

    if (tyreTruckId !== 'CUSTOM') {
      const matched = trucks.find(t => t.id === tyreTruckId);
      if (matched) {
        finalVehicleNo = matched.plateNumber;
        finalTruckId = matched.id;
      }
    }

    if (!finalVehicleNo) {
      setToast({ message: 'Please specify a valid Vehicle Number.', type: 'error' });
      return;
    }

    const newEntry: TyreWorkshopEntry = {
      id: `tyre-entry-${Date.now()}`,
      vehicleNo: finalVehicleNo,
      truckId: finalTruckId,
      date: tyreDate,
      tyreSerialNo: tyreSerialNo,
      brand: tyreBrand,
      size: tyreSize,
      position: tyrePosition,
      actionTaken: tyreActionTaken,
      odometerReading: parseFloat(tyreOdometerReading) || 0,
      cost: parseFloat(tyreCost) || 0,
      createdAt: new Date().toISOString()
    };

    const updated = [newEntry, ...tyreEntries];
    setTyreEntries(updated);
    saveSyncedValue(TYRE_WORKSHOP_KEY, updated);
    setTyreModalOpen(false);
    setToast({ message: "Tyre activity entry saved successfully.", type: 'success' });

    // Reset fields
    setTyreCustomVehicleNo('');
    setTyreSerialNo('');
    setTyreBrand('');
    setTyreSize('');
    setTyreOdometerReading('');
    setTyreCost('');
  };

  const executeDeleteRepair = (id: string) => {
    const updated = repairEntries.filter(e => e.id !== id);
    setRepairEntries(updated);
    saveSyncedValue(REPAIR_MAINTENANCE_KEY, updated);
    setToast({ message: "Repair entry successfully deleted.", type: 'success' });
  };

  const executeDeleteTyre = (id: string) => {
    const updated = tyreEntries.filter(e => e.id !== id);
    setTyreEntries(updated);
    saveSyncedValue(TYRE_WORKSHOP_KEY, updated);
    setToast({ message: "Tyre activity entry successfully deleted.", type: 'success' });
  };

  const handleDeleteRepair = (id: string) => {
    setDeleteConfirm({ id, type: 'REPAIR' });
  };

  const handleDeleteTyre = (id: string) => {
    setDeleteConfirm({ id, type: 'TYRE' });
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-8 animate-fade-in text-xs font-sans">
      {deleteConfirm && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center gap-3 text-red-600">
              <div className="rounded-full bg-red-50 p-2">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 font-sans">
                Confirm Deletion
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-sans font-semibold">
              Are you sure you want to delete this {deleteConfirm.type === 'REPAIR' ? 'repair ledger entry' : 'tyre worklog entry'}? This action is permanent and cannot be undone.
            </p>
            <div className="flex justify-end gap-2 mt-2 font-sans">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = deleteConfirm;
                  setDeleteConfirm(null);
                  if (target.type === 'REPAIR') {
                    executeDeleteRepair(target.id);
                  } else {
                    executeDeleteTyre(target.id);
                  }
                }}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 active:scale-[0.98] transition-all shadow-sm"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Header and top tab switcher */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Workshop & Maintenance</h2>
          <p className="text-xs text-slate-500 mt-1">Audit vehicle repairs, claim negotiations, and tyre workshop logs inside terminal bays</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          <SectionExcelExport sectionName="Workshop & Maintenance" />
          
          {/* Modern Switcher Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 border border-slate-200/80 p-1.5 rounded-2xl shadow-sm self-start">
            <button
              onClick={() => setActiveTab('REPAIR_MAINTENANCE')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'REPAIR_MAINTENANCE'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/40'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Wrench className="h-4 w-4" /> Repair & Maintenance
            </button>
            <button
              onClick={() => setActiveTab('TYRE_WORKSHOP')}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                activeTab === 'TYRE_WORKSHOP'
                  ? 'bg-white text-blue-600 shadow-sm border border-slate-200/40'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Disc className="h-4 w-4" /> Tyre Workshop
            </button>
          </div>
        </div>
      </div>

      {/* R&M SECTION */}
      {activeTab === 'REPAIR_MAINTENANCE' && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <BadgeCent className="h-4 w-4 text-blue-600" /> Total R&M Expenses
              </div>
              <div className="mt-3 text-2xl font-extrabold text-slate-800">{formatCurrency(repairMetrics.totalSpend)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <CheckCircle className="h-4 w-4 text-emerald-600" /> Negotiated Claims
              </div>
              <div className="mt-3 text-2xl font-extrabold text-emerald-600">{formatCurrency(repairMetrics.totalClaims)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Percent className="h-4 w-4 text-purple-600" /> Total Discounts Saved
              </div>
              <div className="mt-3 text-2xl font-extrabold text-purple-600">{formatCurrency(repairMetrics.totalDiscounts)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <TrendingUp className="h-4 w-4 text-slate-500" /> Avg Cost per Truck
              </div>
              <div className="mt-3 text-2xl font-extrabold text-slate-700">{formatCurrency(repairMetrics.avgCost)}</div>
            </div>
          </div>

          {/* Ledger Table Section */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-blue-600" /> Repair & Maintenance Ledger
              </h3>
              <button 
                onClick={() => setRepairModalOpen(true)}
                className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-md"
              >
                <Plus className="h-4 w-4" /> Record Repair Entry
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                    <th className="px-6 py-4">SL.</th>
                    <th className="px-6 py-4">Vehicle No</th>
                    <th className="px-6 py-4">Nature of R&M</th>
                    <th className="px-6 py-4">Occurrence Date</th>
                    <th className="px-6 py-4">R&M Point</th>
                    <th className="px-6 py-4">Taxable Value</th>
                    <th className="px-6 py-4">Total Amount</th>
                    <th className="px-6 py-4">Negotiated Claim</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {filteredRepairEntries.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-slate-400">
                        No Repair & Maintenance logs found for this regional scope. Click the button to add a new record.
                      </td>
                    </tr>
                  ) : filteredRepairEntries.map((entry, idx) => (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-6 py-4 font-extrabold text-slate-800 font-mono tracking-wider">{entry.vehicleNo}</td>
                      <td className="px-6 py-4 font-semibold text-slate-700">{entry.natureOfRM}</td>
                      <td className="px-6 py-4 font-mono text-slate-500">{new Date(entry.dateOfOccurrence).toLocaleDateString('en-IN')}</td>
                      <td className="px-6 py-4 font-semibold text-slate-600">{entry.rmPoint}</td>
                      <td className="px-6 py-4 font-mono">{formatCurrency(entry.taxable)}</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-800">{formatCurrency(entry.total)}</td>
                      <td className="px-6 py-4 font-mono font-bold text-emerald-600">{formatCurrency(entry.negotiatedClaim)}</td>
                      <td className="px-6 py-4 text-right flex justify-end gap-1.5 items-center">
                        <button
                          onClick={() => setSelectedRepairDetail(entry)}
                          className="rounded-lg p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all"
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRepair(entry.id)} 
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
        </div>
      )}

      {/* TYRE WORKSHOP SECTION */}
      {activeTab === 'TYRE_WORKSHOP' && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Metrics */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <BadgeCent className="h-4 w-4 text-blue-600" /> Tyre Expenses
              </div>
              <div className="mt-3 text-2xl font-extrabold text-slate-800">{formatCurrency(tyreMetrics.totalSpend)}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Disc className="h-4 w-4 text-emerald-600" /> Tasks Executed
              </div>
              <div className="mt-3 text-2xl font-extrabold text-slate-800">{tyreMetrics.totalTasks} Jobs</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Wrench className="h-4 w-4 text-purple-600" /> Fitting & Retreads
              </div>
              <div className="mt-3 text-2xl font-extrabold text-purple-600">{tyreMetrics.itemsReplaced} Tyres</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <TrendingUp className="h-4 w-4 text-slate-500" /> Avg Cost per Job
              </div>
              <div className="mt-3 text-2xl font-extrabold text-slate-700">{formatCurrency(tyreMetrics.avgCost)}</div>
            </div>
          </div>

          {/* Tyre Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Disc className="h-4 w-4 text-blue-600" /> Tyre Activity & Maintenance Log
              </h3>
              <button 
                onClick={() => setTyreModalOpen(true)}
                className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-md"
              >
                <Plus className="h-4 w-4" /> Record Tyre Activity
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                    <th className="px-6 py-4">SL.</th>
                    <th className="px-6 py-4">Vehicle No</th>
                    <th className="px-6 py-4">Tyre Serial No</th>
                    <th className="px-6 py-4">Brand</th>
                    <th className="px-6 py-4">Size</th>
                    <th className="px-6 py-4">Position</th>
                    <th className="px-6 py-4">Action Taken</th>
                    <th className="px-6 py-4">Odometer Reading</th>
                    <th className="px-6 py-4">Cost</th>
                    <th className="px-6 py-4">Job Date</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {filteredTyreEntries.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-6 py-10 text-center text-slate-400">
                        No Tyre Workshop activities registered for this regional scope. Click the button to add a new record.
                      </td>
                    </tr>
                  ) : filteredTyreEntries.map((entry, idx) => (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-6 py-4 font-extrabold text-slate-800 font-mono tracking-wider">{entry.vehicleNo}</td>
                      <td className="px-6 py-4 font-mono text-slate-700 font-semibold">{entry.tyreSerialNo}</td>
                      <td className="px-6 py-4 font-semibold">{entry.brand}</td>
                      <td className="px-6 py-4 text-slate-500">{entry.size}</td>
                      <td className="px-6 py-4 text-slate-700 font-medium">{entry.position}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${
                          entry.actionTaken === 'New Fitting' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : entry.actionTaken === 'Retreading' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}>
                          {entry.actionTaken}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono">{entry.odometerReading.toLocaleString()} Km</td>
                      <td className="px-6 py-4 font-mono font-bold text-slate-800">{formatCurrency(entry.cost)}</td>
                      <td className="px-6 py-4 font-mono text-slate-400">{new Date(entry.date).toLocaleDateString('en-IN')}</td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => handleDeleteTyre(entry.id)} 
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
        </div>
      )}

      {/* MODAL 1: ADD REPAIR & MAINTENANCE */}
      {repairModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Wrench className="h-4.5 w-4.5 text-blue-600" /> Add Repair & Maintenance Log
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Submit 15 spreadsheet columns for ledger compliance</p>
              </div>
              <button onClick={() => setRepairModalOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleAddRepairEntry} className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              
              {/* Row 1: Vehicle selection and Nature */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Vehicle *</label>
                  <select 
                    value={rmTruckId} 
                    onChange={(e) => setRmTruckId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 uppercase font-mono"
                  >
                    {dropdownTrucks.map(truck => (
                      <option key={truck.id} value={truck.id}>
                        {truck.plateNumber} ({truck.model})
                      </option>
                    ))}
                    <option value="CUSTOM">-- Manual / Custom Entry --</option>
                  </select>
                </div>

                {rmTruckId === 'CUSTOM' && (
                  <div>
                    <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Custom Vehicle No *</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. OD02AX1234"
                      value={rmCustomVehicleNo} 
                      onChange={(e) => setRmCustomVehicleNo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono uppercase"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Nature of R&M *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Engine Overhauling / Brake repair"
                    value={rmNatureOfRM} 
                    onChange={(e) => setRmNatureOfRM(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 font-semibold"
                  />
                </div>
              </div>

              {/* Row 2: Occurrence & Place & Intimation */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px] flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" /> Date of Occurrence *
                  </label>
                  <input 
                    required
                    type="date" 
                    value={rmDateOfOccurrence} 
                    onChange={(e) => setRmDateOfOccurrence(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Place of Occurrence *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Dharamgarh Depot"
                    value={rmPlaceOfOccurrence} 
                    onChange={(e) => setRmPlaceOfOccurrence(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Prior Intimation *</label>
                  <select 
                    value={rmPriorIntimation} 
                    onChange={(e) => setRmPriorIntimation(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1"
                  >
                    <option value="YES">YES</option>
                    <option value="NO">NO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">R&M Point *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. Brake Bay A"
                    value={rmPoint} 
                    onChange={(e) => setRmPoint(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1"
                  />
                </div>
              </div>

              {/* Row 3: Particulars Text Area */}
              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Particulars (Task Details) *</label>
                <textarea 
                  required
                  rows={2}
                  placeholder="Input detailed task descriptors and spare parts used..."
                  value={rmParticulars} 
                  onChange={(e) => setRmParticulars(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 resize-none h-20"
                />
              </div>

              {/* Row 4: Bill amount parameters (Taxable, CGST, SGST, Auto calculated Total) */}
              <div className="bg-slate-50/50 p-4 border border-slate-100 rounded-2xl grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Taxable Amount (₹) *</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    value={rmTaxable} 
                    onChange={(e) => setRmTaxable(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">CGST Amount (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    value={rmCgst} 
                    onChange={(e) => setRmCgst(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">SGST Amount (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    value={rmSgst} 
                    onChange={(e) => setRmSgst(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-blue-600 mb-1.5 uppercase font-extrabold tracking-wider text-[10px]">Total Bill Amount (Auto)</label>
                  <div className="w-full bg-blue-50/50 border border-blue-200/50 text-blue-700 rounded-xl py-2.5 px-3 font-mono font-extrabold text-sm h-[42px] flex items-center">
                    {formatCurrency(computedRmTotal)}
                  </div>
                </div>
              </div>

              {/* Row 5: Bill No/Date & Initial Claim & Discount & Negotiated Claim */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Bill No/Date *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. BL-4562 / 12-May"
                    value={rmBillNoDate} 
                    onChange={(e) => setRmBillNoDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Initial Claim (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    value={rmInitialClaim} 
                    onChange={(e) => setRmInitialClaim(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Discount (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    value={rmDiscount} 
                    onChange={(e) => setRmDiscount(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Negotiated Claim (₹) *</label>
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    placeholder="0.00"
                    value={rmNegotiatedClaim} 
                    onChange={(e) => setRmNegotiatedClaim(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Form buttons */}
              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setRepairModalOpen(false)} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-[2] w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md"
                >
                  Save Repair Entry <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD TYRE ENTRY */}
      {tyreModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Disc className="h-4.5 w-4.5 text-blue-600" /> Record Tyre Maintenance Task
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Specify tyre positioning and action type</p>
              </div>
              <button onClick={() => setTyreModalOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleAddTyreEntry} className="p-6 space-y-4 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Vehicle *</label>
                  <select 
                    value={tyreTruckId} 
                    onChange={(e) => setTyreTruckId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 uppercase font-mono"
                  >
                    {dropdownTrucks.map(truck => (
                      <option key={truck.id} value={truck.id}>
                        {truck.plateNumber} ({truck.model})
                      </option>
                    ))}
                    <option value="CUSTOM">-- Manual / Custom Entry --</option>
                  </select>
                </div>

                {tyreTruckId === 'CUSTOM' && (
                  <div>
                    <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Custom Vehicle No *</label>
                    <input 
                      required
                      type="text" 
                      placeholder="e.g. OD02AX1234"
                      value={tyreCustomVehicleNo} 
                      onChange={(e) => setTyreCustomVehicleNo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono uppercase"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Job Date *</label>
                  <input 
                    required
                    type="date" 
                    value={tyreDate} 
                    onChange={(e) => setTyreDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Tyre Serial No *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. TYRE-78652A"
                    value={tyreSerialNo} 
                    onChange={(e) => setTyreSerialNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Brand *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. MRF / Apollo"
                    value={tyreBrand} 
                    onChange={(e) => setTyreBrand(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Size *</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. 10.00R20"
                    value={tyreSize} 
                    onChange={(e) => setTyreSize(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Tyre Position *</label>
                  <select 
                    value={tyrePosition} 
                    onChange={(e) => setTyrePosition(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary"
                  >
                    <option value="Front Left">Front Left</option>
                    <option value="Front Right">Front Right</option>
                    <option value="Rear Left Inner">Rear Left Inner</option>
                    <option value="Rear Left Outer">Rear Left Outer</option>
                    <option value="Rear Right Inner">Rear Right Inner</option>
                    <option value="Rear Right Outer">Rear Right Outer</option>
                    <option value="Spare">Spare Wheel</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Action Taken *</label>
                  <select 
                    value={tyreActionTaken} 
                    onChange={(e) => setTyreActionTaken(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary"
                  >
                    <option value="New Fitting">New Fitting</option>
                    <option value="Rotation">Rotation</option>
                    <option value="Retreading">Retreading</option>
                    <option value="Puncture Repair">Puncture Repair</option>
                    <option value="Discarded">Discarded</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Odometer Reading (Km) *</label>
                  <input 
                    required
                    type="number" 
                    placeholder="e.g. 145000"
                    value={tyreOdometerReading} 
                    onChange={(e) => setTyreOdometerReading(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Job Cost (₹) *</label>
                  <input 
                    required
                    type="number" 
                    placeholder="0.00"
                    value={tyreCost} 
                    onChange={(e) => setTyreCost(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button type="button" onClick={() => setTyreModalOpen(false)} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-[2] w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md"
                >
                  Save Tyre Record <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER / DETAILS VIEWER: DETAILED VIEW OF R&M ENTRY */}
      {selectedRepairDetail && (
        <div className="fixed inset-0 z-[160] flex items-center justify-end bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-xl h-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-slide-in">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList className="h-4.5 w-4.5 text-blue-600" /> R&M Ledger Detail Sheet
                </h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Auditing 15 compliant parameters</p>
              </div>
              <button onClick={() => setSelectedRepairDetail(null)} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-700">
              
              {/* Event / Vehicle segment */}
              <div className="space-y-3.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">
                  1. Operational Particulars
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Vehicle No</span>
                    <span className="text-xs font-extrabold font-mono text-slate-800 tracking-wider bg-slate-100 px-2 py-0.5 rounded inline-block mt-0.5">
                      {selectedRepairDetail.vehicleNo}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Nature of R&M</span>
                    <span className="text-xs font-semibold text-slate-800 block mt-0.5">
                      {selectedRepairDetail.natureOfRM}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Occurrence Date</span>
                    <span className="text-xs font-medium text-slate-800 block mt-0.5">
                      {new Date(selectedRepairDetail.dateOfOccurrence).toLocaleDateString('en-IN', { dateStyle: 'long' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Place of Occurrence</span>
                    <span className="text-xs font-medium text-slate-800 block mt-0.5">
                      {selectedRepairDetail.placeOfOccurrence}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Prior Intimation</span>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase border mt-1 ${
                      selectedRepairDetail.priorIntimation === 'YES' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {selectedRepairDetail.priorIntimation}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">R&M Point / Bay</span>
                    <span className="text-xs font-medium text-slate-800 block mt-0.5">
                      {selectedRepairDetail.rmPoint}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[9px] font-bold text-slate-400 uppercase block">Particulars Description</span>
                  <p className="text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-3 mt-1 leading-relaxed whitespace-pre-wrap">
                    {selectedRepairDetail.particulars || 'No detailed particulars supplied.'}
                  </p>
                </div>
              </div>

              {/* Financial segment */}
              <div className="space-y-3.5">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">
                  2. Financial Audit Sheet
                </h4>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Taxable Value</span>
                    <span className="text-sm font-extrabold font-mono text-slate-800 mt-0.5 block">
                      {formatCurrency(selectedRepairDetail.taxable)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Total Bill Amount</span>
                    <span className="text-sm font-extrabold font-mono text-blue-600 mt-0.5 block">
                      {formatCurrency(selectedRepairDetail.total)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">CGST Value</span>
                    <span className="text-xs font-mono text-slate-600 block mt-0.5">
                      {formatCurrency(selectedRepairDetail.cgst)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">SGST Value</span>
                    <span className="text-xs font-mono text-slate-600 block mt-0.5">
                      {formatCurrency(selectedRepairDetail.sgst)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Bill No & Date</span>
                    <span className="text-xs font-mono font-bold text-slate-800 block mt-0.5">
                      {selectedRepairDetail.billNoDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Initial Claim</span>
                    <span className="text-xs font-mono text-slate-700 block mt-0.5">
                      {formatCurrency(selectedRepairDetail.initialClaim)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Discount Saved</span>
                    <span className="text-xs font-mono font-bold text-purple-600 block mt-0.5">
                      {formatCurrency(selectedRepairDetail.discount)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-400 uppercase block">Negotiated Claim</span>
                    <span className="text-xs font-mono font-extrabold text-emerald-600 block mt-0.5">
                      {formatCurrency(selectedRepairDetail.negotiatedClaim)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={() => setSelectedRepairDetail(null)}
                  className="w-full rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5"
                >
                  Close Audit Sheet <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className={`fixed top-5 right-5 z-[300] flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl animate-slide-in max-w-md ${
          toast.type === 'success' ? 'border-emerald-500/20 bg-emerald-50/95 text-emerald-950' :
          toast.type === 'error' ? 'border-red-500/20 bg-red-50/95 text-red-950' :
          'border-amber-500/20 bg-amber-50/95 text-amber-950'
        } backdrop-blur-md`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 font-bold" />
          ) : toast.type === 'error' ? (
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          ) : (
            <Info className="h-5 w-5 text-amber-600 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              {toast.title || (toast.type === 'success' ? 'Succeeded' : toast.type === 'error' ? 'Failed' : 'Status')}
            </h4>
            <p className="text-[10px] opacity-90 mt-0.5 whitespace-pre-wrap">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToast(null)} 
            className="rounded-lg p-1 hover:bg-black/5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
