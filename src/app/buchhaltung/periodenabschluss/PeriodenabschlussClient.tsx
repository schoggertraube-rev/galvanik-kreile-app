"use client";

import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { BackButton } from "@/components/ui/BackButton";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, Lock, ExternalLink, Zap } from "lucide-react";
import type { PeriodenabschlussStatus } from "./actions";

export function PeriodenabschlussClient({ initialStatus, userRole }: { initialStatus: PeriodenabschlussStatus | null, userRole?: string }) {
  const status = initialStatus;

  const monatName = status ? new Date(status.jahr, status.monat - 1).toLocaleString('de-DE', { month: 'long' }) : "";
  const periodTitle = status ? `${monatName} ${status.jahr}` : "Keine offene Periode";

  const blockerCount = status ? 
    (status.belege_ohne_konto + status.belege_ohne_kostenstelle + status.rechnungen_ohne_auftrag + status.auftraege_ohne_db) 
    : 0;

  const steps = [
    {
      id: 1,
      title: "1. Eingangsbelege prüfen",
      description: "Alle Belege müssen ein Sachkonto und eine Kostenstelle haben.",
      content: status && (
        <div className="space-y-3 mt-3">
          <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
            <span className="text-sm font-medium text-neutral-700">Belege ohne Konto</span>
            {status.belege_ohne_konto > 0 ? (
              <Link href="/buchhaltung/belege?view=missingKonto" className="flex items-center gap-2 text-rose-600 font-bold text-sm bg-rose-50 px-3 py-1 rounded-full hover:bg-rose-100 transition-colors">
                {status.belege_ohne_konto} prüfen <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <span className="flex items-center gap-1 text-emerald-600 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-full"><CheckCircle2 className="w-4 h-4" /> 0</span>
            )}
          </div>
          <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
            <span className="text-sm font-medium text-neutral-700">Belege ohne Kostenstelle</span>
            {status.belege_ohne_kostenstelle > 0 ? (
              <Link href="/buchhaltung/belege?view=missingKostenstelle" className="flex items-center gap-2 text-amber-600 font-bold text-sm bg-amber-50 px-3 py-1 rounded-full hover:bg-amber-100 transition-colors">
                {status.belege_ohne_kostenstelle} prüfen <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <span className="flex items-center gap-1 text-emerald-600 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-full"><CheckCircle2 className="w-4 h-4" /> 0</span>
            )}
          </div>
        </div>
      )
    },
    {
      id: 2,
      title: "2. Ausgangsrechnungen",
      description: "Rechnungen ohne Auftragsbezug prüfen und offene Rechnungen im Auge behalten.",
      content: status && (
        <div className="space-y-3 mt-3">
          <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
            <span className="text-sm font-medium text-neutral-700">Rechnungen ohne Auftrag</span>
            {status.rechnungen_ohne_auftrag > 0 ? (
              <div className="flex items-center gap-2 text-blue-600 font-bold text-sm bg-blue-50 px-3 py-1 rounded-full">
                {status.rechnungen_ohne_auftrag} prüfen
              </div>
            ) : (
              <span className="flex items-center gap-1 text-emerald-600 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-full"><CheckCircle2 className="w-4 h-4" /> 0</span>
            )}
          </div>
          <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
            <span className="text-sm font-medium text-neutral-700">Offene Rechnungen</span>
            <span className="text-sm font-bold text-neutral-600">{status.rechnungen_offen} offene Posten</span>
          </div>
        </div>
      )
    },
    {
      id: 3,
      title: "3. Aufträge & DB",
      description: "Aufträge überprüfen, bei denen der Deckungsbeitrag noch nicht berechnet werden konnte.",
      content: status && (
        <div className="mt-3 flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
          <span className="text-sm font-medium text-neutral-700">Aufträge ohne finalen DB</span>
          {status.auftraege_ohne_db > 0 ? (
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm bg-amber-50 px-3 py-1 rounded-full">
              {status.auftraege_ohne_db} prüfen
            </div>
          ) : (
            <span className="flex items-center gap-1 text-emerald-600 font-bold text-sm bg-emerald-50 px-3 py-1 rounded-full"><CheckCircle2 className="w-4 h-4" /> 0</span>
          )}
        </div>
      )
    },
    {
      id: 4,
      title: "4. Energieverteilung",
      description: "Strom, Gas & Wasser anteilig auf die Kostenstellen (Bäder) dieses Monats verteilen.",
      content: (
        <div className="mt-4">
          <button 
            disabled
            className="flex items-center gap-2 bg-[#1e1b18] text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black transition-colors disabled:opacity-50"
          >
            <Zap className="w-4 h-4 text-amber-400" /> Kosten verteilen
          </button>
        </div>
      )
    },
    {
      id: 5,
      title: "5. Kostenstellenauswertung",
      description: "Ergebnis der Kostenstellen kontrollieren (Auslastung & Deckungsbeitrag).",
      content: (
        <div className="mt-4">
          <Link href="/performance/kunden-markt" className="flex items-center gap-2 bg-white border border-neutral-200 text-[#1e1b18] w-fit px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-neutral-50 transition-colors shadow-sm">
            Zum Controlling <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      )
    },
    {
      id: 6,
      title: "6. FiBu Export (Steuerberater)",
      description: "Alle Rechnungen und festgeschriebenen Belege für DATEV oder Lexware exportieren.",
      content: (
        <div className="mt-4 flex gap-3">
          <button disabled className="px-4 py-2 bg-blue-50 text-blue-700 font-bold text-sm rounded-lg hover:bg-blue-100 transition-colors">DATEV Export</button>
          <button disabled className="px-4 py-2 bg-emerald-50 text-emerald-700 font-bold text-sm rounded-lg hover:bg-emerald-100 transition-colors">Lexware Export</button>
        </div>
      )
    },
    {
      id: 7,
      title: "7. Umsatzsteuer-Voranmeldung (UStVA)",
      description: "Umsatzsteuer berechnen und XML für ELSTER generieren.",
      content: (
        <div className="mt-4">
          <button disabled className="px-4 py-2 bg-purple-50 text-purple-700 font-bold text-sm rounded-lg hover:bg-purple-100 transition-colors">UStVA XML generieren</button>
        </div>
      )
    },
    {
      id: 8,
      title: "8. Periode festschreiben",
      description: "Schließt den Monat endgültig. Belege und Aufträge in diesem Monat können danach nicht mehr verändert werden (GoBD-konform).",
      content: (
        <div className="mt-4 flex flex-col gap-3">
          {status && status.status === 'vorlaeufig_geschlossen' ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                Vorläufig geschlossen
              </span>
              {(userRole === 'inhaber' || userRole === 'admin' || userRole === 'developer') && (
                <button 
                  disabled
                  className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" /> Endgültig schließen (Inhaber)
                </button>
              )}
            </div>
          ) : (
            <>
              {blockerCount > 0 && (
                <p className="text-xs text-rose-600 font-bold mb-1">
                  Es gibt noch {blockerCount} ungelöste Blocker in den vorherigen Schritten!
                </p>
              )}
              <button 
                disabled
                className="flex items-center w-fit gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 disabled:bg-neutral-300"
              >
                <Lock className="w-4 h-4" /> {periodTitle} vorläufig schließen
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="w-full pb-24 px-4 sm:px-6 xl:px-8 min-h-screen">
      <div className="mb-6">
        <Breadcrumb items={[{label:'Home',href:'/'}, {label:'Buchhaltung',href:'/buchhaltung'}, {label:'Periodenabschluss'}]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2a2420] tracking-tight">Periodenabschluss</h1>
          <p className="text-sm text-neutral-500 mt-2 font-medium">
            {status ? `Aktuell offene Periode: ${periodTitle}` : "Alle vergangenen Perioden sind abgeschlossen."}
          </p>
          <p className="text-sm text-amber-700 mt-2 font-bold">
            NOT_AVAILABLE: Periodenabschluss benötigt den W3-Command-Vertrag.
          </p>
        </div>
        {status && (
          <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-sm font-bold border border-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {periodTitle} offen
          </div>
        )}
      </div>

      {status ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">
          {steps.map((step) => (
            <div key={step.id} className="bg-white rounded-3xl p-6 shadow-sm border border-neutral-100 flex flex-col h-full">
              <div className="flex items-start gap-4 mb-2">
                <div className="flex-1">
                  <h3 className="text-lg font-extrabold text-[#1e1b18]">{step.title}</h3>
                  <p className="text-xs font-medium text-neutral-500 mt-1 leading-relaxed">{step.description}</p>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-end">
                {step.content}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-emerald-50 rounded-3xl p-10 text-center border border-emerald-100 max-w-2xl mx-auto mt-12">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-extrabold text-emerald-800 mb-2">Alles erledigt!</h2>
          <p className="text-emerald-600 font-medium">Es gibt aktuell keine offenen Perioden, die abgeschlossen werden müssen.</p>
        </div>
      )}

      <FeedbackFooter pageTitle="Periodenabschluss" route="/buchhaltung/periodenabschluss" variant="full" />
    </div>
  );
}
