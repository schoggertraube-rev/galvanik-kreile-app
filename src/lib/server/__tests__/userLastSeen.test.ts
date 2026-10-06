import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ROLE_PERMISSIONS,
  type AppRole,
  type PermissionKey,
} from "@/lib/auth/authorizationContract";
import type { AuthorizationFailureReason } from "@/lib/server/authorization";

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

  describe("KR-PERF-LOGIN-01 login path: one resolve on success, fresh resolve only before a CONFLICT retry", () => {
    type Query = { text: string; values: unknown[] };
    type Step = unknown[] | ((query: Query) => unknown[]);
    type Snapshot = Omit<typeof authorization, "role" | "permissions"> & {
      role: AppRole;
      permissions: readonly PermissionKey[];
    };
    const earlierSeenAt = "2026-08-19T08:00:00.000Z";
    const roles = Object.keys(ROLE_PERMISSIONS) as AppRole[];
    const denialByReason: Record<AuthorizationFailureReason, "UNAUTHENTICATED" | "UNAVAILABLE"> = {
      NO_SESSION: "UNAUTHENTICATED",
      INVALID_SESSION: "UNAUTHENTICATED",
      USER_NOT_FOUND: "UNAUTHENTICATED",
      USER_INACTIVE: "UNAUTHENTICATED",
      ROLE_MISMATCH: "UNAUTHENTICATED",
      SESSION_REVOKED: "UNAUTHENTICATED",
      UNKNOWN_ROLE: "UNAUTHENTICATED",
      AUTHORIZATION_UNAVAILABLE: "UNAVAILABLE",
    };
    const reasons = Object.keys(denialByReason) as AuthorizationFailureReason[];

    function snapshotFor(role: AppRole): Snapshot {
      return { ...authorization, role, permissions: ROLE_PERMISSIONS[role] };
    }

    function stateRow(version: number, seenAt: string, integrity = false) {
      return {
        tenant_id: authorization.tenantId,
        user_id: authorization.userId,
        last_seen_at: seenAt,
        version,
        ...(integrity ? { integrity_ok: true } : {}),
      };
    }

    function script(steps: Step[]) {
      for (const step of steps) {
        executeSpy.mockImplementationOnce(async (query: Query) =>
          typeof step === "function" ? step(query) : step);
      }
    }

    function readbackFor(overrides: Record<string, unknown>): Step {
      return (query) => {
        expect(query.text).toContain("private.v_user_last_seen_receipts_v1");
        return [{ ...receiptRow, ...overrides, client_event_id: query.values[1] }];
      };
    }

    function queries(): Query[] {
      return executeSpy.mock.calls.map(([query]) => query as Query);
    }

    function receiptLookupClientIds(): unknown[] {
      return queries()
        .filter((query) => query.text.includes("receipt.client_event_id"))
        .map((query) => query.values[0]);
    }

    function writeQueries(): Query[] {
      return queries().filter((query) =>
        query.text.includes("INSERT INTO") || query.text.includes("UPDATE private.user_last_seen"));
    }

    // attempt 1: read v0, then the locked state shows a concurrent v1 -> CONFLICT
    const conflictingFirstAttempt: Step[] = [[], [], [], [], [stateRow(1, earlierSeenAt)]];

    beforeEach(() => {
      executeSpy.mockReset();
      resolveAuthorizationSpy.mockReset();
      resolveAuthorizationSpy.mockResolvedValue({ ok: true, data: authorization });
    });

    it("covers exactly the six canonical roles", () => {
      expect([...roles].sort()).toEqual(["admin", "buero", "developer", "meister", "readonly", "werkstatt"]);
    });

    for (const role of roles) {
      it(`conflict-free login as ${role}: one resolve, read and write with the same snapshot`, async () => {
        const snapshot = snapshotFor(role);
        resolveAuthorizationSpy.mockReset();
        resolveAuthorizationSpy.mockResolvedValueOnce({ ok: true, data: snapshot });
        script([
          [],
          [],
          [],
          [],
          [],
          [stateRow(1, lastSeenAt)],
          [],
          readbackFor({ aggregate_version: 1, previous_seen_at: null, last_seen_at: lastSeenAt }),
        ]);

        const { recordUserLastSeenForLogin } = await import("../userLastSeen");
        const result = await recordUserLastSeenForLogin();

        expect(resolveAuthorizationSpy).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
          code: "OK",
          replayed: false,
          receipt: {
            eventId: receiptRow.event_id,
            actorId: authorization.userId,
            aggregateVersion: 1,
            previousSeenAt: null,
            lastSeenAt,
            eventSchemaVersion: 1,
          },
        });

        expect(withTransactionSpy).toHaveBeenCalledTimes(2);
        for (const [used] of withTransactionSpy.mock.calls) expect(used).toBe(snapshot);

        const issued = receiptLookupClientIds();
        expect(issued).toHaveLength(1);
        expect(result.code === "OK" && result.receipt.clientEventId).toBe(issued[0]);

        const texts = queries().map((query) => query.text);
        expect(texts).toHaveLength(8);
        expect(texts[0]).toContain("private.v_user_last_seen_v1");
        expect(texts[1]).toContain("pg_advisory_xact_lock");
        expect(texts[5]).toContain("INSERT INTO private.user_last_seen");
        expect(texts[6]).toContain("INSERT INTO public.events");
        expect(texts[7]).toContain("private.v_user_last_seen_receipts_v1");
      });
    }

    it("CONFLICT retry: re-resolves once, retry read+write use only the fresh snapshot, same clientEventId", async () => {
      const freshAuthorization = { ...authorization, displayName: "Werkstatt (frisch)" };
      resolveAuthorizationSpy.mockReset();
      resolveAuthorizationSpy
        .mockResolvedValueOnce({ ok: true, data: authorization })
        .mockResolvedValueOnce({ ok: true, data: freshAuthorization });
      script([
        ...conflictingFirstAttempt,
        // attempt 2: read v1 -> update to v2
        [stateRow(1, earlierSeenAt, true)],
        [],
        [],
        [],
        [stateRow(1, earlierSeenAt)],
        [stateRow(2, lastSeenAt)],
        [],
        readbackFor({ aggregate_version: 2, previous_seen_at: earlierSeenAt, last_seen_at: lastSeenAt }),
      ]);

      const { recordUserLastSeenForLogin } = await import("../userLastSeen");
      const result = await recordUserLastSeenForLogin();

      expect(resolveAuthorizationSpy).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({
        code: "OK",
        replayed: false,
        receipt: { aggregateVersion: 2, previousSeenAt: earlierSeenAt, lastSeenAt },
      });

      const issued = receiptLookupClientIds();
      expect(issued).toHaveLength(2);
      expect(issued[0]).toBe(issued[1]);
      expect(result.code === "OK" && result.receipt.clientEventId).toBe(issued[0]);

      expect(withTransactionSpy).toHaveBeenCalledTimes(4);
      const snapshots = withTransactionSpy.mock.calls.map(([used]) => used);
      expect(snapshots[0]).toBe(authorization);
      expect(snapshots[1]).toBe(authorization);
      expect(snapshots[2]).toBe(freshAuthorization);
      expect(snapshots[3]).toBe(freshAuthorization);
      expect(queries()).toHaveLength(conflictingFirstAttempt.length + 8);
      expect(queries().some((query) => query.text.includes("UPDATE private.user_last_seen"))).toBe(true);
    });

    it("returns the second CONFLICT unchanged after exactly one retry and two resolves", async () => {
      const staleState = [stateRow(5, earlierSeenAt)];
      script([[], [], [], [], staleState, [], [], [], [], staleState]);

      const { recordUserLastSeenForLogin } = await import("../userLastSeen");
      await expect(recordUserLastSeenForLogin()).resolves.toEqual({
        code: "CONFLICT",
        message: "Letzter Blick wurde bereits geändert.",
      });

      expect(resolveAuthorizationSpy).toHaveBeenCalledTimes(2);
      expect(withTransactionSpy).toHaveBeenCalledTimes(4);
      expect(queries()).toHaveLength(10);
      const issued = receiptLookupClientIds();
      expect(issued).toHaveLength(2);
      expect(issued[0]).toBe(issued[1]);
      expect(writeQueries()).toHaveLength(0);
    });

    for (const reason of reasons) {
      it(`${reason} on the first resolve -> ${denialByReason[reason]}, no transaction`, async () => {
        resolveAuthorizationSpy.mockReset();
        resolveAuthorizationSpy.mockResolvedValueOnce({ ok: false, reason, message: "AUTH_ERROR" });

        const { recordUserLastSeenForLogin } = await import("../userLastSeen");
        await expect(recordUserLastSeenForLogin()).resolves.toMatchObject({ code: denialByReason[reason] });

        expect(resolveAuthorizationSpy).toHaveBeenCalledTimes(1);
        expect(withTransactionSpy).not.toHaveBeenCalled();
        expect(executeSpy).not.toHaveBeenCalled();
      });

      it(`CONFLICT then ${reason} on re-resolve -> ${denialByReason[reason]}, no retry read, write or receipt`, async () => {
        resolveAuthorizationSpy.mockReset();
        resolveAuthorizationSpy
          .mockResolvedValueOnce({ ok: true, data: authorization })
          .mockResolvedValueOnce({ ok: false, reason, message: "AUTH_ERROR" });
        script(conflictingFirstAttempt);

        const { recordUserLastSeenForLogin } = await import("../userLastSeen");
        await expect(recordUserLastSeenForLogin()).resolves.toMatchObject({ code: denialByReason[reason] });

        expect(resolveAuthorizationSpy).toHaveBeenCalledTimes(2);
        expect(withTransactionSpy).toHaveBeenCalledTimes(2);
        for (const [used] of withTransactionSpy.mock.calls) expect(used).toBe(authorization);
        expect(queries()).toHaveLength(conflictingFirstAttempt.length);
        expect(receiptLookupClientIds()).toHaveLength(1);
        expect(writeQueries()).toHaveLength(0);
      });
    }

    it("a thrown resolver error on the first resolve -> UNAVAILABLE, no transaction", async () => {
      resolveAuthorizationSpy.mockReset();
      resolveAuthorizationSpy.mockRejectedValueOnce(new Error("down"));

      const { recordUserLastSeenForLogin } = await import("../userLastSeen");
      await expect(recordUserLastSeenForLogin()).resolves.toMatchObject({ code: "UNAVAILABLE" });

      expect(resolveAuthorizationSpy).toHaveBeenCalledTimes(1);
      expect(withTransactionSpy).not.toHaveBeenCalled();
      expect(executeSpy).not.toHaveBeenCalled();
    });

    it("CONFLICT then a thrown resolver error -> UNAVAILABLE, no retry transaction", async () => {
      resolveAuthorizationSpy.mockReset();
      resolveAuthorizationSpy
        .mockResolvedValueOnce({ ok: true, data: authorization })
        .mockRejectedValueOnce(new Error("down"));
      script(conflictingFirstAttempt);

      const { recordUserLastSeenForLogin } = await import("../userLastSeen");
      await expect(recordUserLastSeenForLogin()).resolves.toMatchObject({ code: "UNAVAILABLE" });

      expect(resolveAuthorizationSpy).toHaveBeenCalledTimes(2);
      expect(withTransactionSpy).toHaveBeenCalledTimes(2);
      for (const [used] of withTransactionSpy.mock.calls) expect(used).toBe(authorization);
      expect(queries()).toHaveLength(conflictingFirstAttempt.length);
      expect(writeQueries()).toHaveLength(0);
    });

    it("an unavailable state read stops before any write transaction", async () => {
      executeSpy.mockRejectedValueOnce(new Error("db down"));

      const { recordUserLastSeenForLogin } = await import("../userLastSeen");
      await expect(recordUserLastSeenForLogin()).resolves.toMatchObject({ code: "UNAVAILABLE" });

      expect(resolveAuthorizationSpy).toHaveBeenCalledTimes(1);
      expect(withTransactionSpy).toHaveBeenCalledTimes(1);
      expect(writeQueries()).toHaveLength(0);
    });
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
