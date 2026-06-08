"use client";

import { useState, useEffect } from "react";
import { Crown, Loader2 } from "lucide-react";
import { getTopKunden } from "../actions";

export function TopKundenKachel() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await getTopKunden(10);
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
        <Crown className="w-5 h-5 text-gold-500" />
        <h3 className="font-bold text-navy-900 text-lg">Top Kunden (nach DB)</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-neutral-gray-500 font-medium p-6">
            Noch keine Kundendaten
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-neutral-gray-500 uppercase bg-neutral-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-semibold">Kunde</th>
                <th className="px-4 py-3 font-semibold text-right">Umsatz</th>
                <th className="px-4 py-3 font-semibold text-right">DB</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.customer_id} className="border-b border-neutral-gray-100 hover:bg-neutral-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-navy-900 truncate max-w-[150px]" title={row.name}>{row.name}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">€ {row.umsatz_gesamt?.toLocaleString('de-DE', { maximumFractionDigits: 0 }) || 0}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">€ {row.db_gesamt?.toLocaleString('de-DE', { maximumFractionDigits: 0 }) || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
