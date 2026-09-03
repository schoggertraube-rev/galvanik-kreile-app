"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { BackButton } from "@/components/ui/BackButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
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

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("de-DE").format(new Date(value));
}

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

export function InvoicesClient({ initialState }: { initialState: InvoicePageInitialState }) {
  const [rows, setRows] = useState(
    initialState.state === "DATA" || initialState.state === "EMPTY" ? initialState.data : [],
  );
  const [pageState, setPageState] = useState<InvoicePageState>(initialState.state);
  const [pageMessage, setPageMessage] = useState(
    initialState.state === "ERROR" || initialState.state === "DENIAL" ? initialState.message : null,
  );
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [pendingInvoiceId, setPendingInvoiceId] = useState<string | null>(null);
  const [rowMessages, setRowMessages] = useState<Record<string, { kind: "success" | "error"; text: string }>>({});
  const requestIds = useRef<Record<string, string>>({});
  const canCancel = initialState.role === "meister" || initialState.role === "admin";
  const interactive = useHydrated();

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
        setPageMessage("Storno-Readback stimmt nicht mit der Rechnungsliste überein.");
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
          text: command.replayed ? "Storno war bereits bestätigt." : "Storno und Readback sind bestätigt.",
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
    <main className="min-h-screen bg-bg-app-soft px-4 pb-24 pt-4 sm:px-6 xl:px-8" data-testid="immutable-invoice-page">
      <div className="mx-auto max-w-6xl">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Buchhaltung", href: "/buchhaltung" }, { label: "Rechnungen" }]} />
        <BackButton label="Buchhaltung" href="/buchhaltung" />

        <header className="mb-8 mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">F1.4 · unveränderliche Belege</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-navy-900">Rechnungen</h1>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">
            Ausgestellte Rechnungen bleiben unverändert. Korrekturen erfolgen ausschließlich durch Storno und Neuausstellung.
          </p>
        </header>

        {pageState === "LOADING" ? (
          <div className="rounded-2xl border border-neutral-gray-200 bg-white p-6" role="status">
            Rechnungsliste wird bestätigt…
          </div>
        ) : null}

        {pageState === "ERROR" || pageState === "DENIAL" ? (
          <div className="rounded-2xl border border-error-red/30 bg-white p-6 text-sm text-error-red" role="alert">
            {pageMessage}
          </div>
        ) : null}

        {pageState === "EMPTY" ? (
          <section className="rounded-2xl border border-neutral-gray-200 bg-white p-8 text-center" data-testid="invoice-empty-state">
            <h2 className="font-display text-xl font-semibold text-navy-900">Noch keine Rechnungen ausgestellt</h2>
            <p className="mt-2 text-sm text-text-muted">Fertiggestellte Aufträge können im Werkstattdurchlauf in Rechnung gestellt werden.</p>
            <Link className="mt-5 inline-flex min-h-12 items-center rounded-lg bg-navy-900 px-5 text-sm font-semibold text-white" href="/warendurchlauf">
              Zum Werkstattdurchlauf
            </Link>
          </section>
        ) : null}

        {pageState === "DATA" ? (
          <section className="space-y-4" aria-label="Unveränderliche Rechnungen">
            {rows.map((row) => {
              const rowMessage = rowMessages[row.invoiceId];
              const pending = pendingInvoiceId === row.invoiceId;
              return (
                <article
                  className="rounded-2xl border border-neutral-gray-200 bg-white p-5 shadow-sm"
                  data-testid={`invoice-row-${row.invoiceNumber}`}
                  key={row.invoiceId}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-xl font-semibold text-navy-900">{row.invoiceNumber}</h2>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.status === "issued" ? "bg-success-green/10 text-success-green" : "bg-neutral-gray-100 text-text-muted"}`}>
                          {row.status === "issued" ? "Ausgestellt" : "Storniert"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-text-muted">{row.customerName} · Auftrag {row.orderNumber}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        Leistung {formatDate(row.serviceDate)} · Ausgabe {formatDate(row.issuedAt)} · Version {row.aggregateVersion}
                      </p>
                    </div>
                    <div className="text-left lg:text-right">
                      <p className="font-display text-2xl font-bold text-navy-900">{formatMoney(row.grossAmountCents)}</p>
                      <p className="text-xs text-text-muted">inkl. {(row.vatRateBasisPoints / 100).toLocaleString("de-DE")} % USt</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <a
                      className="inline-flex min-h-12 items-center rounded-lg border border-navy-900 px-4 text-sm font-semibold text-navy-900"
                      href={`/api/invoices/${row.invoiceId}/pdf?kind=original`}
                      data-testid={`invoice-original-pdf-${row.invoiceNumber}`}
                    >
                      Original-PDF
                    </a>
                    {row.status === "cancelled" ? (
                      <a
                        className="inline-flex min-h-12 items-center rounded-lg border border-navy-900 px-4 text-sm font-semibold text-navy-900"
                        href={`/api/invoices/${row.invoiceId}/pdf?kind=cancellation`}
                        data-testid={`invoice-cancellation-pdf-${row.invoiceNumber}`}
                      >
                        Stornobeleg-PDF
                      </a>
                    ) : null}
                    <Link className="inline-flex min-h-12 items-center px-2 text-sm font-semibold text-navy-900 underline" href="/warendurchlauf">
                      Auftrag öffnen
                    </Link>
                  </div>

                  {row.status === "cancelled" ? (
                    <div className="mt-4 rounded-xl bg-neutral-gray-50 p-4 text-sm text-text-muted">
                      <strong className="text-navy-900">Stornogrund:</strong> {row.cancelReason}
                    </div>
                  ) : null}

                  {row.status === "issued" && canCancel ? (
                    <div className="mt-5 border-t border-neutral-gray-200 pt-4">
                      <label className="block text-sm font-semibold text-navy-900" htmlFor={`cancel-reason-${row.invoiceId}`}>
                        Stornogrund
                      </label>
                      <form
                        noValidate
                        onSubmit={(event) => {
                          event.preventDefault();
                          const formData = new FormData(event.currentTarget);
                          const rawReason = String(formData.get("reason") ?? "");
                          void cancel(row, rawReason);
                        }}
                        className="mt-2 flex flex-col gap-3 sm:flex-row"
                      >
                        <input
                          id={`cancel-reason-${row.invoiceId}`}
                          name="reason"
                          value={reasons[row.invoiceId] ?? ""}
                          onChange={(event) => setReasons((current) => ({ ...current, [row.invoiceId]: event.target.value }))}
                          minLength={5}
                          maxLength={500}
                          disabled={!interactive || pending}
                          className="min-h-12 flex-1 rounded-lg border border-neutral-gray-300 px-3 text-sm"
                          placeholder="Grund der vollständigen Stornierung"
                        />
                        <button
                          type="submit"
                          disabled={!interactive || pending}
                          className="min-h-12 rounded-lg bg-navy-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
                        >
                          {pending ? "Storno wird bestätigt…" : "Rechnung stornieren"}
                        </button>
                      </form>
                    </div>
                  ) : null}

                  {rowMessage ? (
                    <p className={`mt-3 text-sm ${rowMessage.kind === "error" ? "text-error-red" : "text-success-green"}`} role={rowMessage.kind === "error" ? "alert" : "status"}>
                      {rowMessage.text}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </section>
        ) : null}
      </div>
    </main>
  );
}
