# 12 · Anforderungs-Archäologie (nachgeholt, Konduktor)

Ersetzt den ausgefallenen `requirements-archaeologist`. Belege: `99_AUDIT_INPUT/sweep_D_*.txt`, Ideenkataloge, Git-Log, TEST_MATRIX.

## Befund 1 — Es wurde bereits am 2026-06-19 auditiert; die Probleme bestehen fort

Im Root liegen vollständige Vor-Audits:
- `AUDIT_REPORT_2026-06-19.md` (10 KB)
- `PROJEKTARCHAEOLOGIE_2026-06-19.md` (**30 KB**)
- `UX_DESIGN_AUDIT_2026-06-19.md` (19 KB)
- `01_projektanalyse.md`, `audit_results.md`

**Bedeutung:** Vor ~2 Wochen wurde das Projekt schon einmal tief analysiert. Dass dieselben Kernprobleme (Tenant, Mock, Vernetzung) heute noch bestehen, zeigt: **Analyse war nicht das Nadelöhr — Umsetzung + Nachhalten war es.** Genau deshalb ist der 6-Wellen-Plan mit hartem Gate und Register-Pflicht (statt noch eines Audits) der richtige nächste Schritt.

## Befund 2 — Die Ideenkataloge sind extrem reif — und dokumentieren die Probleme selbst

5 Kataloge, 4.385 Zeilen, **100+ spezifizierte Abschnitte**. Sie enthalten fertige Spezifikationen für Startseite, Auftragsbuch, Kundenkartei, Warendurchlauf (6-Stationen-Fluss), Betriebs-Cockpit, Kommunikation, Telefonnotiz („Star-Feature"), Performance (7-Ebenen-Template, Drilldown, Gamification). Bemerkenswert:
- **Katalog 2 §13**: „Datenschutz-/Tenant-Befund (kritisch für Kundenkartei UND Auftragsbuch)" — **das Tenant-Problem war von Anfang an dokumentiert**, wurde aber nie gelöst.
- **Katalog 1 §19 / Katalog 5 §25**: „Antigravity-Drift-Befunde/-Muster" — Drift zwischen Spec und Build war bekannt.
- **Katalog 3 §11**: „sechs Stationen statt drei" — die Stationsdivergenz (F-B3) hat eine konzeptionelle Vorgeschichte.

**Bedeutung:** Die Ideen sind **nicht verloren** und von hoher Qualität. Sie sind jetzt im `IDEA_REGISTER` (I-01…I-17) verankert. Das Risiko war Nachverfolgung, nicht Substanz.

## Befund 3 — TEST_MATRIX ist veraltet (Beleg-Drift)

Die TEST_MATRIX führt T-001…T-005 als `PASSED` mit „PASS (63/63 unit tests)", datiert `2026-06-19`. Der aktuelle Stand am HEAD ist aber **75/75** Unit-Tests. → Die PASSED-Belege stammen aus einem **alten HEAD** und sind am aktuellen `204f3f1` **nicht nachverifiziert**. T-006…T-019 stehen ohnehin auf `OPEN/UNVERIFIED` (kein E2E). 
**Konsequenz:** Die TEST_MATRIX darf nicht als Nachweis aktueller Funktion gelten. Sie muss bei jeder Welle gegen den aktuellen HEAD neu belegt werden (Teil des Livegang-Gates).

## Befund 4 — Korrekturzyklen sind in Git nachvollziehbar, aber nicht in Registern

Git-Log belegt saubere Korrekturarbeit: `DEF-006` (unerreichbare Scan-Stubs entfernt), `DEF-007` (Views nach Scan-Konversion refresht), `G-2026-0001` (Truncation-Artefakte), `CONDITION-001..005` (RLS 6 Tabellen, .gitattributes/CRLF), `QG-01` (ESLint-Gates). 
**Widerspruch:** Diese Historie existiert **nur in Commit-Messages**, nicht im (bis heute leeren) `CHANGELOG`/`DECISION_LOG`. Das ist die Governance-Lücke (F-F5): Entscheidungen leben verstreut, nicht im Register — dasselbe Muster, das den Auftraggeber überhaupt hierher geführt hat.

## Befund 5 — Dokumenten-Widerspruch: veralteter Prüf-HEAD

`PROJECT_TRUTH` nennt Prüf-HEAD `5e8b399` und „QG-01-V ACCEPT", aber der reale HEAD ist `204f3f1` (9 Commits weiter, Branch `feature/capture-auth-tenant`, unmerged). Die autoritative Wahrheit hinkt dem Code hinterher (F-F6). → Nach Freigabe: TRUTH-HEAD nachziehen, Branch-Strategie klären.

## Verlorene/aufgeschobene Ideen (Aufmerksamkeit)

Aus dem Katalog-Abgleich (Details `IDEA_REGISTER`): Namens-Begrüßung statt „Aktueller Nutzer" (I-02, kleiner Fix/große Twin-Wirkung), Wake-Screen (I-03), automatische Kundenkommunikation (I-10), **realistische Terminzusage (I-14 — Michaels Kernrisiko)**, Gamification/Streaks (I-12), Nachfolge-Beweisfunktion (I-15).

## Archäologie-Fazit

Das Projekt leidet nicht an zu wenig Denkarbeit, sondern an **fehlender Umsetzungs- und Nachhaltedisziplin**: ein tiefer Vor-Audit, 4.385 Zeilen reife Ideen und nachvollziehbare Git-Korrekturen stehen leeren Registern und fortbestehenden Kernproblemen gegenüber. Die Bibel + befüllte Register schließen die Nachhalte-Lücke; die 6 Wellen schließen die Umsetzungs-Lücke.
