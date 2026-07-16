import {
  boundedApiError,
  isValidMolliePaymentId,
  parsePaymentIntentApiSuccess,
  parsePaymentStatusApiSuccess,
} from "./mollieClientContract";
import type {
  PaymentIntentOptions,
  PaymentIntentResult,
  PaymentProvider,
  PaymentStatusResult,
} from "./paymentProvider";

async function readJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 32_768) throw new Error("RESPONSE_TOO_LARGE");
  const body = await response.text();
  if (body.length > 32_768) throw new Error("RESPONSE_TOO_LARGE");
  return JSON.parse(body) as unknown;
}

export class MollieAdapter implements PaymentProvider {
  async createPaymentIntent(opts: PaymentIntentOptions): Promise<PaymentIntentResult> {
    try {
      const response = await fetch("/api/payments/mollie/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: opts.orderId }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        return { success: false, error: boundedApiError(data, "Zahlungsanfrage fehlgeschlagen") };
      }
      const parsed = parsePaymentIntentApiSuccess(data);
      return parsed ?? { success: false, error: "Ungültige Antwort des Zahlungsdienstes" };
    } catch {
      return { success: false, error: "Zahlungsdienst derzeit nicht erreichbar" };
    }
  }

  async getPaymentStatus(intentId: string): Promise<PaymentStatusResult> {
    if (!isValidMolliePaymentId(intentId)) {
      return { success: false, error: "Ungültige Zahlungs-ID" };
    }
    try {
      const response = await fetch(`/api/payments/mollie/status?intentId=${encodeURIComponent(intentId)}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = await readJson(response);
      if (!response.ok) {
        return { success: false, error: boundedApiError(data, "Zahlungsstatus nicht verfügbar") };
      }
      const parsed = parsePaymentStatusApiSuccess(data);
      return parsed ?? { success: false, error: "Ungültige Statusantwort" };
    } catch {
      return { success: false, error: "Zahlungsstatus derzeit nicht erreichbar" };
    }
  }

  supportsTapToPay(): boolean {
    return false;
  }

  async cancelPayment(intentId: string): Promise<{ success: boolean; error?: string }> {
    void intentId;
    return { success: false, error: "Stornierung ist noch nicht angebunden" };
  }
}

export const paymentProvider = new MollieAdapter();
