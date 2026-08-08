# F0_PERMISSION_PACKET — extern blockierte Berechtigungen (2026-08-08)

## Blocker 1: Default Privileges der Rolle `supabase_admin` (F0-A05-Teilaspekt)
**Befund:** `pg_default_acl` enthält Einträge `FOR ROLE supabase_admin`, die zukünftig von
`supabase_admin` erzeugte Objekte breit an `anon`/`authenticated` granten würden.
**Behebungsversuch (Evidenz):** `ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin …` als `postgres`
→ `ERROR 42501: permission denied to change default privileges` (2026-08-06, MCP + SQL-Editor;
Dashboard ebenfalls permission denied). `postgres` ist auf Supabase kein Mitglied von
`supabase_admin`; die Änderung ist nur plattformseitig möglich.
**Status: `BLOCKED_EXTERNAL_PERMISSION`** — korrekt gemeldet gemäß Ratifizierer-Auflage 2.

**Kompensierende Kontrollen (aktiv):**
1. Alle BESTEHENDEN Objekte: 0 Grants für anon/authenticated (verifiziert, CI-Negativtest A).
2. Fingerprint-Komponente `grants` CI-hart: jede neue Grant-Abweichung im Replay bricht CI.
3. Neue Objekte entstehen ausschließlich über Repo-Migrationen (laufen als `postgres`, nicht
   `supabase_admin`) — der gefährliche Pfad (Objekterzeugung durch supabase_admin) ist im
   normalen Betrieb nicht aktiv; er beträfe nur Supabase-interne Provisionierung.
4. Empfohlene periodische Live-Prüfung (Betreiber, monatlich): Grants-Fingerprint gegen Referenz.

**Eskalationsweg (Betreiber):** Supabase-Support-Ticket, Vorlage:
> Project ref syhaigjhsbpjmtnggqka. Please remove/neutralize the default privileges defined
> FOR ROLE supabase_admin granting to anon/authenticated in schema public (pg_default_acl),
> or advise how the project owner can do so. We enforce a zero-grant contract for these roles.

## Blocker 2: Leaked-Password-Protection (Advisor WARN, informativ)
Auth-Konfiguration, nur im Dashboard durch Betreiber aktivierbar (Auth → Passwords). Empfohlen.

## Kein Blocker (zur Abgrenzung)
`cons/trig/pol` Fingerprint-Komponenten = known-normalization (PG-Parse-Tree, bewiesen);
keine Berechtigung fehlt, byte-Parität ist technisch unerreichbar, semantische Parität belegt.
