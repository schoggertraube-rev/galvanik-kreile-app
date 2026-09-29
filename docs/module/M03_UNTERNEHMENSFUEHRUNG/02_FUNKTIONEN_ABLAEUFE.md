<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 02 - Funktionen und Abläufe

Stand: 2026-09-26  
Modul: M03 Unternehmensführung

Die folgenden Funktionen beschreiben ausschließlich den ersten Slice `GOALS_V1`. `DECISION_GOVERNANCE_V1`, Klärcenter, Action Gateway und Effect Assessment sind keine verdeckten Teilfunktionen; sie bleiben gemäß A-M03-032 bis A-M03-036 hinter eigenen Gates.

### F-M03-001 — Zielentwurf anlegen oder überarbeiten

**Auslöser:** Eine berechtigte Person legt eine neue Zielabsicht an oder erstellt zu einem offenen Ziel einen neuen Draft.  
**Personen:** Standardmäßig Rolf, Phillip und Gregor gemäß OE-2609-09; der zentrale Admin kann je Person sperren/erweitern. Der neutrale Core kennt keine Personennamen und verlangt `goals:save-draft`.  
**Schritte:**

1. Der Server bindet `SecurityScopeRef`, Actor-, Authentication-, Command-, Idempotenz-, Korrelations- und Zeitmetadaten.
2. Der Host autorisiert `goals:save-draft` und bestätigt die Command-Bindung.
3. Der Core validiert Label, Zielmodus/-wert, Einheit, versionierte Messdefinition, ISO-Intervall/Zeitzone, `validFrom`, Verantwortung und ausschließlich opake Fremdreferenzen.
4. Der Core liest ein vorhandenes Receipt und führt einen identischen Wiederholaufruf als `replayed`; ein abweichender Inhalt am selben Schlüssel wird abgewiesen.
5. Der Core liest das vorhandene Aggregat, prüft `expectedRevision` und erzeugt eine neue unveränderliche Zielversion. Ein vorheriger Draft wird append-only als abgelöst markiert.
6. Hostpersistenz schreibt Aggregat, `goal.draft-saved.v1` und Receipt atomar.

**Ergebnis + Receipt/Readback:** `committed` oder `replayed` mit dauerhaftem Receipt, neuer Aggregate-Revision, Aggregate-Hash und Draft-Version-ID; unabhängiger Readback über `GoalReceiptReadPortV1`.  
**Fehlerfälle:** Zugriff verweigert, Binding ungültig, Validierung fehlgeschlagen, Ziel bereits vorhanden, Revision-/Idempotenzkonflikt, Persistenzausgang unbekannt.  
**Sperren/Konflikte:** K-M03-001, K-M03-002, K-M03-005, K-M03-007.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Formular mit vollständig belegten Zielabsichtsfeldern und Speichern-Aktion | FEHLT → Q-M03-002 | Candidate.3 ist UI-los; Designphase 1b |
| lädt | Speichern läuft; Aktion gegen Doppel-Auslösung gesichert | FEHLT → Q-M03-002 | Red-Team RT-22; Designphase 1b |
| leer | Noch kein Ziel/Draft; Aktion zum neuen Entwurf nur bei Berechtigung | FEHLT → Q-M03-002 | Candidate.3 `GoalAggregateV1`; Designphase 1b |
| Fehler | Sicherer Fehler mit Wirkung, nächstem Weg und Correlation-ID ohne Secret | FEHLT → Q-M03-002 | D-RES-001; Designphase 1b |
| gesperrt | Kein Schreibzugriff; kein Existenzsignal fremder Ziele | FEHLT → Q-M03-002 | `AuthorizationPortV1`; Designphase 1b |
| In Klärung | Modul noch nicht adoptiert, keine Route oder Daten | „In Klärung“ | Anleitung §6; OE-2609-04 |
| In Aufbau | Modul nach freigegebenem Baustart, aber vor realem E2E nicht nutzbar | „In Aufbau“ | Anleitung §6; OE-2609-04 |

### F-M03-002 — Zielversion aktivieren

**Auslöser:** Eine berechtigte Person aktiviert den aktuellen Draft als gültige Zielabsicht.  
**Personen:** Alle gemäß zentralem Hostrecht; Admin kann sperren/erweitern. Serverseitige Bestätigung ist zwingend.  
**Schritte:**

