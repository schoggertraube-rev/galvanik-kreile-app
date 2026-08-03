"use client";

import React from "react";
import { Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart } from "recharts";

export interface AnalysisChartProps {
  data: any[];
  xKey?: string;
  barKey?: string;
  lineKey?: string;
  avgLineKey?: string;
}

export function AnalysisChart({ data, xKey = "name", barKey = "ist", lineKey = "vorjahr", avgLineKey }: AnalysisChartProps) {
  return (
    <div style={{ width: "100%", height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorIst" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--blue-st, #2F86D8)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="var(--blue-st, #2F86D8)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey={xKey} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: "var(--text3, #928F86)" }} 
            dy={5}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 10, fill: "var(--text3, #928F86)" }} 
          />
          <Tooltip 
            contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 11 }}
          />
          {barKey && (
            <Area type="monotone" dataKey={barKey} stroke="var(--blue-st, #2F86D8)" strokeWidth={2} fillOpacity={1} fill="url(#colorIst)" />
          )}
          {lineKey && (
            <Line type="monotone" dataKey={lineKey} stroke="var(--text3, #928F86)" strokeDasharray="4 4" strokeWidth={1.5} dot={false} />
          )}
          {avgLineKey && (
            <Line type="monotone" dataKey={avgLineKey} stroke="var(--red, #DC2626)" strokeWidth={1} dot={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
