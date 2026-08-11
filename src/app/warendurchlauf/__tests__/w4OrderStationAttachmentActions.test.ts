import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ports = vi.hoisted(() => ({
  resolveAuthorization: vi.fn(),
  read: vi.fn(),
  reserve: vi.fn(),
  finalize: vi.fn(),
  original: vi.fn(),
  noStore: vi.fn(),
  domainLoaded: vi.fn(),
}));

vi.mock("next/cache", () => ({ unstable_noStore: ports.noStore }));
vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: ports.resolveAuthorization,
}));
vi.mock("@/lib/server/orderStationRead", () => ({
  readTenantOrderStationReceipt: vi.fn(),
  readTenantStationOrders: vi.fn(),
}));
vi.mock("@/lib/server/orderStationAttachment", () => {
  ports.domainLoaded();
  return {
    readOrderStationAttachments: ports.read,
    reserveOrderStationAttachment: ports.reserve,
    finalizeOrderStationAttachment: ports.finalize,
    getOrderStationAttachmentOriginal: ports.original,
  };
});

const USER_ID = "11111111-1111-4111-8111-111111111111";
const snapshot = {
  userId: USER_ID,
  tenantId: "galvanik-kreile",
  displayName: "Werkstatt",
  role: "werkstatt" as const,
  permissions: ["perm_view_leitstand", "perm_op_photos"] as const,
  active: true as const,
};
const readInput = { orderId: "order-a", itemId: "item-a" };
const reserveInput = {
  ...readInput,
  expectedVersion: 2,
  clientRequestId: "22222222-2222-4222-8222-222222222222",
  mimeType: "image/png" as const,
  fileBytes: 12,
  contentSha256: "a".repeat(64),
};
const finalizeInput = { reservationId: "33333333-3333-4333-8333-333333333333" };
const originalInput = { receiptId: "44444444-4444-4444-8444-444444444444" };

beforeEach(() => {
  vi.clearAllMocks();
  ports.resolveAuthorization.mockResolvedValue({ ok: true, data: snapshot });
  ports.read.mockResolvedValue({ code: "OK", data: [] });
  ports.reserve.mockResolvedValue({ code: "OK", data: { receipt: {}, upload: {}, replayed: false } });
  ports.finalize.mockResolvedValue({ code: "OK", data: { receipt: {}, replayed: false } });
  ports.original.mockResolvedValue({ code: "OK", data: { downloadUrl: "https://local.invalid", expiresInSeconds: 60 } });
});

