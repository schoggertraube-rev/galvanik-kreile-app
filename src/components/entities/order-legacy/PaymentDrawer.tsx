import { X } from "lucide-react";

type PaymentLine = {
  unitTotalEur?: number | string | null;
};

type PaymentOrderData = {
  id?: string;
  orderNumber?: string;
  customerId?: string;
  priceLines?: PaymentLine[];
};

export function PaymentDrawer({ orderData, onClose }: { orderData: PaymentOrderData; onClose: () => void }) {
  const totalValue = (orderData.priceLines ?? []).reduce((sum, line) => sum + Number(line.unitTotalEur || 0), 0);

  return (
    <div className="fixed inset-0 z-[1000] bg-[rgba(26,31,46,0.42)] backdrop-blur-[8px] flex items-start justify-center pt-12 pb-12 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-[560px] mx-4 bg-[var(--ci-surface)] rounded-[18px] border border-[var(--ci-border)] shadow-[0_1px_2px_rgba(20,15,5,0.04),0_12px_32px_rgba(20,15,5,0.08)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--ci-border)] bg-[var(--ci-surface)]">
          <h2 className="text-lg font-medium text-[var(--ci-ink)]">Zahlung initiieren</h2>
          <button onClick={onClose} className="p-2 text-[var(--ci-ink-3)] hover:text-[var(--ci-ink)] transition-colors rounded-full hover:bg-[var(--ci-surface-soft)]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-[var(--ci-surface)] border border-[var(--ci-border)] rounded-[14px] p-5">
            <div className="text-[var(--ci-ink-3)] text-xs uppercase tracking-wider mb-1">Offener Betrag</div>
            <div className="font-serif text-3xl text-[var(--ci-ink)]">{totalValue.toFixed(2)} €</div>
          </div>
          <button
            disabled
            title="Nicht verfügbar: sicherer Zahlungs-Command-Vertrag fehlt."
            className="w-full flex items-center justify-center gap-2 bg-[var(--ci-ink)] text-[var(--ci-surface)] py-3 rounded-xl font-medium opacity-50 cursor-not-allowed"
          >
            Mollie QR-Code generieren
          </button>
          <p className="text-sm text-[var(--ci-ink-3)]">
            Zahlungslinks sind bis zum sicheren Server-Command-Vertrag nicht verfügbar.
          </p>
        </div>
      </div>
    </div>
  );
}
