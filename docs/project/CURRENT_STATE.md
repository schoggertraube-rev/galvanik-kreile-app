# CURRENT_STATE — Galvanik-Kreile WerkstattCockpit

**Massgeblicher Stand: 2026-08-10.** Diese Datei wurde nach dem Befundbericht 2026-08-10 vollstaendig
neu geschrieben (BF-004). Fruehere Fassungen sind ausschliesslich Git-Historie; kein Absatz dieser
Datei beschreibt einen ueberholten Zustand als aktuell. Konsistenz wird durch das CI-Gate
`scripts/quality/check-f0-doc-truth.mjs` erzwungen.

## F0-Fundament (Repo + Production)

| Wahrheit | Stand |
|---|---|
| main | ae47f3ded22e6a29d695b48d3e67ca39c37a8b3f; einziger offener Foundation-PR: #57 (f0/befund-fixes) |
| Production-Deployment | ae47f3de aktiv (Vercel dpl_7vwbgEJrPJhYHf9RcuLWswBr1EbT, READY, target=production) |
| Supabase Prod | syhaigjhsbpjmtnggqka; Ledger 9/9 = aktive Repo-Migrationen (Digest 268ce6c1d87a7d020d68369eac20b2b4) |
| Migrationswahrheit | PASS: Fresh-Replay aus Null, im CI DOPPELT mit identischem Digest (9dc1067b…) |
| Schema-Paritaet | 7 HARTE Fingerprint-Komponenten = Prod (cols/idx/func/rls/grants/func_grants/viewopts); cons/trig/pol known-normalization, def_privs known-external |
| Data API | 0 direkte anon/authenticated-Privileges auf allen public-Tabellen/Views (relationsweiter CI-Test); USAGE auf Schema public besteht (Supabase-Standard, kompensiert) |
| RLS | 29 Haertungspolicies; Tenant-Fixture-Matrix ueber alle 8 tenant_isolation-Tabellen im CI; vollstaendige Kategorisierung aller tenant_id-Tabellen in F0_TENANT_COVERAGE.json mit Live-Abgleich-Gate |
| Views | 17/17 security_invoker (einheitlich `true`, am 10.08. normalisiert; Aufloesung des Audit-Befunds BF-001 s. F0_FINAL_REPORT) |
| Storage | 4 private Buckets, Limits/MIME gesetzt; ECHTE HTTP-Negativmatrix S1–S12 im CI (inkl. Signed-URL expired/manipuliert/fremd) |
| Auth/Session | 6/6 PIN bcrypt; echte Session-Kette V1–V5 im CI (Login-POST, Cookie-Denials, Rollen-Denial); Playwright-Auth-E2E |
| CI-Gates | tsc · lint:full (eigener Step) · Units · DB-Integration · V1–V5 · S1–S12 · Doppel-Replay · Negativ/Inventar (A–H) · Tenant-Coverage · Fingerprint hart · Ledger-Vertrag · Forbidden-Patterns · Client-Boundary · Ratchet · doc-truth · Build · npm-audit-Rohartefakt · diff-check |
| Dependencies | next 16.2.12; npm audit --omit=dev als CI-Artefakt persistiert (Stand: 0 critical / 9 high / 2 moderate / 2 low, alle transitiv; transitiv ≠ automatisch irrelevant — Review-Pflicht bleibt) |
| Externer Blocker | def_privs FOR ROLE supabase_admin (15 von 24 defacl-Eintraegen): BLOCKED_EXTERNAL_PERMISSION, kompensiert + Ticket-Vorlage (F0_PERMISSION_PACKET.md) |
| Advisor offen | pg_trgm in public (WARN); Leaked-Password-Protection deaktiviert (WARN — Betreiberpflicht vor Go-live); 13 rls_enabled_no_policy (INFO, deny-all, kategorisiert) |
| Abschlussstatus | FINAL_STATUS=PASS_WITH_DECLARED_EXTERNAL_EXCEPTION · RATIFICATION_STATUS=PENDING_EXTERNAL (F0_FINAL_REPORT.md / F0_HANDOFF.json) |

