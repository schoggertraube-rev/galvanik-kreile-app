"use client";

import { AlertTriangle } from "lucide-react";
import type { VorlageResult } from "./VorschlagBanner";

interface ErfassungSheetProps {
  orderId: string;
  stationKuerzel?: string;
  mode: "zeit" | "material" | "beides";
  vorlage?: VorlageResult;
  onSuccess: () => void;
  onClose: () => void;
}

export function ErfassungSheet({ onClose }: ErfassungSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section className="max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-700" />
        <h2 className="mt-3 text-lg font-bold text-navy-900">Erfassung nicht freigegeben</h2>
        <p className="mt-2 text-sm text-text-muted">Ohne belegten Zeit-, Material-, Kosten- und Receipt-Vertrag kann keine Buchung bestätigt werden.</p>
        <button className="mt-5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white" onClick={onClose}>Schließen</button>
      </section>
    </div>
  );
}
