"use client";

export function CompanySettingsForm() {
  return (
    <section className="mx-auto max-w-4xl pb-12" aria-labelledby="company-settings-unavailable">
      <div className="rounded-3xl border-2 border-neutral-gray-200 bg-white p-6 shadow-sm">
        <h2 id="company-settings-unavailable" className="text-lg font-bold text-navy-900">
          Firmendaten
        </h2>
        <p className="mt-3 text-sm text-text-muted" role="status">
          NOT_AVAILABLE: Firmendaten-Anzeige benötigt einen tenant- und capability-geprüften W3-Read-Vertrag.
        </p>
      </div>
    </section>
  );
}
