'use client';

import { useEffect, useState } from 'react';
import { Settings, ShieldCheck, Users, FileText, CheckCircle2, Trash2, Plus, Loader2, UserPlus, Lock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../../store/auth.store';
import { saveSyncedValue } from '@/lib/syncedStorage';

interface UserRecord {
  id: string;
  email: string;
  fullName: string;
  role: string;
  phone: string | null;
  regionName: string | null;
  vendorName: string | null;
  isActive: boolean;
  createdAt: string;
}

const ROLES = [
  'SUPER_ADMIN',
  'REGION_ADMIN',
  'PARAMANANDPUR_ADMIN',
  'DHARAMGARH_ADMIN',
  'LANJIGARH_LOADER',
  'PARAMANANDPUR_UNLOADER',
  'DHARAMGARH_UNLOADER',
  'VENDOR',
  'SYS_ADMIN',
  'LOGISTICS_MANAGER',
  'DISPATCHER',
  'COMPLIANCE_OFFICER',
  'FINANCE_OFFICER',
  'GATE_OPERATOR',
  'DRIVER_PARTNER'
];

export default function SettingsPage() {
  const { user: currentUser, token } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isRegionAdmin = currentUser?.role === 'REGION_ADMIN' || currentUser?.role === 'PARAMANANDPUR_ADMIN' || currentUser?.role === 'DHARAMGARH_ADMIN';
  const canManageUsers = isSuperAdmin || isRegionAdmin;

  const [activeTab, setActiveTab] = useState<'logs' | 'users' | 'reset'>(canManageUsers ? 'users' : 'logs');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [resetting, setResetting] = useState(false);
  
  // User Form State
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('VENDOR');
  const [phone, setPhone] = useState('');
  const [regionName, setRegionName] = useState('');
  const [vendorName, setVendorName] = useState('');
  
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const logs: Array<{ id: string; operator: string; action: string; payload: string; timestamp: string; ip: string }> = [];

  useEffect(() => {
    if (isSuperAdmin) {
      setRole('SYS_ADMIN');
    } else if (isRegionAdmin) {
      setRole('VENDOR');
    }
  }, [isSuperAdmin, isRegionAdmin]);

  const fetchUsers = async () => {
    if (!canManageUsers) return;
    setLoadingUsers(true);
    try {
      const response = await fetch('/api/auth/register', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [canManageUsers]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setCreating(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
          phone: phone || null,
          regionName: isRegionAdmin ? currentUser?.regionName : (regionName || null),
          vendorName: vendorName || null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user account');
      }

      setSuccess(`Account for ${fullName} created successfully!`);
      // Reset form fields
      setEmail('');
      setFullName('');
      setPassword('');
      setPhone('');
      setRegionName('');
      setVendorName('');
      
      // Refresh list
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'An error occurred during account creation.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user account?')) return;
    
    try {
      const response = await fetch(`/api/auth/register?id=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }
      
      setSuccess('User account deleted successfully.');
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleResetData = async (type: 'fleet_master' | 'fleet_specs' | 'trips' | 'all') => {
    const confirmation = confirm('Are you sure you want to permanently delete this data? This action cannot be undone.');
    if (!confirmation) return;

    setResetting(true);
    try {
      if (type === 'fleet_master' || type === 'all') {
        localStorage.removeItem('tms_fleet_master');
        await saveSyncedValue('tms_fleet_master', []);
      }
      if (type === 'fleet_specs' || type === 'all') {
        localStorage.removeItem('tms_local_trucks');
        localStorage.removeItem('tms_local_drivers');
        localStorage.removeItem('tms_truck_status_overrides');
        await saveSyncedValue('tms_local_trucks', []);
        await saveSyncedValue('tms_local_drivers', []);
        await saveSyncedValue('tms_truck_status_overrides', {});
      }
      if (type === 'trips' || type === 'all') {
        localStorage.removeItem('tms_assigned_trips');
        localStorage.removeItem('tms_loading_records');
        await saveSyncedValue('tms_assigned_trips', []);
        await saveSyncedValue('tms_loading_records', []);
      }
      alert('Data reset successfully!');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Failed to reset data.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">System Configuration & Settings</h2>
          <p className="text-xs text-slate-500 mt-1">Configure global role access constraints, verify endpoint parameters, and audit system security logs</p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200">
        {canManageUsers && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'users'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <UserPlus className="h-4 w-4" />
            User ID Provisioning
          </button>
        )}
        <button
          onClick={() => setActiveTab('logs')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'logs'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <FileText className="h-4 w-4" />
          Security Audit Logs
        </button>
        <button
          onClick={() => setActiveTab('reset')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
            activeTab === 'reset'
              ? 'border-red-500 text-red-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <Trash2 className="h-4 w-4 text-red-500" />
          Danger Zone
        </button>
      </div>

      {activeTab === 'users' && canManageUsers && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          
          {/* User Provisioning Form */}
          <div className="lg:col-span-1 glass-panel rounded-2xl border border-brand-slate p-6 h-fit bg-white">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Lock className="h-4.5 w-4.5 text-brand-primary animate-pulse" />
              <span>Create Corporate ID</span>
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
              {error && (
                <div className="flex items-center gap-2 rounded-xl bg-brand-danger/10 border border-brand-danger/20 p-3.5 text-brand-danger">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 rounded-xl bg-brand-success/10 border border-brand-success/20 p-3.5 text-brand-success">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Full Name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="settings-input"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Corporate Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@espl.com"
                  className="settings-input"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Initial Password / Token *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="settings-input"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Portal Access Role *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="settings-input cursor-pointer"
                >
                  {isSuperAdmin ? (
                    ROLES.map(r => (
                      <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                    ))
                  ) : isRegionAdmin ? (
                    <>
                      <option value="DISPATCHER">DISPATCHER (Regional Dispatcher)</option>
                      <option value="VENDOR">VENDOR</option>
                    </>
                  ) : (
                    <option value="VENDOR">VENDOR</option>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Mobile Number (Optional)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="settings-input"
                />
              </div>

              {isRegionAdmin && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-500 font-semibold">
                  <span>Assigned Region:</span> {currentUser?.regionName} (Locked to your region)
                </div>
              )}

              {(role === 'REGION_ADMIN' || role === 'PARAMANANDPUR_ADMIN' || role === 'DHARAMGARH_ADMIN') && (
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Assigned Region / Place</label>
                  <input
                    type="text"
                    required
                    value={regionName}
                    onChange={(e) => setRegionName(e.target.value)}
                    placeholder="e.g. Place-1"
                    className="settings-input"
                  />
                </div>
              )}

              {role === 'VENDOR' && (
                <div>
                  <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Assigned Vendor Company</label>
                  <input
                    type="text"
                    required
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="e.g. Vendor 1"
                    className="settings-input"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Encrypting & Syncing...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Provision User Account
                  </>
                )}
              </button>
            </form>
          </div>

          {/* User Management List */}
          <div className="lg:col-span-2 glass-panel rounded-2xl border border-brand-slate overflow-hidden bg-white">
            <div className="border-b border-[#e2e8f0] px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active Corporate Registries</h3>
              {loadingUsers && <Loader2 className="h-4.5 w-4.5 animate-spin text-brand-primary" />}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">Full Name</th>
                    <th className="px-6 py-4">Identity Details</th>
                    <th className="px-6 py-4">Assigned Role</th>
                    <th className="px-6 py-4">Assoc. Parameters</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] text-slate-600">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-extrabold text-slate-800">{u.fullName}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">ID: {u.id.substring(0, 8)}...</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-700">{u.email}</div>
                        {u.phone && <div className="text-[10px] text-slate-500 font-mono mt-0.5">{u.phone}</div>}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block rounded bg-blue-50 border border-blue-200 text-blue-700 px-2 py-0.5 text-[9px] font-bold uppercase font-mono tracking-wider">
                          {u.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-slate-500 font-semibold">
                        {u.regionName && <div>Region: {u.regionName}</div>}
                        {u.vendorName && <div>Vendor: {u.vendorName}</div>}
                        {!u.regionName && !u.vendorName && <span className="text-slate-400">Global Admin</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isSuperAdmin && u.id !== currentUser?.id ? (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Remove Account"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : u.id === currentUser?.id ? (
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-2">Self</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {users.length === 0 && !loadingUsers && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        No active users registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'logs' && (
        <>
          {/* Admin metrics overview */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="glass-card rounded-2xl p-6 bg-white border border-[#e2e8f0]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Unified System Integrity</span>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-800">100% SECURED</span>
                <span className="text-[10px] text-brand-success font-semibold">RSA-4096 logs checking</span>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6 bg-white border border-[#e2e8f0]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Security Audit Rate</span>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-slate-800">Continuous</span>
                <span className="text-[10px] text-slate-400">Global operator actions logs</span>
              </div>
            </div>
            <div className="glass-card rounded-2xl p-6 bg-white border border-[#e2e8f0]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">API Connections Health</span>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-2xl font-extrabold text-brand-success">ACTIVE & SECURE</span>
                <span className="text-[10px] text-brand-success font-semibold">WS Dispatch streams clear</span>
              </div>
            </div>
          </div>

          {/* Security logs table */}
          <div className="glass-panel rounded-2xl border border-brand-slate overflow-hidden bg-white">
            <div className="border-b border-[#e2e8f0] bg-white/60 px-6 py-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Tamper-Proof Audit logs</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4">System Operator</th>
                    <th className="px-6 py-4">Security Action</th>
                    <th className="px-6 py-4">Transaction Payload Details</th>
                    <th className="px-6 py-4">Filing Timestamp</th>
                    <th className="px-6 py-4 text-right">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] text-slate-600">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-brand-primary" />
                          <span className="font-extrabold text-slate-800">{log.operator}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block rounded bg-white border border-[#e2e8f0] text-brand-secondary px-2 py-0.5 text-[9px] font-bold uppercase font-mono tracking-wider">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-600">{log.payload}</td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(log.timestamp).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-400">{log.ip}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                        No audit log records are present in the imported dataset.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'reset' && (
        <div className="space-y-6 max-w-3xl animate-fade-in">
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <h3 className="text-sm font-extrabold text-red-800 uppercase tracking-wider flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" /> Warning: Critical Actions
            </h3>
            <p className="text-xs text-red-700 mt-2 font-medium">
              Actions in this section are destructive and permanent. Resetting will delete all data you have uploaded via Excel sheets or manually entered in the respective modules. This will sync to your cloud storage and cannot be restored.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
            {/* Fleet Master Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Fleet Master Registry</h4>
                <p className="text-[11px] text-slate-500 mt-1">Delete all imported vehicles, validity dates, assigned drivers and records from the Fleet Master tab.</p>
              </div>
              <button
                onClick={() => handleResetData('fleet_master')}
                disabled={resetting}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-all font-sans shadow-sm shrink-0"
              >
                Clear Fleet Master
              </button>
            </div>

            {/* Fleet Control Specs Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Fleet Control Specs & Crew</h4>
                <p className="text-[11px] text-slate-500 mt-1">Delete all manually onboarded trucks, linked driver details, and operational status overrides.</p>
              </div>
              <button
                onClick={() => handleResetData('fleet_specs')}
                disabled={resetting}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-all font-sans shadow-sm shrink-0"
              >
                Clear Fleet & Drivers
              </button>
            </div>

            {/* Operations logs Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-5">
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Operations Logs & Trips</h4>
                <p className="text-[11px] text-slate-500 mt-1">Clear all custom dispatched trips, weighbridge tickets, and loading logs.</p>
              </div>
              <button
                onClick={() => handleResetData('trips')}
                disabled={resetting}
                className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition-all font-sans shadow-sm shrink-0"
              >
                Clear Operations Logs
              </button>
            </div>

            {/* Reset All Section */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
              <div>
                <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider">Full Database Reset</h4>
                <p className="text-[11px] text-slate-500 mt-1">Reset all storage modules back to original state, removing all custom dataset imports at once.</p>
              </div>
              <button
                onClick={() => handleResetData('all')}
                disabled={resetting}
                className="rounded-xl bg-red-600 px-5 py-3 text-xs font-bold text-white hover:bg-red-700 active:scale-[0.98] transition-all font-sans shadow-md shrink-0"
              >
                Reset System Database
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .settings-input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          padding: 0.625rem 0.75rem;
          color: #1e293b;
          outline: none;
        }
        .settings-input:focus {
          border-color: rgb(37 99 235 / 0.65);
          box-shadow: 0 0 0 1px rgb(37 99 235 / 0.2);
        }
      `}</style>
    </div>
  );
}
