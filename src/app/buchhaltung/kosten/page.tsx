"use client";
import { usePageView } from "@/hooks/usePageView";
import { useState, useEffect } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getBuchhaltungProvider } from "@/lib/buchhaltung";
import type { CostItem } from "@/lib/buchhaltung/types";
import { ChevronRight, Plus, PieChart, TrendingUp } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

function KostenContent() {
  usePageView();
  const searchParams = useSearchParams();
  const initialArt = searchParams?.get("art") ?? "alle";
  const [fixkosten, setFixkosten] = useState<CostItem[]>([]);
  const [variabel, setVariabel] = useState<CostItem[]>([]);
  const [art, setArt] = useState(initialArt);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const load = async () => {
      const provider = getBuchhaltungProvider();
      const [f, v] = await Promise.all([provider.getFixkosten(), provider.getVariableKosten()]);
      setFixkosten(f);
      setVariabel(v);
      setLoading(false);
    };
    load();
  }, []);

  const displayed = art === "fix" ? fixkosten : art === "variabel" ? variabel : [...fixkosten, ...variabel];
  const summe = displayed.reduce((s, c) => s + c.amount, 0);

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
        <span className="text-navy-900">Kosten</span>
      </div>

      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Fix- & Variable Kosten</h1>
          <p className="text-sm text-text-muted">{displayed.length} Positionen · Summe: {summe.toLocaleString("de-DE")} €/Monat</p>
        </div>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors active:scale-[0.98]">
          <Plus className="w-4 h-4" /> Kostenposition
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {[{ id: "alle", label: "Alle" }, { id: "fix", label: "Fixkosten" }, { id: "variabel", label: "Variable Kosten" }].map(f => (
          <button
            key={f.id}
            onClick={() => setArt(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
              art === f.id ? "bg-navy-900 text-white" : "bg-white border border-neutral-gray-200 text-text-muted hover:text-navy-900"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Kostenliste */}
      <div className="space-y-3">
        {displayed.map((c, i) => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 flex items-center gap-5">
            <div className="w-10 h-10 rounded-xl bg-neutral-gray-50 flex items-center justify-center shrink-0">
              {c.category === "fix" ? <PieChart className="w-5 h-5 text-blue-500" /> : <TrendingUp className="w-5 h-5 text-amber-500" />}
            </div>
            <div className="flex-1">
              <span className="font-extrabold text-navy-900">{c.name}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  c.category === "fix" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-amber-50 text-amber-700 border-amber-200"
                }`}>{c.category === "fix" ? "Fix" : "Variabel"}</span>
                <span className="text-xs text-text-muted">{c.interval}</span>
              </div>
            </div>
            <span className="text-lg font-extrabold text-navy-900">{c.amount.toLocaleString("de-DE")} €</span>
          </div>
        ))}
      </div>

      {/* Add-Form Overlay */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-elevated border border-neutral-gray-100 w-full max-w-md p-8 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-extrabold text-navy-900 mb-4">Kostenposition hinzufügen</h3>
            <p className="text-sm text-text-muted mb-4">Neue Position wird im lokalen Demo-Modus angelegt. Echte Datenbankanbindung folgt über den Provider.</p>
            <div className="space-y-3 mb-6">
              <input type="text" placeholder="Bezeichnung" className="w-full px-4 py-2.5 border border-neutral-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy-900" />
              <input type="number" placeholder="Betrag (€)" className="w-full px-4 py-2.5 border border-neutral-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy-900" />
              <select className="w-full px-4 py-2.5 border border-neutral-gray-200 rounded-xl text-sm focus:outline-none focus:border-navy-900 bg-white">
                <option value="fix">Fixkosten</option>
                <option value="variabel">Variable Kosten</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-colors">Hinzufügen (Demo)</button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 bg-neutral-gray-100 text-navy-900 rounded-xl font-semibold text-sm hover:bg-neutral-gray-200 transition-colors">Abbrechen</button>
            </div>
          </div>
        </div>
      )}

      <FeedbackFooter pageTitle="Kosten" route="/buchhaltung/kosten" variant="full" />
    </div>
  );
}

export default function KostenPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh]"><div className="w-8 h-8 border-3 border-accent-orange/20 border-t-accent-orange rounded-full animate-spin" /></div>}>
      <KostenContent />
    </Suspense>
  );
}
