'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/auth.store';
import { useRouter } from 'next/navigation';
import { Shield, Truck, Compass, Key, Mail, AlertTriangle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();
  const [email, setEmail] = useState('dispatcher@logistics.com');
  const [password, setPassword] = useState('TMSAdminPassword2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isDemoUser, setIsDemoUser] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Authentication failed. Check your credentials.');
      }

      const data = await response.json();
      login(data.user, data.token);
      router.push('/dashboard');
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Invalid credentials. Use password "admin123" for admin.');
    } finally {
      setLoading(false);
    }
  };

  const autofillRole = (roleEmail: string) => {
    setEmail(roleEmail);
  };

  if (isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f4f6f9]">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="relative flex min-h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#f4f6f9] px-4 md:flex-row md:px-0">
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
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-slate-800">Enterprise Portal Login</h2>
            <p className="text-xs text-slate-500 mt-1">Access secure control tower logs</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
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

          {/* Quick Demo Accounts Selection */}
          <div className="mt-8 border-t border-slate-200 pt-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
              <Shield className="h-3.5 w-3.5 text-brand-primary" />
              <span>Evaluate Demo Shell Roles</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <button
                onClick={() => autofillRole('dispatcher@logistics.com')}
                className="flex items-center justify-between bg-slate-50 border border-slate-200 hover:border-brand-primary/30 rounded-lg p-2 text-left text-slate-600 transition-colors"
              >
                <span>Dispatcher</span>
                <span className="text-brand-primary font-mono text-[9px] bg-brand-primary/10 px-1 py-0.5 rounded">AUTO</span>
              </button>
              <button
                onClick={() => autofillRole('finance@logistics.com')}
                className="flex items-center justify-between bg-slate-50 border border-slate-200 hover:border-brand-primary/30 rounded-lg p-2 text-left text-slate-600 transition-colors"
              >
                <span>Finance Officer</span>
                <span className="text-brand-secondary font-mono text-[9px] bg-brand-secondary/10 px-1 py-0.5 rounded">AUTO</span>
              </button>
              <button
                onClick={() => autofillRole('compliance@logistics.com')}
                className="flex items-center justify-between bg-slate-50 border border-slate-200 hover:border-brand-primary/30 rounded-lg p-2 text-left text-slate-600 transition-colors"
              >
                <span>Compliance Officer</span>
                <span className="text-brand-success font-mono text-[9px] bg-brand-success/10 px-1 py-0.5 rounded">AUTO</span>
              </button>
              <button
                onClick={() => autofillRole('admin@logistics.com')}
                className="flex items-center justify-between bg-slate-50 border border-slate-200 hover:border-brand-primary/30 rounded-lg p-2 text-left text-slate-600 transition-colors"
              >
                <span>Sys Admin</span>
                <span className="text-purple-400 font-mono text-[9px] bg-purple-500/10 px-1 py-0.5 rounded">AUTO</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
