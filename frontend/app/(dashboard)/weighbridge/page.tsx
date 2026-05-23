'use client';

import { useState } from 'react';
import { 
  Scale, Plus, ShieldCheck, AlertOctagon, CheckCircle2, FileText,
  Truck, ArrowRight, X, Printer, Fingerprint
} from 'lucide-react';

interface WeighTicket {
  id: string;
  ticketNo: string;
  tripNo: string;
  truckPlate: string;
  material: string;
  grossTons: number;
  tareTons: number;
  netTons: number;
  sealNumber: string;
  status: 'VERIFIED' | 'PENDING_GROSS' | 'REJECTED';
  timestamp: string;
}

import { getWeighTickets } from '@/app/data/dataHelper';

export default function WeighbridgePage() {
  const [tickets, setTickets] = useState<WeighTicket[]>(() => getWeighTickets());
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [ticketData, setTicketData] = useState({
    truckPlate: '', tripNo: '', material: '', tareTons: '', grossTons: '', sealNumber: ''
  });

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'VERIFIED': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PENDING_GROSS': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'REJECTED': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep(2);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tare = parseFloat(ticketData.tareTons) || 15.0;
    const gross = parseFloat(ticketData.grossTons) || 0;
    const net = gross > tare ? gross - tare : 0;
    
    const newTicket: WeighTicket = {
      id: Date.now().toString(),
      ticketNo: `TKT-WB-${Math.floor(Math.random() * 10000) + 50000}`,
      tripNo: ticketData.tripNo || 'TRIP-NEW',
      truckPlate: ticketData.truckPlate,
      material: ticketData.material,
      tareTons: tare,
      grossTons: gross,
      netTons: net,
      sealNumber: ticketData.sealNumber || '—',
      status: gross > 0 ? 'VERIFIED' : 'PENDING_GROSS',
      timestamp: new Date().toLocaleString('en-IN', { hour12: true, month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })
    };
    
    setTickets([newTicket, ...tickets]);
    setShowModal(false);
    setStep(1);
    setTicketData({ truckPlate: '', tripNo: '', material: '', tareTons: '', grossTons: '', sealNumber: '' });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Weighbridge & Weighing Tickets</h2>
          <p className="text-xs text-slate-500 mt-1">Register vehicle tare weights, gross weights, and lock tamper-proof cargo security seals</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-md"
        >
          <Scale className="h-4 w-4" /> Log Weighment
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Net Payload</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">
              {tickets.reduce((sum, t) => sum + t.netTons, 0).toFixed(2)}t
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">Today's load-out</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Verified Tickets</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{tickets.filter(t => t.status === 'VERIFIED').length}</span>
            <span className="text-[10px] text-slate-500">Tickets generated</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Gross</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600">{tickets.filter(t => t.status === 'PENDING_GROSS').length}</span>
            <span className="text-[10px] text-slate-500">Trucks in yard</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">System Status</span>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600">Active</span>
            <span className="text-[10px] text-slate-500">Scale calibrated</span>
          </div>
        </div>
      </div>

      {/* Tickets table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex justify-between items-center">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-brand-primary" /> Tamper-Proof Weighbridge Tickets
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Ticket details</th>
                <th className="px-6 py-4">Material</th>
                <th className="px-6 py-4">Gross (Tons)</th>
                <th className="px-6 py-4">Tare (Tons)</th>
                <th className="px-6 py-4">Net (Tons)</th>
                <th className="px-6 py-4">Seal No.</th>
                <th className="px-6 py-4 text-right">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {tickets.map(tkt => (
                <tr key={tkt.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-extrabold text-slate-800 font-mono tracking-wider">{tkt.ticketNo}</span>
                      <div className="flex items-center gap-2 mt-1 text-[10px]">
                        <span className="text-blue-600 font-mono bg-blue-50 px-1 py-0.5 rounded">{tkt.tripNo}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500 font-mono">{tkt.truckPlate}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{tkt.material}</td>
                  <td className="px-6 py-4 font-mono font-semibold">{tkt.grossTons > 0 ? tkt.grossTons.toFixed(2) : '—'}</td>
                  <td className="px-6 py-4 font-mono text-slate-500">{tkt.tareTons.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className="font-extrabold text-slate-800 font-mono bg-slate-100 px-2 py-1 rounded">
                      {tkt.netTons > 0 ? tkt.netTons.toFixed(2) : '—'}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-[11px] text-slate-500">
                    {tkt.sealNumber !== '—' ? (
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3 text-emerald-600" /> {tkt.sealNumber}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold border uppercase ${getStatusStyle(tkt.status)}`}>
                        {tkt.status === 'VERIFIED' && <CheckCircle2 className="h-3 w-3" />}
                        {tkt.status.replace('_', ' ')}
                      </span>
                      <span className="text-[9px] text-slate-400">{tkt.timestamp}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                  Log Weighment - Step {step} of 2
                </h3>
              </div>
              <button onClick={() => { setShowModal(false); setStep(1); }} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            {step === 1 ? (
              <form onSubmit={handleNextStep} className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Truck Plate No.</label>
                    <input 
                      type="text" required placeholder="e.g. MH-04-AB-1234"
                      value={ticketData.truckPlate} onChange={(e) => setTicketData({...ticketData, truckPlate: e.target.value.toUpperCase()})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 uppercase font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Trip ID</label>
                    <input 
                      type="text" placeholder="e.g. TRIP-99805"
                      value={ticketData.tripNo} onChange={(e) => setTicketData({...ticketData, tripNo: e.target.value.toUpperCase()})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 uppercase font-mono"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Commodity / Material</label>
                  <input 
                    type="text" required placeholder="e.g. Iron Ore Fines"
                    value={ticketData.material} onChange={(e) => setTicketData({...ticketData, material: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20"
                  />
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                    Capture Tare & Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-2 flex items-center justify-between">
                  <div>
                    <div className="font-mono text-xs font-bold text-slate-800">{ticketData.truckPlate}</div>
                    <div className="text-[10px] text-slate-500 uppercase mt-0.5">{ticketData.material}</div>
                  </div>
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <Truck className="h-4 w-4 text-blue-600" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Tare Weight (Tons)</label>
                    <div className="relative">
                      <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input 
                        type="number" step="0.01" required placeholder="15.20"
                        value={ticketData.tareTons} onChange={(e) => setTicketData({...ticketData, tareTons: e.target.value})}
                        className="w-full bg-white border border-slate-300 rounded-xl py-2.5 pl-9 pr-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Gross Weight (Optional)</label>
                    <div className="relative">
                      <Scale className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input 
                        type="number" step="0.01" placeholder="53.40"
                        value={ticketData.grossTons} onChange={(e) => setTicketData({...ticketData, grossTons: e.target.value})}
                        className="w-full bg-white border border-slate-300 rounded-xl py-2.5 pl-9 pr-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 font-mono font-bold"
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 mt-1">Leave blank if only tare is captured</p>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Security Seal No. (If loaded)</label>
                  <input 
                    type="text" placeholder="e.g. SEAL-9921"
                    value={ticketData.sealNumber} onChange={(e) => setTicketData({...ticketData, sealNumber: e.target.value.toUpperCase()})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 uppercase font-mono"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setStep(1)} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                    Back
                  </button>
                  <button type="submit" className="flex-[2] rounded-xl bg-gradient-to-r from-brand-success to-emerald-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                    Generate Ticket <Printer className="h-4 w-4" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
