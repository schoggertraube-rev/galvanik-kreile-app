import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("database runtime identity contract", () => {
  it("is shared by every direct PostgreSQL capability gate", () => {
    for (const consumerPath of [
      "src/lib/server/captureWriteCapability.ts",
      "src/lib/server/inventoryWriteCapability.ts",
      "src/lib/server/operationalCoreCapability.ts",
    ]) {
      const consumer = source(consumerPath);
      expect(consumer).toContain("databaseRuntimeIdentityPredicate");
      expect(consumer).toContain("${databaseRuntimeIdentityPredicate}");
    }
  });

  it("prevents SET ROLE NONE from recovering an ambient database identity", () => {
    const predicate = source("src/lib/server/databaseRuntimeIdentity.ts");
    for (const evidence of [
      "current_user = 'service_role'",
      "session_user = 'kreile_app_runtime'",
      "current_setting('search_path') = 'pg_catalog,public,pg_temp'",
      "current_setting('session_replication_role') = 'origin'",
      "current_setting('lo_compat_privileges') = 'off'",
      "not service_role.rolcanlogin",
      "not service_role.rolcreaterole",
      "not service_role.rolcreatedb",
      "not service_role.rolreplication",
      "service_role.rolconfig is null",
      "not has_database_privilege(service_role.oid, current_database(), 'CREATE')",
      "not has_database_privilege(service_role.oid, current_database(), 'TEMP')",
      "has_schema_privilege(service_role.oid, namespace_record.oid, 'CREATE')",
      "has_tablespace_privilege(service_role.oid, tablespace_record.oid, 'CREATE')",
      "session_role.rolconfig is null",
      "pg_db_role_setting",
      "has_schema_privilege(session_role.oid, namespace_record.oid, 'CREATE')",
      "has_tablespace_privilege(session_role.oid, tablespace_record.oid, 'CREATE')",
      "pg_auth_members",
      "not membership.admin_option",
      "not membership.inherit_option",
      "membership.set_option",
      "where membership.roleid = service_role.oid",
      "where membership.roleid = session_role.oid",
      "pg_has_role(session_role.oid, reachable_role.oid, 'MEMBER')",
      "pg_has_role(candidate.oid, service_role.oid, 'MEMBER')",
      "pg_has_role(candidate.oid, database_record.datdba, 'MEMBER')",
      "aclexplode(relation_record.relacl)",
      "aclexplode(attribute_record.attacl)",
      "aclexplode(function_record.proacl)",
      "aclexplode(namespace_record.nspacl)",
      "aclexplode(direct_database_record.datacl)",
      "acl_entry.privilege_type = 'CONNECT'",
      "acl_entry.privilege_type in ('CONNECT', 'TEMPORARY')",
      "other_database_record.datallowconn",
      "dependency.deptype in ('o', 'a', 'r')",
      "function_record.prosecdef",
      "has_function_privilege(session_role.oid, function_record.oid, 'EXECUTE')",
      "pg_parameter_acl",
      "coalesce(parameter_acl.paracl, '{}'::aclitem[])",
      "pg_default_acl",
      "pg_largeobject_metadata",
      "acl_entry.grantee = 0",
      "pg_shdepend",
      "dependency.deptype = 'o'",
    ]) expect(predicate).toContain(evidence);

    expect(predicate.match(/where membership\.member = session_role\.oid/g)).toHaveLength(3);
    expect(predicate).toContain("where membership.member = service_role.oid");
  });

  it("pins the startup search path and the prepared role graph", () => {
    const dbIndex = source("src/db/index.ts");
    const migration = source(
      "supabase/migrations/20260715001650_capture_template_projection_reconciliation_prepared_unapplied.sql",
    );

    expect(dbIndex).toContain("-c role=${runtimeRole} -c search_path=pg_catalog,public,pg_temp");
    expect(migration).toContain("SET LOCAL search_path = pg_catalog, pg_temp");
    expect(migration).toContain("PostgreSQL 16 or newer is required");
    expect(migration).toContain("rolname = 'kreile_app_runtime'");
    expect(migration).toContain("official platform graph may also let it SET");
    expect(migration).toContain("session_user = kreile_app_runtime");
    expect(migration).toContain("membership.admin_option");
    expect(migration).toContain("membership.inherit_option");
    expect(migration).toContain("membership.set_option");
    expect(migration).toContain("pg_shdepend");
    expect(migration).toContain("pg_db_role_setting");
    expect(migration).toContain("privilege_type IN ('CONNECT', 'TEMPORARY')");
    expect(migration).toContain("dependency.deptype IN ('o', 'a', 'r')");
    expect(migration).toContain("replication and large-object compatibility settings are unsafe");
    expect(migration).toContain("FROM pg_parameter_acl parameter_acl");
    expect(migration).toContain("FROM pg_largeobject_metadata large_object_record");
    expect(migration).toContain("ARRAY['search_path=pg_catalog, pg_temp']::text[]");
  });

  it("pins the exact public SECURITY DEFINER and trigger inventory instead of accepting white-wall RPC drift", () => {
    const predicate = source("src/lib/server/databaseRuntimeIdentity.ts");
    const migration = source(
      "supabase/migrations/20260715001650_capture_template_projection_reconciliation_prepared_unapplied.sql",
    );

    for (const contract of [predicate, migration]) {
      expect(contract).toContain("pg_get_function_arguments(function_record.oid) || ' -> ' || pg_get_function_result(function_record.oid)");
      expect(contract).toContain("function_record.prosrc");
      expect(contract).toContain("function_record.provolatile");
      expect(contract).toContain("function_record.proparallel");
      expect(contract).toContain("function_record.proretset");
      expect(contract).toContain("function_record.procost");
      expect(contract).toContain("function_record.prorows");
      expect(contract).toContain("pg_get_triggerdef(trigger_record.oid)");
      expect(contract).toContain("trigger_record.tgfoid");
      expect(contract).toContain("trigger_record.tgrelid");
      expect(contract).toContain("trigger_record.tgname");
    }

    expect(predicate).toContain("and 20 = (");
    expect(predicate).toContain("and 8 = (");
    expect(migration).toContain("CASE WHEN p_phase = 'pre' THEN 18 ELSE 20 END");
    expect(migration).toContain("CASE WHEN p_phase = 'pre' THEN 3 ELSE 8 END");
    expect(migration).toContain("CREATE FUNCTION pg_temp.capture_secdef_contract_valid");
    expect(migration).toContain("IF NOT pg_temp.capture_secdef_contract_valid(service_role_oid, migration_owner, 'pre')");
    expect(migration).toContain("IF NOT pg_temp.capture_secdef_contract_valid(service_role_oid, migration_owner, 'post')");
    expect(migration).toContain("coalesce(bool_or(to_regprocedure(approved.signature) = function_record.oid), false)");
  });

  it("accepts only the exact conditional authenticator edge and rejects elevated ambient creators", () => {
    const predicate = source("src/lib/server/databaseRuntimeIdentity.ts");
    const migration = source(
      "supabase/migrations/20260715001650_capture_template_projection_reconciliation_prepared_unapplied.sql",
    );

    for (const contract of [predicate, migration]) {
      expect(contract).toContain("rolname = 'authenticator'");
      expect(contract).toContain("rolcanlogin");
      expect(contract).toContain("rolinherit");
      expect(contract).toContain("rolbypassrls");
      expect(contract).toContain("rolcreaterole");
      expect(contract).toContain("rolcreatedb");
      expect(contract).toContain("rolreplication");
      expect(contract).toContain("has_schema_privilege");
      expect(contract).toContain("has_database_privilege");
    }

    expect(predicate).toContain("not membership.admin_option");
    expect(predicate).toContain("not membership.inherit_option");
    expect(predicate).toContain("membership.set_option");
    expect(predicate).not.toContain("candidate.rolbypassrls and namespace_record.nspname in ('public', 'extensions')");
    expect(migration).not.toContain("candidate.rolbypassrls AND namespace_record.nspname IN ('public', 'extensions')");
  });
});
