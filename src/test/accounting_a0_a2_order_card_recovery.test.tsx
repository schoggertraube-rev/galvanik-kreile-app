import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";

const actions = vi.hoisted(() => ({
  confirmPayment: vi.fn(),
  recoverPayment: vi.fn(),
  getPaymentState: vi.fn(),
  getLiveCard: vi.fn(),
  getMasterData: vi.fn(),
  routerPush: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: actions.routerPush }),
}));
vi.mock("@/lib/auth/PermissionsContext", () => ({
  usePermissions: () => ({ role: "meister" }),
}));
vi.mock("@/lib/overlayStore", () => ({
  useOverlayStore: (selector: (state: { openCustomer: () => void; pop: () => void }) => unknown) =>
    selector({ openCustomer: vi.fn(), pop: vi.fn() }),
}));
vi.mock("@/app/actions/invoices.actions", () => ({
  issueInvoiceAction: vi.fn(),
  getInvoiceReceiptAction: vi.fn(),
}));
vi.mock("@/app/actions/goodsOut.actions", () => ({ recordGoodsOutAction: vi.fn() }));
vi.mock("@/app/actions/orders.actions", () => ({
  freezeOrderAction: vi.fn(),
  getExtraWorkMasterDataAction: actions.getMasterData,
  getLiveOrderCardAction: actions.getLiveCard,
  getOrderFrozenReceiptAction: vi.fn(),
  transitionWareneingangToGalvanikAction: vi.fn(),
}));
vi.mock("@/app/actions/payments.actions", () => ({
  confirmPaymentAction: actions.confirmPayment,
  getOrderPaymentStateAction: actions.getPaymentState,
  recoverPaymentConfirmationAction: actions.recoverPayment,
}));
vi.mock("@/app/warendurchlauf/actions", () => ({
  finalizeGalvanikHandoffAttachmentAction: vi.fn(),
  getGalvanikHandoffAttachmentOriginalAction: vi.fn(),
  getGalvanikHandoffAttachmentsAction: vi.fn(),
  getOrderStationReceiptAction: vi.fn(),
  reserveGalvanikHandoffAttachmentAction: vi.fn(),
}));
vi.mock("@/app/warendurchlauf/galvanik/GalvanikHandoffAttachmentAppAdapter", () => ({
  uploadSignedOrderAttachment: vi.fn(),
}));

import { OrderCardAppAdapter } from "@/app/orders/OrderCardAppAdapter";

const ORDER_ID = "order-a";
const INVOICE_ID = "15151515-1515-4151-8151-151515151510";
const EVENT_ID = "15151515-1515-4151-8151-151515151511";
const RECEIPT_ID = "payment://15151515-1515-4151-8151-151515151510/1";
const ACTOR_ID = "11111111-1111-4111-8111-111111111111";

const card = {
  id: ORDER_ID,
  version: 3,
  orderNumber: "A-2026-0042",
  customerId: "customer-a",
  customerName: "Synthetischer Kunde",
  title: "Synthetischer Auftrag",
  note: null,
  station: "fertig",
  status: "fertig",
  dueAt: "2026-09-30T00:00:00.000Z",
  intakeAt: "2026-09-17T08:00:00.000Z",
  assignment: null,
  assignmentOptions: [],
  items: [],
  freeze: null,
};

function paymentState(paid = false) {
  return {
    orderId: ORDER_ID,
    orderNumber: card.orderNumber,
    orderVersion: card.version,
    physicalStatus: card.station,
    mode: "vorkasse" as const,
    paymentModeVersion: 1,
    invoiceState: "issued" as const,
    payment: {
      invoiceId: INVOICE_ID,
      invoiceNumber: "R-2026-9001",
      orderId: ORDER_ID,
      orderNumber: card.orderNumber,
      totalAmountCents: 11_900,
      paidAmountCents: paid ? 11_900 : 0,
      openAmountCents: paid ? 0 : 11_900,
      mode: "vorkasse" as const,
      status: paid ? "bezahlt" as const : "offen" as const,
      currency: "EUR" as const,
      method: paid ? "ueberweisung" as const : null,
      paidAt: paid ? "2026-09-17T08:15:00.000Z" : null,
      receiptId: paid ? RECEIPT_ID : null,
      eventId: paid ? EVENT_ID : null,
      correlationId: paid ? "15151515-1515-4151-8151-151515151512" : null,
      paymentModeVersion: 1,
      paymentVersion: paid ? 1 : 0,
      goodsOutAllowed: paid,
    },
    paymentActorId: paid ? ACTOR_ID : null,
    goodsOut: null,
    goodsOutAllowed: paid,
  };
}

const recoveredReceipt = {
  contractVersion: "1.0.0-candidate.1",
  receiptId: RECEIPT_ID,
  eventId: EVENT_ID,
  intentId: "filled-from-command",
  idempotencyKey: "filled-from-command",
  correlationId: "15151515-1515-4151-8151-151515151512",
  tenantId: KREILE_TENANT_SLUG,
  actorId: ACTOR_ID,
  occurredAt: "2026-09-17T08:15:00.000Z",
  kind: "payment_confirmed",
  eventType: "PAYMENT_CONFIRMED_V1",
  eventSchemaVersion: 1,
  invoiceId: INVOICE_ID,
  invoiceNumber: "R-2026-9001",
  orderId: ORDER_ID,
  expectedPaymentVersion: 0,
  paymentVersion: 1,
  amount: { amountCents: 11_900, currency: "EUR" },
  gross: { amountCents: 11_900, currency: "EUR" },
  paid: { amountCents: 11_900, currency: "EUR" },
  open: { amountCents: 0, currency: "EUR" },
  paymentStatus: "paid",
  method: "bank_transfer",
  source: "manual",
};

