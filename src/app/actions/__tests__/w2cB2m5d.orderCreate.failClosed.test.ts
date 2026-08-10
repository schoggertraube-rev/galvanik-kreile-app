import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const spies = vi.hoisted(() => ({
  checkAppAuth: vi.fn(), resolveAuthorization: vi.fn(), createId: vi.fn(), revalidatePath: vi.fn(),
  select: vi.fn(), transaction: vi.fn(), insert: vi.fn(), update: vi.fn(), values: vi.fn(), set: vi.fn(), where: vi.fn(),
}));

vi.mock("@/db", () => ({ db: spies }));
vi.mock("@/db/schema", () => ({ orders: {}, items: {}, customers: {}, events: {} }));
vi.mock("@/lib/server/authHelper", () => ({ checkAppAuth: spies.checkAppAuth }));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization: spies.resolveAuthorization }));
vi.mock("@paralleldrive/cuid2", () => ({ createId: spies.createId }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn(), revalidatePath: spies.revalidatePath }));

const message = "NOT_AVAILABLE: Auftragserstellung benötigt den W3-Command-Vertrag.";
const denial = { ok: false, error: "CONFLICT", message };

describe("W2C-B2M5D order creation quarantine", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies adversarial direct and scan creation before every side-effect port", async () => {
    const { createOrderDb, createOrderFromScan } = await import("../orders.actions");
    await expect(createOrderDb({ id: "client-id", tenantId: "other-tenant", customerId: "customer-id", parts: [{ id: "part-id" }], forceCreateCustomer: true })).resolves.toEqual(denial);
    await expect(createOrderFromScan({ customerId: "client-id", customerName: "adversarial", title: "forced", parts: [{ name: "part", quantity: 1 }], forceCreateCustomer: true })).resolves.toEqual(denial);
    for (const spy of Object.values(spies)) expect(spy).not.toHaveBeenCalled();
  });

  it("source-locks both action bodies between found sentinels", async () => {
    const actionPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../orders.actions.ts");
    const source = await readFile(actionPath, "utf8");
    const createStart = source.indexOf("export async function createOrderDb");
    const createEnd = source.indexOf("\n\nexport async function updateOrderDb", createStart);
    const scanStart = source.indexOf("export async function createOrderFromScan");
    const scanEnd = source.length;
    expect(createStart).toBeGreaterThanOrEqual(0); expect(createEnd).toBeGreaterThan(createStart);
    expect(scanStart).toBeGreaterThanOrEqual(0); expect(scanEnd).toBeGreaterThan(scanStart);
    const createBody = source.slice(createStart, createEnd);
    const scanBody = source.slice(scanStart, scanEnd).trim();
    expect(createBody).toBe(`export async function createOrderDb(data: Record<string, unknown>): Promise<ActionResult<Record<string, unknown>>> {\n  void data;\n  return { ok: false, error: "CONFLICT", message: "${message}" };\n}`);
    expect(scanBody).toBe(`export async function createOrderFromScan(params: {\n  customerId?: string;\n  customerName?: string;\n  title?: string;\n  parts: { name: string; quantity: number; surfaceRequested?: string; material?: string }[];\n  forceCreateCustomer?: boolean;\n}): Promise<\n  | { ok: true; data: { orderId: string; newCustomerId?: string; status: string; customerChoices?: Record<string, unknown>[] } }\n  | { ok: false; error: string; message: string; details?: unknown }\n> {\n  void params;\n  return { ok: false, error: "CONFLICT", message: "${message}" };\n}`);
    for (const body of [createBody, scanBody]) expect(body).not.toMatch(/checkAppAuth|resolveAuthorization|db\.|createId|Date|transaction|select|insert|items|events|revalidate|import|console|log/);
  });

  it("quarantines the repository before provider and bridge evaluation", async () => {
    const { ordersRepository } = await import("@/lib/repositories/ordersRepository");
    await expect(ordersRepository.create({ customerId: "client", title: "forced", station: "wareneingang", parts: [] })).rejects.toThrow(message);
    for (const spy of Object.values(spies)) expect(spy).not.toHaveBeenCalled();
  });

  it("source-locks repository and UI fail-closed boundaries", async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
    const [repository, form, scan] = await Promise.all([
      readFile(path.join(root, "lib/repositories/ordersRepository.ts"), "utf8"),
      readFile(path.join(root, "components/orders/NewOrderForm.tsx"), "utf8"),
      readFile(path.join(root, "app/scan/page.tsx"), "utf8"),
    ]);
    expect(repository).toContain('import { getOrdersDb, updateOrderDb } from "@/app/actions/orders.actions";');
    expect(repository).not.toContain("createOrderDb");
    expect(repository).toContain(`void data;\n    throw new Error("${message}");`);
    expect(repository).toContain("async getAll()");
    expect(repository).toContain("getOrdersDb()");
    expect(form).not.toContain("ordersRepository"); expect(form).not.toContain("handleSave"); expect(form).not.toContain("Auftrag gespeichert");
    expect(form).toContain(message); expect(form).toContain("onClose"); expect(form).toContain("Bezeichnung / Bauteil"); expect(form).toContain("Zusätzliche Hinweise");
    const saveStart = form.indexOf("<Button disabled"); const saveEnd = form.indexOf(">", saveStart);
    expect(saveStart).toBeGreaterThanOrEqual(0); expect(saveEnd).toBeGreaterThan(saveStart);
    const saveTag = form.slice(saveStart, saveEnd + 1); expect(saveTag).toContain("disabled"); expect(saveTag).not.toContain("onClick"); expect(saveTag).not.toMatch(/disabled=\{false\}/);
    expect(scan).not.toContain("createOrderFromScan"); expect(scan).not.toContain("SuggestedItemsPanel"); expect(scan).not.toContain("handleConfirmOrder"); expect(scan).not.toContain("Kunde neu anlegen"); expect(scan).not.toContain("erfolgreich");
    expect(scan).toContain(message); expect(scan).toContain("PageHeader"); expect(scan).toContain("CameraCapture"); expect(scan).toContain("onScanComplete={() => {}}");
  });
});
