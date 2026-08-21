-- F1.3 / D-F13-001: configurable extra-work master data and per-item live
-- entries. All business reads are exposed only through tenant-bound private
-- views. Money uses integer cents; an hourly rate is converted with
-- round-half-up(minutes * hourly_rate_cents / 60). The final frozen snapshot
-- and ORDER_FROZEN_V1 event are added by the next F1.3 migration.

CREATE TABLE private.extra_work_hourly_rates (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  hourly_rate_cents integer NOT NULL,
  version integer NOT NULL,
  created_by uuid NOT NULL REFERENCES public.app_users (id) ON DELETE RESTRICT,
  effective_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT extra_work_hourly_rates_tenant_chk
    CHECK (tenant_id = btrim(tenant_id) AND length(tenant_id) BETWEEN 1 AND 50),
  CONSTRAINT extra_work_hourly_rates_rate_chk
    CHECK (hourly_rate_cents BETWEEN 1 AND 1000000),
  CONSTRAINT extra_work_hourly_rates_version_chk CHECK (version > 0),
  CONSTRAINT extra_work_hourly_rates_tenant_version_uidx UNIQUE (tenant_id, version),
  CONSTRAINT extra_work_hourly_rates_tenant_id_uidx UNIQUE (tenant_id, id)
);

CREATE TRIGGER extra_work_hourly_rates_update_immutable
  BEFORE UPDATE ON private.extra_work_hourly_rates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER extra_work_hourly_rates_delete_immutable
  BEFORE DELETE ON private.extra_work_hourly_rates
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER extra_work_hourly_rates_truncate_immutable
  BEFORE TRUNCATE ON private.extra_work_hourly_rates
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TABLE private.extra_work_catalog_positions (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  name text NOT NULL,
  standard_minutes integer NOT NULL,
  active boolean NOT NULL,
  version integer NOT NULL,
  created_by uuid NOT NULL REFERENCES public.app_users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.app_users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT extra_work_catalog_tenant_chk
    CHECK (tenant_id = btrim(tenant_id) AND length(tenant_id) BETWEEN 1 AND 50),
  CONSTRAINT extra_work_catalog_name_chk
    CHECK (name = btrim(name) AND length(name) BETWEEN 2 AND 100),
  CONSTRAINT extra_work_catalog_minutes_chk CHECK (standard_minutes BETWEEN 1 AND 1440),
  CONSTRAINT extra_work_catalog_version_chk CHECK (version > 0),
  CONSTRAINT extra_work_catalog_time_chk CHECK (updated_at >= created_at),
  CONSTRAINT extra_work_catalog_tenant_id_uidx UNIQUE (tenant_id, id)
);

CREATE UNIQUE INDEX extra_work_catalog_tenant_name_uidx
  ON private.extra_work_catalog_positions (tenant_id, lower(name));

