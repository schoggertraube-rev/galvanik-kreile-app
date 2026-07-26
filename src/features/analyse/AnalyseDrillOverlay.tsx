"use client";

import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { AnalyseTileKey, AnalyseTileDetail } from "@/lib/analyse/dataContracts";
import { getAnalyseTileDetail } from "@/features/analyse/analyse.actions";
import { WerkstattPulsLevel2 } from "./kacheln/werkstatt-puls/WerkstattPulsLevel2";

interface Props {
  tileKey: AnalyseTileKey | null;
  period: string;
  onClose: () => void;
}

export function AnalyseDrillOverlay({ tileKey, period, onClose }: Props) {
  const requestKey = tileKey ? `${tileKey}\u0000${period}` : "";
  const [loadState, setLoadState] = useState<{
    requestKey: string;
    detail: AnalyseTileDetail | null;
    error: string | null;
  }>({ requestKey: "", detail: null, error: null });

  useEffect(() => {
    if (!tileKey) return;
    const activeTileKey = tileKey;

    let mounted = true;

    async function load() {
      try {
        const res = await getAnalyseTileDetail(activeTileKey, period);
        if (!mounted) return;
        setLoadState({
          requestKey,
          detail: res.error ? null : res.data,
          error: res.error ? res.error.message : null,
        });
      } catch (loadError) {
        if (!mounted) return;
        setLoadState({
          requestKey,
          detail: null,
          error: loadError instanceof Error ? loadError.message : "Analysedaten nicht verfügbar",
        });
      }
    }

    void load();

    return () => { mounted = false; };
  }, [tileKey, period, requestKey]);

  if (!tileKey) return null;
  const isLoading = loadState.requestKey !== requestKey;
  const detail = isLoading ? null : loadState.detail;
  const error = isLoading ? null : loadState.error;

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
              <WerkstattPulsLevel2
                data={detail.werkstattPulsData}
                evidence={detail.evidence}
                onClose={onClose}
              />
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
                      {chart.emptyState || chart.dataset.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg text-center border border-dashed border-gray-200">
                          <div className="font-semibold text-gray-700">{chart.emptyState?.title || 'Keine Diagrammdaten'}</div>
                          <div className="text-sm text-gray-500 mt-2 max-w-sm">{chart.emptyState?.description || 'Für diesen Zeitraum ist kein gespeicherter Datensatz vorhanden.'}</div>
                        </div>
                      ) : (
                        <div className="min-h-24 flex items-center justify-center bg-gray-50 text-gray-600 rounded-lg p-6 text-center">
                          {chart.dataset.length} gespeicherte Datenpunkte · Visualisierungstyp „{chart.type}“ ist in dieser Ansicht noch nicht umgesetzt.
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
