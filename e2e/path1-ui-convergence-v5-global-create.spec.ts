import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createPinLoginHandle } from "../src/lib/server/pinLoginHandle";

const TENANT = "galvanik-kreile";
const OUTPUT_DIR = path.resolve(process.cwd(), "test-results/path1-v5-global-create");

type AuthSignupResponse = { user?: { id?: string }; message?: string };
type Capture = { file: string; sha256: string; viewport: string; state: string };

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PATH1_V5_GLOBAL_CREATE_ENV_MISSING:${name}`);
  return value;
}

async function createAuthUser(apiUrl: string, anonKey: string, email: string, password: string) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as AuthSignupResponse;
  if (!response.ok || typeof body.user?.id !== "string") {
    throw new Error(`PATH1_V5_GLOBAL_CREATE_AUTH_SIGNUP_FAILED:${response.status}:${body.message ?? "invalid"}`);
  }
  return body.user.id;
}

async function loginPin(page: Page, userId: string, pin: string) {
  await page.goto("/start");
  await page.getByTestId(`pin-user-card-${createPinLoginHandle(userId)}`).click();
  const dialog = page.getByTestId("pin-login-dialog");
  for (const digit of pin) await dialog.getByRole("button", { name: digit, exact: true }).click();
  await expect.poll(async () => (await page.context().cookies()).map((cookie) => cookie.name), { timeout: 10_000 })
    .toContain("kreile_app_session");
  const signedCookie = (await page.context().cookies()).find((cookie) => cookie.name === "kreile_app_session");
  if (!signedCookie || !signedCookie.httpOnly || signedCookie.value.length < 64) {
    throw new Error("PATH1_V5_REAL_SIGNED_SESSION_COOKIE_INVALID");
  }
  // `next start` correctly emits a Secure production cookie. The local proof is
  // HTTP-only, so reuse that exact server-signed value with only its transport
  // flag normalized for localhost; no session payload or signature is forged.
  await page.context().addCookies([{
    name: signedCookie.name,
    value: signedCookie.value,
    url: "http://localhost:3001",
    httpOnly: true,
    secure: false,
    sameSite: signedCookie.sameSite,
    expires: signedCookie.expires,
  }]);
  await page.goto("/");
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
}

async function capture(page: Page, file: string, state: string): Promise<Capture> {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const target = path.join(OUTPUT_DIR, file);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: target, fullPage: false });
  const viewport = page.viewportSize();
  return {
    file,
    sha256: createHash("sha256").update(readFileSync(target)).digest("hex"),
    viewport: `${viewport?.width ?? 0}x${viewport?.height ?? 0}`,
    state,
  };
}

async function newContext(browser: Browser, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport });
  return { context, page: await context.newPage() };
}

async function openCreate(page: Page) {
  await page.getByRole("button", { name: "Anlegen", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Was möchten Sie anlegen?" })).toBeVisible();
}

async function receiptValues(region: Locator) {
  return region.locator("dd").allTextContents();
}

test.describe("PATH1 V5 globales Plus – realer Kunde zu KV zu F1.1-Auftrag", () => {
  test("belegt persistente Readbacks, genau einen Auftrag, responsive Bedienung und Rechte", async ({ browser }) => {
    test.setTimeout(600_000);
    const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const databaseUrl = requiredEnv("DATABASE_URL");
    requiredEnv("APP_SESSION_SECRET");
    expect(apiUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(databaseUrl).toMatch(/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/);

    const suffix = `${Date.now()}-${process.pid}`;
    const officePin = "4186";
    const readonlyPin = "7315";
    const officeEmail = `path1-v5-office-${suffix}@local.test`;
    const readonlyEmail = `path1-v5-readonly-${suffix}@local.test`;
    const password = `Path1-V5-${suffix}!`;
    const customerName = `SYNTHETISCH V5 Kunde ${suffix}`;
    const companyName = `SYNTHETISCH V5 ${suffix} GmbH`;
    const partName = `SYNTHETISCHER V5 Flansch ${suffix}`;
    const sql = postgres(databaseUrl, { max: 2, prepare: false });
    const contexts: BrowserContext[] = [];
    const captures: Capture[] = [];
    const browserErrors: string[] = [];
    const actionErrors: string[] = [];

    try {
      const officeId = await createAuthUser(apiUrl, anonKey, officeEmail, password);
      const readonlyId = await createAuthUser(apiUrl, anonKey, readonlyEmail, password);
      const insertedAt = new Date(Date.now() - 5_000).toISOString();
      await sql`
        INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, created_at, updated_at)
        VALUES
          (${officeId}::uuid, ${TENANT}, ${officeEmail}, 'SYNTHETISCH V5 Büro', 'buero', ${await bcrypt.hash(officePin, 12)}, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz),
          (${readonlyId}::uuid, ${TENANT}, ${readonlyEmail}, 'SYNTHETISCH V5 Readonly', 'readonly', ${await bcrypt.hash(readonlyPin, 12)}, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz)
      `;

      const desktop = await newContext(browser, { width: 1914, height: 917 });
      contexts.push(desktop.context);
      desktop.page.on("console", (message) => {
        if (message.type() === "error") browserErrors.push(message.text());
      });
      desktop.page.on("pageerror", (error) => browserErrors.push(error.message));
      desktop.page.on("response", async (response) => {
        if (response.request().method() !== "POST" || !response.request().headers()["next-action"]) return;
        if (response.status() >= 400) actionErrors.push(`${response.status()}:${await response.text().catch(() => "unreadable")}`);
      });
      await loginPin(desktop.page, officeId, officePin);
      await openCreate(desktop.page);
      captures.push(await capture(desktop.page, "v5-global-plus-desktop-1914x917.png", "chooser"));

      await desktop.page.getByRole("button", { name: /Kunde anlegen/ }).click();
      const nameInput = desktop.page.getByLabel("Firma / Name");
      await expect(nameInput).toBeFocused();
      await nameInput.fill(customerName);
      await desktop.page.getByLabel("Firmenname").fill(companyName);
      await desktop.page.getByLabel("Ansprechpartner").fill("SYNTHETISCH Testperson");
      await desktop.page.getByLabel("Telefon").fill("+49 000 1414");
      await desktop.page.getByLabel("E-Mail").fill(`kunde-${suffix}@example.invalid`);
      await desktop.page.getByLabel("Ort").fill("Synthetische Teststadt");
      await desktop.page.getByRole("button", { name: /Neukunde speichern/ }).click();
      await expect(desktop.page.getByRole("heading", { name: new RegExp(customerName) })).toBeVisible();
      const customerReceipt = await receiptValues(desktop.page.getByRole("region", { name: "Kunden-Receipt" }));
      expect(customerReceipt).toHaveLength(4);
      expect(customerReceipt.every(Boolean)).toBe(true);

      await desktop.page.getByRole("button", { name: /Kundenkarte öffnen/ }).click();
      await expect(desktop.page.getByTestId("customer-card-v2")).toContainText(companyName);
      await desktop.page.getByRole("button", { name: "Schließen", exact: true }).click();
      await desktop.page.goto("/customers");
      await desktop.page.reload();
      await desktop.page.getByPlaceholder("Name, Kundennummer, Ort").fill(customerName);
      await desktop.page.getByRole("button", { name: new RegExp(customerName) }).click();
      await expect(desktop.page.getByTestId("customer-card-v2")).toContainText(companyName);
      await desktop.page.getByRole("button", { name: "Schließen", exact: true }).click();

      await desktop.page.goto("/");
      await openCreate(desktop.page);
      await desktop.page.getByRole("button", { name: /Auftrag \/ KV anlegen/ }).click();
      await desktop.page.getByLabel("Kunde suchen").fill(customerName);
      await desktop.page.getByRole("button", { name: new RegExp(customerName) }).click();
      await desktop.page.getByLabel("Teil / Bezeichnung").fill(partName);
      await desktop.page.getByLabel("Menge").fill("2");
      await desktop.page.getByLabel("Material").fill("Stahl");
      await desktop.page.getByLabel("Oberfläche").fill("Verzinken");
      await desktop.page.getByLabel("Netto je Stück").fill("125,00");
      await desktop.page.getByLabel("Gewünschter Termin").fill("2026-10-15");
      await desktop.page.getByLabel("Hinweis zum KV").fill(`SYNTHETISCHER V5 KV ${suffix}`);
      await desktop.page.getByRole("button", { name: "Position hinzufügen" }).click();
      await expect(desktop.page.getByLabel("Position 2 entfernen")).toBeVisible();
      await desktop.page.getByLabel("Position 2 entfernen").click();

      await desktop.page.setViewportSize({ width: 768, height: 1024 });
      captures.push(await capture(desktop.page, "v5-kv-form-tablet-768x1024.png", "quote-form"));
      await desktop.page.getByRole("button", { name: /KV sichern/ }).click();
      const quoteHeading = desktop.page.getByRole("heading", { name: /^KV-\d{4}-\d+ gesichert$/ });
      await expect(quoteHeading).toBeVisible();
      const quoteNumber = (await quoteHeading.textContent())!.replace(" gesichert", "").trim();
      const quoteReceipt = await receiptValues(desktop.page.getByRole("region", { name: "KV-Receipt" }));
      expect(quoteReceipt).toHaveLength(4);

      await desktop.page.getByRole("button", { name: "Anlegen schließen" }).click();
      await desktop.page.reload();
      await openCreate(desktop.page);
      await desktop.page.getByRole("button", { name: /Gespeicherten KV fortsetzen/ }).click();
      await expect(desktop.page.getByText(/nach Reload aus der Datenbank zurückgelesen/)).toBeVisible();

      await desktop.page.setViewportSize({ width: 390, height: 844 });
      captures.push(await capture(desktop.page, "v5-kv-readback-mobile-390x844.png", "quote-reload-readback"));
      await desktop.page.getByRole("button", { name: /Zuschlag bestätigen/ }).click();
      const orderHeading = desktop.page.getByRole("heading", { name: /^Auftrag A-\d{4}-\d+ angelegt$/ });
      await expect(orderHeading).toBeVisible();
      const orderNumber = (await orderHeading.textContent())!.replace(/^Auftrag /, "").replace(/ angelegt$/, "").trim();
      const conversionReceipt = await receiptValues(desktop.page.getByRole("region", { name: "KV-Zuschlagsreceipt" }));
      const orderReceipt = await receiptValues(desktop.page.getByRole("region", { name: "F1.1-Auftragsreceipt" }));
      expect(conversionReceipt).toHaveLength(4);
      expect(orderReceipt).toHaveLength(5);
      captures.push(await capture(desktop.page, "v5-order-receipts-mobile-390x844.png", "order-receipts"));

      await desktop.page.getByRole("button", { name: "Auftragskarte öffnen" }).click();
      await desktop.page.waitForURL((url) => /^\/orders\/[0-9a-f-]+$/.test(url.pathname));
      const orderCard = desktop.page.getByTestId("order-card-v8");
      await expect(orderCard, `V8 readback failed: ${[...browserErrors, ...actionErrors].join(" | ").slice(0, 2_000) || "no browser/action error"}`).toBeVisible({ timeout: 30_000 });
      await expect(orderCard).toContainText(orderNumber);
      await desktop.page.getByRole("button", { name: /Zurück/ }).first().click();
      await desktop.page.waitForURL((url) => url.pathname === "/orders");

      const [integrity] = await sql<{
        customers: number;
        quotes: number;
        quote_create_events: number;
        quote_award_events: number;
        conversion_receipts: number;
        orders: number;
        intake_events: number;
      }[]>`
        SELECT
          (SELECT count(*)::integer FROM public.customers WHERE tenant_id = ${TENANT} AND name = ${customerName}) AS customers,
          (SELECT count(*)::integer FROM private.quotes WHERE tenant_id = ${TENANT} AND quote_number = ${quoteNumber}) AS quotes,
          (SELECT count(*)::integer FROM public.events event JOIN private.quotes quote ON quote.tenant_id = event.tenant_id AND quote.id::text = event.payload->>'quoteId' WHERE event.tenant_id = ${TENANT} AND event.event_type = 'QUOTE_CREATED_V1' AND quote.quote_number = ${quoteNumber}) AS quote_create_events,
          (SELECT count(*)::integer FROM public.events event JOIN private.quotes quote ON quote.tenant_id = event.tenant_id AND quote.id::text = event.payload->>'quoteId' WHERE event.tenant_id = ${TENANT} AND event.event_type = 'QUOTE_AWARDED_V1' AND quote.quote_number = ${quoteNumber}) AS quote_award_events,
          (SELECT count(*)::integer FROM private.quote_conversion_receipts receipt JOIN private.quotes quote ON quote.tenant_id = receipt.tenant_id AND quote.id = receipt.quote_id WHERE quote.tenant_id = ${TENANT} AND quote.quote_number = ${quoteNumber}) AS conversion_receipts,
          (SELECT count(*)::integer FROM public.orders WHERE tenant_id = ${TENANT} AND order_number = ${orderNumber}) AS orders,
          (SELECT count(*)::integer FROM public.events event JOIN public.orders orders ON orders.tenant_id = event.tenant_id AND orders.id = event.order_id WHERE event.tenant_id = ${TENANT} AND event.event_type = 'ORDER_INTAKE_CREATED_V1' AND orders.order_number = ${orderNumber}) AS intake_events
      `;
      expect(integrity).toEqual({ customers: 1, quotes: 1, quote_create_events: 1, quote_award_events: 1, conversion_receipts: 1, orders: 1, intake_events: 1 });

      const readonly = await newContext(browser, { width: 390, height: 844 });
      contexts.push(readonly.context);
      await loginPin(readonly.page, readonlyId, readonlyPin);
      await openCreate(readonly.page);
      await readonly.page.getByRole("button", { name: /Kunde anlegen/ }).click();
      await expect(readonly.page.getByRole("dialog").getByRole("alert")).toContainText("Büro oder Administration");
      captures.push(await capture(readonly.page, "v5-create-denied-mobile-390x844.png", "readonly-denied"));
      await readonly.page.getByRole("button", { name: "Zum sicheren Profilwechsel" }).click();
      await readonly.page.waitForURL((url) => url.pathname === "/start");
      await expect(readonly.page.getByRole("button", { name: "Anlegen", exact: true })).toHaveCount(0);

      console.log(`PATH1_V5_GLOBAL_CREATE_RECEIPT=${JSON.stringify({ customerReceipt, quoteReceipt, conversionReceipt, orderReceipt, quoteNumber, orderNumber, captures })}`);
    } finally {
      await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
      await sql.end();
    }
  });
});
