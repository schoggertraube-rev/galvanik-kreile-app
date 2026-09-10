import { expect, test, type Page } from "@playwright/test";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
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
  await page.waitForURL((url) => url.pathname === "/warendurchlauf", { timeout: 30_000 });
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
  if (await page.getByRole("button", { name: /Suche .ffnen/ }).isVisible()) {
    await page.getByRole("button", { name: /Suche .ffnen/ }).click();
  } else {
    await page.getByRole("button", { name: /Kunde, Auftrag, Teil, Material/ }).click();
  }
  await expect(page.getByTestId("search-dialog")).toBeVisible();
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

test("real tenant search opens existing customer and order cards on desktop and tablet", async ({ page }) => {
  test.setTimeout(180_000);
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

  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, email, password);
  const orderNumber = await createIntake(page, suffix);
  await page.goto("/warendurchlauf");
  const [created] = await db<{ order_id: string; customer_id: string }[]>`
    SELECT id AS order_id, customer_id FROM public.orders
    WHERE tenant_id = ${TENANT} AND order_number = ${orderNumber}
  `;
  if (!created) throw new Error("SEARCH_E2E_ORDER_READBACK_MISSING");
  await db`
    UPDATE public.customers
    SET street = 'Testweg 1', zip_code = '70173', city = 'Stuttgart', country = 'Deutschland', updated_at = now()
    WHERE tenant_id = ${TENANT} AND id = ${created.customer_id}
  `;
  await db`
    UPDATE public.items SET preis_netto = 100.00
    WHERE tenant_id = ${TENANT} AND order_id = ${created.order_id}
  `;
  await page.goto("/warendurchlauf/wareneingang");
  const intakeRow = page.getByTestId(`wareneingang-order-${created.order_id}`);
  await expect(intakeRow).toBeVisible();
  await intakeRow.getByTestId("wareneingang-handoff").getByRole("button", { name: /An Galvanik/ }).click();
  await expect(page.getByTestId("wareneingang-handoff-status")).toBeVisible({ timeout: 30_000 });
  await page.goto("/warendurchlauf");

  await searchAndOpen(page, `Nordlicht ${suffix}`, "Kunde", `Nordlicht ${suffix} GmbH`);
  await expect(page.getByTestId("live-customer-card")).toContainText(`Nordlicht ${suffix} GmbH`);
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "search-desktop-customer-1440x900.png"), fullPage: false });
  await page.getByRole("button", { name: /Kundenkarte schlie/ }).last().click();

  const orderQueries = [orderNumber, `Pruefbolzen ${suffix}`, `Titan ${suffix}`, `Hartchrom ${suffix}`, "19.11.2026"];
  for (const [index, query] of orderQueries.entries()) {
    await searchAndOpen(page, query, "Auftrag", orderNumber, index === 0);
    await expect(page.getByTestId("live-order-card")).toContainText(orderNumber);
    if (index === 0) {
      await page.screenshot({ path: path.join(EVIDENCE_DIR, "search-desktop-order-1440x900.png"), fullPage: false });
    }
    await page.getByTestId("live-order-card").getByRole("button", { name: /Auftragskarte schlie/ }).click();
  }

  await openSearch(page);
  await page.getByRole("combobox").fill(`kein-treffer-${suffix}`);
  await expect(page.getByTestId("search-dialog")).toContainText(`Ergebnis für „kein-treffer-${suffix}“`);
  await expect(page.getByTestId("search-dialog")).toContainText("Auftragsbestand und Kundenstamm wurden geprüft");
  await expect(page.getByTestId("search-dialog")).toContainText("Kundenname, Auftragsnummer, Teil oder Material, Oberfläche oder Datum");
  const desktopPath = path.join(EVIDENCE_DIR, "search-desktop-empty-1440x900.png");
  await page.screenshot({ path: desktopPath, fullPage: false });
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 1220, height: 880 });
  await searchAndOpen(page, orderNumber, "Auftrag", orderNumber);
  await expect(page.getByTestId("live-order-card")).toContainText(orderNumber);
  await page.getByTestId("live-order-card").getByRole("button", { name: /Auftragskarte schlie/ }).click();
  await openSearch(page);
  await page.getByRole("combobox").fill(orderNumber);
  await expect(page.locator('[role="option"][data-hit-type="ORDER"]').first()).toBeVisible();
  const tabletPath = path.join(EVIDENCE_DIR, "search-tablet-1220x880.png");
  await page.screenshot({ path: tabletPath, fullPage: false });

  const measurement = await page.evaluate(() => ({
    viewport: { width: window.innerWidth, height: window.innerHeight },
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    dialogState: document.querySelector('[data-testid="search-dialog"]')?.getAttribute("data-state"),
  }));
  expect(measurement).toMatchObject({ viewport: { width: 1220, height: 880 }, horizontalOverflow: 0, dialogState: "data" });
  await page.keyboard.press("Escape");

  await db`UPDATE public.app_users SET active = false WHERE id = ${userId}::uuid`;
  await openSearch(page);
  await page.getByRole("combobox").fill(orderNumber);
  await expect(page.getByTestId("search-dialog")).toHaveAttribute("data-state", "denial");
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "search-tablet-denial-1220x880.png"), fullPage: false });
  await page.keyboard.press("Escape");
  await db`UPDATE public.app_users SET active = true WHERE id = ${userId}::uuid`;

  const foreignTenant = `search-e2e-foreign-${suffix}`;
  await db`UPDATE public.customers SET tenant_id = ${foreignTenant} WHERE id = ${created.customer_id}`;
  await openSearch(page);
  await page.getByRole("combobox").fill(orderNumber);
  await expect(page.getByTestId("search-dialog")).toHaveAttribute("data-state", "error");
  await page.screenshot({ path: path.join(EVIDENCE_DIR, "search-tablet-error-1220x880.png"), fullPage: false });
  await db`UPDATE public.customers SET tenant_id = ${TENANT} WHERE id = ${created.customer_id}`;

  const receipt = JSON.stringify({
    orderId: created.order_id,
    orderNumber,
    customerId: created.customer_id,
    customer: `Nordlicht ${suffix} GmbH`,
    searchedFields: ["customer", "orderNumber", "part", "material", "surface", "dueDate"],
    states: ["data", "empty", "denial", "error"],
    sources: ["Auftragsbestand", "Kundenstamm"],
    measurement,
  }, null, 2);
  writeFileSync(path.join(EVIDENCE_DIR, "search-real-browser-receipt.json"), receipt);
  writeFileSync(
    path.join(EVIDENCE_DIR, "search-real-browser-receipt.sha256"),
    `${createHash("sha256").update(receipt).digest("hex")}  search-real-browser-receipt.json\n`,
  );
  await db.end({ timeout: 1 });
});
