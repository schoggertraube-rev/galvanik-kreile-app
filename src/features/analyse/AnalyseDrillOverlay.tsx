"use client";

import React, { useEffect, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { AnalyseTileKey, AnalyseTileDetail } from "@/lib/analyse/dataContracts";
import { getAnalyseTileDetail } from "@/features/analyse/analyse.actions";
import { WerkstattPulsLevel2 } from "./kacheln/werkstatt-puls/WerkstattPulsLevel2";

interface Props {
  tileKey: AnalyseTileKey | null;
  period: string;
  onClose: () => void;
}

export function AnalyseDrillOverlay({ tileKey, period, onClose }: Props) {
  const [detail, setDetail] = useState<AnalyseTileDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tileKey) return;
    
    let mounted = true;
    setIsLoading(true);
    setError(null);

    async function load() {
      const res = await getAnalyseTileDetail(tileKey!, period);
      if (!mounted) return;
      if (res.error) {
        setError(res.error);
      } else {
        setDetail(res.data);
      }
      setIsLoading(false);
    }

    load();

    return () => { mounted = false; };
  }, [tileKey, period]);

  if (!tileKey) return null;

  return (
    <div className="fixed inset-0 z-[2000] bg-[#f1e9dc] overflow-y-auto" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}>
        {isLoading ? (
          <div className="p-12 text-center text-[var(--ink-2)]">Lade Daten...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">Fehler beim Laden der Details: {error}</div>
        ) : detail ? (
          tileKey === "werkstatt_puls" && detail.werkstattPulsData ? (
            <div className="bg-[#f1e9dc] min-h-screen">
              <WerkstattPulsLevel2 data={detail.werkstattPulsData} onClose={onClose} />
            </div>
          ) : (
            <div className="fixed inset-0 z-[2000] bg-[rgba(26,31,46,0.42)] backdrop-blur-[8px] flex items-start justify-center pt-12 pb-12 overflow-y-auto" onClick={onClose}>
              <div className="w-full max-w-[1000px] mx-4 bg-[var(--ci-surface)] rounded-[18px] border border-[var(--ci-border)] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-[var(--ci-border)] bg-[var(--ci-bg)]">
                  <div>
                    <h2 className="text-xl font-bold text-[var(--ci-ink)]">
                      {detail.summary.title || "Analyse Details"}
                    </h2>
                    <p className="text-sm text-[var(--ci-ink-2)] mt-1">
                      Zeitraum: {period}
                    </p>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <X className="w-5 h-5 text-[var(--ci-ink-3)]" />
                  </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6 bg-white flex flex-col gap-8">
                  {/* (Bisheriges Rendering für andere Kacheln) */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 border border-[var(--ci-border)] rounded-xl bg-[var(--ci-bg)]">
                      <div className="text-xs text-[var(--ci-ink-3)] font-semibold uppercase">{detail.summary.primaryLabel}</div>
                      <div className="text-2xl font-bold mt-1 text-[var(--ci-ink)]">{detail.summary.primaryValue || "-"}</div>
                    </div>
                  </div>

                  {detail.charts.map(chart => (
                    <div key={chart.id} className="p-6 border border-[var(--ci-border)] rounded-xl">
                      <h3 className="font-semibold mb-4 text-[var(--ci-ink)]">{chart.title}</h3>
                      {chart.emptyState ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg text-center border border-dashed border-gray-200">
                          <div className="font-semibold text-gray-700">{chart.emptyState.title}</div>
                          <div className="text-sm text-gray-500 mt-2 max-w-sm">{chart.emptyState.description}</div>
                        </div>
                      ) : (
                        <div className="h-48 flex items-center justify-center bg-gray-50 text-gray-400 rounded-lg">
                          [Chart Placeholder: {chart.type}]
                        </div>
                      )}
                    </div>
                  ))}

                </div>
              </div>
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
