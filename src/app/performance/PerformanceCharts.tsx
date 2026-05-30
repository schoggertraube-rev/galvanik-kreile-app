"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface BarChartData {
  name: string;
  value: number;
}

interface LineChartData {
  date: string;
  events: number;
}

export function EventsBarChart({ data }: { data: BarChartData[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-navy-900">Meistgeklickte Bereiche</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "transparent" }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="value" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function ActivityLineChart({ data }: { data: LineChartData[] }) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-navy-900">Aktivität letzte 7 Tage</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Line type="monotone" dataKey="events" stroke="#E8943C" strokeWidth={3} dot={{ r: 4, fill: "#E8943C", strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function FunnelPieChart({ open, accepted }: { open: number, accepted: number }) {
  const data = [
    { name: 'Angenommen', value: accepted },
    { name: 'Offen', value: open },
  ];
  const COLORS = ['#10b981', '#f59e0b']; // green, orange

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-bold text-navy-900">Anfragen Status</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <div className="h-48 w-full max-w-xs">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={70}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col justify-center gap-2 text-xs font-semibold pl-4">
           <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#10b981]" /> Angenommen</div>
           <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#f59e0b]" /> Offen</div>
        </div>
      </CardContent>
    </Card>
  );
}
