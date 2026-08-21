-- F1.3 / D-F13-001: immutable finish snapshot for per-item extra work.
-- Money remains an operational snapshot, not an accounting or margin truth.
-- Integer cents use deterministic round-half-up:
--   amount_cents = floor((minutes * hourly_rate_cents + 30) / 60).

CREATE TABLE private.order_freezes (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  order_id text NOT NULL,
  event_id text NOT NULL REFERENCES public.events (id) ON DELETE RESTRICT,
  hourly_rate_id uuid NOT NULL,
  hourly_rate_cents integer NOT NULL,
  total_amount_cents bigint NOT NULL,
  line_count integer NOT NULL,
  order_version integer NOT NULL,
  frozen_by uuid NOT NULL REFERENCES public.app_users (id) ON DELETE RESTRICT,
  frozen_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT order_freezes_tenant_chk
    CHECK (tenant_id = btrim(tenant_id) AND length(tenant_id) BETWEEN 1 AND 50),
  CONSTRAINT order_freezes_rate_chk CHECK (hourly_rate_cents BETWEEN 1 AND 1000000),
  CONSTRAINT order_freezes_total_chk CHECK (total_amount_cents >= 0),
  CONSTRAINT order_freezes_line_count_chk CHECK (line_count >= 0),
  CONSTRAINT order_freezes_version_chk CHECK (order_version > 0),
  CONSTRAINT order_freezes_order_fkey
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_freezes_rate_fkey
    FOREIGN KEY (tenant_id, hourly_rate_id)
    REFERENCES private.extra_work_hourly_rates (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_freezes_tenant_order_version_uidx
    UNIQUE (tenant_id, order_id, order_version),
  CONSTRAINT order_freezes_tenant_id_uidx UNIQUE (tenant_id, id),
  CONSTRAINT order_freezes_event_uidx UNIQUE (event_id)
);

CREATE TABLE private.order_frozen_extra_work_lines (
  id uuid PRIMARY KEY,
  freeze_id uuid NOT NULL,
  tenant_id text NOT NULL,
  order_id text NOT NULL,
  item_id text NOT NULL,
  source_line_id uuid NOT NULL,
  source_line_version integer NOT NULL,
  catalog_position_id uuid NOT NULL,
  catalog_position_name text NOT NULL,
  minutes integer NOT NULL,
  hourly_rate_cents integer NOT NULL,
  amount_cents integer NOT NULL,
  frozen_at timestamptz NOT NULL,

  CONSTRAINT order_frozen_lines_tenant_chk
    CHECK (tenant_id = btrim(tenant_id) AND length(tenant_id) BETWEEN 1 AND 50),
  CONSTRAINT order_frozen_lines_name_chk
    CHECK (
      catalog_position_name = btrim(catalog_position_name)
      AND length(catalog_position_name) BETWEEN 2 AND 100
    ),
  CONSTRAINT order_frozen_lines_minutes_chk CHECK (minutes BETWEEN 1 AND 1440),
  CONSTRAINT order_frozen_lines_source_version_chk CHECK (source_line_version > 0),
  CONSTRAINT order_frozen_lines_rate_chk CHECK (hourly_rate_cents BETWEEN 1 AND 1000000),
  CONSTRAINT order_frozen_lines_amount_chk CHECK (
    amount_cents = ((minutes::bigint * hourly_rate_cents::bigint + 30) / 60)::integer
  ),
  CONSTRAINT order_frozen_lines_freeze_fkey
    FOREIGN KEY (tenant_id, freeze_id)
    REFERENCES private.order_freezes (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_frozen_lines_item_fkey
    FOREIGN KEY (tenant_id, order_id, item_id)
    REFERENCES public.items (tenant_id, order_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_frozen_lines_source_fkey
    FOREIGN KEY (tenant_id, source_line_id)
    REFERENCES private.order_item_extra_work (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_frozen_lines_catalog_fkey
    FOREIGN KEY (tenant_id, catalog_position_id)
    REFERENCES private.extra_work_catalog_positions (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_frozen_lines_source_uidx UNIQUE (tenant_id, freeze_id, source_line_id),
  CONSTRAINT order_frozen_lines_position_uidx
    UNIQUE (tenant_id, freeze_id, item_id, catalog_position_id)
);

-- L6: corrections never delete or mutate the historical freeze. A correction
-- marks exactly one freeze inactive and records its own immutable event.
CREATE TABLE private.order_freeze_corrections (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  order_id text NOT NULL,
  freeze_id uuid NOT NULL,
  event_id text NOT NULL REFERENCES public.events (id) ON DELETE RESTRICT,
  reason text NOT NULL,
  order_version integer NOT NULL,
  corrected_by uuid NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT order_freeze_corrections_tenant_chk
    CHECK (tenant_id = btrim(tenant_id) AND length(tenant_id) BETWEEN 1 AND 50),
  CONSTRAINT order_freeze_corrections_reason_chk
    CHECK (reason = btrim(reason) AND length(reason) BETWEEN 5 AND 500),
  CONSTRAINT order_freeze_corrections_version_chk CHECK (order_version > 0),
  CONSTRAINT order_freeze_corrections_freeze_fkey
    FOREIGN KEY (tenant_id, freeze_id)
    REFERENCES private.order_freezes (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_freeze_corrections_order_fkey
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_freeze_corrections_actor_fkey
    FOREIGN KEY (tenant_id, corrected_by)
    REFERENCES public.app_users (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_freeze_corrections_tenant_freeze_uidx UNIQUE (tenant_id, freeze_id),
  CONSTRAINT order_freeze_corrections_tenant_id_uidx UNIQUE (tenant_id, id),
  CONSTRAINT order_freeze_corrections_event_uidx UNIQUE (event_id)
);

CREATE TRIGGER order_freezes_update_immutable
  BEFORE UPDATE ON private.order_freezes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_freezes_delete_immutable
  BEFORE DELETE ON private.order_freezes
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_freezes_truncate_immutable
  BEFORE TRUNCATE ON private.order_freezes
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_frozen_lines_update_immutable
  BEFORE UPDATE ON private.order_frozen_extra_work_lines
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_frozen_lines_delete_immutable
  BEFORE DELETE ON private.order_frozen_extra_work_lines
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_frozen_lines_truncate_immutable
  BEFORE TRUNCATE ON private.order_frozen_extra_work_lines
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_freeze_corrections_update_immutable
  BEFORE UPDATE ON private.order_freeze_corrections
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_freeze_corrections_delete_immutable
  BEFORE DELETE ON private.order_freeze_corrections
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_freeze_corrections_truncate_immutable
  BEFORE TRUNCATE ON private.order_freeze_corrections
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE FUNCTION private.prevent_multiple_active_order_freezes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM private.order_freezes existing_freeze
    WHERE existing_freeze.tenant_id = NEW.tenant_id
      AND existing_freeze.order_id = NEW.order_id
      AND NOT EXISTS (
        SELECT 1
        FROM private.order_freeze_corrections correction
        WHERE correction.tenant_id = existing_freeze.tenant_id
          AND correction.freeze_id = existing_freeze.id
      )
  ) THEN
    RAISE EXCEPTION 'ORDER_ACTIVE_FREEZE_EXISTS'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER order_freezes_one_active_guard
  BEFORE INSERT ON private.order_freezes
  FOR EACH ROW EXECUTE FUNCTION private.prevent_multiple_active_order_freezes();

CREATE FUNCTION private.prevent_frozen_order_extra_work_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  target_tenant text;
  target_order text;
BEGIN
  target_tenant := CASE WHEN TG_OP = 'DELETE' THEN OLD.tenant_id ELSE NEW.tenant_id END;
  target_order := CASE WHEN TG_OP = 'DELETE' THEN OLD.order_id ELSE NEW.order_id END;

  IF EXISTS (
    SELECT 1
    FROM private.order_freezes frozen_order
    WHERE frozen_order.tenant_id = target_tenant
      AND frozen_order.order_id = target_order
      AND NOT EXISTS (
        SELECT 1
        FROM private.order_freeze_corrections correction
        WHERE correction.tenant_id = frozen_order.tenant_id
          AND correction.freeze_id = frozen_order.id
      )
  ) THEN
    RAISE EXCEPTION 'ORDER_EXTRA_WORK_FROZEN'
      USING ERRCODE = '23514';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

CREATE TRIGGER order_item_extra_work_freeze_guard
  BEFORE INSERT OR UPDATE OR DELETE ON private.order_item_extra_work
  FOR EACH ROW EXECUTE FUNCTION private.prevent_frozen_order_extra_work_mutation();

ALTER TABLE public.events
  ADD CONSTRAINT events_order_frozen_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_FROZEN_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version > 0
      AND from_station = 'galvanik'
      AND station = 'fertig'
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'freezeId', payload->'freezeId',
        'rateId', payload->'rateId',
        'hourlyRateCents', payload->'hourlyRateCents',
        'totalAmountCents', payload->'totalAmountCents',
        'lineCount', payload->'lineCount'
      )
      AND coalesce(payload->>'freezeId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(payload->>'rateId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND jsonb_typeof(payload->'hourlyRateCents') = 'number'
      AND (payload->>'hourlyRateCents')::integer BETWEEN 1 AND 1000000
      AND jsonb_typeof(payload->'totalAmountCents') = 'number'
      AND (payload->>'totalAmountCents')::bigint >= 0
      AND jsonb_typeof(payload->'lineCount') = 'number'
      AND (payload->>'lineCount')::integer >= 0
    ), false)
  ) NOT VALID;

CREATE TRIGGER events_order_frozen_v1_update_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'ORDER_FROZEN_V1' OR NEW.event_type = 'ORDER_FROZEN_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_order_frozen_v1_delete_immutable
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'ORDER_FROZEN_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

ALTER TABLE public.events
  ADD CONSTRAINT events_order_freeze_corrected_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_FREEZE_CORRECTED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version > 0
      AND from_station = 'fertig'
      AND station = 'galvanik'
      AND status = 'success'
      AND description = btrim(description)
      AND length(description) BETWEEN 5 AND 500
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'freezeId', payload->'freezeId',
        'correctedFreezeVersion', payload->'correctedFreezeVersion'
      )
      AND coalesce(payload->>'freezeId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND jsonb_typeof(payload->'correctedFreezeVersion') = 'number'
      AND (payload->>'correctedFreezeVersion')::integer > 0
    ), false)
  ) NOT VALID;

