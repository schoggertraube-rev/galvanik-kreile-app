-- PREPARED, NOT REMOTELY APPLIED.
-- Makes the tenant key part of every persisted marketing relationship.
-- The server runtime uses a BYPASSRLS role, so these constraints are a
-- second, database-enforced barrier against cross-tenant graph edges.
-- Pre-contract campaign/channel/segment/action/learning rows were already
-- preserved as truth_status = 'legacy_unverified' by 20260715000550. Assigning
-- their storage tenant here is required for referential integrity and does not
-- promote them into verified application reads.

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

DO $tenant_columns$
DECLARE
  relation_name text;
  marketing_relations constant text[] := ARRAY[
    'kampagne', 'kanal', 'segment', 'aktion', 'touchpoint', 'attribution',
    'lern_metrik', 'einwilligung', 'telemetrie_event', 'marketing_asset',
    'feedback_mail', 'feedback_eingang', 'statistik_kennzahl'
  ];
BEGIN
  FOREACH relation_name IN ARRAY marketing_relations LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id text',
      relation_name
    );
    EXECUTE format(
      'UPDATE public.%I
         SET tenant_id = %L
       WHERE tenant_id IS NULL OR btrim(tenant_id) = %L',
      relation_name,
      'galvanik-kreile',
      ''
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT %L',
      relation_name,
      'galvanik-kreile'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL',
      relation_name
    );
  END LOOP;
END
$tenant_columns$;

