-- PREPARED ONLY: do not apply remotely without explicit approval.
-- Finance data is authorized by the database-backed app session in Server Actions.
-- Browser roles must not bypass that boundary through the Supabase Data API.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE public.beleg
  ADD COLUMN IF NOT EXISTS ocr_rohtext text,
  ADD COLUMN IF NOT EXISTS ocr_positionen jsonb,
  ADD COLUMN IF NOT EXISTS rechnungsnummer_extern text;

ALTER TABLE public.ausgangsrechnung
  ADD COLUMN IF NOT EXISTS lead_id text;

CREATE TABLE IF NOT EXISTS public.ausgangsrechnung_position (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ausgangsrechnung_id uuid NOT NULL
    REFERENCES public.ausgangsrechnung(id) ON DELETE RESTRICT,
  beschreibung text NOT NULL,
  menge numeric(12,2) NOT NULL DEFAULT 1,
  einzelpreis_netto numeric(12,2) NOT NULL
);

DO $payment_contract$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zahlung' AND column_name = 'typ'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zahlung' AND column_name = 'richtung'
  ) THEN
    ALTER TABLE public.zahlung RENAME COLUMN typ TO richtung;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zahlung' AND column_name = 'typ'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM public.zahlung
      WHERE richtung IS NOT NULL
        AND typ IS NOT NULL
        AND richtung IS DISTINCT FROM typ
    ) THEN
      RAISE EXCEPTION
        'FINANCE_SOURCE_RECONCILIATION_REQUIRED: zahlung.typ and zahlung.richtung disagree';
    END IF;
    UPDATE public.zahlung SET richtung = typ WHERE richtung IS NULL;
    ALTER TABLE public.zahlung ALTER COLUMN typ DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zahlung' AND column_name = 'zahlungsart'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zahlung' AND column_name = 'art'
  ) THEN
    ALTER TABLE public.zahlung RENAME COLUMN zahlungsart TO art;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zahlung' AND column_name = 'bank_referenz'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'zahlung' AND column_name = 'bank_umsatz_ref'
  ) THEN
    ALTER TABLE public.zahlung RENAME COLUMN bank_referenz TO bank_umsatz_ref;
  END IF;
END
$payment_contract$;

ALTER TABLE public.zahlung
  ADD COLUMN IF NOT EXISTS richtung text,
  ADD COLUMN IF NOT EXISTS art text,
  ADD COLUMN IF NOT EXISTS bank_umsatz_ref text,
  ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

DO $payment_truth$
BEGIN
  IF EXISTS (SELECT 1 FROM public.zahlung WHERE richtung IS NULL OR btrim(richtung) = '') THEN
    RAISE EXCEPTION
      'FINANCE_SOURCE_RECONCILIATION_REQUIRED: payment direction is missing';
  END IF;
END
$payment_truth$;

ALTER TABLE public.zahlung
  ALTER COLUMN richtung SET NOT NULL;

-- The bookkeeping actions and global search use this canonical source table.
-- It was present in the TypeScript schema but absent from the SQL history,
-- which made those paths fail on every fresh database.
CREATE TABLE IF NOT EXISTS public.kostenposten (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  bezeichnung text NOT NULL,
  art text NOT NULL,
  kategorie text,
  betrag numeric(12,2) NOT NULL,
  intervall text NOT NULL,
  beleg_id uuid REFERENCES public.beleg(id),
  kampagne_id uuid,
  gilt_ab date,
  gilt_bis date,
  is_demo boolean NOT NULL DEFAULT false
);

ALTER TABLE public.kostenposten
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'galvanik-kreile';

DO $migration$
DECLARE
  table_name text;
  policy_name text;
  finance_tables constant text[] := ARRAY[
    'beleg',
    'beleg_position',
    'kraftstoff_detail',
    'ausgangsrechnung',
    'ausgangsrechnung_position',
    'zahlung',
    'kategorie',
    'lieferant',
    'steuerprofil',
    'ustva_periode',
    'export_lauf',
    'bh_audit_log',
    'bh_einstellungen',
    'kostenposten'
  ];
BEGIN
  FOREACH table_name IN ARRAY finance_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);

    FOR policy_name IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = table_name
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', policy_name, table_name);
    END LOOP;

    EXECUTE format(
      'REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role',
      table_name
    );
  END LOOP;
END
$migration$;

-- The service role is only used after requireFinanceRead() has validated the
-- current app user, role, active state and fixed tenant. No DELETE permission
-- is granted for GoBD-relevant finance records.
GRANT SELECT, INSERT, UPDATE ON TABLE public.beleg TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.beleg_position TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.kraftstoff_detail TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ausgangsrechnung TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ausgangsrechnung_position TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.zahlung TO service_role;
GRANT SELECT ON TABLE public.kategorie TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.lieferant TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.steuerprofil TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ustva_periode TO service_role;
GRANT SELECT, INSERT ON TABLE public.export_lauf TO service_role;
GRANT SELECT, INSERT ON TABLE public.bh_audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.bh_einstellungen TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.kostenposten TO service_role;

DO $verification$
DECLARE
  exposed_count integer;
BEGIN
  SELECT count(*)
  INTO exposed_count
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
    AND table_name = ANY (ARRAY[
      'beleg', 'beleg_position', 'kraftstoff_detail', 'ausgangsrechnung',
      'ausgangsrechnung_position', 'zahlung', 'kategorie', 'lieferant',
      'steuerprofil', 'ustva_periode', 'export_lauf', 'bh_audit_log',
      'bh_einstellungen', 'kostenposten'
    ])
    AND grantee IN ('anon', 'authenticated');

  IF exposed_count <> 0 THEN
    RAISE EXCEPTION 'Finance Data API boundary still exposes % grants', exposed_count;
  END IF;
END
$verification$;
