# Vernetzte Analyse-, Bau- und Abnahmepipeline

## Phase 0 – Schutz

Projektpfad, Git, Worktrees, Prozesse, WIP, Produktion und Secrets prüfen. Keine destruktive Änderung.

## Phase 1 – Quellen und Anforderungen

Quelleninventar, Ideenregister, Anforderungsregister, Entscheidungshistorie, widersprüchliche Altanweisungen und offene Fragen.

## Phase 2 – Ist-Zustand

Repository-Karte, Datenmodell, Live-vs-Code, Mengenabgleich DB/Server/UI, Mock- und Scheinfunktionen, Performance, Security und Nutzerrealität.

## Phase 3 – Synthese

Das Steuerungsboard erzeugt Root-Cause-Cluster, Vertragslücken, Abhängigkeitsgraph, Risiken, Entscheidungen, Scope-Trennung und erste Baupakete.

## Phase 4 – Baupaket-Spezifikation

Vor jedem Bau: Ziel, Ursache, Scope, Nicht-Scope, Datenmodell, Datenvertrag, Serverlogik, UI/UX, Zustände, Rollen, Security, Performance, Analytics, Migration, Tests, Rollback und Akzeptanzkriterien.

## Phase 5 – Pre-Build-Review

Keine Umsetzung bei unklarer Datenquelle, widersprüchlichem Vertrag, fehlenden Konsumenten, ungeklärter Security, ungeklärter Testbarkeit oder kollidierendem WIP.

## Phase 6 – Bau

1. Git/Pfad/WIP
2. Root Cause
3. DB/Migration
4. Vertrag
5. Konsumenten
6. UI-Zustände
7. Persistenz
8. Reload
9. Folgeprozesse
10. Analytics
11. Tests
12. Dokumentation

## Phase 7 – Selbstprüfung

Der Bauingenieur liefert Beweise, aber keine endgültige Abnahme.

## Phase 8 – Unabhängige Abnahme

Fachprüfer, QA, Security/Performance nach Relevanz und Red Team.

## Phase 9 – Korrekturschleife

Jeder Befund erhält ID, Priorität, Ursache, Korrekturpaket und erneute Prüfung.

## Phase 10 – Release

Remote-Migration, Schema-Reload, Build, Deployment, Smoke Tests, Monitoring, Rollback, Tag und Release-Evidence.

## Phase 11 – Lernen

Findings in Agent Memory, Architektur- und Entscheidungslog, wiederverwendbare Patterns und messbare Nutzerwirkung.
