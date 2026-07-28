"use client";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { Bwa } from "@/lib/buchhaltung/types";
import { ChevronRight, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

export default function BwaPage() {
  usePageView();
  const [bwa, setBwa] = useState<Bwa | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const now = new Date();
      const data = await provider.getBwa({
        von: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
        bis: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`,
      });
      setBwa(data);
      setLoading(false);
    };
    load();
  }, []);

  if (loading || !bwa) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" /></div>;
  }

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Buchhaltung',href:'/buchhaltung'}, {label:'Bwa'}]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />
      </div>
      
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">BWA / Monatsübersicht</span>
      </div>

      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Betriebswirtschaftliche Auswertung</h1>
      <p className="text-sm text-text-muted mb-8">
        {new Date(bwa.zeitraum.von).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Demo-Daten</span>
      </p>

      {/* KPI-Band */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <KPI label="Umsatzerlöse" value={`${bwa.umsatzerloese.toLocaleString("de-DE")} €`} icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} positive />
        <KPI label="Deckungsbeitrag" value={`${bwa.deckungsbeitrag.toLocaleString("de-DE")} €`} icon={<BarChart3 className="w-5 h-5 text-blue-500" />} positive />
        <KPI label="Fixkosten" value={`${bwa.fixkosten.toLocaleString("de-DE")} €`} icon={<TrendingDown className="w-5 h-5 text-red-500" />} />
        <KPI label="Betriebsergebnis" value={`${bwa.betriebsergebnis.toLocaleString("de-DE")} €`} icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} positive highlight />
      </div>

      {/* Positionen */}
      <div className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-6">
        <h2 className="text-base font-extrabold text-navy-900 mb-4">Positionen</h2>
        <div className="space-y-2">
          {bwa.positionen.map((pos, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-neutral-gray-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${pos.typ === "einnahme" ? "bg-emerald-500" : pos.typ === "ausgabe_fix" ? "bg-blue-400" : "bg-amber-400"}`} />
                <span className="text-sm font-semibold text-navy-900">{pos.bezeichnung}</span>
              </div>
              <span className={`text-sm font-extrabold ${pos.typ === "einnahme" ? "text-emerald-600" : "text-navy-900"}`}>
                {pos.typ === "einnahme" ? "+" : "−"}{pos.betrag.toLocaleString("de-DE")} €
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t-2 border-navy-900 flex items-center justify-between">
          <span className="text-base font-extrabold text-navy-900">Betriebsergebnis</span>
          <span className={`text-xl font-extrabold ${bwa.betriebsergebnis >= 0 ? "text-emerald-600" : "text-red-600"}`}>
            {bwa.betriebsergebnis >= 0 ? "+" : ""}{bwa.betriebsergebnis.toLocaleString("de-DE")} €
          </span>
        </div>
      </div>

      <FeedbackFooter pageTitle="BWA" route="/buchhaltung/bwa" variant="full" />
    </div>
  );
}

function KPI({ label, value, icon, positive, highlight }: { label: string; value: string; icon: React.ReactNode; positive?: boolean; highlight?: boolean }) {
void positive;
  return (
    <div className={`rounded-2xl border shadow-sm p-5 flex items-center gap-4 ${highlight ? "bg-emerald-50 border-emerald-200" : "bg-white border-neutral-gray-100"}`}>
      <div className="w-10 h-10 rounded-xl bg-neutral-gray-50 flex items-center justify-center shrink-0">{icon}</div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
        <div className={`text-lg font-extrabold ${highlight ? "text-emerald-700" : "text-navy-900"}`}>{value}</div>
      </div>
    </div>
  );
}
