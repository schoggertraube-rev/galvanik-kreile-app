import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const createSource = fs.readFileSync(
  path.join(root, "supabase/functions/mollie-create-payment/index.ts"),
  "utf8",
);
const webhookSource = fs.readFileSync(
  path.join(root, "supabase/functions/payments-webhook-mollie/index.ts"),
  "utf8",
);
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260714000100_payment_idempotency_prepared_unapplied.sql"),
  "utf8",
);

describe("Mollie payment security contracts", () => {
  it("admits callbacks locally before the first provider request", () => {
    const localLookup = webhookSource.indexOf('.from("payments")');
    const providerFetch = webhookSource.indexOf("https://api.mollie.com/v2/payments/");
    expect(localLookup).toBeGreaterThan(0);
    expect(providerFetch).toBeGreaterThan(localLookup);
    expect(webhookSource).toContain('.eq("webhook_token_hash", tokenHash)');
    expect(webhookSource).toContain("if (!localValue) return ok()");
    expect(webhookSource).toContain("if (local.provider_intent_id !== id) return ok()");
  });

  it("bounds callback bodies and provider response bodies", () => {
    expect(webhookSource).toContain("readBoundedUtf8Body(req, 2_048)");
    expect(webhookSource).not.toContain("await req.text()");
    expect(webhookSource).toContain("text.length > 1_000_000");
  });

  it("validates the high-entropy admission token before reading any request body", () => {
    const admissionGate = webhookSource.indexOf("if (!isValidWebhookAdmissionToken(admission)) return ok()");
    const bodyRead = webhookSource.indexOf("const id = await paymentId(req)");
    expect(admissionGate).toBeGreaterThan(0);
    expect(bodyRead).toBeGreaterThan(admissionGate);
  });

  it("reserves before provider creation and uses the database attempt as idempotency key", () => {
    const reserveCall = createSource.indexOf('reserve_mollie_payment_attempt');
    const providerCreate = createSource.indexOf('fetch("https://api.mollie.com/v2/payments"');
    expect(reserveCall).toBeGreaterThan(0);
    expect(providerCreate).toBeGreaterThan(reserveCall);
    expect(createSource).toContain('"Idempotency-Key": reservation.paymentId');
    expect(createSource).toContain("paymentAttemptId: reservation.paymentId");
  });

  it("locks active quotes and rechecks current quote inside atomic finalization", () => {
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_active_order");
    expect(migration).toContain("ACTIVE_PAYMENT_LOCKS_QUOTE");
    expect(migration).toContain("get_mollie_payment_quote(v_payment.tenant_id, v_payment.order_id)");
    expect(migration).toContain("PAYMENT_QUOTE_STALE");
    expect(migration).toContain("'PAYMENT_PAID'");
  });

  it("keeps all payment RPCs service-role-only", () => {
    for (const signature of [
      "get_mollie_payment_quote(text,text)",
      "reserve_mollie_payment_attempt(uuid,text,text,bigint,text,text)",
      "bind_mollie_payment_provider(uuid,text,text,bigint,text)",
      "record_mollie_payment_state(uuid,text,text,text)",
      "finalize_mollie_payment(text,text,text,timestamptz,text,text,bigint,text)",
    ]) {
      expect(migration).toContain(`REVOKE ALL ON FUNCTION public.${signature} FROM PUBLIC, anon, authenticated`);
      expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${signature} TO service_role`);
    }
  });
});
