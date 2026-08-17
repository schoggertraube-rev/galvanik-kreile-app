"use client";

import { useCustomerOverlay } from "./useCustomerOverlay";
import { useOverlayStore } from "@/lib/overlayStore";
import { AppOverlayPortal } from "@/components/ui/AppOverlayPortal";

const NOT_AVAILABLE_MESSAGE = "NOT_AVAILABLE: Die Kundenakte benötigt einen tenant- und ownership-geprüften W3-Read-/Command-Vertrag.";

export function CustomerOverlay() {
  const { customerId, isOpen, close } = useCustomerOverlay();
  const stack = useOverlayStore((state) => state.stack);

  if (!isOpen) return null;

  const stackIndex = stack.findLastIndex((item) => item.type === "customer" && item.id === customerId);
  const zIndex = 1000 + stackIndex * 10;

  return (
    <AppOverlayPortal>
      <div className="fixed inset-0 z-[1000]">
        <button
          aria-label="Kundenakte schließen"
          className="absolute inset-0 h-full w-full cursor-default bg-black/35 backdrop-blur-sm"
          data-testid="customer-overlay-backdrop"
          onClick={close}
          type="button"
        />
        <div className="relative h-full w-full flex items-center justify-center p-0 sm:p-3" style={{ zIndex }}>
          <section
            aria-label="Kundenakte nicht verfügbar"
            className="relative flex w-full max-w-xl flex-col gap-6 bg-[var(--ci-surface)] p-6 shadow-lg sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              aria-label="Kundenakte schließen"
              className="self-end rounded-full p-2 hover:bg-[var(--ci-bg)]"
              onClick={close}
              type="button"
            >
              ×
            </button>
            <p>{NOT_AVAILABLE_MESSAGE}</p>
          </section>
        </div>
      </div>
    </AppOverlayPortal>
  );
}
