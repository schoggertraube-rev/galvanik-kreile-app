"use client";

import { AlertTriangle } from "lucide-react";

export function ErfassungCard(_props: { orderId: string; tenantId?: string }) {
void _props;
  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-50 p-5 text-sm text-amber-950">
      <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5" /> Zeit- und Verbrauchserfassung nicht freigegeben</div>
      <p className="mt-2">Die frühere Ansicht leitete Buchungen und Vorlagen aus parallelen Browser- und Datenpfaden ab. Bis zu einem gemeinsamen Receipt-Vertrag werden keine Werte angezeigt oder geschrieben.</p>
    </section>
  );
}
