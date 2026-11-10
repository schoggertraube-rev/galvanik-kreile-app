-- Read-only Eingang evidence. No copied mail state and no client-readable body.
CREATE VIEW private.v_intake_reply_evidence_v1 WITH (security_invoker = true) AS
SELECT source.tenant_id,source.id::text AS item_id,source.kunde_id AS customer_id,
 source.graph_message_id,source.empfangen_am AS received_at,
 original.nachher->'replyChain' AS reply_chain,
 EXISTS(SELECT 1 FROM public.intake_file file
  JOIN public.intake_event secured ON secured.tenant_id=file.tenant_id AND secured.item_id=file.item_id
   AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=file.id::text AND secured.nachher->>'sha256'=file.sha256
  WHERE file.tenant_id=source.tenant_id AND file.item_id=source.id AND file.mime='message/rfc822'
   AND file.sha256=original.nachher->'replyChain'->>'originalSha256'
   AND EXISTS(SELECT 1 FROM public.intake_event completed WHERE completed.tenant_id=file.tenant_id AND completed.item_id=file.item_id
    AND completed.art='einsatz' AND completed.nachher->>'action'='mail_import_complete' AND completed.nachher->'fileIds' ? file.id::text)
 ) AS proof_ok
FROM public.intake_item source
JOIN public.intake_event original ON original.tenant_id=source.tenant_id AND original.item_id=source.id AND original.art='angelegt'
WHERE source.kanal='mail' AND original.nachher->'deliveryReport' IS NULL;
REVOKE ALL ON private.v_intake_reply_evidence_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.v_intake_reply_evidence_v1 TO service_role;
COMMENT ON VIEW private.v_intake_reply_evidence_v1 IS 'Secured original MIME reply metadata and its completed file receipt; no body and no separate stored response status.';
