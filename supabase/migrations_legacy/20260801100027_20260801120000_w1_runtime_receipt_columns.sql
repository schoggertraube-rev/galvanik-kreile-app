-- W1: additive, backwards-compatible runtime receipt reconciliation.
--
-- Scope: event and audit idempotency receipts only.
-- Validation target: integration first, then production after independent postflight.
--
-- This migration intentionally does not alter rows, RLS, policies, grants,
-- roles, storage, views, or existing business values. A separate W3 manifest
-- owns tenant/RLS cutover after the complete relation dependency review.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '2min';
SET LOCAL search_path = pg_catalog, pg_temp;

DO $w1_preflight$
BEGIN
  IF to_regclass('public.events') IS NULL OR to_regclass('public.audit_log') IS NULL THEN
    RAISE EXCEPTION 'W1 requires public.events and public.audit_log';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'events'
      AND column_name = 'client_event_id'
      AND (data_type <> 'uuid' OR is_nullable <> 'YES')
  ) THEN
    RAISE EXCEPTION 'public.events.client_event_id exists with an incompatible type or nullability';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_log'
      AND column_name = 'tenant_id'
      AND (data_type <> 'text' OR is_nullable <> 'YES')
  ) THEN
    RAISE EXCEPTION 'public.audit_log.tenant_id exists with an incompatible type or nullability';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_log'
      AND column_name = 'client_request_id'
      AND (data_type <> 'uuid' OR is_nullable <> 'YES')
  ) THEN
    RAISE EXCEPTION 'public.audit_log.client_request_id exists with an incompatible type or nullability';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_log'
      AND column_name = 'action'
      AND data_type = 'text'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'public.audit_log.action must be non-null text for W1 idempotency';
  END IF;
END
$w1_preflight$;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS client_event_id uuid;

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS tenant_id text,
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

DO $w1_index_preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.events
    WHERE tenant_id IS NOT NULL AND client_event_id IS NOT NULL
    GROUP BY tenant_id, client_event_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'public.events contains duplicate tenant/client_event_id values';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.audit_log
    WHERE tenant_id IS NOT NULL AND client_request_id IS NOT NULL
    GROUP BY tenant_id, client_request_id, action
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'public.audit_log contains duplicate tenant/client_request_id/action values';
  END IF;

  IF to_regclass('public.events_tenant_client_event_uidx') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      JOIN pg_catalog.pg_index AS i ON i.indexrelid = c.oid
      JOIN pg_catalog.pg_am AS am ON am.oid = c.relam
      WHERE n.nspname = 'public'
        AND c.relname = 'events_tenant_client_event_uidx'
        AND c.relkind = 'i'
        AND i.indrelid = 'public.events'::regclass
        AND i.indisunique
        AND i.indisvalid
        AND i.indisready
        AND i.indislive
        AND NOT i.indisprimary
        AND NOT i.indisexclusion
        AND i.indimmediate
        AND am.amname = 'btree'
        AND i.indnkeyatts = 2
        AND i.indnatts = 2
        AND i.indexprs IS NULL
        AND i.indpred IS NOT NULL
        AND ARRAY(
          SELECT a.attname::text
          FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_catalog.pg_attribute AS a
            ON a.attrelid = i.indrelid
           AND a.attnum = k.attnum
           AND NOT a.attisdropped
          ORDER BY k.ord
        ) = ARRAY['tenant_id', 'client_event_id']::text[]
        AND lower(regexp_replace(
          pg_catalog.pg_get_expr(i.indpred, i.indrelid),
          '[[:space:]()]', '', 'g'
        )) = 'tenant_idisnotnullandclient_event_idisnotnull'
    ) THEN
    RAISE EXCEPTION 'public.events_tenant_client_event_uidx exists but violates the W1 index contract';
  END IF;

  IF to_regclass('public.audit_log_tenant_request_action_uidx') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_class AS c
      JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
      JOIN pg_catalog.pg_index AS i ON i.indexrelid = c.oid
      JOIN pg_catalog.pg_am AS am ON am.oid = c.relam
      WHERE n.nspname = 'public'
        AND c.relname = 'audit_log_tenant_request_action_uidx'
        AND c.relkind = 'i'
        AND i.indrelid = 'public.audit_log'::regclass
        AND i.indisunique
        AND i.indisvalid
        AND i.indisready
        AND i.indislive
        AND NOT i.indisprimary
        AND NOT i.indisexclusion
        AND i.indimmediate
        AND am.amname = 'btree'
        AND i.indnkeyatts = 3
        AND i.indnatts = 3
        AND i.indexprs IS NULL
        AND i.indpred IS NOT NULL
        AND ARRAY(
          SELECT a.attname::text
          FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
          JOIN pg_catalog.pg_attribute AS a
            ON a.attrelid = i.indrelid
           AND a.attnum = k.attnum
           AND NOT a.attisdropped
          ORDER BY k.ord
        ) = ARRAY['tenant_id', 'client_request_id', 'action']::text[]
        AND lower(regexp_replace(
          pg_catalog.pg_get_expr(i.indpred, i.indrelid),
          '[[:space:]()]', '', 'g'
        )) = 'tenant_idisnotnullandclient_request_idisnotnull'
    ) THEN
    RAISE EXCEPTION 'public.audit_log_tenant_request_action_uidx exists but violates the W1 index contract';
  END IF;
