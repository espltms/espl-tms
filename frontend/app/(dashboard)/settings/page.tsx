'use client';

import { useState } from 'react';
import { Settings, ShieldCheck, Activity, Users, FileText, CheckCircle2 } from 'lucide-react';

export default function SettingsPage() {
  const [logs, setLogs] = useState([
    { id: '1', operator: 'Sarah Jenkins', action: 'TRIP_DISPATCHED', payload: 'TRIP-99801 (Volvo FH16)', timestamp: '2026-05-23T09:15:00Z', ip: '192.168.1.104' },
    { id: '2', operator: 'Elena Rostova', action: 'INVOICE_THREE_WAY_MATCH_RUN', payload: 'INV-VEN-491028 (Disbursed)', timestamp: '2026-05-23T08:30:00Z', ip: '192.168.1.105' },
    { id: '3', operator: 'Arthur Dent', action: 'COMPLIANCE_VERIFIED', payload: 'DL-9948271 (Approved)', timestamp: '2026-05-23T08:12:00Z', ip: '192.168.1.106' },
  ]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">System Configuration & Security Auditing</h2>
          <p className="text-xs text-slate-500 mt-1">Configure global role access constraints, verify endpoint parameters, and audit system security logs</p>
        </div>
      </div>

      {/* Admin metrics overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="glass-card rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unified System Integrity</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">100% SECURED</span>
            <span className="text-[10px] text-brand-success font-semibold">RSA-4096 logs checking</span>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Security Audit Rate</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">Continuous</span>
            <span className="text-[10px] text-slate-400">Global operator actions logs</span>
          </div>
        </div>
        <div className="glass-card rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">API Connections Health</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-brand-success">ACTIVE & SECURE</span>
            <span className="text-[10px] text-brand-success font-semibold">WS Dispatch streams clear</span>
          </div>
        </div>
      </div>

      {/* Security logs table */}
      <div className="glass-panel rounded-2xl border border-brand-slate overflow-hidden">
        <div className="border-b border-[#e2e8f0] bg-white/60 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tamper-Proof Audit logs</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">System Operator</th>
                <th className="px-6 py-4">Security Action</th>
                <th className="px-6 py-4">Transaction Payload Details</th>
                <th className="px-6 py-4">Filing Timestamp</th>
                <th className="px-6 py-4 text-right">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] text-slate-600">
              {logs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-brand-primary" />
                      <span className="font-extrabold text-slate-800">{log.operator}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block rounded bg-white border border-[#e2e8f0] text-brand-secondary px-2 py-0.5 text-[9px] font-bold uppercase font-mono tracking-wider">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-slate-600">{log.payload}</td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-slate-400">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
