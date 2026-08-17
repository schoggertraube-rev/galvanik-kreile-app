import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const denial = {
  ok: false,
  error: "NOT_AVAILABLE",
  message: "NOT_AVAILABLE: Kunden-Detailansicht benötigt einen tenant- und ownership-geprüften W3-Read-Vertrag.",
};

const checkAppAuth = vi.fn();
const dbPorts = {
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
};
const drizzlePorts = {
  eq: vi.fn(),
  or: vi.fn(),
};
const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

vi.mock("@/lib/server/authHelper", () => ({ checkAppAuth }));
vi.mock("@/db", () => ({ db: dbPorts }));
vi.mock("drizzle-orm", () => drizzlePorts);

function extractFunctionBody(source: string, functionName: string): string {
  const declaration = `export async function ${functionName}(`;
  const declarationStart = source.indexOf(declaration);
  expect(declarationStart).toBeGreaterThanOrEqual(0);

  const signatureEnd = source.indexOf("\n> {", declarationStart);
  expect(signatureEnd).toBeGreaterThan(declarationStart);

  const bodyStart = source.indexOf("{", signatureEnd);
  let depth = 0;

  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(bodyStart + 1, index);
  }

  throw new Error(`Could not isolate ${functionName} body`);
}

afterEach(() => {
  vi.clearAllMocks();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("W2C-B2M5F customer detail privacy", () => {
  it.each([
    "11111111-1111-4111-8111-111111111111",
    "99999999-9999-4999-8999-999999999999",
    "KD-2026-0042",
  ])("denies %s without any auth, database, Drizzle, or console side effect", async (customerIdOrNumber) => {
    const { getCustomerDetailsAction } = await import("../actions");

    await expect(getCustomerDetailsAction(customerIdOrNumber)).resolves.toEqual(denial);

    expect(checkAppAuth).not.toHaveBeenCalled();
    expect(dbPorts.select).not.toHaveBeenCalled();
    expect(dbPorts.from).not.toHaveBeenCalled();
    expect(dbPorts.where).not.toHaveBeenCalled();
    expect(dbPorts.orderBy).not.toHaveBeenCalled();
    expect(dbPorts.execute).not.toHaveBeenCalled();
    expect(dbPorts.transaction).not.toHaveBeenCalled();
    expect(drizzlePorts.eq).not.toHaveBeenCalled();
    expect(drizzlePorts.or).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("locks the exact action body and the data-free detail-page denial", () => {
    const actionsPath = resolve(process.cwd(), "src/app/customers/[id]/actions.ts");
    const pagePath = resolve(process.cwd(), "src/app/customers/[id]/page.tsx");
    const actionBody = extractFunctionBody(readFileSync(actionsPath, "utf8"), "getCustomerDetailsAction");
    const normalizedBody = actionBody.replace(/\s+/g, " ").trim();
    const pageSource = readFileSync(pagePath, "utf8");

    expect(normalizedBody).toBe('void customerIdOrNumber; return { ok: false, error: "NOT_AVAILABLE", message: "NOT_AVAILABLE: Kunden-Detailansicht ben\\u00f6tigt einen tenant- und ownership-gepr\\u00fcften W3-Read-Vertrag.", };');
    for (const forbiddenPortToken of ["checkAppAuth", "db", "select", "from", "where", "orderBy", "execute", "transaction", "eq", "or", "console", "Date", "import"]) {
      expect(actionBody).not.toMatch(new RegExp(`\\b${forbiddenPortToken}\\b`));
    }

    expect(pageSource).toContain('const NOT_AVAILABLE_MESSAGE = "NOT_AVAILABLE: Kunden-Detailansicht ben\\u00f6tigt einen tenant- und ownership-gepr\\u00fcften W3-Read-Vertrag.";');
    expect(pageSource).toContain("<p className=\"mt-4 text-text-muted\">{NOT_AVAILABLE_MESSAGE}</p>");
    for (const forbiddenPageToken of ["import(\"./actions\")", "getCustomerDetailsAction", "notFound(", "Kunde nicht gefunden", "anonymizeCustomer", "dsgvoAnonymizer", "useState", "useEffect", "usePageView", "disabled:"]) {
      expect(pageSource).not.toContain(forbiddenPageToken);
    }
  });
});
