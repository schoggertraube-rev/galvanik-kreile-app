import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const expandMigration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260715001300_operational_server_boundary_prepared_unapplied.sql",
  ),
  "utf8",
);
const contractMigration = fs.readFileSync(
  path.join(
    root,
    "supabase/migrations/20260720000500_bath_measurement_contract_prepared_unapplied.sql",
  ),
  "utf8",
);
const schema = fs.readFileSync(path.join(root, "src/db/schema.ts"), "utf8");
const bathsRepository = fs.readFileSync(
  path.join(root, "src/lib/repositories/bathsRepository.ts"),
  "utf8",
);
const measurementsRepository = fs.readFileSync(
  path.join(root, "src/lib/repositories/bathMeasurementsRepository.ts"),
  "utf8",
);

describe("operational bath foundation contract", () => {
  it("keeps the expand phase lossless and tenant-bound", () => {
    expect(expandMigration).not.toMatch(/RENAME COLUMN\s+(ph|note|measured_by)/i);
    expect(expandMigration).not.toContain("numeric(10,2)");
    expect(expandMigration).toContain("BATH_MEASUREMENT_ID_FOREIGN_KEY_RECONCILIATION_REQUIRED");
    expect(expandMigration).toContain("BATH_MEASUREMENT_ID_VIEW_RECONCILIATION_REQUIRED");
    expect(expandMigration).toContain("ALTER COLUMN id TYPE text USING id::text");
    expect(expandMigration).toContain("bath_measurements_tenant_bath_fkey");
    expect(expandMigration).toContain("bath_measurements_tenant_actor_fkey");
    expect(expandMigration).toContain("bath_measurements_dual_write_bridge");
    expect(expandMigration).toContain("BATH_MEASUREMENT_DUAL_WRITE_CONFLICT");
    expect(expandMigration).toContain("pg_catalog.gen_random_uuid()");
    expect(expandMigration).not.toContain("DO $boundary$");
    expect(expandMigration).not.toContain("DROP TRIGGER IF EXISTS bath_measurements_dual_write_bridge");
    expect(expandMigration).not.toContain("CREATE OR REPLACE FUNCTION public.bridge_bath_measurement_columns");
    expect(expandMigration).not.toMatch(/ALTER COLUMN measured_by_user_id SET NOT NULL/i);
  });

  it("tightens the actor contract without deleting the compatibility bridge or legacy values", () => {
    expect(contractMigration).toContain("BATH_MEASUREMENT_ACTOR_RECONCILIATION_REQUIRED");
    expect(contractMigration).toMatch(/ALTER COLUMN measured_by_user_id SET NOT NULL/i);
    expect(contractMigration).toContain("BATH_MEASUREMENT_BRIDGE_VERIFICATION_FAILED");
    expect(contractMigration).not.toMatch(/DROP\s+(?:TRIGGER|FUNCTION|COLUMN)/i);
  });

  it("mirrors tenant-bound keys and never fabricates an epoch or actor", () => {
    expect(schema).toContain('uniqueIndex("baths_tenant_id_uidx")');
    expect(schema).toContain('name: "bath_measurements_tenant_bath_fkey"');
    expect(schema).toContain('name: "bath_measurements_tenant_actor_fkey"');
    expect(bathsRepository).not.toContain("new Date(0)");
    expect(measurementsRepository).not.toContain("new Date(0)");
    expect(bathsRepository).not.toMatch(/measuredBy:\s*["']System["']/);
    expect(measurementsRepository).not.toMatch(/measuredBy:\s*["']System["']/);
  });
});