CREATE TRIGGER events_order_freeze_corrected_v1_update_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (
    OLD.event_type = 'ORDER_FREEZE_CORRECTED_V1'
    OR NEW.event_type = 'ORDER_FREEZE_CORRECTED_V1'
  )
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_order_freeze_corrected_v1_delete_immutable
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'ORDER_FREEZE_CORRECTED_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

-- Narrow accounting boundary for L6. Any existing invoice row blocks reopen;
-- a tenant-mismatched invoice for the same order makes the port fail closed.
CREATE VIEW private.v_order_invoice_presence_v1
WITH (security_invoker = true)
AS
SELECT
  orders.tenant_id,
  orders.id AS order_id,
  EXISTS (
    SELECT 1
    FROM public.invoices invoice
    WHERE invoice.order_id = orders.id
      AND invoice.tenant_id = orders.tenant_id
  ) AS invoice_exists,
  (
    SELECT count(*)::integer
    FROM public.invoices invoice
    WHERE invoice.order_id = orders.id
      AND invoice.tenant_id = orders.tenant_id
  ) AS invoice_count,
  NOT EXISTS (
    SELECT 1
    FROM public.invoices invoice
    WHERE invoice.order_id = orders.id
      AND invoice.tenant_id IS DISTINCT FROM orders.tenant_id
  ) AS integrity_ok
