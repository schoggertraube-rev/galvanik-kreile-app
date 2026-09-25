import { expect, test, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createPinLoginHandle } from "../src/lib/server/pinLoginHandle";

const TENANT = "galvanik-kreile";
const V5_SHA256 = "75258FF3BD4CC212C8E989061708A29DC26EA44B851BD28E8F16E8509B0CC0AA";
const ORIGIN = process.env.A3_TEST_ORIGIN?.trim() || "https://localhost:3443";
const OUTPUT_DIR = path.resolve(process.env.A3_EVIDENCE_OUTPUT_DIR?.trim() || "test-results/path1-v5-shell-smoke/screens");
const VIEWPORTS = [
  { name: "desktop", width: 1914, height: 917 },
  { name: "tablet", width: 1220, height: 880 },
  { name: "mobile", width: 390, height: 844 },
] as const;
const ACTORS = [
  { key: "rolf", id: "11111111-1111-4111-8111-111111111111", pin: "4186", role: "meister" },
  { key: "phillip", id: "22222222-2222-4222-8222-222222222222", pin: "7315", role: "werkstatt" },
] as const;
const GREGOR_ACTOR_ID = "33333333-3333-4333-8333-333333333333";
const NAVIGATION_TIMEOUT = 30_000;

function renderedPathFor(requestedPath: string): string {
  // Settings is intentionally restricted to Gregor and redirects the two
  // smoke actors to their role-aware start page.
  if (requestedPath === "/settings") return "/";
  return requestedPath;
}

