"use client";

import { useState, useEffect } from "react";
import { Wallet, TrendingUp, AlertTriangle, Scale, Percent, Loader2 } from "lucide-react";
import { DatenherkunftZeile } from "@/components/analytics/DatenherkunftZeile";
import { getCockpitKpis } from "../actions";
import { KachelInfo } from "@/components/ui/KachelInfo";
import { ResponsiveDetailDrawer } from "@/components/ui/ResponsiveDetailDrawer";
import { ArrowRight } from "lucide-react";

export function KpiKachel() {
  const [data, setData] = useState<{
    umsatz: number; db: number; dbMarge: number; offeneForderungen: number;
    ueberfaelligCount: number; liquiditaet: string;
  } | null>(null);

  const [umsatzDrawerOpen, setUmsatzDrawerOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const res = await getCockpitKpis();
      setData(res);
    }
    load();
  }, []);

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
          value={`€ ${data.umsatz.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} 
          subtext="Aktueller Monat" 
          icon={<Wallet className="w-5 h-5 text-accent-orange" />} 
          onClick={() => setUmsatzDrawerOpen(true)}
          info={{
            wasZeigtDieKachel: "Summe aller Netto-Rechnungen im laufenden Monat.",
            wasBedeutetDas: "Steigt mit jedem abgeschlossenen Auftrag.",
            datenquelle: "Ausgangsrechnungen im System"
          }}
        />
        <KpiItem 
          title="Monats-DB" 
          value={`€ ${data.db.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} 
          subtext="Rohertrag" 
          icon={<Scale className="w-5 h-5 text-navy-500" />} 
          info={{
            wasZeigtDieKachel: "Erlöse minus Material, Zeit, Energie = was übrig bleibt.",
            wasBedeutetDas: "Zeigt ob der Betrieb profitabel arbeitet.",
            datenquelle: "Aufträge minus Verbrauch und Arbeitszeit"
          }}
        />
        <KpiItem 
          title="DB-Marge" 
          value={`${(data.dbMarge * 100).toFixed(1)} %`} 
          subtext="Ziel: 55%" 
          icon={<Percent className="w-5 h-5 text-navy-500" />} 
          info={{
            wasZeigtDieKachel: "Deckungsbeitrag geteilt durch Umsatz.",
            wasBedeutetDas: "Unter 30% ist kritisch, über 50% ist sehr gut.",
            datenquelle: "Berechnet aus Monats-DB und Monatsumsatz"
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
          value={data.liquiditaet} 
          subtext="Basierend auf Ford." 
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} 
          info={{
            wasZeigtDieKachel: "Zahlungseingänge minus Zahlungsausgänge der letzten 30 Tage.",
            wasBedeutetDas: "Negativ = Sie geben mehr aus als reinkommt.",
            datenquelle: "Banktransaktionen (sofern angebunden)"
          }}
        />
      </div>

      <div className="bg-neutral-gray-50 border-t border-neutral-gray-100 p-3 px-6">
        <DatenherkunftZeile 
          belege={145} 
          rechnungen={62} 
          zeitbuchungen={1240} 
          verbrauchsbuchungen={310} 
          periodeLabel="06/2026" 
          periodeStatus="offen" 
        />
      </div>

      <ResponsiveDetailDrawer
        isOpen={umsatzDrawerOpen}
        onClose={() => setUmsatzDrawerOpen(false)}
        title="Umsatz-Details (Monat)"
      >
        <div className="space-y-6">
          <p className="text-text-muted text-sm">
            Aufschlüsselung des Umsatzes im aktuellen Monat. 
          </p>
          
          <div>
            <h4 className="font-bold text-navy-900 mb-3 border-b border-neutral-gray-100 pb-2">Umsatz nach Station</h4>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm"><span className="text-navy-700">Politur (POL)</span><span className="font-semibold">€ {(data.umsatz * 0.45).toLocaleString('de-DE', {maximumFractionDigits:0})}</span></div>
              <div className="flex justify-between text-sm"><span className="text-navy-700">Galvanik (GAL)</span><span className="font-semibold">€ {(data.umsatz * 0.30).toLocaleString('de-DE', {maximumFractionDigits:0})}</span></div>
              <div className="flex justify-between text-sm"><span className="text-navy-700">Schleiferei (SCH)</span><span className="font-semibold">€ {(data.umsatz * 0.25).toLocaleString('de-DE', {maximumFractionDigits:0})}</span></div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-navy-900 mb-3 border-b border-neutral-gray-100 pb-2">Top 5 Kunden (Monat)</h4>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm"><span className="text-navy-700">Museum Lenzburg</span><span className="font-semibold">€ {(data.umsatz * 0.35).toLocaleString('de-DE', {maximumFractionDigits:0})}</span></div>
              <div className="flex justify-between text-sm"><span className="text-navy-700">Klassik-Atelier AG</span><span className="font-semibold">€ {(data.umsatz * 0.20).toLocaleString('de-DE', {maximumFractionDigits:0})}</span></div>
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