1. Der Server bindet Context, erwartete Revision und einmalige Challenge an den exakten Command-Hash.
2. Authorization und Command-Binding werden fail-closed geprüft.
3. Der Core weist fehlenden Draft, bereits aktive Version oder Revisionskonflikt ab.
4. `ConfirmationPortV1` verifiziert Challenge, Kontext und Einmaligkeit.
5. `ResponsibilityReadPortV1` löst die Verantwortungsreferenz aktuell auf.
6. `MeasurementDefinitionReadPortV1` liefert exakt die gehashte Version, kompatiblen Werttyp/Einheit/Zeitzone sowie ausreichende Frische/Coverage.
7. Der Core markiert den Draft append-only als aktiv und erzeugt `goal.activated.v1`.
8. Hostpersistenz committet Aggregat, Event und Receipt atomar.

**Ergebnis + Receipt/Readback:** Receipt mit aktiver Version-ID, neuer Revision, Hash, Policyversionen und Confirmation-EvidenceRef; Readback unabhängig vom Transport.  
**Fehlerfälle:** Missing/expired/mismatch/replayed/wrong-context Confirmation; Responsibility ungeklärt; Measurement missing/stale/partial/denied/incompatible; Revision-/Idempotenzkonflikt; unknown.  
**Sperren/Konflikte:** K-M03-001 bis K-M03-005, K-M03-007.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Aktivierungszusammenfassung mit Zielversion, Messdefinition, Zeitraum und Verantwortung | FEHLT → Q-M03-002 | `ActivateGoalCommandV1`; Designphase 1b |
| lädt | Bestätigung, Abhängigkeitsprüfung und Commit laufen | FEHLT → Q-M03-002 | Candidate.3 `runtime.ts`; Designphase 1b |
| leer | Kein aktivierbarer aktueller Draft | FEHLT → Q-M03-002 | `DRAFT_NOT_FOUND`; Designphase 1b |
| Fehler | Fehlerwirkung und sicherer nächster Schritt; kein Erfolgszustand ohne Receipt | FEHLT → Q-M03-002 | D-RES-001; Designphase 1b |
| gesperrt | Aktivierung wegen Recht, Confirmation oder blockierender Abhängigkeit nicht möglich | FEHLT → Q-M03-002 | Candidate.3 Error Taxonomy; Designphase 1b |
| In Klärung | Hostports oder Adoption fehlen | „In Klärung“ | Anleitung §6 |
| In Aufbau | Realer Build läuft, Gate noch nicht bestanden | „In Aufbau“ | Anleitung §6 |

### F-M03-003 — Aktive Zielversion ablösen

**Auslöser:** Eine berechtigte Person ersetzt eine aktive Zielversion durch einen bereits gespeicherten aktuellen Draft.  
**Personen:** Alle gemäß zentralem Hostrecht; Adminsteuerung wie F-M03-002; serverseitige Bestätigung zwingend.  
**Schritte:**

1. Der Host bindet aktiven Versionsbezug, Ersatz-Draft, Reason-Code und erwartete Revision an den Command.
2. Authorization, Binding, Idempotenz und Confirmation werden geprüft.
3. Der Core prüft, dass genau die genannte aktive Version und genau der genannte aktuelle Draft existieren.
4. Verantwortung und Messdefinition des Ersatz-Drafts werden wie bei Aktivierung real aufgelöst.
5. Die bisher aktive Version erhält append-only den Status `Superseded`; der Draft erhält append-only `Active`.
6. Die Transitionen und `goal.superseded.v1` referenzieren alte und neue Version sowie Reason-Code.
7. Der Host committet Aggregate, Event und Receipt atomar.

