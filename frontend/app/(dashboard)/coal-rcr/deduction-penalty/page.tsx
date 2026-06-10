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
  Hourglass,
  Layers
} from 'lucide-react';
import { fetchSyncedValue, saveSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { DOMasterRecord } from '../do-master/page';
import { RREntryRecord } from '../rr-entry/page';
import { QualityTrackingRecord } from '../quality-tracking/page';

const DEDUCTION_PENALTY_KEY = 'tms_coal_deduction_penalty';
const QUALITY_TRACKING_KEY = 'tms_coal_quality_tracking';
const RR_ENTRY_KEY = 'tms_coal_rr_entry';
const DO_MASTER_KEY = 'tms_coal_do_master';
const ITEMS_PER_PAGE = 15;

export interface DeductionPenaltyRecord {
  id: string;
  doNo: string;
  rrNo: string;
  deadFreight: number;
  punitive: number;
  dc: number; // Demurrage Charges
  shortage: number;
  qualitySlippage: number; // Pre-filled from Quality Tracking
  railwayLeakage: number;
  finalDeduction: number; // Sum of all above
}

export default function DeductionPenaltyPage() {
  const [records, setRecords] = useState<DeductionPenaltyRecord[]>([]);
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [rrRecords, setRrRecords] = useState<RREntryRecord[]>([]);
  const [qualityRecords, setQualityRecords] = useState<QualityTrackingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [doNoFilter, setDoNoFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DeductionPenaltyRecord | null>(null);
  
  // Form states
  const [form, setForm] = useState({
    doNo: '',
    rrNo: '',
    deadFreight: '',
    punitive: '',
    dc: '',
    shortage: '',
    qualitySlippage: '',
    railwayLeakage: '',
    finalDeduction: ''
  });

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const localDeductions = readLocalValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []);
      const localQualities = readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []);
      const localRRs = readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
      const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
      setRecords(localDeductions);
      setQualityRecords(localQualities);
      setRrRecords(localRRs);
      setDoRecords(localDOs);
      
      const syncedDeductions = await fetchSyncedValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []);
      const syncedQualities = await fetchSyncedValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []);
      const syncedRRs = await fetchSyncedValue<RREntryRecord[]>(RR_ENTRY_KEY, []);
      const syncedDOs = await fetchSyncedValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
      if (syncedDeductions) setRecords(syncedDeductions);
      if (syncedQualities) setQualityRecords(syncedQualities);
      if (syncedRRs) setRrRecords(syncedRRs);
      if (syncedDOs) setDoRecords(syncedDOs);
    } catch (e) {
      console.error("Error fetching Deduction records:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const persistRecords = (next: DeductionPenaltyRecord[]) => {
    setRecords(next);
    saveSyncedValue(DEDUCTION_PENALTY_KEY, next);
  };

  // Get available RRs for selected DO
  const filteredRRsForSelectedDO = useMemo(() => {
    if (!form.doNo) return [];
    return rrRecords.filter(rr => rr.doNo === form.doNo);
  }, [form.doNo, rrRecords]);

  // Pre-fill Quality Slippage and Auto-calculate Final Deduction
  const handleRRChange = (rrNo: string) => {
    const matchedQuality = qualityRecords.find(q => q.rrNo === rrNo);
    const qualitySlippage = matchedQuality ? matchedQuality.qualityPenalty : 0;
    
    setForm(prev => {
      const deadFreight = parseFloat(prev.deadFreight) || 0;
      const punitive = parseFloat(prev.punitive) || 0;
      const dc = parseFloat(prev.dc) || 0;
      const shortage = parseFloat(prev.shortage) || 0;
      const railwayLeakage = parseFloat(prev.railwayLeakage) || 0;
      
      const finalDeduction = deadFreight + punitive + dc + shortage + qualitySlippage + railwayLeakage;
      
      return {
        ...prev,
        rrNo,
        qualitySlippage: String(qualitySlippage),
        finalDeduction: String(finalDeduction)
      };
    });
  };

  // Handle input changes with auto-calculations
  const handleInputChange = (field: string, val: string) => {
    setForm(prev => {
      const nextForm = { ...prev, [field]: val };
      
      const deadFreight = parseFloat(nextForm.deadFreight) || 0;
      const punitive = parseFloat(nextForm.punitive) || 0;
      const dc = parseFloat(nextForm.dc) || 0;
      const shortage = parseFloat(nextForm.shortage) || 0;
      const qualitySlippage = parseFloat(nextForm.qualitySlippage) || 0;
      const railwayLeakage = parseFloat(nextForm.railwayLeakage) || 0;
      
      const finalDeduction = deadFreight + punitive + dc + shortage + qualitySlippage + railwayLeakage;
      nextForm.finalDeduction = String(finalDeduction);
      
      return nextForm;
    });
  };

  // Handle DO change
  const handleDOChange = (doNo: string) => {
    const rrs = rrRecords.filter(rr => rr.doNo === doNo);
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

  // Search & Filters
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
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
    const totalCount = records.length;
    const totalDeduction = records.reduce((acc, r) => acc + Number(r.finalDeduction), 0);
    const shortageDeduction = records.reduce((acc, r) => acc + Number(r.shortage), 0);
    const qualityDeduction = records.reduce((acc, r) => acc + Number(r.qualitySlippage), 0);
    
    return { totalCount, totalDeduction, shortageDeduction, qualityDeduction };
  }, [records]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    if (doRecords.length === 0) {
      alert("Please configure DO Master first!");
      return;
    }
    if (rrRecords.length === 0) {
      alert("Please configure RR Entry first!");
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
      deadFreight: '',
      punitive: '',
      dc: '',
      shortage: '',
      qualitySlippage: String(qualitySlippage),
      railwayLeakage: '',
      finalDeduction: String(qualitySlippage)
    });
    setIsModalOpen(true);
  };

  // Open Modal for Edit
  const handleOpenEdit = (record: DeductionPenaltyRecord) => {
    setEditingRecord(record);
    setForm({
      doNo: record.doNo,
      rrNo: record.rrNo,
      deadFreight: String(record.deadFreight),
      punitive: String(record.punitive),
      dc: String(record.dc),
      shortage: String(record.shortage),
      qualitySlippage: String(record.qualitySlippage),
      railwayLeakage: String(record.railwayLeakage),
      finalDeduction: String(record.finalDeduction)
    });
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doNo || !form.rrNo) {
      alert("Please select DO No and RR No!");
      return;
    }

    const recordData: DeductionPenaltyRecord = {
      id: editingRecord ? editingRecord.id : `deduction-${Date.now()}`,
      doNo: form.doNo,
      rrNo: form.rrNo,
      deadFreight: parseFloat(form.deadFreight) || 0,
      punitive: parseFloat(form.punitive) || 0,
      dc: parseFloat(form.dc) || 0,
      shortage: parseFloat(form.shortage) || 0,
      qualitySlippage: parseFloat(form.qualitySlippage) || 0,
      railwayLeakage: parseFloat(form.railwayLeakage) || 0,
      finalDeduction: parseFloat(form.finalDeduction) || 0
    };

    let nextRecords = [...records];
    if (editingRecord) {
      nextRecords = nextRecords.map(r => r.id === editingRecord.id ? recordData : r);
    } else {
      // Check duplicate RR Deduction
      if (records.some(r => r.rrNo === recordData.rrNo)) {
        alert(`Deduction record for RR Number "${recordData.rrNo}" already exists!`);
        return;
      }
      nextRecords.unshift(recordData);
    }

    persistRecords(nextRecords);
    setIsModalOpen(false);
  };

  // Delete Handler
  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this Deduction Record?")) return;
    const nextRecords = records.filter(r => r.id !== id);
    persistRecords(nextRecords);
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-700">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Deduction / Penalty</h2>
          <p className="text-xs text-slate-500 mt-1">
            Track dead freight charges, punitive charges, demurrage, weight shortage penalties, and leakage deductions
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={handleOpenAdd}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Deduction Record
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
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Audited Shipments</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{stats.totalCount}</span>
            <span className="text-[10px] text-slate-400">RRs processed</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Shortage Penalties</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600">₹{stats.shortageDeduction.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">shortage cost</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Quality Slippage</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-purple-600">₹{stats.qualityDeduction.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-slate-400">GCV slippages</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Deductions</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-red-600">₹{stats.totalDeduction.toLocaleString('en-IN')}</span>
            <span className="text-[10px] text-red-500 font-semibold">total penalties</span>
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
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Scale className="h-4.5 w-4.5 text-blue-600" /> Deduction Logs ({filteredRecords.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
                <th className="px-5 py-4 w-12 text-center">SL.</th>
                <th className="px-5 py-4">RR No</th>
                <th className="px-5 py-4">DO No</th>
                <th className="px-5 py-4 text-right">Dead Freight (₹)</th>
                <th className="px-5 py-4 text-right">Punitive (₹)</th>
                <th className="px-5 py-4 text-right">DC / Demurrage (₹)</th>
                <th className="px-5 py-4 text-right">Shortage (₹)</th>
                <th className="px-5 py-4 text-right">Quality Slippage (₹)</th>
                <th className="px-5 py-4 text-right">Railway Leakage (₹)</th>
                <th className="px-5 py-4 text-right font-bold">Final Deduction (₹)</th>
                <th className="px-5 py-4 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {loading ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> Fetching deductions...
                    </span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No Deduction logs found.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-400 text-center">
                      {(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}
                    </td>
                    <td className="px-5 py-4 font-mono font-extrabold text-slate-800 uppercase tracking-wider">
                      {r.rrNo}
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-slate-700">
                      {r.doNo}
                    </td>
                    <td className="px-5 py-4 font-mono text-right">{r.deadFreight ? r.deadFreight.toLocaleString('en-IN') : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right">{r.punitive ? r.punitive.toLocaleString('en-IN') : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right">{r.dc ? r.dc.toLocaleString('en-IN') : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right font-semibold text-blue-600">{r.shortage ? r.shortage.toLocaleString('en-IN') : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right font-semibold text-purple-600">{r.qualitySlippage ? r.qualitySlippage.toLocaleString('en-IN') : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right">{r.railwayLeakage ? r.railwayLeakage.toLocaleString('en-IN') : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right font-bold text-red-600 bg-red-50/10">₹{r.finalDeduction ? r.finalDeduction.toLocaleString('en-IN') : '0.00'}</td>
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

              {/* Deductions Breakdown */}
              <div className="grid grid-cols-3 gap-4 border-y border-slate-100 py-4">
                {/* Dead Freight */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Dead Freight (₹)</label>
                  <input
                    type="number"
                    value={form.deadFreight}
                    onChange={(e) => handleInputChange('deadFreight', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* Punitive */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Punitive (₹)</label>
                  <input
                    type="number"
                    value={form.punitive}
                    onChange={(e) => handleInputChange('punitive', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* DC / Demurrage */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Demurrage Charges (₹)</label>
                  <input
                    type="number"
                    value={form.dc}
                    onChange={(e) => handleInputChange('dc', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* Shortage */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Shortage Deduction (₹)</label>
                  <input
                    type="number"
                    value={form.shortage}
                    onChange={(e) => handleInputChange('shortage', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>

                {/* Quality Slippage (read-only/auto-filled) */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Quality Slippage (₹)</label>
                  <input
                    type="number"
                    readOnly
                    value={form.qualitySlippage}
                    placeholder="0.00"
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-500 focus:outline-none font-mono font-bold cursor-not-allowed"
                  />
                </div>

                {/* Railway Leakage */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-500 uppercase tracking-wider">Railway Leakage (₹)</label>
                  <input
                    type="number"
                    value={form.railwayLeakage}
                    onChange={(e) => handleInputChange('railwayLeakage', e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none font-mono"
                  />
                </div>
              </div>

              {/* Final Deduction */}
              <div className="space-y-1 max-w-xs mx-auto text-center">
                <label className="font-bold text-slate-500 uppercase tracking-wider text-red-500 block">Final Deduction Amount</label>
                <input
                  type="text"
                  readOnly
                  value={`₹ ${(parseFloat(form.finalDeduction) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                  className="w-full bg-red-50 border border-red-200 rounded-2xl py-3.5 text-center text-red-700 font-extrabold text-lg focus:outline-none font-mono cursor-not-allowed shadow-inner"
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
    </div>
  );
}
