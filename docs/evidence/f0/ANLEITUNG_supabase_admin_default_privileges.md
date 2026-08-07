# Anleitung: supabase_admin Default Privileges schlieÃŸen (einmalig, du)

**Problem:** `supabase_admin` hat Default Privileges, die **kÃ¼nftige** `public`-Objekte automatisch fÃ¼r
`anon`/`authenticated` freigeben kÃ¶nnten. Nur Ã¼ber Owner/Dashboard lÃ¶sbar (deshalb bisher extern).

## Schritt 1 â€” AusfÃ¼hren (Supabase Dashboard â†’ SQL Editor)
Kopiere und fÃ¼hre aus:

```sql
alter default privileges for role supabase_admin in schema public revoke all on tables from anon, authenticated;
alter default privileges for role supabase_admin in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role supabase_admin in schema public revoke all on functions from anon, authenticated;
```

## Schritt 2 â€” Verifizieren (im selben SQL Editor)
```sql
select defaclrole::regrole as owner_role, defaclobjtype as objtype, array_to_string(defaclacl::text[], ', ') as acl
from pg_default_acl da join pg_namespace n on n.oid = da.defaclnamespace
where n.nspname = 'public' order by 1,2;
```
**Erwartung:** in den Zeilen fÃ¼r `supabase_admin` dÃ¼rfen **keine** `anon`/`authenticated`-EintrÃ¤ge mehr stehen.

## Falls Schritt 1 mit â€žpermission denied" fehlschlÃ¤gt
Dann kann auch der Dashboard-`postgres` die Default Privileges von `supabase_admin` nicht Ã¤ndern â†’
es ist ein **Supabase-Support-/Owner-Vorgang** (Ticket: â€žALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin
revoke anon/authenticated in schema public"). Bitte kurz RÃ¼ckmeldung, dann dokumentiere ich es als
Support-Blocker statt als offene LÃ¼cke.

## Danach
Melde mir das Ergebnis (Schritt 2). Ich nehme die Default-Privilege-PrÃ¼fung dann als **PASS** in den
Fingerprint/Ledger auf (schlieÃŸt die `def_privs`-Divergenz im F0-Fingerprint).