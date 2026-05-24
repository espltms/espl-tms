'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import SectionExcelExport from '@/components/SectionExcelExport';
import { 
  LayoutDashboard, 
  Truck, 
  Map, 
  ShieldCheck, 
  BadgeCent, 
  LogOut, 
  User as UserIcon, 
  Menu, 
  Compass, 
  Bell, 
  Clock,
  Wrench,
  Warehouse,
  Users,
  Scale,
  Building2,
  ParkingCircle,
  Disc,
  Layers,
  Settings
} from 'lucide-react';

const navigationDivisions = [
  {
    title: "Core Division",
    items: [
      { label: 'Executive Console', path: '/dashboard', icon: LayoutDashboard, roles: ['SYS_ADMIN', 'DISPATCHER', 'FINANCE_OFFICER', 'COMPLIANCE_OFFICER'] },
      { label: 'Control Room Live', path: '/dispatch', icon: Map, roles: ['SYS_ADMIN', 'DISPATCHER'] },
      { label: 'Trip Dispatch & POs', path: '/trips', icon: Truck, roles: ['SYS_ADMIN', 'DISPATCHER'] },
    ]
  },
  {
    title: "Fleet & Crew",
    items: [
      { label: 'Fleet Control Specs', path: '/fleet', icon: Layers, roles: ['SYS_ADMIN', 'DISPATCHER'] },
      { label: 'Driver Duty Logs', path: '/drivers', icon: Users, roles: ['SYS_ADMIN', 'DISPATCHER'] },
      { label: 'Tyre Inspection', path: '/tyres', icon: Disc, roles: ['SYS_ADMIN', 'DISPATCHER'] },
      { label: 'Workshop & Repairs', path: '/maintenance', icon: Wrench, roles: ['SYS_ADMIN', 'DISPATCHER', 'FINANCE_OFFICER'] },
      { label: 'HR & Payroll Center', path: '/hr', icon: Users, roles: ['SYS_ADMIN', 'FINANCE_OFFICER'] },
    ]
  },
  {
    title: "Terminal & Yard",
    items: [
      { label: 'Yard & Bay Queue', path: '/yard', icon: ParkingCircle, roles: ['SYS_ADMIN', 'DISPATCHER'] },
      { label: 'Weighbridge Weighing', path: '/weighbridge', icon: Scale, roles: ['SYS_ADMIN', 'DISPATCHER'] },
      { label: 'Store & Spare Inventory', path: '/inventory', icon: Warehouse, roles: ['SYS_ADMIN', 'FINANCE_OFFICER', 'DISPATCHER'] },
    ]
  },
  {
    title: "Finance & Law",
    items: [
      { label: 'Billing & Matches', path: '/billing', icon: BadgeCent, roles: ['SYS_ADMIN', 'FINANCE_OFFICER'] },
      { label: 'Corporate Compliance', path: '/legal', icon: Building2, roles: ['SYS_ADMIN', 'COMPLIANCE_OFFICER', 'FINANCE_OFFICER'] },
      { label: 'System Configuration', path: '/settings', icon: Settings, roles: ['SYS_ADMIN'] },
    ]
  }
];

const allNavItems = navigationDivisions.flatMap(div => div.items);

