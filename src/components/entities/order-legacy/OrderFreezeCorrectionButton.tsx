"use client";

import { useRef, useState } from "react";
import {
  getLiveOrderCardAction,
  getOrderFreezeCorrectionReceiptAction,
  reopenFrozenOrderAction,
} from "@/app/actions/orders.actions";
import type { OrderFreezeCorrectionReceipt } from "@/lib/server/commands/orderFreezeCorrectionCommand";
import type { LiveOrderCard } from "@/lib/server/orderCardRead";

type Props = {
  order: LiveOrderCard;
  role: string | null;
  onConfirmedCard: (card: LiveOrderCard) => void;
};

function sameReceipt(
  left: OrderFreezeCorrectionReceipt,
  right: OrderFreezeCorrectionReceipt,
): boolean {
  return left.eventId === right.eventId
    && left.clientEventId === right.clientEventId
    && left.correlationId === right.correlationId
    && left.eventSchemaVersion === right.eventSchemaVersion
    && left.orderId === right.orderId
    && left.aggregateVersion === right.aggregateVersion
    && left.fromStation === right.fromStation
    && left.toStation === right.toStation
    && left.actorId === right.actorId
    && left.occurredAt === right.occurredAt
    && left.correctionId === right.correctionId
    && left.freezeId === right.freezeId
    && left.correctedFreezeVersion === right.correctedFreezeVersion
    && left.reason === right.reason
    && left.correctedAt === right.correctedAt;
}

export function OrderFreezeCorrectionButton({ order, role, onConfirmedCard }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stableRequest = useRef<{ key: string; clientEventId: string } | null>(null);
  const allowed = role === "meister" || role === "admin";

  if (!allowed || !order.freeze || order.station !== "fertig" || order.status !== "fertig") {
    return null;
  }

  async function correctFreeze() {
    if (pending || !order.freeze) return;
    const normalizedReason = reason.trim();
    if (normalizedReason.length < 5 || normalizedReason.length > 500) {
      setMessage("Begründung muss 5 bis 500 Zeichen enthalten.");
      return;
    }
    const key = JSON.stringify({ version: order.version, freezeId: order.freeze.freezeId, reason: normalizedReason });
    if (stableRequest.current?.key !== key) {
      stableRequest.current = { key, clientEventId: globalThis.crypto.randomUUID() };
    }
    const clientEventId = stableRequest.current.clientEventId;
    setPending(true);
    setMessage(null);
    try {
      const command = await reopenFrozenOrderAction({
        orderId: order.id,
        expectedVersion: order.version,
        clientEventId,
        reason: normalizedReason,
      });
      if (command.code !== "OK") {
        setMessage(command.message);
        return;
      }
      const [receiptRead, cardRead] = await Promise.all([
        getOrderFreezeCorrectionReceiptAction({ orderId: order.id, clientEventId }),
        getLiveOrderCardAction({ orderId: order.id }),
      ]);
      if (
        receiptRead.code !== "OK"
        || !receiptRead.data
        || !sameReceipt(command.receipt, receiptRead.data)
        || command.receipt.freezeId !== order.freeze.freezeId
        || cardRead.code !== "OK"
        || cardRead.data.card.version !== command.receipt.aggregateVersion
        || cardRead.data.card.station !== "galvanik"
        || cardRead.data.card.status !== "galvanik"
        || cardRead.data.card.freeze !== null
        || cardRead.data.card.items.some((item) => item.extraWork.some((line) => line.frozen))
      ) {
        setMessage("Freeze-Korrektur wurde nicht sicher bestätigt; Auftragskarte neu laden.");
        return;
      }
      stableRequest.current = null;
      setOpen(false);
      setReason("");
      onConfirmedCard(cardRead.data.card);
      setMessage("Freeze-Korrektur und Rückkehr zur Galvanik bestätigt.");
    } catch {
      setMessage("Freeze-Korrektur ist derzeit nicht verfügbar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#c0392b]/30 bg-[#fdf0ee] p-4" data-testid="order-freeze-correction-panel">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-10 rounded-lg border border-[#c0392b]/50 bg-white px-4 text-xs font-semibold text-[#c0392b]"
        >
          Fertig-Abschluss korrigieren
        </button>
      ) : (
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-navy-900">
            Begründung der Korrektur
            <textarea
              aria-label="Begründung der Freeze-Korrektur"
              value={reason}
              disabled={pending}
              minLength={5}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 min-h-24 w-full rounded-lg border border-neutral-gray-200 bg-white p-3 text-sm text-navy-900"
            />
          </label>
          <p className="text-xs text-text-muted">
            Der alte Freeze und sein Beleg bleiben erhalten. Der Auftrag kehrt zur Galvanik zurück.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void correctFreeze()}
              className="min-h-10 rounded-lg bg-[#c0392b] px-4 text-xs font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Korrektur wird geprüft…" : "Korrektur verbindlich ausführen"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => { setOpen(false); setMessage(null); }}
              className="min-h-10 rounded-lg border border-neutral-gray-200 bg-white px-4 text-xs font-semibold text-navy-900"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {message ? <p className="mt-2 text-xs text-text-muted" role="status">{message}</p> : null}
    </div>
  );
}
