'use client';

import dynamic from 'next/dynamic';
import { useCallback, useMemo } from 'react';
import { 
  TrendingUp, 
  Clock, 
  AlertOctagon, 
  Truck, 
  Users, 
  CheckCircle2, 
  Activity, 
  Layers
} from 'lucide-react';

import { useApiData } from '@/lib/useApiData';
import { getOperationalStatusClasses, getOperationalStatusLabel } from '@/lib/operationalStatus';
import WorkflowAlerts from '@/components/WorkflowAlerts';

const DashboardCharts = dynamic(() => import('@/components/DashboardCharts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="glass-panel h-96 rounded-2xl border border-brand-slate lg:col-span-2 bg-slate-50/50" />
      <div className="glass-panel h-96 rounded-2xl border border-brand-slate bg-slate-50/50" />
    </div>
  ),
});

export default function DashboardPage() {
  const { data: dashboardData, loading: dashboardLoading } = useApiData('/api/dashboard', null);
  const { data: tripsData, loading: tripsLoading } = useApiData('/api/trips?limit=5&status=IN_TRANSIT', { data: [] });

  const loading = dashboardLoading || tripsLoading;
  
  // Safe defaults if API is loading
  const stats = dashboardData || {
    revenueKPI: 0,
    expenseKPI: 0,
    netMarginKPI: 0,
    reconciliationQueueCount: 0,
    disputedQueueCount: 0,
    activeTripsCount: 0,
    fleetUtilization: 0,
    totalTrucks: 0,
    totalDrivers: 0,
    totalTrips: 0,
    completedTrips: 0,
    revenueHistory: [],
    poUsage: []
  };

  const poUsageData = dashboardData?.poUsage || [];
  const revenueHistory = dashboardData?.revenueHistory || [];

  const activeTrips = useMemo(() => (tripsData?.data || []).map((t: any) => ({
    id: t.id,
    tripNumber: t.tripNumber,
    origin: t.source?.replace(' Plant (Mines Loading)', '').replace(' Hub (Mines Loading)', ''),
    destination: t.destination?.replace(' Stockyard (Unloading)', '').replace(' Terminal (Unloading)', ''),
    driver: t.driver?.fullName || 'Unassigned',
    quantity: `${Number(t.estimatedQuantityTons || 0).toFixed(1)} Tons`,
    status: t.status
  })), [tripsData]);

  const formatCurrency = useCallback((val: number) => {
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      maximumFractionDigits: 0 
    }).format(val);
  }, []);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 font-sans tracking-tight">Fleet Transportation Control Tower</h2>
          <p className="text-xs text-slate-500 mt-1">Cross-fleet operational analytical dashboard (India Transportation Network)</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-sky-50 border border-sky-100 px-3.5 py-1.5 text-xs text-sky-700 font-bold shadow-sm">
          <TrendingUp className="h-4 w-4 text-sky-600 animate-pulse" />
          <span>AIS-140 GPS Telemetry feeds: 100% Active</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Financial Overview */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute right-4 top-4 rounded-xl bg-sky-50 p-2 text-sky-600">
            <span className="text-lg font-extrabold">₹</span>
          </div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Financial Performance</div>
          <div className="mt-4">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Gross Billings</span>
            <div className="text-xl font-extrabold text-slate-800 leading-none mt-0.5">{formatCurrency(stats.revenueKPI)}</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-[10px] font-semibold text-slate-500">
            <div>
              <span className="text-slate-400 block font-bold uppercase">Expenses</span>
              <span className="text-slate-700">{formatCurrency(stats.expenseKPI)}</span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold uppercase">Net Margin</span>
              <span className="text-emerald-600">{formatCurrency(stats.netMarginKPI)}</span>
            </div>
          </div>
        </div>

        {/* KPI 2: Total & Active Trips */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute right-4 top-4 rounded-xl bg-amber-50 p-2 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Operations Feed</div>
          <div className="mt-4">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Total Dispatched Trips</span>
            <div className="text-xl font-extrabold text-slate-800 leading-none mt-0.5">{stats.totalTrips || 0} Trips</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-[10px] font-semibold text-slate-500">
            <div>
              <span className="text-slate-400 block font-bold uppercase">Active Transit</span>
              <span className="text-amber-600">{stats.activeTripsCount || 0} Vehicles</span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold uppercase">Completed</span>
              <span className="text-slate-700">{stats.completedTrips || 0} Trips</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Fleet Utilisation */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute right-4 top-4 rounded-xl bg-indigo-50 p-2 text-indigo-600">
            <Truck className="h-5 w-5" />
          </div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Fleet Deployment</div>
          <div className="mt-4">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Fleet Utilization</span>
            <div className="text-xl font-extrabold text-slate-800 leading-none mt-0.5">{stats.fleetUtilization || 0}%</div>
          </div>
          {/* Progress Bar */}
          <div className="mt-3 border-t border-slate-100 pt-2">
            <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
              <div 
                className="h-full rounded-full bg-indigo-500 transition-all duration-500" 
                style={{ width: `${stats.fleetUtilization || 0}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[9px] font-bold uppercase text-slate-400">
              <span>{stats.totalTrucks || 0} Trucks</span>
              <span>{stats.totalDrivers || 0} Drivers</span>
            </div>
          </div>
        </div>

        {/* KPI 4: Exceptions & Auditing */}
        <div className="glass-card rounded-2xl p-6 relative overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <div className="absolute right-4 top-4 rounded-xl bg-rose-50 p-2 text-rose-600">
            <AlertOctagon className="h-5 w-5 animate-pulse" />
          </div>
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Security & Billing Audits</div>
          <div className="mt-4">
            <span className="text-[10px] font-bold text-slate-400 block uppercase">Exceptions Detected</span>
            <div className="text-xl font-extrabold text-rose-600 leading-none mt-0.5">{stats.disputedQueueCount || 0} Disputed</div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-2 text-[10px] font-semibold text-slate-500">
            <div>
              <span className="text-slate-400 block font-bold uppercase">Verified Tickets</span>
              <span className="text-emerald-600">{stats.reconciliationQueueCount || 0} Passed</span>
            </div>
            <div>
              <span className="text-slate-400 block font-bold uppercase">Billing Audit</span>
              <span className="text-slate-700">Variance &gt; 0.5%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Graphs Component */}
      <DashboardCharts 
        revenueHistory={revenueHistory} 
        poUsageData={poUsageData} 
        formatCurrency={formatCurrency} 
      />

      {/* Live Tower Status feed & alert notifications */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Active Dispatch Feed */}
        <div className="glass-panel rounded-2xl p-6 border border-brand-slate bg-white shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-brand-primary" />
              <span>Control Room Real-time Dispatch Feed</span>
            </h3>
            <span className="rounded-full bg-sky-50 border border-sky-100 px-2 py-0.5 text-[8px] text-sky-700 font-extrabold tracking-widest animate-pulse">
              LIVE STREAM
            </span>
          </div>
          
          <div className="space-y-4">
            {activeTrips.length === 0 ? (
              <div className="text-center py-8 text-xs font-bold text-slate-400 uppercase tracking-wider">
                No vehicles currently en-route
              </div>
            ) : (
              activeTrips.map(trip => (
                <div key={trip.id} className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-100 p-4 hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 border border-sky-100 text-sky-700">
                      <Truck className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-800">{trip.tripNumber}</div>
                      <div className="text-[10px] text-slate-400 font-medium mt-0.5">{trip.origin} → {trip.destination}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-[8px] font-bold tracking-wide ${getOperationalStatusClasses(trip.status)}`}>
                      {getOperationalStatusLabel(trip.status)}
                    </span>
                    <div className="text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-wider">{trip.quantity}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Security Alerts and Audit logs */}
        <div className="glass-panel rounded-2xl p-6 border border-brand-slate bg-white shadow-sm">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4.5 w-4.5 text-rose-600 animate-pulse" />
              <span>Safety & Compliance Exception Audits</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">Automated logs showing operator/terminal checkpoints status</p>
          </div>

          <WorkflowAlerts />
        </div>
      </div>
    </div>
  );
}
