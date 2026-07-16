\set ON_ERROR_STOP on

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END
$roles$;

DO $tables$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'kampagne', 'kanal', 'segment', 'aktion', 'touchpoint', 'attribution',
    'lern_metrik', 'einwilligung', 'telemetrie_event', 'marketing_asset',
    'feedback_mail', 'feedback_eingang', 'statistik_kennzahl'
  ] LOOP
    EXECUTE format('CREATE TABLE public.%I (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY)', table_name);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY old_open ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', table_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role', table_name);
  END LOOP;
END
$tables$;
