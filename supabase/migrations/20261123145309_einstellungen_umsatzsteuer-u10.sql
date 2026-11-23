-- U10: Der vorhandene Firmensteuersatz bleibt die Quelle für den Regelsatz.
-- Der neue Vorgabewert gilt für Neueinträge. Vorhandene NULL-Werte bleiben erhalten.
ALTER TABLE public.company_settings
  ALTER COLUMN invoice_vat_rate_basis_points SET DEFAULT 1900,
  ADD COLUMN invoice_reduced_vat_rate_basis_points integer NOT NULL DEFAULT 700,
  ADD CONSTRAINT company_settings_invoice_reduced_vat_rate_chk
    CHECK (invoice_reduced_vat_rate_basis_points BETWEEN 1 AND 10000);

COMMENT ON COLUMN public.company_settings.invoice_reduced_vat_rate_basis_points IS
  'U10: Ermäßigter Satz in Basispunkten. Eine neue Position zu diesem Satz benötigt eine belegte Begründung.';
