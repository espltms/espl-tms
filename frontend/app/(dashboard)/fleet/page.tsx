'use client';

import { useState } from 'react';
import { Truck, AlertTriangle, CheckCircle, Gauge, Activity, Plus, X, ArrowRight } from 'lucide-react';

interface TruckData {
  id: string;
  plateNumber: string;
  model: string;
  type: string;
  capacity: string;
  fuelCard: string;
  health: number;
  status: 'AVAILABLE' | 'ON_TRIP' | 'MAINTENANCE';
}

import { getTrucks } from '@/app/data/dataHelper';

export default function FleetPage() {
  const [trucks, setTrucks] = useState<TruckData[]>(() => getTrucks());
  const [filter, setFilter] = useState('ALL');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    plateNumber: '', model: '', type: 'Tipper', capacity: '', fuelCard: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;

  const filteredTrucks = filter === 'ALL' ? trucks : trucks.filter(t => t.status === filter);
  const totalPages = Math.ceil(filteredTrucks.length / ITEMS_PER_PAGE);
  const paginatedTrucks = filteredTrucks.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTruck: TruckData = {
      id: Date.now().toString(),
      plateNumber: formData.plateNumber.toUpperCase(),
      model: formData.model,
      type: formData.type,
      capacity: `${parseFloat(formData.capacity).toFixed(1)} Tons`,
      fuelCard: formData.fuelCard.toUpperCase() || 'PENDING',
      health: 100,
      status: 'AVAILABLE'
    };
    setTrucks([...trucks, newTruck]);
    setShowModal(false);
    setFormData({ plateNumber: '', model: '', type: 'Tipper', capacity: '', fuelCard: '' });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Fleet Control Specs</h2>
          <p className="text-xs text-slate-500 mt-1">Manage heavy transit vehicles, fuel capacities, and dynamic health alerts</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-md"
        >
          <Plus className="h-4.5 w-4.5" /> Provision New Vehicle
        </button>
      </div>

      {/* Fleet Stats Overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aggregate Utilization</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">
              {Math.round((trucks.filter(t => t.status === 'ON_TRIP').length / trucks.length) * 100) || 0}%
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">+2.4% vs last week</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Fuel Efficiency</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">4.8 Km / L</span>
            <span className="text-[10px] text-slate-400">Bulk Laden average</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Critical Health Alarms</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-red-600">{trucks.filter(t => t.health < 50).length} Vehicle</span>
            <span className="text-[10px] text-red-600 font-semibold">Immediate overhaul scheduled</span>
          </div>
        </div>
      </div>

      {/* Grid List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Fleet Registry</h3>
          <div className="flex gap-2">
            <button onClick={() => { setFilter('ALL'); setCurrentPage(1); }} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${filter === 'ALL' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>ALL</button>
            <button onClick={() => { setFilter('AVAILABLE'); setCurrentPage(1); }} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${filter === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>AVAILABLE</button>
            <button onClick={() => { setFilter('MAINTENANCE'); setCurrentPage(1); }} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition-all ${filter === 'MAINTENANCE' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-white border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}>WORKSHOP</button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Plate Number</th>
                <th className="px-6 py-4">Truck Specs</th>
                <th className="px-6 py-4">Max Capacity</th>
                <th className="px-6 py-4">Active Fuel Card</th>
                <th className="px-6 py-4">Health Index</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {paginatedTrucks.map(truck => (
                <tr key={truck.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-slate-800 font-mono tracking-wider">{truck.plateNumber}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{truck.model} <span className="text-slate-400 font-normal">({truck.type})</span></td>
                  <td className="px-6 py-4 font-semibold text-slate-500">{truck.capacity}</td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">{truck.fuelCard}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                        <div className={`h-full ${truck.health > 80 ? 'bg-emerald-500' : truck.health > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${truck.health}%` }} />
                      </div>
                      <span className={`font-bold text-[10px] ${truck.health > 80 ? 'text-emerald-600' : truck.health > 50 ? 'text-amber-600' : 'text-red-600'}`}>{truck.health}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${
                      truck.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                      truck.status === 'ON_TRIP' ? 'bg-blue-50 text-blue-700 border-blue-200' : 
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {truck.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
              {paginatedTrucks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">No vehicles found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="border-t border-[#e2e8f0] bg-white px-6 py-4 flex items-center justify-between">
            <span className="text-[10px] text-slate-500 font-semibold">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredTrucks.length)} of {filteredTrucks.length} entries
            </span>
            <div className="flex gap-1">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-[#e2e8f0] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Prev
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-white border border-[#e2e8f0] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Provision Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Provision New Vehicle</h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Add a new truck to the fleet registry</p>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Plate Number *</label>
                  <input 
                    type="text" required placeholder="e.g. MH-04-AB-1234"
                    value={formData.plateNumber} onChange={(e) => setFormData({...formData, plateNumber: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Max Capacity (Tons) *</label>
                  <input 
                    type="number" step="0.1" required placeholder="e.g. 40.5"
                    value={formData.capacity} onChange={(e) => setFormData({...formData, capacity: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Truck Model *</label>
                <input 
                  type="text" required placeholder="e.g. Volvo FH16 Multi-Axle"
                  value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Vehicle Type</label>
                  <select 
                    value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1"
                  >
                    <option value="Tipper">Tipper</option>
                    <option value="Dalla">Dalla</option>
                    <option value="Tanker">Tanker</option>
                    <option value="Flatbed">Flatbed</option>
                    <option value="Container Carrier">Container Carrier</option>
                    <option value="Bulker">Bulker</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Fuel Card No.</label>
                  <input 
                    type="text" placeholder="e.g. CARD-VO-8821"
                    value={formData.fuelCard} onChange={(e) => setFormData({...formData, fuelCard: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono uppercase"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-[2] rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                  Register Vehicle <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
