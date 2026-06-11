import React from "react";
import { Banknote } from "lucide-react";
import { AnalyseTileSummary } from "@/lib/analyse/dataContracts";

interface Props {
  summary?: AnalyseTileSummary;
  onClick: () => void;
}

export function UmsatzMargeKachel({ summary, onClick }: Props) {
  if (!summary) return null;

  return (
    <div
      onClick={onClick}
      style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
    >
      <div className="t-tile">
        <div className="t-glow" style={{ background: "#34D399" }}></div>
        <div className="t-th">
          <div className="t-tl">
            <div className="t-ico" style={{ background: "var(--posbg)" }}>
              <Banknote className="w-5 h-5" style={{ color: "var(--pos)" }} />
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
        
        <div className="spk">
          <svg viewBox="0 0 140 28" width="140" height="28">
            <defs>
              <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--pos)" stopOpacity="0.22" />
                <stop offset="100%" stopColor="var(--pos)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0,22 L16,19 L32,20 L48,16 L64,14 L80,13 L96,11 L112,10 L128,7 L140,5 L140,28 L0,28 Z"
              fill="url(#sg)"
            />
            <polyline
              points="0,22 16,19 32,20 48,16 64,14 80,13 96,11 112,10 128,7 140,5"
              fill="none"
              stroke="var(--pos)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="t-arr">Details →</div>
      </div>
    </div>
  );
}
