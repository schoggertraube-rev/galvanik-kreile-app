import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { corsHeaders, handleCors, requireServiceRole } from "../_shared/security.ts";
import {
  assessReusablePayment,
  fixedAmountCents,
  isValidMolliePaymentId,
  verifyMolliePayment,
  webhookAdmissionToken,
  webhookTokenHash,
} from "../_shared/molliePaymentState.ts";

type SupabaseClient = ReturnType<typeof createClient>;

type PaymentQuote = {
  amountEur: string;
  amountCents: number;
  quoteDigest: string;
};

type Reservation = {
  paymentId: string;
  wasCreated: boolean;
  status: string;
  providerIntentId: string | null;
  amountEur: string;
  quoteDigest: string | null;
  webhookTokenHash: string | null;
  createdAt: string;
};

class HttpError extends Error {
  constructor(readonly status: number, readonly publicMessage: string) {
    super(publicMessage);
  }
}

function json(cors: Record<string, string>, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function configuredUrl(name: string): URL {
  const raw = Deno.env.get(name);
  if (!raw) throw new Error(`${name} is not configured`);
  const url = new URL(raw);
  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) throw new Error(`${name} must use HTTPS`);
  return url;
}

function firstRow(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const first = value[0];
    return first && typeof first === "object" ? first as Record<string, unknown> : null;
  }
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function safeInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("INVALID_INTEGER");
  return parsed;
}

async function boundedJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.length > 1_000_000) throw new Error("PROVIDER_RESPONSE_TOO_LARGE");
  return JSON.parse(text);
}

async function getQuote(
  supabase: SupabaseClient,
  tenantId: string,
  orderId: string,
): Promise<PaymentQuote> {
  const { data, error } = await supabase.rpc("get_mollie_payment_quote", {
    p_tenant_id: tenantId,
    p_order_id: orderId,
  });
  if (error) throw error;
  const row = firstRow(data);
  const amountEur = typeof row?.amount_eur === "string" || typeof row?.amount_eur === "number"
    ? String(row.amount_eur)
    : "";
  const amountCents = safeInteger(row?.amount_cents);
  const quoteDigest = typeof row?.quote_digest === "string" ? row.quote_digest : "";
  if (fixedAmountCents(amountEur) !== amountCents || !/^[a-f0-9]{64}$/.test(quoteDigest)) {
    throw new Error("INVALID_PAYMENT_QUOTE");
  }
  return { amountEur, amountCents, quoteDigest };
}

async function reserve(
  supabase: SupabaseClient,
  attemptId: string,
  tenantId: string,
  orderId: string,
  quote: PaymentQuote,
  tokenHash: string,
): Promise<Reservation> {
  const { data, error } = await supabase.rpc("reserve_mollie_payment_attempt", {
    p_attempt_id: attemptId,
    p_tenant_id: tenantId,
    p_order_id: orderId,
    p_amount_cents: quote.amountCents,
    p_quote_digest: quote.quoteDigest,
    p_webhook_token_hash: tokenHash,
  });
  if (error) throw error;
  const row = firstRow(data);
  if (!row || typeof row.payment_id !== "string" || typeof row.payment_status !== "string") {
    throw new Error("INVALID_PAYMENT_RESERVATION_RESPONSE");
  }
  return {
    paymentId: row.payment_id,
    wasCreated: row.was_created === true,
    status: row.payment_status,
    providerIntentId: typeof row.provider_intent_id === "string" ? row.provider_intent_id : null,
    amountEur: String(row.reserved_amount_eur ?? ""),
    quoteDigest: typeof row.reserved_quote_digest === "string" ? row.reserved_quote_digest : null,
    webhookTokenHash: typeof row.reserved_webhook_token_hash === "string"
      ? row.reserved_webhook_token_hash
      : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
  };
}

