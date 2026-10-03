// @vitest-environment node
//
// T-G07-016 / K-G07-004: Storno-Payment-Gate auf DB-Ebene.
//
// Dieser Test geht bewusst NICHT ueber die App-Command-Schicht. Er setzt das
// Session-Flag `app.invoice_cancel_command = 'v1'` selbst und schreibt das
// Storno direkt per UPDATE - genau so, wie ein Schreibweg aussieht, der
// `hasClearlyUnpaidPaymentState` umgeht. Geprueft wird deshalb ausschliesslich
// der Trigger `invoices_f14_update_guard` bzw.
// `private.guard_f1_4_invoice_update()` aus
// supabase/migrations/20260929190000_f1_4_invoice_cancel_payment_guard.sql.
//
// Jeder Fall verwendet dieselbe UPDATE-Form mit vollstaendig vertragsgueltigen
// Storno-Feldern. Damit ist der Zahlungsstand die einzige Variable: wuerde der
// Guard fehlen oder zu schwach sein, ginge das UPDATE durch (Testfehler) statt
// in einen anderen CHECK zu laufen.

import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

const DATABASE_URL = process.env.DATABASE_URL;
const EXPECTED_DATABASE_URL = process.env.F1_4_EXPECTED_DATABASE_URL;

if (!DATABASE_URL || !EXPECTED_DATABASE_URL || DATABASE_URL !== EXPECTED_DATABASE_URL) {
  throw new Error("F1_4_LOCAL_DATABASE_REQUIRED: DATABASE_URL must equal F1_4_EXPECTED_DATABASE_URL");
}

const parsedUrl = new URL(DATABASE_URL);
if (
  parsedUrl.protocol !== "postgresql:"
  || parsedUrl.hostname !== "127.0.0.1"
  || !/^\d{4,5}$/.test(parsedUrl.port)
  || parsedUrl.pathname !== "/postgres"
  || parsedUrl.username !== "postgres"
) {
  throw new Error("F1_4_LOCAL_DATABASE_REQUIRED: expected the dedicated local F1.4 Postgres database");
}

if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("F1_4_LOCAL_DATABASE_REQUIRED: SUPABASE_SERVICE_ROLE_KEY must be unset");
}

const sql = postgres(DATABASE_URL, { max: 2, prepare: false });
const suffix = `${Date.now()}-${process.pid}`;

afterAll(async () => {
  await sql.end({ timeout: 1 });
});

/** The tagged-template surface shared by the pooled client and a transaction. */
type Tx = postgres.ISql;

const NET_AMOUNT_CENTS = 10_000;
const VAT_AMOUNT_CENTS = 1_900;
const GROSS_AMOUNT_CENTS = 11_900;
type InvoiceAmounts = {
  netAmountCents: number;
  vatAmountCents: number;
  grossAmountCents: number;
};
const DEFAULT_AMOUNTS: InvoiceAmounts = {
  netAmountCents: NET_AMOUNT_CENTS,
  vatAmountCents: VAT_AMOUNT_CENTS,
  grossAmountCents: GROSS_AMOUNT_CENTS,
};
const ZERO_AMOUNTS: InvoiceAmounts = {
  netAmountCents: 0,
  vatAmountCents: 0,
  grossAmountCents: 0,
};
/** Berlin 2026-09-09 is the service date derived from this freeze instant. */
const FROZEN_AT = "2026-09-09T10:00:00.000Z";
const SERVICE_DATE = "2026-09-09";
/** Berlin 2026-09-10 + 14 days payment term = 2026-09-24 due date. */
const ISSUED_AT = "2026-09-10T09:00:00.000Z";
const DUE_DATE = "2026-09-24";
const CANCELLED_AT = "2026-09-11T08:00:00.000Z";
const PAID_AT = "2026-09-10T12:00:00.000Z";
const CANCEL_REASON = "Storno-Payment-Gate Nachweis T-G07-016";

type PaymentFixture = {
  contractVersion: number | null;
  mode: string | null;
  status: string | null;
  openAmountCents: number | null;
  paidAmountCents: number | null;
  currency: string | null;
  method: string | null;
  paidAt: string | null;
  receiptId: string | null;
  eventId: string | null;
  correlationId: string | null;
  version: number;
};

