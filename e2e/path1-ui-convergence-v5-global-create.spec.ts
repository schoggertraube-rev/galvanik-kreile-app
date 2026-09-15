import { expect, test, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createPinLoginHandle } from "../src/lib/server/pinLoginHandle";

const TENANT = "galvanik-kreile";
const OUTPUT_DIR = path.resolve(process.cwd(), "test-results/path1-v5-global-create");

type Capture = { file: string; sha256: string; viewport: string; state: string };

const ROLF_ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const PHILLIP_ACTOR_ID = "22222222-2222-4222-8222-222222222222";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PATH1_V5_GLOBAL_CREATE_ENV_MISSING:${name}`);
  return value;
}

async function loginPin(page: Page, userId: string, pin: string) {
  await page.goto("/start");
  const profileCard = page.getByTestId(`pin-user-card-${createPinLoginHandle(userId)}`);
  await expect(profileCard).toBeEnabled();
  await profileCard.click();
  const dialog = page.getByTestId("pin-login-dialog");
  // The dialog is rendered only by the client click handler. Its appearance
  // therefore proves hydration and the real event binding without a fixed wait.
  await expect(dialog).toBeVisible();
  for (const digit of pin) {
    const key = dialog.getByRole("button", { name: digit, exact: true });
    await expect(key).toBeVisible();
    await key.click({ timeout: 10_000 });
  }
  await expect.poll(async () => (await page.context().cookies()).map((cookie) => cookie.name), { timeout: 10_000 })
    .toContain("kreile_app_session");
  const signedCookie = (await page.context().cookies()).find((cookie) => cookie.name === "kreile_app_session");
  if (!signedCookie || !signedCookie.httpOnly || signedCookie.value.length < 64) {
    throw new Error("PATH1_V5_REAL_SIGNED_SESSION_COOKIE_INVALID");
  }
  const sessionToken = decodeURIComponent(signedCookie.value);
  const separator = sessionToken.lastIndexOf(".");
  if (separator <= 0) throw new Error("PATH1_V5_REAL_SIGNED_SESSION_COOKIE_MALFORMED");
  const encodedSession = sessionToken.slice(0, separator);
  const sessionPayload = JSON.parse(Buffer.from(encodedSession, "base64").toString("utf8")) as { userId?: unknown };
  if (sessionPayload.userId !== userId) {
    throw new Error("PATH1_V5_PRODUCT_PROFILE_SESSION_ACTOR_MISMATCH");
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
    const databaseUrl = requiredEnv("DATABASE_URL");
    requiredEnv("APP_SESSION_SECRET");
    expect(databaseUrl).toMatch(/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/);
    expect(process.env.KREILE_ROLF_APP_USER_ID).toBe(ROLF_ACTOR_ID);
    expect(process.env.KREILE_PHILLIP_APP_USER_ID).toBe(PHILLIP_ACTOR_ID);

    const suffix = `${Date.now()}-${process.pid}`;
    const rolfPin = "4186";
    const phillipPin = "7315";
    const rolfEmail = `path1-v5-rolf-${suffix}@local.test`;
    const phillipEmail = `path1-v5-phillip-${suffix}@local.test`;
    const customerName = `SYNTHETISCH V5 Kunde ${suffix}`;
    const intakeCustomerName = `SYNTHETISCH V5 Eingang ${suffix}`;
    const companyName = `SYNTHETISCH V5 ${suffix} GmbH`;
    const partName = `SYNTHETISCHER V5 Flansch ${suffix}`;
    const sql = postgres(databaseUrl, { max: 2, prepare: false });
    const contexts: BrowserContext[] = [];
    const captures: Capture[] = [];
    const browserErrors: string[] = [];
    const actionErrors: string[] = [];

    try {
      const rolfId = ROLF_ACTOR_ID;
      const phillipId = PHILLIP_ACTOR_ID;
      const insertedAt = new Date(Date.now() - 5_000).toISOString();
      await sql`
        INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, created_at, updated_at)
        VALUES
          (${rolfId}::uuid, ${TENANT}, ${rolfEmail}, 'Rolf', 'meister', ${await bcrypt.hash(rolfPin, 12)}, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz),
          (${phillipId}::uuid, ${TENANT}, ${phillipEmail}, 'Phillip', 'werkstatt', ${await bcrypt.hash(phillipPin, 12)}, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz)
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
      await desktop.page.goto("/start");
      await expect(desktop.page.getByRole("heading", { name: "Willkommen" })).toBeVisible();
      await expect(desktop.page.getByText("Rolf")).toBeVisible();
      await expect(desktop.page.getByText("Phillip")).toBeVisible();
      await expect(desktop.page.getByRole("button", { name: /Gregor.*Systemadministrator/ })).toBeVisible();
      await expect(desktop.page.getByText(/Büro|Developer|Readonly|Sabrina/i)).toHaveCount(0);
      captures.push(await capture(desktop.page, "v5-start-identities-desktop-1914x917.png", "start-product-identities"));
      await loginPin(desktop.page, rolfId, rolfPin);
      await expect(desktop.page.getByText("Guten Tag, Rolf")).toBeVisible();
      captures.push(await capture(desktop.page, "v5-rolf-empty-desktop-1914x917.png", "rolf-empty"));
      await desktop.page.getByRole("button", { name: "Neuer Eingang" }).click();
      await expect(desktop.page.getByRole("heading", { name: "Neuer Eingang" })).toBeVisible();
      await expect(desktop.page.getByText("Digitaler Wareneingang")).toHaveCount(0);
      await desktop.page.getByRole("button", { name: "Neukunde" }).click();
      await desktop.page.getByLabel("Firma / Name").fill(intakeCustomerName);
      await desktop.page.getByLabel("Terminwunsch").fill("2026-10-15");
      await desktop.page.getByLabel("Zugesagter Termin").fill("2026-10-20");
      await desktop.page.getByLabel("Teil / Bezeichnung").fill(`SYNTHETISCHER Eingang ${suffix}`);
      await desktop.page.getByLabel("Menge").fill("1");
      await desktop.page.getByLabel("Material").fill("Stahl");
      await desktop.page.getByLabel("Oberfläche").fill("Verzinken");
      await desktop.page.getByRole("button", { name: "Eingang speichern" }).click();
      await expect(desktop.page.getByRole("heading", { name: /^Auftrag A-\d{4}-\d+ angelegt$/ })).toBeVisible();
      captures.push(await capture(desktop.page, "v5-rolf-intake-readback-desktop-1914x917.png", "rolf-intake-readback"));
      await desktop.page.getByRole("button", { name: "Anlegen schließen", exact: true }).click();
      await expect(desktop.page.getByText("Das braucht dich")).toBeVisible();
      await desktop.page.setViewportSize({ width: 1220, height: 880 });
      captures.push(await capture(desktop.page, "v5-rolf-data-tablet-1220x880.png", "rolf-data"));
      await desktop.page.goto("/buchhaltung");
      await desktop.page.waitForURL((url) => url.pathname === "/buchhaltung/rechnungen");
      await expect(desktop.page.getByText("F1.4 · UNVERÄNDERLICHE BELEGE")).toHaveCount(0);
      await expect(desktop.page.getByText("Zurück zur Buchhaltung")).toHaveCount(0);
      await desktop.page.setViewportSize({ width: 1024, height: 768 });
      captures.push(await capture(desktop.page, "v5-invoices-target-shell-1024x768.png", "invoices-target-shell"));
      await desktop.page.goto("/");
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
      const customerReceipt = await receiptValues(desktop.page.getByRole("group", { name: "Kundenanlage – technische Details für Support" }));
      expect(customerReceipt).toHaveLength(3);
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
      const quoteReceipt = await receiptValues(desktop.page.getByRole("group", { name: "KV – technische Details für Support" }));
      expect(quoteReceipt).toHaveLength(3);

      await desktop.page.getByRole("button", { name: "Anlegen schließen" }).click();
      await desktop.page.reload();
      await openCreate(desktop.page);
      await desktop.page.getByRole("button", { name: /Gespeicherten KV fortsetzen/ }).click();
      await expect(desktop.page.getByText(/gespeicherte KV wurde erneut geprüft/)).toBeVisible();

      await desktop.page.setViewportSize({ width: 390, height: 844 });
      captures.push(await capture(desktop.page, "v5-kv-readback-mobile-390x844.png", "quote-reload-readback"));
      await desktop.page.getByLabel("Zusagter Termin für den Auftrag").fill("2026-10-20");
      await desktop.page.getByRole("button", { name: /Zuschlag bestätigen/ }).click();
      const orderHeading = desktop.page.getByRole("heading", { name: /^Auftrag A-\d{4}-\d+ angelegt$/ });
      await expect(orderHeading).toBeVisible();
      const orderNumber = (await orderHeading.textContent())!.replace(/^Auftrag /, "").replace(/ angelegt$/, "").trim();
      const conversionReceipt = await receiptValues(desktop.page.getByRole("group", { name: "Auftrag – technische Details für Support" }));
      expect(conversionReceipt).toHaveLength(3);
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

      const phillip = await newContext(browser, { width: 390, height: 844 });
      contexts.push(phillip.context);
      await loginPin(phillip.page, phillipId, phillipPin);
      await expect(phillip.page.getByRole("button", { name: "Anlegen", exact: true })).toHaveCount(0);
      await expect(phillip.page.getByText("Heute sichern")).toBeVisible();
      captures.push(await capture(phillip.page, "v5-phillip-limited-mobile-390x844.png", "phillip-limited"));

      console.log(`PATH1_V5_GLOBAL_CREATE_RECEIPT=${JSON.stringify({ customerReceipt, quoteReceipt, conversionReceipt, quoteNumber, orderNumber, captures })}`);
    } finally {
      await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
      await sql.end();
    }
  });
});
