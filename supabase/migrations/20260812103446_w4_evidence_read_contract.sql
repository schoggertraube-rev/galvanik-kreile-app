-- W4-02/03/04: append-only extraction metadata, polymorphic domain links,
-- and a read-only legacy Evidence adapter. Existing originals remain unchanged.

ALTER TABLE private.order_station_evidence
  ADD CONSTRAINT order_station_evidence_id_tenant_key UNIQUE (id, tenant_id);

CREATE TABLE private.evidence_extraction_metadata (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL,
  tenant_id text NOT NULL,
  extraction_state text NOT NULL,
  provider text,
  detected_type text,
  detection_confidence numeric(4,3),
  extracted_data jsonb,
  field_confidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT evidence_extraction_metadata_pkey PRIMARY KEY (id),
  CONSTRAINT evidence_extraction_metadata_evidence_key UNIQUE (evidence_id),
  CONSTRAINT evidence_extraction_metadata_evidence_fkey
    FOREIGN KEY (evidence_id, tenant_id)
    REFERENCES private.order_station_evidence (id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT evidence_extraction_metadata_state_chk
    CHECK (extraction_state IN ('NOT_REQUESTED', 'SUCCEEDED', 'FAILED')),
  CONSTRAINT evidence_extraction_metadata_payload_chk
    CHECK (
      (
        extraction_state = 'NOT_REQUESTED'
        AND provider IS NULL
        AND detected_type IS NULL
        AND detection_confidence IS NULL
        AND extracted_data IS NULL
        AND field_confidence = '{}'::jsonb
      )
      OR (
        extraction_state = 'SUCCEEDED'
        AND provider = btrim(provider)
        AND nullif(provider, '') IS NOT NULL
        AND detected_type = btrim(detected_type)
        AND nullif(detected_type, '') IS NOT NULL
        AND detection_confidence BETWEEN 0 AND 1
        AND jsonb_typeof(extracted_data) = 'object'
        AND jsonb_typeof(field_confidence) = 'object'
      )
      OR (
        extraction_state = 'FAILED'
        AND provider = btrim(provider)
        AND nullif(provider, '') IS NOT NULL
        AND detected_type IS NULL
        AND detection_confidence IS NULL
        AND extracted_data IS NULL
        AND field_confidence = '{}'::jsonb
      )
    )
);

CREATE TABLE private.evidence_domain_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL,
  tenant_id text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT statement_timestamp(),

  CONSTRAINT evidence_domain_links_pkey PRIMARY KEY (id),
  CONSTRAINT evidence_domain_links_target_key UNIQUE (evidence_id, target_type, target_id),
  CONSTRAINT evidence_domain_links_evidence_fkey
    FOREIGN KEY (evidence_id, tenant_id)
    REFERENCES private.order_station_evidence (id, tenant_id) ON DELETE RESTRICT,
  CONSTRAINT evidence_domain_links_type_chk
    CHECK (target_type IN ('ORDER', 'ORDER_ITEM', 'CUSTOMER', 'INVOICE')),
  CONSTRAINT evidence_domain_links_target_id_chk
    CHECK (
      target_id = btrim(target_id)
      AND length(target_id) BETWEEN 1 AND 128
    )
);

CREATE INDEX evidence_domain_links_tenant_target_idx
  ON private.evidence_domain_links (tenant_id, target_type, target_id, evidence_id);

CREATE TRIGGER evidence_extraction_metadata_update_immutable
  BEFORE UPDATE ON private.evidence_extraction_metadata
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER evidence_extraction_metadata_delete_immutable
  BEFORE DELETE ON private.evidence_extraction_metadata
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER evidence_extraction_metadata_truncate_immutable
  BEFORE TRUNCATE ON private.evidence_extraction_metadata
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER evidence_domain_links_update_immutable
  BEFORE UPDATE ON private.evidence_domain_links
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER evidence_domain_links_delete_immutable
  BEFORE DELETE ON private.evidence_domain_links
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE TRIGGER evidence_domain_links_truncate_immutable
  BEFORE TRUNCATE ON private.evidence_domain_links
  FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

INSERT INTO private.evidence_extraction_metadata (
  evidence_id,
  tenant_id,
  extraction_state
)
SELECT evidence.id, evidence.tenant_id, 'NOT_REQUESTED'
FROM private.order_station_evidence evidence;

INSERT INTO private.evidence_domain_links (
  evidence_id,
  tenant_id,
  target_type,
  target_id
)
SELECT evidence.id, evidence.tenant_id, target.target_type, target.target_id
FROM private.order_station_evidence evidence
JOIN private.order_station_evidence_reservations reservation
  ON reservation.id = evidence.reservation_id
CROSS JOIN LATERAL (
  VALUES
    ('ORDER'::text, reservation.order_id),
    ('ORDER_ITEM'::text, reservation.item_id)
) AS target(target_type, target_id);

