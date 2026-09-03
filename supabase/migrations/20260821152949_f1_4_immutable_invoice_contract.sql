-- F1.4 immutable invoice contract, ratified 2026-08-21.
-- public.invoices remains the single invoice truth. All changes are additive and
-- legacy rows stay usable. F1.4 rows are identified by contract_version = 1.

-- ---------------------------------------------------------------------------
-- 1. Transactional, tenant/year-bound number allocation
-- ---------------------------------------------------------------------------

CREATE TABLE private.invoice_number_sequences (
  tenant_id text NOT NULL,
  invoice_year integer NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  CONSTRAINT invoice_number_sequences_pkey PRIMARY KEY (tenant_id, invoice_year),
  CONSTRAINT invoice_number_sequences_tenant_chk
    CHECK (tenant_id = btrim(tenant_id) AND length(tenant_id) BETWEEN 1 AND 50),
  CONSTRAINT invoice_number_sequences_year_chk CHECK (invoice_year BETWEEN 2000 AND 2100),
  CONSTRAINT invoice_number_sequences_last_number_chk CHECK (last_number >= 0)
);

COMMENT ON TABLE private.invoice_number_sequences IS
  'F1.4 transaction-bound counter for gapless R-YYYY-NNNN invoice numbers per tenant/year.';

