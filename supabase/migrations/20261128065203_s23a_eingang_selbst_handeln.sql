-- S23a: use the tenant's existing company settings for automatic intake assignment.
ALTER TABLE public.company_settings ADD COLUMN eingang_selbst_handeln boolean NOT NULL DEFAULT true;