CREATE TABLE private.order_item_extra_work (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  order_id text NOT NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  item_id text NOT NULL REFERENCES public.items (id) ON DELETE RESTRICT,
  catalog_position_id uuid NOT NULL,
  minutes integer NOT NULL,
  active boolean NOT NULL,
  version integer NOT NULL,
  created_by uuid NOT NULL REFERENCES public.app_users (id) ON DELETE RESTRICT,
  updated_by uuid NOT NULL REFERENCES public.app_users (id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT order_item_extra_work_tenant_chk
    CHECK (tenant_id = btrim(tenant_id) AND length(tenant_id) BETWEEN 1 AND 50),
  CONSTRAINT order_item_extra_work_minutes_chk CHECK (minutes BETWEEN 1 AND 1440),
  CONSTRAINT order_item_extra_work_version_chk CHECK (version > 0),
  CONSTRAINT order_item_extra_work_time_chk CHECK (updated_at >= created_at),
  CONSTRAINT order_item_extra_work_catalog_fkey
    FOREIGN KEY (tenant_id, catalog_position_id)
    REFERENCES private.extra_work_catalog_positions (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_item_extra_work_item_fkey
    FOREIGN KEY (tenant_id, order_id, item_id)
    REFERENCES public.items (tenant_id, order_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_item_extra_work_tenant_item_catalog_uidx
    UNIQUE (tenant_id, item_id, catalog_position_id),
  CONSTRAINT order_item_extra_work_tenant_id_uidx UNIQUE (tenant_id, id)
);

ALTER TABLE public.events
  ADD CONSTRAINT events_extra_work_catalog_configured_v1_contract_chk
  CHECK (
    event_type <> 'EXTRA_WORK_CATALOG_CONFIGURED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version > 0
      AND from_station IS NULL
      AND station IS NULL
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'positionId', payload->'positionId',
        'name', payload->'name',
        'standardMinutes', payload->'standardMinutes',
        'active', payload->'active',
        'positionVersion', payload->'positionVersion'
      )
      AND coalesce(payload->>'positionId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND jsonb_typeof(payload->'name') = 'string'
      AND payload->>'name' = btrim(payload->>'name')
      AND length(payload->>'name') BETWEEN 2 AND 100
      AND jsonb_typeof(payload->'standardMinutes') = 'number'
      AND (payload->>'standardMinutes')::integer BETWEEN 1 AND 1440
      AND jsonb_typeof(payload->'active') = 'boolean'
      AND jsonb_typeof(payload->'positionVersion') = 'number'
      AND (payload->>'positionVersion')::integer = aggregate_version
    ), false)
  ) NOT VALID;

ALTER TABLE public.events
  ADD CONSTRAINT events_extra_work_rate_set_v1_contract_chk
  CHECK (
    event_type <> 'EXTRA_WORK_RATE_SET_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version > 0
      AND from_station IS NULL
      AND station IS NULL
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'rateId', payload->'rateId',
        'hourlyRateCents', payload->'hourlyRateCents',
        'rateVersion', payload->'rateVersion'
      )
      AND coalesce(payload->>'rateId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND jsonb_typeof(payload->'hourlyRateCents') = 'number'
      AND (payload->>'hourlyRateCents')::integer BETWEEN 1 AND 1000000
      AND jsonb_typeof(payload->'rateVersion') = 'number'
      AND (payload->>'rateVersion')::integer = aggregate_version
    ), false)
  ) NOT VALID;

ALTER TABLE public.events
  ADD CONSTRAINT events_order_item_extra_work_set_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_ITEM_EXTRA_WORK_CHANGED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NOT NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version > 0
      AND from_station = 'galvanik'
      AND station = 'galvanik'
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'lineId', payload->'lineId',
        'catalogPositionId', payload->'catalogPositionId',
        'minutes', payload->'minutes',
        'active', payload->'active',
        'lineVersion', payload->'lineVersion'
      )
      AND coalesce(payload->>'lineId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(payload->>'catalogPositionId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND jsonb_typeof(payload->'minutes') = 'number'
      AND (payload->>'minutes')::integer BETWEEN 1 AND 1440
      AND jsonb_typeof(payload->'active') = 'boolean'
      AND jsonb_typeof(payload->'lineVersion') = 'number'
      AND (payload->>'lineVersion')::integer > 0
    ), false)
  ) NOT VALID;

CREATE TRIGGER events_f1_3_extra_work_update_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (
    OLD.event_type IN (
      'EXTRA_WORK_CATALOG_CONFIGURED_V1',
      'EXTRA_WORK_RATE_SET_V1',
      'ORDER_ITEM_EXTRA_WORK_CHANGED_V1'
    )
    OR NEW.event_type IN (
      'EXTRA_WORK_CATALOG_CONFIGURED_V1',
      'EXTRA_WORK_RATE_SET_V1',
      'ORDER_ITEM_EXTRA_WORK_CHANGED_V1'
    )
  )
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_f1_3_extra_work_delete_immutable
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (
    OLD.event_type IN (
      'EXTRA_WORK_CATALOG_CONFIGURED_V1',
      'EXTRA_WORK_RATE_SET_V1',
      'ORDER_ITEM_EXTRA_WORK_CHANGED_V1'
    )
  )
  EXECUTE FUNCTION public.prevent_audit_mutation();

DROP INDEX public.events_order_station_aggregate_version_uidx;
DROP INDEX public.events_order_station_correlation_uidx;