CREATE UNIQUE INDEX IF NOT EXISTS kampagne_tenant_id_uidx
  ON public.kampagne (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS kanal_tenant_id_uidx
  ON public.kanal (tenant_id, id);
DO $instagram_channel_preflight$
BEGIN
  IF EXISTS (
    SELECT tenant_id
    FROM public.kanal
    WHERE typ = 'instagram'
    GROUP BY tenant_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'MARKETING_CHANNEL_RECONCILIATION_REQUIRED: more than one Instagram channel exists for a tenant';
  END IF;
END
$instagram_channel_preflight$;
CREATE UNIQUE INDEX IF NOT EXISTS kanal_instagram_tenant_uidx
  ON public.kanal (tenant_id)
  WHERE typ = 'instagram';
CREATE UNIQUE INDEX IF NOT EXISTS segment_tenant_id_uidx
  ON public.segment (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS aktion_tenant_id_uidx
  ON public.aktion (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS touchpoint_tenant_id_uidx
  ON public.touchpoint (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS inquiries_tenant_id_uidx
  ON public.inquiries (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_id_uidx
  ON public.orders (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_id_uidx
  ON public.customers (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS marketing_asset_tenant_id_uidx
  ON public.marketing_asset (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS feedback_mail_tenant_id_uidx
  ON public.feedback_mail (tenant_id, id);

DO $relationship_preflight$
DECLARE
  invalid_links text;
BEGIN
  SELECT string_agg(DISTINCT link_name, ', ' ORDER BY link_name)
  INTO invalid_links
  FROM (
    SELECT 'aktion.kampagne_id' AS link_name
    FROM public.aktion child
    LEFT JOIN public.kampagne parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.kampagne_id
    WHERE child.kampagne_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'aktion.kanal_id'
    FROM public.aktion child
    LEFT JOIN public.kanal parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.kanal_id
    WHERE child.kanal_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'aktion.segment_id'
    FROM public.aktion child
    LEFT JOIN public.segment parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.segment_id
    WHERE child.segment_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'touchpoint.aktion_id'
    FROM public.touchpoint child
    LEFT JOIN public.aktion parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.aktion_id
    WHERE child.aktion_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'touchpoint.kanal_id'
    FROM public.touchpoint child
    LEFT JOIN public.kanal parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.kanal_id
    WHERE child.kanal_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'attribution.touchpoint_id'
    FROM public.attribution child
    LEFT JOIN public.touchpoint parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.touchpoint_id
    WHERE child.touchpoint_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'attribution.lead_id'
    FROM public.attribution child
    LEFT JOIN public.inquiries parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.lead_id
    WHERE child.lead_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'attribution.auftrag_id'
    FROM public.attribution child
    LEFT JOIN public.orders parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.auftrag_id
    WHERE child.auftrag_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'einwilligung.kunde_id'
    FROM public.einwilligung child
    LEFT JOIN public.customers parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.kunde_id
    WHERE parent.id IS NULL
    UNION ALL
    SELECT 'marketing_asset.auftrag_id'
    FROM public.marketing_asset child
    LEFT JOIN public.orders parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.auftrag_id
    WHERE child.auftrag_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'marketing_asset.kunde_id'
    FROM public.marketing_asset child
    LEFT JOIN public.customers parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.kunde_id
    WHERE child.kunde_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'marketing_asset.segment_id'
    FROM public.marketing_asset child
    LEFT JOIN public.segment parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.segment_id
    WHERE child.segment_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'feedback_mail.auftrag_id'
    FROM public.feedback_mail child
    LEFT JOIN public.orders parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.auftrag_id
    WHERE child.auftrag_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'feedback_mail.kunde_id'
    FROM public.feedback_mail child
    LEFT JOIN public.customers parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.kunde_id
    WHERE child.kunde_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'feedback_mail.segment_id'
    FROM public.feedback_mail child
    LEFT JOIN public.segment parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.segment_id
    WHERE child.segment_id IS NOT NULL AND parent.id IS NULL
    UNION ALL
    SELECT 'feedback_eingang.feedback_mail_id'
    FROM public.feedback_eingang child
    LEFT JOIN public.feedback_mail parent
      ON parent.tenant_id = child.tenant_id AND parent.id = child.feedback_mail_id
    WHERE child.feedback_mail_id IS NOT NULL AND parent.id IS NULL
  ) invalid;

  IF invalid_links IS NOT NULL THEN
    RAISE EXCEPTION
      'MARKETING_TENANT_RECONCILIATION_REQUIRED: invalid or cross-tenant links: %',
      invalid_links;
  END IF;
END
$relationship_preflight$;

ALTER TABLE public.aktion
  DROP CONSTRAINT IF EXISTS aktion_kampagne_id_fkey,
  DROP CONSTRAINT IF EXISTS aktion_kanal_id_fkey,
  DROP CONSTRAINT IF EXISTS aktion_segment_id_fkey,
  DROP CONSTRAINT IF EXISTS aktion_tenant_kampagne_fkey,
  DROP CONSTRAINT IF EXISTS aktion_tenant_kanal_fkey,
  DROP CONSTRAINT IF EXISTS aktion_tenant_segment_fkey,
  ADD CONSTRAINT aktion_tenant_kampagne_fkey
    FOREIGN KEY (tenant_id, kampagne_id)
    REFERENCES public.kampagne (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT aktion_tenant_kanal_fkey
    FOREIGN KEY (tenant_id, kanal_id)
    REFERENCES public.kanal (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT aktion_tenant_segment_fkey
    FOREIGN KEY (tenant_id, segment_id)
    REFERENCES public.segment (tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE public.touchpoint
  DROP CONSTRAINT IF EXISTS touchpoint_aktion_id_fkey,
  DROP CONSTRAINT IF EXISTS touchpoint_kanal_id_fkey,
  DROP CONSTRAINT IF EXISTS touchpoint_tenant_aktion_fkey,
  DROP CONSTRAINT IF EXISTS touchpoint_tenant_kanal_fkey,
  ADD CONSTRAINT touchpoint_tenant_aktion_fkey
    FOREIGN KEY (tenant_id, aktion_id)
    REFERENCES public.aktion (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT touchpoint_tenant_kanal_fkey
    FOREIGN KEY (tenant_id, kanal_id)
    REFERENCES public.kanal (tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE public.attribution
  DROP CONSTRAINT IF EXISTS attribution_touchpoint_id_fkey,
  DROP CONSTRAINT IF EXISTS attribution_lead_id_fkey,
  DROP CONSTRAINT IF EXISTS attribution_auftrag_id_fkey,
  DROP CONSTRAINT IF EXISTS attribution_tenant_touchpoint_fkey,
  DROP CONSTRAINT IF EXISTS attribution_tenant_lead_fkey,
  DROP CONSTRAINT IF EXISTS attribution_tenant_auftrag_fkey,
  ADD CONSTRAINT attribution_tenant_touchpoint_fkey
    FOREIGN KEY (tenant_id, touchpoint_id)
    REFERENCES public.touchpoint (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT attribution_tenant_lead_fkey
    FOREIGN KEY (tenant_id, lead_id)
    REFERENCES public.inquiries (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT attribution_tenant_auftrag_fkey
    FOREIGN KEY (tenant_id, auftrag_id)
    REFERENCES public.orders (tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE public.einwilligung
  DROP CONSTRAINT IF EXISTS einwilligung_kunde_id_fkey,
  DROP CONSTRAINT IF EXISTS einwilligung_tenant_kunde_fkey,
  ADD CONSTRAINT einwilligung_tenant_kunde_fkey
    FOREIGN KEY (tenant_id, kunde_id)
    REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE public.marketing_asset
  DROP CONSTRAINT IF EXISTS marketing_asset_auftrag_id_fkey,
  DROP CONSTRAINT IF EXISTS marketing_asset_kunde_id_fkey,
  DROP CONSTRAINT IF EXISTS marketing_asset_segment_id_fkey,
  DROP CONSTRAINT IF EXISTS marketing_asset_tenant_auftrag_fkey,
  DROP CONSTRAINT IF EXISTS marketing_asset_tenant_kunde_fkey,
  DROP CONSTRAINT IF EXISTS marketing_asset_tenant_segment_fkey,
  ADD CONSTRAINT marketing_asset_tenant_auftrag_fkey
    FOREIGN KEY (tenant_id, auftrag_id)
    REFERENCES public.orders (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT marketing_asset_tenant_kunde_fkey
    FOREIGN KEY (tenant_id, kunde_id)
    REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT marketing_asset_tenant_segment_fkey
    FOREIGN KEY (tenant_id, segment_id)
    REFERENCES public.segment (tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE public.feedback_mail
  DROP CONSTRAINT IF EXISTS feedback_mail_auftrag_id_fkey,
  DROP CONSTRAINT IF EXISTS feedback_mail_kunde_id_fkey,
  DROP CONSTRAINT IF EXISTS feedback_mail_segment_id_fkey,
  DROP CONSTRAINT IF EXISTS feedback_mail_tenant_auftrag_fkey,
  DROP CONSTRAINT IF EXISTS feedback_mail_tenant_kunde_fkey,
  DROP CONSTRAINT IF EXISTS feedback_mail_tenant_segment_fkey,
  ADD CONSTRAINT feedback_mail_tenant_auftrag_fkey
    FOREIGN KEY (tenant_id, auftrag_id)
    REFERENCES public.orders (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT feedback_mail_tenant_kunde_fkey
    FOREIGN KEY (tenant_id, kunde_id)
    REFERENCES public.customers (tenant_id, id) ON DELETE RESTRICT,
  ADD CONSTRAINT feedback_mail_tenant_segment_fkey
    FOREIGN KEY (tenant_id, segment_id)
    REFERENCES public.segment (tenant_id, id) ON DELETE RESTRICT;

ALTER TABLE public.feedback_eingang
  DROP CONSTRAINT IF EXISTS feedback_eingang_feedback_mail_id_fkey,
  DROP CONSTRAINT IF EXISTS feedback_eingang_tenant_feedback_mail_fkey,
  ADD CONSTRAINT feedback_eingang_tenant_feedback_mail_fkey
    FOREIGN KEY (tenant_id, feedback_mail_id)
    REFERENCES public.feedback_mail (tenant_id, id) ON DELETE RESTRICT;