CREATE FUNCTION private.allocate_invoice_number(p_tenant_id text, p_invoice_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_canonical_pattern text;
  v_existing_max numeric;
  v_number integer;
BEGIN
  IF p_tenant_id IS NULL
     OR p_tenant_id <> btrim(p_tenant_id)
     OR length(p_tenant_id) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'INVOICE_NUMBER_TENANT_INVALID' USING ERRCODE = '23514';
  END IF;

  IF p_invoice_year IS NULL OR p_invoice_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'INVOICE_NUMBER_YEAR_INVALID' USING ERRCODE = '23514';
  END IF;

  -- Legacy cutover: canonical R-YYYY-NNNN numbers that already exist for this
  -- tenant/year belong to the same gapless truth, even when they were written
  -- before F1.4 (contract_version IS NULL). The counter never hands out a
  -- number at or below an already used canonical suffix.
  v_canonical_pattern := '^R-' || p_invoice_year::text || '-([0-9]{4,})$';

  SELECT coalesce(max(substring(invoice.invoice_number FROM v_canonical_pattern)::numeric), 0)
    INTO v_existing_max
  FROM public.invoices invoice
  WHERE invoice.tenant_id = p_tenant_id
    AND invoice.invoice_number ~ v_canonical_pattern;

  IF v_existing_max IS NULL OR v_existing_max > 2147483646 THEN
    RAISE EXCEPTION 'INVOICE_NUMBER_RANGE_EXHAUSTED' USING ERRCODE = '23514';
  END IF;

  -- One atomic upsert per call: no retry loop, no sequence fallback. A rollback
  -- releases the number again, concurrent callers serialise on the conflicting
  -- row and therefore stay unique and consecutive.
  INSERT INTO private.invoice_number_sequences (
    tenant_id,
    invoice_year,
    last_number,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_invoice_year,
    greatest(1, v_existing_max::integer + 1),
    statement_timestamp()
  )
  ON CONFLICT (tenant_id, invoice_year)
  DO UPDATE SET
    last_number = greatest(
      private.invoice_number_sequences.last_number + 1,
      v_existing_max::integer + 1
    ),
    updated_at = statement_timestamp()
  RETURNING last_number INTO v_number;

  RETURN 'R-' || p_invoice_year::text || '-' || lpad(v_number::text, 4, '0');
END;
$$;

REVOKE ALL ON TABLE private.invoice_number_sequences FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.invoice_number_sequences TO service_role;
REVOKE ALL ON FUNCTION private.allocate_invoice_number(text, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.allocate_invoice_number(text, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Existing tenant settings gain only the invoice policy fields
-- ---------------------------------------------------------------------------

ALTER TABLE public.company_settings
  ADD COLUMN invoice_vat_rate_basis_points integer NOT NULL DEFAULT 1900,
  ADD COLUMN invoice_payment_term_days integer;

ALTER TABLE public.company_settings
  ADD CONSTRAINT company_settings_invoice_vat_rate_chk
    CHECK (invoice_vat_rate_basis_points IN (700, 1900)),
  ADD CONSTRAINT company_settings_invoice_payment_term_chk
    CHECK (invoice_payment_term_days IS NULL OR invoice_payment_term_days BETWEEN 1 AND 365);

COMMENT ON COLUMN public.company_settings.invoice_vat_rate_basis_points IS
  'F1.4 invoice VAT policy in basis points; 1900 is the ratified standard, 700 requires explicit tenant configuration.';
COMMENT ON COLUMN public.company_settings.invoice_payment_term_days IS
  'F1.4 payment term. NULL means createInvoice must fail closed.';

-- ---------------------------------------------------------------------------
-- 3. Additive F1.4 fields on the existing public.invoices truth
-- ---------------------------------------------------------------------------

ALTER TABLE public.invoices
  ADD COLUMN contract_version integer,
  ADD COLUMN freeze_id uuid,
  ADD COLUMN snapshot jsonb,
  ADD COLUMN net_amount_cents integer,
  ADD COLUMN vat_rate_basis_points integer,
  ADD COLUMN vat_amount_cents integer,
  ADD COLUMN gross_amount_cents integer,
  ADD COLUMN service_date date,
  ADD COLUMN order_version integer,
  ADD COLUMN payment_term_days integer,
  ADD COLUMN aggregate_version integer,
  ADD COLUMN client_event_id uuid,
  ADD COLUMN correlation_id uuid,
  ADD COLUMN issue_event_id text,
  ADD COLUMN issued_at timestamptz,
  ADD COLUMN issued_by uuid,
  ADD COLUMN pdf_ref text,
  ADD COLUMN pdf_sha256 text,
  ADD COLUMN pdf_content bytea,
  ADD COLUMN cancel_client_event_id uuid,
  ADD COLUMN cancel_correlation_id uuid,
  ADD COLUMN cancelled_by uuid,
  ADD COLUMN cancel_reason text,
  ADD COLUMN cancelled_at timestamptz,
  ADD COLUMN cancel_event_id text,
  ADD COLUMN cancellation_pdf_ref text,
  ADD COLUMN cancellation_pdf_sha256 text,
  ADD COLUMN cancellation_pdf_content bytea;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_f14_contract_version_chk
    CHECK (contract_version IS NULL OR contract_version = 1) NOT VALID,
  ADD CONSTRAINT invoices_f14_invoice_number_chk
    CHECK (
      contract_version IS DISTINCT FROM 1
      OR coalesce(invoice_number ~ '^R-[0-9]{4}-[0-9]{4,}$', false)
    ) NOT VALID,
  ADD CONSTRAINT invoices_f14_required_issue_fields_chk
    CHECK (
      contract_version IS DISTINCT FROM 1
      OR coalesce((
        status IS NOT NULL
        AND order_id IS NOT NULL
        AND customer_id IS NOT NULL
        AND freeze_id IS NOT NULL
        AND invoice_number IS NOT NULL
        AND snapshot IS NOT NULL
        AND jsonb_typeof(snapshot) = 'object'
        AND net_amount_cents IS NOT NULL
        AND vat_rate_basis_points IS NOT NULL
        AND vat_amount_cents IS NOT NULL
        AND gross_amount_cents IS NOT NULL
        AND amount_total IS NOT NULL
        AND service_date IS NOT NULL
        AND order_version IS NOT NULL
        AND payment_term_days IS NOT NULL
        AND due_date IS NOT NULL
        AND aggregate_version IS NOT NULL
        AND client_event_id IS NOT NULL
        AND correlation_id IS NOT NULL
        AND issue_event_id IS NOT NULL
        AND issued_at IS NOT NULL
        AND issued_by IS NOT NULL
        AND pdf_ref IS NOT NULL
        AND pdf_sha256 IS NOT NULL
        AND pdf_content IS NOT NULL
      ), false)
    ) NOT VALID,
  ADD CONSTRAINT invoices_f14_money_chk
    CHECK (
      contract_version IS DISTINCT FROM 1
      OR coalesce((
        net_amount_cents >= 0
        AND vat_amount_cents >= 0
        AND gross_amount_cents = net_amount_cents + vat_amount_cents
        AND vat_amount_cents = round(
          net_amount_cents::numeric * vat_rate_basis_points::numeric / 10000
        )::integer
        AND amount_total = gross_amount_cents::numeric / 100
      ), false)
    ) NOT VALID,
  ADD CONSTRAINT invoices_f14_tax_and_term_chk
    CHECK (
      contract_version IS DISTINCT FROM 1
      OR coalesce((
        vat_rate_basis_points IN (700, 1900)
        AND payment_term_days BETWEEN 1 AND 365
        -- Berlin is the single legal due-date truth; never the DB session zone.
        AND due_date = (issued_at AT TIME ZONE 'Europe/Berlin')::date + payment_term_days
      ), false)
    ) NOT VALID,
  ADD CONSTRAINT invoices_f14_order_version_chk
    CHECK (
      contract_version IS DISTINCT FROM 1
      OR coalesce(order_version > 0, false)
    ) NOT VALID,
  -- Every mandatory snapshot path is checked for presence, JSON type and value.
  -- Casts stay inside CASE guards so a wrong JSON type can never escape as a
  -- cast error (22P02/22007) instead of the fail-closed 23514 of this contract.
  ADD CONSTRAINT invoices_f14_snapshot_shape_chk
    CHECK (
      contract_version IS DISTINCT FROM 1
      OR coalesce((
        snapshot ?& ARRAY[
          'schemaVersion', 'seller', 'customer', 'order', 'lines',
          'totals', 'serviceDate', 'issuedAt', 'paymentTermDays'
        ]
        AND jsonb_typeof(snapshot->'schemaVersion') = 'number'
        AND CASE
              WHEN jsonb_typeof(snapshot->'schemaVersion') = 'number'
                THEN (snapshot->>'schemaVersion')::numeric = 1
              ELSE false
            END
        AND jsonb_typeof(snapshot->'seller') = 'object'
        AND snapshot->'seller' ?& ARRAY[
          'companyName', 'street', 'zip', 'city', 'country',
          'taxId', 'iban', 'bic', 'bankName'
        ]
        AND jsonb_typeof(snapshot->'seller'->'companyName') = 'string'
        AND btrim(snapshot->'seller'->>'companyName') <> ''
        AND jsonb_typeof(snapshot->'seller'->'street') = 'string'
        AND btrim(snapshot->'seller'->>'street') <> ''
        AND jsonb_typeof(snapshot->'seller'->'zip') = 'string'
        AND btrim(snapshot->'seller'->>'zip') <> ''
        AND jsonb_typeof(snapshot->'seller'->'city') = 'string'
        AND btrim(snapshot->'seller'->>'city') <> ''
        AND jsonb_typeof(snapshot->'seller'->'country') = 'string'
        AND btrim(snapshot->'seller'->>'country') <> ''
        AND jsonb_typeof(snapshot->'seller'->'taxId') = 'string'
        AND btrim(snapshot->'seller'->>'taxId') <> ''
        AND jsonb_typeof(snapshot->'seller'->'iban') = 'string'
        AND btrim(snapshot->'seller'->>'iban') <> ''
        AND jsonb_typeof(snapshot->'seller'->'bic') = 'string'
        AND btrim(snapshot->'seller'->>'bic') <> ''
        AND jsonb_typeof(snapshot->'seller'->'bankName') = 'string'
        AND btrim(snapshot->'seller'->>'bankName') <> ''
        AND jsonb_typeof(snapshot->'customer') = 'object'
        AND snapshot->'customer' ?& ARRAY[
          'name', 'companyName', 'contactPerson', 'street', 'zip', 'city', 'country'
        ]
        AND jsonb_typeof(snapshot->'customer'->'name') = 'string'
        AND btrim(snapshot->'customer'->>'name') <> ''
        AND jsonb_typeof(snapshot->'customer'->'street') = 'string'
        AND btrim(snapshot->'customer'->>'street') <> ''
        AND jsonb_typeof(snapshot->'customer'->'zip') = 'string'
        AND btrim(snapshot->'customer'->>'zip') <> ''
        AND jsonb_typeof(snapshot->'customer'->'city') = 'string'
        AND btrim(snapshot->'customer'->>'city') <> ''
        AND jsonb_typeof(snapshot->'customer'->'country') = 'string'
        AND btrim(snapshot->'customer'->>'country') <> ''
        -- companyName/contactPerson stay deliberately optional: string or null.
        AND jsonb_typeof(snapshot->'customer'->'companyName') IN ('string', 'null')
        AND jsonb_typeof(snapshot->'customer'->'contactPerson') IN ('string', 'null')
        AND jsonb_typeof(snapshot->'order') = 'object'
        AND snapshot->'order' ?& ARRAY[
          'orderId', 'orderVersion', 'orderNumber', 'title', 'freezeId'
        ]
        AND jsonb_typeof(snapshot->'order'->'orderVersion') = 'number'
        AND CASE
              WHEN jsonb_typeof(snapshot->'order'->'orderVersion') = 'number'
                THEN (snapshot->'order'->>'orderVersion')::numeric
                       = trunc((snapshot->'order'->>'orderVersion')::numeric)
                  AND (snapshot->'order'->>'orderVersion')::numeric = order_version::numeric
              ELSE false
            END
        AND jsonb_typeof(snapshot->'order'->'orderId') = 'string'
        AND snapshot->'order'->>'orderId' = order_id
        AND jsonb_typeof(snapshot->'order'->'orderNumber') = 'string'
        AND btrim(snapshot->'order'->>'orderNumber') <> ''
        AND jsonb_typeof(snapshot->'order'->'title') = 'string'
        AND btrim(snapshot->'order'->>'title') <> ''
        AND jsonb_typeof(snapshot->'order'->'freezeId') = 'string'
        AND snapshot->'order'->>'freezeId' = freeze_id::text
        -- One type-guarded CASE, never a bare jsonb_array_length: AND does not
        -- guarantee left-to-right evaluation, so an unguarded call on a
        -- non-array `lines` could raise 22023 before this CHECK is reached.
        -- The CASE keeps every wrongly typed, missing or empty `lines` a plain
        -- constraint violation with SQLSTATE 23514.
        AND CASE WHEN jsonb_typeof(snapshot->'lines') = 'array'
                 THEN jsonb_array_length(snapshot->'lines') > 0
                 ELSE false END
        AND jsonb_typeof(snapshot->'totals') = 'object'
        AND snapshot->'totals' ?& ARRAY[
          'netAmountCents', 'vatRateBasisPoints', 'vatAmountCents', 'grossAmountCents'
        ]
        AND jsonb_typeof(snapshot->'totals'->'netAmountCents') = 'number'
        AND jsonb_typeof(snapshot->'totals'->'vatRateBasisPoints') = 'number'
        AND jsonb_typeof(snapshot->'totals'->'vatAmountCents') = 'number'
        AND jsonb_typeof(snapshot->'totals'->'grossAmountCents') = 'number'
        AND CASE
              WHEN jsonb_typeof(snapshot->'totals'->'netAmountCents') = 'number'
               AND jsonb_typeof(snapshot->'totals'->'vatRateBasisPoints') = 'number'
               AND jsonb_typeof(snapshot->'totals'->'vatAmountCents') = 'number'
               AND jsonb_typeof(snapshot->'totals'->'grossAmountCents') = 'number'
                THEN (snapshot->'totals'->>'netAmountCents')::numeric = net_amount_cents::numeric
                  AND (snapshot->'totals'->>'vatRateBasisPoints')::numeric
                        = vat_rate_basis_points::numeric
                  AND (snapshot->'totals'->>'vatAmountCents')::numeric = vat_amount_cents::numeric
                  AND (snapshot->'totals'->>'grossAmountCents')::numeric
                        = gross_amount_cents::numeric
              ELSE false
            END
        AND jsonb_typeof(snapshot->'serviceDate') = 'string'
        -- to_char instead of ::text: no DateStyle dependency, no cast that
        -- could raise before this CHECK can fail closed with 23514.
        AND snapshot->>'serviceDate' = to_char(service_date, 'YYYY-MM-DD')
        AND jsonb_typeof(snapshot->'issuedAt') = 'string'
        -- issuedAt is never cast to timestamptz from merely regex-shaped JSON.
        -- The stored string is compared against the canonical UTC rendering
        -- derived from the issued_at instant itself.
        AND snapshot->>'issuedAt'
              = to_char(issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        AND jsonb_typeof(snapshot->'paymentTermDays') = 'number'
        AND CASE
              WHEN jsonb_typeof(snapshot->'paymentTermDays') = 'number'
                THEN (snapshot->>'paymentTermDays')::numeric = payment_term_days::numeric
              ELSE false
            END
      ), false)
    ) NOT VALID,
  ADD CONSTRAINT invoices_f14_pdf_chk
    CHECK (
      contract_version IS DISTINCT FROM 1
      OR coalesce((
        pdf_ref = 'invoice://' || id::text || '/original'
        AND pdf_sha256 ~ '^[a-f0-9]{64}$'
        AND octet_length(pdf_content) BETWEEN 1 AND 20971520
      ), false)
    ) NOT VALID,
  ADD CONSTRAINT invoices_f14_status_chk
    CHECK (
      contract_version IS DISTINCT FROM 1
      OR coalesce((
        (
          status = 'issued'
          AND aggregate_version = 1
          AND cancel_client_event_id IS NULL
          AND cancel_correlation_id IS NULL
          AND cancelled_by IS NULL
          AND cancel_reason IS NULL
          AND cancelled_at IS NULL
          AND cancel_event_id IS NULL
          AND cancellation_pdf_ref IS NULL
          AND cancellation_pdf_sha256 IS NULL
          AND cancellation_pdf_content IS NULL
        )
        OR (
          status = 'cancelled'
          AND aggregate_version = 2
          AND cancel_client_event_id IS NOT NULL
          AND cancel_correlation_id IS NOT NULL
          AND cancelled_by IS NOT NULL
          AND cancel_reason IS NOT NULL
          AND cancel_reason = btrim(cancel_reason)
          AND length(cancel_reason) BETWEEN 5 AND 500
          AND cancelled_at IS NOT NULL
          AND cancel_event_id IS NOT NULL
          AND cancellation_pdf_ref = 'invoice://' || id::text || '/cancellation'
          AND cancellation_pdf_sha256 ~ '^[a-f0-9]{64}$'
          AND octet_length(cancellation_pdf_content) BETWEEN 1 AND 20971520
        )
      ), false)
    ) NOT VALID;

-- The year in a canonical F1.4 number is the Berlin year of the issue instant,
-- never the UTC and never the session year. The year is compared as the text
-- the number itself carries, so no cast can raise before this CHECK fails
-- closed with 23514. Legacy rows keep contract_version IS NULL and stay
-- untouched, including numbers outside the canonical shape.
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_f14_invoice_year_chk
  CHECK (
    contract_version IS DISTINCT FROM 1
    OR coalesce(
      substring(invoice_number FROM '^R-([0-9]{4})-[0-9]{4,}$')
        = to_char(issued_at AT TIME ZONE 'Europe/Berlin', 'YYYY'),
      false
    )
  ) NOT VALID;

CREATE UNIQUE INDEX customers_tenant_id_id_uidx
  ON public.customers (tenant_id, id);
CREATE UNIQUE INDEX invoices_tenant_id_id_uidx
  ON public.invoices (tenant_id, id);

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_f14_tenant_order_fkey
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders (tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT invoices_f14_tenant_customer_fkey
    FOREIGN KEY (tenant_id, customer_id)
    REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT invoices_f14_tenant_freeze_fkey
    FOREIGN KEY (tenant_id, freeze_id)
    REFERENCES private.order_freezes (tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT invoices_f14_issued_by_fkey
    FOREIGN KEY (tenant_id, issued_by)
    REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT invoices_f14_cancelled_by_fkey
    FOREIGN KEY (tenant_id, cancelled_by)
    REFERENCES public.app_users (tenant_id, id) ON DELETE RESTRICT NOT VALID,
  ADD CONSTRAINT invoices_f14_issue_event_fkey
    FOREIGN KEY (issue_event_id) REFERENCES public.events (id) ON DELETE RESTRICT,
  ADD CONSTRAINT invoices_f14_cancel_event_fkey
    FOREIGN KEY (cancel_event_id) REFERENCES public.events (id) ON DELETE RESTRICT;

-- Legacy cutover. Canonical R-YYYY-NNNN numbers are one gapless truth per
-- tenant, regardless of contract_version. Before the index is built, an
-- already existing canonical duplicate is reported explicitly as 23505 so the
-- migration fails closed. No row is corrected, deleted or renumbered here:
-- resolving a real duplicate is an accounting decision, never a migration side
-- effect.
DO $$
DECLARE
  v_conflict record;
BEGIN
  SELECT
      invoice.tenant_id AS tenant_id,
      invoice.invoice_number AS invoice_number,
      count(*) AS duplicate_count
    INTO v_conflict
  FROM public.invoices invoice
  WHERE invoice.invoice_number ~ '^R-[0-9]{4}-[0-9]{4,}$'
  GROUP BY invoice.tenant_id, invoice.invoice_number
  HAVING count(*) > 1
  ORDER BY invoice.tenant_id, invoice.invoice_number
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'INVOICE_LEGACY_CANONICAL_NUMBER_DUPLICATE: tenant %, invoice number % exists % times',
      v_conflict.tenant_id, v_conflict.invoice_number, v_conflict.duplicate_count
      USING ERRCODE = '23505';
  END IF;
END;
$$;

-- One canonical number per tenant across every contract generation. Legacy
-- numbers outside the canonical shape stay outside this index and therefore
-- remain fully usable, including duplicates.
CREATE UNIQUE INDEX invoices_f14_tenant_number_uidx
  ON public.invoices (tenant_id, invoice_number)
  WHERE invoice_number ~ '^R-[0-9]{4}-[0-9]{4,}$';
CREATE UNIQUE INDEX invoices_f14_issue_event_uidx
  ON public.invoices (issue_event_id)
  WHERE contract_version = 1;
CREATE UNIQUE INDEX invoices_f14_cancel_event_uidx
  ON public.invoices (cancel_event_id)
  WHERE contract_version = 1 AND cancel_event_id IS NOT NULL;
CREATE UNIQUE INDEX invoices_f14_tenant_client_event_uidx
  ON public.invoices (tenant_id, client_event_id)
  WHERE contract_version = 1;
CREATE UNIQUE INDEX invoices_f14_tenant_cancel_client_event_uidx
  ON public.invoices (tenant_id, cancel_client_event_id)
  WHERE contract_version = 1 AND cancel_client_event_id IS NOT NULL;
CREATE UNIQUE INDEX invoices_f14_tenant_active_order_uidx
  ON public.invoices (tenant_id, order_id)
  WHERE contract_version = 1 AND status = 'issued';
CREATE UNIQUE INDEX invoices_f14_tenant_active_freeze_uidx
  ON public.invoices (tenant_id, freeze_id)
  WHERE contract_version = 1 AND status = 'issued';

COMMENT ON COLUMN public.invoices.snapshot IS
  'F1.4 immutable accounting snapshot. After issuance no live customer, order, item or company value is accounting truth.';
COMMENT ON COLUMN public.invoices.freeze_id IS
  'F1.4 service source: the final active F1.3 freeze. The freeze is input, never a mutable invoice substitute.';
COMMENT ON COLUMN public.invoices.pdf_content IS
  'F1.4 exact immutable original invoice PDF bytes used by the authenticated download route.';

-- ---------------------------------------------------------------------------
-- 4. F1.4-only immutability while preserving legacy invoice behaviour
-- ---------------------------------------------------------------------------

CREATE FUNCTION private.guard_f1_4_invoice_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF OLD.contract_version IS DISTINCT FROM 1 THEN
    IF NEW.contract_version IS DISTINCT FROM OLD.contract_version THEN
      RAISE EXCEPTION 'INVOICE_LEGACY_UPGRADE_FORBIDDEN' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.contract_version = 1
     AND OLD.status = 'issued'
     AND NEW.status = 'cancelled'
     AND coalesce(current_setting('app.invoice_cancel_command', true), '') = 'v1'
     AND NEW.aggregate_version = OLD.aggregate_version + 1
     AND (
       to_jsonb(NEW) - ARRAY[
         'status', 'aggregate_version', 'cancel_client_event_id',
         'cancel_correlation_id', 'cancelled_by', 'cancel_reason',
         'cancelled_at', 'cancel_event_id', 'cancellation_pdf_ref',
         'cancellation_pdf_sha256', 'cancellation_pdf_content'
       ]::text[]
     ) = (
       to_jsonb(OLD) - ARRAY[
         'status', 'aggregate_version', 'cancel_client_event_id',
         'cancel_correlation_id', 'cancelled_by', 'cancel_reason',
         'cancelled_at', 'cancel_event_id', 'cancellation_pdf_ref',
         'cancellation_pdf_sha256', 'cancellation_pdf_content'
       ]::text[]
     ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'INVOICE_IMMUTABLE' USING ERRCODE = '23514';
END;
$$;

CREATE FUNCTION private.guard_f1_4_invoice_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF OLD.contract_version = 1 THEN
    RAISE EXCEPTION 'INVOICE_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_f1_4_invoice_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.guard_f1_4_invoice_delete() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER invoices_f14_update_guard
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION private.guard_f1_4_invoice_update();
CREATE TRIGGER invoices_f14_delete_guard
  BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION private.guard_f1_4_invoice_delete();
CREATE TRIGGER invoices_f14_truncate_guard
  BEFORE TRUNCATE ON public.invoices
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

-- ---------------------------------------------------------------------------
-- 5. Append-only invoice lifecycle events
-- ---------------------------------------------------------------------------

ALTER TABLE public.events
  ADD CONSTRAINT events_invoice_created_v1_contract_chk
  CHECK (
    event_type <> 'INVOICE_CREATED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version = 1
      AND from_station = 'fertig'
      AND station = 'fertig'
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'invoiceId', payload->'invoiceId',
        'freezeId', payload->'freezeId',
        'invoiceNumber', payload->'invoiceNumber',
        'orderVersion', payload->'orderVersion',
        'netAmountCents', payload->'netAmountCents',
        'vatRateBasisPoints', payload->'vatRateBasisPoints',
        'vatAmountCents', payload->'vatAmountCents',
        'grossAmountCents', payload->'grossAmountCents',
        'pdfSha256', payload->'pdfSha256',
        'invoiceVersion', payload->'invoiceVersion'
      )
      AND coalesce(payload->>'invoiceId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(payload->>'freezeId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(payload->>'invoiceNumber', '') ~ '^R-[0-9]{4}-[0-9]{4,}$'
      AND coalesce(payload->>'pdfSha256', '') ~ '^[a-f0-9]{64}$'
      AND jsonb_typeof(payload->'netAmountCents') = 'number'
      AND jsonb_typeof(payload->'orderVersion') = 'number'
      AND jsonb_typeof(payload->'vatRateBasisPoints') = 'number'
      AND jsonb_typeof(payload->'vatAmountCents') = 'number'
      AND jsonb_typeof(payload->'grossAmountCents') = 'number'
      AND jsonb_typeof(payload->'invoiceVersion') = 'number'
      AND (payload->>'netAmountCents')::integer >= 0
      AND (payload->>'orderVersion')::numeric = trunc((payload->>'orderVersion')::numeric)
      AND (payload->>'orderVersion')::integer > 0
      AND (payload->>'vatRateBasisPoints')::integer IN (700, 1900)
      AND (payload->>'vatAmountCents')::integer = round(
        (payload->>'netAmountCents')::numeric
        * (payload->>'vatRateBasisPoints')::numeric / 10000
      )::integer
      AND (payload->>'grossAmountCents')::integer
        = (payload->>'netAmountCents')::integer + (payload->>'vatAmountCents')::integer
      AND (payload->>'invoiceVersion')::integer = 1
    ), false)
  ) NOT VALID,
  ADD CONSTRAINT events_invoice_cancelled_v1_contract_chk
  CHECK (
    event_type <> 'INVOICE_CANCELLED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version = 2
      AND from_station = 'fertig'
      AND station = 'fertig'
      AND status = 'success'
      AND description = btrim(description)
      AND length(description) BETWEEN 5 AND 500
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'invoiceId', payload->'invoiceId',
        'invoiceNumber', payload->'invoiceNumber',
        'expectedVersion', payload->'expectedVersion',
        'cancelReason', payload->'cancelReason',
        'cancellationPdfSha256', payload->'cancellationPdfSha256',
        'invoiceVersion', payload->'invoiceVersion'
      )
      AND coalesce(payload->>'invoiceId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(payload->>'invoiceNumber', '') ~ '^R-[0-9]{4}-[0-9]{4,}$'
      AND payload->>'cancelReason' = description
      AND coalesce(payload->>'cancellationPdfSha256', '') ~ '^[a-f0-9]{64}$'
      AND jsonb_typeof(payload->'expectedVersion') = 'number'
      AND (payload->>'expectedVersion')::numeric
        = trunc((payload->>'expectedVersion')::numeric)
      AND (payload->>'expectedVersion')::integer = 1
      AND jsonb_typeof(payload->'invoiceVersion') = 'number'
      AND (payload->>'invoiceVersion')::integer = 2
    ), false)
  ) NOT VALID;

CREATE UNIQUE INDEX events_invoice_lifecycle_version_uidx
  ON public.events (tenant_id, (payload->>'invoiceId'), aggregate_version)
  WHERE event_type IN ('INVOICE_CREATED_V1', 'INVOICE_CANCELLED_V1');
CREATE UNIQUE INDEX events_invoice_lifecycle_client_event_uidx
  ON public.events (tenant_id, client_event_id)
  WHERE event_type IN ('INVOICE_CREATED_V1', 'INVOICE_CANCELLED_V1');
CREATE UNIQUE INDEX events_invoice_lifecycle_correlation_uidx
  ON public.events (tenant_id, correlation_id)
  WHERE event_type IN ('INVOICE_CREATED_V1', 'INVOICE_CANCELLED_V1');

CREATE TRIGGER events_invoice_lifecycle_update_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (
    OLD.event_type IN ('INVOICE_CREATED_V1', 'INVOICE_CANCELLED_V1')
    OR NEW.event_type IN ('INVOICE_CREATED_V1', 'INVOICE_CANCELLED_V1')
  )
  EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER events_invoice_lifecycle_delete_immutable
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type IN ('INVOICE_CREATED_V1', 'INVOICE_CANCELLED_V1'))
  EXECUTE FUNCTION public.prevent_audit_mutation();
-- public.events already has a global immutable TRUNCATE guard from W4.

-- ---------------------------------------------------------------------------
-- 6. Tenant-bound security-invoker read ports
-- ---------------------------------------------------------------------------

CREATE VIEW private.v_invoice_issue_source_v1
WITH (security_invoker = true)
AS
SELECT
  freeze_state.tenant_id,
  freeze_state.order_id,
  freeze_state.freeze_id,
  freeze_state.frozen_at,
  -- Berlin is the single legal service-date truth. The command must never
  -- derive a calendar day from the DB session time zone.
  (freeze_state.frozen_at AT TIME ZONE 'Europe/Berlin')::date AS service_date,
  freeze_state.order_version AS freeze_order_version,
  orders.version AS current_order_version,
  orders.order_number,
  orders.title AS order_title,
  orders.station,
  orders.status AS order_status,
  orders.customer_id,
  customer.name AS customer_name,
  customer.company_name AS customer_company_name,
  customer.contact_person AS customer_contact_person,
  coalesce(nullif(btrim(customer.street), ''), nullif(btrim(customer.address), '')) AS customer_street,
  customer.zip_code AS customer_zip,
  customer.city AS customer_city,
  customer.country AS customer_country,
  company.company_name AS seller_company_name,
  company.street AS seller_street,
  company.zip AS seller_zip,
  company.city AS seller_city,
  company.country AS seller_country,
  company.tax_id AS seller_tax_id,
  company.iban AS seller_iban,
  company.bic AS seller_bic,
  company.bank_name AS seller_bank_name,
  company.invoice_vat_rate_basis_points,
  company.invoice_payment_term_days,
  coalesce(base_items.base_lines, '[]'::jsonb) AS base_lines,
  coalesce(base_items.base_line_count, 0) AS base_line_count,
  coalesce(base_items.base_net_amount_cents, 0) AS base_net_amount_cents,
  coalesce(extra_work.lines, '[]'::jsonb) AS extra_work_lines,
  freeze_state.line_count AS extra_work_line_count,
  freeze_state.total_amount_cents AS extra_work_net_amount_cents,
  company.config_count = 1
    AND nullif(btrim(company.company_name), '') IS NOT NULL
    AND nullif(btrim(company.street), '') IS NOT NULL
    AND nullif(btrim(company.zip), '') IS NOT NULL
    AND nullif(btrim(company.city), '') IS NOT NULL
    AND nullif(btrim(company.country), '') IS NOT NULL
    AND nullif(btrim(company.tax_id), '') IS NOT NULL
    AND nullif(btrim(company.iban), '') IS NOT NULL
    AND nullif(btrim(company.bic), '') IS NOT NULL
    AND nullif(btrim(company.bank_name), '') IS NOT NULL
    AND company.invoice_payment_term_days IS NOT NULL AS seller_config_complete,
  nullif(btrim(coalesce(customer.company_name, customer.name)), '') IS NOT NULL
    AND coalesce(nullif(btrim(customer.street), ''), nullif(btrim(customer.address), '')) IS NOT NULL
    AND nullif(btrim(customer.zip_code), '') IS NOT NULL
    AND nullif(btrim(customer.city), '') IS NOT NULL
    AND nullif(btrim(customer.country), '') IS NOT NULL AS customer_config_complete,
  coalesce(base_items.base_line_count, 0) > 0
    AND coalesce(base_items.invalid_price_count, 0) = 0 AS base_prices_complete,
  NOT EXISTS (
    SELECT 1
    FROM public.invoices existing_invoice
    WHERE existing_invoice.tenant_id = freeze_state.tenant_id
      AND existing_invoice.order_id = freeze_state.order_id
      AND existing_invoice.contract_version = 1
      AND existing_invoice.status = 'issued'
  ) AS no_active_invoice,
  (
    freeze_state.active = true
    AND freeze_state.integrity_ok = true
    AND orders.id IS NOT NULL
    AND orders.station = 'fertig'
    AND customer.id IS NOT NULL
    AND company.config_count = 1
    AND nullif(btrim(company.company_name), '') IS NOT NULL
    AND nullif(btrim(company.street), '') IS NOT NULL
    AND nullif(btrim(company.zip), '') IS NOT NULL
    AND nullif(btrim(company.city), '') IS NOT NULL
    AND nullif(btrim(company.country), '') IS NOT NULL
    AND nullif(btrim(company.tax_id), '') IS NOT NULL
    AND nullif(btrim(company.iban), '') IS NOT NULL
    AND nullif(btrim(company.bic), '') IS NOT NULL
    AND nullif(btrim(company.bank_name), '') IS NOT NULL
    AND company.invoice_payment_term_days IS NOT NULL
    AND nullif(btrim(coalesce(customer.company_name, customer.name)), '') IS NOT NULL
    AND coalesce(nullif(btrim(customer.street), ''), nullif(btrim(customer.address), '')) IS NOT NULL
    AND nullif(btrim(customer.zip_code), '') IS NOT NULL
    AND nullif(btrim(customer.city), '') IS NOT NULL
    AND nullif(btrim(customer.country), '') IS NOT NULL
    AND coalesce(base_items.base_line_count, 0) > 0
    AND coalesce(base_items.invalid_price_count, 0) = 0
  ) AS integrity_ok
FROM private.v_order_freeze_state_v1 freeze_state
JOIN public.orders orders
  ON orders.id = freeze_state.order_id
 AND orders.tenant_id = freeze_state.tenant_id
JOIN public.customers customer
  ON customer.id = orders.customer_id
 AND customer.tenant_id = orders.tenant_id
LEFT JOIN LATERAL (
  SELECT selected.*, count(*) OVER ()::integer AS config_count
  FROM public.company_settings selected
  WHERE selected.tenant_id = freeze_state.tenant_id
  ORDER BY selected.updated_at DESC, selected.id
  LIMIT 1
) company ON true
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS base_line_count,
    count(*) FILTER (WHERE item.preis_netto IS NULL OR item.preis_netto < 0)::integer
      AS invalid_price_count,
    coalesce(sum(round(item.preis_netto * 100)::bigint * item.quantity), 0)::bigint
      AS base_net_amount_cents,
    jsonb_agg(
      jsonb_build_object(
        'itemId', item.id,
        'name', item.name,
        'quantity', item.quantity,
        'unitNetAmountCents', round(item.preis_netto * 100)::bigint,
        'lineNetAmountCents', round(item.preis_netto * 100)::bigint * item.quantity
      ) ORDER BY item.id
    ) AS base_lines
  FROM public.items item
  WHERE item.tenant_id = freeze_state.tenant_id
    AND item.order_id = freeze_state.order_id
) base_items ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'itemId', line.item_id,
      'catalogPositionId', line.catalog_position_id,
      'catalogPositionName', line.catalog_position_name,
      'minutes', line.minutes,
      'hourlyRateCents', line.hourly_rate_cents,
      'amountCents', line.amount_cents
    ) ORDER BY line.item_id, line.catalog_position_name, line.catalog_position_id
  ) AS lines
  FROM private.order_frozen_extra_work_lines line
  WHERE line.tenant_id = freeze_state.tenant_id
    AND line.freeze_id = freeze_state.freeze_id
) extra_work ON true
WHERE freeze_state.active = true
  AND nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND freeze_state.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_invoice_summary_v1
