-- S11 / N9: one append-only visibility history per existing original.
-- Original bytes, ownership and sent documents remain at their existing stores.
CREATE TABLE private.evidence_visibility_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id text NOT NULL,
 evidence_key text NOT NULL CHECK (length(evidence_key) BETWEEN 1 AND 256),
 version integer NOT NULL CHECK (version >= 0),
 customer_visible boolean NOT NULL DEFAULT false,
 actor_id uuid REFERENCES public.app_users(id) ON DELETE RESTRICT,
 client_event_id uuid,
 previous_visible boolean,
 occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
 CONSTRAINT evidence_visibility_version UNIQUE (tenant_id,evidence_key,version),
 CONSTRAINT evidence_visibility_request UNIQUE (tenant_id,client_event_id),
 CONSTRAINT evidence_visibility_event_shape CHECK (
   (version=0 AND customer_visible=false AND actor_id IS NULL AND client_event_id IS NULL AND previous_visible IS NULL)
   OR (version>0 AND actor_id IS NOT NULL AND client_event_id IS NOT NULL
       AND previous_visible IS NOT NULL AND previous_visible<>customer_visible)
 )
);
ALTER TABLE private.evidence_visibility_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.evidence_visibility_events FORCE ROW LEVEL SECURITY;
CREATE POLICY evidence_visibility_tenant ON private.evidence_visibility_events
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),''))
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),''));
REVOKE ALL ON private.evidence_visibility_events FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON private.evidence_visibility_events TO service_role;
CREATE TRIGGER evidence_visibility_no_update BEFORE UPDATE ON private.evidence_visibility_events
 FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER evidence_visibility_no_delete BEFORE DELETE ON private.evidence_visibility_events
 FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_mutation();
CREATE TRIGGER evidence_visibility_no_truncate BEFORE TRUNCATE ON private.evidence_visibility_events
 FOR EACH STATEMENT EXECUTE FUNCTION public.prevent_audit_mutation();

CREATE VIEW private.v_evidence_records_v3 WITH (security_invoker=true) AS
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
 WHERE event.tenant_id=original.tenant_id AND event.evidence_key=original.evidence_key
 ORDER BY event.version DESC LIMIT 1
) visibility ON true;
REVOKE ALL ON private.v_evidence_records_v3 FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON private.v_evidence_records_v3 TO service_role;
COMMENT ON VIEW private.v_evidence_records_v3 IS
 'S11: existing evidence and intake originals with the single append-only customer visibility projection. Missing flag explicitly means internal (N9).';

CREATE FUNCTION private.guard_evidence_visibility_event() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $guard$
DECLARE original_record record;
BEGIN
 IF NEW.tenant_id IS DISTINCT FROM nullif(current_setting('app.tenant_id',true),'') THEN
  RAISE EXCEPTION 'EVIDENCE_VISIBILITY_TENANT_MISMATCH';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('evidence-visibility:'||NEW.tenant_id||':'||NEW.evidence_key,0));
 SELECT * INTO original_record FROM private.v_evidence_records_v3
  WHERE tenant_id=NEW.tenant_id AND evidence_key=NEW.evidence_key;
 IF NOT FOUND THEN RAISE EXCEPTION 'EVIDENCE_VISIBILITY_SOURCE_MISSING'; END IF;
 IF NEW.version>0 THEN
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
REVOKE ALL ON FUNCTION private.guard_evidence_visibility_event() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.guard_evidence_visibility_event() TO service_role;
CREATE TRIGGER evidence_visibility_source BEFORE INSERT ON private.evidence_visibility_events
 FOR EACH ROW EXECUTE FUNCTION private.guard_evidence_visibility_event();

-- Explicit legacy migration as required by ABNAHMEFAELLE S11 V1/V3.
-- This is baseline metadata, never a fabricated employee action or new original.
DO $backfill$
DECLARE target_tenant text;
BEGIN
 FOR target_tenant IN
   SELECT tenant_id FROM public.scan_uploads UNION SELECT tenant_id FROM private.order_station_evidence
   UNION SELECT tenant_id FROM public.intake_file
 LOOP
  PERFORM set_config('app.tenant_id',target_tenant,true);
  INSERT INTO private.evidence_visibility_events(tenant_id,evidence_key,version,customer_visible)
  SELECT tenant_id,evidence_key,0,false FROM private.v_evidence_records_v3
  ON CONFLICT (tenant_id,evidence_key,version) DO NOTHING;
 END LOOP;
END
$backfill$;
