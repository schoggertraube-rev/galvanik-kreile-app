import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { mkdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createPinLoginHandle } from "../src/lib/server/pinLoginHandle";

const TENANT = "galvanik-kreile";
const FOREIGN_TENANT = "f1-3-foreign-tenant";
const EVIDENCE_DIR = path.resolve(process.cwd(), "docs/evidence/f1/artifacts/f1-3");

type AuthSignupResponse = { user?: { id?: string }; message?: string };
type OrderRow = {
  id: string;
  customer_id: string;
  order_number: string;
  station: string;
  current_station: string;
  current_station_id: string;
  status: string;
  version: number;
  db_geplant: string | null;
  db_ist: string | null;
};
type AccountingSnapshot = {
  db_geplant: string | null;
  db_ist: string | null;
  cost_count: number;
  price_count: number;
};
type ReceiptRow = {
  id: string;
  event_type: string;
  client_event_id: string;
  correlation_id: string;
  aggregate_version: number;
  payload: Record<string, unknown>;
};
type LastSeenReceiptRow = {
  event_id: string;
  tenant_id: string;
  actor_id: string;
  client_event_id: string;
  correlation_id: string;
  aggregate_version: number;
  last_seen_at: Date | string;
  integrity_ok: boolean;
};
type LastSeenStateRow = {
  tenant_id: string;
  user_id: string;
  last_seen_at: Date | string;
  version: number;
  integrity_ok: boolean;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`F1_3_E2E_ENV_MISSING:${name}`);
  return value;
}

async function expectExactlyOneVisible(locator: Locator, options?: { timeout?: number }) {
  await expect(locator).toHaveCount(1, options);
  await expect(locator).toBeVisible(options);
}

async function clickExactlyOne(locator: Locator) {
  await expect(locator).toHaveCount(1);
  await locator.click();
}

async function fillExactlyOne(locator: Locator, value: string) {
  await expect(locator).toHaveCount(1);
  await locator.fill(value);
}

async function selectExactlyOne(locator: Locator, value: string) {
  await expect(locator).toHaveCount(1);
  await locator.selectOption(value);
}

async function setInputFilesExactlyOne(
  locator: Locator,
  files: Parameters<Locator["setInputFiles"]>[0],
) {
  await expect(locator).toHaveCount(1);
  await locator.setInputFiles(files);
}

async function submitRealEmailLogin(page: Page, email: string, password: string) {
  await page.goto("/start");
  await clickExactlyOne(page.getByRole("button", { name: "Administrator / E-Mail Login", exact: true }));
  const dialog = page.getByTestId("email-login-dialog");
  await expectExactlyOneVisible(dialog);
  await fillExactlyOne(dialog.locator("#email"), email);
  await fillExactlyOne(dialog.locator("#password"), password);
  await clickExactlyOne(dialog.getByRole("button", { name: "Einloggen", exact: true }));
}

async function createRealLocalAuthUser(apiUrl: string, anonKey: string, email: string, password: string) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as AuthSignupResponse;
  if (!response.ok || typeof body.user?.id !== "string") {
    throw new Error(`REAL_LOCAL_AUTH_SIGNUP_FAILED:${response.status}:${body.message ?? "invalid response"}`);
  }
  return body.user.id;
}

async function loginWithRealEmail(page: Page, email: string, password: string) {
  await submitRealEmailLogin(page, email, password);
  await page.waitForURL((url) => url.pathname === "/warendurchlauf", { timeout: 30_000 });
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "kreile_app_session")).toBe(true);
  expect(cookies.some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))).toBe(true);
}

async function loginWithRealPin(page: Page, userId: string, pin: string) {
  await page.goto("/start");
  const userCard = page.getByTestId(`pin-user-card-${createPinLoginHandle(userId)}`);
  await clickExactlyOne(userCard);
  const dialog = page.getByTestId("pin-login-dialog");
  await expectExactlyOneVisible(dialog);
  await expectExactlyOneVisible(dialog.getByText("PIN eingeben", { exact: true }));
  for (const digit of pin) {
    await clickExactlyOne(dialog.getByRole("button", { name: digit, exact: true }));
  }
  await page.waitForURL((url) => url.pathname === "/warendurchlauf", { timeout: 30_000 });
  expect((await page.context().cookies()).some((cookie) => cookie.name === "kreile_app_session")).toBe(true);
}

async function openRoute(page: Page, route: string) {
  await page.goto(route);
  await page.waitForURL((url) => url.pathname === route, { timeout: 30_000 });
}

