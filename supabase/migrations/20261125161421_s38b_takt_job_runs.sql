-- Laufbelege und Reservierung für den zentralen Zeitauslöser.
CREATE TABLE public.takt_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  job_schluessel text NOT NULL CHECK (job_schluessel ~ '^[a-z][a-z0-9_.]{1,79}$'),
  faellig_fuer text NOT NULL CHECK (faellig_fuer ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2})?$'),
  gestartet_um timestamptz NOT NULL,
  beendet_um timestamptz,
  status text NOT NULL CHECK (status IN ('läuft','ok','fehler','abgebrochen','übersprungen')),
  versuch integer NOT NULL CHECK (versuch BETWEEN 1 AND 4),
  fehlercode text CHECK (fehlercode IS NULL OR fehlercode ~ '^[a-z_]{1,60}$'),
  dauer_ms integer CHECK (dauer_ms IS NULL OR dauer_ms >= 0),
  reserviert_bis timestamptz,
  CONSTRAINT takt_job_runs_due_unique UNIQUE (tenant_id,job_schluessel,faellig_fuer)
);
CREATE INDEX takt_job_runs_last_ok ON public.takt_job_runs(tenant_id,job_schluessel,beendet_um DESC)
  WHERE status='ok' AND beendet_um IS NOT NULL;
CREATE INDEX takt_job_runs_tenant_started ON public.takt_job_runs(tenant_id,gestartet_um DESC,id DESC);
ALTER TABLE public.takt_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.takt_job_runs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.takt_job_runs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.takt_job_runs TO service_role;
