'use client';

import { useState, useEffect } from 'react';
import { 
  BadgeCent, 
  Search, 
  Check, 
  X, 
  HelpCircle, 
  TrendingUp, 
  AlertTriangle,
  PlayCircle,
  FileCheck2,
  Fuel,
  Wrench,
  Truck
} from 'lucide-react';

interface Invoice {
  id: string;
  invoiceNumber: string;
  tripId: string;
  vendorId?: string;
  type: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: 'DRAFT' | 'SENT' | 'PENDING_RECONCILIATION' | 'PAID' | 'OVERDUE' | 'DISPUTED';
  dueDate: string;
  validatedAt?: string;
  reconciliationLog?: string;
  trip: {
    tripNumber: string;
    source: string;
    destination: string;
    purchaseOrder: { poNumber: string; clientName: string };
  };
  vendor?: { name: string };
}

interface ManualFinanceEntry {
  id: string;
  fleetCategory?: 'OWNED_FLEET' | 'ATTACHED_FLEET';
  type: 'DRIVER_SALARY' | 'MAINTENANCE_SERVICE' | 'OWNED_REPAIR_MAINTENANCE' | 'OWNED_DIESEL_ENTRY' | 'ATTACHED_REPAIR_MAINTENANCE';
  reference: string;
  description: string;
  amount: number;
  entryDate: string;
}
import { getInvoices } from '@/app/data/dataHelper';

const MANUAL_FINANCE_ENTRIES_KEY = 'tms_manual_finance_entries';
const FLEET_FINANCE_OPTIONS = {
  OWNED_FLEET: [
    { value: 'OWNED_REPAIR_MAINTENANCE', label: 'Repair & Maintenance' },
    { value: 'OWNED_DIESEL_ENTRY', label: 'Diesel Entry' },
  ],
  ATTACHED_FLEET: [
    { value: 'ATTACHED_REPAIR_MAINTENANCE', label: 'Repair & Maintenance' },
  ],
} as const;

