"use client";

import { AppOverlayPortal } from "@/components/ui/AppOverlayPortal";
import { useOverlayStore } from "@/lib/overlayStore";

const TITLES: Record<string, string> = {
  order: "Auftragsdetail",
  customer: "Kundendetail",
  item: "Teildetail",
  invoice: "Rechnungsdetail",
  payment: "Zahlungsdetail",
};

/**
 * Stops legacy global drawers from creating an unverified second data path.
 * It intentionally reads no business data and exposes no mutation controls.
 */
export function FoundationOverlayGate() {
  const activeOverlay = useOverlayStore((state) => state.stack.at(-1));
  const pop = useOverlayStore((state) => state.pop);

  if (!activeOverlay) return null;

  const title = TITLES[activeOverlay.type] || "Detailansicht";
  return (
    <AppOverlayPortal>
      <div className="fixed inset-0 z-[1100]">
        <button aria-label="Schließen" className="absolute inset-0 h-full w-full cursor-default bg-black/35 backdrop-blur-sm" onClick={pop} />
        <section className="relative mx-auto mt-[18vh] w-[min(32rem,calc(100%-2rem))] rounded-2xl border border-amber-500/30 bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="foundation-overlay-title">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Datenvertrag noch nicht freigegeben</p>
          <h2 id="foundation-overlay-title" className="mt-2 text-xl font-bold text-navy-900">{title} ist vorübergehend nicht verfügbar</h2>
          <p className="mt-3 text-sm leading-relaxed text-text-muted">
            Die frühere Detailansicht enthielt einen parallelen, nicht vollständig tenant- und receipt-gesicherten Datenpfad. Deshalb werden hier weder Daten noch Aktionen behauptet.
          </p>
          <button type="button" onClick={pop} className="mt-5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white">Schließen</button>
        </section>
      </div>
    </AppOverlayPortal>
  );
}
