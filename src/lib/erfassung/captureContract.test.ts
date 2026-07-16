import { describe, expect, it } from "vitest";
import {
  parseMaterialCaptureInput,
  parseTemplateCaptureInput,
  parseTimeCaptureInput,
} from "./captureContract";

const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("capture input contract", () => {
  it("accepts a bounded direct time booking without client identity or tenant", () => {
    expect(parseTimeCaptureInput({
      orderId: "order_123",
      stationKuerzel: "galvanik",
      minutes: 45,
      clientRequestId: requestId,
    })).toEqual({
      orderId: "order_123",
      stationKuerzel: "galvanik",
      minutes: 45,
      clientRequestId: requestId,
      templateId: undefined,
    });
  });

  it("rejects client-controlled actor, tenant, unknown fields and invalid quantities", () => {
    expect(() => parseTimeCaptureInput({
      orderId: "order_123",
      stationKuerzel: "galvanik",
      minutes: 45,
      clientRequestId: requestId,
      employeeId: "attacker",
    })).toThrow("INVALID_CAPTURE");
    expect(() => parseMaterialCaptureInput({
      orderId: "order_123",
      stationKuerzel: "galvanik",
      clientRequestId: requestId,
      tenantId: "other",
      materials: [{ inventoryItemId: "chemie", quantity: 1 }],
    })).toThrow("INVALID_CAPTURE");
    expect(() => parseMaterialCaptureInput({
      orderId: "order_123",
      stationKuerzel: "galvanik",
      clientRequestId: requestId,
      materials: [{ inventoryItemId: "chemie", quantity: -1 }],
    })).toThrow("INVALID_CAPTURE");
  });

  it("rejects duplicate material rows so one request has one unambiguous effect", () => {
    expect(() => parseMaterialCaptureInput({
      orderId: "order_123",
      stationKuerzel: "galvanik",
      clientRequestId: requestId,
      materials: [
        { inventoryItemId: "chemie", quantity: 1 },
        { inventoryItemId: "chemie", quantity: 2 },
      ],
    })).toThrow("INVALID_CAPTURE");
  });

  it("accepts only a v4 idempotency key for template application", () => {
    expect(parseTemplateCaptureInput({ orderId: "order_123", clientRequestId: requestId })).toEqual({
      orderId: "order_123",
      clientRequestId: requestId,
    });
    expect(() => parseTemplateCaptureInput({ orderId: "order_123", clientRequestId: "not-a-uuid" })).toThrow("INVALID_CAPTURE");
  });
});
