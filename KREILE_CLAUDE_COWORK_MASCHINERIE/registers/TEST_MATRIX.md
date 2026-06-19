# TEST MATRIX
<!-- QA/Test Lead | Aktualisiert: 2026-06-19 | CONDITION-004 -->

| TEST-ID | REQ-/WP-ID | Testart | Ausgangszustand | Aktion | erwartetes Ergebnis | tatsächliches Ergebnis | Evidenz | Status |
|---|---|---|---|---|---|---|---|---|
| T-001 | BP01 | Unit | OCR-Route vorhanden | GEMINI_API_KEY gesetzt, Bild-Upload → POST /api/ocr-process | 200, JSON mit lieferant/brutto/datum/confidence≥0.50 | PASS (63/63 unit tests) | vitest run `2026-06-19` | PASSED |
| T-002 | BP01 | Unit | GeminiProvider.ts | GeminiProvider.extract() mit gültigem Base64-Bild | strukturiertes JSON, kein Mock, confidence=0.90 bei vollst. Feldern | PASS (63/63) | vitest run `2026-06-19` | PASSED |
| T-003 | BP02 | Unit | GeminiProvider.ts | Fehlende Felder: nur lieferant vorhanden | confidence=0.50, lieferant present, datum/brutto null | PASS (63/63) | vitest run `2026-06-19` | PASSED |
| T-004 | BP03 | Unit | createOrderFromScan() | CUSTOMER_AMBIGUOUS-Szenario | Rückgabe {status: CUSTOMER_AMBIGUOUS, suggestions} | PASS (63/63) | vitest run `2026-06-19` | PASSED |
| T-005 | BP03 | Unit | createOrderFromScan() | CUSTOMER_NOT_FOUND + forceCreateCustomer=true | Neuer Kunde angelegt, Order erstellt | PASS (63/63) | vitest run `2026-06-19` | PASSED |
| T-006 | BP04 | Integration | /start-Route | Session abgelaufen (TTL > 12h) | SessionWarningBanner sichtbar, Link zu /start | UNVERIFIED | kein automatisierter E2E-Test | OPEN |
| T-007 | BP04 | Integration | KreileAppShell | Pathname = /start oder /login | kein Auth-Check, kein Banner | UNVERIFIED | kein automatisierter E2E-Test | OPEN |
| T-008 | BP05 | Integration | customers.actions.ts | getCustomersDb() mit gültigem Session-Token | nur Kunden mit tenant_id = 'galvanik-kreile' | UNVERIFIED | kein automatisierter DB-Test | OPEN |
| T-009 | BP05 | Integration | createCustomerDb() | Neuer Kunde ohne tenant_id im Body | tenant_id wird aus Session gesetzt, nicht aus Request | UNVERIFIED | kein automatisierter Test | OPEN |
| T-010 | BP06 | Integration | app/page.tsx | Dashboard mit echten DB-Daten | useAnimatedCount zeigt echte Auftragszahl, kein Hardcoded-Wert | UNVERIFIED | kein automatisierter Test | OPEN |
| T-011 | BP07 | SQL | RLS auf events/communications/arbeitszeit_buchung/konto | SET app.tenant_id='galvanik-kreile'; SELECT * FROM events | eigene Zeilen sichtbar | UNVERIFIED | Migration erstellt, Remote-Ausführung ausstehend | OPEN |
| T-012 | BP07 | SQL | RLS auf events | SET app.tenant_id='anderer-mandant'; SELECT * FROM events | 0 Zeilen | UNVERIFIED | Migration erstellt, Remote-Ausführung ausstehend | OPEN |
| T-013 | BP07 | SQL | ausgangsrechnung RLS (CONDITION-002) | SET app.tenant_id='galvanik-kreile'; SELECT COUNT(*) FROM ausgangsrechnung | n ≥ 0, kein RLS-Fehler | UNVERIFIED | Migration 20260619000001 erstellt, Remote-Ausführung ausstehend | OPEN |
| T-014 | BP07 | SQL | ausgangsrechnung_position RLS via JOIN | SET app.tenant_id='anderer-mandant'; SELECT * FROM ausgangsrechnung_position | 0 Zeilen | UNVERIFIED | Migration 20260619000001 erstellt, Remote-Ausführung ausstehend | OPEN |
| T-015 | BP08 | E2E-manuell | RightNav | Desktop: Hover auf Nav | Nav expandiert auf 200px, Labels sichtbar | UNVERIFIED | kein Playwright-Test | OPEN |
| T-016 | BP08 | E2E-manuell | RightNav | Touch-Device (pointer: coarse) | Nav bleibt expandiert ohne Hover | UNVERIFIED | kein Playwright-Test | OPEN |
| T-017 | BP08 | E2E-manuell | RightNav | Klick auf "Fixieren"-Button | Nav bleibt bei Maus-Leave expandiert, Button zeigt "Fixiert" | UNVERIFIED | kein Playwright-Test | OPEN |
| T-018 | BP09 | E2E-manuell | TopWorkflowBar | Navigiere zu /station/wareneingang | Wareneingang-Card hervorgehoben (orange border) | UNVERIFIED | kein Playwright-Test | OPEN |
| T-019 | BP09 | E2E-manuell | TopWorkflowBar | Navigiere zu /station/beschichtung | Galvanik-Card hervorgehoben | UNVERIFIED | kein Playwright-Test | OPEN |
| T-020 | BP09 | Unit | TopWorkflowBar | VALID_SLUGS vollständig | alle 5 Stationen in STATIONS-Array vorhanden | FACT (code review) | `git show HEAD:src/components/layout/TopWorkflowBar.tsx` | PASSED |
| T-021 | CONDITION-001 | Infrastruktur | .gitattributes | git status nach Commit 47fbaf4 | keine CRLF-M-Dateien (280 false positives behoben) | FACT — committed | git log 47fbaf4 | PASSED |
| T-022 | CONDITION-005 | Code-Review | BP08+BP09 Parallelität | Dateiüberschneidungsanalyse | RightNav*.tsx ≠ TopWorkflowBar.tsx | FACT — keine Überschneidung | git show e9fa45a --stat | PASSED |

## Offene Tests (OPEN) — Ausführungsplan

Die T-006 bis T-019 sind manuell oder Integrations-Tests die remote DB oder Browser benötigen.

Priorisierung:
- **P1 — vor Merge zu main:** T-011, T-012, T-013, T-014 (RLS-SQL-Tests nach Migration-Ausführung via Supabase MCP)
- **P2 — nach Deployment:** T-015 bis T-019 (manuelle E2E auf Vercel Preview)
- **P3 — Tech Debt A-13:** T-006 bis T-010 (Playwright E2E, separates WP)
