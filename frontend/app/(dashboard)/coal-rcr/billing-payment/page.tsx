'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  BadgeCent, 
  Plus, 
  Search, 
  X, 
  RefreshCw, 
  Edit2, 
  Trash2, 
  Hourglass,
  Calendar,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { fetchSyncedValue, saveSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import SectionExcelImport from '@/components/SectionExcelImport';
import SectionExcelExport from '@/components/SectionExcelExport';
import { DOMasterRecord, BillingPaymentRecord } from '../types';

const BILLING_PAYMENT_KEY = 'tms_coal_billing_payment';
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

export default function BillingPaymentPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<BillingPaymentRecord[]>([]);
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [doNoFilter, setDoNoFilter] = useState<string>('All');
  const [ocpFilter, setOcpFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingPaymentRecord | null>(null);
  
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
    billNo: '',
    billDate: '',
    billQty: '',
    billAmount: '',
    tds: '',
    advancePaid: '',
    finalPayable: '',
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

      const [bpRes, doRes] = await Promise.all([
        fetch('/api/coal-rcr/billing-payment', { headers }),
        fetch('/api/coal-rcr/do-master', { headers })
      ]);

      if (bpRes.ok && doRes.ok) {
        const bpData = await bpRes.json();
        const doData = await doRes.json();

        if (bpData.success && doData.success) {
          setRecords(bpData.data || []);
          setDoRecords(doData.data || []);
          localStorage.setItem(BILLING_PAYMENT_KEY, JSON.stringify(bpData.data || []));
          localStorage.setItem(DO_MASTER_KEY, JSON.stringify(doData.data || []));
        }
      } else {
        const localBillings = readLocalValue<BillingPaymentRecord[]>(BILLING_PAYMENT_KEY, []);
        const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
        setRecords(localBillings || []);
        setDoRecords(localDOs || []);
      }
    } catch (e) {
      console.error("Error fetching Billing records:", e);
      const localBillings = readLocalValue<BillingPaymentRecord[]>(BILLING_PAYMENT_KEY, []);
      const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
      setRecords(localBillings || []);
      setDoRecords(localDOs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const localBillings = readLocalValue<BillingPaymentRecord[]>(BILLING_PAYMENT_KEY, []);
    const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
    const hasCache = localBillings && localBillings.length > 0;
    if (hasCache) {
      setRecords(localBillings);
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
      if (!detail || detail.sectionName !== 'Billing & Payment') return;
      setLoading(true);
      const token = localStorage.getItem('tms_token');
      const rows = detail.import.rows;
      const recordsToImport: any[] = [];
      let skippedCount = 0;

      rows.forEach((row) => {
        const doNo = getCellValue(detail.import.headers, row, ['do no', 'do number', 'do_no']).toUpperCase().trim();
        const billNo = getCellValue(detail.import.headers, row, ['bill no', 'bill number', 'bill_no', 'invoice number', 'invoice no']).toUpperCase().trim();
        const billDateStr = getCellValue(detail.import.headers, row, ['bill date', 'bill_date', 'invoice date']);
        const billQtyStr = getCellValue(detail.import.headers, row, ['bill qty', 'bill quantity', 'billed qty']);
        const billAmountStr = getCellValue(detail.import.headers, row, ['bill amount', 'bill_amount', 'invoice amount']);
        const tdsStr = getCellValue(detail.import.headers, row, ['tds', 'tds deduction']);
        const advancePaidStr = getCellValue(detail.import.headers, row, ['advance paid', 'advance_paid', 'advance']);
        const finalPayableStr = getCellValue(detail.import.headers, row, ['final payable', 'final_payable', 'net payable']);
        const remarks = getCellValue(detail.import.headers, row, ['remarks', 'comment', 'comments']).trim();

        if (!doNo || !billNo || !billAmountStr) {
          skippedCount++;
          return;
        }

        const billAmount = parseFloat(billAmountStr) || 0;
        const tds = parseFloat(tdsStr) || 0;
        const advancePaid = parseFloat(advancePaidStr) || 0;
        const finalPayable = finalPayableStr ? parseFloat(finalPayableStr) : (billAmount - tds - advancePaid);

        recordsToImport.push({
          doNo,
          billNo,
          billDate: parseDateToYYYYMMDD(billDateStr) || null,
          billQty: parseFloat(billQtyStr) || 0,
          billAmount,
          tds,
          advancePaid,
          finalPayable,
          remarks
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
        const response = await fetch('/api/coal-rcr/billing-payment', {
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
        console.error("Error importing Billing records:", error);
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
  }, [records]);

  // Handle input changes with auto-calculations for final payable
  const handleInputChange = (field: string, val: string) => {
    setForm(prev => {
      const nextForm = { ...prev, [field]: val };
      
      const billAmount = parseFloat(nextForm.billAmount) || 0;
      const tds = parseFloat(nextForm.tds) || 0;
      const advancePaid = parseFloat(nextForm.advancePaid) || 0;
      
      const finalPayable = billAmount - tds - advancePaid;
      nextForm.finalPayable = String(finalPayable);
      
      return nextForm;
    });
  };

  // Unique list of OCPs/Mines for filtering
  const uniqueOCPs = useMemo(() => {
    const list = new Set<string>();
    const safeDOs = doRecords || [];
    safeDOs.forEach(d => {
      if (d && d.mines) {
        list.add(d.mines.trim());
      }
    });
    return Array.from(list).sort();
  }, [doRecords]);

  // Search & Filters
  const filteredRecords = useMemo(() => {
    const safeRecords = records || [];
    return safeRecords.filter(r => {
      if (!r) return false;
      const matchedDO = doRecords.find(d => d.doNo === r.doNo);
      const ocpName = matchedDO ? matchedDO.mines : '';

      const matchesSearch = 
        r.billNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.doNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        (ocpName && ocpName.toUpperCase().includes(searchQuery.toUpperCase())) ||
        (r.remarks && r.remarks.toUpperCase().includes(searchQuery.toUpperCase()));
        
      const matchesDO = doNoFilter === 'All' || r.doNo === doNoFilter;
      const matchesOCP = ocpFilter === 'All' || (ocpName && ocpName.trim().toLowerCase() === ocpFilter.trim().toLowerCase());
      
      return matchesSearch && matchesDO && matchesOCP;
    });
  }, [records, doRecords, searchQuery, doNoFilter, ocpFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Stats
  const stats = useMemo(() => {
    const safeRecords = records || [];
    const totalCount = safeRecords.length;
    const totalBilled = safeRecords.reduce((acc, r) => acc + (r ? Number(r.billAmount) : 0), 0);
    const totalAdvance = safeRecords.reduce((acc, r) => acc + (r ? Number(r.advancePaid) : 0), 0);
    const totalPayable = safeRecords.reduce((acc, r) => acc + (r ? Number(r.finalPayable) : 0), 0);
    
    return { totalCount, totalBilled, totalAdvance, totalPayable };
  }, [records]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    if (doRecords.length === 0) {
      setToast({ message: "Please configure DO Master first!", type: 'error' });
      return;
    }

    setEditingRecord(null);
    setForm({
      doNo: doRecords[0]?.doNo || '',
      billNo: '',
      billDate: '',
      billQty: '',
      billAmount: '',
      tds: '',
      advancePaid: '',
      finalPayable: '0',
      remarks: ''
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (record: BillingPaymentRecord) => {
    setEditingRecord(record);
    setForm({
      doNo: record.doNo,
      billNo: record.billNo,
      billDate: record.billDate || '',
      billQty: String(record.billQty),
      billAmount: String(record.billAmount),
      tds: String(record.tds),
      advancePaid: String(record.advancePaid),
      finalPayable: String(record.finalPayable),
      remarks: record.remarks || ''
    });
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doNo || !form.billNo || !form.billAmount) {
      setToast({ message: "Please fill in all required fields (DO No, Bill No, Bill Amount)!", type: 'error' });
      return;
    }

    const recordData = {
      id: editingRecord ? editingRecord.id : undefined,
      doNo: form.doNo,
      billNo: form.billNo.toUpperCase().trim(),
      billDate: form.billDate,
      billQty: parseFloat(form.billQty) || 0,
      billAmount: parseFloat(form.billAmount) || 0,
      tds: parseFloat(form.tds) || 0,
      advancePaid: parseFloat(form.advancePaid) || 0,
      finalPayable: parseFloat(form.finalPayable) || 0,
      remarks: form.remarks.trim()
    };

    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch('/api/coal-rcr/billing-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(recordData)
      });

      if (!response.ok) {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to save Billing record.", type: 'error' });
        return;
      }

      const res = await response.json();
      if (res.success) {
        setIsModalOpen(false);
        setToast({ message: "Billing record saved successfully.", type: 'success' });
        fetchData();
      }
    } catch (error) {
      console.error("Error saving Billing record:", error);
      setToast({ message: "An error occurred while saving the Billing record.", type: 'error' });
    }
  };

  // Delete Handler
  const executeSingleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch(`/api/coal-rcr/billing-payment?id=${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        setToast({ message: "Billing record successfully deleted.", type: 'success' });
        fetchData();
      } else {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to delete Billing record.", type: 'error' });
      }
    } catch (error) {
      console.error("Error deleting Billing record:", error);
      setToast({ message: "An error occurred while deleting the Billing record.", type: 'error' });
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
          const response = await fetch(`/api/coal-rcr/billing-payment?id=${id}`, {
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
        message: `Bulk delete completed: ${successCount} Billing records deleted, ${failCount} failed.`,
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
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Billing / Payment</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage commercial invoicing, TDS deductions, transporter advance tracking, and final settlements
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {user?.role?.endsWith('_ADMIN') && <SectionExcelImport sectionName="Billing & Payment" />}
          <SectionExcelExport sectionName="Billing & Payment" />
          <button
            onClick={handleOpenAdd}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Bill Entry
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
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Invoices</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalCount}</span>
            <span className="text-[10px] text-slate-400">bills logged</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Billed Amount</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">₹{stats.totalBilled.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">gross revenue</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Advances Paid</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-purple-600">₹{stats.totalAdvance.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">transporter advances</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Net Payable</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">₹{stats.totalPayable.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">outstanding balance</span>
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
            placeholder="Search by Bill No, DO No, Remarks..."
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
            <BadgeCent className="h-4.5 w-4.5 text-blue-600" /> Commercial Invoices ({filteredRecords.length})
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
          <table className="w-full text-left text-xs border-collapse">
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
                <th className="px-5 py-4">Bill No</th>
                <th className="px-5 py-4">DO No</th>
                <th className="px-5 py-4">Bill Date</th>
                <th className="px-5 py-4 text-right">Bill Qty (MT)</th>
                <th className="px-5 py-4 text-right">Bill Amount (₹)</th>
                <th className="px-5 py-4 text-right">TDS (₹)</th>
                <th className="px-5 py-4 text-right">Advance Paid (₹)</th>
                <th className="px-5 py-4 text-right font-bold">Final Payable (₹)</th>
                <th className="px-5 py-4">Remarks</th>
                <th className="px-5 py-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={isDeleteMode ? 12 : 11} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> Fetching billing logs...
                    </span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isDeleteMode ? 12 : 11} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No Billing / Payment records found.
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
                      {r.billNo}
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-slate-700">
                      {r.doNo}
                    </td>
                    <td className="px-5 py-4 font-semibold font-mono text-slate-600">{r.billDate || '—'}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right">{Number(r.billQty || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right font-semibold text-slate-700">{Number(r.billAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right text-red-600">{Number(r.tds || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right text-purple-600">{Number(r.advancePaid || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 font-mono text-right font-bold text-emerald-600 bg-emerald-50/10">₹{Number(r.finalPayable || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="px-5 py-4 text-slate-500 italic max-w-xs truncate">{r.remarks || '—'}</td>
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
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden animate-scale-up">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <BadgeCent className="h-4.5 w-4.5 text-blue-600" />
                {editingRecord ? 'Edit Billing Invoice' : 'Add Billing Invoice'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-4">
                {/* DO No */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">DO Number <span className="text-red-500">*</span></label>
                  <select
                    required
                    value={form.doNo}
                    onChange={(e) => setForm({ ...form, doNo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-bold focus:outline-none cursor-pointer"
                  >
                    {doRecords.map(d => (
                      <option key={d.id} value={d.doNo}>{d.doNo}</option>
                    ))}
                  </select>
                </div>

                {/* Bill No */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Bill Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.billNo}
                    onChange={(e) => setForm({ ...form, billNo: e.target.value })}
                    placeholder="e.g. INVOICE-4019"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500/50 uppercase font-mono font-semibold"
                  />
                </div>

                {/* Bill Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Bill Date</label>
                  <input
                    type="date"
                    value={form.billDate}
                    onChange={(e) => setForm({ ...form, billDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none font-mono cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 border-y border-slate-100 py-4">
                {/* Bill Qty */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Bill Qty (MT)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.billQty}
                    onChange={(e) => setForm({ ...form, billQty: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* Bill Amount */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Bill Amount (₹) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    value={form.billAmount}
                    onChange={(e) => handleInputChange('billAmount', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono font-bold"
                  />
                </div>

                {/* TDS */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">TDS Deduction (₹)</label>
                  <input
                    type="number"
                    value={form.tds}
                    onChange={(e) => handleInputChange('tds', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono text-red-600"
                  />
                </div>

                {/* Advance Paid */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Advance Paid (₹)</label>
                  <input
                    type="number"
                    value={form.advancePaid}
                    onChange={(e) => handleInputChange('advancePaid', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono text-purple-600"
                  />
                </div>
              </div>

              {/* Final Payable */}
              <div className="space-y-1 max-w-xs mx-auto text-center">
                <label className="font-bold text-slate-500 uppercase tracking-wider text-emerald-600 block">Final Payable Net Amount</label>
                <input
                  type="text"
                  readOnly
                  value={`₹ ${(parseFloat(form.finalPayable) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  className="w-full bg-emerald-50 border border-emerald-200 rounded-2xl py-3.5 text-center text-emerald-700 font-extrabold text-lg focus:outline-none font-mono cursor-not-allowed shadow-inner"
                />
              </div>

              {/* Remarks */}
              <div className="space-y-1">
                <label className="font-bold text-slate-500 uppercase tracking-wider">Remarks</label>
                <input
                  type="text"
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  placeholder="Billing comments / terms"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none"
                />
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
