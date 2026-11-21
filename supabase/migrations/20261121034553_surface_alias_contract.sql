-- Generated from src/lib/orderPositionContract.ts; one surface/alias vocabulary.
-- Contract SHA256: eeae5deee3b7178bf06998910b303d8c7af5ed354294af1f3d2b4a59d317a063. Create a new migration for later changes.
-- PL2026-11-21 04:39: legacy aliases are read without rewriting originals.
CREATE OR REPLACE FUNCTION private.order_position_surface_key(p_value text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $fn$
BEGIN
  IF p_value IS NULL OR btrim(p_value)='' THEN RETURN NULL; END IF;
  CASE btrim(p_value)
    WHEN 'verchromen' THEN RETURN 'verchromen';
    WHEN 'Verchromen' THEN RETURN 'verchromen';
    WHEN 'vernickeln' THEN RETURN 'vernickeln';
    WHEN 'Vernickeln' THEN RETURN 'vernickeln';
    WHEN 'verzinken' THEN RETURN 'verzinken';
    WHEN 'Verzinken' THEN RETURN 'verzinken';
    WHEN 'entchromen_pruefen' THEN RETURN 'entchromen_pruefen';
    WHEN 'Entchromen / prüfen' THEN RETURN 'entchromen_pruefen';
    WHEN 'offen' THEN RETURN 'offen';
    WHEN 'noch zu klären' THEN RETURN 'offen';
    WHEN 'chrom' THEN RETURN 'verchromen';
    ELSE RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='ORDER_POSITION_SURFACE_KEY_UNKNOWN';
  END CASE;
END; $fn$;
REVOKE ALL ON FUNCTION private.order_position_surface_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.order_position_surface_key(text) TO service_role;
