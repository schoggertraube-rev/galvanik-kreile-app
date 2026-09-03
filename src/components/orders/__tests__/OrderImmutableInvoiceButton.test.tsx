import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrderImmutableInvoiceButton } from "../OrderImmutableInvoiceButton";
import type { LiveOrderCard } from "@/lib/server/orderCardRead";

const issueSpy = vi.hoisted(() => vi.fn());
const receiptSpy = vi.hoisted(() => vi.fn());

vi.mock("@/app/actions/invoices.actions", () => ({
  issueInvoiceAction: issueSpy,
  getInvoiceReceiptAction: receiptSpy,
}));

const CLIENT_EVENT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const baseOrder: LiveOrderCard = {
  id: "order-1",
  version: 4,
  orderNumber: "A-2026-0009",
  customerId: "customer-1",
  customerName: "Kunde",
  title: "Auftrag",
  note: null,
  station: "fertig",
  status: "fertig",
  dueAt: null,
  intakeAt: "2026-08-01T00:00:00.000Z",
  assignment: null,
  assignmentOptions: [],
  items: [],
  freeze: {
    freezeId: "freeze-1",
    rateId: "rate-1",
    hourlyRateCents: 6000,
    totalAmountCents: 11900,
    lineCount: 2,
    frozenAt: "2026-08-20T10:00:00.000Z",
  },
};

const receipt = {
  invoiceId: "invoice-1",
  invoiceNumber: "R-2026-0009",
  orderId: "order-1",
  orderVersion: 4,
  status: "issued" as const,
  netAmountCents: 10000,
  vatRateBasisPoints: 1900,
  vatAmountCents: 1900,
  grossAmountCents: 11900,
  serviceDate: "2026-08-20",
  dueDate: "2026-09-10",
  issuedAt: "2026-08-21T09:00:00.000Z",
  issuedBy: "actor-1",
  pdfRef: "invoice://invoice-1/original",
  pdfSha256: "d".repeat(64),
  eventId: "event-1",
  clientEventId: CLIENT_EVENT_ID,
  correlationId: "correlation-1",
  aggregateVersion: 1 as const,
  eventSchemaVersion: 1 as const,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("OrderImmutableInvoiceButton", () => {
  it("stays invisible outside the final freeze (not fertig/fertig, or no freeze)", () => {
    const { container: notFinished } = render(
      <OrderImmutableInvoiceButton order={{ ...baseOrder, station: "galvanik", status: "galvanik" }} />,
    );
    expect(notFinished.firstChild).toBeNull();

    const { container: noFreeze } = render(
      <OrderImmutableInvoiceButton order={{ ...baseOrder, freeze: null }} />,
    );
    expect(noFreeze.firstChild).toBeNull();
    expect(issueSpy).not.toHaveBeenCalled();
  });

  it("shows a loading state while pending and prevents a second concurrent submit", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(CLIENT_EVENT_ID as `${string}-${string}-${string}-${string}-${string}`);
    let resolveIssue!: (value: { code: "UNAUTHENTICATED"; message: string }) => void;
    issueSpy.mockReturnValueOnce(new Promise((resolve) => { resolveIssue = resolve; }));
    render(<OrderImmutableInvoiceButton order={baseOrder} />);
    const button = screen.getByRole("button", { name: "Unveränderliche Rechnung ausstellen" });

    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "Rechnung wird ausgestellt…" })).toBeDisabled();
    fireEvent.click(button);
    expect(issueSpy).toHaveBeenCalledTimes(1);

    resolveIssue({ code: "UNAUTHENTICATED", message: "Sitzung fehlt." });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Sitzung fehlt."));
    expect(receiptSpy).not.toHaveBeenCalled();
  });

  it("shows a conflict message from the command without claiming success", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(CLIENT_EVENT_ID as `${string}-${string}-${string}-${string}-${string}`);
    issueSpy.mockResolvedValueOnce({ code: "CONFLICT", message: "Auftrag wurde bereits geändert." });
    render(<OrderImmutableInvoiceButton order={baseOrder} />);
    fireEvent.click(screen.getByRole("button", { name: "Unveränderliche Rechnung ausstellen" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Auftrag wurde bereits geändert."));
    expect(receiptSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("order-immutable-invoice-pdf-link")).not.toBeInTheDocument();
  });

  it("confirms success and shows the download link only after a matching separate receipt readback", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(CLIENT_EVENT_ID as `${string}-${string}-${string}-${string}-${string}`);
    issueSpy.mockResolvedValueOnce({ code: "OK", receipt, replayed: false });
    receiptSpy.mockResolvedValueOnce({ code: "OK", data: receipt });
    render(<OrderImmutableInvoiceButton order={baseOrder} />);

    expect(screen.queryByTestId("order-immutable-invoice-pdf-link")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unveränderliche Rechnung ausstellen" }));

    await waitFor(() => expect(receiptSpy).toHaveBeenCalledWith({ orderId: "order-1", clientEventId: CLIENT_EVENT_ID }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rechnung wurde unveränderlich ausgestellt."));
    const link = screen.getByTestId("order-immutable-invoice-pdf-link");
    expect(link).toHaveAttribute("href", "/api/invoices/invoice-1/pdf");
  });

  it("does not claim success and shows no download link when the readback is missing or mismatched", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(CLIENT_EVENT_ID as `${string}-${string}-${string}-${string}-${string}`);
    issueSpy.mockResolvedValueOnce({ code: "OK", receipt, replayed: false });
    receiptSpy.mockResolvedValueOnce({ code: "OK", data: null });
    render(<OrderImmutableInvoiceButton order={baseOrder} />);

    fireEvent.click(screen.getByRole("button", { name: "Unveränderliche Rechnung ausstellen" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rechnung wurde nicht bestätigt; Auftragskarte neu laden."));
    expect(screen.queryByTestId("order-immutable-invoice-pdf-link")).not.toBeInTheDocument();

    vi.clearAllMocks();
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(CLIENT_EVENT_ID as `${string}-${string}-${string}-${string}-${string}`);
    issueSpy.mockResolvedValueOnce({ code: "OK", receipt, replayed: false });
    receiptSpy.mockResolvedValueOnce({ code: "OK", data: { ...receipt, grossAmountCents: receipt.grossAmountCents + 1 } });
    render(<OrderImmutableInvoiceButton order={baseOrder} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Unveränderliche Rechnung ausstellen" })[1]!);
    await waitFor(() => expect(screen.getAllByRole("status").at(-1)).toHaveTextContent("Rechnung wurde nicht bestätigt; Auftragskarte neu laden."));
    expect(screen.queryAllByTestId("order-immutable-invoice-pdf-link")).toHaveLength(0);
  });

  it("reports a thrown command without claiming success", async () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(CLIENT_EVENT_ID as `${string}-${string}-${string}-${string}-${string}`);
    issueSpy.mockRejectedValueOnce(new Error("network"));
    render(<OrderImmutableInvoiceButton order={baseOrder} />);
    fireEvent.click(screen.getByRole("button", { name: "Unveränderliche Rechnung ausstellen" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Rechnungsausgabe ist derzeit nicht verfügbar."));
    expect(receiptSpy).not.toHaveBeenCalled();
    expect(screen.queryByTestId("order-immutable-invoice-pdf-link")).not.toBeInTheDocument();
  });
});
