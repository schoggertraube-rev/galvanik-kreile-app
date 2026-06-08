"use client";

import { useState, useEffect } from "react";
import { Wallet, TrendingUp, AlertTriangle, Scale, Percent, Loader2 } from "lucide-react";
import { DatenherkunftZeile } from "@/components/analytics/DatenherkunftZeile";
import { getCockpitKpis } from "../actions";

export function KpiKachel() {
  const [data, setData] = useState<{
    umsatz: number; db: number; dbMarge: number; offeneForderungen: number;
    ueberfaelligCount: number; liquiditaet: string;
  } | null>(null);

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
  return (
    <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm overflow-hidden">
      
      {/* 5 KPIs in a grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-neutral-gray-100">
        
        <KpiItem 
          title="Monatsumsatz" 
          value={`€ ${data.umsatz.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} 
          subtext="Aktueller Monat" 
          icon={<Wallet className="w-5 h-5 text-accent-orange" />} 
        />
        <KpiItem 
          title="Monats-DB" 
          value={`€ ${data.db.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} 
          subtext="Rohertrag" 
          icon={<Scale className="w-5 h-5 text-navy-500" />} 
        />
        <KpiItem 
          title="DB-Marge" 
          value={`${(data.dbMarge * 100).toFixed(1)} %`} 
          subtext="Ziel: 55%" 
          icon={<Percent className="w-5 h-5 text-navy-500" />} 
        />
        <KpiItem 
          title="Offene Ford." 
          value={`€ ${data.offeneForderungen.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`} 
          subtext={`${data.ueberfaelligCount} überfällig`} 
          icon={<AlertTriangle className="w-5 h-5 text-amber-500" />} 
        />
        <KpiItem 
          title="Liquidität" 
          value={data.liquiditaet} 
          subtext="Basierend auf Ford." 
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} 
        />
      </div>

      <div className="bg-neutral-gray-50 border-t border-neutral-gray-100 p-3 px-6">
        {/* Placeholder data for now */}
        <DatenherkunftZeile 
          belege={145} 
          rechnungen={62} 
          zeitbuchungen={1240} 
          verbrauchsbuchungen={310} 
          periodeLabel="06/2026" 
          periodeStatus="offen" 
        />
      </div>
    </div>
  );
}

function KpiItem({ title, value, subtext, icon }: { title: string, value: string, subtext: string, icon: React.ReactNode }) {
  return (
    <div className="p-6 flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-full bg-neutral-gray-100 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <span className="text-sm font-semibold text-text-muted">{title}</span>
      </div>
      <div className="text-2xl font-black text-navy-900 tracking-tight mb-1">{value}</div>
      <div className="text-xs text-neutral-gray-500 font-medium">{subtext}</div>
    </div>
  );
}
