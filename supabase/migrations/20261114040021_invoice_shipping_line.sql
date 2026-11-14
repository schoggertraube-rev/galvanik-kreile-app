-- S09: one original VAT validator; add the approved shipping line to schema2.
-- Existing BASE/EXTRA_WORK and schema1 branches/rounding/grants stay byte-identical.
-- PL13.11.00:14: one immutable original, per-rate half-up rounding.
CREATE OR REPLACE FUNCTION private.invoice_original_vat_valid(original jsonb, net bigint, head_rate integer, vat bigint, gross bigint)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,private AS $fn$
DECLARE totals jsonb; line jsonb; grp jsonb; rates integer[] := ARRAY[]::integer[];
 rate integer; line_net numeric; group_net numeric; group_vat numeric;
 sum_net numeric := 0; sum_vat numeric := 0; sum_gross numeric := 0;
BEGIN
 IF original IS NULL OR jsonb_typeof(original) IS DISTINCT FROM 'object' OR net IS NULL OR vat IS NULL OR gross IS NULL OR net<0 OR vat<0 OR gross<>net+vat THEN RETURN false; END IF;
 totals:=original->'totals';
 IF jsonb_typeof(totals) IS DISTINCT FROM 'object' OR jsonb_typeof(totals->'netAmountCents') IS DISTINCT FROM 'number' OR jsonb_typeof(totals->'vatAmountCents') IS DISTINCT FROM 'number' OR jsonb_typeof(totals->'grossAmountCents') IS DISTINCT FROM 'number'
 OR (totals->>'netAmountCents')::numeric<>net OR (totals->>'vatAmountCents')::numeric<>vat OR (totals->>'grossAmountCents')::numeric<>gross THEN RETURN false; END IF;
 IF original->'schemaVersion'='1'::jsonb THEN
  RETURN COALESCE(head_rate IN (700,1900) AND jsonb_typeof(totals->'vatRateBasisPoints')='number' AND (totals->>'vatRateBasisPoints')::numeric=head_rate AND vat=round(net::numeric*head_rate/10000),false);
 END IF;
 IF original->'schemaVersion' IS DISTINCT FROM '2'::jsonb OR head_rate IS NOT NULL OR totals->'vatRateBasisPoints' IS DISTINCT FROM 'null'::jsonb
 OR jsonb_typeof(totals->'vatBreakdown') IS DISTINCT FROM 'array' OR jsonb_array_length(totals->'vatBreakdown')=0
 OR jsonb_typeof(original->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(original->'lines')=0 THEN RETURN false; END IF;
 FOR grp IN SELECT value FROM jsonb_array_elements(totals->'vatBreakdown') LOOP
  IF jsonb_typeof(grp) IS DISTINCT FROM 'object' OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(grp) key) IS DISTINCT FROM ARRAY['grossCents','netCents','rateBp','vatCents']
  OR jsonb_typeof(grp->'rateBp') IS DISTINCT FROM 'number' OR (grp->>'rateBp')::numeric NOT IN (0,700,1900)
  OR jsonb_typeof(grp->'netCents') IS DISTINCT FROM 'number' OR jsonb_typeof(grp->'vatCents') IS DISTINCT FROM 'number' OR jsonb_typeof(grp->'grossCents') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
  rate:=(grp->>'rateBp')::integer;
  IF rate=ANY(rates) THEN RETURN false; END IF;
  rates:=array_append(rates,rate); group_net:=0;
  FOR line IN SELECT value FROM jsonb_array_elements(original->'lines') LOOP
   IF jsonb_typeof(line) IS DISTINCT FROM 'object' OR jsonb_typeof(line->'vat_rate_basis_points') IS DISTINCT FROM 'number' OR (line->>'vat_rate_basis_points')::numeric NOT IN (0,700,1900) THEN RETURN false; END IF;
   IF line->>'type'='BASE' THEN
    IF jsonb_typeof(line->'lineNetAmountCents') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    line_net:=(line->>'lineNetAmountCents')::numeric;
   ELSIF line->>'type' IN ('EXTRA_WORK','SHIPPING') THEN
    IF line->>'type'='SHIPPING' AND (
     (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(line) key) IS DISTINCT FROM ARRAY['amountCents','name','shipmentGroupId','type','vat_rate_basis_points']
     OR jsonb_typeof(line->'shipmentGroupId') IS DISTINCT FROM 'string' OR NULLIF(btrim(line->>'shipmentGroupId'),'') IS NULL
     OR jsonb_typeof(line->'name') IS DISTINCT FROM 'string' OR NULLIF(btrim(line->>'name'),'') IS NULL
    ) THEN RETURN false; END IF;
    IF jsonb_typeof(line->'amountCents') IS DISTINCT FROM 'number' THEN RETURN false; END IF;
    line_net:=(line->>'amountCents')::numeric;
   ELSE RETURN false; END IF;
   IF line_net IS NULL OR line_net<0 OR line_net<>trunc(line_net) THEN RETURN false; END IF;
   IF (line->>'vat_rate_basis_points')::integer=rate THEN group_net:=group_net+line_net; END IF;
  END LOOP;
  group_vat:=round(group_net*rate/10000);
  IF (grp->>'netCents')::numeric<>group_net OR (grp->>'vatCents')::numeric<>group_vat OR (grp->>'grossCents')::numeric<>group_net+group_vat THEN RETURN false; END IF;
  IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(original->'lines') item WHERE (item->>'vat_rate_basis_points')::integer=rate) THEN RETURN false; END IF;
  sum_net:=sum_net+group_net; sum_vat:=sum_vat+group_vat; sum_gross:=sum_gross+group_net+group_vat;
 END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(original->'lines') item WHERE NOT ((item->>'vat_rate_basis_points')::integer=ANY(rates))) THEN RETURN false; END IF;
 IF 0=ANY(rates) THEN
  IF cardinality(rates)<>1 OR jsonb_typeof(original->'customer'->'country') IS DISTINCT FROM 'string' OR jsonb_typeof(original->'customer'->'vatId') IS DISTINCT FROM 'string' OR jsonb_typeof(original->'seller'->'taxId') IS DISTINCT FROM 'string' OR (original->'customer'->>'country') IS NULL OR NOT ((original->'customer'->>'country')=ANY(ARRAY['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']))
  OR NULLIF(btrim(original->'customer'->>'vatId'),'') IS NULL OR NULLIF(btrim(original->'seller'->>'taxId'),'') IS NULL THEN RETURN false; END IF;
 END IF;
 RETURN sum_net=net AND sum_vat=vat AND sum_gross=gross;
EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range OR invalid_parameter_value THEN RETURN false;
END $fn$;
REVOKE ALL ON FUNCTION private.invoice_original_vat_valid(jsonb,bigint,integer,bigint,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION private.invoice_original_vat_valid(jsonb,bigint,integer,bigint,bigint) TO service_role;
