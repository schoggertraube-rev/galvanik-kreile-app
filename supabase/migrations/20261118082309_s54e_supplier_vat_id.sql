-- PL18Nov09:21 S54e: VAT identity is supplier metadata, not a money permission.
-- Only the old supplier VAT-is-NULL clause changes; every other boundary remains.
ALTER TABLE public.customers DROP CONSTRAINT customers_lieferant_felder_chk;
ALTER TABLE public.customers ADD CONSTRAINT customers_lieferant_felder_chk CHECK (
  (type = 'lieferant' AND payment_preference IS NULL AND billing_email IS NULL AND handover_preference IS NULL)
  OR (type <> 'lieferant' AND iban IS NULL AND zahlungsziel_tage IS NULL)
);
