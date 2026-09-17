import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import bcrypt from "bcryptjs";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { createPinLoginHandle } from "../src/lib/server/pinLoginHandle";

const TENANT = "galvanik-kreile";
const ROLF_ID = "11111111-1111-4111-8111-111111111111";
const PHILLIP_ID = "22222222-2222-4222-8222-222222222222";
const ORIGIN = process.env.ACCOUNTING_TEST_ORIGIN?.trim() || "https://localhost:3443";
const OUTPUT_DIR = path.resolve("output/playwright/accounting-a0-a2");

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`ACCOUNTING_A0_A2_ENV_MISSING:${name}`);
  return value;
}

async function assertSession(page: Page, actorId: string, secret: string) {
  const cookie = (await page.context().cookies(ORIGIN)).find((entry) => entry.name === "kreile_app_session");
  expect(cookie).toMatchObject({ httpOnly: true, secure: true });
  const token = decodeURIComponent(cookie!.value);
  const separator = token.lastIndexOf(".");
  expect(separator).toBeGreaterThan(0);
  const payloadText = Buffer.from(token.slice(0, separator), "base64").toString("utf8");
  const expected = createHmac("sha256", secret).update(payloadText).digest();
  const actual = Buffer.from(token.slice(separator + 1), "hex");
  expect(actual.length).toBe(expected.length);
  expect(timingSafeEqual(actual, expected)).toBe(true);
  expect(JSON.parse(payloadText)).toMatchObject({ userId: actorId, tenantId: TENANT });
}

async function loginPin(page: Page, actorId: string, pin: string, secret: string) {
  await page.goto("/start");
  await page.getByTestId(`pin-user-card-${createPinLoginHandle(actorId)}`).click();
  const dialog = page.getByTestId("pin-login-dialog");
  await expect(dialog).toBeVisible();
  const target = page.waitForURL((url) => url.pathname === "/");
  for (const digit of pin) await dialog.getByRole("button", { name: digit, exact: true }).click();
  await target;
  await page.waitForLoadState("networkidle");
  await assertSession(page, actorId, secret);
}

