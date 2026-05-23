'use client';

import { useState } from 'react';
import { Disc, AlertOctagon, HelpCircle, ShieldCheck, Check, Activity, Sparkles, Layers } from 'lucide-react';

export default function TyresPage() {
  const [tyres, setTyres] = useState<any[]>([]);

  const triggerAudit = () => {
    // Simulated live inspection telemetry
    alert('Simulating direct IoT integration... Tyre inspection logs successfully fetched and synchronized!');
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Tyre Telemetry & Wear Auditing</h2>
          <p className="text-xs text-slate-500 mt-1">Monitor tire health index, pressure ratings, and tread levels to avoid transit blowouts</p>
        </div>
        <button 
          onClick={triggerAudit}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-4 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold"
        >
          <Activity className="h-4.5 w-4.5" /> Pull Real-time Tyre Telemetry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Tread Lifetime</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">7.8 mm</span>
            <span className="text-[10px] text-brand-success font-semibold">Tires within safe operating index</span>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inspected Tires</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">24 Tires Active</span>
            <span className="text-[10px] text-slate-400">Continuous tread depth sensing</span>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Urgent Replacements Flagged</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-brand-danger">1 Tire Alert</span>
            <span className="text-[10px] text-brand-danger font-semibold">Tread below 2.0mm threshold limit</span>
          </div>
        </div>
      </div>

      {/* Visual Tyre mapping layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Rear Wheel Axle display */}
        <div className="glass-panel rounded-2xl border border-brand-slate p-6 lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-6">Wheel Position Audits</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-[#e2e8f0] p-4 text-center">
              <span className="text-[10px] font-bold text-slate-400 block mb-3">STEERING WHEELS (WYOMING TRUCK)</span>
              <div className="flex justify-around items-center">
                <div>
                  <div className="text-[9px] font-bold text-brand-primary">FRONT LEFT</div>
                  <div className="mt-2 text-base font-extrabold text-slate-800">9.2 mm</div>
                  <span className="text-[8px] font-bold text-brand-success bg-brand-success/10 px-1.5 py-0.5 rounded border border-brand-success/20">GOOD</span>
                </div>
                <div className="h-10 w-0.5 bg-slate-200" />
                <div>
                  <div className="text-[9px] font-bold text-brand-primary">FRONT RIGHT</div>
                  <div className="mt-2 text-base font-extrabold text-slate-800">8.9 mm</div>
                  <span className="text-[8px] font-bold text-brand-success bg-brand-success/10 px-1.5 py-0.5 rounded border border-brand-success/20">GOOD</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-white border border-[#e2e8f0] p-4 text-center">
              <span className="text-[10px] font-bold text-slate-400 block mb-3">DRIVE WHEELS (TEXAS TANKER)</span>
              <div className="flex justify-around items-center">
                <div>
                  <div className="text-[9px] font-bold text-brand-primary">REAR LEFT</div>
                  <div className="mt-2 text-base font-extrabold text-brand-warning">3.2 mm</div>
                  <span className="text-[8px] font-bold text-brand-warning bg-brand-warning/10 px-1.5 py-0.5 rounded border border-brand-warning/20">WORN</span>
                </div>
                <div className="h-10 w-0.5 bg-slate-200" />
                <div>
                  <div className="text-[9px] font-bold text-brand-primary">REAR RIGHT</div>
                  <div className="mt-2 text-base font-extrabold text-brand-danger">1.5 mm</div>
                  <span className="text-[8px] font-bold text-brand-danger bg-brand-danger/10 px-1.5 py-0.5 rounded border border-brand-danger/20">REPLACE</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tyre inspection ledger */}
        <div className="glass-panel rounded-2xl border border-brand-slate p-6">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Inspection Ledger</h3>
          <div className="space-y-4">
            {tyres.map(tyre => (
              <div key={tyre.id} className="rounded-xl bg-white border border-[#e2e8f0] p-4 flex justify-between items-center text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <Disc className="h-4 w-4 text-brand-primary" />
                    <span className="font-bold text-slate-800 font-mono">{tyre.serial}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Truck: {tyre.truck} ({tyre.position.replace('_', ' ')})</div>
                  <div className="text-[10px] text-slate-500 mt-1">Tread: {tyre.treadMm}mm | Pressure: {tyre.pressurePsi} Psi</div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ${
                  tyre.status === 'GOOD' 
                    ? 'bg-brand-success/15 text-brand-success border border-brand-success/20' 
                    : tyre.status === 'WORN' 
                    ? 'bg-brand-warning/15 text-brand-warning border border-brand-warning/20' 
                    : 'bg-brand-danger/15 text-brand-danger border border-brand-danger/20'
                }`}>
                  {tyre.status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
