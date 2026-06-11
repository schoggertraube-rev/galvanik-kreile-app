import React from "react";
import { AlertTriangle } from "lucide-react";
import { AnalyseTileSummary } from "@/lib/analyse/dataContracts";

interface Props {
  summary?: AnalyseTileSummary;
  onClick: () => void;
}

export function QualitaetRisikoKachel({ summary, onClick }: Props) {
  if (!summary) return null;

  return (
    <div
      onClick={onClick}
      style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
    >
      <div className="t-tile">
        <div className="t-glow" style={{ background: "#FBBF24" }}></div>
        <div className="t-th">
          <div className="t-tl">
            <div className="t-ico" style={{ background: "var(--warnbg)" }}>
              <AlertTriangle className="w-5 h-5" style={{ color: "var(--warn)" }} />
            </div>
            <div>
              <div className="t-name">{summary.title}</div>
              <div className="t-sub">{summary.subtitle}</div>
            </div>
          </div>
          {summary.status === "stable" && <span className="t-pill t-pill-g">STABIL</span>}
          {summary.status === "watch" && <span className="t-pill t-pill-y">BEOBACHTEN</span>}
          {summary.status === "critical" && <span className="t-pill t-pill-r">KRITISCH</span>}
          {summary.status === "data_missing" && <span className="t-pill bg-gray-200 text-gray-600">KEINE DATEN</span>}
        </div>
        
        <div className="metrics">
          <div className="m">
            <div className="ml">{summary.primaryLabel}</div>
            <div className="mv">{summary.primaryValue || "—"}</div>
          </div>
          {summary.secondaryLabel && (
            <div className="m">
              <div className="ml">{summary.secondaryLabel}</div>
              <div className="mv sm">{summary.secondaryValue || "—"}</div>
            </div>
          )}
          {summary.tertiaryLabel && (
            <div className="m">
              <div className="ml">{summary.tertiaryLabel}</div>
              <div className="mv sm">{summary.tertiaryValue || "—"}</div>
            </div>
          )}
        </div>
        
        {summary.status === "data_missing" && summary.emptyState && (
          <div className="mt-4 text-sm text-gray-500">
            {summary.emptyState.description}
          </div>
        )}
        
        <div className="t-arr">Details →</div>
      </div>
    </div>
  );
}