**Ergebnis + Receipt/Readback:** Receipt und Readback zeigen die neue aktive Version; alte Version, Dispositionen und Transitionen bleiben unverändert lesbar.  
**Fehlerfälle:** aktive Version/Draft fehlt, falsche Revision, Reason-Code ungültig, Confirmation/Portfehler, Commit unknown.  
**Sperren/Konflikte:** K-M03-001 bis K-M03-005, K-M03-007.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Vergleich aktive Version zu Ersatz-Draft mit Grund und Bestätigung | FEHLT → Q-M03-002 | `SupersedeGoalCommandV1`; Designphase 1b |
| lädt | Dependency-Check und atomarer Commit laufen | FEHLT → Q-M03-002 | Candidate.3 `runtime.ts`; Designphase 1b |
| leer | Keine aktive Version oder kein Ersatz-Draft vorhanden | FEHLT → Q-M03-002 | Candidate.3 Error Taxonomy; Designphase 1b |
| Fehler | Revisions-/Dependency-/Persistenzfehler mit sicherem nächsten Weg | FEHLT → Q-M03-002 | D-RES-001; Designphase 1b |
| gesperrt | Recht oder Bestätigung fehlt | FEHLT → Q-M03-002 | `AuthorizationPortV1`, `ConfirmationPortV1`; Designphase 1b |
| In Klärung | Host-/Designgate offen | „In Klärung“ | Anleitung §6 |
| In Aufbau | Implementierung noch nicht real abgenommen | „In Aufbau“ | Anleitung §6 |

### F-M03-004 — Ziel schließen

**Auslöser:** Eine berechtigte Person beendet ein offenes Ziel mit Reason-Code.  
**Personen:** Alle gemäß zentralem Hostrecht; Adminsteuerung wie oben; serverseitige Bestätigung zwingend.  
**Schritte:**

1. Context, erwartete Revision, Reason-Code und Confirmation werden serverseitig gebunden.
2. Authorization, Idempotenz, Revision und Confirmation werden geprüft.
3. Der Core markiert vorhandene aktive/Draft-Versionen append-only als abgelöst.
4. Der Lebenszyklus wechselt mit `closedAt`, `closedBy` und Reason-Code auf `Closed`.
5. `goal.closed.v1`, Aggregate und Receipt werden atomar geschrieben.
6. Jeder spätere Schreibcommand wird mit `GOAL_CLOSED` abgewiesen; Reads bleiben möglich.

**Ergebnis + Receipt/Readback:** Dauerhaftes Receipt und lesbarer geschlossener Lebenszyklus samt vollständiger Historie.  
**Fehlerfälle:** Ziel fehlt/bereits geschlossen, falsche Revision, Confirmationfehler, Persistenzkonflikt/unknown.  
**Sperren/Konflikte:** K-M03-001, K-M03-002, K-M03-005, K-M03-007.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Abschlusszusammenfassung, Reason-Code und irreversible Bestätigung | FEHLT → Q-M03-002 | `CloseGoalCommandV1`; Designphase 1b |
| lädt | Bestätigung und atomarer Commit laufen | FEHLT → Q-M03-002 | Candidate.3 `runtime.ts`; Designphase 1b |
| leer | Kein offenes Ziel vorhanden | FEHLT → Q-M03-002 | `GOAL_NOT_FOUND`; Designphase 1b |
| Fehler | Abschluss nicht bestätigt; sicherer Wiederaufnahmeweg | FEHLT → Q-M03-002 | D-RES-001; Designphase 1b |
| gesperrt | Recht/Confirmation fehlt oder Ziel bereits geschlossen | FEHLT → Q-M03-002 | Candidate.3 Error Taxonomy; Designphase 1b |
| In Klärung | Modul/Host noch nicht freigegeben | „In Klärung“ | Anleitung §6 |
| In Aufbau | Umsetzung noch nicht durch reales E2E belegt | „In Aufbau“ | Anleitung §6 |

### F-M03-005 — Ziel, Versionen und Command-Ausgang lesen

**Auslöser:** Eine berechtigte Person öffnet ein Ziel oder prüft nach einem Command dessen Ausgang.  
**Personen:** Alle gemäß zentralem `goals:read` beziehungsweise `goals:read-receipt`; Rechte je Person administrierbar.  
**Schritte:**

1. Der Server validiert Context und Ziel- oder Idempotenzschlüssel.
2. Authorization wird getrennt für Ziel beziehungsweise Receipt geprüft.
3. Hostpersistenz liest scope-gebunden das Aggregat oder Receipt.
4. Der Core prüft Identität, Scope, Vertrag, Hash-/Receiptstruktur und tiefe Immutability.
5. Die UI zeigt aktuelle Disposition je Version, vollständige append-only Transitionen und Read-Metadaten; sie erfindet keine Bewertung.

