import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

const db = { insert: vi.fn(), update: vi.fn(), select: vi.fn() };
const checkAppAuth = vi.fn();
const resolveAuthorization = vi.fn();
const createId = vi.fn();
const revalidatePath = vi.fn();
const safeParse = vi.fn();

vi.mock("@/db", () => ({ db }));
vi.mock("@/db/schema", () => ({ customers: {} }));
vi.mock("drizzle-orm", () => ({ and: vi.fn(), eq: vi.fn(), ilike: vi.fn(), or: vi.fn(), sql: vi.fn() }));
vi.mock("@/lib/server/authHelper", () => ({ checkAppAuth }));
vi.mock("@/lib/server/authorization", () => ({ resolveAuthorization }));
vi.mock("@/lib/validation/customerSchema", () => ({ customerSchema: { safeParse } }));
vi.mock("@paralleldrive/cuid2", () => ({ createId }));
vi.mock("next/cache", () => ({ unstable_noStore: vi.fn(), revalidatePath }));

const createDenial = {
  ok: false,
  error: "CONFLICT",
  message: "NOT_AVAILABLE: Kundenerstellung benötigt den W3-Command-Vertrag.",
} as const;
const updateDenial = {
  ok: false,
  error: "CONFLICT",
  message: "NOT_AVAILABLE: Kundenänderungen benötigen den W3-Command-Vertrag.",
} as const;

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("W2C-B2M5G customer mutation fail-closed", () => {
  it("denies actions and repository writers before every bridge", async () => {
    const [{ createCustomerDb, updateCustomerDb }, { customersRepository }] = await Promise.all([
      import("@/app/actions/customers.actions"),
      import("@/lib/repositories/customersRepository"),
    ]);

    await expect(createCustomerDb({ name: "Max Mustermann", email: "max@example.test" })).resolves.toEqual(createDenial);
    await expect(updateCustomerDb("customer-1", { name: "Erika Musterfrau" })).resolves.toEqual(updateDenial);
    await expect(customersRepository.create({ name: "Max Mustermann", type: "business" })).rejects.toThrow(createDenial.message);
    await expect(customersRepository.updateCustomer("customer-2", { name: "Erika Musterfrau" })).rejects.toThrow(updateDenial.message);

    for (const spy of [db.insert, db.update, db.select, checkAppAuth, resolveAuthorization, createId, revalidatePath, safeParse]) {
      expect(spy).not.toHaveBeenCalled();
    }
  });

  it("locks mutation bodies and inert UI save controls", async () => {
    const [actions, repository, form, wizard] = await Promise.all([
      readFile("src/app/actions/customers.actions.ts", "utf8"),
      readFile("src/lib/repositories/customersRepository.ts", "utf8"),
      readFile("src/components/customers/NewCustomerForm.tsx", "utf8"),
      readFile("src/components/erfassung/ManualFlow/CustomerWizard.tsx", "utf8"),
    ]);
    const actionBodies = actions.match(/export async function (?:createCustomerDb|updateCustomerDb)[\s\S]*?(?=\nexport async function)/g) ?? [];
    expect(actionBodies).toHaveLength(2);
    for (const body of actionBodies) {
      expect(body).not.toMatch(/db|checkAppAuth|resolveAuthorization|Date|Math|import|revalidate|console/);
    }
    expect(repository).toContain("getCustomersDb");
    expect(repository).toContain("getCustomerByIdDb");
    expect(repository).toContain("searchCustomersDb");
    expect(repository).not.toContain("createCustomerDb");
    expect(repository).not.toContain("updateCustomerDb");
    expect(form).toContain("customersRepository.getById");

    for (const source of [form, wizard]) {
      expect(source).not.toMatch(/createCustomerDb|updateCustomer|handleSave|Google|googlemaps|importLibrary|setOptions|Kunde gespeichert|erfolgreich gespeichert|automatisch gespeichert/);
    }
    expect(form).toContain(createDenial.message);
    expect(form).toContain(updateDenial.message);
    expect(wizard).toContain(createDenial.message);
    expect(form).not.toMatch(/<X\b/);
    expect(form).not.toMatch(/lucide-react"[^\n]*\bX\b/);
    expect(form).not.toMatch(/setImageUrls\(\(previous\)\s*=>\s*previous\.filter/);
    expect(form).not.toContain("itemIndex");
    expect(form).not.toMatch(/<button\b(?=[^>]*\bonClick=)(?![^>]*\bdisabled\b)[^>]*>/);
    expect(form).toMatch(/<Button disabled className="[^"]*">\s*<Save[\s\S]*?Speichern<\/Button>/);
    expect(wizard).toMatch(/<button disabled className="[^"]*">Speichern<\/button>/);
  });
});
