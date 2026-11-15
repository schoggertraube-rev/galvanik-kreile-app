-- KORR S11 PL15Nov00:28 Nr4: explicit stable column names in the one current projection.
CREATE OR REPLACE VIEW private.v_evidence_records_v3 WITH (security_invoker=true) AS
WITH originals(evidence_key,source_kind,source_id,tenant_id,original_state,original_bucket_id,original_storage_path,original_hash,original_hash_algorithm,original_size_bytes,original_secured_at,original_mime_type,extraction_state,extraction_provider,detected_type,detection_confidence,extracted_data,field_confidence,target_links,recorded_at,integrity_ok) AS (
 SELECT legacy.evidence_key,legacy.source_kind,legacy.source_id,legacy.tenant_id,legacy.original_state,legacy.original_bucket_id,legacy.original_storage_path,legacy.original_hash,legacy.original_hash_algorithm,legacy.original_size_bytes,legacy.original_secured_at,legacy.original_mime_type,legacy.extraction_state,legacy.extraction_provider,legacy.detected_type,legacy.detection_confidence,legacy.extracted_data,legacy.field_confidence,legacy.target_links,legacy.recorded_at,legacy.integrity_ok FROM private.v_evidence_records_v2 legacy
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
SELECT original.evidence_key,original.source_kind,original.source_id,original.tenant_id,original.original_state,original.original_bucket_id,original.original_storage_path,original.original_hash,original.original_hash_algorithm,original.original_size_bytes,original.original_secured_at,original.original_mime_type,original.extraction_state,original.extraction_provider,original.detected_type,original.detection_confidence,original.extracted_data,original.field_confidence,original.target_links,original.recorded_at,original.integrity_ok,coalesce(visibility.customer_visible,false) AS customer_visible,
 coalesce(visibility.version,0) AS visibility_version,visibility.id AS visibility_event_id,
 visibility.actor_id AS visibility_actor_id,visibility.occurred_at AS visibility_occurred_at
FROM originals original
LEFT JOIN LATERAL (
 SELECT event.customer_visible,event.version,event.id,event.actor_id,event.occurred_at FROM private.evidence_visibility_events event
 WHERE event.tenant_id=original.tenant_id AND event.evidence_key=original.evidence_key AND event.record_kind='change'
 ORDER BY event.version DESC LIMIT 1
) visibility ON true;
