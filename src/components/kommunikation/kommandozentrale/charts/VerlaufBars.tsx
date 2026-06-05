"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export interface VerlaufBarsProps {
  data: { month: string; paid: number; open: number }[];
}

export default function VerlaufBars({ data }: VerlaufBarsProps) {
  return (
    <div style={{ width: "100%", height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <XAxis 
            dataKey="month" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: "var(--kz-ink-mute)" }} 
            dy={5} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: "var(--kz-ink-mute)" }} 
            tickFormatter={(value) => `€${value}`}
          />
          <Tooltip 
            cursor={{ fill: "rgba(27,27,27,0.03)" }}
            contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 11 }}
          />
          <Bar dataKey="paid" stackId="a" fill="var(--kz-green-soft)">
            {data.map((entry, index) => (
              <Cell key={`cell-paid-${index}`} fill="var(--kz-green-soft)" />
            ))}
          </Bar>
          <Bar dataKey="open" stackId="a" fill="var(--kz-orange-soft)" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-open-${index}`} fill={entry.open > 0 ? "var(--kz-orange)" : "var(--kz-orange-soft)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
