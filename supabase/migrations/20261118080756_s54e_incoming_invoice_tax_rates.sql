-- S54e: retain structured invoice VAT subtotals on the existing incoming invoice.
-- NULL preserves the actual absence of a breakdown on legacy/manual originals.
ALTER TABLE public.supplier_invoice ADD COLUMN ust_saetze jsonb;
