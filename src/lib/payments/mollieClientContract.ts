const MOLLIE_PAYMENT_ID = /^tr_[A-Za-z0-9]{1,64}$/;
const MAX_PAYMENT_CENTS = 100_000_000;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function isValidMolliePaymentId(value: unknown): value is string {
  return typeof value === "string" && MOLLIE_PAYMENT_ID.test(value);
}

export function normalizeMollieCheckoutUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2_048) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (
      url.protocol !== "https:"
      || (url.port !== "" && url.port !== "443")
      || url.username !== ""
      || url.password !== ""
      || (hostname !== "mollie.com" && !hostname.endsWith(".mollie.com"))
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export type PaymentIntentApiSuccess = {
  success: true;
  intentId: string;
  checkoutUrl: string;
  amountCents: number;
};

export function parsePaymentIntentApiSuccess(value: unknown): PaymentIntentApiSuccess | null {
  const candidate = record(value);
  if (!candidate || !hasExactKeys(candidate, ["success", "intentId", "checkoutUrl", "amountCents"])) {
    return null;
  }
  const checkoutUrl = normalizeMollieCheckoutUrl(candidate.checkoutUrl);
  if (
    candidate.success !== true
    || !isValidMolliePaymentId(candidate.intentId)
    || !checkoutUrl
    || !Number.isSafeInteger(candidate.amountCents)
    || Number(candidate.amountCents) <= 0
    || Number(candidate.amountCents) > MAX_PAYMENT_CENTS
  ) {
    return null;
  }
  return {
    success: true,
    intentId: candidate.intentId,
    checkoutUrl,
    amountCents: Number(candidate.amountCents),
  };
}

export type PaymentStatusApiSuccess = {
  success: true;
  status: string;
  providerStatus: string | null;
};

function boundedStatus(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 80 ? normalized : null;
}

export function parsePaymentStatusApiSuccess(value: unknown): PaymentStatusApiSuccess | null {
  const candidate = record(value);
  if (!candidate || !hasExactKeys(candidate, ["success", "status", "providerStatus"])) return null;
  const status = boundedStatus(candidate.status);
  const providerStatus = candidate.providerStatus === null ? null : boundedStatus(candidate.providerStatus);
  if (candidate.success !== true || !status || (candidate.providerStatus !== null && !providerStatus)) return null;
  return { success: true, status, providerStatus };
}

export function boundedApiError(value: unknown, fallback: string): string {
  const candidate = record(value);
  const error = candidate?.error;
  return typeof error === "string" && error.trim().length > 0 && error.length <= 300
    ? error.trim()
    : fallback;
}
