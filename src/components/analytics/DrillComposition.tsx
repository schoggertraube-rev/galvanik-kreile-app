"use client";

import { useState } from "react";
import Link from "next/link";
import type { CompositionRow } from "@/lib/analytics/analyticsDataService";
import "lucide-react";

interface DrillCompositionProps {
  items: CompositionRow[];
  label: string;
}

type SortKey = "amt" | "date" | "name";

const SORT_LABELS: Record<SortKey, string> = {
  amt: "Gr\u00F6\u00DFter Betrag zuerst",
  date: "Neueste zuerst",
  name: "Name A\u2013Z",
};

function sortItems(items: CompositionRow[], key: SortKey): CompositionRow[] {
  const copy = [...items];
  if (key === "amt") copy.sort((a, b) => b.amount - a.amount);
  else if (key === "name") copy.sort((a, b) => a.label.localeCompare(b.label, "de"));
  else copy.sort((a, b) => b.date.localeCompare(a.date, "de"));
  return copy;
}

export function DrillComposition({ items, label }: DrillCompositionProps) {
  const [sortKey, setSortKey] = useState<SortKey>("amt");
  const sorted = sortItems(items, sortKey);

  return (
    <div style={{ padding: "18px 22px", borderTop: "0.5px solid var(--neutral-gray-100, #ECE6D9)" }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", gap: 10, flexWrap: "wrap",
      }}>
        <div style={{
          fontSize: 10.5, fontWeight: 600,
          letterSpacing: 0.7, textTransform: "uppercase",
          color: "var(--text-muted, #7A7466)",
        }}>
          C \u00B7 Zusammensetzung{" "}
          <span style={{
            textTransform: "none", letterSpacing: 0, fontWeight: 400,
          }}>
            \u00B7 {items.length} {label}
          </span>
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          style={{
            fontFamily: "inherit", fontSize: 12.5,
            border: "1px solid var(--neutral-gray-300, #C8C2B5)",
            borderRadius: "var(--radius-sm, 8px)",
            background: "var(--surface-card, #FFFFFF)",
            padding: "6px 9px", color: "var(--navy-900, #0E1A2E)",
            cursor: "pointer",
          }}
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
            <option key={k} value={k}>{SORT_LABELS[k]}</option>
          ))}
        </select>
      </div>

      {/* Item list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 11 }}>
        {sorted.length === 0 ? (
          <div style={{
            border: "1.5px dashed var(--neutral-gray-300, #C8C2B5)",
            borderRadius: "var(--radius-sm, 8px)",
            padding: 16, textAlign: "center",
            background: "var(--bg-app-soft, #FAF6EC)",
            fontSize: 13, color: "var(--text-muted, #7A7466)",
          }}>
            Keine {label} in diesem Zeitraum.
          </div>
        ) : sorted.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "11px 13px",
              background: "var(--bg-app-soft, #FAF6EC)",
              borderRadius: "var(--radius-sm, 8px)",
              cursor: "pointer", textDecoration: "none",
              color: "inherit",
              transition: "background 0.1s, box-shadow 0.1s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--surface-tinted-soft, #F2E9D8)";
              (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-card)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-app-soft, #FAF6EC)";
              (e.currentTarget as HTMLElement).style.boxShadow = "none";
            }}
          >
            {/* Avatar */}
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 600,
              background: `${item.avatarColor}20`,
              color: item.avatarColor,
              flexShrink: 0,
            }}>
              {item.avatarInitial}
            </div>

            {/* Label + sublabel */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--navy-900)" }}>
                {item.label}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted, #7A7466)" }}>
                {item.date ? `${item.date} \u00B7 ` : ""}{item.sublabel}
              </div>
            </div>

            {/* Amount */}
            {item.amount > 0 && (
              <div style={{
                fontWeight: 650, fontSize: 14,
                whiteSpace: "nowrap", marginLeft: "auto",
                color: "var(--navy-900)",
              }}>
                {item.amount.toLocaleString("de-DE")}\u00A0\u20AC
              </div>
            )}

            {/* Chevron */}
            <svg style={{ width: 14, height: 14, color: "var(--text-muted)" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 6 6 6-6 6" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
