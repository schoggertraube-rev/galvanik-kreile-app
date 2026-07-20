import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("aging and manual dunning truth", () => {
  it("derives tenant-bound open amounts from canonical invoice rows and fails unavailable instead of returning empty", () => {
    const actions = source("src/app/cockpit/actions.ts");
    expect(actions).toContain("requireCustomerFinanceRead()");
    expect(actions).toContain("ar.tenant_id = ${actor.tenantId}");
    expect(actions).toContain("greatest(ar.brutto - coalesce(ar.bezahlt_betrag_eur, 0), 0)");
    expect(actions).toContain("throw new Error('AGING_DATA_UNAVAILABLE')");
    expect(actions).not.toContain(".from('v_aging')");
    expect(actions).not.toContain("export async function savePhoneNote");
  });

  it("stores only an idempotent audited manual draft and never claims mail delivery or advances the invoice", () => {
    const action = source("src/app/actions/mahnung.actions.ts");
    expect(action).toContain("requireFinanceWrite");
    expect(action).toContain("readStatusEmailLedgerCapability");
    expect(action).toContain("pg_advisory_xact_lock");
    expect(action).toContain("invoiceId: invoice.id");
    expect(action).toContain('status: "draft"');
    expect(action).toContain('type: "email_draft"');
    expect(action).toContain("bhAuditLog");
    expect(action).toContain("sent: false");
    expect(action).not.toContain("communication_messages");
    expect(action).not.toContain("unbekannt@kunde.de");
    expect(action).not.toContain("tx.update(ausgangsrechnung)");
  });

  it("uses the canonical phone-note action and presents draft semantics in the dormant cockpit", () => {
    const client = source("src/app/cockpit/components/AgingKachel.tsx");
    expect(client).toContain("createPhoneNote");
    expect(client).toContain("customerId: phoneTargetRechnung.customer_id");
    expect(client).not.toContain("customer_id: phoneTargetRechnung?.kunde_name");
    expect(client).toContain("Erinnerungsentwurf");
    expect(client).toContain("Mahnungsentwurf Stufe");
    expect(client).toContain("kein bestätigter Nullbestand");
  });

  it("prepares the communication invoice relation and explicit draft status without applying it", () => {
    const migration = source("supabase/migrations/20260715000800_email_delivery_ledger_prepared_unapplied.sql");
    expect(migration).toContain("PREPARED ONLY");
    expect(migration).toContain("invoice_id uuid REFERENCES public.ausgangsrechnung");
    expect(migration).toContain("'draft', 'queued'");
    expect(migration).toContain("communications_tenant_invoice_created_idx");
  });
});