function expectedHeading(actor: string, pagePath: string): string {
  if (pagePath === "/") return actor === "phillip" ? "Werkstatt" : "Der Tag";
  if (pagePath === "/warendurchlauf") return "Werkstatt";
  if (pagePath === "/orders") return "Aufträge";
  if (pagePath === "/customers") return "Kunden & Kontakt";
  if (pagePath === "/buchhaltung/rechnungen") return "Rechnungen";
  throw new Error(`PATH1_V5_SHELL_SMOKE_HEADING_MISSING:${pagePath}`);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PATH1_V5_SHELL_SMOKE_ENV_MISSING:${name}`);
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
  const body = (await response.json()) as { user?: { id?: string }; message?: string };
  if (!response.ok || typeof body.user?.id !== "string") {
    throw new Error(`PATH1_V5_SHELL_SMOKE_AUTH_SIGNUP_FAILED:${response.status}:${body.message ?? "invalid response"}`);
  }
}

function checkoutSha(): string {
  const git = path.resolve(process.cwd(), ".git");
  const head = readFileSync(path.join(git, "HEAD"), "utf8").trim();
  if (!head.startsWith("ref: ")) return head;
  const reference = head.slice(5).trim();
  try {
    return readFileSync(path.join(git, reference), "utf8").trim();
  } catch {
    const packed = readFileSync(path.join(git, "packed-refs"), "utf8")
      .split(/\r?\n/).find((line) => line.endsWith(` ${reference}`));
    if (!packed) throw new Error("PATH1_V5_SHELL_SMOKE_CHECKOUT_SHA_MISSING");
    return packed.slice(0, 40);
  }
}

async function assertSignedSession(page: Page, actorId: string, secret: string) {
  const cookie = (await page.context().cookies(ORIGIN)).find((item) => item.name === "kreile_app_session");
  if (!cookie?.httpOnly || !cookie.secure) throw new Error("PATH1_V5_SHELL_SMOKE_SESSION_COOKIE_INVALID");
  const token = decodeURIComponent(cookie.value);
  const dot = token.lastIndexOf(".");
  const payloadText = Buffer.from(token.slice(0, dot), "base64").toString("utf8");
  const signature = Buffer.from(token.slice(dot + 1), "hex");
  const expected = createHmac("sha256", secret).update(payloadText).digest();
  if (dot <= 0 || signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw new Error("PATH1_V5_SHELL_SMOKE_SESSION_INVALID");
  expect(JSON.parse(payloadText)).toMatchObject({ userId: actorId, tenantId: TENANT });
}

async function loginPin(page: Page, actor: (typeof ACTORS)[number], secret: string) {
  await page.goto("/start", { waitUntil: "domcontentloaded" });
  await page.getByTestId(`pin-user-card-${createPinLoginHandle(actor.id)}`).click();
  const dialog = page.getByTestId("pin-login-dialog");
  await expect(dialog).toBeVisible();
  const home = page.waitForURL((url) => url.pathname === "/", { waitUntil: "commit" });
  for (const digit of actor.pin) await dialog.getByRole("button", { name: digit, exact: true }).click();
  await home;
  await expect(page.locator("main h1")).toBeVisible();
  await assertSignedSession(page, actor.id, secret);
}

async function capture(page: Page, actor: string, viewport: (typeof VIEWPORTS)[number], pagePath?: string) {
  const loading = page.locator('[role="status"][aria-busy="true"], text=/werden geladen/i');
  await expect.poll(async () => loading.evaluateAll((nodes) => nodes.filter((node) => {
    const style = window.getComputedStyle(node);
    return style.visibility !== "hidden" && style.display !== "none" && node.getClientRects().length > 0;
  }).length), { timeout: NAVIGATION_TIMEOUT }).toBe(0);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const suffix = pagePath ? `-path-${pagePath === "/" ? "root" : pagePath.slice(1).replace(/\//g, "-")}` : "";
  const file = `${actor}-${viewport.name}-${viewport.width}x${viewport.height}${suffix}`;
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${file}.png`), fullPage: false, animations: "disabled" });
  writeFileSync(path.join(OUTPUT_DIR, `${file}.txt`), `${await page.locator("main").first().innerText()}\n`, "utf8");
  return file;
}

async function assertPage(page: Page, actor: string, viewport: (typeof VIEWPORTS)[number], pagePath: string, problems: string[], screens: string[]) {
  await expect(page.getByRole("main").getByRole("heading", { name: expectedHeading(actor, pagePath), exact: true })).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  const alerts = (await page.locator('[role="alert"]:not(#__next-route-announcer__)').allInnerTexts()).map((text) => text.trim()).filter(Boolean);
  if (alerts.length) {
    problems.push(`${pagePath}:\n${alerts.join("\n")}`);
    screens.push(await capture(page, actor, viewport, pagePath));
  }
}

async function navigateAndWaitForContent(page: Page, actor: string, target: ReturnType<Page["locator"]>, href: string): Promise<string> {
  const requestedPath = new URL(href, ORIGIN).pathname;
  const renderedPath = renderedPathFor(requestedPath);

  if (new URL(page.url()).pathname === requestedPath) {
    await target.click({ timeout: NAVIGATION_TIMEOUT });
    await expect(page).toHaveURL((url) => url.pathname === requestedPath, { timeout: NAVIGATION_TIMEOUT });
  } else {
    const reached = page.waitForURL((url) => url.pathname === requestedPath, { waitUntil: "commit", timeout: NAVIGATION_TIMEOUT });
    await target.click({ timeout: NAVIGATION_TIMEOUT });
    await reached;
  }

  if (renderedPath !== requestedPath) {
    await expect.poll(() => new URL(page.url()).pathname, { timeout: NAVIGATION_TIMEOUT }).toBe(renderedPath);
  }
  await expect(page.getByRole("main").getByRole("heading", { name: expectedHeading(actor, renderedPath), exact: true })).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  return renderedPath;
}

async function visitDesktopLinks(page: Page, actor: string, viewport: (typeof VIEWPORTS)[number], problems: string[], screens: string[]) {
  const navigation = page.getByRole("navigation", { name: "Hauptnavigation", exact: true });
  await expect(navigation).toBeVisible();
  const hrefs = await navigation.locator("[data-href]").evaluateAll((items) => items.map((item) => item.getAttribute("data-href")).filter((href): href is string => Boolean(href)));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const target = page.getByRole("navigation", { name: "Hauptnavigation", exact: true }).locator(`[data-href="${href}"]`);
    const renderedPath = await navigateAndWaitForContent(page, actor, target, href);
    await assertPage(page, actor, viewport, renderedPath, problems, screens);
    if (!screens.includes(`${actor}-${viewport.name}-${viewport.width}x${viewport.height}-path-${renderedPath === "/" ? "root" : renderedPath.slice(1).replace(/\//g, "-")}`)) {
      screens.push(await capture(page, actor, viewport, renderedPath));
    }
  }
}

async function visitMore(page: Page, actor: string, viewport: (typeof VIEWPORTS)[number], problems: string[], screens: string[]) {
  const dock = page.getByRole("navigation", { name: "Mobile Hauptnavigation", exact: true });
  await expect(dock).toBeVisible();
  await expect(dock.locator(":scope > *")).toHaveCount(5);
  for (const href of ["/warendurchlauf", "/settings"]) {
    await dock.getByRole("button", { name: "Mehr", exact: true }).click({ timeout: NAVIGATION_TIMEOUT });
    const more = page.getByRole("dialog", { name: "Mehr", exact: true });
    await expect(more).toBeVisible();
    const renderedPath = await navigateAndWaitForContent(page, actor, more.locator(`a[href="${href}"]`), href);
    await assertPage(page, actor, viewport, renderedPath, problems, screens);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("main").getByRole("heading", { name: expectedHeading(actor, "/"), exact: true })).toBeVisible({ timeout: NAVIGATION_TIMEOUT });
  }
}

test.describe("PATH1 V5 Shell Smoke", () => {
  test.use({ baseURL: ORIGIN, ignoreHTTPSErrors: true });

  test("belegt echte PIN-Sitzungen, Navigation und Screens für Rolf und Phillip", async ({ browser }) => {
    test.setTimeout(540_000);
    const databaseUrl = required("DATABASE_URL");
    const sessionSecret = required("APP_SESSION_SECRET");
    const apiUrl = required("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const declaredSha = required("A3_CANDIDATE_SHA").toLowerCase();
    expect(declaredSha).toMatch(/^[0-9a-f]{40}$/);
    expect(declaredSha).toBe(checkoutSha());
    const sql = postgres(databaseUrl, { max: 1, prepare: false });
    const screens: string[] = [];
    const problems: string[] = [];
    const suffix = `${Date.now()}-${process.pid}`;
    const emailRolf = `shell-smoke-rolf-${suffix}@local.test`;
    const emailPhillip = `shell-smoke-phillip-${suffix}@local.test`;
    const gregorEmail = `a3-gregor-${suffix}@local.test`;
    const gregorPassword = `A3-Gregor-${suffix}!`;
    const hashRolf = await bcrypt.hash(ACTORS[0].pin, 12);
    const hashPhillip = await bcrypt.hash(ACTORS[1].pin, 12);
    try {
      await createLocalAuthUser(apiUrl, anonKey, gregorEmail, gregorPassword);
      const insertedAt = new Date(Date.now() - 5_000).toISOString();
      await sql`
        INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, created_at, updated_at)
        VALUES
          (${ACTORS[0].id}::uuid, ${TENANT}, ${emailRolf}, 'Rolf', 'meister', ${hashRolf}, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz),
          (${ACTORS[1].id}::uuid, ${TENANT}, ${emailPhillip}, 'Phillip', 'werkstatt', ${hashPhillip}, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz),
          (${GREGOR_ACTOR_ID}::uuid, ${TENANT}, ${gregorEmail}, 'Gregor', 'admin', null, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz)
        ON CONFLICT (id) DO UPDATE SET email = excluded.email, full_name = excluded.full_name, role = excluded.role, pin_hash = excluded.pin_hash, active = excluded.active, updated_at = excluded.updated_at
      `;
      for (const actor of ACTORS) for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({ viewport });
        try {
          const page = await context.newPage();
          await loginPin(page, actor, sessionSecret);
          await assertPage(page, actor.key, viewport, "/", problems, screens);
          screens.push(await capture(page, actor.key, viewport));
          if (viewport.width >= 1300) await visitDesktopLinks(page, actor.key, viewport, problems, screens);
          else await visitMore(page, actor.key, viewport, problems, screens);
        } finally {
          await context.close();
        }
      }
      writeFileSync(path.join(OUTPUT_DIR, "a-browser-receipt.json"), `${JSON.stringify({ candidateCodeShaAtRun: declaredSha, v5ReferenceSha256: V5_SHA256, actors: ACTORS.map(({ key }) => key), viewports: VIEWPORTS, screens }, null, 2)}\n`, "utf8");
      expect(problems, problems.join("\n")).toEqual([]);
    } finally {
      await sql.end();
    }
  });
});
