"use client";

import { useState, useEffect } from "react";
import { Crown, Loader2, Phone, Mail, FileText, ArrowRight, TrendingUp } from "lucide-react";
import { getTopKunden, getKundenDetails, getInaktiveKunden } from "../actions";
import { KachelInfo } from "@/components/ui/KachelInfo";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function TopKundenKachel() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  const [inaktiveDrawerOpen, setInaktiveDrawerOpen] = useState(false);
  const [inaktiveKunden, setInaktiveKunden] = useState<any[]>([]);
  const [inaktiveLoading, setInaktiveLoading] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const res = await getTopKunden(10);
      setData(res);
      setLoading(false);
    }
    load();
  }, []);

  const openCustomerDetails = async (id: string) => {
    setSelectedCustomerId(id);
    setDetailsLoading(true);
    const details = await getKundenDetails(id);
    setCustomerDetails(details);
    setDetailsLoading(false);
  };

  const openInaktiveDrawer = async () => {
    setInaktiveDrawerOpen(true);
    if (inaktiveKunden.length === 0) {
      setInaktiveLoading(true);
      const res = await getInaktiveKunden();
      setInaktiveKunden(res);
      setInaktiveLoading(false);
    }
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
            wasZeigtDieKachel="Die 10 profitabelsten Kunden nach Deckungsbeitrag"
            wasBedeutetDas="Pflegen Sie diese Beziehungen aktiv. Ein Verlust dieser Kunden trifft den Betrieb überproportional."
            datenquelle="Berechnet aus Aufträgen, Rechnungen und erfasstem Verbrauch/Zeit"
          />
        </div>
        
        <div className="p-6 pb-4 flex items-center gap-3 border-b border-neutral-gray-100 pr-14">
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
                  <tr 
                    key={row.customer_id} 
                    className="border-b border-neutral-gray-100 hover:bg-neutral-gray-50 transition-colors cursor-pointer group"
                    onClick={() => openCustomerDetails(row.customer_id)}
                  >
                    <td className="px-4 py-3 font-medium text-navy-900 truncate max-w-[150px]" title={row.name}>
                      <span className="flex items-center gap-2">
                        {row.name}
                        <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-navy-400" />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">€ {row.umsatz_gesamt?.toLocaleString('de-DE', { maximumFractionDigits: 0 }) || 0}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">€ {row.db_gesamt?.toLocaleString('de-DE', { maximumFractionDigits: 0 }) || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-3 bg-neutral-gray-50 border-t border-neutral-gray-100 flex justify-center">
          <button 
            onClick={openInaktiveDrawer}
            className="text-xs font-semibold text-navy-600 hover:underline flex items-center gap-1"
          >
            Inaktive Kunden prüfen <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <ResponsiveDetailDrawer
        isOpen={!!selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
        title={customerDetails?.clv?.name || "Kundenprofil laden..."}
      >
        {detailsLoading || !customerDetails ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center gap-4 text-sm text-neutral-gray-600">
              <span className="bg-navy-50 text-navy-700 px-3 py-1 rounded-full font-medium">{customerDetails.clv.kundentyp || 'Standard'}</span>
              <span>Institution</span>
              <span>{customerDetails.clv.email || 'Keine E-Mail'}</span>
            </div>

            <div className="bg-neutral-gray-50 rounded-xl p-5 border border-neutral-gray-200">
              <h4 className="font-bold text-navy-900 mb-4 border-b border-neutral-gray-200 pb-2">Wirtschaftliche Kennzahlen</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 gap-y-6">
                <div>
                  <div className="text-xs text-text-muted mb-1">Umsatz gesamt</div>
                  <div className="font-bold text-lg">€ {customerDetails.clv.umsatz_gesamt?.toLocaleString('de-DE', { maximumFractionDigits: 0 }) || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-1">Umsatz 12M</div>
                  <div className="font-bold text-lg text-emerald-600">€ {customerDetails.clv.umsatz_gesamt?.toLocaleString('de-DE', { maximumFractionDigits: 0 }) || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-1">DB gesamt</div>
                  <div className="font-bold text-lg">€ {customerDetails.clv.db_gesamt?.toLocaleString('de-DE', { maximumFractionDigits: 0 }) || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-1">DB-Marge</div>
                  <div className="font-bold text-lg">{(customerDetails.clv.db_marge_prozent * 100).toFixed(1)} %</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted mb-1">Aufträge gesamt</div>
                  <div className="font-bold text-lg">{customerDetails.clv.auftraege_gesamt}</div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-navy-900 mb-4 border-b border-neutral-gray-100 pb-2">Letzte Aufträge</h4>
              {customerDetails.letzeAuftraege.length === 0 ? (
                <p className="text-sm text-text-muted">Keine Aufträge vorhanden.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {customerDetails.letzeAuftraege.map((o: any) => (
                    <div key={o.id} className="flex justify-between items-center p-3 hover:bg-neutral-gray-50 rounded-lg cursor-pointer border border-transparent hover:border-neutral-gray-200"
                      onClick={() => router.push(`/orders/${o.id}`)}>
                      <div className="flex flex-col">
                        <span className="font-bold text-navy-900 text-sm">{o.order_number}</span>
                        <span className="text-xs text-text-muted">{new Date(o.intake_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold text-sm">€ {o.umsatz.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</span>
                        <ArrowRight className="w-4 h-4 text-neutral-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
              <h4 className="font-bold text-navy-900 mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent-orange" /> Volumenentwicklung
              </h4>
              <p className="text-sm text-text-muted">Historische Umsatzentwicklung (YoY) noch nicht ausreichend für Trendanalyse.</p>
            </div>

            <div className="pt-4 border-t border-neutral-gray-100 flex flex-wrap gap-3">
              <button className="px-4 py-2 bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-lg transition-colors text-sm flex items-center gap-2">
                <FileText className="w-4 h-4" /> Neuer Auftrag
              </button>
              <button className="px-4 py-2 bg-white border border-neutral-gray-300 hover:bg-neutral-gray-50 text-navy-700 font-semibold rounded-lg transition-colors text-sm flex items-center gap-2">
                <Phone className="w-4 h-4" /> Anrufen
              </button>
              <button className="px-4 py-2 bg-white border border-neutral-gray-300 hover:bg-neutral-gray-50 text-navy-700 font-semibold rounded-lg transition-colors text-sm flex items-center gap-2">
                <Mail className="w-4 h-4" /> E-Mail
              </button>
            </div>
          </div>
        )}
      </ResponsiveDetailDrawer>

      <ResponsiveDetailDrawer
        isOpen={inaktiveDrawerOpen}
        onClose={() => setInaktiveDrawerOpen(false)}
        title="Inaktive Kunden (>9 Monate)"
      >
        {inaktiveLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-text-muted text-sm">
              Stammkunden (≥3 Aufträge), die seit über 9 Monaten keinen Auftrag mehr platziert haben.
            </p>
            {inaktiveKunden.length === 0 ? (
              <div className="p-8 text-center bg-neutral-gray-50 rounded-xl text-neutral-gray-500 font-medium">
                Keine inaktiven Kunden gefunden.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {inaktiveKunden.map(k => (
                  <div key={k.customer_id} className="p-4 border border-neutral-gray-200 rounded-xl flex flex-col gap-3 hover:border-navy-300 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-navy-900">{k.name}</h4>
                        <p className="text-xs text-text-muted">Letzter Auftrag: {new Date(k.letzter_auftrag).toLocaleDateString()}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm">€ {k.umsatz_gesamt?.toLocaleString('de-DE', { maximumFractionDigits: 0 })}</div>
                        <div className="text-xs text-text-muted">Historischer Umsatz</div>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button className="px-3 py-1.5 bg-neutral-gray-100 hover:bg-neutral-gray-200 text-navy-700 font-semibold rounded-md transition-colors text-xs flex items-center gap-1">
                        <Mail className="w-3 h-3" /> Reaktivierungsmail
                      </button>
                      <button className="px-3 py-1.5 bg-neutral-gray-100 hover:bg-neutral-gray-200 text-navy-700 font-semibold rounded-md transition-colors text-xs flex items-center gap-1">
                        <Phone className="w-3 h-3" /> Anrufen
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </ResponsiveDetailDrawer>
    </>
  );
}
