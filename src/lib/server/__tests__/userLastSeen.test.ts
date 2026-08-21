import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveAuthorizationSpy, withTransactionSpy, executeSpy } = vi.hoisted(() => ({
  resolveAuthorizationSpy: vi.fn(),
  withTransactionSpy: vi.fn(),
  executeSpy: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: resolveAuthorizationSpy }));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: withTransactionSpy,
}));
vi.mock("drizzle-orm", () => ({
  sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }),
}));

const authorization = {
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "tenant-a",
  displayName: "Werkstatt",
  role: "werkstatt" as const,
  permissions: ["perm_view_leitstand"] as const,
  active: true as const,
};
const clientEventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const correlationId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const lastSeenAt = "2026-08-20T12:15:00.000Z";
const receiptRow = {
  event_id: "event-last-seen-1",
  tenant_id: "tenant-a",
  actor_id: authorization.userId,
  client_event_id: clientEventId,
  correlation_id: correlationId,
  event_schema_version: 1,
  aggregate_version: 1,
  previous_seen_at: null,
  last_seen_at: lastSeenAt,
  integrity_ok: true,
};

describe("F1.3 L2 user last-seen contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveAuthorizationSpy.mockResolvedValue({ ok: true, data: authorization });
    withTransactionSpy.mockImplementation(async (_authorization, work) => work({ execute: executeSpy }));
  });

  it("rejects malformed runtime input before authorization or database access", async () => {
    const { markUserLastSeen } = await import("../userLastSeen");
    for (const input of [
      undefined,
      { expectedVersion: -1, clientEventId },
      { expectedVersion: 0, clientEventId: clientEventId.toUpperCase() },
      { expectedVersion: 0, clientEventId, tenantId: "tenant-b" },
    ]) {
      await expect(markUserLastSeen(input as never)).resolves.toMatchObject({ code: "VALIDATION_ERROR" });
    }
    expect(resolveAuthorizationSpy).not.toHaveBeenCalled();
    expect(withTransactionSpy).not.toHaveBeenCalled();
  });

  it("fails closed for missing or unavailable authorization", async () => {
    const { markUserLastSeen } = await import("../userLastSeen");
    resolveAuthorizationSpy.mockResolvedValueOnce({ ok: false, reason: "NO_SESSION" });
    await expect(markUserLastSeen({ expectedVersion: 0, clientEventId })).resolves.toMatchObject({ code: "UNAUTHENTICATED" });
    resolveAuthorizationSpy.mockResolvedValueOnce({ ok: false, reason: "AUTHORIZATION_UNAVAILABLE" });
    await expect(markUserLastSeen({ expectedVersion: 0, clientEventId })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    resolveAuthorizationSpy.mockRejectedValueOnce(new Error("down"));
    await expect(markUserLastSeen({ expectedVersion: 0, clientEventId })).resolves.toMatchObject({ code: "UNAVAILABLE" });
    expect(withTransactionSpy).not.toHaveBeenCalled();
  });

  it("writes state and returns only the exact persisted receipt readback", async () => {
    executeSpy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        tenant_id: authorization.tenantId,
        user_id: authorization.userId,
        last_seen_at: lastSeenAt,
        version: 1,
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([receiptRow]);

    const { markUserLastSeen } = await import("../userLastSeen");
    await expect(markUserLastSeen({ expectedVersion: 0, clientEventId })).resolves.toEqual({
      code: "OK",
      replayed: false,
      receipt: {
        eventId: receiptRow.event_id,
        clientEventId,
        correlationId,
        eventSchemaVersion: 1,
        actorId: authorization.userId,
        aggregateVersion: 1,
        previousSeenAt: null,
        lastSeenAt,
      },
    });

    const queries = executeSpy.mock.calls.map(([query]) => query.text as string);
    expect(queries).toHaveLength(7);
    expect(queries[0]).toContain("pg_advisory_xact_lock");
    expect(queries[4]).toContain("INSERT INTO private.user_last_seen");
    expect(queries[5]).toContain("INSERT INTO public.events");
    expect(queries[6]).toContain("private.v_user_last_seen_receipts_v1");
  });

  it("replays an exact receipt and rejects stale versions without a write", async () => {
    executeSpy.mockResolvedValueOnce([]).mockResolvedValueOnce([receiptRow]);
    const { markUserLastSeen } = await import("../userLastSeen");
    await expect(markUserLastSeen({ expectedVersion: 0, clientEventId })).resolves.toMatchObject({
      code: "OK",
      replayed: true,
      receipt: { eventId: receiptRow.event_id },
    });
    expect(executeSpy).toHaveBeenCalledTimes(2);

    executeSpy.mockReset();
    executeSpy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        tenant_id: authorization.tenantId,
        user_id: authorization.userId,
        last_seen_at: lastSeenAt,
        version: 2,
      }]);
    await expect(markUserLastSeen({ expectedVersion: 1, clientEventId })).resolves.toMatchObject({ code: "CONFLICT" });
    expect(executeSpy.mock.calls.some(([query]) => (query.text as string).includes("UPDATE private.user_last_seen"))).toBe(false);
  });

  it("reads empty and filled personal state but rejects foreign or corrupt rows", async () => {
    const { readUserLastSeen } = await import("../userLastSeen");
    executeSpy.mockResolvedValueOnce([]);
    await expect(readUserLastSeen(authorization)).resolves.toEqual({
      code: "OK",
      data: { userId: authorization.userId, lastSeenAt: null, version: 0 },
    });

    executeSpy.mockResolvedValueOnce([{
      tenant_id: authorization.tenantId,
      user_id: authorization.userId,
      last_seen_at: lastSeenAt,
      version: 1,
      integrity_ok: true,
    }]);
    await expect(readUserLastSeen(authorization)).resolves.toMatchObject({
      code: "OK",
      data: { lastSeenAt, version: 1 },
    });

    executeSpy.mockResolvedValueOnce([{
      tenant_id: "tenant-b",
      user_id: authorization.userId,
      last_seen_at: lastSeenAt,
      version: 1,
      integrity_ok: true,
    }]);
    await expect(readUserLastSeen(authorization)).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("contains no client-supplied tenant, Supabase client, RPC, or non-versioned event path", async () => {
    const sourcePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../userLastSeen.ts");
    const source = await readFile(sourcePath, "utf8");
    expect(source).toContain('import "server-only";');
    expect(source).toContain("resolveAuthorization()");
    expect(source).toContain("USER_LAST_SEEN_RECORDED_V1");
    expect(source).toContain("private.v_user_last_seen_receipts_v1");
    expect(source).not.toMatch(/createClient|supabase|rpc\(/i);
    expect(source).not.toMatch(/input\.tenant|tenantId:\s*input/i);
  });
});
