"use client";

import {
  Wallet, TrendingUp, AlertCircle, Clock, AlertTriangle, Fuel,
} from "lucide-react";
import type { PeriodType } from "@/lib/analytics/plainLanguage";
import { PERIOD_LABELS } from "@/lib/analytics/plainLanguage";
import { X } from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  wallet: <Wallet style={{ width: 22, height: 22 }} />,
  "trending-up": <TrendingUp style={{ width: 22, height: 22 }} />,
  "alert-circle": <AlertCircle style={{ width: 22, height: 22 }} />,
  clock: <Clock style={{ width: 22, height: 22 }} />,
  "alert-triangle": <AlertTriangle style={{ width: 22, height: 22 }} />,
  fuel: <Fuel style={{ width: 22, height: 22 }} />,
};

interface DrillCategoryHeaderProps {
  icon: string;
  label: string;
  subtitle: string;
  accentGradient: string;
  period: PeriodType;
  onPeriodChange: (p: PeriodType) => void;
  onClose: () => void;
}

export function DrillCategoryHeader({
  icon,
  label,
  subtitle,
  accentGradient,
  period,
  onPeriodChange,
  onClose,
}: DrillCategoryHeaderProps) {
  const periods: PeriodType[] = ["tag", "woche", "monat", "quartal"];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "18px 22px",
        background: accentGradient,
        color: "#FFFFFF",
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 46, height: 46, borderRadius: "var(--radius-sm, 8px)",
          background: "rgba(255,255,255,0.2)",
          backdropFilter: "blur(8px)",
          boxShadow: "0 1px 2px rgba(0,0,0,.1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {ICONS[icon] || <Wallet style={{ width: 22, height: 22 }} />}
      </div>

      {/* Title + period */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 17, fontWeight: 650 }}>{label}</div>
        <div style={{ fontSize: 12.5, opacity: 0.85 }}>{subtitle}</div>

        <div
          style={{
            display: "inline-flex", gap: 3, padding: 3,
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(4px)",
            borderRadius: 7, marginTop: 14,
          }}
        >
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              style={{
                border: "none",
                background: p === period ? "rgba(255,255,255,0.9)" : "transparent",
                padding: "5px 13px", borderRadius: 5,
                fontFamily: "inherit", fontSize: 12.5,
                fontWeight: p === period ? 600 : 400,
                color: p === period ? "var(--navy-900, #0E1A2E)" : "rgba(255,255,255,0.8)",
                cursor: "pointer",
                boxShadow: p === period ? "0 1px 2px rgba(0,0,0,.1)" : "none",
                transition: "all 0.12s",
              }}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Close */}
      <button
        onClick={onClose}
        aria-label="schlie\u00DFen"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "6px 9px",
          background: "rgba(255,255,255,0.2)",
          backdropFilter: "blur(4px)",
          border: "none", borderRadius: 7,
          cursor: "pointer", color: "#FFFFFF", flexShrink: 0,
        }}
      >
        <X style={{ width: 16, height: 16 }} />
      </button>
    </div>
  );
}
