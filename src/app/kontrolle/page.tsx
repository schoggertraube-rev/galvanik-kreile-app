import Link from "next/link";
import { AlertTriangle, BarChart3, CheckCircle2, MessageSquare, PackageCheck, ShieldCheck } from "lucide-react";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";
import { hasPermission } from "@/lib/auth/permissions";
import { getQsListenAction } from "./actions";

export const dynamic = "force-dynamic";

const destinations = [
  { href: "/orders?filter=critical", label: "Kritische Aufträge", description: "Echte Aufträge mit bestätigter Risikoklassifikation", icon: AlertTriangle },
  { href: "/warendurchlauf/warenausgang", label: "Warenausgang", description: "Aufträge an der Station Warenausgang", icon: PackageCheck },
  { href: "/quotes", label: "Anfragen & Angebote", description: "Bestätigte Angebotsanfragen", icon: MessageSquare },
  { href: "/kommunikation", label: "Kommunikation", description: "Bestätigte Telefonnotizen und Anschlussstatus", icon: ShieldCheck },
] as const;

export default async function KontrollePage() {
  const [qsResult, canViewAnalytics] = await Promise.all([
    getQsListenAction(),
    hasPermission("perm_sys_diag"),
  ]);
  const qsRecords = qsResult.ok ? (qsResult.data ?? []) : [];

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-8 p-4 pb-24 md:p-8">
      <header>
        <h1 className="text-3xl font-bold text-navy-900">Kontrolle</h1>
        <p className="mt-2 text-sm text-text-muted">Echte Kontrollquellen und direkte operative Wege – ohne Demo-Zählstände.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {destinations.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="rounded-2xl border border-neutral-gray-200 bg-white p-5 shadow-sm transition-colors hover:border-navy-500">
            <Icon className="h-6 w-6 text-navy-900" />
            <h2 className="mt-3 font-bold text-navy-900">{label}</h2>
            <p className="mt-1 text-xs text-text-muted">{description}</p>
          </Link>
        ))}
        {canViewAnalytics && (
          <Link href="/admin/analytics" className="rounded-2xl border border-navy-900 bg-navy-900 p-5 text-white shadow-sm">
            <BarChart3 className="h-6 w-6" />
            <h2 className="mt-3 font-bold">Developer Analytics</h2>
            <p className="mt-1 text-xs text-white/70">Instrumentierungs- und Nutzungsstatus</p>
          </Link>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-navy-900" />
          <h2 className="font-bold text-navy-900">QS-Prüfprotokolle</h2>
        </div>
        <p className="mb-4 text-xs text-text-muted">Die QS-Tabelle besitzt derzeit keinen belastbaren Offen-/Erledigt-Status. Deshalb werden nur echte Protokolle gezeigt und keine „offenen Nacharbeiten“ behauptet.</p>

        {!qsResult.ok ? (
          <div role="alert" className="rounded-xl border border-error-red/30 bg-error-red/5 p-4 text-sm text-error-red">
            {qsResult.message}
          </div>
        ) : qsRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-gray-200 p-4 text-sm text-text-muted">
            Keine bestätigten QS-Prüfprotokolle vorhanden.
          </div>
        ) : (
          <div className="space-y-2">
            {qsRecords.map((record) => (
              <Link key={record.id} href={"/orders?order=" + record.orderId} className="flex flex-col justify-between gap-2 rounded-xl border border-neutral-gray-100 p-4 hover:border-navy-300 sm:flex-row">
                <div>
                  <p className="font-bold text-navy-900">{record.orderNumber} · {record.customerName}</p>
                  <p className="text-xs text-text-muted">{record.bemerkung || record.task || "Keine Bemerkung hinterlegt"}</p>
                </div>
                <div className="text-xs font-semibold text-text-muted sm:text-right">
                  <p>{record.ergebnis}</p>
                  <p>{record.datum.toLocaleString("de-DE")}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <FeedbackFooter pageTitle="Kontrolle" route="/kontrolle" variant="full" />
    </main>
  );
}
