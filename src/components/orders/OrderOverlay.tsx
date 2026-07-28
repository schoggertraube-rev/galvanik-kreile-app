"use client";

import { AlertTriangle, X } from "lucide-react";

import { AppOverlayPortal } from "@/components/ui/AppOverlayPortal";
import { useOverlayStore } from "@/lib/overlayStore";

/**
 * The former overlay uploaded to storage and opened mail/payment flows directly
 * from the browser.  It must not turn an unavailable contract into a local
 * action surface while the canonical order detail is being rebuilt.
 */
export function OrderOverlay() {
  const orderStack = useOverlayStore((state) => state.orderStack);
  const popOrder = useOverlayStore((state) => state.popOrder);
  const currentOrderId = orderStack.at(-1);

  if (!currentOrderId) return null;

  return (
    <AppOverlayPortal>
      <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" role="presentation" onClick={popOrder}>
        <section className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg" onClick={(event) => event.stopPropagation()} aria-labelledby="order-overlay-unavailable-title">
          <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-amber-600" aria-hidden="true" />
          <h2 id="order-overlay-unavailable-title" className="text-lg font-semibold text-slate-900">Auftragsdetail ist noch nicht freigegeben</h2>
          <p className="mt-2 text-sm text-slate-600">
            Foto-Upload, Status-Mail, Zahlung und Versand bleiben geschlossen, bis jeder Schritt einen tenantgebundenen Server- und Receipt-Vertrag besitzt.
          </p>
          <button type="button" onClick={popOrder} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            <X className="h-4 w-4" aria-hidden="true" /> Schließen
          </button>
        </section>
      </div>
    </AppOverlayPortal>
  );
}
