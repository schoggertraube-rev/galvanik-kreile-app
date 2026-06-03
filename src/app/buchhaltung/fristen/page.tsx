"use client";
import { usePageView } from "@/hooks/usePageView";
import Link from "next/link";
import { pruefeFristen } from "@/lib/buchhaltung/regeln";
import { ChevronRight, CalendarClock, AlertCircle, CheckCircle2, Calendar } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

const FESTEN_FRISTEN = [
  { titel: "UStVA", beschreibung: "Umsatzsteuer-Voranmeldung", frist: "10. des Folgemonats", paragraf: "§ 18 Abs. 1 UStG", rhythmus: "monatlich" },
  { titel: "Gewerbesteuer", beschreibung: "Vorauszahlung", frist: "15.02, 15.05, 15.08, 15.11", paragraf: "§ 19 GewStG", rhythmus: "vierteljährlich" },
  { titel: "Rundfunkbeitrag", beschreibung: "Quartalsbeitrag", frist: "Mitte des Quartals", paragraf: "RBStV", rhythmus: "vierteljährlich" },
  { titel: "Jahresabschluss", beschreibung: "Bilanz / EÜR", frist: "31.07 (verlängert durch StB: 28.02 Folgejahr)", paragraf: "§ 149 AO", rhythmus: "jährlich" },
  { titel: "Aufbewahrungsfrist", beschreibung: "Buchungsbelege", frist: "8 Jahre (Handelsrecht: 10 Jahre)", paragraf: "§ 147 AO", rhythmus: "dauerhaft" },
];

export default function FristenPage() {
  usePageView();
  const aktuelleHinweise = pruefeFristen();

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8">
      <div className="flex items-center gap-2 text-xs font-semibold text-text-muted mt-4 mb-3">
        <Link href="/" className="hover:text-navy-900 transition-colors">Home</Link>
        <ChevronRight className="w-3 h-3" />
        <Link href="/buchhaltung" className="hover:text-navy-900 transition-colors">Buchhaltung</Link>
        <ChevronRight className="w-3 h-3" />
        <span className="text-navy-900">Fristen & Pflichten</span>
      </div>

      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 mb-1">Fristen & Pflichten</h1>
          <p className="text-sm text-text-muted">Steuer-, Melde- und Aufbewahrungsfristen im Überblick.</p>
        </div>
        <Link href="/kalender" className="flex items-center gap-2 px-4 py-2.5 bg-white text-navy-900 rounded-xl font-semibold text-sm border border-neutral-gray-200 hover:bg-neutral-gray-50 transition-colors">
          <Calendar className="w-4 h-4" /> Zum Kalender
        </Link>
      </div>

      {/* Aktuelle Hinweise */}
      {aktuelleHinweise.length > 0 && (
        <div className="space-y-2 mb-8">
          <h2 className="text-sm font-bold text-navy-900 uppercase tracking-wider">Aktuell anstehend</h2>
          {aktuelleHinweise.map((h, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-800">{h.regel}</p>
                <p className="text-xs text-amber-700 mt-0.5">{h.text}</p>
                {h.paragraf && <p className="text-[10px] text-amber-600 mt-1">{h.paragraf}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alle Fristen */}
      <div className="space-y-3">
        {FESTEN_FRISTEN.map((f, i) => (
          <div key={i} className="bg-white rounded-2xl border border-neutral-gray-100 shadow-sm p-5 flex items-start gap-5">
            <div className="w-10 h-10 rounded-xl bg-neutral-gray-50 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5 text-accent-orange" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-navy-900">{f.titel}</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-neutral-gray-50 text-text-muted border-neutral-gray-200">{f.rhythmus}</span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">{f.beschreibung}</p>
              <p className="text-xs text-navy-900 font-semibold mt-1">Frist: {f.frist}</p>
              <p className="text-[10px] text-text-muted mt-0.5">{f.paragraf}</p>
            </div>
          </div>
        ))}
      </div>

      <FeedbackFooter pageTitle="Fristen" route="/buchhaltung/fristen" variant="full" />
    </div>
  );
}
