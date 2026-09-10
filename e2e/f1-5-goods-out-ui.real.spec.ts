import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createPinLoginHandle } from "../src/lib/server/pinLoginHandle";

const TENANT = "galvanik-kreile";
const EVIDENCE_DIR = path.resolve(process.cwd(), "docs/evidence/f1/artifacts/f1-5");

type AuthSignupResponse = { user?: { id?: string }; message?: string };
type PaymentMode = "vorkasse" | "abholung" | "rechnung";
type OrderRow = { id: string; customer_id: string; order_number: string; version: number };

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`F1_5_D_E2E_ENV_MISSING:${name}`);
  return value;
}

function sha256File(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function expectOne(locator: Locator, timeout = 30_000) {
  await expect(locator).toHaveCount(1, { timeout });
  await expect(locator).toBeVisible({ timeout });
}

async function openRoute(page: Page, route: string) {
  await page.goto(route);
  await page.waitForURL((url) => url.pathname === route, { timeout: 30_000 });
}

async function createAuthUser(apiUrl: string, anonKey: string, email: string, password: string) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as AuthSignupResponse;
  if (!response.ok || typeof body.user?.id !== "string") {
    throw new Error(`F1_5_D_AUTH_SIGNUP_FAILED:${response.status}:${body.message ?? "invalid"}`);
  }
  return body.user.id;
}

