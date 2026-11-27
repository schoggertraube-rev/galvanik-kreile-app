-- I01: one invoice per evidenced original and inclusive page range.
-- Existing rows keep NULL/NULL and continue to refer to the entire original.
ALTER TABLE public.supplier_invoice
  ADD COLUMN seite_von integer,
  ADD COLUMN seite_bis integer,
  ADD CONSTRAINT supplier_invoice_original_pages_chk CHECK (
    (seite_von IS NULL AND seite_bis IS NULL)
    OR (
      seite_von IS NOT NULL AND seite_bis IS NOT NULL
      AND seite_von >= 1 AND seite_bis >= seite_von
    )
  ),
  ADD CONSTRAINT supplier_invoice_original_pages_key
    UNIQUE NULLS NOT DISTINCT (tenant_id, file_id, seite_von, seite_bis),
  DROP CONSTRAINT supplier_invoice_item_id_key;

-- The mail relation remains a first-class lookup for existing intake readers.
CREATE INDEX supplier_invoice_mail_idx
  ON public.supplier_invoice (tenant_id, item_id);
