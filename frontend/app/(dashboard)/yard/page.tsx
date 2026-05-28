'use client';

import { useState } from 'react';
import { 
  ParkingCircle, Plus, AlertOctagon, ShieldCheck, Clock, Layers, 
  MapPin, Check, X, Search, Filter, ArrowRight, Truck
} from 'lucide-react';

interface Bay {
  id: string;
  bayNumber: string;
  type: 'LOADING' | 'UNLOADING' | 'TRUCK_PARKING' | 'WAITING_AREA';
  status: 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'MAINTENANCE';
  activeTrip: string;
  dwellMinutes: number;
  truckPlate?: string;
  driverName?: string;
}

const INITIAL_BAYS: Bay[] = [
  { id: 'bay-load-01', bayNumber: 'LD-01', type: 'LOADING', status: 'VACANT', activeTrip: '', dwellMinutes: 0 },
  { id: 'bay-load-02', bayNumber: 'LD-02', type: 'LOADING', status: 'VACANT', activeTrip: '', dwellMinutes: 0 },
  { id: 'bay-unload-01', bayNumber: 'UL-01', type: 'UNLOADING', status: 'VACANT', activeTrip: '', dwellMinutes: 0 },
  { id: 'bay-park-01', bayNumber: 'PK-01', type: 'TRUCK_PARKING', status: 'VACANT', activeTrip: '', dwellMinutes: 0 },
  { id: 'bay-wait-01', bayNumber: 'WA-01', type: 'WAITING_AREA', status: 'VACANT', activeTrip: '', dwellMinutes: 0 },
  { id: 'bay-maint-01', bayNumber: 'MT-01', type: 'TRUCK_PARKING', status: 'MAINTENANCE', activeTrip: '', dwellMinutes: 0 },
];

const isRegionalAdmin = () => {
  if (typeof window === 'undefined') return false;
  try {
    const user = JSON.parse(window.localStorage.getItem('tms_user') || 'null') as { role?: string } | null;
    return user?.role === 'REGION_ADMIN';
  } catch {
    return false;
  }
};

