import { expect, test, vi } from "vitest";

const ports = vi.hoisted(() => ({ checkAppAuth: vi.fn(), resolveAuthorization: vi.fn(), createId: vi.fn(), revalidatePath: vi.fn(), select: vi.fn(), transaction: vi.fn(), insert: vi.fn(), createCustomer: vi.fn(), createOrder: vi.fn() }));
vi.mock("@/db", () => ({ db: ports }));
vi.mock("@/db/schema", () => ({ orders: {}, customers: {}, items: {}, events: {} }));
vi.mock("@/lib/server/authHelper", () => ({ checkAppAuth: ports.checkAppAuth }));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: ports.resolveAuthorization }));
vi.mock("@paralleldrive/cuid2", () => ({ createId: ports.createId }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn(), revalidatePath: ports.revalidatePath }));

test("scan order creation is a state-free W3 denial", async () => {
  const { createOrderFromScan } = await import("@/app/actions/orders.actions");
  await expect(createOrderFromScan({ customerId: "customer", customerName: "Client supplied", title: "forced", parts: [{ name: "part", quantity: 1, material: "steel" }], forceCreateCustomer: true })).resolves.toEqual({ ok: false, error: "CONFLICT", message: "NOT_AVAILABLE: Auftragserstellung benötigt den W3-Command-Vertrag." });
  for (const port of Object.values(ports)) expect(port).not.toHaveBeenCalled();
});
