"use client";

import { AlertTriangle } from "lucide-react";

interface WareneingangActiveProps {
  orderId: string;
}

/**
 * This legacy detail component has no source-backed expected state to submit
 * to the canonical CAS transition. It must not send a blind process command.
 */
export function WareneingangActive(_props: WareneingangActiveProps) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Prozessaktion nicht freigegeben</div>
      <p className="mt-2">Der Prozessschritt benötigt einen belegten aktuellen Stations- und Statuswert. Diese Detailaktion bleibt bis zum neuen Detailvertrag geschlossen.</p>
    </div>
  );
}
