-- F1.3 / M3 Part A: L2 per-login last-seen state, L4 derived card
-- search documents, and S3 shared order-task assignment state. L1 is already
-- part of private.v_operational_station_queue_v1 through due_date and remains
-- the single order due-date truth.

CREATE TABLE private.user_last_seen (
  tenant_id text NOT NULL,
  user_id uuid NOT NULL,
  last_seen_at timestamptz NOT NULL,
  version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT user_last_seen_pkey PRIMARY KEY (tenant_id, user_id),
  CONSTRAINT user_last_seen_user_fkey
    FOREIGN KEY (user_id) REFERENCES public.app_users (id) ON DELETE RESTRICT,
  CONSTRAINT user_last_seen_tenant_chk
    CHECK (tenant_id = btrim(tenant_id) AND length(tenant_id) BETWEEN 1 AND 50),
  CONSTRAINT user_last_seen_version_chk CHECK (version > 0),
  CONSTRAINT user_last_seen_time_chk CHECK (updated_at >= created_at)
);

ALTER TABLE public.events
  ADD CONSTRAINT events_user_last_seen_recorded_v1_contract_chk
  CHECK (
    event_type <> 'USER_LAST_SEEN_RECORDED_V1'
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
      AND payload ? 'previousSeenAt'
      AND payload = jsonb_build_object('previousSeenAt', payload->'previousSeenAt')
      AND (
        payload->'previousSeenAt' = 'null'::jsonb
        OR jsonb_typeof(payload->'previousSeenAt') = 'string'
      )
    ), false)
  ) NOT VALID;

CREATE UNIQUE INDEX events_user_last_seen_version_uidx
  ON public.events (tenant_id, user_id, aggregate_version)
  WHERE event_type = 'USER_LAST_SEEN_RECORDED_V1';

CREATE UNIQUE INDEX events_user_last_seen_correlation_uidx
  ON public.events (tenant_id, correlation_id)
  WHERE event_type = 'USER_LAST_SEEN_RECORDED_V1';

CREATE TRIGGER events_user_last_seen_recorded_v1_update_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (
    OLD.event_type = 'USER_LAST_SEEN_RECORDED_V1'
    OR NEW.event_type = 'USER_LAST_SEEN_RECORDED_V1'
  )
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_user_last_seen_recorded_v1_delete_immutable
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'USER_LAST_SEEN_RECORDED_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE VIEW private.v_user_last_seen_v1
WITH (security_invoker = true)
AS
SELECT
  state.tenant_id,
  state.user_id,
  state.last_seen_at,
  state.version,
  state.updated_at,
  (
    actor.id IS NOT NULL
    AND actor.tenant_id = state.tenant_id
    AND actor.active = true
  ) AS integrity_ok
FROM private.user_last_seen state
LEFT JOIN public.app_users actor
  ON actor.id = state.user_id
 AND actor.tenant_id = state.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND state.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_user_last_seen_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  event.id AS event_id,
  event.tenant_id,
  event.user_id AS actor_id,
  event.client_event_id,
  event.correlation_id,
  event.event_schema_version,
  event.aggregate_version,
  event.payload->>'previousSeenAt' AS previous_seen_at,
  event.created_at AT TIME ZONE 'UTC' AS last_seen_at,
  (
    actor.id IS NOT NULL
    AND actor.tenant_id = event.tenant_id
    AND event.order_id IS NULL
    AND event.item_id IS NULL
    AND event.from_station IS NULL
    AND event.station IS NULL
  ) AS integrity_ok
FROM public.events event
LEFT JOIN public.app_users actor
  ON actor.id = event.user_id
 AND actor.tenant_id = event.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND event.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND event.event_type = 'USER_LAST_SEEN_RECORDED_V1'
  AND event.status = 'success'
  AND event.event_schema_version = 1
  AND event.client_event_id IS NOT NULL
  AND event.correlation_id IS NOT NULL
  AND event.aggregate_version > 0;