**Ergebnis + Receipt/Readback:** `ReadEnvelopeV1<GoalAggregateV1|null>` beziehungsweise `ReadEnvelopeV1<CommandReceiptV1|null>` mit Quelle, `asOf`, Coverage und eindeutigem Status.  
**Fehlerfälle:** denied ohne Existenzsignal, korrupte Hosthülle, conflict/error/unknown, nicht gefunden als echtes `null` bei berechtigtem Scope.  
**Sperren/Konflikte:** K-M03-003, K-M03-005 bis K-M03-007.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Zielkopf, aktive/Draft-/abgelöste Versionen, Transitionen, Lifecycle und Receipt-Nachweis | FEHLT → Q-M03-002 | Candidate.3 `types.ts`, `contracts.ts`; Designphase 1b |
| lädt | Scope- und Integritätsprüfung läuft | FEHLT → Q-M03-002 | Candidate.3 `runtime.ts`; Designphase 1b |
| leer | Berechtigter Read liefert kein Ziel/Receipt | FEHLT → Q-M03-002 | `ReadEnvelopeV1<...\|null>`; Designphase 1b |
| Fehler | Korrupter/fehlgeschlagener Read mit Correlation-ID und ohne Rohdetails | FEHLT → Q-M03-002 | D-RES-001; Designphase 1b |
| gesperrt | Zugriff verweigert; keine Objektmetadaten sichtbar | FEHLT → Q-M03-002 | `ACCESS_DENIED`; Designphase 1b |
| In Klärung | Produktread fehlt, nur Off-Repo-Contract vorhanden | „In Klärung“ | Anleitung §6 |
| In Aufbau | Reale Readnaht noch im Gate | „In Aufbau“ | Anleitung §6 |

### F-M03-006 — Zielaufmerksamkeit projizieren

**Auslöser:** Rolf/Home oder eine berechtigte Hostoberfläche fragt offene Ziele für einen Zeitpunkt und optional eine Verantwortung ab.  
**Personen:** Read-only gemäß `goals:read-projection`; Default-Zugriff und Adminsteuerung gemäß OE-2609-09.  
**Schritte:**

1. Host bindet Zeitpunkt, optionalen Responsibility-Filter, Limit und Cursor.
2. Authorization prüft den Projektionsread.
3. Der Core liest paginiert offene Aggregate und wählt gültige aktive Zielversionen.
4. Der optionale externe Evaluation-Port liefert je Ziel ein eigenes `ReadEnvelope`; ohne Port entsteht keine erfundene Bewertung.
5. Für den ersten Kreile-Nutzenfall bindet der Host die getrennten M02-Bewertungen zu Termintreue und Liquidität 30 Tage ein; M03 kopiert weder deren Fakten noch Berechnungen.
6. Die Seite übernimmt den schlechtesten Evaluation-/Coveragezustand; ein Cursor erzwingt `partial`. Sobald eine der beiden ersten Zielgrößen kippt, wird der Fall als dringend behandelt.
7. Die Host-UI priorisiert später höchstens drei Fokusziele als Kreile-Policy, ohne kritische Ausnahmen zu verstecken, und ordnet dringende Warnungen im oberen Handlungsbereich vor dem Tagesüberblick ein.

**Ergebnis + Receipt/Readback:** Read-only `GoalAttentionPageV1`; beim ersten Kreile-Nutzenfall bleiben Termintreue und Liquidität 30 Tage getrennt quellengebunden und gemeinsam sichtbar. Kein Command, kein Receipt und keine lokale Erledigt-Wahrheit.  
**Fehlerfälle:** Evaluation fehlt/stale/partial/denied/error/unknown, Pagination unvollständig, Zugriff verweigert, Hostportfehler.  
**Sperren/Konflikte:** K-M03-003, K-M03-004, K-M03-006, K-M03-008.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Zielreferenz, Version, Verantwortung sowie getrennte Bewertungen für Termintreue und Liquidität 30 Tage mit Datenstand und Coverage | FEHLT → Q-M03-002 | `GoalAttentionProjectionReadPortV1`; OE-2609-23; Designphase 1b |
| lädt | Read und optionale Evaluationen laufen | FEHLT → Q-M03-002 | Candidate.3 `projection.ts`; Designphase 1b |
| leer | Keine gültigen offenen Zielreferenzen im berechtigten Scope | FEHLT → Q-M03-002 | `GoalAttentionPageV1`; Designphase 1b |
| Fehler | Projektion nicht belastbar; Quelle und nächster sicherer Weg | FEHLT → Q-M03-002 | D-RES-001; Designphase 1b |
| gesperrt | Projektion nicht berechtigt; keine Zielhinweise | FEHLT → Q-M03-002 | `goals:read-projection`; Designphase 1b |
| In Klärung | M02/Evaluation oder Adoption fehlt | „In Klärung“ | Anleitung §6 |
| In Aufbau | Reale Projektion noch nicht abgenommen | „In Aufbau“ | Anleitung §6 |

