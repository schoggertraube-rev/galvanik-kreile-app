-- PREPARED, NOT REMOTELY APPLIED.
-- Materializes the marketing/CRM source relations that were previously
-- declared only in Drizzle or an out-of-band TypeScript migration.

BEGIN;

CREATE TABLE IF NOT EXISTS public.kampagne (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  truth_status text NOT NULL DEFAULT 'verified',
  name text NOT NULL,
  ziel text,
  zeitraum_von date,
  zeitraum_bis date,
  budget numeric(12,2) DEFAULT 0,
  status text NOT NULL DEFAULT 'geplant',
  is_demo boolean NOT NULL DEFAULT false,
  erstellt_am timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.kanal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  truth_status text NOT NULL DEFAULT 'verified',
  typ text NOT NULL,
  name text NOT NULL,
  verbunden boolean NOT NULL DEFAULT false,
  config jsonb,
  access_token_encrypted text,
  status text DEFAULT 'nicht_verbunden',
  erstellt_am timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.segment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  truth_status text NOT NULL DEFAULT 'verified',
  name text NOT NULL,
  icon text,
  farbe text DEFAULT '#e91e63',
  beschreibung text,
  filter_regel jsonb,
  is_demo boolean NOT NULL DEFAULT false,
  erstellt_am timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.aktion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  truth_status text NOT NULL DEFAULT 'verified',
  kampagne_id uuid REFERENCES public.kampagne(id) ON DELETE SET NULL,
  typ text NOT NULL,
  kanal_id uuid REFERENCES public.kanal(id) ON DELETE SET NULL,
  segment_id uuid REFERENCES public.segment(id) ON DELETE SET NULL,
  titel text NOT NULL,
  inhalt jsonb,
  status text NOT NULL DEFAULT 'vorschlag',
  erwarteter_output numeric(12,2),
  aufwand_min integer DEFAULT 0,
  kosten_budget numeric(12,2),
  budget_status text NOT NULL DEFAULT 'not_measured',
  budget_measured_at timestamp without time zone,
  budget_source text,
  score numeric(6,2) DEFAULT 0,
  freigegeben_von text,
  geplant_fuer timestamp without time zone,
  ausgefuehrt_am timestamp without time zone,
  is_demo boolean NOT NULL DEFAULT false,
  erstellt_am timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.touchpoint (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  aktion_id uuid REFERENCES public.aktion(id) ON DELETE SET NULL,
  kanal_id uuid REFERENCES public.kanal(id) ON DELETE SET NULL,
  externe_ref text,
  utm_campaign text,
  utm_source text,
  utm_medium text,
  reichweite integer,
  klicks integer,
  metrics_status text NOT NULL DEFAULT 'not_measured',
  metrics_measured_at timestamp without time zone,
  metrics_source text,
  ausgefuehrt_am timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  touchpoint_id uuid REFERENCES public.touchpoint(id) ON DELETE SET NULL,
  lead_id text REFERENCES public.inquiries(id) ON DELETE SET NULL,
  auftrag_id text REFERENCES public.orders(id) ON DELETE SET NULL,
  umsatz numeric(12,2),
  revenue_status text NOT NULL DEFAULT 'not_measured',
  revenue_measured_at timestamp without time zone,
  revenue_source text,
  modell text DEFAULT 'last_click',
  erstellt_am timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lern_metrik (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  truth_status text NOT NULL DEFAULT 'verified',
  dimension text NOT NULL,
  wert text NOT NULL,
  aktionen integer NOT NULL DEFAULT 0,
  anfragen integer NOT NULL DEFAULT 0,
  umsatz numeric(12,2) DEFAULT 0,
  konfidenz numeric(5,2) DEFAULT 0,
  aktualisiert_am timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.einwilligung (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  kunde_id text NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  kanal text NOT NULL,
  status text NOT NULL DEFAULT 'widerrufen',
  quelle text NOT NULL,
  nachweis text,
  zeitpunkt timestamp without time zone NOT NULL DEFAULT now(),
  erstellt_am timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.telemetrie_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  event_typ text NOT NULL,
  meta jsonb,
  zeitpunkt timestamp without time zone NOT NULL DEFAULT now(),
  is_anonym boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.marketing_asset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  quelle text NOT NULL,
  auftrag_id text REFERENCES public.orders(id) ON DELETE SET NULL,
  kunde_id text REFERENCES public.customers(id) ON DELETE SET NULL,
  segment_id uuid REFERENCES public.segment(id) ON DELETE SET NULL,
  storage_pfad text NOT NULL,
  typ text NOT NULL,
  freigabe_marketing boolean NOT NULL DEFAULT false,
  qualitaet_score numeric(4,2) DEFAULT 0,
  erstellt_am timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feedback_mail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  auftrag_id text REFERENCES public.orders(id) ON DELETE SET NULL,
  kunde_id text REFERENCES public.customers(id) ON DELETE SET NULL,
  segment_id uuid REFERENCES public.segment(id) ON DELETE SET NULL,
  ankunft_quelle text,
  ankunft_am timestamp without time zone,
  geplant_fuer timestamp without time zone,
  status text NOT NULL DEFAULT 'geplant',
  gesendet_am timestamp without time zone,
  token_upload text,
  token_feedback text,
  einwilligung_ok boolean NOT NULL DEFAULT false,
  erstellt_am timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feedback_eingang (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  feedback_mail_id uuid REFERENCES public.feedback_mail(id) ON DELETE SET NULL,
  zufriedenheit integer,
  google_bewertung_geklickt boolean NOT NULL DEFAULT false,
  fotos_hochgeladen integer NOT NULL DEFAULT 0,
  freitext text,
  eingegangen_am timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.statistik_kennzahl (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL DEFAULT 'galvanik-kreile',
  metrik text NOT NULL,
  periode text NOT NULL,
  wert numeric(12,2) NOT NULL,
  quelle text,
  aktualisiert_am timestamp without time zone NOT NULL DEFAULT now()
);

-- Existing marketing tables predate the provenance contract and may contain
-- rows auto-generated by the former ensureMarketingData() path. Preserve every
-- row, but quarantine all pre-contract source objects fail-closed. Fresh tables
-- already carry "verified"; new writes receive "verified" after this upgrade.
DO $legacy_marketing_source_quarantine$
DECLARE
  relation_name text;
  source_relations constant text[] := ARRAY[
    'kampagne', 'kanal', 'segment', 'aktion', 'lern_metrik'
  ];
BEGIN
  FOREACH relation_name IN ARRAY source_relations LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS truth_status text',
      relation_name
    );
    EXECUTE format(
      'UPDATE public.%I
          SET truth_status = %L
        WHERE truth_status IS NULL
           OR truth_status NOT IN (%L, %L)',
      relation_name,
      'legacy_unverified',
      'verified',
      'legacy_unverified'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN truth_status SET DEFAULT %L',
      relation_name,
      'verified'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN truth_status SET NOT NULL',
      relation_name
    );
  END LOOP;
END
$legacy_marketing_source_quarantine$;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS quelle_typ text NOT NULL DEFAULT 'unbekannt',
  ADD COLUMN IF NOT EXISTS quelle_touchpoint_id uuid,
  ADD COLUMN IF NOT EXISTS quelle_manuell text,
  ADD COLUMN IF NOT EXISTS quelle_konfidenz numeric(5,2);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS inquiry_id text;

ALTER TABLE public.kostenposten
  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'galvanik-kreile';

ALTER TABLE public.touchpoint
  ADD COLUMN IF NOT EXISTS reichweite integer,
  ADD COLUMN IF NOT EXISTS klicks integer,
  ADD COLUMN IF NOT EXISTS metrics_status text NOT NULL DEFAULT 'not_measured',
  ADD COLUMN IF NOT EXISTS metrics_measured_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS metrics_source text,
  ALTER COLUMN reichweite DROP DEFAULT,
  ALTER COLUMN reichweite DROP NOT NULL,
  ALTER COLUMN klicks DROP DEFAULT,
  ALTER COLUMN klicks DROP NOT NULL;

ALTER TABLE public.attribution
  ADD COLUMN IF NOT EXISTS umsatz numeric(12,2),
  ADD COLUMN IF NOT EXISTS revenue_status text NOT NULL DEFAULT 'not_measured',
  ADD COLUMN IF NOT EXISTS revenue_measured_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS revenue_source text,
  ALTER COLUMN umsatz DROP DEFAULT,
  ALTER COLUMN umsatz DROP NOT NULL;

ALTER TABLE public.aktion
  ADD COLUMN IF NOT EXISTS budget_status text,
  ADD COLUMN IF NOT EXISTS budget_measured_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS budget_source text,
  ALTER COLUMN kosten_budget DROP DEFAULT,
  ALTER COLUMN kosten_budget DROP NOT NULL;

UPDATE public.aktion
SET budget_status = CASE
      WHEN kosten_budget IS NULL THEN 'not_measured'
      ELSE 'legacy_unverified'
    END
WHERE budget_status IS NULL
   OR budget_status NOT IN ('not_measured', 'measured', 'legacy_unverified');

ALTER TABLE public.aktion
  ALTER COLUMN budget_status SET DEFAULT 'not_measured',
  ALTER COLUMN budget_status SET NOT NULL;

UPDATE public.touchpoint
SET metrics_status = 'legacy_unverified'
WHERE metrics_status = 'not_measured'
  AND metrics_measured_at IS NULL
  AND (reichweite IS NOT NULL OR klicks IS NOT NULL);

UPDATE public.attribution
SET revenue_status = 'legacy_unverified'
WHERE revenue_status = 'not_measured'
  AND revenue_measured_at IS NULL
  AND umsatz IS NOT NULL;

DO $measurement_constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.touchpoint'::regclass
      AND conname = 'touchpoint_measurement_truth_check'
  ) THEN
    ALTER TABLE public.touchpoint
      ADD CONSTRAINT touchpoint_measurement_truth_check
      CHECK (
        metrics_status IN ('not_measured', 'measured', 'legacy_unverified')
        AND (reichweite IS NULL OR reichweite >= 0)
        AND (klicks IS NULL OR klicks >= 0)
        AND (
          metrics_status <> 'not_measured'
          OR (reichweite IS NULL AND klicks IS NULL)
        )
        AND (
          metrics_status <> 'measured'
          OR (
            metrics_measured_at IS NOT NULL
            AND NULLIF(BTRIM(metrics_source), '') IS NOT NULL
            AND (reichweite IS NOT NULL OR klicks IS NOT NULL)
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.attribution'::regclass
      AND conname = 'attribution_revenue_truth_check'
  ) THEN
    ALTER TABLE public.attribution
      ADD CONSTRAINT attribution_revenue_truth_check
      CHECK (
        revenue_status IN ('not_measured', 'measured', 'legacy_unverified')
        AND (revenue_status <> 'not_measured' OR umsatz IS NULL)
        AND (
          revenue_status <> 'measured'
          OR (
            revenue_measured_at IS NOT NULL
            AND NULLIF(BTRIM(revenue_source), '') IS NOT NULL
            AND umsatz IS NOT NULL
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.aktion'::regclass
      AND conname = 'aktion_budget_truth_check'
  ) THEN
    ALTER TABLE public.aktion
      ADD CONSTRAINT aktion_budget_truth_check
      CHECK (
        truth_status IN ('verified', 'legacy_unverified')
        AND budget_status IN ('not_measured', 'measured', 'legacy_unverified')
        AND (kosten_budget IS NULL OR kosten_budget >= 0)
        AND (budget_status <> 'not_measured' OR kosten_budget IS NULL)
        AND (
          budget_status <> 'measured'
          OR (
            budget_measured_at IS NOT NULL
            AND NULLIF(BTRIM(budget_source), '') IS NOT NULL
            AND kosten_budget IS NOT NULL
          )
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.kampagne'::regclass
      AND conname = 'kampagne_truth_status_check'
  ) THEN
    ALTER TABLE public.kampagne
      ADD CONSTRAINT kampagne_truth_status_check
      CHECK (truth_status IN ('verified', 'legacy_unverified'));
    ALTER TABLE public.kanal
      ADD CONSTRAINT kanal_truth_status_check
      CHECK (truth_status IN ('verified', 'legacy_unverified'));
    ALTER TABLE public.segment
      ADD CONSTRAINT segment_truth_status_check
      CHECK (truth_status IN ('verified', 'legacy_unverified'));
    ALTER TABLE public.lern_metrik
      ADD CONSTRAINT lern_metrik_truth_status_check
      CHECK (truth_status IN ('verified', 'legacy_unverified'));
  END IF;
END
$measurement_constraints$;

CREATE UNIQUE INDEX IF NOT EXISTS touchpoint_tenant_id_uidx
  ON public.touchpoint (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS inquiries_tenant_id_uidx
  ON public.inquiries (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS kampagne_tenant_id_uidx
  ON public.kampagne (tenant_id, id);

DO $connection_constraints$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.inquiries inquiry
    LEFT JOIN public.touchpoint source
      ON source.tenant_id = inquiry.tenant_id
     AND source.id = inquiry.quelle_touchpoint_id
    WHERE inquiry.quelle_touchpoint_id IS NOT NULL
      AND source.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'MARKETING_SOURCE_RECONCILIATION_REQUIRED: inquiry touchpoint is missing or belongs to another tenant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders target_order
    LEFT JOIN public.inquiries inquiry
      ON inquiry.tenant_id = target_order.tenant_id
     AND inquiry.id = target_order.inquiry_id
    WHERE target_order.inquiry_id IS NOT NULL
      AND inquiry.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'MARKETING_SOURCE_RECONCILIATION_REQUIRED: order inquiry is missing or belongs to another tenant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.kostenposten cost
    LEFT JOIN public.kampagne campaign
      ON campaign.tenant_id = cost.tenant_id
     AND campaign.id = cost.kampagne_id
    WHERE cost.kampagne_id IS NOT NULL
      AND campaign.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'MARKETING_FINANCE_RECONCILIATION_REQUIRED: cost campaign is missing or belongs to another tenant';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.ausgangsrechnung invoice
    LEFT JOIN public.inquiries inquiry
      ON inquiry.tenant_id = invoice.tenant_id
     AND inquiry.id = invoice.lead_id
    WHERE invoice.lead_id IS NOT NULL
      AND inquiry.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'MARKETING_FINANCE_RECONCILIATION_REQUIRED: invoice lead is missing or belongs to another tenant';
  END IF;

  ALTER TABLE public.inquiries
    DROP CONSTRAINT IF EXISTS inquiries_quelle_touchpoint_fkey;
  ALTER TABLE public.inquiries
    ADD CONSTRAINT inquiries_quelle_touchpoint_fkey
    FOREIGN KEY (tenant_id, quelle_touchpoint_id)
    REFERENCES public.touchpoint (tenant_id, id)
    ON DELETE RESTRICT;

  ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_inquiry_fkey;
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_inquiry_fkey
    FOREIGN KEY (tenant_id, inquiry_id)
    REFERENCES public.inquiries (tenant_id, id)
    ON DELETE RESTRICT;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.kostenposten'::regclass
      AND conname = 'kostenposten_tenant_kampagne_fkey'
  ) THEN
    ALTER TABLE public.kostenposten
      ADD CONSTRAINT kostenposten_tenant_kampagne_fkey
      FOREIGN KEY (tenant_id, kampagne_id)
      REFERENCES public.kampagne (tenant_id, id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ausgangsrechnung'::regclass
      AND conname = 'ausgangsrechnung_tenant_lead_fkey'
  ) THEN
    ALTER TABLE public.ausgangsrechnung
      ADD CONSTRAINT ausgangsrechnung_tenant_lead_fkey
      FOREIGN KEY (tenant_id, lead_id)
      REFERENCES public.inquiries (tenant_id, id)
      ON DELETE RESTRICT;
  END IF;
END
$connection_constraints$;

CREATE INDEX IF NOT EXISTS touchpoint_tenant_executed_idx
  ON public.touchpoint (tenant_id, ausgefuehrt_am DESC);
CREATE INDEX IF NOT EXISTS kostenposten_tenant_campaign_idx
  ON public.kostenposten (tenant_id, kampagne_id);
CREATE INDEX IF NOT EXISTS inquiries_quelle_touchpoint_idx
  ON public.inquiries (tenant_id, quelle_touchpoint_id);
CREATE INDEX IF NOT EXISTS orders_inquiry_idx
  ON public.orders (tenant_id, inquiry_id);
CREATE INDEX IF NOT EXISTS ausgangsrechnung_tenant_lead_idx
  ON public.ausgangsrechnung (tenant_id, lead_id);

COMMIT;
