import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import {
  fixedAmountCents,
  isValidMolliePaymentId,
  isValidWebhookAdmissionToken,
  verifyMolliePayment,
  webhookTokenHash,
} from "../_shared/molliePaymentState.ts";

type SupabaseClient = ReturnType<typeof createClient>;

type LocalPayment = {
  id: string;
  tenant_id: string;
  order_id: string;
  amount_eur: string | number;
  status: string;
  provider_intent_id: string | null;
  quote_digest: string | null;
};

function ok(message = "OK"): Response {
  return new Response(message, { status: 200 });
}

async function paymentId(req: Request): Promise<string | null> {
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > 2_048) return null;

  try {
    const raw = await req.text();
    if (raw.length > 2_048) return null;
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = JSON.parse(raw);
      return isValidMolliePaymentId(body?.id) ? body.id : null;
    }
    const id = new URLSearchParams(raw).get("id");
    return isValidMolliePaymentId(id) ? id : null;
  } catch {
    return null;
  }
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

async function recordState(
  supabase: SupabaseClient,
  local: LocalPayment,
  providerStatus: string,
  targetStatus: "pending" | "failed" | "review_required",
): Promise<void> {
  const safeStatus = /^[a-z_]{1,64}$/.test(providerStatus) ? providerStatus : "unknown";
  const { error } = await supabase.rpc("record_mollie_payment_state", {
    p_payment_id: local.id,
    p_provider_intent_id: local.provider_intent_id,
    p_provider_status: safeStatus,
    p_target_status: targetStatus,
  });
  if (error) throw error;
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const id = await paymentId(req);
    const admission = new URL(req.url).searchParams.get("admission");
    if (!id || !isValidWebhookAdmissionToken(admission)) return ok();

    const mollieKey = Deno.env.get("MOLLIE_API_KEY");
    const url = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const tenantId = Deno.env.get("KREILE_TENANT_ID") ?? "galvanik-kreile";
    if (!mollieKey || !url || !serviceRole) throw new Error("Webhook is not configured");

    const supabase = createClient(url, serviceRole);
    const tokenHash = await webhookTokenHash(admission);

    // Local high-entropy admission happens before provider I/O. Unknown callbacks
    // are acknowledged with zero requests to Mollie.
    const { data: localValue, error: paymentError } = await supabase
      .from("payments")
      .select("id, tenant_id, order_id, amount_eur, status, provider_intent_id, quote_digest")
      .eq("webhook_token_hash", tokenHash)
      .eq("provider", "mollie")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!localValue) return ok();

    const local = localValue as LocalPayment;
    if (local.status === "failed" || local.status === "review_required") return ok();
    if (!local.provider_intent_id) {
      // Provider callback won the creation/binding race. Mollie retries non-2xx;
      // the deterministic idempotency key lets creation recover safely.
      return new Response("Payment binding in progress", { status: 503 });
    }
    if (local.provider_intent_id !== id) return ok();

    // Mollie Classic sends only an ID. Provider retrieval is the authenticity
    // check, but it is performed only after local token + payment admission.
    const mollieResponse = await fetch(`https://api.mollie.com/v2/payments/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${mollieKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (mollieResponse.status === 404) {
      if (local.status !== "completed") {
        await recordState(supabase, local, "provider_not_found", "review_required");
      }
      return ok();
    }
    if (!mollieResponse.ok) throw new Error("Mollie verification request failed");
    const remote = await boundedJson(mollieResponse);

    const localCents = fixedAmountCents(local.amount_eur);
    const localDigest = local.quote_digest ?? "";
    const verification = verifyMolliePayment(remote, {
      providerIntentId: id,
      paymentAttemptId: local.id,
      localAmountEur: local.amount_eur,
      localQuoteDigest: localDigest,
      expectedAmountCents: localCents,
      expectedQuoteDigest: localDigest,
      orderId: local.order_id,
      tenantId,
    });
    if (!verification.verified) {
      console.error("Mollie webhook truth mismatch", { paymentId: id, reason: verification.reason });
      if (local.status !== "completed") {
        await recordState(supabase, local, `truth_${verification.reason}`, "review_required");
      }
      return ok();
    }

    const providerPayment = verification.payment;
    if (local.status === "completed") {
      // Finalization is already sealed. A valid paid retry is idempotent; any
      // later provider-state divergence is logged without downgrading paid truth.
      if (!providerPayment.paid) {
        console.error("Completed Mollie payment changed provider state", {
          paymentId: id,
          providerStatus: providerPayment.status,
        });
      }
      return ok();
    }

    if (providerPayment.terminal) {
      await recordState(supabase, local, providerPayment.status, "failed");
      return ok();
    }
    if (providerPayment.status === "open" || providerPayment.processing) {
      await recordState(supabase, local, providerPayment.status || "unknown", "pending");
      return ok();
    }
    if (!providerPayment.paid) {
      await recordState(supabase, local, providerPayment.status || "unknown", "review_required");
      return ok();
    }

    const { data: quoteValue, error: quoteError } = await supabase.rpc("get_mollie_payment_quote", {
      p_tenant_id: tenantId,
      p_order_id: local.order_id,
    });
    if (quoteError) {
      await recordState(supabase, local, "paid_quote_unavailable", "review_required");
      return ok();
    }
    const quote = firstRow(quoteValue);
    const currentCents = safeInteger(quote?.amount_cents);
    const currentDigest = typeof quote?.quote_digest === "string" ? quote.quote_digest : "";
    if (currentCents !== localCents || currentDigest !== localDigest) {
      await recordState(supabase, local, "paid_quote_stale", "review_required");
      return ok();
    }

    const remoteRecord = remote as Record<string, unknown>;
    const paidAtValue = typeof remoteRecord.paidAt === "string" ? Date.parse(remoteRecord.paidAt) : Number.NaN;
    const paidAt = Number.isFinite(paidAtValue)
      ? new Date(paidAtValue).toISOString()
      : new Date().toISOString();
    const method = typeof remoteRecord.method === "string" ? remoteRecord.method : null;
    const { data: finalized, error: finalizeError } = await supabase.rpc("finalize_mollie_payment", {
      p_provider_intent_id: id,
      p_status: providerPayment.status,
      p_method: method,
      p_paid_at: paidAt,
      p_expected_order_id: local.order_id,
      p_expected_tenant_id: tenantId,
      p_expected_amount_cents: currentCents,
      p_expected_quote_digest: currentDigest,
    });
    if (finalizeError) {
      const message = typeof finalizeError.message === "string" ? finalizeError.message : "";
      if (message.includes("PAYMENT_QUOTE_STALE") || message.includes("PAYMENT_STATE_LOCKED")) {
        await recordState(supabase, local, "paid_finalize_mismatch", "review_required");
        return ok();
      }
      throw finalizeError;
    }
    const result = firstRow(finalized);

    if (result?.created === true && typeof result.customer_id === "string") {
      const { data: customer } = await supabase
        .from("customers")
        .select("email")
        .eq("id", result.customer_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (customer?.email) {
        const { error: emailError } = await supabase.functions.invoke("email-send", {
          body: {
            tenantId,
            to: customer.email,
            templateKey: "zahlung_quittung",
            variables: {
              order_id: local.order_id,
              amount: (currentCents / 100).toFixed(2),
            },
            orderId: local.order_id,
            customerId: result.customer_id,
            idempotencyKey: `payment-receipt/${local.id}`,
          },
        });
        if (emailError) console.error("Receipt email failed after payment finalization");
      }
    }
    return ok();
  } catch (error) {
    console.error("Mollie webhook internal failure", error instanceof Error ? error.message : "unknown");
    return new Response("Internal Server Error", { status: 500 });
  }
});
