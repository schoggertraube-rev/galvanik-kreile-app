-- W4-03: immutable, tenant-bound evidence reservations and finalized receipts
-- for the private Galvanik handoff-original workflow. No Data API, RLS, ACL,
-- policy, RPC, function, or bucket surface is added by this migration.

CREATE TABLE private.order_station_evidence_reservations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  customer_id text NOT NULL,
  order_id text NOT NULL,
  item_id text NOT NULL,
  transition_event_id text NOT NULL,
  order_version integer NOT NULL,
  actor_id uuid NOT NULL,
  client_request_id uuid NOT NULL,
  purpose text NOT NULL,
  station text NOT NULL,
  bucket_id text NOT NULL,
  object_path text NOT NULL,
  mime_type text NOT NULL,
  file_bytes bigint NOT NULL,
  content_sha256 text NOT NULL,
  upload_expires_at timestamptz NOT NULL DEFAULT (statement_timestamp() + interval '2 hours'),
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT order_station_evidence_reservations_pkey PRIMARY KEY (id),
  CONSTRAINT order_station_evidence_reservations_actor_request_key
    UNIQUE (tenant_id, actor_id, client_request_id),
  CONSTRAINT order_station_evidence_reservations_bucket_path_key
    UNIQUE (bucket_id, object_path),
  CONSTRAINT order_station_evidence_reservations_binding_key
    UNIQUE (id, tenant_id, actor_id),
  CONSTRAINT order_station_evidence_reservations_order_fkey
    FOREIGN KEY (tenant_id, order_id)
    REFERENCES public.orders (tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT order_station_evidence_reservations_item_fkey
    FOREIGN KEY (tenant_id, order_id, item_id)
    REFERENCES public.items (tenant_id, order_id, id) ON DELETE RESTRICT,
  CONSTRAINT order_station_evidence_reservations_customer_fkey
    FOREIGN KEY (customer_id)
    REFERENCES public.customers (id) ON DELETE RESTRICT,
  CONSTRAINT order_station_evidence_reservations_actor_fkey
    FOREIGN KEY (actor_id)
    REFERENCES public.app_users (id) ON DELETE RESTRICT,
  CONSTRAINT order_station_evidence_reservations_transition_event_fkey
    FOREIGN KEY (transition_event_id)
    REFERENCES public.events (id) ON DELETE RESTRICT,
  CONSTRAINT order_station_evidence_reservations_order_version_chk
    CHECK (order_version > 0),
  CONSTRAINT order_station_evidence_reservations_domain_chk
    CHECK (
      purpose = 'GALVANIK_HANDOFF_ORIGINAL_V1'
      AND station = 'galvanik'
      AND bucket_id = 'item-photos'
      AND transition_event_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
  CONSTRAINT order_station_evidence_reservations_path_chk
    CHECK (
      object_path = 'order-station-evidence/v1/' || id::text ||
        CASE mime_type
          WHEN 'image/jpeg' THEN '.jpg'
          WHEN 'image/png' THEN '.png'
          WHEN 'image/webp' THEN '.webp'
          ELSE ''
        END
    ),
  CONSTRAINT order_station_evidence_reservations_mime_chk
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT order_station_evidence_reservations_bytes_chk
    CHECK (file_bytes BETWEEN 1 AND 12582912),
  CONSTRAINT order_station_evidence_reservations_sha256_chk
    CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT order_station_evidence_reservations_expiry_chk
    CHECK (upload_expires_at = created_at + interval '2 hours')
);

CREATE TABLE private.order_station_evidence (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL,
  tenant_id text NOT NULL,
  actor_id uuid NOT NULL,
  storage_object_id uuid NOT NULL,
  storage_object_version text NOT NULL,
  verified_mime_type text NOT NULL,
  verified_file_bytes bigint NOT NULL,
  verified_content_sha256 text NOT NULL,
  storage_created_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT order_station_evidence_pkey PRIMARY KEY (id),
  CONSTRAINT order_station_evidence_reservation_key UNIQUE (reservation_id),
  CONSTRAINT order_station_evidence_storage_object_key UNIQUE (storage_object_id),
  CONSTRAINT order_station_evidence_reservation_fkey
    FOREIGN KEY (reservation_id, tenant_id, actor_id)
    REFERENCES private.order_station_evidence_reservations (id, tenant_id, actor_id)
    ON DELETE RESTRICT,
  CONSTRAINT order_station_evidence_actor_fkey
    FOREIGN KEY (actor_id)
    REFERENCES public.app_users (id) ON DELETE RESTRICT,
  CONSTRAINT order_station_evidence_storage_version_chk
    CHECK (nullif(btrim(storage_object_version), '') IS NOT NULL),
  CONSTRAINT order_station_evidence_mime_chk
    CHECK (verified_mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT order_station_evidence_bytes_chk
    CHECK (verified_file_bytes BETWEEN 1 AND 12582912),
  CONSTRAINT order_station_evidence_sha256_chk
    CHECK (verified_content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT order_station_evidence_time_chk
    CHECK (storage_created_at <= verified_at)
);

CREATE TRIGGER order_station_evidence_reservations_update_immutable
  BEFORE UPDATE ON private.order_station_evidence_reservations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_station_evidence_reservations_delete_immutable
  BEFORE DELETE ON private.order_station_evidence_reservations
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_station_evidence_reservations_truncate_immutable
  BEFORE TRUNCATE ON private.order_station_evidence_reservations
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_station_evidence_update_immutable
  BEFORE UPDATE ON private.order_station_evidence
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_station_evidence_delete_immutable
  BEFORE DELETE ON private.order_station_evidence
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER order_station_evidence_truncate_immutable
  BEFORE TRUNCATE ON private.order_station_evidence
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE VIEW private.v_order_station_evidence_receipts_v1
WITH (security_invoker = true)
AS
SELECT
  r.id AS reservation_id,
  evidence.id AS receipt_id,
  r.tenant_id,
  r.customer_id,
  r.order_id,
  r.item_id,
  r.transition_event_id,
  r.order_version,
  r.actor_id,
  reservation_actor.full_name AS actor_display_name,
  r.client_request_id,
  r.purpose,
  r.station,
  r.mime_type,
  r.file_bytes,
  r.content_sha256,
  r.upload_expires_at,
  r.created_at AS reserved_at,
  evidence.storage_object_id,
  evidence.storage_object_version,
  evidence.storage_created_at,
  evidence.verified_at,
  CASE
    WHEN validity.integrity_ok IS NOT TRUE THEN 'INVALID'
    WHEN evidence.id IS NULL THEN 'PENDING'
    ELSE 'FINALIZED'
  END AS receipt_state,
  validity.integrity_ok
FROM private.order_station_evidence_reservations r
LEFT JOIN public.orders orders
  ON orders.id = r.order_id
 AND orders.tenant_id = r.tenant_id
LEFT JOIN public.customers customers
  ON customers.id = r.customer_id
 AND customers.tenant_id = r.tenant_id
LEFT JOIN public.items items
  ON items.id = r.item_id
 AND items.order_id = r.order_id
 AND items.tenant_id = r.tenant_id
LEFT JOIN public.app_users reservation_actor
  ON reservation_actor.id = r.actor_id
 AND reservation_actor.tenant_id = r.tenant_id
LEFT JOIN public.events transition_event
  ON transition_event.id = r.transition_event_id
 AND transition_event.tenant_id = r.tenant_id
LEFT JOIN public.app_users transition_actor
  ON transition_actor.id = transition_event.user_id
 AND transition_actor.tenant_id = r.tenant_id
LEFT JOIN private.order_station_evidence evidence
  ON evidence.reservation_id = r.id
CROSS JOIN LATERAL (
  SELECT (
    orders.id IS NOT NULL
    AND customers.id IS NOT NULL
    AND items.id IS NOT NULL
    AND reservation_actor.id IS NOT NULL
    AND transition_event.id IS NOT NULL
    AND r.transition_event_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    AND transition_actor.id IS NOT NULL
    AND orders.customer_id = r.customer_id
    AND items.customer_id = r.customer_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.items corrupt_item
      WHERE corrupt_item.order_id = r.order_id
        AND (
          corrupt_item.tenant_id IS DISTINCT FROM r.tenant_id
          OR corrupt_item.customer_id IS DISTINCT FROM r.customer_id
        )
    )
    AND transition_event.tenant_id = r.tenant_id
    AND transition_event.order_id = r.order_id
    AND transition_event.item_id IS NULL
    AND transition_event.event_type = 'ORDER_STATION_MOVED_V1'
    AND transition_event.client_event_id IS NOT NULL
    AND transition_event.correlation_id IS NOT NULL
    AND transition_event.event_schema_version = 1
    AND transition_event.aggregate_version = r.order_version
    AND transition_event.from_station = 'wareneingang'
    AND transition_event.station = 'galvanik'
    AND transition_event.status = 'success'
    AND (
      evidence.id IS NULL
      OR (
        evidence.tenant_id = r.tenant_id
        AND evidence.actor_id = r.actor_id
        AND evidence.verified_mime_type = r.mime_type
        AND evidence.verified_file_bytes = r.file_bytes
        AND evidence.verified_content_sha256 = r.content_sha256
        AND evidence.storage_object_id IS NOT NULL
        AND nullif(btrim(evidence.storage_object_version), '') IS NOT NULL
        AND evidence.storage_created_at >= r.created_at
        AND evidence.storage_created_at <= r.upload_expires_at
        AND evidence.storage_created_at <= evidence.verified_at
      )
    )
  ) AS integrity_ok
) validity
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND r.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_order_station_evidence_receipts_v1 IS
  'W4 v1 tenant-bound private Galvanik handoff attachment receipts; corrupt rows remain visible with integrity_ok=false.';
