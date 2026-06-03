"use client";
import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import Link from "next/link";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import { pruefePlausibilitaet } from "@/lib/buchhaltung/regeln";
import type { KategorieSumme } from "@/lib/buchhaltung/types";
import { ChevronRight, PieChart } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

export default function AusgabenPage() {
  usePageView();
  const [kategorien, setKategorien] = useState<KategorieSumme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const now = new Date();
      const data = await provider.getAusgabenNachKategorie({
        von: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`,
        bis: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`,
      });
      setKategorien(data);
      setLoading(false);
    };
    load();
  }, []);

  const gesamt = kategorien.reduce((s, k) => s + k.summe, 0);
  const hinweise = pruefePlausibilitaet(kategorien, 85400);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" /></div>;
  }

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Ausgaben gesamt</span>
      </div>

      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Ausgaben gesamt</h1>
      <p className="text-sm text-text-muted mb-8">Laufender Monat · {kategorien.length} Kategorien · {gesamt.toLocaleString("de-DE")} € gesamt</p>

      {/* KI-Hinweise */}
      {hinweise.length > 0 && (
        <div className="space-y-2 mb-6">
          {hinweise.map((h, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs">
              <span className="font-bold text-amber-800">{h.regel}</span>
              <p className="text-amber-700 mt-1">{h.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Kategorie-Karten */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {kategorien.map(k => {
          const anteil = gesamt > 0 ? ((k.summe / gesamt) * 100).toFixed(1) : "0";
          return (
            <Link
              key={k.kategorieId}
              href={`/buchhaltung/belege?kategorie=${k.kategorieId}`}
              className="group bg-white rounded-2xl border border-neutral-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-5 cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">{k.icon}</span>
                <span className="text-xs font-bold text-text-muted">{anteil} %</span>
              </div>
              <h3 className="text-lg font-extrabold text-navy-900 group-hover:text-accent-orange transition-colors">{k.kategorieName}</h3>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-text-muted">{k.anzahl} Belege</span>
                <span className="text-lg font-extrabold text-navy-900">{k.summe.toLocaleString("de-DE")} €</span>
              </div>
              {/* Anteil-Bar */}
              <div className="mt-3 h-1.5 bg-neutral-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-accent-orange rounded-full transition-all" style={{ width: `${anteil}%` }} />
              </div>
            </Link>
          );
        })}
      </div>

      <FeedbackFooter pageTitle="Ausgaben" route="/buchhaltung/ausgaben" variant="full" />
    </div>
  );
}
