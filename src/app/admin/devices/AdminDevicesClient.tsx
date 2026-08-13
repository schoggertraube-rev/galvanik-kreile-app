"use client";

/**
 * AdminDevicesClient — NOT_CONFIGURED
 *
 * The previous implementation contained a hardcoded device list with no real
 * database contract (removed in F1-R0 gate). Pending a real device-management
 * data source and server contract before this page can be activated.
 */
export function AdminDevicesClient() {
  return (
    <div className="max-w-4xl mx-auto p-6 font-sans antialiased text-navy-900">
      <h1 className="text-2xl font-bold font-serif mb-4">Geräteverwaltung</h1>
      <div className="bg-white rounded-2xl p-8 border border-neutral-gray-200 text-center">
        <p className="font-bold text-navy-900 text-lg">NOT_CONFIGURED</p>
        <p className="text-sm text-text-muted mt-2">
          Geräteverwaltung ist noch nicht angebunden. Kein realer Datenbankvertrag vorhanden.
        </p>
      </div>
    </div>
  );
}
