-- Keep the canonical invoice number suffix lossless once a tenant reaches
-- five or more digits. PostgreSQL lpad(text, 4, '0') truncates longer input;
-- the allocator must pad short suffixes without shortening long ones.

CREATE OR REPLACE FUNCTION private.allocate_invoice_number(
  p_tenant_id text,
  p_invoice_year integer
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_canonical_pattern text;
  v_existing_max numeric;
  v_number integer;
  v_suffix text;
BEGIN
  IF p_tenant_id IS NULL
     OR p_tenant_id <> btrim(p_tenant_id)
     OR length(p_tenant_id) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'INVOICE_NUMBER_TENANT_INVALID' USING ERRCODE = '23514';
  END IF;

  IF p_invoice_year IS NULL OR p_invoice_year NOT BETWEEN 2000 AND 2100 THEN
    RAISE EXCEPTION 'INVOICE_NUMBER_YEAR_INVALID' USING ERRCODE = '23514';
  END IF;

  v_canonical_pattern := '^R-' || p_invoice_year::text || '-([0-9]{4,})$';

  SELECT coalesce(max(substring(invoice.invoice_number FROM v_canonical_pattern)::numeric), 0)
    INTO v_existing_max
  FROM public.invoices invoice
  WHERE invoice.tenant_id = p_tenant_id
    AND invoice.invoice_number ~ v_canonical_pattern;

  IF v_existing_max IS NULL OR v_existing_max > 2147483646 THEN
    RAISE EXCEPTION 'INVOICE_NUMBER_RANGE_EXHAUSTED' USING ERRCODE = '23514';
  END IF;

  INSERT INTO private.invoice_number_sequences (
    tenant_id,
    invoice_year,
    last_number,
    updated_at
  )
  VALUES (
    p_tenant_id,
    p_invoice_year,
    greatest(1, v_existing_max::integer + 1),
    statement_timestamp()
  )
  ON CONFLICT (tenant_id, invoice_year)
  DO UPDATE SET
    last_number = greatest(
      private.invoice_number_sequences.last_number + 1,
      v_existing_max::integer + 1
    ),
    updated_at = statement_timestamp()
  RETURNING last_number INTO v_number;

  v_suffix := v_number::text;
  RETURN 'R-' || p_invoice_year::text || '-'
    || lpad(v_suffix, greatest(4, length(v_suffix)), '0');
END;
$$;

COMMENT ON FUNCTION private.allocate_invoice_number(text, integer) IS
  'Allocates one transaction-bound invoice number without truncating suffixes above four digits.';
