import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createPinLoginHandle } from "../src/lib/server/pinLoginHandle";

const TENANT = "galvanik-kreile";
const V5_SHA256 = "75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA";
const ROLF_ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const PHILLIP_ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const GREGOR_ACTOR_ID = "33333333-3333-4333-8333-333333333333";
const TEST_ORIGIN = process.env.A3_TEST_ORIGIN?.trim() || "https://localhost:3443";
const OUTPUT_DIR = path.resolve(
  process.env.A3_EVIDENCE_OUTPUT_DIR?.trim() ||
    path.join(process.cwd(), "docs/evidence/path1/artifacts/v5-a-shell-homes-nav"),
);
const STAGING_DIR = path.resolve(process.cwd(), "test-results/path1-v5-a3-shell-homes-nav");

const VIEWPORTS = [
  { name: "desktop", width: 1914, height: 917 },
  { name: "tablet", width: 1220, height: 880 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const RETIRED_ROUTES = [
  "/admin/analytics",
  "/admin/devices",
  "/admin/import",
  "/admin/testanalyse",
  "/admin/testanalyse/live",
  "/analyse",
  "/archive",
  "/baeder",
  "/betrieb",
  "/betrieb-kvp",
  "/buchhaltung/ausgaben",
  "/buchhaltung/belege",
  "/buchhaltung/belege/neu",
  "/buchhaltung/belege/synthetic-id",
  "/buchhaltung/bwa",
  "/buchhaltung/einstellungen",
  "/buchhaltung/export",
  "/buchhaltung/fristen",
  "/buchhaltung/kosten",
  "/buchhaltung/kosten/neu",
  "/buchhaltung/kosten/synthetic-id",
  "/buchhaltung/kraftstoff",
  "/buchhaltung/periodenabschluss",
  "/buchhaltung/rechnungen/neu",
  "/buchhaltung/rechnungen/synthetic-id",
  "/buchhaltung/steuerprofil",
  "/cockpit",
  "/cockpit/jahresplan",
  "/feedback/synthetic-token",
  "/finanzen",
  "/items",
  "/kalender",
  "/kommunikation",
  "/kontrolle",
  "/kunden-auftraege",
  "/kvp",
  "/lager",
  "/lieferanten",
  "/lieferanten/synthetic-id",
  "/marketing",
  "/marketing/aktion",
  "/marketing/aktion/neu",
  "/marketing/attribution",
  "/marketing/einwilligungen",
  "/marketing/kanaele",
  "/marketing/segmente",
  "/marketing/segmente/neu",
  "/marketing/segmente/synthetic-id",
  "/performance",
  "/performance/baeder-material",
  "/performance/ki-empfehlungen",
  "/performance/kunden-markt",
  "/performance/qualitaet-risiko",
  "/performance/umsatz-marge",
  "/performance/werkstatt-puls",
  "/print-queue",
  "/scan",
  "/station/wareneingang",
  "/status",
  "/telefonnotiz",
  "/today",
] as const;

type AuthSignupResponse = { user?: { id?: string }; message?: string };
type Capture = { file: string; sha256: string; viewport: string; state: string };
type Readback = { orderId: string; orderNumber: string; exactlyOne: number };

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PATH1_A3_ENV_MISSING:${name}`);
  return value;
}

async function createLocalAuthUser(apiUrl: string, anonKey: string, email: string, password: string) {
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
    throw new Error(`PATH1_A3_LOCAL_AUTH_SIGNUP_FAILED:${response.status}:${body.message ?? "invalid response"}`);
  }
}

async function assertSignedSession(page: Page, actorId: string, sessionSecret: string) {
  const cookie = (await page.context().cookies(TEST_ORIGIN)).find(
    (candidate) => candidate.name === "kreile_app_session",
  );
  if (!cookie?.httpOnly || !cookie.secure) throw new Error("PATH1_A3_SESSION_COOKIE_INVALID");
  const token = decodeURIComponent(cookie.value);
  const separator = token.lastIndexOf(".");
  if (separator <= 0) throw new Error("PATH1_A3_SESSION_COOKIE_MALFORMED");
  const payloadText = Buffer.from(token.slice(0, separator), "base64").toString("utf8");
  const signature = Buffer.from(token.slice(separator + 1), "hex");
  const expected = createHmac("sha256", sessionSecret).update(payloadText).digest();
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    throw new Error("PATH1_A3_SESSION_SIGNATURE_INVALID");
  }
  const payload = JSON.parse(payloadText) as { userId?: unknown; tenantId?: unknown };
  expect(payload).toMatchObject({ userId: actorId, tenantId: TENANT });
}

async function loginPin(page: Page, actorId: string, pin: string, sessionSecret: string) {
  await page.goto("/start", { waitUntil: "networkidle" });
  await page.getByTestId(`pin-user-card-${createPinLoginHandle(actorId)}`).click();
  const dialog = page.getByTestId("pin-login-dialog");
  await expect(dialog).toBeVisible();
  const destination = page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  for (const digit of pin) {
    await dialog.getByRole("button", { name: digit, exact: true }).click();
  }
  await destination;
  await page.waitForLoadState("networkidle");
  await assertSignedSession(page, actorId, sessionSecret);
}

async function loginGregor(
  page: Page,
  email: string,
  password: string,
  sessionSecret: string,
) {
  await page.goto("/start", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Gregor/ }).click();
  const dialog = page.getByTestId("email-login-dialog");
  await dialog.locator("#email").fill(email);
  await dialog.locator("#password").fill(password);
  const destination = page.waitForURL((url) => url.pathname === "/settings", { timeout: 30_000 });
  await dialog.getByRole("button", { name: "Einloggen", exact: true }).click();
  await destination;
  await page.waitForLoadState("networkidle");
  await assertSignedSession(page, GREGOR_ACTOR_ID, sessionSecret);
}

async function capture(page: Page, file: string, state: string): Promise<Capture> {
  mkdirSync(STAGING_DIR, { recursive: true });
  const target = path.join(STAGING_DIR, file);
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  )).toBe(true);
  await page.screenshot({ path: target, fullPage: false });
  const viewport = page.viewportSize();
  return {
    file,
    sha256: createHash("sha256").update(readFileSync(target)).digest("hex"),
    viewport: `${viewport?.width ?? 0}x${viewport?.height ?? 0}`,
    state,
  };
}

async function newContext(browser: Browser, viewport = VIEWPORTS[0]) {
  const context = await browser.newContext({ viewport });
  return { context, page: await context.newPage() };
}

function localIsoDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function createIntake(
  page: Page,
  sql: ReturnType<typeof postgres>,
  suffix: string,
  index: number,
): Promise<Readback> {
  await page.getByRole("button", { name: "Neuer Eingang", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Neuer Eingang", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Neukunde", exact: true }).click();
  await page.getByLabel("Firma / Name").fill(`SYNTHETISCH A3 Kunde ${index} ${suffix}`);
  await page.getByLabel("Terminwunsch").fill(localIsoDate(0));
  await page.getByLabel("Zugesagter Termin").fill(localIsoDate(1));
  await page.getByLabel("Teil / Bezeichnung").fill(`SYNTHETISCHES A3 Teil ${index} ${suffix}`);
  await page.getByLabel("Menge").fill(String(index));
  await page.getByLabel("Material").fill("Stahl");
  await page.getByLabel("Oberfläche").fill("Verzinken");
  await page.getByRole("button", { name: "Eingang speichern", exact: true }).click();

  const heading = page.getByRole("heading", { name: /^Auftrag A-\d{4}-\d+ angelegt$/ });
  await expect(heading).toBeVisible();
  const orderNumber = (await heading.textContent())!
    .replace(/^Auftrag /, "")
    .replace(/ angelegt$/, "")
    .trim();
  const receipt = page.getByRole("group", { name: /technische Details für Support/i });
  await expect(receipt).toBeVisible();
  await receipt.locator("summary").click();
  await expect(receipt.locator("dd")).toHaveCount(2);
  expect((await receipt.locator("dd").allTextContents()).every(Boolean)).toBe(true);

  const [stored] = await sql<{ order_id: string; count: number }[]>`
    SELECT min(id::text) AS order_id, count(*)::integer AS count
    FROM public.orders
    WHERE tenant_id = ${TENANT} AND order_number = ${orderNumber}
  `;
  expect(stored?.count).toBe(1);
  if (!stored?.order_id) throw new Error("PATH1_A3_ORDER_READBACK_MISSING");
  await page.getByRole("button", { name: "Anlegen schließen", exact: true }).click();
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByTestId("rolf-v8-home")).toContainText(orderNumber);
  return { orderId: stored.order_id, orderNumber, exactlyOne: stored.count };
}

async function clickRolfNavigation(page: Page) {
  const targets = [
    ["Werkstatt", "/warendurchlauf"],
    ["Aufträge", "/orders"],
    ["Kunden & Kontakt", "/customers"],
    ["Geld & Rechnungen", "/buchhaltung/rechnungen"],
  ] as const;
  for (const [name, pathname] of targets) {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("link", { name, exact: true }).click();
    await page.waitForURL((url) => url.pathname === pathname);
  }
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Suche öffnen" }).click();
  await expect(page.getByRole("dialog", { name: "Kunden und Aufträge" })).toBeVisible();
  await page.getByRole("button", { name: "Suche schließen" }).click();
  await page.getByRole("button", { name: "Anlegen", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Was (?:möchtest du|möchten Sie) anlegen\?/i })).toBeVisible();
  await page.getByRole("button", { name: "Anlegen schließen", exact: true }).click();
}

async function clickRolfMobileNavigation(page: Page) {
  await page.setViewportSize(VIEWPORTS[2]);
  const targets = [
    ["Aufträge", "/orders"],
    ["Kunden", "/customers"],
    ["Geld", "/buchhaltung/rechnungen"],
  ] as const;
  for (const [name, pathname] of targets) {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByRole("navigation", { name: "Mobile Hauptnavigation" })
      .getByRole("link", { name, exact: true })
      .click();
    await page.waitForURL((url) => url.pathname === pathname);
  }
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Mehr", exact: true }).click();
  const more = page.getByRole("dialog", { name: "Weitere Kernbereiche" });
  await more.getByRole("link", { name: "Werkstatt", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/warendurchlauf");
}

async function clickPhillipActions(page: Page) {
  const bar = page.getByRole("navigation", { name: "Werkstattaktionen" });
  await expect(bar.getByRole("button")).toHaveCount(5);
  for (const name of ["Auftrag öffnen / scannen", "Mehrarbeit", "Fertig melden", "Ware raus"]) {
    await bar.getByRole("button", { name, exact: true }).click();
    const dialog = page.getByRole("dialog", { name: /Auftrag öffnen|Ware raus/ });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  }
  await bar.getByRole("button", { name: "Neuer Eingang", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Neuer Eingang", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Anlegen schließen", exact: true }).click();
  await page.getByTestId("werkstatt-bundle").getByRole("button").click();
  await expect(page.getByTestId("werkstatt-bundle").getByRole("button")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("werkstatt-wip-tile").click();
  await page.waitForURL((url) => url.pathname === "/warendurchlauf/galvanik");
}

test.describe("PATH1 A3 – V5 Shell, Rollen-Homes und Navigation", () => {
  test.use({ baseURL: TEST_ORIGIN, ignoreHTTPSErrors: true });

  test("belegt die drei Rollen, responsive V5-Flächen, echte Readbacks und 404-Quarantäne", async ({ browser }) => {
    test.setTimeout(420_000);
    const databaseUrl = requiredEnv("DATABASE_URL");
    const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const sessionSecret = requiredEnv("APP_SESSION_SECRET");
    expect(TEST_ORIGIN).toMatch(/^https:\/\/localhost:\d+$/);
    expect(databaseUrl).toMatch(/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/);
    expect(apiUrl).toMatch(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/);
    expect(process.env.KREILE_ROLF_APP_USER_ID).toBe(ROLF_ACTOR_ID);
    expect(process.env.KREILE_PHILLIP_APP_USER_ID).toBe(PHILLIP_ACTOR_ID);
    expect(process.env.KREILE_GREGOR_APP_USER_ID).toBe(GREGOR_ACTOR_ID);
    expect(RETIRED_ROUTES).toHaveLength(61);

    const suffix = `${Date.now()}-${process.pid}`;
    const rolfPin = "4186";
    const phillipPin = "7315";
    const gregorEmail = `a3-gregor-${suffix}@local.test`;
    const gregorPassword = `A3-Gregor-${suffix}!`;
    const sql = postgres(databaseUrl, { max: 2, prepare: false });
    const contexts: BrowserContext[] = [];
    const captures: Capture[] = [];
    const browserErrors: string[] = [];

    try {
      await createLocalAuthUser(apiUrl, anonKey, gregorEmail, gregorPassword);
      const insertedAt = new Date(Date.now() - 5_000).toISOString();
      await sql`
        INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, created_at, updated_at)
        VALUES
          (${ROLF_ACTOR_ID}::uuid, ${TENANT}, ${`a3-rolf-${suffix}@local.test`}, 'Rolf', 'meister', ${await bcrypt.hash(rolfPin, 12)}, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz),
          (${PHILLIP_ACTOR_ID}::uuid, ${TENANT}, ${`a3-phillip-${suffix}@local.test`}, 'Phillip', 'werkstatt', ${await bcrypt.hash(phillipPin, 12)}, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz),
          (${GREGOR_ACTOR_ID}::uuid, ${TENANT}, ${gregorEmail}, 'Gregor', 'admin', null, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz)
        ON CONFLICT (id) DO UPDATE SET
          email = excluded.email,
          full_name = excluded.full_name,
          role = excluded.role,
          pin_hash = excluded.pin_hash,
          active = excluded.active,
          updated_at = excluded.updated_at
      `;

      const start = await newContext(browser);
      contexts.push(start.context);
      for (const viewport of VIEWPORTS) {
        await start.page.setViewportSize(viewport);
        await start.page.goto("/start", { waitUntil: "networkidle" });
        await expect(start.page.getByRole("heading", { name: "Wer arbeitet gerade?" })).toBeVisible();
        await expect(start.page.getByText(/Wähle deinen Namen und melde dich an\./)).toBeVisible();
        await expect(start.page.getByRole("button", { name: /Rolf/ })).toBeVisible();
        await expect(start.page.getByRole("button", { name: /Phillip/ })).toBeVisible();
        await expect(start.page.getByRole("button", { name: /Gregor/ })).toBeVisible();
        await expect(start.page.locator("main button")).toHaveCount(3);
        captures.push(await capture(start.page, `a-start-${viewport.name}-${viewport.width}x${viewport.height}.png`, "start-login-only"));
      }

      const rolf = await newContext(browser);
      contexts.push(rolf.context);
      rolf.page.on("pageerror", (error) => browserErrors.push(`Rolf:${error.message}`));
      await loginPin(rolf.page, ROLF_ACTOR_ID, rolfPin, sessionSecret);
      await expect(rolf.page.getByRole("heading", { name: "Guten Tag, Rolf" })).toBeVisible();
      const readbacks = [
        await createIntake(rolf.page, sql, suffix, 1),
        await createIntake(rolf.page, sql, suffix, 2),
      ];
      for (const viewport of VIEWPORTS) {
        await rolf.page.setViewportSize(viewport);
        await rolf.page.goto("/", { waitUntil: "networkidle" });
        await expect(rolf.page.getByTestId("rolf-v8-home")).toContainText(readbacks[0].orderNumber);
        await expect(rolf.page.locator("body")).not.toContainText(/Geplant|kommt bald/i);
        captures.push(await capture(rolf.page, `a-rolf-${viewport.name}-${viewport.width}x${viewport.height}.png`, "rolf-v8-real-projection"));
      }
      await rolf.page.setViewportSize(VIEWPORTS[0]);
      await clickRolfNavigation(rolf.page);
      await clickRolfMobileNavigation(rolf.page);

      const phillip = await newContext(browser);
      contexts.push(phillip.context);
      phillip.page.on("pageerror", (error) => browserErrors.push(`Phillip:${error.message}`));
      await loginPin(phillip.page, PHILLIP_ACTOR_ID, phillipPin, sessionSecret);
      await expect(phillip.page.getByRole("heading", { name: "Werkstatt", exact: true })).toBeVisible();
      await expect(phillip.page.getByTestId("werkstatt-status")).toHaveCount(1);
      await expect(phillip.page.getByTestId("werkstatt-status")).toBeVisible();
      await expect(phillip.page.getByRole("heading", { name: "Heute sichern" })).toBeVisible();
      await expect(phillip.page.getByTestId("werkstatt-bundle")).toBeVisible();
      await expect(phillip.page.getByTestId("werkstatt-wip-tile")).toHaveCount(1);
      await expect(phillip.page.locator("body")).not.toContainText(/Geld|Stationsband/i);
      for (const viewport of VIEWPORTS) {
        await phillip.page.setViewportSize(viewport);
        await phillip.page.goto("/", { waitUntil: "networkidle" });
        captures.push(await capture(phillip.page, `a-phillip-${viewport.name}-${viewport.width}x${viewport.height}.png`, "phillip-v4-real-projection"));
      }
      await phillip.page.setViewportSize(VIEWPORTS[0]);
      await phillip.page.goto("/", { waitUntil: "networkidle" });
      await clickPhillipActions(phillip.page);

      const gregor = await newContext(browser);
      contexts.push(gregor.context);
      await loginGregor(gregor.page, gregorEmail, gregorPassword, sessionSecret);
      await expect(gregor.page.getByTestId("gregor-system-admin")).toBeVisible();
      await gregor.page.goto("/", { waitUntil: "networkidle" });
      await gregor.page.waitForURL((url) => url.pathname === "/settings");
      await expect(gregor.page.locator('a[href="/orders"], a[href="/customers"], a[href="/warendurchlauf"]')).toHaveCount(0);

      const retiredResults: Array<{ path: string; status: number }> = [];
      const retired = await rolf.context.newPage();
      try {
        for (const retiredPath of RETIRED_ROUTES) {
          const response = await retired.goto(retiredPath, { waitUntil: "domcontentloaded" });
          const status = response?.status() ?? 0;
          retiredResults.push({ path: retiredPath, status });
          expect(status, `${retiredPath} muss ein echter 404 sein`).toBe(404);
        }
      } finally {
        await retired.close();
      }

      expect(browserErrors).toEqual([]);
      const candidateCodeSha = requiredEnv("A3_CANDIDATE_SHA");
      expect(candidateCodeSha).toMatch(/^[0-9a-f]{40}$/);
      const receipt = {
        candidateCodeShaAtRun: candidateCodeSha,
        v5ReferenceSha256: V5_SHA256,
        evidenceScope: "SYNTHETIC_LOCAL_FIXTURE",
        productionReadiness: "OPEN",
        synthetic: true,
        tenant: TENANT,
        actors: { rolf: "READY", phillip: "READY", gregor: "READY" },
        commandReadbacks: readbacks,
        dRes001: "COMMAND_RECEIPT_AND_EXACTLY_ONE_READBACK",
        captures,
        retiredResults,
      };
      mkdirSync(OUTPUT_DIR, { recursive: true });
      for (const captured of captures) {
        copyFileSync(path.join(STAGING_DIR, captured.file), path.join(OUTPUT_DIR, captured.file));
      }
      writeFileSync(path.join(OUTPUT_DIR, "a-browser-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
      console.log(`PATH1_V5_A3_RECEIPT=${JSON.stringify(receipt)}`);
    } finally {
      await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
      await sql.end();
    }
  });
});
