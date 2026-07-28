"use client";

import { X } from "lucide-react";

export function PaymentDrawer({ onClose }: { orderData: unknown; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center bg-[rgba(26,31,46,0.42)] px-4 pt-12" onClick={onClose}>
      <section className="w-full max-w-[560px] rounded-[18px] border border-[var(--ci-border)] bg-[var(--ci-surface)] p-6 shadow-lg" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium text-[var(--ci-ink)]">Zahlung ist noch nicht freigegeben</h2>
            <p className="mt-2 text-sm text-[var(--ci-ink-3)]">Es wird kein Zahlungslink, QR-Code oder Status erzeugt, bis Auftrag, Kunde, Anbieterantwort und Receipt gemeinsam geprüft sind.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--ci-ink-3)] hover:bg-[var(--ci-surface-soft)]" aria-label="Schließen"><X className="h-5 w-5" /></button>
        </div>
      </section>
    </div>
  );
}
