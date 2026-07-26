"use client";

import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { BackButton } from "@/components/ui/BackButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { usePageView } from "@/hooks/usePageView";
import type { KategorieSumme } from "@/lib/buchhaltung/types";
import {
  AlertCircle,
  BarChart3,
  Download,
  FileCheck,
  FileText,
  Landmark,
  Receipt,
  Settings,
  ShieldAlert,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export type FinanceCockpitSnapshot = {
  period: { von: string; bis: string; label: string };
  generatedAt: string;
  ledger: "SKR03" | "SKR04";
  income: number;
  expenses: number;
  result: number;
  vatPayable: number;
  receiptCount: number;
  reviewCount: number;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  openAmount: number;
  categories: KategorieSumme[];
  truthStatus: "complete" | "partial";
  missingInputCount: number;
};

const currency = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function BuchhaltungCockpitClient({ snapshot }: { snapshot: FinanceCockpitSnapshot }) {
  usePageView();

  return (
    <div className="w-full px-4 pb-24 sm:px-6 xl:px-8">
      <div className="mb-5">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Betrieb", href: "/betrieb" }, { label: "Buchhaltung & Finanzen" }]} />
        <BackButton label="Betrieb" href="/betrieb" />
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-orange/10">
              <FileText className="h-6 w-6 text-accent-orange" />
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-navy-900">Buchhaltung & Finanzen</h1>
          </div>
          <p className="mt-2 text-sm text-text-muted">
            Datenbankstand für {snapshot.period.label} · {snapshot.ledger} · aktualisiert {new Date(snapshot.generatedAt).toLocaleString("de-DE")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NavButton href="/buchhaltung/belege" icon={<Receipt className="h-4 w-4" />}>Belege</NavButton>
          <NavButton href="/buchhaltung/einstellungen" icon={<Settings className="h-4 w-4" />}>Einstellungen</NavButton>
        </div>
      </div>

      <section aria-labelledby="month-summary" className="mb-7">
        <h2 id="month-summary" className="mb-3 text-sm font-bold text-navy-900">Monatssicht {snapshot.period.von} bis {snapshot.period.bis}</h2>
        {snapshot.truthStatus === "partial" ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            Teilstand: {snapshot.missingInputCount} benÃ¶tigte Betrags- oder Steuerfelder fehlen. Die folgenden Summen enthalten nur belegte Werte und sind keine vollstÃ¤ndigen Gesamtsummen.
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label={snapshot.truthStatus === "partial" ? "Bekannte Netto-Einnahmen" : "Netto-Einnahmen"} value={currency.format(snapshot.income)} />
          <Metric label={snapshot.truthStatus === "partial" ? "Bekannte Ausgaben" : "Ausgaben"} value={currency.format(snapshot.expenses)} />
          <Metric label={snapshot.truthStatus === "partial" ? "Rechnerischer Teilstand" : "Rechnerisches Ergebnis"} value={currency.format(snapshot.result)} tone={snapshot.result < 0 ? "warning" : "default"} />
          <Metric label={snapshot.truthStatus === "partial" ? "Bekannte USt-Zahllast" : "USt-Zahllast (berechnet)"} value={currency.format(snapshot.vatPayable)} />
          <Metric label="Offene Restbeträge" value={currency.format(snapshot.openAmount)} tone={snapshot.overdueInvoiceCount > 0 ? "warning" : "default"} />
        </div>
        <p className="mt-2 text-xs text-text-muted">Die Werte stammen aus erfassten Rechnungen, Belegen und Kostenposten. Sie sind keine Steuerfreigabe und keine ELSTER-Übermittlung.</p>
      </section>

      <div className="mb-7 grid gap-4 lg:grid-cols-3">
        <TruthCard
          title="Belege"
          icon={<Receipt className="h-5 w-5 text-rose-600" />}
          href="/buchhaltung/belege"
          primary={`${snapshot.receiptCount} im Zeitraum`}
          detail={`${snapshot.reviewCount} noch nicht festgeschrieben`}
        />
        <TruthCard
          title="Offene Rechnungen"
          icon={<FileCheck className="h-5 w-5 text-emerald-600" />}
          href="/buchhaltung/rechnungen?view=open_items"
          primary={`${snapshot.openInvoiceCount} offen oder teilbezahlt`}
          detail={`${snapshot.overdueInvoiceCount} fällig/überfällig`}
        />
        <TruthCard
          title="BWA-Auswertung"
          icon={<TrendingUp className="h-5 w-5 text-teal-600" />}
          href="/buchhaltung/bwa"
          primary="Aus Datenbankwerten berechnen"
          detail="Keine feste Beispielkennzahl"
        />
      </div>

      <div className="mb-7 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            <h2 className="font-extrabold text-navy-900">Ausgaben nach gespeicherter Kategorie</h2>
          </div>
          {snapshot.categories.length === 0 ? (
            <p className="text-sm text-text-muted">Für diesen Zeitraum liegen keine kategorisierten Ausgaben vor.</p>
          ) : (
            <div className="space-y-3">
              {snapshot.categories.slice(0, 8).map((category) => (
                <div key={category.kategorieId} className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2 text-sm last:border-0">
                  <span className="min-w-0 truncate text-text-muted">{category.kategorieName} · {category.anzahl} Buchungen</span>
                  <span className="shrink-0 font-bold text-navy-900">{currency.format(category.summe)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            <h2 className="font-extrabold text-navy-900">Schnittstellenstatus</h2>
          </div>
          <div className="space-y-3 text-sm">
            <Boundary label="ELSTER-Direktversand" status="Nicht angebunden" />
            <Boundary label="Bank / PSD2" status="Nicht angebunden" />
            <Boundary label="Lohn-Meldung" status="Nicht angebunden" />
            <Boundary label="DATEV / Lexware" status="Dateiexport verfügbar" ready />
          </div>
        </section>
      </div>

      <section className="mb-8 rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-extrabold text-navy-900">Echte Arbeitswege</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <RouteLink href="/buchhaltung/ausgaben" icon={<WalletCards className="h-4 w-4" />} label="Ausgaben" />
          <RouteLink href="/buchhaltung/rechnungen" icon={<FileCheck className="h-4 w-4" />} label="Rechnungen" />
          <RouteLink href="/buchhaltung/kosten" icon={<TrendingUp className="h-4 w-4" />} label="Kostenposten" />
          <RouteLink href="/buchhaltung/export" icon={<Download className="h-4 w-4" />} label="Export" />
          <RouteLink href="/buchhaltung/steuerprofil" icon={<FileText className="h-4 w-4" />} label="Steuerprofil" />
          <RouteLink href="/buchhaltung/periodenabschluss" icon={<AlertCircle className="h-4 w-4" />} label="Periodenabschluss" />
          <RouteLink href="/buchhaltung/kraftstoff" icon={<Landmark className="h-4 w-4" />} label="Kraftstoffdaten" />
          <RouteLink href="/marketing" icon={<BarChart3 className="h-4 w-4" />} label="Marketing separat" />
        </div>
        <p className="mt-4 text-xs text-text-muted">Marketing-Umsatz wird hier erst ausgewiesen, wenn eine gespeicherte, prüfbare Zuordnung zwischen Kampagne, Auftrag und Rechnung vorliegt.</p>
      </section>

      <FeedbackFooter pageTitle="Buchhaltung" route="/buchhaltung" variant="full" />
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div className={`rounded-2xl border bg-white p-4 shadow-sm ${tone === "warning" ? "border-amber-200" : "border-neutral-100"}`}>
      <p className="text-xs font-semibold text-text-muted">{label}</p>
      <p className={`mt-2 text-xl font-extrabold ${tone === "warning" ? "text-amber-700" : "text-navy-900"}`}>{value}</p>
    </div>
  );
}

function TruthCard({ title, icon, href, primary, detail }: { title: string; icon: ReactNode; href: string; primary: string; detail: string }) {
  return (
    <Link href={href} className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm transition-colors hover:border-neutral-200">
      <div className="mb-3 flex items-center gap-2">{icon}<h2 className="font-extrabold text-navy-900">{title}</h2></div>
      <p className="text-sm font-bold text-navy-900">{primary}</p>
      <p className="mt-1 text-xs text-text-muted">{detail}</p>
    </Link>
  );
}

function Boundary({ label, status, ready = false }: { label: string; status: string; ready?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0">
      <span className="text-text-muted">{label}</span>
      <span className={`font-bold ${ready ? "text-emerald-700" : "text-amber-700"}`}>{status}</span>
    </div>
  );
}

function NavButton({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  return <Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-bold text-navy-900">{icon}{children}</Link>;
}

function RouteLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return <Link href={href} className="flex min-h-11 items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-neutral-50">{icon}{label}</Link>;
}
