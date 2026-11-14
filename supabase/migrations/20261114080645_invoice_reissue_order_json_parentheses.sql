-- Mechanical consequence of the real A09-7 INSERT: JSONB -> must bind before -.
-- All source, value, actor and original predicates remain identical.
DO $$
DECLARE original text; corrected text;
BEGIN
 SELECT pg_get_functiondef('private.guard_invoice_reissue_original_v1()'::regprocedure) INTO STRICT original;
 corrected:=replace(original,'NEW.snapshot->''order''-''orderVersion''','(NEW.snapshot->''order'')-''orderVersion''');
 corrected:=replace(corrected,'original.snapshot->''order''-''orderVersion''','(original.snapshot->''order'')-''orderVersion''');
 IF corrected=original THEN RAISE EXCEPTION 'REISSUE_JSON_OPERATOR_SOURCE_CHANGED'; END IF;
 EXECUTE corrected;
END $$;