async function createIntake(page: Page, name: string, promisedDate: string) {
  await page.goto("/warendurchlauf/wareneingang", { waitUntil: "networkidle" });
  const intakeTrigger = page.getByTestId("wareneingang-create-order");
  await expect(intakeTrigger).toBeVisible();
  await intakeTrigger.click();
  const dialog = page.getByRole("dialog", { name: "Neuer Eingang" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Neukunde", exact: true }).click();
  await dialog.getByLabel("Firma / Name").fill(name);
  await dialog.getByLabel("Terminwunsch").fill("2026-10-20");
  await dialog.getByLabel("Zugesagter Termin").fill(promisedDate);
  await dialog.getByLabel("Teil / Bezeichnung").fill("Synthetischer Prüfkörper");
  await dialog.getByLabel("Menge").fill("1");
  await dialog.getByLabel("Material").fill("Stahl");
  await dialog.getByLabel("Oberfläche").fill("Verzinken");
  await dialog.getByRole("button", { name: "Eingang speichern" }).click();
  const heading = dialog.getByRole("heading", { name: /^Auftrag A-\d{4}-\d+ angelegt$/ });
  await expect(heading).toBeVisible();
  const orderNumber = (await heading.textContent())!.replace(/^Auftrag /, "").replace(/ angelegt$/, "").trim();
  await dialog.getByRole("button", { name: "Anlegen schließen", exact: true }).click();
  return orderNumber;
}

async function capture(page: Page, file: string) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const target = path.join(OUTPUT_DIR, file);
  await page.screenshot({ path: target, fullPage: false });
  return { file, sha256: createHash("sha256").update(readFileSync(target)).digest("hex") };
}

test.describe("ACCOUNTING A0-A2 containment on existing surfaces", () => {
  test.use({ baseURL: ORIGIN, ignoreHTTPSErrors: true });

  test("proves payment reload, paid cancellation denial and unknown recovery without duplicate mutation", async ({ browser }) => {
    test.setTimeout(240_000);
    const databaseUrl = requiredEnv("DATABASE_URL");
    const sessionSecret = requiredEnv("APP_SESSION_SECRET");
    expect(databaseUrl).toMatch(/^postgresql:\/\/postgres:postgres@127\.0\.0\.1:\d+\/postgres$/);
    expect(ORIGIN).toMatch(/^https:\/\/localhost:\d+$/);
    expect(process.env.KREILE_ROLF_APP_USER_ID).toBe(ROLF_ID);
    expect(process.env.KREILE_PHILLIP_APP_USER_ID).toBe(PHILLIP_ID);

    const suffix = `${Date.now()}-${process.pid}`;
    const sql = postgres(databaseUrl, { max: 2, prepare: false });
    const contexts: BrowserContext[] = [];
    const captures: Array<{ file: string; sha256: string }> = [];
    const rolfPin = "4186";
    const phillipPin = "7315";
    try {
      await sql`
        INSERT INTO public.app_users (id, tenant_id, email, full_name, role, pin_hash, active, created_at, updated_at)
        VALUES
          (${ROLF_ID}::uuid, ${TENANT}, ${`a0-a2-rolf-${suffix}@local.test`}, 'Rolf', 'meister', ${await bcrypt.hash(rolfPin, 12)}, true, now(), now()),
          (${PHILLIP_ID}::uuid, ${TENANT}, ${`a0-a2-phillip-${suffix}@local.test`}, 'Phillip', 'werkstatt', ${await bcrypt.hash(phillipPin, 12)}, true, now(), now())
        ON CONFLICT (id) DO UPDATE SET
          tenant_id = excluded.tenant_id, email = excluded.email, full_name = excluded.full_name,
          role = excluded.role, pin_hash = excluded.pin_hash, active = true, updated_at = now()
      `;

      const rolfContext = await browser.newContext({
        viewport: { width: 1914, height: 917 },
        serviceWorkers: "block",
      });
      contexts.push(rolfContext);
      const rolf = await rolfContext.newPage();
      await loginPin(rolf, ROLF_ID, rolfPin, sessionSecret);

      const orderNumber = await createIntake(rolf, `SYNTHETISCH A0-A2 Zahlung ${suffix}`, "2026-10-23");
      const [order] = await sql<{ id: string; customer_id: string }[]>`
        SELECT id::text, customer_id::text
        FROM public.orders
        WHERE tenant_id = ${TENANT} AND order_number = ${orderNumber}
      `;
      if (!order) throw new Error("ACCOUNTING_A0_A2_ORDER_MISSING");
      const invoiceId = randomUUID();
      await sql`
        INSERT INTO public.invoices (
          id, tenant_id, customer_id, order_id, invoice_number, amount_total, status, due_date,
          gross_amount_cents, payment_contract_version, payment_mode, payment_status,
          payment_open_amount_cents, payment_paid_amount_cents, payment_currency, payment_version
        ) VALUES (
          ${invoiceId}::uuid, ${TENANT}, ${order.customer_id}, ${order.id}, 'R-2026-99001', 119.00,
          'issued', '2026-10-31'::date, 11900, 1, 'vorkasse', 'offen', 11900, 0, 'EUR', 0
        )
      `;

      await rolf.goto(`/orders/${order.id}`, { waitUntil: "networkidle" });
      const card = rolf.getByTestId("order-card-v8");
      await expect(card).toContainText(orderNumber);
      let confirmPaymentActionId = "";
      await rolf.route("**/*", async (route) => {
        const request = route.request();
        const actionId = request.headers()["next-action"];
        if (confirmPaymentActionId === "" && request.method() === "POST" && typeof actionId === "string") {
          confirmPaymentActionId = actionId;
        }
        await route.continue();
      });
      await card.getByRole("button", { name: "Zahlung bestätigen" }).click();
      await expect(card).toContainText("Zahlung wurde sicher bestätigt.");
      expect(confirmPaymentActionId).not.toBe("");
      await rolf.unroute("**/*");
      await rolf.reload({ waitUntil: "networkidle" });
      await expect(rolf.getByTestId("order-card-v8")).toContainText("bezahlt");
      captures.push(await capture(rolf, "accounting-payment-reload-1914x917.png"));
      const [paymentProof] = await sql<{ count: number; paid: number; open: number; status: string }[]>`
        SELECT
          (SELECT count(*)::integer FROM public.events event
            WHERE event.tenant_id = ${TENANT} AND event.event_type = 'PAYMENT_CONFIRMED_V1'
              AND event.payload->>'invoiceId' = ${invoiceId}) AS count,
          payment_paid_amount_cents::integer AS paid,
          payment_open_amount_cents::integer AS open,
          payment_status AS status
        FROM public.invoices WHERE id = ${invoiceId}::uuid
      `;
      expect(paymentProof).toEqual({ count: 1, paid: 11_900, open: 0, status: "bezahlt" });

      const unknownOrderNumber = await createIntake(rolf, `SYNTHETISCH A0-A2 Unklar ${suffix}`, "2026-10-24");
      const [unknownOrder] = await sql<{ id: string; customer_id: string }[]>`
        SELECT id::text, customer_id::text FROM public.orders
        WHERE tenant_id = ${TENANT} AND order_number = ${unknownOrderNumber}
      `;
      if (!unknownOrder) throw new Error("ACCOUNTING_A0_A2_UNKNOWN_ORDER_MISSING");
      const unknownInvoiceId = randomUUID();
      await sql`
        INSERT INTO public.invoices (
          id, tenant_id, customer_id, order_id, invoice_number, amount_total, status, due_date,
          gross_amount_cents, payment_contract_version, payment_mode, payment_status,
          payment_open_amount_cents, payment_paid_amount_cents, payment_currency, payment_version
        ) VALUES (
          ${unknownInvoiceId}::uuid, ${TENANT}, ${unknownOrder.customer_id}, ${unknownOrder.id}, 'R-2026-99002', 59.50,
          'issued', '2026-10-31'::date, 5950, 1, 'vorkasse', 'offen', 5950, 0, 'EUR', 0
        )
      `;
      let droppedCommittedResponse = false;
      try {
        await rolf.setViewportSize({ width: 390, height: 844 });
        await rolf.goto(`/orders/${unknownOrder.id}`, { waitUntil: "networkidle" });
        const unknownCard = rolf.getByTestId("order-card-v8");
        const paymentButton = unknownCard.getByRole("button", { name: "Zahlung bestätigen" });
        await rolf.route("**/*", async (route) => {
          const request = route.request();
          if (
            !droppedCommittedResponse
            && request.method() === "POST"
            && request.headers()["next-action"] === confirmPaymentActionId
          ) {
            const response = await route.fetch();
            expect(response.ok()).toBe(true);
            droppedCommittedResponse = true;
            await route.abort("connectionfailed");
            return;
          }
          await route.continue();
        });
        await paymentButton.click();
        await expect.poll(() => droppedCommittedResponse).toBe(true);
        await expect(unknownCard).toContainText("Zahlung wurde nach der Statusprüfung sicher bestätigt.");
        const [unknownProof] = await sql<{ count: number }[]>`
          SELECT count(*)::integer AS count FROM public.events
          WHERE tenant_id = ${TENANT} AND event_type = 'PAYMENT_CONFIRMED_V1'
            AND payload->>'invoiceId' = ${unknownInvoiceId}
        `;
        expect(unknownProof?.count).toBe(1);
        captures.push(await capture(rolf, "accounting-unknown-recovery-390x844.png"));
      } finally {
        await rolf.unroute("**/*");
      }
      await rolf.reload({ waitUntil: "networkidle" });
      await expect(rolf.getByTestId("order-card-v8")).toContainText("bezahlt");

      const [browserInvoiceOrder] = await sql<{
        order_id: string;
        order_number: string;
      }[]>`
        SELECT orders.id::text AS order_id, orders.order_number
        FROM public.orders orders
        JOIN private.order_freezes order_freeze
          ON order_freeze.tenant_id = orders.tenant_id
         AND order_freeze.order_id = orders.id
        WHERE orders.tenant_id = ${TENANT}
          AND orders.id = 'f14-command-browser-order'
          AND orders.station = 'fertig'
          AND orders.status = 'fertig'
          AND NOT EXISTS (
            SELECT 1 FROM public.invoices invoice
            WHERE invoice.tenant_id = orders.tenant_id
              AND invoice.order_id = orders.id
          )
      `;
      if (!browserInvoiceOrder) throw new Error("ACCOUNTING_A0_A2_BROWSER_INVOICE_ORDER_MISSING");

      await rolf.setViewportSize({ width: 1220, height: 880 });
      await rolf.goto(`/orders/${browserInvoiceOrder.order_id}`, { waitUntil: "networkidle" });
      const browserInvoiceCard = rolf.getByTestId("order-card-v8");
      await expect(browserInvoiceCard).toContainText(browserInvoiceOrder.order_number);
      await browserInvoiceCard.getByRole("button", { name: "Rechnung", exact: true }).click();
      await expect(browserInvoiceCard).toContainText(/Rechnung R-\d{4}-\d+ wurde unveränderlich ausgestellt\./);
      await browserInvoiceCard.getByRole("button", { name: "Zahlung bestätigen" }).click();
      await expect(browserInvoiceCard).toContainText("Zahlung wurde sicher bestätigt.");

      const [paidF14] = await sql<{
        invoice_id: string;
        invoice_number: string;
      }[]>`
        SELECT invoice.id::text AS invoice_id, invoice.invoice_number
        FROM public.invoices invoice
        WHERE invoice.tenant_id = ${TENANT}
          AND invoice.order_id = ${browserInvoiceOrder.order_id}
          AND invoice.contract_version = 1
          AND invoice.status = 'issued'
          AND invoice.payment_status = 'bezahlt'
      `;
      if (!paidF14) throw new Error("ACCOUNTING_A0_A2_F14_PAID_INVOICE_MISSING");
      const [beforeCancel] = await sql<{
        status: string; payment_status: string; paid: number; open: number;
        payment_version: number; pdf_hash: string; cancellation_events: number;
      }[]>`
        SELECT invoice.status, invoice.payment_status,
          invoice.payment_paid_amount_cents::integer AS paid,
          invoice.payment_open_amount_cents::integer AS open,
          invoice.payment_version::integer,
          invoice.pdf_sha256 AS pdf_hash,
          (SELECT count(*)::integer FROM public.events event
            WHERE event.tenant_id = invoice.tenant_id AND event.event_type = 'INVOICE_CANCELLED_V1'
              AND event.payload->>'invoiceId' = invoice.id::text) AS cancellation_events
        FROM public.invoices invoice WHERE invoice.id = ${paidF14.invoice_id}::uuid
      `;
      await rolf.goto("/buchhaltung/rechnungen", { waitUntil: "networkidle" });
      const row = rolf.getByTestId(`invoice-row-${paidF14.invoice_number}`);
      await row.getByLabel("Stornogrund").fill("Bereits bezahlte Rechnung bleibt unverändert");
      await row.getByRole("button", { name: "Rechnung stornieren" }).click();
      await expect(row.getByRole("alert")).toContainText("Eine Rechnung mit bestätigter Zahlung kann nicht storniert werden.");
      const [afterCancel] = await sql<typeof beforeCancel extends infer T ? T[] : never>`
        SELECT invoice.status, invoice.payment_status,
          invoice.payment_paid_amount_cents::integer AS paid,
          invoice.payment_open_amount_cents::integer AS open,
          invoice.payment_version::integer,
          invoice.pdf_sha256 AS pdf_hash,
          (SELECT count(*)::integer FROM public.events event
            WHERE event.tenant_id = invoice.tenant_id AND event.event_type = 'INVOICE_CANCELLED_V1'
              AND event.payload->>'invoiceId' = invoice.id::text) AS cancellation_events
        FROM public.invoices invoice WHERE invoice.id = ${paidF14.invoice_id}::uuid
      `;
      expect(afterCancel).toEqual(beforeCancel);
      captures.push(await capture(rolf, "accounting-paid-cancel-blocked-1220x880.png"));

      const phillipContext = await browser.newContext({
        viewport: { width: 768, height: 1024 },
        serviceWorkers: "block",
      });
      contexts.push(phillipContext);
      const phillip = await phillipContext.newPage();
      await loginPin(phillip, PHILLIP_ID, phillipPin, sessionSecret);
      await phillip.goto("/buchhaltung/rechnungen", { waitUntil: "networkidle" });
      await expect(phillip.getByText("Rechnungsliste ist mit dieser Rolle nicht erlaubt.", { exact: true }))
        .toBeVisible();
      captures.push(await capture(phillip, "accounting-invoice-denied-768x1024.png"));

      const receipt = {
        candidateProductSha: requiredEnv("ACCOUNTING_CANDIDATE_SHA"),
        syntheticLocalTenant: TENANT,
        actors: { rolf: ROLF_ID, phillip: PHILLIP_ID },
        payment: paymentProof,
        unknownOutcomeEventCount: 1,
        paidCancellationNullMutation: beforeCancel,
        captures,
      };
      writeFileSync(path.join(OUTPUT_DIR, "accounting-a0-a2-browser-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
    } finally {
      await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
      await sql.end();
    }
  });
});
