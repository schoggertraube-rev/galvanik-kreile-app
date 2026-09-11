import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { hash as hashPin } from "bcryptjs";
import { execFileSync } from "node:child_process";
import { createHash, createHmac } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const TENANT = "galvanik-kreile";
const EVIDENCE_DIR = path.resolve(process.cwd(), "docs/evidence/ui/artifacts/path1-ui-convergence");
let loopbackSecureCookieReplayUsed = false;

test.describe.configure({ mode: "serial" });

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PATH1_UI_E2E_ENV_MISSING:${name}`);
  return value;
}

async function createAuthUser(apiUrl: string, anonKey: string, email: string, password: string): Promise<string> {
  const baseUrl = apiUrl.replace(/\/$/, "");
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const health = await fetch(`${baseUrl}/auth/v1/health`);
    if (!health.ok) {
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        continue;
      }
      throw new Error(`PATH1_UI_AUTH_HEALTH_FAILED:${health.status}`);
    }

    const response = await fetch(`${baseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json() as { user?: { id?: string }; message?: string };
    if (response.ok && typeof body.user?.id === "string") return body.user.id;
    if (response.status !== 502 || attempt === 3) {
      throw new Error(`PATH1_UI_AUTH_SIGNUP_FAILED:${response.status}:${body.message ?? "invalid"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  throw new Error("PATH1_UI_AUTH_SIGNUP_FAILED:retry-exhausted");
}

async function normalizeLoopbackSessionCookie(page: Page): Promise<void> {
  const sessionCookie = (await page.context().cookies()).find((cookie) => cookie.name === "kreile_app_session");
  if (!sessionCookie) throw new Error("PATH1_UI_SESSION_COOKIE_MISSING");
  if (sessionCookie.secure && page.url().startsWith("http://localhost")) {
    // next start correctly emits Secure in production. Reuse the byte-identical signed cookie
    // without Secure solely for this loopback HTTP transport; server validation remains real.
    await page.context().addCookies([{ ...sessionCookie, secure: false }]);
    loopbackSecureCookieReplayUsed = true;
  }
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/start");
  await page.getByRole("button", { name: "Administrator / E-Mail Login", exact: true }).click();
  const dialog = page.getByTestId("email-login-dialog");
  await dialog.locator("#email").fill(email);
  await dialog.locator("#password").fill(password);
  await dialog.getByRole("button", { name: "Einloggen", exact: true }).click();
  await page.waitForURL((url) => url.pathname !== "/start", { timeout: 30_000 });
  await normalizeLoopbackSessionCookie(page);
}

async function loginWithPin(page: Page, userId: string, pin: string): Promise<Page> {
  await page.goto("/start");
  const handle = createHmac("sha256", requiredEnv("APP_SESSION_SECRET"))
    .update(`pin-login:${TENANT}:${userId}`)
    .digest("base64url");
  const userCard = page.getByTestId(`pin-user-card-${handle}`);
  await userCard.focus();
  await expect(userCard).toBeFocused();
  await page.keyboard.press("Enter");
  const dialog = page.getByTestId("pin-login-dialog");
  for (const digit of pin) {
    await dialog.getByRole("button", { name: digit, exact: true }).click();
  }
  await expect.poll(async () => (await page.context().cookies()).some((cookie) => cookie.name === "kreile_app_session"), {
    timeout: 30_000,
    message: "real signed app session cookie",
  }).toBe(true);
  // Let the production redirect settle first. On loopback HTTP the Secure cookie is
  // intentionally not sent yet, so middleware may finish back on /start.
  await page.waitForLoadState("networkidle");
  await normalizeLoopbackSessionCookie(page);
  const context = page.context();
  await page.close();
  const authenticatedPage = await context.newPage();
  await authenticatedPage.goto("/");
  await authenticatedPage.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  expect((await context.cookies()).some((cookie) => cookie.name === "kreile_app_session")).toBe(true);
  return authenticatedPage;
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

type IntakeOptions = {
  dueDate?: string;
  itemName?: string;
  material?: string;
  surface?: string;
  note?: string;
};

function isoDateFromToday(offsetDays: number): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function createIntake(
  page: Page,
  suffix: string,
  existingCustomerName?: string,
  options: IntakeOptions = {},
): Promise<{ orderNumber: string; customerName: string }> {
  const customerName = existingCustomerName ?? `UI-Konvergenz ${suffix}`;
  await page.goto("/warendurchlauf/wareneingang", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page).toHaveURL(/\/warendurchlauf\/wareneingang$/, { timeout: 30_000 });
  await page.getByTestId("wareneingang-create-order").click({ timeout: 120_000 });
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
  await modal.getByPlaceholder("Bezeichnung *", { exact: true }).fill(options.itemName ?? `Synthetisches Bauteil ${suffix}`);
  await modal.getByPlaceholder("Menge *", { exact: true }).fill("2");
  await modal.getByPlaceholder("Werkstoff", { exact: true }).fill(options.material ?? "Stahl");
  await modal.getByPlaceholder("Oberfläche / Behandlung *", { exact: true }).fill(options.surface ?? "Chrom hochglanz");
  await modal.getByLabel("Wunschtermin *", { exact: true }).fill(options.dueDate ?? "2030-09-30");
  await modal.getByLabel("Interner Hinweis", { exact: true }).fill(options.note ?? "Klar synthetischer lokaler B/C-Browserbeleg");
  await modal.getByRole("button", { name: "Wareneingang anlegen", exact: true }).click();
  const heading = modal.getByRole("heading", { name: /^A-\d{4}-\d+ bestätigt$/ });
  await expect(heading).toBeVisible({ timeout: 30_000 });
  const match = /^(A-\d{4}-\d+) bestätigt$/.exec((await heading.textContent())?.trim() ?? "");
  if (!match) throw new Error("PATH1_UI_INTAKE_RECEIPT_INVALID");
  await modal.getByRole("button", { name: "Schließen", exact: true }).click();
  return { orderNumber: match[1], customerName };
}

async function transitionToGalvanik(page: Page, orderId: string): Promise<void> {
  await page.goto("/warendurchlauf/wareneingang", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await expect(page).toHaveURL(/\/warendurchlauf\/wareneingang$/, { timeout: 30_000 });
  const row = page.getByTestId(`wareneingang-order-${orderId}`);
  await expect(row).toBeVisible({ timeout: 120_000 });
  await row.getByTestId("wareneingang-handoff").getByRole("button", { name: "An Galvanik übergeben", exact: true }).click();
  await expect(page.getByTestId("wareneingang-handoff-status")).toBeVisible({ timeout: 30_000 });
}

async function capture(page: Page, filename: string): Promise<{ file: string; sha256: string }> {
  const target = path.join(EVIDENCE_DIR, filename);
  await page.screenshot({ path: target, fullPage: false });
  return { file: path.relative(process.cwd(), target).replaceAll("\\", "/"), sha256: createHash("sha256").update(readFileSync(target)).digest("hex") };
}

async function captureReference(
  page: Page,
  source: string,
  filename: string,
): Promise<{ file: string; sha256: string }> {
  await page.setContent(readFileSync(path.resolve(process.cwd(), source), "utf8"), {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(() => document.fonts.ready);
  return capture(page, filename);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

async function exerciseRolfNavigation(page: Page, mobile: boolean): Promise<string[]> {
  const visited: string[] = [];
  if (mobile) {
    const navigation = page.getByRole("navigation", { name: "Mobile Hauptnavigation" });
    for (const [name, pathname] of [["Der Tag", "/"], ["Aufträge", "/orders"], ["Kunden", "/customers"], ["Geld", "/buchhaltung/rechnungen"]] as const) {
      await navigation.getByRole("link", { name, exact: true }).click();
      await page.waitForURL((url) => url.pathname === pathname, { timeout: 30_000 });
      visited.push(pathname);
    }
    await navigation.getByRole("button", { name: "Mehr", exact: true }).click();
    const more = page.getByRole("dialog", { name: "Weitere Kernbereiche" });
    await more.getByRole("link", { name: "Werkstatt", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/warendurchlauf", { timeout: 30_000 });
    visited.push("/warendurchlauf");
  } else {
    const navigation = page.getByRole("navigation", { name: "Hauptnavigation" });
    for (const [name, pathname] of [["Der Tag", "/"], ["Werkstatt", "/warendurchlauf"], ["Aufträge", "/orders"], ["Kunden & Kontakt", "/customers"], ["Geld & Rechnungen", "/buchhaltung/rechnungen"]] as const) {
      await navigation.getByRole("link", { name, exact: true }).click();
      await page.waitForURL((url) => url.pathname === pathname, { timeout: 30_000 });
      visited.push(pathname);
    }
  }
  await expect(page.locator("body")).not.toContainText(/NOT_AVAILABLE|kommt bald|Google Calendar/i);
  return visited;
}

test.describe("Path-1 UI convergence A", () => {
  test("belegt sechs Rollen, Phillip/Rolf, Zielnavigation und entfernte Alt-Routen", async ({ browser }) => {
    test.setTimeout(900_000);
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const databaseUrl = requiredEnv("DATABASE_URL");
    requiredEnv("APP_SESSION_SECRET");
    expect(apiUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(databaseUrl).toMatch(/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/);

    const suffix = `${Date.now()}-${process.pid}`;
    const pin = "6142";
    const users = [
      { role: "developer", name: `Dora Entwicklung ${suffix}`, initials: "DE", email: `path1-a-developer-${suffix}@local.test`, password: `Path1-A-Developer-${suffix}!`, login: "email" },
      { role: "admin", name: `Anton Administration ${suffix}`, initials: "AA", email: `path1-a-admin-${suffix}@local.test`, password: `Path1-A-Admin-${suffix}!`, login: "email" },
      { role: "meister", name: `Mara Meister ${suffix}`, initials: "MM", email: `path1-a-meister-${suffix}@local.test`, password: `Path1-A-Meister-${suffix}!`, login: "pin" },
      { role: "buero", name: `Berta Büro ${suffix}`, initials: "BB", email: `path1-a-buero-${suffix}@local.test`, password: `Path1-A-Buero-${suffix}!`, login: "pin" },
      { role: "werkstatt", name: `Phillip Werkstatt ${suffix}`, initials: "PW", email: `path1-a-werkstatt-${suffix}@local.test`, password: `Path1-A-Werkstatt-${suffix}!`, login: "pin" },
      { role: "readonly", name: `Rita Nurlesen ${suffix}`, initials: "RN", email: `path1-a-readonly-${suffix}@local.test`, password: `Path1-A-Readonly-${suffix}!`, login: "pin" },
    ] as const;
    const sql = postgres(databaseUrl, { max: 1, prepare: false });
    const contexts: BrowserContext[] = [];
    const artifacts: Array<{ file: string; sha256: string }> = [];
    const routeProof: Array<{ role: string; pathname: string; login: string }> = [];
    let renamedOperationalView = false;

    try {
      const persistedPinHash = await hashPin(pin, 12);
      const identities = [] as Array<(typeof users)[number] & { id: string }>;
      for (const user of users) {
        identities.push({ ...user, id: await createAuthUser(apiUrl, anonKey, user.email, user.password) });
      }
      for (const user of identities) {
        await sql`
          INSERT INTO public.app_users (id, tenant_id, email, full_name, role, active, pin_hash)
          VALUES (${user.id}::uuid, ${TENANT}, ${user.email}, ${user.name}, ${user.role}, true, ${user.login === "pin" ? persistedPinHash : null})
        `;
      }
      await sql`
        UPDATE public.app_users
        SET updated_at = statement_timestamp() - interval '5 seconds'
        WHERE id IN ${sql(identities.map((user) => user.id))}
      `;
      expect((await sql<Array<{ role: string }>>`
        SELECT role FROM public.app_users WHERE id IN ${sql(identities.map((user) => user.id))} ORDER BY role
      `).map((entry) => entry.role)).toEqual(["admin", "buero", "developer", "meister", "readonly", "werkstatt"]);

      const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
      deniedContext.setDefaultTimeout(30_000);
      contexts.push(deniedContext);
      const deniedPage = await deniedContext.newPage();
      const deniedResponse = await deniedPage.goto("/");
      await deniedPage.waitForURL((url) => url.pathname === "/start", { timeout: 30_000 });
      expect(deniedResponse?.status()).toBeLessThan(400);
      await expect(deniedPage.locator("body")).not.toContainText(/Wetter|Google|Kalender|Provider|NOT_AVAILABLE/i);
      artifacts.push(await capture(deniedPage, "a-start-denied-mobile-390x844.png"));

      for (const role of ["werkstatt", "buero"] as const) {
        const user = identities.find((candidate) => candidate.role === role)!;
        const emptyContext = await browser.newContext({ viewport: role === "werkstatt" ? { width: 390, height: 844 } : { width: 1914, height: 917 } });
        emptyContext.setDefaultTimeout(30_000);
        contexts.push(emptyContext);
        let emptyPage = await emptyContext.newPage();
        emptyPage = await loginWithPin(emptyPage, user.id, pin);
        if (role === "werkstatt") {
          await expect(emptyPage.getByRole("heading", { name: "Noch keine Daten erfasst" })).toBeVisible();
          artifacts.push(await capture(emptyPage, "a-phillip-empty-mobile-390x844.png"));
        } else {
          await expect(emptyPage.getByText("Heute liegt kein offener Auftrag vor.", { exact: true })).toBeVisible();
          artifacts.push(await capture(emptyPage, "a-rolf-empty-desktop-1914x917.png"));
        }
      }

      const admin = identities.find((candidate) => candidate.role === "admin")!;
      await seedPrerequisites(sql, admin.id);
      const setupContext = await browser.newContext({ viewport: { width: 1914, height: 917 } });
      setupContext.setDefaultTimeout(30_000);
      contexts.push(setupContext);
      const setupPage = await setupContext.newPage();
      await login(setupPage, admin.email, admin.password);
      await expect(setupPage).toHaveURL(/\/settings$/);
      routeProof.push({ role: admin.role, pathname: "/settings", login: admin.login });
      const critical = await createIntake(setupPage, `a-critical-${suffix}`, undefined, {
        dueDate: isoDateFromToday(-1), itemName: "Synthetischer kritischer Träger", surface: "Zink gelb",
        note: "Klar synthetischer lokaler A-Beleg: kritisch",
      });
      const bundleIncoming = await createIntake(setupPage, `a-bundle-in-${suffix}`, critical.customerName, {
        dueDate: isoDateFromToday(0), itemName: "Synthetische Bündelplatte A", surface: "Zink blau",
        note: "Klar synthetischer lokaler A-Beleg: Bündel A",
      });
      const bundleProduction = await createIntake(setupPage, `a-bundle-prod-${suffix}`, critical.customerName, {
        dueDate: isoDateFromToday(0), itemName: "Synthetische Bündelplatte B", surface: "Zink blau",
        note: "Klar synthetischer lokaler A-Beleg: Bündel B",
      });
      const wip = await createIntake(setupPage, `a-wip-${suffix}`, critical.customerName, {
        dueDate: isoDateFromToday(0), itemName: "Synthetischer Galvanik-WIP", surface: "Chrom matt",
        note: "Klar synthetischer lokaler A-Beleg: Galvanik WIP",
      });
      const finished = await createIntake(setupPage, `a-finished-${suffix}`, critical.customerName, {
        dueDate: isoDateFromToday(0), itemName: "Synthetischer Warenausgang", surface: "Nickel",
        note: "Klar synthetischer lokaler A-Beleg: Ware raus",
      });
      const intakes = { critical, bundleIncoming, bundleProduction, wip, finished };
      const orderRows = await sql<Array<{ order_id: string; order_number: string }>>`
        SELECT id AS order_id, order_number FROM public.orders
        WHERE tenant_id=${TENANT} AND order_number IN ${sql(Object.values(intakes).map((entry) => entry.orderNumber))}
      `;
      const orderIdByNumber = new Map(orderRows.map((row) => [row.order_number, row.order_id]));
      const orderId = orderIdByNumber.get(wip.orderNumber);
      const bundleProductionId = orderIdByNumber.get(bundleProduction.orderNumber);
      const finishedOrderId = orderIdByNumber.get(finished.orderNumber);
      if (!orderId || !bundleProductionId || !finishedOrderId || orderRows.length !== 5) {
        throw new Error("PATH1_UI_A_ORDER_READBACK_MISSING");
      }

      // Synthetic local fixture facts are persisted explicitly; product reads still use the canonical tenant view.
      await sql`
        UPDATE public.orders SET priority_computed = CASE order_number
          WHEN ${critical.orderNumber} THEN 'red'
          WHEN ${bundleIncoming.orderNumber} THEN 'orange'
          WHEN ${bundleProduction.orderNumber} THEN 'yellow'
          ELSE 'green'
        END
        WHERE tenant_id=${TENANT} AND order_number IN ${sql(Object.values(intakes).map((entry) => entry.orderNumber))}
      `;
      await transitionToGalvanik(setupPage, bundleProductionId);
      await transitionToGalvanik(setupPage, orderId);
      await transitionToGalvanik(setupPage, finishedOrderId);
      await setupPage.goto(`/orders/${finishedOrderId}`);
      const finishedCard = setupPage.getByTestId("order-card-v8");
      await expect(finishedCard.getByRole("button", { name: "Fertig melden & einfrieren" })).toBeEnabled();
      await finishedCard.getByRole("button", { name: "Fertig melden & einfrieren" }).click();
      await expect(finishedCard.getByText("Fertigstellung und Freeze bestätigt.")).toBeVisible({ timeout: 30_000 });

      const developer = identities.find((candidate) => candidate.role === "developer")!;
      const developerContext = await browser.newContext({ viewport: { width: 1914, height: 917 } });
      developerContext.setDefaultTimeout(30_000);
      contexts.push(developerContext);
      const developerPage = await developerContext.newPage();
      await login(developerPage, developer.email, developer.password);
      await expect(developerPage).toHaveURL(/\/settings$/);
      routeProof.push({ role: developer.role, pathname: "/settings", login: developer.login });

      const viewports = [
        { width: 1914, height: 917, label: "desktop-1914x917" },
        { width: 1220, height: 880, label: "tablet-1220x880" },
        { width: 390, height: 844, label: "mobile-390x844" },
      ] as const;
      for (const role of ["werkstatt", "buero", "meister", "readonly"] as const) {
        const user = identities.find((candidate) => candidate.role === role)!;
        const context = await browser.newContext({ viewport: { width: 1914, height: 917 } });
        context.setDefaultTimeout(30_000);
        contexts.push(context);
        let page = await context.newPage();
        page = await loginWithPin(page, user.id, pin);
        await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
        routeProof.push({ role, pathname: "/", login: user.login });

        for (const viewport of viewports) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          await page.goto("/");
          if (role === "werkstatt") {
            await expect(page.getByRole("heading", { name: "Werkstatt", exact: true })).toBeVisible();
            const actionBar = page.getByRole("navigation", { name: "Werkstattaktionen" });
            await expect(actionBar).toBeVisible();
            await expect(actionBar).toBeInViewport();
            await expect(page.getByText("Heute sichern", { exact: true })).toBeVisible();
            await expect(page.getByTestId("werkstatt-bundle")).toContainText("2 Aufträge mit");
            await expect(page.getByTestId("werkstatt-wip-tile")).toContainText("3");
            await expect(page.getByTestId("werkstatt-goods-out-tile")).toContainText("1");
            await expect(page.getByTestId("werkstatt-due-week-tile")).toContainText("4");
            for (const name of ["Auftrag öffnen / scannen", "Mehrarbeit", "Fertig melden", "Neuer Eingang", "Ware raus"]) {
              await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
            }
            await expect(page.getByRole("button", { name: "Neuer Eingang", exact: true })).toBeDisabled();
            artifacts.push(await capture(page, `a-phillip-${viewport.label}.png`));
          } else {
            await expect(page.getByRole("heading", { name: `Guten Tag, ${user.name}`, exact: true })).toBeVisible();
            await expect(page.getByRole("heading", { name: "Das braucht dich", exact: true })).toBeVisible();
            await expect(page.getByText("Kritisch", { exact: true })).toBeVisible();
            await expect(page.getByRole("button", { name: new RegExp(critical.orderNumber) })).toBeVisible();
            await expect(page.getByRole("button", { name: /Heute raus 1 fertig gemeldet/ })).toBeVisible();
            if (role === "readonly") {
              await expect(page.getByRole("navigation", { name: "Schnellaktionen" })).toHaveCount(0);
              await expect(page.getByRole("button", { name: /Neuer Eingang/ })).toHaveCount(0);
            } else {
              await expect(page.getByRole("navigation", { name: "Schnellaktionen" })).toBeVisible();
            }
            if (role === "readonly") {
              await expect(page.getByRole("link", { name: /Geld|Rechnung/i })).toHaveCount(0);
            } else {
              await expect(page.getByRole("link", { name: /Geld|Rechnung/i }).first()).toHaveAttribute("href", "/buchhaltung/rechnungen");
            }
            artifacts.push(await capture(page, `a-rolf-${role}-${viewport.label}.png`));
          }
          await expectNoHorizontalOverflow(page);
        }

        if (role === "buero") {
          await page.setViewportSize({ width: 1914, height: 917 });
          await page.goto("/");
          expect(await exerciseRolfNavigation(page, false)).toEqual(["/", "/warendurchlauf", "/orders", "/customers", "/buchhaltung/rechnungen"]);
          await page.setViewportSize({ width: 390, height: 844 });
          await page.goto("/");
          expect(await exerciseRolfNavigation(page, true)).toEqual(["/", "/orders", "/customers", "/buchhaltung/rechnungen", "/warendurchlauf"]);
        }

        if (role === "werkstatt") {
          await page.setViewportSize({ width: 1914, height: 917 });
          await page.goto("/");
          for (const action of ["Auftrag öffnen / scannen", "Mehrarbeit", "Fertig melden"] as const) {
            await page.getByRole("button", { name: action, exact: true }).click();
            const picker = page.getByRole("dialog", { name: "Auftrag öffnen" });
            await expect(picker).toBeVisible();
            await picker.getByTestId(`order-picker-order-${orderId}`).click();
            await expect(page.getByTestId("order-card-v8")).toBeVisible();
            await page.getByTestId("order-card-v8").getByRole("button", { name: "Schließen / zurück" }).click();
          }
          await expect(page.getByRole("button", { name: "Neuer Eingang", exact: true })).toBeDisabled();
          await page.getByRole("button", { name: "Ware raus", exact: true }).click();
          const goodsOutPicker = page.getByRole("dialog", { name: "Ware raus" });
          await expect(goodsOutPicker.getByTestId(`goods-out-picker-order-${finishedOrderId}`)).toBeVisible();
          await goodsOutPicker.getByTestId(`goods-out-picker-order-${finishedOrderId}`).click();
          await expect(page.getByTestId("order-card-v8")).toBeVisible();
          await expect(page.getByTestId("order-card-v8")).toContainText(finished.orderNumber);
          await page.getByTestId("order-card-v8").getByRole("button", { name: "Schließen / zurück" }).click();
        }

        if (role === "buero") {
          await page.setViewportSize({ width: 1914, height: 917 });
          await page.goto("/");
          const quickActions = page.getByRole("navigation", { name: "Schnellaktionen" });
          await quickActions.getByRole("button", { name: /Ware raus/ }).click();
          const goodsOutDialog = page.getByRole("dialog", { name: "Ware raus" });
          await expect(goodsOutDialog.getByRole("button", { name: new RegExp(finished.orderNumber) })).toBeVisible();
          await goodsOutDialog.getByRole("button", { name: new RegExp(finished.orderNumber) }).click();
          await expect(page.getByTestId("order-card-v8")).toContainText(finished.orderNumber);
          await page.getByTestId("order-card-v8").getByRole("button", { name: "Schließen / zurück" }).click();
        }
      }

      const retiredRoutes = [
        "/analyse", "/cockpit", "/kontrolle", "/performance", "/status", "/marketing",
        "/baeder", "/betrieb", "/betrieb-kvp", "/kvp", "/today", "/finanzen",
        "/kunden-auftraege", "/print-queue", "/feedback", "/archive", "/lager",
        "/lieferanten", "/telefonnotiz", "/items", "/kalender", "/station/galvanik",
        "/scan", "/kommunikation", "/quotes",
      ];
      for (const pathname of retiredRoutes) {
        const response = await setupPage.goto(pathname);
        expect(response?.status(), `${pathname} must fail closed`).toBe(404);
        await expect(setupPage.locator("body")).not.toContainText(/Google Calendar|NOT_AVAILABLE|kommt bald/i);
      }

      const buero = identities.find((candidate) => candidate.role === "buero")!;
      const errorContext = await browser.newContext({ viewport: { width: 1914, height: 917 } });
      errorContext.setDefaultTimeout(30_000);
      contexts.push(errorContext);
      let errorPage = await errorContext.newPage();
      errorPage = await loginWithPin(errorPage, buero.id, pin);
      await sql`ALTER VIEW private.v_operational_station_queue_v1 RENAME TO v_operational_station_queue_v1_path1_a_fault`;
      renamedOperationalView = true;
      await errorPage.goto("/");
      await expect(errorPage.getByRole("alert").filter({ hasText: "Tagesansicht nicht verfügbar" })).toContainText("Tagesansicht nicht verfügbar");
      artifacts.push(await capture(errorPage, "a-rolf-error-desktop-1914x917.png"));

      const werkstatt = identities.find((candidate) => candidate.role === "werkstatt")!;
      const werkstattErrorContext = await browser.newContext({ viewport: { width: 1914, height: 917 } });
      werkstattErrorContext.setDefaultTimeout(30_000);
      contexts.push(werkstattErrorContext);
      let werkstattErrorPage = await werkstattErrorContext.newPage();
      werkstattErrorPage = await loginWithPin(werkstattErrorPage, werkstatt.id, pin);
      await werkstattErrorPage.goto("/");
      await expect(werkstattErrorPage.getByRole("alert").filter({ hasText: "Werkstattdaten konnten nicht sicher geladen werden" })).toContainText("Werkstattdaten konnten nicht sicher geladen werden");
      artifacts.push(await capture(werkstattErrorPage, "a-phillip-error-desktop-1914x917.png"));
      await sql`ALTER VIEW private.v_operational_station_queue_v1_path1_a_fault RENAME TO v_operational_station_queue_v1`;
      renamedOperationalView = false;

      const referenceContext = await browser.newContext({ viewport: { width: 1914, height: 917 } });
      referenceContext.setDefaultTimeout(30_000);
      contexts.push(referenceContext);
      const referencePage = await referenceContext.newPage();
      for (const viewport of viewports) {
        await referencePage.setViewportSize({ width: viewport.width, height: viewport.height });
        artifacts.push(await captureReference(referencePage, "docs/project/linie/ui/KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html", `a-reference-phillip-${viewport.label}.png`));
        artifacts.push(await captureReference(referencePage, "docs/project/linie/ui/KREILE_STARTSEITE_ROLF_V8_2026-08-20.html", `a-reference-rolf-${viewport.label}.png`));
      }

      const receiptPath = path.join(EVIDENCE_DIR, "a-real-browser-receipt.json");
      const testedCodeCommit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
      writeFileSync(receiptPath, `${JSON.stringify({
        source: "fresh local Supabase + real auth/session + role-aware root + target navigation",
        loopbackSessionTransport: {
          used: loopbackSecureCookieReplayUsed,
          invariant: "byte-identical signed server cookie; Secure removed only for localhost HTTP replay",
        },
        testedCodeCommit,
        canonicalRoles: users.map((user) => user.role),
        routeProof,
        syntheticData: {
          tenant: TENANT,
          intakePath: "real OrderIntake UI/command",
          stationPath: "real station handoff command",
          finishPath: "real V8 freeze command/readback",
          orders: Object.fromEntries(Object.entries(intakes).map(([purpose, entry]) => [purpose, {
            orderNumber: entry.orderNumber,
            orderId: orderIdByNumber.get(entry.orderNumber),
          }])),
          persistedRiskFixture: { critical: "red", bundleIncoming: "orange", bundleProduction: "yellow" },
          sameSurfaceBundle: "Zink blau",
          goodsOutCandidates: 1,
          canonicalWipCount: 3,
          dueThisWeek: 4,
        },
        states: ["data", "empty", "denied", "error", "conflict (focused contract test)"],
        visibleNavigation: ["/", "/warendurchlauf", "/orders", "/customers", "/buchhaltung/rechnungen"],
        retiredRoutes,
        viewports: viewports.map((viewport) => `${viewport.width}x${viewport.height}`),
        references: [
          "KREILE_STARTSEITE_PHILLIP_V4_2026-08-20.html",
          "KREILE_STARTSEITE_ROLF_V8_2026-08-20.html",
          "KREILE_AUFTRAGSKARTE_MACHART_V8_2026-08-19.html (existing B/C evidence)",
          "KREILE_KUNDENKARTE_MACHART_V2_2026-08-19.html (existing B/C evidence)",
        ],
        artifacts,
      }, null, 2)}\n`);
      const receiptHash = createHash("sha256").update(readFileSync(receiptPath)).digest("hex");
      writeFileSync(path.join(EVIDENCE_DIR, "a-real-browser-receipt.sha256"), `${receiptHash}  a-real-browser-receipt.json\n`);
    } finally {
      if (renamedOperationalView) {
        await sql`ALTER VIEW private.v_operational_station_queue_v1_path1_a_fault RENAME TO v_operational_station_queue_v1`;
      }
      await Promise.all(contexts.map((context) => context.close()));
      await sql.end({ timeout: 5 });
    }
  });
});

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
      let readonlyPage = await readonlyContext.newPage();
      readonlyPage = await loginWithPin(readonlyPage, readonlyId, "4827");
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
