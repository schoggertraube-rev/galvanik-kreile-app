"use client";

import { AlertTriangle, FileJson, Server } from "lucide-react";
import { useSync } from "@/lib/offline/SyncContext";

export function BackupRestoreCenter() {
  const { outboxItems } = useSync();
  const outboxCount = outboxItems.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex flex-col justify-between rounded-3xl border-2 border-neutral-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-blue-100 p-3 text-blue-700">
              <Server size={24} />
            </div>
            <div>
              <h3 className="font-bold text-navy-900">Datenbank</h3>
              <p className="text-xs font-bold text-text-muted">Sicherungsstatus nicht verfügbar</p>
            </div>
          </div>
          <p className="text-sm text-text-muted">Kein verifizierter Statusvertrag angebunden.</p>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border-2 border-neutral-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-purple-100 p-3 text-purple-700">
              <FileJson size={24} />
            </div>
            <div>
              <h3 className="font-bold text-navy-900">Storage (Dateien)</h3>
              <p className="text-xs font-bold text-text-muted">Sicherungsstatus nicht verfügbar</p>
            </div>
          </div>
          <p className="text-sm text-text-muted">Kein verifizierter Statusvertrag angebunden.</p>
        </div>

        <div className="flex flex-col justify-between rounded-3xl border-2 border-neutral-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-2xl bg-gray-100 p-3 text-gray-500">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-navy-900">Lokale Outbox</h3>
              <p className="text-xs font-bold text-text-muted">
                {outboxCount} {outboxCount === 1 ? "Eintrag" : "Einträge"} lokal vorhanden
              </p>
            </div>
          </div>
          <p className="text-sm text-text-muted">
            Dies ist keine Bestätigung einer Sicherung oder Synchronisierung.
          </p>
        </div>
      </div>

      <div className="space-y-8 rounded-3xl border-2 border-neutral-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="mb-2 text-xl font-bold text-navy-900">Sicherung nicht verfügbar</h2>
          <p className="mb-4 max-w-2xl text-sm text-text-muted">
            Kein verifizierter Exportvertrag ist angebunden und es wurde keine Sicherung erstellt.
          </p>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 rounded-xl bg-neutral-gray-200 px-6 py-3 font-bold text-text-muted"
          >
            Sicherung nicht verfügbar
          </button>
        </div>

        <div className="border-t border-neutral-gray-200 pt-8">
          <h2 className="mb-2 text-xl font-bold text-danger-red">Wiederherstellung nicht verfügbar</h2>
          <p className="mb-4 max-w-2xl text-sm text-text-muted">
            Kein verifizierter Wiederherstellungsvertrag ist angebunden, keine Datei ist ausgewählt und es werden keine Daten geändert.
          </p>
          <button
            type="button"
            disabled
            className="flex items-center gap-2 rounded-xl border-2 border-neutral-gray-200 bg-neutral-gray-100 px-6 py-3 font-bold text-text-muted"
          >
            Wiederherstellung nicht verfügbar
          </button>
        </div>
      </div>
    </div>
  );
}
