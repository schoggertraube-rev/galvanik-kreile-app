export default function InvoicesLoading() {
  return (
    <main className="min-h-screen bg-bg-app-soft px-4 py-8 sm:px-6 xl:px-8" aria-busy="true">
      <div className="mx-auto max-w-6xl space-y-4" role="status">
        <span className="sr-only">Rechnungsliste wird geladen</span>
        <div className="h-10 w-56 animate-pulse rounded-lg bg-neutral-gray-200" />
        <div className="h-36 animate-pulse rounded-2xl bg-white" />
        <div className="h-36 animate-pulse rounded-2xl bg-white" />
      </div>
    </main>
  );
}
