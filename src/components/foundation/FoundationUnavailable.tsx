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
