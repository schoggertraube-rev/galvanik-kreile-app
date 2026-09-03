import { devices, expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createPinLoginHandle } from "../src/lib/server/pinLoginHandle";

const TENANT = "galvanik-kreile";
const EVIDENCE_DIR = path.resolve(process.cwd(), "docs/evidence/f1/artifacts/f1-4");

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
};
type InvoiceRow = {
  id: string;
  invoice_number: string;
  status: string;
  aggregate_version: number;
  order_version: number;
  net_amount_cents: number;
  vat_rate_basis_points: number;
  vat_amount_cents: number;
  gross_amount_cents: number;
  service_date: string;
  pdf_sha256: string;
  pdf_content: Uint8Array;
  cancellation_pdf_sha256: string | null;
  cancellation_pdf_content: Uint8Array | null;
  cancel_reason: string | null;
};
type ReceiptRow = {
  event_id: string;
  event_type: "INVOICE_CREATED_V1" | "INVOICE_CANCELLED_V1";
  client_event_id: string;
  correlation_id: string;
  aggregate_version: number;
  invoice_id: string;
  invoice_number: string;
  pdf_sha256: string;
  integrity_ok: boolean;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`F1_4_E2E_ENV_MISSING:${name}`);
  return value;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const F1_4_MIN_CORE_CONTROL_PX = 48;

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

async function tapExactlyOne(locator: Locator) {
  await expect(locator).toHaveCount(1);
  await locator.tap();
}

// Fail-closed Groessenpruefung ausschliesslich fuer F1.4-eigene Kerncontrols.
// Keine Aussage ueber geteiltes App-Chrome, andere Routen oder physische Geraete.
async function expectF1_4CoreControlTouchTarget(name: string, locator: Locator) {
  await expectExactlyOneVisible(locator);
  const box = await locator.boundingBox();
  expect(box, `F1_4_CORE_CONTROL_BOX_MISSING:${name}`).not.toBeNull();
  expect(box?.width ?? 0, `F1_4_CORE_CONTROL_WIDTH:${name}`).toBeGreaterThanOrEqual(F1_4_MIN_CORE_CONTROL_PX);
  expect(box?.height ?? 0, `F1_4_CORE_CONTROL_HEIGHT:${name}`).toBeGreaterThanOrEqual(F1_4_MIN_CORE_CONTROL_PX);
}

async function expectRealContextProfile(
  page: Page,
  label: string,
  expected: { width: number; height: number },
) {
  expect(page.viewportSize(), `F1_4_CONTEXT_VIEWPORT:${label}`).toEqual({
    width: expected.width,
    height: expected.height,
  });
}

async function openRoute(page: Page, route: string) {
  await page.goto(route);
  await page.waitForURL((url) => url.pathname === route, { timeout: 30_000 });
}

async function screenshot(page: Page, filename: string) {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, filename), fullPage: true });
}

// Echter EMPTY-Zustand der Rechnungsroute vor der ersten Rechnungsstellung.
// Erzeugt bewusst keine zusaetzlichen Screenshots oder Dateien.
async function expectRealInvoiceEmptyState(page: Page) {
  await openRoute(page, "/buchhaltung/rechnungen");
  const emptyState = page.getByTestId("invoice-empty-state");
  await expectExactlyOneVisible(emptyState, { timeout: 30_000 });
  await expectExactlyOneVisible(
    emptyState.getByRole("heading", { name: "Noch keine Rechnungen ausgestellt", exact: true }),
  );
  await expectExactlyOneVisible(
    emptyState.getByText(
      "Fertiggestellte Aufträge können im Werkstattdurchlauf in Rechnung gestellt werden.",
      { exact: true },
    ),
  );
  expect(await page.locator('[data-testid^="invoice-row-"]').count()).toBe(0);
  await expectF1_4CoreControlTouchTarget(
    "invoice-empty-cta",
    emptyState.getByRole("link", { name: "Zum Werkstattdurchlauf", exact: true }),
  );
}

