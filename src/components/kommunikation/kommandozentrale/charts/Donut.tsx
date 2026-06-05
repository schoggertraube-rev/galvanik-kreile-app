"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

export interface DonutProps {
  data: { label: string; value: number; color: string }[];
  centerLabel?: string;
  centerValue?: string | number;
}

export default function Donut({ data, centerLabel, centerValue }: DonutProps) {
  return (
    <div style={{ width: "100%", height: 180, position: "relative" }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius="65%"
            outerRadius="90%"
            dataKey="value"
            nameKey="label"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Center Label */}
      {(centerLabel || centerValue) && (
        <div 
          style={{ 
            position: "absolute", 
            top: "50%", 
            left: "50%", 
            transform: "translate(-50%, -50%)",
            textAlign: "center",
            pointerEvents: "none"
          }}
        >
          {centerValue && <div style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 500, lineHeight: 1 }}>{centerValue}</div>}
          {centerLabel && <div style={{ fontSize: 10, color: "var(--kz-ink-mute)", marginTop: 2, fontWeight: 600, letterSpacing: "0.03em", textTransform: "uppercase" }}>{centerLabel}</div>}
        </div>
      )}
    </div>
  );
}
