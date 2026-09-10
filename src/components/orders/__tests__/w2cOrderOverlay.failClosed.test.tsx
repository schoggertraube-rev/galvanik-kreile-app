import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveOrderCard } from "@/lib/server/orderCardRead";
import type { OrderPaymentState } from "@/lib/server/paymentContract";

const mocked = vi.hoisted(() => {
  const popOrder = vi.fn();
  const openCustomer = vi.fn();
  const state = { stack: [{ type: "order" as const, id: "order-1" }], orderStack: ["order-1"], popOrder, openCustomer };
  return {
    state,
    role: { value: "admin" },
    popOrder,
    openCustomer,
    getLiveOrderCardAction: vi.fn(),
    getExtraWorkMasterDataAction: vi.fn(),
    getOrderPaymentStateAction: vi.fn(),
    confirmPaymentAction: vi.fn(),
    recordGoodsOutAction: vi.fn(),
    useOverlayStore: vi.fn((selector: (store: typeof state) => unknown) => selector(state)),
  };
});

vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: mocked.useOverlayStore }));
vi.mock("@/components/ui/AppOverlayPortal", () => ({ AppOverlayPortal: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/lib/auth/PermissionsContext", () => ({ usePermissions: () => ({ role: mocked.role.value }) }));
vi.mock("@/app/actions/orders.actions", () => ({
  getLiveOrderCardAction: mocked.getLiveOrderCardAction,
  getExtraWorkMasterDataAction: mocked.getExtraWorkMasterDataAction,
}));
vi.mock("@/app/actions/payments.actions", () => ({
  getOrderPaymentStateAction: mocked.getOrderPaymentStateAction,
  confirmPaymentAction: mocked.confirmPaymentAction,
}));
vi.mock("@/app/actions/goodsOut.actions", () => ({ recordGoodsOutAction: mocked.recordGoodsOutAction }));
vi.mock("../ExtraWorkAdminPanel", () => ({ ExtraWorkAdminPanel: () => null }));
vi.mock("../OrderExtraWorkEditor", () => ({ OrderExtraWorkEditor: () => null }));
vi.mock("../OrderFreezeButton", () => ({ OrderFreezeButton: () => null }));
vi.mock("../OrderFreezeCorrectionButton", () => ({ OrderFreezeCorrectionButton: () => null }));
vi.mock("../OrderTaskAssignmentPanel", () => ({ OrderTaskAssignmentPanel: () => null }));
vi.mock("../OrderImmutableInvoiceButton", () => ({
  OrderImmutableInvoiceButton: ({
    allowAfterGoodsOut,
    onConfirmedReadback,
  }: {
    allowAfterGoodsOut?: boolean;
    onConfirmedReadback?: (receipt: { invoiceId: string }) => boolean | Promise<boolean>;
  }) => (
    <button
      data-testid="order-immutable-invoice-panel"
      data-after-goods-out={allowAfterGoodsOut ? "true" : "false"}
      onClick={() => void onConfirmedReadback?.({ invoiceId: "33333333-3333-4333-8333-333333333333" })}
      type="button"
    >
      Unveränderliche Rechnung ausstellen
    </button>
  ),
}));

import { OrderOverlay } from "../OrderOverlay";

const ACTOR_ID = "66666666-6666-4666-8666-666666666666";
const PAYMENT_EVENT_ID = "77777777-7777-4777-8777-777777777777";
const GOODS_EVENT_ID = "88888888-8888-4888-8888-888888888888";
const CORRELATION_ID = "99999999-9999-4999-8999-999999999999";

const card: LiveOrderCard = {
  id: "order-1",
  version: 4,
  orderNumber: "A-2026-0001",
  customerId: "customer-1",
  customerName: "Musterkunde",
  title: "Testauftrag",
  note: null,
  station: "fertig",
  status: "fertig",
  dueAt: null,
  intakeAt: "2026-09-09T08:00:00.000Z",
  assignment: null,
  assignmentOptions: [],
  items: [],
  freeze: null,
};

const openInvoice = {
  invoiceId: "33333333-3333-4333-8333-333333333333",
  invoiceNumber: "R-2026-0001",
  orderId: "order-1",
  orderNumber: "A-2026-0001",
  totalAmountCents: 11900,
  paidAmountCents: 0,
  openAmountCents: 11900,
  mode: "vorkasse" as const,
  status: "offen" as const,
  currency: "EUR" as const,
  method: null,
  paidAt: null,
  receiptId: null,
  eventId: null,
  correlationId: null,
  paymentModeVersion: 0,
  paymentVersion: 0,
  goodsOutAllowed: false,
};

function paymentState(overrides: Partial<OrderPaymentState> = {}): OrderPaymentState {
  return {
    orderId: "order-1",
    orderNumber: "A-2026-0001",
    orderVersion: 4,
    physicalStatus: "fertig",
    mode: "vorkasse",
    paymentModeVersion: 0,
    invoiceState: "issued",
    payment: openInvoice,
    paymentActorId: null,
    goodsOut: null,
    goodsOutAllowed: false,
    ...overrides,
  };
}

function cardResult(value: LiveOrderCard = card) {
  return { code: "OK" as const, data: { card: value, evidence: [] } };
}

describe("F1.5-D live order overlay fail-closed flow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.role.value = "admin";
    mocked.state.orderStack = ["order-1"];
    mocked.state.stack = [{ type: "order", id: "order-1" }];
    mocked.getExtraWorkMasterDataAction.mockResolvedValue({ code: "OK", data: { currentRate: null, catalog: [] } });
    mocked.getLiveOrderCardAction.mockResolvedValue(cardResult());
    mocked.getOrderPaymentStateAction.mockResolvedValue({ code: "OK", data: paymentState() });
  });

  it("renders a foreign order as tenant-safe empty and remains closable", async () => {
    mocked.getLiveOrderCardAction.mockResolvedValue({ code: "NOT_FOUND", message: "Auftrag nicht verfügbar." });
    render(<OrderOverlay />);
    expect(await screen.findByText("Auftrag wurde nicht gefunden oder gehört nicht zu diesem Mandanten.")).toBeVisible();
    fireEvent.click(screen.getByTestId("order-overlay-backdrop"));
    fireEvent.click(screen.getAllByRole("button", { name: "Auftragskarte schließen" })[1]!);
    expect(mocked.popOrder).toHaveBeenCalledTimes(2);
    expect(mocked.openCustomer).not.toHaveBeenCalled();
  });

  it("returns null for an empty order stack without calling a read port", () => {
    mocked.state.orderStack = [];
    const view = render(<OrderOverlay />);
    expect(view.container).toBeEmptyDOMElement();
    expect(mocked.getLiveOrderCardAction).not.toHaveBeenCalled();
  });

  it("keeps Vorkasse visibly blocked until the canonical invoice is fully paid", async () => {
    render(<OrderOverlay />);
    expect(await screen.findByTestId("f1-5-payment-mode")).toHaveTextContent("Vorkasse");
    expect(screen.getByTestId("f1-5-payment-status")).toHaveTextContent("offen");
    expect(screen.getByText(/Erst der bestätigte Readback öffnet das Ausgangs-Gate/)).toBeVisible();
    expect(screen.getByTestId("f1-5-blocked")).toHaveTextContent("Vorkasse ist noch nicht vollständig bestätigt");
    expect(screen.getByTestId("f1-5-goods-out-action")).toBeDisabled();
    expect(screen.queryByTestId("f1-5-receipt")).not.toBeInTheDocument();
  });

  it("confirms Abholung payment, verifies its readback, then records a separate physical handover", async () => {
    const paidInvoice = {
      ...openInvoice,
      mode: "abholung" as const,
      status: "bezahlt" as const,
      paidAmountCents: 11900,
      openAmountCents: 0,
      method: "bar" as const,
      paidAt: "2026-09-09T10:00:00.000Z",
      receiptId: "receipt-1",
      eventId: PAYMENT_EVENT_ID,
      correlationId: CORRELATION_ID,
      paymentVersion: 1,
      goodsOutAllowed: true,
    };
    const abholungOpen = paymentState({ mode: "abholung", payment: { ...openInvoice, mode: "abholung" } });
    const abholungPaid = paymentState({ mode: "abholung", payment: paidInvoice, paymentActorId: ACTOR_ID, goodsOutAllowed: true });
    const pickedCard = { ...card, version: 5, station: "abgeholt", status: "abgeholt" };
    const pickedState = paymentState({
      ...abholungPaid,
      orderVersion: 5,
      physicalStatus: "abgeholt",
      goodsOutAllowed: false,
      goodsOut: { eventId: GOODS_EVENT_ID, clientEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", correlationId: CORRELATION_ID, eventSchemaVersion: 1, orderVersion: 5, actorId: ACTOR_ID, occurredAt: "2026-09-09T10:01:00.000Z", mode: "abholung" },
    });
    mocked.getOrderPaymentStateAction
      .mockResolvedValueOnce({ code: "OK", data: abholungOpen })
      .mockResolvedValueOnce({ code: "OK", data: abholungPaid })
      .mockResolvedValueOnce({ code: "OK", data: pickedState });
    mocked.getLiveOrderCardAction
      .mockResolvedValueOnce(cardResult())
      .mockResolvedValueOnce(cardResult())
      .mockResolvedValueOnce(cardResult(pickedCard));
    mocked.confirmPaymentAction.mockResolvedValue({
      code: "OK",
      replayed: false,
      receipt: { eventId: PAYMENT_EVENT_ID, invoiceId: openInvoice.invoiceId, invoiceNumber: openInvoice.invoiceNumber, orderId: "order-1", receiptId: "receipt-1", clientEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", correlationId: CORRELATION_ID, eventSchemaVersion: 1, expectedVersion: 0, paymentVersion: 1, amountCents: 11900, grossAmountCents: 11900, paidAmountCents: 11900, openAmountCents: 0, currency: "EUR", paymentMode: "abholung", paymentStatus: "bezahlt", method: "bar", confirmedAt: "2026-09-09T10:00:00.000Z", confirmedBy: ACTOR_ID, source: "manual" },
    });
    mocked.recordGoodsOutAction.mockResolvedValue({
      code: "OK",
      replayed: false,
      receipt: { eventId: GOODS_EVENT_ID, clientEventId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", correlationId: CORRELATION_ID, eventSchemaVersion: 1, expectedVersion: 4, orderVersion: 5, orderId: "order-1", fromStation: "fertig", toStation: "abgeholt", mode: "abholung", paymentMode: "abholung", paymentStatus: "bezahlt", openAmountCents: 0, actorId: ACTOR_ID, occurredAt: "2026-09-09T10:01:00.000Z" },
    });
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .mockReturnValueOnce("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

    render(<OrderOverlay />);
    expect(await screen.findByText(/Erst der bestätigte Readback öffnet das Ausgangs-Gate/)).toBeVisible();
    fireEvent.click(await screen.findByTestId("f1-5-payment-action"));
    await waitFor(() => expect(screen.getByTestId("f1-5-receipt")).toHaveTextContent("Zahlung bestätigt"));
    expect(mocked.confirmPaymentAction).toHaveBeenCalledWith(expect.objectContaining({ amount: 11900, expectedVersion: 0 }));
    fireEvent.click(screen.getByTestId("f1-5-goods-out-mode-abholung"));
    fireEvent.click(screen.getByTestId("f1-5-goods-out-action"));
    await waitFor(() => expect(screen.getByTestId("f1-5-receipt")).toHaveTextContent("Warenausgang bestätigt"));
    expect(mocked.recordGoodsOutAction).toHaveBeenCalledWith(expect.objectContaining({ mode: "abholung", expectedVersion: 4 }));
    expect(mocked.getLiveOrderCardAction).toHaveBeenCalledTimes(1);
    expect(mocked.getOrderPaymentStateAction).toHaveBeenCalledTimes(3);
  });

  it("enforces Rechnung goods-out V2 before invoice V2 and then confirms the later payment", async () => {
    const noInvoice = paymentState({ mode: "rechnung", invoiceState: "not_issued", payment: null, goodsOutAllowed: true });
    const pickedCard = { ...card, version: 5, station: "abgeholt", status: "abgeholt", freeze: { freezeId: "freeze-1", rateId: "rate-1", hourlyRateCents: 6000, totalAmountCents: 11900, lineCount: 1, frozenAt: "2026-09-09T10:00:00.000Z" } };
    const picked = paymentState({
      ...noInvoice,
      orderVersion: 5,
      physicalStatus: "abgeholt",
      goodsOutAllowed: false,
      goodsOut: { eventId: GOODS_EVENT_ID, clientEventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", correlationId: CORRELATION_ID, eventSchemaVersion: 2, orderVersion: 5, actorId: ACTOR_ID, occurredAt: "2026-09-09T11:00:00.000Z", mode: "versand" },
    });
    const issuedInvoice = { ...openInvoice, mode: "rechnung" as const };
    const invoiced = paymentState({ ...picked, invoiceState: "issued", payment: issuedInvoice });
    const paidInvoice = { ...issuedInvoice, status: "bezahlt" as const, paidAmountCents: 11900, openAmountCents: 0, method: "ueberweisung" as const, paidAt: "2026-09-09T11:02:00.000Z", receiptId: "receipt-rechnung", eventId: PAYMENT_EVENT_ID, correlationId: CORRELATION_ID, paymentVersion: 1, goodsOutAllowed: false };
    const paid = paymentState({ ...invoiced, payment: paidInvoice, paymentActorId: ACTOR_ID });
    mocked.getOrderPaymentStateAction
      .mockResolvedValueOnce({ code: "OK", data: noInvoice })
      .mockResolvedValueOnce({ code: "OK", data: picked })
      .mockResolvedValueOnce({ code: "OK", data: invoiced })
      .mockResolvedValueOnce({ code: "OK", data: paid });
    mocked.getLiveOrderCardAction.mockResolvedValueOnce(cardResult({ ...card, freeze: pickedCard.freeze }));
    mocked.recordGoodsOutAction.mockResolvedValue({ code: "OK", replayed: false, receipt: { eventId: GOODS_EVENT_ID, clientEventId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", correlationId: CORRELATION_ID, eventSchemaVersion: 2, expectedVersion: 4, orderVersion: 5, orderId: "order-1", fromStation: "fertig", toStation: "abgeholt", mode: "versand", paymentMode: "rechnung", invoiceState: "not_issued", actorId: ACTOR_ID, occurredAt: "2026-09-09T11:00:00.000Z" } });
    mocked.confirmPaymentAction.mockResolvedValue({ code: "OK", replayed: false, receipt: { eventId: PAYMENT_EVENT_ID, invoiceId: openInvoice.invoiceId, invoiceNumber: openInvoice.invoiceNumber, orderId: "order-1", receiptId: "receipt-rechnung", clientEventId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", correlationId: CORRELATION_ID, eventSchemaVersion: 1, expectedVersion: 0, paymentVersion: 1, amountCents: 11900, grossAmountCents: 11900, paidAmountCents: 11900, openAmountCents: 0, currency: "EUR", paymentMode: "rechnung", paymentStatus: "bezahlt", method: "ueberweisung", confirmedAt: "2026-09-09T11:02:00.000Z", confirmedBy: ACTOR_ID, source: "manual" } });
    vi.spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("cccccccc-cccc-4ccc-8ccc-cccccccccccc")
      .mockReturnValueOnce("dddddddd-dddd-4ddd-8ddd-dddddddddddd");

    render(<OrderOverlay />);
    expect(await screen.findByTestId("f1-5-no-invoice-values")).toHaveTextContent("weder Betrag noch Zahlungsstatus");
    expect(screen.queryByTestId("f1-5-payment-values")).not.toBeInTheDocument();
    expect(screen.queryByTestId("order-immutable-invoice-panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("f1-5-goods-out-mode-versand"));
    fireEvent.click(screen.getByTestId("f1-5-goods-out-action"));
    await waitFor(() => expect(screen.getByTestId("f1-5-receipt")).toHaveTextContent(GOODS_EVENT_ID));
    const invoiceAction = await screen.findByTestId("order-immutable-invoice-panel");
    expect(invoiceAction).toHaveAttribute("data-after-goods-out", "true");
    fireEvent.click(invoiceAction);
    await waitFor(() => expect(screen.getByTestId("f1-5-invoice-state")).toHaveTextContent("Rechnung R-2026-0001"));
    expect(screen.getByText("Spätere Zahlung bestätigen")).toBeVisible();
    expect(screen.getByText(/Der Warenausgang ist bereits bestätigt; die spätere Zahlung wird separat mit Readback dokumentiert/)).toBeVisible();
    expect(screen.queryByText(/Erst der bestätigte Readback öffnet das Ausgangs-Gate/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Zahlungsart"), { target: { value: "ueberweisung" } });
    fireEvent.click(screen.getByTestId("f1-5-payment-action"));
    await waitFor(() => expect(screen.getByTestId("f1-5-receipt")).toHaveTextContent("Zahlung bestätigt"));
    expect(mocked.confirmPaymentAction).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: openInvoice.invoiceId, amount: 11900, method: "ueberweisung" }));
    expect(mocked.getLiveOrderCardAction).toHaveBeenCalledTimes(1);
    expect(mocked.getOrderPaymentStateAction).toHaveBeenCalledTimes(4);
  });

  it.each([
    ["FORBIDDEN", "denied", "Zugriff nicht erlaubt"],
    ["NOT_FOUND", "empty", "Keine Ausgangsdaten"],
    ["UNAVAILABLE", "error", "Status nicht sicher verfügbar"],
  ])("renders %s as the honest %s state", async (code, _state, heading) => {
    mocked.getOrderPaymentStateAction.mockResolvedValue({ code, message: "Sicherer Testzustand." });
    render(<OrderOverlay />);
    expect(await screen.findByText(heading)).toBeVisible();
    expect(screen.queryByTestId("f1-5-goods-out-action")).not.toBeInTheDocument();
  });

  it("reloads on CONFLICT and never claims success", async () => {
    const paidInvoice = { ...openInvoice, status: "bezahlt" as const, paidAmountCents: 11900, openAmountCents: 0, method: "bar" as const, paidAt: "2026-09-09T10:00:00.000Z", receiptId: "receipt-1", eventId: PAYMENT_EVENT_ID, correlationId: CORRELATION_ID, paymentVersion: 1, goodsOutAllowed: true };
    const ready = paymentState({ payment: paidInvoice, paymentActorId: ACTOR_ID, goodsOutAllowed: true });
    mocked.getOrderPaymentStateAction.mockResolvedValue({ code: "OK", data: ready });
    mocked.recordGoodsOutAction.mockResolvedValue({ code: "CONFLICT", message: "Auftrag wurde bereits geändert." });
    render(<OrderOverlay />);
    fireEvent.click(await screen.findByTestId("f1-5-goods-out-mode-abholung"));
    fireEvent.click(screen.getByTestId("f1-5-goods-out-action"));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Der Auftrag wurde neu geladen"));
    expect(mocked.getLiveOrderCardAction).toHaveBeenCalledTimes(1);
    expect(mocked.getOrderPaymentStateAction).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId("f1-5-receipt")).not.toBeInTheDocument();
  });
});
