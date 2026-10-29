// @vitest-environment node

import { AsyncLocalStorage } from "node:async_hooks";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { KREILE_TENANT_SLUG } from "@/lib/tenant";
import type { AppSession } from "@/lib/server/appSession";

(globalThis as typeof globalThis & { AsyncLocalStorage: typeof AsyncLocalStorage }).AsyncLocalStorage = AsyncLocalStorage;

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.H18_EXPECTED_DATABASE_URL;
if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("H18_INVOICE_LOCAL_REPLAY_REQUIRED: DATABASE_URL must equal H18_EXPECTED_DATABASE_URL");
}
const parsed = new URL(DATABASE_URL);
if (parsed.protocol !== "postgresql:" || parsed.hostname !== "127.0.0.1" || parsed.pathname !== "/postgres" || parsed.username !== "postgres") {
  throw new Error("H18_INVOICE_LOCAL_REPLAY_REQUIRED: dedicated loopback Postgres expected");
}
if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("H18_INVOICE_LOCAL_REPLAY_REQUIRED: service role must be unset");

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const originalSecret = process.env.APP_SESSION_SECRET;
process.env.APP_SESSION_SECRET = "h18-invoice-actions-local-only";

type Fixture = {
  actorId: string;
  actorIssuedAt: number;
  customerId: string;
  freezeId: string;
  rateId: string;
};

