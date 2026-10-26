import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  execute: vi.fn(), withTransaction: vi.fn(), createUpload: vi.fn(), readStable: vi.fn(), createDownload: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("drizzle-orm", () => ({ sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }) }));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: ports.withTransaction }));
vi.mock("@/lib/server/domainAttachmentStorage", () => ({
  DomainAttachmentStorageError: class DomainAttachmentStorageError extends Error { constructor(readonly kind: string) { super(kind); } },
  createDomainAttachmentUploadGrant: ports.createUpload,
  readStableDomainAttachment: ports.readStable,
  createDomainAttachmentDownloadUrl: ports.createDownload,
}));

import { finalizeDomainAttachment, reserveDomainAttachment } from "../domainAttachment";

const ATTACHMENT = "11111111-1111-4111-8111-111111111111";
const ACTOR = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "customer-1";
const CLIENT = "33333333-3333-4333-8333-333333333333";
const bytes = new TextEncoder().encode("%PDF-synthetic-evidence");
const hash = createHash("sha256").update(bytes).digest("hex");
const authorization = {
  userId: ACTOR, tenantId: "kreile", displayName: "Rolf", role: "meister" as const,
  permissions: ["perm_view_leitstand", "perm_op_photos"] as const, active: true as const,
};

function row(status: "upload_reserved" | "secured") {
  return {
    id: ATTACHMENT, tenant_id: "kreile", file_url: `storage://scans/domain-attachments/v1/${ATTACHMENT}.pdf`, file_type: "application/pdf",
    uploaded_by: ACTOR, uploaded_at: "2026-10-26T12:00:00.000Z", status, linked_order_id: null, linked_customer_id: CUSTOMER,
    original_hash: status === "secured" ? hash : null, original_storage_path: status === "secured" ? `domain-attachments/v1/${ATTACHMENT}.pdf` : null,
    original_size_bytes: status === "secured" ? bytes.byteLength : null, original_secured_at: status === "secured" ? "2026-10-26T12:01:00.000Z" : null,
    client_idempotency_key: CLIENT,
  };
}

describe("domain attachments", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    ports.withTransaction.mockImplementation(async (_authorization, work) => work({ execute: ports.execute }));
    ports.createUpload.mockResolvedValue({ path: `domain-attachments/v1/${ATTACHMENT}.pdf`, token: "signed-upload" });
  });

  it("reserves a tenant-bound customer document and returns only a signed upload grant", async () => {
    ports.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: CUSTOMER }]).mockResolvedValueOnce([row("upload_reserved")]);
    const result = await reserveDomainAttachment(authorization, {
      targetType: "CUSTOMER", targetId: CUSTOMER, clientRequestId: CLIENT, mimeType: "application/pdf", fileBytes: bytes.byteLength, contentSha256: hash,
    });
    expect(result).toMatchObject({ code: "OK", data: { receipt: { targetType: "CUSTOMER", targetId: CUSTOMER, state: "PENDING" }, upload: { token: "signed-upload" } } });
    expect(ports.execute.mock.calls[2]?.[0].text).toContain("INSERT INTO public.scan_uploads");
  });

  it("verifies bytes, signature and hash before finalizing", async () => {
    ports.execute.mockResolvedValueOnce([row("upload_reserved")]).mockResolvedValueOnce([row("secured")]);
    ports.readStable.mockResolvedValue({
      info: { id: "storage-object", version: "1", path: `domain-attachments/v1/${ATTACHMENT}.pdf`, createdAt: "2026-10-26T12:01:00.000Z", size: bytes.byteLength, contentType: "application/pdf" },
      bytes,
    });
    const result = await finalizeDomainAttachment(authorization, { attachmentId: ATTACHMENT, fileBytes: bytes.byteLength, contentSha256: hash });
    expect(result).toMatchObject({ code: "OK", data: { receipt: { state: "FINALIZED", contentSha256: hash }, replayed: false } });
    expect(ports.execute.mock.calls[1]?.[0].text).toContain("status='secured'");
  });

  it("rejects invalid input and roles before database or storage access", async () => {
    await expect(reserveDomainAttachment(authorization, {})).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(reserveDomainAttachment({ ...authorization, permissions: ["perm_view_leitstand"] }, {
      targetType: "CUSTOMER", targetId: CUSTOMER, clientRequestId: CLIENT, mimeType: "application/pdf", fileBytes: bytes.byteLength, contentSha256: hash,
    })).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(ports.withTransaction).not.toHaveBeenCalled();
  });
});
