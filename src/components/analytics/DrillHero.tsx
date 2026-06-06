"use client";

import { MeaningPill } from "./MeaningPill";
import { InfoPopover } from "./InfoPopover";
import type { KpiDefinition } from "@/lib/analytics/kpiRegistry";
import type { KpiSnapshot } from "@/lib/analytics/analyticsDataService";
import type { MeaningLevel } from "@/lib/analytics/plainLanguage";

interface DrillHeroProps {
  snapshot: KpiSnapshot;
  kpi: KpiDefinition;
}

function formatValue(value: number, unit: string): string {
  if (unit === "EUR") return `${value.toLocaleString("de-DE")}\u00A0\u20AC`;
  if (unit === "PERCENT") return `${value}\u00A0%`;
  if (unit === "COUNT") return `${value}`;
  return `${value.toLocaleString("de-DE")}`;
}

function classifyValue(value: number, unit: string): MeaningLevel {
  if (unit === "PERCENT") {
    if (value >= 90) return "gut";
    if (value >= 80) return "beobachten";
    return "kritisch";
  }
  // For costs: always "beobachten" unless we have comparison data
  return "beobachten";
}

export function DrillHero({ snapshot, kpi }: DrillHeroProps) {
  const level = snapshot.value !== null ? classifyValue(snapshot.value, snapshot.unit) : "beobachten";

  return (
    <div style={{ padding: "18px 22px" }}>
      {/* Kicker */}
      <div style={{
        fontSize: 10.5, fontWeight: 600,
        letterSpacing: 0.7, textTransform: "uppercase",
        color: "var(--text-muted, #7A7466)",
      }}>
        {kpi.plainMeaning}
      </div>

      {/* Value */}
      <div style={{
        display: "flex", gap: 18, alignItems: "flex-start",
        justifyContent: "space-between", flexWrap: "wrap", marginTop: 14,
      }}>
        <div>
          <div style={{
            display: "flex", alignItems: "baseline", gap: 12,
            flexWrap: "wrap", marginTop: 6,
          }}>
            {snapshot.value !== null ? (
              <span style={{
                fontSize: 34, fontWeight: 680, lineHeight: 1,
                letterSpacing: -0.5,
                color: "var(--navy-900, #0E1A2E)",
              }}>
                {formatValue(snapshot.value, snapshot.unit)}
              </span>
            ) : (
              <span style={{
                fontSize: 34, fontWeight: 680, lineHeight: 1,
                color: "var(--text-muted, #7A7466)",
              }}>
                \u2014
              </span>
            )}

            {snapshot.changeText && (
              <span style={{
                display: "inline-flex", alignItems: "center",
                gap: 4, padding: "3px 9px", borderRadius: 20,
                fontSize: 11.5, fontWeight: 600,
                background: snapshot.changePct && snapshot.changePct > 0
                  ? "rgba(209,79,61,0.1)" : "rgba(90,143,77,0.1)",
                color: snapshot.changePct && snapshot.changePct > 0
                  ? "var(--danger-red)" : "var(--success-green)",
              }}>
                {snapshot.changeText}
              </span>
            )}
          </div>

          {/* Meaning + info + meta */}
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            fontSize: 12.5, color: "var(--text-muted, #7A7466)",
            marginTop: 9, flexWrap: "wrap",
          }}>
            <MeaningPill level={level} />
            <InfoPopover infoKey={kpi.infoKey} />
            <span>{snapshot.meta}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
