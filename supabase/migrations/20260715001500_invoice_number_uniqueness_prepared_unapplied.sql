-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Invoice numbers are business identities and must be unique inside the tenant.

DO $validation$
BEGIN
  IF to_regclass('public.ausgangsrechnung') IS NULL THEN
    RAISE EXCEPTION 'Required table public.ausgangsrechnung is missing';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.ausgangsrechnung
    GROUP BY tenant_id, nummer
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate invoice numbers must be resolved before applying this migration';
  END IF;
END
$validation$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ausgangsrechnung_tenant_nummer
  ON public.ausgangsrechnung (tenant_id, nummer);
