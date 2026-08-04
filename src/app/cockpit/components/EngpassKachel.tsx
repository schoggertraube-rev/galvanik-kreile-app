"use client";

import { useState, useEffect } from "react";
import { Activity, Loader2, ArrowRight, Beaker, GitPullRequest } from "lucide-react";
import {
  getEngpassDaten,
  getEngpassDetails,
  type EngpassDetails,
  type EngpassStation,
} from "../actions";
import { KachelInfo } from "@/components/ui/KachelInfo";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";
import Link from "next/link";
import { useOrderModal } from "@/components/orders/OrderModalProvider";

export function EngpassKachel() {
  const [data, setData] = useState<EngpassStation[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<EngpassStation | null>(null);
  const [details, setDetails] = useState<EngpassDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const { openOrder } = useOrderModal();

  useEffect(() => {
    async function load() {
      const res = await getEngpassDaten();
      setData(res);
      setLoading(false);
    }
    load();
  }, []);

  const openDrawer = async (station: EngpassStation) => {
    setSelectedStation(station);
    setDrawerOpen(true);
    setDetailsLoading(true);
    const res = await getEngpassDetails(station.kuerzel);
    setDetails(res);
    setDetailsLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex items-center justify-center h-[450px]">
        <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[450px] relative">
        <div className="absolute top-4 right-4 z-10">
          <KachelInfo 
            wasZeigtDieKachel="Auslastung der 6 Produktionsstationen im laufenden Monat"
            wasBedeutetDas="Grün (<50%): Kapazität frei. Gelb (50-85%): normal. Rot (>85%): Engpass — prüfen ob Umverteilung oder Personal nötig."
            datenquelle="Berechnet aus gebuchten Arbeitsstunden vs. verfügbaren Stunden"
          />
        </div>
        
        <div className="p-6 pb-4 flex items-center gap-3 border-b border-neutral-gray-100 pr-14">
          <Activity className="w-5 h-5 text-accent-orange" />
          <h3 className="font-bold text-navy-900 text-lg">Engpass-Heatmap</h3>
        </div>
        <div className="flex-1 p-6 overflow-y-auto">
          {data.length === 0 ? (
            <div className="flex h-full items-center justify-center text-neutral-gray-500 font-medium">
              Noch keine Engpassdaten
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.map((row) => {
                const score = row.auslastung_quote || row.engpass_score || 0;
                let bgColor = 'bg-neutral-gray-50 border-neutral-gray-200';
                let scoreColor = 'text-emerald-600';
                
                if (score > 0.95) {
                  bgColor = 'bg-danger-red/10 border-danger-red/30';
                  scoreColor = 'text-danger-red';
                } else if (score > 0.85) {
                  bgColor = 'bg-amber-100 border-amber-300';
                  scoreColor = 'text-amber-600';
                } else if (score > 0.6) {
                  bgColor = 'bg-yellow-50 border-yellow-200';
                  scoreColor = 'text-yellow-600';
                }

                return (
                  <div 
                    key={row.kostenstelle_id || row.kuerzel} 
                    className={`rounded-xl border p-4 flex flex-col cursor-pointer transition-colors hover:opacity-80 group ${bgColor}`}
                    onClick={() => openDrawer(row)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-bold text-navy-900 truncate">{row.name}</h4>
                      <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-navy-400" />
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-sm text-text-muted">Auslastung</span>
                      <span className={`font-black text-lg ${scoreColor}`}>{Math.round(score * 100)}%</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-text-muted">Warteschlange</span>
                      <span className="font-semibold text-sm">{row.warteschlange_aktuell || 0} Aufträge</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-4 border-t border-neutral-gray-100 bg-neutral-gray-50 rounded-b-2xl">
          <Link href="/einstellungen" className="text-xs font-semibold text-navy-600 hover:text-navy-800 flex items-center justify-center gap-1">
            Stunden pro Station anpassen <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      <ResponsiveDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedStation ? `Station: ${selectedStation.name} (${selectedStation.kuerzel})` : "Laden..."}
      >
        {detailsLoading || !selectedStation ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-neutral-gray-50 rounded-xl p-4 border border-neutral-gray-200 flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Auslastung aktuell:</span>
                <span className="font-bold text-navy-900">{Math.round((selectedStation.auslastung_quote || selectedStation.engpass_score || 0) * 100)}%</span>
              </div>
              {/* Progress bar visual */}
              <div className="w-full bg-neutral-gray-200 rounded-full h-2.5">
                <div 
                  className={`h-2.5 rounded-full ${(selectedStation.auslastung_quote || selectedStation.engpass_score || 0) > 0.85 ? 'bg-danger-red' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.min(100, Math.round((selectedStation.auslastung_quote || selectedStation.engpass_score || 0) * 100))}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-text-muted">Warteschlange:</span>
                <span className="font-bold text-navy-900">{details?.waitingOrders?.length || 0} Aufträge</span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-navy-900 mb-3 border-b border-neutral-gray-100 pb-2">Wartende Aufträge</h4>
              {details?.waitingOrders?.length === 0 ? (
                <p className="text-sm text-text-muted">Keine wartenden Aufträge.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {details?.waitingOrders?.map(o => (
                    <button key={o.id} onClick={() => { openOrder(o.id); setDrawerOpen(false); }} className="w-full text-left flex justify-between items-center p-3 hover:bg-neutral-gray-50 rounded-lg border border-transparent hover:border-neutral-gray-200">
                      <div className="flex flex-col">
                        <span className="font-bold text-navy-900 text-sm">{o.order_number}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-text-muted">Eingang: {new Date(o.intake_date ?? 0).toLocaleDateString()}</span>
                        <ArrowRight className="w-4 h-4 text-neutral-gray-400" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 className="font-bold text-navy-900 mb-3 border-b border-neutral-gray-100 pb-2">Trend (letzte 4 Wochen)</h4>
              <p className="text-sm text-text-muted">Historische Auslastungstrends sind noch nicht ausreichend für Analyse.</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
              <h4 className="font-bold text-navy-900 mb-2">Was tun?</h4>
              <p className="text-sm text-text-muted mb-4">
                {(selectedStation.auslastung_quote || selectedStation.engpass_score || 0) > 0.85 
                  ? "Die Station nähert sich der Kapazitätsgrenze." 
                  : "Kapazität ist in Ordnung."}
              </p>
              <div className="flex flex-col gap-2">
                <button 
                  className="px-4 py-2 bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                  onClick={() => {
                    const el = document.getElementById("whatif-studio-btn");
                    if (el) { el.click(); setDrawerOpen(false); }
                  }}
                >
                  <Beaker className="w-4 h-4" /> Mitarbeiter-Szenario prüfen
                </button>
                <Link 
                  href={`/orders?station=${selectedStation.kuerzel}`}
                  className="px-4 py-2 bg-white border border-neutral-gray-300 hover:bg-neutral-gray-50 text-navy-700 font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <GitPullRequest className="w-4 h-4" /> Aufträge an dieser Station: {details?.waitingOrders?.length || 0} anzeigen
                </Link>
              </div>
            </div>
          </div>
        )}
      </ResponsiveDetailDrawer>
    </>
  );
}
