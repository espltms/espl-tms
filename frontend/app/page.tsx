'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useRouter } from 'next/navigation';
import { Shield, Key, Mail, AlertTriangle, ArrowRight, Building2, Crown, Truck, PackageOpen } from 'lucide-react';

const portalRoles = [
  {
    label: 'Super Admin',
    value: 'SUPER_ADMIN',
    icon: Crown,
    accent: 'text-purple-600',
    chip: 'bg-purple-500/10 text-purple-600',
  },
  {
    label: 'System Admin',
    value: 'SYS_ADMIN',
    icon: Shield,
    accent: 'text-purple-600',
    chip: 'bg-purple-500/10 text-purple-600',
  },
  {
    label: 'Paramanandpur Admin',
    value: 'PARAMANANDPUR_ADMIN',
    icon: Building2,
    accent: 'text-blue-600',
    chip: 'bg-blue-500/10 text-blue-600',
  },
  {
    label: 'Dharamgarh Admin',
    value: 'DHARAMGARH_ADMIN',
    icon: Building2,
    accent: 'text-blue-600',
    chip: 'bg-blue-500/10 text-blue-600',
  },
  {
    label: 'Paramanandpur Unloader',
    value: 'PARAMANANDPUR_UNLOADER',
    icon: PackageOpen,
    accent: 'text-blue-600',
    chip: 'bg-blue-500/10 text-blue-600',
  },
  {
    label: 'Dharamgarh Unloader',
    value: 'DHARAMGARH_UNLOADER',
    icon: PackageOpen,
    accent: 'text-blue-600',
    chip: 'bg-blue-500/10 text-blue-600',
  },
  {
    label: 'Lanjigarh Loader',
    value: 'LANJIGARH_LOADER',
    icon: Truck,
    accent: 'text-blue-600',
    chip: 'bg-blue-500/10 text-blue-600',
  },
  {
    label: 'Vendor -1',
    value: 'VENDOR_1',
    icon: Truck,
    accent: 'text-emerald-600',
    chip: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    label: 'Vendor -2',
    value: 'VENDOR_2',
    icon: Truck,
    accent: 'text-emerald-600',
    chip: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    label: 'Vendor -3',
    value: 'VENDOR_3',
    icon: Truck,
    accent: 'text-emerald-600',
    chip: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    label: 'Vendor -4',
    value: 'VENDOR_4',
    icon: Truck,
    accent: 'text-emerald-600',
    chip: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    label: 'Vendor -5',
    value: 'VENDOR_5',
    icon: Truck,
    accent: 'text-emerald-600',
    chip: 'bg-emerald-500/10 text-emerald-600',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();
  const [selectedRole, setSelectedRole] = useState(portalRoles[0]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: selectedRole.value }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Authentication failed. Check your credentials.');
      }

      const data = await response.json();
      login(data.user, data.token);
      const targetPath = data.user.role?.startsWith('VENDOR') 
        ? '/vehicle-summary' 
        : data.user.role === 'LANJIGARH_LOADER' 
          ? '/trips' 
          : data.user.role === 'PARAMANANDPUR_UNLOADER' || data.user.role === 'DHARAMGARH_UNLOADER'
            ? '/unloading'
            : '/dashboard';
      router.push(targetPath);
    } catch (err: any) {
      console.error('login failed:', err);
      setError(err.message || 'Unable to complete request. Please check the details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = (role: typeof portalRoles[number]) => {
    setSelectedRole(role);
    setError('');
  };

  if (isAuthenticated) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-[#f4f6f9]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-x-hidden bg-[#f4f6f9] px-4 py-6 md:flex-row md:px-0 md:py-0">
      {/* Decorative background glow rings */}
      <div className="absolute -left-64 -top-64 h-[600px] w-[600px] rounded-full bg-brand-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute -right-64 -bottom-64 h-[600px] w-[600px] rounded-full bg-brand-secondary/5 blur-[120px] pointer-events-none" />

      {/* Left side: Premium Branding & Live Statistics */}
      <div className="relative hidden h-full w-1/2 flex-col justify-between p-16 md:flex">
        <div className="flex items-center gap-3">
          <img src="/images/espl-logo.png" alt="ESPL Logo" className="h-12 w-auto" />
          <span className="font-sans text-2xl font-extrabold tracking-tight bg-gradient-to-r from-slate-800 to-slate-500 bg-clip-text text-transparent">
            ESPL <span className="text-brand-primary">TMS</span>
          </span>
        </div>

        <div className="my-auto space-y-8">
          <div className="space-y-4 max-w-lg">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary uppercase tracking-wide">
              Eastern Stevedores Private Limited
            </div>
            <h1 className="font-sans text-4xl font-extrabold leading-tight text-slate-800 lg:text-5xl">
              Honesty Integrity <br />
              <span className="bg-gradient-to-r from-brand-primary to-brand-secondary bg-clip-text text-transparent">Automated Finance.</span>
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed">
              Industrial grade vehicle dispatching, real-time spatial geofencing, multi-stage compliance verification, and 3-way invoice reconciliation tailored for high-volume mining, agriculture, and manufacturing transit.
            </p>
          </div>

          {/* Quick Metrics display */}
          <div className="grid grid-cols-3 gap-6 border-y border-slate-200 py-8 max-w-lg">
            <div>
              <div className="text-2xl font-extrabold text-slate-800">400k+</div>
              <div className="text-xs text-slate-400 mt-1 uppercase font-bold">Tons Dispatched</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-800">99.8%</div>
              <div className="text-xs text-slate-400 mt-1 uppercase font-bold">Compliance Rate</div>
            </div>
            <div>
              <div className="text-2xl font-extrabold text-slate-800">0.02%</div>
              <div className="text-xs text-slate-400 mt-1 uppercase font-bold">Transit Leakage</div>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          © 2026 Eastern Stevedores Private Limited. All rights reserved. Secure RSA-4096 Encrypted Session.
        </p>
      </div>

      {/* Right side: Login Panel */}
      <div className="flex w-full max-w-md items-center justify-center p-4 sm:p-6 md:w-1/2 md:max-w-xl md:p-16">
        <div className="glass-panel relative z-10 w-full max-w-md rounded-2xl border border-slate-200 p-5 shadow-glass shadow-glass-glow sm:p-8">
          <div className="mb-6 text-center md:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">Enterprise Portal Access</h2>
            <p className="text-xs text-slate-500 mt-1">Choose your assigned access type before login</p>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              <Shield className="h-3.5 w-3.5 text-brand-primary" />
              <span>Select Portal Role</span>
            </div>
            <div className="grid grid-cols-1 gap-2 text-[11px] sm:grid-cols-3">
              {portalRoles.map((role) => {
                const Icon = role.icon;
                const active = selectedRole.value === role.value;
                return (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => selectRole(role)}
                    className={`flex min-h-[56px] items-center gap-2 rounded-lg border p-2 text-left transition-colors ${
                      active
                        ? 'border-brand-primary/50 bg-brand-primary/5 text-slate-800 shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-primary/30'
                    }`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${role.chip}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="font-semibold leading-tight">{role.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Corporate Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary/50 transition-colors"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Access Token / Password</label>
              <div className="relative">
                <Key className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary/50 transition-colors"
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-brand-danger/10 border border-brand-danger/20 p-4 text-xs text-brand-danger">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-brand-primary to-blue-600 py-3 text-sm font-semibold text-white hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 font-sans font-extrabold"
            >
              {loading ? 'Decrypting Authentication Key...' : 'Authorize Secure Gateway'}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-slate-400">
            Selected role: <span className={`font-bold ${selectedRole.accent}`}>{selectedRole.label}</span>
          </p>
        </div>
      </div>
    </main>
  );
}
