-- Canonical original evidence owned by Eingang; a projection, never a second saved delivery state.
CREATE VIEW private.v_intake_delivery_evidence_v1 WITH (security_invoker = true) AS
SELECT source.tenant_id,source.id::text AS item_id,source.kunde_id AS customer_id,source.graph_message_id,
 original.nachher->'deliveryReport' AS report,
 EXISTS(SELECT 1 FROM public.intake_file file
  JOIN public.intake_event secured ON secured.tenant_id=file.tenant_id AND secured.item_id=file.item_id
   AND secured.art='original_gespeichert' AND secured.nachher->>'fileId'=file.id::text AND secured.nachher->>'sha256'=file.sha256
  WHERE file.tenant_id=source.tenant_id AND file.item_id=source.id AND file.mime='message/rfc822'
   AND file.sha256=original.nachher->'deliveryReport'->>'originalSha256'
   AND EXISTS(SELECT 1 FROM public.intake_event completed WHERE completed.tenant_id=file.tenant_id AND completed.item_id=file.item_id
    AND completed.art='einsatz' AND completed.nachher->>'action'='mail_import_complete' AND completed.nachher->'fileIds' ? file.id::text)
 ) AS proof_ok
FROM public.intake_item source
JOIN public.intake_event original ON original.tenant_id=source.tenant_id AND original.item_id=source.id AND original.art='angelegt'
WHERE source.kanal='mail';
REVOKE ALL ON private.v_intake_delivery_evidence_v1 FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.v_intake_delivery_evidence_v1 TO service_role;
COMMENT ON VIEW private.v_intake_delivery_evidence_v1 IS 'Read-only Eingang port: delivery report from the sole secured MIME original and completed original-file receipt.';
