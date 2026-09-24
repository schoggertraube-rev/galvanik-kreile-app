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
    path.join(process.cwd(), "test-results/path1-v5-a3-shell-homes-nav/screens"),
);
const STAGING_DIR = path.resolve(process.cwd(), "test-results/path1-v5-a3-shell-homes-nav/staging");

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
type PinInputMode = "keyboard" | "touch";
type PinProof = { actorId: string; viewport: string; mode: PinInputMode; submits: number };

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PATH1_A3_ENV_MISSING:${name}`);
  return value;
}

function requireSha(value: string, label: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(normalized)) {
    throw new Error(`PATH1_A3_INVALID_SHA:${label}`);
  }
  return normalized;
}

function readCheckoutSha(): string {
  const gitDirectory = path.resolve(process.cwd(), ".git");
  const head = readFileSync(path.join(gitDirectory, "HEAD"), "utf8").trim();
  if (!head.startsWith("ref: ")) return requireSha(head, "DETACHED_HEAD");

  const reference = head.slice("ref: ".length).trim();
  try {
    return requireSha(readFileSync(path.join(gitDirectory, reference), "utf8"), reference);
  } catch (error) {
    const packedReferences = readFileSync(path.join(gitDirectory, "packed-refs"), "utf8");
    const packed = packedReferences
      .split(/\r?\n/)
      .find((line) => !line.startsWith("#") && !line.startsWith("^") && line.endsWith(` ${reference}`));
    if (!packed) throw error;
    return requireSha(packed.slice(0, 40), reference);
  }
}

function readBuildBinding() {
  const nextDirectory = path.resolve(process.cwd(), ".next");
  const files = ["BUILD_ID", "build-manifest.json"] as const;
  const digest = createHash("sha256");
  for (const file of files) {
    digest.update(file);
    digest.update("\0");
    digest.update(readFileSync(path.join(nextDirectory, file)));
    digest.update("\0");
  }
  const buildId = readFileSync(path.join(nextDirectory, "BUILD_ID"), "utf8").trim();
  if (!buildId) throw new Error("PATH1_A3_BUILD_ID_MISSING");
  return { buildId, artifactSha256: digest.digest("hex"), files };
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

async function loginPin(
  page: Page,
  actorId: string,
  pin: string,
  sessionSecret: string,
  mode: PinInputMode = "touch",
): Promise<PinProof> {
  await page.goto("/start", { waitUntil: "networkidle" });
  await page.getByTestId(`pin-user-card-${createPinLoginHandle(actorId)}`).click();
  const dialog = page.getByTestId("pin-login-dialog");
  await expect(dialog).toBeVisible();
  let submits = 0;
  const countSubmit = (request: { method: () => string }) => {
    if (request.method() === "POST") submits += 1;
  };
  page.on("request", countSubmit);
  const destination = page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  if (mode === "touch") {
    await dialog.getByRole("button", { name: pin[0], exact: true }).click();
    await expect(dialog.getByLabel("1 von 4 Stellen eingegeben")).toBeVisible();
    await dialog.getByRole("button", { name: "Löschen", exact: true }).click();
    await expect(dialog.getByLabel("0 von 4 Stellen eingegeben")).toBeVisible();
    for (const digit of pin) await dialog.getByRole("button", { name: digit, exact: true }).click();
  } else {
    await page.keyboard.press(pin[0]);
    await expect(dialog.getByLabel("1 von 4 Stellen eingegeben")).toBeVisible();
    await page.keyboard.press("Backspace");
    await expect(dialog.getByLabel("0 von 4 Stellen eingegeben")).toBeVisible();
    for (const digit of pin) {
      await page.evaluate((value) => {
        window.dispatchEvent(new KeyboardEvent("keydown", {
          bubbles: true,
          code: `Numpad${value}`,
          key: "Unidentified",
        }));
      }, digit);
    }
  }
  await destination;
  await page.waitForLoadState("networkidle");
  page.off("request", countSubmit);
  expect(submits).toBe(1);
  await assertSignedSession(page, actorId, sessionSecret);
  const viewport = page.viewportSize();
  return {
    actorId,
    viewport: `${viewport?.width ?? 0}x${viewport?.height ?? 0}`,
    mode,
    submits,
  };
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

async function newContext(browser: Browser, viewport: { width: number; height: number } = VIEWPORTS[0]) {
  const context = await browser.newContext({ viewport });
  return { context, page: await context.newPage() };
}

async function assertMoreMenu(page: Page) {
  await page.getByRole("button", { name: "Mehr", exact: true }).click();
  const more = page.getByRole("dialog", { name: "Mehr", exact: true });
  await expect(more).toBeVisible();
  await expect(more.getByRole("heading", { name: "Mehr", exact: true })).toBeVisible();
  await expect(more.getByText("Seltene Funktionen eine Ebene tiefer.")).toBeVisible();
  for (const label of ["Infos rein", "Werkstatt", "Einstellungen", "Abmelden"])
    await expect(more.getByText(label, { exact: true })).toBeVisible();
  await more.getByRole("button", { name: "Schließen", exact: true }).click();
}

async function assertRolfChrome(page: Page, viewport: (typeof VIEWPORTS)[number]) {
  const quickActions = page
    .getByTestId("rolf-v8-home")
    .getByRole("navigation", { name: "Schnellaktionen", exact: true });
  if (viewport.width >= 1300) {
    const sidebar = page.getByRole("navigation", { name: "Hauptnavigation", exact: true });
    await expect(sidebar).toBeVisible();
    await expect(sidebar.locator(":scope > *")).toHaveCount(8);
    await expect(page.getByRole("navigation", { name: "Mobile Hauptnavigation", exact: true })).toBeHidden();
    await expect(quickActions).toBeHidden();
  } else {
    const dock = page.getByRole("navigation", { name: "Mobile Hauptnavigation", exact: true });
    await expect(dock).toBeVisible();
    await expect(dock.locator(":scope > *")).toHaveCount(5);
    await expect(page.getByRole("navigation", { name: "Hauptnavigation", exact: true })).toBeHidden();
    await expect(quickActions).toBeVisible();
  }
}

async function assertNoFloatingActionOverlap(page: Page) {
  const overlaps = await page.evaluate(() => {
    const create = document.querySelector<HTMLButtonElement>('button[aria-label="Anlegen"]')
      ?? [...document.querySelectorAll<HTMLButtonElement>("button")].find((button) => button.textContent?.trim() === "Anlegen");
    if (!create) return ["Anlegen fehlt"];
    const createRect = create.getBoundingClientRect();
    const candidates = [...document.querySelectorAll<HTMLElement>('[data-testid="rolf-v8-home"] button, [data-testid="rolf-v8-home"] a, nav[aria-label="Mobile Hauptnavigation"]')];
    return candidates.flatMap((candidate) => {
      const style = getComputedStyle(candidate);
      const rect = candidate.getBoundingClientRect();
      if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) return [];
      const intersects = createRect.left < rect.right && createRect.right > rect.left
        && createRect.top < rect.bottom && createRect.bottom > rect.top;
      return intersects ? [candidate.getAttribute("aria-label") ?? candidate.textContent?.trim() ?? candidate.tagName] : [];
    });
  });
  expect(overlaps).toEqual([]);
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
    ["Ware raus", "/orders"],
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
  await page.goto("/orders", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Der Tag", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await page.getByRole("link", { name: "Einstellungen", exact: true }).click();
  await page.waitForLoadState("networkidle");
  expect(new URL(page.url()).pathname).toBe("/");
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Suche öffnen" }).click();
  await expect(page.getByRole("dialog", { name: "Kunden und Aufträge" })).toBeVisible();
  await page.getByRole("button", { name: "Suche schließen" }).click();
  await page.getByRole("button", { name: "Anlegen", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Was möchtest du anlegen\?/i })).toBeVisible();
  await page.getByRole("button", { name: "Anlegen schließen", exact: true }).click();
}

async function clickSharedMorePaths(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Mehr öffnen", exact: true }).click();
  await page.getByRole("dialog", { name: "Mehr", exact: true }).getByRole("button", { name: /^Infos rein/ }).click();
  await expect(page.getByRole("dialog", { name: /Was möchtest du anlegen\?/i })).toBeVisible();
  await page.getByRole("button", { name: "Anlegen schließen", exact: true }).click();

  await page.getByRole("button", { name: "Mehr öffnen", exact: true }).click();
  await page.getByRole("dialog", { name: "Mehr", exact: true }).locator('a[href="/warendurchlauf"]').click();
  await page.waitForURL((url) => url.pathname === "/warendurchlauf");

  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Mehr öffnen", exact: true }).click();
  await page.getByRole("dialog", { name: "Mehr", exact: true }).locator('a[href="/settings"]').click();
  await page.waitForLoadState("networkidle");
  expect(new URL(page.url()).pathname).toBe("/");
}

async function clickSharedMoreLogout(page: Page) {
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Mehr öffnen", exact: true }).click();
  const destination = page.waitForURL((url) => url.pathname === "/start");
  await page.getByRole("dialog", { name: "Mehr", exact: true }).getByRole("button", { name: /^Abmelden/ }).click();
  await destination;
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
  await page.getByRole("button", { name: "Mehr öffnen", exact: true }).click();
  const more = page.getByRole("dialog", { name: "Mehr", exact: true });
  await more.locator('a[href="/warendurchlauf"]').click();
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
    test.setTimeout(600_000);
    const databaseUrl = requiredEnv("DATABASE_URL");
    const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const sessionSecret = requiredEnv("APP_SESSION_SECRET");
    const declaredCandidateSha = requireSha(requiredEnv("A3_CANDIDATE_SHA"), "A3_CANDIDATE_SHA");
    const checkoutSha = readCheckoutSha();
    expect(declaredCandidateSha).toBe(checkoutSha);
    const buildBinding = readBuildBinding();
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
    const pinProofs: PinProof[] = [];
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

      for (const viewport of VIEWPORTS) {
        for (const actor of [
          { id: ROLF_ACTOR_ID, pin: rolfPin, role: "rolf" as const },
          { id: PHILLIP_ACTOR_ID, pin: phillipPin, role: "phillip" as const },
        ]) {
          for (const mode of ["keyboard", "touch"] as const) {
            const proof = await newContext(browser, viewport);
            try {
              pinProofs.push(await loginPin(proof.page, actor.id, actor.pin, sessionSecret, mode));
              if (actor.role === "rolf") {
                await expect(proof.page.getByRole("heading", { name: "Der Tag", exact: true })).toBeVisible();
                await assertRolfChrome(proof.page, viewport);
              } else {
                await expect(proof.page.getByRole("heading", { name: "Werkstatt", exact: true })).toBeVisible();
                await expect(proof.page.getByRole("navigation", { name: "Hauptnavigation" })).toHaveCount(0);
                await expect(proof.page.getByRole("navigation", { name: "Mobile Hauptnavigation" })).toHaveCount(0);
                await expect(proof.page.getByRole("navigation", { name: "Werkstattaktionen" }).getByRole("button")).toHaveCount(5);
              }
            } finally {
              await proof.context.close();
            }
          }
        }
      }
      expect(pinProofs).toHaveLength(12);

      const start = await newContext(browser);
      contexts.push(start.context);
      for (const viewport of VIEWPORTS) {
        await start.page.setViewportSize(viewport);
        await start.page.goto("/start", { waitUntil: "networkidle" });
        await expect(start.page.getByRole("heading", { name: "Persönlichen Code eingeben", exact: true })).toBeVisible();
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
      await expect(rolf.page.getByRole("heading", { name: "Der Tag", exact: true })).toBeVisible();
      const readbacks = [
        await createIntake(rolf.page, sql, suffix, 1),
        await createIntake(rolf.page, sql, suffix, 2),
      ];
      for (const viewport of VIEWPORTS) {
        await rolf.page.setViewportSize(viewport);
        await rolf.page.goto("/", { waitUntil: "networkidle" });
        await expect(rolf.page.getByTestId("rolf-v8-home")).toContainText(readbacks[0].orderNumber);
        await expect(rolf.page.locator("body")).not.toContainText(/Geplant|kommt bald|wareneingang/i);
        await assertRolfChrome(rolf.page, viewport);
        await assertNoFloatingActionOverlap(rolf.page);
        await assertMoreMenu(rolf.page);
        captures.push(await capture(rolf.page, `a-rolf-${viewport.name}-${viewport.width}x${viewport.height}.png`, "rolf-v8-real-projection"));
      }
      await rolf.page.setViewportSize(VIEWPORTS[0]);
      await clickRolfNavigation(rolf.page);
      await clickSharedMorePaths(rolf.page);
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
        await expect(phillip.page.getByRole("navigation", { name: "Hauptnavigation" })).toHaveCount(0);
        await expect(phillip.page.getByRole("navigation", { name: "Mobile Hauptnavigation" })).toHaveCount(0);
        await expect(phillip.page.getByRole("navigation", { name: "Werkstattaktionen" }).getByRole("button")).toHaveCount(5);
        await expect(phillip.page.getByRole("button", { name: "Anlegen", exact: true })).toHaveCount(0);
        await assertMoreMenu(phillip.page);
        captures.push(await capture(phillip.page, `a-phillip-${viewport.name}-${viewport.width}x${viewport.height}.png`, "phillip-v4-real-projection"));
      }
      await phillip.page.setViewportSize(VIEWPORTS[0]);
      await phillip.page.goto("/", { waitUntil: "networkidle" });
      await clickPhillipActions(phillip.page);
      await clickSharedMoreLogout(phillip.page);

      const gregor = await newContext(browser);
      contexts.push(gregor.context);
      await loginGregor(gregor.page, gregorEmail, gregorPassword, sessionSecret);
      await expect(gregor.page.getByTestId("gregor-system-admin")).toBeVisible();
      await gregor.page.goto("/", { waitUntil: "networkidle" });
      await gregor.page.waitForURL((url) => url.pathname === "/settings");
      await expect(gregor.page.locator('a[href="/orders"], a[href="/customers"], a[href="/warendurchlauf"]')).toHaveCount(0);

      const retiredResults: Array<{ path: string; status: number }> = [];
      const retiredPages = await Promise.all(
        Array.from({ length: 4 }, () => rolf.context.newPage()),
      );
      try {
        const workerResults = await Promise.all(
          retiredPages.map(async (retiredPage, workerIndex) => {
            const results: Array<{ index: number; path: string; status: number }> = [];
            for (
              let routeIndex = workerIndex;
              routeIndex < RETIRED_ROUTES.length;
              routeIndex += retiredPages.length
            ) {
              const retiredPath = RETIRED_ROUTES[routeIndex];
              const response = await retiredPage.goto(retiredPath, { waitUntil: "domcontentloaded" });
              const status = response?.status() ?? 0;
              expect(status, `${retiredPath} muss ein echter 404 sein`).toBe(404);
              results.push({ index: routeIndex, path: retiredPath, status });
            }
            return results;
          }),
        );
        retiredResults.push(
          ...workerResults
            .flat()
            .sort((left, right) => left.index - right.index)
            .map(({ path: retiredPath, status }) => ({ path: retiredPath, status })),
        );
      } finally {
        await Promise.all(retiredPages.map((retiredPage) => retiredPage.close()));
      }

      expect(browserErrors).toEqual([]);
      const receipt = {
        candidateCodeShaAtRun: checkoutSha,
        declaredCandidateSha,
        buildBinding,
        v5ReferenceSha256: V5_SHA256,
        evidenceScope: "SYNTHETIC_LOCAL_FIXTURE",
        productionReadiness: "OPEN",
        synthetic: true,
        tenant: TENANT,
        actors: { rolf: "READY", phillip: "READY", gregor: "READY" },
        acceptanceMatrix: {
          roles: ["rolf", "phillip"],
          viewports: VIEWPORTS.map(({ width, height }) => `${width}x${height}`),
          pinModes: ["keyboard", "touch"],
          pinProofs,
          screenshotsArtifact: "path1-v5-a3-shell-homes-screens",
        },
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
