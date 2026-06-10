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
  FileText
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
  
  // Form states
  const [form, setForm] = useState({
    doNo: '',
    siding: '',
    rrNo: '',
    rrDate: '',
    loadingDate: '',
    receiptDate: '',
    rrActQty: '',
    rrChQty: '',
    vllQty: '',
    grnQty: '',
    normalisedQty: ''
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
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
    fetchData();
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
      let successCount = 0;
      let errorCount = 0;

      for (const row of detail.import.rows) {
        const doNo = getCellValue(detail.import.headers, row, ['do no', 'do number', 'do_no']).toUpperCase().trim();
        const rrNo = getCellValue(detail.import.headers, row, ['rr no', 'rr number', 'rr_no', 'railway receipt']).toUpperCase().trim();
        let siding = getCellValue(detail.import.headers, row, ['siding', 'siding name']).trim();
        const rrDateStr = getCellValue(detail.import.headers, row, ['rr date', 'rr_date']);
        const loadingDateStr = getCellValue(detail.import.headers, row, ['loading date', 'loading_date']);
        const receiptDateStr = getCellValue(detail.import.headers, row, ['receipt date', 'receipt_date']);
        const rrActQtyStr = getCellValue(detail.import.headers, row, ['rr act qty', 'rr actual quantity', 'actual quantity', 'rr_act_qty']);
        const rrChQtyStr = getCellValue(detail.import.headers, row, ['rr ch qty', 'rr challan qty', 'challan qty', 'rr_ch_qty']);
        const vllQtyStr = getCellValue(detail.import.headers, row, ['vll qty', 'vll quantity', 'vll', 'vll_qty']);
        const grnQtyStr = getCellValue(detail.import.headers, row, ['grn qty', 'grn quantity', 'grn', 'grn_qty']);
        const normalisedQtyStr = getCellValue(detail.import.headers, row, ['normalised qty', 'normalized qty', 'normalised_qty']);

        if (!doNo || !rrNo || !grnQtyStr) {
          errorCount++;
          continue;
        }

        if (!siding) {
          const matchedDO = doRecords.find(d => d.doNo.toUpperCase().trim() === doNo);
          siding = matchedDO ? matchedDO.siding : '';
        }

        const grnQty = parseFloat(grnQtyStr) || 0;
        const normalisedQty = parseFloat(normalisedQtyStr !== '' ? normalisedQtyStr : grnQtyStr) || 0;

        const recordData = {
          doNo,
          siding,
          rrNo,
          rrDate: parseDateToYYYYMMDD(rrDateStr) || null,
          loadingDate: parseDateToYYYYMMDD(loadingDateStr) || null,
          receiptDate: parseDateToYYYYMMDD(receiptDateStr) || null,
          rrActQty: parseFloat(rrActQtyStr) || 0,
          rrChQty: parseFloat(rrChQtyStr) || 0,
          vllQty: parseFloat(vllQtyStr) || 0,
          grnQty,
          normalisedQty
        };

        try {
          const response = await fetch('/api/coal-rcr/rr-entry', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify(recordData)
          });
          if (response.ok) {
            successCount++;
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error("Error importing RR row:", error);
          errorCount++;
        }
      }

      alert(`Excel Import completed: ${successCount} RR records successfully imported, ${errorCount} failed/skipped.`);
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
      siding: matchedDO ? matchedDO.siding : ''
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

  // Search & Filters
  const filteredRecords = useMemo(() => {
    const safeRecords = records || [];
    return safeRecords.filter(r => {
      if (!r) return false;
      const matchesSearch = 
        r.rrNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.doNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.siding.toUpperCase().includes(searchQuery.toUpperCase());
        
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
      alert("Please add at least one Delivery Order in the DO Master before creating an RR Entry!");
      return;
    }
    setEditingRecord(null);
    setForm({
      doNo: doRecords[0]?.doNo || '',
      siding: doRecords[0]?.siding || '',
      rrNo: '',
      rrDate: '',
      loadingDate: '',
      receiptDate: '',
      rrActQty: '',
      rrChQty: '',
      vllQty: '',
      grnQty: '',
      normalisedQty: ''
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (record: RREntryRecord) => {
    setEditingRecord(record);
    setForm({
      doNo: record.doNo,
      siding: record.siding,
      rrNo: record.rrNo,
      rrDate: record.rrDate || '',
      loadingDate: record.loadingDate || '',
      receiptDate: record.receiptDate || '',
      rrActQty: String(record.rrActQty),
      rrChQty: String(record.rrChQty),
      vllQty: String(record.vllQty),
      grnQty: String(record.grnQty),
      normalisedQty: String(record.normalisedQty)
    });
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doNo || !form.rrNo || !form.grnQty) {
      alert("Please fill in all required fields (DO No, RR No, GRN Qty)");
      return;
    }

    const recordData = {
      id: editingRecord ? editingRecord.id : undefined,
      doNo: form.doNo,
      siding: form.siding.trim(),
      rrNo: form.rrNo.toUpperCase().trim(),
      rrDate: form.rrDate,
      loadingDate: form.loadingDate,
      receiptDate: form.receiptDate,
      rrActQty: parseFloat(form.rrActQty) || 0,
      rrChQty: parseFloat(form.rrChQty) || 0,
      vllQty: parseFloat(form.vllQty) || 0,
      grnQty: parseFloat(form.grnQty) || 0,
      normalisedQty: parseFloat(form.normalisedQty !== undefined && form.normalisedQty !== '' ? form.normalisedQty : form.grnQty) || 0
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
        alert(errData.error || "Failed to save RR record.");
        return;
      }

      const res = await response.json();
      if (res.success) {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Error saving RR record:", error);
      alert("An error occurred while saving the RR record.");
    }
  };

  // Delete Handler
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this RR Entry?")) return;
    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch(`/api/coal-rcr/rr-entry?id=${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const errData = await response.json();
        alert(errData.error || "Failed to delete RR record.");
        return;
      }
      fetchData();
    } catch (error) {
      console.error("Error deleting RR record:", error);
      alert("An error occurred while deleting the RR record.");
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Are you sure you want to delete these ${selectedIds.length} RR records?`)) return;
    setLoading(true);
    const token = localStorage.getItem('tms_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(selectedIds.map(async (id) => {
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
      alert(`Bulk delete completed: ${successCount} RR records deleted, ${failCount} failed.`);
      setSelectedIds([]);
      setIsDeleteMode(false);
      fetchData();
    } catch (error) {
      console.error("Error in bulk delete:", error);
      alert("An error occurred during bulk delete.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-700">
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
            onClick={fetchData}
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
                      onClick={deleteSelected}
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
                <th className="px-5 py-4">RR No</th>
                <th className="px-5 py-4">DO No</th>
                <th className="px-5 py-4">Siding</th>
                <th className="px-5 py-4">RR Date</th>
                <th className="px-5 py-4 text-right">RR Act Qty</th>
                <th className="px-5 py-4 text-right">RR CH Qty</th>
                <th className="px-5 py-4 text-right">VLL Qty</th>
                <th className="px-5 py-4 text-right">GRN Qty</th>
                <th className="px-5 py-4 text-right">Normalised Qty</th>
                <th className="px-5 py-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={isDeleteMode ? 12 : 11} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> Fetching railway receipts...
                    </span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isDeleteMode ? 12 : 11} className="px-6 py-12 text-center text-slate-400 font-bold">
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
                    <td className="px-5 py-4 font-mono font-bold text-slate-700">
                      {r.doNo}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{r.siding}</td>
                    <td className="px-5 py-4 font-semibold font-mono text-slate-600">{r.rrDate || '—'}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right">{Number(r.rrActQty || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right">{Number(r.rrChQty || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right">{Number(r.vllQty || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right font-bold text-blue-600">{Number(r.grnQty || 0).toFixed(2)}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right font-bold text-emerald-600">{Number(r.normalisedQty || 0).toFixed(2)}</td>
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
                <ClipboardList className="h-4.5 w-4.5 text-blue-600" />
                {editingRecord ? 'Edit RR Receipt Record' : 'Add RR Receipt Record'}
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
                {/* DO No Dropdown */}
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

                {/* Siding (read-only/auto-filled) */}
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

                {/* RR No */}
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
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* RR Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> RR Date</label>
                  <input
                    type="date"
                    value={form.rrDate}
                    onChange={(e) => setForm({ ...form, rrDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none font-mono cursor-pointer"
                  />
                </div>

                {/* Loading Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Loading Date</label>
                  <input
                    type="date"
                    value={form.loadingDate}
                    onChange={(e) => setForm({ ...form, loadingDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none font-mono cursor-pointer"
                  />
                </div>

                {/* Receipt Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Receipt Date</label>
                  <input
                    type="date"
                    value={form.receiptDate}
                    onChange={(e) => setForm({ ...form, receiptDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none font-mono cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {/* RR Act Qty */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">RR Act Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.rrActQty}
                    onChange={(e) => setForm({ ...form, rrActQty: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* RR CH Qty */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">RR CH Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.rrChQty}
                    onChange={(e) => setForm({ ...form, rrChQty: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* VLL Qty */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">VLL Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.vllQty}
                    onChange={(e) => setForm({ ...form, vllQty: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* GRN Qty */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">GRN Qty <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.grnQty}
                    onChange={(e) => handleGRNChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* Normalised Qty */}
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
    </div>
  );
}
