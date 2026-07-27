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
const runtimeMigration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260715001650_capture_template_projection_reconciliation_prepared_unapplied.sql",
  ),
  "utf8",
);
const runtimePredicate = fs.readFileSync(
  path.join(root, "src/lib/server/databaseRuntimeIdentity.ts"),
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
    expect(migration).toContain("PAYMENT_ACTIVE_PROVIDER_CONFLICT");
    expect(migration).toContain("PAYMENT_RESERVATION_TRUTH_MISMATCH");
    expect(migration).toContain("get_mollie_payment_quote(v_payment.tenant_id, v_payment.order_id)");
    expect(migration).toContain("PAYMENT_QUOTE_STALE");
    expect(migration).toContain("'PAYMENT_PAID'");
  });

  it("uses the order row as the canonical quote mutex and maps reconciliation conflicts honestly", () => {
    expect(migration).not.toContain("pg_advisory_xact_lock(hashtextextended(p_tenant_id || ':' || p_order_id");
    expect(migration).toContain("FOR NO KEY UPDATE");
    expect(createSource).toContain("PAYMENT_ACTIVE_PROVIDER_CONFLICT");
    expect(createSource).toContain("PAYMENT_RESERVATION_TRUTH_MISMATCH");
    expect(createSource).toContain("Existing payment requires manual review");
  });

  it("pins pgcrypto outside every SECURITY DEFINER search path", () => {
    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions");
    expect(migration).toContain("to_regprocedure('extensions.digest(bytea,text)')");
    expect(migration).toContain("extensions.digest(");
    expect(migration).toContain("SET search_path = pg_catalog, public, pg_temp");
    expect(migration).not.toContain("SET search_path = pg_catalog, extensions, public, pg_temp");
    expect(migration).not.toContain("encode(digest(");

    const expectedReceipt =
      "('public.get_mollie_payment_quote(text,text)', ARRAY['search_path=pg_catalog, public, pg_temp']::text[], 'e1387b5f181cf370a9134565723908a0', '25fcd431d639b3f1d67c0f218290871e', true, true)";
    for (const contract of [runtimeMigration, runtimePredicate]) {
      expect(contract).toContain(expectedReceipt);
      expect(contract).not.toContain("64323e588243eb11d29f2e27270c0104");
      expect(contract).not.toContain("search_path=pg_catalog, extensions, public, pg_temp");
    }
  });

  it("owns a bounded invoice sequence without exposing direct sequence privileges", () => {
    expect(migration).toContain("MAXVALUE 999999 NO CYCLE");
    expect(migration).toContain("invoice sequence suffix exceeds the six-digit contract");
    expect(migration).toContain("REVOKE ALL ON SEQUENCE public.ausgangsrechnung_nummer_seq");
    expect(migration).toContain("INVOICE_NUMBER_SEQUENCE_EXHAUSTED");
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
