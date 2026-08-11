"use client";

import { AppOverlayPortal } from "@/components/ui/AppOverlayPortal";
import { useOverlayStore } from "@/lib/overlayStore";

const ORDER_OVERLAY_READ_NOT_AVAILABLE_MESSAGE =
  "NOT_AVAILABLE: Auftrags-Overlay benötigt einen tenant- und ownership-geprüften W3-Read-Vertrag.";

export function OrderOverlay() {
  const stack = useOverlayStore((state) => state.stack);
  const orderStack = useOverlayStore((state) => state.orderStack);
  const popOrder = useOverlayStore((state) => state.popOrder);
  const currentOrderId = orderStack.at(-1);

  if (!currentOrderId) return null;

  const stackIndex = stack.findLastIndex((item) => item.type === "order" && item.id === currentOrderId);
  const zIndex = stackIndex >= 0 ? 1010 + stackIndex * 10 : 1010;

  return (
    <AppOverlayPortal>
      <div className="fixed inset-0 z-[1000]">
        <button aria-label="Auftrags-Overlay schließen" className="absolute inset-0 h-full w-full cursor-default bg-black/35 backdrop-blur-sm" data-testid="order-overlay-backdrop" onClick={popOrder} type="button" />
        <div className="relative flex h-full w-full items-center justify-center p-0 sm:p-3" style={{ zIndex }}>
          <section aria-label="Auftragsdetail nicht verfügbar" className="relative flex w-full max-w-xl flex-col gap-6 bg-[var(--ci-surface)] p-6 shadow-lg sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
            <button aria-label="Auftrags-Overlay schließen" className="self-end rounded-full p-2 hover:bg-[var(--ci-bg)]" onClick={popOrder} type="button">×</button>
            <p>{ORDER_OVERLAY_READ_NOT_AVAILABLE_MESSAGE}</p>
          </section>
        </div>
      </div>
    </AppOverlayPortal>
  );
}
