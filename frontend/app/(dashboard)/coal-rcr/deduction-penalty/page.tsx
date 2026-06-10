'use client';

import { Scale, Hourglass } from 'lucide-react';

export default function DeductionPenaltyPage() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Deduction / Penalty</h2>
        <p className="text-xs text-slate-500 mt-1">
          Track transit shortages, quality GCV penalties, demurrage, and client shortage claims
        </p>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col items-center justify-center text-center max-w-3xl mx-auto min-h-[350px]">
        <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4">
          <Scale className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-800 uppercase tracking-wider">Deduction / Penalty Configuration Pending</h3>
        <p className="text-xs text-slate-500 mt-2 max-w-md">
          This section will hold transit shortage audit logs, quality deductions, and demurrages. We are waiting for your input details to define the columns and fields.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 font-mono">
          <Hourglass className="h-3.5 w-3.5 animate-pulse text-blue-500" />
          Awaiting input columns specification
        </div>
      </div>
    </div>
  );
}