## Ausdruecklich NICHT Teil des F0-Fundaments (Produkt-/Go-live-Gates, offen)
48h-Offline-Nachweis · Backup-/Restore-DRILL (Rollback ist vorbereitet, nicht getestet) ·
DB-Passwort-Rotation · UI-Gesamtabnahme Desktop/Tablet/Mobile · operativer E2E-Kernweg ·
Capture/OCR-Vollnutzung · Brain/Buchkern/Connectoren · Rate-Limit-Wirkungs-Drill.

## Governance-Vermerk (ehrlich)
Zwei Prod-Eingriffe dieser F0-Phase liefen mit Session-Freigabe des Auftraggebers VOR dem
PR-Merge (Haertung 07.08.; Migration 20260810100000 am 10.08., dabei zunaechst ohne
Ledger-Eintrag — selbst entdeckt und noch am selben Tag regulaer im Ledger nachgefuehrt).
Regelweg bleibt Merge→Apply; alle Eingriffe sind in F0_HANDOFF.json REMOTE_MUTATIONS protokolliert.

## Remote-Branch-Inventar (2026-08-10)
Einziger aktiver Foundation-Branch: `f0/befund-fixes` (PR #57). Nachfolgende Liste aller weiteren
Remote-Branches (historisch, ohne offenen PR; Disposition: nach F0-Abschluss loeschbar, kein
F0-Inhalt geht verloren — Salvage bereits erfolgt):
- agent/docs-rls-architecture
- agent/docs-update-and-m3
- agent/m4-sec-pin-002b
- archive/db-truth-main-source-c3b9f20
- archive/db-truth-pr30-source-d6bbfc2
- archive/db-truth-replay-source-5b5aa76
- archive/pr-15-capture-auth-tenant-f0090ab
- archive/pr-19-foundation-security-338a13c
- archive/pr-20-foundation-consolidation-2589fde
- archive/pr-8-auth-identity-002-007b85b
- checkpoint/order-flow-source-stable-2026-06-16
- checkpoint/sec-pin-002-no-merge-20260801
- chore/company-agent-governance
- chore/control-plane-min-ci
- chore/cowork-control-plane
- chore/ledger-d1-d2-migrations
- chore/minimal-mission-runtime
- ci/agentur-gate-to-main
- codex/foundation-consolidation-v3-20260728
- codex/foundation-gap-fill-001
- codex/foundation-migration-reconciliation-20260801
- codex/foundation-replay-inquiries-001
- codex/foundation-security-remediation-20260715
- codex/p0-hotfix-no-pin-payload
- codex/p0-hotfix-no-pin-payload-clean
- codex/w0-api-02f-scan-upload-02
- codex/w1-runtime-receipts-20260801
- docs/plan-sync-001
- docs/truthful-current-state-2026-08-06
- f0/befund-fixes
- f0/consolidation
- feature/appvernetzung-a1-data-truth
- feature/capture-auth-tenant
- feature/gemini-model-router
- feature/integration-capture-r15e
- feature/right-nav-focus
- feature/rls-core-migrations
- feature/rls-r1a-items-timeline-server-bridge
- feature/rls-r2-customers-server-bridge
- feature/rls-r3-baths-server-bridge
- feature/ui-cleanup-after-search-live
- fix/auth-identity-002-root
- fix/auth-session-permissions-2026-06-17
- fix/docs-and-offline-containment
- fix/inquiries-repository-server-action
- fix/live-auth-relogin
- fix/offline-synccontext-dataloss-containment
- fix/operational-orders-real-priority
- fix/orders-auth-after-a1-a2
- fix/storage-ocr-signed-urls
- hotfix/main-build-repair
- main
- r14c/s1-production-orders-view
- r15/scan-upload-security-lazy-init
- repair/f0-migration-ledger-reviewed
- repair/m03-auth-foundation
- review/G-2026-0001-scan-order-persistenz
- test/r5-negativ-20260713
