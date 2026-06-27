'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  RefreshCw, 
  X,
  ClipboardList
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { DOMasterRecord, DOLiftingRecord } from '../types';
import { readLocalValue } from '@/lib/syncedStorage';
import SectionExcelExport from '@/components/SectionExcelExport';

const DO_MASTER_KEY = 'tms_coal_do_master';
const DO_LIFTING_KEY = 'tms_coal_do_lifting';
const ITEMS_PER_PAGE = 15;

const isDOExpired = (endDateStr: string | null | undefined): boolean => {
  if (!endDateStr) return false;
  const clean = endDateStr.trim();
  const parts = clean.split('-');
  if (parts.length === 3) {
    let d = new Date();
    if (parts[0].length === 4) { // YYYY-MM-DD
      d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59);
    } else if (parts[2].length === 4) { // DD-MM-YYYY
      d = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]), 23, 59, 59);
    }
    return d < new Date();
  }
  return new Date(endDateStr) < new Date();
};

export default function QuantityReportPage() {
  const { user } = useAuthStore();
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [liftingRecords, setLiftingRecords] = useState<DOLiftingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOcp, setSelectedOcp] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('tms_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [doRes, liftingRes] = await Promise.all([
        fetch('/api/coal-rcr/do-master', { headers }),
        fetch('/api/coal-rcr/do-lifting', { headers })
      ]);

      if (doRes.ok && liftingRes.ok) {
        const doData = await doRes.json();
        const liftingData = await liftingRes.json();

        if (doData.success && liftingData.success) {
          setDoRecords(doData.data || []);
          setLiftingRecords(liftingData.data || []);
          localStorage.setItem(DO_MASTER_KEY, JSON.stringify(doData.data || []));
          localStorage.setItem(DO_LIFTING_KEY, JSON.stringify(liftingData.data || []));
        }
      } else {
        setDoRecords(readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []));
        setLiftingRecords(readLocalValue<DOLiftingRecord[]>(DO_LIFTING_KEY, []));
      }
    } catch (e) {
      console.error("Error fetching quantity report data:", e);
      setDoRecords(readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []));
      setLiftingRecords(readLocalValue<DOLiftingRecord[]>(DO_LIFTING_KEY, []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cachedDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    const cachedLifting = readLocalValue<DOLiftingRecord[]>(DO_LIFTING_KEY, []);
    if (cachedDOs.length > 0) setDoRecords(cachedDOs);
    if (cachedLifting.length > 0) setLiftingRecords(cachedLifting);
    fetchData(cachedDOs.length === 0);
  }, []);

  // Compute unique OCPs for filtering
  const uniqueOCPs = useMemo(() => {
    const ocps = new Set<string>();
    doRecords.forEach(d => {
      if (d.mines) ocps.add(d.mines.trim());
    });
    return Array.from(ocps).sort();
  }, [doRecords]);

  // Aggregate quantity report details per DO No
  const reportData = useMemo(() => {
    // Group lifting records by DO No
    const liftingMap = new Map<string, number>();
    liftingRecords.forEach(l => {
      const doNo = l.doNo.toUpperCase().trim();
      const qty = Number(l.mineralQty) || 0;
      liftingMap.set(doNo, (liftingMap.get(doNo) || 0) + qty);
    });

    return doRecords.map(item => {
      const doNoUpper = item.doNo.toUpperCase().trim();
      const doQty = Number(item.doQty) || 0;
      const liftedQty = liftingMap.get(doNoUpper) || 0;

      const isExpiredOrCompleted = item.status === 'Completed' || item.status === 'Cancelled' || isDOExpired(item.endDate);
      const remaining = Math.max(0, doQty - liftedQty);

      const balanceQty = isExpiredOrCompleted ? 0 : remaining;
      const lapseQty = isExpiredOrCompleted ? remaining : 0;

      return {
        id: item.id,
        doNo: item.doNo,
        ocp: item.mines || '-',
        doQty,
        liftedQty,
        balanceQty,
        lapseQty,
        status: item.status,
        endDate: item.endDate || '-'
      };
    });
  }, [doRecords, liftingRecords]);

  // Search & OCP Filtering
  const filteredReport = useMemo(() => {
    return reportData.filter(item => {
      const matchesSearch = item.doNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.ocp.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOcp = selectedOcp === 'All' || item.ocp === selectedOcp;
      return matchesSearch && matchesOcp;
    });
  }, [reportData, searchQuery, selectedOcp]);

  // Pagination
  const totalPages = Math.ceil(filteredReport.length / ITEMS_PER_PAGE);
  const paginatedReport = useMemo(() => {
    return filteredReport.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredReport, currentPage]);

  // Stats Card Calculations
  const stats = useMemo(() => {
    const totalDOQty = filteredReport.reduce((acc, r) => acc + r.doQty, 0);
    const totalLiftedQty = filteredReport.reduce((acc, r) => acc + r.liftedQty, 0);
    const totalBalanceQty = filteredReport.reduce((acc, r) => acc + r.balanceQty, 0);
    const totalLapseQty = filteredReport.reduce((acc, r) => acc + r.lapseQty, 0);
    return { totalDOQty, totalLiftedQty, totalBalanceQty, totalLapseQty };
  }, [filteredReport]);

  return (
    <main className="space-y-6 p-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-600" /> Quantity Report
          </h1>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">
            DO-wise delivery status, lifting quantities, and balances
          </p>
        </div>
        <button
          onClick={() => fetchData()}
          disabled={loading}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm disabled:opacity-60 shrink-0 self-end sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Report
        </button>
      </div>

      {/* Stats Panel */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total DO Qty</span>
          <span className="text-xl font-extrabold text-slate-800 block mt-2 font-mono">{stats.totalDOQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-[10px] text-slate-400 font-bold">MT</span></span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Lifted Qty</span>
          <span className="text-xl font-extrabold text-blue-600 block mt-2 font-mono">{stats.totalLiftedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-[10px] text-blue-400 font-bold">MT</span></span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Active Balance</span>
          <span className="text-xl font-extrabold text-emerald-600 block mt-2 font-mono">{stats.totalBalanceQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-[10px] text-emerald-400 font-bold">MT</span></span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Lapsed Qty</span>
          <span className="text-xl font-extrabold text-rose-600 block mt-2 font-mono">{stats.totalLapseQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span className="text-[10px] text-rose-400 font-bold">MT</span></span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search by DO Number or OCP..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-9 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500/50 transition-colors font-sans"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3.5 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 self-end md:self-auto flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-semibold font-sans">Filter by OCP:</span>
            <select
              value={selectedOcp}
              onChange={(e) => { setSelectedOcp(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-bold font-sans focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
            >
              <option value="All">All OCPs</option>
              {uniqueOCPs.map(ocp => <option key={ocp} value={ocp}>{ocp}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Quantity Table Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-blue-600" /> Quantity Reconciliation Report
          </h3>
          <div className="flex items-center gap-2">
            <SectionExcelExport sectionName="Quantity Reconciliation Report" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">DO No</th>
                <th className="px-5 py-4">OCP</th>
                <th className="px-5 py-4 text-right">DO Qty (MT)</th>
                <th className="px-5 py-4 text-right">Lifted Qty (MT)</th>
                <th className="px-5 py-4 text-right">Balance Qty (MT)</th>
                <th className="px-5 py-4 text-right">Lapse Qty (MT)</th>
                <th className="px-5 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-semibold">
                    Fetching DO quantity report...
                  </td>
                </tr>
              ) : paginatedReport.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No DO records found.
                  </td>
                </tr>
              ) : (
                paginatedReport.map((item, idx) => {
                  const sl = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-400 text-center">{sl}</td>
                      <td className="px-5 py-4 font-mono font-extrabold text-slate-800 uppercase">{item.doNo}</td>
                      <td className="px-5 py-4 font-semibold text-slate-600">{item.ocp}</td>
                      <td className="px-5 py-4 font-mono text-right font-bold text-slate-800">
                        {item.doQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 font-mono text-right font-semibold text-blue-600">
                        {item.liftedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-5 py-4 font-mono text-right font-bold ${item.balanceQty > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {item.balanceQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className={`px-5 py-4 font-mono text-right font-bold ${item.lapseQty > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {item.lapseQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                          item.status === 'Cancelled'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200/50'
                            : item.status === 'Completed'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200/50'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
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

        {/* Pagination Panel */}
        {totalPages > 1 && (
          <div className="border-t border-slate-100 px-6 py-4 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} - {Math.min(currentPage * ITEMS_PER_PAGE, filteredReport.length)} of {filteredReport.length} DOs
            </span>
            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Prev
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
