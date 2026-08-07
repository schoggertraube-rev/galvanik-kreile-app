-- Data-API Grant-Lockdown — reproduzierbare Form der Prod-Massnahmen (#86/#87/#88)
-- ZWINGEND zusammen mit der Schema-Baseline anzuwenden.
--
-- Grund (empirisch belegt 2026-08-06): Ein reiner Schema-Dump reproduziert den
-- Prod-Zustand "0 Grants an anon/authenticated" NICHT. Auf einer frischen Supabase-
-- Instanz vergeben die plattformseitigen Default Privileges alle public-Objekte
-- (94 Tabellen + 17 Views = 111) automatisch an anon UND authenticated zurueck
-- (Fresh-Replay-Messung: 666 Grants). Diese Migration entzieht sie wieder auf 0.
--
-- Verifiziert: nach Anwendung im Fresh-Replay -> 0 Grants (= Produktion).
-- Idempotent / replay-safe.

-- 1) Bestehende Tabellen- und View-Rechte entziehen
revoke all on all tables in schema public from anon, authenticated;

-- 2) Kuenftige Objekte fail-closed (Default Privileges)
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- Hinweis (nicht hier loesbar): Die supabase_admin-Default-Privileges auf Cluster-
-- Ebene (SUPABASE-ADMIN-DEFAULTPRIV-001) sind nur ueber Dashboard/Owner adressierbar
-- und bleiben ein separater, extern zu klaerender Punkt.
