import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, expect, test, vi } from "vitest";
import { recordExtraWorkApproval, type RecordExtraWorkApprovalInput } from "../orderExtraWorkCommand";

const fixture = vi.hoisted(() => {
  const actor = {
    active: true, role: "buero", tenantId: "TEST-Mandant",
    userId: "ab000000-0000-4000-8000-000000000001",
    packageSwitches: { p3_werkstatt: true },
    areas: ["auftraege", "preise", "mails"], permissions: ["perm_view_leitstand"],
  };
  return { actor, execute: vi.fn(), authorized: vi.fn() };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: fixture.authorized }));
vi.mock("@/lib/server/orderCardRead", () => ({
  canViewOrderCard: (auth: typeof fixture.actor) => auth.permissions.includes("perm_view_leitstand"),
}));
vi.mock("@/lib/server/privilegedDb", () => ({
  withPrivilegedTenantTransaction: (_auth: unknown, run: (tx: unknown) => unknown) => run({ execute: fixture.execute }),
}));
vi.mock("../immutableInvoiceCommand", () => ({ readOrderScrapInvoiceNumberInTransaction: async () => null }));

const request = {
  channel: "mail",
  orderId: "TEST-Auftrag",
  clientEventId: "ab000000-0000-4000-8000-000000000002",
  intakeItemId: "ab000000-0000-4000-8000-000000000003",
  positions: [{ lineId: "ab000000-0000-4000-8000-000000000004", lineVersion: 1 }],
  approvedNetAmountCents: 1000,
  confirmationText: "TEST Der Kunde bestätigt die Mehrarbeit.",
} satisfies RecordExtraWorkApprovalInput;
const customerId = "TEST-Kunde";
const dialect = new PgDialect();

beforeEach(() => {
  vi.resetAllMocks();
  fixture.authorized.mockResolvedValue({ ok: true, data: fixture.actor });
  fixture.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ version: 1, station: "galvanik", customer_id: customerId }]);
});

test("Eine Mail am anderen Auftrag erhöht den abrechenbaren Betrag nicht", async () => {
  const readMail = vi.fn(async () => ({ id: request.intakeItemId, orderId: "TEST-Anderer-Auftrag", customerId }));
  await expect(recordExtraWorkApproval(request, readMail)).resolves.toEqual({
    code: "CONFLICT", message: "Der Auftrag wurde inzwischen geändert. Bitte neu öffnen.",
    next: { label: "Auftrag neu öffnen", href: "/orders/TEST-Auftrag" },
  });
  expect(fixture.execute.mock.calls.some(([query]) => dialect.sqlToQuery(query).sql.includes("INSERT INTO"))).toBe(false);
});

test("Eine Mailzusage braucht zusätzlich das Nachrichtenrecht", async () => {
  fixture.authorized.mockResolvedValue({
    ok: true, data: { ...fixture.actor, areas: ["auftraege", "preise"] },
  });
  const readMail = vi.fn();
  await expect(recordExtraWorkApproval(request, readMail)).resolves.toEqual({
    code: "FORBIDDEN", message: "Dafür fehlt dir das Recht. Bitte das Büro um Freigabe.",
  });
  expect(readMail).not.toHaveBeenCalled();
  expect(fixture.execute).not.toHaveBeenCalled();
});

test("Ein nicht verfügbarer Auftrag führt zur Auftragsliste zurück", async () => {
  fixture.execute.mockReset().mockResolvedValue([]);
  const readMail = vi.fn();
  await expect(recordExtraWorkApproval(request, readMail)).resolves.toEqual({
    code: "NOT_FOUND", message: "Diesen Auftrag gibt es nicht mehr.",
    next: { label: "Auftragsliste öffnen", href: "/orders" },
  });
  expect(readMail).not.toHaveBeenCalled();
});

test("Die ausdrückliche Zusage speichert die zugeordnete Originalmail am bestehenden Auftragsbeleg", async () => {
  const readMail = vi.fn(async () => ({ id: request.intakeItemId, orderId: request.orderId, customerId }));
  fixture.execute.mockResolvedValueOnce([{ line_id: request.positions[0].lineId, line_version: 1, integrity_ok: true }])
    .mockResolvedValueOnce([{ id: "TEST-Auftragsbeleg" }]);

  await expect(recordExtraWorkApproval({
    ...request, approvedBy: "TEST Fremder Login", approvedAt: "2000-01-01T08:00:00.000Z",
  }, readMail)).resolves.toEqual({ code: "OK", eventId: "TEST-Auftragsbeleg", replayed: false });

  expect(readMail).toHaveBeenCalledWith(expect.anything(), fixture.actor, request.intakeItemId);
  const written = fixture.execute.mock.calls.map(([query]) => dialect.sqlToQuery(query))
    .find(statement => statement.sql.includes("INSERT INTO public.events"));
  expect(written?.params).toContain("ORDER_EXTRA_WORK_APPROVED_V1");
  const payload = written?.params.find(value => typeof value === "string" && value.startsWith("{"));
  if (typeof payload !== "string") throw Error("TEST_MEHRARBEITSBELEG_FEHLT");
  expect(JSON.parse(payload)).toEqual({
    channel: "mail", intakeItemId: request.intakeItemId,
    positions: request.positions, approvedNetAmountCents: request.approvedNetAmountCents,
    confirmationText: request.confirmationText, approvedBy: fixture.actor.userId,
    approvedAt: expect.not.stringMatching(/^2000-01-01/),
  });
});
