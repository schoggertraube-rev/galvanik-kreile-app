import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("operational capture truth boundary", () => {
  it("derives actor and tenant on the server before any capture write", () => {
    const action = source("src/app/actions/capture.actions.ts");
    expect(action).toContain("resolveAuthorization");
    expect(action).toContain("CAPTURE_TENANT_ID");
    expect(action).toContain('actor.data.userId');
    expect(action).toContain('actor.data.tenantId');
    expect(action).toContain('permissions.includes("perm_op_status")');
    expect(action).not.toMatch(/input\.(employeeId|employee_id|tenantId|tenant_id)/);
  });

  it("uses one transaction, row locks, idempotency receipt and audit for mutations", () => {
    const action = source("src/app/actions/capture.actions.ts");
    expect(action).toContain("db.transaction");
    expect(action).toContain('.for("update")');
    expect(action).toContain("captureRequestReceipts");
    expect(action).toContain("onConflictDoNothing");
    expect(action).toContain("completeRequest");
    expect(action).toContain("addAudit");
    expect(action).toContain("INSUFFICIENT_STOCK");
    expect(action).toContain("PRICE_MISSING");
    expect(action).not.toContain("partial:");
  });

  it("keeps the active client free of direct database and invented-cost paths", () => {
    const card = source("src/components/erfassung/CaptureCard.tsx");
    const sheet = source("src/components/erfassung/CaptureSheet.tsx");
    const page = source("src/app/orders/[id]/page.tsx");
    const legacyCard = source("src/components/erfassung/ErfassungCard.tsx");
    const legacySheet = source("src/components/erfassung/ErfassungSheet.tsx");
    const combined = [card, sheet, legacyCard, legacySheet].join("\n");
    expect(page).toContain('import { CaptureCard }');
    expect(page).not.toContain('import { ErfassungCard }');
    expect(combined).not.toContain("createClient");
    expect(combined).not.toContain("employeeId");
    expect(combined).not.toContain("alert(");
    expect(combined).not.toContain("kostenMaterial = 0");
    expect(combined).not.toContain("stationsSet.add('SCH')");
    expect(combined).not.toContain("stationsSet.add('GAL')");
    expect(sheet).toContain("unitCostEur");
    expect(sheet).toContain("currentStock");
  });

  it("completes time, material and the locked process state in one idempotent transaction", () => {
    const action = source("src/app/actions/capture.actions.ts");
    const completion = action.slice(
      action.indexOf("export async function completeStationCapture"),
      action.indexOf("export async function applyCaptureTemplate"),
    );
    const modal = source("src/components/orders/StationCompletionModal.tsx");
    expect(completion).toContain('authorizeCapture("status")');
    expect(completion).toContain('.for("update")');
    expect(completion).toContain('kind: "station_completion"');
    expect(completion).toContain("if (request.replay) return request.replay");
    expect(completion).toContain('currentStatus !== "in_progress"');
    expect(completion).toContain("storedStation !== expectedStation");
    expect(completion).toContain("lockAndConsumeMaterials");
    expect(completion).toContain("arbeitszeitBuchung");
    expect(completion).toContain("ORDER_TRANSITION_NOT_CONFIRMED");
    expect(completion).toContain("completeRequest");
    expect(completion.indexOf("db.transaction")).toBeLessThan(completion.indexOf("lockAndConsumeMaterials"));
    expect(completion.indexOf("lockAndConsumeMaterials")).toBeLessThan(completion.indexOf("completeRequest"));
    expect(modal).toContain("completeStationCapture");
    expect(modal).toContain("isSubmitting");
    expect(modal).toContain("clientRequestId");
    expect(modal).toContain("selectedRate?.valueEurPerHour");
    expect(modal).not.toContain("DEFAULT_HOURLY_RATE_EUR");
    expect(modal).not.toContain("inventoryRepository.createMovement");
    expect(modal).not.toContain("eventsRepository.addEvent");
    expect(modal).not.toContain("transitionOrderProcess");
  });

  it("prepares but does not apply the tenant, RLS and receipt migration", () => {
    const migration = source("supabase/migrations/20260715001600_capture_integrity_prepared_unapplied.sql");
    expect(migration).toContain("PREPARED ONLY");
    expect(migration).toContain("capture_request_receipts");
    expect(migration).toContain("capture_request_receipts_tenant_request_kind_uidx");
    expect(migration).toContain("'station_completion'");
    expect(migration).toContain("ALTER TABLE public.inventory_items");
    expect(migration).toContain("ALTER COLUMN tenant_id SET NOT NULL");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL PRIVILEGES");
    const additive = source("supabase/migrations/20260716000100_station_completion_receipt_prepared_unapplied.sql");
    expect(additive).toContain("PREPARED ONLY");
    expect(additive).toContain("DROP CONSTRAINT IF EXISTS capture_request_receipts_kind_check");
    expect(additive).toContain("'station_completion'");
    expect(additive).toContain("VALIDATE CONSTRAINT capture_request_receipts_kind_check");
  });
});
