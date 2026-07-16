import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rückmeldung | KREILE WerkstattCockpit",
  robots: { index: false, follow: false },
};

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  await params;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-12 text-slate-100">
      <section className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-300">
          Rückmeldung
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          Online-Feedback ist noch nicht sicher angebunden
        </h1>
        <p className="mt-5 leading-7 text-slate-200">
          Über diese Seite werden derzeit keine Bewertungen entgegengenommen.
          Es wurde nichts gespeichert oder übermittelt.
        </p>
        <p className="mt-4 text-sm leading-6 text-slate-400">
          Bitte nutzen Sie für Ihre Rückmeldung den Ihnen bekannten Kontaktweg
          zu Galvanik Kreile. Ein öffentlicher Feedback-Link wird erst aktiviert,
          wenn Token-Ablauf, Einmalverwendung und eine bestätigte Speicherung
          technisch umgesetzt sind.
        </p>
      </section>
    </main>
  );
}
