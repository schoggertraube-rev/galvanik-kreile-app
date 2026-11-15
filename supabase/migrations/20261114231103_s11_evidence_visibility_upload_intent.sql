-- S11 / R2: upload intent and flag history share the one immutable ledger.
-- An intent is provenance for repair, never a current customer-visible flag.
ALTER TABLE private.evidence_visibility_events
 ADD COLUMN record_kind text NOT NULL DEFAULT 'change' CHECK (record_kind IN ('change','upload_intent')),
 ADD COLUMN requested_visible boolean;
ALTER TABLE private.evidence_visibility_events DROP CONSTRAINT evidence_visibility_version;
CREATE UNIQUE INDEX evidence_visibility_version ON private.evidence_visibility_events(tenant_id,evidence_key,version) WHERE record_kind='change';
CREATE UNIQUE INDEX evidence_visibility_one_upload_intent ON private.evidence_visibility_events(tenant_id,evidence_key) WHERE record_kind='upload_intent';
ALTER TABLE private.evidence_visibility_events DROP CONSTRAINT evidence_visibility_request;
ALTER TABLE private.evidence_visibility_events ADD CONSTRAINT evidence_visibility_request UNIQUE(tenant_id,client_event_id,record_kind);
ALTER TABLE private.evidence_visibility_events DROP CONSTRAINT evidence_visibility_event_shape;
ALTER TABLE private.evidence_visibility_events ADD CONSTRAINT evidence_visibility_event_shape CHECK (
 (record_kind='change' AND requested_visible IS NULL AND (
  (version=0 AND customer_visible=false AND actor_id IS NULL AND client_event_id IS NULL AND previous_visible IS NULL)
  OR (version>0 AND actor_id IS NOT NULL AND client_event_id IS NOT NULL AND previous_visible IS NOT NULL AND previous_visible<>customer_visible)))
 OR (record_kind='upload_intent' AND version=0 AND customer_visible=false AND previous_visible IS NULL
     AND actor_id IS NOT NULL AND client_event_id IS NOT NULL AND requested_visible IS NOT NULL)
);
CREATE OR REPLACE VIEW private.v_evidence_records_v3 WITH (security_invoker=true) AS
WITH originals AS (
 SELECT * FROM private.v_evidence_records_v2
 UNION ALL
 SELECT 'intake-file:'||file.id::text,'INTAKE_FILE'::text,file.id::text,file.tenant_id,
  'VERIFIED'::text,'scans'::text,file.speicherpfad,file.sha256,'SHA256'::text,file.bytes,
  source.erstellt_am,file.mime,'NOT_REQUESTED'::text,NULL::text,NULL::text,NULL::numeric,
  NULL::jsonb,'{}'::jsonb,
  (SELECT coalesce(jsonb_agg(jsonb_build_object('targetType',link.kind,'targetId',link.id)
                            ORDER BY link.kind,link.id),'[]'::jsonb)
   FROM (VALUES ('CUSTOMER'::text,source.kunde_id),
                ('ORDER'::text,CASE WHEN source.vorgang_art='auftrag' THEN source.vorgang_id END)) link(kind,id)
   WHERE link.id IS NOT NULL),
  source.erstellt_am,
  file.sha256 ~ '^[a-f0-9]{64}$' AND file.speicherpfad=file.tenant_id||'/'||file.sha256
    AND file.bytes>0 AND EXISTS(SELECT 1 FROM public.intake_event secured
      WHERE secured.tenant_id=file.tenant_id AND secured.item_id=file.item_id
        AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=file.id::text)
 FROM public.intake_file file
 JOIN public.intake_item source ON source.tenant_id=file.tenant_id AND source.id=file.item_id
 WHERE file.tenant_id=nullif(current_setting('app.tenant_id',true),'')
)
SELECT original.*,coalesce(visibility.customer_visible,false) AS customer_visible,
 coalesce(visibility.version,0) AS visibility_version,visibility.id AS visibility_event_id,
 visibility.actor_id AS visibility_actor_id,visibility.occurred_at AS visibility_occurred_at
FROM originals original
LEFT JOIN LATERAL (
 SELECT event.* FROM private.evidence_visibility_events event
 WHERE event.tenant_id=original.tenant_id AND event.evidence_key=original.evidence_key AND event.record_kind='change'
 ORDER BY event.version DESC LIMIT 1
) visibility ON true;

CREATE OR REPLACE FUNCTION private.guard_evidence_visibility_event() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
DECLARE original_record record; source_actor text; source_key text;
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'') THEN
  RAISE EXCEPTION 'EVIDENCE_VISIBILITY_TENANT_MISMATCH';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('evidence-visibility:'||NEW.tenant_id||':'||NEW.evidence_key,0));
 SELECT * INTO original_record FROM private.v_evidence_records_v3
  WHERE tenant_id=NEW.tenant_id AND evidence_key=NEW.evidence_key;
 IF NOT FOUND THEN RAISE EXCEPTION 'EVIDENCE_VISIBILITY_SOURCE_MISSING'; END IF;
 IF NEW.record_kind='upload_intent' THEN
  IF original_record.source_kind='LEGACY_SCAN_UPLOAD' THEN
   SELECT uploaded_by::text,client_idempotency_key::text INTO source_actor,source_key FROM public.scan_uploads
    WHERE tenant_id=NEW.tenant_id AND id::text=original_record.source_id AND status='secured';
  ELSIF original_record.source_kind IN ('ORDER_STATION_ATTACHMENT','ORDER_INTAKE_ATTACHMENT') THEN
   SELECT evidence.actor_id::text,reservation.client_request_id::text INTO source_actor,source_key
    FROM private.order_station_evidence evidence JOIN private.order_station_evidence_reservations reservation
     ON reservation.tenant_id=evidence.tenant_id AND reservation.id=evidence.reservation_id
    WHERE evidence.tenant_id=NEW.tenant_id AND evidence.id::text=original_record.source_id;
  ELSIF original_record.source_kind='INTAKE_FILE' THEN
   SELECT aufgenommen_von::text,id::text INTO source_actor,source_key FROM public.intake_file
    WHERE tenant_id=NEW.tenant_id AND id::text=original_record.source_id;
  END IF;
  IF original_record.integrity_ok IS NOT TRUE OR source_actor IS DISTINCT FROM NEW.actor_id::text
    OR source_key IS DISTINCT FROM NEW.client_event_id::text
    OR NOT EXISTS(SELECT 1 FROM public.app_users actor WHERE actor.tenant_id=NEW.tenant_id AND actor.id=NEW.actor_id AND actor.active=true)
  THEN RAISE EXCEPTION 'EVIDENCE_VISIBILITY_UPLOAD_SOURCE_INVALID'; END IF;
 ELSIF NEW.version>0 THEN
  IF original_record.integrity_ok IS NOT TRUE
    OR NEW.version<>original_record.visibility_version+1
    OR NEW.previous_visible IS DISTINCT FROM original_record.customer_visible
    OR NOT EXISTS(SELECT 1 FROM public.app_users actor
       WHERE actor.id=NEW.actor_id AND actor.tenant_id=NEW.tenant_id AND actor.active=true)
  THEN RAISE EXCEPTION 'EVIDENCE_VISIBILITY_SOURCE_OR_VERSION_MISMATCH'; END IF;
 END IF;
 RETURN NEW;
END
$guard$;
