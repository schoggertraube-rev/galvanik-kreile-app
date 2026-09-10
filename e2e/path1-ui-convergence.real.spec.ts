import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const TENANT = "galvanik-kreile";
const EVIDENCE_DIR = path.resolve(process.cwd(), "docs/evidence/ui/artifacts/path1-ui-convergence");

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PATH1_UI_E2E_ENV_MISSING:${name}`);
  return value;
}

async function createAuthUser(apiUrl: string, anonKey: string, email: string, password: string): Promise<string> {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json() as { user?: { id?: string }; message?: string };
  if (!response.ok || typeof body.user?.id !== "string") throw new Error(`PATH1_UI_AUTH_SIGNUP_FAILED:${response.status}:${body.message ?? "invalid"}`);
  return body.user.id;
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/start");
  await page.getByRole("button", { name: "Administrator / E-Mail Login", exact: true }).click();
  const dialog = page.getByTestId("email-login-dialog");
  await dialog.locator("#email").fill(email);
  await dialog.locator("#password").fill(password);
  await dialog.getByRole("button", { name: "Einloggen", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/settings", { timeout: 30_000 });
  expect((await page.context().cookies()).some((cookie) => cookie.name === "kreile_app_session")).toBe(true);
}

async function createIntake(page: Page, suffix: string): Promise<{ orderNumber: string; customerName: string }> {
  const customerName = `UI-Konvergenz ${suffix}`;
  await page.goto("/warendurchlauf/wareneingang");
  await page.getByTestId("wareneingang-create-order").click();
  const modal = page.getByTestId("order-intake-modal");
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Neu anlegen", exact: true }).click();
  await modal.getByPlaceholder("Kundenname *", { exact: true }).fill(customerName);
  await modal.getByPlaceholder("Firmenname", { exact: true }).fill(`${customerName} GmbH`);
  await modal.getByPlaceholder("Ansprechperson", { exact: true }).fill("Lokale B/C-Abnahme");
  await modal.getByPlaceholder("Bezeichnung *", { exact: true }).fill("Synthetische Stoßstange");
  await modal.getByPlaceholder("Menge *", { exact: true }).fill("2");
  await modal.getByPlaceholder("Werkstoff", { exact: true }).fill("Stahl");
  await modal.getByPlaceholder("Oberfläche / Behandlung *", { exact: true }).fill("Chrom hochglanz");
  await modal.getByLabel("Wunschtermin *", { exact: true }).fill("2030-09-30");
  await modal.getByLabel("Interner Hinweis", { exact: true }).fill("Klar synthetischer lokaler B/C-Browserbeleg");
  await modal.getByRole("button", { name: "Wareneingang anlegen", exact: true }).click();
  const heading = modal.getByRole("heading", { name: /^A-\d{4}-\d+ bestätigt$/ });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  const match = /^(A-\d{4}-\d+) bestätigt$/.exec((await heading.textContent())?.trim() ?? "");
  if (!match) throw new Error("PATH1_UI_INTAKE_RECEIPT_INVALID");
  await modal.getByRole("button", { name: "Schließen", exact: true }).click();
  return { orderNumber: match[1], customerName };
}

async function transitionToGalvanik(page: Page, orderId: string): Promise<void> {
  await page.goto("/warendurchlauf/wareneingang");
  const row = page.getByTestId(`wareneingang-order-${orderId}`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.getByTestId("wareneingang-handoff").getByRole("button", { name: "An Galvanik übergeben", exact: true }).click();
  await expect(page.getByTestId("wareneingang-handoff-status")).toBeVisible({ timeout: 30_000 });
}

async function capture(page: Page, filename: string): Promise<{ file: string; sha256: string }> {
  const target = path.join(EVIDENCE_DIR, filename);
  await page.screenshot({ path: target, fullPage: false });
  return { file: path.relative(process.cwd(), target).replaceAll("\\", "/"), sha256: createHash("sha256").update(readFileSync(target)).digest("hex") };
}

test.describe("Path-1 UI convergence B/C", () => {
  test("belegt V8/V2, Deeplinks und denselben Home-Auftrag-Kunde-Auftrag-Stack", async ({ browser }) => {
    test.setTimeout(360_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const databaseUrl = requiredEnv("DATABASE_URL");
    requiredEnv("APP_SESSION_SECRET");
    expect(apiUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(databaseUrl).toMatch(/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/);

    const suffix = `${Date.now()}-${process.pid}`;
    const email = `path1-bc-${suffix}@local.test`;
    const password = `Path1-BC-${suffix}!`;
    const sql = postgres(databaseUrl, { max: 1, prepare: false });
    const contexts: BrowserContext[] = [];
    const artifacts: Array<{ file: string; sha256: string }> = [];
    try {
      const userId = await createAuthUser(apiUrl, anonKey, email, password);
      await sql`INSERT INTO public.app_users (id, tenant_id, email, full_name, role, active) VALUES (${userId}::uuid, ${TENANT}, ${email}, 'Path1 B/C Prüfer', 'admin', true)`;
      const setupContext = await browser.newContext({ viewport: { width: 1914, height: 917 } });
      contexts.push(setupContext);
      const setupPage = await setupContext.newPage();
      await login(setupPage, email, password);
      const receipt = await createIntake(setupPage, suffix);

      const rows = await sql<Array<{ order_id: string; customer_id: string }>>`SELECT id AS order_id, customer_id FROM public.orders WHERE tenant_id=${TENANT} AND order_number=${receipt.orderNumber}`;
      const row = rows[0];
      if (!row) throw new Error("PATH1_UI_ORDER_READBACK_MISSING");
      await transitionToGalvanik(setupPage, row.order_id);

      for (const viewport of [
        { width: 1914, height: 917, label: "desktop-1914x917" },
        { width: 1220, height: 880, label: "tablet-1220x880" },
        { width: 390, height: 844, label: "mobile-390x844" },
      ]) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        contexts.push(context);
        const page = await context.newPage();
        await login(page, email, password);
        await page.goto("/orders");
        const orderButton = page.getByRole("button", { name: new RegExp(receipt.orderNumber) });
        await expect(orderButton).toBeVisible();
        await orderButton.click();
        const orderCard = page.getByTestId("order-card-v8");
        await expect(orderCard).toBeVisible();
        await expect(orderCard).toContainText("Zahlung · getrennte Schwelle");
        await expect(orderCard).toContainText("Synthetische Stoßstange");
        artifacts.push(await capture(page, `bc-order-v8-${viewport.label}.png`));

        await orderCard.getByRole("button", { name: /Kundenkarte öffnen/ }).click();
        const customerCard = page.getByTestId("customer-card-v2");
        await expect(customerCard).toBeVisible();
        await expect(customerCard).toContainText(receipt.customerName);
        await expect(customerCard.getByRole("button", { name: new RegExp(receipt.orderNumber) }).first()).toBeVisible();
        artifacts.push(await capture(page, `bc-customer-v2-${viewport.label}.png`));
        await customerCard.getByRole("button", { name: new RegExp(receipt.orderNumber) }).first().click();
        await expect(page.getByTestId("order-card-v8")).toContainText(receipt.orderNumber);

        await page.goto(`/orders/${row.order_id}`);
        await expect(page.getByTestId("order-card-v8")).toContainText(receipt.orderNumber);
        await page.goto(`/customers/${row.customer_id}`);
        await expect(page.getByTestId("customer-card-v2")).toContainText(receipt.customerName);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }

      const receiptPath = path.join(EVIDENCE_DIR, "bc-real-browser-receipt.json");
      writeFileSync(receiptPath, `${JSON.stringify({ source: "fresh local Supabase + real auth/session + canonical intake + tenant reads", orderNumber: receipt.orderNumber, orderId: row.order_id, customerId: row.customer_id, viewports: ["1914x917", "1220x880", "390x844"], artifacts }, null, 2)}\n`);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
      await sql.end({ timeout: 5 });
    }
  });
});
