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
    const capability = source("src/lib/server/captureWriteCapability.ts");
    expect(action).toContain("db.transaction");
    expect(action).toContain('.for("update")');
    expect(action).toContain("captureRequestReceipts");
    expect(action).toContain("readCompletedCaptureReplay");
    expect(action).toContain("onConflictDoNothing");
    expect(action).toContain("completeRequest");
    expect(action).toContain("addAudit");
    expect(action).toContain("INSUFFICIENT_STOCK");
    expect(action).toContain("PRICE_MISSING");
    expect(action).not.toContain("partial:");
    expect(action).toContain("readCaptureWriteCapability");
    expect(action).toContain("readCaptureSchemaCapability");
    expect(action).toContain("CAPTURE_ROLLOUT_REQUIRED");
    expect(capability).toContain("('capture_request_receipts', 'station_kuerzel'");
    expect(capability).toContain("idx.indisvalid");
    expect(capability).toContain("idx.indisready");
    expect(capability).toContain("rel.relforcerowsecurity");
    expect(capability).toContain("has_any_column_privilege");
    expect(capability).toContain("capture_request_receipts_tenant_order_fk");
    expect(action).toContain("value === null || value === undefined");
    expect(action).toContain("isNull(captureRequestReceipts.result)");
    expect(action).toContain("completedAt: sql`now()`");
    expect(action).toContain("warAusVorlage: Boolean(line.templateId)");
    expect(action).not.toContain("fromTemplate:");
    expect(action).toContain("eq(vorlageZeit.stationKuerzel, input.stationKuerzel)");
    expect(action).toContain("eq(vorlageVerbrauch.inventoryItemId, line.inventoryItemId)");
    expect(action).toContain("normalizeTemplateNumber(template.medianMinutes");
    expect(action).toContain("normalizeTemplateNumber(template.medianQuantity");
    expect(action).toContain("normalizeComparableUnit(template.unit)");
  });

  it("keeps the active client free of direct database and invented-cost paths", () => {
    const action = source("src/app/actions/capture.actions.ts");
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
    expect(sheet).toContain("Zeitbuchung ist bestätigt");
    expect(sheet).toContain("Materialbuchung ist bestätigt");
    expect(sheet).toContain("article.suggestedQuantity === quantity");
    expect(sheet).toContain("templateId: article.suggestedTemplateId");
    expect(sheet).toContain("suggestedTime.median_min === minutes");
    expect(action).toContain("suggestedTemplateId: suggestion?.id ?? null");
    expect(action).toContain(".filter((row) => row.station === selectedStation)");
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
    expect(completion).toContain('expectedStation === "galvanik"');
    expect(completion).toContain("BATH_PARTICIPATION_REQUIRED");
    expect(completion.indexOf("if (request.replay) return request.replay")).toBeLessThan(completion.indexOf('expectedStation === "galvanik"'));
    expect(completion).toContain('expectedStation === "qualitaetssicherung"');
    expect(completion).toContain("QUALITY_RECEIPT_REQUIRED");
    expect(completion.indexOf("if (request.replay) return request.replay")).toBeLessThan(completion.indexOf('expectedStation === "qualitaetssicherung"'));
    expect(completion).toContain('currentStatus !== "in_progress"');
    expect(completion).toContain("storedStation !== expectedStation");
    expect(completion).toContain("lockAndConsumeMaterials");
    expect(completion).toContain("arbeitszeitBuchung");
    expect(completion).toContain("ORDER_TRANSITION_NOT_CONFIRMED");
    const transitionEvent = completion.slice(
      completion.indexOf("const [transitionEvent]"),
      completion.indexOf("if (!transitionEvent)"),
    );
    expect(transitionEvent).toContain("station: expectedStation");
    expect(transitionEvent).toContain("nextStation: completed.station");
    expect(completion).toContain("completeRequest");
    expect(completion.indexOf("db.transaction")).toBeLessThan(completion.indexOf("lockAndConsumeMaterials"));
    expect(completion.indexOf("lockAndConsumeMaterials")).toBeLessThan(completion.indexOf("completeRequest"));
    expect(modal).toContain("completeStationCapture");
    expect(modal).toContain("isSubmitting");
    expect(modal).toContain("clientRequestId");
    expect(modal).toContain("selectedRate?.valueEurPerHour");
    expect(modal).toContain("catalogTruncated");
    expect(modal).toContain("nicht als fehlend bestätigt");
    expect(modal).toContain("matchingConsumables.length === 0");
    expect(modal).toContain("Gesamtkatalog ist damit nicht leer bestätigt");
    expect(modal).not.toContain("DEFAULT_HOURLY_RATE_EUR");
    expect(modal).not.toContain("inventoryRepository.createMovement");
    expect(modal).not.toContain("eventsRepository.addEvent");
    expect(modal).not.toContain("transitionOrderProcess");
    const galvanikExtras = source("src/components/orders/variants/GalvanikExtras.tsx");
    expect(galvanikExtras).toContain("kein Auftrag-zu-Bad-Beleg bestätigt");
    expect(galvanikExtras).not.toContain("Chrombad 2");
    expect(galvanikExtras).not.toContain("12 µm");
  });

  it("prepares but does not apply the tenant, RLS and receipt migration", () => {
    const migration = source("supabase/migrations/20260715001600_capture_integrity_prepared_unapplied.sql");
    const capability = source("src/lib/server/captureWriteCapability.ts");
    expect(migration).toContain("PREPARED ONLY");
    expect(migration).toContain("capture_request_receipts");
    expect(migration).toContain("capture_request_receipts_tenant_request_kind_uidx");
    expect(migration).toContain("'station_completion'");
    expect(migration).toContain("Apply and verify the inventory contract reconciliation before capture integrity");
    expect(migration).not.toContain("UPDATE public.inventory_items");
    expect(migration).not.toContain("SET current_stock = 0");
    expect(migration).toContain("capture_request_receipts_tenant_order_fk");
    expect(migration).toContain("capture_request_receipts_tenant_actor_fk");
    expect(migration).toContain("UPDATE public.audit_log audit");
    expect(migration).toContain("audit.tenant_id <> actor.tenant_id");
    expect(migration).not.toContain("SET tenant_id = 'galvanik-kreile'");
    expect(migration).toContain("ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id)");
    expect(migration).toContain("ALTER COLUMN id SET DEFAULT (gen_random_uuid())::text");
    expect(migration).toContain("GRANT INSERT (");
    expect(capability).toContain("('audit_log', 'id', 'gen_random_uuid()')");
    expect(capability).toContain("('audit_log', ARRAY['id'])");
    expect(capability).toContain("'service_role', 'public.audit_log', required.column_name, 'INSERT'");
    expect(migration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL PRIVILEGES");
    expect(migration).toContain("GRANT UPDATE (result, completed_at)");
    expect(migration).toContain("BEFORE INSERT OR UPDATE ON public.capture_request_receipts");
    expect(migration).toContain("capture_request_receipts_write_once_trg");
    expect(migration).toContain("attribute.attname IN ('auftrag_id', 'employee_id', 'vorlage_id')");
    expect(migration).not.toContain("GRANT SELECT, INSERT, UPDATE ON TABLE public.inventory_items");
    const additive = source("supabase/migrations/20260716000100_station_completion_receipt_prepared_unapplied.sql");
    expect(additive).toContain("PREPARED ONLY");
    expect(additive).toContain("DROP CONSTRAINT IF EXISTS capture_request_receipts_kind_check");
    expect(additive).toContain("'station_completion'");
    expect(additive).toContain("VALIDATE CONSTRAINT capture_request_receipts_kind_check");
    const projection = source("supabase/migrations/20260715001650_capture_template_projection_reconciliation_prepared_unapplied.sql");
    expect(projection).toContain("PREPARED, NOT APPLIED");
    expect(projection).toContain("migration_owner oid := (SELECT oid FROM pg_roles WHERE rolname = current_user)");
    expect(projection).toContain("legacy function owner differs from migration owner");
    expect(projection).toContain("migration owner, service_role or database privilege contract is unsafe");
    expect(projection).toContain("DO $function_acl_reset$");
    expect(projection).toContain("FROM PUBLIC CASCADE");
    expect(projection).not.toContain("CREATE ROLE kreile_template_writer");
    expect(projection).toContain("SECURITY DEFINER");
    expect(projection).toContain("SET search_path = pg_catalog");
    expect(projection).toContain("movement.movement_type IN ('consumption', 'verbrauch')");
    expect(projection).toContain("'shipped', 'versendet', 'delivered'");
    expect(projection).toContain("inventory.tenant_id = movement.tenant_id");
    expect(projection).toContain("TEMPLATE_PROJECTION_UNIT_DRIFT");
    expect(projection).toContain("TEMPLATE_PROJECTION_TERMINAL_INSERT_REQUIRES_STATUS_TRANSITION");
    expect(projection).toContain("TEMPLATE_PROJECTION_SOURCE_FROZEN");
    expect(projection).toContain("fn_guard_template_projection_source_insert");
    expect(projection).toContain("template_projection_items_source_guard_trg");
    expect(projection).toContain("template_projection_time_source_guard_trg");
    expect(projection).toContain("template_projection_movement_source_guard_trg");
    expect(projection).toContain("FOR SHARE");
    expect(projection).toContain("fn_kreile_template_keywords_valid");
    expect(projection).toContain("teile_klassifikator_template_key_chk");
    expect(projection).toContain("items_template_surface_key_chk");
    expect(projection).toContain("teile_klassifikator_tenant_normalized_class_uidx");
    expect(projection).toContain("normalize(p_value, NFC)");
    expect(projection).toContain("strpos(");
    expect(projection).toContain("length(public.fn_kreile_template_normalize(keyword.value)) DESC");
    expect(projection).toContain("lower(btrim(order_record.status))");
    expect(projection).toContain("booking.end_zeit IS NOT NULL");
    expect(projection).toContain("AT TIME ZONE 'Europe/Berlin'");
    expect(projection).toContain("WHEN 'beschichtung' THEN 'galvanik'");
    expect(projection).toContain("is_active = false");
    expect(projection).toContain("ON CONFLICT (tenant_id, schluessel, station_kuerzel, inventory_item_id)");
    expect(projection).toContain("CREATE OR REPLACE VIEW public.v_auftrag_db");
    expect(projection).toContain("security_invoker = true");
    expect(projection).toContain("security_barrier = true");
    expect(projection).toContain("movement.movement_type IN ('consumption', 'verbrauch')");
    expect(projection).toContain("material.tenant_id = order_record.tenant_id");
    expect(projection).toContain("anz_verbrauch_ohne_preis");
    expect(projection).toContain("db_berechenbar");
    expect(projection).not.toContain("COALESCE(movement.snapshot_einkaufspreis_eur, 0)");
    const projectionFunction = projection.slice(
      projection.indexOf("CREATE OR REPLACE FUNCTION public.fn_update_vorlagen"),
      projection.indexOf("ALTER FUNCTION public.fn_update_vorlagen() OWNER TO CURRENT_USER"),
    );
    expect(projectionFunction).not.toContain("COALESCE(NEW.tenant_id");
    expect(projectionFunction).not.toContain("ii.unit, 'st'");
    const captureAction = source("src/app/actions/capture.actions.ts");
    expect(captureAction).not.toContain("fallbackKey");
  });
});
