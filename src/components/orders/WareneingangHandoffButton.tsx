"use client";

import { useState } from "react";
import {
  getGalvanikOrdersAction,
  getWareneingangOrdersAction,
  type WarendurchlaufOrder,
} from "@/app/warendurchlauf/actions";
import { transitionWareneingangToGalvanikAction } from "@/app/actions/orders.actions";

type Props = {
  orderId: string;
  expectedVersion: number;
  onConfirmedReadback: (nextWeOrders: WarendurchlaufOrder[]) => void;
  onConflictReadback?: (nextWeOrders: WarendurchlaufOrder[]) => void;
};

const UNCONFIRMED_MESSAGE = "Übergabe wurde nicht bestätigt; bitte Liste neu laden.";

export function WareneingangHandoffButton({
  orderId,
  expectedVersion,
  onConfirmedReadback,
  onConflictReadback,
}: Props) {
  const [pending, setPending] = useState(false);
  const [retryBlocked, setRetryBlocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleHandoff() {
    if (pending || retryBlocked) return;

    setPending(true);
    setMessage(null);
    try {
      const command = await transitionWareneingangToGalvanikAction({ orderId, expectedVersion });

      if (command.code === "CONFLICT") {
        try {
          const sourceRead = await getWareneingangOrdersAction();
          if (sourceRead.ok) onConflictReadback?.(sourceRead.data);
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
      try {
        [sourceRead, targetRead] = await Promise.all([
          getWareneingangOrdersAction(),
          getGalvanikOrdersAction(),
        ]);
      } catch {
        setRetryBlocked(true);
        setMessage(UNCONFIRMED_MESSAGE);
        return;
      }

      if (!sourceRead.ok || !targetRead.ok) {
        setRetryBlocked(true);
        setMessage(UNCONFIRMED_MESSAGE);
        return;
      }

      const targetOrder = targetRead.data.find((order) => order.id === orderId);
      const confirmed =
        !sourceRead.data.some((order) => order.id === orderId) &&
        targetOrder?.station === "galvanik" &&
        targetOrder.currentStationId === "galvanik" &&
        targetOrder.status === "ready" &&
        command.version === expectedVersion + 1 &&
        targetOrder.version === command.version;

      if (!confirmed) {
        setRetryBlocked(true);
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
    <div className="mt-2" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={handleHandoff}
        disabled={pending || retryBlocked}
        className="rounded-md bg-success-green px-3 py-1.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Übergabe wird geprüft..." : "An Galvanik übergeben"}
      </button>
      {message ? <p className="mt-1 text-xs text-[#5e5850]" role="status">{message}</p> : null}
    </div>
  );
}
