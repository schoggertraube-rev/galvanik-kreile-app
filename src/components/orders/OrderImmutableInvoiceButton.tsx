"use client";

import { useRef, useState } from "react";
import {
  getInvoiceReceiptAction,
  issueInvoiceAction,
} from "@/app/actions/invoices.actions";
import type { LiveOrderCard } from "@/lib/server/orderCardRead";
import type { ImmutableInvoiceReceipt } from "@/lib/server/commands/immutableInvoiceCommand";

type Props = {
  order: LiveOrderCard;
};

function sameReceipt(left: ImmutableInvoiceReceipt, right: ImmutableInvoiceReceipt): boolean {
  return left.invoiceId === right.invoiceId
    && left.invoiceNumber === right.invoiceNumber
    && left.orderId === right.orderId
    && left.orderVersion === right.orderVersion
    && left.status === right.status
    && left.netAmountCents === right.netAmountCents
    && left.vatRateBasisPoints === right.vatRateBasisPoints
    && left.vatAmountCents === right.vatAmountCents
    && left.grossAmountCents === right.grossAmountCents
    && left.serviceDate === right.serviceDate
    && left.dueDate === right.dueDate
    && left.issuedAt === right.issuedAt
    && left.issuedBy === right.issuedBy
    && left.pdfRef === right.pdfRef
    && left.pdfSha256 === right.pdfSha256
    && left.eventId === right.eventId
    && left.clientEventId === right.clientEventId
    && left.correlationId === right.correlationId
    && left.aggregateVersion === right.aggregateVersion
    && left.eventSchemaVersion === right.eventSchemaVersion;
}

function formatGross(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function OrderImmutableInvoiceButton({ order }: Props) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ImmutableInvoiceReceipt | null>(null);
  const stableRequest = useRef<{
    orderId: string;
    expectedVersion: number;
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
        clientEventId: globalThis.crypto.randomUUID(),
      };
    }
    return stableRequest.current;
  }

  async function issue() {
    if (pending) return;
    const stable = request();
    setPending(true);
    setMessage(null);
    try {
      const command = await issueInvoiceAction({
        orderId: order.id,
        expectedVersion: order.version,
        clientEventId: stable.clientEventId,
      });
      if (command.code !== "OK") {
        setMessage(command.message);
        return;
      }
      const receiptRead = await getInvoiceReceiptAction({
        orderId: order.id,
        clientEventId: stable.clientEventId,
      });
      if (
        receiptRead.code !== "OK"
        || !receiptRead.data
        || !sameReceipt(command.receipt, receiptRead.data)
      ) {
        setMessage("Rechnung wurde nicht bestätigt; Auftragskarte neu laden.");
        return;
      }
      stableRequest.current = null;
      setReceipt(receiptRead.data);
      setMessage(command.replayed ? "Rechnung war bereits ausgestellt." : "Rechnung wurde unveränderlich ausgestellt.");
    } catch {
      setMessage("Rechnungsausgabe ist derzeit nicht verfügbar.");
    } finally {
      setPending(false);
    }
  }

  if (order.station !== "fertig" || order.status !== "fertig" || !order.freeze) return null;

  return (
    <div className="rounded-xl border border-neutral-gray-200 bg-bg-app-soft p-4" data-testid="order-immutable-invoice-panel">
      {receipt ? (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-success-green">Rechnung {receipt.invoiceNumber} ausgestellt</p>
          <p className="text-xs text-text-muted">
            Brutto {formatGross(receipt.grossAmountCents)} · Beleg {receipt.eventId} · Korrelation {receipt.correlationId}
          </p>
          <a
            href={`/api/invoices/${receipt.invoiceId}/pdf`}
            className="inline-flex min-h-12 items-center text-xs font-semibold text-navy-900 underline"
            data-testid="order-immutable-invoice-pdf-link"
          >
            Rechnung als PDF herunterladen
          </a>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => void issue()}
          className="min-h-12 rounded-lg bg-navy-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Rechnung wird ausgestellt…" : "Unveränderliche Rechnung ausstellen"}
        </button>
      )}
      {message ? <p className="mt-2 text-xs text-text-muted" role="status">{message}</p> : null}
    </div>
  );
}