describe("W4 attachment server actions", () => {
  it.each([
    ["NO_SESSION", { ok: false, reason: "NO_SESSION", message: "ignored" }, "UNAUTHENTICATED"],
    ["AUTHORIZATION_UNAVAILABLE", { ok: false, reason: "AUTHORIZATION_UNAVAILABLE", message: "ignored" }, "UNAVAILABLE"],
  ])("stops %s before importing or calling any domain port", async (_name, authResult, code) => {
    ports.resolveAuthorization.mockResolvedValueOnce(authResult);
    const {
      finalizeGalvanikHandoffAttachmentAction,
      getGalvanikHandoffAttachmentOriginalAction,
      getGalvanikHandoffAttachmentsAction,
      reserveGalvanikHandoffAttachmentAction,
    } = await import("../actions");

    await expect(getGalvanikHandoffAttachmentsAction(readInput)).resolves.toMatchObject({ code });
    ports.resolveAuthorization.mockResolvedValueOnce(authResult);
    await expect(reserveGalvanikHandoffAttachmentAction(reserveInput)).resolves.toMatchObject({ code });
    ports.resolveAuthorization.mockResolvedValueOnce(authResult);
    await expect(finalizeGalvanikHandoffAttachmentAction(finalizeInput)).resolves.toMatchObject({ code });
    ports.resolveAuthorization.mockResolvedValueOnce(authResult);
    await expect(getGalvanikHandoffAttachmentOriginalAction(originalInput)).resolves.toMatchObject({ code });
    expect(ports.read).not.toHaveBeenCalled();
    expect(ports.reserve).not.toHaveBeenCalled();
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(ports.original).not.toHaveBeenCalled();
    expect(ports.domainLoaded).not.toHaveBeenCalled();
  });

  it("lets readonly and buero read tenant metadata while deriving canOperate=false", async () => {
    const { getGalvanikHandoffAttachmentsAction } = await import("../actions");
    for (const role of ["readonly", "buero"] as const) {
      const readOnlySnapshot = {
        ...snapshot,
        role,
        permissions: ["perm_view_leitstand"] as const,
      };
      ports.resolveAuthorization.mockResolvedValueOnce({ ok: true, data: readOnlySnapshot });
      const result = await getGalvanikHandoffAttachmentsAction(readInput);
      expect(result).toEqual({
        code: "OK",
        data: { receipts: [], canOperate: false, currentActorId: USER_ID },
      });
      expect(ports.read).toHaveBeenLastCalledWith(readOnlySnapshot, readInput);
    }
  });

  it("separates perm_view_leitstand from perm_op_photos in both directions", async () => {
    const {
      getGalvanikHandoffAttachmentsAction,
      reserveGalvanikHandoffAttachmentAction,
    } = await import("../actions");

    ports.resolveAuthorization.mockResolvedValueOnce({
      ok: true,
      data: { ...snapshot, permissions: ["perm_op_photos"] },
    });
    await expect(getGalvanikHandoffAttachmentsAction(readInput)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(ports.read).not.toHaveBeenCalled();

    ports.resolveAuthorization.mockResolvedValueOnce({
      ok: true,
      data: { ...snapshot, role: "readonly", permissions: ["perm_view_leitstand"] },
    });
    await expect(reserveGalvanikHandoffAttachmentAction(reserveInput)).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(ports.reserve).not.toHaveBeenCalled();
  });

  it("keeps readonly, buero, and perm_op_status-only snapshots out of every photo mutation port", async () => {
    const {
      finalizeGalvanikHandoffAttachmentAction,
      getGalvanikHandoffAttachmentOriginalAction,
      reserveGalvanikHandoffAttachmentAction,
    } = await import("../actions");
    for (const [role, permissions] of [
      ["readonly", ["perm_view_leitstand"]],
      ["buero", ["perm_view_leitstand"]],
      ["werkstatt", ["perm_view_leitstand", "perm_op_status"]],
    ] as const) {
      for (const [action, input] of [
        [reserveGalvanikHandoffAttachmentAction, reserveInput],
        [finalizeGalvanikHandoffAttachmentAction, finalizeInput],
        [getGalvanikHandoffAttachmentOriginalAction, originalInput],
      ] as const) {
        ports.resolveAuthorization.mockResolvedValueOnce({
          ok: true,
          data: { ...snapshot, role, permissions },
        });
        await expect(action(input as never)).resolves.toMatchObject({ code: "FORBIDDEN" });
      }
    }
    expect(ports.reserve).not.toHaveBeenCalled();
    expect(ports.finalize).not.toHaveBeenCalled();
    expect(ports.original).not.toHaveBeenCalled();
  });

  it("forwards only the server-resolved snapshot and exact input to all four ports", async () => {
    const {
      finalizeGalvanikHandoffAttachmentAction,
      getGalvanikHandoffAttachmentOriginalAction,
      getGalvanikHandoffAttachmentsAction,
      reserveGalvanikHandoffAttachmentAction,
    } = await import("../actions");

    await getGalvanikHandoffAttachmentsAction(readInput);
    await reserveGalvanikHandoffAttachmentAction(reserveInput);
    await finalizeGalvanikHandoffAttachmentAction(finalizeInput);
    await getGalvanikHandoffAttachmentOriginalAction(originalInput);

    expect(ports.read).toHaveBeenCalledWith(snapshot, readInput);
    expect(ports.reserve).toHaveBeenCalledWith(snapshot, reserveInput);
    expect(ports.finalize).toHaveBeenCalledWith(snapshot, finalizeInput);
    expect(ports.original).toHaveBeenCalledWith(snapshot, originalInput);
    expect(ports.noStore).toHaveBeenCalledTimes(4);
  });

  it("maps resolver rejection to unavailable without a domain call", async () => {
    ports.resolveAuthorization.mockRejectedValueOnce(new Error("offline"));
    const { finalizeGalvanikHandoffAttachmentAction } = await import("../actions");
    await expect(finalizeGalvanikHandoffAttachmentAction(finalizeInput)).resolves.toMatchObject({
      code: "UNAVAILABLE",
    });
    expect(ports.finalize).not.toHaveBeenCalled();
  });

  it("source-locks authorization and capability before every dynamic domain import", async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
    const source = await readFile(path.join(root, "src/app/warendurchlauf/actions.ts"), "utf8");
    for (const [startName, endName, permission] of [
      ["getGalvanikHandoffAttachmentsAction", "reserveGalvanikHandoffAttachmentAction", "perm_view_leitstand"],
      ["reserveGalvanikHandoffAttachmentAction", "finalizeGalvanikHandoffAttachmentAction", "perm_op_photos"],
      ["finalizeGalvanikHandoffAttachmentAction", "getGalvanikHandoffAttachmentOriginalAction", "perm_op_photos"],
      ["getGalvanikHandoffAttachmentOriginalAction", "startProcessingStation", "perm_op_photos"],
    ] as const) {
      const section = source.slice(source.indexOf(`export async function ${startName}`), source.indexOf(`export async function ${endName}`));
      expect(section).toContain(`authorizeOrderStationAttachment("${permission}")`);
      expect(section.indexOf("authorizeOrderStationAttachment")).toBeLessThan(
        section.indexOf('import("@/lib/server/orderStationAttachment")'),
      );
    }
    expect(source).not.toContain("createAdminClient");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});
