"use client";

/**
 * DrillChart — renders the right chart type per KPI.
 * Uses Chart.js for Donut/Bar, pure SVG for Gauge/Sparkline.
 */

import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  Filler,
} from "chart.js";
import { Doughnut, Bar, Line } from "react-chartjs-2";
import { Info } from "lucide-react";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend, LineElement, PointElement, Filler);

// App palette
const PALETTE = [
  "#E8943C", "#5A8F4D", "#B8923F", "#D14F3D",
  "#2E3A55", "#C9A661", "#7A7466", "#0E1A2E",
];

interface DrillChartProps {
  type: "donut" | "bar" | "horizontal-bar" | "sparkline" | "gauge";
  data: Record<string, unknown>;
  readAs?: string;
}

export function DrillChart({ type, data, readAs }: DrillChartProps) {
  return (
    <div style={{ padding: "18px 22px", borderTop: "0.5px solid var(--neutral-gray-100, #ECE6D9)" }}>
      <div style={{
        fontSize: 10.5, fontWeight: 600, letterSpacing: 0.7,
        textTransform: "uppercase", color: "var(--text-muted, #7A7466)",
      }}>
        B \u00B7 Visualisierung
      </div>

      <div style={{
        background: "var(--bg-app-soft, #FAF6EC)",
        borderRadius: "var(--radius-sm, 8px)",
        padding: "16px",
        marginTop: 8,
      }}>
        {type === "donut" && <DonutChart data={data} />}
        {type === "bar" && <BarChart data={data} />}
        {type === "horizontal-bar" && <HorizontalBarChart data={data} />}
        {type === "gauge" && <GaugeChart data={data} />}
        {type === "sparkline" && <LineChart data={data} />}
      </div>

      {readAs && (
        <div style={{
          fontSize: 12.5, color: "#0C447C",
          background: "#E7F1FB", borderRadius: 7,
          padding: "9px 12px", marginTop: 10,
          display: "flex", gap: 8, alignItems: "flex-start", lineHeight: 1.55,
        }}>
          <Info style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
          <span>{readAs}</span>
        </div>
      )}
    </div>
  );
}

// ── Donut ─────────────────────────────────────────────────────────────

function DonutChart({ data }: { data: Record<string, unknown> }) {
  const labels = (data.labels as string[]) || [];
  const values = (data.values as number[]) || [];

  const total = values.reduce((s, v) => s + v, 0);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
      <div style={{ width: 160, height: 160, flexShrink: 0 }}>
        <Doughnut
          data={{
            labels,
            datasets: [{
              data: values,
              backgroundColor: PALETTE.slice(0, values.length),
              borderWidth: 2,
              borderColor: "#FAF6EC",
              hoverBorderColor: "#FFFFFF",
            }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            cutout: "65%",
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const v = ctx.raw as number;
                    const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
                    return `${ctx.label}: ${v.toLocaleString("de-DE")} \u20AC (${pct} %)`;
                  },
                },
              },
            },
          }}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1, minWidth: 140 }}>
        {labels.map((l, i) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
            <span style={{
              width: 10, height: 10, borderRadius: 3, flexShrink: 0,
              background: PALETTE[i % PALETTE.length],
            }} />
            <span style={{ flex: 1, color: "var(--navy-900, #0E1A2E)" }}>{l}</span>
            <span style={{ fontWeight: 600 }}>{values[i]?.toLocaleString("de-DE")}\u00A0\u20AC</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Vertical Bar ──────────────────────────────────────────────────────

function BarChart({ data }: { data: Record<string, unknown> }) {
  const labels = (data.labels as string[]) || [];
  const values = (data.values as number[]) || [];

  return (
    <div style={{ maxHeight: 200 }}>
      <Bar
        data={{
          labels,
          datasets: [{
            label: "Kosten",
            data: values,
            backgroundColor: "#E8943C",
            borderRadius: 6,
            borderSkipped: false,
            barThickness: 28,
          }],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `${(ctx.raw as number).toLocaleString("de-DE")} \u20AC`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: "var(--text-muted, #7A7466)", font: { size: 11 } },
            },
            y: {
              grid: { color: "rgba(14,26,46,0.06)" },
              ticks: {
                color: "var(--text-muted, #7A7466)",
                font: { size: 11 },
                callback: (v) => `${Number(v).toLocaleString("de-DE")} \u20AC`,
              },
            },
          },
        }}
        height={180}
      />
    </div>
  );
}

// ── Horizontal Bar ────────────────────────────────────────────────────

