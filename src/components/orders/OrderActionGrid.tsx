"use client";

import { AlertTriangle } from "lucide-react";

export function OrderActionGrid(_props: {
  orderId: string;
  customerId?: string;
  currentStationId: string;
  currentStatus: string;
  customerPhone?: string;
  onCompleteStation?: () => void;
  onPrint?: () => void;
}) {
void _props;
  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-50 p-5 text-sm text-amber-950">
      <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-5 w-5" /> Auftragsaktionen sind noch nicht freigegeben</div>
      <p className="mt-2">Fotos, Druck, Nacharbeit, Storno und Stationswechsel werden erst mit ihren belegten Server- und Receipt-Verträgen wieder angeboten.</p>
    </section>
  );
}
