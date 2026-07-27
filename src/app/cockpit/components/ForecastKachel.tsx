"use client";

import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, ComposedChart, Bar, Legend } from "recharts";
import { getForecastDaten, type ForecastData } from "../actions";
import { Calendar, Loader2, ArrowRight } from "lucide-react";
import Link from "next/link";
import { KachelInfo } from "@/components/ui/KachelInfo";

type ForecastChartPoint = {
  monat: string;
  umsatz: number | null;
  istWert: boolean;
  pipelineGewichtet: number;
  pipelineUngewichtet: number;
  plan: number | null;
};

export function ForecastKachel() {
  const [data, setData] = useState<ForecastData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await getForecastDaten();
        if (res.status === "not_configured") {
          setData(null);
          setNotConfigured(true);
          setLoadError(null);
        } else {
          setData(res.data);
          setNotConfigured(false);
          setLoadError(null);
        }
      } catch {
        setData(null);
        setNotConfigured(false);
        setLoadError("Der Forecast-Status konnte nicht geladen werden.");
      } finally {
        setLoading(false);
      }
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

  if (notConfigured) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[350px] items-center justify-center p-8 text-center">
        <Calendar className="w-8 h-8 text-neutral-gray-400 mb-3" />
        <h3 className="font-bold text-navy-900">Forecast nicht konfiguriert</h3>
        <p role="status" className="mt-2 text-sm text-neutral-gray-600">
          Es werden keine Pipeline-Werte geschätzt.
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm flex flex-col h-[350px] items-center justify-center p-8 text-center">
        <Calendar className="w-8 h-8 text-red-500 mb-3" />
        <h3 className="font-bold text-navy-900">Forecast nicht geladen</h3>
        <p role="alert" className="mt-2 text-sm text-red-700">{loadError}</p>
      </div>
    );
  }

  // Combine historical and pipeline data
  // Pipeline months start from current month and go forward
  const chartData: ForecastChartPoint[] = [...(data?.monate || [])].map(m => {
    const monatDate = new Date(m.monat);
    const monatIdx = monatDate.getMonth() + 1;
    return {
      monat: monatDate.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' }),
      umsatz: m.umsatz,
      istWert: true,
      pipelineGewichtet: 0,
      pipelineUngewichtet: 0,
      plan: data?.plan ? (data.plan[String(monatIdx)] ?? null) : null
    };
  });

  // Append pipeline data
  (data?.pipeline || []).forEach(p => {
    const pDate = new Date(p.erwarteter_monat);
    const mStr = pDate.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
    const existing = chartData.find(c => c.monat === mStr);
    if (existing) {
      existing.pipelineGewichtet += p.pipeline_wert_gewichtet;
      existing.pipelineUngewichtet += p.pipeline_wert_ungewichtet;
      existing.plan = data?.plan ? (data.plan[String(pDate.getMonth() + 1)] ?? null) : null;
    } else {
      chartData.push({
        monat: mStr,
        umsatz: null,
        istWert: false,
        pipelineGewichtet: p.pipeline_wert_gewichtet,
        pipelineUngewichtet: p.pipeline_wert_ungewichtet,
        plan: data?.plan ? (data.plan[String(pDate.getMonth() + 1)] ?? null) : null
      });
    }
  });

  return (
    <div className="bg-white rounded-2xl border border-neutral-gray-200 shadow-sm flex flex-col h-[350px] relative">
      <div className="absolute top-4 right-4 z-10">
        <KachelInfo 
          wasZeigtDieKachel="Umsatz-Forecast inkl. Sales-Pipeline"
          wasBedeutetDas="Historischer Umsatz vs. erwarteter zukünftiger Umsatz aus offenen Angeboten."
          datenquelle="Rechnungen (Historie) und offene Aufträge (Pipeline)"
        />
      </div>

      <div className="p-6 pb-2 flex items-center justify-between border-b border-neutral-gray-100 pr-14">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-navy-500" />
          <h3 className="font-bold text-navy-900 text-lg">Forecast & Pipeline</h3>
        </div>
        <Link 
          href="/cockpit/jahresplan"
          className="text-xs font-semibold text-navy-600 hover:underline flex items-center gap-1 bg-neutral-gray-50 px-3 py-1.5 rounded-lg border border-neutral-gray-200 shadow-sm"
        >
          Jahresplan öffnen <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      
      <div className="flex-1 p-6 pt-4 flex flex-col">
        {chartData.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-neutral-gray-500 font-medium">
            Keine Daten vorhanden
          </div>
        ) : (
          <div className="flex-1 min-h-0 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="monat" tick={{ fontSize: 11 }} tickMargin={10} />
                <YAxis tickFormatter={(val) => `€${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value: any, name: any) => {
                    if (name === "Umsatz (Ist)") return [`€ ${Number(value).toLocaleString('de-DE')}`, name];
                    if (name === "Pipeline (Gewichtet)") return [`€ ${Number(value).toLocaleString('de-DE')}`, name];
                    return [value, name];
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="umsatz" name="Umsatz (Ist)" fill="#1E3A8A" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="pipelineGewichtet" name="Pipeline (Gewichtet)" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Line type="monotone" dataKey="plan" name="Jahresplan" stroke="#3B82F6" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
            {!data?.plan && (
              <div className="text-center mt-2 text-xs text-text-muted">
                Kein Jahresplan hinterlegt — <Link href="/cockpit/jahresplan" className="text-navy-600 font-bold hover:underline">Jahresplan anlegen</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
