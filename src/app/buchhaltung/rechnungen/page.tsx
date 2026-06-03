"use client";
import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { Ausgangsrechnung } from "@/lib/buchhaltung/types";
import { ChevronRight, AlertCircle, CheckCircle2, Clock, FileCheck } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

const STATUS_COLORS: Record<string, string> = {
  offen: "bg-blue-50 text-blue-700 border-blue-200",
  bezahlt: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ueberfaellig: "bg-red-50 text-red-700 border-red-200",
  teilbezahlt: "bg-amber-50 text-amber-700 border-amber-200",
  storniert: "bg-neutral-gray-100 text-text-muted border-neutral-gray-200",
};

function RechnungenContent() {
  usePageView();
  const searchParams = useSearchParams();
  const initialFilter = searchParams?.get("filter") ?? "alle";
  const [rechnungen, setRechnungen] = useState<Ausgangsrechnung[]>([]);
  const [filter, setFilter] = useState(initialFilter);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const data = await provider.listRechnungen();
      setRechnungen(data);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    if (filter === "alle") return rechnungen;
    if (filter === "offen") return rechnungen.filter(r => r.status === "offen" || r.status === "ueberfaellig");
    return rechnungen.filter(r => r.status === filter);
  }, [rechnungen, filter]);

  const offeneSumme = rechnungen.filter(r => r.status !== "bezahlt").reduce((s, r) => s + r.brutto, 0);
  const ueberfaelligCount = rechnungen.filter(r => r.status === "ueberfaellig").length;

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
        <span className="text-navy-900">Rechnungen & Offene Posten</span>
      </div>

      <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Rechnungen & Offene Posten</h1>
      <p className="text-sm text-text-muted mb-6">
        {rechnungen.length} Rechnungen · Offene Summe: <strong className="text-navy-900">{offeneSumme.toLocaleString("de-DE")} €</strong>
        {ueberfaelligCount > 0 && <> · <span className="text-red-600 font-bold">{ueberfaelligCount} überfällig</span></>}
      </p>

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { id: "alle", label: "Alle" },
          { id: "offen", label: "Offen & Überfällig" },
          { id: "bezahlt", label: "Bezahlt" },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              filter === f.id ? "bg-navy-900 text-white" : "bg-white border border-neutral-gray-200 text-text-muted hover:text-navy-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Rechnungsliste */}
      <div className="space-y-3">
        {filtered.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 flex items-center gap-5">
            <div className="w-10 h-10 rounded-xl bg-neutral-gray-50 flex items-center justify-center shrink-0">
              {r.status === "ueberfaellig" ? <AlertCircle className="w-5 h-5 text-red-500" /> :
               r.status === "bezahlt" ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> :
               <Clock className="w-5 h-5 text-blue-500" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-navy-900">{r.nummer}</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_COLORS[r.status]}`}>
                  {r.status}{r.mahnstufe > 0 ? ` (Mahnstufe ${r.mahnstufe})` : ""}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                {r.kundeName ?? "—"} · {new Date(r.datum).toLocaleDateString("de-DE")}
                {r.faelligAm && ` · Fällig: ${new Date(r.faelligAm).toLocaleDateString("de-DE")}`}
                {r.bezahltAm && ` · Bezahlt: ${new Date(r.bezahltAm).toLocaleDateString("de-DE")}`}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-extrabold text-navy-900">{r.brutto.toLocaleString("de-DE")} €</div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted text-sm">Keine Rechnungen gefunden.</div>
        )}
      </div>

      <FeedbackFooter pageTitle="Rechnungen" route="/buchhaltung/rechnungen" variant="full" />
    </div>
  );
}

export default function RechnungenPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" /></div>}>
      <RechnungenContent />
    </Suspense>
  );
}