### F-M03-007 — Unknown oder Konflikt sicher auflösen

**Auslöser:** Ein Command endet `unknown`, ein Receiptread ist unklar oder `expectedRevision` kollidiert.  
**Personen:** Die auslösende berechtigte Person; technische Diagnose kann Gregor sehen, fachliche Daten bleiben rollen-/scopegeschützt.  
**Schritte:**

1. Die UI zeigt keinen Erfolg und sendet denselben Command nicht blind erneut.
2. Bei `unknown` liest der Host mit demselben Idempotenzschlüssel über `GoalReceiptReadPortV1` nach.
3. Gefundenes, exakt zu Goal-ID, Command-Art, Intent-Hash und Scope passendes Receipt wird als committed/replayed übernommen.
4. Kein Receipt beziehungsweise weiter unknown bleibt sichtbar und wird per Reconciliation-Token wiederaufnehmbar.
5. Bei Revisionskonflikt lädt der Host das aktuelle Aggregat neu und verlangt eine bewusste Neubasierung der Nutzerabsicht.
6. Abweichendes Receipt, Cross-Scope-Inhalt oder korrupte Hosthülle wird als Integritätsverletzung behandelt, nicht als Erfolg.

**Ergebnis + Receipt/Readback:** Entweder belegtes Receipt plus Reload/Readback, expliziter Revisionskonflikt oder weiterhin ehrlicher Unknown-Zustand; keine Doppelmutation.  
**Fehlerfälle:** Receiptport nicht erreichbar, Receipt passt nicht zum Command, Scopewechsel, Prozessneustart, Hostclock/Hash/ID-Port fehlerhaft.  
**Sperren/Konflikte:** K-M03-002, K-M03-005 bis K-M03-008.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Belegter Ausgang mit Receipt, Revision, Hash und nächstem zulässigem Schritt | FEHLT → Q-M03-002 | Candidate.3 `CommandOutcomeV1`; Designphase 1b |
| lädt | Unabhängiger Receipt-Readback beziehungsweise Reload läuft | FEHLT → Q-M03-002 | Adoption Mission §4; Designphase 1b |
| leer | Noch kein dauerhaftes Receipt gefunden; Zustand bleibt offen | FEHLT → Q-M03-002 | `GoalReceiptReadPortV1`; Designphase 1b |
| Fehler | Integritäts-/Hostfehler mit Correlation-ID, ohne Blind-Retry | FEHLT → Q-M03-002 | D-RES-001; Designphase 1b |
| gesperrt | Receipt-/Zielread nicht berechtigt oder Scope passt nicht | FEHLT → Q-M03-002 | `ACCESS_DENIED`; Designphase 1b |
| In Klärung | Reconciliation-Hostpfad fehlt | „In Klärung“ | Anleitung §6 |
| In Aufbau | Recoverypfad ist im realen E2E noch nicht abgenommen | „In Aufbau“ | Anleitung §6 |

## Bewusst nicht baubare spätere Funktionen

- `DECISION_GOVERNANCE_V1`: keine Typen, Ports, Commands, Events, Tabellen, Route oder UI; Status `BLOCKED_NOT_BUILDABLE`.
- `DATA_QUALITY_AND_CLARIFICATION_V1`, Analysis/Forecast, Planning, External Intelligence und Action Gateway: jeweils getrennte Wahrheitseigentümer und spätere Gates.
- Entscheidungs- und Wirkungsoberflächen dürfen in Designphase 1b als Inhaltsbedarf geplant, aber vor den jeweiligen Verträgen weder geroutet noch als Produktfunktion gebaut werden. Sobald dieses Gate später öffnet, muss jede Entscheidung des ersten Kreile-Nutzenfalls ihre Wirkung auf Termintreue und Liquidität 30 Tage getrennt ausweisen.