CREATE VIEW private.v_card_search_documents_v1
WITH (security_invoker = true)
AS
WITH order_documents AS (
  SELECT
    'ORDER'::text AS document_type,
    orders.id AS record_id,
    orders.tenant_id,
    orders.order_number AS title,
    customer.name AS subtitle,
    orders.status,
    lower(concat_ws(
      ' ',
      orders.order_number,
      orders.title,
      orders.task,
      orders.status,
      orders.station,
      customer.name,
      customer.company_name,
      intake.note,
      intake_positions.position_text,
      live_positions.position_text
    )) AS search_document,
    (
      customer.id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.items corrupt_item
        WHERE corrupt_item.order_id = orders.id
          AND (
            corrupt_item.tenant_id IS DISTINCT FROM orders.tenant_id
            OR corrupt_item.customer_id IS DISTINCT FROM orders.customer_id
          )
      )
    ) AS integrity_ok
  FROM public.orders orders
  LEFT JOIN public.customers customer
    ON customer.id = orders.customer_id
   AND customer.tenant_id = orders.tenant_id
  LEFT JOIN LATERAL (
    SELECT receipt.note, receipt.items_snapshot
    FROM private.order_intake_receipts receipt
    WHERE receipt.order_id = orders.id
      AND receipt.tenant_id = orders.tenant_id
    ORDER BY receipt.created_at DESC, receipt.id
    LIMIT 1
  ) intake ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(
      concat_ws(
        ' ',
        snapshot.item->>'position',
        snapshot.item->>'name',
        snapshot.item->>'quantity',
        snapshot.item->>'material',
        snapshot.item->>'surfaceRequested'
      ),
      ' ' ORDER BY snapshot.ordinality
    ) AS position_text
    FROM jsonb_array_elements(coalesce(intake.items_snapshot, '[]'::jsonb))
      WITH ORDINALITY AS snapshot(item, ordinality)
  ) intake_positions ON true
  LEFT JOIN LATERAL (
    SELECT string_agg(
      concat_ws(
        ' ',
        item.name,
        item.quantity,
        item.material,
        item.surface_requested,
        item.internal_notes,
        array_to_string(item.repair_types, ' ')
      ),
      ' ' ORDER BY item.created_at, item.id
    ) AS position_text
    FROM public.items item
    WHERE item.order_id = orders.id
      AND item.tenant_id = orders.tenant_id
      AND item.customer_id = orders.customer_id
  ) live_positions ON true
  WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
    AND orders.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND coalesce(orders.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
    AND coalesce(orders.order_number, '') NOT ILIKE 'A-SEED-%'
    AND coalesce(orders.order_number, '') NOT ILIKE '%TEST%'
),
customer_documents AS (
  SELECT
    'CUSTOMER'::text AS document_type,
    customer.id AS record_id,
    customer.tenant_id,
    customer.name AS title,
    coalesce(customer.company_name, customer.city, customer.customer_number) AS subtitle,
    NULL::text AS status,
    lower(concat_ws(
      ' ',
      customer.customer_number,
      customer.name,
      customer.company_name,
      customer.contact_person,
      customer.city,
      customer.phone,
      customer.email,
      customer.notes,
      customer.internal_notes,
      customer.behavior_notes,
      customer_orders.order_text
    )) AS search_document,
    NOT EXISTS (
      SELECT 1
      FROM public.orders corrupt_order
      WHERE corrupt_order.customer_id = customer.id
        AND corrupt_order.tenant_id IS DISTINCT FROM customer.tenant_id
    ) AS integrity_ok
  FROM public.customers customer
  LEFT JOIN LATERAL (
    SELECT string_agg(
      concat_ws(' ', orders.order_number, orders.title, orders.task, orders.status),
      ' ' ORDER BY orders.created_at, orders.id
    ) AS order_text
    FROM public.orders orders
    WHERE orders.customer_id = customer.id
      AND orders.tenant_id = customer.tenant_id
      AND coalesce(orders.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
  ) customer_orders ON true
  WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
    AND customer.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND coalesce(customer.source, 'manual') NOT IN ('seed', 'test', 'demo', 'integration-test')
    AND coalesce(customer.name, '') NOT LIKE 'Capture%'
)
SELECT * FROM order_documents
UNION ALL
SELECT * FROM customer_documents;

COMMENT ON TABLE private.user_last_seen IS
  'F1.3 L2 tenant/user current last-seen state; every write is paired with an immutable USER_LAST_SEEN_RECORDED_V1 receipt.';

COMMENT ON VIEW private.v_user_last_seen_v1 IS
  'F1.3 L2 tenant-bound current last-seen read port.';

COMMENT ON VIEW private.v_user_last_seen_receipts_v1 IS
  'F1.3 L2 tenant-bound immutable receipt readback for last-seen writes.';

COMMENT ON VIEW private.v_card_search_documents_v1 IS
  'F1.3 L4 tenant-bound derived search documents for order positions/notes and customer card text; no independent business truth.';

-- S3: one shared assignment state for both delegator and assignee. The order
-- aggregate version remains the only optimistic version; due_date is read from
-- public.orders and is never copied into this state.
ALTER TABLE public.app_users
  ADD CONSTRAINT app_users_tenant_id_uidx UNIQUE (tenant_id, id);

CREATE TABLE private.order_task_assignment_state (
  id uuid NOT NULL,
  tenant_id text NOT NULL,
  order_id text NOT NULL,
  assigned_to uuid NOT NULL,
  assigned_by uuid NOT NULL,
  assigned_at timestamptz NOT NULL,
  active boolean NOT NULL,
  handed_back_by uuid,
  handed_back_at timestamptz,
  order_version integer NOT NULL,
  last_event_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT order_task_assignment_state_pkey PRIMARY KEY (tenant_id, order_id),
  CONSTRAINT order_task_assignment_state_tenant_id_uidx UNIQUE (tenant_id, id),
  CONSTRAINT order_task_assignment_state_event_uidx UNIQUE (last_event_id),
  CONSTRAINT order_task_assignment_state_order_fkey
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_task_assignment_state_assigned_to_fkey
    FOREIGN KEY (tenant_id, assigned_to)
    REFERENCES public.app_users (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_task_assignment_state_assigned_by_fkey
    FOREIGN KEY (tenant_id, assigned_by)
    REFERENCES public.app_users (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_task_assignment_state_handed_back_by_fkey
    FOREIGN KEY (tenant_id, handed_back_by)
    REFERENCES public.app_users (tenant_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT order_task_assignment_state_event_fkey
    FOREIGN KEY (last_event_id)
    REFERENCES public.events (id)
    ON DELETE RESTRICT,
  CONSTRAINT order_task_assignment_state_tenant_chk
    CHECK (tenant_id = btrim(tenant_id) AND length(tenant_id) BETWEEN 1 AND 50),
  CONSTRAINT order_task_assignment_state_version_chk CHECK (order_version > 0),
  CONSTRAINT order_task_assignment_state_time_chk CHECK (
    assigned_at >= created_at
    AND updated_at >= assigned_at
    AND (
      (active = true AND handed_back_by IS NULL AND handed_back_at IS NULL)
      OR (
        active = false
        AND handed_back_by IS NOT NULL
        AND handed_back_at IS NOT NULL
        AND handed_back_at >= assigned_at
        AND updated_at >= handed_back_at
      )
    )
  )
);

CREATE TRIGGER order_task_assignment_state_delete_guard
  BEFORE DELETE ON private.order_task_assignment_state
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_task_assignment_state_truncate_guard
  BEFORE TRUNCATE ON private.order_task_assignment_state
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

ALTER TABLE public.events
  ADD CONSTRAINT events_order_task_assigned_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_TASK_ASSIGNED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version > 0
      AND from_station IS NOT NULL
      AND station = from_station
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'assignmentStateId', payload->'assignmentStateId',
        'assignedTo', payload->'assignedTo'
      )
      AND coalesce(payload->>'assignmentStateId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(payload->>'assignedTo', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ), false)
  ) NOT VALID;

ALTER TABLE public.events
  ADD CONSTRAINT events_order_task_handed_back_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_TASK_HANDED_BACK_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version > 0
      AND from_station IS NOT NULL
      AND station = from_station
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload = jsonb_build_object(
        'assignmentStateId', payload->'assignmentStateId',
        'assignedTo', payload->'assignedTo'
      )
      AND coalesce(payload->>'assignmentStateId', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND coalesce(payload->>'assignedTo', '') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ), false)
  ) NOT VALID;

CREATE TRIGGER events_order_task_assignment_update_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (
    OLD.event_type IN ('ORDER_TASK_ASSIGNED_V1', 'ORDER_TASK_HANDED_BACK_V1')
    OR NEW.event_type IN ('ORDER_TASK_ASSIGNED_V1', 'ORDER_TASK_HANDED_BACK_V1')
  )
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_order_task_assignment_delete_immutable
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type IN ('ORDER_TASK_ASSIGNED_V1', 'ORDER_TASK_HANDED_BACK_V1'))
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE VIEW private.v_order_task_assignment_receipts_v1
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
  event.from_station,
  event.station,
  event.user_id AS actor_id,
  event.created_at AT TIME ZONE 'UTC' AS occurred_at,
  (event.payload->>'assignmentStateId')::uuid AS assignment_state_id,
  (event.payload->>'assignedTo')::uuid AS assigned_to,
  (
    orders.id IS NOT NULL
    AND orders.version >= event.aggregate_version
    AND actor.id IS NOT NULL
    AND actor.tenant_id = event.tenant_id
    AND assignee.id IS NOT NULL
    AND assignee.tenant_id = event.tenant_id
    AND event.from_station = event.station
  ) AS integrity_ok
