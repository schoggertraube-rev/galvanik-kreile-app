"use client";

import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { BackButton } from "@/components/ui/BackButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { usePageView } from "@/hooks/usePageView";
import type { BelegDetail } from "@/lib/buchhaltung/types";
import { Fuel, Navigation } from "lucide-react";
import Link from "next/link";

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function KraftstoffClient({
  initialTankungen,
  gesamtLiter,
  gesamtKosten,
  missingDetailCount,
  missingLiterCount,
  missingAmountCount,
  unresolvedCount,
}: {
  initialTankungen: BelegDetail[];
  gesamtLiter: number;
  gesamtKosten: number;
  missingDetailCount: number;
  missingLiterCount: number;
  missingAmountCount: number;
  unresolvedCount: number;
}) {
  usePageView();
  const average = unresolvedCount === 0 && gesamtLiter > 0 ? gesamtKosten / gesamtLiter : null;

  return (
    <div className="min-h-screen w-full px-4 pb-24 sm:px-6 xl:px-8">
      <div className="mb-6">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Buchhaltung", href: "/buchhaltung" }, { label: "Kraftstoff" }]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />
      </div>

      <div className="mb-7 flex items-center gap-3">
        <Fuel className="h-7 w-7 text-blue-500" />
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">Kraftstoffbelege</h1>
          <p className="mt-1 text-xs text-text-muted">Festgeschriebene Tankbelege; fehlende Kraftstoffdetails und Beträge bleiben ausdrücklich sichtbar.</p>
        </div>
      </div>

      <div className="mb-7 grid gap-4 sm:grid-cols-3">
        <Metric label="Festgeschriebene Tankbelege" value={String(initialTankungen.length)} />
        <Metric label={missingLiterCount > 0 ? "Bekannte Liter (Teilwert)" : "Gespeicherte Liter"} value={`${gesamtLiter.toLocaleString("de-DE", { maximumFractionDigits: 2 })} l`} />
        <Metric label="Durchschnitt aus Kosten/Litern" value={average === null ? "Nicht vollständig berechenbar" : `${money.format(average)} / l`} />
      </div>
      <p className="-mt-4 mb-7 text-xs text-text-muted">
        {missingAmountCount > 0 ? "Bekannte Kosten (Teilwert)" : "Gesamtkosten der angezeigten Belege"}: {money.format(gesamtKosten)}.
        {unresolvedCount > 0 ? ` ${unresolvedCount} Belege besitzen noch keine vollständige Berechnungsbasis; ${missingDetailCount} davon ohne Kraftstoffdetail.` : ""}
      </p>

      <section aria-label="Tankbelege" className="rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm">
        {initialTankungen.length === 0 ? (
          <p className="py-12 text-center text-sm text-text-muted">Keine festgeschriebenen Tankbelege mit diesem Belegtyp vorhanden.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {initialTankungen.map((item) => {
              const fuel = item.kraftstoffDetail;
              const date = item.belegdatum
                ? new Date(`${item.belegdatum}T00:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" })
                : "Belegdatum fehlt";
              return (
                <Link key={item.id} href={`/buchhaltung/belege/${item.id}`} className="grid gap-3 rounded-xl p-4 hover:bg-neutral-50 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50"><Navigation className="h-4 w-4 text-blue-600" /></div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-navy-900">{fuel?.tankstelle?.trim() || item.lieferantText?.trim() || "Tankstelle nicht erfasst"}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {date} · {fuel?.sorte || "Sorte nicht erfasst"} · {fuel?.liter === undefined ? "Liter nicht erfasst" : `${fuel.liter} l`}
                      {fuel?.ort ? ` · ${fuel.ort}` : ""}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-extrabold text-navy-900">{item.brutto === undefined ? "Betrag nicht erfasst" : money.format(item.brutto)}</p>
                    <p className="text-[10px] text-text-muted">Vorsteuerabzug gespeichert: {item.vorsteuerAbzug ? "ja" : "nein"}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <FeedbackFooter pageTitle="Kraftstoff" route="/buchhaltung/kraftstoff" variant="full" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm"><p className="text-xs font-semibold text-text-muted">{label}</p><p className="mt-2 text-xl font-extrabold text-navy-900">{value}</p></div>;
}
