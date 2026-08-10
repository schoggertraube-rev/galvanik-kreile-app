import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const stationMessage = "NOT_AVAILABLE: Stationsstart benötigt den W3-Command-Vertrag.";
const kpiMessage = "NOT_AVAILABLE: Warendurchlauf-KPIs benötigen einen kanonischen SQL-Read-Model-Vertrag.";
const checkAppAuth = vi.fn();
const operationalPorts = {
  getOperationalOrders: vi.fn(),
  getOperationalOrdersByStation: vi.fn(),
  getOperationalOrdersReadyForStation: vi.fn(),
};
const db = { transaction: vi.fn(), select: vi.fn(), update: vi.fn(), insert: vi.fn() };
const revalidatePath = vi.fn();
const createId = vi.fn();

vi.mock("@/lib/server/authHelper", () => ({ checkAppAuth }));
vi.mock("@/lib/server/operationalOrders", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/operationalOrders")>("@/lib/server/operationalOrders");
  return { ...actual, ...operationalPorts };
});
vi.mock("@/db", () => ({ db }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@paralleldrive/cuid2", () => ({ createId }));

function extractFunctionBody(source: string, functionName: string): string {
  const start = source.indexOf(`export async function ${functionName}(`);
  expect(start).toBeGreaterThanOrEqual(0);
  const declarationEnd = source.indexOf("\n", start);
  expect(declarationEnd).toBeGreaterThan(start);
  const bodyStart = source.lastIndexOf("{", declarationEnd);
  expect(bodyStart).toBeGreaterThan(start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }
  throw new Error(`Could not isolate ${functionName}`);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("W2C-B2M5J station and KPI fail-closed boundaries", () => {
  it.each(["order-foreign-001", "00000000-0000-4000-8000-000000000001"])("denies station start for adversarial order %s with no port calls", async (orderId) => {
    const { startProcessingStation } = await import("../actions");
    const { startProcessingStationService } = await import("@/lib/server/operationalOrders");

    await expect(startProcessingStation(orderId, "beschichtung")).resolves.toEqual({ ok: false, error: "CONFLICT", message: stationMessage });
    await expect(startProcessingStationService(orderId, "beschichtung", "actor-foreign")).rejects.toThrow(stationMessage);

    expect(checkAppAuth).not.toHaveBeenCalled();
    expect(operationalPorts.getOperationalOrders).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.select).not.toHaveBeenCalled();
    expect(db.update).not.toHaveBeenCalled();
    expect(db.insert).not.toHaveBeenCalled();
    expect(createId).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("denies KPI reads before authentication, orders, and clock calculation", async () => {
    const dateNow = vi.spyOn(Date, "now");
    const { getWarendurchlaufKPIs } = await import("../actions");

    await expect(getWarendurchlaufKPIs()).resolves.toEqual({ ok: false, error: "NOT_AVAILABLE", message: kpiMessage });

    expect(checkAppAuth).not.toHaveBeenCalled();
    expect(operationalPorts.getOperationalOrders).not.toHaveBeenCalled();
    expect(dateNow).not.toHaveBeenCalled();
  });

  it("locks only the denied bodies and their UTF-8 truth anchors", () => {
    const actions = readFileSync(resolve(process.cwd(), "src/app/warendurchlauf/actions.ts"), "utf8");
    const service = readFileSync(resolve(process.cwd(), "src/lib/server/operationalOrders.ts"), "utf8");
    const stationActionBody = extractFunctionBody(actions, "startProcessingStation");
    const kpiBody = extractFunctionBody(actions, "getWarendurchlaufKPIs");
    const serviceBody = extractFunctionBody(service, "startProcessingStationService");

    expect(Buffer.from(stationMessage, "utf8").toString("hex")).toBe("4e4f545f415641494c41424c453a2053746174696f6e7373746172742062656ec3b6746967742064656e2057332d436f6d6d616e642d566572747261672e");
    expect(Buffer.from(kpiMessage, "utf8").toString("hex")).toBe("4e4f545f415641494c41424c453a20576172656e64757263686c6175662d4b5049732062656ec3b6746967656e2065696e656e206b616e6f6e69736368656e2053514c2d526561642d4d6f64656c2d566572747261672e");
    expect(Buffer.from(actions, "utf8").toString("hex")).toContain(Buffer.from(stationMessage, "utf8").toString("hex"));
    expect(Buffer.from(actions, "utf8").toString("hex")).toContain(Buffer.from(kpiMessage, "utf8").toString("hex"));

    for (const body of [stationActionBody, kpiBody, serviceBody]) {
      for (const forbidden of ["checkAppAuth", "getOperationalOrders", "transaction", "select", "update", "insert", "createId", "revalidate", "Date", "event"]) {
        expect(body).not.toContain(forbidden);
      }
    }
  });
});
