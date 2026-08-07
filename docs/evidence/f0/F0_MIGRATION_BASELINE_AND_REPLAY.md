# F0_MIGRATION_BASELINE_AND_REPLAY â€” Fresh-Replay + ParitÃ¤ts-Fingerprint

**Datum:** 2026-08-06
**Baseline-Set (3 Migrationen):**
1. `PROD_BASELINE_2026-08-06.sql` (public+private Schema, +pg_trgm)
2. `PROD_LOCKDOWN_GRANTS.sql` (Data-API-Lockdown, Grantsâ†’0)
3. `PROD_STORAGE_POLICIES.sql` (4 storage.objects RLS-Policies â€” NEU, siehe Befund)

**Testinstanz:** lokales Supabase (Docker), leere DB.

## Fresh-Replay (leer â†’ Ziel)
- `supabase start` (2 VorlÃ¤ufe) und final mit allen 3 Migrationen: **kein ERROR**, Stack healthy.

## Deterministischer ParitÃ¤ts-Fingerprint (Replay vs. Prod, read-only)
Katalog-basiert (kein pg_dump; PG17-`\restrict`-Zufallstoken umgangen). Voll-Fingerprint Ã¼ber
Tabellen/Views/Sequences + Funktionen + **alle** RLS-Policies + Grants:

| | Wert |
|---|---|
| **Prod** | `7c6bbd55e1e80a4aaee974075f7cec4e` (71 Policies) |
| **Replay (Baseline+Lockdown+Storage-Policies)** | `7c6bbd55e1e80a4aaee974075f7cec4e` (71 Policies) |
| **Match** | âœ… **exakt identisch** |

Komponenten einzeln zuvor bestÃ¤tigt: rels `cc607a56`, funcs `265d29f6`, grants 0, sequences 0 â€” je Replay==Prod.

## Befund + Behebung (korrigiert #119/#123)
- **Erst-Fund:** Baseline (nur public+private) reproduzierte die **4 `storage.objects`-RLS-Policies**
  (`scan_objects_insert/select/update/service_role_all`) **nicht** â†’ Fingerprint wich ab. Mein frÃ¼heres
  â€žBaseline = Prod" war auf der Storage-Policy-Ebene unvollstÃ¤ndig.
- **Behebung:** Die 4 Policies exakt aus Prod (`pg_get_expr`) extrahiert und als idempotente Migration
  `PROD_STORAGE_POLICIES.sql` ergÃ¤nzt. (public+private-Policy-Satz war identisch: alte Baseline vs.
  frischer Prod-Dump = 0 Diff, je 67.)
- **Verifiziert:** Voll-Fingerprint Replay == Prod (`7c6bbd55â€¦`), 71 == 71 Policies.

**Damit gilt jetzt belegt: Baseline+Lockdown+Storage-Policies = Prod** auf Tabellen/Views/Sequences/
Funktionen/**Policies (inkl. Storage)**/Grants â€” deterministisch, reproduzierbar aus leerer DB.

## Rest fÃ¼r F0-03/04 (weiterhin offen, freigabepflichtig)
1. **Fingerprint-Gate in CI**: bei jedem Build Replay-md5 == hinterlegter Prod-md5 (`7c6bbd55â€¦`).
2. **Ledger-Reconciliation (F0-04)**: die 3 Baseline-Migrationen + Historie ledgerfÃ¤hig ordnen
   (Baseline VOR den 96 Ledgerzeilen; A1/A2 aus PLAN_118). **Remote-Ledger-Eintrag = Freigabe nÃ¶tig.**
3. **Referenzdaten-Inventar** (Seeds/Config) getrennt, freigabepflichtig.

## Sauberkeit
Alle lokalen Stacks gestoppt, Replay-/Redump-Klone gelÃ¶scht. Prod ausschlieÃŸlich read-only.
DB-Passwort nach Nutzung weiterhin zur Rotation empfohlen.