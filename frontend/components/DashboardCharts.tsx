'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface DashboardChartsProps {
  revenueHistory: any[];
  poUsageData: any[];
  formatCurrency: (value: number) => string;
}

export default function DashboardCharts({ revenueHistory, poUsageData, formatCurrency }: DashboardChartsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
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
              <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '12px', color: '#1e293b' }} />
              <Bar dataKey="allocated" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
