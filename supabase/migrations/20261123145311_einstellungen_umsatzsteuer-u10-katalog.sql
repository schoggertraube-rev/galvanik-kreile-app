-- Die alten Werte bleiben gültig. Neue Katalogsätze werden im Mandantenbefehl
-- gegen die beiden gespeicherten Firmensätze oder den Nullsatz abgeglichen.
ALTER TABLE public.company_settings
  DROP CONSTRAINT company_settings_invoice_vat_rate_chk,
  ADD CONSTRAINT company_settings_invoice_vat_rate_chk
    CHECK (invoice_vat_rate_basis_points BETWEEN 1 AND 10000);

ALTER TABLE public.catalog_services
  DROP CONSTRAINT catalog_services_vat_chk,
  ADD CONSTRAINT catalog_services_vat_chk
    CHECK (vat_rate_basis_points BETWEEN 0 AND 10000);
