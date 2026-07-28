import Link from "next/link";

type FoundationUnavailableProps = {
  title: string;
  reason: string;
  returnHref?: string;
  returnLabel?: string;
};

/**
 * A deliberately small, truth-preserving state for a product area whose
 * source contract is not safe enough to expose yet. It is not an empty state:
 * no count, success state, or inferred availability is rendered.
 */
export function FoundationUnavailable({
  title,
  reason,
  returnHref = "/",
  returnLabel = "Zur Startseite",
}: FoundationUnavailableProps) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl items-center p-6 md:p-10" data-foundation-state="not-configured">
      <section className="w-full rounded-2xl border border-amber-500/30 bg-amber-50 p-6 text-navy-900 shadow-sm" role="status">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Datenvertrag noch nicht freigegeben</p>
        <h1 className="mt-2 text-2xl font-bold">{title}</h1>
        <p className="mt-3 leading-relaxed text-text-muted">{reason}</p>
        <p className="mt-3 text-sm text-text-muted">
          Es werden bis zur belegten Anbindung keine Nullwerte, Entwarnungen oder erfundenen Ergebnisse angezeigt.
        </p>
        <Link href={returnHref} className="mt-5 inline-flex rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800">
          {returnLabel}
        </Link>
      </section>
    </main>
  );
}