WITH (security_invoker = true)
AS
SELECT
  invoice.id,
  invoice.tenant_id,
  invoice.order_id,
  invoice.customer_id,
  invoice.freeze_id,
  invoice.invoice_number,
  invoice.status,
  invoice.net_amount_cents,
  invoice.vat_rate_basis_points,
  invoice.vat_amount_cents,
  invoice.gross_amount_cents,
  invoice.service_date,
  invoice.order_version,
  invoice.due_date,
  invoice.payment_term_days,
  invoice.issued_at,
  invoice.aggregate_version,
  invoice.issued_by,
  invoice.pdf_ref,
  invoice.pdf_sha256,
  invoice.cancelled_by,
  invoice.cancel_reason,
  invoice.cancelled_at,
  invoice.cancellation_pdf_ref,
  invoice.cancellation_pdf_sha256,
  invoice.snapshot->'order'->>'orderNumber' AS order_number,
  coalesce(
    nullif(invoice.snapshot->'customer'->>'companyName', ''),
    invoice.snapshot->'customer'->>'name'
  ) AS customer_name,
  (
    orders.id IS NOT NULL
    AND customer.id IS NOT NULL
    AND issuer.id IS NOT NULL
    AND invoice.gross_amount_cents = invoice.net_amount_cents + invoice.vat_amount_cents
    AND invoice.order_version = (invoice.snapshot->'order'->>'orderVersion')::integer
    AND invoice.order_id = invoice.snapshot->'order'->>'orderId'
    AND invoice.freeze_id::text = invoice.snapshot->'order'->>'freezeId'
    AND encode(sha256(invoice.pdf_content), 'hex') = invoice.pdf_sha256
    AND (
      invoice.status <> 'cancelled'
      OR (
        canceller.id IS NOT NULL
        AND encode(sha256(invoice.cancellation_pdf_content), 'hex')
          = invoice.cancellation_pdf_sha256
      )
    )
  ) AS integrity_ok
