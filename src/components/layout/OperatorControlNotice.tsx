import type { OperatorControlStatus } from "@/lib/server/operatorControl";

function berlinTime(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(value));
}

export function OperatorControlBanner({
  status,
  developerBypass,
}: {
  status: OperatorControlStatus;
  developerBypass: boolean;
}) {
  if (status.availability === "invalid_signature" && developerBypass) {
    return (
      <div role="alert" className="border-b border-red-300 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-900">
        Betreiberstatus nicht verifizierbar. Die ungültige Signatur wird nicht angewendet; Version {status.policyVersion ?? "unbekannt"} prüfen.
      </div>
    );
  }
  if (!status.enforced || status.mode === "active") return null;

  const expiry = berlinTime(status.expiresAt);
  const prefix = developerBypass && status.accessRestricted
    ? "Entwicklerzugang bleibt für Diagnose aktiv. Kundenbetrieb: "
    : status.mode === "grace"
      ? "Hinweis zum Vertragsstatus: "
      : "Betriebsstatus: ";
  return (
    <div role="status" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      {prefix}{status.notice}
      {expiry ? ` Gültig bis ${expiry}.` : ""}
      {status.policyVersion ? ` (Statusversion ${status.policyVersion})` : ""}
    </div>
  );
}

export function OperatorRestrictedAccess({ status }: { status: OperatorControlStatus }) {
  const effectiveAt = berlinTime(status.effectiveAt);
  const heading = status.mode === "maintenance" ? "WerkstattCockpit in Wartung" : "WerkstattCockpit vorübergehend ausgesetzt";
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <section aria-labelledby="operator-control-heading" className="w-full max-w-2xl rounded-2xl border border-amber-400/50 bg-slate-900 p-8 shadow-2xl">
        <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-amber-300">Transparenter Betriebsstatus</p>
        <h1 id="operator-control-heading" className="text-3xl font-bold">{heading}</h1>
        <p className="mt-5 text-lg leading-8 text-slate-200">{status.notice}</p>
        <dl className="mt-7 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
          <div><dt className="font-semibold text-slate-100">Wirksam seit</dt><dd>{effectiveAt ?? "nicht angegeben"}</dd></div>
          <div><dt className="font-semibold text-slate-100">Statusversion</dt><dd>{status.policyVersion ?? "nicht angegeben"}</dd></div>
        </dl>
        <p className="mt-7 text-sm text-slate-400">Es wird keine künstliche Verlangsamung eingesetzt. Der Zugang ist eindeutig gekennzeichnet; der Entwicklerzugang für Diagnose und Wiederherstellung bleibt getrennt.</p>
      </section>
    </main>
  );
}