FROM public.events event
LEFT JOIN public.orders orders
  ON orders.id = event.order_id
 AND orders.tenant_id = event.tenant_id
LEFT JOIN public.app_users actor
  ON actor.id = event.user_id
 AND actor.tenant_id = event.tenant_id
LEFT JOIN public.app_users assignee
  ON assignee.id = (event.payload->>'assignedTo')::uuid
 AND assignee.tenant_id = event.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND event.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND event.event_type IN ('ORDER_TASK_ASSIGNED_V1', 'ORDER_TASK_HANDED_BACK_V1')
  AND event.status = 'success'
  AND event.event_schema_version = 1;

CREATE VIEW private.v_order_task_assignment_v1
WITH (security_invoker = true)
AS
SELECT
  state.id,
  state.tenant_id,
  state.order_id,
  state.assigned_to,
  assignee.full_name AS assigned_to_name,
  assignee.active AS assigned_to_active,
  state.assigned_by,
  assigner.full_name AS assigned_by_name,
  state.assigned_at,
  state.active,
  state.handed_back_by,
  handback_actor.full_name AS handed_back_by_name,
  state.handed_back_at,
  state.order_version,
  state.last_event_id,
  orders.version AS current_order_version,
  orders.due_date,
  orders.station,
  orders.status,
  (
    orders.id IS NOT NULL
    AND orders.version >= state.order_version
    AND assignee.id IS NOT NULL
    AND assignee.tenant_id = state.tenant_id
    AND assigner.id IS NOT NULL
    AND assigner.tenant_id = state.tenant_id
    AND (
      (state.active = true AND handback_actor.id IS NULL)
      OR (
        state.active = false
        AND handback_actor.id IS NOT NULL
        AND handback_actor.tenant_id = state.tenant_id
      )
    )
    AND last_event.id = state.last_event_id
    AND last_event.tenant_id = state.tenant_id
    AND last_event.order_id = state.order_id
    AND last_event.aggregate_version = state.order_version
    AND last_event.payload->>'assignmentStateId' = state.id::text
    AND last_event.payload->>'assignedTo' = state.assigned_to::text
    AND (
      (state.active = true
       AND last_event.event_type = 'ORDER_TASK_ASSIGNED_V1'
       AND last_event.user_id = state.assigned_by)
      OR
      (state.active = false
       AND last_event.event_type = 'ORDER_TASK_HANDED_BACK_V1'
       AND last_event.user_id = state.handed_back_by)
    )
  ) AS integrity_ok
