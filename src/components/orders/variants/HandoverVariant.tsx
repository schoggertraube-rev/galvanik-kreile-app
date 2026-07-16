'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, PackageCheck, Truck } from 'lucide-react';
import { completeOrderHandover, type HandoverReceipt } from '@/features/orders/shipment.actions';
import { Button } from '@/components/ui/button';

interface HandoverVariantProps {
  orderId: string;
  customerName: string;
}

export function HandoverVariant({ orderId, customerName }: HandoverVariantProps) {
  const requestId = useRef<string | null>(null);
  const [method, setMethod] = useState<'' | 'shipment' | 'pickup'>('');
  const [carrier, setCarrier] = useState('');
  const [recipient, setRecipient] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<HandoverReceipt | null>(null);

  const canSubmit = confirmed && reference.trim().length > 0
    && (method === 'shipment' ? carrier.trim().length > 0 : method === 'pickup' && recipient.trim().length > 0);

  const handleComplete = async () => {
    if (!canSubmit || method === '') return;
    if (!requestId.current) requestId.current = crypto.randomUUID();
    setSubmitting(true);
    setError(null);
    try {
      const result = await completeOrderHandover({
        orderId,
        clientRequestId: requestId.current,
        method,
        reference,
        ...(method === 'shipment' ? { carrier } : { recipient }),
        ...(note.trim() ? { note } : {}),
        confirmed: true,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setReceipt(result.data);
      window.dispatchEvent(new Event('kreile-orders-updated'));
    } catch (transportError) {
      setError(transportError instanceof Error
        ? `Bestätigung unklar: ${transportError.message}. Mit denselben Eingaben erneut versuchen.`
        : 'Bestätigung unklar. Mit denselben Eingaben erneut versuchen.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-gray-300 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start gap-3">
        <PackageCheck className="mt-0.5 h-5 w-5 text-navy-900" />
        <div>
          <h3 className="font-serif text-base font-bold text-navy-900">Physische Übergabe bestätigen</h3>
          <p className="text-xs text-text-muted">Auftrag für {customerName}. Der Beleg beendet ausschließlich den real gestarteten Warenausgang.</p>
        </div>
      </div>

      {receipt ? (
        <div role="status" className="rounded-xl border border-green-300 bg-green-50 p-4 text-sm text-green-900">
          <div className="flex items-center gap-2 font-bold"><CheckCircle2 className="h-4 w-4" /> Übergabe dauerhaft bestätigt</div>
          <p className="mt-1">Beleg {receipt.reference} · {new Date(receipt.confirmedAt).toLocaleString('de-DE')}</p>
          {receipt.replayed && <p className="mt-1 text-xs">Bereits bestätigter Request wurde sicher wiederholt.</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-bold text-navy-900">Tatsächliche Übergabeart</legend>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-gray-300 p-3 text-sm font-semibold">
              <input type="radio" name={`handover-${orderId}`} checked={method === 'shipment'} disabled={submitting} onChange={() => setMethod('shipment')} />
              <Truck className="h-4 w-4" /> Versand / Spedition
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-gray-300 p-3 text-sm font-semibold">
              <input type="radio" name={`handover-${orderId}`} checked={method === 'pickup'} disabled={submitting} onChange={() => setMethod('pickup')} />
              <PackageCheck className="h-4 w-4" /> Selbstabholung
            </label>
          </fieldset>

          {method === 'shipment' && (
            <label className="block text-sm font-bold text-navy-900">
              Tatsächlicher Frachtführer
              <input value={carrier} disabled={submitting} onChange={(event) => setCarrier(event.target.value)} maxLength={80} className="mt-1 w-full rounded-xl border border-neutral-gray-300 px-3 py-2 font-normal" placeholder="z. B. DHL, Spedition Muster" />
            </label>
          )}
          {method === 'pickup' && (
            <label className="block text-sm font-bold text-navy-900">
              Tatsächlicher Abholer
              <input value={recipient} disabled={submitting} onChange={(event) => setRecipient(event.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-neutral-gray-300 px-3 py-2 font-normal" placeholder="Vor- und Nachname" />
            </label>
          )}
          {method !== '' && (
            <>
              <label className="block text-sm font-bold text-navy-900">
                Belegreferenz
                <input value={reference} disabled={submitting} onChange={(event) => setReference(event.target.value)} maxLength={120} className="mt-1 w-full rounded-xl border border-neutral-gray-300 px-3 py-2 font-normal" placeholder="Tracking-, Frachtbrief- oder Abholschein-Nr." />
              </label>
              <label className="block text-sm font-bold text-navy-900">
                Notiz (optional)
                <textarea value={note} disabled={submitting} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} className="mt-1 w-full rounded-xl border border-neutral-gray-300 px-3 py-2 font-normal" />
              </label>
              <label className="flex items-start gap-2 rounded-xl bg-bg-app-soft p-3 text-sm text-navy-900">
                <input type="checkbox" checked={confirmed} disabled={submitting} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5" />
                Ich bestätige, dass die Ware physisch übergeben wurde und die Belegreferenz geprüft ist.
              </label>
            </>
          )}

          <p className="text-xs text-text-muted">Carrier-Buchung, Labeldruck und Kundenmail sind nicht automatisch angebunden und werden hier nicht als ausgeführt markiert.</p>
          {error && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm font-semibold text-red-900">{error}</p>}
          <Button type="button" onClick={handleComplete} disabled={!canSubmit || submitting} className="bg-navy-900 text-white">
            {submitting ? 'Beleg wird bestätigt …' : 'Übergabe atomar abschließen'}
          </Button>
        </div>
      )}
    </section>
  );
}
