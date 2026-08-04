"use client";

/**
 * AnalyticsDrillDrawer v2 — fetches REAL data, renders individual charts.
 * Desktop: right-docked 720px. Tablet: 70%. Mobile: fullscreen.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { KPI_REGISTRY } from "@/lib/analytics/kpiRegistry";
import { fetchKpiSnapshot, type KpiSnapshot, type DataStatus } from "@/lib/analytics/analyticsDataService";
import type { PeriodType } from "@/lib/analytics/plainLanguage";
import { DrillCategoryHeader } from "./DrillCategoryHeader";
import { DrillHero } from "./DrillHero";
import { DrillChart } from "./DrillChart";
import { DrillComposition } from "./DrillComposition";
import { DrillCrossKpi } from "./DrillCrossKpi";
import { DrillInsight } from "./DrillInsight";
import { DrillLinkChips } from "./DrillLinkChips";

interface AnalyticsDrillDrawerProps {
  kpiId: string;
  period: PeriodType;
  onClose: () => void;
  onPeriodChange: (p: PeriodType) => void;
}

interface KpiRequestSnapshot {
  key: string;
  status: DataStatus;
  snapshot: KpiSnapshot | null;
  error: string | null;
}

const subscribeToBrowser = () => () => {};
const getBrowserSnapshot = () => true;
const getServerSnapshot = () => false;

export function AnalyticsDrillDrawer({
  kpiId,
  period,
  onClose,
  onPeriodChange,
}: AnalyticsDrillDrawerProps) {
  const mounted = useSyncExternalStore(subscribeToBrowser, getBrowserSnapshot, getServerSnapshot);
  const [visible, setVisible] = useState(false);
  const [request, setRequest] = useState<KpiRequestSnapshot | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);

  const kpi = KPI_REGISTRY[kpiId];
  const requestKey = `${kpiId}:${period}:${retryNonce}`;
  const activeRequest = request?.key === requestKey ? request : null;
  const status = activeRequest?.status ?? "loading";
  const snapshot = activeRequest?.snapshot ?? null;
  const error = activeRequest?.error ?? null;

  // Mount + animate in
  useEffect(() => {
    let innerFrame: number | undefined;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      if (innerFrame !== undefined) cancelAnimationFrame(innerFrame);
    };
  }, []);

  // Fetch real data
  useEffect(() => {
    let cancelled = false;

    void fetchKpiSnapshot(kpiId).then((result) => {
      if (cancelled) return;
      if (result.status === "ok" && result.data) {
        setRequest({ key: requestKey, status: "ok", snapshot: result.data, error: null });
      } else {
        setRequest({
          key: requestKey,
          status: result.status,
          snapshot: null,
          error: result.message || "Daten konnten nicht geladen werden.",
        });
      }
    });

    return () => { cancelled = true; };
  }, [kpiId, requestKey]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handleClose]);

  const retry = () => setRetryNonce(nonce => nonce + 1);

  if (!mounted || !kpi) return null;

  return createPortal(
    <>
      <style>{`
        .drill-backdrop {
          position: fixed; inset: 0; z-index: 50;
          background: rgba(14,26,46,0.5);
          backdrop-filter: blur(4px);
          opacity: ${visible ? 1 : 0};
          transition: opacity 250ms ease;
          display: flex; align-items: center; justify-content: center;
          padding: 1rem;
        }
        .drill-drawer {
          position: relative;
          width: 100%; max-width: 780px; max-height: 90vh;
          background: var(--surface-card, #FFFFFF);
          border-radius: var(--radius-xl, 24px);
          box-shadow: 0 20px 60px -10px rgba(14,26,46,0.3);
          transform: scale(${visible ? 1 : 0.96}) translateY(${visible ? 0 : "10px"});
          opacity: ${visible ? 1 : 0};
          transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease;
          display: flex; flex-direction: column;
          overflow: hidden;
          font-family: var(--font-body, 'Inter', sans-serif);
          color: var(--navy-900, #0E1A2E);
          line-height: 1.5;
        }
        .drill-scroll {
          flex: 1; overflow-y: auto; overscroll-behavior: contain;
        }
        .drill-skeleton {
          animation: drillPulse 1.2s ease-in-out infinite;
        }
        @keyframes drillPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
        @media (max-width: 768px) {
          .drill-drawer { width: 100%; }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .drill-drawer { width: 70%; }
        }
      `}</style>

      {/* Backdrop + Container */}
      <div className="drill-backdrop" onClick={handleClose}>
        {/* Modal Window */}
        <div 
          className="drill-drawer" 
          ref={drawerRef}
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
        <DrillCategoryHeader
          icon={kpi.icon}
          label={kpi.label}
          subtitle={kpi.subtitle}
          accentGradient={kpi.accentGradient}
          period={period}
          onPeriodChange={onPeriodChange}
          onClose={handleClose}
        />

        <div className="drill-scroll">
          {status === "loading" && <SkeletonContent />}

          {status === "error" && (
            <div style={{ padding: 22 }}>
              <div style={{
                padding: 16, borderRadius: 10,
                background: "rgba(209,79,61,0.08)",
                border: "1px solid rgba(209,79,61,0.2)",
                color: "var(--danger-red, #D14F3D)",
                fontSize: 13,
              }}>
                <strong>Fehler:</strong> {error}
                <button
                  onClick={retry}
                  style={{
                    marginTop: 8, display: "block",
                    padding: "6px 14px", borderRadius: 7,
                    background: "var(--danger-red)", color: "#fff",
                    border: "none", cursor: "pointer", fontFamily: "inherit",
                    fontSize: 12, fontWeight: 600,
                  }}
                >
                  Erneut versuchen
                </button>
              </div>
            </div>
          )}

          {status === "ok" && snapshot && (
            <>
              {/* A: Hero */}
              <DrillHero snapshot={snapshot} kpi={kpi} />

              {/* B: Chart */}
              <DrillChart
                type={kpi.chartType}
                data={snapshot.chartData as Record<string, unknown>}
                readAs={kpi.plainMeaning ? `So liest du das: ${kpi.plainMeaning}. Die Visualisierung zeigt die aktuelle Verteilung.` : undefined}
              />

              {/* C: Composition */}
              <DrillComposition
                items={snapshot.compositionItems}
                label={kpi.compositionLabel}
              />

              {/* D: Cross-KPI */}
              <DrillCrossKpi inputs={snapshot.crossInputs} kpiLabel={kpi.label} />

              {/* E: Insight */}
              <DrillInsight />

              {/* F: Links */}
              <DrillLinkChips links={kpi.linkedAreas} />

              <div style={{ height: 40 }} />
            </>
          )}
        </div>
      </div>
      </div>
    </>,
    document.body,
  );
}

// ── Skeleton UI ───────────────────────────────────────────────────────

function SkeletonContent() {
  const bar = (w: string, h = 16) => (
    <div className="drill-skeleton" style={{
      width: w, height: h, borderRadius: 6,
      background: "var(--neutral-gray-100, #ECE6D9)",
    }} />
  );

  return (
    <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>
      {bar("40%", 12)}
      {bar("60%", 36)}
      {bar("80%", 14)}
      <div style={{ height: 8 }} />
      {bar("100%", 160)}
      <div style={{ height: 8 }} />
      {bar("100%", 60)}
      {bar("100%", 60)}
      {bar("100%", 60)}
    </div>
  );
}
