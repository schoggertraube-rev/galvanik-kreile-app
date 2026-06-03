"use client";
import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { KraftstoffReport } from "@/lib/buchhaltung/types";
import { ChevronRight, Fuel, MapPin, Calendar } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

export default function KraftstoffPage() {
  usePageView();
  const [report, setReport] = useState<KraftstoffReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const now = new Date();
      const data = await provider.getKraftstoffAuswertung({
        von: `${now.getFullYear()}-01-01`,
        bis: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`,
      });
      setReport(data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !report) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" /></div>;
  }

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Kraftstoff & Kfz</span>
      </div>

      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Kraftstoff & Kfz</h1>
      <p className="text-sm text-text-muted mb-8">{report.anzahlTankungen} Tankungen · Ø {report.durchschnittPreisProLiter.toFixed(2)} €/l · {report.gesamtLiter.toFixed(0)} Liter gesamt</p>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPI label="Gesamtkosten" value={`${report.gesamtkosten.toLocaleString("de-DE")} €`} icon={<Fuel className="w-5 h-5 text-blue-500" />} />
        <KPI label="Liter gesamt" value={report.gesamtLiter.toFixed(0)} icon={<Fuel className="w-5 h-5 text-teal-500" />} />
        <KPI label="Ø Preis/Liter" value={`${report.durchschnittPreisProLiter.toFixed(2)} €`} icon={<Fuel className="w-5 h-5 text-amber-500" />} />
        <KPI label="Tankungen" value={String(report.anzahlTankungen)} icon={<MapPin className="w-5 h-5 text-emerald-500" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Nach Sorte */}
        <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-6">
          <h2 className="text-base font-extrabold text-navy-900 mb-4">Nach Kraftstoffsorte</h2>
          <div className="space-y-3">
            {report.nachSorte.map(s => (
              <div key={s.sorte} className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-navy-900 capitalize">{s.sorte}</span>
                  <span className="text-xs text-text-muted ml-2">{s.liter.toFixed(0)} l</span>
                </div>
                <span className="font-extrabold text-navy-900">{s.kosten.toLocaleString("de-DE")} €</span>
              </div>
            ))}
          </div>
        </div>

        {/* Nach Ort */}
        <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-6">
          <h2 className="text-base font-extrabold text-navy-900 mb-4">Nach Ort</h2>
          <div className="space-y-3">
            {report.nachOrt.map(o => (
              <div key={o.ort} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-text-muted" />
                  <span className="font-bold text-navy-900">{o.ort}</span>
                  <span className="text-xs text-text-muted">{o.anzahl}×</span>
                </div>
                <span className="font-extrabold text-navy-900">{o.kosten.toLocaleString("de-DE")} €</span>
              </div>
            ))}
          </div>
        </div>

        {/* Nach Monat */}
        <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-6 lg:col-span-2">
          <h2 className="text-base font-extrabold text-navy-900 mb-4">Monatsverlauf</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {report.nachMonat.map(m => (
              <div key={m.monat} className="flex-1 min-w-[120px] bg-neutral-gray-50 rounded-xl p-4 text-center">
                <div className="text-xs text-text-muted font-bold">{new Date(m.monat + "-01").toLocaleDateString("de-DE", { month: "short", year: "2-digit" })}</div>
                <div className="text-lg font-extrabold text-navy-900 mt-1">{m.kosten.toLocaleString("de-DE")} €</div>
                <div className="text-xs text-text-muted">{m.liter.toFixed(0)} l</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FeedbackFooter pageTitle="Kraftstoff" route="/buchhaltung/kraftstoff" variant="full" />
    </div>
  );
}

function KPI({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-neutral-gray-50 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
        <div className="text-lg font-extrabold text-navy-900">{value}</div>
      </div>
    </div>
  );
}