FROM public.orders orders
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_order_freeze_state_v1
WITH (security_invoker = true)
AS
SELECT
  frozen_order.id AS freeze_id,
  frozen_order.tenant_id,
  frozen_order.order_id,
  frozen_order.event_id,
  frozen_order.hourly_rate_id AS rate_id,
  frozen_order.hourly_rate_cents,
  frozen_order.total_amount_cents,
  frozen_order.line_count,
  frozen_order.order_version,
  frozen_order.frozen_by,
  frozen_order.frozen_at,
  correction.id AS correction_id,
  correction.event_id AS correction_event_id,
  correction.reason AS correction_reason,
  correction.order_version AS correction_order_version,
  correction.corrected_by,
  correction.corrected_at,
  correction.id IS NULL AS active,
  (
    orders.id IS NOT NULL
    AND customer.id IS NOT NULL
    AND freeze_actor.id IS NOT NULL
    AND freeze_event.id = frozen_order.event_id
    AND freeze_event.tenant_id = frozen_order.tenant_id
    AND freeze_event.order_id = frozen_order.order_id
    AND freeze_event.event_type = 'ORDER_FROZEN_V1'
    AND freeze_event.aggregate_version = frozen_order.order_version
    AND freeze_event.user_id = frozen_order.frozen_by
    AND orders.version >= frozen_order.order_version
    AND frozen_order.line_count = coalesce(lines.actual_line_count, 0)
    AND frozen_order.total_amount_cents = coalesce(lines.actual_total_amount_cents, 0)
    AND (
      correction.id IS NULL
      OR (
        correction.order_id = frozen_order.order_id
        AND correction.order_version > frozen_order.order_version
        AND correction_event.id = correction.event_id
        AND correction_event.tenant_id = frozen_order.tenant_id
        AND correction_event.order_id = frozen_order.order_id
        AND correction_event.event_type = 'ORDER_FREEZE_CORRECTED_V1'
        AND correction_event.aggregate_version = correction.order_version
        AND correction_event.user_id = correction.corrected_by
        AND correction_event.description = correction.reason
        AND correction_event.payload->>'freezeId' = frozen_order.id::text
        AND (correction_event.payload->>'correctedFreezeVersion')::integer = frozen_order.order_version
        AND correction_actor.id IS NOT NULL
        AND correction_actor.tenant_id = frozen_order.tenant_id
      )
    )
  ) AS integrity_ok
