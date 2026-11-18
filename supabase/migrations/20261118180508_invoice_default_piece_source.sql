-- PL18Nov19:01: only new v3 BASE part lines may declare default_piece.
-- Existing originals, KV/Freeze rows, VAT arithmetic and grants are unchanged.
DO $migration$
DECLARE
  definition text;
  marker constant text := $old$IF line->>'unit' IS NULL$old$;
  validated constant text := $new$IF line ? 'unitSource' AND (
      line->>'type' IS DISTINCT FROM 'BASE'
      OR line->'unitSource' IS DISTINCT FROM '"default_piece"'::jsonb
      OR line->'unit' IS DISTINCT FROM '"C62"'::jsonb
      OR jsonb_typeof(line->'itemId') IS DISTINCT FROM 'string'
      OR NULLIF(btrim(line->>'itemId'),'') IS NULL
      OR jsonb_typeof(line->'quantity') IS DISTINCT FROM 'number'
      OR COALESCE((line->>'quantity')::numeric<=0
        OR (line->>'quantity')::numeric<>trunc((line->>'quantity')::numeric),true)
    ) THEN RETURN false; END IF;
   IF line->>'unit' IS NULL$new$;
  projection constant text := $old$value-'unit'-'taxCategory' ORDER BY ordinal$old$;
BEGIN
  definition:=pg_get_functiondef('private.invoice_original_vat_valid(jsonb,bigint,integer,bigint,bigint)'::regprocedure);
  IF length(definition)-length(replace(definition,marker,''))<>length(marker)
    OR length(definition)-length(replace(definition,projection,''))<>length(projection) THEN
    RAISE EXCEPTION 'S54O_DEFAULT_PIECE_VALIDATOR_ANCHOR_CHANGED';
  END IF;
  EXECUTE replace(replace(definition,marker,validated),projection,
    $new$value-'unit'-'taxCategory'-'unitSource' ORDER BY ordinal$new$);
END
$migration$;