FROM public.invoices invoice
JOIN public.orders orders
  ON orders.id = invoice.order_id
 AND orders.tenant_id = invoice.tenant_id
JOIN public.customers customer
  ON customer.id = invoice.customer_id
 AND customer.tenant_id = invoice.tenant_id
JOIN public.app_users issuer
  ON issuer.id = invoice.issued_by
 AND issuer.tenant_id = invoice.tenant_id
LEFT JOIN public.app_users canceller
  ON canceller.id = invoice.cancelled_by
 AND canceller.tenant_id = invoice.tenant_id
WHERE invoice.contract_version = 1
  AND nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND invoice.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_invoice_receipt_v1
WITH (security_invoker = true)
AS
SELECT
  event.id AS event_id,
  event.tenant_id,
  event.order_id,
  event.event_type,
  event.client_event_id,
  event.correlation_id,
  event.event_schema_version,
  event.aggregate_version,
  event.user_id AS actor_id,
  -- public.events.created_at is timestamp without time zone in UTC. The
  -- receipt exposes the canonical UTC instant string instead of a value whose
  -- rendering would depend on the reading session's time zone.
  to_char(event.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS occurred_at,
  invoice.id AS invoice_id,
  invoice.invoice_number,
  invoice.order_version,
  CASE
    WHEN event.event_type = 'INVOICE_CREATED_V1'
      THEN (event.payload->>'orderVersion')::integer
    ELSE (event.payload->>'expectedVersion')::integer
  END AS intent_expected_version,
  invoice.status AS current_status,
  invoice.aggregate_version AS current_version,
  invoice.net_amount_cents,
  invoice.vat_rate_basis_points,
  invoice.vat_amount_cents,
  invoice.gross_amount_cents,
  invoice.service_date,
  invoice.due_date,
  CASE
    WHEN event.event_type = 'INVOICE_CREATED_V1' THEN invoice.pdf_ref
    ELSE invoice.cancellation_pdf_ref
  END AS pdf_ref,
  CASE
    WHEN event.event_type = 'INVOICE_CREATED_V1' THEN invoice.pdf_sha256
    ELSE invoice.cancellation_pdf_sha256
  END AS pdf_sha256,
  invoice.cancel_reason,
  invoice.pdf_sha256 AS original_pdf_sha256,
  (
    actor.id IS NOT NULL
    AND event.order_id = invoice.order_id
    AND invoice.id::text = event.payload->>'invoiceId'
    AND invoice.invoice_number = event.payload->>'invoiceNumber'
    AND invoice.order_version = (invoice.snapshot->'order'->>'orderVersion')::integer
    AND invoice.order_id = invoice.snapshot->'order'->>'orderId'
    AND invoice.freeze_id::text = invoice.snapshot->'order'->>'freezeId'
    AND invoice.snapshot->>'serviceDate' = to_char(invoice.service_date, 'YYYY-MM-DD')
    AND invoice.snapshot->>'issuedAt'
      = to_char(invoice.issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    AND invoice.net_amount_cents = (invoice.snapshot->'totals'->>'netAmountCents')::integer
    AND invoice.vat_rate_basis_points = (invoice.snapshot->'totals'->>'vatRateBasisPoints')::integer
    AND invoice.vat_amount_cents = (invoice.snapshot->'totals'->>'vatAmountCents')::integer
    AND invoice.gross_amount_cents = (invoice.snapshot->'totals'->>'grossAmountCents')::integer
    AND (
      (
        event.event_type = 'INVOICE_CREATED_V1'
        AND invoice.issue_event_id = event.id
        AND invoice.client_event_id = event.client_event_id
        AND invoice.correlation_id = event.correlation_id
        AND invoice.issued_by = event.user_id
        -- public.events.created_at is timestamp without time zone and holds
        -- UTC. Exactly one issue instant must be visible on the invoice and
        -- on its lifecycle event.
        AND invoice.issued_at = event.created_at AT TIME ZONE 'UTC'
        AND event.aggregate_version = 1
        AND (event.payload->>'orderVersion')::integer = invoice.order_version
        AND event.payload->>'pdfSha256' = invoice.pdf_sha256
        AND encode(sha256(invoice.pdf_content), 'hex') = invoice.pdf_sha256
      )
      OR (
        event.event_type = 'INVOICE_CANCELLED_V1'
        AND invoice.cancel_event_id = event.id
        AND invoice.cancel_client_event_id = event.client_event_id
        AND invoice.cancel_correlation_id = event.correlation_id
        AND invoice.cancelled_by = event.user_id
        -- Same single-instant rule for the cancellation.
        AND invoice.cancelled_at IS NOT NULL
        AND invoice.cancelled_at = event.created_at AT TIME ZONE 'UTC'
        AND event.aggregate_version = 2
        AND (event.payload->>'expectedVersion')::integer = invoice.aggregate_version - 1
        AND event.payload->>'cancellationPdfSha256' = invoice.cancellation_pdf_sha256
        AND event.payload->>'cancelReason' = invoice.cancel_reason
        AND encode(sha256(invoice.cancellation_pdf_content), 'hex')
          = invoice.cancellation_pdf_sha256
      )
    )
  ) AS integrity_ok
FROM public.events event
JOIN public.invoices invoice
  ON invoice.tenant_id = event.tenant_id
 AND invoice.id::text = event.payload->>'invoiceId'
JOIN public.app_users actor
  ON actor.id = event.user_id
 AND actor.tenant_id = event.tenant_id
WHERE invoice.contract_version = 1
  AND event.event_type IN ('INVOICE_CREATED_V1', 'INVOICE_CANCELLED_V1')
  AND event.status = 'success'
  AND nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND event.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_invoice_issue_source_v1 IS
  'F1.4 tenant-bound source for an invoice command: final F1.3 freeze, real base prices, frozen extra work, customer and tenant master data.';
COMMENT ON VIEW private.v_invoice_summary_v1 IS
  'F1.4 tenant-bound immutable invoice summary. Payment/open-balance truth remains excluded until F1.5.';
COMMENT ON VIEW private.v_invoice_receipt_v1 IS
  'F1.4 tenant-bound created/cancelled receipt readback with event, actor, invoice and PDF hash integrity.';

REVOKE ALL ON TABLE private.v_invoice_issue_source_v1 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.v_invoice_summary_v1 FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE private.v_invoice_receipt_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE private.v_invoice_issue_source_v1 TO service_role;
GRANT SELECT ON TABLE private.v_invoice_summary_v1 TO service_role;
GRANT SELECT ON TABLE private.v_invoice_receipt_v1 TO service_role;
