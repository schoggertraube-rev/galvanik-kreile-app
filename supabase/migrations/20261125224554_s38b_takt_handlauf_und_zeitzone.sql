-- Handaufrufe erhalten eigene Belege; die Automatik behält eindeutige Termine.
ALTER TABLE public.takt_job_runs
  DROP CONSTRAINT takt_job_runs_faellig_fuer_check,
  DROP CONSTRAINT takt_job_runs_due_unique;

ALTER TABLE public.takt_job_runs
  ADD CONSTRAINT takt_job_runs_faellig_fuer_check CHECK (
    faellig_fuer ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}[+-][0-9]{2}:[0-9]{2})?$'
    OR (job_schluessel='heute_neuaufbau' AND faellig_fuer ~ '^hand:[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}Z$')
    OR (beendet_um IS NOT NULL AND faellig_fuer ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$')
  );

CREATE UNIQUE INDEX takt_job_runs_due_unique ON public.takt_job_runs (tenant_id,job_schluessel,faellig_fuer)
  WHERE faellig_fuer NOT LIKE 'hand:%';

DROP INDEX public.takt_job_runs_last_ok;
CREATE INDEX takt_job_runs_last_ok ON public.takt_job_runs (tenant_id,job_schluessel,faellig_fuer DESC)
  WHERE status='ok' AND beendet_um IS NOT NULL AND length(faellig_fuer)=10;

CREATE POLICY takt_job_runs_tenant ON public.takt_job_runs
  USING (tenant_id=current_setting('app.tenant_id',true))
  WITH CHECK (tenant_id=current_setting('app.tenant_id',true));
