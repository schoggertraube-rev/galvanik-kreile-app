"use client";

import { Search, X } from "lucide-react";

/**
 * The legacy search mixed browser RPCs, unscoped direct table queries, and
 * navigation to disabled product areas.  Do not turn a missing result into a
 * claim that nothing exists; a server-side tenant/evidence contract must be
 * released before global search returns.
 */
export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (value: boolean) => void }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-200 flex items-start justify-center bg-navy-900/40 px-4 pt-[15vh]"
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <section
        aria-labelledby="global-search-unavailable-title"
        className="w-full max-w-xl rounded-2xl border border-neutral-gray-100 bg-white p-6 text-navy-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <Search className="mt-0.5 h-5 w-5 text-text-muted" aria-hidden="true" />
            <div>
              <h2 id="global-search-unavailable-title" className="font-bold">Globale Suche ist noch nicht freigegeben</h2>
              <p className="mt-1 text-sm text-text-muted">
                Die frühere Suche konnte Daten ohne belegten Mandanten- und Berechtigungsvertrag abfragen. Sie zeigt deshalb keine scheinbar vollständigen Treffer an.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-text-muted hover:bg-neutral-gray-100"
            aria-label="Suche schließen"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>
    </div>
  );
}
