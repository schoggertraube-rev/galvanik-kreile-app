-- S09 / Owner: initial EUR 10.00 net once per shipment. NULL is deliberately
-- unconfigured and never replaced with a product-code default; explicit zero stays zero.
ALTER TABLE public.company_settings
 ADD COLUMN versand_pauschale_netto_cents integer DEFAULT 1000
 CHECK (versand_pauschale_netto_cents IS NULL OR versand_pauschale_netto_cents>=0);
