<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 06 - Entscheidungen

Stand: 2026-09-26  
Modul: M03 Unternehmensführung

Diese Datei enthält nur Verweise und Kurzformen. Register- oder Ownertexte werden nicht dupliziert.

| Register-ID / Fundstelle | Kurzform (1 Zeile) | Datum | gilt/überholt |
|---|---|---|---|
| D-GOV-001, Repo-Entscheidungsregister | Eine Quelle je Wahrheitsart; Konflikte werden fail-closed benannt. | 2026-09-10 | gilt |
| D-ARCH-008, Repo-Entscheidungsregister | Path-1-Modulbau: ein Modulordner, Manifest, Fassaden, Hostadapter, keine Tiefimporte. | 2026-09-06 | gilt |
| D-ARCH-009, Repo-Entscheidungsregister / `MODULKARTE_KANON.md` | Alte Analyse-/Cockpit-Ausschlussfassung enthält M03 noch nicht. | 2026-09-06 | für M03 durch D-LEADERSHIP-001/OE-2609-05 fachlich überholt; formaler OP-02-Nachzug offen |
| D-ARCH-011, Repo-Entscheidungsregister | Externe Capabilities nur real, sicher und tenantneutral hinter engen Ports; kein Fake-Fallback. | 2026-09-10 | gilt |
| D-ARCH-012, Repo-Entscheidungsregister | Provider bleiben hinter versionierten Ports und benötigen je Capability ein Gate. | 2026-09-14 | gilt; GOALS_V1 hat keine Provider |
| D-AI-001, Repo-Entscheidungsregister | Deterministische Logik zuerst; Modelle nur gegatet und ohne Scheingenauigkeit. | 2026-09-14 | gilt für spätere Führungs-/Analysefunktionen |
| D-AI-002, Repo-Entscheidungsregister | Quellengebundene Fakten-/Aktionskette; Fachmutation nur nach menschlicher Bestätigung mit Receipt/Readback. | 2026-09-14 | gilt |
| D-RES-001, Repo-Entscheidungsregister | Fehler bleiben sichtbar, wiederaufnehmbar und ohne stillen Erfolg/Fallback. | 2026-09-14 | gilt |
| D-UI-V5-003, Repo-Entscheidungsregister | V5 ist UI-Quelle; V6 ist verworfen. | 2026-09-21 | gilt als visuelle Quelle; Umsetzungsmethode durch OE-2609-03 präzisiert |
| D-LEADERSHIP-001, `D_LEADERSHIP_001_CANONIZATION_HANDOFF_2026-09-17.md` | Domäne `LEADERSHIP_DECISIONS` ratifiziert; erster Slice nur GOALS_V1, fremde Wahrheiten außen. | 2026-09-17 | gilt fachlich; formale Register-/Modulkarten-Kanonisierung ausstehend |
| Owner-Slotentscheidung, `LEADERSHIP_SLOT_DECISION_HANDOFF_2026-09-17.md` | Späterer Slot `src/modules/leadership-decisions/`; Candidate.3 erst nach Opus-Gate und atomarer Adoption. | 2026-09-17 | gilt; Slot im Repo noch nicht angelegt |
| Owner-Fallback-Regel, Chat-Digest Owner #13 | Bei nicht auswertbarem Opus kein Loop; Codex nur interim, Opus bleibt vor Adoption offen. | 2026-09-17 | gilt |
| Owner-Auftrag UX-/Red-Team-Delta, Chat-Digest Owner #21/#24 | Mock nur Kontrollbild; Pseudogenauigkeit, Fake-Klärung und Direktaktion verboten; fünf Sonnet-P1-Auflagen eingearbeitet. | 2026-09-17 | gilt als Planungs-/Sicherheitsgrenze, keine Produktfreigabe |
| OE-2609-01 | D-GOV-001 bleibt; kein Register-über-allem. | 2026-09-25 | gilt |
| OE-2609-03 | Kreile-DS neu aus V5 ableiten; kein Mock-CSS kopieren. | 2026-09-25 | gilt; Register-Nachzug offen |
| OE-2609-04 | Spätere Funktionen als nicht klickbare Elemente `In Klärung`/`In Aufbau`; keine tote Route/Fake-Daten. | 2026-09-25 | gilt; MODULKARTE-Nachzug OP-02 offen |
| OE-2609-05 | Module entfallen nicht, sondern sind hinten angestellt; Anbindung erst nach Grundstamm- und Modulabnahme. | 2026-09-25 | gilt; ersetzt alte Entfall-Aussage für M03 |
| OE-2609-08 | Plan bis Livegang ratifiziert; vorerst kein App-Bau und Register-Merge bis Git-Rückkehr verschoben. | 2026-09-25 | gilt für aktuellen Staginglauf |
| OE-2609-09 | Standardzugriff für jede Person; Admin steuert je Person. | 2026-09-26 | gilt; Host-Mapping noch zu bauen |
| OE-2609-10 | Interne Sperren verhindern Fehler; Konflikte erscheinen zuständigkeitsbezogen auf Startseiten. | 2026-09-26 | gilt |
| OE-2609-15, präzisiert durch `HINWEIS_TRENNUNG_2026-09-26.md` | Übertragbarkeit wird nur als App-Neutralität des Kerns beschrieben; dieses Dossier enthält ausschließlich Kreile-Anforderungen. | 2026-09-26 | gilt in der präzisierten Fassung |
| OE-2609-16 | Modul-Mindmap 2026-08-15 wird als Strukturbild abgelegt. | 2026-09-26 | gilt; alte Entfall-Zeile darin überholt |
| OE-2609-17 | Modulkerne dürfen mit BAUBEREIT-Dossier priorisiert M01→M07 parallel off-repo entstehen; Kreile-Anbindung bleibt seriell. | 2026-09-26 | gilt; M03-Anbindung weiter nach M01/M02 |
| OE-2609-20 | Personenbezug nur so lange wie nötig; Geschäftsdaten bleiben fristgerecht, Anonymisierung/Löschung nur vorgeschlagen und adminfreigegeben. | 2026-09-26 | gilt für M03-Verantwortungsreferenzen; konkrete Naht Q-M03-012 |
| OE-2609-21 | Termintreue ist die erste Analyse-Kennzahl. | 2026-09-26 | für M03 durch OE-2609-23 um Liquidität 30 Tage ergänzt |
| OE-2609-22 | Vollständige Analyse bleibt im Analyse-Menü; auf der Startseite erscheinen nur dringende Analysefälle. | 2026-09-26 | gilt als M02-/M03-Anzeigegrenze |
| OE-2609-23 | Erstes M03-Ziel kombiniert Termintreue und Liquidität 30 Tage; Warnungen und Entscheidungen betrachten beide. | 2026-09-26 | gilt; klärt Q-M03-005 |
| OE-2609-24 | Liquidität startet mit manuellen Kreile-Eingaben und wechselt später hinter Owner-Gate zu bestätigten Bankvorschlägen. | 2026-09-26 | gilt für M01-/M02-Datenquelle; M03 referenziert nur |
| OE-2609-26 | Dringende Konflikte, Warnungen und Entscheidungen stehen oben; der V5-Tagesüberblick bleibt darunter. | 2026-09-26 | gilt für Rolf-Startseitenprojektion |
| Plan 1.1 §C/Phase 4 | M03 ist hinten angestellt und wird seriell nach M01/M02 angebunden. | 2026-09-26 | gilt als ratifizierter Plan; keine aktive Mission |
