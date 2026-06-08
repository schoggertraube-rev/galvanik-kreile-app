"use client";

import { useState, useEffect } from "react";
import { Activity, Loader2 } from "lucide-react";
import { getEngpassDaten } from "../actions";

export function EngpassKachel() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getEngpassDaten();
      setData(res);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex items-center justify-center h-[450px]">
        <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
      </div>
    );
  }
  return (
    <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[450px]">
      <div className="p-6 pb-4 flex items-center gap-3 border-b border-neutral-gray-100">
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
              const score = row.engpass_score || 0;
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
                <div key={row.kostenstelle_id} className={`rounded-xl border p-4 flex flex-col ${bgColor}`}>
                  <h4 className="font-bold text-navy-900 truncate mb-1">{row.name}</h4>
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
    </div>
  );
}
