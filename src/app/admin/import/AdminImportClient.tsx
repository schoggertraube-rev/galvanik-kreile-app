"use client";

/**
 * AdminImportClient — NOT_CONFIGURED
 *
 * The previous implementation simulated a local import queue with no real
 * database contract (removed in F1-R0 gate). Pending a verified server-side
 * import pipeline before this module can be activated.
 */
export function AdminImportClient() {
  return (
    <div className="max-w-4xl mx-auto p-6 font-sans antialiased text-navy-900">
      <h1 className="text-2xl font-bold font-serif mb-4">Datenimport</h1>
      <div className="bg-white rounded-2xl p-8 border border-neutral-gray-200 text-center">
        <p className="font-bold text-navy-900 text-lg">NOT_CONFIGURED</p>
        <p className="text-sm text-text-muted mt-2">
          Datenimport ist noch nicht angebunden. Kein realer Server-Import-Vertrag vorhanden.
        </p>
      </div>
    </div>
  );
}