FROM private.order_task_assignment_state state
LEFT JOIN public.orders orders
  ON orders.id = state.order_id
 AND orders.tenant_id = state.tenant_id
LEFT JOIN public.app_users assignee
  ON assignee.id = state.assigned_to
 AND assignee.tenant_id = state.tenant_id
LEFT JOIN public.app_users assigner
  ON assigner.id = state.assigned_by
 AND assigner.tenant_id = state.tenant_id
LEFT JOIN public.app_users handback_actor
  ON handback_actor.id = state.handed_back_by
 AND handback_actor.tenant_id = state.tenant_id
LEFT JOIN public.events last_event
  ON last_event.id = state.last_event_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND state.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

CREATE VIEW private.v_order_task_assignee_options_v1
WITH (security_invoker = true)
AS
SELECT
  actor.tenant_id,
  actor.id AS user_id,
  actor.full_name,
  actor.role,
  actor.active,
  (
    actor.full_name = btrim(actor.full_name)
    AND length(actor.full_name) BETWEEN 1 AND 160
    AND actor.role IN ('buero', 'werkstatt', 'meister', 'admin')
  ) AS integrity_ok
FROM public.app_users actor
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND actor.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND actor.active = true
  AND actor.role IN ('buero', 'werkstatt', 'meister', 'admin');

COMMENT ON TABLE private.order_task_assignment_state IS
  'F1.3 S3 one current tenant/order assignment state; orders.version is the only optimistic version and rows are never deleted.';
COMMENT ON VIEW private.v_order_task_assignment_receipts_v1 IS
  'F1.3 S3 tenant-bound immutable assignment and handback receipt readback independent of later current-state changes.';
COMMENT ON VIEW private.v_order_task_assignment_v1 IS
  'F1.3 S3 shared tenant-bound assignment state for delegator and assignee; due_date is read directly from orders.';
COMMENT ON VIEW private.v_order_task_assignee_options_v1 IS
  'F1.3 S3 tenant-bound active assignment targets; readonly and developer are fail-closed.';