END
$w1_index_preflight$;

CREATE UNIQUE INDEX IF NOT EXISTS events_tenant_client_event_uidx
  ON public.events (tenant_id, client_event_id)
  WHERE tenant_id IS NOT NULL AND client_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS audit_log_tenant_request_action_uidx
  ON public.audit_log (tenant_id, client_request_id, action)
  WHERE tenant_id IS NOT NULL AND client_request_id IS NOT NULL;

DO $w1_postflight$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events'
      AND column_name = 'client_event_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_log'
      AND column_name = 'tenant_id' AND data_type = 'text' AND is_nullable = 'YES'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_log'
      AND column_name = 'client_request_id' AND data_type = 'uuid' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'W1 receipt column postflight check failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_index AS i ON i.indexrelid = c.oid
    JOIN pg_catalog.pg_am AS am ON am.oid = c.relam
    WHERE n.nspname = 'public'
      AND c.relname = 'events_tenant_client_event_uidx'
      AND c.relkind = 'i'
      AND i.indrelid = 'public.events'::regclass
      AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive
      AND NOT i.indisprimary AND NOT i.indisexclusion AND i.indimmediate
      AND am.amname = 'btree'
      AND i.indnkeyatts = 2 AND i.indnatts = 2
      AND i.indexprs IS NULL AND i.indpred IS NOT NULL
      AND ARRAY(
        SELECT a.attname::text
        FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_catalog.pg_attribute AS a
          ON a.attrelid = i.indrelid AND a.attnum = k.attnum AND NOT a.attisdropped
        ORDER BY k.ord
      ) = ARRAY['tenant_id', 'client_event_id']::text[]
      AND lower(regexp_replace(pg_catalog.pg_get_expr(i.indpred, i.indrelid), '[[:space:]()]', '', 'g')) = 'tenant_idisnotnullandclient_event_idisnotnull'
  ) THEN
    RAISE EXCEPTION 'public.events_tenant_client_event_uidx postflight contract failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_class AS c
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_index AS i ON i.indexrelid = c.oid
    JOIN pg_catalog.pg_am AS am ON am.oid = c.relam
    WHERE n.nspname = 'public'
      AND c.relname = 'audit_log_tenant_request_action_uidx'
      AND c.relkind = 'i'
      AND i.indrelid = 'public.audit_log'::regclass
      AND i.indisunique AND i.indisvalid AND i.indisready AND i.indislive
      AND NOT i.indisprimary AND NOT i.indisexclusion AND i.indimmediate
      AND am.amname = 'btree'
      AND i.indnkeyatts = 3 AND i.indnatts = 3
      AND i.indexprs IS NULL AND i.indpred IS NOT NULL
      AND ARRAY(
        SELECT a.attname::text
        FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_catalog.pg_attribute AS a
          ON a.attrelid = i.indrelid AND a.attnum = k.attnum AND NOT a.attisdropped
        ORDER BY k.ord
      ) = ARRAY['tenant_id', 'client_request_id', 'action']::text[]
      AND lower(regexp_replace(pg_catalog.pg_get_expr(i.indpred, i.indrelid), '[[:space:]()]', '', 'g')) = 'tenant_idisnotnullandclient_request_idisnotnull'
  ) THEN
    RAISE EXCEPTION 'public.audit_log_tenant_request_action_uidx postflight contract failed';
  END IF;
END
$w1_postflight$;

COMMIT;
