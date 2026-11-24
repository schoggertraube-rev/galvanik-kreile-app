-- Teil 1 speichert den neuen Steuerkatalog, schaltet ihn aber noch nicht frei.
-- Die bestehende Rechnungs- und Positionskette akzeptiert bis STEUER-KETTE
-- ausschließlich ihre bislang belegten Sätze. Die 13 importierten SQL-Originale
-- bleiben bytegleich; diese additive Folge stellt den alten DB-Guard wieder her.
ALTER TABLE public.company_settings
  DROP CONSTRAINT company_settings_invoice_vat_rate_chk,
  ADD CONSTRAINT company_settings_invoice_vat_rate_chk
    CHECK (invoice_vat_rate_basis_points IN (700, 1900));

ALTER TABLE public.catalog_services
  DROP CONSTRAINT catalog_services_vat_chk,
  ADD CONSTRAINT catalog_services_vat_chk
    CHECK (vat_rate_basis_points IN (0, 700, 1900));
