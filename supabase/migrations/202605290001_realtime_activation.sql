-- ============================================================================
-- Supabase Realtime Activation
-- Datum: 2026-05-29
-- Zweck: Aktivierung der Postgres Changes für Live-Sync auf mehreren Geräten
-- ============================================================================

BEGIN;

-- Fallback: Publication löschen, falls sie falsch konfiguriert war
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Publication neu anlegen (Standardname für Supabase Realtime)
CREATE PUBLICATION supabase_realtime;

-- Tabellen hinzufügen, für die wir INSERT, UPDATE, DELETE Events wollen
ALTER PUBLICATION supabase_realtime ADD TABLE customers, orders, items;
DO $events$
BEGIN
  IF to_regclass('public.events') IS NOT NULL THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
  END IF;
END
$events$;

COMMIT;