async function loginEmail(page: Page, email: string, password: string) {
  await page.goto("/start");
  await page.getByRole("button", { name: "Administrator / E-Mail Login", exact: true }).click();
  const dialog = page.getByTestId("email-login-dialog");
  await dialog.locator("#email").fill(email);
  await dialog.locator("#password").fill(password);
  await dialog.getByRole("button", { name: "Einloggen", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/warendurchlauf", { timeout: 30_000 });
  expect((await page.context().cookies()).some((cookie) => cookie.name === "kreile_app_session")).toBe(true);
}

async function loginPin(page: Page, userId: string, pin: string) {
  await page.goto("/start");
  await page.getByTestId(`pin-user-card-${createPinLoginHandle(userId)}`).click();
  const dialog = page.getByTestId("pin-login-dialog");
  for (const digit of pin) await dialog.getByRole("button", { name: digit, exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/warendurchlauf", { timeout: 30_000 });
}

async function createIntake(page: Page, label: string): Promise<string> {
  await openRoute(page, "/warendurchlauf/wareneingang");
  await page.getByTestId("wareneingang-create-order").click();
  const modal = page.getByTestId("order-intake-modal");
  await expectOne(modal);
  await modal.getByRole("button", { name: "Neu anlegen", exact: true }).click();
  await modal.getByPlaceholder("Kundenname *", { exact: true }).fill(`F1.5-D ${label}`);
  await modal.getByPlaceholder("Firmenname", { exact: true }).fill(`F1.5-D ${label} GmbH`);
  await modal.getByPlaceholder("Ansprechperson", { exact: true }).fill("Lokale Abnahme");
  await modal.getByPlaceholder("Bezeichnung *", { exact: true }).fill(`Synthetisches Prüfteil ${label}`);
  await modal.getByPlaceholder("Menge *", { exact: true }).fill("1");
  await modal.getByPlaceholder("Werkstoff", { exact: true }).fill("Stahl");
  await modal.getByPlaceholder("Oberfläche / Behandlung *", { exact: true }).fill("Verzinken");
  await modal.getByLabel("Wunschtermin *", { exact: true }).fill("2026-09-30");
  await modal.getByLabel("Interner Hinweis", { exact: true }).fill(`F1.5-D REAL E2E ${label}`);
  await modal.getByRole("button", { name: "Wareneingang anlegen", exact: true }).click();
  const heading = modal.getByRole("heading", { name: /^A-\d{4}-\d+ bestätigt$/ });
  await expectOne(heading);
  const match = /^(A-\d{4}-\d+) bestätigt$/.exec((await heading.textContent())?.trim() ?? "");
  if (!match) throw new Error("F1_5_D_INTAKE_RECEIPT_INVALID");
  await modal.getByRole("button", { name: "Schließen", exact: true }).click();
  return match[1];
}

async function setFixturePaymentMode(
  sql: postgres.Sql,
  orderId: string,
  actorId: string,
  paymentMode: Exclude<PaymentMode, "vorkasse">,
) {
  const clientEventId = randomUUID();
  const correlationId = randomUUID();
  const occurredAt = new Date().toISOString();
  await sql.begin(async (transaction) => {
    await transaction`SELECT set_config('app.payment_mode_command', 'v1', true)`;
    await transaction`
      UPDATE public.orders
      SET payment_mode = ${paymentMode}, payment_mode_version = 1
      WHERE tenant_id = ${TENANT} AND id = ${orderId}
        AND payment_mode = 'vorkasse' AND payment_mode_version = 0
    `;
    await transaction`
      INSERT INTO public.events (
        id, tenant_id, order_id, item_id, event_type, description, user_id,
        payload, status, station, client_event_id, event_schema_version,
        correlation_id, aggregate_version, from_station, created_at
      ) VALUES (
        gen_random_uuid()::text, ${TENANT}, ${orderId}, NULL,
        'PAYMENT_MODE_SET_V1', 'F1.5-D synthetic setup payment mode', ${actorId}::uuid,
        ${transaction.json({ orderId, receiptId: `payment-mode://${orderId}/1`, previousPaymentMode: "vorkasse", paymentMode, expectedVersion: 0, paymentModeVersion: 1, occurredAt })},
        'success', NULL, ${clientEventId}::uuid, 1, ${correlationId}::uuid, 1, NULL,
        ${occurredAt}::timestamptz AT TIME ZONE 'UTC'
      )
    `;
  });
}

async function prepareFinishedOrder(
  page: Page,
  sql: postgres.Sql,
  actorId: string,
  label: string,
  mode: PaymentMode,
  issueInvoice: boolean,
) {
  const orderNumber = await createIntake(page, label);
  const [order] = await sql<OrderRow[]>`
    SELECT id, customer_id, order_number, version
    FROM public.orders WHERE tenant_id = ${TENANT} AND order_number = ${orderNumber}
  `;
  if (!order) throw new Error(`F1_5_D_ORDER_MISSING:${label}`);
  await sql`
    UPDATE public.customers SET company_name = ${`F1.5-D ${label} GmbH`}, street = 'Testweg 1',
      zip_code = '70173', city = 'Stuttgart', country = 'Deutschland', updated_at = now()
    WHERE tenant_id = ${TENANT} AND id = ${order.customer_id}
  `;
  await sql`UPDATE public.items SET preis_netto = 100.00 WHERE tenant_id = ${TENANT} AND order_id = ${order.id}`;
  if (mode !== "vorkasse") await setFixturePaymentMode(sql, order.id, actorId, mode);

  await openRoute(page, "/warendurchlauf/wareneingang");
  const row = page.getByTestId(`wareneingang-order-${order.id}`);
  await expectOne(row);
  await row.getByTestId("wareneingang-handoff").getByRole("button", { name: "An Galvanik übergeben", exact: true }).click();
  await expectOne(page.getByTestId("wareneingang-handoff-status"));

  const overlay = await openFinishedOverlay(page, order.id, orderNumber, false);
  const freeze = overlay.getByTestId("order-freeze-panel");
  await freeze.getByRole("button", { name: "Auftrag fertigsetzen", exact: true }).click();
  await freeze.getByRole("button", { name: "Fertig verbindlich bestätigen", exact: true }).click();
  await expect(freeze).toContainText("Fertig-Abschluss und Mehrarbeits-Freeze bestätigt.", { timeout: 30_000 });
  if (issueInvoice) {
    const invoice = overlay.getByTestId("order-immutable-invoice-panel");
    await invoice.getByRole("button", { name: "Unveränderliche Rechnung ausstellen", exact: true }).click();
    await expect(invoice).toContainText(/Rechnung R-\d{4}-\d+ ausgestellt/, { timeout: 30_000 });
  }
  await overlay.getByRole("button", { name: "Auftragskarte schließen", exact: true }).click();
  return { orderId: order.id, orderNumber };
}

async function openFinishedOverlay(page: Page, orderId: string, orderNumber: string, finished = true) {
  await openRoute(page, "/warendurchlauf/galvanik");
  if (finished) await page.getByTestId("galvanik-finished-tab").click();
  const bucket = page.getByTestId(finished ? "galvanik-finished-orders" : "galvanik-galvanik-orders");
  const card = bucket.locator(`[data-testid="order-compact-card"][data-order-id="${orderId}"]`);
  await expectOne(card);
  await card.click();
  const overlay = page.getByTestId("live-order-card");
  await expectOne(overlay);
  await expect(overlay).toContainText(orderNumber);
  await expectOne(overlay.getByTestId("f1-5-flow"));
  return overlay;
}

async function capture(page: Page, filename: string) {
  const target = path.join(EVIDENCE_DIR, filename);
  await page.screenshot({ path: target, fullPage: false });
  return target;
}

async function captureDesktopAndTablet(page: Page, anchor: Locator, step: string) {
  const captures: string[] = [];
  for (const viewport of [
    { width: 1440, height: 900, label: "desktop-1440x900" },
    { width: 1220, height: 880, label: "tablet-1220x880" },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await anchor.scrollIntoViewIfNeeded();
    captures.push(await capture(page, `f1-5-d-${viewport.label}-rechnung-${step}.png`));
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  return captures;
}

test.describe("F1.5-D schmale echte Zahlungs-/Warenausgangsoberfläche", () => {
  test("belegt drei Zahlungsmodi, Reload-Readback, Konflikt, Rollen und Desktop/Tablet", async ({ browser }) => {
    test.setTimeout(600_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const databaseUrl = requiredEnv("DATABASE_URL");
    requiredEnv("APP_SESSION_SECRET");
    expect(apiUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(databaseUrl).toMatch(/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/);

    const suffix = `${Date.now()}-${process.pid}`;
    const adminEmail = `f1-5-d-admin-${suffix}@local.test`;
    const readonlyEmail = `f1-5-d-readonly-${suffix}@local.test`;
    const foreignTenant = `f1-5-d-foreign-${suffix}`;
    const foreignEmail = `f1-5-d-foreign-${suffix}@local.test`;
    const password = `F1.5-D-${suffix}!`;
    const readonlyPin = "5917";
    const sql = postgres(databaseUrl, { max: 2, prepare: false });
    const contexts: BrowserContext[] = [];
    const screenshots: string[] = [];

    try {
      const adminId = await createAuthUser(apiUrl, anonKey, adminEmail, password);
      const readonlyId = await createAuthUser(apiUrl, anonKey, readonlyEmail, password);
      const foreignId = await createAuthUser(apiUrl, anonKey, foreignEmail, password);
      const readonlyHash = await bcrypt.hash(readonlyPin, 12);
      await sql`
        INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active)
        VALUES
          (${adminId}::uuid, ${TENANT}, ${adminEmail}, 'F1.5-D E2E Admin', 'admin', NULL, true),
          (${readonlyId}::uuid, ${TENANT}, ${readonlyEmail}, 'F1.5-D E2E Readonly', 'readonly', ${readonlyHash}, true),
          (${foreignId}::uuid, ${foreignTenant}, ${foreignEmail}, 'F1.5-D E2E Foreign', 'admin', NULL, true)
      `;
      await sql`
        INSERT INTO public.company_settings (
          id, tenant_id, company_name, street, zip, city, country, iban, bic,
          bank_name, tax_id, invoice_vat_rate_basis_points, invoice_payment_term_days
        ) VALUES (
          ${`f1-5-d-${suffix}`}, ${TENANT}, 'F1.5-D Synthetische Galvanik GmbH', 'Testweg 1',
          '70173', 'Stuttgart', 'Deutschland', 'DE02120300000000202051', 'BYLADEM1001',
          'F1.5 Testbank', 'DE-SYNTHETIC-TAX', 1900, 14
        )
      `;
      await sql`
        INSERT INTO private.extra_work_hourly_rates (id, tenant_id, hourly_rate_cents, version, created_by, effective_at)
        VALUES (${randomUUID()}::uuid, ${TENANT}, 12000, 1, ${adminId}::uuid, now())
      `;

      const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      contexts.push(desktop);
      const desktopPage = await desktop.newPage();
      await loginEmail(desktopPage, adminEmail, password);

      const vorkasse = await prepareFinishedOrder(desktopPage, sql, adminId, "Vorkasse", "vorkasse", true);
      const abholung = await prepareFinishedOrder(desktopPage, sql, adminId, "Abholung", "abholung", true);
      const rechnung = await prepareFinishedOrder(desktopPage, sql, adminId, "Rechnung", "rechnung", false);

      const tablet = await browser.newContext({ viewport: { width: 1220, height: 880 } });
      contexts.push(tablet);
      const tabletPage = await tablet.newPage();
      await loginEmail(tabletPage, adminEmail, password);

      const readonlyContext = await browser.newContext({ viewport: { width: 1220, height: 880 } });
      contexts.push(readonlyContext);
      const readonlyPage = await readonlyContext.newPage();
      await loginPin(readonlyPage, readonlyId, readonlyPin);
      const readonlyOverlay = await openFinishedOverlay(readonlyPage, vorkasse.orderId, vorkasse.orderNumber);
      await expect(readonlyOverlay.getByText("Zugriff nicht erlaubt", { exact: true })).toBeVisible();
      expect(await readonlyOverlay.getByTestId("f1-5-goods-out-action").count()).toBe(0);
      expect(await readonlyOverlay.getByTestId("f1-5-payment-action").count()).toBe(0);
      await readonlyContext.close();

      const vorkasseDesktop = await openFinishedOverlay(desktopPage, vorkasse.orderId, vorkasse.orderNumber);
      const vorkasseDesktopBlocked = vorkasseDesktop.getByTestId("f1-5-blocked");
      await expect(vorkasseDesktopBlocked).toContainText("Vorkasse ist noch nicht vollständig bestätigt");
      await vorkasseDesktopBlocked.scrollIntoViewIfNeeded();
      screenshots.push(await capture(desktopPage, "f1-5-d-desktop-vorkasse-blocked-1440x900.png"));
      const vorkasseTablet = await openFinishedOverlay(tabletPage, vorkasse.orderId, vorkasse.orderNumber);
      const vorkasseTabletBlocked = vorkasseTablet.getByTestId("f1-5-blocked");
      await expect(vorkasseTabletBlocked).toContainText("Vorkasse ist noch nicht vollständig bestätigt");
      await vorkasseTabletBlocked.scrollIntoViewIfNeeded();
      screenshots.push(await capture(tabletPage, "f1-5-d-tablet-vorkasse-blocked-1220x880.png"));
      await vorkasseTablet.getByRole("button", { name: "Auftragskarte schließen", exact: true }).click();

      await vorkasseDesktop.locator("#f1-5-payment-method").selectOption("ueberweisung");
      await vorkasseDesktop.getByTestId("f1-5-payment-action").click();
      await expect(vorkasseDesktop.getByTestId("f1-5-receipt")).toContainText("Zahlung bestätigt", { timeout: 30_000 });
      await vorkasseDesktop.getByTestId("f1-5-goods-out-mode-versand").click();
      await vorkasseDesktop.getByTestId("f1-5-goods-out-action").click();
      await expect(vorkasseDesktop.getByTestId("f1-5-receipt")).toContainText("Warenausgang bestätigt", { timeout: 30_000 });
      screenshots.push(await capture(desktopPage, "f1-5-d-desktop-vorkasse-success-1440x900.png"));
      await vorkasseDesktop.getByRole("button", { name: "Auftragskarte schließen", exact: true }).click();

      const abholungTablet = await openFinishedOverlay(tabletPage, abholung.orderId, abholung.orderNumber);
      await expect(abholungTablet.getByTestId("f1-5-blocked")).toContainText("bei der Übergabe zuerst vollständig bestätigt");
      await abholungTablet.getByTestId("f1-5-payment-action").click();
      await expect(abholungTablet.getByTestId("f1-5-receipt")).toContainText("Zahlung bestätigt", { timeout: 30_000 });
      await abholungTablet.getByTestId("f1-5-goods-out-mode-abholung").click();
      await abholungTablet.getByTestId("f1-5-goods-out-action").click();
      await expect(abholungTablet.getByTestId("f1-5-receipt")).toContainText("Warenausgang bestätigt", { timeout: 30_000 });
      screenshots.push(await capture(tabletPage, "f1-5-d-tablet-abholung-success-1220x880.png"));
      await abholungTablet.getByRole("button", { name: "Auftragskarte schließen", exact: true }).click();

      const rechnungDesktop = await openFinishedOverlay(desktopPage, rechnung.orderId, rechnung.orderNumber);
      const rechnungTablet = await openFinishedOverlay(tabletPage, rechnung.orderId, rechnung.orderNumber);
      const rechnungDesktopEmpty = rechnungDesktop.getByTestId("f1-5-no-invoice-values");
      const rechnungTabletEmpty = rechnungTablet.getByTestId("f1-5-no-invoice-values");
      await expect(rechnungDesktopEmpty).toContainText("weder Betrag noch Zahlungsstatus");
      await expect(rechnungTabletEmpty).toContainText("weder Betrag noch Zahlungsstatus");
      expect(await rechnungDesktop.getByTestId("order-immutable-invoice-panel").count()).toBe(0);
      expect(await rechnungTablet.getByTestId("order-immutable-invoice-panel").count()).toBe(0);
      await rechnungDesktopEmpty.scrollIntoViewIfNeeded();
      await rechnungTabletEmpty.scrollIntoViewIfNeeded();
      screenshots.push(await capture(desktopPage, "f1-5-d-desktop-rechnung-empty-1440x900.png"));
      screenshots.push(await capture(tabletPage, "f1-5-d-tablet-rechnung-empty-1220x880.png"));
      await rechnungDesktop.getByTestId("f1-5-goods-out-mode-versand").click();
      await rechnungTablet.getByTestId("f1-5-goods-out-mode-versand").click();
      await rechnungDesktop.getByTestId("f1-5-goods-out-action").click();
      await expect(rechnungDesktop.getByTestId("f1-5-receipt")).toContainText("Warenausgang bestätigt", { timeout: 30_000 });
      await rechnungTablet.getByTestId("f1-5-goods-out-action").click();
      await expect(rechnungTablet.getByRole("alert")).toContainText("Der Auftrag wurde neu geladen", { timeout: 30_000 });
      expect(await rechnungTablet.getByTestId("f1-5-receipt").count()).toBe(0);

      const rechnungInvoice = rechnungDesktop.getByTestId("order-immutable-invoice-panel");
      await expectOne(rechnungInvoice);
      await expect(rechnungDesktop.getByTestId("f1-5-physical-status")).toHaveText("abgeholt");
      screenshots.push(...await captureDesktopAndTablet(desktopPage, rechnungInvoice, "nach-ausgang-v2"));
      await rechnungInvoice.getByRole("button", { name: "Unveränderliche Rechnung ausstellen", exact: true }).click();
      await expect(rechnungDesktop.getByTestId("f1-5-invoice-state")).toContainText(/Rechnung R-\d{4}-\d+/, { timeout: 45_000 });
      await expect(rechnungDesktop.getByTestId("f1-5-receipt")).toContainText("Rechnung bestätigt", { timeout: 45_000 });
      await expect(rechnungDesktop.getByText("Spätere Zahlung bestätigen", { exact: true })).toBeVisible();
      await expect(rechnungDesktop.getByText(/Der Warenausgang ist bereits bestätigt; die spätere Zahlung wird separat mit Readback dokumentiert/)).toBeVisible();
      await expect(rechnungDesktop.getByText(/Erst der bestätigte Readback öffnet das Ausgangs-Gate/)).toHaveCount(0);
      screenshots.push(...await captureDesktopAndTablet(desktopPage, rechnungDesktop.getByTestId("f1-5-payment-action"), "nach-rechnung-v2"));
      await rechnungDesktop.locator("#f1-5-payment-method").selectOption("ueberweisung");
      await rechnungDesktop.getByTestId("f1-5-payment-action").click();
      await expect(rechnungDesktop.getByTestId("f1-5-receipt")).toContainText("Zahlung bestätigt", { timeout: 30_000 });
      await expect(rechnungDesktop.getByTestId("f1-5-payment-status")).toHaveText("bezahlt");
      screenshots.push(...await captureDesktopAndTablet(desktopPage, rechnungDesktop.getByTestId("f1-5-receipt"), "nach-zahlung-v1"));

      const [readback] = await sql<{
        vorkasse_events: number; abholung_events: number; rechnung_v2_events: number;
        rechnung_invoice_v2_events: number; payment_events: number;
      }[]>`
        SELECT
          (SELECT count(*)::integer FROM public.events WHERE tenant_id=${TENANT} AND order_id=${vorkasse.orderId} AND event_type='ORDER_PICKED_UP_V1') AS vorkasse_events,
          (SELECT count(*)::integer FROM public.events WHERE tenant_id=${TENANT} AND order_id=${abholung.orderId} AND event_type='ORDER_PICKED_UP_V1') AS abholung_events,
          (SELECT count(*)::integer FROM public.events WHERE tenant_id=${TENANT} AND order_id=${rechnung.orderId} AND event_type='ORDER_PICKED_UP_V2') AS rechnung_v2_events,
          (SELECT count(*)::integer FROM public.events WHERE tenant_id=${TENANT} AND order_id=${rechnung.orderId} AND event_type='INVOICE_CREATED_V2') AS rechnung_invoice_v2_events,
          (SELECT count(*)::integer FROM public.events WHERE tenant_id=${TENANT} AND order_id IN (${vorkasse.orderId},${abholung.orderId},${rechnung.orderId}) AND event_type='PAYMENT_CONFIRMED_V1') AS payment_events
      `;
      expect(readback).toEqual({ vorkasse_events: 1, abholung_events: 1, rechnung_v2_events: 1, rechnung_invoice_v2_events: 1, payment_events: 3 });

      const receipts = await sql<{
        event_id: string; order_id: string; event_type: string; actor_id: string;
        occurred_at: string; client_event_id: string; correlation_id: string; event_schema_version: number;
      }[]>`
        SELECT id::text AS event_id, order_id, event_type, user_id::text AS actor_id,
               created_at::text AS occurred_at, client_event_id::text, correlation_id::text, event_schema_version
        FROM public.events
        WHERE tenant_id = ${TENANT}
          AND order_id IN (${vorkasse.orderId}, ${abholung.orderId}, ${rechnung.orderId})
          AND event_type IN ('PAYMENT_CONFIRMED_V1', 'ORDER_PICKED_UP_V1', 'ORDER_PICKED_UP_V2', 'INVOICE_CREATED_V2')
        ORDER BY occurred_at, id
      `;
      expect(receipts).toHaveLength(7);

      const foreignContext = await browser.newContext({ viewport: { width: 1220, height: 880 } });
      contexts.push(foreignContext);
      const foreignPage = await foreignContext.newPage();
      await foreignPage.goto("/start");
      await foreignPage.getByRole("button", { name: "Administrator / E-Mail Login", exact: true }).click();
      await foreignPage.locator("#email").fill(foreignEmail);
      await foreignPage.locator("#password").fill(password);
      await foreignPage.getByRole("button", { name: "Einloggen", exact: true }).click();
      await foreignPage.waitForURL((url) => url.pathname === "/start" && url.searchParams.has("message"), { timeout: 30_000 });
      expect((await foreignContext.cookies()).some((cookie) => cookie.name === "kreile_app_session")).toBe(false);

      const artifact = {
        testedAt: new Date().toISOString(),
        source: "fresh local Supabase + real auth/session + real server actions + browser reload readback",
        viewports: ["1440x900", "1220x880"],
        orders: { vorkasse, abholung, rechnung },
        readback,
        receipts,
        screenshots: screenshots.map((file) => ({ file: path.relative(process.cwd(), file).replaceAll("\\", "/"), sha256: sha256File(readFileSync(file)) })),
      };
      writeFileSync(path.join(EVIDENCE_DIR, "f1-5-d-real-browser-receipt.json"), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
    } finally {
      await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
      await sql.end({ timeout: 2 });
    }
  });
});
