'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useRouter } from 'next/navigation';
import { Shield, Truck, Compass, Key, Mail, AlertTriangle, ArrowRight, UserPlus, UserRound, BadgeCheck, WalletCards, Settings } from 'lucide-react';

const portalRoles = [
  {
    label: 'Dispatcher',
    value: 'DISPATCHER',
    email: 'dispatcher@logistics.com',
    icon: Truck,
    accent: 'text-brand-primary',
    chip: 'bg-brand-primary/10 text-brand-primary',
  },
  {
    label: 'Finance Officer',
    value: 'FINANCE_OFFICER',
    email: 'finance@logistics.com',
    icon: WalletCards,
    accent: 'text-brand-secondary',
    chip: 'bg-brand-secondary/10 text-brand-secondary',
  },
  {
    label: 'Compliance Officer',
    value: 'COMPLIANCE_OFFICER',
    email: 'compliance@logistics.com',
    icon: BadgeCheck,
    accent: 'text-brand-success',
    chip: 'bg-brand-success/10 text-brand-success',
  },
  {
    label: 'Sys Admin',
    value: 'SYS_ADMIN',
    email: 'admin@logistics.com',
    icon: Settings,
    accent: 'text-purple-500',
    chip: 'bg-purple-500/10 text-purple-500',
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [selectedRole, setSelectedRole] = useState(portalRoles[0]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
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
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload =
        mode === 'login'
          ? { email, password }
          : {
              email,
              password,
              fullName,
              phone,
              role: selectedRole.value,
            };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || (mode === 'login' ? 'Authentication failed. Check your credentials.' : 'Registration failed. Check your details.'));
      }

      const data = await response.json();
      login(data.user, data.token);
      router.push('/dashboard');
    } catch (err: any) {
      console.error(`${mode} failed:`, err);
      setError(err.message || 'Unable to complete request. Please check the details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectRole = (role: typeof portalRoles[number]) => {
    setSelectedRole(role);
    setError('');
  };

  const switchMode = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setError('');
    setEmail('');
    setPassword('');
  };

  if (isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f4f6f9]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen w-screen flex-col items-center justify-center overflow-x-hidden bg-[#f4f6f9] px-4 py-6 md:flex-row md:px-0 md:py-0">
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
      <div className="w-full max-w-md p-8 md:w-1/2 md:max-w-xl md:p-16 flex items-center justify-center">
        <div className="glass-panel w-full max-w-md rounded-2xl p-8 shadow-glass shadow-glass-glow border border-slate-200 relative z-10">
          <div className="mb-6 text-center md:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">Enterprise Portal Access</h2>
            <p className="text-xs text-slate-500 mt-1">Choose your role before login or registration</p>
          </div>

          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              <Shield className="h-3.5 w-3.5 text-brand-primary" />
              <span>Select Portal Role</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
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

          <div className="mb-6 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${mode === 'login' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              <Key className="h-3.5 w-3.5" />
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 transition-colors ${mode === 'register' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Register
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <UserRound className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary/50 transition-colors"
                    placeholder="Your full name"
                  />
                </div>
              </div>
            )}

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

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Phone Number</label>
                <div className="relative">
                  <Compass className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-primary/50 transition-colors"
                    placeholder="+91..."
                  />
                </div>
              </div>
            )}

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
              {loading
                ? mode === 'login' ? 'Decrypting Authentication Key...' : 'Creating Secure Account...'
                : mode === 'login' ? 'Authorize Secure Gateway' : `Register as ${selectedRole.label}`}
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
