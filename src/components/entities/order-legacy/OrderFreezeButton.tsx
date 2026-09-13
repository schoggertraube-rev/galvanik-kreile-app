"use client";

import { useRef, useState } from "react";
import {
  freezeOrderAction,
  getLiveOrderCardAction,
  getOrderFrozenReceiptAction,
} from "@/app/actions/orders.actions";
import type { LiveOrderCard } from "@/lib/server/orderCardRead";
import type { OrderFrozenReceipt } from "@/lib/server/commands/orderFreezeCommand";

type Props = {
  order: LiveOrderCard;
  rateConfigured: boolean;
  onConfirmedCard: (card: LiveOrderCard) => void;
};

function sameReceipt(left: OrderFrozenReceipt, right: OrderFrozenReceipt): boolean {
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
    && left.freezeId === right.freezeId
    && left.rateId === right.rateId
    && left.hourlyRateCents === right.hourlyRateCents
    && left.totalAmountCents === right.totalAmountCents
    && left.lineCount === right.lineCount
    && left.frozenAt === right.frozenAt
    && JSON.stringify(left.lines) === JSON.stringify(right.lines);
}

export function OrderFreezeButton({ order, rateConfigured, onConfirmedCard }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const stableRequest = useRef<{
    orderId: string;
    expectedVersion: number;
    freezeId: string;
    clientEventId: string;
  } | null>(null);

  function request() {
    if (
      !stableRequest.current
      || stableRequest.current.orderId !== order.id
      || stableRequest.current.expectedVersion !== order.version
    ) {
      stableRequest.current = {
        orderId: order.id,
        expectedVersion: order.version,
        freezeId: globalThis.crypto.randomUUID(),
        clientEventId: globalThis.crypto.randomUUID(),
      };
    }
    return stableRequest.current;
  }

  async function finish() {
    if (pending || !rateConfigured) return;
    const stable = request();
    setPending(true);
    setMessage(null);
    try {
      const command = await freezeOrderAction({
        orderId: order.id,
        freezeId: stable.freezeId,
        expectedVersion: order.version,
        clientEventId: stable.clientEventId,
      });
      if (command.code !== "OK") {
        setMessage(command.message);
        return;
      }
      const [receiptRead, cardRead] = await Promise.all([
        getOrderFrozenReceiptAction({ orderId: order.id, clientEventId: stable.clientEventId }),
        getLiveOrderCardAction({ orderId: order.id }),
      ]);
      if (
        receiptRead.code !== "OK"
        || !receiptRead.data
        || !sameReceipt(command.receipt, receiptRead.data)
        || cardRead.code !== "OK"
        || cardRead.data.card.station !== "fertig"
        || cardRead.data.card.status !== "fertig"
        || cardRead.data.card.version !== command.receipt.aggregateVersion
        || cardRead.data.card.freeze?.freezeId !== command.receipt.freezeId
        || cardRead.data.card.freeze.totalAmountCents !== command.receipt.totalAmountCents
      ) {
        setMessage("Fertig-Abschluss wurde nicht bestätigt; Auftragskarte neu laden.");
        return;
      }
      stableRequest.current = null;
      setConfirming(false);
      onConfirmedCard(cardRead.data.card);
      setMessage("Fertig-Abschluss und Mehrarbeits-Freeze bestätigt.");
    } catch {
      setMessage("Fertig-Abschluss ist derzeit nicht verfügbar.");
    } finally {
      setPending(false);
    }
  }

  if (order.freeze) {
    return (
      <div className="rounded-xl border border-success-green/30 bg-success-green/10 p-4" data-testid="order-freeze-panel">
        <p className="text-sm font-semibold text-success-green">Fertig-Abschluss bestätigt</p>
        <p className="mt-1 text-xs text-text-muted">
          {order.freeze.lineCount} Mehrarbeitspositionen ·{" "}
          {(order.freeze.totalAmountCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
        </p>
        {message ? <p className="mt-2 text-xs text-text-muted" role="status">{message}</p> : null}
      </div>
    );
  }

  if (order.station !== "galvanik" || order.status !== "galvanik") return null;

  return (
    <div className="rounded-xl border border-neutral-gray-200 bg-bg-app-soft p-4" data-testid="order-freeze-panel">
      {!rateConfigured ? (
        <p className="text-sm text-[#c0392b]" role="status">
          Vor dem Fertig-Abschluss muss ein Admin den Stundensatz konfigurieren.
        </p>
      ) : !confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="min-h-11 rounded-lg bg-success-green px-5 text-sm font-semibold text-white"
        >
          Auftrag fertigsetzen
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-navy-900">
            Auftrag und alle Mehrarbeitsbeträge unveränderlich einfrieren?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => void finish()}
              className="min-h-11 rounded-lg bg-success-green px-5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pending ? "Beleg wird geprüft…" : "Fertig verbindlich bestätigen"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirming(false)}
              className="min-h-11 rounded-lg border border-neutral-gray-200 bg-white px-5 text-sm font-semibold text-navy-900"
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
