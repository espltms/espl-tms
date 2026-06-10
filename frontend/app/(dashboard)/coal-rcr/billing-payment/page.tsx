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
  Layers
} from 'lucide-react';
import { fetchSyncedValue, saveSyncedValue, readLocalValue } from '@/lib/syncedStorage';
import { DOMasterRecord } from '../do-master/page';

const BILLING_PAYMENT_KEY = 'tms_coal_billing_payment';
const DO_MASTER_KEY = 'tms_coal_do_master';
const ITEMS_PER_PAGE = 15;

export interface BillingPaymentRecord {
  id: string;
  doNo: string;
  billNo: string;
  billDate: string;
  billQty: number;
  billAmount: number;
  tds: number;
  advancePaid: number;
  finalPayable: number;
  remarks: string;
}

export default function BillingPaymentPage() {
  const [records, setRecords] = useState<BillingPaymentRecord[]>([]);
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [doNoFilter, setDoNoFilter] = useState<string>('All');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<BillingPaymentRecord | null>(null);
  
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
  const fetchData = async () => {
    setLoading(true);
    try {
      const localBillings = readLocalValue<BillingPaymentRecord[]>(BILLING_PAYMENT_KEY, []);
      const localDOs = readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
      setRecords(localBillings);
      setDoRecords(localDOs);
      
      const syncedBillings = await fetchSyncedValue<BillingPaymentRecord[]>(BILLING_PAYMENT_KEY, []);
      const syncedDOs = await fetchSyncedValue<DOMasterRecord[]>(DO_MASTER_KEY, []);
      if (syncedBillings) setRecords(syncedBillings);
      if (syncedDOs) setDoRecords(syncedDOs);
    } catch (e) {
      console.error("Error fetching Billing records:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const persistRecords = (next: BillingPaymentRecord[]) => {
    setRecords(next);
    saveSyncedValue(BILLING_PAYMENT_KEY, next);
  };

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

  // Search & Filters
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      const matchesSearch = 
        r.billNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.doNo.toUpperCase().includes(searchQuery.toUpperCase()) ||
        r.remarks.toUpperCase().includes(searchQuery.toUpperCase());
        
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
    const totalBilled = records.reduce((acc, r) => acc + Number(r.billAmount), 0);
    const totalAdvance = records.reduce((acc, r) => acc + Number(r.advancePaid), 0);
    const totalPayable = records.reduce((acc, r) => acc + Number(r.finalPayable), 0);
    
    return { totalCount, totalBilled, totalAdvance, totalPayable };
  }, [records]);

  // Open Modal for Add
  const handleOpenAdd = () => {
    if (doRecords.length === 0) {
      alert("Please configure DO Master first!");
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
      billDate: record.billDate,
      billQty: String(record.billQty),
      billAmount: String(record.billAmount),
      tds: String(record.tds),
      advancePaid: String(record.advancePaid),
      finalPayable: String(record.finalPayable),
      remarks: record.remarks
    });
    setIsModalOpen(true);
  };

  // Submit Handler
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.doNo || !form.billNo || !form.billAmount) {
      alert("Please fill in all required fields (DO No, Bill No, Bill Amount)!");
      return;
    }

    const recordData: BillingPaymentRecord = {
      id: editingRecord ? editingRecord.id : `bill-${Date.now()}`,
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

    let nextRecords = [...records];
    if (editingRecord) {
      nextRecords = nextRecords.map(r => r.id === editingRecord.id ? recordData : r);
    } else {
      // Check duplicate Bill No
      if (records.some(r => r.billNo === recordData.billNo)) {
        alert(`Bill Number "${recordData.billNo}" already exists!`);
        return;
      }
      nextRecords.unshift(recordData);
    }

    persistRecords(nextRecords);
    setIsModalOpen(false);
  };

  // Delete Handler
  const handleDelete = (id: string) => {
    if (!confirm("Are you sure you want to delete this Billing Record?")) return;
    const nextRecords = records.filter(r => r.id !== id);
    persistRecords(nextRecords);
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-700">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Billing / Payment</h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage commercial invoicing, TDS deductions, transporter advance tracking, and final settlements
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={handleOpenAdd}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm shrink-0"
          >
            <Plus className="h-4 w-4" /> Add Bill Entry
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
            <BadgeCent className="h-4.5 w-4.5 text-blue-600" /> Commercial Invoices ({filteredRecords.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/20">
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
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-500 font-semibold">
                    <span className="flex items-center justify-center gap-2 text-slate-400">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> Fetching billing logs...
                    </span>
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400 font-bold">
                    No Billing / Payment records found.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((r, idx) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
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
                    <td className="px-5 py-4 font-mono text-slate-800 text-right">{r.billQty ? r.billQty.toFixed(2) : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-slate-800 text-right font-semibold text-slate-700">{r.billAmount ? r.billAmount.toLocaleString('en-IN') : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right text-red-600">{r.tds ? r.tds.toLocaleString('en-IN') : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right text-purple-600">{r.advancePaid ? r.advancePaid.toLocaleString('en-IN') : '0.00'}</td>
                    <td className="px-5 py-4 font-mono text-right font-bold text-emerald-600 bg-emerald-50/10">₹{r.finalPayable ? r.finalPayable.toLocaleString('en-IN') : '0.00'}</td>
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
    </div>
  );
}