/** The exact state a freshly issued F1.5 invoice carries: fully unpaid. */
const UNPAID: PaymentFixture = {
  contractVersion: 1,
  mode: "vorkasse",
  status: "offen",
  openAmountCents: GROSS_AMOUNT_CENTS,
  paidAmountCents: 0,
  currency: "EUR",
  method: null,
  paidAt: null,
  receiptId: null,
  eventId: null,
  correlationId: null,
  version: 0,
};
const ZERO_UNPAID: PaymentFixture = {
  ...UNPAID,
  openAmountCents: 0,
};

type InvoiceState = {
  status: string;
  aggregate_version: number;
  cancel_client_event_id: string | null;
  cancel_correlation_id: string | null;
  cancelled_by: string | null;
  cancel_reason: string | null;
  cancelled_at: string | null;
  cancel_event_id: string | null;
  cancellation_pdf_ref: string | null;
  cancellation_pdf_sha256: string | null;
  cancellation_pdf_bytes: number | null;
  payment_contract_version: number | null;
  payment_mode: string | null;
  payment_status: string | null;
  payment_open_amount_cents: number | null;
  payment_paid_amount_cents: number | null;
  payment_currency: string | null;
  payment_method: string | null;
  payment_paid_at: string | null;
  payment_receipt_id: string | null;
  payment_event_id: string | null;
  payment_correlation_id: string | null;
  payment_version: number;
};

type SeededCase = {
  label: string;
  invoiceId: string;
  orderId: string;
  invoiceNumber: string;
  cancelEventId: string;
  cancelClientEventId: string;
  cancelCorrelationId: string;
  cancellationPdf: Buffer;
  cancellationPdfSha256: string;
  userId: string;
};

async function readInvoiceState(transaction: Tx, invoiceId: string): Promise<InvoiceState> {
  const [state] = await transaction<InvoiceState[]>`
    SELECT
      status,
      aggregate_version,
      cancel_client_event_id::text,
      cancel_correlation_id::text,
      cancelled_by::text,
      cancel_reason,
      CASE WHEN cancelled_at IS NULL THEN NULL
        ELSE to_char(cancelled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      END AS cancelled_at,
      cancel_event_id,
      cancellation_pdf_ref,
      cancellation_pdf_sha256,
      octet_length(cancellation_pdf_content)::integer AS cancellation_pdf_bytes,
      payment_contract_version,
      payment_mode,
      payment_status,
      payment_open_amount_cents,
      payment_paid_amount_cents,
      payment_currency,
      payment_method,
      CASE WHEN payment_paid_at IS NULL THEN NULL
        ELSE to_char(payment_paid_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
      END AS payment_paid_at,
      payment_receipt_id,
      payment_event_id,
      payment_correlation_id::text,
      payment_version
    FROM public.invoices
    WHERE id = ${invoiceId}::uuid
  `;
  if (!state) throw new Error("F1_4_CANCEL_GUARD_STATE_MISSING");
  return state;
}

/** Seeds the tenant-wide master data every F1.4 invoice depends on. */
async function seedTenant(transaction: Tx, params: {
  tenantId: string;
  userId: string;
  rateId: string;
  label: string;
}): Promise<void> {
  await transaction`
    INSERT INTO public.app_users
      (id, tenant_id, email, full_name, role, active, created_at, updated_at)
    VALUES (
      ${params.userId}::uuid, ${params.tenantId},
      ${`${params.label}@local.invalid`}, 'F1.4 Guard Synthetic Admin', 'admin',
      true, now(), now()
    )
  `;
  await transaction`
    INSERT INTO public.company_settings (
      id, tenant_id, company_name, street, zip, city, country,
      iban, bic, bank_name, tax_id, invoice_vat_rate_basis_points,
      invoice_payment_term_days
    ) VALUES (
      ${`settings-${params.label}`}, ${params.tenantId}, 'F1.4 Synthetic Galvanik GmbH',
      'Testweg 1', '70173', 'Stuttgart', 'Deutschland',
      'DE02120300000000202051', 'BYLADEM1001', 'F1.4 Testbank',
      'DE-SYNTHETIC-TAX', 1900, 14
    )
  `;
  await transaction`
    INSERT INTO private.extra_work_hourly_rates (
      id, tenant_id, hourly_rate_cents, version, created_by, effective_at
    ) VALUES (
      ${params.rateId}::uuid, ${params.tenantId}, 12000, 1, ${params.userId}::uuid, now()
    )
  `;
}

/**
 * Seeds one complete, contract-valid F1.4 invoice in status `issued` with the
 * given F1.5 payment state, including its customer, order, item, freeze and
 * INVOICE_CREATED_V1 event. Nothing here is a shortcut: every CHECK of the
 * immutable invoice contract has to accept the row.
 */
