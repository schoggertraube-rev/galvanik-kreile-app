import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Locator,
  type Page,
} from "@playwright/test";
import bcrypt from "bcryptjs";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createPinLoginHandle } from "../src/lib/server/pinLoginHandle";

const TENANT = "galvanik-kreile";
const ROLF_ACTOR_ID = "11111111-1111-4111-8111-111111111111";
const PHILLIP_ACTOR_ID = "22222222-2222-4222-8222-222222222222";
const GREGOR_ACTOR_ID = "33333333-3333-4333-8333-333333333333";
const P3_TEST_ORIGIN =
  process.env.P3_TEST_ORIGIN?.trim() || "https://localhost:3443";
const OUTPUT_DIR = path.resolve(
  process.env.P3_EVIDENCE_OUTPUT_DIR?.trim() ||
    path.join(
      process.cwd(),
      "docs/evidence/path1/artifacts/p3-core-surfaces-search",
    ),
);
const VIEWPORTS = [
  { name: "desktop", width: 1914, height: 917 },
  { name: "tablet-landscape", width: 1220, height: 880 },
  { name: "tablet-portrait", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const RETIRED_ROUTE_MATRIX = [
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
  "/status",
  "/telefonnotiz",
  "/today",
] as const;

type AuthSignupResponse = { user?: { id?: string }; message?: string };

type Capture = {
  file: string;
  sha256: string;
  viewport: string;
  state: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`PATH1_P3_ENV_MISSING:${name}`);
  return value;
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
    throw new Error(
      `PATH1_P3_LOCAL_AUTH_SIGNUP_FAILED:${response.status}:${body.message ?? "invalid response"}`,
    );
  }
  return body.user.id;
}

async function assertSignedAppSession(
  page: Page,
  actorId: string,
  sessionSecret: string,
) {
  const signedCookie = (await page.context().cookies(P3_TEST_ORIGIN)).find(
    (cookie) => cookie.name === "kreile_app_session",
  );
  if (!signedCookie) throw new Error("PATH1_P3_SIGNED_SESSION_COOKIE_MISSING");
  if (!signedCookie.httpOnly || !signedCookie.secure)
    throw new Error("PATH1_P3_SESSION_COOKIE_FLAGS_INVALID");
  const token = decodeURIComponent(signedCookie.value);
  const separator = token.lastIndexOf(".");
  if (separator <= 0)
    throw new Error("PATH1_P3_SIGNED_SESSION_COOKIE_MALFORMED");
  const payloadText = Buffer.from(token.slice(0, separator), "base64").toString(
    "utf8",
  );
  const signature = token.slice(separator + 1);
  if (!/^[a-f0-9]{64}$/.test(signature))
    throw new Error("PATH1_P3_SIGNED_SESSION_COOKIE_MALFORMED");
  const expectedSignature = createHmac("sha256", sessionSecret)
    .update(payloadText)
    .digest();
  const actualSignature = Buffer.from(signature, "hex");
  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  )
    throw new Error("PATH1_P3_SESSION_SIGNATURE_INVALID");
  const payload = JSON.parse(payloadText) as {
    userId?: unknown;
    tenantId?: unknown;
  };
  if (payload.userId !== actorId || payload.tenantId !== TENANT)
    throw new Error("PATH1_P3_SESSION_ACTOR_MISMATCH");
}

async function loginPin(
  page: Page,
  userId: string,
  pin: string,
  sessionSecret: string,
) {
  await page.goto("/start");
  const card = page.getByTestId(
    `pin-user-card-${createPinLoginHandle(userId)}`,
  );
  await expect(card).toBeEnabled();
  await card.click();
  const dialog = page.getByTestId("pin-login-dialog");
  await expect(dialog).toBeVisible();
  const reachedHome = page.waitForURL((url) => url.pathname === "/", {
    timeout: 30_000,
  });
  for (const digit of pin)
    await dialog.getByRole("button", { name: digit, exact: true }).click();
  await reachedHome;
  await page.waitForLoadState("networkidle");
  await assertSignedAppSession(page, userId, sessionSecret);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForURL((url) => url.pathname === "/", { timeout: 30_000 });
  await assertSignedAppSession(page, userId, sessionSecret);
}

