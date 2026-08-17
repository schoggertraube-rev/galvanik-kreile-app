-- F1.1: tenant-bound digital order intake with immutable write receipts,
-- a private customer/readback contract, and an additive intake-original
-- workflow on the existing W4 Evidence and Storage boundary.

CREATE TABLE private.order_intake_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_id text NOT NULL,
  tenant_id text NOT NULL,
  order_id text NOT NULL,
  customer_id text NOT NULL,
  actor_id uuid NOT NULL,
  client_event_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  intent_sha256 text NOT NULL,
  customer_mode text NOT NULL,
  order_number text NOT NULL,
  customer_display_name text NOT NULL,
  due_date date,
  note text,
  items_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT order_intake_receipts_pkey PRIMARY KEY (id),
  CONSTRAINT order_intake_receipts_event_key UNIQUE (event_id),
  CONSTRAINT order_intake_receipts_actor_request_key
    UNIQUE (tenant_id, actor_id, client_event_id),
  CONSTRAINT order_intake_receipts_event_fkey
    FOREIGN KEY (event_id) REFERENCES public.events (id) ON DELETE RESTRICT,
  CONSTRAINT order_intake_receipts_order_fkey
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT order_intake_receipts_customer_fkey
    FOREIGN KEY (customer_id) REFERENCES public.customers (id) ON DELETE RESTRICT,
  CONSTRAINT order_intake_receipts_actor_fkey
    FOREIGN KEY (actor_id) REFERENCES public.app_users (id) ON DELETE RESTRICT,
  CONSTRAINT order_intake_receipts_intent_chk
    CHECK (intent_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT order_intake_receipts_customer_mode_chk
    CHECK (customer_mode IN ('EXISTING', 'NEW')),
  CONSTRAINT order_intake_receipts_order_number_chk
    CHECK (order_number ~ '^A-[0-9]{4}-[0-9]{4,}$'),
  CONSTRAINT order_intake_receipts_customer_display_chk
    CHECK (
      customer_display_name = btrim(customer_display_name)
      AND length(customer_display_name) BETWEEN 2 AND 160
    ),
  CONSTRAINT order_intake_receipts_note_chk
    CHECK (note IS NULL OR (note = btrim(note) AND length(note) BETWEEN 1 AND 2000)),
  CONSTRAINT order_intake_receipts_items_chk
    CHECK (
      jsonb_typeof(items_snapshot) = 'array'
      AND jsonb_array_length(items_snapshot) BETWEEN 1 AND 20
    )
);

ALTER TABLE public.events
  ADD CONSTRAINT events_order_intake_created_v1_contract_chk
  CHECK (
    event_type <> 'ORDER_INTAKE_CREATED_V1'
    OR coalesce((
      tenant_id IS NOT NULL
      AND order_id IS NOT NULL
      AND item_id IS NULL
      AND user_id IS NOT NULL
      AND client_event_id IS NOT NULL
      AND event_schema_version = 1
      AND correlation_id IS NOT NULL
      AND aggregate_version = 1
      AND from_station IS NULL
      AND station = 'wareneingang'
      AND status = 'success'
      AND jsonb_typeof(payload) = 'object'
      AND payload->>'intentSha256' ~ '^[0-9a-f]{64}$'
      AND payload = jsonb_build_object('intentSha256', payload->>'intentSha256')
    ), false)
  ) NOT VALID;

CREATE UNIQUE INDEX events_order_intake_order_uidx
  ON public.events (tenant_id, order_id)
  WHERE event_type = 'ORDER_INTAKE_CREATED_V1';

CREATE UNIQUE INDEX events_order_intake_correlation_uidx
  ON public.events (tenant_id, correlation_id)
  WHERE event_type = 'ORDER_INTAKE_CREATED_V1';

CREATE TRIGGER events_order_intake_created_v1_update_immutable
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  WHEN (
    OLD.event_type = 'ORDER_INTAKE_CREATED_V1'
    OR NEW.event_type = 'ORDER_INTAKE_CREATED_V1'
  )
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER events_order_intake_created_v1_delete_immutable
  BEFORE DELETE ON public.events
  FOR EACH ROW
  WHEN (OLD.event_type = 'ORDER_INTAKE_CREATED_V1')
  EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_intake_receipts_update_immutable
  BEFORE UPDATE ON private.order_intake_receipts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_intake_receipts_delete_immutable
  BEFORE DELETE ON private.order_intake_receipts
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_intake_receipts_truncate_immutable
  BEFORE TRUNCATE ON private.order_intake_receipts
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE VIEW private.v_order_intake_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  receipt.id AS receipt_id,
  receipt.event_id,
  receipt.tenant_id,
  receipt.order_id,
  receipt.customer_id,
  receipt.actor_id,
  actor.full_name AS actor_display_name,
  receipt.client_event_id,
  receipt.correlation_id,
  receipt.intent_sha256,
  receipt.customer_mode,
  receipt.order_number,
  receipt.customer_display_name,
  receipt.due_date,
  receipt.note,
  receipt.items_snapshot,
  receipt.created_at AS recorded_at,
  orders.version AS current_order_version,
  orders.station AS current_station,
  orders.status AS current_status,
  validity.integrity_ok
