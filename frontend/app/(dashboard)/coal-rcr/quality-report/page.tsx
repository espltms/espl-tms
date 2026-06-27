'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  Activity, 
  Search, 
  RefreshCw, 
  X,
  FileSpreadsheet
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { DOMasterRecord, RREntryRecord, QualityTrackingRecord } from '../types';
import { readLocalValue } from '@/lib/syncedStorage';
import SectionExcelExport from '@/components/SectionExcelExport';

const DO_MASTER_KEY = 'tms_coal_do_master';
const RR_ENTRY_KEY = 'tms_coal_rr_entry';
const QUALITY_TRACKING_KEY = 'tms_coal_quality_tracking';
const ITEMS_PER_PAGE = 15;

export default function QualityReportPage() {
  const { user } = useAuthStore();
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [rrRecords, setRrRecords] = useState<RREntryRecord[]>([]);
  const [qualityRecords, setQualityRecords] = useState<QualityTrackingRecord[]>([]);
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

      const [doRes, rrRes, qualityRes] = await Promise.all([
        fetch('/api/coal-rcr/do-master', { headers }),
        fetch('/api/coal-rcr/rr-entry', { headers }),
        fetch('/api/coal-rcr/quality-tracking', { headers })
      ]);

      if (doRes.ok && rrRes.ok && qualityRes.ok) {
        const doData = await doRes.json();
        const rrData = await rrRes.json();
        const qualityData = await qualityRes.json();

        if (doData.success && rrData.success && qualityData.success) {
          setDoRecords(doData.data || []);
          setRrRecords(rrData.data || []);
          setQualityRecords(qualityData.data || []);
          localStorage.setItem(DO_MASTER_KEY, JSON.stringify(doData.data || []));
          localStorage.setItem(RR_ENTRY_KEY, JSON.stringify(rrData.data || []));
          localStorage.setItem(QUALITY_TRACKING_KEY, JSON.stringify(qualityData.data || []));
        }
      } else {
        setDoRecords(readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []));
        setRrRecords(readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []));
        setQualityRecords(readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []));
      }
    } catch (e) {
      console.error("Error fetching quality report data:", e);
      setDoRecords(readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []));
      setRrRecords(readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []));
      setQualityRecords(readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cachedDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    const cachedRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
    const cachedQuality = readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []);
    if (cachedDOs.length > 0) setDoRecords(cachedDOs);
    if (cachedRRs.length > 0) setRrRecords(cachedRRs);
    if (cachedQuality.length > 0) setQualityRecords(cachedQuality);
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

  // Aggregate quality statistics DO-wise
  const reportData = useMemo(() => {
    // 1. Map quality records by RR No for quick lookups
    const qualityMap = new Map<string, QualityTrackingRecord>();
    qualityRecords.forEach(q => {
      if (q.rrNo) {
        qualityMap.set(q.rrNo.toUpperCase().trim(), q);
      }
    });

    // 2. Group RR Entry records by DO No
    const rrGroupMap = new Map<string, RREntryRecord[]>();
    rrRecords.forEach(rr => {
      const doNo = rr.doNo.toUpperCase().trim();
      if (!rrGroupMap.has(doNo)) {
        rrGroupMap.set(doNo, []);
      }
      rrGroupMap.get(doNo)!.push(rr);
    });

    // 3. For each DO Master, compute stats
    return doRecords.map(item => {
      const doNoUpper = item.doNo.toUpperCase().trim();
      const linkedRRs = rrGroupMap.get(doNoUpper) || [];

      let liftedQty = 0;
      let grnQty = 0;

      // Weighted quality sum variables
      let tmSum = 0, imSum = 0, ashSum = 0, vmSum = 0, fcSum = 0, gcvAdbSum = 0, gcvArbSum = 0;
      let totalQualityWeight = 0;

      // Count of actual quality records matched
      let qualityCount = 0;

      linkedRRs.forEach(rr => {
        const rrWeight = Number(rr.rrActQty) || 0;
        liftedQty += rrWeight;
        grnQty += Number(rr.grnQty) || 0;

        const rrNoUpper = rr.rrNo.toUpperCase().trim();
        const quality = qualityMap.get(rrNoUpper);

        if (quality) {
          qualityCount++;
          // We use rrActQty as the weight for weighted averages
          const weight = rrWeight || 1; // Fallback to 1 if actual weight is zero
          totalQualityWeight += weight;

          tmSum += (Number(quality.tm) || 0) * weight;
          imSum += (Number(quality.im) || 0) * weight;
          ashSum += (Number(quality.ash) || 0) * weight;
          vmSum += (Number(quality.vm) || 0) * weight;
          fcSum += (Number(quality.fc) || 0) * weight;
          gcvAdbSum += (Number(quality.gcvAdb) || 0) * weight;
          gcvArbSum += (Number(quality.gcvArb) || 0) * weight;
        }
      });

      // Calculate averages
      const hasWeight = totalQualityWeight > 0;
      const divisor = hasWeight ? totalQualityWeight : 1;

      return {
        id: item.id,
        doNo: item.doNo,
        ocp: item.mines || '-',
        liftedQty,
        grnQty,
        tm: hasWeight ? (tmSum / divisor) : 0,
        im: hasWeight ? (imSum / divisor) : 0,
        ash: hasWeight ? (ashSum / divisor) : 0,
        vm: hasWeight ? (vmSum / divisor) : 0,
        fc: hasWeight ? (fcSum / divisor) : 0,
        gcvAdb: hasWeight ? (gcvAdbSum / divisor) : 0,
        gcvArb: hasWeight ? (gcvArbSum / divisor) : 0,
        qualityCount
      };
    });
  }, [doRecords, rrRecords, qualityRecords]);

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

  // Stats Card Calculations (Averages of DOs with quality results)
  const stats = useMemo(() => {
    let activeQualityDOs = 0;
    let tmTotal = 0, ashTotal = 0, gcvAdbTotal = 0, gcvArbTotal = 0;

    filteredReport.forEach(r => {
      if (r.qualityCount > 0) {
        activeQualityDOs++;
        tmTotal += r.tm;
        ashTotal += r.ash;
        gcvAdbTotal += r.gcvAdb;
        gcvArbTotal += r.gcvArb;
      }
    });

    const divisor = activeQualityDOs || 1;
    return {
      avgTm: activeQualityDOs > 0 ? (tmTotal / divisor) : 0,
      avgAsh: activeQualityDOs > 0 ? (ashTotal / divisor) : 0,
      avgGcvAdb: activeQualityDOs > 0 ? (gcvAdbTotal / divisor) : 0,
      avgGcvArb: activeQualityDOs > 0 ? (gcvArbTotal / divisor) : 0,
      activeQualityDOs
    };
  }, [filteredReport]);

  return (
    <main className="space-y-6 p-6">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Activity className="h-6 w-6 text-blue-600" /> Quality Report
          </h1>
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-1">
            DO-wise weighted average quality parameters (TM, IM, ASH, GCV)
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
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average TM</span>
          <span className="text-xl font-extrabold text-blue-600 block mt-2 font-mono">
            {stats.avgTm.toFixed(2)} <span className="text-[10px] text-slate-400 font-bold">%</span>
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Ash</span>
          <span className="text-xl font-extrabold text-slate-700 block mt-2 font-mono">
            {stats.avgAsh.toFixed(2)} <span className="text-[10px] text-slate-400 font-bold">%</span>
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average GCV (ADB)</span>
          <span className="text-xl font-extrabold text-emerald-600 block mt-2 font-mono">
            {Math.round(stats.avgGcvAdb).toLocaleString()} <span className="text-[10px] text-emerald-400 font-bold">kcal</span>
          </span>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average GCV (ARB)</span>
          <span className="text-xl font-extrabold text-rose-600 block mt-2 font-mono">
            {Math.round(stats.avgGcvArb).toLocaleString()} <span className="text-[10px] text-rose-400 font-bold">kcal</span>
          </span>
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

      {/* Quality Table Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Activity className="h-4.5 w-4.5 text-blue-600" /> Quality Analytics Report
          </h3>
          <div className="flex items-center gap-2">
            <SectionExcelExport sectionName="Quality Analytics Report" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-4 py-4 w-12 text-center">SL.</th>
                <th className="px-4 py-4">DO No</th>
                <th className="px-4 py-4">OCP</th>
                <th className="px-4 py-4 text-right">Lifted Qty (MT)</th>
                <th className="px-4 py-4 text-right">GRN Qty (MT)</th>
                <th className="px-4 py-4 text-right">TM (%)</th>
                <th className="px-4 py-4 text-right">IM (%)</th>
                <th className="px-4 py-4 text-right">ASH (%)</th>
                <th className="px-4 py-4 text-right">VM (%)</th>
                <th className="px-4 py-4 text-right">FC (%)</th>
                <th className="px-4 py-4 text-right">GCV ADB (kcal)</th>
                <th className="px-4 py-4 text-right">GCV ARB (kcal)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-400 font-semibold">
                    Fetching DO quality report...
                  </td>
                </tr>
              ) : paginatedReport.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No DO records found.
                  </td>
                </tr>
              ) : (
                paginatedReport.map((item, idx) => {
                  const sl = (currentPage - 1) * ITEMS_PER_PAGE + idx + 1;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-4 font-bold text-slate-400 text-center">{sl}</td>
                      <td className="px-4 py-4 font-mono font-extrabold text-slate-800 uppercase">{item.doNo}</td>
                      <td className="px-4 py-4 font-semibold text-slate-600">{item.ocp}</td>
                      <td className="px-4 py-4 font-mono text-right font-bold text-slate-800">
                        {item.liftedQty > 0 ? item.liftedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="px-4 py-4 font-mono text-right font-semibold text-blue-600">
                        {item.grnQty > 0 ? item.grnQty.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="px-4 py-4 font-mono text-right font-bold text-slate-700">
                        {item.qualityCount > 0 ? item.tm.toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-4 font-mono text-right font-medium text-slate-500">
                        {item.qualityCount > 0 ? item.im.toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-4 font-mono text-right font-bold text-slate-700">
                        {item.qualityCount > 0 ? item.ash.toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-4 font-mono text-right font-medium text-slate-500">
                        {item.qualityCount > 0 ? item.vm.toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-4 font-mono text-right font-medium text-slate-500">
                        {item.qualityCount > 0 ? item.fc.toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-4 font-mono text-right font-bold text-emerald-600">
                        {item.qualityCount > 0 ? Math.round(item.gcvAdb).toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-4 font-mono text-right font-bold text-rose-600">
                        {item.qualityCount > 0 ? Math.round(item.gcvArb).toLocaleString() : '-'}
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
