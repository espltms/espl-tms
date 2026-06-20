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
  const [selectedOcp, setSelectedOcp] = useState<string>('All');

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
    if (cachedDOs.length > 0) setDoRecords(cachedDOs);
    if (cachedRRs.length > 0) setRrRecords(cachedRRs);
    fetchData(cachedDOs.length === 0);
  }, []);

  const doSummaryList = useMemo(() => {
    return doRecords.map(doRec => {
      const linkedRRs = rrRecords.filter(rr => rr.doNo === doRec.doNo);
      
      const totalLiftedQty = linkedRRs.reduce((sum, rr) => sum + (Number(rr.rrActQty) || 0), 0);
      const totalGrnQty = linkedRRs.reduce((sum, rr) => sum + (Number(rr.grnQty) || 0), 0);
      const totalInMotionQty = linkedRRs.reduce((sum, rr) => sum + (Number(rr.inMotionQty) || Number(rr.vllQty) || 0), 0);
      const sumChQty = linkedRRs.reduce((sum, rr) => sum + (Number(rr.rrChQty) || 0), 0);
      
      const doQty = Number(doRec.doQty) || 0;
      const balanceQty = doQty - totalLiftedQty;
      const tolerancePercent = Number(doRec.tolerance) || 0;
      const toleranceQty = doQty * (tolerancePercent / 100);
      const balanceExclTolerance = balanceQty - toleranceQty;

      const destination = linkedRRs[0]?.to || '—';
      const ocp = doRec.mines || linkedRRs[0]?.ocp || '—';

      return {
        ...doRec,
        doQty,
        totalLiftedQty,
        totalGrnQty,
        totalInMotionQty,
        sumChQty,
        balanceQty,
        tolerancePercent,
        toleranceQty,
        balanceExclTolerance,
        destination,
        ocp,
        rrCount: linkedRRs.length
      };
    });
  }, [doRecords, rrRecords]);

  const stats = useMemo(() => {
    let totalDOQty = 0, totalLiftedQty = 0, totalInMotionQty = 0, totalGrnQty = 0;
    doSummaryList.forEach(item => {
      totalDOQty += item.doQty;
      totalLiftedQty += item.totalLiftedQty;
      totalInMotionQty += item.totalInMotionQty;
      totalGrnQty += item.totalGrnQty;
    });
    return { totalDOQty, totalLiftedQty, totalInMotionQty, totalGrnQty, weightDifference: totalInMotionQty - totalLiftedQty };
  }, [doSummaryList]);

  const uniqueOCPs = useMemo(() => {
    const list = new Set<string>();
    rrRecords.forEach(r => { if (r.ocp) list.add(r.ocp.trim()); });
    return Array.from(list).sort();
  }, [rrRecords]);

  const filteredDOs = useMemo(() => {
    return doSummaryList.filter(d => {
      const matchesOCP = selectedOcp === 'All' || (d.mines && d.mines.trim().toLowerCase() === selectedOcp.trim().toLowerCase());
      const matchesSearch = 
        d.doNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        (d.poNo && d.poNo.toUpperCase().includes(searchQuery.toUpperCase())) ||
        (d.siding && d.siding.toUpperCase().includes(searchQuery.toUpperCase())) ||
        (d.mines && d.mines.toUpperCase().includes(searchQuery.toUpperCase())) ||
        (d.customer && d.customer.toUpperCase().includes(searchQuery.toUpperCase()));
      return matchesOCP && matchesSearch;
    });
  }, [doSummaryList, selectedOcp, searchQuery]);

  const beforeCompletedList = useMemo(() => filteredDOs.filter(d => d.status !== 'Completed'), [filteredDOs]);
  const afterCompletedList = useMemo(() => filteredDOs.filter(d => d.status === 'Completed'), [filteredDOs]);

  return (
    <div className="space-y-8 animate-fade-in text-slate-700">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Quantity Reconciliation</h2>
          <p className="text-xs text-slate-500 mt-1">Reconcile weight differences and track DO-wise balance status including tolerance limits.</p>
        </div>
        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-all active:scale-[0.98] shadow-sm disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        {[
          { label: 'Total Allocated DO Qty', val: stats.totalDOQty, color: 'text-slate-800' },
          { label: 'Total Lifted (Actual)', val: stats.totalLiftedQty, color: 'text-blue-600' },
          { label: 'Total GRN Received', val: stats.totalGrnQty, color: 'text-emerald-700' },
          { label: 'Weight Diff (IM vs Act)', val: stats.weightDifference, color: stats.weightDifference >= 0 ? 'text-emerald-600' : 'text-red-600' }
        ].map((s, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
            <div className="mt-4 flex items-baseline gap-2">
              <span className={`text-2xl font-extrabold ${s.color}`}>{s.val.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
              <span className="text-[10px] text-slate-400">MT</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <GitCompare className="h-4.5 w-4.5 text-blue-600" /> Reconciliation Filters
        </h3>
        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search DO, siding, mine..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 focus:outline-none"
            />
          </div>
          <select
            value={selectedOcp}
            onChange={(e) => setSelectedOcp(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 font-bold focus:outline-none cursor-pointer"
          >
            <option value="All">All OCPs</option>
            {uniqueOCPs.map(ocp => <option key={ocp} value={ocp}>{ocp}</option>)}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <GitCompare className="h-4.5 w-4.5 text-blue-600" /> 1) Before Completed
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1000px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">DO Number</th>
                <th className="px-5 py-4">OCP</th>
                <th className="px-5 py-4">Source Siding</th>
                <th className="px-5 py-4">Destination</th>
                <th className="px-5 py-4 text-right">DO Qty</th>
                <th className="px-5 py-4 text-right">Lifted Qty</th>
                <th className="px-5 py-4 text-right">Balance Qty</th>
                <th className="px-5 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-semibold">Fetching DO reconciliation details...</td></tr>
              ) : beforeCompletedList.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-12 text-center text-slate-400 font-bold">No active or cancelled DO records found.</td></tr>
              ) : (
                beforeCompletedList.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                    <td className="px-5 py-4 font-mono font-extrabold text-slate-800 uppercase">{item.doNo}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{item.ocp}</td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{item.siding}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600">{item.destination}</td>
                    <td className="px-5 py-4 font-mono text-right font-bold text-slate-800">{item.doQty.toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-right font-semibold text-blue-600">{item.totalLiftedQty.toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-right font-semibold text-slate-700">{item.balanceQty.toFixed(2)}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${item.status === 'Cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <GitCompare className="h-4.5 w-4.5 text-blue-600" /> 2) After Completed
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1500px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">DO Number</th>
                <th className="px-5 py-4">OCP</th>
                <th className="px-5 py-4">Source Siding</th>
                <th className="px-5 py-4">Destination</th>
                <th className="px-5 py-4 text-right">DO Qty</th>
                <th className="px-5 py-4 text-right">Lifted Qty</th>
                <th className="px-5 py-4 text-right">Lapse Qty</th>
                <th className="px-5 py-4 text-center">Tolerance</th>
                <th className="px-5 py-4 text-right">Deliverable Qty</th>
                <th className="px-5 py-4 text-right">Chargable</th>
                <th className="px-5 py-4 text-right">RR Actual</th>
                <th className="px-5 py-4 text-right">In Motion</th>
                <th className="px-5 py-4 text-right">GRN</th>
                <th className="px-5 py-4 text-right">Difference</th>
                <th className="px-5 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr><td colSpan={16} className="px-6 py-12 text-center text-slate-400 font-semibold">Fetching DO reconciliation details...</td></tr>
              ) : afterCompletedList.length === 0 ? (
                <tr><td colSpan={16} className="px-6 py-12 text-center text-slate-400 font-bold">No completed DO records found.</td></tr>
              ) : (
                afterCompletedList.map((item, idx) => {
                  const deliverableQty = item.totalLiftedQty * 0.997;
                  const difference = item.totalGrnQty - deliverableQty;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                      <td className="px-5 py-4 font-mono font-extrabold text-slate-800 uppercase">{item.doNo}</td>
                      <td className="px-5 py-4 font-semibold text-slate-600">{item.ocp}</td>
                      <td className="px-5 py-4 font-semibold text-slate-700">{item.siding}</td>
                      <td className="px-5 py-4 font-semibold text-slate-600">{item.destination}</td>
                      <td className="px-5 py-4 font-mono text-right text-slate-700">{item.doQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right text-blue-600">{item.totalLiftedQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right text-orange-600">{item.balanceQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-center font-semibold text-slate-500">{item.tolerancePercent}%</td>
                      <td className="px-5 py-4 font-mono text-right text-slate-700">{deliverableQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right text-slate-600">{item.sumChQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right text-slate-600">{item.totalLiftedQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right text-slate-600">{item.totalInMotionQty.toFixed(2)}</td>
                      <td className="px-5 py-4 font-mono text-right text-emerald-700 font-semibold">{item.totalGrnQty.toFixed(2)}</td>
                      <td className={`px-5 py-4 font-mono text-right font-bold ${difference < 0 ? 'text-red-500' : 'text-emerald-700'}`}>
                        {difference.toFixed(2)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
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
    </div>
  );
}
