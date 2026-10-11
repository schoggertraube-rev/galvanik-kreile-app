<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 05 - Regeln, Sperren und Konflikte

Stand: 2026-09-26  
Modul: M03 Unternehmensführung

## 1. Sperren (vorbeugend)

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| Keine Adoption vor auswertbarem Opus-Schlussgate und atomarer Adoptionsmission | ungeprüften Candidate als Produkt-PASS oder Teilkopie | CI/Governance | Candidate.3 `AUDIT_REPORT.md`, Slotentscheidung | SPEZ; Gate offen |
| Keine M03-Route vor realem GOALS-E2E und Designphase 1b | Mock-/Schattenfunktion und Dead End | UI/Routing | Adoption Mission §§4–5; OE-2609-04 | SPEZ |
| Jeder Request benötigt servergebundenen SecurityScope/Actor/Auth-Context | Client-Tenant-Autorisierung und Cross-Scope-Leak | Server | `TrustedRequestContextV1`, `AuthorizationPortV1` | GEBAUT im Core; Host FEHLT |
| Jeder Command benötigt serverseitige Command-Bindung | fremde/ungeprüfte Idempotenz- und Korrelationsmetadaten | Server | `CommandEnvelopeBindingPortV1` | GEBAUT im Core; Host FEHLT |
| Aktivieren, Ablösen und Schließen benötigen einmalige servergebundene Confirmation | folgenreichen Klick ohne exakte Zusammenfassung/Freigabe | Server | `ConfirmationPortV1`, A-M03-021 | GEBAUT im Core; Host FEHLT |
| Aktivierung ohne auflösbare Verantwortung oder kompatible aktuelle Messdefinition wird abgewiesen | Ziel ohne Verantwortlichkeit/Messbarkeit | Server | Candidate.3 `validateActivationDependencies` | GEBAUT im Core; Host FEHLT |
| CAS auf exakter Revision | Lost Update/Überschreiben konkurrierender Zieländerung | Server/DB | `expectedRevision`, `commitAtomically` | GEBAUTer Vertrag; reale DB FEHLT |
| Idempotenz bindet Receipt an Intent-Hash, Goal-ID und Command-Art | Cross-Goal-/Cross-Command-Replay und Doppelcommit | Server/DB | Candidate.3 Completion Report Punkt 1 | GEBAUT im Core; reale DB FEHLT |
| Aggregate, Events und Receipt committen atomar oder gar nicht | Erfolg ohne Zustand/Event/Receipt beziehungsweise halben Commit | DB | `AtomicGoalsPersistencePortV1` | SPEZ; reale DB FEHLT |
| Geschlossenes Ziel ist immutable; Historienlisten sind append-only | stille Änderung/Löschung des Unternehmensgedächtnisses | Server/DB | Candidate.3 `domain.ts`, `validation.ts` | GEBAUT im Core; DB-Beweis FEHLT |
| Unknown führt zu Receipt-Readback vor Retry | Doppelmutation nach Transport-/Clock-/Commitfehler | UI/Server | `CommandOutcomeV1`, Adoption Mission §4 | GEBAUT im Core; reales E2E FEHLT |
| ReadEnvelope-Fehler werden nicht zu Null/leer/Erfolg umgedeutet | Scheingenauigkeit und verschwundene Datenlücke | Server/UI | Candidate.3 `ReadEnvelopeV1`; D-RES-001 | GEBAUTer Vertrag; UI FEHLT |
| Keine fremden Fakten im GOALS-/Decision-Core | zweite Accounting-, Analyse-, Aufgaben- oder Commandwahrheit | Architektur/CI | Manifest `truthOwnership`; D-LEADERSHIP-001 | GEBAUT im GOALS-Core |
| Keine Einzelprozentzahl für Entscheidungsreife | freie KI-Pseudogenauigkeit | Server/UI | Delta SAFE-001 | SPEZ; spätere Capabilities |
| Keine fachliche Klärung durch UI-Klick | manuell bestätigten Schattenfakt | Server/UI | Delta SAFE-002 | SPEZ; C3-Gate offen |
| Keine Fachaktion aus Leadership/Analysis/Search | Geld-/Rechts-/Betriebswirkung ohne Fachowner | Server/Architektur | D-AI-002; Delta SAFE-005 | SPEZ |
| `DECISION_GOVERNANCE_V1` bleibt symbolfrei | leere Ports/Routes/Tabellen als Scheinfortschritt | Build/CI | Candidate.3 `BLOCKED_CAPABILITIES.md` | GEBAUTe Negativgrenze |
| Keine Provider-/Runtime-Abhängigkeit im GOALS-Core | stillen KI-/Cloud-Fallback | Build/Server | Candidate.3 Manifest/Neutralitätscheck | GEBAUT |
| App-neutraler Core enthält ausschließlich neutrale Verträge; alle Kreile-Bezüge bleiben im Kreile-HostAdapter | Vermischung von Core und Kreile-Daten-, Auth-, Rollen-, UI- oder Infrastrukturwahrheit | Architektur/CI | Candidate.3 Manifest; Owner-Hinweis `HINWEIS_TRENNUNG_2026-09-26.md` | GEBAUT im Core; Kreile-Host FEHLT |
| Keine stille Löschung, Anonymisierung oder Umschreibung der M03-Historie | Verlust von Geschäftsnachweisen oder ungeprüfte Personenbezüge | Server/DB/Governance | OE-2609-20; Q-M03-012 | SPEZ; zentrale Retention-/Anonymisierungsnaht FEHLT |