async function loginEmail(
  page: Page,
  actorId: string,
  email: string,
  password: string,
  sessionSecret: string,
) {
  await page.goto("/start");
  await page.getByRole("button", { name: /Gregor/ }).click();
  const dialog = page.getByTestId("email-login-dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("#email").fill(email);
  await dialog.locator("#password").fill(password);
  const reachedSettings = page.waitForURL(
    (url) => url.pathname === "/settings",
    {
      timeout: 30_000,
    },
  );
  await dialog.getByRole("button", { name: "Einloggen", exact: true }).click();
  await reachedSettings;
  await page.waitForLoadState("networkidle");
  await assertSignedAppSession(page, actorId, sessionSecret);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForURL((url) => url.pathname === "/settings", {
    timeout: 30_000,
  });
  await assertSignedAppSession(page, actorId, sessionSecret);
}

async function capture(
  page: Page,
  file: string,
  state: string,
): Promise<Capture> {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const target = path.join(OUTPUT_DIR, file);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
  await page.screenshot({ path: target, fullPage: false });
  const viewport = page.viewportSize();
  return {
    file,
    sha256: createHash("sha256").update(readFileSync(target)).digest("hex"),
    viewport: `${viewport?.width ?? 0}x${viewport?.height ?? 0}`,
    state,
  };
}

async function newContext(
  browser: Browser,
  viewport = { width: 1914, height: 917 },
) {
  const context = await browser.newContext({ viewport });
  return { context, page: await context.newPage() };
}

async function closeOverlay(page: Page) {
  const dialog = page.getByRole("dialog", {
    name: /Auftragskarte|Kundenkarte/,
  });
  await dialog.getByRole("button", { name: "Schließen", exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

async function expectFullyInsideViewport(page: Page, target: Locator) {
  const box = await target.boundingBox();
  const viewport = page.viewportSize();
  expect(
    box,
    "sichtbares Bedienelement besitzt eine Bounding Box",
  ).not.toBeNull();
  expect(viewport, "Browser-Viewport ist bestimmt").not.toBeNull();
  if (!box || !viewport) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
}

async function openSearch(page: Page, query: string) {
  await page.getByRole("button", { name: "Suche öffnen" }).click();
  const dialog = page.getByRole("dialog", { name: "Kunden und Aufträge" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox").fill(query);
  return dialog;
}

async function returnToWorkshopHub(page: Page) {
  const directLink = page.locator('a[href="/warendurchlauf"]:visible');
  if ((await directLink.count()) > 0) {
    await directLink.first().click();
  } else {
    await page.getByRole("button", { name: "Mehr", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Mehr", exact: true })
      .getByRole("link", { name: "Werkstatt", exact: true })
      .click();
  }
  await page.waitForURL((url) => url.pathname === "/warendurchlauf");
  await expect(
    page.getByRole("heading", { name: "Werkstatt", exact: true }),
  ).toBeVisible();
}

test.describe("PATH1 V5 P3 – reale Kernflächen und Lane-0-Suche", () => {
  test.use({
    baseURL: P3_TEST_ORIGIN,
    ignoreHTTPSErrors: true,
  });

  test("belegt Orders V8, Customers V2, Homes, Backstack und deterministische Suche", async ({
    browser,
  }) => {
    test.setTimeout(300_000);
    const databaseUrl = requiredEnv("DATABASE_URL");
    const apiUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
    const anonKey = requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const sessionSecret = requiredEnv("APP_SESSION_SECRET");
    expect(P3_TEST_ORIGIN).toMatch(/^https:\/\/localhost:\d+$/);
    expect(databaseUrl).toMatch(
      /^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/,
    );
    expect(process.env.KREILE_ROLF_APP_USER_ID).toBe(ROLF_ACTOR_ID);
    expect(process.env.KREILE_PHILLIP_APP_USER_ID).toBe(PHILLIP_ACTOR_ID);
    expect(process.env.KREILE_GREGOR_APP_USER_ID).toBe(GREGOR_ACTOR_ID);
    expect(apiUrl).toMatch(/^http:\/\/(?:127\.0\.0\.1|localhost):\d+$/);
    expect(RETIRED_ROUTE_MATRIX).toHaveLength(60);

    const suffix = `${Date.now()}-${process.pid}`;
    const rolfPin = "4186";
    const phillipPin = "7315";
    const gregorEmail = `p3-gregor-${suffix}@local.test`;
    const gregorPassword = `P3-Gregor-${suffix}!`;
    const customerName = `SYNTHETISCH P3 Kunde ${suffix}`;
    const partName = `SYNTHETISCHER P3 Flansch ${suffix}`;
    const material = `P3-Material-${suffix}`;
    const surface = `P3-Oberfläche-${suffix}`;
    const promisedDate = "2026-10-23";
    const promisedDateLabel = new Intl.DateTimeFormat("de-DE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${promisedDate}T00:00:00.000Z`));
    const sql = postgres(databaseUrl, { max: 2, prepare: false });
    const contexts: BrowserContext[] = [];
    const captures: Capture[] = [];
    const browserErrors: string[] = [];
    const requestFailures: string[] = [];

    try {
      const insertedAt = new Date(Date.now() - 5_000).toISOString();
      await createRealLocalAuthUser(
        apiUrl,
        anonKey,
        gregorEmail,
        gregorPassword,
      );
      await sql`
        INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, created_at, updated_at)
        VALUES
          (${ROLF_ACTOR_ID}::uuid, ${TENANT}, ${`p3-rolf-${suffix}@local.test`}, 'Rolf', 'meister', ${await bcrypt.hash(rolfPin, 12)}, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz),
          (${PHILLIP_ACTOR_ID}::uuid, ${TENANT}, ${`p3-phillip-${suffix}@local.test`}, 'Phillip', 'werkstatt', ${await bcrypt.hash(phillipPin, 12)}, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz),
          (${GREGOR_ACTOR_ID}::uuid, ${TENANT}, ${gregorEmail}, 'Technical Admin', 'admin', null, true, ${insertedAt}::timestamptz, ${insertedAt}::timestamptz)
        ON CONFLICT (id) DO UPDATE SET
          email = excluded.email,
          full_name = excluded.full_name,
          role = excluded.role,
          pin_hash = excluded.pin_hash,
          active = excluded.active,
          updated_at = excluded.updated_at
      `;

      const rolf = await newContext(browser);
      contexts.push(rolf.context);
      await loginPin(rolf.page, ROLF_ACTOR_ID, rolfPin, sessionSecret);
      // Der echte Secure-Cookie, seine Signatur und der Actor sind vor diesem
      // Zieloberflächen-Fehlervertrag bereits geprüft und nach Reload bestätigt.
      rolf.page.on("console", (message) => {
        if (message.type() !== "error") return;
        const location = message.location();
        browserErrors.push(
          `${message.text()} @ ${location.url || "browser"}:${location.lineNumber ?? 0}:${location.columnNumber ?? 0}`,
        );
      });
      rolf.page.on("pageerror", (error) =>
        browserErrors.push(
          `${rolf.page.url()} :: ${error.stack ?? error.message}`,
        ),
      );
      rolf.page.on("requestfailed", (request) => {
        requestFailures.push(
          `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`,
        );
      });
      await expect(
        rolf.page.getByRole("heading", { name: "Der Tag", exact: true }),
      ).toBeVisible();

      for (const viewport of VIEWPORTS) {
        await rolf.page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await rolf.page.goto("/warendurchlauf", { waitUntil: "networkidle" });
        await expect(
          rolf.page.getByRole("heading", { name: "Werkstatt", exact: true }),
        ).toBeVisible();
        const emptyWorkshopHeading = rolf.page.getByRole("heading", {
          name: "Noch keine Daten erfasst",
        });
        const populatedWorkshopSource = rolf.page
          .getByRole("main")
          .getByText(/^Quelle: Auftragsbestand · Stand /);
        await expect
          .poll(async () => {
            const [emptyVisible, populatedVisible] = await Promise.all([
              emptyWorkshopHeading.isVisible(),
              populatedWorkshopSource.isVisible(),
            ]);
            if (emptyVisible === populatedVisible) return "pending-or-conflict";
            return emptyVisible ? "empty" : "data";
          })
          .toMatch(/^(empty|data)$/);
        const workshopIsEmpty = await emptyWorkshopHeading.isVisible();
        if (workshopIsEmpty) {
          await expect(
            rolf.page.getByText(
              "Sobald Aufträge im Wareneingang oder in der Galvanik liegen, erscheinen sie hier.",
            ),
          ).toBeVisible();
          await expect(populatedWorkshopSource).toHaveCount(0);
        } else {
          await expect(populatedWorkshopSource).toBeVisible();
          await expect(rolf.page.getByTestId("werkstatt-status")).toBeVisible();
          await expect(rolf.page.getByTestId("werkstatt-wip-tile")).toBeVisible();
          await expect(emptyWorkshopHeading).toHaveCount(0);
        }
        const hubIntake = rolf.page.getByRole("button", {
          name: "Neuer Eingang",
          exact: true,
        });
        await expect(hubIntake).toBeVisible();
        await expect(hubIntake).toBeEnabled();
        const goodsOut = rolf.page.getByRole("button", {
          name: "Ware raus",
          exact: true,
        });
        await expect(goodsOut).toBeVisible();
        await expect(goodsOut).toBeEnabled();
        await expect(rolf.page.locator("body")).not.toContainText(
          /NOT_AVAILABLE|Mock/,
        );
        await hubIntake.scrollIntoViewIfNeeded();
        await expectFullyInsideViewport(rolf.page, hubIntake);
        captures.push(
          await capture(
            rolf.page,
            `p3-workshop-hub-${viewport.name}-${viewport.width}x${viewport.height}.png`,
            "workshop-hub-real",
          ),
        );
        await hubIntake.click();
        const hubCreateDialog = rolf.page.getByRole("dialog", {
          name: "Neuer Eingang",
        });
        await expect(hubCreateDialog).toBeVisible();
        await expect(hubCreateDialog.getByLabel("Firma / Name")).toBeFocused();
        await hubCreateDialog
          .getByRole("button", { name: "Anlegen schließen", exact: true })
          .click();
        await expect(hubCreateDialog).toHaveCount(0);

        await rolf.page.goto("/warendurchlauf/wareneingang", {
          waitUntil: "networkidle",
        });
        await expect(
          rolf.page.getByText("Neue Annahme erfassen"),
        ).toBeVisible();
        await expect(rolf.page.locator("body")).not.toContainText(
          "NOT_AVAILABLE",
        );
        await expect(
          rolf.page.locator('nav a[href="/warendurchlauf/wareneingang"]'),
        ).toHaveCount(0);
        await expect(
          rolf.page.locator('nav a[href="/warendurchlauf/galvanik"]'),
        ).toHaveCount(0);
        const stationIntake = rolf.page.getByTestId(
          "wareneingang-create-order",
        );
        await stationIntake.scrollIntoViewIfNeeded();
        await expectFullyInsideViewport(rolf.page, stationIntake);
        captures.push(
          await capture(
            rolf.page,
            `p3-wareneingang-${viewport.name}-${viewport.width}x${viewport.height}.png`,
            "wareneingang-real",
          ),
        );
        await stationIntake.click();
        const stationCreateDialog = rolf.page.getByRole("dialog", {
          name: "Neuer Eingang",
        });
        await expect(stationCreateDialog).toBeVisible();
        await expect(
          stationCreateDialog.getByLabel("Firma / Name"),
        ).toBeFocused();
        await stationCreateDialog
          .getByRole("button", { name: "Anlegen schließen", exact: true })
          .click();
        await expect(stationCreateDialog).toHaveCount(0);

        if (viewport.name === "desktop") {
          const redirectResponse = await rolf.page.goto("/warendurchlauf/neu", {
            waitUntil: "domcontentloaded",
          });
          expect(redirectResponse?.status()).toBe(200);
          await rolf.page.waitForURL(
            (url) => url.pathname === "/warendurchlauf/wareneingang",
          );
          await expect(
            rolf.page.getByTestId("wareneingang-create-order"),
          ).toBeVisible();
        }
        await returnToWorkshopHub(rolf.page);
      }

      await rolf.page.setViewportSize({ width: 1914, height: 917 });
      await rolf.page.goto("/", { waitUntil: "networkidle" });

      await rolf.page.getByRole("button", { name: "Neuer Eingang" }).click();
      await expect(
        rolf.page.getByRole("heading", { name: "Neuer Eingang" }),
      ).toBeVisible();
      await rolf.page.getByRole("button", { name: "Neukunde" }).click();
      await rolf.page.getByLabel("Firma / Name").fill(customerName);
      await rolf.page.getByLabel("Terminwunsch").fill("2026-10-20");
      await rolf.page.getByLabel("Zugesagter Termin").fill(promisedDate);
      await rolf.page.getByLabel("Teil / Bezeichnung").fill(partName);
      await rolf.page.getByLabel("Menge").fill("3");
      await rolf.page.getByLabel("Material").fill(material);
      await rolf.page.getByLabel("Oberfläche").fill(surface);
      await rolf.page
        .getByRole("button", { name: "Eingang speichern" })
        .click();
      const heading = rolf.page.getByRole("heading", {
        name: /^Auftrag A-\d{4}-\d+ angelegt$/,
      });
      await expect(heading).toBeVisible();
      const orderNumber = (await heading.textContent())!
        .replace(/^Auftrag /, "")
        .replace(/ angelegt$/, "")
        .trim();
      await rolf.page
        .getByRole("button", { name: "Anlegen schließen", exact: true })
        .click();

      const [stored] = await sql<
        { order_id: string; customer_id: string; count: number }[]
      >`
        SELECT min(orders.id::text) AS order_id, min(orders.customer_id::text) AS customer_id, count(*)::integer AS count
        FROM public.orders orders
        WHERE orders.tenant_id = ${TENANT} AND orders.order_number = ${orderNumber}
      `;
      expect(stored?.count).toBe(1);
      if (!stored?.order_id || !stored.customer_id)
        throw new Error("PATH1_P3_ORDER_READBACK_MISSING");

      await rolf.page.goto("/warendurchlauf/wareneingang", {
        waitUntil: "networkidle",
      });
      await expect(
        rolf.page.getByText(orderNumber, { exact: false }),
      ).toBeVisible();
      await rolf.page.reload({ waitUntil: "networkidle" });
      await expect(
        rolf.page.getByText(orderNumber, { exact: false }),
      ).toBeVisible();
      await returnToWorkshopHub(rolf.page);
      const populatedWorkshopHub = rolf.page.getByRole("region", {
        name: "Werkstatt",
      });
      await expect(
        populatedWorkshopHub.getByText("Quelle: Auftragsbestand"),
      ).toBeVisible();
      await expect(populatedWorkshopHub.getByRole("status")).toContainText(
        "Werkstatt läuft rund",
      );
      await expect(
        populatedWorkshopHub.getByRole("heading", {
          name: "Noch keine Daten erfasst",
        }),
      ).toHaveCount(0);

      await rolf.page.goto("/", { waitUntil: "networkidle" });
      await rolf.page
        .getByRole("button", { name: "Anlegen", exact: true })
        .click();
      await rolf.page
        .getByRole("button", { name: /Offene KVs bearbeiten/ })
        .click();
      const openQuotesDialog = rolf.page.getByRole("dialog", {
        name: "Offene KVs",
      });
      await expect(openQuotesDialog.getByRole("status")).toContainText(
        "Keine offenen KVs",
      );
      await expect(openQuotesDialog.getByRole("alert")).toHaveCount(0);
      await expect(openQuotesDialog).not.toContainText("Ausgang ungeklärt");
      await rolf.page
        .getByRole("button", { name: "Anlegen schließen" })
        .click();

      const moneyLink = rolf.page.getByRole("link", {
        name: "Geld & Rechnungen",
      });
      await expect(moneyLink).toHaveAttribute(
        "href",
        "/buchhaltung/rechnungen",
      );
      await moneyLink.click();
      await rolf.page.waitForURL(
        (url) => url.pathname === "/buchhaltung/rechnungen",
      );
      await expect(
        rolf.page.getByRole("heading", { name: "Rechnungen", exact: true }),
      ).toBeVisible();
      await expect(rolf.page.locator("body")).not.toContainText(
        "NOT_AVAILABLE",
      );
      const accountingEntry = await rolf.page.goto("/buchhaltung", {
        waitUntil: "networkidle",
      });
      expect(accountingEntry?.status()).toBe(200);
      await rolf.page.waitForURL(
        (url) => url.pathname === "/buchhaltung/rechnungen",
      );

      const retiredRouteResults: Array<{ path: string; status: number }> = [];
      let legacyStationRouteResult = {
        path: "/station/wareneingang",
        status: 0,
      };
      const retiredRoutePage = await rolf.context.newPage();
      try {
        for (const retiredRoute of RETIRED_ROUTE_MATRIX) {
          const response = await retiredRoutePage.goto(retiredRoute, {
            waitUntil: "domcontentloaded",
          });
          const status = response?.status() ?? 0;
          retiredRouteResults.push({ path: retiredRoute, status });
          expect(
            status,
            `${retiredRoute} must resolve through Next's unmatched-route 404`,
          ).toBe(404);
          await expect(retiredRoutePage.locator("body")).not.toContainText(
            /NOT_AVAILABLE|Liquidität Stabil|145 Belege|62 Rechnungen|1240 Zeitbuchungen|Google-API|Scan & KI-Erfassung|App-Nutzung \/ Analytics|Testanalyse \(Testpilot\)/i,
          );
        }
        const legacyStationResponse = await retiredRoutePage.goto(
          legacyStationRouteResult.path,
          { waitUntil: "domcontentloaded" },
        );
        legacyStationRouteResult = {
          ...legacyStationRouteResult,
          status: legacyStationResponse?.status() ?? 0,
        };
        expect(legacyStationRouteResult.status).toBe(404);
        await expect(retiredRoutePage.locator("body")).not.toContainText(
          /Stationsdaten werden geladen|WarendurchlaufStationNav|NOT_AVAILABLE/,
        );
      } finally {
        await retiredRoutePage.close();
      }
      const galvanikControl = await rolf.page.goto("/warendurchlauf/galvanik", {
        waitUntil: "networkidle",
      });
      expect(galvanikControl?.status()).toBe(200);
      await expect(
        rolf.page.getByRole("heading", { name: /Galvanik Bearbeitung/ }),
      ).toBeVisible();

      for (const viewport of VIEWPORTS) {
        await rolf.page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await rolf.page.goto("/", { waitUntil: "networkidle" });
        await expect(
          rolf.page.getByRole("heading", { name: "Das braucht dich", exact: true }),
        ).toBeVisible();
        await expect(rolf.page.getByTestId("rolf-v8-home")).toContainText(
          orderNumber,
        );
        await expect(
          rolf.page.getByRole("button", { name: "Anlegen", exact: true }),
        ).toBeVisible();
        captures.push(
          await capture(
            rolf.page,
            `p3-rolf-home-${viewport.name}-${viewport.width}x${viewport.height}.png`,
            "rolf-home-data",
          ),
        );

        await rolf.page.goto("/orders", { waitUntil: "networkidle" });
        await expect(
          rolf.page.getByRole("heading", { name: "Aufträge" }),
        ).toBeVisible();
        await expect(
          rolf.page.getByRole("button", { name: "Anlegen", exact: true }),
        ).toBeVisible();
        await rolf.page
          .getByPlaceholder("Auftrag, Kunde, Material oder Oberfläche")
          .fill(orderNumber);
        await rolf.page
          .getByRole("button", { name: new RegExp(customerName) })
          .click();
        const orderCard = rolf.page.getByTestId("order-card-v8");
        await expect(orderCard).toContainText(orderNumber);
        await expect(orderCard).toContainText(promisedDateLabel);
        await expectFullyInsideViewport(
          rolf.page,
          orderCard.getByRole("button", { name: "Zurück", exact: true }),
        );
        await expectFullyInsideViewport(
          rolf.page,
          orderCard.getByRole("button", { name: "Schließen", exact: true }),
        );
        await expect(orderCard).not.toContainText(
          /Zahlungsstand nicht verfügbar|Zahlungs- und Warenausgangsdaten konnten nicht sicher geladen werden/i,
        );
        await expect(orderCard).toContainText(
          "Rechnung noch nicht ausgestellt",
        );
        if (viewport.name === "mobile") {
          await rolf.page.keyboard.press("Control+k");
          const portalSearch = rolf.page.getByRole("dialog", {
            name: "Kunden und Aufträge",
          });
          await expect(portalSearch).toBeVisible();
          await expect(portalSearch.getByRole("combobox")).toBeFocused();
          await expect(orderCard).toBeVisible();
          await portalSearch
            .getByRole("button", { name: "Suche schließen" })
            .click();
        }
        captures.push(
          await capture(
            rolf.page,
            `p3-order-v8-${viewport.name}-${viewport.width}x${viewport.height}.png`,
            "order-v8-overlay",
          ),
        );

        await orderCard
          .getByRole("button", { name: new RegExp(customerName) })
          .click();
        const customerCard = rolf.page.getByTestId("customer-card-v2");
        await expect(customerCard).toContainText(customerName);
        await expectFullyInsideViewport(
          rolf.page,
          customerCard.getByRole("button", { name: "Zurück", exact: true }),
        );
        await expectFullyInsideViewport(
          rolf.page,
          customerCard.getByRole("button", { name: "Schließen", exact: true }),
        );
        const customerActions = customerCard.locator(
          '[aria-label="Kundenaktionen"] a, [aria-label="Kundenaktionen"] button',
        );
        for (
          let index = 0;
          index < (await customerActions.count());
          index += 1
        ) {
          await expectFullyInsideViewport(
            rolf.page,
            customerActions.nth(index),
          );
        }
        captures.push(
          await capture(
            rolf.page,
            `p3-customer-v2-${viewport.name}-${viewport.width}x${viewport.height}.png`,
            "customer-v2-overlay",
          ),
        );
        await customerCard
          .getByRole("button", { name: /Auftragskarte öffnen|Aktiver Auftrag/ })
          .first()
          .click();
        await expect(rolf.page.getByTestId("order-card-v8")).toContainText(
          orderNumber,
        );
        await rolf.page
          .getByTestId("order-card-v8")
          .getByRole("button", { name: /Zurück/ })
          .click();
        await expect(rolf.page.getByTestId("customer-card-v2")).toBeVisible();
        await rolf.page
          .getByTestId("customer-card-v2")
          .getByRole("button", { name: /Zurück/ })
          .click();
        await expect(rolf.page.getByTestId("order-card-v8")).toBeVisible();
        await closeOverlay(rolf.page);

        const search = await openSearch(rolf.page, surface);
        await expect(search.getByRole("option")).toContainText(
          "Auftragsbestand",
        );
        await expect(search.getByRole("option")).toContainText(surface);
        await expect(search.getByRole("option")).toHaveAttribute(
          "href",
          `/orders/${stored.order_id}`,
        );
        captures.push(
          await capture(
            rolf.page,
            `p3-search-${viewport.name}-${viewport.width}x${viewport.height}.png`,
            "search-real-hit",
          ),
        );
        await search.getByRole("option").click();
        await expect(rolf.page.getByTestId("order-card-v8")).toContainText(
          orderNumber,
        );
        await closeOverlay(rolf.page);
      }

      await rolf.page.goto(`/orders/${stored.order_id}`, {
        waitUntil: "networkidle",
      });
      await expect(rolf.page.getByTestId("order-card-v8")).toContainText(
        orderNumber,
      );
      await rolf.page
        .getByTestId("order-card-v8")
        .getByRole("button", { name: /Zurück/ })
        .click();
      await rolf.page.waitForURL((url) => url.pathname === "/orders");
      await rolf.page.waitForLoadState("networkidle");
      await expect(
        rolf.page.getByRole("heading", { name: "Aufträge" }),
      ).toBeVisible();
      await expect(
        rolf.page.getByRole("button", { name: "Anlegen", exact: true }),
      ).toBeVisible();
      await rolf.page.goto(`/customers/${stored.customer_id}`, {
        waitUntil: "networkidle",
      });
      await expect(rolf.page.getByTestId("customer-card-v2")).toContainText(
        customerName,
      );
      await rolf.page
        .getByTestId("customer-card-v2")
        .getByRole("button", { name: /Zurück/ })
        .click();
      await rolf.page.waitForURL((url) => url.pathname === "/customers");
      await rolf.page.waitForLoadState("networkidle");
      await expect(
        rolf.page.getByRole("heading", { name: "Kunden" }),
      ).toBeVisible();
      await expect(
        rolf.page.getByRole("button", { name: "Anlegen", exact: true }),
      ).toBeVisible();

      const customerSearch = await openSearch(rolf.page, customerName);
      const customerHit = customerSearch.locator(
        '[role="option"][data-hit-type="CUSTOMER"]',
      );
      await expect(customerHit).toContainText("Kundenstamm");
      await expect(customerHit).toContainText(customerName);
      await expect(customerHit).toHaveAttribute(
        "href",
        `/customers/${stored.customer_id}`,
      );
      await customerHit.click();
      await expect(rolf.page.getByTestId("customer-card-v2")).toContainText(
        customerName,
      );
      await closeOverlay(rolf.page);
      const emptySearch = await openSearch(rolf.page, `ohne-beleg-${suffix}`);
      await expect(emptySearch.getByText("Prüfergebnis")).toBeVisible();
      await expect(emptySearch).toContainText(
        "Auftragsbestand und Kundenstamm",
      );
      await expect(emptySearch).not.toContainText(
        /nicht gefunden|Keine Treffer gefunden/i,
      );
      await emptySearch
        .getByRole("button", { name: "Suche schließen" })
        .click();

      const phillip = await newContext(browser);
      contexts.push(phillip.context);
      await loginPin(phillip.page, PHILLIP_ACTOR_ID, phillipPin, sessionSecret);
      for (const viewport of VIEWPORTS) {
        await phillip.page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });
        await expect(
          phillip.page.getByRole("heading", { name: "Werkstatt" }),
        ).toBeVisible();
        await expect(
          phillip.page.getByText("Quelle: Auftragsbestand"),
        ).toBeVisible();
        captures.push(
          await capture(
            phillip.page,
            `p3-phillip-home-${viewport.name}-${viewport.width}x${viewport.height}.png`,
            "phillip-home-data",
          ),
        );
      }

      const gregor = await newContext(browser);
      contexts.push(gregor.context);
      await loginEmail(
        gregor.page,
        GREGOR_ACTOR_ID,
        gregorEmail,
        gregorPassword,
        sessionSecret,
      );
      await expect(
        gregor.page.getByTestId("gregor-system-admin"),
      ).toContainText("Angemeldet als Gregor · Systemadministrator");
      for (const retiredAdminHref of [
        "/admin/analytics",
        "/admin/testanalyse",
        "/kvp",
      ]) {
        await expect(
          gregor.page.locator(`a[href="${retiredAdminHref}"]`),
        ).toHaveCount(0);
      }
      await expect(gregor.page.locator("body")).not.toContainText(
        /Technical Admin|\bTA\b/,
      );
      await expect(
        gregor.page.getByRole("link", { name: "Geld & Rechnungen" }),
      ).toHaveCount(0);
      await expect(gregor.page.getByRole("link", { name: "Geld" })).toHaveCount(
        0,
      );
      await gregor.page
        .getByRole("link", { name: "Kreile Startseite" })
        .click();
      await gregor.page.waitForURL((url) => url.pathname === "/settings", {
        timeout: 30_000,
      });
      await expect(
        gregor.page.getByTestId("gregor-system-admin"),
      ).toBeVisible();
      const [gregorReadback] = await sql<
        { id: string; email: string; role: string }[]
      >`
        SELECT id::text, email, role
        FROM public.app_users
        WHERE tenant_id = ${TENANT} AND id = ${GREGOR_ACTOR_ID}::uuid
      `;
      expect(gregorReadback).toEqual({
        id: GREGOR_ACTOR_ID,
        email: gregorEmail,
        role: "admin",
      });

      if (browserErrors.length > 0) {
        console.log(
          `PATH1_V5_P3_REQUEST_FAILURES=${JSON.stringify(requestFailures)}`,
        );
      }
      expect(browserErrors).toEqual([]);
      const candidateCodeSha = requiredEnv("P3_CANDIDATE_SHA");
      expect(candidateCodeSha).toMatch(/^[0-9a-f]{40}$/);
      const receipt = {
        candidateCodeShaAtRun: candidateCodeSha,
        evidenceScope: "SYNTHETIC_CI_FIXTURE",
        productionReadiness: "OPEN",
        postDeployEvidence: "OPEN",
        tenant: TENANT,
        actors: {
          rolf: "SYNTHETIC_READY",
          phillip: "SYNTHETIC_READY",
          gregor: "SYNTHETIC_READY",
        },
        synthetic: true,
        order: {
          id: stored.order_id,
          orderNumber,
          customerId: stored.customer_id,
          promisedDate,
          exactlyOne: stored.count,
        },
        paths: [
          "Rolf -> Direktaufnahme -> Auftrag",
          "Orders -> Auftrag -> Kunde -> Auftrag -> zurück",
          "Deep-Link -> Liste",
          "Suche -> V8/V2",
          "Rolf -> Geld & Rechnungen -> Accounting-minimal",
          "Rolf -> Werkstatt-Hub -> Wareneingang -> eine Erfassung -> Werkstatt-Hub",
          "/warendurchlauf/neu -> /warendurchlauf/wareneingang",
          "/station/wareneingang -> 404 without legacy station band",
          "Gregor -> E-Mail-Login -> Einstellungen -> Start -> Einstellungen",
          "60 retired/quarantined routes -> 404; Galvanik blackbox -> 200",
        ],
        retiredRouteResults,
        legacyStationRouteResult,
        captures,
      };
      mkdirSync(OUTPUT_DIR, { recursive: true });
      writeFileSync(
        path.join(OUTPUT_DIR, "p3-browser-receipt.json"),
        `${JSON.stringify(receipt, null, 2)}\n`,
        "utf8",
      );
      console.log(`PATH1_V5_P3_RECEIPT=${JSON.stringify(receipt)}`);
    } finally {
      await Promise.all(
        contexts.map((context) => context.close().catch(() => undefined)),
      );
      await sql.end();
    }
  });
});
