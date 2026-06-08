"use client";

import { useEffect, useState } from "react";
import { Target, Loader2 } from "lucide-react";
import { getAuftragDbRanking } from "../actions";
import { useRouter } from "next/navigation";

type DbRankingData = {
  order_id: string;
  order_number: string;
  kunde_name: string;
  erloes_netto: number;
  deckungsbeitrag: number;
};

export function DbRankingKachel() {
  const [data, setData] = useState<DbRankingData[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const result = await getAuftragDbRanking(10);
      setData(result);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[350px] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[350px]">
      <div className="p-6 pb-4 flex items-center gap-3 border-b border-neutral-gray-100">
        <Target className="w-5 h-5 text-navy-500" />
        <h3 className="font-bold text-navy-900 text-lg">Auftrags-DB-Ranking</h3>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-auto">
        {data.length === 0 ? (
          <div className="flex-1 h-full flex items-center justify-center text-neutral-gray-500 font-medium p-6">
            Noch keine Aufträge mit Erlösdaten
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-neutral-gray-500 uppercase bg-neutral-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 font-semibold">Auftragsnr</th>
                <th className="px-4 py-3 font-semibold">Kunde</th>
                <th className="px-4 py-3 font-semibold text-right">Erlös</th>
                <th className="px-4 py-3 font-semibold text-right">DB</th>
                <th className="px-4 py-3 font-semibold text-right">Marge</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const marge = row.erloes_netto > 0 ? (row.deckungsbeitrag / row.erloes_netto) * 100 : 0;
                const isNegative = row.deckungsbeitrag < 0;
                return (
                  <tr 
                    key={row.order_id} 
                    className={`border-b border-neutral-gray-100 cursor-pointer transition-colors ${
                      isNegative ? 'bg-danger-red/10 hover:bg-danger-red/20' : 'hover:bg-neutral-gray-50'
                    }`}
                    onClick={() => router.push(`/orders/${row.order_id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-navy-900 whitespace-nowrap">{row.order_number}</td>
                    <td className="px-4 py-3 text-text-muted truncate max-w-[120px]" title={row.kunde_name}>{row.kunde_name}</td>
                    <td className="px-4 py-3 text-right font-medium whitespace-nowrap">€ {row.erloes_netto.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</td>
                    <td className={`px-4 py-3 text-right font-bold whitespace-nowrap ${isNegative ? 'text-danger-red' : 'text-emerald-600'}`}>
                      € {row.deckungsbeitrag.toLocaleString('de-DE', { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right text-text-muted whitespace-nowrap">
                      {marge.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
