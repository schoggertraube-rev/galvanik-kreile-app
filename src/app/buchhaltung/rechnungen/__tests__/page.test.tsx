import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  cancelInvoiceAction: vi.fn(),
  getInvoiceCancellationReceiptAction: vi.fn(),
  getInvoiceSummariesAction: vi.fn(),
}));

vi.mock("@/app/actions/invoices.actions", () => ports);
vi.mock("@/components/ui/Breadcrumb", () => ({ Breadcrumb: () => <nav aria-label="Breadcrumb" /> }));
vi.mock("@/components/ui/BackButton", () => ({ BackButton: () => <a href="/buchhaltung">Buchhaltung</a> }));

const INVOICE = "11111111-1111-4111-8111-111111111111";
const ORDER = "22222222-2222-4222-8222-222222222222";
const ACTOR = "33333333-3333-4333-8333-333333333333";
const EVENT = "44444444-4444-4444-8444-444444444444";
const CLIENT = "55555555-5555-4555-8555-555555555555";
const CORRELATION = "66666666-6666-4666-8666-666666666666";
const ORIGINAL_HASH = "a".repeat(64);
const CANCELLATION_HASH = "b".repeat(64);

const issuedRow = {
  invoiceId: INVOICE,
  invoiceNumber: "R-2026-0001",
  orderId: ORDER,
  orderNumber: "A-2026-0001",
  customerId: "77777777-7777-4777-8777-777777777777",
  customerName: "Synthetischer Testkunde",
  status: "issued" as const,
  aggregateVersion: 1 as const,
  orderVersion: 4,
  netAmountCents: 10000,
  vatRateBasisPoints: 1900,
  vatAmountCents: 1900,
  grossAmountCents: 11900,
  serviceDate: "2026-08-20",
  dueDate: "2026-09-10",
  issuedAt: "2026-08-21T09:00:00.000Z",
  originalPdfRef: `invoice://${INVOICE}/original`,
  originalPdfSha256: ORIGINAL_HASH,
  cancelledAt: null,
  cancelledBy: null,
  cancelReason: null,
  cancellationPdfRef: null,
  cancellationPdfSha256: null,
};

const cancellationReceipt = {
  invoiceId: INVOICE,
  invoiceNumber: "R-2026-0001",
  orderId: ORDER,
  orderVersion: 4,
  status: "cancelled" as const,
  reason: "Doppelte Berechnung vollständig storniert",
  cancelledAt: "2026-08-21T10:00:00.000Z",
  cancelledBy: ACTOR,
  originalPdfSha256: ORIGINAL_HASH,
  cancellationPdfRef: `invoice://${INVOICE}/cancellation`,
  cancellationPdfSha256: CANCELLATION_HASH,
  eventId: EVENT,
  clientEventId: CLIENT,
  correlationId: CORRELATION,
  expectedVersion: 1 as const,
  aggregateVersion: 2 as const,
  eventSchemaVersion: 1 as const,
};

const cancelledRow = {
  ...issuedRow,
  status: "cancelled" as const,
  aggregateVersion: 2 as const,
  cancelledAt: cancellationReceipt.cancelledAt,
  cancelledBy: ACTOR,
  cancelReason: cancellationReceipt.reason,
  cancellationPdfRef: cancellationReceipt.cancellationPdfRef,
  cancellationPdfSha256: CANCELLATION_HASH,
};

afterEach(() => cleanup());

describe("F1.4 immutable invoice page states", () => {
  beforeEach(() => vi.resetAllMocks());

  it("renders denial and error separately from an empty list", async () => {
    const { InvoicesClient } = await import("../InvoicesClient");
    render(
      <InvoicesClient initialState={{ state: "DENIAL", message: "Nicht erlaubt", role: null }} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Nicht erlaubt");
    expect(screen.queryByTestId("invoice-empty-state")).not.toBeInTheDocument();

    cleanup();
    render(<InvoicesClient initialState={{ state: "ERROR", message: "Quelle nicht verfügbar", role: null }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Quelle nicht verfügbar");
    expect(screen.queryByTestId("invoice-empty-state")).not.toBeInTheDocument();
  });

  it("renders the real empty state without fabricated metrics", async () => {
    const { InvoicesClient } = await import("../InvoicesClient");
    render(<InvoicesClient initialState={{ state: "EMPTY", data: [], role: "buero" }} />);
    expect(screen.getByTestId("invoice-empty-state")).toHaveTextContent("Noch keine Rechnungen ausgestellt");
    expect(screen.queryByText(/offene posten|bezahlt|mahnung/i)).not.toBeInTheDocument();
  });

  it("shows immutable data and keeps cancellation unavailable to buero", async () => {
    const { InvoicesClient } = await import("../InvoicesClient");
    render(<InvoicesClient initialState={{ state: "DATA", data: [issuedRow], role: "buero" }} />);
    expect(screen.getByText("R-2026-0001")).toBeVisible();
    expect(screen.getByText("Synthetischer Testkunde · Auftrag A-2026-0001")).toBeVisible();
    expect(screen.getByTestId("invoice-original-pdf-R-2026-0001")).toHaveAttribute(
      "href",
      `/api/invoices/${INVOICE}/pdf?kind=original`,
    );
    expect(screen.queryByRole("button", { name: "Rechnung stornieren" })).not.toBeInTheDocument();
  });

  it("confirms cancellation only after command, receipt readback and refreshed summary agree", async () => {
    ports.cancelInvoiceAction.mockResolvedValueOnce({ code: "OK", receipt: cancellationReceipt, replayed: false });
    ports.getInvoiceCancellationReceiptAction.mockResolvedValueOnce({ code: "OK", data: cancellationReceipt });
    ports.getInvoiceSummariesAction.mockResolvedValueOnce({ code: "OK", data: [cancelledRow] });
    const { InvoicesClient } = await import("../InvoicesClient");
    render(<InvoicesClient initialState={{ state: "DATA", data: [issuedRow], role: "meister" }} />);

    fireEvent.change(screen.getByLabelText("Stornogrund"), {
      target: { value: cancellationReceipt.reason },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rechnung stornieren" }));

    await waitFor(() => expect(ports.getInvoiceCancellationReceiptAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(ports.getInvoiceSummariesAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Storno und Readback sind bestätigt.")).toBeVisible();
    expect(screen.getByTestId("invoice-cancellation-pdf-R-2026-0001")).toHaveAttribute(
      "href",
      `/api/invoices/${INVOICE}/pdf?kind=cancellation`,
    );
  });

  it("surfaces a command conflict without reading a false receipt", async () => {
    ports.cancelInvoiceAction.mockResolvedValueOnce({ code: "CONFLICT", message: "Rechnung wurde bereits verändert." });
    const { InvoicesClient } = await import("../InvoicesClient");
    render(<InvoicesClient initialState={{ state: "DATA", data: [issuedRow], role: "admin" }} />);
    fireEvent.change(screen.getByLabelText("Stornogrund"), {
      target: { value: "Doppelte Berechnung vollständig storniert" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rechnung stornieren" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Rechnung wurde bereits verändert.");
    expect(ports.getInvoiceCancellationReceiptAction).not.toHaveBeenCalled();
  });
});
