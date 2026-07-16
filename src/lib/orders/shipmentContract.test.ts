import { describe, expect, it } from "vitest";
import { getHandoverEventType, parseCompleteHandoverInput } from "@/lib/orders/shipmentContract";

const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("shipmentContract", () => {
  it("normalizes a manually confirmed shipment receipt", () => {
    expect(parseCompleteHandoverInput({
      orderId: "order-1",
      clientRequestId: requestId,
      method: "shipment",
      carrier: " Spedition Muster ",
      reference: " Frachtbrief 42 ",
      confirmed: true,
    })).toEqual({
      orderId: "order-1",
      clientRequestId: requestId,
      method: "shipment",
      carrier: "Spedition Muster",
      reference: "Frachtbrief 42",
      confirmed: true,
    });
    expect(getHandoverEventType("shipment")).toBe("SHIPMENT_SENT");
  });

  it("requires named recipient and receipt reference for pickup", () => {
    expect(parseCompleteHandoverInput({
      orderId: "order-1",
      clientRequestId: requestId,
      method: "pickup",
      recipient: " Michael Muster ",
      reference: " Abholschein 17 ",
      confirmed: true,
    })).toMatchObject({ recipient: "Michael Muster", reference: "Abholschein 17" });
    expect(getHandoverEventType("pickup")).toBe("CUSTOMER_PICKUP");
  });

  it.each([
    { orderId: "order-1", clientRequestId: requestId, method: "shipment", carrier: "DHL", reference: "R-1" },
    { orderId: "order-1", clientRequestId: requestId, method: "shipment", reference: "R-1", confirmed: true },
    { orderId: "order-1", clientRequestId: requestId, method: "pickup", reference: "R-1", confirmed: true },
    { orderId: "order-1", clientRequestId: requestId, method: "pickup", recipient: "M. Muster", reference: "", confirmed: true },
    { orderId: "order-1", clientRequestId: requestId, method: "pickup", recipient: "M. Muster", reference: "R-1", carrier: "DHL", confirmed: true },
  ])("rejects incomplete or ambiguous evidence %#", (input) => {
    expect(() => parseCompleteHandoverInput(input)).toThrow("INVALID_HANDOVER");
  });
});
