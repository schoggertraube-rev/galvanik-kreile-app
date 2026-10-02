<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G08_SUCHE — Regeln, Sperren und Konflikte

## Fach- und Sicherheitsregeln

1. Suche ist read-only; kein Suchpfad darf einen Command oder eine Mutation auslösen.
2. Server-Identity, Tenant und Capability sind die einzige Autorisierungsquelle; kein Client-`tenantId` und keine Rollenentscheidung im Kern.
3. RLS/Tenantfilter wirken vor Retrieval. Ein Fremdtenant-Treffer ist ein Gate-Fehler, kein filterbarer UI-Fall.
4. Unter zwei Zeichen werden keine Ports aufgerufen; über 80 Zeichen wird vor Portzugriff abgewiesen.
5. Jede Quelle validiert ihre Rückgabe vollständig. Unbelegte oder inkonsistente Daten schließen V1 insgesamt.
6. Ein Treffer ist nur mit Quelle, Matchfeld, Matchwert und stabiler Entity-ID zulässig.
7. Geprüfte Quellen werden erst nach vollständig erfolgreichem Portaufruf gemeldet.
8. Kappung ist nie still; unbewiesene Vollständigkeit setzt `truncated=true`.
9. Resultatnavigation verwendet typisierte Action-Keys; freie URLs aus Portdaten sind verboten.
10. Dokumente, KI und weitere Quellen bleiben deaktiviert, bis ein öffentlicher Besitzer-Port und ein freigegebenes Ticket existieren.
11. Der App-Backstack besitzt Route, Filter, Scroll und Fokus; der neutrale Suchkern besitzt keine Routerlogik.
12. Demo-/Mockdaten und HTML-Beispieldaten dürfen niemals in Produktresultate gelangen.

## Sperren

| Sperre | verhindert | Ebene (UI/Server/DB) | Beleg | Stand |
|---|---|---|---|---|
| Query <2 Zeichen | unnötigen Datenzugriff und Rauschen | Kern/Server | `searchTenant.test.ts` | GEBAUT |
| Query >80 oder Nicht-String | Missbrauch und uneindeutige Eingabe | Kern/Server, vor Ports | `searchTenant.test.ts` | GEBAUT |
| fehlende/ungültige Session | jeden Quellenzugriff | Server | `search_tenant.integration.test.ts` | GEBAUT |
| fehlende Lesecapability/individuelle Admin-Sperre | Suche und Zielkartenzugriff | Server + UI-Anzeige | OE-2609-09; heutiger `perm_view_leitstand`-Check | Ziel SPEZ; heutige enge Sperre umzubauen |
| Tenant-/RLS-Grenze | fremde Auftrags-/Kundendaten | DB/Server | Fresh-DB-Fremdtenanttest | GEBAUT |
| malformed/unbelegte Portdaten | Teilwahrheit und erfundene Treffer | Kern | negative Unit-Tests | GEBAUT |
| Pflichtquellenfehler | veraltete/partielle Ergebnisdarstellung | Kern/UI | `UNAVAILABLE`, keine Hits | GEBAUT |
| Kappungsgrenze 10/Quelle, 20 gesamt | übergroße Dialogresultate und falsche Vollständigkeit | Kern/UI | Coverage-Test | GEBAUT |
| geschlossene Resultatnavigation | URL-/Router-Tunnel und unbekannte Zieltypen | HostAdapter | Zielarchitektur 4a/4c | SPEZ |
| Dokument-Port fehlt | Schein-Dokumentensuche | HostAdapter/UI | OP-10, Q-G08-001 | verbindlich gesperrt |
| Provider nicht entschieden | KI-/Internet-/Kosten-Fallback | Architektur/Server | D-AI-001; Owner-Grenzen | verbindlich gesperrt |
| Ziel-Designsystem nicht abgenommen | Kopieren von Mock-/Alt-CSS | UI-Gate | OE-2609-03; Designphase 1 | verbindlich bis Phase 1 |
| vollständige Route nicht belegt | Teilkomponente als UI-PASS | Abnahme/Governance | D-UI-CORE-001 | offen bis T-04 |

## Konflikte und Zuständigkeit

| ID | Auslöser | Erkennung | zuständig (Rolf/Phillip/Gregor) | Anzeigeort (Startseite-Bereich) | Auflösung | Stand |
|---|---|---|---|---|---|---|
| K-G08-001 | Session oder technische Capability nicht bestimmbar | Authorization-Port liefert `UNAUTHENTICATED`, `FORBIDDEN` oder `UNAVAILABLE` | Gregor | lokal im Suchdialog; später Gregor-Systemzugang über öffentlichen Diagnoseport | Session/Rechte prüfen; kein Retry ohne geklärten Zustand; Correlation-ID an Diagnose | teilweise GEBAUT, Correlation-ID FEHLT |
| K-G08-002 | Auftrags-/Kundendaten verletzen Tenant- oder Schema-Invarianten | Portvalidator oder `tenant_integrity_ok=false` | Rolf für Fachdaten; Gregor bei technischer Ursache | lokal im Suchdialog; spätere Rolf-Klärung nur über Port des besitzenden Moduls | besitzendes Modul korrigiert Wahrheit; G08 zeigt keine Teiltreffer | GEBAUT fail-closed; Home-Projektion SPEZ |
| K-G08-003 | Treffer war beim Öffnen lesbar, Zielkarte ist danach gelöscht/gesperrt/nicht mehr lesbar | Zielkarten-AppAdapter liefert typisierten Nicht-verfügbar-/Sperrstatus | Rolf bei Auftrags-/Kundenzuordnung, Gregor bei Rechten | Suchdialog bleibt als Ausgang; spätere Klärung im besitzenden Modul | keine Schattenkarte; Readback der Originalkarte, sichere Rückkehr zur Suche | SPEZ |
| K-G08-004 | Resultattyp oder Action-Key ist nicht registriert | Navigator-Registry lehnt Schlüssel ab | Gregor | lokaler Dialogfehler; Gregor-Systemzugang über Diagnoseport | nichts öffnen; Konfiguration/Version korrigieren; Correlation-ID ausgeben | SPEZ |
| K-G08-005 | zwei UI-Schichten reagieren auf Escape und würden doppelt schließen | Integrationstest zählt Stacktiefe vor/nach Escape | Gregor | kein globaler Startseitenfall; sichtbar durch erhaltene Suche/Karte | ein zentraler Top-Layer-Handler; pro Escape exakt ein Pop | Risiko im Ist: globaler Store-Listener plus Dialoglistener |
| K-G08-006 | Portausfall bei einer Pflichtquelle | Promise-/Timeout-/Validatorfehler einer Source | Gregor technisch; Rolf nur bei belegtem Fachdatendefekt | lokaler Suchdialog; spätere Systemdiagnose über öffentlichen Port | Gesamtergebnis verwerfen, sichere Wirkung nennen, keine Teilwahrheit | GEBAUT ohne Correlation-ID |

## Konfliktrouting-Grenze

G08 legt keine neue Konflikttabelle und keinen eigenen Arbeitsvorrat an. Ein wiederaufnehmbarer Fall gehört dem Modul, dessen Daten oder Capability betroffen sind. Eine spätere Startseitenanzeige liest ihn ausschließlich über dessen öffentlichen Port. Bis dahin bleibt der konkrete Fehler im Dialog sichtbar; es wird weder ein Erfolg noch ein fiktiver Rolf-/Phillip-Task behauptet.