const ClockWidget = memo(function ClockWidget() {
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZoneName: 'short'
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hidden items-center gap-2 rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-1.5 text-xs text-brand-primary font-mono font-semibold md:flex">
      <Clock className="h-3.5 w-3.5" />
      <span>{currentTime}</span>
    </div>
  );
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  if (!mounted || !isAuthenticated) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#f4f6f9]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary border-t-transparent" />
      </div>
    );
  }

  const allowedDivisions = useMemo(() => navigationDivisions.map(div => ({
    ...div,
    items: div.items.filter(item => item.roles.includes(user?.role || 'SYS_ADMIN'))
  })).filter(div => div.items.length > 0), [user?.role]);

  const handleSignOut = () => {
    logout();
    router.push('/');
  };

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'SYS_ADMIN': return 'bg-purple-50 text-purple-600 border-purple-200';
      case 'FINANCE_OFFICER': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'COMPLIANCE_OFFICER': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const currentSectionName = allNavItems.find((n) => n.path === pathname)?.label || 'Current Section';

  return (
    <div className="flex h-dvh min-h-dvh w-full bg-[#f4f6f9] text-slate-700 overflow-hidden">
      
      {/* 1. Sidebar Panel for Desktop */}
      <aside className="hidden w-64 border-r border-[#e2e8f0] bg-white flex-col justify-between md:flex shrink-0">
        <div className="flex flex-col min-h-0 flex-1">
          {/* Logo Brand Header */}
          <div className="flex h-16 items-center gap-3 px-6 border-b border-[#e2e8f0]">
            <img src="/images/espl-logo.png" alt="ESPL Logo" className="h-9 w-auto" />
            <span className="font-sans text-lg font-extrabold tracking-tight bg-gradient-to-r from-slate-800 to-slate-500 bg-clip-text text-transparent">
              ESPL <span className="text-brand-primary">TMS</span>
            </span>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {allowedDivisions.map((division, idx) => (
              <div key={idx} className="space-y-1">
                <span className="px-3 text-[9px] font-bold text-slate-400 uppercase tracking-widest block">
                  {division.title}
                </span>
                <div className="space-y-0.5 mt-1.5">
                  {division.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[11px] font-semibold tracking-wide transition-all ${
                          isActive
                            ? 'bg-blue-50 text-blue-600 border-l-2 border-blue-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Card & Logout bottom pane */}
        <div className="p-4 border-t border-[#e2e8f0]">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 border border-slate-200">
              <UserIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-slate-800 truncate">{user?.fullName}</div>
              <div className="mt-1 flex">
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${getRoleBadgeStyle(user?.role || '')}`}>
                  {user?.role?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-brand-danger/20 bg-brand-danger/5 py-2.5 text-xs font-bold text-brand-danger hover:bg-brand-danger/10 active:scale-[0.98] transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* 2. Main Dashboard Panel Viewport */}
      <div className="flex h-dvh flex-1 flex-col min-w-0 overflow-hidden bg-[#f4f6f9]">
        {/* Top Navbar */}
        <header className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-[#e2e8f0] bg-white/95 px-3 py-2 backdrop-blur sticky top-0 z-50 shrink-0 sm:h-16 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:text-slate-900 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="min-w-0 truncate text-[11px] font-extrabold tracking-widest text-slate-800 uppercase font-sans sm:text-xs">
              {currentSectionName}
            </h1>
          </div>

          {/* Time & Alert widgets */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <SectionExcelExport sectionName={currentSectionName} />

            <ClockWidget />

            {/* Notification center */}
            <button className="relative rounded-xl border border-slate-200 bg-white p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-all">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand-secondary animate-ping" />
            </button>
          </div>
        </header>

        {/* Dynamic page viewport contents wrapper */}
        <main className="dashboard-main flex-grow overflow-y-auto p-4 sm:p-5 md:p-8">
          {children}
        </main>
      </div>

      {/* 3. Mobile Sidebar overlay drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[100] flex bg-black/30 backdrop-blur-sm md:hidden">
          <div className="flex h-full w-[86vw] max-w-80 flex-col justify-between overflow-y-auto border-r border-[#e2e8f0] bg-white shadow-2xl">
            <div className="min-h-0 flex-1">
              <div className="flex h-16 items-center gap-3 px-5 border-b border-[#e2e8f0]">
                <img src="/images/espl-logo.png" alt="ESPL Logo" className="h-9 w-auto" />
                <span className="font-sans text-xl font-extrabold text-slate-800">ESPL TMS</span>
              </div>
              <nav className="space-y-5 px-4 py-5">
                {allowedDivisions.map((division) => (
                  <div key={division.title} className="space-y-2">
                    <span className="px-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                      {division.title}
                    </span>
                    <div className="space-y-1">
                      {division.items.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.path;
                        return (
                          <Link
                            key={item.path}
                            href={item.path}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
                              isActive ? 'bg-brand-primary/10 text-brand-primary' : 'text-slate-500 hover:bg-slate-100'
                            }`}
                          >
                            <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-brand-primary' : 'text-slate-400'}`} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </div>
            <div className="p-4 border-t border-[#e2e8f0]">
              <button
                onClick={handleSignOut}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-danger/10 py-2.5 text-xs font-bold text-brand-danger"
              >
                Sign Out
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}
    </div>
  );
}
