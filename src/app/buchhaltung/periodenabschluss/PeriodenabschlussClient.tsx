"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, Lock, Zap } from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { usePageView } from "@/hooks/usePageView";
import {
  finalSchliessePeriodeAction,
  schliessePeriodeAction,
  type PeriodenabschlussStatus,
} from "./actions";

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : "Unbekannter Fehler";
}

function CountRow({ label, count, href }: { label: string; count: number; href?: string }) {
  const value = count === 0 ? (
    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
      <CheckCircle2 className="h-4 w-4" /> 0
    </span>
  ) : href ? (
    <Link href={href} className="flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-700">
      {count} prüfen <ExternalLink className="h-3.5 w-3.5" />
    </Link>
  ) : (
    <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">{count} prüfen</span>
  );
  return <div className="flex items-center justify-between gap-4 rounded-xl bg-neutral-50 p-3"><span className="text-sm font-medium">{label}</span>{value}</div>;
}

export function PeriodenabschlussClient({
  initialStatus,
  userRole,
}: {
  initialStatus: PeriodenabschlussStatus | null;
  userRole?: string;
}) {
  usePageView();
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [isProcessing, setIsProcessing] = useState(false);
  const preliminaryRequestId = useRef<string | null>(null);
  const finalRequestId = useRef<string | null>(null);

  const monthName = status
    ? new Date(status.jahr, status.monat - 1).toLocaleString("de-DE", { month: "long" })
    : "";
  const periodTitle = status ? `${monthName} ${status.jahr}` : "Keine offene Periode";
  const blockerCount = status
    ? status.belege_ohne_konto
      + status.belege_ohne_kostenstelle
      + status.rechnungen_ohne_auftrag
      + status.belege_ohne_periode
      + status.rechnungen_ohne_periode
      + status.auftraege_ohne_db
    : 0;
  const canClose = userRole === "admin" || userRole === "developer";

  async function closePreliminary() {
    if (!status) return;
    setIsProcessing(true);
    try {
      preliminaryRequestId.current ||= crypto.randomUUID();
      const result = await schliessePeriodeAction(status.id, preliminaryRequestId.current);
      if (!result.ok) throw new Error(result.message);
      setStatus({ ...status, status: "vorlaeufig_geschlossen", geschlossen_am: result.closedAt });
      preliminaryRequestId.current = null;
      router.refresh();
    } catch (error) {
      alert(`Abschluss nicht bestätigt: ${messageFrom(error)}`);
    } finally {
      setIsProcessing(false);
    }
  }

  async function closeFinal() {
    if (!status) return;
    setIsProcessing(true);
    try {
      finalRequestId.current ||= crypto.randomUUID();
      const result = await finalSchliessePeriodeAction(status.id, finalRequestId.current);
      if (!result.ok) throw new Error(result.message);
      setStatus(null);
      finalRequestId.current = null;
      router.refresh();
    } catch (error) {
      alert(`Finaler Abschluss nicht bestätigt: ${messageFrom(error)}`);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen w-full px-4 pb-24 sm:px-6 xl:px-8">
      <div className="mb-6">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Buchhaltung", href: "/buchhaltung" }, { label: "Periodenabschluss" }]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />
      </div>

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#2a2420]">Periodenabschluss</h1>
          <p className="mt-2 text-sm font-medium text-neutral-500">
            {status ? `Nächste offene Periode: ${periodTitle}` : "Keine offene oder vorläufig geschlossene Periode gefunden."}
          </p>
        </div>
        {status && <span className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800"><AlertTriangle className="h-4 w-4" />{status.status}</span>}
      </div>

      {status ? (
        <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-extrabold">Abschlussblocker</h2>
            <p className="mb-4 text-xs text-neutral-500">Die Werte werden serverseitig für genau diese Periode berechnet.</p>
            <div className="space-y-3">
              <CountRow label="Belege ohne Konto" count={status.belege_ohne_konto} href="/buchhaltung/belege?view=missingKonto" />
              <CountRow label="Belege ohne Kostenstelle" count={status.belege_ohne_kostenstelle} href="/buchhaltung/belege?view=missingKostenstelle" />
              <CountRow label="Rechnungen ohne Auftrag" count={status.rechnungen_ohne_auftrag} href="/buchhaltung/rechnungen" />
              <CountRow label="Belege ohne Periodenzuordnung" count={status.belege_ohne_periode} href="/buchhaltung/belege" />
              <CountRow label="Rechnungen ohne Periodenzuordnung" count={status.rechnungen_ohne_periode} href="/buchhaltung/rechnungen" />
              <CountRow label="Abgeschlossene Aufträge ohne DB" count={status.auftraege_ohne_db} href="/orders" />
            </div>
            <p className="mt-4 text-xs text-neutral-500">Offene Rechnungen: {status.rechnungen_offen}. Sie werden angezeigt, sind aber nicht automatisch ein Abschlussblocker.</p>
          </section>

          <section className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-extrabold">Verbundene Schritte</h2>
            <p className="mb-4 text-xs text-neutral-500">Nur tatsächlich angebundene Wege sind aktiv.</p>
            <div className="space-y-3">
              <button type="button" disabled className="flex w-full items-center gap-2 rounded-xl bg-neutral-100 px-4 py-3 text-left text-sm font-bold text-neutral-500">
                <Zap className="h-4 w-4" /> Energieverteilung nicht konfiguriert
              </button>
              <Link href="/buchhaltung/export" className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm font-bold hover:bg-neutral-50">
                Serverexporte öffnen <ExternalLink className="h-4 w-4" />
              </Link>
              <button type="button" disabled className="w-full rounded-xl bg-neutral-100 px-4 py-3 text-left text-sm font-bold text-neutral-500">
                ELSTER/XML nicht verbunden
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-100 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="text-lg font-extrabold">Periode sperren</h2>
            <p className="mt-1 text-sm text-neutral-600">
              Der Server prüft Mandant, Rolle, Blocker und Status in einer gesperrten Transaktion. Ein Erfolg wird erst nach Audit-Receipt angezeigt.
            </p>
            {!canClose && <p className="mt-3 text-sm font-bold text-amber-800">Für den Abschluss ist eine Administrator- oder Entwicklerrolle erforderlich.</p>}
            {blockerCount > 0 && <p className="mt-3 text-sm font-bold text-rose-700">Noch {blockerCount} Abschlussblocker.</p>}
            <div className="mt-5">
              {status.status === "vorlaeufig_geschlossen" ? (
                <button type="button" onClick={closeFinal} disabled={!canClose || isProcessing} className="flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                  <Lock className="h-4 w-4" /> Endgültig schließen
                </button>
              ) : (
                <button type="button" onClick={closePreliminary} disabled={!canClose || isProcessing || blockerCount > 0} className="flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40">
                  <Lock className="h-4 w-4" /> Vorläufig schließen
                </button>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div className="mx-auto mt-12 max-w-2xl rounded-3xl border border-neutral-200 bg-white p-10 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
          <h2 className="text-xl font-extrabold">Keine bearbeitbare Periode</h2>
          <p className="mt-2 text-sm text-neutral-600">Es wird kein Abschluss behauptet, wenn schlicht keine Periodenzeile vorhanden ist.</p>
        </div>
      )}

      <FeedbackFooter pageTitle="Periodenabschluss" route="/buchhaltung/periodenabschluss" variant="full" />
    </div>
  );
}
