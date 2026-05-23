'use client';

import { useState } from 'react';
import { Warehouse, Plus, AlertTriangle, ShieldCheck, ShoppingCart, Activity, X, ArrowRight } from 'lucide-react';

interface Part {
  id: string;
  partNo: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  cost: number;
  location: string;
}

const INITIAL_PARTS: Part[] = [];

export default function InventoryPage() {
  const [parts, setParts] = useState<Part[]>(INITIAL_PARTS);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    partNo: '', name: '', category: 'ENGINE_FILTERS', stock: '', minStock: '', cost: '', location: ''
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const handleRestock = (id: string) => {
    setParts(parts.map(p => p.id === id ? { ...p, stock: p.stock + 10 } : p));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newPart: Part = {
      id: Date.now().toString(),
      partNo: formData.partNo.toUpperCase(),
      name: formData.name,
      category: formData.category,
      stock: parseInt(formData.stock) || 0,
      minStock: parseInt(formData.minStock) || 5,
      cost: parseFloat(formData.cost) || 0,
      location: formData.location.toUpperCase() || 'GENERAL-STORE'
    };
    setParts([newPart, ...parts]);
    setShowModal(false);
    setFormData({ partNo: '', name: '', category: 'ENGINE_FILTERS', stock: '', minStock: '', cost: '', location: '' });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Store & Spare Inventory</h2>
          <p className="text-xs text-slate-500 mt-1">Manage warehouse spare parts, trigger automated stock level replenishment, and evaluate costs (₹ / INR)</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-md"
        >
          <Plus className="h-4.5 w-4.5" /> Enlist Spare Part Item
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Spare Parts Total Assets Valuation</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{formatCurrency(parts.reduce((sum, p) => sum + (p.stock * p.cost), 0))}</span>
            <span className="text-[10px] text-slate-400 font-semibold">Audited stock asset sheet</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Items Stocked</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{parts.length} Spare lines</span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">Continuous stock sync</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Low Stock Alerts Pending</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-red-600">{parts.filter(p => p.stock < p.minStock).length} Alarms</span>
            <span className="text-[10px] text-red-600 font-semibold">Requires immediate attention</span>
          </div>
        </div>
      </div>

      {/* Low stock alert */}
      {parts.some(p => p.stock < p.minStock) && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 leading-relaxed shadow-sm">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold uppercase">WAREHOUSE REORDER REQUIRED:</span>
            <p className="text-[10px] text-red-600 mt-1">
              {parts.filter(p => p.stock < p.minStock).map(p => `${p.partNo} (${p.stock}/${p.minStock})`).join(', ')} 
              have reached critically low stock levels. Automated restock requisition forwarded to Procurement.
            </p>
          </div>
        </div>
      )}

      {/* Spare parts list */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Spare Parts Stock Ledger</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Part Number</th>
                <th className="px-6 py-4">Item Specifications</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 font-mono">Stock Level</th>
                <th className="px-6 py-4">Unit Cost</th>
                <th className="px-6 py-4">Warehouse Location</th>
                <th className="px-6 py-4 text-right">Replenish</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {parts.map(part => (
                <tr key={part.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Warehouse className="h-4 w-4 text-brand-primary" />
                      <span className="font-extrabold text-slate-800 font-mono tracking-wider">{part.partNo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{part.name}</td>
                  <td className="px-6 py-4">
                    <span className="text-[9px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded shadow-sm">
                      {part.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`font-bold font-mono px-2 py-1 rounded ${part.stock < part.minStock ? 'text-red-700 bg-red-100 animate-pulse' : 'text-slate-800 bg-slate-100'}`}>
                      {part.stock} / {part.minStock} units
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">{formatCurrency(part.cost)}</td>
                  <td className="px-6 py-4 text-slate-500 font-mono text-[10px]">{part.location}</td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => handleRestock(part.id)}
                      className="rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 text-[10px] font-extrabold px-3 py-1.5 transition-all shadow-sm active:scale-95"
                    >
                      Restock +10
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enlist Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Enlist Spare Part</h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Register new item to warehouse ledger</p>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Part Number *</label>
                  <input 
                    type="text" required placeholder="e.g. PRT-XYZ-1234"
                    value={formData.partNo} onChange={(e) => setFormData({...formData, partNo: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all uppercase font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Category *</label>
                  <select 
                    value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                  >
                    <option value="ENGINE_FILTERS">Engine Filters</option>
                    <option value="TYRES">Tyres</option>
                    <option value="BRAKES">Brakes</option>
                    <option value="OILS">Oils & Lubricants</option>
                    <option value="LIGHTS">Lighting</option>
                    <option value="MISC">Miscellaneous</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Item Name / Specs *</label>
                <input 
                  type="text" required placeholder="e.g. Heavy Duty Axle Grease"
                  value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Initial Stock</label>
                  <input 
                    type="number" required placeholder="0"
                    value={formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Min Alert Limit</label>
                  <input 
                    type="number" required placeholder="5"
                    value={formData.minStock} onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Unit Cost (₹)</label>
                  <input 
                    type="number" step="0.01" required placeholder="e.g. 1500"
                    value={formData.cost} onChange={(e) => setFormData({...formData, cost: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Warehouse Location / Bay</label>
                <input 
                  type="text" placeholder="e.g. WAREHOUSE-BAY-A1"
                  value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all uppercase font-mono"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-[2] rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                  Confirm Registration <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
