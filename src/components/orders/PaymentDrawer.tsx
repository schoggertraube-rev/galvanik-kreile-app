import React, { useState } from 'react';
import Image from 'next/image';
import { X, CreditCard, ExternalLink, QrCode } from 'lucide-react';
import { paymentProvider } from '@/lib/payments/mollieAdapter';

export function PaymentDrawer({ orderData, onClose }: { orderData: any, onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalValue = (orderData.priceLines || []).reduce((sum: number, line: any) => sum + Number(line.unitTotalEur || 0), 0);

  const handleGenerateLink = async () => {
    setLoading(true);
    setError(null);
    const res = await paymentProvider.createPaymentIntent({
      amountEur: totalValue,
      description: `Auftrag ${orderData.orderNumber || orderData.id}`,
      orderId: orderData.id,
      customerId: orderData.customerId
    });

    if (res.success && res.checkoutUrl) {
      setCheckoutUrl(res.checkoutUrl);
    } else {
      setError(res.error || "Unbekannter Fehler bei der Mollie-Verbindung");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-[rgba(26,31,46,0.42)] backdrop-blur-[8px] flex items-start justify-center pt-12 pb-12 overflow-y-auto" onClick={onClose}>
      <div className="w-full max-w-[560px] mx-4 bg-[var(--ci-surface)] rounded-[18px] border border-[var(--ci-border)] shadow-[0_1px_2px_rgba(20,15,5,0.04),0_12px_32px_rgba(20,15,5,0.08)]" onClick={e => e.stopPropagation()}>
        
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

          {!checkoutUrl && (
            <div className="space-y-3">
              <button 
                onClick={handleGenerateLink} 
                disabled={loading || totalValue === 0}
                className="w-full flex items-center justify-center gap-2 bg-[var(--ci-ink)] text-[var(--ci-surface)] py-3 rounded-xl font-medium hover:bg-opacity-90 disabled:opacity-50 transition-all"
              >
                {loading ? "Generiere..." : <><QrCode className="w-5 h-5"/> Mollie QR-Code generieren</>}
              </button>

              <button 
                disabled 
                className="w-full flex items-center justify-center gap-2 bg-transparent border-2 border-dashed border-[var(--ci-border)] text-[var(--ci-ink-3)] py-3 rounded-xl font-medium cursor-not-allowed"
                title="Folgt in Kürze via Terminal"
              >
                <CreditCard className="w-5 h-5"/> Tap-to-Pay (NFC) bald verfügbar
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 bg-[var(--ci-danger-soft)] text-[var(--ci-danger)] rounded-xl text-sm border border-red-200">
              {error}
            </div>
          )}

          {checkoutUrl && (
            <div className="space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="p-4 bg-white rounded-xl border border-[var(--ci-border)] flex items-center justify-center">
                {/* Fallback QR if no library used, just showing a placeholder or linking to a free API for now */}
                <Image src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(checkoutUrl)}`} alt="Zahlung QR Code" width={200} height={200} unoptimized className="w-48 h-48"/>
              </div>
              <p className="text-center text-sm text-[var(--ci-ink-3)]">
                Kunde scannt den Code mit seinem Smartphone.
              </p>
              <a 
                href={checkoutUrl} 
                target="_blank" 
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 bg-[var(--ci-surface)] border border-[var(--ci-border)] text-[var(--ci-ink)] py-3 rounded-xl font-medium hover:bg-[var(--ci-surface-soft)] transition-colors"
              >
                Link auf diesem Gerät öffnen <ExternalLink className="w-4 h-4"/>
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
