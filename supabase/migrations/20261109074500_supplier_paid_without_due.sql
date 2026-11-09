-- BA-08: an explicitly confirmed paid receipt has no unpaid due date to invent.
-- Every other mandatory invoice field and the separate paid-date/tenant/original contracts remain enforced.
ALTER TABLE public.supplier_invoice DROP CONSTRAINT supplier_invoice_fields_chk;
ALTER TABLE public.supplier_invoice ADD CONSTRAINT supplier_invoice_fields_chk CHECK (
 zahlstatus IN ('unklar','ungueltig') OR (
  lieferant_id IS NOT NULL AND nummer IS NOT NULL AND btrim(nummer) <> ''
  AND datum IS NOT NULL AND netto IS NOT NULL AND ust IS NOT NULL AND brutto IS NOT NULL
  AND (zahlstatus='bezahlt' OR faellig_am IS NOT NULL)
 )
);