async function recordState(
  supabase: SupabaseClient,
  reservation: Reservation,
  providerStatus: string,
  targetStatus: "pending" | "failed" | "review_required",
): Promise<void> {
  const safeStatus = /^[a-z_]{1,64}$/.test(providerStatus) ? providerStatus : "unknown";
  const { error } = await supabase.rpc("record_mollie_payment_state", {
    p_payment_id: reservation.paymentId,
    p_provider_intent_id: reservation.providerIntentId,
    p_provider_status: safeStatus,
    p_target_status: targetStatus,
  });
  if (error) throw error;
}

async function bindProvider(
  supabase: SupabaseClient,
  reservation: Reservation,
  providerIntentId: string,
  providerStatus: string,
): Promise<void> {
  const safeStatus = /^[a-z_]{1,64}$/.test(providerStatus) ? providerStatus : "unknown";
  const { error } = await supabase.rpc("bind_mollie_payment_provider", {
    p_payment_id: reservation.paymentId,
    p_provider_intent_id: providerIntentId,
    p_provider_status: safeStatus,
    p_expected_amount_cents: fixedAmountCents(reservation.amountEur),
    p_expected_quote_digest: reservation.quoteDigest,
  });
  if (error) throw error;
  reservation.providerIntentId = providerIntentId;
  reservation.status = "pending";
}

async function mollieGet(paymentId: string, mollieKey: string): Promise<Response> {
  return fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${mollieKey}` },
    signal: AbortSignal.timeout(12_000),
  });
}

async function cancelMollie(paymentId: string, mollieKey: string): Promise<Response> {
  return fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(paymentId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${mollieKey}` },
    signal: AbortSignal.timeout(12_000),
  });
}