FROM private.order_intake_receipts receipt
LEFT JOIN public.events event
  ON event.id = receipt.event_id
 AND event.tenant_id = receipt.tenant_id
LEFT JOIN public.orders orders
  ON orders.id = receipt.order_id
 AND orders.tenant_id = receipt.tenant_id
LEFT JOIN public.customers customer
  ON customer.id = receipt.customer_id
 AND customer.tenant_id = receipt.tenant_id
LEFT JOIN public.app_users actor
  ON actor.id = receipt.actor_id
 AND actor.tenant_id = receipt.tenant_id
CROSS JOIN LATERAL (
  SELECT (
    event.id IS NOT NULL
    AND orders.id IS NOT NULL
    AND customer.id IS NOT NULL
    AND actor.id IS NOT NULL
    AND event.order_id = receipt.order_id
    AND event.item_id IS NULL
    AND event.user_id = receipt.actor_id
    AND event.client_event_id = receipt.client_event_id
    AND event.correlation_id = receipt.correlation_id
    AND event.event_type = 'ORDER_INTAKE_CREATED_V1'
    AND event.event_schema_version = 1
    AND event.aggregate_version = 1
    AND event.from_station IS NULL
    AND event.station = 'wareneingang'
    AND event.status = 'success'
    AND event.payload = jsonb_build_object('intentSha256', receipt.intent_sha256)
    AND receipt.created_at >= event.created_at AT TIME ZONE 'UTC'
    AND orders.customer_id = receipt.customer_id
    AND orders.order_number = receipt.order_number
    AND orders.version >= 1
    AND jsonb_typeof(receipt.items_snapshot) = 'array'
    AND jsonb_array_length(receipt.items_snapshot) BETWEEN 1 AND 20
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(receipt.items_snapshot) snapshot(item)
      WHERE jsonb_typeof(snapshot.item) <> 'object'
         OR (SELECT count(*) FROM jsonb_object_keys(snapshot.item)) <> 6
         OR NOT snapshot.item ?& ARRAY[
           'id', 'position', 'name', 'quantity', 'material', 'surfaceRequested'
         ]
         OR coalesce(snapshot.item->>'id', '') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
         OR CASE
              WHEN coalesce(snapshot.item->>'position', '') ~ '^[1-9][0-9]?$'
                THEN (snapshot.item->>'position')::integer NOT BETWEEN 1 AND 20
              ELSE true
            END
         OR snapshot.item->>'name' IS DISTINCT FROM btrim(snapshot.item->>'name')
         OR length(snapshot.item->>'name') NOT BETWEEN 2 AND 160
         OR CASE
              WHEN coalesce(snapshot.item->>'quantity', '') ~ '^[1-9][0-9]{0,6}$'
                THEN (snapshot.item->>'quantity')::integer NOT BETWEEN 1 AND 1000000
              ELSE true
            END
         OR NOT (
           snapshot.item->'material' = 'null'::jsonb
           OR (
             jsonb_typeof(snapshot.item->'material') = 'string'
             AND snapshot.item->>'material' = btrim(snapshot.item->>'material')
             AND length(snapshot.item->>'material') BETWEEN 1 AND 120
           )
         )
         OR snapshot.item->>'surfaceRequested' IS DISTINCT FROM btrim(snapshot.item->>'surfaceRequested')
         OR length(snapshot.item->>'surfaceRequested') NOT BETWEEN 2 AND 160
    )
    AND (
      SELECT count(DISTINCT snapshot.item->>'position')
      FROM jsonb_array_elements(receipt.items_snapshot) snapshot(item)
    ) = jsonb_array_length(receipt.items_snapshot)
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(receipt.items_snapshot) snapshot(item)
      LEFT JOIN public.items item
        ON item.id = snapshot.item->>'id'
       AND item.order_id = receipt.order_id
       AND item.tenant_id = receipt.tenant_id
       AND item.customer_id = receipt.customer_id
      WHERE item.id IS NULL
         OR item.name IS DISTINCT FROM snapshot.item->>'name'
         OR item.quantity IS DISTINCT FROM CASE
              WHEN coalesce(snapshot.item->>'quantity', '') ~ '^[1-9][0-9]{0,6}$'
                THEN (snapshot.item->>'quantity')::integer
              ELSE NULL
            END
         OR item.material IS DISTINCT FROM nullif(snapshot.item->>'material', '')
         OR item.surface_requested IS DISTINCT FROM snapshot.item->>'surfaceRequested'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.items item
      WHERE item.order_id = receipt.order_id
        AND (
          item.tenant_id IS DISTINCT FROM receipt.tenant_id
          OR item.customer_id IS DISTINCT FROM receipt.customer_id
          OR NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(receipt.items_snapshot) snapshot(item_snapshot)
            WHERE snapshot.item_snapshot->>'id' = item.id
          )
        )
    )
  ) AS integrity_ok
) validity
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND receipt.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_order_intake_receipts_v1 IS
  'F1.1 immutable order-intake write receipt and exact tenant-bound readback.';

