-- RLS Phase 1 Migration
-- Skipping table: public.ausgangsrechnung_position (STOP: Missing tenant_id column, reported to Siglinder)

-- 1. Table: events
DO $events$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON public.events;
    CREATE POLICY tenant_isolation ON public.events
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END
$events$;

-- 2. Table: communications
DO $communications$
BEGIN
  IF to_regclass('public.communications') IS NOT NULL THEN
    ALTER TABLE public.communications ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS tenant_isolation ON public.communications;
    CREATE POLICY tenant_isolation ON public.communications
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END
$communications$;

-- 3. Table: arbeitszeit_buchung
ALTER TABLE arbeitszeit_buchung ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON arbeitszeit_buchung;
CREATE POLICY tenant_isolation ON arbeitszeit_buchung
  USING (tenant_id = current_setting('app.tenant_id', true));

-- 4. Table: konto
ALTER TABLE konto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON konto;
CREATE POLICY tenant_isolation ON konto
  USING (tenant_id = current_setting('app.tenant_id', true));