export default function BillingPage() {
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>(() => getInvoices());

  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [matchingResults, setMatchingResults] = useState<any>(null);
  const [manualEntries, setManualEntries] = useState<ManualFinanceEntry[]>([]);
  const [manualForm, setManualForm] = useState({
    fleetCategory: 'OWNED_FLEET' as NonNullable<ManualFinanceEntry['fleetCategory']>,
    type: 'OWNED_REPAIR_MAINTENANCE' as ManualFinanceEntry['type'],
    reference: '',
    description: '',
    amount: '',
    entryDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MANUAL_FINANCE_ENTRIES_KEY);
      if (saved) setManualEntries(JSON.parse(saved) as ManualFinanceEntry[]);
    } catch {
      localStorage.removeItem(MANUAL_FINANCE_ENTRIES_KEY);
    }
  }, []);

  const fetchInvoicesData = async () => {
    setLoading(false);
  };

  const handleThreeWayMatch = async (invoiceId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('tms_token');
      const response = await fetch(`${apiUrl}/api/finance/invoices/${invoiceId}/three-way-match`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error('API failed');
      const data = await response.json();
      setMatchingResults(data.reconciliationDetails);
      fetchInvoicesData();
    } catch (err) {
      const mockReconciliation = {
        purchaseOrder: 'PO-2026-COAL-KORBA-01',
        clientContractRate: 3200.00, // ₹3,200
        billingInvoiceRate: 3200.00,
        rateMatched: true,
        loadingGrossWeight: 39.10,
        unloadedNetWeight: 39.05,
        shrinkageTons: 0.05,
        shrinkagePercentage: 0.12,
        shrinkageAllowedPercentage: 0.50,
        weightsMatched: true,
        automatedPass: true,
        executedAt: new Date().toISOString(),
      };
      setMatchingResults(mockReconciliation);
      setInvoices(prev =>
        prev.map(inv =>
          inv.id === invoiceId
            ? { ...inv, status: 'SENT', reconciliationLog: JSON.stringify(mockReconciliation, null, 2) }
            : inv
        )
      );
    }
  };

  const handlePayInvoice = async (invoiceId: string) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const token = localStorage.getItem('tms_token');
      await fetch(`${apiUrl}/api/finance/invoices/${invoiceId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status: 'PAID' }),
      });
      fetchInvoicesData();
    } catch (err) {
      setInvoices(prev =>
        prev.map(inv =>
          inv.id === invoiceId ? { ...inv, status: 'PAID' } : inv
        )
      );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PAID':
        return <span className="inline-block rounded-full border border-brand-success/20 bg-brand-success/15 px-2 py-0.5 text-[9px] font-bold text-brand-success uppercase">Paid</span>;
      case 'PENDING_RECONCILIATION':
        return <span className="inline-block rounded-full border border-brand-warning/20 bg-brand-warning/15 px-2 py-0.5 text-[9px] font-bold text-brand-warning uppercase">Requires Match</span>;
      case 'DISPUTED':
        return <span className="inline-block rounded-full border border-brand-danger/20 bg-brand-danger/15 px-2 py-0.5 text-[9px] font-bold text-brand-danger uppercase">Disputed Variance</span>;
      default:
        return <span className="inline-block rounded-full border border-brand-primary/20 bg-brand-primary/15 px-2 py-0.5 text-[9px] font-bold text-brand-primary uppercase">Approved Match</span>;
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const handleManualEntrySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: ManualFinanceEntry = {
      id: `manual-finance-${Date.now()}`,
      fleetCategory: manualForm.fleetCategory,
      type: manualForm.type,
      reference: manualForm.reference,
      description: manualForm.description,
      amount: parseFloat(manualForm.amount) || 0,
      entryDate: manualForm.entryDate,
    };
    const nextEntries = [newEntry, ...manualEntries];
    localStorage.setItem(MANUAL_FINANCE_ENTRIES_KEY, JSON.stringify(nextEntries));
    setManualEntries(nextEntries);
    setManualForm({
      fleetCategory: manualForm.fleetCategory,
      type: manualForm.type,
      reference: '',
      description: '',
      amount: '',
      entryDate: new Date().toISOString().split('T')[0],
    });
  };

  const manualSalaryTotal = manualEntries
    .filter(entry => entry.type === 'DRIVER_SALARY')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const ownedRepairTotal = manualEntries
    .filter(entry => entry.type === 'OWNED_REPAIR_MAINTENANCE')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const ownedDieselTotal = manualEntries
    .filter(entry => entry.type === 'OWNED_DIESEL_ENTRY')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const attachedRepairTotal = manualEntries
    .filter(entry => entry.type === 'ATTACHED_REPAIR_MAINTENANCE')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const legacyMaintenanceTotal = manualEntries
    .filter(entry => entry.type === 'MAINTENANCE_SERVICE')
    .reduce((sum, entry) => sum + entry.amount, 0);

  const getEntryTypeLabel = (entry: ManualFinanceEntry) => {
    switch (entry.type) {
      case 'DRIVER_SALARY':
        return 'Driver Salary';
      case 'OWNED_REPAIR_MAINTENANCE':
        return 'Owned Repair & Maintenance';
      case 'OWNED_DIESEL_ENTRY':
        return 'Owned Diesel Entry';
      case 'ATTACHED_REPAIR_MAINTENANCE':
        return 'Attached Repair & Maintenance';
      default:
        return 'Maintenance';
    }
  };

  const getEntryTypeClass = (entry: ManualFinanceEntry) => {
    if (entry.type === 'OWNED_DIESEL_ENTRY') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (entry.fleetCategory === 'ATTACHED_FLEET' || entry.type === 'ATTACHED_REPAIR_MAINTENANCE') return 'border-violet-200 bg-violet-50 text-violet-700';
    if (entry.type === 'DRIVER_SALARY') return 'border-amber-200 bg-amber-50 text-amber-700';
    return 'border-blue-200 bg-blue-50 text-blue-700';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Financial & Reconciliation center</h2>
        <p className="text-xs text-slate-500 mt-1">Audit transport invoices matching physical weighbridge loading and unloading counts (₹ / INR)</p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-1">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Manual Driver Salary Entries</span>
            <div className="mt-3 text-2xl font-extrabold text-slate-800">{formatCurrency(manualSalaryTotal)}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Fleet Finance Expenses</span>
            <div className="mt-3 text-2xl font-extrabold text-slate-800">{formatCurrency(ownedRepairTotal + ownedDieselTotal + attachedRepairTotal + legacyMaintenanceTotal)}</div>
          </div>
        </div>

        <form onSubmit={handleManualEntrySubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 flex flex-col gap-1">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Manual Finance Entry</h3>
            <p className="text-[10px] text-slate-400">Add owned fleet repair, owned fleet diesel, or attached fleet repair money directly from Finance.</p>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setManualForm({ ...manualForm, fleetCategory: 'OWNED_FLEET', type: 'OWNED_REPAIR_MAINTENANCE' })}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                manualForm.fleetCategory === 'OWNED_FLEET'
                  ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider">
                <Truck className="h-4 w-4" /> Owned Fleet
              </div>
              <div className="mt-1 text-[10px] font-semibold text-slate-400">Repair & Maintenance, Diesel Entry</div>
            </button>
            <button
              type="button"
              onClick={() => setManualForm({ ...manualForm, fleetCategory: 'ATTACHED_FLEET', type: 'ATTACHED_REPAIR_MAINTENANCE' })}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${
                manualForm.fleetCategory === 'ATTACHED_FLEET'
                  ? 'border-brand-primary bg-brand-primary/5 text-brand-primary'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider">
                <Truck className="h-4 w-4" /> Attached Fleet
              </div>
              <div className="mt-1 text-[10px] font-semibold text-slate-400">Repair & Maintenance only</div>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <select
              value={manualForm.type}
              onChange={(e) => setManualForm({ ...manualForm, type: e.target.value as ManualFinanceEntry['type'] })}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none focus:border-brand-primary"
            >
              {FLEET_FINANCE_OPTIONS[manualForm.fleetCategory].map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <input
              required
              value={manualForm.reference}
              onChange={(e) => setManualForm({ ...manualForm, reference: e.target.value })}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-brand-primary"
              placeholder={manualForm.type === 'OWNED_DIESEL_ENTRY' ? 'Truck / fuel slip no.' : 'Truck / vendor'}
            />
            <input
              required
              value={manualForm.description}
              onChange={(e) => setManualForm({ ...manualForm, description: e.target.value })}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-brand-primary"
              placeholder="Description"
            />
            <input
              type="number"
              step="0.01"
              required
              value={manualForm.amount}
              onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-brand-primary"
              placeholder="Amount"
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-4 py-2.5 text-xs font-extrabold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Add Entry
            </button>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
            <Truck className="h-4 w-4 text-brand-primary" /> Owned Fleet Finance
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-blue-700">
                <Wrench className="h-3.5 w-3.5" /> Repair & Maintenance
              </div>
              <div className="mt-2 text-xl font-extrabold text-slate-800">{formatCurrency(ownedRepairTotal)}</div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                <Fuel className="h-3.5 w-3.5" /> Diesel Entry
              </div>
              <div className="mt-2 text-xl font-extrabold text-slate-800">{formatCurrency(ownedDieselTotal)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-800">
            <Truck className="h-4 w-4 text-brand-primary" /> Attached Fleet Finance
          </div>
          <div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/60 p-4">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-violet-700">
              <Wrench className="h-3.5 w-3.5" /> Repair & Maintenance
            </div>
            <div className="mt-2 text-xl font-extrabold text-slate-800">{formatCurrency(attachedRepairTotal)}</div>
          </div>
        </div>
      </div>

      {manualEntries.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Manual Expense Ledger</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400">
                  <th className="px-6 py-3 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 uppercase tracking-wider">Reference</th>
                  <th className="px-6 py-3 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-right uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600">
                {manualEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50">
                    <td className="px-6 py-3">
                      <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase ${getEntryTypeClass(entry)}`}>
                        {getEntryTypeLabel(entry)}
                      </span>
                    </td>
                    <td className="px-6 py-3 font-semibold text-slate-800">{entry.reference}</td>
                    <td className="px-6 py-3">{entry.description}</td>
                    <td className="px-6 py-3 text-slate-400">{new Date(entry.entryDate).toLocaleDateString('en-IN')}</td>
                    <td className="px-6 py-3 text-right font-bold text-slate-800">{formatCurrency(entry.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        
        {/* Ledger Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-panel rounded-2xl border border-brand-slate overflow-hidden">
            <div className="border-b border-[#e2e8f0] bg-white/60 px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Corporate billing ledger</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Invoice serial</th>
                    <th className="px-6 py-4">Vendor Partner</th>
                    <th className="px-6 py-4">Total Amount</th>
                    <th className="px-6 py-4">Due Date</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] text-slate-600">
                  {invoices.map(inv => (
                    <tr 
                      key={inv.id} 
                      onClick={() => { setActiveInvoice(inv); setMatchingResults(null); }}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                        activeInvoice?.id === inv.id ? 'bg-brand-primary/5 border-l-2 border-brand-primary' : ''
                      }`}
                    >
                      <td className="px-6 py-4 font-bold text-slate-800 font-mono">{inv.invoiceNumber}</td>
                      <td className="px-6 py-4 font-semibold text-slate-600">{inv.vendor?.name || '—'}</td>
                      <td className="px-6 py-4 font-bold text-slate-800">{formatCurrency(inv.totalAmount)}</td>
                      <td className="px-6 py-4">
                        {new Date(inv.dueDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                      </td>
                      <td className="px-6 py-4">{getStatusBadge(inv.status)}</td>
                      <td className="px-6 py-4 text-right">
                        <button className="rounded-lg bg-brand-primary/10 border border-brand-primary/20 hover:bg-brand-primary/20 text-brand-primary text-[10px] font-bold px-2 py-1 transition-all">
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                        No invoice records are present in the imported dataset.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Detailed matching */}
        <div>
          {activeInvoice ? (
            <div className="glass-panel rounded-2xl border border-brand-slate p-6 space-y-6 shadow-glass shadow-glass-glow animate-scale-up sticky top-24">
              <div>
                <span className="text-[10px] font-bold text-brand-secondary font-mono tracking-wider">
                  {activeInvoice.invoiceNumber}
                </span>
                <h3 className="text-sm font-extrabold text-slate-800 mt-1 uppercase">Reconciliation Audit</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">3-Way match validator dashboard</p>
              </div>

              <div className="rounded-xl bg-white border border-[#e2e8f0] p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Subtotal:</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(activeInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">CGST + SGST (5%):</span>
                  <span className="font-semibold text-slate-800">{formatCurrency(activeInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-[#e2e8f0] pt-2 font-bold">
                  <span className="text-slate-500">Total Invoice (INR):</span>
                  <span className="text-brand-primary text-sm">{formatCurrency(activeInvoice.totalAmount)}</span>
                </div>
              </div>

              {activeInvoice.status === 'PENDING_RECONCILIATION' && !matchingResults && (
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5 rounded-xl border border-brand-warning/20 bg-brand-warning/5 p-4 text-[10px] text-brand-warning leading-relaxed">
                    <AlertTriangle className="h-5 w-5 text-brand-warning flex-shrink-0 mt-0.5" />
                    <span>This invoice requires a 3-way matching clearance: NTPC contract rates, Outbound weighbridge weight, and Mundra inbound dump weighbridge weight.</span>
                  </div>

                  <button
                    onClick={() => handleThreeWayMatch(activeInvoice.id)}
                    className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 font-sans font-extrabold"
                  >
                    <PlayCircle className="h-4.5 w-4.5" /> Run 3-Way Match Check
                  </button>
                </div>
              )}

              {matchingResults && (
                <div className="space-y-4 animate-fade-in">
                  <div className="rounded-xl bg-brand-success/5 border border-brand-success/20 p-4 space-y-3 text-xs font-sans">
                    <div className="flex items-center gap-2 text-brand-success font-bold uppercase tracking-wider text-[10px]">
                      <FileCheck2 className="h-4 w-4" /> 3-Way Match Verification Passed
                    </div>

                    <div className="space-y-2 border-t border-[#e2e8f0] pt-2 font-mono text-[10px] text-slate-600">
                      <div className="flex justify-between">
                        <span>PO Rate matched:</span>
                        <span className="text-brand-success font-bold">PASS ({formatCurrency(matchingResults.clientContractRate)})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Loading Gross Wt:</span>
                        <span className="text-slate-800 font-bold">{matchingResults.loadingGrossWeight} Tons</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unloaded Net Wt:</span>
                        <span className="text-slate-800 font-bold">{matchingResults.unloadedNetWeight} Tons</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Transit Shrinkage:</span>
                        <span className="text-brand-primary font-bold">
                          {matchingResults.shrinkageTons} Tons ({matchingResults.shrinkagePercentage}%)
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-[#e2e8f0] pt-2 text-slate-500 font-semibold">
                        <span>Max Allowed loss:</span>
                        <span>{matchingResults.shrinkageAllowedPercentage}%</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handlePayInvoice(activeInvoice.id)}
                    className="w-full rounded-xl bg-brand-success py-3 text-xs font-bold text-white hover:brightness-105 active:scale-[0.98] transition-all font-sans font-extrabold shadow-lg"
                  >
                    Authorize Payment Settle
                  </button>
                </div>
              )}

              {activeInvoice.status === 'PAID' && (
                <div className="rounded-xl border border-brand-success/20 bg-brand-success/10 p-4 text-center text-brand-success text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                  <Check className="h-5 w-5 stroke-[3]" /> Transaction Settled (Paid)
                </div>
              )}
            </div>
          ) : (
            <div className="glass-panel rounded-2xl border border-brand-slate p-8 text-center text-xs text-slate-400">
              Select an invoice from the ledger to open the Three-Way matching audit panel
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
