"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Compatibility boundary for an old, non-atomic material/time drawer.
 * The real product capability lives in CaptureSheet and returns server receipts.
 */
export function OrderMaterialTimeDrawer({
  orderId,
  onClose,
}: {
  orderId: string;
  customerId?: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end z-50" role="dialog" aria-modal="true" aria-labelledby="retired-material-drawer-title">
      <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-neutral-gray-100">
          <div>
            <h2 id="retired-material-drawer-title" className="text-2xl font-black font-serif text-navy-900">Buchungspfad stillgelegt</h2>
            <p className="text-text-muted text-xs mt-1">Auftrag: {orderId}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-neutral-gray-100 rounded-full" aria-label="Hinweis schließen"><X /></button>
        </div>
        <div className="p-6 text-sm text-navy-900">
          Dieser frühere Einzelbuchungspfad ist deaktiviert, weil er Material und Zeit nicht atomar bestätigen konnte. Verwenden Sie im Auftrag die aktive Erfassung; nur dort werden echte Server-Receipts erzeugt.
        </div>
        <div className="mt-auto p-6 border-t border-neutral-gray-100">
          <Button type="button" onClick={onClose} className="w-full">Schließen und aktive Auftragserfassung verwenden</Button>
        </div>
      </div>
    </div>
  );
}
