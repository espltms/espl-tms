'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  GitCompare, 
  Search, 
  RefreshCw, 
  Calendar,
  X
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { DOMasterRecord, RREntryRecord } from '../types';
import { readLocalValue } from '@/lib/syncedStorage';
import SectionExcelImport from '@/components/SectionExcelImport';
import SectionExcelExport from '@/components/SectionExcelExport';

const DO_MASTER_KEY = 'tms_coal_do_master';
const RR_ENTRY_KEY = 'tms_coal_rr_entry';
const ITEMS_PER_PAGE = 15;

type ImportedSheet = {
  id: string;
  fileName: string;
  importedAt: string;
  headers: string[];
  rows: string[][];
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

      if (detail.sectionName === 'DO Master') {
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
          } else if (sLower === 'open' || sLower === 'active') {
            status = 'Active';
          }

          let mode: DOMasterRecord['mode'] = 'RCR';
          if (modeRaw === 'road') {
            mode = 'Road';
          }

          recordsToImport.push({
            doNo,
            month: month || null,
            auctionDate: auctionDate || null,
            mines: mines || null,
            doQty,
            coalType,
            startDate: startDate || null,
            endDate: endDate || null,
            permitNo: permitNo || null,
            permitValidDate: permitValidDate || null,
            status,
            customer: customer || null,
            mode
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

      } else if (detail.sectionName === 'RR Entry') {
        setLoading(true);
        const token = localStorage.getItem('tms_token');
        const rows = detail.import.rows;
        const recordsToImport: any[] = [];
        let skippedCount = 0;

        rows.forEach((row) => {
          const doNo = getCellValue(detail.import.headers, row, ['do no', 'do number', 'do_no']).toUpperCase().trim();
          const rrNo = getCellValue(detail.import.headers, row, ['rr no', 'rr number', 'rr_no', 'railway receipt']).toUpperCase().trim();
          let siding = getCellValue(detail.import.headers, row, ['siding', 'siding name', 'source siding', 'source_siding']).trim();
          const rrDateStr = getCellValue(detail.import.headers, row, ['rr date', 'rr_date']);
          const invoiceDateStr = getCellValue(detail.import.headers, row, ['invoice date', 'invoice_date']);
          const receiptDateStr = getCellValue(detail.import.headers, row, ['receipt date', 'receipt_date']);
          const loadingDateStr = getCellValue(detail.import.headers, row, ['loading date', 'loading_date']);
          const fromVal = getCellValue(detail.import.headers, row, ['from', 'loading point', 'from_station']);
          const toVal = getCellValue(detail.import.headers, row, ['to', 'destination', 'to_station']);
          const ocpVal = getCellValue(detail.import.headers, row, ['ocp', 'mine', 'mine name', 'ocp name', 'ocp / mine']);
          const rrActQtyStr = getCellValue(detail.import.headers, row, ['rr act qty', 'rr actual quantity', 'actual quantity', 'rr_act_qty', 'rr actual qty']);
          const rrChQtyStr = getCellValue(detail.import.headers, row, ['rr ch qty', 'rr chargeable weight', 'chargeable weight', 'rr_ch_qty', 'rr chargeable qty']);
          const vllQtyStr = getCellValue(detail.import.headers, row, ['vll qty', 'vll quantity', 'vll', 'vll_qty', 'vll in-motion qty']);
          const grnQtyStr = getCellValue(detail.import.headers, row, ['grn qty', 'grn quantity', 'grn', 'grn_qty']);
          const normalisedQtyStr = getCellValue(detail.import.headers, row, ['normalised qty', 'normalized qty', 'normalised_qty']);
          const noOfWagonsStr = getCellValue(detail.import.headers, row, ['no of wagons', 'wagons', 'wagon count', 'no of wagon']);
          const udRemarkVal = getCellValue(detail.import.headers, row, ['ud remark', 'ud remarks', 'remark']);

          // New fields
          const fnrNo = getCellValue(detail.import.headers, row, ['fnr no', 'fnr_no', 'fnr number', 'fnr', 'fnr_number']).trim();
          const inMotionQtyStr = getCellValue(detail.import.headers, row, ['in motion qty', 'in_motion_qty', 'in motion weight', 'in-motion qty', 'in motion']);
          const esplTInvNo = getCellValue(detail.import.headers, row, ['espl t inv no', 'espl (t) inv no', 'espl t invoice no', 'espl(t)invno', 'espl (t) inv no.']).trim();
          const esplHInvNo = getCellValue(detail.import.headers, row, ['espl h inv no', 'espl (h) inv no', 'espl h invoice no', 'espl(h)invno', 'espl (h) inv no.']).trim();
          const invDateStr = getCellValue(detail.import.headers, row, ['date', 'inv date', 'invoice date', 'inv_date']);
          const tInvAmtStr = getCellValue(detail.import.headers, row, ['t inv amt', 't_inv_amt', 't inv amount', 't invoice amount', 'tinvamt']);
          const hInvAmtStr = getCellValue(detail.import.headers, row, ['h inv amt', 'h_inv_amt', 'h inv amount', 'h invoice amount', 'hinvamt']);

          // Quality fields
          const tmStr = getCellValue(detail.import.headers, row, ['tm', 'tm%', 'total moisture']);
          const imStr = getCellValue(detail.import.headers, row, ['im', 'im%', 'inherent moisture']);
          const vmStr = getCellValue(detail.import.headers, row, ['vm', 'vm%', 'volatile matter']);
          const ashStr = getCellValue(detail.import.headers, row, ['ash', 'ash%', 'ash content']);
          const fcStr = getCellValue(detail.import.headers, row, ['fc', 'fc%', 'fixed carbon']);
          const gcvAdbStr = getCellValue(detail.import.headers, row, ['gcv adb', 'gcv_adb', 'gcv adb Basis']);
          const gcvArbStr = getCellValue(detail.import.headers, row, ['gcv arb', 'gcv_arb']);
          const qualityPenaltyStr = getCellValue(detail.import.headers, row, ['quality penalty', 'penalty', 'quality_penalty']);

          // Deduction fields
          const pol1Str = getCellValue(detail.import.headers, row, ['pol1', 'pol1/a', 'pol1a', 'pol 1']);
          const pol2Str = getCellValue(detail.import.headers, row, ['pol2', 'pol 2']);
          const enhcStr = getCellValue(detail.import.headers, row, ['enhc']);
          const dclaStr = getCellValue(detail.import.headers, row, ['dcla']);
          const faucStr = getCellValue(detail.import.headers, row, ['fauc']);
          const deadFreightStr = getCellValue(detail.import.headers, row, ['dead freight', 'dead_freight']);
          const dcStr = getCellValue(detail.import.headers, row, ['dc', 'demurrage']);
          const shortageStr = getCellValue(detail.import.headers, row, ['shortage']);
          const qualitySlippageStr = getCellValue(detail.import.headers, row, ['quality slippage', 'quality_slippage']);
          const railwayLeakageStr = getCellValue(detail.import.headers, row, ['railway leakage', 'railway_leakage']);
          const mrExclGstStr = getCellValue(detail.import.headers, row, ['mr excl gst', 'mr_excl_gst']);
          const finalDeductionStr = getCellValue(detail.import.headers, row, ['final deduction', 'final_deduction', 'total deduction']);

          if (!doNo || !rrNo || !grnQtyStr) {
            skippedCount++;
            return;
          }

          const rrDate = parseDateToYYYYMMDD(rrDateStr);
          const invoiceDate = parseDateToYYYYMMDD(invoiceDateStr);
          const receiptDate = parseDateToYYYYMMDD(receiptDateStr);
          const loadingDate = parseDateToYYYYMMDD(loadingDateStr);
          const invDate = parseDateToYYYYMMDD(invDateStr);

          // Find siding from DO Master if siding is empty or MVAA
          if ((!siding || siding.toUpperCase() === 'MVAA') && doRecords) {
            const matchedDO = doRecords.find(d => d.doNo === doNo);
            if (matchedDO && matchedDO.siding) {
              siding = matchedDO.siding;
            }
          }

          recordsToImport.push({
            doNo,
            siding: siding || 'MVAA',
            rrNo,
            rrDate: rrDate || null,
            invoiceDate: invoiceDate || null,
            receiptDate: receiptDate || null,
            loadingDate: loadingDate || null,
            from: fromVal || null,
            to: toVal || null,
            ocp: ocpVal || null,
            rrActQty: parseFloat(rrActQtyStr) || 0,
            rrChQty: parseFloat(rrChQtyStr) || 0,
            vllQty: parseFloat(vllQtyStr) || 0,
            grnQty: parseFloat(grnQtyStr) || 0,
            normalisedQty: parseFloat(normalisedQtyStr) || parseFloat(grnQtyStr) || 0,
            noOfWagons: noOfWagonsStr ? parseInt(noOfWagonsStr) || null : null,
            udRemark: udRemarkVal || null,
            fnrNo: fnrNo || null,
            inMotionQty: inMotionQtyStr ? parseFloat(inMotionQtyStr) : null,
            esplTInvNo: esplTInvNo || null,
            esplHInvNo: esplHInvNo || null,
            invDate: invDate || null,
            tInvAmt: tInvAmtStr ? parseFloat(tInvAmtStr) : null,
            hInvAmt: hInvAmtStr ? parseFloat(hInvAmtStr) : null,
            quality: {
              tm: parseFloat(tmStr) || 0,
              im: parseFloat(imStr) || 0,
              ash: parseFloat(ashStr) || 0,
              vm: parseFloat(vmStr) || 0,
              fc: parseFloat(fcStr) || 0,
              gcvAdb: parseFloat(gcvAdbStr) || 0,
              gcvArb: parseFloat(gcvArbStr) || 0,
              qualityPenalty: parseFloat(qualityPenaltyStr) || 0,
            },
            deductions: {
              pol1: parseFloat(pol1Str) || 0,
              pol2: parseFloat(pol2Str) || 0,
              enhc: parseFloat(enhcStr) || 0,
              dcla: parseFloat(dclaStr) || 0,
              fauc: parseFloat(faucStr) || 0,
              deadFreight: parseFloat(deadFreightStr) || 0,
              punitive: parseFloat(getCellValue(detail.import.headers, row, ['punitive', 'punitive charges'])) || 0,
              dc: parseFloat(dcStr) || 0,
              shortage: parseFloat(shortageStr) || 0,
              qualitySlippage: parseFloat(qualitySlippageStr) || 0,
              railwayLeakage: parseFloat(railwayLeakageStr) || 0,
              mrExclGst: parseFloat(mrExclGstStr) || 0,
              finalDeduction: parseFloat(finalDeductionStr) || 
                ((parseFloat(pol1Str) || 0) +
                 (parseFloat(pol2Str) || 0) +
                 (parseFloat(enhcStr) || 0) +
                 (parseFloat(dclaStr) || 0) +
                 (parseFloat(faucStr) || 0) +
                 (parseFloat(deadFreightStr) || 0) +
                 (parseFloat(dcStr) || 0) +
                 (parseFloat(shortageStr) || 0) +
                 (parseFloat(qualitySlippageStr) || 0) +
                 (parseFloat(railwayLeakageStr) || 0)),
              remarks: getCellValue(detail.import.headers, row, ['remarks', 'deduction remarks', 'deduction remark'])
            }
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
              message: `Excel Import completed: ${importedCount} records imported successfully. ${duplicatesCount} duplicates skipped. ${skippedCount} invalid rows skipped.`,
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
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {user?.role?.endsWith('_ADMIN') && (
            <>
              <SectionExcelImport sectionName="DO Master" />
              <SectionExcelImport sectionName="RR Entry" />
            </>
          )}
          <SectionExcelExport sectionName="Quantity Reconciliation" />
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm disabled:opacity-60 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
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
