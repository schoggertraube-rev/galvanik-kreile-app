import { randomUUID } from "node:crypto";
import { createId } from "@paralleldrive/cuid2";
import { expect, test, vi } from "vitest";

const integrationDatabaseUrl = process.env.KREILE_INTEGRATION_DATABASE_URL;
const writesExplicitlyAllowed = process.env.KREILE_INTEGRATION_ALLOW_WRITES === "true";
const integrationTest = integrationDatabaseUrl && writesExplicitlyAllowed ? test : test.skip;
const actorId = "00000000-0000-4000-8000-000000000001";
const tenantId = "galvanik-kreile";

vi.mock("@/lib/server/authorization", () => ({
  resolveAuthorization: vi.fn().mockResolvedValue({
    ok: true,
    data: {
      userId: "00000000-0000-4000-8000-000000000001",
      tenantId: "galvanik-kreile",
      displayName: "Test Admin",
      role: "admin",
      permissions: ["perm_data_orders"],
      active: true,
    },
  }),
}));

integrationTest("scan receipt is tenant-bound and atomically linked to an idempotent order", async () => {
  process.env.DATABASE_URL = integrationDatabaseUrl;
  const [{ createOrderFromScan }, { db }, schema, { and, eq }] = await Promise.all([
    import("@/app/actions/orders.actions"),
    import("@/db"),
    import("@/db/schema"),
    import("drizzle-orm"),
  ]);

  const customerId = createId();
  const scanId = randomUUID();
  const clientRequestId = randomUUID();
  const email = `scan-integration-${scanId}@example.invalid`;

  await db.insert(schema.appUsers).values({
    id: actorId,
    tenantId,
    email,
    fullName: "Scan Integration",
    role: "admin",
  }).onConflictDoNothing({ target: schema.appUsers.id });
  await db.insert(schema.customers).values({
    id: customerId,
    tenantId,
    name: `Scan Integration ${scanId}`,
    type: "business",
    source: "manual",
  });
  await db.insert(schema.scanUploads).values({
    id: scanId,
    tenantId,
    recordKind: "capture_scan",
    fileUrl: `${tenantId}/${scanId}/original.pdf`,
    fileType: "application/pdf",
    contentSha256: "a".repeat(64),
    fileSizeBytes: 256,
    uploadedBy: actorId,
    status: "secured",
  });

  const request = {
    clientRequestId,
    sourceRef: scanId,
    routeTemplateId: "direct_galvanik",
    customerId,
    title: "Auftrag per Scan Integration",
    parts: [{ name: "Galvanisiertes Blech", quantity: 12, surfaceRequested: "Verzinkt", material: "Stahl" }],
  };
  const [first, replay] = await Promise.all([
    createOrderFromScan(request),
    createOrderFromScan(request),
  ]);
  expect(first.ok).toBe(true);
  expect(replay.ok).toBe(true);
  if (!first.ok || !replay.ok) return;
  expect(replay.data.orderId).toBe(first.data.orderId);

  const [scan] = await db.select({
    linkedOrderId: schema.scanUploads.linkedOrderId,
    linkedCustomerId: schema.scanUploads.linkedCustomerId,
    status: schema.scanUploads.status,
  }).from(schema.scanUploads).where(and(
    eq(schema.scanUploads.tenantId, tenantId),
    eq(schema.scanUploads.id, scanId),
  )).limit(1);
  expect(scan).toEqual({
    linkedOrderId: first.data.orderId,
    linkedCustomerId: customerId,
    status: "secured",
  });

  const orders = await db.select({ id: schema.orders.id }).from(schema.orders).where(and(
    eq(schema.orders.tenantId, tenantId),
    eq(schema.orders.id, first.data.orderId),
  ));
  expect(orders).toHaveLength(1);
});
