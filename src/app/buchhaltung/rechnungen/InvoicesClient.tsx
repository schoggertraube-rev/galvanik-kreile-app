"use client";

import { useRef, useState } from "react";
import { useHydrated } from "@/hooks/useHydrated";
import {
  cancelInvoiceAction,
  getInvoiceCancellationReceiptAction,
  getInvoiceSummariesAction,
} from "@/app/actions/invoices.actions";
import type { AppRole } from "@/lib/auth/authorizationContract";
import type { ImmutableInvoiceCancellationReceipt } from "@/lib/server/commands/immutableInvoiceCommand";
import type { ImmutableInvoiceSummary } from "@/lib/server/invoiceRead";

type InvoiceReaderRole = Extract<AppRole, "buero" | "meister" | "admin">;

export type InvoicePageInitialState =
  | { state: "DATA" | "EMPTY"; data: ImmutableInvoiceSummary[]; role: InvoiceReaderRole }
  | { state: "ERROR" | "DENIAL"; message: string; role: AppRole | null };

type InvoicePageState = InvoicePageInitialState["state"] | "LOADING";

function sameCancellationReceipt(
  receipt: ImmutableInvoiceCancellationReceipt,
  row: ImmutableInvoiceSummary,
): boolean {
  return row.invoiceId === receipt.invoiceId
    && row.invoiceNumber === receipt.invoiceNumber
    && row.orderId === receipt.orderId
    && row.orderVersion === receipt.orderVersion
    && row.status === "cancelled"
    && row.aggregateVersion === receipt.aggregateVersion
    && row.cancelReason === receipt.reason
    && row.cancelledAt === receipt.cancelledAt
    && row.cancelledBy === receipt.cancelledBy
    && row.originalPdfSha256 === receipt.originalPdfSha256
    && row.cancellationPdfRef === receipt.cancellationPdfRef
    && row.cancellationPdfSha256 === receipt.cancellationPdfSha256;
}

function statusLabel(status: ImmutableInvoiceSummary["status"]): string {
  return status === "issued" ? "Ausgestellt" : "Storniert";
}

function documentLabel(row: ImmutableInvoiceSummary): string {
  return row.status === "issued" ? "Original-PDF öffnen" : "Stornobeleg öffnen";
}

function documentHref(row: ImmutableInvoiceSummary): string {
  const kind = row.status === "issued" ? "original" : "cancellation";
  return `/api/invoices/${row.invoiceId}/pdf?kind=${kind}`;
}