FROM private.order_freezes frozen_order
LEFT JOIN public.events freeze_event
  ON freeze_event.id = frozen_order.event_id
LEFT JOIN private.order_freeze_corrections correction
  ON correction.tenant_id = frozen_order.tenant_id
 AND correction.freeze_id = frozen_order.id
LEFT JOIN public.events correction_event
  ON correction_event.id = correction.event_id
LEFT JOIN public.orders orders
  ON orders.id = frozen_order.order_id
 AND orders.tenant_id = frozen_order.tenant_id
LEFT JOIN public.customers customer
  ON customer.id = orders.customer_id
 AND customer.tenant_id = orders.tenant_id
LEFT JOIN public.app_users freeze_actor
  ON freeze_actor.id = frozen_order.frozen_by
 AND freeze_actor.tenant_id = frozen_order.tenant_id
LEFT JOIN public.app_users correction_actor
  ON correction_actor.id = correction.corrected_by
 AND correction_actor.tenant_id = frozen_order.tenant_id
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS actual_line_count,
    coalesce(sum(line.amount_cents), 0)::bigint AS actual_total_amount_cents
  FROM private.order_frozen_extra_work_lines line
  WHERE line.tenant_id = frozen_order.tenant_id
    AND line.freeze_id = frozen_order.id
) lines ON true
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND frozen_order.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_order_freeze_correction_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  event.id AS event_id,
  event.tenant_id,
  event.order_id,
  event.client_event_id,
  event.correlation_id,
  event.event_schema_version,
  event.aggregate_version,
  event.from_station,
  event.station AS to_station,
  event.user_id AS actor_id,
  event.created_at AT TIME ZONE 'UTC' AS occurred_at,
  correction.id AS correction_id,
  correction.freeze_id,
  frozen_order.order_version AS corrected_freeze_version,
  correction.reason,
  correction.corrected_at,
  (
    orders.id IS NOT NULL
    AND orders.version >= correction.order_version
    AND actor.id IS NOT NULL
    AND actor.tenant_id = event.tenant_id
    AND frozen_order.id = correction.freeze_id
    AND frozen_order.tenant_id = correction.tenant_id
    AND frozen_order.order_id = correction.order_id
    AND correction.event_id = event.id
    AND correction.order_version = event.aggregate_version
    AND correction.corrected_by = event.user_id
    AND correction.reason = event.description
    AND event.payload->>'freezeId' = correction.freeze_id::text
    AND (event.payload->>'correctedFreezeVersion')::integer = frozen_order.order_version
  ) AS integrity_ok