async function screenshot(page: Page, filename: string) {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, filename), fullPage: true });
}

async function createIntakeThroughRealUi(page: Page, suffix: string): Promise<string> {
  await openRoute(page, "/warendurchlauf/wareneingang");
  await clickExactlyOne(page.getByTestId("wareneingang-create-order"));
  const intake = page.getByTestId("order-intake-modal");
  await expectExactlyOneVisible(intake);
  await expectExactlyOneVisible(intake.getByRole("heading", { name: "Digitaler Wareneingang", exact: true }));
  await clickExactlyOne(intake.getByRole("button", { name: "Neu anlegen", exact: true }));
  await fillExactlyOne(intake.getByPlaceholder("Kundenname *", { exact: true }), `F1.3 Kunde ${suffix}`);
  await fillExactlyOne(intake.getByPlaceholder("Firmenname", { exact: true }), "F1.3 E2E GmbH");
  await fillExactlyOne(intake.getByPlaceholder("Ansprechperson", { exact: true }), "F1.3 Abnahme");
  await fillExactlyOne(intake.getByPlaceholder("Bezeichnung *", { exact: true }), `Stoßstange ${suffix}`);
  await fillExactlyOne(intake.getByPlaceholder("Menge *", { exact: true }), "2");
  await fillExactlyOne(intake.getByPlaceholder("Werkstoff", { exact: true }), "Stahl");
  await fillExactlyOne(intake.getByPlaceholder("Oberfläche / Behandlung *", { exact: true }), "Verchromen");
  await fillExactlyOne(intake.getByLabel("Wunschtermin *", { exact: true }), "2026-09-30");
  await fillExactlyOne(intake.getByLabel("Interner Hinweis", { exact: true }), "F1.3 realer Leistungsabschluss");
  await clickExactlyOne(intake.getByRole("button", { name: "Wareneingang anlegen", exact: true }));

  const receiptHeading = intake.getByRole("heading", { name: /^A-\d{4}-\d+ bestätigt$/ });
  await expectExactlyOneVisible(receiptHeading, { timeout: 30_000 });
  const receiptText = (await receiptHeading.textContent())?.trim() ?? "";
  const match = /^(A-\d{4}-\d+) bestätigt$/.exec(receiptText);
  if (!match) throw new Error(`F1_3_INTAKE_RECEIPT_INVALID:${receiptText}`);

  await setInputFilesExactlyOne(intake.locator('input[type="file"]'), {
    name: "f1-3-original.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await expectExactlyOneVisible(intake.getByText("Original bestätigt · f1-3-original.png", { exact: true }), { timeout: 30_000 });
  await screenshot(page, "01-intake-storage-receipt.png");
  await clickExactlyOne(intake.getByRole("button", { name: "Schließen", exact: true }));
  return match[1];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function openOrderCardFromBucket(
  page: Page,
  orderId: string,
  orderNumber: string,
  bucket: "galvanik" | "finished",
) {
  const orderList = page.getByTestId(`galvanik-${bucket}-orders`);
  await expectExactlyOneVisible(orderList, { timeout: 30_000 });
  const orderCard = orderList.locator(
    `[data-testid="order-compact-card"][data-order-id="${orderId}"]`,
  );
  await clickExactlyOne(orderCard);
  const overlay = page.getByTestId("live-order-card");
  await expectExactlyOneVisible(overlay, { timeout: 30_000 });
  await expectExactlyOneVisible(
    overlay.getByRole("heading", { name: new RegExp(`^${escapeRegExp(orderNumber)} ·`) }),
    { timeout: 30_000 },
  );
  return overlay;
}

async function openLiveOrderCard(page: Page, orderId: string, orderNumber: string) {
  await openRoute(page, "/warendurchlauf/galvanik");
  return openOrderCardFromBucket(page, orderId, orderNumber, "galvanik");
}

async function readOrder(sql: postgres.Sql, orderNumber: string): Promise<OrderRow> {
  const rows = await sql<OrderRow[]>`
    SELECT id, customer_id, order_number, station, current_station, current_station_id,
           status, version, db_geplant::text, db_ist::text
    FROM public.orders
    WHERE tenant_id = ${TENANT} AND order_number = ${orderNumber}
  `;
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function readAccountingSnapshot(sql: postgres.Sql, orderId: string): Promise<AccountingSnapshot> {
  const [row] = await sql<AccountingSnapshot[]>`
    SELECT orders.db_geplant::text, orders.db_ist::text,
      (SELECT count(*)::integer FROM public.order_cost_positions WHERE order_id = ${orderId}) AS cost_count,
      (SELECT count(*)::integer FROM public.price_lines WHERE order_id = ${orderId}) AS price_count
    FROM public.orders orders WHERE orders.id = ${orderId}
  `;
  if (!row) throw new Error("F1_3_ACCOUNTING_SNAPSHOT_MISSING");
  return row;
}

test.describe("F1.3 realer Leistungsabschluss", () => {
  test("läuft mit echter Auth, DB, Storage, Commands, Receipts, Reload und negativen Grenzen", async ({ browser }, testInfo) => {
    test.setTimeout(420_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });

    const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const databaseUrl = requiredEnv("DATABASE_URL");
    const expectedApiUrl = requiredEnv("F1_3_EXPECTED_API_URL");
    const expectedDatabaseUrl = requiredEnv("F1_3_EXPECTED_DATABASE_URL");
    requiredEnv("APP_SESSION_SECRET");
    expect(apiUrl).toBe(expectedApiUrl);
    expect(databaseUrl).toBe(expectedDatabaseUrl);
    expect(apiUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(databaseUrl).toMatch(/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/);

    const suffix = `${Date.now()}-${process.pid}`;
    const adminEmail = `f1-3-admin-${suffix}@local.test`;
    const readonlyEmail = `f1-3-readonly-${suffix}@local.test`;
    const workshopEmail = `f1-3-workshop-${suffix}@local.test`;
    const foreignEmail = `f1-3-foreign-${suffix}@local.test`;
    const adminPassword = `F1.3-Admin-${suffix}!`;
    const readonlyPassword = `F1.3-Readonly-${suffix}!`;
    const workshopPassword = `F1.3-Workshop-${suffix}!`;
    const foreignPassword = `F1.3-Foreign-${suffix}!`;
    const readonlyPin = "7314";
    const workshopPin = "8426";
    const catalogName = `Richten ${suffix}`;
    const sql = postgres(databaseUrl, { max: 1, prepare: false });
    const contexts: BrowserContext[] = [];

    try {
      const adminId = await createRealLocalAuthUser(apiUrl, anonKey, adminEmail, adminPassword);
      const readonlyId = await createRealLocalAuthUser(apiUrl, anonKey, readonlyEmail, readonlyPassword);
      const workshopId = await createRealLocalAuthUser(apiUrl, anonKey, workshopEmail, workshopPassword);
      const foreignId = await createRealLocalAuthUser(apiUrl, anonKey, foreignEmail, foreignPassword);
      const readonlyPinHash = await bcrypt.hash(readonlyPin, 12);
      const workshopPinHash = await bcrypt.hash(workshopPin, 12);
      await sql`
        INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active)
        VALUES
          (${adminId}::uuid, ${TENANT}, ${adminEmail}, 'F1.3 Admin', 'admin', NULL, true),
          (${readonlyId}::uuid, ${TENANT}, ${readonlyEmail}, 'F1.3 Readonly', 'readonly', ${readonlyPinHash}, true),
          (${workshopId}::uuid, ${TENANT}, ${workshopEmail}, 'F1.3 Werkstatt', 'werkstatt', ${workshopPinHash}, true),
          (${foreignId}::uuid, ${FOREIGN_TENANT}, ${foreignEmail}, 'F1.3 Foreign', 'admin', NULL, true)
      `;

      const adminContext = await browser.newContext({ viewport: { width: 1024, height: 1366 } });
      contexts.push(adminContext);
      const adminPage = await adminContext.newPage();
      await loginWithRealEmail(adminPage, adminEmail, adminPassword);

      await openRoute(adminPage, "/warendurchlauf/galvanik");
      await expectExactlyOneVisible(adminPage.getByText("Lade Galvanik Aufträge...", { exact: true }));
      const activeOrders = adminPage.getByTestId("galvanik-galvanik-orders");
      await expectExactlyOneVisible(activeOrders, { timeout: 30_000 });
      await expectExactlyOneVisible(activeOrders.getByText(/Noch keine Daten erfasst\./), { timeout: 30_000 });
      await screenshot(adminPage, "02-galvanik-empty.png");

      const orderNumber = await createIntakeThroughRealUi(adminPage, suffix);
      const created = await readOrder(sql, orderNumber);
      expect(created).toMatchObject({ station: "wareneingang", status: "angenommen", version: 1 });

      await openRoute(adminPage, "/warendurchlauf/wareneingang");
      const orderRow = adminPage.getByTestId(`wareneingang-order-${created.id}`);
      await expectExactlyOneVisible(orderRow, { timeout: 30_000 });
      await expectExactlyOneVisible(orderRow.getByText(orderNumber, { exact: true }));
      const handoffControl = orderRow.getByTestId("wareneingang-handoff");
      await expectExactlyOneVisible(handoffControl);
      const handoffButton = handoffControl.getByRole("button", {
        name: "An Galvanik übergeben",
        exact: true,
      });
      await clickExactlyOne(handoffButton);
      await expectExactlyOneVisible(adminPage.getByTestId("wareneingang-handoff-status"), { timeout: 30_000 });
      const inGalvanik = await readOrder(sql, orderNumber);
      expect(inGalvanik).toMatchObject({ station: "galvanik", current_station: "galvanik", status: "galvanik", version: 2 });
      const accountingBefore = await readAccountingSnapshot(sql, created.id);

      let adminOverlay = await openLiveOrderCard(adminPage, created.id, orderNumber);
      await expectExactlyOneVisible(adminOverlay.getByText("6 Intake-Felder bestätigt", { exact: true }));
      await expect(adminOverlay.getByText("Geplanter Kennzahlen-Steckplatz", { exact: true })).toHaveCount(2);
      await screenshot(adminPage, "03-live-card-data-tablet.png");

      const assignmentPanel = adminOverlay.getByTestId("order-task-assignment-panel");
      await expectExactlyOneVisible(assignmentPanel);
      await selectExactlyOne(assignmentPanel.getByLabel("Zuständige Person", { exact: true }), workshopId);
      await clickExactlyOne(assignmentPanel.getByRole("button", { name: "Zuweisen", exact: true }));
      await expectExactlyOneVisible(assignmentPanel.getByText("Zuweisung und gemeinsamer Readback bestätigt.", { exact: true }), { timeout: 30_000 });
      await expectExactlyOneVisible(assignmentPanel.getByText(/Bei F1\.3 Werkstatt/));
      await screenshot(adminPage, "04-assignment-admin-confirmed.png");

      const workshopContext = await browser.newContext({ viewport: { width: 1024, height: 1366 } });
      contexts.push(workshopContext);
      const workshopPage = await workshopContext.newPage();
      await loginWithRealPin(workshopPage, workshopId, workshopPin);
      const workshopOverlay = await openLiveOrderCard(workshopPage, created.id, orderNumber);
      const workshopAssignment = workshopOverlay.getByTestId("order-task-assignment-panel");
      await expectExactlyOneVisible(workshopAssignment);
      await expectExactlyOneVisible(workshopAssignment.getByText("Von F1.3 Admin · wartet auf dich", { exact: true }));
      await clickExactlyOne(workshopAssignment.getByRole("button", { name: "Aufgabe zurückgeben", exact: true }));
      await expectExactlyOneVisible(workshopAssignment.getByText("Rückgabe und gemeinsamer Readback bestätigt.", { exact: true }), { timeout: 30_000 });
      await expectExactlyOneVisible(workshopAssignment.getByText("Von F1.3 Werkstatt zurückgegeben.", { exact: true }));
      await screenshot(workshopPage, "05-handback-workshop-confirmed.png");

      await adminPage.reload({ waitUntil: "domcontentloaded" });
      adminOverlay = await openLiveOrderCard(adminPage, created.id, orderNumber);
      await expectExactlyOneVisible(adminOverlay.getByTestId("order-task-assignment-panel").getByText("Von F1.3 Werkstatt zurückgegeben.", { exact: true }));

      const adminPanel = adminOverlay.getByTestId("extra-work-admin-panel");
      await expectExactlyOneVisible(adminPanel);
      await clickExactlyOne(adminPanel.getByRole("button", { name: "Mehrarbeits-Stammdaten (Admin)", exact: true }));
      await fillExactlyOne(adminPanel.getByLabel("Stundensatz in EUR", { exact: true }), "120,00");
      await clickExactlyOne(adminPanel.getByRole("button", { name: "Satz speichern", exact: true }));
      await expectExactlyOneVisible(adminPanel.getByText("Stundensatz bestätigt.", { exact: true }), { timeout: 30_000 });
      const catalogCreate = adminPanel.getByTestId("extra-work-catalog-create");
      await expectExactlyOneVisible(catalogCreate);
      await fillExactlyOne(catalogCreate.getByLabel("Neue Position", { exact: true }), catalogName);
      await fillExactlyOne(catalogCreate.getByLabel("Standard-Min.", { exact: true }), "45");
      await clickExactlyOne(catalogCreate.getByRole("button", { name: "Anlegen", exact: true }));
      await expectExactlyOneVisible(adminPanel.getByText("Katalogposition bestätigt.", { exact: true }), { timeout: 30_000 });

      const staleContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      contexts.push(staleContext);
      const stalePage = await staleContext.newPage();
      await loginWithRealEmail(stalePage, adminEmail, adminPassword);
      const staleOverlay = await openLiveOrderCard(stalePage, created.id, orderNumber);
      await screenshot(stalePage, "04-live-card-data-desktop.png");

      const extraWorkAdd = adminOverlay.getByTestId("order-extra-work-add");
      await expectExactlyOneVisible(extraWorkAdd);
      const catalogSelect = extraWorkAdd.getByLabel("Katalogposition", { exact: true });
      await expect(catalogSelect).toHaveCount(1);
      await catalogSelect.selectOption({ label: catalogName });
      await fillExactlyOne(extraWorkAdd.getByLabel("Minuten", { exact: true }), "75");
      await clickExactlyOne(extraWorkAdd.getByRole("button", { name: "Hinzufügen", exact: true }));
      const addedExtraWorkLine = adminOverlay.getByTestId("order-extra-work-line").filter({ hasText: catalogName });
      await expectExactlyOneVisible(addedExtraWorkLine, { timeout: 30_000 });
      const addedMinutes = addedExtraWorkLine.getByLabel(`Minuten für ${catalogName}`, { exact: true });
      await expect(addedMinutes).toHaveCount(1);
      await expect(addedMinutes).toHaveValue("75");
      await screenshot(adminPage, "05-extra-work-receipt-readback.png");

      const staleFreezePanel = staleOverlay.getByTestId("order-freeze-panel");
      await expectExactlyOneVisible(staleFreezePanel);
      await clickExactlyOne(staleFreezePanel.getByRole("button", { name: "Auftrag fertigsetzen", exact: true }));
      await clickExactlyOne(staleFreezePanel.getByRole("button", { name: "Fertig verbindlich bestätigen", exact: true }));
      await expectExactlyOneVisible(staleFreezePanel.getByText("Auftrag wurde bereits geändert.", { exact: true }), { timeout: 30_000 });
      await screenshot(stalePage, "06-version-conflict.png");

      const readonlyPage = await test.step("F1.3 READONLY: Context und Page anlegen", async () => {
        const readonlyContext = await browser.newContext({ viewport: { width: 1024, height: 1366 } });
        contexts.push(readonlyContext);
        return readonlyContext.newPage();
      }, { timeout: 15_000 });

      await test.step("F1.3 READONLY: PIN-Login", async () => {
        await loginWithRealPin(readonlyPage, readonlyId, readonlyPin);
      }, { timeout: 15_000 });

      const readonlyOverlay = await test.step("F1.3 READONLY: Auftrag öffnen", async () => {
        return openLiveOrderCard(readonlyPage, created.id, orderNumber);
      }, { timeout: 15_000 });

      const readonlyFreezePanel = await test.step("F1.3 READONLY: Freeze-Panel lokalisieren", async () => {
        const panel = readonlyOverlay.getByTestId("order-freeze-panel");
        await expectExactlyOneVisible(panel);
        return panel;
      }, { timeout: 15_000 });

      await test.step("F1.3 READONLY: Abschlussdialog öffnen", async () => {
        await clickExactlyOne(readonlyFreezePanel.getByRole("button", { name: "Auftrag fertigsetzen", exact: true }));
      }, { timeout: 15_000 });

      await test.step("F1.3 READONLY: Bestätigung bestätigen und Denial lesen", async () => {
        await clickExactlyOne(readonlyFreezePanel.getByRole("button", { name: "Fertig verbindlich bestätigen", exact: true }));
        await expectExactlyOneVisible(readonlyFreezePanel.getByText("Fertig-Abschluss ist mit dieser Rolle nicht erlaubt.", { exact: true }), { timeout: 30_000 });
      }, { timeout: 15_000 });

      await test.step("F1.3 READONLY: Screenshot schreiben", async () => {
        await screenshot(readonlyPage, "07-readonly-denial.png");
      }, { timeout: 15_000 });

      const foreignContext = await browser.newContext();
      contexts.push(foreignContext);
      const foreignPage = await foreignContext.newPage();
      await submitRealEmailLogin(foreignPage, foreignEmail, foreignPassword);
      await foreignPage.waitForURL((url) => url.pathname === "/start" && url.searchParams.has("message"), { timeout: 30_000 });
      expect((await foreignContext.cookies()).some((cookie) => cookie.name === "kreile_app_session")).toBe(false);
      await screenshot(foreignPage, "08-foreign-tenant-denial.png");

      const missingContext = await browser.newContext();
      contexts.push(missingContext);
      const missingPage = await missingContext.newPage();
      await missingPage.goto("/warendurchlauf/galvanik");
      await missingPage.waitForURL((url) => url.pathname === "/start", { timeout: 30_000 });

      const manipulatedContext = await browser.newContext();
      contexts.push(manipulatedContext);
      await manipulatedContext.addCookies([{ name: "kreile_app_session", value: "manipulated", domain: "127.0.0.1", path: "/" }]);
      const manipulatedPage = await manipulatedContext.newPage();
      await manipulatedPage.goto("/warendurchlauf/galvanik");
      await manipulatedPage.waitForURL((url) => url.pathname === "/start", { timeout: 30_000 });

      const adminFreezePanel = adminOverlay.getByTestId("order-freeze-panel");
      await expectExactlyOneVisible(adminFreezePanel);
      await clickExactlyOne(adminFreezePanel.getByRole("button", { name: "Auftrag fertigsetzen", exact: true }));
      await clickExactlyOne(adminFreezePanel.getByRole("button", { name: "Fertig verbindlich bestätigen", exact: true }));
      await expectExactlyOneVisible(adminFreezePanel.getByText("Fertig-Abschluss und Mehrarbeits-Freeze bestätigt.", { exact: true }), { timeout: 30_000 });
      await expectExactlyOneVisible(adminFreezePanel.getByText("Fertig-Abschluss bestätigt", { exact: true }));
      await screenshot(adminPage, "09-freeze-confirmed.png");

      const frozen = await readOrder(sql, orderNumber);
      expect(frozen).toMatchObject({ station: "fertig", current_station: "fertig", current_station_id: "fertig", status: "fertig", version: 6 });
      expect(await readAccountingSnapshot(sql, created.id)).toEqual(accountingBefore);

      await adminPage.reload({ waitUntil: "domcontentloaded" });
      await expectExactlyOneVisible(
        adminPage.getByTestId("galvanik-galvanik-orders"),
        { timeout: 30_000 },
      );
      await clickExactlyOne(adminPage.getByTestId("galvanik-finished-tab"));
      const reloadedOverlay = await openOrderCardFromBucket(
        adminPage,
        created.id,
        orderNumber,
        "finished",
      );
      await expectExactlyOneVisible(reloadedOverlay.getByText("Fertig-Abschluss bestätigt", { exact: true }), { timeout: 30_000 });
      await expectExactlyOneVisible(reloadedOverlay.getByText(catalogName, { exact: true }));
      await expect(reloadedOverlay.getByRole("button", { name: "Auftrag fertigsetzen" })).toHaveCount(0);

      const correctionPanel = reloadedOverlay.getByTestId("order-freeze-correction-panel");
      await expectExactlyOneVisible(correctionPanel);
      await clickExactlyOne(correctionPanel.getByRole("button", { name: "Fertig-Abschluss korrigieren", exact: true }));
      await fillExactlyOne(correctionPanel.getByLabel("Begründung der Freeze-Korrektur", { exact: true }), "Fertigmeldung nach realer Werkstattprüfung korrigiert");
      await clickExactlyOne(correctionPanel.getByRole("button", { name: "Korrektur verbindlich ausführen", exact: true }));
      const reloadedFreezePanel = reloadedOverlay.getByTestId("order-freeze-panel");
      await expectExactlyOneVisible(reloadedFreezePanel, { timeout: 30_000 });
      await expectExactlyOneVisible(reloadedFreezePanel.getByRole("button", { name: "Auftrag fertigsetzen", exact: true }));
      const corrected = await readOrder(sql, orderNumber);
      expect(corrected).toMatchObject({ station: "galvanik", current_station: "galvanik", current_station_id: "galvanik", status: "galvanik", version: 7 });
      await screenshot(adminPage, "11-freeze-correction-confirmed.png");

      const extraWorkLine = reloadedOverlay.getByTestId("order-extra-work-line").filter({ hasText: catalogName });
      await expectExactlyOneVisible(extraWorkLine);
      await fillExactlyOne(extraWorkLine.getByLabel(`Minuten für ${catalogName}`, { exact: true }), "90");
      await clickExactlyOne(extraWorkLine.getByRole("button", { name: "Speichern", exact: true }));
      await expectExactlyOneVisible(extraWorkLine.getByText("Mehrarbeit bestätigt.", { exact: true }), { timeout: 30_000 });
      await clickExactlyOne(reloadedFreezePanel.getByRole("button", { name: "Auftrag fertigsetzen", exact: true }));
      await clickExactlyOne(reloadedFreezePanel.getByRole("button", { name: "Fertig verbindlich bestätigen", exact: true }));
      await expectExactlyOneVisible(reloadedFreezePanel.getByText("Fertig-Abschluss und Mehrarbeits-Freeze bestätigt.", { exact: true }), { timeout: 30_000 });
      const refrozen = await readOrder(sql, orderNumber);
      expect(refrozen).toMatchObject({ station: "fertig", current_station: "fertig", current_station_id: "fertig", status: "fertig", version: 9 });
      await screenshot(adminPage, "12-refreeze-confirmed.png");

      const correctionCountBeforeInvoice = await sql<{ count: number }[]>`
        SELECT count(*)::integer AS count
        FROM private.order_freeze_corrections
        WHERE tenant_id = ${TENANT} AND order_id = ${created.id}
      `;
      await sql`
        INSERT INTO public.invoices
          (id, tenant_id, customer_id, order_id, invoice_number, amount_total, status)
        VALUES
          (gen_random_uuid(), ${TENANT}, ${created.customer_id}, ${created.id}, ${`F1-3-${suffix}`}, 180.00, 'draft')
      `;
      await expectExactlyOneVisible(correctionPanel);
      await clickExactlyOne(correctionPanel.getByRole("button", { name: "Fertig-Abschluss korrigieren", exact: true }));
      await fillExactlyOne(correctionPanel.getByLabel("Begründung der Freeze-Korrektur", { exact: true }), "Korrektur nach Rechnung muss sicher blockieren");
      await clickExactlyOne(correctionPanel.getByRole("button", { name: "Korrektur verbindlich ausführen", exact: true }));
      await expectExactlyOneVisible(correctionPanel.getByText("Freeze kann nach Rechnungserstellung nicht korrigiert werden.", { exact: true }), { timeout: 30_000 });
      expect(await readOrder(sql, orderNumber)).toMatchObject({ station: "fertig", status: "fertig", version: 9 });
      const correctionCountAfterInvoice = await sql<{ count: number }[]>`
        SELECT count(*)::integer AS count
        FROM private.order_freeze_corrections
        WHERE tenant_id = ${TENANT} AND order_id = ${created.id}
      `;
      expect(correctionCountAfterInvoice).toEqual(correctionCountBeforeInvoice);
      await screenshot(adminPage, "13-invoice-conflict.png");

      await clickExactlyOne(reloadedOverlay.getByTestId("order-customer-trigger"));
      const customerOverlay = adminPage.getByTestId("live-customer-card");
      await expectExactlyOneVisible(customerOverlay, { timeout: 30_000 });
      await expectExactlyOneVisible(customerOverlay.getByText("1 Auftrag: Ware im Haus", { exact: true }), { timeout: 30_000 });
      const customerOrder = customerOverlay.getByTestId(`customer-order-${created.id}`);
      await expectExactlyOneVisible(customerOrder);
      await expect(customerOrder).toContainText(orderNumber);
      await screenshot(adminPage, "10-customer-ware-im-haus.png");

      const receipts = await sql<ReceiptRow[]>`
        SELECT id, event_type, client_event_id::text, correlation_id::text, aggregate_version, payload
        FROM public.events
        WHERE tenant_id = ${TENANT} AND order_id = ${created.id}
          AND event_type IN (
            'ORDER_TASK_ASSIGNED_V1',
            'ORDER_TASK_HANDED_BACK_V1',
            'ORDER_ITEM_EXTRA_WORK_CHANGED_V1',
            'ORDER_FROZEN_V1',
            'ORDER_FREEZE_CORRECTED_V1'
          )
        ORDER BY aggregate_version
      `;
      expect(receipts.map((receipt) => receipt.event_type)).toEqual([
        "ORDER_TASK_ASSIGNED_V1",
        "ORDER_TASK_HANDED_BACK_V1",
        "ORDER_ITEM_EXTRA_WORK_CHANGED_V1",
        "ORDER_FROZEN_V1",
        "ORDER_FREEZE_CORRECTED_V1",
        "ORDER_ITEM_EXTRA_WORK_CHANGED_V1",
        "ORDER_FROZEN_V1",
      ]);
      const { lastSeenReceipts, lastSeenStates } = await sql.begin(async (tx) => {
        await tx`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
        const receiptRows = await tx<LastSeenReceiptRow[]>`
          SELECT event_id, tenant_id, actor_id::text, client_event_id::text,
                 correlation_id::text, aggregate_version, last_seen_at, integrity_ok
          FROM private.v_user_last_seen_receipts_v1
          WHERE actor_id IN (${adminId}::uuid, ${readonlyId}::uuid, ${workshopId}::uuid)
          ORDER BY actor_id, aggregate_version
        `;
        const stateRows = await tx<LastSeenStateRow[]>`
          SELECT tenant_id, user_id::text, last_seen_at, version, integrity_ok
          FROM private.v_user_last_seen_v1
          WHERE user_id IN (${adminId}::uuid, ${readonlyId}::uuid, ${workshopId}::uuid)
          ORDER BY user_id
        `;
        return { lastSeenReceipts: receiptRows, lastSeenStates: stateRows };
      });
      const adminLastSeenReceipts = lastSeenReceipts.filter((receipt) => receipt.actor_id === adminId);
      const readonlyLastSeenReceipts = lastSeenReceipts.filter((receipt) => receipt.actor_id === readonlyId);
      const workshopLastSeenReceipts = lastSeenReceipts.filter((receipt) => receipt.actor_id === workshopId);
      expect(adminLastSeenReceipts.map((receipt) => receipt.aggregate_version)).toEqual([1, 2]);
      expect(readonlyLastSeenReceipts.map((receipt) => receipt.aggregate_version)).toEqual([1]);
      expect(workshopLastSeenReceipts.map((receipt) => receipt.aggregate_version)).toEqual([1]);
      for (const receipt of lastSeenReceipts) {
        expect(receipt).toMatchObject({ tenant_id: TENANT, integrity_ok: true });
        expect(receipt.event_id).not.toBe("");
        expect(receipt.client_event_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(receipt.correlation_id).toMatch(/^[0-9a-f-]{36}$/);
        expect(Number.isFinite(new Date(receipt.last_seen_at).getTime())).toBe(true);
      }
      expect(lastSeenStates).toHaveLength(3);
      for (const state of lastSeenStates) {
        const actorReceipts = lastSeenReceipts.filter((receipt) => receipt.actor_id === state.user_id);
        const latest = actorReceipts.at(-1);
        expect(state).toMatchObject({ tenant_id: TENANT, version: latest?.aggregate_version, integrity_ok: true });
        expect(new Date(state.last_seen_at).toISOString()).toBe(new Date(latest!.last_seen_at).toISOString());
      }

      const evidence = {
        orderId: created.id,
        orderNumber,
        writeReceipt: receipts[0],
        readbackReceipt: receipts.at(-1),
        lastSeenReceipts,
        lastSeenStates,
        lastSeenReplayProof: "src/test/f1_3_foundation_ports.integration.test.ts",
        finalVersion: refrozen.version,
        finalSource: "private.v_operational_station_queue_v1 + private.v_order_frozen_receipts_v1",
        negativeProof: {
          tenant: "FOREIGN_TENANT_AUTH_DENIED",
          role: "READONLY_FORBIDDEN_NO_WRITE",
          version: "STALE_VERSION_CONFLICT_NO_FREEZE",
          session: "MISSING_AND_MANIPULATED_UNAUTHENTICATED",
        },
      };
      await testInfo.attach("f1-3-real-receipts", {
        body: Buffer.from(JSON.stringify(evidence, null, 2), "utf8"),
        contentType: "application/json",
      });
      console.log(`F1_3_WRITE_RECEIPT=${receipts[0]?.id}:V${receipts[0]?.aggregate_version}:${receipts[0]?.correlation_id}`);
      console.log(`F1_3_READBACK_RECEIPT=${receipts.at(-1)?.id}:V${refrozen.version}:DATABASE`);
      console.log("F1_3_NEGATIVE_PROOF=TENANT,ROLE,VERSION,SESSION");
    } finally {
      for (const context of contexts.reverse()) {
        try {
          await context.close();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const alreadyClosed =
            message.includes("Target page, context or browser has been closed") ||
            message.includes("Browser has been closed") ||
            message.includes("Context has been closed") ||
            message.includes("Page has been closed");
          if (!alreadyClosed) {
            throw error;
          }
        }
      }
      await sql.end({ timeout: 5 });
    }
  });
});
