import { expect, test, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const TENANT = "galvanik-kreile";
const EVIDENCE_DIR = path.resolve(process.cwd(), "docs/evidence/f1/artifacts/search");

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`SEARCH_E2E_ENV_MISSING:${name}`);
  return value;
}

async function createAuthUser(apiUrl: string, anonKey: string, email: string, password: string) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await response.json() as { user?: { id?: string }; message?: string };
  if (!response.ok || typeof body.user?.id !== "string") {
    throw new Error(`SEARCH_AUTH_SIGNUP_FAILED:${response.status}:${body.message ?? "invalid"}`);
  }
  return body.user.id;
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/start");
  await page.getByRole("button", { name: "Administrator / E-Mail Login", exact: true }).click();
  const dialog = page.getByTestId("email-login-dialog");
  await dialog.locator("#email").fill(email);
  await dialog.locator("#password").fill(password);
  await dialog.getByRole("button", { name: "Einloggen", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/start", { timeout: 30_000 });
  expect((await page.context().cookies()).some((cookie) => cookie.name === "kreile_app_session")).toBe(true);
}

async function capture(page: Page, filename: string) {
  const target = path.join(EVIDENCE_DIR, filename);
  await page.screenshot({ path: target, fullPage: false });
  return {
    file: path.relative(process.cwd(), target).replaceAll("\\", "/"),
    sha256: createHash("sha256").update(readFileSync(target)).digest("hex"),
  };
}

async function createIntake(page: Page, suffix: string) {
  await page.goto("/warendurchlauf/wareneingang");
  await page.getByTestId("wareneingang-create-order").click();
  const modal = page.getByTestId("order-intake-modal");
  await modal.getByRole("button", { name: "Neu anlegen", exact: true }).click();
  await modal.getByPlaceholder("Kundenname *", { exact: true }).fill(`Suchkunde ${suffix}`);
  await modal.getByPlaceholder("Firmenname", { exact: true }).fill(`Nordlicht ${suffix} GmbH`);
  await modal.getByPlaceholder("Ansprechperson", { exact: true }).fill("Ada Suchtest");
  await modal.getByPlaceholder("Bezeichnung *", { exact: true }).fill(`Pruefbolzen ${suffix}`);
  await modal.getByPlaceholder("Menge *", { exact: true }).fill("2");
  await modal.getByPlaceholder("Werkstoff", { exact: true }).fill(`Titan ${suffix}`);
  await modal.getByPlaceholder(/Oberfl.che \/ Behandlung/).fill(`Hartchrom ${suffix}`);
  await modal.getByLabel("Wunschtermin *", { exact: true }).fill("2026-11-19");
  await modal.getByLabel("Interner Hinweis", { exact: true }).fill("S5 SEARCH REAL E2E");
  await modal.getByRole("button", { name: "Wareneingang anlegen", exact: true }).click();
  const heading = modal.getByRole("heading", { name: /^A-\d{4}-\d+ best/ });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  const orderNumber = /^(A-\d{4}-\d+)/.exec((await heading.textContent())?.trim() ?? "")?.[1];
  if (!orderNumber) throw new Error("SEARCH_INTAKE_RECEIPT_INVALID");
  await modal.getByRole("button", { name: /Schlie/ }).click();
  return orderNumber;
}

async function openSearch(page: Page) {
  const compact = await page.evaluate(() => window.innerWidth < 768);
  const trigger = compact
    ? page.getByRole("button", { name: "Suche öffnen", exact: true })
    : page.getByRole("button", {
        name: "Kunde, Auftrag, Teil, Material, Oberfläche oder Termin suchen",
        exact: true,
      });
  await trigger.click();
  await expect(page.getByTestId("search-dialog")).toBeVisible({ timeout: 15_000 });
}

async function searchAndOpen(
  page: Page,
  query: string,
  type: "Auftrag" | "Kunde",
  targetText: string,
  keyboard = false,
) {
  await openSearch(page);
  const input = page.getByRole("combobox", { name: /Kunde, Auftrag, Teil, Material/ });
  await input.fill(query);
  const option = page
    .locator(`[role="option"][data-hit-type="${type === "Auftrag" ? "ORDER" : "CUSTOMER"}"]`)
    .filter({ hasText: targetText })
    .first();
  await expect(option).toBeVisible({ timeout: 30_000 });
  await expect(option).toContainText(type === "Auftrag" ? "Auftragsbestand" : "Kundenstamm");
  await expect(option).toContainText("Treffer über");
  await expect(option).toContainText("Zusammenhang:");
  await expect(option).toContainText(type === "Auftrag" ? "Auftragskarte öffnen" : "Kundenkarte öffnen");
  if (keyboard) await input.press("Enter");
  else await option.click();
}

test.describe.configure({ mode: "serial" });

test("real tenant search opens the target V8/V2 cards on desktop, tablet and mobile", async ({ page }) => {
  test.setTimeout(300_000);
  const databaseUrl = requiredEnv("DATABASE_URL");
  const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  requiredEnv("APP_SESSION_SECRET");
  const db = postgres(databaseUrl, { max: 1, prepare: false });
  const suffix = `${Date.now()}-${process.pid}`;
  const rateVersion = Math.floor(Date.now() / 1000);
  const email = `search-e2e-${suffix}@local.invalid`;
  const password = `Search-${randomUUID()}!Aa1`;
  const userId = await createAuthUser(apiUrl, anonKey, email, password);
  await db`
    INSERT INTO public.app_users (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES (${userId}::uuid, ${TENANT}, ${email}, 'Search E2E Admin', 'admin', true, now(), now())
  `;
  await db`
    INSERT INTO public.company_settings (
      id, tenant_id, company_name, street, zip, city, country, iban, bic,
      bank_name, tax_id, invoice_vat_rate_basis_points, invoice_payment_term_days
    ) VALUES (
      ${`search-e2e-${suffix}`}, ${TENANT}, 'Search E2E Synthetische GmbH', 'Testweg 1',
      '70173', 'Stuttgart', 'Deutschland', 'DE02120300000000202051', 'BYLADEM1001',
      'Search Testbank', 'DE-SYNTHETIC-TAX', 1900, 14
    )
  `;
  await db`
    INSERT INTO private.extra_work_hourly_rates (id, tenant_id, hourly_rate_cents, version, created_by, effective_at)
    VALUES (${randomUUID()}::uuid, ${TENANT}, 12000, ${rateVersion}, ${userId}::uuid, now())
  `;

  const artifacts: Array<{ file: string; sha256: string }> = [];
  await page.setViewportSize({ width: 1914, height: 917 });
  await login(page, email, password);
  const orderNumber = await createIntake(page, suffix);
  await page.goto("/orders");
  const [created] = await db<{ order_id: string; customer_id: string }[]>`
    SELECT id AS order_id, customer_id FROM public.orders
    WHERE tenant_id = ${TENANT} AND order_number = ${orderNumber}
  `;
  if (!created) throw new Error("SEARCH_E2E_ORDER_READBACK_MISSING");
  await page.goto("/warendurchlauf/wareneingang");
  const intakeRow = page.getByTestId(`wareneingang-order-${created.order_id}`);
  await expect(intakeRow).toBeVisible();
  await intakeRow.getByTestId("wareneingang-handoff").getByRole("button", { name: /An Galvanik/ }).click();
  await expect(page.getByTestId("wareneingang-handoff-status")).toBeVisible({ timeout: 30_000 });
  await page.goto("/orders");

  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await searchAndOpen(page, `Nordlicht ${suffix}`, "Kunde", `Nordlicht ${suffix} GmbH`);
  const customerCard = page.getByTestId("customer-card-v2");
  await expect(customerCard).toContainText(`Nordlicht ${suffix} GmbH`);
  artifacts.push(await capture(page, "search-desktop-customer-1914x917.png"));
  await customerCard.getByRole("button", { name: new RegExp(orderNumber) }).first().click();
  const linkedOrderCard = page.getByTestId("order-card-v8");
  await expect(linkedOrderCard).toContainText(orderNumber);
  await linkedOrderCard.getByRole("button", { name: /Auftragskarte schlie/ }).click();
  await expect(customerCard).toBeVisible();
  await customerCard.getByRole("button", { name: /Kundenkarte schlie/ }).click();

  const orderQueries = [orderNumber, `Pruefbolzen ${suffix}`, `Titan ${suffix}`, `Hartchrom ${suffix}`, "19.11.2026"];
  for (const [index, query] of orderQueries.entries()) {
    await searchAndOpen(page, query, "Auftrag", orderNumber, index === 0);
    const orderCard = page.getByTestId("order-card-v8");
    await expect(orderCard).toContainText(orderNumber);
    if (index === 0) artifacts.push(await capture(page, "search-desktop-order-1914x917.png"));
    await orderCard.getByRole("button", { name: /Auftragskarte schlie/ }).click();
  }

  await openSearch(page);
  await page.getByRole("combobox").fill(`kein-treffer-${suffix}`);
  const emptyDialog = page.getByTestId("search-dialog");
  await expect(emptyDialog).toContainText(`Ergebnis für „kein-treffer-${suffix}“`);
  await expect(emptyDialog).toContainText("Auftragsbestand und Kundenstamm wurden geprüft");
  await expect(emptyDialog).toContainText("Kundenname, Auftragsnummer, Teil oder Material, Oberfläche oder Datum");
  await expect(emptyDialog).not.toContainText(/Keine Treffer gefunden|nicht gefunden/i);
  artifacts.push(await capture(page, "search-desktop-empty-1914x917.png"));
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 1220, height: 880 });
  await searchAndOpen(page, orderNumber, "Auftrag", orderNumber);
  await expect(page.getByTestId("order-card-v8")).toContainText(orderNumber);
  await page.getByTestId("order-card-v8").getByRole("button", { name: /Auftragskarte schlie/ }).click();
  await openSearch(page);
  await page.getByRole("combobox").fill(orderNumber);
  await expect(page.locator('[role="option"][data-hit-type="ORDER"]').first()).toBeVisible();
  artifacts.push(await capture(page, "search-tablet-1220x880.png"));
  const tabletMeasurement = await page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    dialogState: document.querySelector('[data-testid="search-dialog"]')?.getAttribute("data-state"),
  }));
  expect(tabletMeasurement).toMatchObject({ viewport: { width: 1220, height: 880 }, horizontalOverflow: 0, dialogState: "data" });
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 844 });
  await searchAndOpen(page, `Nordlicht ${suffix}`, "Kunde", `Nordlicht ${suffix} GmbH`);
  await expect(page.getByTestId("customer-card-v2")).toContainText(orderNumber);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  artifacts.push(await capture(page, "search-mobile-customer-390x844.png"));
  await page.getByTestId("customer-card-v2").getByRole("button", { name: /Kundenkarte schlie/ }).click();

  await db`UPDATE public.app_users SET active = false WHERE id = ${userId}::uuid`;
  await openSearch(page);
  await page.getByRole("combobox").fill(orderNumber);
  await expect(page.getByTestId("search-dialog")).toHaveAttribute("data-state", "denial");
  artifacts.push(await capture(page, "search-mobile-denial-390x844.png"));
  await page.keyboard.press("Escape");
  await db`UPDATE public.app_users SET active = true WHERE id = ${userId}::uuid`;

  const foreignTenant = `search-e2e-foreign-${suffix}`;
  await db`UPDATE public.customers SET tenant_id = ${foreignTenant} WHERE id = ${created.customer_id}`;
  await openSearch(page);
  await page.getByRole("combobox").fill(orderNumber);
  await expect(page.getByTestId("search-dialog")).toHaveAttribute("data-state", "error");
  artifacts.push(await capture(page, "search-mobile-error-390x844.png"));
  await db`UPDATE public.customers SET tenant_id = ${TENANT} WHERE id = ${created.customer_id}`;

  const receipt = JSON.stringify({
    orderId: created.order_id,
    orderNumber,
    customerId: created.customer_id,
    customer: `Nordlicht ${suffix} GmbH`,
    searchedFields: ["customer", "orderNumber", "part", "material", "surface", "dueDate"],
    states: ["data", "empty", "denial", "error"],
    sources: ["Auftragsbestand", "Kundenstamm"],
    overlayBackstack: "customer -> order -> customer -> target shell",
    tabletMeasurement,
    artifacts,
  }, null, 2);
  writeFileSync(path.join(EVIDENCE_DIR, "search-real-browser-receipt.json"), receipt);
  writeFileSync(
    path.join(EVIDENCE_DIR, "search-real-browser-receipt.sha256"),
    `${createHash("sha256").update(receipt).digest("hex")}  search-real-browser-receipt.json\n`,
  );
  await db.end({ timeout: 1 });
});
