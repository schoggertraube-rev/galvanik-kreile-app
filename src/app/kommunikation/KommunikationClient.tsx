"use client";

/**
 * Communication previously combined browser-side customer reads, realtime
 * subscriptions, and suggested replies.  It remains explicit about the
 * missing tenant, consent, provider, and receipt contracts.
 */
export function KommunikationClient() {
  return (
    <section className="mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-slate-900">
      <h1 className="text-lg font-semibold">Kommunikation ist noch nicht freigegeben</h1>
      <p className="mt-2 text-sm text-slate-700">
        Es werden keine Kundendaten, Realtime-Nachrichten, Antwortvorschläge oder Versandaktionen geladen, bis der Mandanten-, Einwilligungs- und Receipt-Vertrag geprüft ist.
      </p>
    </section>
  );
}
