import React from "react";
import { Activity } from "lucide-react";
import { AnalyseTileSummary } from "@/lib/analyse/dataContracts";

interface Props {
  summary?: AnalyseTileSummary;
  onClick: () => void;
}

export function WerkstattPulsKachel({ summary, onClick }: Props) {
  if (!summary) return null;

  return (
    <div
      onClick={onClick}
      style={{ textDecoration: "none", color: "inherit", cursor: "pointer" }}
    >
      <div className="t-tile t-hero">
        <div className="t-glow" style={{ background: "#22D3EE" }}></div>
        <div className="t-th">
          <div className="t-tl">
            <div
              className="t-ico"
              style={{ background: "rgba(34,211,238,.12)" }}
            >
              <Activity className="w-5 h-5" style={{ color: "var(--cyan)" }} />
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
        
        <div className="hero-body">
          <div className="hero-left">
            <div className="metrics">
              <div className="m">
                <div className="ml">{summary.primaryLabel}</div>
                <div className="mv">{summary.primaryValue || "—"}</div>
              </div>
              {summary.secondaryLabel && (
                <div className="m">
                  <div className="ml">{summary.secondaryLabel}</div>
                  <div className="mv">{summary.secondaryValue || "—"}</div>
                </div>
              )}
              {summary.tertiaryLabel && (
                <div className="m">
                  <div className="ml">{summary.tertiaryLabel}</div>
                  <div className="mv">{summary.tertiaryValue || "—"}</div>
                </div>
              )}
            </div>
            
            {summary.status === "data_missing" && summary.emptyState ? (
              <div className="mt-4 text-sm text-gray-500">
                {summary.emptyState.description}
              </div>
            ) : null}

            {summary.progressBars && summary.progressBars.length > 0 && (
              <div className="mbars" style={{ marginTop: 20 }}>
                {summary.progressBars.map((b, idx) => (
                  <div key={idx} className="mbar" title={`${b.label}: ${b.value}`}>
                    <div className={`mbar-f ${b.colorClass || 'bg-cyan-500'}`} style={{ height: `${b.fillRatio}%` }}></div>
                  </div>
                ))}
              </div>
            )}
            {summary.progressBars && summary.progressBars.length > 0 && (
              <div className="mbar-labels">
                {summary.progressBars.map((b, idx) => (
                  <span key={idx}>{b.label.substring(0, 3)}</span>
                ))}
              </div>
            )}
          </div>

          {summary.scoreRing !== undefined && (
            <div className="ring">
              <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--bd)" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--cyan)" strokeWidth="3" strokeDasharray={`${summary.scoreRing}, 100`} style={{ transition: 'stroke-dasharray 1s ease' }} />
              </svg>
              <div className="rval">{summary.scoreRing}</div>
            </div>
          )}
        </div>
        <div className="t-arr">Details →</div>
      </div>
    </div>
  );
}