CREATE VIEW private.v_order_station_evidence_receipts_v2
WITH (security_invoker = true)
AS
SELECT
  receipt.reservation_id,
  receipt.receipt_id,
  receipt.tenant_id,
  receipt.customer_id,
  receipt.order_id,
  receipt.item_id,
  receipt.transition_event_id,
  receipt.order_version,
  receipt.actor_id,
  receipt.actor_display_name,
  receipt.client_request_id,
  receipt.purpose,
  receipt.station,
  receipt.mime_type,
  receipt.file_bytes,
  receipt.content_sha256,
  receipt.upload_expires_at,
  receipt.reserved_at,
  receipt.storage_object_id,
  receipt.storage_object_version,
  receipt.storage_created_at,
  receipt.verified_at,
  CASE
    WHEN receipt.integrity_ok IS TRUE AND contract.integrity_ok IS TRUE
      THEN receipt.receipt_state
    ELSE 'INVALID'
  END AS receipt_state,
  receipt.integrity_ok IS TRUE AND contract.integrity_ok IS TRUE AS integrity_ok,
  extraction.extraction_state,
  extraction.provider AS extraction_provider,
  extraction.detected_type,
  extraction.detection_confidence,
  extraction.extracted_data,
  extraction.field_confidence,
  extraction.created_at AS extraction_created_at,
  links.target_links
FROM private.v_order_station_evidence_receipts_v1 receipt
LEFT JOIN private.evidence_extraction_metadata extraction
  ON extraction.evidence_id = receipt.receipt_id
 AND extraction.tenant_id = receipt.tenant_id
LEFT JOIN LATERAL (
  SELECT
    count(*)::integer AS link_count,
    count(*) FILTER (
      WHERE link.target_type = 'ORDER' AND link.target_id = receipt.order_id
    )::integer AS order_link_count,
    count(*) FILTER (
      WHERE link.target_type = 'ORDER_ITEM' AND link.target_id = receipt.item_id
    )::integer AS item_link_count,
    bool_and(
      link.tenant_id = receipt.tenant_id
      AND link.evidence_id = receipt.receipt_id
      AND link.created_at >= receipt.verified_at
    ) AS bindings_ok,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'targetType', link.target_type,
          'targetId', link.target_id
        ) ORDER BY link.target_type, link.target_id
      ),
      '[]'::jsonb
    ) AS target_links
  FROM private.evidence_domain_links link
  WHERE link.evidence_id = receipt.receipt_id
) links ON true
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN receipt.receipt_id IS NULL THEN
      extraction.id IS NULL AND links.link_count = 0
    ELSE
      extraction.id IS NOT NULL
      AND extraction.evidence_id = receipt.receipt_id
      AND extraction.tenant_id = receipt.tenant_id
      AND extraction.extraction_state = 'NOT_REQUESTED'
      AND extraction.provider IS NULL
      AND extraction.detected_type IS NULL
      AND extraction.detection_confidence IS NULL
      AND extraction.extracted_data IS NULL
      AND extraction.field_confidence = '{}'::jsonb
      AND extraction.created_at >= receipt.verified_at
      AND links.link_count = 2
      AND links.order_link_count = 1
      AND links.item_link_count = 1
      AND links.bindings_ok IS TRUE
  END AS integrity_ok
) contract;

COMMENT ON VIEW private.v_order_station_evidence_receipts_v2 IS
  'W4 v2 receipt contract: v1 original integrity plus exact append-only extraction and ORDER/ORDER_ITEM links.';

CREATE VIEW private.v_evidence_records_v1
WITH (security_invoker = true)
AS
SELECT
  'order-station-attachment:' || receipt.receipt_id::text AS evidence_key,
  'ORDER_STATION_ATTACHMENT'::text AS source_kind,
  receipt.receipt_id::text AS source_id,
  receipt.tenant_id,
  'VERIFIED'::text AS original_state,
  'item-photos'::text AS original_bucket_id,
  'order-station-evidence/v1/' || receipt.reservation_id::text ||
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
FROM private.v_order_station_evidence_receipts_v2 receipt
WHERE receipt.receipt_id IS NOT NULL

UNION ALL

