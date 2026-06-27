'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  GitCompare, 
  Search, 
  RefreshCw, 
  X
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { DOMasterRecord, RREntryRecord, QualityTrackingRecord } from '../types';
import { readLocalValue } from '@/lib/syncedStorage';
import CentralExcelImport from '@/components/CentralExcelImport';
import SectionExcelExport from '@/components/SectionExcelExport';

const DO_MASTER_KEY = 'tms_coal_do_master';
const RR_ENTRY_KEY = 'tms_coal_rr_entry';
const QUALITY_TRACKING_KEY = 'tms_coal_quality_tracking';
const ITEMS_PER_PAGE = 15;

type ImportedSheet = {
  id: string;
  fileName: string;
  importedAt: string;
  headers: string[];
  rows: string[][];
};

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

const parseDateToYYYYMMDD = (val: unknown): string => {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'null' || str.toLowerCase() === 'undefined') {
    return '';
  }

  const num = Number(str);
  if (!isNaN(num) && num > 30000 && num < 100000) {
    const utcDate = new Date(Date.UTC(1899, 11, 30) + num * 24 * 60 * 60 * 1000);
    const dd = String(utcDate.getUTCDate()).padStart(2, '0');
    const mm = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = utcDate.getUTCFullYear();
    return `${yyyy}-${mm}-${dd}`;
  }

  let datePart = str;
  if (str.includes('T')) {
    datePart = str.split('T')[0];
  } else {
    const spaceParts = str.split(/\s+/);
    if (spaceParts.length > 1 && (spaceParts[0].includes('-') || spaceParts[0].includes('/') || spaceParts[0].includes('.'))) {
      datePart = spaceParts[0];
    }
  }

  const clean = datePart.replace(/[/\s.]+/g, '-');
  const parts = clean.split('-');

  const formatYear = (yStr: string): string => {
    if (yStr.length === 2) {
      const yearNum = parseInt(yStr, 10);
      return yearNum <= 50 ? `20${yStr.padStart(2, '0')}` : `19${yStr.padStart(2, '0')}`;
    }
    return yStr.padStart(4, '0');
  };

  const pad = (s: string) => s.padStart(2, '0');

  if (parts.length === 3) {
    const p0 = parts[0];
    const p1 = parts[1];
    const p2 = parts[2];

    if (p0.length === 4) {
      return `${p0}-${pad(p1)}-${pad(p2)}`;
    }

    if (p2.length === 4) {
      const year = p2;
      const val0 = parseInt(p0, 10);
      const val1 = parseInt(p1, 10);

      if (val1 >= 1 && val1 <= 12) {
        return `${year}-${pad(p1)}-${pad(p0)}`;
      }
      if (val0 >= 1 && val0 <= 12) {
        return `${year}-${pad(p0)}-${pad(p1)}`;
      }
      return `${year}-${pad(p1)}-${pad(p0)}`;
    }
  }

  return str;
};