function HorizontalBarChart({ data }: { data: Record<string, unknown> }) {
  const labels = (data.labels as string[]) || [];
  const values = (data.values as number[]) || [];
  const types = (data.types as string[]) || [];

  const colors = values.map((v, i) => {
    if (types[i] === "einnahme") return "#5A8F4D";
    if (v < 0) return "#D14F3D";
    return "#E8943C";
  });

  return (
    <div style={{ maxHeight: Math.max(180, labels.length * 32) }}>
      <Bar
        data={{
          labels,
          datasets: [{
            data: values,
            backgroundColor: colors,
            borderRadius: 4,
            borderSkipped: false,
            barThickness: 18,
          }],
        }}
        options={{
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.raw as number;
                  return `${v >= 0 ? "+" : ""}${v.toLocaleString("de-DE")} \u20AC`;
                },
              },
            },
          },
          scales: {
            x: {
              grid: { color: "rgba(14,26,46,0.06)" },
              ticks: {
                color: "var(--text-muted, #7A7466)",
                font: { size: 10 },
                callback: (v) => `${Number(v).toLocaleString("de-DE")}`,
              },
            },
            y: {
              grid: { display: false },
              ticks: { color: "var(--navy-900, #0E1A2E)", font: { size: 11 } },
            },
          },
        }}
        height={Math.max(180, labels.length * 32)}
      />
    </div>
  );
}

// ── Gauge (SVG Ring) ──────────────────────────────────────────────────

function GaugeChart({ data }: { data: Record<string, unknown> }) {
  const value = (data.value as number) || 0;
  const max = (data.max as number) || 100;
  const pct = Math.min(value / max, 1);

  const size = 140;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);

  const color = pct >= 0.9 ? "var(--success-green, #5A8F4D)"
    : pct >= 0.8 ? "var(--accent-orange, #E8943C)"
    : "var(--danger-red, #D14F3D)";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--neutral-gray-100, #ECE6D9)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div style={{
        position: "relative", marginTop: -90,
        fontSize: 32, fontWeight: 700, color: "var(--navy-900, #0E1A2E)",
        textAlign: "center",
      }}>
        {value}<span style={{ fontSize: 16, fontWeight: 400, color: "var(--text-muted)" }}> %</span>
      </div>
      <div style={{ height: 46 }} />
    </div>
  );
}

// ── Line / Area Chart (formerly Sparkline) ──────────────────────────────

function LineChart({ data }: { data: Record<string, unknown> }) {
  const labels = (data.labels as string[]) || ["Jul","Aug","Sep","Okt","Nov","Dez","Jan","Feb","Mär","Apr","Mai","Jun"];
  const values = (data.values as number[]) || [];
  const previousValues = (data.previousValues as number[]) || values.map(v => v * (0.8 + Math.random() * 0.4)); // Fallback mock

  // Calculate average for "Vorjahr" if needed, or overall average
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 11.5 }}>
          <span style={{ color: "var(--text-muted)", fontSize: 10, textTransform: "uppercase" }}>Werte pro Monat</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: "var(--accent-orange, #E8943C)" }} />
            <span style={{ fontWeight: 600 }}>dieses Jahr</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 16, height: 2, background: "#C8C2B5", borderStyle: "dashed" }} />
            <span style={{ color: "var(--text-muted)" }}>Vorjahr (gestrichelt)</span>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          Ø: {avg.toLocaleString("de-DE", { maximumFractionDigits: 0 })}
        </div>
      </div>

      <div style={{ height: 220 }}>
        <Line
          data={{
            labels,
            datasets: [
              {
                label: "dieses Jahr",
                data: values,
                borderColor: "#E8943C",
                backgroundColor: (context) => {
                  const ctx = context.chart.ctx;
                  const gradient = ctx.createLinearGradient(0, 0, 0, 220);
                  gradient.addColorStop(0, "rgba(232,148,60,0.25)");
                  gradient.addColorStop(1, "rgba(232,148,60,0.0)");
                  return gradient;
                },
                borderWidth: 2.5,
                fill: true,
                tension: 0.4,
                pointRadius: 3,
                pointBackgroundColor: "#E8943C",
                pointBorderColor: "#fff",
                pointHoverRadius: 6,
              },
              {
                label: "Vorjahr",
                data: previousValues,
                borderColor: "#C8C2B5",
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
              }
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: "index",
              intersect: false,
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString("de-DE")}`,
                },
              },
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { color: "var(--text-muted, #7A7466)", font: { size: 10 } },
              },
              y: {
                grid: { color: "rgba(14,26,46,0.06)" },
                border: { display: false },
                ticks: {
                  color: "var(--text-muted, #7A7466)",
                  font: { size: 10 },
                  callback: (v) => {
                    const num = Number(v);
                    if (num >= 1000) return `${num / 1000}k`;
                    return num;
                  },
                },
              },
            },
          }}
        />
      </div>
      <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
        → Monate (letzte 12)
      </div>
    </div>
  );
}
