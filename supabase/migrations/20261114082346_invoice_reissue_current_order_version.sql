-- S09 R2/R3: original handover/source version and current repair version are
-- distinct facts. The repaired invoice must still match the locked current
-- order version and pickup mode; original goods/actors/intent stay exact.
DO $$
DECLARE original text; corrected text;
BEGIN
 SELECT pg_get_functiondef('private.guard_invoice_reissue_original_v1()'::regprocedure) INTO STRICT original;
 corrected:=replace(original,
  'NEW.order_version::text IS DISTINCT FROM cancellation.payload#>>''{reissue,orderVersion}''',
  'NEW.order_version < (cancellation.payload#>>''{reissue,orderVersion}'')::integer');
 IF corrected=original OR strpos(corrected,'current_order.version IS DISTINCT FROM NEW.order_version')=0 THEN
  RAISE EXCEPTION 'REISSUE_REPAIR_VERSION_SOURCE_CHANGED';
 END IF;
 EXECUTE corrected;
END $$;