export default function QuantityReconciliationPage() {
  const { user } = useAuthStore();
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [rrRecords, setRrRecords] = useState<RREntryRecord[]>([]);
  const [qualityRecords, setQualityRecords] = useState<QualityTrackingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOcp, setSelectedOcp] = useState<string>('All');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; title?: string } | null>(null);

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
      console.error("Error fetching reconciliation data:", e);
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

  /* ── Excel import listener ── */
  useEffect(() => {
    const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const getCellValue = (headers: string[], row: string[], aliases: string[]) => {
      const normalizedAliases = aliases.map(normalizeHeader);
      const index = headers.findIndex(header => normalizedAliases.includes(normalizeHeader(header)));
      const value = index >= 0 ? row[index] : '';
      return value && String(value).trim() ? String(value).trim() : '';
    };

    const handleExcelImport = async (event: Event) => {
      const detail = (event as CustomEvent<{ sectionName: string; import: ImportedSheet }>).detail;
      if (!detail) return;

      if (detail.sectionName === 'Before Completed') {
        setLoading(true);
        const token = localStorage.getItem('tms_token');
        const rows = detail.import.rows;
        const recordsToImport: any[] = [];
        let skippedCount = 0;

        rows.forEach((row) => {
          const doNo = getCellValue(detail.import.headers, row, ['do no', 'do number', 'do_no', 'do_number', 'delivery order no', 'delivery order number']).toUpperCase().trim();
          const mines = getCellValue(detail.import.headers, row, ['mines', 'mine name', 'mine', 'ocp / mine', 'ocp']).trim();
          const doQtyStr = getCellValue(detail.import.headers, row, ['do qty', 'do quantity', 'quantity', 'qty', 'do_qty']);
          const coalTypeRaw = getCellValue(detail.import.headers, row, ['coal type', 'coal_type']).trim();
          const startDateStr = getCellValue(detail.import.headers, row, ['start date', 'start_date', 'validity start', 'valid from', 'valid from date']);
          const endDateStr = getCellValue(detail.import.headers, row, ['end date', 'end_date', 'validity end', 'valid upto', 'valid up to']);
          const statusRaw = getCellValue(detail.import.headers, row, ['status']).trim();
          const month = getCellValue(detail.import.headers, row, ['month']).trim();
          const customer = getCellValue(detail.import.headers, row, ['customer', 'client', 'buyer', 'customer name']).trim();
          const modeRaw = getCellValue(detail.import.headers, row, ['mode', 'transport mode', 'trans mode']).trim().toLowerCase();
          const auctionDateStr = getCellValue(detail.import.headers, row, ['auction date', 'auction_date', 'auction']).trim();
          const permitNo = getCellValue(detail.import.headers, row, ['permit no', 'permit number', 'permit_no', 'permit_number', 'permit']).toUpperCase().trim();
          const permitValidDateStr = getCellValue(detail.import.headers, row, ['permit valid date', 'permit_valid_date', 'permit validity']).trim();

          if (!doNo || !doQtyStr) {
            skippedCount++;
            return;
          }

          const doQty = parseFloat(doQtyStr) || 0;
          const startDate = parseDateToYYYYMMDD(startDateStr);
          const endDate = parseDateToYYYYMMDD(endDateStr);
          const auctionDate = parseDateToYYYYMMDD(auctionDateStr);
          const permitValidDate = parseDateToYYYYMMDD(permitValidDateStr);

          let coalType = 'ROM';
          if (['ROM', 'Slack', 'Steam', 'Washed', 'Non Coking Coal', 'Non Cooking Coals'].some(t => t.toLowerCase() === coalTypeRaw.toLowerCase())) {
            if (coalTypeRaw.toUpperCase() === 'ROM') {
              coalType = 'ROM';
            } else if (coalTypeRaw.toLowerCase().startsWith('non')) {
              coalType = 'Non Coking Coal';
            } else {
              coalType = coalTypeRaw.charAt(0).toUpperCase() + coalTypeRaw.slice(1).toLowerCase();
            }
          }

          let status: DOMasterRecord['status'] = 'Active';
          const sLower = statusRaw.toLowerCase();
          if (sLower === 'completed') {
            status = 'Completed';
          } else if (sLower === 'expired' || sLower === 'cancelled') {
            status = 'Cancelled';
          }

          let mode: DOMasterRecord['mode'] = 'RCR';
          if (modeRaw === 'road') {
            mode = 'Road';
          }

          recordsToImport.push({
            doNo,
            month: month || null,
            auctionDate: auctionDate || null,
            doQty,
            coalType,
            startDate: startDate || null,
            endDate: endDate || null,
            permitNo: permitNo || null,
            permitValidDate: permitValidDate || null,
            status,
            customer: customer || null,
            mode,
            mines: mines || null
          });
        });

        if (recordsToImport.length === 0) {
          setToast({
            message: `Excel Import failed: No valid records found in the sheet.`,
            type: 'error',
            title: 'Import Failed'
          });
          setLoading(false);
          return;
        }

        try {
          const response = await fetch('/api/coal-rcr/do-master', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(recordsToImport)
          });

          if (response.ok) {
            const resData = await response.json();
            const importedCount = resData.count || 0;
            const duplicatesCount = recordsToImport.length - importedCount;

            setToast({
              message: `Excel Import completed: ${importedCount} records imported successfully. ${duplicatesCount} duplicates skipped. ${skippedCount} invalid rows skipped.`,
              type: duplicatesCount > 0 || skippedCount > 0 ? 'info' : 'success',
              title: 'Import Result'
            });
          } else {
            const errData = await response.json();
            throw new Error(errData.error || 'Server returned an error');
          }
        } catch (error: any) {
          console.error("Error importing DO records:", error);
          setToast({
            message: `Excel Import failed: ${error.message || 'Network error'}`,
            type: 'error',
            title: 'Import Error'
          });
        }
        setLoading(false);
        fetchData();
      }

      if (detail.sectionName === 'After Completed') {
        setLoading(true);
        const token = localStorage.getItem('tms_token');
        const rows = detail.import.rows;
        const recordsToImport: any[] = [];
        let skippedCount = 0;

        rows.forEach((row) => {
          const rrNo = getCellValue(detail.import.headers, row, ['rr no', 'rr number', 'rr_no', 'rr_number', 'railway receipt no', 'railway receipt number']).toUpperCase().trim();
          const doNo = getCellValue(detail.import.headers, row, ['do no', 'do number', 'do_no', 'do_number', 'delivery order no', 'delivery order number']).toUpperCase().trim();
          const siding = getCellValue(detail.import.headers, row, ['siding', 'source siding', 'siding name']).trim();
          const rrActQtyStr = getCellValue(detail.import.headers, row, ['rr act qty', 'rr actual qty', 'actual weight', 'rr weight', 'act qty', 'rr_act_qty', 'actual qty']);
          const rrChQtyStr = getCellValue(detail.import.headers, row, ['rr ch qty', 'rr chargeable qty', 'chargeable weight', 'ch qty', 'rr_ch_qty', 'chargeable qty']);
          const vllQtyStr = getCellValue(detail.import.headers, row, ['vll qty', 'vll_qty', 'vll weight']);
          const grnQtyStr = getCellValue(detail.import.headers, row, ['grn qty', 'grn_qty', 'grn weight', 'grn normalised qty']);
          const normalisedQtyStr = getCellValue(detail.import.headers, row, ['normalised qty', 'normalised_qty', 'normalised weight']);
          const rrDateStr = getCellValue(detail.import.headers, row, ['rr date', 'rr_date', 'receipt date']);
          const ocp = getCellValue(detail.import.headers, row, ['ocp', 'mines', 'mine']).trim();

          if (!rrNo || !doNo) {
            skippedCount++;
            return;
          }

          const rrActQty = parseFloat(rrActQtyStr) || 0;
          const rrChQty = parseFloat(rrChQtyStr) || 0;
          const vllQty = parseFloat(vllQtyStr) || 0;
          const grnQty = parseFloat(grnQtyStr) || 0;
          const normalisedQty = parseFloat(normalisedQtyStr) || 0;
          const rrDate = parseDateToYYYYMMDD(rrDateStr);

          recordsToImport.push({
            rrNo,
            doNo,
            siding: siding || '—',
            rrActQty,
            rrChQty,
            vllQty,
            grnQty,
            normalisedQty,
            rrDate: rrDate || null,
            ocp: ocp || null
          });
        });

        if (recordsToImport.length === 0) {
          setToast({
            message: `Excel Import failed: No valid RR records found.`,
            type: 'error',
            title: 'Import Failed'
          });
          setLoading(false);
          return;
        }

        try {
          const response = await fetch('/api/coal-rcr/rr-entry', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(recordsToImport)
          });

          if (response.ok) {
            const resData = await response.json();
            const importedCount = resData.count || 0;
            const duplicatesCount = recordsToImport.length - importedCount;

            setToast({
              message: `Excel Import completed: ${importedCount} records imported successfully. ${duplicatesCount} duplicates updated/skipped. ${skippedCount} invalid rows skipped.`,
              type: duplicatesCount > 0 || skippedCount > 0 ? 'info' : 'success',
              title: 'Import Result'
            });
          } else {
            const errData = await response.json();
            throw new Error(errData.error || 'Server returned an error');
          }
        } catch (error: any) {
          console.error("Error importing RR records:", error);
          setToast({
            message: `Excel Import failed: ${error.message || 'Network error'}`,
            type: 'error',
            title: 'Import Error'
          });
        }
        setLoading(false);
        fetchData();
      }
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, [doRecords, rrRecords]);

  // Aggregate quantity and quality metrics DO-wise
  const doSummaryList = useMemo(() => {
    // 1. Map quality records by RR No for quick lookups
    const qualityMap = new Map<string, QualityTrackingRecord>();
    qualityRecords.forEach(q => {
      if (q.rrNo) {
        qualityMap.set(q.rrNo.toUpperCase().trim(), q);
      }
    });

    return doRecords.map(doRec => {
      const doNoUpper = doRec.doNo.toUpperCase().trim();
      const linkedRRs = rrRecords.filter(rr => rr.doNo.toUpperCase().trim() === doNoUpper);
      
      const totalLiftedQty = linkedRRs.reduce((sum, rr) => sum + (Number(rr.rrActQty) || 0), 0);
      const totalGrnQty = linkedRRs.reduce((sum, rr) => sum + (Number(rr.grnQty) || 0), 0);
      const totalInMotionQty = linkedRRs.reduce((sum, rr) => sum + (Number(rr.inMotionQty) || Number(rr.vllQty) || 0), 0);
      const sumChQty = linkedRRs.reduce((sum, rr) => sum + (Number(rr.rrChQty) || 0), 0);
      
      const doQty = Number(doRec.doQty) || 0;
      
      const isExpiredOrCompleted = doRec.status === 'Completed' || doRec.status === 'Cancelled' || isDOExpired(doRec.endDate);
      const remaining = Math.max(0, doQty - totalLiftedQty);

      const balanceQty = isExpiredOrCompleted ? 0 : remaining;
      const lapseQty = isExpiredOrCompleted ? remaining : 0;

      const tolerancePercent = Number(doRec.tolerance) || 0;
      const toleranceQty = doQty * (tolerancePercent / 100);
      const balanceExclTolerance = Math.max(0, balanceQty - toleranceQty);

      const destination = linkedRRs[0]?.to || '—';
      const ocp = doRec.mines || linkedRRs[0]?.ocp || '—';

      // Weighted quality parameters variables
      let tmSum = 0, imSum = 0, ashSum = 0, vmSum = 0, fcSum = 0, gcvAdbSum = 0, gcvArbSum = 0;
      let totalQualityWeight = 0;
      let qualityCount = 0;

      linkedRRs.forEach(rr => {
        const rrWeight = Number(rr.rrActQty) || 0;
        const rrNoUpper = rr.rrNo.toUpperCase().trim();
        const quality = qualityMap.get(rrNoUpper);

        if (quality) {
          qualityCount++;
          // We use rrActQty as the weight for weighted averages
          const weight = rrWeight || 1;
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

      const hasWeight = totalQualityWeight > 0;
      const divisor = hasWeight ? totalQualityWeight : 1;

      return {
        ...doRec,
        doQty,
        totalLiftedQty,
        totalGrnQty,
        totalInMotionQty,
        sumChQty,
        balanceQty,
        lapseQty,
        tolerancePercent,
        toleranceQty,
        balanceExclTolerance,
        destination,
        ocp,
        rrCount: linkedRRs.length,
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
    doRecords.forEach(d => { if (d.mines) list.add(d.mines.trim()); });
    rrRecords.forEach(r => { if (r.ocp) list.add(r.ocp.trim()); });
    return Array.from(list).sort();
  }, [doRecords, rrRecords]);

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
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed bottom-5 right-5 z-50 rounded-2xl border p-4 shadow-xl flex items-start gap-3 w-96 transition-all ${
          toast.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
        }`}>
          <div className="flex-1">
            <h4 className="text-xs font-black uppercase tracking-wider">{toast.title || 'Notification'}</h4>
            <p className="text-[11px] font-semibold mt-1 opacity-90">{toast.message}</p>
          </div>
          <button onClick={() => setToast(null)} className="p-0.5 hover:bg-slate-200/50 rounded-full transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Header Title */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Quantity & Quality Reconciliation</h2>
          <p className="text-xs text-slate-500 mt-1">Unified DO reconciliation showing delivery quantities alongside average quality tracking analysis.</p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm disabled:opacity-60 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
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

      {/* Filter panel */}
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

      {/* Section 1: Before Completed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <GitCompare className="h-4.5 w-4.5 text-blue-600" /> 1) Before Completed
          </h3>
          <div className="flex items-center gap-2">
            {user?.role?.endsWith('_ADMIN') && <CentralExcelImport onImportSuccess={fetchData} />}
            <SectionExcelExport sectionName="Before Completed" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse min-w-[1400px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-4 py-3.5 w-12 text-center">SL.</th>
                <th className="px-4 py-3.5">DO NO</th>
                <th className="px-4 py-3.5">OCP</th>
                <th className="px-4 py-3.5 text-right">DO QTY (MT)</th>
                <th className="px-4 py-3.5 text-right">LIFTED QTY (MT)</th>
                <th className="px-4 py-3.5 text-right">BALANCE QTY (MT)</th>
                <th className="px-4 py-3.5 text-right">LAPSE QTY (MT)</th>
                <th className="px-4 py-3.5 text-right">GRN QTY (MT)</th>
                <th className="px-4 py-3.5 text-right">TM (%)</th>
                <th className="px-4 py-3.5 text-right">IM (%)</th>
                <th className="px-4 py-3.5 text-right">ASH (%)</th>
                <th className="px-4 py-3.5 text-right">VM (%)</th>
                <th className="px-4 py-3.5 text-right">FC (%)</th>
                <th className="px-4 py-3.5 text-right">GCV ADB (kcal)</th>
                <th className="px-4 py-3.5 text-right">GCV ARB (kcal)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr><td colSpan={15} className="px-6 py-12 text-center text-slate-400 font-semibold">Fetching DO reconciliation details...</td></tr>
              ) : beforeCompletedList.length === 0 ? (
                <tr><td colSpan={15} className="px-6 py-12 text-center text-slate-400 font-bold">No active or cancelled DO records found.</td></tr>
              ) : (
                beforeCompletedList.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                    <td className="px-4 py-4 font-mono font-extrabold text-slate-800 uppercase">{item.doNo}</td>
                    <td className="px-4 py-4 font-semibold text-slate-600">{item.ocp}</td>
                    <td className="px-4 py-4 font-mono text-right font-bold text-slate-800">{item.doQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 font-mono text-right font-semibold text-blue-600">{item.totalLiftedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 font-mono text-right font-semibold text-emerald-600">{item.balanceQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 font-mono text-right font-semibold text-rose-600">{item.lapseQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 font-mono text-right font-semibold text-blue-600">{item.totalGrnQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 font-mono text-right text-slate-700">{item.qualityCount > 0 ? item.tm.toFixed(2) : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-slate-500">{item.qualityCount > 0 ? item.im.toFixed(2) : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-slate-700">{item.qualityCount > 0 ? item.ash.toFixed(2) : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-slate-500">{item.qualityCount > 0 ? item.vm.toFixed(2) : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-slate-500">{item.qualityCount > 0 ? item.fc.toFixed(2) : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-emerald-600 font-bold">{item.qualityCount > 0 ? Math.round(item.gcvAdb).toLocaleString() : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-rose-600 font-bold">{item.qualityCount > 0 ? Math.round(item.gcvArb).toLocaleString() : '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: After Completed */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <GitCompare className="h-4.5 w-4.5 text-blue-600" /> 2) After Completed
          </h3>
          <div className="flex items-center gap-2">
            {user?.role?.endsWith('_ADMIN') && <CentralExcelImport onImportSuccess={fetchData} />}
            <SectionExcelExport sectionName="After Completed" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] border-collapse min-w-[1400px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-4 py-3.5 w-12 text-center">SL.</th>
                <th className="px-4 py-3.5">DO NO</th>
                <th className="px-4 py-3.5">OCP</th>
                <th className="px-4 py-3.5 text-right">DO QTY (MT)</th>
                <th className="px-4 py-3.5 text-right">LIFTED QTY (MT)</th>
                <th className="px-4 py-3.5 text-right">BALANCE QTY (MT)</th>
                <th className="px-4 py-3.5 text-right">LAPSE QTY (MT)</th>
                <th className="px-4 py-3.5 text-right">GRN QTY (MT)</th>
                <th className="px-4 py-3.5 text-right">TM (%)</th>
                <th className="px-4 py-3.5 text-right">IM (%)</th>
                <th className="px-4 py-3.5 text-right">ASH (%)</th>
                <th className="px-4 py-3.5 text-right">VM (%)</th>
                <th className="px-4 py-3.5 text-right">FC (%)</th>
                <th className="px-4 py-3.5 text-right">GCV ADB (kcal)</th>
                <th className="px-4 py-3.5 text-right">GCV ARB (kcal)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr><td colSpan={15} className="px-6 py-12 text-center text-slate-400 font-semibold">Fetching DO reconciliation details...</td></tr>
              ) : afterCompletedList.length === 0 ? (
                <tr><td colSpan={15} className="px-6 py-12 text-center text-slate-400 font-bold">No completed DO records found.</td></tr>
              ) : (
                afterCompletedList.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                    <td className="px-4 py-4 font-mono font-extrabold text-slate-800 uppercase">{item.doNo}</td>
                    <td className="px-4 py-4 font-semibold text-slate-600">{item.ocp}</td>
                    <td className="px-4 py-4 font-mono text-right font-bold text-slate-800">{item.doQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 font-mono text-right font-semibold text-blue-600">{item.totalLiftedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 font-mono text-right font-semibold text-emerald-600">{item.balanceQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 font-mono text-right font-semibold text-rose-600">{item.lapseQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 font-mono text-right font-semibold text-blue-600">{item.totalGrnQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-4 font-mono text-right text-slate-700">{item.qualityCount > 0 ? item.tm.toFixed(2) : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-slate-500">{item.qualityCount > 0 ? item.im.toFixed(2) : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-slate-700">{item.qualityCount > 0 ? item.ash.toFixed(2) : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-slate-500">{item.qualityCount > 0 ? item.vm.toFixed(2) : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-slate-500">{item.qualityCount > 0 ? item.fc.toFixed(2) : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-emerald-600 font-bold">{item.qualityCount > 0 ? Math.round(item.gcvAdb).toLocaleString() : '-'}</td>
                    <td className="px-4 py-4 font-mono text-right text-rose-600 font-bold">{item.qualityCount > 0 ? Math.round(item.gcvArb).toLocaleString() : '-'}</td>
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
