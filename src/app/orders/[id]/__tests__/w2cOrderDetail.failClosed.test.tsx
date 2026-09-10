import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({ read: vi.fn(), payment: vi.fn(), openCustomer: vi.fn(), pop: vi.fn() }));
vi.mock("@/app/actions/orders.actions", () => ({ getLiveOrderCardAction: ports.read }));
vi.mock("@/app/actions/payments.actions", () => ({ getOrderPaymentStateAction: ports.payment }));
vi.mock("@/lib/overlayStore", () => ({ useOverlayStore: (selector: (state: { openCustomer: typeof ports.openCustomer; pop: typeof ports.pop }) => unknown) => selector({ openCustomer: ports.openCustomer, pop: ports.pop }) }));
import OrderDetailPage from "../page";

describe("Orders V8 deeplink", () => {
  beforeEach(() => vi.clearAllMocks());
  it("verbindet Karte, Belege und Zahlungsstand nur bei identischem Readback", async () => {
    ports.read.mockResolvedValue({ code: "OK", data: { card: {
      id: "order-1", version: 2, orderNumber: "A-100", customerId: "customer-1", customerName: "Kreile GmbH", title: "Welle", note: null,
      station: "fertig", status: "fertig", dueAt: null, intakeAt: "2026-08-10T08:00:00.000Z", assignment: null, assignmentOptions: [],
      items: [{ id: "item-1", position: 1, name: "Welle", quantity: 1, material: "Stahl", surfaceRequested: "Zink", extraWork: [] }], freeze: { frozenAt: "2026-08-11T08:00:00.000Z", totalAmountCents: 0 },
    }, evidence: [] } });
    ports.payment.mockResolvedValue({ code: "OK", data: { orderId: "order-1", orderNumber: "A-100", orderVersion: 2, physicalStatus: "fertig", mode: "rechnung", paymentModeVersion: 1, invoiceState: "not_issued", payment: null, paymentActorId: null, goodsOut: null, goodsOutAllowed: true } });
    render(await OrderDetailPage({ params: Promise.resolve({ id: "order-1" }) }));
    expect(await screen.findByTestId("order-card-v8")).toHaveTextContent("Rechnung noch nicht gestellt");
    expect(screen.getByText("Versand oder Abholung bestätigen")).toBeVisible();
  });

  it("meldet abweichende Versionen als Konflikt statt Teilstand", async () => {
    ports.read.mockResolvedValue({ code: "OK", data: { card: { id: "order-1", version: 2, orderNumber: "A-100", station: "fertig" }, evidence: [] } });
    ports.payment.mockResolvedValue({ code: "OK", data: { orderId: "order-1", orderNumber: "A-100", orderVersion: 1, physicalStatus: "fertig" } });
    render(await OrderDetailPage({ params: Promise.resolve({ id: "order-1" }) }));
    expect(await screen.findByRole("alert")).toHaveTextContent("nicht überein");
    expect(screen.queryByTestId("order-card-v8")).not.toBeInTheDocument();
  });

  it("liest genau die angeforderte kanonische Karte", async () => {
    ports.read.mockResolvedValue({ code: "NOT_FOUND", message: "Auftrag nicht gefunden." });
    ports.payment.mockResolvedValue({ code: "NOT_FOUND", message: "Zahlungsstand nicht gefunden." });
    render(await OrderDetailPage({ params: Promise.resolve({ id: "order-7" }) }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Auftrag nicht gefunden");
    expect(ports.read).toHaveBeenCalledWith({ orderId: "order-7" });
    expect(ports.payment).not.toHaveBeenCalled();
  });

  it("zeigt keine alte NOT_AVAILABLE-Hülle", async () => {
    ports.read.mockResolvedValue({ code: "FORBIDDEN", message: "Auftragskarte ist nicht erlaubt." });
    ports.payment.mockResolvedValue({ code: "FORBIDDEN", message: "Zahlungsstand ist nicht erlaubt." });
    render(await OrderDetailPage({ params: Promise.resolve({ id: "foreign" }) }));
    expect(await screen.findByRole("alert")).toHaveTextContent("nicht erlaubt");
    expect(screen.queryByText(/NOT_AVAILABLE/)).not.toBeInTheDocument();
  });
});