SELECT
  'legacy-scan-upload:' || scan.id AS evidence_key,
  'LEGACY_SCAN_UPLOAD'::text AS source_kind,
  scan.id AS source_id,
  scan.tenant_id,
  CASE
    WHEN scan.original_storage_path IS NULL
      AND scan.original_hash IS NULL
      AND scan.original_size_bytes IS NULL
      AND scan.original_secured_at IS NULL THEN 'NOT_RECORDED'
    WHEN scan.original_storage_path IS NOT NULL
      AND scan.original_hash IS NOT NULL
      AND scan.original_size_bytes IS NOT NULL
      AND scan.original_secured_at IS NOT NULL THEN 'LEGACY_RECORDED'
    ELSE 'LEGACY_PARTIAL'
  END AS original_state,
  NULL::text AS original_bucket_id,
  scan.original_storage_path,
  scan.original_hash,
  CASE
    WHEN scan.original_hash ~ '^[0-9a-f]{64}$' THEN 'SHA256'
    WHEN scan.original_hash IS NOT NULL THEN 'LEGACY_UNSPECIFIED'
    ELSE NULL
  END AS original_hash_algorithm,
  scan.original_size_bytes,
  scan.original_secured_at,
  scan.file_type AS original_mime_type,
  CASE
    WHEN scan.detected_type IS NOT NULL
      OR scan.detection_confidence IS NOT NULL
      OR scan.extracted_data IS NOT NULL
      OR scan.ocr_provider IS NOT NULL
      OR scan.field_confidence <> '{}'::jsonb THEN 'LEGACY_RECORDED'
    ELSE 'NOT_RECORDED'
  END AS extraction_state,
  scan.ocr_provider AS extraction_provider,
  scan.detected_type,
  scan.detection_confidence,
  scan.extracted_data,
  scan.field_confidence,
  targets.target_links,
  scan.uploaded_at AS recorded_at,
  scan.id = btrim(scan.id)
    AND length(scan.id) BETWEEN 1 AND 128
    AND scan.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '')
    AND (scan.uploaded_by IS NULL OR EXISTS (
      SELECT 1 FROM public.app_users actor
      WHERE actor.id = scan.uploaded_by AND actor.tenant_id = scan.tenant_id
    ))
    AND (scan.linked_order_id IS NULL OR EXISTS (
      SELECT 1 FROM public.orders linked_order
      WHERE linked_order.id = scan.linked_order_id
        AND linked_order.tenant_id = scan.tenant_id
        AND (
          scan.linked_customer_id IS NULL
          OR linked_order.customer_id = scan.linked_customer_id
        )
    ))
    AND (scan.linked_customer_id IS NULL OR EXISTS (
      SELECT 1 FROM public.customers linked_customer
      WHERE linked_customer.id = scan.linked_customer_id
        AND linked_customer.tenant_id = scan.tenant_id
    ))
    AND (scan.linked_invoice_id IS NULL OR EXISTS (
      SELECT 1 FROM public.invoices linked_invoice
      WHERE linked_invoice.id::text = scan.linked_invoice_id
        AND linked_invoice.tenant_id = scan.tenant_id
        AND (
          scan.linked_order_id IS NULL
          OR linked_invoice.order_id = scan.linked_order_id
        )
        AND (
          scan.linked_customer_id IS NULL
          OR linked_invoice.customer_id = scan.linked_customer_id
        )
    ))
    AND jsonb_array_length(targets.target_links) > 0
    AND (
      scan.original_storage_path IS NULL
      OR (
        scan.original_storage_path = btrim(scan.original_storage_path)
        AND nullif(scan.original_storage_path, '') IS NOT NULL
      )
    )
    AND (
      scan.original_hash IS NULL
      OR (
        scan.original_hash = btrim(scan.original_hash)
        AND nullif(scan.original_hash, '') IS NOT NULL
      )
    )
    AND (scan.original_size_bytes IS NULL OR scan.original_size_bytes > 0)
    AND (
      scan.original_secured_at IS NULL
      OR scan.original_secured_at >= scan.uploaded_at
    )
    AND (
      scan.file_type IS NULL
      OR (scan.file_type = btrim(scan.file_type) AND nullif(scan.file_type, '') IS NOT NULL)
    )
    AND (
      scan.detection_confidence IS NULL
      OR scan.detection_confidence BETWEEN 0 AND 1
    )
    AND (scan.extracted_data IS NULL OR jsonb_typeof(scan.extracted_data) = 'object')
    AND jsonb_typeof(scan.field_confidence) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each(scan.field_confidence) field
      WHERE jsonb_typeof(field.value) <> 'number'
         OR (field.value #>> '{}')::numeric NOT BETWEEN 0 AND 1
    ) AS integrity_ok
FROM public.scan_uploads scan
CROSS JOIN LATERAL (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'targetType', target.target_type,
        'targetId', target.target_id
      ) ORDER BY target.target_type, target.target_id
    ),
    '[]'::jsonb
  ) AS target_links
  FROM (
    SELECT 'ORDER'::text AS target_type, scan.linked_order_id AS target_id
    WHERE scan.linked_order_id IS NOT NULL
    UNION ALL
    SELECT 'CUSTOMER'::text, scan.linked_customer_id
    WHERE scan.linked_customer_id IS NOT NULL
    UNION ALL
    SELECT 'INVOICE'::text, scan.linked_invoice_id
    WHERE scan.linked_invoice_id IS NOT NULL
  ) target
) targets
WHERE nullif(btrim(current_setting('app.tenant_id', true)), '') IS NOT NULL
  AND scan.tenant_id = nullif(btrim(current_setting('app.tenant_id', true)), '');

COMMENT ON VIEW private.v_evidence_records_v1 IS
  'W4 canonical read-only Evidence port: verified station originals plus existing scan_uploads metadata; no legacy object capability is exposed.';