async function seedIssuedInvoice(transaction: Tx, params: {
  tenantId: string;
  userId: string;
  rateId: string;
  label: string;
  invoiceNumber: string;
  payment: PaymentFixture;
  amounts?: InvoiceAmounts;
}): Promise<SeededCase> {
  const amounts = params.amounts ?? DEFAULT_AMOUNTS;
  const customerId = `customer-${params.label}`;
  const orderId = `order-${params.label}`;
  const itemId = `item-${params.label}`;
  const freezeId = randomUUID();
  const freezeEventId = `freeze-event-${params.label}`;
  const invoiceId = randomUUID();
  const issueEventId = `issue-event-${params.label}`;
  const cancelEventId = `cancel-event-${params.label}`;
  const pdf = Buffer.from(`%PDF-1.4\nF1.4 ${params.label} original\n%%EOF`, "utf8");
  const pdfSha256 = createHash("sha256").update(pdf).digest("hex");
  const cancellationPdf = Buffer.from(
    `%PDF-1.4\nF1.4 ${params.label} cancellation\n%%EOF`,
    "utf8",
  );
  const cancellationPdfSha256 = createHash("sha256").update(cancellationPdf).digest("hex");

  await transaction`
    INSERT INTO public.customers (
      id, tenant_id, customer_number, name, company_name, type,
      street, zip_code, city, country, created_at, updated_at
    ) VALUES (
      ${customerId}, ${params.tenantId}, ${`KDN-${params.label}`},
      'F1.4 Synthetic Customer', 'F1.4 Synthetic Customer GmbH', 'business',
      'Kundenweg 2', '70174', 'Stuttgart', 'Deutschland', now(), now()
    )
  `;
  await transaction`
    INSERT INTO public.orders (
      id, tenant_id, order_number, customer_id, title, station,
      current_station, current_station_id, version, status, created_at
    ) VALUES (
      ${orderId}, ${params.tenantId}, ${`A-${params.label}`}, ${customerId},
      'F1.4 Synthetic Order', 'fertig', 'fertig', 'fertig', 2, 'fertig', now()
    )
  `;
  await transaction`
    INSERT INTO public.items (
      id, tenant_id, order_id, customer_id, name, quantity,
      current_station_id, preis_netto, created_at
    ) VALUES (
      ${itemId}, ${params.tenantId}, ${orderId}, ${customerId},
      'F1.4 Synthetic Position', 1, 'fertig', ${amounts.netAmountCents / 100}, now()
    )
  `;
  await transaction`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, created_at, client_event_id,
      event_schema_version, correlation_id, aggregate_version, from_station
    ) VALUES (
      ${freezeEventId}, ${params.tenantId}, ${orderId}, NULL,
      'ORDER_FROZEN_V1', 'Order frozen from galvanik to fertig', ${params.userId}::uuid,
      ${transaction.json({
        freezeId,
        rateId: params.rateId,
        hourlyRateCents: 12000,
        totalAmountCents: 0,
        lineCount: 0,
      })},
      'success', 'fertig', ${FROZEN_AT}::timestamptz AT TIME ZONE 'UTC',
      ${randomUUID()}::uuid, 1, ${randomUUID()}::uuid, 2, 'galvanik'
    )
  `;
  await transaction`
    INSERT INTO private.order_freezes (
      id, tenant_id, order_id, event_id, hourly_rate_id,
      hourly_rate_cents, total_amount_cents, line_count, order_version,
      frozen_by, frozen_at
    ) VALUES (
      ${freezeId}::uuid, ${params.tenantId}, ${orderId}, ${freezeEventId},
      ${params.rateId}::uuid, 12000, 0, 0, 2, ${params.userId}::uuid,
      ${FROZEN_AT}::timestamptz
    )
  `;

  const issueClientEventId = randomUUID();
  const issueCorrelationId = randomUUID();
  await transaction`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, client_event_id, event_schema_version,
      correlation_id, aggregate_version, from_station, created_at
    ) VALUES (
      ${issueEventId}, ${params.tenantId}, ${orderId}, NULL,
      'INVOICE_CREATED_V1', 'Unveraenderliche Rechnung erstellt', ${params.userId}::uuid,
      ${transaction.json({
        invoiceId,
        freezeId,
        invoiceNumber: params.invoiceNumber,
        orderVersion: 2,
        netAmountCents: amounts.netAmountCents,
        vatRateBasisPoints: 1900,
        vatAmountCents: amounts.vatAmountCents,
        grossAmountCents: amounts.grossAmountCents,
        pdfSha256,
        invoiceVersion: 1,
      })}::jsonb,
      'success', 'fertig', ${issueClientEventId}::uuid, 1,
      ${issueCorrelationId}::uuid, 1, 'fertig',
      ${ISSUED_AT}::timestamptz AT TIME ZONE 'UTC'
    )
  `;

  const snapshot = {
    schemaVersion: 1,
    seller: {
      companyName: "F1.4 Synthetic Galvanik GmbH",
      street: "Testweg 1",
      zip: "70173",
      city: "Stuttgart",
      country: "Deutschland",
      taxId: "DE-SYNTHETIC-TAX",
      iban: "DE02120300000000202051",
      bic: "BYLADEM1001",
      bankName: "F1.4 Testbank",
    },
    customer: {
      name: "F1.4 Synthetic Customer",
      companyName: "F1.4 Synthetic Customer GmbH",
      contactPerson: null,
      street: "Kundenweg 2",
      zip: "70174",
      city: "Stuttgart",
      country: "Deutschland",
    },
    order: {
      orderId,
      orderVersion: 2,
      orderNumber: `A-${params.label}`,
      title: "F1.4 Synthetic Order",
      freezeId,
    },
    lines: [{
      type: "BASE",
      itemId,
      name: "F1.4 Synthetic Position",
      quantity: 1,
      unitNetAmountCents: amounts.netAmountCents,
      lineNetAmountCents: amounts.netAmountCents,
    }],
    totals: {
      netAmountCents: amounts.netAmountCents,
      vatRateBasisPoints: 1900,
      vatAmountCents: amounts.vatAmountCents,
      grossAmountCents: amounts.grossAmountCents,
    },
    serviceDate: SERVICE_DATE,
    issuedAt: ISSUED_AT,
    paymentTermDays: 14,
  };

  await transaction`
    INSERT INTO public.invoices (
      id, tenant_id, customer_id, order_id, invoice_number, amount_total,
      status, due_date, contract_version, freeze_id, snapshot,
      net_amount_cents, vat_rate_basis_points, vat_amount_cents,
      gross_amount_cents, service_date, payment_term_days,
      order_version, aggregate_version, client_event_id, correlation_id,
      issue_event_id, issued_at, issued_by, pdf_ref, pdf_sha256, pdf_content,
      payment_contract_version, payment_mode, payment_status,
      payment_open_amount_cents, payment_paid_amount_cents, payment_currency,
      payment_method, payment_paid_at, payment_receipt_id, payment_event_id,
      payment_correlation_id, payment_version
    ) VALUES (
      ${invoiceId}::uuid, ${params.tenantId}, ${customerId}, ${orderId},
      ${params.invoiceNumber}, ${amounts.grossAmountCents / 100}, 'issued', ${DUE_DATE}::date,
      1, ${freezeId}::uuid, ${transaction.json(snapshot)}::jsonb,
      ${amounts.netAmountCents}, 1900, ${amounts.vatAmountCents}, ${amounts.grossAmountCents},
      ${SERVICE_DATE}::date, 14, 2, 1,
      ${issueClientEventId}::uuid, ${issueCorrelationId}::uuid,
      ${issueEventId}, ${ISSUED_AT}::timestamptz, ${params.userId}::uuid,
      ${`invoice://${invoiceId}/original`}, ${pdfSha256}, ${pdf},
      ${params.payment.contractVersion}, ${params.payment.mode},
      ${params.payment.status}, ${params.payment.openAmountCents},
      ${params.payment.paidAmountCents}, ${params.payment.currency},
      ${params.payment.method}, ${params.payment.paidAt}::timestamptz,
      ${params.payment.receiptId}, ${params.payment.eventId},
      ${params.payment.correlationId}::uuid, ${params.payment.version}
    )
  `;

  const cancelClientEventId = randomUUID();
  const cancelCorrelationId = randomUUID();
  await transaction`
    INSERT INTO public.events (
      id, tenant_id, order_id, item_id, event_type, description, user_id,
      payload, status, station, client_event_id, event_schema_version,
      correlation_id, aggregate_version, from_station, created_at
    ) VALUES (
      ${cancelEventId}, ${params.tenantId}, ${orderId}, NULL,
      'INVOICE_CANCELLED_V1', ${CANCEL_REASON}, ${params.userId}::uuid,
      ${transaction.json({
        invoiceId,
        invoiceNumber: params.invoiceNumber,
        expectedVersion: 1,
        cancelReason: CANCEL_REASON,
        cancellationPdfSha256,
        invoiceVersion: 2,
      })}::jsonb,
      'success', 'fertig', ${cancelClientEventId}::uuid, 1,
      ${cancelCorrelationId}::uuid, 2, 'fertig',
      ${CANCELLED_AT}::timestamptz AT TIME ZONE 'UTC'
    )
  `;

  return {
    label: params.label,
    invoiceId,
    orderId,
    invoiceNumber: params.invoiceNumber,
    cancelEventId,
    cancelClientEventId,
    cancelCorrelationId,
    cancellationPdf,
    cancellationPdfSha256,
    userId: params.userId,
  };
}

/**
 * The identical raw cancellation UPDATE for every case, with the Storno session
 * flag set and every cancellation field contract-valid. The only difference
 * between the accepted and the rejected cases is the invoice's payment state.
 */
async function rawCancel(transaction: Tx, seeded: SeededCase): Promise<void> {
  await transaction`SELECT set_config('app.invoice_cancel_command', 'v1', true)`;
  await transaction`
    UPDATE public.invoices
    SET
      status = 'cancelled',
      aggregate_version = aggregate_version + 1,
      cancel_client_event_id = ${seeded.cancelClientEventId}::uuid,
      cancel_correlation_id = ${seeded.cancelCorrelationId}::uuid,
      cancelled_by = ${seeded.userId}::uuid,
      cancel_reason = ${CANCEL_REASON},
      cancelled_at = ${CANCELLED_AT}::timestamptz,
      cancel_event_id = ${seeded.cancelEventId},
      cancellation_pdf_ref = ${`invoice://${seeded.invoiceId}/cancellation`},
      cancellation_pdf_sha256 = ${seeded.cancellationPdfSha256},
      cancellation_pdf_content = ${seeded.cancellationPdf}
    WHERE id = ${seeded.invoiceId}::uuid
  `;
}

describe("F1.4/F1.5 Storno-Payment-Gate im DB-Trigger (T-G07-016)", () => {
  it("erlaubt das Storno nur im eindeutig unbezahlten, konsistenten Zustand", async () => {
    const tenantId = `f14-cancelgate-${suffix}`;
    const userId = randomUUID();
    const rateId = randomUUID();
    const rollbackSignal = new Error("ROLLBACK_F1_4_CANCEL_PAYMENT_GUARD");

    try {
      await sql.begin(async (transaction) => {
        await seedTenant(transaction, {
          tenantId,
          userId,
          rateId,
          label: `f14-cancelgate-${suffix}`,
        });

        const seed = (
          label: string,
          invoiceNumber: string,
          payment: PaymentFixture,
          amounts?: InvoiceAmounts,
        ) =>
          seedIssuedInvoice(transaction, {
            tenantId,
            userId,
            rateId,
            label: `${label}-${suffix}`,
            invoiceNumber,
            payment,
            amounts,
          });

        // -------------------------------------------------------------------
        // Rejected cases. Each one is a state the payment contract can really
        // store, and each one must be refused without any mutation.
        // -------------------------------------------------------------------
        const rejected: { seeded: SeededCase; why: string }[] = [
          {
            why: "teilbezahlt: paid > 0 und open > 0",
            seeded: await seed("partial", "R-2026-9102", {
              contractVersion: 1,
              mode: "rechnung",
              status: "teilbezahlt",
              openAmountCents: GROSS_AMOUNT_CENTS - 500,
              paidAmountCents: 500,
              currency: "EUR",
              method: "ueberweisung",
              paidAt: PAID_AT,
              receiptId: "receipt-partial",
              eventId: "payment-event-partial",
              correlationId: randomUUID(),
              version: 1,
            }),
          },
          {
            why: "bezahlt: paid = gross und open = 0",
            seeded: await seed("paid", "R-2026-9103", {
              contractVersion: 1,
              mode: "vorkasse",
              status: "bezahlt",
              openAmountCents: 0,
              paidAmountCents: GROSS_AMOUNT_CENTS,
              currency: "EUR",
              method: "bar",
              paidAt: PAID_AT,
              receiptId: "receipt-paid",
              eventId: "payment-event-paid",
              correlationId: randomUUID(),
              version: 2,
            }),
          },
          {
            // One representative pcv-NULL row is sufficient: every such row
            // fails on the explicit payment_contract_version=1 dependency.
            // paid=0 and paid+open=gross are additionally enforced for pcv=1
            // by invoices_f15_amounts_chk and remain defense in depth here.
            why: "Legacy ohne Zahlungsvertrag: payment_contract_version IS NULL",
            seeded: await seed("legacynull", "R-2026-9104", {
              contractVersion: null,
              mode: null,
              status: null,
              openAmountCents: null,
              paidAmountCents: null,
              currency: null,
              method: null,
              paidAt: null,
              receiptId: null,
              eventId: null,
              correlationId: null,
              version: 0,
            }),
          },
          {
            // Zero is accepted by both F1.4 money and F1.5 amount CHECKs. This
            // case therefore isolates the guard's gross_amount_cents > 0 rule.
            why: "Nullbetrag: eindeutiger Zahlungsstand, aber kein Geldvorgang",
            seeded: await seed("zero", "R-2026-9105", ZERO_UNPAID, ZERO_AMOUNTS),
          },
        ];

        for (const { seeded, why } of rejected) {
          const before = await readInvoiceState(transaction, seeded.invoiceId);
          expect({ why, status: before.status }).toEqual({ why, status: "issued" });
          expect({ why, version: before.aggregate_version })
            .toEqual({ why, version: 1 });

          const savepoint = `cancel_${seeded.label.replace(/[^a-z0-9]/gi, "_")}`;
          await transaction.unsafe(`SAVEPOINT ${savepoint}`);
          let cancelError: unknown;
          try {
            await rawCancel(transaction, seeded);
          } catch (error) {
            cancelError = error;
          }
          await transaction.unsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`);

          // The trigger, not another CHECK: the error is the immutability
          // contract's own fail-closed signal.
          expect({ why, error: (cancelError as { message?: string } | undefined)?.message })
            .toEqual({ why, error: "INVOICE_IMMUTABLE" });
          expect({ why, code: (cancelError as { code?: string } | undefined)?.code })
            .toEqual({ why, code: "23514" });

          const after = await readInvoiceState(transaction, seeded.invoiceId);
          expect({ why, after }).toEqual({ why, after: before });
          expect({ why, after: JSON.stringify(after) })
            .toEqual({ why, after: JSON.stringify(before) });
        }

        // -------------------------------------------------------------------
        // Direct DB control: identical UPDATE and session flag, only the clean
        // unpaid state differs. This proves that the trigger is not a blanket
        // block. The separate F1.4 command suite is run after an unpinned reset
        // in the same CI job and proves real createInvoice -> cancelInvoice.
        // -------------------------------------------------------------------
        const allowed = await seed("unpaid", "R-2026-9101", UNPAID);
        const beforeAllowed = await readInvoiceState(transaction, allowed.invoiceId);
        expect(beforeAllowed.status).toBe("issued");
        await rawCancel(transaction, allowed);
        const afterAllowed = await readInvoiceState(transaction, allowed.invoiceId);
        expect(afterAllowed).toEqual({
          ...beforeAllowed,
          status: "cancelled",
          aggregate_version: 2,
          cancel_client_event_id: allowed.cancelClientEventId,
          cancel_correlation_id: allowed.cancelCorrelationId,
          cancelled_by: allowed.userId,
          cancel_reason: CANCEL_REASON,
          cancelled_at: CANCELLED_AT,
          cancel_event_id: allowed.cancelEventId,
          cancellation_pdf_ref: `invoice://${allowed.invoiceId}/cancellation`,
          cancellation_pdf_sha256: allowed.cancellationPdfSha256,
          cancellation_pdf_bytes: allowed.cancellationPdf.byteLength,
        });
        // The payment truth itself is untouched by the cancellation.
        expect({
          payment_contract_version: afterAllowed.payment_contract_version,
          payment_status: afterAllowed.payment_status,
          payment_open_amount_cents: afterAllowed.payment_open_amount_cents,
          payment_paid_amount_cents: afterAllowed.payment_paid_amount_cents,
          payment_version: afterAllowed.payment_version,
        }).toEqual({
          payment_contract_version: 1,
          payment_status: "offen",
          payment_open_amount_cents: GROSS_AMOUNT_CENTS,
          payment_paid_amount_cents: 0,
          payment_version: 0,
        });

        throw rollbackSignal;
      });
    } catch (error) {
      if (error !== rollbackSignal) throw error;
    }
  }, 120_000);
});