async function createRealLocalAuthUser(
  apiUrl: string,
  anonKey: string,
  email: string,
  password: string,
) {
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

async function submitRealEmailLogin(page: Page, email: string, password: string) {
  await page.goto("/start");
  await clickExactlyOne(page.getByRole("button", { name: "Administrator / E-Mail Login", exact: true }));
  const dialog = page.getByTestId("email-login-dialog");
  await expectExactlyOneVisible(dialog);
  await fillExactlyOne(dialog.locator("#email"), email);
  await fillExactlyOne(dialog.locator("#password"), password);
  await clickExactlyOne(dialog.getByRole("button", { name: "Einloggen", exact: true }));
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

async function createIntakeThroughRealUi(page: Page, suffix: string): Promise<string> {
  await openRoute(page, "/warendurchlauf/wareneingang");
  const createOrderCta = page.getByTestId("wareneingang-create-order");
  await expectExactlyOneVisible(createOrderCta, { timeout: 30_000 });
  await clickExactlyOne(createOrderCta);
  const intake = page.getByTestId("order-intake-modal");
  await expectExactlyOneVisible(intake);
  await expectExactlyOneVisible(intake.getByRole("heading", {
    name: "Digitaler Wareneingang",
    exact: true,
  }));
  await clickExactlyOne(intake.getByRole("button", { name: "Neu anlegen", exact: true }));
  await fillExactlyOne(intake.getByPlaceholder("Kundenname *", { exact: true }), "F1.4 Synthetischer Kunde");
  await fillExactlyOne(intake.getByPlaceholder("Firmenname", { exact: true }), "F1.4 Synthetischer Kunde GmbH");
  await fillExactlyOne(intake.getByPlaceholder("Ansprechperson", { exact: true }), "F1.4 Abnahme");
  await fillExactlyOne(intake.getByPlaceholder("Bezeichnung *", { exact: true }), `F1.4 Prüfteil ${suffix}`);
  await fillExactlyOne(intake.getByPlaceholder("Menge *", { exact: true }), "2");
  await fillExactlyOne(intake.getByPlaceholder("Werkstoff", { exact: true }), "Stahl");
  await fillExactlyOne(intake.getByPlaceholder("Oberfläche / Behandlung *", { exact: true }), "Verchromen");
  await fillExactlyOne(intake.getByLabel("Wunschtermin *", { exact: true }), "2026-09-30");
  await fillExactlyOne(intake.getByLabel("Interner Hinweis", { exact: true }), "F1.4 unveränderliche Rechnung");
  await clickExactlyOne(intake.getByRole("button", { name: "Wareneingang anlegen", exact: true }));

  const receiptHeading = intake.getByRole("heading", { name: /^A-\d{4}-\d+ bestätigt$/ });
  await expectExactlyOneVisible(receiptHeading, { timeout: 30_000 });
  const receiptText = (await receiptHeading.textContent())?.trim() ?? "";
  const match = /^(A-\d{4}-\d+) bestätigt$/.exec(receiptText);
  if (!match) throw new Error(`F1_4_INTAKE_RECEIPT_INVALID:${receiptText}`);
  await clickExactlyOne(intake.getByRole("button", { name: "Schließen", exact: true }));
  return match[1];
}

async function readOrder(sql: postgres.Sql, orderNumber: string): Promise<OrderRow> {
  const rows = await sql<OrderRow[]>`
    SELECT id, customer_id, order_number, station, current_station,
           current_station_id, status, version
    FROM public.orders
    WHERE tenant_id = ${TENANT} AND order_number = ${orderNumber}
  `;
  expect(rows).toHaveLength(1);
  return rows[0];
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

async function openGalvanikOrderCard(
  page: Page,
  orderId: string,
  orderNumber: string,
  bucket: "galvanik" | "finished",
) {
  await openRoute(page, "/warendurchlauf/galvanik");
  if (bucket === "finished") {
    const finishedTab = page.getByTestId("galvanik-finished-tab");
    await expectExactlyOneVisible(finishedTab, { timeout: 30_000 });
    await clickExactlyOne(finishedTab);
  }
  return openOrderCardFromBucket(page, orderId, orderNumber, bucket);
}

async function readPdf(page: Page, href: string) {
  const response = await page.request.get(new URL(href, page.url()).toString());
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/pdf");
  const bytes = await response.body();
  expect(bytes.byteLength).toBeGreaterThan(100);
  return Buffer.from(bytes);
}

test.describe("F1.4 unveränderliche Rechnung – realer Abnahmepfad", () => {
  test("belegt Freeze-Quelle, Ausgabe, Konflikt, Rollen, Storno, Originaltreue und Neuausstellung", async ({ browser }) => {
    test.setTimeout(420_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });

    const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const databaseUrl = requiredEnv("DATABASE_URL");
    const expectedApiUrl = requiredEnv("F1_4_EXPECTED_API_URL");
    const expectedDatabaseUrl = requiredEnv("F1_4_EXPECTED_DATABASE_URL");
    requiredEnv("APP_SESSION_SECRET");
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    expect(apiUrl).toBe(expectedApiUrl);
    expect(databaseUrl).toBe(expectedDatabaseUrl);
    expect(apiUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(databaseUrl).toMatch(/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/);

    const suffix = `${Date.now()}-${process.pid}`;
    const foreignTenant = `f1-4-foreign-${suffix}`;
    const adminEmail = `f1-4-admin-${suffix}@local.test`;
    const officeEmail = `f1-4-office-${suffix}@local.test`;
    const readonlyEmail = `f1-4-readonly-${suffix}@local.test`;
    const foreignEmail = `f1-4-foreign-${suffix}@local.test`;
    const adminPassword = `F1.4-Admin-${suffix}!`;
    const officePassword = `F1.4-Office-${suffix}!`;
    const readonlyPassword = `F1.4-Readonly-${suffix}!`;
    const foreignPassword = `F1.4-Foreign-${suffix}!`;
    const officePin = "4173";
    const readonlyPin = "8259";
    const rateId = randomUUID();
    const cancelReason = "Doppelte Berechnung vollständig storniert";
    const contexts: BrowserContext[] = [];
    const sql = postgres(databaseUrl, { max: 2, prepare: false });

    try {
      const [initialState] = await sql<{
        settings_count: number;
        invoice_count: number;
        order_count: number;
      }[]>`
        SELECT
          (SELECT count(*)::integer FROM public.company_settings) AS settings_count,
          (SELECT count(*)::integer FROM public.invoices) AS invoice_count,
          (SELECT count(*)::integer FROM public.orders) AS order_count
      `;
      expect(initialState).toEqual({ settings_count: 0, invoice_count: 0, order_count: 0 });

      const adminId = await createRealLocalAuthUser(apiUrl, anonKey, adminEmail, adminPassword);
      const officeId = await createRealLocalAuthUser(apiUrl, anonKey, officeEmail, officePassword);
      const readonlyId = await createRealLocalAuthUser(apiUrl, anonKey, readonlyEmail, readonlyPassword);
      const foreignId = await createRealLocalAuthUser(apiUrl, anonKey, foreignEmail, foreignPassword);
      const officePinHash = await bcrypt.hash(officePin, 12);
      const readonlyPinHash = await bcrypt.hash(readonlyPin, 12);

      await sql.begin(async (transaction) => {
        await transaction`
          INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active)
          VALUES
            (${adminId}::uuid, ${TENANT}, ${adminEmail}, 'F1.4 E2E Admin', 'admin', NULL, true),
            (${officeId}::uuid, ${TENANT}, ${officeEmail}, 'F1.4 E2E Büro', 'buero', ${officePinHash}, true),
            (${readonlyId}::uuid, ${TENANT}, ${readonlyEmail}, 'F1.4 E2E Readonly', 'readonly', ${readonlyPinHash}, true),
            (${foreignId}::uuid, ${foreignTenant}, ${foreignEmail}, 'F1.4 E2E Foreign', 'admin', NULL, true)
        `;
        await transaction`
          INSERT INTO public.company_settings (
            id, tenant_id, company_name, street, zip, city, country,
            iban, bic, bank_name, tax_id, invoice_vat_rate_basis_points,
            invoice_payment_term_days
          ) VALUES (
            ${`f1-4-e2e-${suffix}`}, ${TENANT}, 'F1.4 Synthetische Galvanik GmbH',
            'Testweg 1', '70173', 'Stuttgart', 'Deutschland',
            'DE02120300000000202051', 'BYLADEM1001', 'F1.4 Testbank',
            'DE-SYNTHETIC-TAX', 1900, 14
          )
        `;
        await transaction`
          INSERT INTO private.extra_work_hourly_rates (
            id, tenant_id, hourly_rate_cents, version, created_by, effective_at
          ) VALUES (${rateId}::uuid, ${TENANT}, 12000, 1, ${adminId}::uuid, now())
        `;
      });

      const adminContext = await browser.newContext({
        ...devices["iPad Pro 11"],
        viewport: { width: 1024, height: 1366 },
      });
      contexts.push(adminContext);
      const adminPage = await adminContext.newPage();
      await loginWithRealEmail(adminPage, adminEmail, adminPassword);
      await expectRealContextProfile(adminPage, "admin-tablet-touch", {
        width: 1024,
        height: 1366,
      });
      await expectRealInvoiceEmptyState(adminPage);

      const orderNumber = await createIntakeThroughRealUi(adminPage, suffix);
      const createdOrder = await readOrder(sql, orderNumber);
      expect(createdOrder).toMatchObject({
        station: "wareneingang",
        current_station: "wareneingang",
        current_station_id: "wareneingang",
        status: "angenommen",
        version: 1,
      });
      const orderId = createdOrder.id;
      const customerId = createdOrder.customer_id;

      await sql.begin(async (transaction) => {
        await transaction`
          UPDATE public.customers
          SET company_name = 'F1.4 Synthetischer Kunde GmbH',
              street = 'Kundenweg 2',
              zip_code = '70174',
              city = 'Stuttgart',
              country = 'Deutschland',
              updated_at = now()
          WHERE tenant_id = ${TENANT} AND id = ${customerId}
        `;
        await transaction`
          UPDATE public.items
          SET preis_netto = 50.00
          WHERE tenant_id = ${TENANT} AND order_id = ${orderId}
        `;
      });

      await openRoute(adminPage, "/warendurchlauf/wareneingang");
      const intakeOrderRow = adminPage.getByTestId(`wareneingang-order-${orderId}`);
      await expectExactlyOneVisible(intakeOrderRow, { timeout: 30_000 });
      await expectExactlyOneVisible(intakeOrderRow.getByText(orderNumber, { exact: true }));
      const handoffControl = intakeOrderRow.getByTestId("wareneingang-handoff");
      await expectExactlyOneVisible(handoffControl);
      await clickExactlyOne(handoffControl.getByRole("button", {
        name: "An Galvanik übergeben",
        exact: true,
      }));
      await expectExactlyOneVisible(
        adminPage.getByTestId("wareneingang-handoff-status"),
        { timeout: 30_000 },
      );
      const handedOffOrder = await readOrder(sql, orderNumber);
      expect(handedOffOrder).toMatchObject({
        id: orderId,
        customer_id: customerId,
        station: "galvanik",
        current_station: "galvanik",
        current_station_id: "galvanik",
        status: "galvanik",
        version: 2,
      });

      const adminOverlay = await openGalvanikOrderCard(adminPage, orderId, orderNumber, "galvanik");
      const freezePanel = adminOverlay.getByTestId("order-freeze-panel");
      await expectExactlyOneVisible(freezePanel);
      await clickExactlyOne(freezePanel.getByRole("button", { name: "Auftrag fertigsetzen", exact: true }));
      await clickExactlyOne(freezePanel.getByRole("button", { name: "Fertig verbindlich bestätigen", exact: true }));
      await expectExactlyOneVisible(
        freezePanel.getByText("Fertig-Abschluss und Mehrarbeits-Freeze bestätigt.", { exact: true }),
        { timeout: 30_000 },
      );
      const adminInvoicePanel = adminOverlay.getByTestId("order-immutable-invoice-panel");
      await expectExactlyOneVisible(adminInvoicePanel, { timeout: 30_000 });
      const adminIssueButton = adminInvoicePanel.getByRole("button", {
        name: "Unveränderliche Rechnung ausstellen",
        exact: true,
      });
      await expectF1_4CoreControlTouchTarget("order-invoice-issue-admin", adminIssueButton);
      await screenshot(adminPage, "01-final-freeze-source.png");

      const sourceRows = await sql.begin(async (transaction) => {
        await transaction`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
        return transaction<{
          order_id: string;
          current_order_version: number;
          service_date: string;
          seller_config_complete: boolean;
          customer_config_complete: boolean;
          base_prices_complete: boolean;
          no_active_invoice: boolean;
          integrity_ok: boolean;
        }[]>`
          SELECT order_id, current_order_version, frozen_at::date::text AS service_date,
                 seller_config_complete, customer_config_complete,
                 base_prices_complete, no_active_invoice, integrity_ok
          FROM private.v_invoice_issue_source_v1
          WHERE order_id = ${orderId}
        `;
      });
      expect(sourceRows).toEqual([expect.objectContaining({
        order_id: orderId,
        current_order_version: 3,
        seller_config_complete: true,
        customer_config_complete: true,
        base_prices_complete: true,
        no_active_invoice: true,
        integrity_ok: true,
      })]);
      const serviceDate = sourceRows[0]?.service_date;
      expect(serviceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

      const officeContext = await browser.newContext({
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
      });
      contexts.push(officeContext);
      const officePage = await officeContext.newPage();
      await loginWithRealPin(officePage, officeId, officePin);
      await expectRealContextProfile(officePage, "office-desktop-pointer", {
        width: 1440,
        height: 900,
      });
      await expectRealInvoiceEmptyState(officePage);
      const officeOverlay = await openGalvanikOrderCard(officePage, orderId, orderNumber, "finished");
      const officeInvoicePanel = officeOverlay.getByTestId("order-immutable-invoice-panel");
      await expectExactlyOneVisible(officeInvoicePanel);
      const officeIssueButton = officeInvoicePanel.getByRole("button", {
        name: "Unveränderliche Rechnung ausstellen",
        exact: true,
      });
      await expectF1_4CoreControlTouchTarget("order-invoice-issue-office", officeIssueButton);
      await clickExactlyOne(officeIssueButton);
      await expectExactlyOneVisible(
        officeInvoicePanel.getByRole("status").getByText("Rechnung wurde unveränderlich ausgestellt.", { exact: true }),
        { timeout: 30_000 },
      );
      const issuedLabel = officeInvoicePanel.getByText(/^Rechnung R-\d{4}-\d+ ausgestellt$/);
      await expectExactlyOneVisible(issuedLabel);
      const issuedText = (await issuedLabel.textContent())?.trim() ?? "";
      const issuedMatch = /^Rechnung (R-\d{4}-\d+) ausgestellt$/.exec(issuedText);
      if (!issuedMatch) throw new Error(`F1_4_INVOICE_LABEL_INVALID:${issuedText}`);
      const firstInvoiceNumber = issuedMatch[1];
      const originalLink = officeInvoicePanel.getByTestId("order-immutable-invoice-pdf-link");
      await expectF1_4CoreControlTouchTarget("order-invoice-pdf-link", originalLink);
      const originalHref = await originalLink.getAttribute("href");
      if (!originalHref) throw new Error("F1_4_ORIGINAL_PDF_HREF_MISSING");
      const invoiceIdMatch = /^\/api\/invoices\/([0-9a-f-]+)\/pdf$/.exec(originalHref);
      if (!invoiceIdMatch) throw new Error(`F1_4_ORIGINAL_PDF_HREF_INVALID:${originalHref}`);
      const firstInvoiceId = invoiceIdMatch[1];
      const originalPdf = await readPdf(officePage, originalHref);
      const originalPdfSha256 = sha256(originalPdf);
      await screenshot(officePage, "02-issued-receipt-and-pdf.png");

      const [issuedRow] = await sql<InvoiceRow[]>`
        SELECT id::text, invoice_number, status, aggregate_version, order_version,
               net_amount_cents, vat_rate_basis_points, vat_amount_cents,
               gross_amount_cents, service_date::text, pdf_sha256, pdf_content,
               cancellation_pdf_sha256, cancellation_pdf_content, cancel_reason
        FROM public.invoices
        WHERE tenant_id = ${TENANT} AND id = ${firstInvoiceId}::uuid
      `;
      expect(issuedRow).toMatchObject({
        id: firstInvoiceId,
        invoice_number: firstInvoiceNumber,
        status: "issued",
        aggregate_version: 1,
        order_version: 3,
        net_amount_cents: 10000,
        vat_rate_basis_points: 1900,
        vat_amount_cents: 1900,
        gross_amount_cents: 11900,
        service_date: serviceDate,
        pdf_sha256: originalPdfSha256,
        cancellation_pdf_sha256: null,
        cancellation_pdf_content: null,
        cancel_reason: null,
      });
      expect(Buffer.from(issuedRow?.pdf_content ?? []).equals(originalPdf)).toBe(true);

      const liveCustomerName = "F1.4 geänderter Live-Kunde";
      await sql.begin(async (transaction) => {
        await transaction`
          UPDATE public.customers
          SET name = ${liveCustomerName}, company_name = ${liveCustomerName}, updated_at = now()
          WHERE tenant_id = ${TENANT} AND id = ${customerId}
        `;
      });

      await tapExactlyOne(adminIssueButton);
      await expectExactlyOneVisible(
        adminInvoicePanel.getByRole("status").getByText(
          "Für diesen Auftrag besteht bereits eine aktive Rechnung.",
          { exact: true },
        ),
        { timeout: 30_000 },
      );
      const [conflictCounts] = await sql<{ invoice_count: number; event_count: number }[]>`
        SELECT
          (SELECT count(*)::integer FROM public.invoices
           WHERE tenant_id = ${TENANT} AND order_id = ${orderId}) AS invoice_count,
          (SELECT count(*)::integer FROM public.events
           WHERE tenant_id = ${TENANT} AND order_id = ${orderId}
             AND event_type = 'INVOICE_CREATED_V1') AS event_count
      `;
      expect(conflictCounts).toEqual({ invoice_count: 1, event_count: 1 });
      await screenshot(adminPage, "03-active-invoice-conflict.png");

      await openRoute(officePage, "/buchhaltung/rechnungen");
      const officeInvoiceRow = officePage.getByTestId(`invoice-row-${firstInvoiceNumber}`);
      await expectExactlyOneVisible(officeInvoiceRow, { timeout: 30_000 });
      await expectExactlyOneVisible(officeInvoiceRow.getByText("Ausgestellt", { exact: true }));
      await expectExactlyOneVisible(officeInvoiceRow.getByText(
        `F1.4 Synthetischer Kunde GmbH · Auftrag ${orderNumber}`,
        { exact: true },
      ));
      expect(await officeInvoiceRow.getByText(
        `${liveCustomerName} · Auftrag ${orderNumber}`,
        { exact: true },
      ).count()).toBe(0);
      await expectF1_4CoreControlTouchTarget(
        "invoice-original-pdf-office",
        officeInvoiceRow.getByTestId(`invoice-original-pdf-${firstInvoiceNumber}`),
      );
      await expectF1_4CoreControlTouchTarget(
        "invoice-open-order-office",
        officeInvoiceRow.getByRole("link", { name: "Auftrag öffnen", exact: true }),
      );
      const originalAfterLiveMutationHref = await officeInvoiceRow
        .getByTestId(`invoice-original-pdf-${firstInvoiceNumber}`)
        .getAttribute("href");
      if (!originalAfterLiveMutationHref) throw new Error("F1_4_ORIGINAL_PDF_AFTER_LIVE_MUTATION_MISSING");
      const originalAfterLiveMutation = await readPdf(officePage, originalAfterLiveMutationHref);
      expect(originalAfterLiveMutation.equals(originalPdf)).toBe(true);
      expect(sha256(originalAfterLiveMutation)).toBe(originalPdfSha256);
      expect(await officeInvoiceRow.getByRole("button", { name: "Rechnung stornieren", exact: true }).count()).toBe(0);
      await screenshot(officePage, "04-office-list-no-cancel.png");

      await openRoute(adminPage, "/buchhaltung/rechnungen");
      const adminInvoiceRow = adminPage.getByTestId(`invoice-row-${firstInvoiceNumber}`);
      await expectExactlyOneVisible(adminInvoiceRow, { timeout: 30_000 });
      const adminCancelReasonInput = adminInvoiceRow.getByLabel("Stornogrund", { exact: true });
      await expectF1_4CoreControlTouchTarget("invoice-cancel-reason-input", adminCancelReasonInput);
      await fillExactlyOne(adminCancelReasonInput, cancelReason);
      const adminCancelButton = adminInvoiceRow.getByRole("button", { name: "Rechnung stornieren", exact: true });
      await expectF1_4CoreControlTouchTarget("invoice-cancel-submit", adminCancelButton);
      await tapExactlyOne(adminCancelButton);

      const cancelSuccessStatus = adminPage.getByRole("status").filter({
        hasText: /^(Storno und Readback sind bestätigt\.|Storno war bereits bestätigt\.)$/,
      });
      const cancelAlerts = adminPage
        .getByTestId("immutable-invoice-page")
        .getByRole("alert")
        .filter({ hasText: /\S/ });
      const cancelRowStorniert = adminInvoiceRow.getByText("Storniert", { exact: true });

      await expect
        .poll(
          async () => {
            const [successCount, alertCount, storniertCount] = await Promise.all([
              cancelSuccessStatus.count(),
              cancelAlerts.count(),
              cancelRowStorniert.count(),
            ]);
            return successCount > 0 || alertCount > 0 || storniertCount > 0;
          },
          { timeout: 30_000 },
        )
        .toBe(true);

      const cancelAlertTexts = await cancelAlerts.allTextContents();
      if (cancelAlertTexts.length > 0) {
        const cancelStatusTexts = await adminPage.getByRole("status").allTextContents();
        const cancelRowCount = await adminInvoiceRow.count();
        throw new Error(
          `F1_4_CANCEL_TERMINAL_ALERT:alerts=${JSON.stringify(cancelAlertTexts)}:statuses=${JSON.stringify(cancelStatusTexts)}:rowCount=${cancelRowCount}`,
        );
      }

      await adminPage.reload();
      await adminPage.waitForURL((url) => url.pathname === "/buchhaltung/rechnungen", { timeout: 30_000 });
      const adminInvoiceRowAfterCancel = adminPage.getByTestId(`invoice-row-${firstInvoiceNumber}`);

      try {
        await expectExactlyOneVisible(adminInvoiceRowAfterCancel, { timeout: 30_000 });
        await expectExactlyOneVisible(adminInvoiceRowAfterCancel.getByText("Storniert", { exact: true }));
        await expectExactlyOneVisible(adminInvoiceRowAfterCancel.getByText(`Stornogrund: ${cancelReason}`, { exact: true }));
        expect(await adminInvoiceRowAfterCancel
          .getByRole("button", { name: "Rechnung stornieren", exact: true })
          .count()).toBe(0);
        await expectExactlyOneVisible(adminInvoiceRowAfterCancel.getByTestId(`invoice-original-pdf-${firstInvoiceNumber}`));
        await expectExactlyOneVisible(adminInvoiceRowAfterCancel.getByTestId(`invoice-cancellation-pdf-${firstInvoiceNumber}`));
      } catch (error) {
        const alertTexts = await adminPage
          .getByTestId("immutable-invoice-page")
          .getByRole("alert")
          .allTextContents();
        const statusTexts = await adminPage.getByRole("status").allTextContents();
        const rowCount = await adminInvoiceRowAfterCancel.count();
        throw new Error(
          `F1_4_CANCEL_READBACK_UNSTABLE:alerts=${JSON.stringify(alertTexts)}:statuses=${JSON.stringify(statusTexts)}:rowCount=${rowCount}:cause=${(error as Error).message}`,
        );
      }

      await expectF1_4CoreControlTouchTarget(
        "invoice-original-pdf-admin",
        adminInvoiceRowAfterCancel.getByTestId(`invoice-original-pdf-${firstInvoiceNumber}`),
      );
      await expectF1_4CoreControlTouchTarget(
        "invoice-cancellation-pdf-admin",
        adminInvoiceRowAfterCancel.getByTestId(`invoice-cancellation-pdf-${firstInvoiceNumber}`),
      );
      await expectF1_4CoreControlTouchTarget(
        "invoice-open-order-admin",
        adminInvoiceRowAfterCancel.getByRole("link", { name: "Auftrag öffnen", exact: true }),
      );
      const originalListHref = await adminInvoiceRowAfterCancel
        .getByTestId(`invoice-original-pdf-${firstInvoiceNumber}`)
        .getAttribute("href");
      const cancellationHref = await adminInvoiceRowAfterCancel
        .getByTestId(`invoice-cancellation-pdf-${firstInvoiceNumber}`)
        .getAttribute("href");
      if (!originalListHref || !cancellationHref) throw new Error("F1_4_CANCELLED_PDF_LINK_MISSING");
      const originalAfterCancel = await readPdf(adminPage, originalListHref);
      const cancellationPdf = await readPdf(adminPage, cancellationHref);
      expect(originalAfterCancel.equals(originalPdf)).toBe(true);
      expect(sha256(originalAfterCancel)).toBe(originalPdfSha256);
      expect(sha256(cancellationPdf)).not.toBe(originalPdfSha256);
      await screenshot(adminPage, "05-cancellation-readback-and-pdfs.png");

      const [cancelledRow] = await sql<InvoiceRow[]>`
        SELECT id::text, invoice_number, status, aggregate_version, order_version,
               net_amount_cents, vat_rate_basis_points, vat_amount_cents,
               gross_amount_cents, service_date::text, pdf_sha256, pdf_content,
               cancellation_pdf_sha256, cancellation_pdf_content, cancel_reason
        FROM public.invoices
        WHERE tenant_id = ${TENANT} AND id = ${firstInvoiceId}::uuid
      `;
      expect(cancelledRow).toMatchObject({
        id: firstInvoiceId,
        invoice_number: firstInvoiceNumber,
        status: "cancelled",
        aggregate_version: 2,
        order_version: 3,
        pdf_sha256: originalPdfSha256,
        cancellation_pdf_sha256: sha256(cancellationPdf),
        cancel_reason: cancelReason,
      });
      expect(Buffer.from(cancelledRow?.pdf_content ?? []).equals(originalPdf)).toBe(true);
      expect(Buffer.from(cancelledRow?.cancellation_pdf_content ?? []).equals(cancellationPdf)).toBe(true);

      const receiptRows = await sql.begin(async (transaction) => {
        await transaction`SELECT set_config('app.tenant_id', ${TENANT}, true)`;
        return transaction<ReceiptRow[]>`
          SELECT event_id, event_type, client_event_id::text, correlation_id::text,
                 aggregate_version, invoice_id::text, invoice_number, pdf_sha256,
                 integrity_ok
          FROM private.v_invoice_receipt_v1
          WHERE invoice_id = ${firstInvoiceId}::uuid
          ORDER BY aggregate_version
        `;
      });
      expect(receiptRows).toHaveLength(2);
      expect(receiptRows.map((receipt) => ({
        eventType: receipt.event_type,
        version: receipt.aggregate_version,
        integrity: receipt.integrity_ok,
      }))).toEqual([
        { eventType: "INVOICE_CREATED_V1", version: 1, integrity: true },
        { eventType: "INVOICE_CANCELLED_V1", version: 2, integrity: true },
      ]);
      expect(receiptRows[0]?.pdf_sha256).toBe(originalPdfSha256);
      expect(receiptRows[1]?.pdf_sha256).toBe(sha256(cancellationPdf));

      const readonlyContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
      contexts.push(readonlyContext);
      const readonlyPage = await readonlyContext.newPage();
      await loginWithRealPin(readonlyPage, readonlyId, readonlyPin);
      await openRoute(readonlyPage, "/buchhaltung/rechnungen");
      await expectExactlyOneVisible(
        readonlyPage.getByRole("alert").getByText(
          "Rechnungsliste ist mit dieser Rolle nicht erlaubt.",
          { exact: true },
        ),
      );
      expect(await readonlyPage.getByText(firstInvoiceNumber, { exact: true }).count()).toBe(0);
      await screenshot(readonlyPage, "06-readonly-denial.png");
      await readonlyContext.close();
      contexts.splice(contexts.indexOf(readonlyContext), 1);

      const foreignContext = await browser.newContext({ viewport: { width: 1024, height: 768 } });
      contexts.push(foreignContext);
      const foreignPage = await foreignContext.newPage();
      await submitRealEmailLogin(foreignPage, foreignEmail, foreignPassword);
      await foreignPage.waitForURL((url) => url.pathname === "/start" && url.searchParams.has("message"), { timeout: 30_000 });
      expect((await foreignContext.cookies()).some((cookie) => cookie.name === "kreile_app_session")).toBe(false);
      expect(await foreignPage.getByText(firstInvoiceNumber, { exact: true }).count()).toBe(0);
      await screenshot(foreignPage, "07-foreign-tenant-denial.png");
      await foreignContext.close();
      contexts.splice(contexts.indexOf(foreignContext), 1);

      const reissueOverlay = await openGalvanikOrderCard(officePage, orderId, orderNumber, "finished");
      const reissuePanel = reissueOverlay.getByTestId("order-immutable-invoice-panel");
      await clickExactlyOne(reissuePanel.getByRole("button", {
        name: "Unveränderliche Rechnung ausstellen",
        exact: true,
      }));
      const reissuedLabel = reissuePanel.getByText(/^Rechnung R-\d{4}-\d+ ausgestellt$/);
      await expectExactlyOneVisible(reissuedLabel, { timeout: 30_000 });
      const reissuedText = (await reissuedLabel.textContent())?.trim() ?? "";
      const reissuedMatch = /^Rechnung (R-\d{4}-\d+) ausgestellt$/.exec(reissuedText);
      if (!reissuedMatch) throw new Error(`F1_4_REISSUE_LABEL_INVALID:${reissuedText}`);
      const secondInvoiceNumber = reissuedMatch[1];
      const firstParts = firstInvoiceNumber.split("-");
      const secondParts = secondInvoiceNumber.split("-");
      expect(secondParts.slice(0, 2)).toEqual(firstParts.slice(0, 2));
      expect(Number(secondParts[2])).toBe(Number(firstParts[2]) + 1);

      await openRoute(officePage, "/buchhaltung/rechnungen");
      const firstListRow = officePage.getByTestId(`invoice-row-${firstInvoiceNumber}`);
      const secondListRow = officePage.getByTestId(`invoice-row-${secondInvoiceNumber}`);
      await expectExactlyOneVisible(firstListRow, { timeout: 30_000 });
      await expectExactlyOneVisible(secondListRow, { timeout: 30_000 });
      await expectExactlyOneVisible(firstListRow.getByText("Storniert", { exact: true }));
      await expectExactlyOneVisible(secondListRow.getByText("Ausgestellt", { exact: true }));
      await expectExactlyOneVisible(firstListRow.getByText(
        `F1.4 Synthetischer Kunde GmbH · Auftrag ${orderNumber}`,
        { exact: true },
      ));
      await expectExactlyOneVisible(secondListRow.getByText(
        `${liveCustomerName} · Auftrag ${orderNumber}`,
        { exact: true },
      ));
      await screenshot(officePage, "08-gapless-reissue-readback.png");

      const finalInvoices = await sql<{
        id: string;
        invoice_number: string;
        status: string;
        pdf_sha256: string;
      }[]>`
        SELECT id::text, invoice_number, status, pdf_sha256
        FROM public.invoices
        WHERE tenant_id = ${TENANT} AND order_id = ${orderId}
        ORDER BY invoice_number
      `;
      expect(finalInvoices).toEqual([
        expect.objectContaining({ id: firstInvoiceId, invoice_number: firstInvoiceNumber, status: "cancelled", pdf_sha256: originalPdfSha256 }),
        expect.objectContaining({ invoice_number: secondInvoiceNumber, status: "issued" }),
      ]);

      writeFileSync(
        path.join(EVIDENCE_DIR, "f1-4-real-e2e-receipt.json"),
        `${JSON.stringify({
          realE2ePath: "local Supabase -> real Auth/tenant roles -> final F1.3 freeze -> createInvoice -> stored PDF -> live source mutation -> immutable snapshot readback -> cancelInvoice -> stored cancellation PDF -> original byte equality -> reissue",
          orderId,
          orderNumber,
          liveCustomerName,
          serviceDate,
          firstInvoice: {
            id: firstInvoiceId,
            number: firstInvoiceNumber,
            originalPdfSha256,
            cancellationPdfSha256: cancelledRow?.cancellation_pdf_sha256,
          },
          secondInvoice: finalInvoices[1],
          receipts: receiptRows,
          negativeProof: {
            activeInvoiceConflict: "PASS_NO_SECOND_WRITE",
            officeCancellationControl: "ABSENT",
            readonly: "DENIAL_NO_DATA",
            foreignTenant: "DENIAL_NO_APP_SESSION",
          },
          productionPathMocks: "NONE",
          acceptancePathMocks: "NONE",
        }, null, 2)}\n`,
        "utf8",
      );
    } finally {
      for (const context of [...contexts].reverse()) {
        await context.close().catch(() => undefined);
      }
      await sql.end({ timeout: 1 });
    }
  });
});
