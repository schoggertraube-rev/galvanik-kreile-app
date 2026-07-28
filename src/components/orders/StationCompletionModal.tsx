"use client";

import { AlertTriangle } from "lucide-react";

export function StationCompletionModal({ onClose }: {
  orderId: string;
  customerId?: string;
  currentStationId: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-700" />
        <h2 className="mt-3 text-lg font-bold text-navy-900">Stationsabschluss nicht freigegeben</h2>
        <p className="mt-2 text-sm text-text-muted">Zeit, Material, Kosten und Prozesswechsel benötigen einen gemeinsamen, tenant- und receipt-gesicherten Vertrag. Es wird nichts lokal oder remote als abgeschlossen verbucht.</p>
        <button className="mt-5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white" onClick={onClose}>Schließen</button>
      </section>
    </div>
  );
}