CREATE VIEW private.v_order_intake_customers_v1
WITH (security_invoker = true)
AS
SELECT
  customer.id,
  customer.tenant_id,
  customer.customer_number,
  customer.name,
  customer.company_name,
  customer.type AS customer_type,
  customer.city,
  count(orders.id)::integer AS orders_count,
  lower(concat_ws(' ', customer.name, customer.company_name, customer.customer_number, customer.city)) AS search_text,
  (
    customer.id = btrim(customer.id)
    AND length(customer.id) BETWEEN 1 AND 128
    AND customer.name = btrim(customer.name)
    AND length(customer.name) BETWEEN 2 AND 160
    AND NOT EXISTS (
      SELECT 1
      FROM public.orders corrupt_order
      WHERE corrupt_order.customer_id = customer.id
        AND corrupt_order.tenant_id IS DISTINCT FROM customer.tenant_id
    )
  ) AS integrity_ok
FROM public.customers customer
LEFT JOIN public.orders orders
  ON orders.customer_id = customer.id
 AND orders.tenant_id = customer.tenant_id
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND customer.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
GROUP BY customer.id, customer.tenant_id, customer.customer_number,
  customer.name, customer.company_name, customer.type, customer.city;

COMMENT ON VIEW private.v_order_intake_customers_v1 IS
  'F1.1 minimal tenant-bound customer selection contract.';

ALTER TABLE private.order_station_evidence_reservations
  DROP CONSTRAINT order_station_evidence_reservations_domain_chk,
  DROP CONSTRAINT order_station_evidence_reservations_path_chk;

ALTER TABLE private.order_station_evidence_reservations
  ADD CONSTRAINT order_station_evidence_reservations_domain_chk
    CHECK (
      bucket_id = 'item-photos'
      AND transition_event_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      AND (
        (purpose = 'GALVANIK_HANDOFF_ORIGINAL_V1' AND station = 'galvanik')
        OR (purpose = 'ORDER_INTAKE_ORIGINAL_V1' AND station = 'wareneingang')
      )
    ),
  ADD CONSTRAINT order_station_evidence_reservations_path_chk
    CHECK (
      object_path = CASE purpose
        WHEN 'GALVANIK_HANDOFF_ORIGINAL_V1' THEN 'order-station-evidence/v1/'
        WHEN 'ORDER_INTAKE_ORIGINAL_V1' THEN 'order-intake-evidence/v1/'
        ELSE ''
      END || id::text ||
        CASE mime_type
          WHEN 'image/jpeg' THEN '.jpg'
          WHEN 'image/png' THEN '.png'
          WHEN 'image/webp' THEN '.webp'
          ELSE ''
        END
    );

