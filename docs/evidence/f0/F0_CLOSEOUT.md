# F0 CLOSEOUT — Fundament-Abschlusserklaerung (2026-08-07)

**Status: PASS mit dokumentierten Klassen.** Ein Commit auf `main` traegt das beweisbare Fundament.
Unabhaengige Red-Team-Review dieses PRs: persistiert als PR-Kommentar (F0-11-Vertrag: ein Writer, ein
unabhaengiger read-only Reviewer).

## Erfuellt (F0-01..08, Evidence im Repo)
- 01/02 Preflight, Driftinventur, PR-Konsolidierung: docs/evidence/f0/ (F0_PRECHECK, F0_PR_CONSOLIDATION_MATRIX).
- 03/04 DB-Wahrheit: Prod-Baseline replayt fresh aus Null; definitorischer Fingerprint 6/10 Komponenten
  byte-exakt = Prod, CI-hart (fingerprint-compare.mjs); Ledger-Vertrag (Archiv 96 + Baseline + Forward). (PR #49)
- 05/06 Security/Storage: RLS-CONTRACT-Haertung (29 Policies) + Bucket-Limits + v_auftrag_db
  security_invoker als aktive Migrationen 20260807090000/090100; am 2026-08-07 mit Freigabe auf Prod
  angewendet und read-only verifiziert (F0_PROD_HARDENING_APPLIED.md); CI-Negativtests verankern den
  Vertrag als Regressionsschutz (dieser PR). (PRs #50, #52)
- 07 Modulare Grenze: kanonische Admin-Client-Factory (src/lib/supabase/admin.ts), CI-Boundary-Gate
  (check-supabase-client-boundary.mjs), Modulmanifest-Schema + erfassung-Beispiel. (PR #51)
- 08 Test-Evidence: konsolidierte Gate-Tabelle (F0_TEST_EVIDENCE.md) + scripts/quality/f0_negative_tests.sql
  im Fresh-Replay-CI-Job.

## Dokumentierte Klassen (kein Blocker, ehrlich ausgewiesen)
- cons/trig/pol: known-normalization (PG-Parse-Tree-Folding; semantisch identisch, Objektmengen geprueft;
  byte-Paritaet per Replay bewiesenermassen unerreichbar).
- def_privs: known-external (supabase_admin; nur via Supabase-Support aenderbar, Dashboard permission denied).
- app_users-RLS-Nuance: Gruppe-C-Policies effektiv deny-all fuer authenticated (Subquery RLS-blockiert);
  fail-closed, inert auf realen Pfaden (Drizzle/service_role); Aufweitung = spaetere Produktentscheidung.

## Nicht Teil von F0 (Betreiber/Folgearbeit)
1. DB-Passwort-Rotation (Betreiber; nach F0-Abschluss faellig).
2. Prod-Ledger-Rekonziliation (96 Legacy-Zeilen -> db-push-Faehigkeit; tooling-hygiene, deliberiert separat).
3. Leaked-Password-Protection aktivieren (Supabase Dashboard -> Auth -> Passwords; Betreiber).
4. Tenant-Fixture-Negativtests, Modul-Extraktion/Baukasten, E2E-Kernweg: F1.
