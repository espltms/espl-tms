'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  FileText, 
  Plus, 
  Search, 
  X, 
  RefreshCw, 
  Edit2, 
  Trash2, 
  Hourglass,
  Calendar,
  Layers,
  Database,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { fetchSyncedValue, saveSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import SectionExcelImport from '@/components/SectionExcelImport';
import SectionExcelExport from '@/components/SectionExcelExport';
import { DOMasterRecord } from '../types';

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

export default function DOMasterPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<DOMasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DOMasterRecord | null>(null);
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Form states
  const [form, setForm] = useState({
    doNo: '',
    poNo: '',
    siding: '',
    mines: '',
    coalCompany: '',
    doQty: '',
    coalType: 'ROM',
    startDate: '',
    endDate: '',
    status: 'Active' as DOMasterRecord['status']
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch('/api/coal-rcr/do-master', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const res = await response.json();
        if (res.success) {
          setRecords(res.data || []);
          localStorage.setItem(DO_MASTER_KEY, JSON.stringify(res.data || []));
        } else {
          throw new Error(res.error || 'Fetch failed');
        }
      } else {
        const local = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
        setRecords(local || []);
      }
    } catch (e) {
      console.error("Error fetching DO records:", e);
      const local = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
      setRecords(local || []);
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
      if (!detail || detail.sectionName !== 'DO Master') return;

      setLoading(true);
      const token = localStorage.getItem('tms_token');
      let successCount = 0;
      let errorCount = 0;

      const batchSize = 15;
      const rows = detail.import.rows;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await Promise.all(batch.map(async (row) => {
          const doNo = getCellValue(detail.import.headers, row, ['do no', 'do number', 'do_no', 'do_number', 'delivery order no', 'delivery order number']).toUpperCase().trim();
          const poNo = getCellValue(detail.import.headers, row, ['po no', 'po number', 'po_no', 'po_number', 'purchase order no', 'purchase order number']).toUpperCase().trim();
          const siding = getCellValue(detail.import.headers, row, ['siding', 'siding name']).trim();
          const mines = getCellValue(detail.import.headers, row, ['mines', 'mine name', 'mine']).trim();
          const coalCompany = getCellValue(detail.import.headers, row, ['coal company', 'coal_company', 'company']).trim();
          const doQtyStr = getCellValue(detail.import.headers, row, ['do qty', 'do quantity', 'quantity', 'qty', 'do_qty']);
          const coalTypeRaw = getCellValue(detail.import.headers, row, ['coal type', 'coal_type']).trim();
          const startDateStr = getCellValue(detail.import.headers, row, ['start date', 'start_date', 'validity start']);
          const endDateStr = getCellValue(detail.import.headers, row, ['end date', 'end_date', 'validity end']);
          const statusRaw = getCellValue(detail.import.headers, row, ['status']).trim();

          if (!doNo || !poNo || !siding || !doQtyStr) {
            errorCount++;
            return;
          }

          const doQty = parseFloat(doQtyStr) || 0;
          const startDate = parseDateToYYYYMMDD(startDateStr);
          const endDate = parseDateToYYYYMMDD(endDateStr);

          let coalType = 'ROM';
          if (['ROM', 'Slack', 'Steam', 'Washed'].some(t => t.toLowerCase() === coalTypeRaw.toLowerCase())) {
            coalType = coalTypeRaw.toUpperCase() === 'ROM' ? 'ROM' : coalTypeRaw.charAt(0).toUpperCase() + coalTypeRaw.slice(1).toLowerCase();
          }

          let status = 'Active';
          if (['Active', 'Completed', 'Cancelled'].some(s => s.toLowerCase() === statusRaw.toLowerCase())) {
            status = statusRaw.charAt(0).toUpperCase() + statusRaw.slice(1).toLowerCase();
          }

          const recordData = {
            doNo,
            poNo,
            siding,
            mines: mines || null,
            coalCompany: coalCompany || null,
            doQty,
            coalType,
            startDate: startDate || null,
            endDate: endDate || null,
            status
          };

          try {
            const response = await fetch('/api/coal-rcr/do-master', {
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
            console.error("Error importing DO row:", error);
            errorCount++;
          }
        }));
      }

      setToast({
        message: `Excel Import completed: ${successCount} DO records successfully imported, ${errorCount} failed/skipped.`,
        type: errorCount > 0 ? 'info' : 'success'
      });
      fetchData();
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, [records]);

  // Search & Filters
  const filteredRecords = useMemo(() => {
    const safeRecords = records || [];
    return safeRecords.filter(r => {
      if (!r) return false;
      const matchesSearch = 
        r.doNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.poNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.siding.toUpperCase().includes(searchQuery.toUpperCase()) ||
        (r.mines && r.mines.toUpperCase().includes(searchQuery.toUpperCase())) ||
        (r.coalCompany && r.coalCompany.toUpperCase().includes(searchQuery.toUpperCase()));
        
      const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Stats
  const stats = useMemo(() => {
    const safeRecords = records || [];
    const totalCount = safeRecords.length;
    const activeCount = safeRecords.filter(r => r && r.status === 'Active').length;
    const totalQty = safeRecords.reduce((acc, r) => acc + (r ? Number(r.doQty) : 0), 0);
    const activeQty = safeRecords.filter(r => r && r.status === 'Active').reduce((acc, r) => acc + (r ? Number(r.doQty) : 0), 0);
    
    return { totalCount, activeCount, totalQty, activeQty };
  }, [records]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    setEditingRecord(null);
    setForm({
      doNo: '',
      poNo: '',
      siding: '',
      mines: '',
      coalCompany: '',
      doQty: '',
      coalType: 'ROM',
      startDate: '',
      endDate: '',
      status: 'Active'
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (record: DOMasterRecord) => {
    setEditingRecord(record);
    setForm({
      doNo: record.doNo,
      poNo: record.poNo,
      siding: record.siding,
      mines: record.mines || '',
      coalCompany: record.coalCompany || '',
      doQty: String(record.doQty),
      coalType: record.coalType,
      startDate: record.startDate || '',
      endDate: record.endDate || '',
      status: record.status
    });
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doNo || !form.poNo || !form.siding || !form.doQty) {
      alert("Please fill in all required fields (DO No, PO No, Siding, DO Qty)");
      return;
    }

    const recordData = {
      id: editingRecord ? editingRecord.id : undefined,
      doNo: form.doNo.toUpperCase().trim(),
      poNo: form.poNo.toUpperCase().trim(),
      siding: form.siding.trim(),
      mines: form.mines.trim(),
      coalCompany: form.coalCompany.trim(),
      doQty: parseFloat(form.doQty) || 0,
      coalType: form.coalType,
      startDate: form.startDate,
      endDate: form.endDate,
      status: form.status
    };

    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch('/api/coal-rcr/do-master', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(recordData)
      });

      if (!response.ok) {
        const errData = await response.json();
        alert(errData.error || "Failed to save DO record.");
        return;
      }

      const res = await response.json();
      if (res.success) {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Error saving DO record:", error);
      alert("An error occurred while saving the DO record.");
    }
  };

  // Delete Handler
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this DO record?")) return;
    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch(`/api/coal-rcr/do-master?id=${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const errData = await response.json();
        alert(errData.error || "Failed to delete DO record.");
        return;
      }
      fetchData();
    } catch (error) {
      console.error("Error deleting DO record:", error);
      alert("An error occurred while deleting the DO record.");
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Are you sure you want to delete these ${selectedIds.length} DO records?`)) return;
    setLoading(true);
    const token = localStorage.getItem('tms_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(selectedIds.map(async (id) => {
        try {
          const response = await fetch(`/api/coal-rcr/do-master?id=${id}`, {
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
      alert(`Bulk delete completed: ${successCount} DO records deleted, ${failCount} failed.`);
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
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">DO Master</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track and configure Delivery Orders, contract parameters, sourcing mines, and lifted allocations
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {user?.role?.endsWith('_ADMIN') && <SectionExcelImport sectionName="DO Master" />}
          <SectionExcelExport sectionName="DO Master" />
          <button
            onClick={handleOpenAdd}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Delivery Order
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

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total DO Registered</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalCount}</span>
            <span className="text-[10px] text-slate-400">records</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active DOs</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">{stats.activeCount}</span>
            <span className="text-[10px] text-blue-500 font-semibold">in progress</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total DO Allocation</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalQty.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">Metric Tons</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Allocation</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">{stats.activeQty.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">MT pending</span>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder="Search by DO No, PO No, Mines, Siding..."
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
          <span className="text-xs text-slate-400 font-semibold font-sans">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 font-bold font-sans focus:outline-none focus:border-blue-500/50 transition-colors cursor-pointer"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-blue-600" /> DO Registries ({filteredRecords.length})
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
                <th className="px-5 py-4">DO No</th>
                <th className="px-5 py-4">PO No</th>
                <th className="px-5 py-4">Siding</th>
                <th className="px-5 py-4">Mines</th>
                <th className="px-5 py-4">Coal Company</th>
                <th className="px-5 py-4 text-right">DO Qty (MT)</th>
                <th className="px-5 py-4">Coal Type</th>
                <th className="px-5 py-4">Validity</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={isDeleteMode ? 12 : 11} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> Fetching delivery orders...
                    </span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isDeleteMode ? 12 : 11} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No DO records found.
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
                      {r.doNo}
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-slate-700">
                      {r.poNo}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{r.siding}</td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{r.mines}</td>
                    <td className="px-5 py-4 font-semibold text-slate-700">{r.coalCompany}</td>
                    <td className="px-5 py-4 font-mono font-bold text-slate-800 text-right">
                      {r.doQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-5 py-4 font-semibold">{r.coalType}</td>
                    <td className="px-5 py-4 text-slate-500 whitespace-nowrap">
                      {r.startDate && r.endDate ? (
                        <div className="flex items-center gap-1.5 font-mono text-[10px]">
                          <span>{r.startDate}</span>
                          <span className="text-slate-300">to</span>
                          <span>{r.endDate}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${
                        r.status === 'Active' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : r.status === 'Completed'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                      }`}>
                        {r.status}
                      </span>
                    </td>
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

        {/* Pagination Pane */}
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
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-xl overflow-hidden animate-scale-up">
            <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-blue-600" />
                {editingRecord ? 'Edit Delivery Order' : 'Add Delivery Order'}
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
                  <input
                    type="text"
                    required
                    value={form.doNo}
                    onChange={(e) => setForm({ ...form, doNo: e.target.value })}
                    placeholder="e.g. DO-2026-1002"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500/50 uppercase font-mono font-semibold"
                  />
                </div>

                {/* PO No */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">PO Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.poNo}
                    onChange={(e) => setForm({ ...form, poNo: e.target.value })}
                    placeholder="e.g. PO-VAL-2026-01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500/50 uppercase font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Siding */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Siding <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.siding}
                    onChange={(e) => setForm({ ...form, siding: e.target.value })}
                    placeholder="e.g. Paramanandpur Siding"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                {/* Mines */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Mines</label>
                  <input
                    type="text"
                    value={form.mines}
                    onChange={(e) => setForm({ ...form, mines: e.target.value })}
                    placeholder="e.g. Lajkura OCP"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                {/* Coal Company */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Coal Company</label>
                  <input
                    type="text"
                    value={form.coalCompany}
                    onChange={(e) => setForm({ ...form, coalCompany: e.target.value })}
                    placeholder="e.g. MCL"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* DO Quantity */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">DO Quantity (MT) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.doQty}
                    onChange={(e) => setForm({ ...form, doQty: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* Coal Type */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Coal Type</label>
                  <select
                    value={form.coalType}
                    onChange={(e) => setForm({ ...form, coalType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="ROM">ROM (Run of Mine)</option>
                    <option value="Slack">Slack</option>
                    <option value="Steam">Steam</option>
                    <option value="Washed">Washed</option>
                  </select>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Start Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Start Date</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none font-mono cursor-pointer"
                  />
                </div>

                {/* End Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> End Date</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none font-mono cursor-pointer"
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
              {toast.type === 'success' ? 'Import Succeeded' : toast.type === 'error' ? 'Import Failed' : 'Import Status'}
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
