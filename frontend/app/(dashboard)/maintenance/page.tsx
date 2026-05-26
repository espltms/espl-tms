'use client';

import { useEffect, useState } from 'react';
import { Wrench, Plus, AlertOctagon, ShieldCheck, Clock, X, ArrowRight } from 'lucide-react';

interface Order {
  id: string;
  truckPlate: string;
  description: string;
  severity: string;
  cost: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  workshop: string;
}

import { getTrucks } from '@/app/data/dataHelper';

const allTrucks = getTrucks();
const INITIAL_ORDERS: Order[] = [];
const MANUAL_MAINTENANCE_KEY = 'tms_manual_maintenance_orders';

export default function MaintenancePage() {
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [modalOpen, setModalOpen] = useState(false);
  
  const [plate, setPlate] = useState(allTrucks[0]?.plateNumber || '');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('MEDIUM');
  const [cost, setCost] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MANUAL_MAINTENANCE_KEY);
      if (!saved) return;
      setOrders(JSON.parse(saved) as Order[]);
    } catch {
      localStorage.removeItem(MANUAL_MAINTENANCE_KEY);
    }
  }, []);

  const handleCreateOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const newOrder: Order = {
      id: Date.now().toString(),
      truckPlate: plate,
      description,
      severity,
      cost: parseFloat(cost) || 0,
      status: 'PENDING',
      workshop: ''
    };
    const nextOrders = [newOrder, ...orders];
    localStorage.setItem(MANUAL_MAINTENANCE_KEY, JSON.stringify(nextOrders));
    setOrders(nextOrders);
    setModalOpen(false);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Workshop & Maintenance</h2>
          <p className="text-xs text-slate-500 mt-1">Schedule vehicle services, track mechanics orders, and manage spare parts allocations</p>
        </div>
        <button 
          onClick={() => setModalOpen(true)}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-md"
        >
          <Plus className="h-4.5 w-4.5" /> Schedule Workshop Service
        </button>
      </div>

      {/* Maintenance metrics overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Service Budget Cycle Expense</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{formatCurrency(orders.reduce((sum, o) => sum + o.cost, 0))}</span>
            <span className="text-[10px] text-slate-400 font-semibold">Tuned against maintenance reserves</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Repair Orders</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{orders.length} Active</span>
            <span className="text-[10px] text-slate-400">
              {orders.filter(o => o.status === 'IN_PROGRESS').length} In-progress at terminal bay
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Critical Breakdown Alerts</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-red-600">{orders.filter(o => o.severity === 'CRITICAL').length} Overhaul</span>
            <span className="text-[10px] text-red-600 font-semibold">Requires immediate attention</span>
          </div>
        </div>
      </div>

      {/* Repair orders grid list */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-600" /> Service Work Orders
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Plate Number</th>
                <th className="px-6 py-4">Work Description</th>
                <th className="px-6 py-4">Severity Triage</th>
                <th className="px-6 py-4">Service Cost</th>
                <th className="px-6 py-4">Workshop Facility</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-slate-800 font-mono tracking-wider">{order.truckPlate}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{order.description}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase border ${
                      order.severity === 'CRITICAL' 
                        ? 'bg-red-50 text-red-700 border-red-200' 
                        : order.severity === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {order.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800 font-mono">{formatCurrency(order.cost)}</td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-[10px]">{order.workshop}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${
                      order.status === 'PENDING' 
                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                        : order.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {order.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Schedule Maintenance modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Create Workshop Order</h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Schedule repair or maintenance task</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Select Vehicle *</label>
                <select 
                  value={plate} 
                  onChange={(e) => setPlate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono uppercase"
                >
                  {allTrucks.map(truck => (
                    <option key={truck.id} value={truck.plateNumber}>
                      {truck.plateNumber} ({truck.model})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Defect description *</label>
                <textarea 
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 h-20 resize-none transition-all"
                  placeholder="Describe the issues or required maintenance..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Severity Triage *</label>
                  <select 
                    value={severity} 
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                  >
                    <option value="LOW">Low Priority (Routine)</option>
                    <option value="MEDIUM">Medium Priority</option>
                    <option value="CRITICAL">Critical Locked</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Estimated Budget (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-[2] w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md"
                >
                  Issue Workshop Order <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
