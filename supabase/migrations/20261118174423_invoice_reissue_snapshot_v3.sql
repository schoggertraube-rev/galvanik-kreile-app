-- S54o: the existing S09 cancellation/reissue intent must also recognize the
-- canonical v3 original. All original/hash/actor/handover/line checks remain.
-- Legacy v1/v2 issuance/cancellation refusal remains in the existing writer.
DO $migration$
DECLARE
  definition text;
  source_predicate constant text := $old$original.snapshot->>'schemaVersion' IS DISTINCT FROM '2'$old$;
  current_predicate constant text := $new$(original.snapshot->>'schemaVersion' IS DISTINCT FROM '2'
     AND original.snapshot->>'schemaVersion' IS DISTINCT FROM '3')$new$;
BEGIN
  definition := pg_get_functiondef('private.guard_invoice_reissue_event_v1()'::regprocedure);
  IF (length(definition)-length(replace(definition,source_predicate,''))) <> length(source_predicate) THEN
    RAISE EXCEPTION 'S54O_REISSUE_ORIGINAL_VERSION_ANCHOR_CHANGED';
  END IF;
  EXECUTE replace(definition,source_predicate,current_predicate);
END
$migration$;
