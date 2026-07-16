import Link from "next/link";
import { FeedbackFooter } from "@/components/feedback/FeedbackFooter";

export default function KvpPage() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6 pb-24">
      <header>
        <h1 className="text-2xl font-bold text-navy-900">App verbessern</h1>
        <p className="mt-2 text-sm text-text-muted">Keine lokale Demo-Liste: App-Feedback und betriebliche Verbesserungen bleiben getrennte, bestätigte Wege.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/betrieb-kvp" className="rounded-2xl border border-neutral-gray-200 bg-white p-5">
          <h2 className="font-bold text-navy-900">Betrieblicher KVP</h2>
          <p className="mt-2 text-sm text-text-muted">Tenantgebundene Verbesserungen für Werkstatt und Prozesse.</p>
        </Link>
        <Link href="/admin/analytics" className="rounded-2xl border border-neutral-gray-200 bg-white p-5">
          <h2 className="font-bold text-navy-900">Developer Analytics</h2>
          <p className="mt-2 text-sm text-text-muted">Bestätigter Instrumentierungs- und Nutzungsstatus.</p>
        </Link>
      </div>
      <FeedbackFooter pageTitle="App verbessern" route="/kvp" variant="full" />
    </main>
  );
}