CREATE VIEW private.v_order_intake_evidence_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  reservation.id AS reservation_id,
  evidence.id AS receipt_id,
  reservation.tenant_id,
  reservation.customer_id,
  reservation.order_id,
  reservation.item_id,
  reservation.transition_event_id,
  reservation.order_version,
  reservation.actor_id,
  reservation_actor.full_name AS actor_display_name,
  reservation.client_request_id,
  reservation.purpose,
  reservation.station,
  reservation.mime_type,
  reservation.file_bytes,
  reservation.content_sha256,
  reservation.upload_expires_at,
  reservation.created_at AS reserved_at,
  evidence.storage_object_id,
  evidence.storage_object_version,
  evidence.storage_created_at,
  evidence.verified_at,
  CASE
    WHEN validity.integrity_ok IS NOT TRUE THEN 'INVALID'
    WHEN evidence.id IS NULL THEN 'PENDING'
    ELSE 'FINALIZED'
  END AS receipt_state,
  validity.integrity_ok,
  extraction.extraction_state,
  extraction.provider AS extraction_provider,
  extraction.detected_type,
  extraction.detection_confidence,
  extraction.extracted_data,
  extraction.field_confidence,
  extraction.created_at AS extraction_created_at,
  links.target_links
FROM private.order_station_evidence_reservations reservation
LEFT JOIN public.orders orders
  ON orders.id = reservation.order_id
 AND orders.tenant_id = reservation.tenant_id
LEFT JOIN public.customers customers
  ON customers.id = reservation.customer_id
 AND customers.tenant_id = reservation.tenant_id
LEFT JOIN public.items items
  ON items.id = reservation.item_id
 AND items.order_id = reservation.order_id
 AND items.tenant_id = reservation.tenant_id
LEFT JOIN public.app_users reservation_actor
  ON reservation_actor.id = reservation.actor_id
 AND reservation_actor.tenant_id = reservation.tenant_id
LEFT JOIN public.events intake_event
  ON intake_event.id = reservation.transition_event_id
 AND intake_event.tenant_id = reservation.tenant_id
LEFT JOIN public.app_users intake_actor
  ON intake_actor.id = intake_event.user_id
 AND intake_actor.tenant_id = reservation.tenant_id
LEFT JOIN private.order_station_evidence evidence
  ON evidence.reservation_id = reservation.id
LEFT JOIN private.evidence_extraction_metadata extraction
  ON extraction.evidence_id = evidence.id
 AND extraction.tenant_id = reservation.tenant_id
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS link_count,
    count(*) FILTER (
      WHERE link.target_type = 'ORDER' AND link.target_id = reservation.order_id
    )::integer AS order_link_count,
    count(*) FILTER (
      WHERE link.target_type = 'ORDER_ITEM' AND link.target_id = reservation.item_id
    )::integer AS item_link_count,
    bool_and(
      link.tenant_id = reservation.tenant_id
      AND link.evidence_id = evidence.id
      AND link.created_at >= evidence.verified_at
    ) AS bindings_ok,
    COALESCE(
      jsonb_agg(
        jsonb_build_object('targetType', link.target_type, 'targetId', link.target_id)
        ORDER BY link.target_type, link.target_id
      ),
      '[]'::jsonb
    ) AS target_links
  FROM private.evidence_domain_links link
  WHERE link.evidence_id = evidence.id
) links ON true
CROSS JOIN LATERAL (
  SELECT (
    reservation.purpose = 'ORDER_INTAKE_ORIGINAL_V1'
    AND reservation.station = 'wareneingang'
    AND reservation.bucket_id = 'item-photos'
    AND reservation.object_path = 'order-intake-evidence/v1/' || reservation.id::text ||
      CASE reservation.mime_type
        WHEN 'image/jpeg' THEN '.jpg'
        WHEN 'image/png' THEN '.png'
        WHEN 'image/webp' THEN '.webp'
        ELSE ''
      END
    AND orders.id IS NOT NULL
    AND customers.id IS NOT NULL
    AND items.id IS NOT NULL
    AND reservation_actor.id IS NOT NULL
    AND intake_event.id IS NOT NULL
    AND intake_actor.id IS NOT NULL
    AND orders.customer_id = reservation.customer_id
    AND items.customer_id = reservation.customer_id
    AND reservation.order_version = 1
    AND intake_event.order_id = reservation.order_id
    AND intake_event.item_id IS NULL
    AND intake_event.event_type = 'ORDER_INTAKE_CREATED_V1'
    AND intake_event.client_event_id IS NOT NULL
    AND intake_event.correlation_id IS NOT NULL
    AND intake_event.event_schema_version = 1
    AND intake_event.aggregate_version = 1
    AND intake_event.from_station IS NULL
    AND intake_event.station = 'wareneingang'
    AND intake_event.status = 'success'
    AND NOT EXISTS (
      SELECT 1 FROM public.items corrupt_item
      WHERE corrupt_item.order_id = reservation.order_id
        AND (
          corrupt_item.tenant_id IS DISTINCT FROM reservation.tenant_id
          OR corrupt_item.customer_id IS DISTINCT FROM reservation.customer_id
        )
    )
    AND (
      evidence.id IS NULL
      OR (
        evidence.tenant_id = reservation.tenant_id
        AND evidence.actor_id = reservation.actor_id
        AND evidence.verified_mime_type = reservation.mime_type
        AND evidence.verified_file_bytes = reservation.file_bytes
        AND evidence.verified_content_sha256 = reservation.content_sha256
        AND evidence.storage_object_id IS NOT NULL
        AND nullif(btrim(evidence.storage_object_version), '') IS NOT NULL
        AND evidence.storage_created_at >= reservation.created_at
        AND evidence.storage_created_at <= reservation.upload_expires_at
        AND evidence.storage_created_at <= evidence.verified_at
      )
    )
    AND (
      (evidence.id IS NULL AND extraction.id IS NULL AND links.link_count = 0)
      OR (
        evidence.id IS NOT NULL
        AND extraction.id IS NOT NULL
        AND extraction.evidence_id = evidence.id
        AND extraction.tenant_id = reservation.tenant_id
        AND extraction.extraction_state = 'NOT_REQUESTED'
        AND extraction.provider IS NULL
        AND extraction.detected_type IS NULL
        AND extraction.detection_confidence IS NULL
        AND extraction.extracted_data IS NULL
        AND extraction.field_confidence = '{}'::jsonb
        AND extraction.created_at >= evidence.verified_at
        AND links.link_count = 2
        AND links.order_link_count = 1
        AND links.item_link_count = 1
        AND links.bindings_ok IS TRUE
      )
    )
  ) AS integrity_ok
) validity
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND reservation.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
  AND reservation.purpose = 'ORDER_INTAKE_ORIGINAL_V1';

