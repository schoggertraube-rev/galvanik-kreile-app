import { describe, expect, it } from "vitest";
import {
  parseMaterialCaptureInput,
  parseStationCompletionCaptureInput,
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

  it("accepts one bounded, idempotent station completion payload", () => {
    expect(parseStationCompletionCaptureInput({
      orderId: "order_123",
      expectedStation: "galvanik",
      minutes: 45,
      multiplier: 2,
      taskType: "Polieren",
      note: "Zusatzaufwand dokumentiert",
      materials: [{ inventoryItemId: "chemie_1", quantity: 1.25 }],
      clientRequestId: requestId,
    })).toEqual({
      orderId: "order_123",
      expectedStation: "galvanik",
      minutes: 45,
      multiplier: 2,
      taskType: "Polieren",
      note: "Zusatzaufwand dokumentiert",
      materials: [{ inventoryItemId: "chemie_1", quantity: 1.25, templateId: undefined }],
      clientRequestId: requestId,
    });
  });

  it("rejects empty, duplicate, unbounded or client-controlled station completions", () => {
    const valid = {
      orderId: "order_123",
      expectedStation: "galvanik",
      minutes: 15,
      multiplier: 1,
      taskType: "Polieren",
      materials: [] as { inventoryItemId: string; quantity: number }[],
      clientRequestId: requestId,
    };
    expect(() => parseStationCompletionCaptureInput({ ...valid, minutes: 0 })).toThrow("INVALID_CAPTURE");
    expect(() => parseStationCompletionCaptureInput({ ...valid, multiplier: 5 })).toThrow("INVALID_CAPTURE");
    expect(() => parseStationCompletionCaptureInput({ ...valid, tenantId: "other" })).toThrow("INVALID_CAPTURE");
    expect(() => parseStationCompletionCaptureInput({
      ...valid,
      materials: [
        { inventoryItemId: "chemie_1", quantity: 1 },
        { inventoryItemId: "chemie_1", quantity: 2 },
      ],
    })).toThrow("INVALID_CAPTURE");
  });
});
