'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  Milestone, 
  RefreshCw, 
  Activity,
  Scale,
  GitCompare,
  Layers,
  Search
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { DOMasterRecord, RREntryRecord, QualityTrackingRecord, DeductionPenaltyRecord } from '../types';
import { readLocalValue } from '@/lib/syncedStorage';

const DO_MASTER_KEY = 'tms_coal_do_master';
const RR_ENTRY_KEY = 'tms_coal_rr_entry';
const QUALITY_TRACKING_KEY = 'tms_coal_quality_tracking';
const DEDUCTION_PENALTY_KEY = 'tms_coal_deduction_penalty';

const MINES = [
  { id: 'ANANTA', name: 'ANANTA' },
  { id: 'BBSRI', name: 'BBSRI' },
  { id: 'KANIHA', name: 'KANIHA' },
  { id: 'JAGANNATH', name: 'JAGANNATH' },
  { id: 'LINGARAJ', name: 'LINGARAJ' },
  { id: 'BHARATPUR', name: 'BHARATPUR' }
];

export default function OcpTrackRecordPage() {
  const { user } = useAuthStore();
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [rrRecords, setRrRecords] = useState<RREntryRecord[]>([]);
  const [qualityRecords, setQualityRecords] = useState<QualityTrackingRecord[]>([]);
  const [deductionRecords, setDeductionRecords] = useState<DeductionPenaltyRecord[]>([]);
  
  const [activeTab, setActiveTab] = useState<string>('ANANTA');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('tms_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [doRes, rrRes, qRes, dpRes] = await Promise.all([
        fetch('/api/coal-rcr/do-master', { headers }),
        fetch('/api/coal-rcr/rr-entry', { headers }),
        fetch('/api/coal-rcr/quality-tracking', { headers }),
        fetch('/api/coal-rcr/deduction-penalty', { headers })
      ]);

      if (doRes.ok && rrRes.ok && qRes.ok && dpRes.ok) {
        const doData = await doRes.json();
        const rrData = await rrRes.json();
        const qData = await qRes.json();
        const dpData = await dpRes.json();

        if (doData.success && rrData.success && qData.success && dpData.success) {
          setDoRecords(doData.data || []);
          setRrRecords(rrData.data || []);
          setQualityRecords(qData.data || []);
          setDeductionRecords(dpData.data || []);
          
          localStorage.setItem(DO_MASTER_KEY, JSON.stringify(doData.data || []));
          localStorage.setItem(RR_ENTRY_KEY, JSON.stringify(rrData.data || []));
          localStorage.setItem(QUALITY_TRACKING_KEY, JSON.stringify(qData.data || []));
          localStorage.setItem(DEDUCTION_PENALTY_KEY, JSON.stringify(dpData.data || []));
        }
      } else {
        setDoRecords(readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []));
        setRrRecords(readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []));
        setQualityRecords(readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []));
        setDeductionRecords(readLocalValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []));
      }
    } catch (e) {
      console.error("Error fetching OCP Track Record data:", e);
      setDoRecords(readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []));
      setRrRecords(readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []));
      setQualityRecords(readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []));
      setDeductionRecords(readLocalValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cachedDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    const cachedRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
    const cachedQual = readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []);
    const cachedDP = readLocalValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []);
    
    if (cachedDOs.length > 0) setDoRecords(cachedDOs);
    if (cachedRRs.length > 0) setRrRecords(cachedRRs);
    if (cachedQual.length > 0) setQualityRecords(cachedQual);
    if (cachedDP.length > 0) setDeductionRecords(cachedDP);
    
    fetchData(cachedDOs.length === 0);
  }, []);

  // Filter helper
  const matchMine = (val: string | null | undefined, target: string) => {
    if (!val) return false;
    const cleanVal = val.toUpperCase().replace(/[^A-Z]/g, '');
    const cleanTarget = target.toUpperCase().replace(/[^A-Z]/g, '');
    return cleanVal.includes(cleanTarget) || cleanTarget.includes(cleanVal);
  };

  // Mine-wise Aggregations
  const mineData = useMemo(() => {
    const activeMine = activeTab;

    // Filter DOs matching this mine name
    const mineDOs = doRecords.filter(d => matchMine(d.mines, activeMine) || matchMine(d.coalCompany, activeMine));
    const doNumbers = mineDOs.map(d => d.doNo.toUpperCase().trim());

    // Filter RRs matching this mine name or DOs
    const mineRRs = rrRecords.filter(r => 
      matchMine(r.ocp, activeMine) || 
      (r.doNo && doNumbers.includes(r.doNo.toUpperCase().trim()))
    );
    const rrNumbers = mineRRs.map(r => r.rrNo.toUpperCase().trim());

    // Filter Quality Records
    const mineQualities = qualityRecords.filter(q => q.rrNo && rrNumbers.includes(q.rrNo.toUpperCase().trim()));

    // Filter Deductions
    const mineDeductions = deductionRecords.filter(d => d.rrNo && rrNumbers.includes(d.rrNo.toUpperCase().trim()));

    // Aggregate statistics
    const totalDOQty = mineDOs.reduce((sum, d) => sum + (Number(d.doQty) || 0), 0);
    const totalActualQty = mineRRs.reduce((sum, r) => sum + (Number(r.rrActQty) || 0), 0);
    const totalInMotionQty = mineRRs.reduce((sum, r) => sum + (Number(r.vllQty) || 0), 0);
    const totalGrnQty = mineRRs.reduce((sum, r) => sum + (Number(r.grnQty) || 0), 0);
    
    const balanceQty = Math.max(0, totalDOQty - totalActualQty);

    // Quality Averages
    const qualCount = mineQualities.length;
    const avgTM = qualCount > 0 ? (mineQualities.reduce((sum, q) => sum + (Number(q.tm) || 0), 0) / qualCount) : 0;
    const avgIM = qualCount > 0 ? (mineQualities.reduce((sum, q) => sum + (Number(q.im) || 0), 0) / qualCount) : 0;
    const avgAsh = qualCount > 0 ? (mineQualities.reduce((sum, q) => sum + (Number(q.ash) || 0), 0) / qualCount) : 0;
    const avgVM = qualCount > 0 ? (mineQualities.reduce((sum, q) => sum + (Number(q.vm) || 0), 0) / qualCount) : 0;
    const avgFC = qualCount > 0 ? (mineQualities.reduce((sum, q) => sum + (Number(q.fc) || 0), 0) / qualCount) : 0;
    const avgGcvAdb = qualCount > 0 ? (mineQualities.reduce((sum, q) => sum + (Number(q.gcvAdb) || 0), 0) / qualCount) : 0;
    const avgGcvArb = qualCount > 0 ? (mineQualities.reduce((sum, q) => sum + (Number(q.gcvArb) || 0), 0) / qualCount) : 0;

    // Total deductions
    const totalDeductions = mineDeductions.reduce((sum, d) => sum + (Number(d.finalDeduction) || 0), 0);
    const qualityPenalties = mineQualities.reduce((sum, q) => sum + (Number(q.qualityPenalty) || 0), 0);

    return {
      mineDOs,
      mineRRs,
      totalDOQty,
      totalActualQty,
      totalInMotionQty,
      totalGrnQty,
      balanceQty,
      avgTM,
      avgIM,
      avgAsh,
      avgVM,
      avgFC,
      avgGcvAdb,
      avgGcvArb,
      totalDeductions,
      qualityPenalties,
      rrCount: mineRRs.length,
      doCount: mineDOs.length
    };
  }, [activeTab, doRecords, rrRecords, qualityRecords, deductionRecords]);

  // Search filter inside the active mine list
  const filteredRRs = useMemo(() => {
    return mineData.mineRRs.filter(r => {
      const matchText = searchQuery.toUpperCase();
      return (
        r.rrNo.toUpperCase().includes(matchText) ||
        r.doNo.toUpperCase().includes(matchText) ||
        (r.siding && r.siding.toUpperCase().includes(matchText))
      );
    });
  }, [mineData.mineRRs, searchQuery]);

  return (
    <div className="space-y-8 animate-fade-in text-slate-700">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">OCP-wise Track Record</h2>
          <p className="text-xs text-slate-500 mt-1">
            Compare coal qualities, weights, and commercial metrics across individual Open Cast Project (OCP) mines.
          </p>
        </div>
        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm disabled:opacity-60 self-start md:self-auto shrink-0"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Mines Tabs */}
      <div className="flex flex-wrap border-b border-slate-200 bg-slate-50 rounded-xl p-1 gap-1">
        {MINES.map(mine => (
          <button
            key={mine.id}
            onClick={() => {
              setActiveTab(mine.id);
              setSearchQuery('');
            }}
            className={`px-5 py-2.5 text-xs font-extrabold rounded-lg tracking-wider transition-all duration-200 ${
              activeTab === mine.id 
                ? 'bg-white text-blue-600 shadow-sm border border-slate-200/50' 
                : 'text-slate-400 hover:text-slate-700'
            }`}
          >
            {mine.name}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        {/* Quantity Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-blue-600">
            <GitCompare className="h-4.5 w-4.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Quantities (MT)</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Allocated:</span>
              <span className="font-extrabold text-slate-800">{mineData.totalDOQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Lifted Actual:</span>
              <span className="font-extrabold text-blue-600">{mineData.totalActualQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">GRN Qty:</span>
              <span className="font-extrabold text-emerald-700">{mineData.totalGrnQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="border-t border-slate-100 pt-2 flex justify-between text-[11px] font-extrabold">
              <span className="text-slate-500">Balance:</span>
              <span className="text-slate-800">{mineData.balanceQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Quality Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-indigo-600">
            <Activity className="h-4.5 w-4.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Avg Quality Analysis</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Total Moisture:</span>
              <span className="font-extrabold text-slate-800">{mineData.avgTM.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Ash Content:</span>
              <span className="font-extrabold text-slate-800">{mineData.avgAsh.toFixed(2)}%</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">GCV ADB:</span>
              <span className="font-extrabold text-slate-800">{Math.round(mineData.avgGcvAdb)} kcal</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">GCV ARB:</span>
              <span className="font-extrabold text-indigo-600">{Math.round(mineData.avgGcvArb)} kcal</span>
            </div>
          </div>
        </div>

        {/* Deductions Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-red-600">
            <Scale className="h-4.5 w-4.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Penalties & Deductions</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Quality Penalties:</span>
              <span className="font-extrabold text-slate-800">₹{mineData.qualityPenalties.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Surcharges/Freight:</span>
              <span className="font-extrabold text-slate-800">₹{(mineData.totalDeductions - mineData.qualityPenalties).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="border-t border-slate-100 pt-2 flex justify-between text-[11px] font-extrabold text-red-600">
              <span>Total Deductions:</span>
              <span>₹{mineData.totalDeductions.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-amber-500">
            <Layers className="h-4.5 w-4.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Record Summary</span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Delivery Orders:</span>
              <span className="font-extrabold text-slate-800">{mineData.doCount} DOs</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Railway Wagons/RRs:</span>
              <span className="font-extrabold text-slate-800">{mineData.rrCount} RRs</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400 font-semibold">Quality Audits:</span>
              <span className="font-extrabold text-slate-800">{qualityRecords.filter(q => mineData.mineRRs.some(r => r.rrNo === q.rrNo)).length} Audited</span>
            </div>
          </div>
        </div>
      </div>

      {/* DO List section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Active Delivery Orders - {activeTab}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">DO Number</th>
                <th className="px-5 py-4">Month</th>
                <th className="px-5 py-4">Siding</th>
                <th className="px-5 py-4 text-right">DO Qty (MT)</th>
                <th className="px-5 py-4 text-right">Lifted Qty (MT)</th>
                <th className="px-5 py-4 text-right">Balance Qty (MT)</th>
                <th className="px-5 py-4 text-center">Tolerance %</th>
                <th className="px-5 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {mineData.mineDOs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-8 text-center text-slate-400 font-bold">
                    No DO allocation found for this mine.
                  </td>
                </tr>
              ) : (
                mineData.mineDOs.map((d, idx) => {
                  const linkedRRs = rrRecords.filter(rr => rr.doNo === d.doNo);
                  const totalLifted = linkedRRs.reduce((sum, r) => sum + (Number(r.rrActQty) || 0), 0);
                  const balance = (Number(d.doQty) || 0) - totalLifted;
                  
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                      <td className="px-5 py-4 font-mono font-extrabold text-slate-800 uppercase">{d.doNo}</td>
                      <td className="px-5 py-4 font-semibold text-slate-600">{d.month || '—'}</td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{d.siding}</td>
                      <td className="px-5 py-4 font-mono text-right font-bold text-slate-800">{Number(d.doQty).toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right font-semibold text-blue-600">{totalLifted.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right font-semibold text-slate-700">{balance.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-center font-semibold text-slate-500">{Number(d.tolerance)}%</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                          d.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          d.status === 'Cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RRs section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            Railway Receipts (RRs) - {activeTab}
          </h3>
          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search RR, Siding..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">RR No</th>
                <th className="px-5 py-4">RR Date</th>
                <th className="px-5 py-4">DO No</th>
                <th className="px-5 py-4">Siding</th>
                <th className="px-5 py-4 text-right">RR Act Qty (MT)</th>
                <th className="px-5 py-4 text-right">GRN Qty (MT)</th>
                <th className="px-5 py-4 text-right">GCV (ADB)</th>
                <th className="px-5 py-4 text-right">GCV (ARB)</th>
                <th className="px-5 py-4 text-right">Final Deduction (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {filteredRRs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-8 text-center text-slate-400 font-bold">
                    No railway receipts found matching search.
                  </td>
                </tr>
              ) : (
                filteredRRs.map((r, idx) => {
                  const qRecord = qualityRecords.find(q => q.rrNo === r.rrNo);
                  const dRecord = deductionRecords.find(d => d.rrNo === r.rrNo);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                      <td className="px-5 py-4 font-mono font-extrabold text-slate-800 uppercase">{r.rrNo}</td>
                      <td className="px-5 py-4 font-semibold font-mono text-slate-600">{r.rrDate || '—'}</td>
                      <td className="px-5 py-4 font-mono font-semibold text-slate-700">{r.doNo}</td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{r.siding}</td>
                      <td className="px-5 py-4 font-mono text-right text-slate-800">{(Number(r.rrActQty) || 0).toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right font-bold text-blue-600">{(Number(r.grnQty) || 0).toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right font-semibold text-slate-700">{qRecord ? Math.round(Number(qRecord.gcvAdb)) : '—'}</td>
                      <td className="px-5 py-4 font-mono text-right font-semibold text-slate-700">{qRecord ? Math.round(Number(qRecord.gcvArb)) : '—'}</td>
                      <td className="px-5 py-4 font-mono text-right font-extrabold text-red-600">
                        {dRecord ? `₹${Number(dRecord.finalDeduction).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