COMMENT ON VIEW private.v_order_intake_evidence_receipts_v1 IS
  'F1.1 tenant-bound intake-original reservations and finalized Evidence receipts.';

CREATE VIEW private.v_order_evidence_attachment_receipts_v1
WITH (security_invoker = true)
AS
SELECT * FROM private.v_order_station_evidence_receipts_v2
WHERE purpose = 'GALVANIK_HANDOFF_ORIGINAL_V1'
UNION ALL
SELECT * FROM private.v_order_intake_evidence_receipts_v1;

COMMENT ON VIEW private.v_order_evidence_attachment_receipts_v1 IS
  'Shared read contract for the existing Galvanik handoff and F1 intake-original workflows.';

CREATE VIEW private.v_evidence_records_v2
WITH (security_invoker = true)
AS
SELECT * FROM private.v_evidence_records_v1
WHERE NOT (
  source_kind = 'ORDER_STATION_ATTACHMENT'
  AND source_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM private.v_order_intake_evidence_receipts_v1 intake
    WHERE intake.receipt_id::text = source_id
  )
)
UNION ALL
SELECT
  'order-intake-attachment:' || receipt.receipt_id::text AS evidence_key,
  'ORDER_INTAKE_ATTACHMENT'::text AS source_kind,
  receipt.receipt_id::text AS source_id,
  receipt.tenant_id,
  'VERIFIED'::text AS original_state,
  'item-photos'::text AS original_bucket_id,
  'order-intake-evidence/v1/' || receipt.reservation_id::text ||
    CASE receipt.mime_type
      WHEN 'image/jpeg' THEN '.jpg'
      WHEN 'image/png' THEN '.png'
      WHEN 'image/webp' THEN '.webp'
    END AS original_storage_path,
  receipt.content_sha256 AS original_hash,
  'SHA256'::text AS original_hash_algorithm,
  receipt.file_bytes AS original_size_bytes,
  receipt.storage_created_at AS original_secured_at,
  receipt.mime_type AS original_mime_type,
  receipt.extraction_state,
  receipt.extraction_provider,
  receipt.detected_type,
  receipt.detection_confidence,
  receipt.extracted_data,
  receipt.field_confidence,
  receipt.target_links,
  receipt.verified_at AS recorded_at,
  receipt.integrity_ok IS TRUE
    AND receipt.receipt_state = 'FINALIZED'
    AND receipt.receipt_id IS NOT NULL AS integrity_ok
FROM private.v_order_intake_evidence_receipts_v1 receipt
WHERE receipt.receipt_id IS NOT NULL;

COMMENT ON VIEW private.v_evidence_records_v2 IS
  'F1 shared Evidence read port: W4 records plus verified intake originals.';