## 2. Konflikte

Bis eine reale M03-Projektion freigegeben ist, werden keine Laufzeitkonflikte aus Fake-Daten angezeigt. Der einzige sichtbare Zustand ist das graue Element `In Klärung`. Nach Adoption gilt folgende Zuständigkeits- und Anzeigeordnung:

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-M03-001 | Erwartete Revision ist nicht aktuell | `REVISION_CONFLICT` plus tatsächliche Revision | Rolf | Rolf „Der Tag“ › Ziele & Entscheidungen › Handlungsbedarf | Aktuelles Ziel neu laden, Nutzerabsicht bewusst neu basieren, neuen Command senden | GEBAUTer Core; Anzeige FEHLT |
| K-M03-002 | Idempotenzschlüssel gehört zu anderem Intent, Ziel oder Command | Receiptvergleich Hash + `goalId` + `commandKind` | Gregor technisch, Rolf fachlich | Gregor-Start `/settings` › Systemstatus; Rolf-Karte zeigt nur sicheren Wiederaufnahmehinweis | keinen Retry; Integritätsfall mit Correlation-ID prüfen, ursprüngliches Receipt/Command zuordnen | GEBAUTer Core; Host/Anzeige FEHLT |
| K-M03-003 | Messdefinition fehlt, ist stale/partial/denied/unknown oder inkompatibel | `MeasurementDefinitionReadPortV1` und Compatibility-/Freshness-Regeln | Rolf | Rolf „Der Tag“ › Ziele & Entscheidungen › Handlungsbedarf | zuständigen Measurement-Owner öffnen; Definition/Freigabe dort klären; danach Aktivierung neu versuchen | GEBAUTer Core; realer Port/Anzeige FEHLT |
| K-M03-004 | Verantwortungsreferenz ist nicht auflösbar oder nicht aktuell | `ResponsibilityReadPortV1.resolve` | Rolf | Rolf „Der Tag“ › Ziele & Entscheidungen › Handlungsbedarf | zentrale Personen-/Verantwortungswahrheit korrigieren; keine lokale Ersatzperson | GEBAUTer Core; realer Port/Anzeige FEHLT |
| K-M03-005 | Confirmation fehlt, ist abgelaufen, replayed oder kontextfremd | `ConfirmationPortV1.verify` | Rolf | im geöffneten Ziel; auf Rolf-Home nur wenn Handlung fällig bleibt | neue servergebundene Zusammenfassung/Challenge erzeugen und bewusst bestätigen | GEBAUTer Core; realer Port/Anzeige FEHLT |
| K-M03-006 | Zugriff/Scope ist verweigert oder mehrdeutig | Authorization-Denial/RLS-Negativfall ohne Existenzsignal | Gregor | Gregor-Start `/settings` › Rechte/Systemstatus; kein fachlicher Zielinhalt | zentrale Personenrechte prüfen; keine Modul-Whitelist oder Clientfreigabe | Contract GEBAUT; Host/RLS FEHLT |
| K-M03-007 | Ausgang eines Commands ist nach möglichem Commit unbekannt | `CommandOutcomeV1.status=unknown`, Reconciliation-Token | Rolf; Gregor bei technischem Wiederholungsfall | Rolf „Der Tag“ › Ziele & Entscheidungen › Handlungsbedarf; technische Details bei Gregor | mit demselben Idempotenzschlüssel Receipt lesen; erst nach belegtem Nichtcommit bewusst wiederholen | GEBAUTer Core; reales E2E/Anzeige FEHLT |
| K-M03-008 | Evaluation ist partial/stale/denied/error/unknown oder Pagination unvollständig | Evaluation-ReadEnvelope; Coverage; `nextCursor` | Rolf | Rolf „Der Tag“ › Ziele & Entscheidungen › Datenstand | Bewertung nicht als Zielstatus ausgeben; M02/Ownerquelle öffnen, Recompute/Readback abwarten | GEBAUTer Projection-Contract; realer Port FEHLT |
| K-M03-009 | Formale Kanonisierung, Opus- oder Adoptiongate ist noch offen | Governance-/Handshake-Status | Gregor/PL; fachlich keine Laufzeitverantwortung | Rolf sieht ausschließlich graues Element `In Klärung`; Gregor-Doku/Systemstatus | OP-02/Kanonisierung, Opus-Audit und Adoption seriell abschließen | OFFEN; kein Runtimekonflikt simulieren |
| K-M03-010 | Späterer Entscheidungsfall hat blockierende Kerninformation oder ungeklärte Fachfreigabe | künftiger Data-Requirement-/Readiness-Vertrag | Rolf | Rolf „Der Tag“ › Ziele & Entscheidungen › Handlungsbedarf | nur reversible Vorbereitung; C3-Klärfall/Fachperson; Entscheidung/Aktion bleibt gesperrt | GEPLANT; Decision Governance/C3 blockiert |
| K-M03-011 | Termintreue oder Liquidität 30 Tage kippt im ersten gemeinsamen Unternehmensziel | getrennte, versionierte M02-Bewertung markiert mindestens eine Zielgröße als gefährdet | Rolf | Rolf „Der Tag“ › oberer Handlungsbereich › Ziele & Entscheidungen | betroffene M01-/M02-Quelle öffnen; Entscheidung erst im freigegebenen Governance-Pfad treffen und Wirkung auf beide Zielgrößen prüfen | SPEZ; reale M01-/M02-Ports und Anzeige FEHLT |

## 3. Zuständigkeitsgrundsatz

- Fachliche Ziel-, Messbarkeits-, Revisions-, Unknown- und Entscheidungsfälle landen bei Rolf. Dringende Fälle stehen im oberen Handlungsbereich vor dem Tagesüberblick; vollständige Analyseinhalte werden dort nicht dupliziert.
- Phillip erhält erst dann einen M03-Fall, wenn eine spätere berechtigte Delegations-/Aufgabenreferenz real vorhanden ist; M03 besitzt den Aufgabenstatus nicht.
- Gregor erhält ausschließlich technische Rechte-, Integritäts-, Connector- und Recoveryhinweise; Adminstatus ist keine fachliche Freigabe.
- Kein Konflikt erzeugt einen lokalen „erledigt“-Schreibweg auf Home. Auflösung erfolgt immer beim zuständigen Wahrheitseigentümer mit Receipt/Readback.
