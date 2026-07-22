import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("scan schema and rollout contract", () => {
  it("creates scan_uploads before declaring dynamically typed parent relations", () => {
    const migration = source("supabase/migrations/20260621103338_fk_scan_uploads.sql");
    expect(migration.indexOf("CREATE TABLE IF NOT EXISTS public.scan_uploads")).toBeLessThan(
      migration.indexOf("ADD CONSTRAINT fk_scan_uploads_order"),
    );
    expect(migration).toContain("format_type(a.atttypid, a.atttypmod)");
    expect(migration).toContain("does not match orders.id type");
    expect(migration).toContain("does not match customers.id type");
  });

  it("removes every browser policy and effective browser privilege", () => {
    const earlyBoundary = source("supabase/migrations/20260621103346_add_ocr_provider.sql");
    const additive = source("supabase/migrations/20260626000000_erfassung_additive_spalten.sql");
    const prepared = source("supabase/migrations/20260720000100_scan_original_receipt_prepared_unapplied.sql");
    const capability = source("src/lib/server/scanCaptureCapability.ts");

    for (const migration of [earlyBoundary, additive, prepared]) {
      expect(migration).toContain("FOR policy_name IN");
      expect(migration).toContain("REVOKE ALL PRIVILEGES ON TABLE public.scan_uploads FROM PUBLIC");
      expect(migration).not.toContain("auth_read_scan_uploads");
      expect(migration).not.toContain("allow_tenant_all_scan_uploads");
    }
    expect(capability).toContain("has_table_privilege");
    expect(capability).toContain("has_any_column_privilege");
    expect(capability).toContain("not exists (\n      select 1 from pg_policies");
  });

  it("preserves legacy/photo rows while constraining only explicit capture receipts", () => {
    const migration = source("supabase/migrations/20260720000100_scan_original_receipt_prepared_unapplied.sql");
    const schema = source("src/db/schema.ts");

    expect(schema).toContain('recordKind: text("record_kind").notNull().default("legacy")');
    expect(migration).toContain("record_kind IN ('capture_scan', 'order_photo', 'legacy')");
    expect(migration).toContain("content_sha256 IS NOT NULL");
    expect(migration).toContain("file_size_bytes IS NOT NULL");
    expect(migration).toContain("file_type IS NOT NULL");
    expect(migration).toContain("FOREIGN KEY (tenant_id, linked_order_id)");
    expect(migration).toContain("FOREIGN KEY (tenant_id, uploaded_by)");
    expect(migration).not.toContain("SET status = 'legacy_unverified'");
  });

  it("requires a private constrained scans bucket", () => {
    const bucket = source("supabase/migrations/20260611114327_create_storage_buckets.sql");
    const prepared = source("supabase/migrations/20260720000100_scan_original_receipt_prepared_unapplied.sql");
    const capability = source("src/lib/server/scanCaptureCapability.ts");

    for (const evidence of [bucket, prepared, capability]) {
      expect(evidence).toContain("14680064");
      expect(evidence).toContain("image/jpeg");
      expect(evidence).toContain("image/png");
      expect(evidence).toContain("application/pdf");
    }
    expect(bucket).toContain("on conflict (id) do update set");
    expect(prepared).toContain("public = false");
    expect(capability).toContain("public = false");
    expect(prepared).toContain("CREATE POLICY scans_server_only_boundary");
    expect(prepared).toContain("AS RESTRICTIVE");
    expect(prepared).toContain("FOR ALL");
    expect(prepared).toContain("USING (bucket_id <> 'scans')");
    expect(prepared).toContain("WITH CHECK (bucket_id <> 'scans')");
    expect(capability).toContain("policy.polrelid = 'storage.objects'::regclass");
    expect(capability).toContain("not policy.polpermissive");
    expect(capability).toContain("policy.polcmd = '*'");
    expect(capability).toContain("policy.polname = 'scans_server_only_boundary'");
    expect(capability).toContain("allowed_mime_types <@");
  });

  it("uses direct-to-storage admission, durable quotas, and metered OCR", () => {
    const upload = source("src/app/api/erfassung/scan-upload/route.ts");
    const process = source("src/app/api/erfassung/scan-process/[id]/route.ts");
    const client = source("src/components/erfassung/ScanFlow/ScanUpload.tsx");

    expect(upload).toContain("createSignedUploadUrl");
    expect(upload).not.toContain("request.formData()");
    expect(upload).toContain("USER_UPLOADS_PER_HOUR");
    expect(upload).toContain("USER_UPLOAD_BYTES_PER_DAY");
    expect(client).toContain("directSignedUpload");
    expect(client).toContain("max. 14 MB");
    expect(process).toContain("reserveDirectAiUsage");
    expect(process).toContain("claimDirectAiUsage");
    expect(process).toContain("settleDirectAiUsage");
  });
});