export function InvoicesClient({ initialState }: { initialState: InvoicePageInitialState }) {
  const [rows, setRows] = useState(
    initialState.state === "DATA" || initialState.state === "EMPTY" ? initialState.data : [],
  );
  const [pageState, setPageState] = useState<InvoicePageState>(initialState.state);
  const [pageMessage, setPageMessage] = useState(
    initialState.state === "ERROR" || initialState.state === "DENIAL" ? initialState.message : null,
  );
  const [openInvoiceId, setOpenInvoiceId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);
  const [rowMessages, setRowMessages] = useState<Record<string, { kind: "success" | "error"; text: string }>>({});
  const requestIds = useRef<Record<string, string>>({});
  const canCancel = initialState.role === "meister" || initialState.role === "admin";
  const interactive = useHydrated();
  const openRow = openInvoiceId ? rows.find((row) => row.invoiceId === openInvoiceId) ?? null : null;

  function stableClientEventId(invoiceId: string): string {
    requestIds.current[invoiceId] ??= globalThis.crypto.randomUUID();
    return requestIds.current[invoiceId];
  }

  async function cancel(row: ImmutableInvoiceSummary, rawReason: string) {
    if (pendingInvoiceId) return;
    const reason = rawReason.trim();
    if (reason.length < 5 || reason.length > 500) {
      setRowMessages((current) => ({
        ...current,
        [row.invoiceId]: { kind: "error", text: "Stornogrund muss 5 bis 500 Zeichen enthalten." },
      }));
      return;
    }

    const clientEventId = stableClientEventId(row.invoiceId);
    setPendingInvoiceId(row.invoiceId);
    setRowMessages((current) => {
      const next = { ...current };
      delete next[row.invoiceId];
      return next;
    });
    try {
      const command = await cancelInvoiceAction({
        invoiceId: row.invoiceId,
        expectedVersion: row.aggregateVersion,
        reason,
        clientEventId,
      });
      if (command.code !== "OK") {
        setRowMessages((current) => ({
          ...current,
          [row.invoiceId]: { kind: "error", text: command.message },
        }));
        return;
      }

      const receiptResult = await getInvoiceCancellationReceiptAction({
        invoiceId: row.invoiceId,
        clientEventId,
      });
      if (receiptResult.code !== "OK" || !receiptResult.data) {
        setRowMessages((current) => ({
          ...current,
          [row.invoiceId]: {
            kind: "error",
            text: "Storno wurde nicht bestätigt; Rechnungsliste neu laden.",
          },
        }));
        return;
      }

      setPageState("LOADING");
      const refreshed = await getInvoiceSummariesAction();
      if (refreshed.code !== "OK") {
        setPageState(refreshed.code === "UNAUTHENTICATED" || refreshed.code === "FORBIDDEN" ? "DENIAL" : "ERROR");
        setPageMessage(refreshed.message);
        return;
      }
      const confirmed = refreshed.data.find((candidate) => candidate.invoiceId === row.invoiceId);
      if (!confirmed || !sameCancellationReceipt(receiptResult.data, confirmed)) {
        setPageState("ERROR");
        setPageMessage("Der gespeicherte Stornobeleg stimmt nicht mit der Rechnungsliste überein.");
        return;
      }

      delete requestIds.current[row.invoiceId];
      setRows(refreshed.data);
      setPageState(refreshed.data.length === 0 ? "EMPTY" : "DATA");
      setPageMessage(null);
      setRowMessages((current) => ({
        ...current,
        [row.invoiceId]: {
          kind: "success",
          text: command.replayed ? "Storno war bereits bestätigt." : "Storno und gespeicherter Beleg sind bestätigt.",
        },
      }));
    } catch {
      setRowMessages((current) => ({
        ...current,
        [row.invoiceId]: { kind: "error", text: "Rechnungsstorno ist derzeit nicht verfügbar." },
      }));
    } finally {
      setPendingInvoiceId(null);
    }
  }

  return (
    <div className="mock-kreile-rolf-accounting" data-testid="immutable-invoice-page" style={{ minHeight: "100%" }}>
      <div className="app-page">
        <div className="app-head">
          <div>
            <h1 style={{ margin: 0 }}>Geld &amp; Rechnungen</h1>
          </div>
        </div>

        {pageState === "LOADING" ? (
          <div className="app-note" role="status">Rechnungsliste wird bestätigt.</div>
        ) : null}

        {pageState === "ERROR" || pageState === "DENIAL" ? (
          <div className="app-note" role="alert">{pageMessage}</div>
        ) : null}

        {pageState === "EMPTY" ? (
          <div className="app-note" data-testid="invoice-empty-state" role="status">Keine Rechnungen ausgestellt.</div>
        ) : null}

        {pageState === "DATA" ? (
          <>
            <div className="app-list" aria-label="Unveränderliche Rechnungen">
              <div className="app-list-head">
                <span>Rechnung / Auftrag</span>
                <span>Status</span>
                <span>Nächste Handlung</span>
                <span></span>
              </div>
              {rows.map((row) => (
                <div className="app-row" data-testid={`invoice-row-${row.invoiceNumber}`} key={row.invoiceId}>
                  <div className="app-main">
                    <b>{row.invoiceNumber} · {row.customerName}</b>
                    <span>{row.orderNumber}</span>
                  </div>
                  <div className="app-meta">
                    <span className="app-status">{statusLabel(row.status)}</span>
                  </div>
                  <div className="app-meta">{documentLabel(row)}</div>
                  <button
                    aria-expanded={openInvoiceId === row.invoiceId}
                    aria-label={`Rechnung ${row.invoiceNumber} öffnen`}
                    className="app-btn"
                    onClick={() => setOpenInvoiceId((current) => current === row.invoiceId ? null : row.invoiceId)}
                    type="button"
                  >
                    Öffnen →
                  </button>
                </div>
              ))}
            </div>

            {openRow ? (
              <div className="app-note" data-testid={`invoice-open-${openRow.invoiceNumber}`}>
                <a
                  className="app-btn"
                  data-testid={`invoice-document-${openRow.invoiceNumber}`}
                  href={documentHref(openRow)}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {documentLabel(openRow)}
                </a>

                {openRow.status === "issued" && canCancel ? (
                  <form
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      void cancel(openRow, String(formData.get("reason") ?? ""));
                    }}
                  >
                    <label htmlFor={`cancel-reason-${openRow.invoiceId}`}>Stornogrund</label>
                    <input
                      id={`cancel-reason-${openRow.invoiceId}`}
                      maxLength={500}
                      minLength={5}
                      name="reason"
                      onChange={(event) => setReasons((current) => ({ ...current, [openRow.invoiceId]: event.target.value }))}
                      placeholder="Grund der vollständigen Stornierung"
                      value={reasons[openRow.invoiceId] ?? ""}
                      disabled={!interactive || pendingInvoiceId === openRow.invoiceId}
                    />
                    <button disabled={!interactive || pendingInvoiceId === openRow.invoiceId} type="submit">
                      {pendingInvoiceId === openRow.invoiceId ? "Storno wird bestätigt…" : "Rechnung stornieren"}
                    </button>
                  </form>
                ) : null}

                {rowMessages[openRow.invoiceId] ? (
                  <p role={rowMessages[openRow.invoiceId].kind === "error" ? "alert" : "status"}>
                    {rowMessages[openRow.invoiceId].text}
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
