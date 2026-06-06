"use client";
import { usePageView } from "@/hooks/usePageView";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Plus, PieChart, TrendingUp } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { Kostenposten } from "@/lib/buchhaltung/types";

export function KostenClient({ initialKosten, initialArt, initialKategorie }: { initialKosten: Kostenposten[], initialArt: string, initialKategorie: string }) {
  usePageView();
  const router = useRouter();
  const searchParams = useSearchParams();

  const setArt = (newArt: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (newArt === "alle") {
      params.delete("art");
    } else {
      params.set("art", newArt);
    }
    router.push("?" + params.toString());
  };

  const setKategorie = (newKat: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (newKat === "alle") {
      params.delete("kategorie");
    } else {
      params.set("kategorie", newKat);
    }
    router.push("?" + params.toString());
  };

  const summe = initialKosten.reduce((s, c) => s + c.betrag, 0);

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/betrieb" className="hover:text-navy-900 transition-colors">Betrieb</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Kosten</span>
      </div>

      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Kostenposten</h1>
          <p className="text-sm text-text-muted">{initialKosten.length} Positionen · Summe: {summe.toLocaleString("de-DE")} €</p>
        </div>
        <Link href="/buchhaltung/kosten/neu" className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors active:scale-[0.98]">
          <Plus className="w-4 h-4" /> Kostenposition
        </Link>
      </div>

      {/* Filter: Art */}
      <div className="flex gap-2 mb-4">
        {[{ id: "alle", label: "Alle Arten" }, { id: "fix", label: "Fixkosten" }, { id: "variabel", label: "Variable Kosten" }].map(f => (
          <button
            key={f.id}
            onClick={() => setArt(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              initialArt === f.id ? "bg-navy-900 text-white" : "bg-white border border-neutral-gray-200 text-text-muted hover:text-navy-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Filter: Kategorie */}
      <div className="flex gap-2 mb-6">
        {[{ id: "alle", label: "Alle Kategorien" }, { id: "marketing", label: "Marketing" }, { id: "instandhaltung", label: "Instandhaltung" }, { id: "büro", label: "Büro" }].map(f => (
          <button
            key={f.id}
            onClick={() => setKategorie(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              initialKategorie === f.id ? "bg-navy-900 text-white" : "bg-white border border-neutral-gray-200 text-text-muted hover:text-navy-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Kostenliste */}
      <div className="space-y-3">
        {initialKosten.length === 0 ? (
          <div className="text-center py-12 text-neutral-400 text-sm font-semibold">Keine Kostenposten für diesen Filter gefunden.</div>
        ) : initialKosten.map((c) => (
          <Link href={`/buchhaltung/kosten/${c.id}`} key={c.id} className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 flex items-center gap-5 hover:bg-neutral-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-neutral-gray-50 flex items-center justify-center shrink-0">
              {c.art === "fix" ? <PieChart className="w-5 h-5 text-blue-500" /> : <TrendingUp className="w-5 h-5 text-amber-500" />}
            </div>
            <div className="flex-1">
              <span className="font-extrabold text-navy-900">{c.bezeichnung}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  c.art === "fix" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>{c.art === "fix" ? "Fix" : "Variabel"}</span>
                {c.kategorie && <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-neutral-50 text-neutral-600 border-neutral-200">{c.kategorie}</span>}
                <span className="text-xs text-text-muted">{c.intervall}</span>
              </div>
            </div>
            <span className="text-lg font-extrabold text-navy-900">{c.betrag.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
            <ChevronRight className="w-4 h-4 text-neutral-300" />
          </Link>
        ))}
      </div>

      <FeedbackFooter pageTitle="Kosten" route="/buchhaltung/kosten" variant="full" />
    </div>
  );
}
