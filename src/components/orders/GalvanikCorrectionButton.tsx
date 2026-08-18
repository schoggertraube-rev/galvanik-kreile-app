"use client";

import { useRef, useState } from "react";
import {
  getGalvanikOrdersAction,
  getOrderStationCorrectionReceiptAction,
  getWareneingangOrdersAction,
  type WarendurchlaufOrder,
} from "@/app/warendurchlauf/actions";
import { correctGalvanikToWareneingangAction } from "@/app/actions/orders.actions";
import { ORDER_LIFECYCLE_STATUS } from "@/lib/orders/orderLifecycleContract";

type Props = {
  orderId: string;
  expectedVersion: number;
  onConfirmedReadback: (nextGalvanikOrders: WarendurchlaufOrder[]) => void;
  onConflictReadback?: (nextGalvanikOrders: WarendurchlaufOrder[], message: string) => void;
};

const REASON_MIN_LENGTH = 5;
const REASON_MAX_LENGTH = 500;
const UNCONFIRMED_MESSAGE = "Rücknahme wurde nicht bestätigt; erneut prüfen.";

function normalizedReason(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length < REASON_MIN_LENGTH || trimmed.length > REASON_MAX_LENGTH) return null;
  return trimmed;
}

export function GalvanikCorrectionButton({
  orderId,
  expectedVersion,
  onConfirmedReadback,
  onConflictReadback,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const clientEventRef = useRef<{
    orderId: string;
    expectedVersion: number;
    reason: string;
    id: string;
  } | null>(null);

  function stableClientEventId(trimmedReason: string): string {
    if (
      !clientEventRef.current
      || clientEventRef.current.orderId !== orderId
      || clientEventRef.current.expectedVersion !== expectedVersion
      || clientEventRef.current.reason !== trimmedReason
    ) {
      clientEventRef.current = {
        orderId,
        expectedVersion,
        reason: trimmedReason,
        id: globalThis.crypto.randomUUID(),
      };
    }
    return clientEventRef.current.id;
  }

  async function handleCorrect() {
    if (pending) return;

    const trimmedReason = normalizedReason(reason);
    if (trimmedReason === null) {
      setValidationError(
        `Begründung der Korrektur muss zwischen ${REASON_MIN_LENGTH} und ${REASON_MAX_LENGTH} Zeichen lang sein.`,
      );
      return;
    }
    setValidationError(null);

    setPending(true);
    setMessage(null);
    try {
      const clientEventId = stableClientEventId(trimmedReason);
      const command = await correctGalvanikToWareneingangAction({
        orderId,
        expectedVersion,
        clientEventId,
        reason: trimmedReason,
      });

      if (command.code === "CONFLICT") {
        try {
          const targetRead = await getGalvanikOrdersAction();
          if (targetRead.ok) onConflictReadback?.(targetRead.data, command.message);
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
        receiptRead = await getOrderStationCorrectionReceiptAction({ orderId, clientEventId });
      } catch {
        setMessage(UNCONFIRMED_MESSAGE);
        return;
      }

      if (!sourceRead.ok || !targetRead.ok || !receiptRead.ok || !receiptRead.data) {
        setMessage(UNCONFIRMED_MESSAGE);
        return;
      }

      const sourceOrder = sourceRead.data.find((order) => order.id === orderId);
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
        persistedReceipt.occurredAt === command.receipt.occurredAt &&
        persistedReceipt.reason === command.receipt.reason;
      const confirmed =
        !targetRead.data.some((order) => order.id === orderId) &&
        sourceOrder?.station === "wareneingang" &&
        sourceOrder.currentStationId === "wareneingang" &&
        sourceOrder.status === ORDER_LIFECYCLE_STATUS.ANGENOMMEN &&
        command.receipt.clientEventId === clientEventId &&
        command.receipt.reason === trimmedReason &&
        command.receipt.aggregateVersion === expectedVersion + 1 &&
        sourceOrder.version === command.receipt.aggregateVersion &&
        receiptConfirmed;

      if (!confirmed) {
        setMessage(UNCONFIRMED_MESSAGE);
        return;
      }

      onConfirmedReadback(targetRead.data);
      setMessage("Rücknahme nach Wareneingang bestätigt.");
      setOpen(false);
      setReason("");
    } catch {
      setMessage("Korrektur ist derzeit nicht verfügbar.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-2" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-md border border-[#c0392b]/40 bg-white px-3 py-1.5 text-xs font-semibold text-[#c0392b] min-h-[36px]"
        >
          Zurück nach Wareneingang
        </button>
        {message ? <p className="mt-1 text-xs text-[#5e5850]" role="status">{message}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2" onClick={(event) => event.stopPropagation()}>
      <label htmlFor={`galvanik-correction-reason-${orderId}`} className="text-xs font-semibold text-[#5e5850]">
        Begründung der Korrektur
      </label>
      <textarea
        id={`galvanik-correction-reason-${orderId}`}
        value={reason}
        maxLength={REASON_MAX_LENGTH}
        onChange={(event) => {
          setReason(event.target.value);
          setValidationError(null);
        }}
        className="min-h-[72px] rounded-md border border-[#d8d0c4] px-3 py-2 text-xs"
        placeholder="Warum muss der Auftrag zurück in den Wareneingang?"
      />
      {validationError ? (
        <p className="text-xs text-[#c0392b]" role="alert">{validationError}</p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleCorrect}
          disabled={pending}
          className="rounded-md bg-[#c0392b] px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 min-h-[36px]"
        >
          {pending ? "Korrektur wird geprüft..." : "Korrektur bestätigen"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setValidationError(null);
          }}
          disabled={pending}
          className="rounded-md border border-[#d8d0c4] px-3 py-1.5 text-xs font-semibold text-[#5e5850] min-h-[36px]"
        >
          Abbrechen
        </button>
      </div>
      {message ? <p className="text-xs text-[#5e5850]" role="status">{message}</p> : null}
    </div>
  );
}
