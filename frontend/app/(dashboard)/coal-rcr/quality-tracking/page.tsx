'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  Activity, 
  Plus, 
  Search, 
  X, 
  RefreshCw, 
  Edit2, 
  Trash2, 
  Hourglass,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { fetchSyncedValue, saveSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { useAuthStore } from '@/store/auth.store';
import SectionExcelImport from '@/components/SectionExcelImport';
import SectionExcelExport from '@/components/SectionExcelExport';
import { DOMasterRecord, RREntryRecord, QualityTrackingRecord } from '../types';

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

export default function QualityTrackingPage() {
  const { user } = useAuthStore();
  const [records, setRecords] = useState<QualityTrackingRecord[]>([]);
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [rrRecords, setRrRecords] = useState<RREntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [doNoFilter, setDoNoFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<QualityTrackingRecord | null>(null);
  
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
    rrNo: '',
    tm: '',
    im: '',
    ash: '',
    vm: '',
    fc: '',
    gcvAdb: '',
    gcvArb: '',
    qualityPenalty: ''
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('tms_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [qRes, rrRes, doRes] = await Promise.all([
        fetch('/api/coal-rcr/quality-tracking', { headers }),
        fetch('/api/coal-rcr/rr-entry', { headers }),
        fetch('/api/coal-rcr/do-master', { headers })
      ]);

      if (qRes.ok && rrRes.ok && doRes.ok) {
        const qData = await qRes.json();
        const rrData = await rrRes.json();
        const doData = await doRes.json();

        if (qData.success && rrData.success && doData.success) {
          setRecords(qData.data || []);
          setRrRecords(rrData.data || []);
          setDoRecords(doData.data || []);
          localStorage.setItem(QUALITY_TRACKING_KEY, JSON.stringify(qData.data || []));
          localStorage.setItem(RR_ENTRY_KEY, JSON.stringify(rrData.data || []));
          localStorage.setItem(DO_MASTER_KEY, JSON.stringify(doData.data || []));
        }
      } else {
        const localQualities = readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []);
        const localRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
        const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
        setRecords(localQualities || []);
        setRrRecords(localRRs || []);
        setDoRecords(localDOs || []);
      }
    } catch (e) {
      console.error("Error fetching Quality records:", e);
      const localQualities = readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []);
      const localRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
      const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
      setRecords(localQualities || []);
      setRrRecords(localRRs || []);
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
      if (!detail || detail.sectionName !== 'Quality Tracking') return;

      setLoading(true);
      const token = localStorage.getItem('tms_token');
      let successCount = 0;
      let errorCount = 0;

      const batchSize = 15;
      const rows = detail.import.rows;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        await Promise.all(batch.map(async (row) => {
          const doNo = getCellValue(detail.import.headers, row, ['do no', 'do number', 'do_no']).toUpperCase().trim();
          const rrNo = getCellValue(detail.import.headers, row, ['rr no', 'rr number', 'rr_no', 'railway receipt']).toUpperCase().trim();
          const tmStr = getCellValue(detail.import.headers, row, ['tm', 'total moisture', 'tm %']);
          const imStr = getCellValue(detail.import.headers, row, ['im', 'inherent moisture', 'im %']);
          const ashStr = getCellValue(detail.import.headers, row, ['ash', 'ash %']);
          const vmStr = getCellValue(detail.import.headers, row, ['vm', 'volatile matter', 'vm %']);
          const fcStr = getCellValue(detail.import.headers, row, ['fc', 'fixed carbon', 'fc %']);
          const gcvAdbStr = getCellValue(detail.import.headers, row, ['gcv adb', 'gcv_adb', 'gcv adb Basis']);
          const gcvArbStr = getCellValue(detail.import.headers, row, ['gcv arb', 'gcv_arb']);
          const qualityPenaltyStr = getCellValue(detail.import.headers, row, ['quality penalty', 'penalty', 'quality_penalty']);

          if (!doNo || !rrNo) {
            errorCount++;
            return;
          }

          const recordData = {
            doNo,
            rrNo,
            tm: parseFloat(tmStr) || 0,
            im: parseFloat(imStr) || 0,
            ash: parseFloat(ashStr) || 0,
            vm: parseFloat(vmStr) || 0,
            fc: parseFloat(fcStr) || 0,
            gcvAdb: parseFloat(gcvAdbStr) || 0,
            gcvArb: parseFloat(gcvArbStr) || 0,
            qualityPenalty: parseFloat(qualityPenaltyStr) || 0
          };

          try {
            const response = await fetch('/api/coal-rcr/quality-tracking', {
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
            console.error("Error importing Quality row:", error);
            errorCount++;
          }
        }));
      }

      setToast({
        message: `Excel Import completed: ${successCount} Quality records successfully imported, ${errorCount} failed/skipped.`,
        type: errorCount > 0 ? 'info' : 'success'
      });
      fetchData();
    };

    window.addEventListener('tms:excel-imported', handleExcelImport);
    return () => window.removeEventListener('tms:excel-imported', handleExcelImport);
  }, [records]);

  // Get available RRs for selected DO
  const filteredRRsForSelectedDO = useMemo(() => {
    if (!form.doNo) return [];
    const safeRRs = rrRecords || [];
    return safeRRs.filter(rr => rr && rr.doNo === form.doNo);
  }, [form.doNo, rrRecords]);

  // Handle DO selection
  const handleDOChange = (doNo: string) => {
    const safeRRs = rrRecords || [];
    const rrs = safeRRs.filter(rr => rr && rr.doNo === doNo);
    setForm(prev => ({
      ...prev,
      doNo,
      rrNo: rrs[0]?.rrNo || ''
    }));
  };

  // Search & Filters
  const filteredRecords = useMemo(() => {
    const safeRecords = records || [];
    return safeRecords.filter(r => {
      if (!r) return false;
      const matchesSearch = 
        r.rrNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.doNo.toUpperCase().includes(searchQuery.toUpperCase());
        
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
    
    // Average GCV ADB and ARB
    const countWithGCV = safeRecords.filter(r => r && r.gcvAdb > 0).length;
    const avgGcvAdb = countWithGCV > 0
      ? Math.round(safeRecords.reduce((acc, r) => acc + (r ? Number(r.gcvAdb) : 0), 0) / countWithGCV)
      : 0;
    const avgGcvArb = countWithGCV > 0
      ? Math.round(safeRecords.reduce((acc, r) => acc + (r ? Number(r.gcvArb) : 0), 0) / countWithGCV)
      : 0;
      
    const totalPenalty = safeRecords.reduce((acc, r) => acc + (r ? Number(r.qualityPenalty) : 0), 0);
    
    return { totalCount, avgGcvAdb, avgGcvArb, totalPenalty };
  }, [records]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    if (doRecords.length === 0) {
      alert("Please configure a DO in the DO Master first!");
      return;
    }
    if (rrRecords.length === 0) {
      alert("Please configure RRs in the RR Entry first!");
      return;
    }

    const firstDo = doRecords[0].doNo;
    const rrsForFirstDo = rrRecords.filter(rr => rr.doNo === firstDo);

    setEditingRecord(null);
    setForm({
      doNo: firstDo,
      rrNo: rrsForFirstDo[0]?.rrNo || '',
      tm: '',
      im: '',
      ash: '',
      vm: '',
      fc: '',
      gcvAdb: '',
      gcvArb: '',
      qualityPenalty: ''
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (record: QualityTrackingRecord) => {
    setEditingRecord(record);
    setForm({
      doNo: record.doNo,
      rrNo: record.rrNo,
      tm: String(record.tm),
      im: String(record.im),
      ash: String(record.ash),
      vm: String(record.vm),
      fc: String(record.fc),
      gcvAdb: String(record.gcvAdb),
      gcvArb: String(record.gcvArb),
      qualityPenalty: String(record.qualityPenalty)
    });
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doNo || !form.rrNo) {
      alert("Please select DO No and RR No!");
      return;
    }

    const recordData = {
      id: editingRecord ? editingRecord.id : undefined,
      doNo: form.doNo,
      rrNo: form.rrNo,
      tm: parseFloat(form.tm) || 0,
      im: parseFloat(form.im) || 0,
      ash: parseFloat(form.ash) || 0,
      vm: parseFloat(form.vm) || 0,
      fc: parseFloat(form.fc) || 0,
      gcvAdb: parseFloat(form.gcvAdb) || 0,
      gcvArb: parseFloat(form.gcvArb) || 0,
      qualityPenalty: parseFloat(form.qualityPenalty) || 0
    };

    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch('/api/coal-rcr/quality-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(recordData)
      });

      if (!response.ok) {
        const errData = await response.json();
        alert(errData.error || "Failed to save Quality record.");
        return;
      }

      const res = await response.json();
      if (res.success) {
        setIsModalOpen(false);
        fetchData();
      }
    } catch (error) {
      console.error("Error saving Quality record:", error);
      alert("An error occurred while saving the Quality record.");
    }
  };

  // Delete Handler
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this Quality Record?")) return;
    try {
      const token = localStorage.getItem('tms_token');
      const response = await fetch(`/api/coal-rcr/quality-tracking?id=${id}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const errData = await response.json();
        alert(errData.error || "Failed to delete Quality record.");
        return;
      }
      fetchData();
    } catch (error) {
      console.error("Error deleting Quality record:", error);
      alert("An error occurred while deleting the Quality record.");
    }
  };

  const deleteSelected = async () => {
    if (!confirm(`Are you sure you want to delete these ${selectedIds.length} Quality records?`)) return;
    setLoading(true);
    const token = localStorage.getItem('tms_token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    let successCount = 0;
    let failCount = 0;

    try {
      await Promise.all(selectedIds.map(async (id) => {
        try {
          const response = await fetch(`/api/coal-rcr/quality-tracking?id=${id}`, {
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
      alert(`Bulk delete completed: ${successCount} Quality records deleted, ${failCount} failed.`);
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
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Quality Tracking</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track chemical proximate parameters (ash, moisture, GCV) and quality slippages per Railway Receipt
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          {user?.role?.endsWith('_ADMIN') && <SectionExcelImport sectionName="Quality Tracking" />}
          <SectionExcelExport sectionName="Quality Tracking" />
          <button
            onClick={handleOpenAdd}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Quality Analysis
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Analyzed RRs</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalCount}</span>
            <span className="text-[10px] text-slate-400">RRs tested</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg GCV (ADB)</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">{stats.avgGcvAdb.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400">kcal/kg</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg GCV (ARB)</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">{stats.avgGcvArb.toLocaleString()}</span>
            <span className="text-[10px] text-slate-400">kcal/kg</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Quality Penalty</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-red-600">₹{stats.totalPenalty.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-red-500 font-semibold">deductions</span>
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
            <Activity className="h-4.5 w-4.5 text-blue-600" /> Quality Audits ({filteredRecords.length})
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
                <th className="px-5 py-4 text-right">TM (%)</th>
                <th className="px-5 py-4 text-right">IM (%)</th>
                <th className="px-5 py-4 text-right">Ash (%)</th>
                <th className="px-5 py-4 text-right">VM (%)</th>
                <th className="px-5 py-4 text-right">FC (%)</th>
                <th className="px-5 py-4 text-right">GCV ADB (kcal)</th>
                <th className="px-5 py-4 text-right">GCV ARB (kcal)</th>
                <th className="px-5 py-4 text-right">Penalty (₹)</th>
                <th className="px-5 py-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={isDeleteMode ? 13 : 12} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> Fetching quality logs...
                    </span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={isDeleteMode ? 13 : 12} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No Quality records found.
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
                    <td className="px-5 py-4 font-mono text-right">{Number(r.tm || 0).toFixed(2)}%</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.im || 0).toFixed(2)}%</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.ash || 0).toFixed(2)}%</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.vm || 0).toFixed(2)}%</td>
                    <td className="px-5 py-4 font-mono text-right">{Number(r.fc || 0).toFixed(2)}%</td>
                    <td className="px-5 py-4 font-mono text-right font-semibold text-slate-700">{Math.round(Number(r.gcvAdb || 0))}</td>
                    <td className="px-5 py-4 font-mono text-right font-semibold text-slate-700">{Math.round(Number(r.gcvArb || 0))}</td>
                    <td className="px-5 py-4 font-mono text-right font-bold text-red-600">₹{Number(r.qualityPenalty || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
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
                <Activity className="h-4.5 w-4.5 text-blue-600" />
                {editingRecord ? 'Edit Quality Analysis' : 'Add Quality Analysis'}
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
                    onChange={(e) => setForm({ ...form, rrNo: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-700 font-bold focus:outline-none cursor-pointer"
                  >
                    {filteredRRsForSelectedDO.length === 0 ? (
                      <option value="">No RRs logged for this DO</option>
                    ) : (
                      filteredRRsForSelectedDO.map(rr => (
                        <option key={rr.id} value={rr.rrNo}>{rr.rrNo}</option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* proximate analysis grid */}
              <div className="grid grid-cols-5 gap-3 border-y border-slate-100 py-4">
                {/* TM */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">TM (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.tm}
                    onChange={(e) => setForm({ ...form, tm: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* IM */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">IM (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.im}
                    onChange={(e) => setForm({ ...form, im: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* Ash */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Ash (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.ash}
                    onChange={(e) => setForm({ ...form, ash: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* VM */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">VM (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.vm}
                    onChange={(e) => setForm({ ...form, vm: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* FC */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">FC (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.fc}
                    onChange={(e) => setForm({ ...form, fc: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {/* GCV ADB */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">GCV ADB (kcal/kg)</label>
                  <input
                    type="number"
                    value={form.gcvAdb}
                    onChange={(e) => setForm({ ...form, gcvAdb: e.target.value })}
                    placeholder="e.g. 5200"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* GCV ARB */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">GCV ARB (kcal/kg)</label>
                  <input
                    type="number"
                    value={form.gcvArb}
                    onChange={(e) => setForm({ ...form, gcvArb: e.target.value })}
                    placeholder="e.g. 4800"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* Quality Penalty */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider text-red-500">Quality Penalty (₹)</label>
                  <input
                    type="number"
                    value={form.qualityPenalty}
                    onChange={(e) => setForm({ ...form, qualityPenalty: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-red-700 border-red-100 placeholder-red-300 font-bold focus:outline-none font-mono"
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