function arrangeLoad(...states: ReturnType<typeof paymentState>[]) {
  actions.getLiveCard.mockResolvedValue({ code: "OK", data: { card, evidence: [] } });
  actions.getMasterData.mockResolvedValue({ code: "OK", data: { currentRate: null, catalog: [] } });
  for (const state of states) actions.getPaymentState.mockResolvedValueOnce({ code: "OK", data: state });
}

describe("OrderCardAppAdapter accounting recovery", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("restores a committed payment only after the independent status read and reload", async () => {
    arrangeLoad(paymentState(false), paymentState(true));
    actions.confirmPayment.mockResolvedValue({
      code: "UNAVAILABLE",
      message: "Der Ausgang ist noch unklar.",
    });
    actions.recoverPayment.mockImplementation(async (query) => ({
      state: "resolved",
      receipt: { ...recoveredReceipt, intentId: query.intentId, idempotencyKey: query.idempotencyKey },
    }));

    render(<OrderCardAppAdapter orderId={ORDER_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Zahlung bestätigen" }));

    expect(await screen.findByText("Zahlung wurde nach der Statusprüfung sicher bestätigt.")).toBeInTheDocument();
    const command = actions.confirmPayment.mock.calls[0]?.[0];
    expect(actions.recoverPayment).toHaveBeenCalledWith(expect.objectContaining({
      intentId: command.clientEventId,
      idempotencyKey: command.clientEventId,
      aggregateId: INVOICE_ID,
    }));
    expect(actions.recoverPayment.mock.calls[0]?.[0]).not.toHaveProperty("tenantId");
    expect(actions.getPaymentState).toHaveBeenCalledTimes(2);
  });

  it("recovers a committed payment when the command response is lost", async () => {
    arrangeLoad(paymentState(false), paymentState(true));
    actions.confirmPayment.mockRejectedValue(new TypeError("transport response lost"));
    actions.recoverPayment.mockImplementation(async (query) => ({
      state: "resolved",
      receipt: { ...recoveredReceipt, intentId: query.intentId, idempotencyKey: query.idempotencyKey },
    }));

    render(<OrderCardAppAdapter orderId={ORDER_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Zahlung bestätigen" }));

    expect(await screen.findByText("Zahlung wurde nach der Statusprüfung sicher bestätigt.")).toBeInTheDocument();
    expect(actions.confirmPayment).toHaveBeenCalledTimes(1);
    expect(actions.recoverPayment).toHaveBeenCalledTimes(1);
    expect(actions.getPaymentState).toHaveBeenCalledTimes(2);
  });

  it("allows a second mutation only after complete absence and keeps the same idempotency key", async () => {
    arrangeLoad(paymentState(false), paymentState(true));
    actions.confirmPayment
      .mockResolvedValueOnce({ code: "UNAVAILABLE", message: "Der Ausgang ist noch unklar." })
      .mockResolvedValueOnce({
        code: "OK",
        receipt: {
          eventId: EVENT_ID,
          receiptId: RECEIPT_ID,
          paymentVersion: 1,
          confirmedBy: ACTOR_ID,
          confirmedAt: "2026-09-17T08:15:00.000Z",
        },
        replayed: false,
      });
    actions.recoverPayment.mockResolvedValue({
      state: "not_committed",
      retry: "same_idempotency_key_only",
    });

    render(<OrderCardAppAdapter orderId={ORDER_ID} />);
    const button = await screen.findByRole("button", { name: "Zahlung bestätigen" });
    fireEvent.click(button);
    expect(await screen.findByText(/Es wurde keine Zahlung gespeichert/)).toBeInTheDocument();
    expect(actions.confirmPayment).toHaveBeenCalledTimes(1);
    fireEvent.click(button);

    expect(await screen.findByText("Zahlung wurde sicher bestätigt.")).toBeInTheDocument();
    expect(actions.confirmPayment).toHaveBeenCalledTimes(2);
    expect(actions.confirmPayment.mock.calls[1]?.[0].clientEventId)
      .toBe(actions.confirmPayment.mock.calls[0]?.[0].clientEventId);
    expect(actions.recoverPayment).toHaveBeenCalledTimes(1);
  });

  it("blocks every further mutation after a mismatching or corrupt recovery read", async () => {
    arrangeLoad(paymentState(false));
    actions.confirmPayment.mockResolvedValue({
      code: "UNAVAILABLE",
      message: "Der Ausgang ist noch unklar.",
    });
    actions.recoverPayment.mockResolvedValue({
      state: "integrity_failure",
      error: { code: "INTEGRITY_ERROR", message: "mismatch", retryability: "after_reconciliation", details: {} },
    });

    render(<OrderCardAppAdapter orderId={ORDER_ID} />);
    const button = await screen.findByRole("button", { name: "Zahlung bestätigen" });
    fireEvent.click(button);
    expect(await screen.findByText(/Bitte nicht erneut bestätigen/)).toBeInTheDocument();
    fireEvent.click(button);

    await waitFor(() => expect(screen.getByText(/muss vor einem weiteren Versuch geklärt werden/)).toBeInTheDocument());
    expect(actions.confirmPayment).toHaveBeenCalledTimes(1);
    expect(actions.recoverPayment).toHaveBeenCalledTimes(1);
  });
});