FROM public.events event
JOIN private.order_freeze_corrections correction
  ON correction.event_id = event.id
 AND correction.tenant_id = event.tenant_id
 AND correction.order_id = event.order_id
JOIN private.order_freezes frozen_order
  ON frozen_order.id = correction.freeze_id
 AND frozen_order.tenant_id = correction.tenant_id
 AND frozen_order.order_id = correction.order_id
LEFT JOIN public.orders orders
  ON orders.id = event.order_id
 AND orders.tenant_id = event.tenant_id
LEFT JOIN public.app_users actor
  ON actor.id = event.user_id
 AND actor.tenant_id = event.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND event.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND event.event_type = 'ORDER_FREEZE_CORRECTED_V1'
  AND event.status = 'success'
  AND event.event_schema_version = 1
  AND event.from_station = 'fertig'
  AND event.station = 'galvanik';

CREATE VIEW private.v_order_frozen_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  event.id AS event_id,
  event.tenant_id,
  event.order_id,
  event.client_event_id,
  event.correlation_id,
  event.event_schema_version,
  event.aggregate_version,
  event.from_station,
  event.station AS to_station,
  event.user_id AS actor_id,
  event.created_at AT TIME ZONE 'UTC' AS occurred_at,
  frozen_order.id AS freeze_id,
  frozen_order.hourly_rate_id AS rate_id,
  frozen_order.hourly_rate_cents,
  frozen_order.total_amount_cents,
  frozen_order.line_count,
  frozen_order.frozen_at,
  freeze_state.active,
  freeze_state.correction_event_id,
  freeze_state.correction_reason,
  freeze_state.corrected_at,
  coalesce(lines.lines, '[]'::jsonb) AS lines,
  (
    freeze_state.integrity_ok = true
    AND orders.id IS NOT NULL
    AND customer.id IS NOT NULL
    AND actor.id IS NOT NULL
    AND actor.tenant_id = event.tenant_id
    AND frozen_order.event_id = event.id
    AND frozen_order.order_version = event.aggregate_version
    AND frozen_order.frozen_by = event.user_id
    AND orders.version >= frozen_order.order_version
    AND frozen_order.line_count = coalesce(lines.actual_line_count, 0)
    AND frozen_order.total_amount_cents = coalesce(lines.actual_total_amount_cents, 0)
  ) AS integrity_ok
FROM public.events event
JOIN private.order_freezes frozen_order
  ON frozen_order.event_id = event.id
 AND frozen_order.tenant_id = event.tenant_id
 AND frozen_order.order_id = event.order_id
JOIN private.v_order_freeze_state_v1 freeze_state
  ON freeze_state.freeze_id = frozen_order.id
 AND freeze_state.tenant_id = frozen_order.tenant_id
 AND freeze_state.order_id = frozen_order.order_id
LEFT JOIN public.orders orders
  ON orders.id = event.order_id
 AND orders.tenant_id = event.tenant_id
LEFT JOIN public.customers customer
  ON customer.id = orders.customer_id
 AND customer.tenant_id = orders.tenant_id
