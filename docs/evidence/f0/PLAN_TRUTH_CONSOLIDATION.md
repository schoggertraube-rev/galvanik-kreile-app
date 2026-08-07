# F0 Truth-Consolidation â€” geschÃ¤rfter Plan (Red-Team-geprÃ¼ft, 2026-08-07)

**Ziel unverÃ¤ndert (kein Drift):** F0 GREEN = beweisbares Fundament auf einem Commit. Dieser Plan schlieÃŸt
die vom externen Review + eigenem Red-Team belegten LÃ¼cken. Ein PR, unabhÃ¤ngige Review, Merge mit Freigabe.

## Red-Team-Korrekturen am ursprÃ¼nglichen Plan (Ã¼bernommen)
1. **Kein Parallelmechanismus fÃ¼r die Baseline.** PR #40 definiert bereits den Ziel-Vertrag:
   `supabase/migrations_legacy/` (Archiv der 96+ Altmigrationen mit SHA-Manifest) + **eine**
   `production_schema_baseline` als ERSTE aktive Migration + aktualisierter `check-migration-ledger.mjs`
   (BASELINE_NAME-Vertrag). `main` trÃ¤gt noch den alten Check (verifiziert via API, blob 4e171155).
   â†’ **F0-04 = PR-#40-MECHANIK salvagen**, Inhalt = meine bewiesene Baseline vom 06.08.
   (public+private + pg_trgm + Storage-Policies + Lockdown; PR-#40-Baseline ist vom 05.08., vor D1/D2 â†’ veraltet).
   Meine 20260101-vor-96-Idee und die supabase/baseline/-Alternative sind **verworfen**.
2. **ParitÃ¤t vor HÃ¤rtung:** Baseline stellt exakten Prod-Ist her (service_role VOLL auf den 3 RPC-Tabellen,
   **per role_table_grants belegen**, nicht annehmen). Least-Privilege-REVOKE = separate Forward-Migration
   (Nutzer-Entscheidung liegt vor, Anwendung nach Baseline-Merge).
3. **Replay-Beweis = CI, nicht Transkript:** CI-Job â€žfresh-replay": leere DB â†’ Baseline â†’ Fingerprint-SQL â†’
   Vergleich gegen **committete Prod-Referenzdatei** (kein Prod-Zugriff aus CI). Referenz-Update-Verfahren
   dokumentieren (Re-Attestierung read-only bei Prod-Change), sonst wird die Referenz zur neuen LÃ¼ge.
4. **CRLF hart verhindern:** `.gitattributes` â†’ `*.sql text eol=lf`. Hash nur noch vom LF-Repo-Artefakt
   (aktuell: `29896f7143bd9937994d4bd0f6e9675707694539b9c0039c347dcc6b31c6193d`).
5. **cons/trig-Diff:** timeboxed Stichprobe (1-2 Definitionen nebeneinander), Normalisierungsart benennen
   oder echten Unterschied ausweisen. Kein â€žvermutlich" mehr.
6. **Docs-Truth:** NICHT alle Altberichte umschreiben (Scope-Creep). Alte als SUPERSEDED markieren;
   **ein** kanonisches Dokument mit A01â€“A15-Matrix; %-Angaben nur aus der Matrix.
7. **Fingerprint-LÃ¼cken explizit:** grants mit Funktionssignatur, security_invoker-Status, Bucket-Config
   aufnehmen; Extensions/Sequenzen/Kommentare/Matviews als bewusst-out-of-scope deklarieren.
8. **Review-Urteile persistieren** (Datei im PR), keine â€žunabhÃ¤ngige Review"-Behauptung ohne Artefakt.

## Bereits erledigt (dieser Block)
- Views-Messfehler korrigiert: 16/17 bereits security_invoker=true; HÃ¤rtung = nur `v_auftrag_db` (verifiziert).
- Migration + Matrix entsprechend korrigiert.

## Reihenfolge (ein PR `f0/truth-consolidation`)
1. Quick-Fixes: Views-Korrektur + Hash-Rebind + `.gitattributes` eol=lf committen.
2. service_role-ParitÃ¤t in Baseline (belegt), Least-Privilege als separate Migration danebenlegen.
3. PR-#40-Salvage: Archiv + Baseline-Vertrag + neuer Ledger-Check, Baseline-Inhalt 06.08.
4. CI â€žfresh-replay"-Job + erweitertes Fingerprint-SQL + committete Prod-Referenz.
5. cons/trig-Stichprobe. 6. Kanonisches A01â€“A15-Statusdokument, Altdocs SUPERSEDED.
7. Red-Team-Review (persistiert) â†’ Freigabe â†’ Merge.

## Drift-Wache
Nicht in diesem PR: RLS-Contract-Bau (separat, Spec liegt), UI/Features, Offline, E2E-Kernweg,
Remote-Anwendungen auf Prod (alle erst nach Baseline-Merge + Freigabe).