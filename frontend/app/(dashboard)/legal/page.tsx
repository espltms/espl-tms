'use client';

import { useState } from 'react';
import { Building2, Plus, ShieldCheck, AlertOctagon, Sparkles, FileSpreadsheet, X, ArrowRight } from 'lucide-react';

interface Compliance {
  id: string;
  name: string;
  category: string;
  filingDate: string;
  renewalDate: string;
  score: number;
  status: 'COMPLIANT' | 'PENDING_AUDIT' | 'NON_COMPLIANT';
}

const INITIAL_COMPLIANCES: Compliance[] = [];

export default function LegalPage() {
  const [compliances, setCompliances] = useState<Compliance[]>(INITIAL_COMPLIANCES);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', category: 'TAX_LAW', filingDate: '', renewalDate: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newCompliance: Compliance = {
      id: Date.now().toString(),
      name: formData.name,
      category: formData.category,
      filingDate: formData.filingDate || new Date().toISOString().split('T')[0],
      renewalDate: formData.renewalDate || new Date(Date.now() + 180*24*60*60*1000).toISOString().split('T')[0], // 6 months from now
      score: 100,
      status: 'PENDING_AUDIT'
    };
    setCompliances([newCompliance, ...compliances]);
    setShowModal(false);
    setFormData({ name: '', category: 'TAX_LAW', filingDate: '', renewalDate: '' });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Corporate Statutory Law & ESG Compliance</h2>
          <p className="text-xs text-slate-500 mt-1">Audit company legal filings, employee labor certifications, and fleet environmental emissions credits</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-md"
        >
          <Plus className="h-4.5 w-4.5" /> Log Regulatory Filing
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unified Regulatory Compliance Score</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">
              {(compliances.reduce((sum, c) => sum + c.score, 0) / compliances.length || 0).toFixed(1)} / 100
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">+0.8% variance</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Compliance Audits</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{compliances.length} Filings</span>
            <span className="text-[10px] text-slate-400">
              {compliances.filter(c => c.status === 'PENDING_AUDIT').length} pending audit
            </span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Carbon Emissions Balance</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">1,240 MT Credits</span>
            <span className="text-[10px] text-blue-600 font-semibold">ESG targets maintained</span>
          </div>
        </div>
      </div>

      {/* Compliance board list table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-brand-primary" /> Statutory Audits Dashboard
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Filing Description</th>
                <th className="px-6 py-4">Law Category</th>
                <th className="px-6 py-4">Filing Date</th>
                <th className="px-6 py-4">Audit / Renewal Due</th>
                <th className="px-6 py-4">Audit Score</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {compliances.map(comp => (
                <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="font-extrabold text-slate-800">{comp.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[9px] font-bold text-slate-600 bg-white border border-slate-200 shadow-sm px-2 py-0.5 rounded uppercase font-mono tracking-wider">
                      {comp.category.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono">
                    {new Date(comp.filingDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-slate-500 font-mono">
                    {new Date(comp.renewalDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 font-bold text-emerald-600">
                      <ShieldCheck className="h-4 w-4" />
                      <span>{comp.score}% Score</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold border uppercase ${
                      comp.status === 'COMPLIANT' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : comp.status === 'PENDING_AUDIT' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {comp.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Regulatory Filing Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Log Regulatory Filing</h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Submit new compliance or audit record</p>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Filing Description / Name *</label>
                <input 
                  type="text" required placeholder="e.g. FY26 Q1 Environmental Emissions Report"
                  value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Law / Regulatory Category *</label>
                <select 
                  value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                >
                  <option value="TAX_LAW">Tax Law & Finance</option>
                  <option value="LABOR_REGULATION">Labor Regulation & HR</option>
                  <option value="ENVIRONMENTAL">Environmental / ESG</option>
                  <option value="CORPORATE">Corporate Governance</option>
                  <option value="SAFETY">Safety & DOT Compliance</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Filing Date</label>
                  <input 
                    type="date"
                    value={formData.filingDate} onChange={(e) => setFormData({...formData, filingDate: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Next Audit / Renewal Date</label>
                  <input 
                    type="date"
                    value={formData.renewalDate} onChange={(e) => setFormData({...formData, renewalDate: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-[2] rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                  Submit Filing <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
