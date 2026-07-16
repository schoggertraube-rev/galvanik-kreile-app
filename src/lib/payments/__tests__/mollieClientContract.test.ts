import { describe, expect, it } from "vitest";
import {
  normalizeMollieCheckoutUrl,
  parsePaymentIntentApiSuccess,
  parsePaymentStatusApiSuccess,
} from "@/lib/payments/mollieClientContract";

describe("Mollie browser/server response contract", () => {
  it("accepts only HTTPS checkout URLs owned by Mollie", () => {
    expect(normalizeMollieCheckoutUrl("https://www.mollie.com/checkout/abc"))
      .toBe("https://www.mollie.com/checkout/abc");
    expect(normalizeMollieCheckoutUrl("https://mollie.com.evil.example/checkout")).toBeNull();
    expect(normalizeMollieCheckoutUrl("https://user:pass@mollie.com/checkout")).toBeNull();
    expect(normalizeMollieCheckoutUrl("http://www.mollie.com/checkout")).toBeNull();
  });

  it("requires an exact, bounded payment-intent response", () => {
    expect(parsePaymentIntentApiSuccess({
      success: true,
      intentId: "tr_payment123",
      checkoutUrl: "https://www.mollie.com/checkout/abc",
      amountCents: 12_050,
    })).toMatchObject({ intentId: "tr_payment123", amountCents: 12_050 });
    expect(parsePaymentIntentApiSuccess({
      success: true,
      intentId: "tr_payment123",
      checkoutUrl: "https://www.mollie.com.attacker.example/checkout",
      amountCents: 12_050,
    })).toBeNull();
    expect(parsePaymentIntentApiSuccess({
      success: true,
      intentId: "tr_payment123",
      checkoutUrl: "https://www.mollie.com/checkout/abc",
      amountCents: 12_050,
      injected: true,
    })).toBeNull();
  });

  it("accepts only exact, bounded local status responses", () => {
    expect(parsePaymentStatusApiSuccess({
      success: true,
      status: "pending",
      providerStatus: "open",
    })).toEqual({ success: true, status: "pending", providerStatus: "open" });
    expect(parsePaymentStatusApiSuccess({ success: true, status: "", providerStatus: null })).toBeNull();
  });
});
