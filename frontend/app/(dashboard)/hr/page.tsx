'use client';

import { useEffect, useState } from 'react';
import { Users, Plus, ShieldCheck, DollarSign, Award, ArrowUpRight, X, ArrowRight } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  salary: number;
  allowance: number;
  safetyScore: number;
  joinDate: string;
}

import { getEmployees } from '@/app/data/dataHelper';

const MANUAL_EMPLOYEES_KEY = 'tms_manual_employees';

export default function HRPage() {
  const [employees, setEmployees] = useState<Employee[]>(() => getEmployees());
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', email: '', department: 'DRIVER_PARTNER', salary: '', allowance: ''
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(MANUAL_EMPLOYEES_KEY);
      if (!saved) return;
      const manualEmployees = JSON.parse(saved) as Employee[];
      setEmployees([...manualEmployees, ...getEmployees()]);
    } catch {
      localStorage.removeItem(MANUAL_EMPLOYEES_KEY);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newEmployee: Employee = {
      id: `manual-${Date.now()}`,
      name: formData.name,
      email: formData.email,
      department: formData.department,
      salary: parseFloat(formData.salary) || 0,
      allowance: parseFloat(formData.allowance) || 0,
      safetyScore: 100,
      joinDate: new Date().toISOString().split('T')[0]
    };
    const existingManual = employees.filter(emp => emp.id.startsWith('manual-'));
    localStorage.setItem(MANUAL_EMPLOYEES_KEY, JSON.stringify([newEmployee, ...existingManual]));
    setEmployees([newEmployee, ...employees]);
    setShowModal(false);
    setFormData({ name: '', email: '', department: 'DRIVER_PARTNER', salary: '', allowance: '' });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">HR & Employee Payroll</h2>
          <p className="text-xs text-slate-500 mt-1">Manage corporate personnel records, employee base salaries, and driver allowance indexes (₹ / INR)</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 px-5 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center gap-2 font-sans font-extrabold shadow-md"
        >
          <Plus className="h-4.5 w-4.5" /> Enlist New Employee
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Aggregate Payroll Expenditure</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{formatCurrency(employees.reduce((sum, e) => sum + e.salary, 0))} / mo</span>
            <span className="text-[10px] text-slate-400 font-semibold">100% disbursed</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Corporate Headcount</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-800">{employees.length} Personnel</span>
            <span className="text-[10px] text-slate-400">Continuous background checks</span>
          </div>
        </div>
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Safety Performance Bonus</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600">{formatCurrency(25000)} Approved</span>
            <span className="text-[10px] text-emerald-600 font-semibold">Driver safety score &gt; 92%</span>
          </div>
        </div>
      </div>

      {/* Employees Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Users className="h-4 w-4 text-blue-600" /> Employee Registry
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Full Name</th>
                <th className="px-6 py-4">Department / Role</th>
                <th className="px-6 py-4">Base Salary</th>
                <th className="px-6 py-4">Transit Allowance / day</th>
                <th className="px-6 py-4">Safety Audit Index</th>
                <th className="px-6 py-4 text-right">Join Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              {employees.map(emp => (
                <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <span className="font-extrabold text-slate-800">{emp.name}</span>
                      <div className="text-[10px] text-slate-400 mt-0.5">{emp.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-block rounded bg-white border border-slate-200 text-slate-600 px-2 py-0.5 text-[9px] font-bold uppercase font-mono tracking-wider shadow-sm">
                      {emp.department.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-800">{formatCurrency(emp.salary)} <span className="text-[10px] font-normal text-slate-400">/ mo</span></td>
                  <td className="px-6 py-4 font-mono font-semibold text-slate-500">
                    {emp.allowance > 0 ? `${formatCurrency(emp.allowance)} / day` : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-600">
                      <ShieldCheck className="h-4 w-4" />
                      <span>{emp.safetyScore}%</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-slate-400">
                    {new Date(emp.joinDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enlist Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">Enlist New Employee</h3>
                <p className="text-[10px] text-slate-500 font-semibold uppercase mt-0.5">Add personnel to corporate registry</p>
              </div>
              <button onClick={() => setShowModal(false)} className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 transition-all">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Full Name *</label>
                  <input 
                    type="text" required placeholder="e.g. Aditi Rao"
                    value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Corporate Email *</label>
                  <input 
                    type="email" required placeholder="e.g. aditi@logistics.com"
                    value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Department / Role *</label>
                <select 
                  value={formData.department} onChange={(e) => setFormData({...formData, department: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all"
                >
                  <option value="DRIVER_PARTNER">Driver Partner</option>
                  <option value="FINANCE_OFFICER">Finance Officer</option>
                  <option value="LOGISTICS_OPS">Logistics Operations</option>
                  <option value="SYS_ADMIN">System Administrator</option>
                  <option value="HR_MANAGER">HR Manager</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Base Salary (₹ / mo) *</label>
                  <input 
                    type="number" required placeholder="e.g. 45000"
                    value={formData.salary} onChange={(e) => setFormData({...formData, salary: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1.5 uppercase font-bold tracking-wider text-[10px]">Transit Allowance (₹ / day)</label>
                  <input 
                    type="number" placeholder="e.g. 500"
                    value={formData.allowance} onChange={(e) => setFormData({...formData, allowance: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary focus:ring-1 transition-all font-mono"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl bg-slate-100 border border-slate-200 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-all">
                  Cancel
                </button>
                <button type="submit" className="flex-[2] rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md">
                  Enlist Personnel <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
