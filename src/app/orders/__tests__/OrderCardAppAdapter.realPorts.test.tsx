import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  card: vi.fn(), master: vi.fn(), payment: vi.fn(), handoff: vi.fn(), stationReceipt: vi.fn(),
  freeze: vi.fn(), freezeReceipt: vi.fn(), invoice: vi.fn(), invoiceReceipt: vi.fn(), confirmPayment: vi.fn(), goodsOut: vi.fn(),
  attachmentRead: vi.fn(), reserve: vi.fn(), finalize: vi.fn(), openCustomer: vi.fn(), pop: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/app/actions/orders.actions", () => ({ getLiveOrderCardAction: ports.card, getExtraWorkMasterDataAction: ports.master, transitionWareneingangToGalvanikAction: ports.handoff, freezeOrderAction: ports.freeze, getOrderFrozenReceiptAction: ports.freezeReceipt }));
vi.mock("@/app/actions/payments.actions", () => ({ getOrderPaymentStateAction: ports.payment, confirmPaymentAction: ports.confirmPayment }));
vi.mock("@/app/actions/goodsOut.actions", () => ({ recordGoodsOutAction: ports.goodsOut }));
vi.mock("@/app/actions/invoices.actions", () => ({ issueInvoiceAction: ports.invoice, getInvoiceReceiptAction: ports.invoiceReceipt }));
vi.mock("@/app/warendurchlauf/actions", () => ({ getOrderStationReceiptAction: ports.stationReceipt, getGalvanikHandoffAttachmentsAction: ports.attachmentRead, reserveGalvanikHandoffAttachmentAction: ports.reserve, finalizeGalvanikHandoffAttachmentAction: ports.finalize }));
vi.mock("@/lib/auth/PermissionsContext", () => ({ usePermissions: () => ({ role: "admin" }) }));
vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: (selector: (value: { openCustomer: typeof ports.openCustomer; pop: typeof ports.pop }) => unknown) => selector({ openCustomer: ports.openCustomer, pop: ports.pop }) }));
vi.mock("@/lib/supabase/client", () => ({ supabase: { storage: { from: vi.fn() } } }));
vi.mock("@/modules/orders/public", async (original) => {
  const actual = await original<typeof import("@/modules/orders/public")>();
  return { ...actual, OrderCardView: ({ state, actions }: { state: { kind: string; card?: { payment: { kind: string; value?: { mode: string } } } }; actions: { handoff: { visible: boolean }; onHandoff: () => void; feedback: { kind: string } } }) => <div data-testid="adapter-state">{state.kind}{state.card?.payment.kind}:{state.card?.payment.value?.mode}<button disabled={!actions.handoff.visible} onClick={actions.onHandoff}>handoff</button><span>{actions.feedback.kind}</span></div> };
});
import { OrderCardAppAdapter } from "../OrderCardAppAdapter";

const baseCard = { id: "order-1", version: 1, orderNumber: "A-1", customerId: "customer-1", customerName: "Kunde", title: "Teil", note: null, station: "angenommen", status: "angenommen", dueAt: null, intakeAt: "2026-09-10T10:00:00.000Z", assignment: null, assignmentOptions: [], items: [{ id: "item-1", position: 1, name: "Teil", quantity: 1, material: "Stahl", surfaceRequested: "Zink", extraWork: [] }], freeze: null };
const payment = (version = 1, station = "angenommen") => ({ code: "OK", data: { orderId: "order-1", orderNumber: "A-1", orderVersion: version, physicalStatus: station, mode: "vorkasse", paymentModeVersion: 0, invoiceState: "not_issued", payment: null, paymentActorId: null, goodsOut: null, goodsOutAllowed: false } });

describe("OrderCardAppAdapter reale Port-Orchestrierung", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ports.card.mockResolvedValue({ code: "OK", data: { card: baseCard, evidence: [] } });
    ports.master.mockResolvedValue({ code: "OK", data: { currentRate: null, catalog: [] } });
    ports.payment.mockResolvedValue(payment());
  });

  it("liest den persistenten Zahlungsmodus bereits vor fertig", async () => {
    render(<OrderCardAppAdapter orderId="order-1" />);
    expect(await screen.findByTestId("adapter-state")).toHaveTextContent("dataavailable:vorkasse");
    expect(ports.payment).toHaveBeenCalledWith({ orderId: "order-1" });
  });

  it("behält die erlaubte Kernkarte bei einem verweigerten Zahlungsdetail-Read", async () => {
    ports.payment.mockResolvedValue({ code: "FORBIDDEN", message: "Nicht erlaubt." });
    render(<OrderCardAppAdapter orderId="order-1" />);
    await waitFor(() => expect(screen.getByTestId("adapter-state")).toHaveTextContent("datarestricted"));
    expect(screen.getByTestId("adapter-state")).not.toHaveTextContent("denied");
  });

  it("zeigt Erfolg erst nach Command-, Receipt- und Karten-Readback", async () => {
    ports.handoff.mockResolvedValue({ code: "OK", replayed: false, receipt: { eventId: "event-1", clientEventId: "client-1", aggregateVersion: 2, actorId: "actor-1", occurredAt: "2026-09-11T01:00:00.000Z" } });
    ports.stationReceipt.mockResolvedValue({ ok: true, data: { eventId: "event-1" } });
    ports.card.mockResolvedValueOnce({ code: "OK", data: { card: baseCard, evidence: [] } }).mockResolvedValue({ code: "OK", data: { card: { ...baseCard, version: 2, station: "galvanik", status: "galvanik" }, evidence: [] } });
    ports.payment.mockResolvedValueOnce(payment()).mockResolvedValue(payment(2, "galvanik"));
    render(<OrderCardAppAdapter orderId="order-1" />);
    const button = await screen.findByRole("button", { name: "handoff" });
    await act(async () => { fireEvent.click(button); });
    await waitFor(() => expect(screen.getByTestId("adapter-state")).toHaveTextContent("success"));
    expect(ports.stationReceipt).toHaveBeenCalledOnce();
    expect(ports.card).toHaveBeenCalledTimes(2);
  });
});
