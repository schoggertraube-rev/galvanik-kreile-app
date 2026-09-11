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
  await page.waitForURL((url) => url.pathname !== "/start", { timeout: 30_000 });
  expect((await page.context().cookies()).some((cookie) => cookie.name === "kreile_app_session")).toBe(true);
}

async function loginWithPin(page: Page, initials: string, pin: string): Promise<void> {
  await page.goto("/start");
  await page.locator('[data-testid^="pin-user-card-"]').filter({ hasText: initials }).click();
  const dialog = page.getByTestId("pin-login-dialog");
  for (const digit of pin) {
    await dialog.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.waitForURL((url) => url.pathname !== "/start", { timeout: 30_000 });
  expect((await page.context().cookies()).some((cookie) => cookie.name === "kreile_app_session")).toBe(true);
}

async function seedPrerequisites(sql: postgres.Sql, adminId: string): Promise<void> {
  await sql`
    INSERT INTO public.company_settings (
      id, tenant_id, company_name, street, zip, city, country, iban, bic, bank_name,
      tax_id, invoice_vat_rate_basis_points, invoice_payment_term_days
    ) VALUES (
      'path1-ui-convergence', ${TENANT}, 'Path1 UI Test GmbH', 'Testweg 1', '70173',
      'Stuttgart', 'Deutschland', 'DE02120300000000202051', 'BYLADEM1001', 'Testbank',
      'DE-SYNTHETIC-TAX', 1900, 14
    ) ON CONFLICT (id) DO NOTHING
  `;
  await sql`
    INSERT INTO private.extra_work_hourly_rates
      (id, tenant_id, hourly_rate_cents, version, created_by, effective_at)
    VALUES ('a1000000-0000-4000-8000-000000000001'::uuid, ${TENANT}, 12000, 91011, ${adminId}::uuid, now())
    ON CONFLICT (tenant_id, version) DO NOTHING
  `;
}

async function createIntake(page: Page, suffix: string, existingCustomerName?: string): Promise<{ orderNumber: string; customerName: string }> {
  const customerName = existingCustomerName ?? `UI-Konvergenz ${suffix}`;
  await page.goto("/warendurchlauf/wareneingang");
  await page.getByTestId("wareneingang-create-order").click();
  const modal = page.getByTestId("order-intake-modal");
  await expect(modal).toBeVisible();
  if (existingCustomerName) {
    await modal.getByRole("button", { name: "Bestehend", exact: true }).click();
    await modal.getByPlaceholder("Name, Nummer oder Ort", { exact: true }).fill(existingCustomerName);
    const select = modal.getByLabel("Kunde auswählen", { exact: true });
    await expect(select).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => select.locator("option").count()).toBeGreaterThan(0);
    await select.selectOption({ index: 0 });
  } else {
    await modal.getByRole("button", { name: "Neu anlegen", exact: true }).click();
    await modal.getByPlaceholder("Kundenname *", { exact: true }).fill(customerName);
    await modal.getByPlaceholder("Firmenname", { exact: true }).fill(`${customerName} GmbH`);
    await modal.getByPlaceholder("Ansprechperson", { exact: true }).fill("Lokale B/C-Abnahme");
  }
  await modal.getByPlaceholder("Bezeichnung *", { exact: true }).fill(`Synthetisches Bauteil ${suffix}`);
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
  test("belegt V8/V2, reale Fachaktionen, Rechte, Deeplinks und denselben Backstack", async ({ browser }) => {
    test.setTimeout(900_000);
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
      const readonlyEmail = `path1-bc-readonly-${suffix}@local.test`;
      const readonlyPassword = `Path1-BC-Readonly-${suffix}!`;
      const readonlyId = await createAuthUser(apiUrl, anonKey, readonlyEmail, readonlyPassword);
      await sql`INSERT INTO public.app_users (id, tenant_id, email, full_name, role, active, pin_hash) VALUES (${userId}::uuid, ${TENANT}, ${email}, 'Path1 B/C Admin', 'admin', true, null), (${readonlyId}::uuid, ${TENANT}, ${readonlyEmail}, 'Path1 B/C Nur Lesen', 'readonly', true, '4827')`;
      await seedPrerequisites(sql, userId);
      const setupContext = await browser.newContext({ viewport: { width: 1914, height: 917 } });
      setupContext.setDefaultTimeout(30_000);
      contexts.push(setupContext);
      const setupPage = await setupContext.newPage();
      await login(setupPage, email, password);
      const receipt = await createIntake(setupPage, suffix);

      const rows = await sql<Array<{ order_id: string; customer_id: string }>>`SELECT id AS order_id, customer_id FROM public.orders WHERE tenant_id=${TENANT} AND order_number=${receipt.orderNumber}`;
      const row = rows[0];
      if (!row) throw new Error("PATH1_UI_ORDER_READBACK_MISSING");
      await sql`UPDATE public.customers SET street='Kundenweg 2', zip_code='70174', city='Stuttgart', country='Deutschland' WHERE tenant_id=${TENANT} AND id=${row.customer_id}`;
      await sql`UPDATE public.items SET preis_netto=100.00 WHERE tenant_id=${TENANT} AND order_id=${row.order_id}`;
      await transitionToGalvanik(setupPage, row.order_id);
      const operativeReceipt = await createIntake(setupPage, `${suffix}-operativ`, receipt.customerName);
      for (let index = 1; index <= 10; index += 1) {
        await createIntake(setupPage, `${suffix}-scroll-${String(index).padStart(2, "0")}`, receipt.customerName);
      }
      const operativeRows = await sql<Array<{ order_id: string }>>`SELECT id AS order_id FROM public.orders WHERE tenant_id=${TENANT} AND order_number=${operativeReceipt.orderNumber}`;
      const operativeRow = operativeRows[0];
      if (!operativeRow) throw new Error("PATH1_UI_OPERATIVE_ORDER_READBACK_MISSING");
      await transitionToGalvanik(setupPage, operativeRow.order_id);

      const readonlyContext = await browser.newContext({ viewport: { width: 1220, height: 880 } });
      readonlyContext.setDefaultTimeout(30_000);
      contexts.push(readonlyContext);
      const readonlyPage = await readonlyContext.newPage();
      await loginWithPin(readonlyPage, "PL", "4827");
      await readonlyPage.goto(`/orders/${operativeRow.order_id}`);
      const readonlyCard = readonlyPage.getByTestId("order-card-v8");
      await expect(readonlyCard).toContainText("Zahlungsdetails sind für diese Rolle nicht freigegeben.");
      await expect(readonlyCard.getByRole("button", { name: "Fertig melden & einfrieren" })).toBeDisabled();

      const anonymousContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      anonymousContext.setDefaultTimeout(30_000);
      contexts.push(anonymousContext);
      const anonymousPage = await anonymousContext.newPage();
      await anonymousPage.goto(`/orders/${operativeRow.order_id}`);
      await anonymousPage.waitForURL((url) => url.pathname === "/start");

      await setupPage.goto("/orders");
      const filter = setupPage.getByPlaceholder("Auftragsnummer, Kunde, Teil, Material …");
      await expect(setupPage.getByRole("button", { name: new RegExp(receipt.orderNumber) })).toBeVisible();
      await filter.click();
      await filter.fill("kein-belegter-treffer-xyz");
      await expect(filter).toHaveValue("kein-belegter-treffer-xyz");
      await expect(setupPage.getByText("Keine Aufträge passen zu diesem Filter.")).toBeVisible();
      await filter.fill(receipt.orderNumber);
      await setupPage.getByRole("button", { name: new RegExp(receipt.orderNumber) }).click();
      const actionCard = setupPage.getByTestId("order-card-v8");
      await expect(actionCard).toContainText("Vorkasse · Rechnung noch nicht gestellt");
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
      await actionCard.locator('input[type="file"]').setInputFiles({ name: "synthetischer-zustandsbeleg.png", mimeType: "image/png", buffer: png });
      await expect(actionCard.getByText("Zustandsfoto wurde unverändert gespeichert und zurückgelesen.")).toBeVisible({ timeout: 30_000 });
      await actionCard.getByRole("button", { name: "Fertig melden & einfrieren" }).click();
      await expect(actionCard.getByText("Fertigstellung und Freeze bestätigt.")).toBeVisible({ timeout: 30_000 });
      await actionCard.getByRole("button", { name: "Rechnung ausstellen" }).click();
      await expect(actionCard.getByText(/wurde unveränderlich ausgestellt/)).toBeVisible({ timeout: 30_000 });
      await actionCard.getByRole("button", { name: "Offenen Betrag bestätigen" }).click();
      await expect(actionCard.getByText("Zahlung wurde bestätigt und aus der Datenbank zurückgelesen.")).toBeVisible({ timeout: 30_000 });
      await actionCard.getByRole("button", { name: "Warenausgang bestätigen" }).click();
      await expect(actionCard.getByText("Warenausgang wurde bestätigt und aus der Datenbank zurückgelesen.")).toBeVisible({ timeout: 30_000 });
      const eventRows = await sql<Array<{ event_type: string; count: number }>>`
        SELECT event_type, count(*)::integer AS count FROM public.events
        WHERE tenant_id=${TENANT} AND order_id=${row.order_id}
          AND event_type IN ('ORDER_STATION_MOVED_V1','ORDER_FROZEN_V1','INVOICE_CREATED_V1','PAYMENT_CONFIRMED_V1','ORDER_PICKED_UP_V1')
        GROUP BY event_type ORDER BY event_type
      `;
      expect(eventRows.every((entry) => entry.count === 1)).toBe(true);

      await setupPage.goto(`/orders/${operativeRow.order_id}`);
      const operativeActionCard = setupPage.getByTestId("order-card-v8");
      await expect(operativeActionCard.getByRole("button", { name: "Fertig melden & einfrieren" })).toBeEnabled();
      await operativeActionCard.locator('input[type="file"]').setInputFiles({ name: "synthetischer-operativer-readback.png", mimeType: "image/png", buffer: png });
      await expect(operativeActionCard.getByText("Zustandsfoto wurde unverändert gespeichert und zurückgelesen.")).toBeVisible({ timeout: 30_000 });
      await operativeActionCard.getByText("Readback bestätigt").scrollIntoViewIfNeeded();
      artifacts.push(await capture(setupPage, "bc-order-v8-action-readback-desktop-1914x917.png"));

      for (const viewport of [
        { width: 1914, height: 917, label: "desktop-1914x917" },
        { width: 1220, height: 880, label: "tablet-1220x880" },
        { width: 390, height: 844, label: "mobile-390x844" },
      ]) {
        const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
        context.setDefaultTimeout(30_000);
        contexts.push(context);
        const page = await context.newPage();
        await login(page, email, password);
        await page.goto("/orders");
        const listFilter = page.getByPlaceholder("Auftragsnummer, Kunde, Teil, Material …");
        await expect(page.getByRole("button", { name: new RegExp(operativeReceipt.orderNumber) })).toBeVisible();
        await listFilter.fill(receipt.customerName);
        const orderButton = page.getByRole("button", { name: new RegExp(operativeReceipt.orderNumber) });
        await expect(orderButton).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await orderButton.scrollIntoViewIfNeeded();
        const initialScroll = await page.evaluate(() => window.scrollY);
        expect(initialScroll).toBeGreaterThan(0);
        await orderButton.click();
        const orderCard = page.getByTestId("order-card-v8");
        await expect(orderCard).toBeVisible();
        await expect(orderCard).toContainText("Zahlung · getrennte Schwelle");
        await expect(orderCard).toContainText(`Synthetisches Bauteil ${suffix}-operativ`);
        await expect(orderCard.getByRole("button", { name: "Fertig melden & einfrieren" })).toBeEnabled();
        expect(await orderCard.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        artifacts.push(await capture(page, `bc-order-v8-${viewport.label}.png`));
        await orderCard.evaluate((element) => { element.scrollTop = element.scrollHeight; });
        await expect(orderCard.getByText("Verbindliche Fachaktionen")).toBeVisible();
        artifacts.push(await capture(page, `bc-order-v8-actions-${viewport.label}.png`));

        await orderCard.getByRole("button", { name: /Kundenkarte öffnen/ }).click();
        const customerCard = page.getByTestId("customer-card-v2");
        await expect(customerCard).toBeVisible();
        await expect(customerCard).toContainText(receipt.customerName);
        await expect(customerCard.getByText("Kein aktiver Auftrag im Haus")).not.toBeVisible();
        await expect(customerCard.getByText("Historie & Referenzen")).toBeVisible();
        await expect(customerCard.getByRole("button", { name: "Notiz +" })).toHaveCount(0);
        await expect(customerCard.getByRole("button", { name: "Neuer Auftrag" })).toHaveCount(0);
        await expect(customerCard.getByRole("button", { name: new RegExp(operativeReceipt.orderNumber) }).first()).toBeVisible();
        await expect(customerCard.getByRole("button", { name: new RegExp(receipt.orderNumber) }).first()).toBeVisible();
        expect(await customerCard.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        artifacts.push(await capture(page, `bc-customer-v2-${viewport.label}.png`));
        const operativeCustomerOrder = customerCard.getByRole("button", { name: new RegExp(operativeReceipt.orderNumber) }).first();
        await operativeCustomerOrder.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("order-card-v8")).toContainText(operativeReceipt.orderNumber, { timeout: 30_000 });
        await page.getByTestId("order-card-v8").getByRole("button", { name: "Schließen / zurück" }).click();
        await page.getByTestId("customer-card-v2").getByRole("button", { name: /Schließen/ }).click();
        await page.getByTestId("order-card-v8").getByRole("button", { name: "Schließen / zurück" }).click();
        await expect(listFilter).toHaveValue(receipt.customerName);
        expect(await page.evaluate(() => window.scrollY)).toBe(initialScroll);

        await page.goto(`/orders/${operativeRow.order_id}`);
        await expect(page.getByTestId("order-card-v8")).toContainText(operativeReceipt.orderNumber);
        await page.getByTestId("order-card-v8").getByRole("button", { name: "Schließen / zurück" }).click();
        await page.waitForURL((url) => url.pathname === "/orders");
        await page.goto("/orders/00000000-0000-4000-8000-000000000099");
        await expect(page.getByText("Auftrag nicht verfügbar.", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Schließen" }).click();
        await page.waitForURL((url) => url.pathname === "/orders");
        await page.goto(`/customers/${row.customer_id}`);
        await expect(page.getByTestId("customer-card-v2")).toContainText(receipt.customerName);
        await page.getByTestId("customer-card-v2").getByRole("button", { name: /Schließen/ }).click();
        await page.waitForURL((url) => url.pathname === "/customers");
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
      }

      const receiptPath = path.join(EVIDENCE_DIR, "bc-real-browser-receipt.json");
      writeFileSync(receiptPath, `${JSON.stringify({
        source: "fresh local Supabase + real auth/session + canonical intake/actions/readbacks",
        roles: ["admin", "readonly", "unauthenticated"],
        completedOrder: { orderNumber: receipt.orderNumber, orderId: row.order_id },
        operativeOrder: { orderNumber: operativeReceipt.orderNumber, orderId: operativeRow.order_id, station: "galvanik" },
        customerId: row.customer_id,
        verifiedActions: ["station handoff", "station evidence upload with persisted readback", "finish/freeze", "immutable invoice", "confirm payment", "goods out"],
        contextProof: { filter: receipt.customerName, scroll: "strictly positive and equal after order -> customer -> order -> list", activeAndHistoryForSameCustomer: true },
        negativeStates: ["readonly payment detail restricted without hiding core card", "unauthenticated redirect", "empty filter", "not found deeplink"],
        viewports: ["1914x917", "1220x880", "390x844"],
        artifacts,
      }, null, 2)}\n`);
    } finally {
      await Promise.all(contexts.map((context) => context.close()));
      await sql.end({ timeout: 5 });
    }
  });
});