CREATE UNIQUE INDEX events_order_station_aggregate_version_uidx
  ON public.events (tenant_id, order_id, aggregate_version)
  WHERE event_type IN (
    'ORDER_STATION_MOVED_V1',
    'ORDER_STATION_CORRECTED_V1',
    'ORDER_ITEM_EXTRA_WORK_CHANGED_V1',
    'ORDER_FROZEN_V1',
    'ORDER_FREEZE_CORRECTED_V1',
    'ORDER_TASK_ASSIGNED_V1',
    'ORDER_TASK_HANDED_BACK_V1'
  );

CREATE UNIQUE INDEX events_order_station_correlation_uidx
  ON public.events (tenant_id, correlation_id)
  WHERE event_type IN (
    'ORDER_STATION_MOVED_V1',
    'ORDER_STATION_CORRECTED_V1',
    'ORDER_ITEM_EXTRA_WORK_CHANGED_V1',
    'ORDER_FROZEN_V1',
    'ORDER_FREEZE_CORRECTED_V1',
    'ORDER_TASK_ASSIGNED_V1',
    'ORDER_TASK_HANDED_BACK_V1'
  );

CREATE VIEW private.v_extra_work_current_rate_v1
WITH (security_invoker = true)
AS
SELECT
  rate.id,
  rate.tenant_id,
  rate.hourly_rate_cents,
  rate.version,
  rate.created_by,
  rate.effective_at,
  (
    actor.id IS NOT NULL
    AND actor.tenant_id = rate.tenant_id
    AND actor.active = true
  ) AS integrity_ok
FROM private.extra_work_hourly_rates rate
LEFT JOIN public.app_users actor
  ON actor.id = rate.created_by
 AND actor.tenant_id = rate.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND rate.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND rate.version = (
    SELECT max(candidate.version)
    FROM private.extra_work_hourly_rates candidate
    WHERE candidate.tenant_id = rate.tenant_id
  );

CREATE VIEW private.v_extra_work_catalog_v1
WITH (security_invoker = true)
AS
SELECT
  position.id,
  position.tenant_id,
  position.name,
  position.standard_minutes,
  position.active,
  position.version,
  position.updated_by,
  position.updated_at,
  (
    actor.id IS NOT NULL
    AND actor.tenant_id = position.tenant_id
    AND actor.active = true
  ) AS integrity_ok
FROM private.extra_work_catalog_positions position
LEFT JOIN public.app_users actor
  ON actor.id = position.updated_by
 AND actor.tenant_id = position.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND position.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_order_item_extra_work_v1
WITH (security_invoker = true)
AS
SELECT
  line.id,
  line.tenant_id,
  line.order_id,
  line.item_id,
  line.catalog_position_id,
  position.name AS catalog_position_name,
  position.standard_minutes,
  line.minutes,
  line.active,
  line.version,
  current_rate.hourly_rate_cents,
  current_rate.id IS NOT NULL AS rate_configured,
  CASE
    WHEN current_rate.hourly_rate_cents IS NULL THEN NULL
    ELSE ((line.minutes::bigint * current_rate.hourly_rate_cents::bigint + 30) / 60)::integer
  END AS provisional_amount_cents,
  line.updated_by,
  line.updated_at,
  (
    orders.id IS NOT NULL
    AND item.id IS NOT NULL
    AND item.order_id = orders.id
    AND item.customer_id = orders.customer_id
    AND item.tenant_id = orders.tenant_id
    AND position.id IS NOT NULL
    AND actor.id IS NOT NULL
    AND actor.tenant_id = line.tenant_id
  ) AS integrity_ok
FROM private.order_item_extra_work line
LEFT JOIN public.orders orders
  ON orders.id = line.order_id
 AND orders.tenant_id = line.tenant_id
LEFT JOIN public.items item
  ON item.id = line.item_id
 AND item.tenant_id = line.tenant_id
LEFT JOIN private.extra_work_catalog_positions position
  ON position.id = line.catalog_position_id
 AND position.tenant_id = line.tenant_id
LEFT JOIN private.v_extra_work_current_rate_v1 current_rate
  ON current_rate.tenant_id = line.tenant_id
