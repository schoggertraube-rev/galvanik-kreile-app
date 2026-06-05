"use client";

import React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export interface TrendLineProps {
  data: { year: string; count: number }[];
}

export default function TrendLine({ data }: TrendLineProps) {
  return (
    <div style={{ width: "100%", height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--kz-blue-soft)" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="var(--kz-blue-soft)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="year" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: "var(--kz-ink-mute)" }} 
            dy={5}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: "var(--kz-ink-mute)" }} 
          />
          <Tooltip 
            contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 11 }}
          />
          <Area type="monotone" dataKey="count" stroke="var(--kz-blue-mid)" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
