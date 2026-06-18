'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  ClipboardList, 
  Plus, 
  Search, 
  X, 
  RefreshCw, 
  Edit2, 
  Trash2, 
  Hourglass,
  Calendar,
  Layers,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { fetchSyncedValue, saveSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import SectionExcelImport from '@/components/SectionExcelImport';
import SectionExcelExport from '@/components/SectionExcelExport';
import { DOMasterRecord, RREntryRecord } from '../types';

const RR_ENTRY_KEY = 'tms_coal_rr_entry';
const DO_MASTER_KEY = 'tms_coal_do_master';
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

    if (p0.length === 2 && p2.length === 2) {
      const val0 = parseInt(p0, 10);
      const val1 = parseInt(p1, 10);
      const val2 = parseInt(p2, 10);

      const yrA = 2000 + val2;
      const yrB = 2000 + val0;
      const isYrBValid = yrB >= 2015 && yrB <= 2040;

      if (isYrBValid) {
        return `${yrB}-${pad(p1)}-${pad(p2)}`;
      } else {
        return `${yrA}-${pad(p1)}-${pad(p0)}`;
      }
    }
  }

  return str;
};

export default function RREntryPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<RREntryRecord[]>([]);
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [doNoFilter, setDoNoFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<RREntryRecord | null>(null);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; title?: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id?: string; ids?: string[] } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [activeTab, setActiveTab] = useState<'rr-details' | 'quality' | 'deductions'>('rr-details');

  // Form states
  const [form, setForm] = useState({
    doNo: '',
    siding: '',
    rrNo: '',
    rrDate: '',
    invoiceDate: '',
    receiptDate: '',
    loadingDate: '',
    from: '',
    to: '',
    ocp: '',
    rrActQty: '',
    rrChQty: '',
    vllQty: '',
    grnQty: '',
    normalisedQty: '',
    noOfWagons: '',
    udRemark: '',

    // Quality Tab
    quality: {
      tm: '',
      im: '',
      ash: '',
      vm: '',
      fc: '',
      gcvAdb: '',
      gcvArb: '',
      qualityPenalty: '',
    },

    // Deductions Tab
    deductions: {
      pol1: '',
      pol2: '',
      enhc: '',
      dcla: '',
      fauc: '',
      deadFreight: '',
      punitive: '',
      dc: '',
      shortage: '',
      qualitySlippage: '',
      railwayLeakage: '',
      mrExclGst: '',
      finalDeduction: '',
      remarks: '',
    }
  });

  // Fetch data
  const fetchData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('tms_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [rrRes, doRes] = await Promise.all([
        fetch('/api/coal-rcr/rr-entry', { headers }),
        fetch('/api/coal-rcr/do-master', { headers })
      ]);

      if (rrRes.ok && doRes.ok) {
        const rrData = await rrRes.json();
        const doData = await doRes.json();

        if (rrData.success && doData.success) {
          setRecords(rrData.data || []);
          setDoRecords(doData.data || []);
          localStorage.setItem(RR_ENTRY_KEY, JSON.stringify(rrData.data || []));
          localStorage.setItem(DO_MASTER_KEY, JSON.stringify(doData.data || []));
        }
      } else {
        const localRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
        const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
        setRecords(localRRs || []);
        setDoRecords(localDOs || []);
      }
    } catch (e) {
      console.error("Error fetching RR records:", e);
      const localRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
      const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
      setRecords(localRRs || []);
      setDoRecords(localDOs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const localRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
    const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    const hasCache = localRRs && localRRs.length > 0;
    if (hasCache) {
      setRecords(localRRs);
    }
    if (localDOs && localDOs.length > 0) {
      setDoRecords(localDOs);
    }
    fetchData(!hasCache);
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
      if (!detail || detail.sectionName !== 'RR Entry') return;
      setLoading(true);
      const token = localStorage.getItem('tms_token');
      const rows = detail.import.rows;
      const recordsToImport: any[] = [];
      let skippedCount = 0;

      rows.forEach((row) => {
        const doNo = getCellValue(detail.import.headers, row, ['do no', 'do number', 'do_no']).toUpperCase().trim();
        const rrNo = getCellValue(detail.import.headers, row, ['rr no', 'rr number', 'rr_no', 'railway receipt']).toUpperCase().trim();
        let siding = getCellValue(detail.import.headers, row, ['siding', 'siding name']).trim();
        const rrDateStr = getCellValue(detail.import.headers, row, ['rr date', 'rr_date']);
        const invoiceDateStr = getCellValue(detail.import.headers, row, ['invoice date', 'invoice_date']);
        const receiptDateStr = getCellValue(detail.import.headers, row, ['receipt date', 'receipt_date']);
        const loadingDateStr = getCellValue(detail.import.headers, row, ['loading date', 'loading_date']);
        const fromVal = getCellValue(detail.import.headers, row, ['from', 'loading point', 'from_station']);
        const toVal = getCellValue(detail.import.headers, row, ['to', 'destination', 'to_station']);
        const ocpVal = getCellValue(detail.import.headers, row, ['ocp', 'mine', 'mine name', 'ocp name']);
        const rrActQtyStr = getCellValue(detail.import.headers, row, ['rr act qty', 'rr actual quantity', 'actual quantity', 'rr_act_qty']);
        const rrChQtyStr = getCellValue(detail.import.headers, row, ['rr ch qty', 'rr chargeable weight', 'chargeable weight', 'rr_ch_qty']);
        const vllQtyStr = getCellValue(detail.import.headers, row, ['vll qty', 'vll quantity', 'vll', 'vll_qty', 'vll in-motion qty']);
        const grnQtyStr = getCellValue(detail.import.headers, row, ['grn qty', 'grn quantity', 'grn', 'grn_qty']);
        const normalisedQtyStr = getCellValue(detail.import.headers, row, ['normalised qty', 'normalized qty', 'normalised_qty']);
        const noOfWagonsStr = getCellValue(detail.import.headers, row, ['no of wagons', 'wagons', 'wagon count']);
        const udRemarkVal = getCellValue(detail.import.headers, row, ['ud remark', 'ud remarks', 'remark']);

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
        const pol1Str = getCellValue(detail.import.headers, row, ['pol1', 'pol1/a']);
        const pol2Str = getCellValue(detail.import.headers, row, ['pol2']);
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

        if (!siding) {
          const matchedDO = doRecords.find(d => d.doNo.toUpperCase().trim() === doNo);
          siding = matchedDO ? matchedDO.siding : '';
        }

        const grnQty = parseFloat(grnQtyStr) || 0;
        const normalisedQty = parseFloat(normalisedQtyStr !== '' ? normalisedQtyStr : grnQtyStr) || 0;
        const finalDeduction = parseFloat(finalDeductionStr) || (
          (parseFloat(pol1Str) || 0) +
          (parseFloat(pol2Str) || 0) +
          (parseFloat(enhcStr) || 0) +
          (parseFloat(dclaStr) || 0) +
          (parseFloat(faucStr) || 0) +
          (parseFloat(deadFreightStr) || 0) +
          (parseFloat(dcStr) || 0) +
          (parseFloat(shortageStr) || 0) +
          (parseFloat(qualitySlippageStr) || 0) +
          (parseFloat(railwayLeakageStr) || 0) +
          (parseFloat(mrExclGstStr) || 0)
        );

        recordsToImport.push({
          doNo,
          siding,
          rrNo,
          rrDate: parseDateToYYYYMMDD(rrDateStr) || null,
          invoiceDate: parseDateToYYYYMMDD(invoiceDateStr) || null,
          receiptDate: parseDateToYYYYMMDD(receiptDateStr) || null,
          loadingDate: parseDateToYYYYMMDD(loadingDateStr) || null,
          from: fromVal || null,
          to: toVal || null,
          ocp: ocpVal || null,
          rrActQty: parseFloat(rrActQtyStr) || 0,
          rrChQty: parseFloat(rrChQtyStr) || 0,
          vllQty: parseFloat(vllQtyStr) || 0,
          grnQty,
          normalisedQty,
          noOfWagons: noOfWagonsStr ? parseInt(noOfWagonsStr) || null : null,
          udRemark: udRemarkVal || null,
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
            dc: parseFloat(dcStr) || 0,
            shortage: parseFloat(shortageStr) || 0,
            qualitySlippage: parseFloat(qualitySlippageStr) || 0,
            railwayLeakage: parseFloat(railwayLeakageStr) || 0,
            mrExclGst: parseFloat(mrExclGstStr) || 0,
            finalDeduction: finalDeduction || 0,
            remarks: udRemarkVal || null,
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
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, [records, doRecords]);

  // Auto-fill siding when DO is selected
  const handleDOChange = (doNo: string) => {
    const matchedDO = doRecords.find(d => d.doNo === doNo);
    setForm(prev => ({
      ...prev,
      doNo,
      siding: matchedDO ? matchedDO.siding : '',
      ocp: matchedDO?.mines || prev.ocp // Prefill mine from DO Master as OCP
    }));
  };

  // Auto-fill Normalized Qty when GRN Qty is changed
  const handleGRNChange = (grnQty: string) => {
    setForm(prev => ({
      ...prev,
      grnQty,
      normalisedQty: prev.normalisedQty ? prev.normalisedQty : grnQty // pre-fill if not already edited
    }));
  };

  // Deduction auto-sum logic
  const autoSumDeductions = (d: typeof form.deductions) => {
    return (
      (parseFloat(d.pol1) || 0) +
      (parseFloat(d.pol2) || 0) +
      (parseFloat(d.enhc) || 0) +
      (parseFloat(d.dcla) || 0) +
      (parseFloat(d.fauc) || 0) +
      (parseFloat(d.deadFreight) || 0) +
      (parseFloat(d.punitive) || 0) +
      (parseFloat(d.dc) || 0) +
      (parseFloat(d.shortage) || 0) +
      (parseFloat(d.qualitySlippage) || 0) +
      (parseFloat(d.railwayLeakage) || 0) +
      (parseFloat(d.mrExclGst) || 0)
    );
  };

  const handleDeductionChange = (field: keyof typeof form.deductions, val: string) => {
    setForm(prev => {
      const updatedDeductions = {
        ...prev.deductions,
        [field]: val
      };
      const newSum = autoSumDeductions(updatedDeductions);
      return {
        ...prev,
        deductions: {
          ...updatedDeductions,
          finalDeduction: field === 'finalDeduction' ? val : String(newSum)
        }
      };
    });
  };

  // Search & Filters
  const filteredRecords = useMemo(() => {
    const safeRecords = records || [];
    return safeRecords.filter(r => {
      if (!r) return false;
      const matchesSearch = 
        r.rrNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.doNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.siding.toUpperCase().includes(searchQuery.toUpperCase()) ||
        (r.ocp && r.ocp.toUpperCase().includes(searchQuery.toUpperCase()));
        
      const matchesDO = doNoFilter === 'All' || r.doNo === doNoFilter;
      
      return matchesSearch && matchesDO;
    });
  }, [records, searchQuery, doNoFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Stats
  const stats = useMemo(() => {
    const safeRecords = records || [];
    const totalCount = safeRecords.length;
    const totalGrnQty = safeRecords.reduce((acc, r) => acc + (r ? Number(r.grnQty) : 0), 0);
    const totalNormQty = safeRecords.reduce((acc, r) => acc + (r ? Number(r.normalisedQty) : 0), 0);
    
    return { totalCount, totalGrnQty, totalNormQty };
  }, [records]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    if (doRecords.length === 0) {
      setToast({ message: "Please add at least one Delivery Order in the DO Master before creating an RR Entry!", type: 'error' });
      return;
    }
    setEditingRecord(null);
    setForm({
      doNo: doRecords[0]?.doNo || '',
      siding: doRecords[0]?.siding || '',
      rrNo: '',
      rrDate: '',
      invoiceDate: '',
      receiptDate: '',
      loadingDate: '',
      from: '',
      to: '',
      ocp: doRecords[0]?.mines || '',
      rrActQty: '',
      rrChQty: '',
      vllQty: '',
      grnQty: '',
      normalisedQty: '',
      noOfWagons: '',
      udRemark: '',
      quality: {
        tm: '',
        im: '',
        ash: '',
        vm: '',
        fc: '',
        gcvAdb: '',
        gcvArb: '',
        qualityPenalty: '',
      },
      deductions: {
        pol1: '',
        pol2: '',
        enhc: '',
        dcla: '',
        fauc: '',
        deadFreight: '',
        punitive: '',
        dc: '',
        shortage: '',
        qualitySlippage: '',
        railwayLeakage: '',
        mrExclGst: '',
        finalDeduction: '',
        remarks: '',
      }
    });
    setActiveTab('rr-details');
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (record: any) => {
    setEditingRecord(record);
    setForm({
      doNo: record.doNo,
      siding: record.siding,
      rrNo: record.rrNo,
      rrDate: record.rrDate || '',
      invoiceDate: record.invoiceDate || '',
      receiptDate: record.receiptDate || '',
      loadingDate: record.loadingDate || '',
      from: record.from || '',
      to: record.to || '',
      ocp: record.ocp || '',
      rrActQty: record.rrActQty !== undefined ? String(record.rrActQty) : '',
      rrChQty: record.rrChQty !== undefined ? String(record.rrChQty) : '',
      vllQty: record.vllQty !== undefined ? String(record.vllQty) : '',
      grnQty: record.grnQty !== undefined ? String(record.grnQty) : '',
      normalisedQty: record.normalisedQty !== undefined ? String(record.normalisedQty) : '',
      noOfWagons: record.noOfWagons !== undefined && record.noOfWagons !== null ? String(record.noOfWagons) : '',
      udRemark: record.udRemark || '',
      quality: {
        tm: record.quality?.tm !== undefined ? String(record.quality.tm) : '',
        im: record.quality?.im !== undefined ? String(record.quality.im) : '',
        ash: record.quality?.ash !== undefined ? String(record.quality.ash) : '',
        vm: record.quality?.vm !== undefined ? String(record.quality.vm) : '',
        fc: record.quality?.fc !== undefined ? String(record.quality.fc) : '',
        gcvAdb: record.quality?.gcvAdb !== undefined ? String(record.quality.gcvAdb) : '',
        gcvArb: record.quality?.gcvArb !== undefined ? String(record.quality.gcvArb) : '',
        qualityPenalty: record.quality?.qualityPenalty !== undefined ? String(record.quality.qualityPenalty) : '',
      },
      deductions: {
        pol1: record.deductions?.pol1 !== undefined ? String(record.deductions.pol1) : '',
        pol2: record.deductions?.pol2 !== undefined ? String(record.deductions.pol2) : '',
        enhc: record.deductions?.enhc !== undefined ? String(record.deductions.enhc) : '',
        dcla: record.deductions?.dcla !== undefined ? String(record.deductions.dcla) : '',
        fauc: record.deductions?.fauc !== undefined ? String(record.deductions.fauc) : '',
        deadFreight: record.deductions?.deadFreight !== undefined ? String(record.deductions.deadFreight) : '',
        punitive: record.deductions?.punitive !== undefined ? String(record.deductions.punitive) : '',
        dc: record.deductions?.dc !== undefined ? String(record.deductions.dc) : '',
        shortage: record.deductions?.shortage !== undefined ? String(record.deductions.shortage) : '',
        qualitySlippage: record.deductions?.qualitySlippage !== undefined ? String(record.deductions.qualitySlippage) : '',
        railwayLeakage: record.deductions?.railwayLeakage !== undefined ? String(record.deductions.railwayLeakage) : '',
        mrExclGst: record.deductions?.mrExclGst !== undefined ? String(record.deductions.mrExclGst) : '',
        finalDeduction: record.deductions?.finalDeduction !== undefined ? String(record.deductions.finalDeduction) : '',
        remarks: record.deductions?.remarks || '',
      }
    });
    setActiveTab('rr-details');
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doNo || !form.rrNo || !form.grnQty) {
      setToast({ message: "Please fill in all required fields (DO No, RR No, GRN Qty)", type: 'error' });
      return;
    }

    const recordData = {
      id: editingRecord ? editingRecord.id : undefined,
      doNo: form.doNo,
      siding: form.siding.trim(),
      rrNo: form.rrNo.toUpperCase().trim(),
      rrDate: form.rrDate || null,
      invoiceDate: form.invoiceDate || null,
      receiptDate: form.receiptDate || null,
      loadingDate: form.loadingDate || null,
      from: form.from || null,
      to: form.to || null,
      ocp: form.ocp || null,
      rrActQty: parseFloat(form.rrActQty) || 0,
      rrChQty: parseFloat(form.rrChQty) || 0,
      vllQty: parseFloat(form.vllQty) || 0,
      grnQty: parseFloat(form.grnQty) || 0,
      normalisedQty: parseFloat(form.normalisedQty !== undefined && form.normalisedQty !== '' ? form.normalisedQty : form.grnQty) || 0,
      noOfWagons: form.noOfWagons ? parseInt(form.noOfWagons) || null : null,
      udRemark: form.udRemark || null,
      quality: {
        tm: parseFloat(form.quality.tm) || 0,
        im: parseFloat(form.quality.im) || 0,
        ash: parseFloat(form.quality.ash) || 0,
        vm: parseFloat(form.quality.vm) || 0,
        fc: parseFloat(form.quality.fc) || 0,
        gcvAdb: parseFloat(form.quality.gcvAdb) || 0,
        gcvArb: parseFloat(form.quality.gcvArb) || 0,
        qualityPenalty: parseFloat(form.quality.qualityPenalty) || 0,
      },
      deductions: {
        pol1: parseFloat(form.deductions.pol1) || 0,
        pol2: parseFloat(form.deductions.pol2) || 0,
        enhc: parseFloat(form.deductions.enhc) || 0,
        dcla: parseFloat(form.deductions.dcla) || 0,
        fauc: parseFloat(form.deductions.fauc) || 0,
        deadFreight: parseFloat(form.deductions.deadFreight) || 0,
        punitive: parseFloat(form.deductions.punitive) || 0,
        dc: parseFloat(form.deductions.dc) || 0,
        shortage: parseFloat(form.deductions.shortage) || 0,
        qualitySlippage: parseFloat(form.deductions.qualitySlippage) || 0,
        railwayLeakage: parseFloat(form.deductions.railwayLeakage) || 0,
        mrExclGst: parseFloat(form.deductions.mrExclGst) || 0,
        finalDeduction: parseFloat(form.deductions.finalDeduction) || 0,
        remarks: form.deductions.remarks || null,
      }
    };

    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch('/api/coal-rcr/rr-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(recordData)
      });

      if (!response.ok) {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to save RR record.", type: 'error' });
        return;
      }

      const res = await response.json();
      if (res.success) {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Error saving RR record:", error);
      setToast({ message: "An error occurred while saving the RR record.", type: 'error' });
    }
  };

  // Delete Handler
  const executeSingleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch(`/api/coal-rcr/rr-entry?id=${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        setToast({ message: "RR record successfully deleted.", type: 'success' });
        fetchData();
      } else {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to delete RR record.", type: 'error' });
      }
    } catch (error) {
      console.error("Error deleting RR record:", error);
      setToast({ message: "An error occurred while deleting the RR record.", type: 'error' });
    }
  };

  const executeBulkDelete = async (ids: string[]) => {
    setLoading(true);
    const token = localStorage.getItem('tms_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(ids.map(async (id) => {
        try {
          const response = await fetch(`/api/coal-rcr/rr-entry?id=${id}`, {
            method: 'DELETE',
            headers
          });
          if (response.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }));
      setToast({
        message: `Bulk delete completed: ${successCount} RR records deleted, ${failCount} failed.`,
        type: failCount > 0 ? 'info' : 'success'
      });
      setSelectedIds([]);
      setIsDeleteMode(false);
      fetchData();
    } catch (error) {
      console.error("Error in bulk delete:", error);
      setToast({ message: "An error occurred during bulk delete.", type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirm({ id });
  };

  const handleBulkDelete = () => {
    setDeleteConfirm({ ids: selectedIds });
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-700">
      {deleteConfirm && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center gap-3 text-red-600">
              <div className="rounded-full bg-red-50 p-2">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 font-sans">
                Confirm Deletion
              </h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-sans font-semibold">
              {deleteConfirm.ids 
                ? `Are you sure you want to delete these ${deleteConfirm.ids.length} records? This action is permanent and cannot be undone.`
                : "Are you sure you want to delete this record? This action is permanent and cannot be undone."
              }
            </p>
            <div className="flex justify-end gap-2 mt-2 font-sans">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 active:scale-[0.98] transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const target = deleteConfirm;
                  setDeleteConfirm(null);
                  if (target.ids) {
                    await executeBulkDelete(target.ids);
                  } else if (target.id) {
                    await executeSingleDelete(target.id);
                  }
                }}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 active:scale-[0.98] transition-all shadow-sm"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">RR Entry</h2>
          <p className="text-xs text-slate-500 mt-1">
            Log railway receipt logs, actual and challan invoice weights, VLL, and GRN receipts
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {user?.role?.endsWith('_ADMIN') && <SectionExcelImport sectionName="RR Entry" />}
          <SectionExcelExport sectionName="RR Entry" />
          <button
            onClick={handleOpenAdd}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" /> Add RR Entry
          </button>
          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm disabled:opacity-60 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total RR Registered</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalCount}</span>
            <span className="text-[10px] text-slate-400">wagons / shipments</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total GRN Received</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">{stats.totalGrnQty.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">Metric Tons</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Normalised Weight</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">{stats.totalNormQty.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">MT normalised</span>
          </div>
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
            placeholder="Search by RR No, DO No, Siding..."
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
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="text-xs text-slate-400 font-semibold font-sans">Filter by DO:</span>
          <select
            value={doNoFilter}
            onChange={(e) => { setDoNoFilter(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-bold font-sans focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
          >
            <option value="All">All DO Numbers</option>
            {doRecords.map(d => (
              <option key={d.id} value={d.doNo}>{d.doNo}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <ClipboardList className="h-4.5 w-4.5 text-blue-600" /> RR Receipts ({filteredRecords.length})
          </h3>
          {user?.role?.endsWith('_ADMIN') && (
            <div className="flex items-center gap-2">
              {isDeleteMode ? (
                <>
                  {selectedIds.length > 0 && (
                    <button
                      onClick={handleBulkDelete}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors shadow-sm"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Selected ({selectedIds.length})
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setIsDeleteMode(false);
                      setSelectedIds([]);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsDeleteMode(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  Select to Delete
                </button>
              )}
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1500px]">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                {isDeleteMode && (
                  <th className="w-10 px-5 py-4 text-center">
                    <input
                      type="checkbox"
                      checked={paginatedRecords.length > 0 && paginatedRecords.every(r => selectedIds.includes(r.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSelections = [...selectedIds];
                          paginatedRecords.forEach(r => {
                            if (!newSelections.includes(r.id)) {
                              newSelections.push(r.id);
                            }
                          });
                          setSelectedIds(newSelections);
                        } else {
                          setSelectedIds(selectedIds.filter(id => !paginatedRecords.some(r => r.id === id)));
                        }
                      }}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                    />
                  </th>
                )}
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">RR No</th>
                <th className="px-5 py-4">RR Date</th>
                <th className="px-5 py-4">Invoice Date</th>
                <th className="px-5 py-4">Receipt Date</th>
                <th className="px-5 py-4">From</th>
                <th className="px-5 py-4">To</th>
                <th className="px-5 py-4">OCP</th>
                <th className="px-5 py-4">DO No</th>
                <th className="px-5 py-4 text-right">RR Chargeable Weight</th>
                <th className="px-5 py-4 text-right">RR Actual Qty</th>
                <th className="px-5 py-4 text-right">VLL In-Motion Qty</th>
                <th className="px-5 py-4 text-right">GRN Qty</th>
                <th className="px-5 py-4 text-right">Normalised Qty</th>
                <th className="px-5 py-4 text-center">No. of Wagons</th>
                <th className="px-5 py-4">U/D Remark</th>
                <th className="px-5 py-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={isDeleteMode ? 18 : 17} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> Fetching railway receipts...
                    </span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isDeleteMode ? 18 : 17} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No RR entries found.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => (
                  <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.includes(r.id) ? 'bg-blue-50/20' : ''}`}>
                    {isDeleteMode && (
                      <td className="w-10 px-5 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(r.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds([...selectedIds, r.id]);
                            } else {
                              setSelectedIds(selectedIds.filter(id => id !== r.id));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-5 py-4 font-bold text-slate-400 text-center">
                      {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                    </td>
                    <td className="px-5 py-4 font-mono font-extrabold text-slate-800 uppercase tracking-wider">
                      {r.rrNo}
                    </td>
                    <td className="px-5 py-4 font-semibold font-mono text-slate-600">{r.rrDate || '—'}</td>
                    <td className="px-5 py-4 font-semibold font-mono text-slate-600">{r.invoiceDate || '—'}</td>
                    <td className="px-5 py-4 font-semibold font-mono text-slate-600">{r.receiptDate || '—'}</td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{r.from || '—'}</td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{r.to || '—'}</td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{r.ocp || '—'}</td>
                    <td className="px-5 py-4 font-mono font-bold text-slate-700">
                      {r.doNo}
                    </td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right">{Number(r.rrChQty || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right">{Number(r.rrActQty || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right">{Number(r.vllQty || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right font-bold text-blue-600">{Number(r.grnQty || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right font-bold text-emerald-600">{Number(r.normalisedQty || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 text-center font-semibold text-slate-700">{r.noOfWagons || '—'}</td>
                    <td className="px-5 py-4 font-semibold text-slate-600 max-w-[150px] truncate" title={r.udRemark || ''}>{r.udRemark || '—'}</td>
                    <td className="px-5 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEdit(r)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/50 shrink-0">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
                {editingRecord ? 'Edit RR Entry' : 'Add RR Entry'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('rr-details')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  activeTab === 'rr-details'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                1. RR Details
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('quality')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  activeTab === 'quality'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                2. Quality Analysis
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('deductions')}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
                  activeTab === 'deductions'
                    ? 'border-blue-600 text-blue-600 bg-white'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                3. Charges & Deductions
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              
              {/* Tab 1: RR Details */}
              {activeTab === 'rr-details' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-800 border-b border-slate-100 pb-2">Basic RR Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">DO Number <span className="text-red-500">*</span></label>
                      <select
                        required
                        value={form.doNo}
                        onChange={(e) => handleDOChange(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-bold focus:outline-none cursor-pointer"
                      >
                        {doRecords.map(d => (
                          <option key={d.id} value={d.doNo}>{d.doNo}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Siding</label>
                      <input
                        type="text"
                        readOnly
                        value={form.siding}
                        placeholder="Siding name"
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-500 focus:outline-none font-semibold cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">RR Number <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        required
                        value={form.rrNo}
                        onChange={(e) => setForm({ ...form, rrNo: e.target.value })}
                        placeholder="e.g. RR-9831"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500/50 uppercase font-mono font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">OCP / Mine Name</label>
                      <input
                        type="text"
                        value={form.ocp}
                        onChange={(e) => setForm({ ...form, ocp: e.target.value })}
                        placeholder="e.g. Ananta"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> RR Date</label>
                      <input
                        type="date"
                        value={form.rrDate}
                        onChange={(e) => setForm({ ...form, rrDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none font-mono cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Invoice Date</label>
                      <input
                        type="date"
                        value={form.invoiceDate}
                        onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none font-mono cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Receipt Date</label>
                      <input
                        type="date"
                        value={form.receiptDate}
                        onChange={(e) => setForm({ ...form, receiptDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none font-mono cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Loading Date</label>
                      <input
                        type="date"
                        value={form.loadingDate}
                        onChange={(e) => setForm({ ...form, loadingDate: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none font-mono cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">From Station</label>
                      <input
                        type="text"
                        value={form.from}
                        onChange={(e) => setForm({ ...form, from: e.target.value })}
                        placeholder="From Loading Point"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">To Station</label>
                      <input
                        type="text"
                        value={form.to}
                        onChange={(e) => setForm({ ...form, to: e.target.value })}
                        placeholder="Destination Siding"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">No. of Wagons</label>
                      <input
                        type="number"
                        value={form.noOfWagons}
                        onChange={(e) => setForm({ ...form, noOfWagons: e.target.value })}
                        placeholder="e.g. 58"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-semibold"
                      />
                    </div>
                  </div>

                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-800 border-b border-slate-100 pb-2 pt-2">Quantities & Weights (MT)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">RR Chargeable Wt</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.rrChQty}
                        onChange={(e) => setForm({ ...form, rrChQty: e.target.value })}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">RR Actual Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.rrActQty}
                        onChange={(e) => setForm({ ...form, rrActQty: e.target.value })}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">VLL In-Motion Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.vllQty}
                        onChange={(e) => setForm({ ...form, vllQty: e.target.value })}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">GRN Qty <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={form.grnQty}
                        onChange={(e) => handleGRNChange(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Normalised Qty</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.normalisedQty}
                        onChange={(e) => setForm({ ...form, normalisedQty: e.target.value })}
                        placeholder="Defaults to GRN"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono font-bold text-emerald-700"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-slate-500 uppercase tracking-wider">U/D Remark</label>
                    <textarea
                      value={form.udRemark || ''}
                      onChange={(e) => setForm({ ...form, udRemark: e.target.value })}
                      placeholder="Enter unloading remarks if any..."
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-semibold resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Quality Analysis */}
              {activeTab === 'quality' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-800 border-b border-slate-100 pb-2">Proximate Chemical Parameters & GCV</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Total Moisture (TM %)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.quality.tm}
                        onChange={(e) => setForm({
                          ...form,
                          quality: { ...form.quality, tm: e.target.value }
                        })}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Inherent Moisture (IM %)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.quality.im}
                        onChange={(e) => setForm({
                          ...form,
                          quality: { ...form.quality, im: e.target.value }
                        })}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Ash Content (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.quality.ash}
                        onChange={(e) => setForm({
                          ...form,
                          quality: { ...form.quality, ash: e.target.value }
                        })}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Volatile Matter (VM %)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.quality.vm}
                        onChange={(e) => setForm({
                          ...form,
                          quality: { ...form.quality, vm: e.target.value }
                        })}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Fixed Carbon (FC %)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.quality.fc}
                        onChange={(e) => setForm({
                          ...form,
                          quality: { ...form.quality, fc: e.target.value }
                        })}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">GCV (ADB) (kcal/kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.quality.gcvAdb}
                        onChange={(e) => setForm({
                          ...form,
                          quality: { ...form.quality, gcvAdb: e.target.value }
                        })}
                        placeholder="e.g. 3800"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">GCV (ARB) (kcal/kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={form.quality.gcvArb}
                        onChange={(e) => setForm({
                          ...form,
                          quality: { ...form.quality, gcvArb: e.target.value }
                        })}
                        placeholder="e.g. 3600"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-red-500 uppercase tracking-wider">Quality Penalty (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.quality.qualityPenalty}
                        onChange={(e) => setForm({
                          ...form,
                          quality: { ...form.quality, qualityPenalty: e.target.value }
                        })}
                        placeholder="0.00"
                        className="w-full bg-red-50 border border-red-200 text-red-700 font-bold rounded-xl px-3 py-2.5 placeholder-red-400 focus:outline-none font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 3: Charges & Deductions */}
              {activeTab === 'deductions' && (
                <div className="space-y-4">
                  <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-800 border-b border-slate-100 pb-2">Commercial Surcharges & Penalty Deductions</h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">POL 1 / A (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.pol1}
                        onChange={(e) => handleDeductionChange('pol1', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">POL 2 (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.pol2}
                        onChange={(e) => handleDeductionChange('pol2', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">ENHC Charge (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.enhc}
                        onChange={(e) => handleDeductionChange('enhc', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">DCLA Charge (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.dcla}
                        onChange={(e) => handleDeductionChange('dcla', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">FAUC Charge (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.fauc}
                        onChange={(e) => handleDeductionChange('fauc', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Dead Freight (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.deadFreight}
                        onChange={(e) => handleDeductionChange('deadFreight', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Punitive Charges (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.punitive}
                        onChange={(e) => handleDeductionChange('punitive', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Demurrage Charge (DC) (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.dc}
                        onChange={(e) => handleDeductionChange('dc', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Shortage Deduction (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.shortage}
                        onChange={(e) => handleDeductionChange('shortage', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Quality Slippage (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.qualitySlippage}
                        onChange={(e) => handleDeductionChange('qualitySlippage', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Railway Leakage (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.railwayLeakage}
                        onChange={(e) => handleDeductionChange('railwayLeakage', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">MR Excl. GST (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.mrExclGst}
                        onChange={(e) => handleDeductionChange('mrExclGst', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="font-bold text-red-600 uppercase tracking-wider">Final Deduction (₹) <span className="text-[10px] text-slate-400 font-semibold">(Auto-calculated)</span></label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.deductions.finalDeduction}
                        onChange={(e) => handleDeductionChange('finalDeduction', e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-red-50 border border-red-200 text-red-700 font-extrabold rounded-xl px-3 py-2.5 placeholder-red-400 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-bold text-slate-500 uppercase tracking-wider">Remarks / Narration</label>
                      <input
                        type="text"
                        value={form.deductions.remarks}
                        onChange={(e) => setForm({
                          ...form,
                          deductions: { ...form.deductions, remarks: e.target.value }
                        })}
                        placeholder="Enter commercial remarks..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-semibold"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Form Footer Action Bar */}
              <div className="border-t border-slate-100 pt-4 flex justify-between items-center shrink-0">
                <span className="text-[10px] text-slate-400 font-semibold">
                  * Fields are required to save. Fill other tabs before submitting.
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-50 active:scale-[0.98] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-blue-600 px-5 py-2.5 text-white font-extrabold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm"
                  >
                    Save Record
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Floating Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[300] flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl animate-slide-in max-w-md ${
          toast.type === 'success' ? 'border-emerald-500/20 bg-emerald-50/95 text-emerald-950' :
          toast.type === 'error' ? 'border-red-500/20 bg-red-50/95 text-red-950' :
          'border-amber-500/20 bg-amber-50/95 text-amber-950'
        } backdrop-blur-md`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 font-bold" />
          ) : toast.type === 'error' ? (
            <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          ) : (
            <Info className="h-5 w-5 text-amber-600 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-[11px] font-bold uppercase tracking-wider">
              {toast.title || (toast.type === 'success' ? 'Succeeded' : toast.type === 'error' ? 'Failed' : 'Status')}
            </h4>
            <p className="text-[10px] opacity-90 mt-0.5 whitespace-pre-wrap">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToast(null)} 
            className="rounded-lg p-1 hover:bg-black/5 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
