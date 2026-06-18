'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  Scale, 
  Plus, 
  Search, 
  X, 
  RefreshCw, 
  Edit2, 
  Trash2, 
  Info,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import SectionExcelImport from '@/components/SectionExcelImport';
import SectionExcelExport from '@/components/SectionExcelExport';
import { DOMasterRecord, RREntryRecord, QualityTrackingRecord, DeductionPenaltyRecord } from '../types';

const DEDUCTION_PENALTY_KEY = 'tms_coal_deduction_penalty';
const QUALITY_TRACKING_KEY = 'tms_coal_quality_tracking';
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

export default function DeductionPenaltyPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<DeductionPenaltyRecord[]>([]);
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [rrRecords, setRrRecords] = useState<RREntryRecord[]>([]);
  const [qualityRecords, setQualityRecords] = useState<QualityTrackingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [doNoFilter, setDoNoFilter] = useState<string>('All');
  const [ocpFilter, setOcpFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DeductionPenaltyRecord | null>(null);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info'; title?: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id?: string; ids?: string[] } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Form states
  const [form, setForm] = useState({
    doNo: '',
    rrNo: '',
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
    remarks: ''
  });

  // Fetch data
  const fetchData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('tms_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [dpRes, qRes, rrRes, doRes] = await Promise.all([
        fetch('/api/coal-rcr/deduction-penalty', { headers }),
        fetch('/api/coal-rcr/quality-tracking', { headers }),
        fetch('/api/coal-rcr/rr-entry', { headers }),
        fetch('/api/coal-rcr/do-master', { headers })
      ]);

      if (dpRes.ok && qRes.ok && rrRes.ok && doRes.ok) {
        const dpData = await dpRes.json();
        const qData = await qRes.json();
        const rrData = await rrRes.json();
        const doData = await doRes.json();

        if (dpData.success && qData.success && rrData.success && doData.success) {
          setRecords(dpData.data || []);
          setQualityRecords(qData.data || []);
          setRrRecords(rrData.data || []);
          setDoRecords(doData.data || []);
          localStorage.setItem(DEDUCTION_PENALTY_KEY, JSON.stringify(dpData.data || []));
          localStorage.setItem(QUALITY_TRACKING_KEY, JSON.stringify(qData.data || []));
          localStorage.setItem(RR_ENTRY_KEY, JSON.stringify(rrData.data || []));
          localStorage.setItem(DO_MASTER_KEY, JSON.stringify(doData.data || []));
        }
      } else {
        setRecords(readLocalValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []));
        setQualityRecords(readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []));
        setRrRecords(readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []));
        setDoRecords(readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []));
      }
    } catch (e) {
      console.error("Error fetching Deduction records:", e);
      setRecords(readLocalValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []));
      setQualityRecords(readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []));
      setRrRecords(readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []));
      setDoRecords(readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cachedDP = readLocalValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []);
    const cachedQual = readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []);
    const cachedRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
    const cachedDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    if (cachedDP.length > 0) setRecords(cachedDP);
    if (cachedQual.length > 0) setQualityRecords(cachedQual);
    if (cachedRRs.length > 0) setRrRecords(cachedRRs);
    if (cachedDOs.length > 0) setDoRecords(cachedDOs);
    fetchData(cachedDP.length === 0);
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
      if (detail.sectionName !== 'Deduction & Penalty') return;
      setLoading(true);
      const token = localStorage.getItem('tms_token');
      const rows = detail.import.rows;
      const recordsToImport: any[] = [];
      let skippedCount = 0;

      rows.forEach((row) => {
        const doNo = getCellValue(detail.import.headers, row, ['do no', 'do number', 'do_no']).toUpperCase().trim();
        const rrNo = getCellValue(detail.import.headers, row, ['rr no', 'rr number', 'rr_no', 'railway receipt']).toUpperCase().trim();
        const pol1Str = getCellValue(detail.import.headers, row, ['pol1', 'pol 1', 'pol 1/a']);
        const pol2Str = getCellValue(detail.import.headers, row, ['pol2', 'pol 2']);
        const enhcStr = getCellValue(detail.import.headers, row, ['enhc', 'enhc charge']);
        const dclaStr = getCellValue(detail.import.headers, row, ['dcla', 'dcla charge']);
        const faucStr = getCellValue(detail.import.headers, row, ['fauc', 'fauc charge']);
        const deadFreightStr = getCellValue(detail.import.headers, row, ['dead freight', 'dead_freight']);
        const punitiveStr = getCellValue(detail.import.headers, row, ['punitive', 'punitive charges']);
        const dcStr = getCellValue(detail.import.headers, row, ['dc', 'demurrage', 'demurrage charges']);
        const shortageStr = getCellValue(detail.import.headers, row, ['shortage', 'shortage deduction']);
        const qualitySlippageStr = getCellValue(detail.import.headers, row, ['quality slippage', 'quality_slippage']);
        const railwayLeakageStr = getCellValue(detail.import.headers, row, ['railway leakage', 'railway_leakage']);
        const mrExclGstStr = getCellValue(detail.import.headers, row, ['mr excl gst', 'mr', 'mr_excl_gst']);
        const finalDeductionStr = getCellValue(detail.import.headers, row, ['final deduction', 'total deduction']);
        const remarksVal = getCellValue(detail.import.headers, row, ['remarks', 'remark', 'narration']);

        if (!doNo || !rrNo) {
          skippedCount++;
          return;
        }

        const pol1 = parseFloat(pol1Str) || 0;
        const pol2 = parseFloat(pol2Str) || 0;
        const enhc = parseFloat(enhcStr) || 0;
        const dcla = parseFloat(dclaStr) || 0;
        const fauc = parseFloat(faucStr) || 0;
        const deadFreight = parseFloat(deadFreightStr) || 0;
        const punitive = parseFloat(punitiveStr) || 0;
        const dc = parseFloat(dcStr) || 0;
        const shortage = parseFloat(shortageStr) || 0;
        const railwayLeakage = parseFloat(railwayLeakageStr) || 0;
        const mrExclGst = parseFloat(mrExclGstStr) || 0;

        let qualitySlippage = parseFloat(qualitySlippageStr) || 0;
        if (!qualitySlippageStr) {
          const matchedQuality = qualityRecords.find(q => q.rrNo.toUpperCase().trim() === rrNo);
          qualitySlippage = matchedQuality ? matchedQuality.qualityPenalty : 0;
        }

        const finalDeduction = finalDeductionStr 
          ? parseFloat(finalDeductionStr) 
          : (pol1 + pol2 + enhc + dcla + fauc + deadFreight + punitive + dc + shortage + qualitySlippage + railwayLeakage + mrExclGst);

        recordsToImport.push({
          doNo,
          rrNo,
          pol1,
          pol2,
          enhc,
          dcla,
          fauc,
          deadFreight,
          punitive,
          dc,
          shortage,
          qualitySlippage,
          railwayLeakage,
          mrExclGst,
          finalDeduction,
          remarks: remarksVal || null
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
        const response = await fetch('/api/coal-rcr/deduction-penalty', {
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
        console.error("Error importing Deduction records:", error);
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
  }, [records, qualityRecords]);

  // Get available RRs for selected DO
  const filteredRRsForSelectedDO = useMemo(() => {
    if (!form.doNo) return [];
    return rrRecords.filter(rr => rr && rr.doNo === form.doNo);
  }, [form.doNo, rrRecords]);

  // Pre-fill Quality Slippage and Auto-calculate Final Deduction
  const handleRRChange = (rrNo: string) => {
    const matchedQuality = qualityRecords.find(q => q.rrNo === rrNo);
    const qualitySlippage = matchedQuality ? matchedQuality.qualityPenalty : 0;
    
    setForm(prev => {
      const pol1 = parseFloat(prev.pol1) || 0;
      const pol2 = parseFloat(prev.pol2) || 0;
      const enhc = parseFloat(prev.enhc) || 0;
      const dcla = parseFloat(prev.dcla) || 0;
      const fauc = parseFloat(prev.fauc) || 0;
      const deadFreight = parseFloat(prev.deadFreight) || 0;
      const punitive = parseFloat(prev.punitive) || 0;
      const dc = parseFloat(prev.dc) || 0;
      const shortage = parseFloat(prev.shortage) || 0;
      const railwayLeakage = parseFloat(prev.railwayLeakage) || 0;
      const mrExclGst = parseFloat(prev.mrExclGst) || 0;
      
      const finalDeduction = pol1 + pol2 + enhc + dcla + fauc + deadFreight + punitive + dc + shortage + qualitySlippage + railwayLeakage + mrExclGst;
      
      return {
        ...prev,
        rrNo,
        qualitySlippage: String(qualitySlippage),
        finalDeduction: String(finalDeduction)
      };
    });
  };

  // Handle DO change
  const handleDOChange = (doNo: string) => {
    const rrs = rrRecords.filter(rr => rr && rr.doNo === doNo);
    const firstRR = rrs[0]?.rrNo || '';
    
    setForm(prev => ({
      ...prev,
      doNo,
      rrNo: firstRR
    }));
    
    if (firstRR) {
      handleRRChange(firstRR);
    } else {
      setForm(prev => ({
        ...prev,
        doNo,
        rrNo: '',
        qualitySlippage: '0',
        finalDeduction: '0'
      }));
    }
  };

  // Handle input changes with auto-calculations
  const handleInputChange = (field: string, val: string) => {
    setForm(prev => {
      const nextForm = { ...prev, [field]: val };
      
      const pol1 = parseFloat(nextForm.pol1) || 0;
      const pol2 = parseFloat(nextForm.pol2) || 0;
      const enhc = parseFloat(nextForm.enhc) || 0;
      const dcla = parseFloat(nextForm.dcla) || 0;
      const fauc = parseFloat(nextForm.fauc) || 0;
      const deadFreight = parseFloat(nextForm.deadFreight) || 0;
      const punitive = parseFloat(nextForm.punitive) || 0;
      const dc = parseFloat(nextForm.dc) || 0;
      const shortage = parseFloat(nextForm.shortage) || 0;
      const qualitySlippage = parseFloat(nextForm.qualitySlippage) || 0;
      const railwayLeakage = parseFloat(nextForm.railwayLeakage) || 0;
      const mrExclGst = parseFloat(nextForm.mrExclGst) || 0;
      
      const finalDeduction = pol1 + pol2 + enhc + dcla + fauc + deadFreight + punitive + dc + shortage + qualitySlippage + railwayLeakage + mrExclGst;
      nextForm.finalDeduction = String(finalDeduction);
      
      return nextForm;
    });
  };

  // Unique list of OCPs for filtering
  const uniqueOCPs = useMemo(() => {
    const list = new Set<string>();
    const safeRRs = rrRecords || [];
    safeRRs.forEach(r => {
      if (r && r.ocp) {
        list.add(r.ocp.trim());
      }
    });
    return Array.from(list).sort();
  }, [rrRecords]);

  // Search & Filters
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (!r) return false;
      const matchedRR = rrRecords.find(rr => rr.rrNo === r.rrNo);
      const ocpName = matchedRR ? matchedRR.ocp : '';
      
      const matchesSearch = 
        r.rrNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.doNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        (ocpName && ocpName.toUpperCase().includes(searchQuery.toUpperCase()));
        
      const matchesDO = doNoFilter === 'All' || r.doNo === doNoFilter;
      const matchesOCP = ocpFilter === 'All' || (ocpName && ocpName.trim().toLowerCase() === ocpFilter.trim().toLowerCase());
      
      return matchesSearch && matchesDO && matchesOCP;
    });
  }, [records, rrRecords, searchQuery, doNoFilter, ocpFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Stats
  const stats = useMemo(() => {
    const totalCount = records.length;
    const totalDeduction = records.reduce((acc, r) => acc + (r ? Number(r.finalDeduction) : 0), 0);
    const shortageDeduction = records.reduce((acc, r) => acc + (r ? Number(r.shortage) : 0), 0);
    const qualityDeduction = records.reduce((acc, r) => acc + (r ? Number(r.qualitySlippage) : 0), 0);
    
    return { totalCount, totalDeduction, shortageDeduction, qualityDeduction };
  }, [records]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    if (doRecords.length === 0) {
      setToast({ message: "Please configure DO Master first!", type: 'error' });
      return;
    }
    if (rrRecords.length === 0) {
      setToast({ message: "Please configure RR Entry first!", type: 'error' });
      return;
    }

    const firstDo = doRecords[0].doNo;
    const rrsForFirstDo = rrRecords.filter(rr => rr.doNo === firstDo);
    const firstRR = rrsForFirstDo[0]?.rrNo || '';
    const matchedQuality = qualityRecords.find(q => q.rrNo === firstRR);
    const qualitySlippage = matchedQuality ? matchedQuality.qualityPenalty : 0;

    setEditingRecord(null);
    setForm({
      doNo: firstDo,
      rrNo: firstRR,
      pol1: '',
      pol2: '',
      enhc: '',
      dcla: '',
      fauc: '',
      deadFreight: '',
      punitive: '',
      dc: '',
      shortage: '',
      qualitySlippage: String(qualitySlippage),
      railwayLeakage: '',
      mrExclGst: '',
      finalDeduction: String(qualitySlippage),
      remarks: ''
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (record: DeductionPenaltyRecord) => {
    setEditingRecord(record);
    setForm({
      doNo: record.doNo,
      rrNo: record.rrNo,
      pol1: record.pol1 !== undefined ? String(record.pol1) : '',
      pol2: record.pol2 !== undefined ? String(record.pol2) : '',
      enhc: record.enhc !== undefined ? String(record.enhc) : '',
      dcla: record.dcla !== undefined ? String(record.dcla) : '',
      fauc: record.fauc !== undefined ? String(record.fauc) : '',
      deadFreight: String(record.deadFreight),
      punitive: String(record.punitive),
      dc: String(record.dc),
      shortage: String(record.shortage),
      qualitySlippage: String(record.qualitySlippage),
      railwayLeakage: String(record.railwayLeakage),
      mrExclGst: record.mrExclGst !== undefined ? String(record.mrExclGst) : '',
      finalDeduction: String(record.finalDeduction),
      remarks: record.remarks || ''
    });
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doNo || !form.rrNo) {
      setToast({ message: "Please select DO No and RR No!", type: 'error' });
      return;
    }

    const recordData = {
      id: editingRecord ? editingRecord.id : undefined,
      doNo: form.doNo,
      rrNo: form.rrNo,
      pol1: parseFloat(form.pol1) || 0,
      pol2: parseFloat(form.pol2) || 0,
      enhc: parseFloat(form.enhc) || 0,
      dcla: parseFloat(form.dcla) || 0,
      fauc: parseFloat(form.fauc) || 0,
      deadFreight: parseFloat(form.deadFreight) || 0,
      punitive: parseFloat(form.punitive) || 0,
      dc: parseFloat(form.dc) || 0,
      shortage: parseFloat(form.shortage) || 0,
      qualitySlippage: parseFloat(form.qualitySlippage) || 0,
      railwayLeakage: parseFloat(form.railwayLeakage) || 0,
      mrExclGst: parseFloat(form.mrExclGst) || 0,
      finalDeduction: parseFloat(form.finalDeduction) || 0,
      remarks: form.remarks || null
    };

    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch('/api/coal-rcr/deduction-penalty', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(recordData)
      });

      if (!response.ok) {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to save Deduction record.", type: 'error' });
        return;
      }

      const res = await response.json();
      if (res.success) {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Error saving Deduction record:", error);
      setToast({ message: "An error occurred while saving the Deduction record.", type: 'error' });
    }
  };

  // Delete Handler
  const executeSingleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch(`/api/coal-rcr/deduction-penalty?id=${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        setToast({ message: "Deduction record successfully deleted.", type: 'success' });
        fetchData();
      } else {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to delete Deduction record.", type: 'error' });
      }
    } catch (error) {
      console.error("Error deleting Deduction record:", error);
      setToast({ message: "An error occurred while deleting the Deduction record.", type: 'error' });
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
          const response = await fetch(`/api/coal-rcr/deduction-penalty?id=${id}`, {
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
        message: `Bulk delete completed: ${successCount} Deduction records deleted, ${failCount} failed.`,
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
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Charges & Deductions</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track commercial penal surcharges, dead freights, shortage claims, and MR balances per Railway Receipt.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {user?.role?.endsWith('_ADMIN') && <SectionExcelImport sectionName="Deduction & Penalty" />}
          <SectionExcelExport sectionName="Deduction & Penalty" />
          <button
            onClick={handleOpenAdd}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Deduction Record
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Deduction Logs</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalCount}</span>
            <span className="text-[10px] text-slate-400">RRs logged</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Shortage Penalties</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">₹{stats.shortageDeduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-slate-400">deducted</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quality Slippage Penalties</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-purple-600">₹{stats.qualityDeduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-slate-400">deducted</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Deductions Claimed</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-red-600">₹{stats.totalDeduction.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-red-500 font-semibold">cumulative</span>
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
            placeholder="Search by RR No or DO No..."
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
              value={ocpFilter}
              onChange={(e) => { setOcpFilter(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-bold font-sans focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
            >
              <option value="All">All OCPs</option>
              {uniqueOCPs.map(ocp => (
                <option key={ocp} value={ocp}>{ocp}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
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
      </div>

      {/* Table grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Scale className="h-4.5 w-4.5 text-blue-600" /> Deduction Logs ({filteredRecords.length})
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
          <table className="w-full text-left text-xs border-collapse min-w-[1800px]">
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
                <th className="px-5 py-4">DO No</th>
                <th className="px-5 py-4 text-right">POL 1 / A (₹)</th>
                <th className="px-5 py-4 text-right">POL 2 (₹)</th>
                <th className="px-5 py-4 text-right">ENHC Charge (₹)</th>
                <th className="px-5 py-4 text-right">DCLA Charge (₹)</th>
                <th className="px-5 py-4 text-right">FAUC Charge (₹)</th>
                <th className="px-5 py-4 text-right">Dead Freight (₹)</th>
                <th className="px-5 py-4 text-right">Punitive (₹)</th>
                <th className="px-5 py-4 text-right">DC / Demurrage (₹)</th>
                <th className="px-5 py-4 text-right">Shortage (₹)</th>
                <th className="px-5 py-4 text-right">Quality Slippage (₹)</th>
                <th className="px-5 py-4 text-right">Railway Leakage (₹)</th>
                <th className="px-5 py-4 text-right">MR Excl. GST (₹)</th>
                <th className="px-5 py-4 text-right font-bold">Final Deduction (₹)</th>
                <th className="px-5 py-4">Remarks</th>
                <th className="px-5 py-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={isDeleteMode ? 19 : 18} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> Fetching deductions...
                    </span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isDeleteMode ? 19 : 18} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No Deduction logs found.
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
                    <td className="px-5 py-4 font-mono font-bold text-slate-700">
                      {r.doNo}
                    </td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.pol1 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.pol2 || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.enhc || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.dcla || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.fauc || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.deadFreight || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.punitive || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.dc || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right font-semibold text-blue-600">{Number(r.shortage || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right font-semibold text-purple-600">{Number(r.qualitySlippage || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.railwayLeakage || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.mrExclGst || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right font-extrabold text-red-600 bg-red-50/10">₹{Number(r.finalDeduction || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-semibold text-slate-500 max-w-[150px] truncate" title={r.remarks || ''}>{r.remarks || '—'}</td>
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

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl shadow-xl overflow-hidden animate-scale-up">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Scale className="h-4.5 w-4.5 text-blue-600" />
                {editingRecord ? 'Edit Penalty Deduction Record' : 'Add Penalty Deduction Record'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                {/* DO No */}
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

                {/* RR No */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">RR Number <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={form.rrNo}
                    onChange={(e) => handleRRChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-bold focus:outline-none cursor-pointer font-mono"
                  >
                    {filteredRRsForSelectedDO.length === 0 ? (
                      <option value="">No RRs under this DO</option>
                    ) : (
                      filteredRRsForSelectedDO.map(rr => (
                        <option key={rr.id} value={rr.rrNo}>{rr.rrNo}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">POL 1 / A (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.pol1}
                    onChange={(e) => handleInputChange('pol1', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">POL 2 (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.pol2}
                    onChange={(e) => handleInputChange('pol2', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">ENHC Charge (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.enhc}
                    onChange={(e) => handleInputChange('enhc', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">DCLA Charge (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.dcla}
                    onChange={(e) => handleInputChange('dcla', e.target.value)}
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
                    value={form.fauc}
                    onChange={(e) => handleInputChange('fauc', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Dead Freight (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.deadFreight}
                    onChange={(e) => handleInputChange('deadFreight', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Punitive Charges (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.punitive}
                    onChange={(e) => handleInputChange('punitive', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Demurrage Charge (DC) (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.dc}
                    onChange={(e) => handleInputChange('dc', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Shortage Claims (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.shortage}
                    onChange={(e) => handleInputChange('shortage', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Quality Slippage (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.qualitySlippage}
                    onChange={(e) => handleInputChange('qualitySlippage', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Railway Leakage (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.railwayLeakage}
                    onChange={(e) => handleInputChange('railwayLeakage', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">MR Excl. GST (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.mrExclGst}
                    onChange={(e) => handleInputChange('mrExclGst', e.target.value)}
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
                    value={form.finalDeduction}
                    onChange={(e) => handleInputChange('finalDeduction', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-red-50 border border-red-200 text-red-700 font-extrabold rounded-xl px-3 py-2.5 placeholder-red-400 focus:outline-none font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Remarks / Narration</label>
                  <input
                    type="text"
                    value={form.remarks}
                    onChange={(e) => setForm({
                      ...form,
                      remarks: e.target.value
                    })}
                    placeholder="Enter commercial remarks..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-semibold"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-600 font-bold hover:bg-slate-50 active:scale-[0.98] transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-white font-bold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-sm"
                >
                  Save Record
                </button>
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