async function withRequest<T>(cookie: string, work: () => Promise<T>): Promise<T> {
  const { NextRequest } = await import("next/server");
  const { createRequestStoreForAPI } = await import("next/dist/server/async-storage/request-store");
  const { workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external");
  const { workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external");
  const request = new NextRequest("http://127.0.0.1/h18-invoice-actions", { headers: { cookie } });
  const workStore = {
    isStaticGeneration: false,
    page: "/h18-invoice-actions",
    route: "/h18-invoice-actions",
    afterContext: {},
    previouslyRevalidatedTags: [],
    refreshTagsByCacheKind: new Map(),
    shouldTrackFetchMetrics: false,
    deploymentId: "test",
    buildId: "test",
    incrementalCache: {},
    cacheComponentsEnabled: false,
    runInCleanSnapshot: (fn: (...args: never[]) => unknown, ...args: never[]) => fn(...args),
    reactServerErrorsByDigest: new Map(),
  } as unknown as import("next/dist/server/app-render/work-async-storage.external").WorkStore;
  const requestStore = createRequestStoreForAPI(
    request,
    { pathname: "/h18-invoice-actions", search: "" },
    { tags: [], expirationsByCacheKind: new Map() },
    undefined,
    undefined as never,
  );
  return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(requestStore, work));
}

async function withSession<T>(fixture: Fixture, work: () => Promise<T>): Promise<T> {
  const { COOKIE_NAME, getSecretKey, signAppSession } = await import("@/lib/server/appSession");
  const session: AppSession = {
    userId: fixture.actorId,
    tenantId: KREILE_TENANT_SLUG,
    role: "meister",
    displayName: "Rolf H18 Rechnung",
    issuedAt: fixture.actorIssuedAt,
    expiresAt: Date.now() + 5 * 60_000,
  };
  return withRequest(`${COOKIE_NAME}=${signAppSession(session, getSecretKey())}`, work);
}

async function createFixture(): Promise<Fixture> {
  const actorId = randomUUID();
  const customerId = randomUUID();
  const settingsId = randomUUID();
  const freezeId = randomUUID();
  const rateId = randomUUID();
  const updatedAt = new Date(Date.now() - 5_000).toISOString();
  await sql.begin(async (transaction) => {
    await transaction`
      INSERT INTO public.app_users
        (id, tenant_id, email, full_name, role, active, created_at, updated_at)
      VALUES (
        ${actorId}::uuid, ${KREILE_TENANT_SLUG}, ${`rolf-h18-invoice-${actorId}@local.invalid`},
        'Rolf H18 Rechnung', 'meister', true, ${updatedAt}::timestamptz, ${updatedAt}::timestamptz
      )
    `;
    await transaction`
      INSERT INTO public.app_user_rights (tenant_id, user_id, bereich, granted_by)
      SELECT ${KREILE_TENANT_SLUG}, ${actorId}::uuid, area, ${actorId}::uuid
      FROM unnest(ARRAY['eingang', 'auftraege', 'kunden', 'geld']::text[]) area
    `;
    await transaction`
      INSERT INTO public.company_settings (
        id, tenant_id, company_name, street, zip, city, country,
        iban, bic, bank_name, tax_id, invoice_vat_rate_basis_points,
        invoice_payment_term_days
      ) VALUES (
        ${settingsId}, ${KREILE_TENANT_SLUG}, 'H18 Galvanik Kreile',
        'Pruefstrasse 18', '70173', 'Stuttgart', 'Deutschland',
        'DE02120300000000202051', 'BYLADEM1001', 'H18 Testbank',
        'DE-H18-INVOICE', 1900, 14
      )
    `;
    await transaction`
      INSERT INTO public.customers (
        id, tenant_id, customer_number, name, company_name, type, contact_person,
        email, phone, street, zip_code, city, country, payment_preference,
        ziel_freigeschaltet, source
      ) VALUES (
        ${customerId}, ${KREILE_TENANT_SLUG}, ${`H18-R-${customerId.slice(0, 8)}`},
        'H18 Rechnungskunde', 'H18 Rechnungskunde GmbH', 'business', 'Ada Rechnung',
        ${`rechnung-${customerId}@local.invalid`}, '+49 711 5550188', 'Kundenweg 18',
        '70174', 'Stuttgart', 'Deutschland', 'vorkasse', false, 'manual'
      )
    `;
  });
  const [clock] = await sql<{ updated_at_ms: string }[]>`
    SELECT floor(extract(epoch FROM updated_at) * 1000)::bigint::text AS updated_at_ms
    FROM public.app_users WHERE id = ${actorId}::uuid
  `;
  const actorIssuedAt = Date.now();
  if (!clock || Number(clock.updated_at_ms) >= actorIssuedAt) throw new Error("H18_INVOICE_SESSION_ORDER_INVALID");
  return { actorId, actorIssuedAt, customerId, freezeId, rateId };
}

beforeAll(async () => {
  const migrations = await sql<{ version: string }[]>`
    SELECT version::text FROM supabase_migrations.schema_migrations ORDER BY version
  `;
  const repositoryMigrations = readdirSync(join(process.cwd(), "supabase", "migrations"))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .map((file) => file.slice(0, file.indexOf("_")))
    .sort();
  expect(migrations.map((row) => row.version)).toEqual(repositoryMigrations);
});

afterAll(async () => {
  await sql.end({ timeout: 1 });
  if (originalSecret === undefined) delete process.env.APP_SESSION_SECRET;
  else process.env.APP_SESSION_SECRET = originalSecret;
});

describe("H18 invoice Server Actions against the real replay database", () => {
  it("sets prices, issues and cancels through the UI actions with DB, event, view and PDF readback", async () => {
    const fixture = await createFixture();
    const intakeClientEventId = randomUUID();
    const priceClientEventId = randomUUID();
    const issueClientEventId = randomUUID();
    const cancelClientEventId = randomUUID();
    const freezeEventId = randomUUID();
    const freezeClientEventId = randomUUID();
    const freezeCorrelationId = randomUUID();

    const { createOrderIntakeAction } = await import("@/app/warendurchlauf/actions");
    const intake = await withSession(fixture, () => createOrderIntakeAction({
      clientEventId: intakeClientEventId,
      customer: { mode: "EXISTING", customerId: fixture.customerId },
      dueDate: "2027-03-31",
      termStatus: "bestaetigt",
      intakeSource: "persoenlich",
      handoverMode: "pickup",
      paymentMode: "vorkasse",
      note: "H18 Rechnungslauf",
      items: [{
        catalogServiceId: null,
        name: "H18 Rechnungsteil",
        quantity: 2,
        material: "Stahl",
        surfaceRequested: "Hartchrom",
        executionRequested: "offen",
        unit: null,
        unitPriceCents: null,
        vatRateBasisPoints: null,
      }],
    }));
    if (intake.code !== "OK") throw new Error(`H18_INVOICE_INTAKE_FAILED:${intake.code}:${intake.message}`);
    expect(intake.code).toBe("OK");
    const itemId = intake.receipt.items[0]?.id;
    if (!itemId) throw new Error("H18_INVOICE_ITEM_MISSING");

    await sql.begin(async (transaction) => {
      await transaction`
        UPDATE public.orders
        SET station='fertig', current_station='fertig', current_station_id='fertig',
            status='fertig', version=2
        WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${intake.receipt.orderId}
      `;
      await transaction`
        UPDATE public.items SET current_station_id='fertig'
        WHERE tenant_id=${KREILE_TENANT_SLUG} AND id=${itemId}
      `;
      await transaction`
        INSERT INTO private.extra_work_hourly_rates
          (id, tenant_id, hourly_rate_cents, version, created_by, effective_at)
        VALUES (${fixture.rateId}::uuid, ${KREILE_TENANT_SLUG}, 12000, 1, ${fixture.actorId}::uuid, now())
      `;
      await transaction`
        INSERT INTO public.events (
          id, tenant_id, order_id, event_type, description, user_id, payload,
          status, station, client_event_id, event_schema_version,
          correlation_id, aggregate_version, from_station
        ) VALUES (
          ${freezeEventId}, ${KREILE_TENANT_SLUG}, ${intake.receipt.orderId},
          'ORDER_FROZEN_V1', 'H18 Auftrag fertiggestellt', ${fixture.actorId}::uuid,
          ${transaction.json({
            freezeId: fixture.freezeId,
            rateId: fixture.rateId,
            hourlyRateCents: 12000,
            totalAmountCents: 0,
            lineCount: 0,
          })},
          'success', 'fertig', ${freezeClientEventId}::uuid, 1,
          ${freezeCorrelationId}::uuid, 2, 'galvanik'
        )
      `;
      await transaction`
        INSERT INTO private.order_freezes (
          id, tenant_id, order_id, event_id, hourly_rate_id, hourly_rate_cents,
          total_amount_cents, line_count, order_version, frozen_by, frozen_at
        ) VALUES (
          ${fixture.freezeId}::uuid, ${KREILE_TENANT_SLUG}, ${intake.receipt.orderId},
          ${freezeEventId}, ${fixture.rateId}::uuid, 12000, 0, 0, 2,
          ${fixture.actorId}::uuid, now()
        )
      `;
    });

    const {
      cancelInvoiceAction,
      getInvoiceCancellationReceiptAction,
      getInvoiceReceiptAction,
      getInvoiceSummariesAction,
      issueInvoiceAction,
      setInvoiceItemPricesAction,
    } = await import("@/app/actions/invoices.actions");
    const { getLiveOrderCardAction } = await import("@/app/actions/orders.actions");

    const priced = await withSession(fixture, () => setInvoiceItemPricesAction({
      orderId: intake.receipt.orderId,
      expectedVersion: 2,
      clientEventId: priceClientEventId,
      prices: [{ itemId, unitPriceCents: 12_345 }],
    }));
    expect(priced.code).toBe("OK");
    if (priced.code !== "OK") throw new Error(`H18_INVOICE_PRICE_FAILED:${priced.code}`);
    const [priceRow] = await sql<{
      unit_price_cents: number;
      order_version: number;
      event_type: string;
      actor_id: string;
      event_version: number;
    }[]>`
      SELECT round(item.preis_netto * 100)::integer AS unit_price_cents,
        orders.version AS order_version, event.event_type,
        event.user_id::text AS actor_id, event.aggregate_version AS event_version
      FROM public.items item
      JOIN public.orders orders ON orders.id=item.order_id AND orders.tenant_id=item.tenant_id
      JOIN public.events event ON event.order_id=orders.id AND event.tenant_id=orders.tenant_id
        AND event.client_event_id=${priceClientEventId}::uuid
      WHERE item.id=${itemId} AND item.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(priceRow).toEqual({
      unit_price_cents: 12_345,
      order_version: 3,
      event_type: "ORDER_INVOICE_PRICES_SET_V1",
      actor_id: fixture.actorId,
      event_version: 3,
    });
    const pricedCard = await withSession(fixture, () => getLiveOrderCardAction({ orderId: intake.receipt.orderId }));
    expect(pricedCard.code).toBe("OK");
    if (pricedCard.code === "OK") {
      expect(pricedCard.data.card.version).toBe(3);
      expect(pricedCard.data.card.items).toContainEqual(expect.objectContaining({ id: itemId, unitPriceCents: 12_345 }));
    }

    const issued = await withSession(fixture, () => issueInvoiceAction({
      orderId: intake.receipt.orderId,
      expectedVersion: 3,
      clientEventId: issueClientEventId,
    }));
    expect(issued.code).toBe("OK");
    if (issued.code !== "OK") throw new Error(`H18_INVOICE_ISSUE_FAILED:${issued.code}`);
    const [invoiceRow] = await sql<{
      id: string;
      status: string;
      aggregate_version: number;
      pdf_sha256: string;
      pdf_content: Buffer;
      event_type: string;
      event_count: number;
    }[]>`
      SELECT invoice.id::text, invoice.status, invoice.aggregate_version,
        invoice.pdf_sha256, invoice.pdf_content, event.event_type,
        count(*) OVER ()::integer AS event_count
      FROM public.invoices invoice
      JOIN public.events event ON event.id=invoice.issue_event_id
      WHERE invoice.id=${issued.receipt.invoiceId}::uuid
        AND invoice.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(invoiceRow).toMatchObject({
      id: issued.receipt.invoiceId,
      status: "issued",
      aggregate_version: 1,
      event_type: "INVOICE_CREATED_V1",
      event_count: 1,
      pdf_sha256: issued.receipt.pdfSha256,
    });
    const issueReceipt = await withSession(fixture, () => getInvoiceReceiptAction({
      orderId: intake.receipt.orderId,
      clientEventId: issueClientEventId,
    }));
    expect(issueReceipt).toEqual({ code: "OK", data: issued.receipt });
    const issuedView = await withSession(fixture, () => getInvoiceSummariesAction());
    expect(issuedView.code).toBe("OK");
    if (issuedView.code === "OK") {
      expect(issuedView.data).toContainEqual(expect.objectContaining({ invoiceId: issued.receipt.invoiceId, status: "issued" }));
    }

    const { GET: readInvoicePdfRoute } = await import("@/app/api/invoices/[invoiceId]/pdf/route");
    const originalPdf = await withSession(fixture, () => readInvoicePdfRoute(
      new Request(`http://127.0.0.1/api/invoices/${issued.receipt.invoiceId}/pdf?disposition=inline`),
      { params: Promise.resolve({ invoiceId: issued.receipt.invoiceId }) },
    ));
    expect(originalPdf.status).toBe(200);
    const originalBytes = Buffer.from(await originalPdf.arrayBuffer());
    expect(originalBytes.equals(Buffer.from(invoiceRow!.pdf_content))).toBe(true);
    expect(createHash("sha256").update(originalBytes).digest("hex")).toBe(invoiceRow!.pdf_sha256);

    const cancelled = await withSession(fixture, () => cancelInvoiceAction({
      invoiceId: issued.receipt.invoiceId,
      expectedVersion: 1,
      reason: "H18 vollstaendiger Pruefstorno",
      clientEventId: cancelClientEventId,
    }));
    expect(cancelled.code).toBe("OK");
    if (cancelled.code !== "OK") throw new Error(`H18_INVOICE_CANCEL_FAILED:${cancelled.code}`);
    const [cancelRow] = await sql<{
      status: string;
      aggregate_version: number;
      cancel_reason: string;
      cancellation_pdf_sha256: string;
      cancellation_pdf_content: Buffer;
      event_type: string;
      event_count: number;
    }[]>`
      SELECT invoice.status, invoice.aggregate_version, invoice.cancel_reason,
        invoice.cancellation_pdf_sha256, invoice.cancellation_pdf_content,
        event.event_type, count(*) OVER ()::integer AS event_count
      FROM public.invoices invoice
      JOIN public.events event ON event.id=invoice.cancel_event_id
      WHERE invoice.id=${issued.receipt.invoiceId}::uuid
        AND invoice.tenant_id=${KREILE_TENANT_SLUG}
    `;
    expect(cancelRow).toMatchObject({
      status: "cancelled",
      aggregate_version: 2,
      cancel_reason: "H18 vollstaendiger Pruefstorno",
      cancellation_pdf_sha256: cancelled.receipt.cancellationPdfSha256,
      event_type: "INVOICE_CANCELLED_V1",
      event_count: 1,
    });
    const cancelReceipt = await withSession(fixture, () => getInvoiceCancellationReceiptAction({
      invoiceId: issued.receipt.invoiceId,
      clientEventId: cancelClientEventId,
    }));
    expect(cancelReceipt).toEqual({ code: "OK", data: cancelled.receipt });
    const cancelledView = await withSession(fixture, () => getInvoiceSummariesAction());
    expect(cancelledView.code).toBe("OK");
    if (cancelledView.code === "OK") {
      expect(cancelledView.data).toContainEqual(expect.objectContaining({ invoiceId: issued.receipt.invoiceId, status: "cancelled", aggregateVersion: 2 }));
    }
    const cancellationPdf = await withSession(fixture, () => readInvoicePdfRoute(
      new Request(`http://127.0.0.1/api/invoices/${issued.receipt.invoiceId}/pdf?kind=cancellation&disposition=inline`),
      { params: Promise.resolve({ invoiceId: issued.receipt.invoiceId }) },
    ));
    expect(cancellationPdf.status).toBe(200);
    const cancellationBytes = Buffer.from(await cancellationPdf.arrayBuffer());
    expect(cancellationBytes.equals(Buffer.from(cancelRow!.cancellation_pdf_content))).toBe(true);
    expect(createHash("sha256").update(cancellationBytes).digest("hex")).toBe(cancelRow!.cancellation_pdf_sha256);
  }, 60_000);
});
