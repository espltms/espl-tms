'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  GitCompare, 
  Search, 
  RefreshCw, 
  Calendar
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { DOMasterRecord, RREntryRecord } from '../types';
import { readLocalValue } from '@/lib/syncedStorage';

const DO_MASTER_KEY = 'tms_coal_do_master';
const RR_ENTRY_KEY = 'tms_coal_rr_entry';
const ITEMS_PER_PAGE = 15;

export default function QuantityReconciliationPage() {
  const { user } = useAuthStore();
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [rrRecords, setRrRecords] = useState<RREntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoNo, setSelectedDoNo] = useState<string>('All');
  const [selectedOcp, setSelectedOcp] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('tms_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [doRes, rrRes] = await Promise.all([
        fetch('/api/coal-rcr/do-master', { headers }),
        fetch('/api/coal-rcr/rr-entry', { headers })
      ]);

      if (doRes.ok && rrRes.ok) {
        const doData = await doRes.json();
        const rrData = await rrRes.json();

        if (doData.success && rrData.success) {
          setDoRecords(doData.data || []);
          setRrRecords(rrData.data || []);
          localStorage.setItem(DO_MASTER_KEY, JSON.stringify(doData.data || []));
          localStorage.setItem(RR_ENTRY_KEY, JSON.stringify(rrData.data || []));
        }
      } else {
        setDoRecords(readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []));
        setRrRecords(readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []));
      }
    } catch (e) {
      console.error("Error fetching reconciliation data:", e);
      setDoRecords(readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []));
      setRrRecords(readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cachedDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    const cachedRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
    if (cachedDOs.length > 0) {
      setDoRecords(cachedDOs);
    }
    if (cachedRRs.length > 0) {
      setRrRecords(cachedRRs);
    }
    fetchData(cachedDOs.length === 0);
  }, []);

  // Calculate DO-wise quantities
  const doSummaryList = useMemo(() => {
    return doRecords.map(doRec => {
      const linkedRRs = rrRecords.filter(rr => rr.doNo === doRec.doNo);
      
      const totalLiftedQty = linkedRRs.reduce((sum, rr) => sum + (Number(rr.rrActQty) || 0), 0);
      const totalGrnQty = linkedRRs.reduce((sum, rr) => sum + (Number(rr.grnQty) || 0), 0);
      const totalInMotionQty = linkedRRs.reduce((sum, rr) => sum + (Number(rr.vllQty) || 0), 0);
      
      const doQty = Number(doRec.doQty) || 0;
      const balanceQty = doQty - totalLiftedQty;
      const tolerancePercent = Number(doRec.tolerance) || 0;
      const toleranceQty = doQty * (tolerancePercent / 100);
      const balanceExclTolerance = balanceQty - toleranceQty;

      return {
        ...doRec,
        doQty,
        totalLiftedQty,
        totalGrnQty,
        totalInMotionQty,
        balanceQty,
        tolerancePercent,
        toleranceQty,
        balanceExclTolerance,
        rrCount: linkedRRs.length
      };
    });
  }, [doRecords, rrRecords]);

  // Overall statistics
  const stats = useMemo(() => {
    let totalDOQty = 0;
    let totalLiftedQty = 0;
    let totalInMotionQty = 0;
    let totalGrnQty = 0;

    doSummaryList.forEach(item => {
      totalDOQty += item.doQty;
      totalLiftedQty += item.totalLiftedQty;
      totalInMotionQty += item.totalInMotionQty;
      totalGrnQty += item.totalGrnQty;
    });

    const weightDifference = totalInMotionQty - totalLiftedQty;

    return {
      totalDOQty,
      totalLiftedQty,
      totalInMotionQty,
      totalGrnQty,
      weightDifference
    };
  }, [doSummaryList]);

  // Unique list of OCPs for filtering
  const uniqueOCPs = useMemo(() => {
    const list = new Set<string>();
    rrRecords.forEach(r => {
      if (r.ocp) list.add(r.ocp.trim());
    });
    return Array.from(list).sort();
  }, [rrRecords]);

  // Filtered RR detailed weight differences
  const filteredRRs = useMemo(() => {
    return rrRecords.filter(rr => {
      const matchesDO = selectedDoNo === 'All' || rr.doNo === selectedDoNo;
      const matchesOCP = selectedOcp === 'All' || (rr.ocp && rr.ocp.trim().toLowerCase() === selectedOcp.trim().toLowerCase());
      const matchesSearch = 
        rr.rrNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        rr.doNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        (rr.ocp && rr.ocp.toUpperCase().includes(searchQuery.toUpperCase())) ||
        rr.siding.toUpperCase().includes(searchQuery.toUpperCase());
      return matchesDO && matchesOCP && matchesSearch;
    });
  }, [rrRecords, selectedDoNo, selectedOcp, searchQuery]);

  // Pagination for RRs
  const totalPages = Math.ceil(filteredRRs.length / ITEMS_PER_PAGE);
  const paginatedRRs = useMemo(() => {
    return filteredRRs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredRRs, currentPage]);

  return (
    <div className="space-y-8 animate-fade-in text-slate-700">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Quantity Reconciliation</h2>
          <p className="text-xs text-slate-500 mt-1">
            Reconcile weight differences (In-Motion vs Actual, GRN weights) and track DO-wise balance status including tolerance limits.
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

      {/* Stats Panel */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Allocated DO Qty</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalDOQty.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">METRIC TONS</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Lifted (Actual)</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">{stats.totalLiftedQty.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">METRIC TONS</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total GRN Received</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">{stats.totalGrnQty.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">METRIC TONS</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weight Difference (IM vs Act)</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className={`text-2xl font-extrabold ${stats.weightDifference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.weightDifference >= 0 ? '+' : ''}{stats.weightDifference.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </span>
            <span className="text-[10px] text-slate-400">MT</span>
          </div>
        </div>
      </div>

      {/* DO Master Reconciliation Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <GitCompare className="h-4.5 w-4.5 text-blue-600" /> DO-wise Reconciliation Summary
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">DO Number</th>
                <th className="px-5 py-4">Month</th>
                <th className="px-5 py-4">Siding</th>
                <th className="px-5 py-4 text-right">DO Qty (METRIC TONS)</th>
                <th className="px-5 py-4 text-right">Total Lifted Qty (METRIC TONS)</th>
                <th className="px-5 py-4 text-right">Balance Qty (METRIC TONS)</th>
                <th className="px-5 py-4 text-center">Tolerance %</th>
                <th className="px-5 py-4 text-right">Tolerance Qty (METRIC TONS)</th>
                <th className="px-5 py-4 text-right">Final Balance (METRIC TONS)</th>
                <th className="px-5 py-4 text-center">Linked RRs</th>
                <th className="px-5 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-400 font-semibold">
                    Fetching DO reconciliation details...
                  </td>
                </tr>
              ) : doSummaryList.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No DO records found.
                  </td>
                </tr>
              ) : (
                doSummaryList.map((item, idx) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                      <td className="px-5 py-4 font-mono font-extrabold text-slate-800 uppercase">{item.doNo}</td>
                      <td className="px-5 py-4 font-semibold text-slate-600">{item.month || '—'}</td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{item.siding}</td>
                      <td className="px-5 py-4 font-mono text-right font-bold text-slate-800">{item.doQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right font-semibold text-blue-600">{item.totalLiftedQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right font-semibold text-slate-700">{item.balanceQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-center font-bold text-slate-500">{item.tolerancePercent}%</td>
                      <td className="px-5 py-4 font-mono text-right text-slate-500">{item.toleranceQty.toFixed(2)}</td>
                      <td className={`px-5 py-4 font-mono text-right font-extrabold ${item.balanceExclTolerance < 0 ? 'text-red-500' : 'text-emerald-700'}`}>
                        {item.balanceExclTolerance.toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-center font-mono font-bold text-slate-600">{item.rrCount} RRs</td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                          item.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                          item.status === 'Expired' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                          'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {item.status}
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

      {/* RR Entry Weight Reconciliation */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <GitCompare className="h-4.5 w-4.5 text-blue-600" /> RR-wise Weight Discrepancies
          </h3>
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                placeholder="Search RR, siding, mine..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 focus:outline-none focus:border-blue-500/50 transition-colors"
              />
            </div>
            <select
              value={selectedOcp}
              onChange={(e) => { setSelectedOcp(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="All">All OCPs</option>
              {uniqueOCPs.map(ocp => (
                <option key={ocp} value={ocp}>{ocp}</option>
              ))}
            </select>
            <select
              value={selectedDoNo}
              onChange={(e) => { setSelectedDoNo(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-bold focus:outline-none cursor-pointer"
            >
              <option value="All">All DOs</option>
              {doRecords.map(d => (
                <option key={d.id} value={d.doNo}>{d.doNo}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">RR No</th>
                <th className="px-5 py-4">DO No</th>
                <th className="px-5 py-4">OCP</th>
                <th className="px-5 py-4">Siding</th>
                <th className="px-5 py-4 text-right">RR Act Qty (A)</th>
                <th className="px-5 py-4 text-right">In-Motion Qty (B)</th>
                <th className="px-5 py-4 text-right">GRN Qty (C)</th>
                <th className="px-5 py-4 text-right">Weight Diff (B - A)</th>
                <th className="px-5 py-4 text-right">Shortage Qty (C - A)</th>
                <th className="px-5 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400 font-semibold">
                    Fetching RR discrepancies...
                  </td>
                </tr>
              ) : filteredRRs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No RR discrepancy records found.
                  </td>
                </tr>
              ) : (
                paginatedRRs.map((rr, idx) => {
                  const actQty = Number(rr.rrActQty) || 0;
                  const imQty = Number(rr.vllQty) || 0;
                  const grnQty = Number(rr.grnQty) || 0;
                  
                  const imDiff = imQty - actQty;
                  const shortage = grnQty - actQty;

                  return (
                    <tr key={rr.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-400 text-center">
                        {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                      </td>
                      <td className="px-5 py-4 font-mono font-extrabold text-slate-800 uppercase">{rr.rrNo}</td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-700">{rr.doNo}</td>
                      <td className="px-5 py-4 font-semibold text-slate-600">{rr.ocp || '—'}</td>
                      <td className="px-5 py-4 font-semibold text-slate-600">{rr.siding}</td>
                      <td className="px-5 py-4 font-mono text-right text-slate-700">{actQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right text-slate-700">{imQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right font-bold text-blue-600">{grnQty.toFixed(2)}</td>
                      <td className={`px-5 py-4 font-mono text-right font-bold ${
                        imDiff === 0 ? 'text-slate-500' : imDiff > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {imDiff === 0 ? '—' : `${imDiff > 0 ? '+' : ''}${imDiff.toFixed(2)}`}
                      </td>
                      <td className={`px-5 py-4 font-mono text-right font-bold ${
                        shortage === 0 ? 'text-slate-500' : shortage > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {shortage === 0 ? '—' : `${shortage > 0 ? '+' : ''}${shortage.toFixed(2)}`}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                          Math.abs(shortage) <= 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {Math.abs(shortage) <= 1 ? 'Ok' : 'Slippage'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/30">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
