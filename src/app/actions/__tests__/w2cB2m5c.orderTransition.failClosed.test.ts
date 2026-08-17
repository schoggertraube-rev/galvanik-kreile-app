import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const checkAppAuthSpy = vi.fn();
const resolveAuthorizationSpy = vi.fn();
const dbSpies = {
  select: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  set: vi.fn(),
  where: vi.fn(),
};
const revalidatePathSpy = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ db: dbSpies }));
vi.mock("@/db/schema", () => ({ orders: {}, items: {}, customers: {}, events: {} }));
vi.mock("@/lib/server/authHelper", () => ({ checkAppAuth: checkAppAuthSpy }));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: resolveAuthorizationSpy }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn(), revalidatePath: revalidatePathSpy }));

const denial = {
  ok: false,
  error: "CONFLICT",
  message: "NOT_AVAILABLE: Stationswechsel benötigen den W3-Command-Vertrag.",
};

describe("W2C-B2M5C transitionOrderProcess quarantine", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies start, complete, and targetStep before every guarded dependency", async () => {
    const { transitionOrderProcess } = await import("../orders.actions");

    await expect(transitionOrderProcess({ orderId: "order-start", action: "start" })).resolves.toEqual(denial);
    await expect(transitionOrderProcess({ orderId: "order-complete", action: "complete" })).resolves.toEqual(denial);
    await expect(transitionOrderProcess({ orderId: "order-target", targetStep: "galvanik" })).resolves.toEqual(denial);

    expect(checkAppAuthSpy).not.toHaveBeenCalled();
    expect(resolveAuthorizationSpy).not.toHaveBeenCalled();
    expect(dbSpies.select).not.toHaveBeenCalled();
    expect(dbSpies.transaction).not.toHaveBeenCalled();
    expect(dbSpies.update).not.toHaveBeenCalled();
    expect(dbSpies.insert).not.toHaveBeenCalled();
    expect(dbSpies.values).not.toHaveBeenCalled();
    expect(dbSpies.set).not.toHaveBeenCalled();
    expect(dbSpies.where).not.toHaveBeenCalled();
    expect(revalidatePathSpy).not.toHaveBeenCalled();
  });

  it("source-locks the exact denied body and excludes every mutation dependency", async () => {
    const actionPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../orders.actions.ts");
    const source = await readFile(actionPath, "utf8");
    const start = source.indexOf("export async function transitionOrderProcess");
    const end = source.indexOf("\n\nexport async function createOrderFromScan", start);

    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const body = source.slice(start, end);
    expect(body).toBe(`export async function transitionOrderProcess(params: {\n  orderId: string;\n  targetStep?: string;\n  action?: string;\n}): Promise<ActionResult<never>> {\n  void params;\n  return { ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Stationswechsel benötigen den W3-Command-Vertrag." };\n}`);
    expect(body).not.toMatch(/checkAppAuth|resolveAuthorization|db\.|transaction|update|insert|events|crypto|randomUUID|Date|revalidatePath|import/);
  });

  it("keeps the dormant legacy station writer immediate and database-free", async () => {
    const { moveOperationalOrderToStationService } = await import("@/lib/server/operationalOrders");

    await expect(
      moveOperationalOrderToStationService("order-1", "galvanik", "user-1"),
    ).rejects.toThrow("NOT_AVAILABLE: Stationswechsel benötigt den W3-Command-Vertrag.");

    expect(dbSpies.select).not.toHaveBeenCalled();
    expect(dbSpies.transaction).not.toHaveBeenCalled();
    expect(dbSpies.update).not.toHaveBeenCalled();
    expect(dbSpies.insert).not.toHaveBeenCalled();
  });

  it("keeps legacy writers denied while the named W3 handoff remains the sole reactivated entry", async () => {
    const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const [wareneingang, stationStatus, galvanik, wareneingangPage] = await Promise.all([
      readFile(path.join(srcRoot, "components/orders/variants/WareneingangActive.tsx"), "utf8"),
      readFile(path.join(srcRoot, "components/orders/StationStatusButton.tsx"), "utf8"),
      readFile(path.join(srcRoot, "app/warendurchlauf/galvanik/page.tsx"), "utf8"),
      readFile(path.join(srcRoot, "app/warendurchlauf/wareneingang/page.tsx"), "utf8"),
    ]);

    for (const source of [stationStatus, galvanik]) {
      expect(source).not.toContain("transitionOrderProcess");
    }
    expect(wareneingang).not.toContain("transitionOrderProcess");
    expect(wareneingangPage).toContain("WareneingangHandoffButton");

    const wareneingangStart = wareneingang.indexOf("<button");
    const wareneingangEnd = wareneingang.indexOf(">", wareneingangStart);
    expect(wareneingangStart).toBeGreaterThanOrEqual(0);
    expect(wareneingangEnd).toBeGreaterThan(wareneingangStart);
    const wareneingangOpeningTag = wareneingang.slice(wareneingangStart, wareneingangEnd + 1);
    expect(wareneingangOpeningTag).toContain("disabled");
    expect(wareneingangOpeningTag).not.toContain("onClick");

    let stationSearchFrom = 0;
    for (let index = 0; index < 2; index += 1) {
      const stationStart = stationStatus.indexOf("<Button", stationSearchFrom);
      const stationEnd = stationStatus.indexOf(">", stationStart);
      expect(stationStart).toBeGreaterThanOrEqual(0);
      expect(stationEnd).toBeGreaterThan(stationStart);
      const stationOpeningTag = stationStatus.slice(stationStart, stationEnd + 1);
      expect(stationOpeningTag).toContain("disabled");
      expect(stationOpeningTag).not.toContain("onClick");
      stationSearchFrom = stationEnd + 1;
    }

    expect(galvanik).not.toContain("handleAdvance");
    expect(galvanik).not.toContain("onAdvance");
    expect(galvanik).not.toContain("setReadyOrders(prev");
    expect(galvanik).not.toContain("setInProgressOrders(prev");
    expect(galvanik).not.toContain("getStationReadyOrders");
    expect(galvanik).not.toContain("getStationOrders");
    expect(galvanik).toContain("getGalvanikOrdersAction()");
    expect(galvanik).toContain("const renderOrderList");
    expect(galvanik).toContain("orders.map((o) => (");
  });
});
