-- PREPARED, NOT REMOTELY APPLIED.
-- Makes finalized receipt amounts fail closed and gives reviewed fuel details a
-- single, auditable source row. Existing contradictory rows must be reconciled
-- explicitly; this migration never guesses or backfills accounting values.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
SET LOCAL search_path = pg_catalog, pg_temp;

DO $truth_preflight$
BEGIN
  IF to_regclass('public.beleg') IS NULL
     OR to_regclass('public.kraftstoff_detail') IS NULL THEN
    RAISE EXCEPTION 'FINANCE_TRUTH_PREREQUISITE_MISSING';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.beleg receipt
    WHERE receipt.status NOT IN ('pruefen', 'erfasst', 'festgeschrieben', 'storniert')
  ) THEN
    RAISE EXCEPTION 'FINANCE_TRUTH_RECONCILIATION_REQUIRED: invalid receipt status';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.beleg receipt
    WHERE receipt.status = 'festgeschrieben'
      AND (
        receipt.lieferant_text IS NULL
        OR btrim(receipt.lieferant_text) = ''
        OR receipt.belegdatum IS NULL
        OR receipt.brutto IS NULL
        OR receipt.netto IS NULL
        OR receipt.ust_satz IS NULL
        OR receipt.ust_betrag IS NULL
        OR receipt.vorsteuer_abzug IS NULL
        OR receipt.skr_konto IS NULL
        OR receipt.skr_konto !~ '^[0-9]{1,9}$'
        OR receipt.brutto::text IN ('NaN', 'Infinity', '-Infinity')
        OR receipt.netto::text IN ('NaN', 'Infinity', '-Infinity')
        OR receipt.ust_satz::text IN ('NaN', 'Infinity', '-Infinity')
        OR receipt.ust_betrag::text IN ('NaN', 'Infinity', '-Infinity')
        OR receipt.brutto <= 0
        OR receipt.netto < 0
        OR receipt.ust_satz NOT IN (0, 7, 19)
        OR receipt.ust_betrag < 0
        OR (
          receipt.vorsteuer_abzug
          AND (
            receipt.absetzbar_prozent IS NULL
            OR receipt.absetzbar_prozent::text IN ('NaN', 'Infinity', '-Infinity')
            OR receipt.absetzbar_prozent < 0
            OR receipt.absetzbar_prozent > 100
          )
        )
        OR abs(receipt.brutto - receipt.netto - receipt.ust_betrag) > 0.01
      )
  ) THEN
    RAISE EXCEPTION 'FINANCE_TRUTH_RECONCILIATION_REQUIRED: finalized receipt is incomplete or contradictory';
  END IF;

  IF EXISTS (
    SELECT detail.beleg_id
    FROM public.kraftstoff_detail detail
    GROUP BY detail.beleg_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'FINANCE_TRUTH_RECONCILIATION_REQUIRED: duplicate fuel detail';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.kraftstoff_detail detail
    WHERE detail.sorte IS NULL
       OR detail.sorte NOT IN ('diesel', 'super', 'superplus', 'adblue', 'unbekannt')
       OR detail.liter IS NULL
       OR detail.liter::text IN ('NaN', 'Infinity', '-Infinity')
       OR detail.liter <= 0
       OR (
         detail.preis_pro_liter IS NOT NULL
         AND (
           detail.preis_pro_liter::text IN ('NaN', 'Infinity', '-Infinity')
           OR detail.preis_pro_liter <= 0
         )
       )
  ) THEN
    RAISE EXCEPTION 'FINANCE_TRUTH_RECONCILIATION_REQUIRED: invalid fuel detail';
  END IF;
END
$truth_preflight$;

ALTER TABLE public.beleg
  DROP CONSTRAINT IF EXISTS beleg_status_chk,
  DROP CONSTRAINT IF EXISTS beleg_finalized_truth_chk;

