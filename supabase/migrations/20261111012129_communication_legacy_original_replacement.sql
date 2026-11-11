-- PL02:01: one normal new PREPARE for a legacy quote lacking its original.
CREATE UNIQUE INDEX communication_one_legacy_original_replacement
 ON public.events(tenant_id,(payload->'legacyReplaces'->>'requestId'))
 WHERE event_type='COMMUNICATION_MAIL_PREPARED_V1' AND payload->'legacyReplaces'->>'requestId' IS NOT NULL;
