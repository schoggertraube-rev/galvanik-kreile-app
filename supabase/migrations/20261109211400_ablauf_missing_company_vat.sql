-- PL09.11.21:45: a missing company VAT rate stays missing; never manufacture 19%.
-- Existing configuration values and all allowed-rate checks are retained.
ALTER TABLE public.company_settings
 ALTER COLUMN invoice_vat_rate_basis_points DROP DEFAULT,
 ALTER COLUMN invoice_vat_rate_basis_points DROP NOT NULL;
