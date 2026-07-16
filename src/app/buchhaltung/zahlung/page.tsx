import { getPaymentLedgerSnapshotAction } from "@/app/buchhaltung/zahlung/actions";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { BackButton } from "@/components/ui/BackButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { AlertTriangle, CreditCard, Database, ExternalLink, Link2Off } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export default async function ZahlungPage() {
  const snapshot = await getPaymentLedgerSnapshotAction();
  const paid = snapshot.entries.filter((entry) => entry.status === "paid");
  const pending = snapshot.entries.filter((entry) => ["creating", "pending"].includes(entry.status));
  const review = snapshot.entries.filter((entry) => entry.status === "review_required");

  return (
    <div className="w-full px-4 pb-24 sm:px-6 xl:px-8">
      <div className="mb-6">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Buchhaltung", href: "/buchhaltung" }, { label: "Zahlungen" }]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />
      </div>

      <div className="mb-7 flex items-center gap-3">
        <CreditCard className="h-7 w-7 text-blue-600" />
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900">Zahlungsstatus</h1>
          <p className="mt-1 text-xs text-text-muted">Gespeicherte Zahlungsversuche für Aufträge · Stand {new Date(snapshot.generatedAt).toLocaleString("de-DE")}</p>
        </div>
      </div>

      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Gespeicherte Versuche" value={String(snapshot.entries.length)} />
        <Metric label="Lokal als bezahlt" value={`${paid.length} · ${money.format(paid.reduce((sum, entry) => sum + entry.amountEur, 0))}`} />
        <Metric label="Offen / in Bearbeitung" value={String(pending.length)} />
        <Metric label="Manuell zu prüfen" value={String(review.length)} warning={review.length > 0} />
      </div>

      <div className="mb-7 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-neutral-100 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2"><Database className="h-5 w-5 text-emerald-600" /><h2 className="font-extrabold text-navy-900">Verbindungswahrheit</h2></div>
          <StatusRow label="App → geschützte Zahlungsfunktion" value={snapshot.appForwarderConfigured ? "App-Konfiguration vorhanden" : "Nicht konfiguriert"} ready={snapshot.appForwarderConfigured} />
          <StatusRow label="Mollie / Webhook aktuell erreichbar" value="In dieser Ansicht nicht geprüft" />
          <StatusRow label="Bank / PSD2" value="Nicht angebunden" />
          <p className="mt-4 text-xs text-text-muted">Ein vorhandener App-Forwarder beweist weder Provider-Secrets noch Erreichbarkeit. Erst ein erfolgreicher, gespeicherter Zahlungsversuch ist eine Ausführungsquittung.</p>
        </section>

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="mb-3 flex items-center gap-2"><Link2Off className="h-5 w-5 text-amber-700" /><h2 className="font-extrabold text-amber-900">Noch keine automatische Abstimmung</h2></div>
          <p className="text-sm text-amber-800">Auftragszahlungen und Ausgangsrechnungen sind noch nicht durch eine gespeicherte Abstimmungsreferenz verbunden. Deshalb wird hier keine Zahlungsmoral, Bankliquidität oder Rechnungsbegleichung hergeleitet.</p>
          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold">
            <Link href="/buchhaltung/rechnungen" className="text-amber-900 underline">Offene Rechnungen</Link>
            <Link href="/orders" className="text-amber-900 underline">Aufträge</Link>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm" aria-label="Letzte Zahlungsversuche">
        <div className="mb-3 flex items-center justify-between gap-4">
          <h2 className="font-extrabold text-navy-900">Letzte gespeicherte Zahlungsversuche</h2>
          <span className="text-xs text-text-muted">maximal 50</span>
        </div>
        {snapshot.entries.length === 0 ? (
          <div className="flex items-start gap-2 rounded-xl bg-neutral-50 p-4 text-sm text-text-muted"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Es existieren noch keine gespeicherten Zahlungsversuche. Daraus wird kein „0 € Live-Saldo“ abgeleitet.</div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {snapshot.entries.map((entry) => (
              <div key={entry.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-bold text-navy-900">{entry.provider} · {entry.id}</p>
                  <p className="text-xs text-text-muted">{new Date(entry.createdAt).toLocaleString("de-DE")} · Providerstatus: {entry.providerStatus || "nicht gespeichert"}</p>
                </div>
                <span className="font-bold text-navy-900">{money.format(entry.amountEur)}</span>
                {entry.orderId ? (
                  <Link href={`/orders/${encodeURIComponent(entry.orderId)}`} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700">Auftrag <ExternalLink className="h-3 w-3" /></Link>
                ) : <span className="text-xs text-text-muted">Kein Auftrag verknüpft</span>}
                <span className="text-xs text-text-muted sm:col-start-2">Lokaler Status: {entry.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="mt-4 text-xs text-text-muted">Zahlungslinks werden ausschließlich am konkreten Auftrag erzeugt. Diese Seite erzeugt keine Links und simuliert keine Statistik.</p>
      <FeedbackFooter pageTitle="Zahlung" route="/buchhaltung/zahlung" variant="full" />
    </div>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className={`rounded-2xl border bg-white p-5 shadow-sm ${warning ? "border-amber-200" : "border-neutral-100"}`}><p className="text-xs font-semibold text-text-muted">{label}</p><p className={`mt-2 text-xl font-extrabold ${warning ? "text-amber-700" : "text-navy-900"}`}>{value}</p></div>;
}

function StatusRow({ label, value, ready = false }: { label: string; value: string; ready?: boolean }) {
  return <div className="flex items-start justify-between gap-4 border-b border-neutral-100 py-2 text-sm last:border-0"><span className="text-text-muted">{label}</span><span className={`text-right font-bold ${ready ? "text-emerald-700" : "text-amber-700"}`}>{value}</span></div>;
}
