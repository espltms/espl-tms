'use client';

import { useEffect, useState } from 'react';
import { Settings, ShieldCheck, Users, FileText, CheckCircle2, Trash2, Plus, Loader2, UserPlus, Lock, AlertCircle, Pencil, X } from 'lucide-react';
import { useAuthStore } from '../../../store/auth.store';
import { saveSyncedValue } from '@/lib/syncedStorage';
import { getRoleDisplayName, normalizeVendorName } from '@/lib/operationalStatus';

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

const STATIC_ROLES = [
  'SUPER_ADMIN',
  'SYS_ADMIN',
  'PARAMANANDPUR_ADMIN',
  'DHARAMGARH_ADMIN',
  'BHAWANIPATNA_ADMIN',
  'LANJIGARH_LOADER',
  'PARAMANANDPUR_UNLOADER',
  'DHARAMGARH_UNLOADER',
  'VENDOR_1',
  'VENDOR_2',
  'VENDOR_3',
  'VENDOR_4',
  'VENDOR_5'
];

const ALL_ROUTES = [
  { path: '/dashboard', label: 'Executive Dashboard (Core)' },
  { path: '/trips', label: 'Trip Dispatch & Loading (Core)' },
  { path: '/unloading', label: 'Unloading Vehicle (Core)' },
  { path: '/fleet-master', label: 'Fleet Master (Fleet)' },
  { path: '/vehicle-summary', label: 'Vehicle Summary (Fleet)' },
  { path: '/drivers', label: 'Driver Duty Logs (Fleet)' },
  { path: '/maintenance', label: 'Workshop & Maintenance (Fleet Finance)' },
  { path: '/fuel-finance', label: 'Fuel Finances (Fleet Finance)' },
  { path: '/hr', label: 'HR & Payroll Center (Fleet)' },
  { path: '/settings', label: 'System Configuration (Finance)' },
];

