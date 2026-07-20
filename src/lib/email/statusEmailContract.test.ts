import { describe, expect, it } from "vitest";
import { parseStatusEmailRequest } from "./statusEmailContract";

const requestId = "2e9c6b6d-f7cb-4f2d-8e0d-55b0d221df28";

describe("status email public contract", () => {
  it("accepts only an order, a status template and an order-bound request key", () => {
    expect(parseStatusEmailRequest({
      orderId: "order_1",
      templateKey: "status_update",
      idempotencyKey: `status/order_1/${requestId}`,
    })).toEqual({
      orderId: "order_1",
      templateKey: "status_update",
      idempotencyKey: `status/order_1/${requestId}`,
    });
  });

  it("rejects caller-owned recipients, variables, non-status templates and unrelated request keys", () => {
    expect(() => parseStatusEmailRequest({
      orderId: "order_1",
      templateKey: "status_update",
      idempotencyKey: `status/order_1/${requestId}`,
      to: "attacker@example.com",
    })).toThrow("INVALID_STATUS_EMAIL_REQUEST");
    expect(() => parseStatusEmailRequest({
      orderId: "order_1",
      templateKey: "feedback_request",
      idempotencyKey: `status/order_1/${requestId}`,
    })).toThrow("INVALID_STATUS_EMAIL_REQUEST");
    expect(() => parseStatusEmailRequest({
      orderId: "order_1",
      templateKey: "status_update",
      idempotencyKey: `status/other/${requestId}`,
    })).toThrow("INVALID_STATUS_EMAIL_REQUEST");
  });
});