LEFT JOIN public.app_users actor
  ON actor.id = line.updated_by
 AND actor.tenant_id = line.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND line.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_extra_work_catalog_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  event.id AS event_id,
  event.tenant_id,
  event.client_event_id,
  event.correlation_id,
  event.event_schema_version,
  event.aggregate_version,
  event.user_id AS actor_id,
  event.payload->>'positionId' AS position_id,
  event.payload->>'name' AS name,
  (event.payload->>'standardMinutes')::integer AS standard_minutes,
  (event.payload->>'active')::boolean AS active,
  event.created_at AT TIME ZONE 'UTC' AS occurred_at,
  actor.id IS NOT NULL AND actor.tenant_id = event.tenant_id AS integrity_ok
FROM public.events event
LEFT JOIN public.app_users actor
  ON actor.id = event.user_id
 AND actor.tenant_id = event.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND event.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND event.event_type = 'EXTRA_WORK_CATALOG_CONFIGURED_V1'
  AND event.status = 'success';

CREATE VIEW private.v_extra_work_rate_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  event.id AS event_id,
  event.tenant_id,
  event.client_event_id,
  event.correlation_id,
  event.event_schema_version,
  event.aggregate_version,
  event.user_id AS actor_id,
  event.payload->>'rateId' AS rate_id,
  (event.payload->>'hourlyRateCents')::integer AS hourly_rate_cents,
  event.created_at AT TIME ZONE 'UTC' AS occurred_at,
  actor.id IS NOT NULL AND actor.tenant_id = event.tenant_id AS integrity_ok
FROM public.events event
LEFT JOIN public.app_users actor
  ON actor.id = event.user_id
 AND actor.tenant_id = event.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND event.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND event.event_type = 'EXTRA_WORK_RATE_SET_V1'
  AND event.status = 'success';

CREATE VIEW private.v_order_item_extra_work_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  event.id AS event_id,
  event.tenant_id,
  event.order_id,
  event.item_id,
  event.client_event_id,
  event.correlation_id,
  event.event_schema_version,
  event.aggregate_version,
  event.user_id AS actor_id,
  event.payload->>'lineId' AS line_id,
  event.payload->>'catalogPositionId' AS catalog_position_id,
  (event.payload->>'minutes')::integer AS minutes,
  (event.payload->>'active')::boolean AS active,
  (event.payload->>'lineVersion')::integer AS line_version,
  event.created_at AT TIME ZONE 'UTC' AS occurred_at,
  (
    orders.id IS NOT NULL
    AND item.id IS NOT NULL
    AND item.order_id = orders.id
    AND item.tenant_id = orders.tenant_id
    AND item.customer_id = orders.customer_id
    AND actor.id IS NOT NULL
    AND actor.tenant_id = event.tenant_id
  ) AS integrity_ok
FROM public.events event
LEFT JOIN public.orders orders
  ON orders.id = event.order_id
 AND orders.tenant_id = event.tenant_id
LEFT JOIN public.items item
  ON item.id = event.item_id
 AND item.tenant_id = event.tenant_id
LEFT JOIN public.app_users actor
  ON actor.id = event.user_id
 AND actor.tenant_id = event.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND event.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND event.event_type = 'ORDER_ITEM_EXTRA_WORK_CHANGED_V1'
  AND event.status = 'success'
  AND event.from_station = 'galvanik'
  AND event.station = 'galvanik';

COMMENT ON VIEW private.v_extra_work_current_rate_v1 IS
  'F1.3 tenant-bound current projection over append-only hourly-rate history; integer cents per hour.';
COMMENT ON VIEW private.v_extra_work_catalog_v1 IS
  'F1.3 tenant-bound configurable extra-work catalog port.';
COMMENT ON VIEW private.v_order_item_extra_work_v1 IS
  'F1.3 tenant-bound live per-item extra-work port with derived provisional amount; no accounting truth.';
COMMENT ON VIEW private.v_extra_work_catalog_receipts_v1 IS
  'F1.3 tenant-bound catalog configuration receipt readback.';
COMMENT ON VIEW private.v_extra_work_rate_receipts_v1 IS
  'F1.3 tenant-bound hourly-rate configuration receipt readback.';
COMMENT ON VIEW private.v_order_item_extra_work_receipts_v1 IS
  'F1.3 tenant-bound per-item extra-work command receipt readback.';
