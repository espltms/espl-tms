'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  AlertOctagon, 
  Truck, 
  MapPin, 
  FileText, 
  ChevronRight 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar 
} from 'recharts';
import { 
  getDashboardStats, 
  getRevenueHistory, 
  getPoUsageData, 
  getTrips 
} from '@/app/data/dataHelper';

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(() => getDashboardStats());
  const [poUsageData, setPoUsageData] = useState(() => getPoUsageData());
  const [revenueHistory, setRevenueHistory] = useState(() => getRevenueHistory());

  const [activeTrips, setActiveTrips] = useState(() => {
    const rawTrips = getTrips().filter(t => t.status === 'EN_ROUTE' || t.status === 'LOADING');
    return rawTrips.slice(0, 5).map(t => ({
      id: t.id,
      tripNumber: t.tripNumber,
      origin: t.source.replace(' Plant (Mines Loading)', '').replace(' Hub (Mines Loading)', ''),
      destination: t.destination.replace(' Stockyard (Unloading)', '').replace(' Terminal (Unloading)', ''),
      driver: t.driver.fullName,
      quantity: `${t.estimatedQuantityTons.toFixed(1)} Tons`,
      status: t.status
    }));
  });

  useEffect(() => {
    // Already populated from helpers on init
    setLoading(false);
  }, []);


  const formatCurrency = (val: number) => {
    // Beautiful Indian Rupees format output
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Executive Operations Terminal</h2>
          <p className="text-xs text-slate-500 mt-1">Cross-fleet analytical control tower feed (India Network)</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-brand-primary/10 border border-brand-primary/20 px-3.5 py-1.5 text-xs text-brand-primary font-semibold">
          <TrendingUp className="h-4 w-4" />
          <span>AIS-140 GPS Streams: 100% OK</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1 */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 rounded-xl bg-brand-primary/10 p-2 text-brand-primary">
            <span className="text-lg font-bold">₹</span>
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Gross Billings (INR)</div>
          <div className="mt-4 text-2xl font-extrabold text-slate-800">{formatCurrency(stats.revenueKPI)}</div>
          <div className="mt-2 text-[10px] text-brand-success font-semibold flex items-center gap-1">
            <span>+14.2%</span> <span className="text-slate-400">vs last cycle</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 rounded-xl bg-brand-secondary/10 p-2 text-brand-secondary">
            <Clock className="h-5 w-5" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Transit Dispatch</div>
          <div className="mt-4 text-2xl font-extrabold text-slate-800">{stats.activeTripsCount} Fleet Trips</div>
          <div className="mt-2 text-[10px] text-brand-primary font-semibold flex items-center gap-1">
            <span>{stats.fleetUtilization}%</span> <span className="text-slate-400">active load-out</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 rounded-xl bg-brand-success/10 p-2 text-brand-success">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Auto Reconciled Invoices</div>
          <div className="mt-4 text-2xl font-extrabold text-slate-800">{stats.reconciliationQueueCount} Ready</div>
          <div className="mt-2 text-[10px] text-brand-success font-semibold flex items-center gap-1">
            <span>98.6%</span> <span className="text-slate-400">3-Way Match accuracy</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute right-4 top-4 rounded-xl bg-brand-danger/10 p-2 text-brand-danger animate-pulse-slow">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Flagged Exceptions</div>
          <div className="mt-4 text-2xl font-extrabold text-brand-danger">{stats.disputedQueueCount} Audit Logs</div>
          <div className="mt-2 text-[10px] text-brand-danger font-semibold flex items-center gap-1">
            <span>Weight Loss &gt; 0.5%</span>
          </div>
        </div>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Large Chart */}
        <div className="glass-panel rounded-2xl p-6 border border-brand-slate lg:col-span-2">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Dynamic Freight Volume Trends</h3>
            <p className="text-[11px] text-slate-400 mt-1">Aggregate shipment tonnages & daily billings tracking (INR)</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: '10px' }} />
                <YAxis stroke="#6b7280" style={{ fontSize: '10px' }} />
                <Tooltip 
                  formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#1e293b' }}
                  labelStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Small Chart */}
        <div className="glass-panel rounded-2xl p-6 border border-brand-slate">
          <div className="mb-6">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Contract Budget Allocation</h3>
            <p className="text-[11px] text-slate-400 mt-1">Tonnage limits matching aggregate client contracts</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={poUsageData} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" stroke="#6b7280" style={{ fontSize: '10px' }} />
                <YAxis dataKey="name" type="category" stroke="#6b7280" style={{ fontSize: '10px' }} width={90} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#1e293b' }}
                />
                <Bar dataKey="allocated" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Live Tower Status feed & alert notifications */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Active Dispatch */}
        <div className="glass-panel rounded-2xl p-6 border border-brand-slate">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Live Control Room Dispatches</h3>
            <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-[10px] text-brand-primary font-bold">REALTIME FEED</span>
          </div>
          
          <div className="space-y-4">
            {activeTrips.map(trip => (
              <div key={trip.id} className="flex items-center justify-between rounded-xl bg-white border border-[#e2e8f0] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-primary/10 text-brand-primary">
                    <Truck className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-800">{trip.tripNumber}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{trip.origin} → {trip.destination}</div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-full bg-brand-success/15 border border-brand-success/20 px-2.5 py-0.5 text-[9px] font-bold text-brand-success tracking-wide">
                    {trip.status}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1">{trip.quantity}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security Alerts and Audit logs */}
        <div className="glass-panel rounded-2xl p-6 border border-brand-slate">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Critical Safety & Compliance Audits</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Automated logs showing operator/terminal checkpoints updates</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-brand-danger/20 bg-brand-danger/5 p-3.5">
              <AlertOctagon className="h-5 w-5 text-brand-danger flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-800">RECONCILIATION EXCEPTION SHRINKAGE</div>
                <div className="text-[10px] text-slate-500 mt-1">Invoice INV-VEN-491028 matched variance is 0.12% (limit: 0.50%). Cargo weight shrinkage flagged.</div>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-brand-warning/20 bg-brand-warning/5 p-3.5">
              <Clock className="h-5 w-5 text-brand-warning flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-slate-800">LICENSING EXPIRATION WARNING</div>
                <div className="text-[10px] text-slate-500 mt-1">Driver license record for Anil Deshmukh (IND-DL-1092837) expired. Automations suspended for new trip dispatches.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
