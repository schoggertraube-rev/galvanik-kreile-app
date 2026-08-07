# F0 — Prod-Härtung ANGEWENDET (Audit-Artefakt, 2026-08-07)

**Status:** PASS. Der irreversible Remote-Prod-DDL-Block ("Punkt 1") wurde mit ausdrücklicher
Nutzerfreigabe ("mach prod block weiter") ausgeführt und verifiziert. Prod und Repo `main` sind
jetzt konsistent gehärtet.

## Was auf PROD angewendet wurde (Supabase `apply_migration`, aufgezeichnet im Prod-Ledger)

### Stufe 1 — RLS-CONTRACT-Härtung (`f0_05_rls_contract_hardening`)
Inhalt = `f0_evidence/hardening/F0_05_RLS_CONTRACT_TENANT_ID.sql` (begin/commit entfernt).
- Gruppe A: 3 redundante breite Policies gedroppt (inquiries: auth_all_inquiries, public_all_inquiries_final; items: public_all_items_final).
- Gruppe B: 8 tenant_id-Tabellen breit→tenant-gebunden (`tenant_id = current_setting('app.tenant_id', true)`; varchar via `::text`; kpi_snapshots SELECT-only).
- Gruppe C: 15 Buchhaltung/Config-Tabellen ohne tenant_id → aktiver-App-User-Vertrag (`auth.uid() in (select id from public.app_users where active is true)`); bh_audit_log append-only (nur INSERT+SELECT).
- **Verifiziert:** `broad_still_present=0`, `new_policies_present=29`.

### Stufe 2 — Storage + View (`f0_06_storage_view_hardening`)
- Bucket `item-photos`: file_size_limit 12 MiB, mime jpeg/png/webp.
- Bucket `buchhaltung-belege`: file_size_limit 5 MiB, mime pdf/png/jpeg.
- `alter view public.v_auftrag_db set (security_invoker = on)`.
- **Verifiziert:** Bucket-Limits gesetzt; `v_auftrag_db_invoker='on'`.

### Sicherheits-Lint nach Härtung (`get_advisors`, security)
Keine NEUEN Findings aus der Härtung. Bestand: 13× `rls_enabled_no_policy` (INFO, deny-all/fail-closed,
sicher), 2× WARN vorbestehend (pg_trgm im public-Schema; leaked-password-protection deaktiviert — beides
vor der Härtung vorhanden, nicht durch sie verursacht).

## Fingerprint-Konsequenz
Nur Komponente `pol` änderte sich (a6bf6244 → **af7dd29ef35db3ec25297d54b999ba32**), alle 9 anderen
unverändert. Referenz `docs/evidence/f0/PROD_FINGERPRINT_REFERENCE.txt` in PR #50 read-only-verifiziert
nachgezogen. Die 6 hart-gegateten Kernkomponenten (cols/idx/func/rls/grants/func_grants) matchen weiter
byte-exakt → CI-Gate „quality/Fresh Supabase replay" grün auf allen Merge-Commits.

## Repo-Zustand
- `main = 0391cd51` — enthält F0-03/04-Baseline (#49), F0-05/06-Härtung + Fingerprint-Referenz (#50),
  F0-07 modulare Grenze (#51). Alle drei PRs squash-gemergt, Feature-Branches gelöscht.

## Warum inert auf realen App-Pfaden (Defense-in-Depth, kein Regressionsrisiko)
anon/authenticated haben 0 Tabellen-Grants (Grant-Entzug vor RLS). Reale Pfade laufen über Drizzle
(`DATABASE_URL`, privilegiert) und `service_role` (bypassrls). Die neuen Policies sind daher
Verteidigung in der Tiefe; sie sperren keinen produktiven Pfad aus und öffnen keinen Leak.

## Red-Team-Verifikation nach Merge (2026-08-07, unabhängiger Recheck)
Repo (read-only Klon von main 0391cd51): Referenzdatei korrekt (pol=af7dd29e, alter Wert nirgends mehr),
Ledger-Check PASS, Boundary-Check PASS (625 Dateien), Fingerprint-Gate in quality.yml hart (pipefail,
kein continue-on-error am Gate-Step; das continue-on-error betrifft nur den Artifact-Upload).
Prod (read-only SQL + Advisors, project `syhaigjhsbpjmtnggqka`): 29 Härtungspolicies vorhanden; die
verbleibenden 23 `USING(true) FOR ALL`-Policies sind ausnahmslos `TO service_role` (bypassrls → No-Op,
bewusst außer Scope); Ledger 98 = 96 Original + 2 Härtung; Buckets + v_auftrag_db-invoker korrekt;
Advisors unverändert (nur Vorbestand). **Kein neuer Befund.**

### Dokumentierte Nuance: Gruppe-C-Policies + app_users-RLS
`public.app_users` hat RLS enabled und **0 Policies** (deny-all). Die Gruppe-C-Policies
(`auth.uid() in (select id from public.app_users where active is true)`) laufen für `authenticated`
mit dessen Rechten → die app_users-Subquery ist RLS-blockiert → liefert leer → Policy evaluiert false.
**Effekt: Gruppe C ist für `authenticated` effektiv deny-all — strenger als beabsichtigt, fail-closed,
kein Leak.** Reale App-Pfade (Drizzle/service_role) sind unberührt. Falls später echte
authenticated-Clients auf Buchhaltungstabellen zugreifen sollen, braucht app_users zuerst eine
schmale SELECT-Self-Policy (bewusste Produktentscheidung, nicht in F0).

### Selbst gefundener Prozessfehler (behoben)
Nach Kontext-Kompaktierung wurde eine falsche Supabase-project_id verwendet; MCP-„permission denied"
wurde zunächst fehlgedeutet. Korrigiert via `list_projects`; kanonische IDs jetzt persistent notiert.
Regel: nach Kompaktierung IDs nie rekonstruieren, immer nachschlagen.

## Offen / bewusst zurückgestellt (nicht in diesem Block)
1. **Prod-Ledger-Rekonziliation (delikat):** Prod `supabase_migrations.schema_migrations` trägt weiter
   die 96 Original-Zeilen + die 2 Härtungs-Zeilen (MCP-eigene Timestamps, nicht die Repo-Timestamps
   `20260807090000/090100`). Für spätere `db push`-Fähigkeit müsste Prod-Ledger = aktive Repo-Menge
   gemacht werden (delete 96 Legacy-Zeilen, insert Baseline-Struktur). Tooling-Hygiene, kein Sicherheits-
   oder Datenrisiko. Separat, bewusst deliberiert ausführen.
2. **def_privs (`supabase_admin`):** extern (Dashboard permission denied), optional Supabase-Support.
3. **DB-Passwort rotieren** nach F0-Abschluss (aktuell noch gültig).
4. **Leaked-Password-Protection** (Supabase Auth, WARN im Advisor): Empfehlung aktivieren —
   Auth-Konfigurationsänderung, vom Betreiber im Dashboard zu setzen (Auth → Passwords).
