"use client";

import { useState, useEffect } from "react";
import { Wallet, TrendingUp, AlertTriangle, Scale, Percent, Loader2 } from "lucide-react";
import { DatenherkunftZeile } from "@/components/analytics/DatenherkunftZeile";
import { getCockpitKpis } from "../actions";
import { KachelInfo } from "@/components/ui/KachelInfo";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";
import { ArrowRight } from "lucide-react";

export function KpiKachel() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getCockpitKpis>> | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [umsatzDrawerOpen, setUmsatzDrawerOpen] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await getCockpitKpis();
        setData(res);
        setLoadError(false);
      } catch {
        setData(null);
        setLoadError(true);
      }
    }
    void load();
  }, []);

  if (loadError) {
    return (
      <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-6 text-sm text-amber-950">
        Cockpit-Kennzahlen konnten nicht belastbar aus der Datenbank bestaetigt werden. Es werden keine Nullwerte als Ersatz angezeigt.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-navy-500" />
      </div>
    );
  }

  const scrollToAging = () => {
    const el = document.getElementById("aging-kachel");
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm overflow-hidden">
      
      {/* 5 KPIs in a grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-neutral-gray-100">
        
        <KpiItem 
          title="Monatsumsatz" 
          value={data.umsatz === null ? "Nicht verfuegbar" : `€ ${data.umsatz.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`}
          subtext={`Periode ${data.periodLabel}`}
          icon={<Wallet className="w-5 h-5 text-accent-orange" />} 
          onClick={() => setUmsatzDrawerOpen(true)}
          info={{
            wasZeigtDieKachel: "Summe aller Netto-Rechnungen im laufenden Monat.",
            wasBedeutetDas: "Steigt mit jedem abgeschlossenen Auftrag.",
            datenquelle: "Ausgangsrechnungen im System"
          }}
        />
        <KpiItem 
          title="Erfasster DB"
          value={data.db === null ? "Nicht verfuegbar" : `€ ${data.db.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`}
          subtext="Nur Zeit + Material"
          icon={<Scale className="w-5 h-5 text-navy-500" />} 
          info={{
            wasZeigtDieKachel: "Nettoerloese minus bestaetigte Zeit- und Materialkosten.",
            wasBedeutetDas: "Energie und Sachkosten fehlen noch; dies ist keine vollstaendige Ergebnisrechnung.",
            datenquelle: data.dbScope
          }}
        />
        <KpiItem 
          title="Erfasste DB-Marge"
          value={data.dbMarge === null ? "Nicht verfuegbar" : `${(data.dbMarge * 100).toFixed(1)} %`}
          subtext="Nur bestaetigte Direktkosten"
          icon={<Percent className="w-5 h-5 text-navy-500" />} 
          info={{
            wasZeigtDieKachel: "Deckungsbeitrag geteilt durch Umsatz.",
            wasBedeutetDas: "Noch nicht als vollstaendige Profitabilitaet bewerten.",
            datenquelle: data.dbScope
          }}
        />
        <KpiItem 
          title="Offene Ford." 
          value={`€ ${data.offeneForderungen.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} 
          subtext={`${data.ueberfaelligCount} überfällig`} 
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} 
          onClick={scrollToAging}
          info={{
            wasZeigtDieKachel: "Rechnungen die noch nicht bezahlt wurden.",
            wasBedeutetDas: "Hohe Summen gefährden Ihre Liquidität.",
            datenquelle: "Ungeschlossene Ausgangsrechnungen"
          }}
        />
        <KpiItem 
          title="Liquidität" 
          value={data.liquiditaet ?? "Nicht angebunden"}
          subtext="Keine Bankwahrheit"
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} 
          info={{
            wasZeigtDieKachel: "Liquiditaet benoetigt bestaetigte Kontostaende sowie Ein- und Auszahlungen.",
            wasBedeutetDas: "Bis zur Bankanbindung wird bewusst kein Status geschaetzt.",
            datenquelle: data.liquiditaetReason
          }}
        />
      </div>

      <div className="bg-neutral-gray-50 border-t border-neutral-gray-100 p-3 px-6">
        <DatenherkunftZeile 
          belege={0}
          rechnungen={data.sourceCounts.rechnungen}
          zeitbuchungen={data.sourceCounts.zeitbuchungen}
          verbrauchsbuchungen={data.sourceCounts.verbrauchsbuchungen}
          periodeLabel={data.periodLabel}
          periodeStatus="laufend"
        />
      </div>

      <ResponsiveDetailDrawer
        isOpen={umsatzDrawerOpen}
        onClose={() => setUmsatzDrawerOpen(false)}
        title="Erfassungsgrundlage (Monat)"
      >
        <div className="space-y-6">
          <p className="text-text-muted text-sm">
            Bestätigte Zeitkosten, die in den erfassten Deckungsbeitrag einfließen.
          </p>
          
          <div>
            <h4 className="font-bold text-navy-900 mb-3 border-b border-neutral-gray-100 pb-2">Zeitkosten nach Station</h4>
            <div className="flex flex-col gap-2">
              {Object.keys(data.zeitkostenNachStation).length > 0 ? (
                Object.entries(data.zeitkostenNachStation).map(([ks, wert]) => (
                  <div key={ks} className="flex justify-between text-sm">
                    <span className="text-navy-700">{ks}</span>
                    <span className="font-semibold">€ {(wert as number).toLocaleString('de-DE', {maximumFractionDigits:0})}</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-neutral-gray-500">Keine bestätigten Zeitbuchungen im laufenden Monat.</div>
              )}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <button className="flex-1 py-2 font-semibold text-navy-600 bg-neutral-gray-50 hover:bg-neutral-gray-100 rounded-lg transition-colors border border-neutral-gray-200 shadow-sm"
              onClick={() => setUmsatzDrawerOpen(false)}>
              Schließen
            </button>
          </div>
        </div>
      </ResponsiveDetailDrawer>
    </div>
  );
}

function KpiItem({ title, value, subtext, icon, onClick, info }: { 
  title: string, value: string, subtext: string, icon: React.ReactNode, onClick?: () => void,
  info?: { wasZeigtDieKachel: string, wasBedeutetDas: string, datenquelle: string }
}) {
  return (
    <div 
      className={`p-6 flex flex-col justify-center relative ${onClick ? 'cursor-pointer hover:bg-neutral-gray-50/50 transition-colors group' : ''}`}
      onClick={onClick}
    >
      {info && (
        <div className="absolute top-4 right-4 z-10">
          <KachelInfo {...info} />
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-neutral-gray-100 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="text-sm font-semibold text-text-muted">{title}</span>
      </div>
      <div className="text-2xl font-black text-navy-900 tracking-tight mb-1 flex items-center gap-2">
        {value}
        {onClick && <ArrowRight className="w-4 h-4 text-neutral-gray-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
      </div>
      <div className="text-xs text-neutral-gray-500 font-medium">{subtext}</div>
    </div>
  );
}
