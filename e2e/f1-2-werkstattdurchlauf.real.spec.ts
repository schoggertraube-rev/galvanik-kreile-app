import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const TENANT = "galvanik-kreile";
const FOREIGN_TENANT = "m2-foreign-tenant";
const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  "docs/evidence/f1/artifacts/f1-2",
);

type AuthUser = { id: string };
type AuthSignupResponse = { user?: { id?: string } };
type OrderRow = {
  id: string;
  order_number: string;
  station: string;
  current_station: string;
  current_station_id: string;
  status: string;
  version: number;
};
type StationEventRow = {
  id: string;
  event_type: string;
  client_event_id: string;
  correlation_id: string;
  aggregate_version: number;
  from_station: string | null;
  station: string;
  status: string;
  description: string | null;
  user_id: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`F1_2_E2E_ENV_MISSING:${name}`);
  return value;
}

async function createRealLocalAuthUser(
  apiUrl: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<AuthUser> {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const body = (await response.json()) as AuthSignupResponse & { message?: string };
  if (!response.ok || typeof body.user?.id !== "string") {
    throw new Error(`REAL_LOCAL_AUTH_SIGNUP_FAILED:${response.status}:${body.message ?? "invalid response"}`);
  }
  return { id: body.user.id };
}

async function loginWithRealEmail(page: Page, email: string, password: string) {
  await page.goto("/start");
  await page.getByRole("button", { name: "Administrator / E-Mail Login" }).click();
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Einloggen" }).click();
  await page.waitForURL((url) => url.pathname === "/warendurchlauf", { timeout: 30_000 });
  await expect(page.locator('a[href="/warendurchlauf/wareneingang"]')).toBeVisible({ timeout: 30_000 });

  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "kreile_app_session")).toBe(true);
  expect(cookies.some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"))).toBe(true);
}

async function loginWithRealPin(page: Page, initials: string, pin: string) {
  await page.goto("/start");
  await page
    .getByText(initials, { exact: true })
    .locator("xpath=ancestor::button[1]")
    .click();
  await expect(page.getByText("PIN eingeben", { exact: true })).toBeVisible();
  for (const digit of pin) {
    await page.getByRole("button", { name: digit, exact: true }).click();
  }
  await page.waitForURL((url) => url.pathname === "/warendurchlauf", { timeout: 30_000 });
  await expect(page.locator('a[href="/warendurchlauf/wareneingang"]')).toBeVisible({ timeout: 30_000 });
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "kreile_app_session")).toBe(true);
}

async function screenshot(page: Page, filename: string) {
  await page.screenshot({ path: path.join(EVIDENCE_DIR, filename), fullPage: true });
}

