'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  RefreshCw, 
  Layers, 
  TrendingUp, 
  Scale, 
  BadgeCent, 
  FileText
} from 'lucide-react';
import { fetchSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { DOMasterRecord } from '../do-master/page';
import { RREntryRecord } from '../rr-entry/page';
import { DeductionPenaltyRecord } from '../deduction-penalty/page';
import { BillingPaymentRecord } from '../billing-payment/page';

const DO_MASTER_KEY = 'tms_coal_do_master';
const RR_ENTRY_KEY = 'tms_coal_rr_entry';
const DEDUCTION_PENALTY_KEY = 'tms_coal_deduction_penalty';
const BILLING_PAYMENT_KEY = 'tms_coal_billing_payment';

interface SidingAggregation {
  siding: string;
  totalDoQty: number;
  liftedQty: number;
  lapsedQty: number;
  grnQty: number;
  normalisedQty: number;
  totalDeduction: number;
  finalPayable: number;
}

export default function SummaryDashboardPage() {
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [rrRecords, setRrRecords] = useState<RREntryRecord[]>([]);
  const [deductions, setDeductions] = useState<DeductionPenaltyRecord[]>([]);
  const [billings, setBillings] = useState<BillingPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('tms_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [doRes, rrRes, dpRes, bpRes] = await Promise.all([
        fetch('/api/coal-rcr/do-master', { headers }),
        fetch('/api/coal-rcr/rr-entry', { headers }),
        fetch('/api/coal-rcr/deduction-penalty', { headers }),
        fetch('/api/coal-rcr/billing-payment', { headers })
      ]);

      if (doRes.ok && rrRes.ok && dpRes.ok && bpRes.ok) {
        const doData = await doRes.json();
        const rrData = await rrRes.json();
        const dpData = await dpRes.json();
        const bpData = await bpRes.json();

        if (doData.success && rrData.success && dpData.success && bpData.success) {
          setDoRecords(doData.data);
          setRrRecords(rrData.data);
          setDeductions(dpData.data);
          setBillings(bpData.data);

          localStorage.setItem(DO_MASTER_KEY, JSON.stringify(doData.data));
          localStorage.setItem(RR_ENTRY_KEY, JSON.stringify(rrData.data));
          localStorage.setItem(DEDUCTION_PENALTY_KEY, JSON.stringify(dpData.data));
          localStorage.setItem(BILLING_PAYMENT_KEY, JSON.stringify(bpData.data));
        }
      } else {
        const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
        const localRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
        const localDeductions = readLocalValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []);
        const localBillings = readLocalValue<BillingPaymentRecord[]>(BILLING_PAYMENT_KEY, []);
        
        setDoRecords(localDOs);
        setRrRecords(localRRs);
        setDeductions(localDeductions);
        setBillings(localBillings);
      }
    } catch (e) {
      console.error("Error loading summary dashboard data:", e);
      const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
      const localRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
      const localDeductions = readLocalValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []);
      const localBillings = readLocalValue<BillingPaymentRecord[]>(BILLING_PAYMENT_KEY, []);
      
      setDoRecords(localDOs);
      setRrRecords(localRRs);
      setDeductions(localDeductions);
      setBillings(localBillings);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Aggregation logic grouped by Siding
  const sidingAggregations = useMemo((): SidingAggregation[] => {
    // Collect all unique sidings
    const sidingsSet = new Set<string>();
    doRecords.forEach(d => { if (d.siding) sidingsSet.add(d.siding.trim()); });
    rrRecords.forEach(r => { if (r.siding) sidingsSet.add(r.siding.trim()); });

    const result: SidingAggregation[] = [];

    sidingsSet.forEach(sidingName => {
      // Find DOs for this siding
      const matchedDOs = doRecords.filter(d => d.siding.trim().toLowerCase() === sidingName.toLowerCase());
      const matchedDONos = matchedDOs.map(d => d.doNo);
      
      // Calculate DO Qty
      const totalDoQty = matchedDOs.reduce((acc, d) => acc + Number(d.doQty), 0);

      // Find RRs for these DOs or this siding
      const matchedRRs = rrRecords.filter(r => 
        r.siding.trim().toLowerCase() === sidingName.toLowerCase() ||
        matchedDONos.includes(r.doNo)
      );
      const matchedRRNos = matchedRRs.map(r => r.rrNo);

      // Calculate weights
      const liftedQty = matchedRRs.reduce((acc, r) => acc + Number(r.rrChQty), 0);
      const lapsedQty = Math.max(0, totalDoQty - liftedQty);
      const grnQty = matchedRRs.reduce((acc, r) => acc + Number(r.grnQty), 0);
      const normalisedQty = matchedRRs.reduce((acc, r) => acc + Number(r.normalisedQty), 0);

      // Calculate deductions
      const matchedDeductions = deductions.filter(d => matchedRRNos.includes(d.rrNo) || matchedDONos.includes(d.doNo));
      const totalDeduction = matchedDeductions.reduce((acc, d) => acc + Number(d.finalDeduction), 0);

      // Calculate billing final payable
      const matchedBillings = billings.filter(b => matchedDONos.includes(b.doNo));
      const finalPayable = matchedBillings.reduce((acc, b) => acc + Number(b.finalPayable), 0);

      result.push({
        siding: sidingName,
        totalDoQty,
        liftedQty,
        lapsedQty,
        grnQty,
        normalisedQty,
        totalDeduction,
        finalPayable
      });
    });

    return result.sort((a, b) => b.totalDoQty - a.totalDoQty);
  }, [doRecords, rrRecords, deductions, billings]);

  // Overall KPIs
  const kpis = useMemo(() => {
    const totalDoVolume = sidingAggregations.reduce((acc, s) => acc + s.totalDoQty, 0);
    const totalLiftedVolume = sidingAggregations.reduce((acc, s) => acc + s.liftedQty, 0);
    const totalDeductionsCost = sidingAggregations.reduce((acc, s) => acc + s.totalDeduction, 0);
    const totalPayableCost = sidingAggregations.reduce((acc, s) => acc + s.finalPayable, 0);
    const liftingProgress = totalDoVolume > 0 ? (totalLiftedVolume / totalDoVolume) * 100 : 0;
    
    return { totalDoVolume, totalLiftedVolume, totalDeductionsCost, totalPayableCost, liftingProgress };
  }, [sidingAggregations]);

  return (
    <div className="space-y-8 animate-fade-in text-slate-700">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Summary Dashboard</h2>
          <p className="text-xs text-slate-500 mt-1">
            Real-time siding-wise operational aggregates: allocated quantities, wagon lifting progress, and billing balances
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={fetchData}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm disabled:opacity-60 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Dashboard
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* DO Volume */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total DO Sourced</span>
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{kpis.totalDoVolume.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">Tons</span>
          </div>
        </div>

        {/* Wagon Lifting Progress */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Wagon Lifting Progress</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-4 flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-700">{kpis.liftingProgress.toFixed(1)}%</span>
              <span className="text-[10px] text-slate-400">({kpis.totalLiftedVolume.toLocaleString('en-IN')} MT Lifted)</span>
            </div>
            {/* progress bar */}
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
              <div 
                className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min(100, kpis.liftingProgress)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Penalties */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Deduction / Penalty</span>
            <Scale className="h-4 w-4 text-red-500" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-red-600">₹{kpis.totalDeductionsCost.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-red-500 font-semibold">deductions</span>
          </div>
        </div>

        {/* Net Billing Payable */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Net Billing Payable</span>
            <BadgeCent className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">₹{kpis.totalPayableCost.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">net payable</span>
          </div>
        </div>
      </div>

      {/* Siding Aggregates Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <LayoutDashboard className="h-4.5 w-4.5 text-blue-600" /> Siding-wise Aggregated Reports ({sidingAggregations.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">Siding Name</th>
                <th className="px-5 py-4 text-right">Total DO Qty (MT)</th>
                <th className="px-5 py-4 text-right">Lifted Qty (MT)</th>
                <th className="px-5 py-4 text-right">Lapsed Qty (MT)</th>
                <th className="px-5 py-4 text-right">GRN Qty (MT)</th>
                <th className="px-5 py-4 text-right">Normalised Qty (MT)</th>
                <th className="px-5 py-4 text-right">Total Deduction (₹)</th>
                <th className="px-5 py-4 text-right font-bold">Final Payable (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> Aggregating records...
                    </span>
                  </td>
                </tr>
              ) : sidingAggregations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No transportation data available to aggregate.
                  </td>
                </tr>
              ) : (
                sidingAggregations.map((r, idx) => (
                  <tr key={r.siding} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                    <td className="px-5 py-4 font-extrabold text-slate-800 tracking-wide uppercase">
                      {r.siding}
                    </td>
                    <td className="px-5 py-4 font-mono text-right font-semibold">{r.totalDoQty ? r.totalDoQty.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right font-semibold text-blue-600">{r.liftedQty ? r.liftedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right text-slate-400">{r.lapsedQty ? r.lapsedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right">{r.grnQty ? r.grnQty.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right">{r.normalisedQty ? r.normalisedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right font-bold text-red-600">₹{r.totalDeduction ? r.totalDeduction.toLocaleString('en-IN') : '0'}</td>
                    <td className="px-5 py-4 font-mono text-right font-bold text-emerald-600 bg-emerald-50/10">₹{r.finalPayable ? r.finalPayable.toLocaleString('en-IN') : '0'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
