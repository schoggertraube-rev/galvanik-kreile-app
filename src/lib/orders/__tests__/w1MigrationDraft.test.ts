import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260728124147_foundation_w1_runtime_receipt_columns.sql"),
  "utf8",
);

describe("W1 runtime-receipt migration draft", () => {
  it("rejects an existing receipt column with the wrong type or non-nullability", () => {
    expect(migration).toContain("data_type <> 'uuid' OR is_nullable <> 'YES'");
    expect(migration).toContain("data_type <> 'text' OR is_nullable <> 'YES'");
    expect(migration.match(/is_nullable\s*=\s*'YES'/g)).toHaveLength(3);
  });

  it("adds only nullable receipt columns and their partial idempotency indexes", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS client_event_id uuid;");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS tenant_id text,");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS client_request_id uuid;");
    expect(migration).not.toMatch(/ADD COLUMN IF NOT EXISTS[^;]+NOT NULL/);
    expect(migration).toContain("events_tenant_client_event_uidx");
    expect(migration).toContain("audit_log_tenant_request_action_uidx");
    expect(migration).toContain("WHERE tenant_id IS NOT NULL AND client_event_id IS NOT NULL;");
    expect(migration).toContain("WHERE tenant_id IS NOT NULL AND client_request_id IS NOT NULL;");
  });

  it("cannot become a hidden policy, grant, view, storage, or data mutation", () => {
    expect(migration).not.toMatch(/\bCREATE\s+POLICY\b/i);
    expect(migration).not.toMatch(/\bALTER\s+TABLE\b[^;]*\bROW\s+LEVEL\s+SECURITY\b/i);
    expect(migration).not.toMatch(/\bGRANT\b|\bREVOKE\b/i);
    expect(migration).not.toMatch(/\bCREATE\s+(?:OR\s+REPLACE\s+)?VIEW\b/i);
    expect(migration).not.toMatch(/\bINSERT\s+INTO\b|\bUPDATE\b\s+public\.|\bDELETE\s+FROM\b/i);
  });
});
