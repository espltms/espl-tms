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
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Info,
  Truck,
  Scale
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import SectionExcelImport from '@/components/SectionExcelImport';
import SectionExcelExport from '@/components/SectionExcelExport';
import { fetchSyncedValue, saveSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { DOLiftingRecord } from '../types';

const DO_LIFTING_KEY = 'tms_coal_do_lifting';
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

export default function DOLiftingPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<DOLiftingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [ocpFilter, setOcpFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DOLiftingRecord | null>(null);
  
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
    ocp: '',
    customer: '',
    passNo: '',
    passDate: '',
    truckNo: '',
    mineralQty: ''
  });

  // Fetch data
  const fetchData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true);
    }
    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch('/api/coal-rcr/do-lifting', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const res = await response.json();
        if (res.success) {
          setRecords(res.data || []);
          localStorage.setItem(DO_LIFTING_KEY, JSON.stringify(res.data || []));
        } else {
          throw new Error(res.error || 'Fetch failed');
        }
      } else {
        const local = readLocalValue<DOLiftingRecord[]>(DO_LIFTING_KEY, []);
        setRecords(local || []);
      }
    } catch (e) {
      console.error("Error fetching DO Lifting records:", e);
      const local = readLocalValue<DOLiftingRecord[]>(DO_LIFTING_KEY, []);
      setRecords(local || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const local = readLocalValue<DOLiftingRecord[]>(DO_LIFTING_KEY, []);
    const hasCache = local && local.length > 0;
    if (hasCache) {
      setRecords(local);
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
      if (!detail || detail.sectionName !== 'DO Lifting') return;

      setLoading(true);
      const token = localStorage.getItem('tms_token');
      const rows = detail.import.rows;
      const recordsToImport: any[] = [];
      let skippedCount = 0;

      rows.forEach((row) => {
        const doNo = getCellValue(detail.import.headers, row, ['do no', 'do number', 'do_no', 'do_number', 'delivery order no', 'delivery order number']).toUpperCase().trim();
        const ocp = getCellValue(detail.import.headers, row, ['ocp', 'mines', 'mine name', 'mine']).trim();
        const customer = getCellValue(detail.import.headers, row, ['customer', 'client', 'buyer', 'customer name']).trim();
        const passNo = getCellValue(detail.import.headers, row, ['pass no', 'pass number', 'pass_no', 'pass_number', 'gp no', 'gate pass']).toUpperCase().trim();
        const passDateStr = getCellValue(detail.import.headers, row, ['pass date', 'pass_date', 'date']).trim();
        const truckNo = getCellValue(detail.import.headers, row, ['truck no', 'truck number', 'truck_no', 'truck_number', 'vehicle no', 'vehicle number']).toUpperCase().trim();
        const mineralQtyStr = getCellValue(detail.import.headers, row, ['mineral qty', 'mineral quantity', 'mineral_qty', 'qty', 'quantity']);

        if (!doNo || !passNo || !truckNo || !mineralQtyStr) {
          skippedCount++;
          return;
        }

        const mineralQty = parseFloat(mineralQtyStr) || 0;
        const passDate = parseDateToYYYYMMDD(passDateStr);

        recordsToImport.push({
          doNo,
          ocp: ocp || null,
          customer: customer || null,
          passNo,
          passDate: passDate || null,
          truckNo,
          mineralQty
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
        const response = await fetch('/api/coal-rcr/do-lifting', {
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
        console.error("Error importing DO Lifting records:", error);
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

  // Unique list of OCPs/Mines for filtering
  const uniqueOCPs = useMemo(() => {
    const list = new Set<string>();
    const safeRecords = records || [];
    safeRecords.forEach(r => {
      if (r && r.ocp) {
        list.add(r.ocp.trim());
      }
    });
    return Array.from(list).sort();
  }, [records]);

  // Search & Filters
  const filteredRecords = useMemo(() => {
    const safeRecords = records || [];
    return safeRecords.filter(r => {
      if (!r) return false;
      const matchesSearch =
        r.doNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        (r.ocp && r.ocp.toUpperCase().includes(searchQuery.toUpperCase())) ||
        (r.customer && r.customer.toUpperCase().includes(searchQuery.toUpperCase())) ||
        r.passNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.truckNo.toUpperCase().includes(searchQuery.toUpperCase());
        
      const matchesOCP = ocpFilter === 'All' || (r.ocp && r.ocp.trim().toLowerCase() === ocpFilter.trim().toLowerCase());
      
      return matchesSearch && matchesOCP;
    });
  }, [records, searchQuery, ocpFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    return filteredRecords.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Stats
  const stats = useMemo(() => {
    const safeRecords = filteredRecords || [];
    const totalQty = safeRecords.reduce((acc, r) => acc + (r ? Number(r.mineralQty) : 0), 0);
    
    // Unique trucks
    const truckSet = new Set<string>();
    safeRecords.forEach(r => {
      if (r && r.truckNo) {
        truckSet.add(r.truckNo.trim().toUpperCase());
      }
    });
    const uniqueTrucksCount = truckSet.size;
    const avgPayload = safeRecords.length > 0 ? totalQty / safeRecords.length : 0;
    
    return { totalQty, uniqueTrucksCount, avgPayload, totalRecords: safeRecords.length };
  }, [filteredRecords]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    setEditingRecord(null);
    setForm({
      doNo: '',
      ocp: '',
      customer: '',
      passNo: '',
      passDate: '',
      truckNo: '',
      mineralQty: ''
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (record: DOLiftingRecord) => {
    setEditingRecord(record);
    setForm({
      doNo: record.doNo,
      ocp: record.ocp || '',
      customer: record.customer || '',
      passNo: record.passNo,
      passDate: record.passDate || '',
      truckNo: record.truckNo,
      mineralQty: String(record.mineralQty)
    });
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doNo || !form.passNo || !form.truckNo || !form.mineralQty) {
      setToast({ message: "Please fill in all required fields (DO No, Pass No, Truck No, Mineral Qty)", type: 'error' });
      return;
    }

    const recordData = {
      id: editingRecord ? editingRecord.id : undefined,
      doNo: form.doNo.toUpperCase().trim(),
      ocp: form.ocp ? form.ocp.trim() : null,
      customer: form.customer ? form.customer.trim() : null,
      passNo: form.passNo.toUpperCase().trim(),
      passDate: form.passDate || null,
      truckNo: form.truckNo.toUpperCase().trim(),
      mineralQty: parseFloat(form.mineralQty) || 0
    };

    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch('/api/coal-rcr/do-lifting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(recordData)
      });

      if (!response.ok) {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to save DO Lifting record.", type: 'error' });
        return;
      }

      const res = await response.json();
      if (res.success) {
        setIsModalOpen(false);
        fetchData();
        setToast({ message: "Lifting record saved successfully.", type: 'success' });
      }
    } catch (error) {
      console.error("Error saving DO Lifting record:", error);
      setToast({ message: "An error occurred while saving the DO Lifting record.", type: 'error' });
    }
  };

  // Delete Handlers
  const executeSingleDelete = async (id: string) => {
    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch(`/api/coal-rcr/do-lifting?id=${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        setToast({ message: "DO Lifting record successfully deleted.", type: 'success' });
        fetchData();
      } else {
        const errData = await response.json();
        setToast({ message: errData.error || "Failed to delete DO Lifting record.", type: 'error' });
      }
    } catch (error) {
      console.error("Error deleting DO Lifting record:", error);
      setToast({ message: "An error occurred while deleting the DO Lifting record.", type: 'error' });
    }
  };

  const executeBulkDelete = async (ids: string[]) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('tms_token');
      let successCount = 0;
      let failCount = 0;

      await Promise.all(ids.map(async (id) => {
        const response = await fetch(`/api/coal-rcr/do-lifting?id=${id}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.ok) {
          successCount++;
        } else {
          failCount++;
        }
      }));

      setToast({
        message: `Bulk delete completed: ${successCount} records deleted, ${failCount} failed.`,
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
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">DO Lifting</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track coal dispatches via road lifting, gate pass transactions, vehicle dispatches and mineral payloads
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {user?.role?.endsWith('_ADMIN') && <SectionExcelImport sectionName="DO Lifting" />}
          <SectionExcelExport sectionName="DO Lifting" />
          <button
            onClick={handleOpenAdd}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Lifting Log
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

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Mineral Lifted</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalQty.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-slate-400">Metric Tons</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Dispatched Vehicles</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">{stats.uniqueTrucksCount}</span>
            <span className="text-[10px] text-blue-500 font-semibold">unique trucks</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Payload / Truck</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-700">{stats.avgPayload.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
            <span className="text-[10px] text-slate-400">MT per trip</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Lift Logs</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalRecords}</span>
            <span className="text-[10px] text-slate-400">records</span>
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
            placeholder="Search by DO No, Customer, Pass No, Truck No..."
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
        </div>
      </div>

      {/* Table grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-blue-600" /> DO Lifting Logs ({filteredRecords.length})
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
                      checked={selectedIds.length === paginatedRecords.length && paginatedRecords.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const newSelections = Array.from(new Set([...selectedIds, ...paginatedRecords.map(r => r.id)]));
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
                <th className="px-5 py-4">OCP</th>
                <th className="px-5 py-4">Customer</th>
                <th className="px-5 py-4">Pass No</th>
                <th className="px-5 py-4">Pass Date</th>
                <th className="px-5 py-4">Truck No</th>
                <th className="px-5 py-4 text-right">Mineral Qty (MT)</th>
                <th className="px-5 py-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={isDeleteMode ? 10 : 9} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> Fetching lifting logs...
                    </span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isDeleteMode ? 10 : 9} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No DO lifting records found.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => {
                  return (
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
                      <td className="px-5 py-4 font-semibold text-slate-700 whitespace-nowrap">
                        {r.ocp || '—'}
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-700">
                        {r.customer || '—'}
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-700">
                        {r.passNo}
                      </td>
                      <td className="px-5 py-4 font-mono text-slate-500 text-[10px] whitespace-nowrap">
                        {r.passDate || '—'}
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-800 uppercase tracking-wider whitespace-nowrap">
                        {r.truckNo}
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-800 text-right">
                        {Number(r.mineralQty).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
                  );
                })
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
                {editingRecord ? 'Edit Lifting Log' : 'Add Lifting Log'}
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

                {/* OCP */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">OCP / Mine</label>
                  <input
                    type="text"
                    value={form.ocp}
                    onChange={(e) => setForm({ ...form, ocp: e.target.value })}
                    placeholder="e.g. Lajkura OCP"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Customer */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Customer Name</label>
                  <input
                    type="text"
                    value={form.customer}
                    onChange={(e) => setForm({ ...form, customer: e.target.value })}
                    placeholder="e.g. Vedanta Ltd"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                {/* Pass No */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Pass Number <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.passNo}
                    onChange={(e) => setForm({ ...form, passNo: e.target.value })}
                    placeholder="e.g. GP-554012"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none uppercase font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* Pass Date */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Pass Date</label>
                  <input
                    type="date"
                    value={form.passDate}
                    onChange={(e) => setForm({ ...form, passDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none font-mono cursor-pointer"
                  />
                </div>

                {/* Truck No */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Truck className="h-3.5 w-3.5 text-slate-400" /> Truck No <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={form.truckNo}
                    onChange={(e) => setForm({ ...form, truckNo: e.target.value })}
                    placeholder="e.g. OR-09-C-1234"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none uppercase font-mono font-semibold"
                  />
                </div>

                {/* Mineral Qty */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1"><Scale className="h-3.5 w-3.5 text-slate-400" /> Mineral Qty (MT) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.mineralQty}
                    onChange={(e) => setForm({ ...form, mineralQty: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
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
