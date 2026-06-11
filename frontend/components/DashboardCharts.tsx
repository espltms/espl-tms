'use client';

import { useState } from 'react';
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
  Legend
} from 'recharts';
import { TrendingUp, BarChart3 } from 'lucide-react';

interface DashboardChartsProps {
  revenueHistory: any[];
  poUsageData: any[];
  formatCurrency: (value: number) => string;
}

export default function DashboardCharts({ revenueHistory, poUsageData, formatCurrency }: DashboardChartsProps) {
  const [metricMode, setMetricMode] = useState<'revenue' | 'tonnage'>('revenue');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Area Chart: Billings & Tonnages */}
      <div className="glass-panel rounded-2xl p-6 border border-brand-slate lg:col-span-2 bg-white shadow-sm flex flex-col justify-between">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0">
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-sky-600" />
              <span>Dynamic Fleet Volume & Billing Trends</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
              {metricMode === 'revenue' 
                ? 'Aggregate daily billings tracking (INR)' 
                : 'Aggregate daily shipment tonnage metrics (Tons)'
              }
            </p>
          </div>
          
          {/* Chart Mode Toggle */}
          <div className="flex rounded-xl bg-slate-100 p-1 text-[10px] font-bold uppercase tracking-wider select-none shrink-0 self-start sm:self-center">
            <button
              onClick={() => setMetricMode('revenue')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                metricMode === 'revenue'
                  ? 'bg-white text-sky-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Billings (₹)
            </button>
            <button
              onClick={() => setMetricMode('tonnage')}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                metricMode === 'tonnage'
                  ? 'bg-white text-emerald-600 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Volume (Tons)
            </button>
          </div>
        </div>

        <div className="h-80 w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueHistory} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorTonnage" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '9px', fontWeight: 'bold' }} />
              <YAxis 
                stroke="#94a3b8" 
                style={{ fontSize: '9px', fontWeight: 'bold' }}
                tickFormatter={(val) => metricMode === 'revenue' ? `₹${val >= 1000 ? (val/1000) + 'K' : val}` : `${val}`}
              />
              <Tooltip
                formatter={(value) => [
                  metricMode === 'revenue' ? formatCurrency(Number(value)) : `${value} Tons`,
                  metricMode === 'revenue' ? 'Billings' : 'Tonnage Shipped'
                ]}
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  borderColor: '#f1f5f9', 
                  borderRadius: '16px', 
                  color: '#1e293b',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}
                labelStyle={{ color: '#64748b', fontSize: '10px', fontWeight: 'bold' }}
              />
              {metricMode === 'revenue' ? (
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#0ea5e9" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              ) : (
                <Area 
                  type="monotone" 
                  dataKey="tons" 
                  stroke="#10b981" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorTonnage)" 
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar Chart: Budget Allocations */}
      <div className="glass-panel rounded-2xl p-6 border border-brand-slate bg-white shadow-sm flex flex-col justify-between">
        <div className="mb-6 shrink-0">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-amber-600" />
            <span>Contract Tonnage Capacity Limits</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
            Allocated cargo vs total contract limit
          </p>
        </div>
        <div className="h-80 w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={poUsageData} layout="vertical" margin={{ top: 10, right: 10, left: 15, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" stroke="#94a3b8" style={{ fontSize: '9px', fontWeight: 'bold' }} />
              <YAxis 
                dataKey="name" 
                type="category" 
                stroke="#64748b" 
                style={{ fontSize: '9px', fontWeight: 'bold' }} 
                width={80} 
              />
              <Tooltip 
                formatter={(value, name) => [`${value} Tons`, name === 'allocated' ? 'Allocated' : 'Total Limit']}
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  borderColor: '#f1f5f9', 
                  borderRadius: '16px', 
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
                  fontSize: '11px',
                  fontWeight: 'bold'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={32}
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }}
              />
              {/* Total Capacity Limit (background bar) */}
              <Bar 
                dataKey="total" 
                fill="#e2e8f0" 
                radius={[0, 4, 4, 0]} 
                barSize={12} 
                name="Total Contract Limit"
              />
              {/* Allocated Capacity (foreground bar) */}
              <Bar 
                dataKey="allocated" 
                fill="#f59e0b" 
                radius={[0, 4, 4, 0]} 
                barSize={12} 
                name="Allocated Tonnage"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
