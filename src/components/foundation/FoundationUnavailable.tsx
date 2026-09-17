export function FoundationUnavailable() {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl items-center px-6 py-16">
      <section className="w-full rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <p className="text-sm font-semibold tracking-wide">NOT_AVAILABLE</p>
        <h1 className="mt-2 text-2xl font-semibold">Operative Daten sind noch nicht verfügbar</h1>
        <p className="mt-3 text-sm leading-6">Für diesen Bereich ist noch keine kanonische, quellgestützte operative Datenbasis verfügbar.</p>
      </section>
    </main>
  );
}

export type ProductActorAccessUnavailableProps = {
  supportReference?: string;
};

/** Safe, value-free failure state for the shared product-actor choke point. */
export function ProductActorAccessUnavailable({
  supportReference,
}: ProductActorAccessUnavailableProps) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl items-center px-6 py-16">
      <section
        className="w-full rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950"
        role="alert"
      >
        <p className="text-sm font-semibold tracking-wide">Sicherer Halt</p>
        <h1 className="mt-2 text-2xl font-semibold">
          Produktzugang momentan nicht verfügbar
        </h1>
        <p className="mt-3 text-sm leading-6">
          Die vorgesehenen Produktprofile konnten nicht vollständig und
          eindeutig bestätigt werden. Es wurden keine Daten verändert. Bitte
          wenden Sie sich an den Systemadministrator.
        </p>
        {supportReference ? (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold">
              Supportdetails
            </summary>
            <p className="mt-2">
              Referenz: <code>{supportReference}</code>
            </p>
          </details>
        ) : null}
      </section>
    </main>
  );
}
