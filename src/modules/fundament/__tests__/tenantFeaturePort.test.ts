import { beforeEach, describe, expect, it, vi } from "vitest";
import { SALES_STAGE_FEATURES } from "../featureCatalog";

const { execute, withTransaction } = vi.hoisted(() => ({ execute: vi.fn(), withTransaction: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/privilegedDb", () => ({ withPrivilegedTenantTransaction: withTransaction }));
vi.mock("drizzle-orm", () => ({ sql: (parts: TemplateStringsArray, ...values: unknown[]) => ({ text: parts.join("?"), values }) }));

const context = { tenantId: "synthetic-tenant", actorId: "11111111-1111-4111-8111-111111111111", canManage: true };
const rows = SALES_STAGE_FEATURES.map((feature) => ({ feature_id: feature.id, enabled: feature.defaultEnabled }));

describe("tenant feature port", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    withTransaction.mockImplementation(async (_context, work) => work({ execute }));
  });

  it("reads one complete tenant-bound set and fails closed when a row is missing", async () => {
    const { readTenantFeatures } = await import("../server/tenantFeaturePort");
    execute.mockResolvedValueOnce(rows);
    await expect(readTenantFeatures(context)).resolves.toMatchObject({
      code: "OK",
      features: expect.arrayContaining([{ id: "E01", enabled: true }, { id: "W02", enabled: false }]),
    });
    execute.mockResolvedValueOnce(rows.slice(1));
    await expect(readTenantFeatures(context)).resolves.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("updates only a known feature in the current tenant and rejects unauthorized writes", async () => {
    const { setTenantFeature } = await import("../server/tenantFeaturePort");
    await expect(setTenantFeature({ ...context, canManage: false }, { featureId: "W02", enabled: true })).resolves.toMatchObject({ code: "FORBIDDEN" });
    expect(withTransaction).not.toHaveBeenCalled();

    execute.mockResolvedValueOnce([{ feature_id: "W02" }]);
    await expect(setTenantFeature(context, { featureId: "W02", enabled: true })).resolves.toEqual({ code: "OK", feature: { id: "W02", enabled: true } });
    const query = execute.mock.calls[0]?.[0];
    expect(query.text).toContain("tenant =");
    expect(query.values).toEqual(expect.arrayContaining([context.tenantId, "W02", true]));
  });
});