serve(async (req) => {
  const cors = corsHeaders(req);
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const unauthorized = requireServiceRole(req);
  if (unauthorized) return unauthorized;
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: cors });

  try {
    const body = await req.json();
    const keys = body && typeof body === "object" ? Object.keys(body) : [];
    const orderId = keys.length === 1 && keys[0] === "orderId" && typeof body.orderId === "string"
      ? body.orderId.trim()
      : "";
    if (!orderId || orderId.length > 128) {
      return json(cors, { error: "Only a valid orderId is accepted" }, 400);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const tenantId = Deno.env.get("KREILE_TENANT_ID") ?? "galvanik-kreile";
    const mollieKey = Deno.env.get("MOLLIE_API_KEY");
    const admissionSecret = Deno.env.get("MOLLIE_WEBHOOK_ADMISSION_SECRET");
    if (!url || !serviceRole || !mollieKey || !admissionSecret) {
      throw new Error("Payment service is not configured");
    }
    if (admissionSecret.length < 32) throw new Error("Webhook admission secret is too short");

    const supabase = createClient(url, serviceRole);
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, order_number, tenant_id")
      .eq("id", orderId)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return json(cors, { error: "Not found" }, 404);

    const quote = await getQuote(supabase, tenantId, order.id);
    const proposedAttemptId = crypto.randomUUID();
    const proposedToken = await webhookAdmissionToken(
      admissionSecret,
      proposedAttemptId,
      tenantId,
      order.id,
      quote.quoteDigest,
    );
    const proposedTokenHash = await webhookTokenHash(proposedToken);
    let reservation = await reserve(
      supabase,
      proposedAttemptId,
      tenantId,
      order.id,
      quote,
      proposedTokenHash,
    );

    for (let pass = 0; pass < 2; pass += 1) {
      if (reservation.status === "pending" && reservation.providerIntentId) {
        const currentResponse = await mollieGet(reservation.providerIntentId, mollieKey);
        if (currentResponse.status === 404) {
          await recordState(supabase, reservation, "provider_not_found", "failed");
          reservation = await reserve(
            supabase,
            proposedAttemptId,
            tenantId,
            order.id,
            quote,
            proposedTokenHash,
          );
          continue;
        }
        if (!currentResponse.ok) throw new HttpError(503, "Payment provider temporarily unavailable");
        const remote = await boundedJson(currentResponse);
        const localCents = fixedAmountCents(reservation.amountEur);
        const localDigest = reservation.quoteDigest ?? "";
        const verification = verifyMolliePayment(remote, {
          providerIntentId: reservation.providerIntentId,
          paymentAttemptId: reservation.paymentId,
          localAmountEur: reservation.amountEur,
          localQuoteDigest: localDigest,
          expectedAmountCents: localCents,
          expectedQuoteDigest: localDigest,
          orderId: order.id,
          tenantId,
        });
        if (!verification.verified) {
          await recordState(supabase, reservation, `truth_${verification.reason}`, "review_required");
          throw new HttpError(409, "Existing payment requires manual review");
        }

        const providerPayment = verification.payment;
        const quoteIsCurrent = localCents === quote.amountCents && localDigest === quote.quoteDigest;
        if (!quoteIsCurrent) {
          if (providerPayment.terminal) {
            await recordState(supabase, reservation, providerPayment.status, "failed");
            reservation = await reserve(
              supabase,
              proposedAttemptId,
              tenantId,
              order.id,
              quote,
              proposedTokenHash,
            );
            continue;
          }
          if (providerPayment.status === "open" && providerPayment.isCancelable) {
            const canceled = await cancelMollie(providerPayment.id, mollieKey);
            if (canceled.ok || canceled.status === 404) {
              await recordState(supabase, reservation, "canceled_stale_quote", "failed");
              reservation = await reserve(
                supabase,
                proposedAttemptId,
                tenantId,
                order.id,
                quote,
                proposedTokenHash,
              );
              continue;
            }
            if (canceled.status !== 422) {
              throw new HttpError(503, "Payment provider temporarily unavailable");
            }
          }
          await recordState(supabase, reservation, providerPayment.status || "unknown", "pending");
          throw new HttpError(409, "Existing payment is still processing");
        }

        const reuse = assessReusablePayment(remote, {
          providerIntentId: reservation.providerIntentId,
          paymentAttemptId: reservation.paymentId,
          localAmountEur: reservation.amountEur,
          localQuoteDigest: localDigest,
          expectedAmountCents: quote.amountCents,
          expectedQuoteDigest: quote.quoteDigest,
          orderId: order.id,
          tenantId,
        });
        if (reuse.reusable) {
          return json(cors, {
            success: true,
            intentId: reuse.intentId,
            checkoutUrl: reuse.checkoutUrl,
            reused: true,
          });
        }
        if (reuse.terminal) {
          await recordState(supabase, reservation, verification.payment.status, "failed");
          reservation = await reserve(
            supabase,
            proposedAttemptId,
            tenantId,
            order.id,
            quote,
            proposedTokenHash,
          );
          continue;
        }
        if (reuse.processing || reuse.paid) {
          await recordState(supabase, reservation, verification.payment.status, "pending");
          throw new HttpError(409, "Existing payment is still processing");
        }
        await recordState(supabase, reservation, `reuse_${reuse.reason}`, "review_required");
        throw new HttpError(409, "Existing payment requires manual review");
      }

      if (reservation.status !== "creating" || reservation.providerIntentId) {
        throw new HttpError(409, "Payment state does not allow a new checkout");
      }
      const reservedCents = fixedAmountCents(reservation.amountEur);
      if (reservedCents !== quote.amountCents || reservation.quoteDigest !== quote.quoteDigest) {
        await recordState(supabase, reservation, "creation_quote_stale", "review_required");
        throw new HttpError(409, "Payment quote changed during creation");
      }

      const createdAt = Date.parse(reservation.createdAt);
      if (!Number.isFinite(createdAt) || Date.now() - createdAt >= 50 * 60 * 1000) {
        await recordState(supabase, reservation, "creation_recovery_expired", "review_required");
        throw new HttpError(409, "Payment creation requires manual review");
      }

      const admissionToken = await webhookAdmissionToken(
        admissionSecret,
        reservation.paymentId,
        tenantId,
        order.id,
        quote.quoteDigest,
      );
      const admissionTokenHash = await webhookTokenHash(admissionToken);
      if (reservation.webhookTokenHash !== admissionTokenHash) {
        await recordState(supabase, reservation, "admission_secret_mismatch", "review_required");
        throw new HttpError(409, "Payment creation requires manual review");
      }

      const appBase = configuredUrl("APP_BASE_URL");
      const webhookUrl = configuredUrl("MOLLIE_WEBHOOK_URL");
      webhookUrl.searchParams.set("admission", admissionToken);
      const mollieResponse = await fetch("https://api.mollie.com/v2/payments", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${mollieKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": reservation.paymentId,
        },
        body: JSON.stringify({
          amount: { currency: "EUR", value: (quote.amountCents / 100).toFixed(2) },
          description: `Auftrag ${order.order_number}`,
          redirectUrl: new URL(`/orders/${encodeURIComponent(order.id)}?payment=success`, appBase).toString(),
          webhookUrl: webhookUrl.toString(),
          metadata: {
            orderId: order.id,
            tenantId,
            quoteDigest: quote.quoteDigest,
            amountCents: quote.amountCents,
            paymentAttemptId: reservation.paymentId,
          },
        }),
        signal: AbortSignal.timeout(12_000),
      });
      const payment = await boundedJson(mollieResponse);
      if (!mollieResponse.ok) throw new HttpError(502, "Payment provider rejected creation");

      const paymentRecord = payment && typeof payment === "object"
        ? payment as Record<string, unknown>
        : null;
      const providerIntentId = paymentRecord?.id;
      const providerStatus = typeof paymentRecord?.status === "string" ? paymentRecord.status : "unknown";
      if (!isValidMolliePaymentId(providerIntentId)) {
        await recordState(supabase, reservation, "invalid_provider_identity", "review_required");
        throw new HttpError(502, "Payment provider returned an invalid response");
      }

      const verification = verifyMolliePayment(payment, {
        providerIntentId,
        paymentAttemptId: reservation.paymentId,
        localAmountEur: reservation.amountEur,
        localQuoteDigest: reservation.quoteDigest,
        expectedAmountCents: quote.amountCents,
        expectedQuoteDigest: quote.quoteDigest,
        orderId: order.id,
        tenantId,
      });
      await bindProvider(supabase, reservation, providerIntentId, providerStatus);
      if (!verification.verified) {
        await recordState(supabase, reservation, `truth_${verification.reason}`, "review_required");
        throw new HttpError(502, "Payment provider returned an inconsistent response");
      }

      const reuse = assessReusablePayment(payment, {
        providerIntentId,
        paymentAttemptId: reservation.paymentId,
        localAmountEur: reservation.amountEur,
        localQuoteDigest: reservation.quoteDigest,
        expectedAmountCents: quote.amountCents,
        expectedQuoteDigest: quote.quoteDigest,
        orderId: order.id,
        tenantId,
      });
      if (reuse.reusable) {
        return json(cors, {
          success: true,
          intentId: reuse.intentId,
          checkoutUrl: reuse.checkoutUrl,
          reused: false,
        });
      }
      if (verification.payment.terminal) {
        await recordState(supabase, reservation, verification.payment.status, "failed");
      } else if (verification.payment.processing || verification.payment.paid) {
        await recordState(supabase, reservation, verification.payment.status, "pending");
      } else {
        await recordState(supabase, reservation, `creation_${reuse.reason}`, "review_required");
      }
      throw new HttpError(409, "Payment checkout is not available yet");
    }

    throw new HttpError(409, "Payment state could not be reconciled");
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error("Payment creation failed", message);
    if (error instanceof HttpError) return json(cors, { error: error.publicMessage }, error.status);
    if (message.includes("PAYMENT_ALREADY_COMPLETED")) {
      return json(cors, { error: "Order is already paid" }, 409);
    }
    if (message.includes("PAYMENT_ACTIVE_PROVIDER_CONFLICT")) {
      return json(cors, { error: "Another payment is already active for this order" }, 409);
    }
    if (message.includes("PAYMENT_RESERVATION_TRUTH_MISMATCH")) {
      return json(cors, { error: "Existing payment requires manual review" }, 409);
    }
    if (message.includes("PAYMENT_QUOTE_CHANGED") || message.includes("ACTIVE_PAYMENT_LOCKS_QUOTE")) {
      return json(cors, { error: "Payment quote changed; retry" }, 409);
    }
    return json(cors, { error: "Payment creation failed" }, 500);
  }
});
