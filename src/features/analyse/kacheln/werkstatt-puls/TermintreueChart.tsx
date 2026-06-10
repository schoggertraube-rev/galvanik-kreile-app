import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface TermintreueChartProps {
  currentWeekPct: number | null;
  // This is a placeholder for historical data that would come from kpi_snapshots
  // For the MVP we will show a generic static visualization to indicate the UI intent
}

export const TermintreueChart: React.FC<TermintreueChartProps> = ({ currentWeekPct }) => {
  // Mock data for the chart since we don't have historical weekly snapshots yet
  const mockData = [
    { week: 'KW 20', current: 80, previous: 75 },
    { week: 'KW 21', current: 82, previous: 78 },
    { week: 'KW 22', current: 85, previous: 80 },
    { week: 'KW 23', current: 79, previous: 82 },
    { week: 'KW 24', current: currentWeekPct || 76, previous: 85 },
  ];

  return (
    <div className="w-full h-64 bg-white p-4 rounded-xl border border-gray-200">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={mockData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCurrent" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} domain={[0, 100]} />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <ReferenceLine y={90} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Ziel (90%)', fill: '#10b981', fontSize: 12 }} />
          <Area type="monotone" dataKey="current" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCurrent)" name="Aktuell" />
          <Area type="monotone" dataKey="previous" stroke="#9ca3af" strokeWidth={2} strokeDasharray="5 5" fill="none" name="Vorjahr" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
