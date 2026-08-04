"use client";

import { useEffect, useState } from "react";
import { Target, Loader2, ArrowRight, FileText, User } from "lucide-react";
import { getAuftragDbRanking, getAuftragDbDetails, type AuftragDbDetails, type AuftragDbRankingRow } from "../actions";
import { KachelInfo } from "@/components/ui/KachelInfo";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";
import { useRouter } from "next/navigation";

export function DbRankingKachel() {
  const [data, setData] = useState<AuftragDbRankingRow[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<AuftragDbRankingRow | null>(null);
  const [details, setDetails] = useState<AuftragDbDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const result = await getAuftragDbRanking(10);
      setData(result);
      setLoading(false);
    }
    load();
  }, []);

  const handleRowClick = async (row: AuftragDbRankingRow) => {
    setSelectedOrder(row);
    setDrawerOpen(true);
    setDetailsLoading(true);
    const result = await getAuftragDbDetails(row.order_id);
    setDetails(result);
    setDetailsLoading(false);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[350px] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[350px] relative">
        <div className="absolute top-4 right-4 z-10">
          <KachelInfo 
            wasZeigtDieKachel="Aufträge sortiert nach Wirtschaftlichkeit"
            wasBedeutetDas="Grüne Aufträge bringen Geld. Rote verlieren Geld. Prüfen Sie rote Aufträge auf Ursachen."
            datenquelle="Berechnet aus Rechnungen, Verbrauchsbuchungen und Zeiterfassung"
          />
        </div>
        
        <div className="p-6 pb-4 flex items-center gap-3 border-b border-neutral-gray-100 pr-14">
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
                      className={`border-b border-neutral-gray-100 cursor-pointer transition-colors group ${
                        isNegative ? 'bg-danger-red/10 hover:bg-danger-red/20' : 'hover:bg-neutral-gray-50'
                      }`}
                      onClick={() => handleRowClick(row)}
                    >
                      <td className="px-4 py-3 font-medium text-navy-900 whitespace-nowrap">
                        <span className="flex items-center gap-2">
                          {row.order_number}
                          <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-navy-400" />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-muted truncate max-w-[120px]" title={row.kunde_name ?? undefined}>{row.kunde_name}</td>
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

      <ResponsiveDetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={selectedOrder ? `Auftrag ${selectedOrder.order_number} — Deckungsbeitrag` : "Laden..."}
      >
        {detailsLoading || !details ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
          </div>
        ) : (
          <div className="space-y-6">
            {details.deckungsbeitrag < 0 && (
              <div className="bg-danger-red/10 border border-danger-red/30 rounded-xl p-4 text-danger-red">
                <h4 className="font-bold flex items-center gap-2 mb-1">
                  ⚠ Dieser Auftrag war ein Verlustgeschäft.
                </h4>
                <p className="text-sm">
                  {details.erloes_netto === 0 ? "Keine Rechnung gestellt oder Erlös = 0." :
                   details.arbeitszeit_kosten > details.erloes_netto * 0.6 ? "Überdurchschnittliche Arbeitszeit erfasst." :
                   details.material_kosten > details.erloes_netto * 0.4 ? "Hoher Materialverbrauch." :
                   "Allgemein zu geringer Erlös für die angefallenen Kosten."}
                </p>
              </div>
            )}
            
            <div className="bg-neutral-gray-50 rounded-xl p-5 border border-neutral-gray-200">
              <div className="flex flex-col gap-3 font-mono text-sm">
                <div className="flex justify-between">
                  <span>Erlös:</span>
                  <span className="font-bold">€ {details.erloes_netto?.toLocaleString('de-DE', {maximumFractionDigits:0}) || 0}</span>
                </div>
                <div className="flex justify-between text-danger-red">
                  <span>Material:</span>
                  <span>− € {details.material_kosten.toLocaleString('de-DE', {maximumFractionDigits:0})}</span>
                </div>
                <div className="flex justify-between text-danger-red">
                  <span>Arbeitszeit:</span>
                  <span>− € {details.arbeitszeit_kosten.toLocaleString('de-DE', {maximumFractionDigits:0})}</span>
                </div>
                <div className="flex justify-between text-danger-red">
                  <span>Energie:</span>
                  <span>− € {details.energie_anteil_kosten.toLocaleString('de-DE', {maximumFractionDigits:0})}</span>
                </div>
                <div className="border-t border-neutral-gray-300 my-1 pt-2 flex justify-between font-bold text-base">
                  <span>Deckungsbeitrag:</span>
                  <span className={details.deckungsbeitrag < 0 ? 'text-danger-red' : 'text-emerald-600'}>
                    € {details.deckungsbeitrag?.toLocaleString('de-DE', {maximumFractionDigits:0}) || 0} 
                    <span className="text-xs text-text-muted font-normal ml-2">
                      ({details.erloes_netto > 0 ? ((details.deckungsbeitrag / details.erloes_netto) * 100).toFixed(1) : 0}%)
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-navy-900 mb-3 border-b border-neutral-gray-100 pb-2">Vergleich mit ähnlichen Aufträgen</h4>
              <p className="text-sm text-text-muted">Vergleichsdaten (Median für diese Oberflächen/Teile) sind derzeit noch im Aufbau.</p>
            </div>

            <div className="pt-4 border-t border-neutral-gray-100 flex gap-3">
              <button 
                onClick={() => router.push(`/orders/${details.order_id}`)}
                className="flex-1 py-2 font-semibold text-white bg-navy-600 hover:bg-navy-700 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" /> Auftrag öffnen
              </button>
              <button 
                onClick={() => router.push(`/customers/${details.customer_id}`)}
                className="flex-1 py-2 font-semibold text-navy-600 bg-neutral-gray-50 hover:bg-neutral-gray-100 border border-neutral-gray-200 shadow-sm rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4" /> Kunde anzeigen
              </button>
            </div>
          </div>
        )}
      </ResponsiveDetailDrawer>
    </>
  );
}
