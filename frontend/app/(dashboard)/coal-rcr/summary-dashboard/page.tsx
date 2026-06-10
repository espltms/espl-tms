'use client';

import { useEffect, useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  RefreshCw, 
  Layers, 
  TrendingUp, 
  Scale, 
  BadgeCent, 
  FileText,
  Search,
  Filter,
  ArrowRight,
  ClipboardList,
  Activity,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { readLocalValue } from '@/lib/syncedStorage';
import SectionExcelExport from '@/components/SectionExcelExport';
import { DOMasterRecord } from '../do-master/page';
import { RREntryRecord } from '../rr-entry/page';
import { QualityTrackingRecord } from '../quality-tracking/page';
import { DeductionPenaltyRecord } from '../deduction-penalty/page';
import { BillingPaymentRecord } from '../billing-payment/page';

const DO_MASTER_KEY = 'tms_coal_do_master';
const RR_ENTRY_KEY = 'tms_coal_rr_entry';
const QUALITY_TRACKING_KEY = 'tms_coal_quality_tracking';
const DEDUCTION_PENALTY_KEY = 'tms_coal_deduction_penalty';
const BILLING_PAYMENT_KEY = 'tms_coal_billing_payment';

interface SidingAggregation {
  siding: string;
  totalDoQty: number;
  liftedQty: number;
  lapsedQty: number;
  balanceQty: number;
  grnQty: number;
  normalisedQty: number;
  totalDeduction: number;
  finalPayable: number;
}

export default function SummaryDashboardPage() {
  const [doRecords, setDoRecords] = useState<DOMasterRecord[]>([]);
  const [rrRecords, setRrRecords] = useState<RREntryRecord[]>([]);
  const [qualityRecords, setQualityRecords] = useState<QualityTrackingRecord[]>([]);
  const [deductions, setDeductions] = useState<DeductionPenaltyRecord[]>([]);
  const [billings, setBillings] = useState<BillingPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [selectedSiding, setSelectedSiding] = useState<string>('All');
  const [selectedDO, setSelectedDO] = useState<string>('All');
  const [selectedRR, setSelectedRR] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Navigation / Tabs State
  const [activeTab, setActiveTab] = useState<'siding' | 'do' | 'rr' | 'explorer'>('siding');
  
  // Expanded DO Row State
  const [expandedDOId, setExpandedDOId] = useState<string | null>(null);

  // Fetch data
  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('tms_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [doRes, rrRes, qRes, dpRes, bpRes] = await Promise.all([
        fetch('/api/coal-rcr/do-master', { headers }),
        fetch('/api/coal-rcr/rr-entry', { headers }),
        fetch('/api/coal-rcr/quality-tracking', { headers }),
        fetch('/api/coal-rcr/deduction-penalty', { headers }),
        fetch('/api/coal-rcr/billing-payment', { headers })
      ]);

      if (doRes.ok && rrRes.ok && qRes.ok && dpRes.ok && bpRes.ok) {
        const doData = await doRes.json();
        const rrData = await rrRes.json();
        const qData = await qRes.json();
        const dpData = await dpRes.json();
        const bpData = await bpRes.json();

        if (doData.success && rrData.success && qData.success && dpData.success && bpData.success) {
          setDoRecords(doData.data);
          setRrRecords(rrData.data);
          setQualityRecords(qData.data);
          setDeductions(dpData.data);
          setBillings(bpData.data);

          localStorage.setItem(DO_MASTER_KEY, JSON.stringify(doData.data));
          localStorage.setItem(RR_ENTRY_KEY, JSON.stringify(rrData.data));
          localStorage.setItem(QUALITY_TRACKING_KEY, JSON.stringify(qData.data));
          localStorage.setItem(DEDUCTION_PENALTY_KEY, JSON.stringify(dpData.data));
          localStorage.setItem(BILLING_PAYMENT_KEY, JSON.stringify(bpData.data));
        }
      } else {
        fallbackToLocal();
      }
    } catch (e) {
      console.error("Error loading summary dashboard data:", e);
      fallbackToLocal();
    } finally {
      setLoading(false);
    }
  };

  const fallbackToLocal = () => {
    setDoRecords(readLocalValue<DOMasterRecord[]>(DO_MASTER_KEY, []));
    setRrRecords(readLocalValue<RREntryRecord[]>(RR_ENTRY_KEY, []));
    setQualityRecords(readLocalValue<QualityTrackingRecord[]>(QUALITY_TRACKING_KEY, []));
    setDeductions(readLocalValue<DeductionPenaltyRecord[]>(DEDUCTION_PENALTY_KEY, []));
    setBillings(readLocalValue<BillingPaymentRecord[]>(BILLING_PAYMENT_KEY, []));
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Reset all filters
  const resetFilters = () => {
    setSelectedSiding('All');
    setSelectedDO('All');
    setSelectedRR('All');
    setSearchQuery('');
  };

  // Preset Searches Action Handlers
  const showSidingRecords = (siding: string) => {
    resetFilters();
    setSelectedSiding(siding);
    setActiveTab('explorer');
  };

  const showDORecords = (doNo: string) => {
    resetFilters();
    setSelectedDO(doNo);
    setActiveTab('explorer');
  };

  const focusSidingTab = () => {
    resetFilters();
    setActiveTab('siding');
  };

  // Get Unique Filter Lists
  const uniqueSidings = useMemo(() => {
    const list = new Set<string>();
    doRecords.forEach(d => { if (d.siding) list.add(d.siding.trim()); });
    rrRecords.forEach(r => { if (r.siding) list.add(r.siding.trim()); });
    return Array.from(list).sort();
  }, [doRecords, rrRecords]);

  const uniqueDOs = useMemo(() => {
    return doRecords.map(d => d.doNo).sort();
  }, [doRecords]);

  const uniqueRRs = useMemo(() => {
    return rrRecords.map(r => r.rrNo).sort();
  }, [rrRecords]);

  // Siding Wise aggregation logic (Groups metrics strictly by Siding)
  const sidingAggregations = useMemo((): SidingAggregation[] => {
    return uniqueSidings.map(sidingName => {
      // Find DOs for this siding
      const matchedDOs = doRecords.filter(d => d.siding.trim().toLowerCase() === sidingName.toLowerCase());
      const matchedDONos = matchedDOs.map(d => d.doNo);
      
      const totalDoQty = matchedDOs.reduce((acc, d) => acc + Number(d.doQty), 0);

      // Find RRs for these DOs/Siding
      const matchedRRs = rrRecords.filter(r => 
        r.siding.trim().toLowerCase() === sidingName.toLowerCase() ||
        matchedDONos.includes(r.doNo)
      );
      const matchedRRNos = matchedRRs.map(r => r.rrNo);

      const liftedQty = matchedRRs.reduce((acc, r) => acc + Number(r.rrChQty), 0);
      
      // Calculate Balance & Lapsed
      let balanceQty = 0;
      let lapsedQty = 0;
      matchedDOs.forEach(d => {
        const doLifted = matchedRRs.filter(r => r.doNo === d.doNo).reduce((acc, r) => acc + Number(r.rrChQty), 0);
        if (d.status === 'Active') {
          balanceQty += Math.max(0, Number(d.doQty) - doLifted);
        } else {
          lapsedQty += Math.max(0, Number(d.doQty) - doLifted);
        }
      });

      const grnQty = matchedRRs.reduce((acc, r) => acc + Number(r.grnQty), 0);
      const normalisedQty = matchedRRs.reduce((acc, r) => acc + Number(r.normalisedQty), 0);

      // Deductions
      const matchedDeductions = deductions.filter(d => matchedRRNos.includes(d.rrNo) || matchedDONos.includes(d.doNo));
      const totalDeduction = matchedDeductions.reduce((acc, d) => acc + Number(d.finalDeduction), 0);

      // Billings
      const matchedBillings = billings.filter(b => matchedDONos.includes(b.doNo));
      const finalPayable = matchedBillings.reduce((acc, b) => acc + Number(b.finalPayable), 0);

      return {
        siding: sidingName,
        totalDoQty,
        liftedQty,
        lapsedQty,
        balanceQty,
        grnQty,
        normalisedQty,
        totalDeduction,
        finalPayable
      };
    }).sort((a, b) => b.totalDoQty - a.totalDoQty);
  }, [uniqueSidings, doRecords, rrRecords, deductions, billings]);

  // Overall aggregate metrics for KPIs
  const overallKPIs = useMemo(() => {
    const totalDoVolume = sidingAggregations.reduce((acc, s) => acc + s.totalDoQty, 0);
    const totalLiftedVolume = sidingAggregations.reduce((acc, s) => acc + s.liftedQty, 0);
    const totalLapsedVolume = sidingAggregations.reduce((acc, s) => acc + s.lapsedQty, 0);
    const totalBalanceVolume = sidingAggregations.reduce((acc, s) => acc + s.balanceQty, 0);
    const totalDeductionsCost = sidingAggregations.reduce((acc, s) => acc + s.totalDeduction, 0);
    const totalPayableCost = sidingAggregations.reduce((acc, s) => acc + s.finalPayable, 0);
    const progressPercent = totalDoVolume > 0 ? (totalLiftedVolume / totalDoVolume) * 100 : 0;

    return {
      totalDoVolume,
      totalLiftedVolume,
      totalLapsedVolume,
      totalBalanceVolume,
      totalDeductionsCost,
      totalPayableCost,
      progressPercent
    };
  }, [sidingAggregations]);

  // Filters logic applied to lists
  const filteredDOsList = useMemo(() => {
    return doRecords.filter(d => {
      const matchesSiding = selectedSiding === 'All' || d.siding.trim().toLowerCase() === selectedSiding.toLowerCase();
      const matchesDO = selectedDO === 'All' || d.doNo === selectedDO;
      const matchesQuery = searchQuery === '' || 
        d.doNo.includes(searchQuery.toUpperCase()) || 
        d.poNo.includes(searchQuery.toUpperCase()) ||
        d.siding.toUpperCase().includes(searchQuery.toUpperCase());
      return matchesSiding && matchesDO && matchesQuery;
    });
  }, [doRecords, selectedSiding, selectedDO, searchQuery]);

  const filteredRRsList = useMemo(() => {
    return rrRecords.filter(r => {
      const matchesSiding = selectedSiding === 'All' || r.siding.trim().toLowerCase() === selectedSiding.toLowerCase();
      const matchesDO = selectedDO === 'All' || r.doNo === selectedDO;
      const matchesRR = selectedRR === 'All' || r.rrNo === selectedRR;
      const matchesQuery = searchQuery === '' || 
        r.rrNo.includes(searchQuery.toUpperCase()) || 
        r.doNo.includes(searchQuery.toUpperCase()) ||
        r.siding.toUpperCase().includes(searchQuery.toUpperCase());
      return matchesSiding && matchesDO && matchesRR && matchesQuery;
    });
  }, [rrRecords, selectedSiding, selectedDO, selectedRR, searchQuery]);

  // Aggregate helper for DO detailed expander
  const getDORRDetails = (doNo: string) => {
    const rrs = rrRecords.filter(r => r.doNo === doNo);
    const rrsNos = rrs.map(r => r.rrNo);
    const matchedQuality = qualityRecords.filter(q => rrsNos.includes(q.rrNo));
    const matchedDeductions = deductions.filter(d => rrsNos.includes(d.rrNo));
    const matchedBillings = billings.filter(b => b.doNo === doNo);

    const sumChQty = rrs.reduce((acc, r) => acc + Number(r.rrChQty), 0);
    const sumGrnQty = rrs.reduce((acc, r) => acc + Number(r.grnQty), 0);
    const sumNormalisedQty = rrs.reduce((acc, r) => acc + Number(r.normalisedQty), 0);
    const sumPenalties = matchedDeductions.reduce((acc, d) => acc + Number(d.finalDeduction), 0);
    const sumBillAmount = matchedBillings.reduce((acc, b) => acc + Number(b.billAmount), 0);

    return {
      rrs,
      quality: matchedQuality,
      deductions: matchedDeductions,
      billings: matchedBillings,
      sumChQty,
      sumGrnQty,
      sumNormalisedQty,
      sumPenalties,
      sumBillAmount
    };
  };

  return (
    <div className="space-y-8 animate-fade-in text-slate-700">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Summary & Query Dashboard</h2>
          <p className="text-xs text-slate-500 mt-1">
            Perform unified searches, track lifted, lapsed, and balance metrics, and audit quality slippages per Delivery Order
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <SectionExcelExport sectionName="Summary Dashboard" />
          <button
            onClick={fetchData}
            disabled={loading}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-slate-800 flex items-center gap-2 font-sans transition-all active:scale-[0.98] shadow-sm disabled:opacity-60 shrink-0"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </div>
      </div>

      {/* Preset Searches Bar */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-slate-500 font-semibold">
          <span className="text-blue-700 font-bold uppercase tracking-wider text-[10px]">Quick Searches:</span>
          {uniqueSidings.includes('HKG') && (
            <button 
              onClick={() => showSidingRecords('HKG')} 
              className="bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 font-sans transition-all shadow-sm"
            >
              “Show all records for Siding HKG”
            </button>
          )}
          {uniqueDOs.length > 0 && (
            <button 
              onClick={() => showDORecords(uniqueDOs[0])}
              className="bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 font-sans transition-all shadow-sm"
            >
              “Show all RRs under DO {uniqueDOs[0]}”
            </button>
          )}
          <button 
            onClick={focusSidingTab}
            className="bg-white hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg px-2.5 py-1 font-sans transition-all shadow-sm"
          >
            “Show pending/lapsed quantity siding-wise”
          </button>
        </div>
        {(selectedSiding !== 'All' || selectedDO !== 'All' || selectedRR !== 'All' || searchQuery !== '') && (
          <button 
            onClick={resetFilters}
            className="text-red-600 hover:text-red-700 font-bold flex items-center gap-1 self-start md:self-auto"
          >
            <X className="h-3.5 w-3.5" /> Clear active filters
          </button>
        )}
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {/* DO Allocation */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Total DO Qty</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black text-slate-800">{overallKPIs.totalDoVolume.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-slate-400 font-bold">MT</span>
          </div>
        </div>

        {/* Lifted Qty */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-blue-600">Lifted Qty</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black text-blue-600">{overallKPIs.totalLiftedVolume.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-blue-400 font-bold">MT</span>
          </div>
        </div>

        {/* Balance Qty */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-emerald-700">Balance Qty</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black text-emerald-700">{overallKPIs.totalBalanceVolume.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-slate-400 font-bold">MT pending</span>
          </div>
        </div>

        {/* Lapsed Qty */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-orange-600">Lapsed Qty</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black text-orange-600">{overallKPIs.totalLapsedVolume.toLocaleString('en-IN')}</span>
            <span className="text-[9px] text-slate-400 font-bold">MT lapsed</span>
          </div>
        </div>

        {/* Total Deductions */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-red-600">Deductions</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black text-red-600">₹{Math.round(overallKPIs.totalDeductionsCost).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Total Payable */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-purple-600">Net Payable</span>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-lg font-black text-purple-600">₹{Math.round(overallKPIs.totalPayableCost).toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Interactive Query Filters Control Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <Filter className="h-4 w-4 text-blue-600" /> Query Filters (Connect everything by DO No.)
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Siding dropdown */}
          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-400 uppercase tracking-wider">Filter by Siding</label>
            <select
              value={selectedSiding}
              onChange={(e) => { setSelectedSiding(e.target.value); setSelectedDO('All'); setSelectedRR('All'); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-sans font-bold focus:outline-none"
            >
              <option value="All">All Sidings</option>
              {uniqueSidings.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* DO Number dropdown */}
          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-400 uppercase tracking-wider">Filter by DO No.</label>
            <select
              value={selectedDO}
              onChange={(e) => { setSelectedDO(e.target.value); setSelectedRR('All'); }}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-sans font-bold focus:outline-none font-mono"
            >
              <option value="All">All DO Numbers</option>
              {uniqueDOs.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {/* RR Number dropdown */}
          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-400 uppercase tracking-wider">Filter by RR No.</label>
            <select
              value={selectedRR}
              onChange={(e) => setSelectedRR(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-sans font-bold focus:outline-none font-mono"
            >
              <option value="All">All RR Numbers</option>
              {uniqueRRs.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Search box */}
          <div className="space-y-1 text-xs">
            <label className="font-bold text-slate-400 uppercase tracking-wider">Search by keywords</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search DO, PO, RR, Siding..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-8 font-sans focus:outline-none text-xs"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 p-0.5 rounded-full hover:bg-slate-200 text-slate-400"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="border-b border-slate-200 flex gap-4 text-xs font-bold uppercase tracking-wider overflow-x-auto whitespace-nowrap">
        <button
          onClick={() => setActiveTab('siding')}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === 'siding' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Siding-wise Summary
        </button>
        <button
          onClick={() => setActiveTab('do')}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === 'do' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          DO-wise Explorer
        </button>
        <button
          onClick={() => setActiveTab('rr')}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === 'rr' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          RR-wise Explorer
        </button>
        <button
          onClick={() => setActiveTab('explorer')}
          className={`pb-3 border-b-2 transition-all ${
            activeTab === 'explorer' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          Unified Search Report
        </button>
      </div>

      {/* View Screens */}

      {/* Tab 1: Siding-wise Aggregates */}
      {activeTab === 'siding' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/40">
                  <th className="px-5 py-4 w-12 text-center">SL.</th>
                  <th className="px-5 py-4">Siding Name</th>
                  <th className="px-5 py-4 text-right">Total DO Qty (MT)</th>
                  <th className="px-5 py-4 text-right text-blue-600">Lifted Qty (MT)</th>
                  <th className="px-5 py-4 text-right text-emerald-700">Balance Qty (MT)</th>
                  <th className="px-5 py-4 text-right text-orange-600">Lapsed Qty (MT)</th>
                  <th className="px-5 py-4 text-right">GRN Qty (MT)</th>
                  <th className="px-5 py-4 text-right">Normalised Qty (MT)</th>
                  <th className="px-5 py-4 text-right text-red-600">Total Deduction (₹)</th>
                  <th className="px-5 py-4 text-right text-purple-600">Final Payable (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-bold">
                      <RefreshCw className="h-4 w-4 animate-spin text-blue-600 inline-block mr-2" /> Aggregating siding metrics...
                    </td>
                  </tr>
                ) : sidingAggregations.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-bold">No transportation records.</td>
                  </tr>
                ) : (
                  sidingAggregations
                    .filter(s => selectedSiding === 'All' || s.siding.trim().toLowerCase() === selectedSiding.toLowerCase())
                    .map((r, idx) => (
                      <tr key={r.siding} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                        <td className="px-5 py-4 font-extrabold text-slate-800 uppercase tracking-wide">{r.siding}</td>
                        <td className="px-5 py-4 font-mono text-right">{r.totalDoQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-4 font-mono text-right text-blue-600 font-semibold">{r.liftedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-4 font-mono text-right text-emerald-700 font-bold">{r.balanceQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-4 font-mono text-right text-orange-600">{r.lapsedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-4 font-mono text-right">{r.grnQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-4 font-mono text-right">{r.normalisedQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-4 font-mono text-right text-red-600 font-semibold">₹{Math.round(r.totalDeduction).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-4 font-mono text-right text-purple-600 font-bold bg-purple-50/10">₹{Math.round(r.finalPayable).toLocaleString('en-IN')}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: DO-wise Explorer */}
      {activeTab === 'do' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/40">
                  <th className="px-5 py-4 w-8"></th>
                  <th className="px-5 py-4">DO No.</th>
                  <th className="px-5 py-4">PO No.</th>
                  <th className="px-5 py-4">Siding</th>
                  <th className="px-5 py-4 text-right">DO Qty (MT)</th>
                  <th className="px-5 py-4 text-right text-blue-600">Lifted Qty (MT)</th>
                  <th className="px-5 py-4 text-right text-emerald-700">Balance Qty (MT)</th>
                  <th className="px-5 py-4 text-right text-orange-600">Lapsed Qty (MT)</th>
                  <th className="px-5 py-4 text-right text-red-600">Penalties (₹)</th>
                  <th className="px-5 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-bold">Fetching DO list...</td>
                  </tr>
                ) : filteredDOsList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-bold">No Delivery Orders match your filters.</td>
                  </tr>
                ) : (
                  filteredDOsList.map((d) => {
                    const isExpanded = expandedDOId === d.id;
                    const aggregateDetails = getDORRDetails(d.doNo);
                    
                    // calculations
                    const isCompleted = d.status !== 'Active';
                    const balance = isCompleted ? 0 : Math.max(0, Number(d.doQty) - aggregateDetails.sumChQty);
                    const lapsed = isCompleted ? Math.max(0, Number(d.doQty) - aggregateDetails.sumChQty) : 0;

                    return (
                      <>
                        <tr key={d.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setExpandedDOId(isExpanded ? null : d.id)}>
                          <td className="px-4 py-4 text-center">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                          </td>
                          <td className="px-5 py-4 font-mono font-bold text-slate-800 uppercase">{d.doNo}</td>
                          <td className="px-5 py-4 font-mono text-slate-600">{d.poNo}</td>
                          <td className="px-5 py-4 font-semibold">{d.siding}</td>
                          <td className="px-5 py-4 font-mono text-right">{Number(d.doQty).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-4 font-mono text-right text-blue-600">{aggregateDetails.sumChQty.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-4 font-mono text-right text-emerald-700 font-semibold">{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-4 font-mono text-right text-orange-600">{lapsed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td className="px-5 py-4 font-mono text-right text-red-600 font-semibold">₹{Math.round(aggregateDetails.sumPenalties).toLocaleString('en-IN')}</td>
                          <td className="px-5 py-4 text-center">
                            <span className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${
                              d.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              {d.status}
                            </span>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={10} className="px-8 py-5 border-l-2 border-blue-500">
                              <div className="space-y-6">
                                {/* Associated RRs */}
                                <div>
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                                    <ClipboardList className="h-3.5 w-3.5 text-blue-600" /> Associated Railway Receipts ({aggregateDetails.rrs.length})
                                  </h4>
                                  {aggregateDetails.rrs.length === 0 ? (
                                    <p className="text-[10px] text-slate-400 italic">No RR receipts logged under this DO.</p>
                                  ) : (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-w-4xl shadow-sm">
                                      <table className="w-full text-left text-[10px] border-collapse">
                                        <thead>
                                          <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase bg-slate-50/80">
                                            <th className="px-4 py-2.5">RR No</th>
                                            <th className="px-4 py-2.5">Date</th>
                                            <th className="px-4 py-2.5 text-right">Challan Qty</th>
                                            <th className="px-4 py-2.5 text-right">GRN Qty</th>
                                            <th className="px-4 py-2.5 text-right">Normalised Qty</th>
                                            <th className="px-4 py-2.5 text-right">Dead Freight</th>
                                            <th className="px-4 py-2.5 text-right">Quality Penalty</th>
                                            <th className="px-4 py-2.5 text-right font-bold">Final Deduction</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-600 font-mono">
                                          {aggregateDetails.rrs.map(rr => {
                                            const qual = aggregateDetails.quality.find(q => q.rrNo === rr.rrNo);
                                            const ded = aggregateDetails.deductions.find(d => d.rrNo === rr.rrNo);
                                            return (
                                              <tr key={rr.id} className="hover:bg-slate-50/50">
                                                <td className="px-4 py-2 font-bold text-slate-800">{rr.rrNo}</td>
                                                <td className="px-4 py-2">{rr.rrDate || '—'}</td>
                                                <td className="px-4 py-2 text-right">{Number(rr.rrChQty).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right">{Number(rr.grnQty).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right">{Number(rr.normalisedQty).toFixed(2)}</td>
                                                <td className="px-4 py-2 text-right">₹{ded ? Math.round(Number(ded.deadFreight)).toLocaleString('en-IN') : '0'}</td>
                                                <td className="px-4 py-2 text-right text-purple-600">₹{qual ? Math.round(Number(qual.qualityPenalty)).toLocaleString('en-IN') : '0'}</td>
                                                <td className="px-4 py-2 text-right font-bold text-red-600">₹{ded ? Math.round(Number(ded.finalDeduction)).toLocaleString('en-IN') : '0'}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>

                                {/* Quality Proximate parameters */}
                                {aggregateDetails.quality.length > 0 && (
                                  <div>
                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                                      <Activity className="h-3.5 w-3.5 text-blue-600" /> Quality Proximate Analysis Reports
                                    </h4>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-w-4xl shadow-sm">
                                      <table className="w-full text-left text-[10px] border-collapse">
                                        <thead>
                                          <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase bg-slate-50/80">
                                            <th className="px-4 py-2.5">RR No</th>
                                            <th className="px-4 py-2.5 text-right">TM (%)</th>
                                            <th className="px-4 py-2.5 text-right">IM (%)</th>
                                            <th className="px-4 py-2.5 text-right">Ash (%)</th>
                                            <th className="px-4 py-2.5 text-right">VM (%)</th>
                                            <th className="px-4 py-2.5 text-right">FC (%)</th>
                                            <th className="px-4 py-2.5 text-right">GCV ADB (kcal)</th>
                                            <th className="px-4 py-2.5 text-right">GCV ARB (kcal)</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-600 font-mono text-right">
                                          {aggregateDetails.quality.map(q => (
                                            <tr key={q.id} className="hover:bg-slate-50/50">
                                              <td className="px-4 py-2 text-left font-bold text-slate-800">{q.rrNo}</td>
                                              <td className="px-4 py-2">{Number(q.tm).toFixed(2)}%</td>
                                              <td className="px-4 py-2">{Number(q.im).toFixed(2)}%</td>
                                              <td className="px-4 py-2">{Number(q.ash).toFixed(2)}%</td>
                                              <td className="px-4 py-2">{Number(q.vm).toFixed(2)}%</td>
                                              <td className="px-4 py-2">{Number(q.fc).toFixed(2)}%</td>
                                              <td className="px-4 py-2 font-bold text-slate-700">{Math.round(q.gcvAdb)}</td>
                                              <td className="px-4 py-2 font-bold text-slate-700">{Math.round(q.gcvArb)}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}

                                {/* Billings / Payments */}
                                <div>
                                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                                    <BadgeCent className="h-3.5 w-3.5 text-blue-600" /> Commercial Settlements & Payments
                                  </h4>
                                  {aggregateDetails.billings.length === 0 ? (
                                    <p className="text-[10px] text-slate-400 italic">No billings or payments registered for this DO.</p>
                                  ) : (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white max-w-4xl shadow-sm">
                                      <table className="w-full text-left text-[10px] border-collapse">
                                        <thead>
                                          <tr className="border-b border-slate-200 text-slate-400 font-semibold uppercase bg-slate-50/80">
                                            <th className="px-4 py-2.5">Bill No</th>
                                            <th className="px-4 py-2.5">Date</th>
                                            <th className="px-4 py-2.5 text-right">Billed Qty</th>
                                            <th className="px-4 py-2.5 text-right">Bill Amount</th>
                                            <th className="px-4 py-2.5 text-right">TDS</th>
                                            <th className="px-4 py-2.5 text-right">Advance Paid</th>
                                            <th className="px-4 py-2.5 text-right font-bold">Final Payable</th>
                                            <th className="px-4 py-2.5">Remarks</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-600 font-mono">
                                          {aggregateDetails.billings.map(b => (
                                            <tr key={b.id} className="hover:bg-slate-50/50">
                                              <td className="px-4 py-2 font-bold text-slate-800">{b.billNo}</td>
                                              <td className="px-4 py-2">{b.billDate || '—'}</td>
                                              <td className="px-4 py-2 text-right">{Number(b.billQty).toFixed(2)}</td>
                                              <td className="px-4 py-2 text-right">₹{Math.round(Number(b.billAmount)).toLocaleString('en-IN')}</td>
                                              <td className="px-4 py-2 text-right text-red-600">₹{Math.round(Number(b.tds)).toLocaleString('en-IN')}</td>
                                              <td className="px-4 py-2 text-right text-purple-600">₹{Math.round(Number(b.advancePaid)).toLocaleString('en-IN')}</td>
                                              <td className="px-4 py-2 text-right font-bold text-emerald-600 bg-emerald-50/10">₹{Math.round(Number(b.finalPayable)).toLocaleString('en-IN')}</td>
                                              <td className="px-4 py-2 font-sans italic text-slate-400">{b.remarks || '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: RR-wise Explorer */}
      {activeTab === 'rr' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/40">
                  <th className="px-5 py-4 w-12 text-center">SL.</th>
                  <th className="px-5 py-4">RR No.</th>
                  <th className="px-5 py-4">DO No.</th>
                  <th className="px-5 py-4">Siding</th>
                  <th className="px-5 py-4 text-right">Challan Qty</th>
                  <th className="px-5 py-4 text-right text-blue-600">GRN Qty</th>
                  <th className="px-5 py-4 text-right text-emerald-700">Normalised Qty</th>
                  <th className="px-5 py-4 text-right">Ash / VM / FC</th>
                  <th className="px-5 py-4 text-right">GCV ADB/ARB</th>
                  <th className="px-5 py-4 text-right text-red-600">Deduction (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-bold">Loading RR explorer...</td>
                  </tr>
                ) : filteredRRsList.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400 font-bold">No RR records match your criteria.</td>
                  </tr>
                ) : (
                  filteredRRsList.map((r, idx) => {
                    const quality = qualityRecords.find(q => q.rrNo === r.rrNo);
                    const deduction = deductions.find(d => d.rrNo === r.rrNo);

                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-4 font-bold text-slate-400 text-center">{idx + 1}</td>
                        <td className="px-5 py-4 font-mono font-extrabold text-slate-800 uppercase">{r.rrNo}</td>
                        <td className="px-5 py-4 font-mono font-bold text-slate-700 uppercase">{r.doNo}</td>
                        <td className="px-5 py-4 font-semibold">{r.siding}</td>
                        <td className="px-5 py-4 font-mono text-right">{Number(r.rrChQty).toFixed(2)}</td>
                        <td className="px-5 py-4 font-mono text-right text-blue-600 font-semibold">{Number(r.grnQty).toFixed(2)}</td>
                        <td className="px-5 py-4 font-mono text-right text-emerald-700 font-semibold">{Number(r.normalisedQty).toFixed(2)}</td>
                        <td className="px-5 py-4 font-mono text-right text-[10px]">
                          {quality ? (
                            <span>{Number(quality.ash).toFixed(1)}% / {Number(quality.vm).toFixed(1)}% / {Number(quality.fc).toFixed(1)}%</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-mono text-right text-[10px]">
                          {quality ? (
                            <span>{Math.round(quality.gcvAdb)} / {Math.round(quality.gcvArb)} kcal</span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 font-mono text-right text-red-600 font-bold bg-red-50/5">
                          ₹{deduction ? Math.round(Number(deduction.finalDeduction)).toLocaleString('en-IN') : '0'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Unified Search Explorer */}
      {activeTab === 'explorer' && (
        <div className="space-y-6">
          {/* Query Summary Description */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-bold text-slate-400 uppercase tracking-wider">Active Query Scope</span>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                <span className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-1 font-sans">
                  Siding: <strong className="text-blue-700">{selectedSiding}</strong>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                <span className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-1 font-sans">
                  DO Number: <strong className="text-blue-700 font-mono">{selectedDO}</strong>
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                <span className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 flex items-center gap-1 font-sans">
                  RR Number: <strong className="text-blue-700 font-mono">{selectedRR}</strong>
                </span>
              </div>
            </div>
            <button
              onClick={resetFilters}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-all"
            >
              Reset Filters
            </button>
          </div>

          {/* Unified Explorer Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* DO Details Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileText className="h-4.5 w-4.5 text-blue-600" /> Delivery Order (DO) Details ({filteredDOsList.length})
              </h3>
              {filteredDOsList.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No DO records found matching the active filters.</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {filteredDOsList.slice(0, 5).map(d => {
                    const dt = getDORRDetails(d.doNo);
                    return (
                      <div key={d.id} className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50/30">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-slate-800 uppercase text-xs">{d.doNo}</span>
                          <span className={`rounded-full px-2.5 py-0.5 text-[9px] font-bold border ${
                            d.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>{d.status}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-500 font-medium">
                          <div>Siding: <strong className="text-slate-800 block mt-0.5 font-semibold">{d.siding}</strong></div>
                          <div>PO No: <strong className="text-slate-800 block mt-0.5 font-mono font-bold">{d.poNo}</strong></div>
                          <div>Mines: <strong className="text-slate-800 block mt-0.5 font-semibold">{d.mines || '—'}</strong></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5 text-[10px] font-semibold text-slate-400">
                          <div>DO QTY: <strong className="text-slate-800 block mt-0.5 font-mono font-bold">{Number(d.doQty).toLocaleString()} MT</strong></div>
                          <div>LIFTED QTY: <strong className="text-blue-600 block mt-0.5 font-mono font-bold">{dt.sumChQty.toLocaleString()} MT</strong></div>
                          <div>BALANCE: <strong className="text-emerald-700 block mt-0.5 font-mono font-bold">{Math.max(0, Number(d.doQty) - dt.sumChQty).toLocaleString()} MT</strong></div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredDOsList.length > 5 && (
                    <p className="text-[10px] text-slate-400 text-center italic">Showing first 5 entries. Use filters to narrow search.</p>
                  )}
                </div>
              )}
            </div>

            {/* RR & Quality Summary Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-3">
                <ClipboardList className="h-4.5 w-4.5 text-blue-600" /> Railway Receipts & Quality Logs ({filteredRRsList.length})
              </h3>
              {filteredRRsList.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No RR entries found matching the active filters.</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                  {filteredRRsList.slice(0, 5).map(r => {
                    const quality = qualityRecords.find(q => q.rrNo === r.rrNo);
                    const deduction = deductions.find(d => d.rrNo === r.rrNo);
                    return (
                      <div key={r.id} className="border border-slate-100 rounded-xl p-4 space-y-3 bg-slate-50/30">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-slate-800 uppercase text-xs">RR: {r.rrNo}</span>
                          <span className="text-[9px] font-mono text-slate-400">DO: {r.doNo}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-500 font-medium text-right">
                          <div className="text-left">Siding: <strong className="text-slate-800 block mt-0.5 font-semibold text-left">{r.siding}</strong></div>
                          <div>Challan Qty: <strong className="text-slate-800 block mt-0.5 font-mono">{Number(r.rrChQty).toFixed(1)} MT</strong></div>
                          <div>GRN Qty: <strong className="text-blue-600 block mt-0.5 font-mono">{Number(r.grnQty).toFixed(1)} MT</strong></div>
                          <div>Normalised: <strong className="text-emerald-700 block mt-0.5 font-mono">{Number(r.normalisedQty).toFixed(1)} MT</strong></div>
                        </div>
                        
                        {/* Quality & Penalties subpane */}
                        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-2.5 text-[10px] font-semibold text-slate-400">
                          <div>
                            <span>Proximate Analysis:</span>
                            {quality ? (
                              <div className="mt-1 text-slate-700 font-mono text-[9px] space-y-0.5 font-bold">
                                <div>TM: {quality.tm}% | IM: {quality.im}%</div>
                                <div>Ash: {quality.ash}% | FC: {quality.fc}%</div>
                                <div className="text-blue-600">GCV: {Math.round(quality.gcvAdb)} / {Math.round(quality.gcvArb)} kcal</div>
                              </div>
                            ) : (
                              <div className="mt-1 text-slate-400 font-normal italic">No quality report logged.</div>
                            )}
                          </div>
                          <div className="text-right">
                            <span>Settlement Audit:</span>
                            <div className="mt-1 font-mono text-[9px] space-y-0.5 font-bold text-slate-700">
                              <div>Dead Freight: ₹{deduction ? Math.round(Number(deduction.deadFreight)).toLocaleString('en-IN') : '0'}</div>
                              <div>Shortage: ₹{deduction ? Math.round(Number(deduction.shortage)).toLocaleString('en-IN') : '0'}</div>
                              <div className="text-red-600">Total Deduction: ₹{deduction ? Math.round(Number(deduction.finalDeduction)).toLocaleString('en-IN') : '0'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {filteredRRsList.length > 5 && (
                    <p className="text-[10px] text-slate-400 text-center italic">Showing first 5 entries. Use filters to narrow search.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
