import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockRequireFinanceRead,
  mockAssertFinanceDateRange,
  mockDbSelect,
  mockEq,
} = vi.hoisted(() => ({
  mockRequireFinanceRead: vi.fn(),
  mockAssertFinanceDateRange: vi.fn(),
  mockDbSelect: vi.fn(),
  mockEq: vi.fn((left, right) => ({ op: "eq", left, right })),
}));

vi.mock("@/lib/server/financeAuthorization", () => ({
  requireFinanceRead: mockRequireFinanceRead,
  assertFinanceDateRange: mockAssertFinanceDateRange,
}));

vi.mock("@/db", () => ({ db: { select: mockDbSelect } }));
vi.mock("@/lib/analyse/insights", () => ({ generateInsight: vi.fn(() => []) }));
vi.mock("@/lib/server/mockBuchhaltung", () => ({
  buchhaltungMockEnabled: vi.fn(() => false),
  buchhaltungDataSource: vi.fn(() => "live"),
}));
vi.mock("drizzle-orm", () => ({
  and: vi.fn((...parts) => ({ op: "and", parts })),
  eq: mockEq,
  gte: vi.fn((left, right) => ({ op: "gte", left, right })),
  inArray: vi.fn((left, right) => ({ op: "inArray", left, right })),
  lte: vi.fn((left, right) => ({ op: "lte", left, right })),
  ne: vi.fn((left, right) => ({ op: "ne", left, right })),
  sql: vi.fn(() => ({ op: "sql" })),
}));

import * as actions from "@/app/buchhaltung/analysis.actions";

const actor = {
  userId: "user-admin",
  tenantId: "galvanik-kreile",
  displayName: "Admin",
  role: "admin",
  permissions: ["perm_view_prices"],
  active: true,
} as const;

function emptyQuery() {
  const query: Record<string, unknown> = {};
  query.from = vi.fn(() => query);
  query.where = vi.fn(() => query);
  query.leftJoin = vi.fn(() => query);
  query.innerJoin = vi.fn(() => query);
  query.groupBy = vi.fn(() => query);
  query.limit = vi.fn(async () => [{
    ocrConfidenceSchwelle: '85',
    beraterStundensatz: '120',
    minutenProBeleg: 4,
  }]);
  query.then = (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
    Promise.resolve([]).then(resolve, reject);
  return query;
}

const datedActions = [
  actions.getUstvaAnalysisAction,
  actions.getKraftstoffAnalysisAction,
  actions.getOffenePostenAnalysisAction,
  actions.getBwaAnalysisAction,
  actions.getAusgabenAnalysisAction,
  actions.getSparzaehlerAnalysisAction,
] as const;

describe("Buchhaltung analysis Server Action boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbSelect.mockImplementation(() => emptyQuery());
  });

  it("rejects every analysis entry point before date parsing or database access", async () => {
    mockRequireFinanceRead.mockRejectedValue(new Error("AUTH_ERROR: Forbidden"));

    for (const action of datedActions) {
      await expect(action("not-a-date", "also-invalid")).rejects.toThrow("AUTH_ERROR: Forbidden");
    }
    await expect(actions.getAusgabenKategorien()).rejects.toThrow("AUTH_ERROR: Forbidden");

    expect(mockAssertFinanceDateRange).not.toHaveBeenCalled();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it("keeps all seven legitimate finance paths operational for an entitled current actor", async () => {
    mockRequireFinanceRead.mockResolvedValue(actor);

    for (const action of datedActions) {
      await expect(action("2026-01-01", "2026-12-31")).resolves.toBeDefined();
    }
    await expect(actions.getAusgabenKategorien()).resolves.toEqual([]);

    expect(mockRequireFinanceRead).toHaveBeenCalledTimes(7);
    expect(mockAssertFinanceDateRange).toHaveBeenCalledTimes(6);
    expect(mockDbSelect).toHaveBeenCalled();
    expect(mockEq.mock.calls.some((call) => call[1] === actor.tenantId)).toBe(true);
  });
});
