"use client";

import { useRef, useState } from "react";
import {
  getGalvanikOrdersAction,
  getOrderStationReceiptAction,
  getWareneingangOrdersAction,
  type WarendurchlaufOrder,
} from "@/app/warendurchlauf/actions";
import { transitionWareneingangToGalvanikAction } from "@/app/actions/orders.actions";
import { ORDER_LIFECYCLE_STATUS } from "@/lib/orders/orderLifecycleContract";

type Props = {
  orderId: string;
  expectedVersion: number;
  onConfirmedReadback: (nextWeOrders: WarendurchlaufOrder[]) => void;
  onConflictReadback?: (nextWeOrders: WarendurchlaufOrder[], message: string) => void;
};

const UNCONFIRMED_MESSAGE = "Übergabe wurde nicht bestätigt; erneut prüfen.";

export function WareneingangHandoffButton({
  orderId,
  expectedVersion,
  onConfirmedReadback,
  onConflictReadback,
}: Props) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const clientEventRef = useRef<{ orderId: string; expectedVersion: number; id: string } | null>(null);

  function stableClientEventId(): string {
    if (
      !clientEventRef.current
      || clientEventRef.current.orderId !== orderId
      || clientEventRef.current.expectedVersion !== expectedVersion
    ) {
      clientEventRef.current = { orderId, expectedVersion, id: globalThis.crypto.randomUUID() };
    }
    return clientEventRef.current.id;
  }

  async function handleHandoff() {
    if (pending) return;

    setPending(true);
    setMessage(null);
    try {
      const clientEventId = stableClientEventId();
      const command = await transitionWareneingangToGalvanikAction({
        orderId,
        expectedVersion,
        clientEventId,
      });

      if (command.code === "CONFLICT") {
        try {
          const sourceRead = await getWareneingangOrdersAction();
          if (sourceRead.ok) onConflictReadback?.(sourceRead.data, command.message);
        } catch {
          // The conflict remains truthful even when its optional refresh fails.
        }
        setMessage(command.message);
        return;
      }

      if (command.code !== "OK") {
        setMessage(command.message);
        return;
      }

      let sourceRead;
      let targetRead;
      let receiptRead;
      try {
        sourceRead = await getWareneingangOrdersAction();
        targetRead = await getGalvanikOrdersAction();
        receiptRead = await getOrderStationReceiptAction({ orderId, clientEventId });
      } catch {
        setMessage(UNCONFIRMED_MESSAGE);
        return;
      }

      if (!sourceRead.ok || !targetRead.ok || !receiptRead.ok || !receiptRead.data) {
        setMessage(UNCONFIRMED_MESSAGE);
        return;
      }

      const targetOrder = targetRead.data.find((order) => order.id === orderId);
      const persistedReceipt = receiptRead.data;
      const receiptConfirmed =
        persistedReceipt.eventId === command.receipt.eventId &&
        persistedReceipt.clientEventId === command.receipt.clientEventId &&
        persistedReceipt.correlationId === command.receipt.correlationId &&
        persistedReceipt.eventSchemaVersion === command.receipt.eventSchemaVersion &&
        persistedReceipt.orderId === command.receipt.orderId &&
        persistedReceipt.aggregateVersion === command.receipt.aggregateVersion &&
        persistedReceipt.fromStation === command.receipt.fromStation &&
        persistedReceipt.toStation === command.receipt.toStation &&
        persistedReceipt.actorId === command.receipt.actorId &&
        persistedReceipt.occurredAt === command.receipt.occurredAt;
      const confirmed =
        !sourceRead.data.some((order) => order.id === orderId) &&
        targetOrder?.station === "galvanik" &&
        targetOrder.currentStationId === "galvanik" &&
        targetOrder.status === ORDER_LIFECYCLE_STATUS.GALVANIK &&
        command.receipt.clientEventId === clientEventId &&
        command.receipt.aggregateVersion === expectedVersion + 1 &&
        targetOrder.version === command.receipt.aggregateVersion &&
        receiptConfirmed;

      if (!confirmed) {
        setMessage(UNCONFIRMED_MESSAGE);
        return;
      }

      onConfirmedReadback(sourceRead.data);
      setMessage("Übergabe an Galvanik bestätigt.");
    } catch {
      setMessage("Übergabe ist derzeit nicht verfügbar.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2" data-testid="wareneingang-handoff" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={handleHandoff}
        disabled={pending}
        className="rounded-md bg-success-green px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Übergabe wird geprüft..." : "An Galvanik übergeben"}
      </button>
      {message ? <p className="mt-1 text-xs text-[#5e5850]" role="status">{message}</p> : null}
    </div>
  );
}
