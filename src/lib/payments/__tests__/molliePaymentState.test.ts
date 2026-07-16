import { describe, expect, it } from "vitest";
import {
  assessReusablePayment,
  fixedAmountCents,
  isValidMolliePaymentId,
  isValidWebhookAdmissionToken,
  verifyMolliePayment,
  webhookAdmissionToken,
  webhookTokenHash,
} from "../../../../supabase/functions/_shared/molliePaymentState.ts";

const digest = "a".repeat(64);
const context = {
  providerIntentId: "tr_payment123",
  paymentAttemptId: "a906ae2a-56e8-493c-a0d3-7c74c31f273d",
  localAmountEur: "120.50",
  localQuoteDigest: digest,
  expectedAmountCents: 12050,
  expectedQuoteDigest: digest,
  orderId: "order-42",
  tenantId: "galvanik-kreile",
};

function remote(overrides: Record<string, unknown> = {}) {
  return {
    id: context.providerIntentId,
    status: "open",
    amount: { currency: "EUR", value: "120.50" },
    metadata: {
      orderId: context.orderId,
      tenantId: context.tenantId,
      quoteDigest: digest,
      amountCents: 12050,
      paymentAttemptId: context.paymentAttemptId,
    },
    isCancelable: true,
    _links: { checkout: { href: "https://www.mollie.com/checkout/example" } },
    ...overrides,
  };
}

describe("Mollie payment truth", () => {
  it("parses fixed monetary values without floating-point acceptance", () => {
    expect(fixedAmountCents("12.30")).toBe(1230);
    expect(() => fixedAmountCents("12.301")).toThrow("INVALID_AMOUNT");
    expect(() => fixedAmountCents("-1.00")).toThrow("INVALID_AMOUNT");
  });

  it("accepts only bounded provider IDs and admission tokens", () => {
    expect(isValidMolliePaymentId("tr_abCD1234")).toBe(true);
    expect(isValidMolliePaymentId("ord_abCD1234")).toBe(false);
    expect(isValidWebhookAdmissionToken("f".repeat(64))).toBe(true);
    expect(isValidWebhookAdmissionToken("f".repeat(65))).toBe(false);
  });

  it("derives an attempt-bound secret token and persists only its digest", async () => {
    const secret = "payment-webhook-admission-secret-32+";
    const token = await webhookAdmissionToken(
      secret,
      context.paymentAttemptId,
      context.tenantId,
      context.orderId,
      digest,
    );
    const same = await webhookAdmissionToken(
      secret,
      context.paymentAttemptId,
      context.tenantId,
      context.orderId,
      digest,
    );
    const other = await webhookAdmissionToken(
      secret,
      "different-attempt",
      context.tenantId,
      context.orderId,
      digest,
    );

    expect(token).toBe(same);
    expect(token).not.toBe(other);
    expect(await webhookTokenHash(token)).toMatch(/^[a-f0-9]{64}$/);
    await expect(webhookAdmissionToken("short", context.paymentAttemptId, context.tenantId, context.orderId, digest))
      .rejects.toThrow("WEBHOOK_ADMISSION_SECRET_TOO_SHORT");
  });

  it("reuses only an exact open payment with a secure checkout URL", () => {
    expect(assessReusablePayment(remote(), context)).toEqual({
      reusable: true,
      checkoutUrl: "https://www.mollie.com/checkout/example",
      intentId: context.providerIntentId,
    });
    expect(assessReusablePayment(remote({ status: "paid" }), context)).toMatchObject({
      reusable: false,
      reason: "paid",
      paid: true,
    });
    expect(assessReusablePayment(remote({ status: "failed" }), context)).toMatchObject({
      reusable: false,
      reason: "terminal",
      terminal: true,
    });
    expect(assessReusablePayment(remote({
      _links: { checkout: { href: "https://www.mollie.com.attacker.example/checkout" } },
    }), context)).toMatchObject({
      reusable: false,
      reason: "checkout_url",
    });
  });

  it("rejects stale amounts, stale quote versions, and foreign metadata", () => {
    expect(verifyMolliePayment(remote(), { ...context, expectedAmountCents: 12100 }))
      .toEqual({ verified: false, reason: "amount_stale" });
    expect(verifyMolliePayment(remote(), { ...context, expectedQuoteDigest: "b".repeat(64) }))
      .toEqual({ verified: false, reason: "quote_stale" });
    expect(verifyMolliePayment(remote({
      metadata: { ...remote().metadata as object, orderId: "foreign-order" },
    }), context)).toEqual({ verified: false, reason: "metadata" });
  });
});
