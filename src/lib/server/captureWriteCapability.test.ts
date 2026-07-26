import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("capture write capability", () => {
  it("accepts only an explicit boolean database verdict", async () => {
    vi.stubEnv("DATABASE_URL", "postgres://fixture:fixture@127.0.0.1:5432/fixture");
    const { captureWriteCapabilityAvailable } = await import("@/lib/server/captureWriteCapability");
    expect(captureWriteCapabilityAvailable({ available: true })).toBe(true);
    expect(captureWriteCapabilityAvailable({ available: false })).toBe(false);
    expect(() => captureWriteCapabilityAvailable(undefined)).toThrow("CAPTURE_WRITE_CAPABILITY_UNAVAILABLE");
    expect(() => captureWriteCapabilityAvailable({ available: "true" })).toThrow("CAPTURE_WRITE_CAPABILITY_UNAVAILABLE");
  });

  it("requires tenant-bound relations, durable receipts and exact indexes", () => {
    const capability = source("src/lib/server/captureWriteCapability.ts");
    for (const evidence of [
      "arbeitszeit_buchung_tenant_order_fk",
      "arbeitszeit_buchung_tenant_employee_fk",
      "vorlage_verbrauch_tenant_inventory_fk",
      "items_tenant_order_fk",
      "stock_movements_tenant_template_fk",
      "capture_request_receipts_tenant_actor_fk",
      "capture_request_receipts_tenant_order_fk",
      "audit_log_tenant_actor_fk",
      "capture_request_receipts_completion_chk",
      "capture_request_receipts_tenant_request_kind_uidx",
      "capture_request_receipts_write_once_trg",
      "enforce_capture_request_receipt_write_once",
      "trg_update_vorlagen",
      "trg_insert_vorlagen",
      "fn_guard_template_projection_source_insert",
      "template_projection_items_source_guard_trg",
      "template_projection_time_source_guard_trg",
      "template_projection_movement_source_guard_trg",
      "owner_role.rolname not in ('anon', 'authenticated', 'service_role', 'authenticator')",
      "vorlage_zeit_tenant_key_station_uidx",
      "vorlage_verbrauch_tenant_key_station_item_uidx",
      "teile_klassifikator_tenant_normalized_class_uidx",
      "items_template_surface_key_chk",
      "teile_klassifikator_template_key_chk",
      "required_exact_checks",
      "expected_check_dependencies",
      "expected_classifier_index_dependencies",
      "expected_view_dependencies",
      "pg_get_expr(con.conbin, con.conrelid, false) = required.expression_definition",
      "expected_projection_functions",
      "definition_md5",
      "md5(convert_to(",
      "function_value.prosrc",
      "to_regprocedure('public.fn_update_vorlagen()')",
      "function_value.prorettype",
      "function_value.proisstrict",
      "acl.grantee <> function_value.proowner",
      "trigger_value.tgtype = 17",
      "trigger_value.tgtype = 5",
      "trigger_value.tgtype = 7",
      "trigger_value.tgattr::text",
      "trigger_value.tgnargs = 0",
      "v_auftrag_db",
      "security_invoker=true",
      "security_barrier=true",
      "view_record.relowner",
      "pg_get_viewdef(view_record.oid, false)",
      "tenant_id:text",
      "kostenstellen_energie_monat",
    ]) expect(capability).toContain(evidence);
    expect(capability).toContain("con.confdeltype::text = required.delete_type");
    expect(capability).toContain("idx.indisvalid");
    expect(capability).toContain("idx.indisready");
    expect(capability).toContain("idx.indimmediate");
    expect(capability).toContain("pg_get_expr(idx.indpred, idx.indrelid, false) is not distinct from required.predicate_definition");
    expect(capability).toContain("pg_opclass");
    expect(capability).toContain("required.expected_collations");
    expect(capability).toContain("'pg_catalog.default'::regcollation::oid");
    expect(capability).toContain("con.conindid = to_regclass('public.' || required.target_index_name)");
    expect(capability).toContain("con.conpfeqop::oid[] = required.equality_operators");
    expect(capability).toContain("con.conppeqop::oid[] = required.equality_operators");
    expect(capability).toContain("con.conffeqop::oid[] = required.equality_operators");
    expect(capability).toContain("idx.indoption::smallint[]");
    expect(capability).toContain("idx.indrelid = 'public.teile_klassifikator'::regclass");
    expect(capability).toContain("pg_get_indexdef(idx.indexrelid, 1, false) = 'tenant_id'");
  });

  it("fails closed on policies, browser ACLs and overprivileged service grants", () => {
    const capability = source("src/lib/server/captureWriteCapability.ts");
    const runtimeIdentity = source("src/lib/server/databaseRuntimeIdentity.ts");
    expect(capability).toContain("rel.relforcerowsecurity");
    expect(capability).toContain("aclexplode");
    expect(capability).toContain("has_table_privilege");
    expect(capability).toContain("has_any_column_privilege");
    expect(capability).toContain("att.attname not in ('result', 'completed_at')");
    expect(capability).toContain("required_primary_keys");
    expect(capability).toContain("required_defaults");
    expect(capability).toContain("BEFORE INSERT OR UPDATE");
    expect(runtimeIdentity).toContain("current_user = 'service_role'");
    expect(capability).toContain("databaseRuntimeIdentityPredicate");
    expect(capability).toContain("not has_table_privilege(role.oid, protected.oid, 'UPDATE')");
    expect(capability).toContain("has_table_privilege(role_record.oid, view_record.oid, 'SELECT')");
    expect(capability).not.toContain("pg_get_expr(trigger_value.tgqual");
  });

  it("keeps the capture rollout from mutating or widening the inventory ledger", () => {
    const migration = source("supabase/migrations/20260715001600_capture_integrity_prepared_unapplied.sql");
    expect(migration).not.toContain("UPDATE public.inventory_items");
    expect(migration).not.toContain("SET current_stock = 0");
    expect(migration).not.toContain("GRANT SELECT, INSERT, UPDATE ON TABLE public.inventory_items");
    expect(migration).toContain("Capture integrity widened or broke the inventory service-role boundary");
    expect(migration).toContain("GRANT UPDATE (result, completed_at)");
    expect(migration).toContain("GRANT INSERT (");
    expect(migration).toContain("Capture receipts must be inserted pending");
    expect(migration).toContain("Capture receipt result identity does not match its ledger row");
    expect(migration).toContain("Capture service-role has an inherited or direct column overgrant");
  });

  it("pins the controlling projection owner, view ACL and exact trigger shapes", () => {
    const migration = source("supabase/migrations/20260715001650_capture_template_projection_reconciliation_prepared_unapplied.sql");
    expect(migration).toContain("existing v_auftrag_db owner differs from migration owner");
    expect(migration).toContain("v_auftrag_db contains ACLs from a foreign grantor");
    expect(migration).toContain("fn_update_vorlagen contains ACLs from a foreign grantor");
    expect(migration).toContain("fn_update_vorlagen has an unknown trigger attachment");
    expect(migration).toContain("acl_entry.grantor <> migration_owner");
    expect(migration).toContain("ALTER VIEW public.v_auftrag_db OWNER TO CURRENT_USER");
    expect(migration).toContain("view_record.relowner = migration_owner");
    expect(migration).toContain("has_table_privilege(role_record.oid, 'public.v_auftrag_db', 'SELECT')");
    expect(migration).toContain("role_record.rolname !~ '^pg_'");
    expect(migration).toContain("pg_get_viewdef(view_record.oid, false)");
    expect(migration).toContain("tenant_id:text");
    expect(migration).toContain("index_record.indimmediate");
    expect(migration).toContain("index_record.indoption::text = '0 0 0'");
    expect(migration).toContain("constraint_record.conparentid = 0");
    expect(migration).toContain("constraint_record.connoinherit");
    expect(migration).toContain("constraint_record.conindid = 'public.orders_tenant_id_uidx'::regclass");
    expect(migration).toContain("constraint_record.conpfeqop::oid[]");
    expect(migration).toContain("'pg_catalog.default'::regcollation::oid");
    expect(migration).toContain("SET LOCAL search_path = pg_catalog, pg_temp");
    expect(migration).toContain("AND 39 = (");
    expect(migration).toContain("dependency.refobjid = keywords_function");
    expect(migration).toContain("2 <> (");
    expect(migration).toContain("trigger_record.tgfoid = template_function");
    expect(migration).not.toContain("role_record.rolcanlogin");
    expect(migration).toContain("trigger_record.tgtype = 17");
    expect(migration).toContain("trigger_record.tgtype = 5");
    expect(migration).toContain("trigger_record.tgtype = 7");
    expect(migration).toContain("pg_get_expr(constraint_record.conbin, constraint_record.conrelid, false)");
    expect(migration).not.toContain("pg_get_expr(trigger_record.tgqual");
    expect(migration).not.toContain("protransform");
  });

  it("uses exact catalog fingerprints instead of fragment-only semantic seals", () => {
    const capability = source("src/lib/server/captureWriteCapability.ts");
    const migration = source("supabase/migrations/20260715001650_capture_template_projection_reconciliation_prepared_unapplied.sql");
    for (const fingerprint of [
      "c0a810fd594dd7012e097d2d00be7f50",
      "758bf8c0fc6506ad85862f5547a660f2",
      "11156fe67484f3a382eea5202c6e80a4",
      "d6c4024c3d3a869f0795c96a6ebe9c8e",
      "aa3283092a231dd9134774ce3de5aecb",
      "8d59ab4d53f735d657349f089f300a1f",
      "2dafb1c34dcb1e1f071b0adb425c6972",
      "b4c1bfc16010d3005ab0fcb3695631b8",
    ]) {
      expect(capability + migration).toContain(fingerprint);
    }
    expect(capability).toContain("md5(pg_get_expr(con.conbin, con.conrelid, false)) = required.expression_md5");
    expect(capability).toContain("acl.grantor <> function_value.proowner");
    expect(migration).toContain("acl_entry.grantor <> migration_owner");
  });
});