LEFT JOIN public.app_users actor
  ON actor.id = event.user_id
 AND actor.tenant_id = event.tenant_id
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS actual_line_count,
    coalesce(sum(line.amount_cents), 0)::bigint AS actual_total_amount_cents,
    jsonb_agg(
      jsonb_build_object(
        'itemId', line.item_id,
        'catalogPositionId', line.catalog_position_id,
        'catalogPositionName', line.catalog_position_name,
        'minutes', line.minutes,
        'hourlyRateCents', line.hourly_rate_cents,
        'amountCents', line.amount_cents
      )
      ORDER BY line.item_id, line.catalog_position_name, line.catalog_position_id
    ) AS lines
  FROM private.order_frozen_extra_work_lines line
  WHERE line.tenant_id = frozen_order.tenant_id
    AND line.freeze_id = frozen_order.id
) lines ON true
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND event.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND event.event_type = 'ORDER_FROZEN_V1'
  AND event.status = 'success'
  AND event.event_schema_version = 1
  AND event.from_station = 'galvanik'
  AND event.station = 'fertig';

CREATE VIEW private.v_order_extra_work_live_v1
WITH (security_invoker = true)
AS
SELECT
  live.tenant_id,
  live.order_id,
  live.item_id,
  live.id AS line_id,
  live.catalog_position_id,
  live.catalog_position_name,
  live.minutes,
  live.hourly_rate_cents,
  live.provisional_amount_cents AS amount_cents,
  false AS frozen,
  live.version AS line_version,
  NULL::timestamptz AS frozen_at,
  (live.integrity_ok AND live.rate_configured) AS integrity_ok
FROM private.v_order_item_extra_work_v1 live
WHERE live.active = true
  AND NOT EXISTS (
    SELECT 1
    FROM private.v_order_freeze_state_v1 frozen_order
    WHERE frozen_order.tenant_id = live.tenant_id
      AND frozen_order.order_id = live.order_id
      AND frozen_order.active = true
  )

UNION ALL

SELECT
  line.tenant_id,
  line.order_id,
  line.item_id,
  line.source_line_id AS line_id,
  line.catalog_position_id,
  line.catalog_position_name,
  line.minutes,
  line.hourly_rate_cents,
  line.amount_cents,
  true AS frozen,
  line.source_line_version AS line_version,
  frozen_order.frozen_at,
  (
    orders.id IS NOT NULL
    AND item.id IS NOT NULL
    AND item.order_id = orders.id
    AND item.customer_id = orders.customer_id
    AND item.tenant_id = orders.tenant_id
    AND frozen_order.integrity_ok = true
  ) AS integrity_ok
FROM private.order_frozen_extra_work_lines line
JOIN private.v_order_freeze_state_v1 frozen_order
  ON frozen_order.freeze_id = line.freeze_id
 AND frozen_order.tenant_id = line.tenant_id
 AND frozen_order.order_id = line.order_id
 AND frozen_order.active = true
LEFT JOIN public.orders orders
  ON orders.id = line.order_id
 AND orders.tenant_id = line.tenant_id
LEFT JOIN public.items item
  ON item.id = line.item_id
 AND item.tenant_id = line.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND line.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON TABLE private.order_freezes IS
  'F1.3 immutable finish header; operational extra-work snapshot, never accounting truth.';
COMMENT ON TABLE private.order_frozen_extra_work_lines IS
  'F1.3 immutable per-item extra-work snapshots with historical catalog name, minutes, hourly rate and amount.';
COMMENT ON TABLE private.order_freeze_corrections IS
  'F1.3 L6 immutable correction markers for historical freezes; never deletes or overwrites a freeze snapshot.';
COMMENT ON VIEW private.v_order_invoice_presence_v1 IS
  'F1.3 L6 narrow tenant-bound accounting boundary; any invoice row blocks reopen and tenant mismatches fail closed.';
COMMENT ON VIEW private.v_order_freeze_state_v1 IS
  'F1.3 single active-freeze truth; historical freezes remain visible after an append-only correction.';
COMMENT ON VIEW private.v_order_freeze_correction_receipts_v1 IS
  'F1.3 tenant-bound immutable ORDER_FREEZE_CORRECTED_V1 receipt readback.';
COMMENT ON VIEW private.v_order_frozen_receipts_v1 IS
  'F1.3 tenant-bound historical ORDER_FROZEN_V1 receipt and immutable line readback with active/corrected projection.';
COMMENT ON VIEW private.v_order_extra_work_live_v1 IS
  'F1.3 tenant-bound live extra-work port: provisional before freeze, stored snapshot after freeze.';
