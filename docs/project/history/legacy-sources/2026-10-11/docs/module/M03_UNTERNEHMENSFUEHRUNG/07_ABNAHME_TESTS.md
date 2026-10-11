<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 07 - Abnahme und Tests

Stand: 2026-09-26  
Modul: M03 Unternehmensführung

Bestehende Candidate-Tests sind Contractnachweis, kein Produkt-E2E. Geplante Host- und UI-Tests bleiben `FEHLT`, bis die jeweiligen Gates geöffnet sind.

| T-ID | Anforderung | Given/When/Then | Gate (Smoke/E2E/Owner-UX) | Beleg (Test/Hash) |
|---|---|---|---|---|
| T-M03-001 | A-M03-001, A-M03-005, A-M03-023 | Given der Candidate.3-Quellbaum, when der Neutralitätsgate läuft, then existieren keine Hostnamen/-rollen, UI-Artefakte, Provider- oder Runtime-Abhängigkeiten. | Smoke | `verify:static` PASS; `FINAL_AUDIT_FREEZE.json`; Core-Hash `9A3554D49B05…` |
| T-M03-002 | A-M03-002, A-M03-006 | Given ein neues Ziel und zwei Draft-Saves, when die Historie gelesen wird, then ist Version 1 unverändert, Version 2 aktuell Draft und der Historienpräfix byte-/kanonisch gleich. | Smoke | Candidate.3 `domain.test.mjs`, `property.test.mjs`; 48/48 + 200 Sequenzen PASS |
| T-M03-003 | A-M03-003, A-M03-004 | Given alle Zielmodi und ungültige Kombinationen, when Schema und Validator laufen, then werden nur kompatible Wert-/Einheits-/Periodenkombinationen akzeptiert. | Smoke | AJV Strict: 2 Schemata/5 Instanzen PASS; `validation.ts` |
| T-M03-004 | A-M03-007, A-M03-021 | Given Aktivierung ohne/falsche/abgelaufene/replayed/wrong-context Challenge, when der Command läuft, then wird ohne Persistenz abgewiesen. | Smoke | Candidate.3 Runtime-/Hardeningtests PASS; Confirmation-Failure-Matrix |
| T-M03-005 | A-M03-007, A-M03-018 | Given missing/stale/partial/denied/unknown/incompatible Measurement und ungeklärte Responsibility, when aktiviert wird, then bleibt der Draft unverändert und der exakte Fehlerzustand erscheint. | Smoke | Candidate.3 Runtime-/Conformance-Tests PASS; realer Hostnachweis FEHLT |
| T-M03-006 | A-M03-008 | Given aktive Version plus Ersatz-Draft, when `Supersede` bestätigt committet, then alte und neue Version sind lesbar, Dispositionen/Transitionen append-only und Event/Receipt korrekt gebunden. | Smoke | Candidate.3 Domain-/Runtime-Tests PASS |
| T-M03-007 | A-M03-009 | Given ein offenes Ziel, when `Close` bestätigt committet und danach erneut geschrieben wird, then ist das Ziel geschlossen und der Folgeschreibversuch liefert `GOAL_CLOSED`. | Smoke | Candidate.3 Domain-/Runtime-Tests PASS |
| T-M03-008 | A-M03-010, A-M03-013 | Given identischer Command und Idempotenzschlüssel, when er erneut ankommt, then wird das dauerhafte Receipt als `replayed` zurückgegeben; bei abweichendem Hash/Ziel/Command wird abgewiesen. | Smoke | Candidate.3 Completion Report Punkt 1; negative Cross-Goal-/Cross-Command-Tests PASS |
| T-M03-009 | A-M03-011 | Given zwei Commands auf derselben Revision, when beide committieren wollen, then gewinnt höchstens einer und der andere liefert `REVISION_CONFLICT` ohne Historienverlust. | Smoke | Candidate.3 Concurrencytests PASS; reale DB FEHLT |
| T-M03-010 | A-M03-014 | Given jede ReadEnvelope-Variante, when ein öffentlicher Read zurückkehrt, then sind Root/Coverage/Reasons tief immutable, referenzgetrennt und kein Fehler wird zu Daten. | Smoke | Candidate.3 Hardening-/Regressiontests PASS |
| T-M03-011 | A-M03-016, A-M03-017 | Given Evaluationen mit mixed Coverage und eine Seite mit Cursor, when Attention projiziert wird, then bestimmt der schlechteste Zustand die Hülle und `complete` trägt nie `nextCursor`. | Smoke | Candidate.3 Projection-/Paginationtests PASS |
| T-M03-012 | A-M03-015, A-M03-024 | Given das gepackte Artefakt in einem frischen Consumer, when beide Exporte importiert und streng typgeprüft werden, then stimmen Manifest und Exportmap exakt. | Smoke | Clean Consumer PASS; Paket SHA `E4D357426B64…` |
| T-M03-013 | A-M03-024, A-M03-025 | Given der Candidate-Ordner, when Tree-Digest und Freeze nachgerechnet werden, then ergeben sich 107/556595/`3AEB7CDB…` und 103/539796/`E7E155C7…`; unabhängiger Opus-Audit muss auswertbar sein. | Smoke | Hashes lokal am 2026-09-26 bestätigt; Opus `HTTP 429`, 0 Tokens → FEHLT |
| T-M03-014 | A-M03-012, A-M03-013 | Given reale DB und Prozessabbruch vor/während/nach Commit, when derselbe Schlüssel readback/replayed wird, then sind Aggregate+Events+Receipt entweder gemeinsam dauerhaft oder gemeinsam nicht sichtbar. | E2E | FEHLT → Q-M03-003 |
| T-M03-015 | A-M03-019 | Given Nutzer/Scope A und Ziel in Scope B, when Goal-, Receipt- und Projection-Reads sowie Commands ausgeführt werden, then entstehen weder Daten noch Existenzsignal oder Mutation. | E2E | FEHLT → Q-M03-003/Q-M03-006 |
| T-M03-016 | A-M03-020 | Given Standardrechte und eine Adminsperre je Person, when dieselbe Action ausgeführt wird, then gilt der zentrale serverseitige Rechte-Snapshot und jede Änderung ist auditierbar. | E2E | FEHLT → Q-M03-006 |
| T-M03-017 | A-M03-026 | Given realer Kreile-Host, when Draft→Activate→neuer Draft→Supersede→alte Version lesen→Close einschließlich Conflict, Duplicate, Restart und Unknown durchlaufen wird, then bestehen alle Receipt-/Readback- und History-Gates. | E2E | FEHLT → Q-M03-003 bis Q-M03-006 |
| T-M03-018 | A-M03-027, A-M03-028 | Given jeder GOALS-Screen, when Desktop/Tablet/Handy mit Daten/lädt/leer/Fehler/gesperrt/In Klärung/In Aufbau geprüft werden, then sind Texte, Fokus, 48-px-Touch, Screenreader, Kontrast und Reduced Motion korrekt. | Owner-UX | FEHLT → Q-M03-002 |
| T-M03-019 | A-M03-029 | Given M03 ist nicht adoptiert, when Rolf-Home und Direkt-URL geprüft werden, then ist nur das nicht klickbare Element `Ziele & Entscheidungen`/`In Klärung` sichtbar und die Direkt-URL fail-closed/404. | E2E | SPEZ; Design-/Grundstammumsetzung FEHLT → Q-M03-001 |
| T-M03-020 | A-M03-030 | Given mehr als drei offene Ziele und kritische Ausnahmen, when die Hostprojektion priorisiert, then zeigt sie höchstens drei Fokusziele, unterdrückt aber keine definierte kritische Ausnahme; der Core behält alle Ziele. | E2E | GEPLANT; Hostdarstellung in Designphase 1b → Q-M03-002 |
| T-M03-021 | A-M03-031 | Given alle Reifedimensionen und Missing/Stale/Denied/Conflict-Fälle, when spätere Decision Readiness komponiert wird, then erscheint eine erklärbare Klasse und niemals ein freier Prozentwert. | E2E | GEPLANT; C3/C4/C5-Gates offen |
| T-M03-022 | A-M03-032 | Given erkannte Datenlücke, when Nutzer Evidence liefert, then bleibt sie `under_review` bis Fachowner-Write + Readback + Reconciliation + Neuberechnung; UI-Klick allein kann nicht abschließen. | E2E | GEPLANT; C3-Gate offen |
| T-M03-023 | A-M03-033 | Given Candidate.3 und spätere GOALS-Adoption, when Exporte/Schema/Manifest/Routes durchsucht werden, then existiert kein Decision-Governance-Symbol oder leerer Port. | Smoke | Candidate.3 PASS; bei Adoption erneut auszuführen |
| T-M03-024 | A-M03-034 bis A-M03-036 | Given späteres separates Decision-/Effect-Gate, when Entscheidung und Review E2E laufen, then sind vollständige Evidenz/Optionen/Guardrails/Human-Review vorhanden, Fachcommand bleibt extern und unklare Wirkung bleibt unklar. | E2E | BLOCKED_NOT_BUILDABLE; kein aktueller Test zulässig |
| T-M03-025 | A-M03-037, A-M03-038 | Given getrennte M02-Bewertungen für Termintreue und Liquidität 30 Tage, when eine der beiden kippt, then erscheint der Fall oben auf Rolf „Der Tag“, der Tagesüberblick bleibt darunter und eine spätere Entscheidung weist ihre Wirkung auf beide Größen getrennt aus. | E2E + Owner-UX | SPEZ; reale M01-/M02-Ports, Designphase 1b und Decision-Governance-Gate noch offen |
| T-M03-026 | A-M03-039 | Given abgelaufener Personenbezug in einer unveränderlichen Zielhistorie, when die zentral vorgeschlagene und adminfreigegebene Anonymisierung erfolgt, then ist die Person nicht mehr auflösbar, die Geschäftshistorie unverändert lesbar und ohne Freigabe nichts verändert. | E2E | FEHLT → Q-M03-012; Datenschutz-/Steuerberater-Gate vor Livegang |

## Abnahmereihenfolge

1. T-M03-013 schließt Integrität und unabhängiges Opus-Gate.
2. T-M03-014 bis T-M03-017 beweisen Hostpersistenz, Security und realen Ziel-Lebenszyklus.
3. T-M03-018 bis T-M03-020 erlauben erst danach die echte Kreile-UI.
4. T-M03-021 bis T-M03-024 bleiben außerhalb des GOALS_V1-Scopes hinter separaten Gates; T-M03-025 wird stufenweise mit M01/M02, Startseitenprojektion und späterem Decision-Governance-Gate abgenommen.
5. T-M03-026 wird erst nach Q-M03-012 und dem zentralen Datenschutz-/Aufbewahrungsgate ausgeführt.