export default function SettingsPage() {
  const { user: currentUser, token } = useAuthStore();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';
  const isRegionAdmin = currentUser?.role === 'PARAMANANDPUR_ADMIN' || currentUser?.role === 'DHARAMGARH_ADMIN' || currentUser?.role === 'BHAWANIPATNA_ADMIN';
  const canManageUsers = isSuperAdmin || currentUser?.role === 'SYS_ADMIN' || isRegionAdmin;
  const canManageRoles = isSuperAdmin || currentUser?.role === 'SYS_ADMIN';

  const [activeTab, setActiveTab] = useState<'logs' | 'users' | 'roles'>(canManageUsers ? 'users' : 'logs');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  
  // User Form State
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('VENDOR_1');
  const [phone, setPhone] = useState('');
  const [regionName, setRegionName] = useState('');
  const [vendorName, setVendorName] = useState('');
  
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Edit User State
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  // Custom Roles State
  const [customRoles, setCustomRoles] = useState<Array<{ id: string; name: string; routes: string[] }>>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [roleActionError, setRoleActionError] = useState('');
  const [roleActionSuccess, setRoleActionSuccess] = useState('');
  const [creatingRole, setCreatingRole] = useState(false);
  
  const logs: Array<{ id: string; operator: string; action: string; payload: string; timestamp: string; ip: string }> = [];

  const fetchCustomRoles = async () => {
    if (!canManageRoles) return;
    setLoadingRoles(true);
    try {
      const res = await fetch('/api/roles', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success && data.roles) {
        setCustomRoles(data.roles);
      }
    } catch (err) {
      console.error("Failed to load roles", err);
    } finally {
      setLoadingRoles(false);
    }
  };

  useEffect(() => {
    if (canManageRoles) {
      fetchCustomRoles();
    }
  }, [canManageRoles, token]);

  useEffect(() => {
    if (isSuperAdmin || currentUser?.role === 'SYS_ADMIN') {
      setRole('SYS_ADMIN');
    } else if (isRegionAdmin) {
      setRole('VENDOR_1');
    }
  }, [isSuperAdmin, isRegionAdmin, currentUser]);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleActionError('');
    setRoleActionSuccess('');
    if (!newRoleName.trim()) {
      setRoleActionError('Role name is required');
      return;
    }
    if (selectedRoutes.length === 0) {
      setRoleActionError('Please select at least one route access criteria');
      return;
    }

    setCreatingRole(true);
    try {
      const response = await fetch('/api/roles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newRoleName,
          routes: selectedRoutes
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create role');
      }

      setRoleActionSuccess(`Custom role ${newRoleName.toUpperCase()} created successfully!`);
      setNewRoleName('');
      setSelectedRoutes([]);
      fetchCustomRoles();
    } catch (err: any) {
      setRoleActionError(err.message || 'An error occurred during role creation.');
    } finally {
      setCreatingRole(false);
    }
  };

  const handleDeleteRole = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the role ${name}? Users with this role may lose access.`)) return;
    setRoleActionError('');
    setRoleActionSuccess('');
    try {
      const response = await fetch(`/api/roles?id=${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete role');
      }
      setRoleActionSuccess(`Role ${name} deleted successfully.`);
      fetchCustomRoles();
    } catch (err: any) {
      alert(err.message);
    }
  };

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
          vendorName: (role === 'VENDOR_1' ? 'Eastern Stevedores' : (role === 'VENDOR_2' ? 'Mahaveer' : (role.startsWith('VENDOR') ? normalizeVendorName(vendorName) : (vendorName || null))))
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

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setError('');
    setSuccess('');
    setUpdating(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: editingUser.id,
          email: editEmail,
          password: editPassword || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user account');
      }

      setSuccess(`Account for ${editingUser.fullName} updated successfully!`);
      setEditingUser(null);
      setEditEmail('');
      setEditPassword('');
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'An error occurred during account update.');
    } finally {
      setUpdating(false);
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
        {canManageRoles && (
          <button
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === 'roles'
                ? 'border-brand-primary text-brand-primary'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Role Management
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
                  {isSuperAdmin || currentUser?.role === 'SYS_ADMIN' ? (
                    <>
                      {STATIC_ROLES.map(r => (
                        <option key={r} value={r}>{getRoleDisplayName(r)}</option>
                      ))}
                      {customRoles.map(cr => (
                        <option key={cr.id} value={cr.name}>{getRoleDisplayName(cr.name)}</option>
                      ))}
                    </>
                  ) : isRegionAdmin ? (
                    <>
                      <option value="VENDOR_1">Eastern Stevedores</option>
                      <option value="VENDOR_2">Mahaveer</option>
                      <option value="VENDOR_3">Vendor -3</option>
                      <option value="VENDOR_4">Vendor -4</option>
                      <option value="VENDOR_5">Vendor -5</option>
                    </>
                  ) : (
                    <option value="VENDOR_1">Eastern Stevedores</option>
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

              {(role === 'PARAMANANDPUR_ADMIN' || role === 'DHARAMGARH_ADMIN' || role === 'BHAWANIPATNA_ADMIN') && (
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

              {role.startsWith('VENDOR') && (
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
                          {getRoleDisplayName(u.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[10px] text-slate-500 font-semibold">
                        {u.regionName && <div>Region: {u.regionName}</div>}
                        {u.vendorName && <div>Vendor: {u.vendorName}</div>}
                        {!u.regionName && !u.vendorName && <span className="text-slate-400">Global Admin</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isSuperAdmin && u.id !== currentUser?.id ? (
                            <>
                              <button
                                onClick={() => {
                                  setEditingUser(u);
                                  setEditEmail(u.email);
                                  setEditPassword('');
                                }}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 transition-colors"
                                title="Edit Account"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u.id)}
                                className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Remove Account"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : u.id === currentUser?.id ? (
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-2">Self</span>
                          ) : null}
                        </div>
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

      {activeTab === 'roles' && canManageRoles && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 animate-fade-in">
          {/* Role Creation Form */}
          <div className="lg:col-span-1 glass-panel rounded-2xl border border-brand-slate p-6 h-fit bg-white">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-brand-primary" />
              <span>Create Custom Role</span>
            </h3>

            <form onSubmit={handleCreateRole} className="space-y-4 text-xs">
              {roleActionError && (
                <div className="flex items-center gap-2 rounded-xl bg-brand-danger/10 border border-brand-danger/20 p-3.5 text-brand-danger">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{roleActionError}</span>
                </div>
              )}

              {roleActionSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-brand-success/10 border border-brand-success/20 p-3.5 text-brand-success">
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  <span>{roleActionSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Role Name *</label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. Regional Manager"
                  className="settings-input text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">This will be stored as uppercase (e.g. REGIONAL_MANAGER)</p>
              </div>

              <div>
                <label className="block text-slate-500 mb-2 font-bold uppercase tracking-wider">Assign Route Access Criteria *</label>
                <div className="space-y-3 max-h-[350px] overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                  {Object.entries(
                    ALL_ROUTES.reduce((acc, route) => {
                      const group = route.label.match(/\(([^)]+)\)/)?.[1] || 'Other';
                      if (!acc[group]) acc[group] = [];
                      acc[group].push(route);
                      return acc;
                    }, {} as Record<string, typeof ALL_ROUTES>)
                  ).map(([group, routes]) => (
                    <div key={group} className="space-y-1.5">
                      <div className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-200/60 pb-0.5 mb-1.5">
                        {group} Division
                      </div>
                      {routes.map(route => {
                        const isChecked = selectedRoutes.includes(route.path);
                        return (
                          <label key={route.path} className="flex items-center gap-2.5 py-1 px-1.5 rounded hover:bg-slate-100/80 cursor-pointer select-none transition-colors">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedRoutes(selectedRoutes.filter(p => p !== route.path));
                                } else {
                                  setSelectedRoutes([...selectedRoutes, route.path]);
                                }
                              }}
                              className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary h-3.5 w-3.5 cursor-pointer"
                            />
                            <span className="text-[11px] font-medium text-slate-700">{route.label.split(' (')[0]}</span>
                          </label>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={creatingRole}
                className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
              >
                {creatingRole ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Role...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Custom Role
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Dynamic Roles List */}
          <div className="lg:col-span-2 glass-panel rounded-2xl border border-brand-slate overflow-hidden bg-white">
            <div className="border-b border-[#e2e8f0] px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Dynamic Access Control Roles</h3>
              {loadingRoles && <Loader2 className="h-4.5 w-4.5 animate-spin text-brand-primary" />}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#e2e8f0] text-slate-400 font-bold uppercase tracking-wider">
                    <th className="px-6 py-4 w-1/4">Role Name</th>
                    <th className="px-6 py-4 w-2/3">Allowed Sidebar Screens</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2e8f0] text-slate-600">
                  {customRoles.map(cr => (
                    <tr key={cr.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-extrabold text-slate-800">
                        <span className="inline-block rounded bg-purple-50 border border-purple-200 text-purple-700 px-2 py-0.5 text-[9px] font-bold uppercase font-mono tracking-wider">
                          {cr.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {cr.routes.length === 0 ? (
                            <span className="text-slate-400 text-[10px]">No screen access granted</span>
                          ) : (
                            (cr.routes as string[]).map(path => {
                              const rObj = ALL_ROUTES.find(r => r.path === path);
                              return (
                                <span key={path} className="inline-block rounded bg-slate-100 text-slate-600 px-1.5 py-0.5 text-[9px] font-semibold border border-slate-200">
                                  {rObj ? rObj.label.split(' (')[0] : path}
                                </span>
                              );
                            })
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteRole(cr.id, cr.name)}
                          className="rounded-lg p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete Role"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {customRoles.length === 0 && !loadingRoles && (
                    <tr>
                      <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                        No custom roles defined. System admins can configure custom roles above.
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

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border border-brand-slate max-w-md w-full p-6 space-y-4 shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Edit Corporate ID</h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">
                  {editingUser.fullName} &bull; {getRoleDisplayName(editingUser.role)}
                </p>
              </div>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">Corporate Email *</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="name@espl.com"
                  className="settings-input"
                />
              </div>

              <div>
                <label className="block text-slate-500 mb-1.5 font-bold uppercase tracking-wider">
                  New Password / Token (Optional)
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Leave blank to keep unchanged"
                  className="settings-input"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="w-1/2 rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="w-1/2 rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-xs font-bold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {updating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
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