function runDocker(...args: string[]): string {
  return execFileSync("docker", args, {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

async function restoreLocalDatabase(apiUrl: string) {
  runDocker("start", "supabase_db_02_app");

  const databaseDeadline = Date.now() + 60_000;
  while (Date.now() < databaseDeadline) {
    if (runDocker("inspect", "--format={{.State.Health.Status}}", "supabase_db_02_app") === "healthy") break;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  expect(runDocker("inspect", "--format={{.State.Health.Status}}", "supabase_db_02_app")).toBe("healthy");

  runDocker("restart", "supabase_kong_02_app");
  const authDeadline = Date.now() + 45_000;
  while (Date.now() < authDeadline) {
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, "")}/auth/v1/health`);
      if (response.status === 200) return;
    } catch {
      // The real local gateway is still recovering.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("LOCAL_SUPABASE_AUTH_DID_NOT_RECOVER");
}

async function openWorkflowRoute(page: Page, href: string) {
  const link = page.locator(`a[href="${href}"]`).first();
  await expect(link).toBeVisible({ timeout: 30_000 });
  await Promise.all([
    page.waitForURL((url) => url.pathname === href, { timeout: 30_000 }),
    link.click(),
  ]);
}

async function readOrder(sql: postgres.Sql, orderNumber: string): Promise<OrderRow> {
  const rows = await sql<OrderRow[]>`
    SELECT id, order_number, station, current_station, current_station_id, status, version
    FROM public.orders
    WHERE tenant_id = ${TENANT} AND order_number = ${orderNumber}
  `;
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function readStationEvents(sql: postgres.Sql, orderId: string): Promise<StationEventRow[]> {
  return await sql<StationEventRow[]>`
    SELECT id, event_type, client_event_id, correlation_id, aggregate_version,
           from_station, station, status, description, user_id
    FROM public.events
    WHERE tenant_id = ${TENANT}
      AND order_id = ${orderId}
      AND event_type IN ('ORDER_STATION_MOVED_V1', 'ORDER_STATION_CORRECTED_V1')
    ORDER BY aggregate_version
  `;
}

async function openSourceOrder(page: Page, orderNumber: string) {
  await openWorkflowRoute(page, "/warendurchlauf/wareneingang");
  await expect(page.getByText(orderNumber, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "An Galvanik übergeben" })).toHaveCount(1);
}

test.describe("F1.2 realer Werkstattdurchlauf", () => {
  test("ein UI-erzeugter Auftrag läuft real durch Storage, Übergabe, Konflikt, Korrektur und Rollen-/Tenant-Grenzen", async ({ browser }, testInfo) => {
    test.setTimeout(360_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });

    const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const databaseUrl = requiredEnv("DATABASE_URL");
    requiredEnv("APP_SESSION_SECRET");

    expect(apiUrl).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321$/);
    expect(databaseUrl).toMatch(/@(127\.0\.0\.1|localhost):54322\//);

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const adminEmail = `m2-admin-${suffix}@local.test`;
    const foreignEmail = `m2-foreign-${suffix}@local.test`;
    const adminPassword = `M2-Admin-${suffix}!`;
    const foreignPassword = `M2-Foreign-${suffix}!`;
    const readonlyPin = "6042";
    const customerName = `M2 E2E Kunde ${suffix}`;
    const itemName = `M2 E2E Bauteil ${suffix}`;
    const correctionReason = "Falsche Zuordnung im Wareneingang korrigieren";

    const sql = postgres(databaseUrl, { max: 1, prepare: false });
    const contexts: BrowserContext[] = [];

    try {
      const adminAuth = await createRealLocalAuthUser(apiUrl, anonKey, adminEmail, adminPassword);
      const readonlyAuth = await createRealLocalAuthUser(
        apiUrl,
        anonKey,
        `m2-readonly-${suffix}@local.test`,
        `M2-Readonly-${suffix}!`,
      );
      const foreignAuth = await createRealLocalAuthUser(apiUrl, anonKey, foreignEmail, foreignPassword);
      const readonlyPinHash = await bcrypt.hash(readonlyPin, 12);

      await sql`
        INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active)
        VALUES
          (${adminAuth.id}::uuid, ${TENANT}, ${adminEmail}, 'M2 Admin', 'admin', NULL, true),
          (${readonlyAuth.id}::uuid, ${TENANT}, ${`m2-readonly-${suffix}@local.test`}, 'M2 Readonly', 'readonly', ${readonlyPinHash}, true),
          (${foreignAuth.id}::uuid, ${FOREIGN_TENANT}, ${foreignEmail}, 'M2 Foreign', 'admin', NULL, true)
      `;

      const contextA = await browser.newContext();
      contexts.push(contextA);
      const pageA = await contextA.newPage();
      await loginWithRealEmail(pageA, adminEmail, adminPassword);

      await openWorkflowRoute(pageA, "/warendurchlauf/galvanik");
      await expect(pageA.getByText("Lade Galvanik Aufträge...", { exact: true })).toBeVisible();
      await screenshot(pageA, "01-galvanik-loading.png");
      await expect(pageA.getByText(/Noch keine Daten erfasst\./).first()).toBeVisible({ timeout: 30_000 });
      await screenshot(pageA, "02-galvanik-empty.png");

      await openWorkflowRoute(pageA, "/warendurchlauf/wareneingang");
      await pageA.getByRole("button", { name: "Wareneingang anlegen" }).click();
      const intakeModal = pageA.locator(
        '[class~="fixed"][class~="inset-0"][class~="z-[2000]"] > div.max-w-5xl',
      );
      await expect(intakeModal).toHaveCount(1);
      await expect(intakeModal.getByRole("heading", { name: "Digitaler Wareneingang" })).toBeVisible();
      await intakeModal.getByRole("button", { name: "Neu anlegen", exact: true }).click();
      await intakeModal.getByPlaceholder("Kundenname *").fill(customerName);
      await intakeModal.getByPlaceholder("Firmenname").fill("M2 E2E GmbH");
      await intakeModal.getByPlaceholder("Ansprechperson").fill("M2 Abnahme");
      await intakeModal.getByPlaceholder("Bezeichnung *").fill(itemName);
      await intakeModal.getByPlaceholder("Menge *").fill("7");
      await intakeModal.getByPlaceholder("Werkstoff").fill("Stahl");
      await intakeModal.getByPlaceholder("Oberfläche / Behandlung *").fill("Verzinken");
      await intakeModal.getByLabel("Wunschtermin *").fill("2026-08-27");
      await intakeModal.getByLabel("Interner Hinweis").fill("M2 realer Ende-zu-Ende-Abnahmepfad");
      await intakeModal.getByRole("button", { name: "Wareneingang anlegen", exact: true }).click();

      const receiptHeading = intakeModal.getByRole("heading", { name: /^A-\d{4}-\d+ bestätigt$/ });
      await expect(receiptHeading).toBeVisible({ timeout: 30_000 });
      const receiptHeadingText = (await receiptHeading.textContent())?.trim() ?? "";
      const orderNumberMatch = /^(A-\d{4}-\d+) bestätigt$/.exec(receiptHeadingText);
      expect(orderNumberMatch).not.toBeNull();
      const orderNumber = orderNumberMatch![1];

      const png = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      );
      await intakeModal.locator('input[type="file"]').setInputFiles({
        name: "m2-e2e-original.png",
        mimeType: "image/png",
        buffer: png,
      });
      await expect(intakeModal.getByText("Original bestätigt · m2-e2e-original.png", { exact: true })).toBeVisible({ timeout: 30_000 });
      await screenshot(pageA, "03-intake-photo-confirmed.png");

      const created = await readOrder(sql, orderNumber);
      expect(created).toMatchObject({
        station: "wareneingang",
        current_station: "wareneingang",
        current_station_id: "wareneingang",
        status: "angenommen",
        version: 1,
      });
      const storageReceipts = await sql<{
        reservation_id: string;
        receipt_id: string;
        object_path: string;
        content_sha256: string;
        storage_object_id: string;
      }[]>`
        SELECT reservation.id::text AS reservation_id,
               evidence.id::text AS receipt_id,
               reservation.object_path,
               reservation.content_sha256,
               evidence.storage_object_id::text AS storage_object_id
        FROM private.order_station_evidence_reservations reservation
        JOIN private.order_station_evidence evidence ON evidence.reservation_id = reservation.id
        JOIN storage.objects object ON object.id = evidence.storage_object_id
        WHERE reservation.tenant_id = ${TENANT}
          AND reservation.order_id = ${created.id}
          AND reservation.purpose = 'ORDER_INTAKE_ORIGINAL_V1'
      `;
      expect(storageReceipts).toHaveLength(1);

      await intakeModal.getByRole("button", { name: "Schließen", exact: true }).click();
      await openSourceOrder(pageA, orderNumber);
      await screenshot(pageA, "04-source-order-data.png");

      const contextB = await browser.newContext();
      contexts.push(contextB);
      const pageB = await contextB.newPage();
      await loginWithRealEmail(pageB, adminEmail, adminPassword);
      await openSourceOrder(pageB, orderNumber);

      await pageA.getByRole("button", { name: "An Galvanik übergeben" }).click();
      await expect(pageA.getByText("Übergabe an Galvanik bestätigt.", { exact: true }).last()).toBeVisible({ timeout: 30_000 });
      await screenshot(pageA, "05-forward-success.png");

      const afterForward = await readOrder(sql, orderNumber);
      expect(afterForward).toMatchObject({
        station: "galvanik",
        current_station: "galvanik",
        current_station_id: "galvanik",
        status: "galvanik",
        version: 2,
      });
      const forwardEvents = await readStationEvents(sql, created.id);
      expect(forwardEvents).toHaveLength(1);
      expect(forwardEvents[0]).toMatchObject({
        event_type: "ORDER_STATION_MOVED_V1",
        aggregate_version: 2,
        from_station: "wareneingang",
        station: "galvanik",
        status: "success",
        user_id: adminAuth.id,
      });

      await pageB.getByRole("button", { name: "An Galvanik übergeben" }).click();
      await expect(pageB.getByText("Auftrag wurde bereits geändert.", { exact: true })).toBeVisible({ timeout: 30_000 });
      await screenshot(pageB, "06-stale-conflict.png");
      expect(await readOrder(sql, orderNumber)).toEqual(afterForward);
      expect(await readStationEvents(sql, created.id)).toEqual(forwardEvents);

      await openWorkflowRoute(pageA, "/warendurchlauf/galvanik");
      await expect(pageA.getByText(orderNumber, { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(pageA.getByRole("button", { name: "Zurück nach Wareneingang" })).toHaveCount(1);
      await screenshot(pageA, "07-target-reload-data.png");

      await pageA.getByRole("button", { name: "Zurück nach Wareneingang" }).click();
      const correctionReasonInput = pageA.getByLabel("Begründung der Korrektur");
      const correctionPanel = correctionReasonInput.locator("..");
      await correctionReasonInput.fill(correctionReason);
      const confirmCorrection = correctionPanel.getByRole("button", { name: "Korrektur bestätigen" });
      await expect(confirmCorrection).toBeVisible();
      await expect(confirmCorrection).toBeEnabled();
      await confirmCorrection.click({ timeout: 10_000 });
      await expect(pageA.getByText("Rücknahme nach Wareneingang bestätigt.", { exact: true }).last()).toBeVisible({ timeout: 30_000 });
      await screenshot(pageA, "08-correction-success.png");

      const afterCorrection = await readOrder(sql, orderNumber);
      expect(afterCorrection).toMatchObject({
        station: "wareneingang",
        current_station: "wareneingang",
        current_station_id: "wareneingang",
        status: "angenommen",
        version: 3,
      });
      const correctedEvents = await readStationEvents(sql, created.id);
      expect(correctedEvents).toHaveLength(2);
      expect(correctedEvents[1]).toMatchObject({
        event_type: "ORDER_STATION_CORRECTED_V1",
        aggregate_version: 3,
        from_station: "galvanik",
        station: "wareneingang",
        status: "success",
        description: correctionReason,
        user_id: adminAuth.id,
      });

      await openSourceOrder(pageA, orderNumber);
      await screenshot(pageA, "09-source-reload-readback.png");

      const readonlyContext = await browser.newContext();
      contexts.push(readonlyContext);
      const readonlyPage = await readonlyContext.newPage();
      await loginWithRealPin(readonlyPage, "MR", readonlyPin);
      await openSourceOrder(readonlyPage, orderNumber);
      await readonlyPage.getByRole("button", { name: "An Galvanik übergeben" }).click();
      await expect(readonlyPage.getByText("Stationswechsel ist nicht erlaubt.", { exact: true })).toBeVisible({ timeout: 30_000 });
      await screenshot(readonlyPage, "10-readonly-denial.png");
      expect(await readOrder(sql, orderNumber)).toEqual(afterCorrection);
      expect(await readStationEvents(sql, created.id)).toEqual(correctedEvents);

      const foreignContext = await browser.newContext();
      contexts.push(foreignContext);
      const foreignPage = await foreignContext.newPage();
      await foreignPage.goto("/start");
      await foreignPage.getByRole("button", { name: "Administrator / E-Mail Login" }).click();
      await foreignPage.locator("#email").fill(foreignEmail);
      await foreignPage.locator("#password").fill(foreignPassword);
      await foreignPage.getByRole("button", { name: "Einloggen" }).click();
      await foreignPage.waitForURL((url) => url.pathname === "/start" && url.searchParams.has("message"), { timeout: 30_000 });
      await expect(foreignPage.getByText("AUTH_ERROR: Benutzer nicht gefunden", { exact: true })).toBeVisible();
      expect((await foreignContext.cookies()).some((cookie) => cookie.name === "kreile_app_session")).toBe(false);
      await screenshot(foreignPage, "11-foreign-tenant-denial.png");
      expect(await readOrder(sql, orderNumber)).toEqual(afterCorrection);
      expect(await readStationEvents(sql, created.id)).toEqual(correctedEvents);

      const receiptEvidence = {
        orderId: created.id,
        orderNumber,
        intakeVersion: created.version,
        storage: storageReceipts[0],
        forward: forwardEvents[0],
        correction: correctedEvents[1],
        finalReadback: afterCorrection,
        negativeProof: {
          staleConflict: "CONFLICT_NO_SECOND_WRITE",
          readonly: "FORBIDDEN_NO_WRITE",
          foreignTenant: "AUTH_ERROR_NO_APP_SESSION_NO_WRITE",
        },
      };
      await testInfo.attach("f1-2-real-receipts", {
        body: Buffer.from(JSON.stringify(receiptEvidence, null, 2), "utf8"),
        contentType: "application/json",
      });
      console.log(`M2_ORDER=${orderNumber}:${created.id}`);
      console.log(`M2_WRITE_RECEIPT=${forwardEvents[0].id}:V${forwardEvents[0].aggregate_version}:${forwardEvents[0].correlation_id}`);
      console.log(`M2_READBACK_RECEIPT=${correctedEvents[1].id}:V${afterCorrection.version}:DATABASE`);
      console.log("M2_NEGATIVE_PROOF=CONFLICT,READONLY_FORBIDDEN,FOREIGN_TENANT_DENIED");
    } finally {
      for (const context of contexts.reverse()) await context.close();
      await sql.end({ timeout: 5 });
    }
  });

  test("zeigt bei real gestoppter lokaler Datenbank den sichtbaren Fehlerzustand", async ({ browser }) => {
    test.setTimeout(150_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });

    const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const databaseUrl = requiredEnv("DATABASE_URL");
    requiredEnv("APP_SESSION_SECRET");

    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    const adminEmail = `m2-error-admin-${suffix}@local.test`;
    const adminPassword = `M2-Error-Admin-${suffix}!`;
    const sql = postgres(databaseUrl, { max: 1, prepare: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    let databaseStopped = false;

    try {
      const adminAuth = await createRealLocalAuthUser(apiUrl, anonKey, adminEmail, adminPassword);
      await sql`
        INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active)
        VALUES (${adminAuth.id}::uuid, ${TENANT}, ${adminEmail}, 'M2 Error Admin', 'admin', NULL, true)
      `;
      await sql.end({ timeout: 5 });

      await loginWithRealEmail(page, adminEmail, adminPassword);
      await openWorkflowRoute(page, "/warendurchlauf/galvanik");
      await expect(page.getByText(/Noch keine Daten erfasst\.|A-\d{4}-\d+/).first()).toBeVisible({ timeout: 30_000 });

      runDocker("stop", "supabase_db_02_app");
      databaseStopped = true;
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30_000 });
      await expect(page.getByText("Daten konnten nicht geladen werden", { exact: true })).toBeVisible({ timeout: 30_000 });
      await screenshot(page, "12-galvanik-real-error.png");
    } finally {
      await context.close();
      if (databaseStopped) await restoreLocalDatabase(apiUrl);
      else await sql.end({ timeout: 5 });
    }
  });
});