export default function YardPage() {
  const [bays, setBays] = useState<Bay[]>(() => isRegionalAdmin() ? [] : INITIAL_BAYS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [showAllocateModal, setShowAllocateModal] = useState(false);
  const [selectedBay, setSelectedBay] = useState<Bay | null>(null);
  const [allocationForm, setAllocationForm] = useState({
    truckPlate: '',
    driverName: '',
    activeTrip: '',
  });

  const filteredBays = bays.filter(bay => {
    const matchesSearch = 
      bay.bayNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (bay.truckPlate && bay.truckPlate.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (bay.activeTrip && bay.activeTrip.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFilter = filterType === 'ALL' || bay.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'VACANT': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'OCCUPIED': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'RESERVED': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'MAINTENANCE': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getDwellColor = (minutes: number) => {
    if (minutes === 0) return 'text-slate-400';
    if (minutes > 60) return 'text-red-600 font-bold';
    if (minutes > 30) return 'text-amber-600 font-bold';
    return 'text-slate-600';
  };

  const handleAllocate = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedBay) {
      setBays(bays.map(b => b.id === selectedBay.id ? {
        ...b,
        status: 'OCCUPIED',
        truckPlate: allocationForm.truckPlate.toUpperCase(),
        driverName: allocationForm.driverName,
        activeTrip: allocationForm.activeTrip,
        dwellMinutes: 1
      } : b));
    }
    setShowAllocateModal(false);
    setSelectedBay(null);
    setAllocationForm({ truckPlate: '', driverName: '', activeTrip: '' });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Yard & Terminal Bay Management</h2>
          <p className="text-xs text-slate-500 mt-1">Monitor dock loading occupancies, yard queues, and truck gate-house dwell times</p>
        </div>
        <button 
          onClick={() => {
            setSelectedBay(bays.find(b => b.status === 'VACANT') || null);
            setAllocationForm({ truckPlate: '', driverName: '', activeTrip: '' });
            setShowAllocateModal(true);
          }}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-md"
        >
          <Layers className="h-4 w-4" /> Allocate Dock Bay
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Gate Dwell</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{bays.length ? '28m' : '0m'}</span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
               Efficiency +4.2m
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overall Occupancy</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">
              {bays.length ? Math.round((bays.filter(b => b.status === 'OCCUPIED').length / bays.length) * 100) : 0}%
            </span>
            <span className="text-[10px] text-slate-500">
              {bays.filter(b => b.status === 'OCCUPIED').length} of {bays.length} active bays
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Terminal Queue</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600">
              {bays.filter(b => b.type === 'WAITING_AREA' && b.status === 'OCCUPIED').length} Trucks
            </span>
            <span className="text-[10px] text-slate-500">Waiting for docks</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Alerts</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-red-600">
              {bays.filter(b => b.dwellMinutes > 60).length} Critical
            </span>
            <span className="text-[10px] text-slate-500">Dwell time exceeded</span>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Bay, Truck Plate, or Trip ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 placeholder-slate-400 pl-10 pr-4 py-2.5 focus:outline-none focus:border-brand-primary/50 transition-all"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['ALL', 'LOADING', 'UNLOADING', 'TRUCK_PARKING', 'WAITING_AREA'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${
                filterType === type 
                  ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                  : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Visual Bays Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {filteredBays.map(bay => (
          <div 
            key={bay.id} 
            onClick={() => { if (bay.status === 'VACANT') { setSelectedBay(bay); setShowAllocateModal(true); } }}
            className={`bg-white rounded-2xl p-5 border relative overflow-hidden flex flex-col h-56 transition-all ${
              bay.status === 'VACANT' ? 'border-slate-200 hover:border-brand-primary/50 hover:shadow-md cursor-pointer group' : 'border-slate-200 shadow-sm'
            }`}
          >
            {/* Top Row: Bay ID & Status */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <span className="text-[11px] font-extrabold text-slate-800 font-mono tracking-wider">{bay.bayNumber}</span>
                <h4 className="text-[9px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{bay.type.replace('_', ' ')}</h4>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold border uppercase ${getStatusStyle(bay.status)}`}>
                {bay.status === 'VACANT' && <Check className="h-3 w-3" />}
                {bay.status === 'MAINTENANCE' && <AlertOctagon className="h-3 w-3" />}
                {bay.status}
              </span>
            </div>

            {/* Middle Row: Content */}
            <div className="flex-1 flex flex-col justify-center">
              {bay.status === 'VACANT' ? (
                <div className="text-center">
                  <div className="mx-auto w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-colors mb-2">
                    <Plus className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-400 group-hover:text-blue-600 transition-colors">Assign Truck</span>
                </div>
              ) : bay.status === 'MAINTENANCE' ? (
                <div className="text-center text-slate-400">
                  <AlertOctagon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <span className="text-xs font-semibold">Under Maintenance</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800 font-mono">
                    <Truck className="h-4 w-4 text-blue-600" />
                    {bay.truckPlate}
                  </div>
                  {bay.driverName && (
                    <div className="text-xs font-semibold text-slate-600">
                      Driver: {bay.driverName}
                    </div>
                  )}
                  {bay.activeTrip !== '—' && (
                    <div className="text-[10px] font-semibold text-slate-500">
                      Trip ID: <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-1">{bay.activeTrip}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Row: Dwell Time */}
            <div className={`mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] ${getDwellColor(bay.dwellMinutes)}`}>
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-semibold">Dwell Time</span>
              </div>
              <span className="font-extrabold">{bay.dwellMinutes} mins</span>
            </div>
          </div>
        ))}
      </div>

      {/* Allocation Modal */}
      {showAllocateModal && selectedBay && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Allocate Bay: {selectedBay.bayNumber}</h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">{selectedBay.type.replace('_', ' ')}</p>
              </div>
              <button onClick={() => setShowAllocateModal(false)} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAllocate} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Truck Plate Number *</label>
                <input 
                  type="text" 
                  required
                  value={allocationForm.truckPlate}
                  onChange={(e) => setAllocationForm({ ...allocationForm, truckPlate: e.target.value })}
                  placeholder="e.g. MH-04-AB-1234"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Driver ID / Name</label>
                <input 
                  type="text" 
                  value={allocationForm.driverName}
                  onChange={(e) => setAllocationForm({ ...allocationForm, driverName: e.target.value })}
                  placeholder="e.g. EMP-9821 / Rajesh"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Trip ID Reference</label>
                <input 
                  type="text" 
                  value={allocationForm.activeTrip}
                  onChange={(e) => setAllocationForm({ ...allocationForm, activeTrip: e.target.value })}
                  placeholder="e.g. TRIP-99805"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md"
                >
                  Confirm Bay Allocation <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