ALTER TABLE public.beleg
  ADD CONSTRAINT beleg_status_chk
    CHECK (status IN ('pruefen', 'erfasst', 'festgeschrieben', 'storniert')) NOT VALID,
  ADD CONSTRAINT beleg_finalized_truth_chk
    CHECK (
      status <> 'festgeschrieben'
      OR (
        lieferant_text IS NOT NULL
        AND btrim(lieferant_text) <> ''
        AND belegdatum IS NOT NULL
        AND brutto IS NOT NULL
        AND netto IS NOT NULL
        AND ust_satz IS NOT NULL
        AND ust_betrag IS NOT NULL
        AND vorsteuer_abzug IS NOT NULL
        AND skr_konto IS NOT NULL
        AND skr_konto ~ '^[0-9]{1,9}$'
        AND brutto::text NOT IN ('NaN', 'Infinity', '-Infinity')
        AND netto::text NOT IN ('NaN', 'Infinity', '-Infinity')
        AND ust_satz::text NOT IN ('NaN', 'Infinity', '-Infinity')
        AND ust_betrag::text NOT IN ('NaN', 'Infinity', '-Infinity')
        AND brutto > 0
        AND netto >= 0
        AND ust_satz IN (0, 7, 19)
        AND ust_betrag >= 0
        AND (
          NOT vorsteuer_abzug
          OR (
            absetzbar_prozent IS NOT NULL
            AND absetzbar_prozent::text NOT IN ('NaN', 'Infinity', '-Infinity')
            AND absetzbar_prozent >= 0
            AND absetzbar_prozent <= 100
          )
        )
        AND abs(brutto - netto - ust_betrag) <= 0.01
      )
    ) NOT VALID;

ALTER TABLE public.beleg VALIDATE CONSTRAINT beleg_status_chk;
ALTER TABLE public.beleg VALIDATE CONSTRAINT beleg_finalized_truth_chk;

ALTER TABLE public.kraftstoff_detail
  ALTER COLUMN sorte SET NOT NULL,
  ALTER COLUMN liter SET NOT NULL,
  DROP CONSTRAINT IF EXISTS kraftstoff_detail_sorte_chk,
  DROP CONSTRAINT IF EXISTS kraftstoff_detail_liter_positive_chk,
  DROP CONSTRAINT IF EXISTS kraftstoff_detail_preis_positive_chk;

ALTER TABLE public.kraftstoff_detail
  ADD CONSTRAINT kraftstoff_detail_sorte_chk
    CHECK (sorte IN ('diesel', 'super', 'superplus', 'adblue', 'unbekannt')) NOT VALID,
  ADD CONSTRAINT kraftstoff_detail_liter_positive_chk
    CHECK (
      liter::text NOT IN ('NaN', 'Infinity', '-Infinity')
      AND liter > 0
    ) NOT VALID,
  ADD CONSTRAINT kraftstoff_detail_preis_positive_chk
    CHECK (
      preis_pro_liter IS NULL
      OR (
        preis_pro_liter::text NOT IN ('NaN', 'Infinity', '-Infinity')
        AND preis_pro_liter > 0
      )
    ) NOT VALID;

ALTER TABLE public.kraftstoff_detail VALIDATE CONSTRAINT kraftstoff_detail_sorte_chk;
ALTER TABLE public.kraftstoff_detail VALIDATE CONSTRAINT kraftstoff_detail_liter_positive_chk;
ALTER TABLE public.kraftstoff_detail VALIDATE CONSTRAINT kraftstoff_detail_preis_positive_chk;

CREATE UNIQUE INDEX IF NOT EXISTS kraftstoff_detail_beleg_id_uidx
  ON public.kraftstoff_detail (beleg_id);

DO $truth_verification$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint constraint_record
    WHERE constraint_record.conrelid IN (
      'public.beleg'::regclass,
      'public.kraftstoff_detail'::regclass
    )
      AND constraint_record.conname IN (
        'beleg_status_chk',
        'beleg_finalized_truth_chk',
        'kraftstoff_detail_sorte_chk',
        'kraftstoff_detail_liter_positive_chk',
        'kraftstoff_detail_preis_positive_chk'
      )
      AND NOT constraint_record.convalidated
  ) THEN
    RAISE EXCEPTION 'FINANCE_TRUTH_VERIFICATION_FAILED: unvalidated constraint';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_class index_record
    JOIN pg_namespace namespace_record ON namespace_record.oid = index_record.relnamespace
    JOIN pg_index index_meta ON index_meta.indexrelid = index_record.oid
    WHERE namespace_record.nspname = 'public'
      AND index_record.relname = 'kraftstoff_detail_beleg_id_uidx'
      AND index_meta.indisunique
      AND index_meta.indisvalid
  ) THEN
    RAISE EXCEPTION 'FINANCE_TRUTH_VERIFICATION_FAILED: fuel identity index';
  END IF;
END
$truth_verification$;
