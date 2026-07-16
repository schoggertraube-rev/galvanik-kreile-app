export type PaymentTruthContext = {
  providerIntentId: string;
  paymentAttemptId: string;
  localAmountEur: string | number | null;
  localQuoteDigest: string | null;
  expectedAmountCents: number;
  expectedQuoteDigest: string;
  orderId: string;
  tenantId: string;
};

export type VerifiedPayment = {
  id: string;
  status: string;
  checkoutUrl: string | null;
  isCancelable: boolean;
  terminal: boolean;
  processing: boolean;
  paid: boolean;
};

export type VerificationDecision =
  | { verified: true; payment: VerifiedPayment }
  | { verified: false; reason: string };

export type ReuseDecision =
  | { reusable: true; checkoutUrl: string; intentId: string }
  | {
      reusable: false;
      reason: string;
      terminal: boolean;
      processing: boolean;
      paid: boolean;
    };

const TERMINAL_PROVIDER_STATES = new Set(["canceled", "expired", "failed"]);
const PROCESSING_PROVIDER_STATES = new Set(["pending", "authorized"]);
const PAYMENT_ID = /^tr_[A-Za-z0-9]{1,64}$/;
const ADMISSION_TOKEN = /^[a-f0-9]{64}$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;

export function isValidMolliePaymentId(value: unknown): value is string {
  return typeof value === "string" && PAYMENT_ID.test(value);
}

export function isValidWebhookAdmissionToken(value: unknown): value is string {
  return typeof value === "string" && ADMISSION_TOKEN.test(value);
}

export function fixedAmountCents(value: string | number | null): number {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(String(value ?? "").trim());
  if (!match) throw new Error("INVALID_AMOUNT");
  const fraction = (match[2] ?? "").padEnd(2, "0");
  if (fraction.length > 2) throw new Error("INVALID_AMOUNT");
  const result = Number(match[1]) * 100 + Number(fraction || "0");
  if (!Number.isSafeInteger(result)) throw new Error("INVALID_AMOUNT");
  return result;
}

async function digestHex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function webhookAdmissionToken(
  secret: string,
  paymentAttemptId: string,
  tenantId: string,
  orderId: string,
  quoteDigest: string,
): Promise<string> {
  if (secret.length < 32) throw new Error("WEBHOOK_ADMISSION_SECRET_TOO_SHORT");
  if (!paymentAttemptId || !tenantId || !orderId || !SHA256_HEX.test(quoteDigest)) {
    throw new Error("INVALID_WEBHOOK_ADMISSION_CONTEXT");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${paymentAttemptId}:${tenantId}:${orderId}:${quoteDigest}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function webhookTokenHash(token: string): Promise<string> {
  if (!isValidWebhookAdmissionToken(token)) throw new Error("INVALID_WEBHOOK_ADMISSION_TOKEN");
  return digestHex(token);
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function trustedCheckoutUrl(value: unknown): string | null {
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
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function verifyMolliePayment(
  remoteValue: unknown,
  context: PaymentTruthContext,
): VerificationDecision {
  const remote = record(remoteValue);
  if (!remote || remote.id !== context.providerIntentId || !isValidMolliePaymentId(remote.id)) {
    return { verified: false, reason: "provider_identity" };
  }

  const amount = record(remote.amount);
  if (amount?.currency !== "EUR") return { verified: false, reason: "currency" };

  let remoteCents: number;
  let localCents: number;
  try {
    remoteCents = fixedAmountCents(typeof amount?.value === "string" ? amount.value : null);
    localCents = fixedAmountCents(context.localAmountEur);
  } catch {
    return { verified: false, reason: "amount_format" };
  }
  if (
    remoteCents !== context.expectedAmountCents ||
    localCents !== context.expectedAmountCents
  ) {
    return { verified: false, reason: "amount_stale" };
  }
  if (
    !context.localQuoteDigest ||
    context.localQuoteDigest !== context.expectedQuoteDigest ||
    !SHA256_HEX.test(context.expectedQuoteDigest)
  ) {
    return { verified: false, reason: "quote_stale" };
  }

  const metadata = record(remote.metadata);
  if (
    metadata?.orderId !== context.orderId ||
    metadata?.tenantId !== context.tenantId ||
    metadata?.quoteDigest !== context.expectedQuoteDigest ||
    metadata?.amountCents !== context.expectedAmountCents ||
    metadata?.paymentAttemptId !== context.paymentAttemptId
  ) {
    return { verified: false, reason: "metadata" };
  }

  const status = typeof remote.status === "string" ? remote.status : "";
  const links = record(remote._links);
  const checkout = record(links?.checkout);
  const checkoutUrl = trustedCheckoutUrl(checkout?.href);

  return {
    verified: true,
    payment: {
      id: remote.id,
      status,
      checkoutUrl,
      isCancelable: remote.isCancelable === true,
      terminal: TERMINAL_PROVIDER_STATES.has(status),
      processing: PROCESSING_PROVIDER_STATES.has(status),
      paid: status === "paid",
    },
  };
}

export function assessReusablePayment(
  remoteValue: unknown,
  context: PaymentTruthContext,
): ReuseDecision {
  const verification = verifyMolliePayment(remoteValue, context);
  if (!verification.verified) {
    return {
      reusable: false,
      reason: verification.reason,
      terminal: false,
      processing: false,
      paid: false,
    };
  }

  const { payment } = verification;
  if (payment.status !== "open") {
    return {
      reusable: false,
      reason: payment.terminal ? "terminal" : payment.paid ? "paid" : payment.processing ? "processing" : "status",
      terminal: payment.terminal,
      processing: payment.processing,
      paid: payment.paid,
    };
  }
  if (!payment.checkoutUrl) {
    return {
      reusable: false,
      reason: "checkout_url",
      terminal: false,
      processing: false,
      paid: false,
    };
  }

  return {
    reusable: true,
    checkoutUrl: payment.checkoutUrl,
    intentId: payment.id,
  };
}
