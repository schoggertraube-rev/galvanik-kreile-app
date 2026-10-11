<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 02 – Funktionen und Abläufe

Stand: 2026-09-26  
Modul: M02 Analyse

**Personengrundsatz für alle Funktionen:** Standardmäßig dürfen alle Kreile-Personen alles lesen, soweit die angefragten Fachdaten freigegeben sind; der Admin kann Rechte je Person sperren oder erweitern. M02 besitzt dafür keine zweite Rollenwahrheit, sondern übernimmt die Entscheidung des Hosts.

### F-M02-001 — Entscheidungsübersicht lesen

- **Auslöser:** Nach erfolgter Anbindung öffnet eine berechtigte Person den eigenen Menüpunkt Analyse oder eine freigegebene Analyse-Projektion an Auftrag oder Kunde.
- **Personen:** Standardmäßig alle angemeldeten Kreile-Personen; Einschränkungen nur durch die Host-Autorisierung. Primär Rolf, bei Integrationsfragen Gregor, bei Produktionsursachen Phillip.
- **Ablauf:**
  1. Der Host bestimmt Tenant, Person, Rollen, Sichtbarkeits- und Zeitraumkontext.
  2. Der Host ruft ausschließlich `decision-support.read/v1` mit kanonischem Metric-Pack und Domain-Fact-Adapter auf.
  3. Der Core validiert Capabilities, Evidenz, Disclosure und Coverage.
  4. Der Core erzeugt deterministische Claims, Empfehlungen, Briefs und renderer-neutrale Projektionen.
  5. Die UI zeigt Ergebnis, Verlauf, betroffene Aufträge, Ursachen, Aktualität, Umfang, Unsicherheit und Herkunft gemeinsam an.
- **Ergebnis/Readback:** `ReadEnvelope` mit stabiler `projectionId` und `contentHash`; kein Command-Receipt, keine Mutation.
- **Fehler:** Capability `UNSUPPORTED`/`ERROR`, Evidenz `STALE`/`PARTIAL`/`UNKNOWN`/`CONFLICTING` oder Disclosure `DENIED`/`SUPPRESSED` werden sichtbar und dürfen nicht in einen belastbaren Befund umgedeutet werden.
- **Konflikte:** K-M02-001, K-M02-002, K-M02-004, K-M02-006.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Freigegebene Entscheidungsübersicht mit Provenienz, Coverage und Unsicherheit | FEHLT → Q-M02-002 | `RUNTIME_TRUTH.md`, `FUNCTION_CATALOG.md` |
| lädt | Reservierter Ladebereich ohne erfundene Kennzahlen | FEHLT → Q-M02-002 | RT-22 |
| leer | Leerergebnis mit Scope und Datenabdeckung | FEHLT → Q-M02-002 | RT-22, `SOURCES_AND_REQUIREMENTS.md` |
| Fehler | Fehlerzustand mit maschinenlesbarem Fehlercode; keine Nullwert-Ersatzanzeige | FEHLT → Q-M02-002 | `decision-support.read/v1` |
| gesperrt | Keine Datenwerte; Disclosure-Zustand und nächster zulässiger Schritt | FEHLT → Q-M02-002 | RT-22, OE-2609-09 |
| In Klärung | Grauer, nicht aktiver Modulzustand | `In Klärung` | OE-2609-04 |
| In Aufbau | Grauer, nicht aktiver Modulzustand für freigegebenen Aufbau | `In Aufbau` | OE-2609-04 |

### F-M02-002 — Belegspur und Drill-down prüfen

- **Auslöser:** Eine Person öffnet einen Claim, eine Empfehlung oder einen Datenpunkt.
- **Personen:** Wie F-M02-001; die Disclosure-Entscheidung gilt bis auf Feldebene.
- **Ablauf:**
  1. Die UI übernimmt den unveränderten Scope und Snapshot der Ausgangsprojektion.
  2. Der Host fordert die zugehörige Derivation- und Provenienzspur an.
  3. Der Core liefert Quellreferenzen, Berechnungsschritte, Coverage, Ausschlüsse und Unsicherheit.
  4. Die UI zeigt Tabellenalternative und Beschreibung zusätzlich zur Visualisierung.
  5. Bei unterdrückter Sekundärableitung bleibt die gesamte abhängige Belegspur unterdrückt.
- **Ergebnis/Readback:** Nachprüfbare Belegspur mit identischer `projectionId`/`contentHash`-Bindung.
- **Fehler:** Fehlende oder nicht sichtbare Primärbelege unterdrücken abhängige Werte; kein Rückfall auf Legacy-Queries.
- **Konflikte:** K-M02-002, K-M02-003, K-M02-004.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Ableitung, Quellen, Scope, Coverage, Ausschlüsse und Tabellenalternative | FEHLT → Q-M02-002 | `RUNTIME_TRUTH.md`, `P1_CLOSURE.md` |
| lädt | Strukturierter Ladezustand der Belegspur | FEHLT → Q-M02-002 | RT-22 |
| leer | Keine freigegebenen Belege im unveränderten Scope | FEHLT → Q-M02-002 | `SOURCES_AND_REQUIREMENTS.md` |
| Fehler | Fehlercode und betroffener Ableitungsschritt | FEHLT → Q-M02-002 | `decision-support.read/v1` |
| gesperrt | Unterdrückte Quelle und alle davon abhängigen Projektionen bleiben wertfrei | FEHLT → Q-M02-002 | externer P1-Reaudit |
| In Klärung | Grauer, nicht aktiver Detailzustand | `In Klärung` | OE-2609-04 |
| In Aufbau | Grauer, nicht aktiver Detailzustand | `In Aufbau` | OE-2609-04 |

### F-M02-003 — Szenario und Prognose lesen

- **Auslöser:** Eine Person öffnet ein freigegebenes Szenario oder eine Prognose aus einem Analysebefund.
- **Personen:** Wie F-M02-001; Veröffentlichung und Priorität werden außerhalb des Cores verantwortet.
- **Ablauf:**
  1. Der Host liefert Baseline, Parameter, Zeitraum, Zeitzone, Snapshot und Policy.
  2. Der Core validiert Methoden und Eingaben ohne Systemzeit, Zufall oder Gleitkomma-Geldwerte.
  3. Er berechnet nur zugelassene deterministische Methoden.
  4. Er kennzeichnet Szenario, Prognose, Ist-Wert und Unsicherheit getrennt.
  5. Spätere Ist-Werte können zur Prognosebewertung referenziert werden.
- **Ergebnis/Readback:** Szenario-/Forecast-Projektion mit Eingaben, Methode, Version, Provenienz und Content-Hash.
- **Fehler:** Unvollständige oder widersprüchliche Eingaben führen zu PARTIAL/UNKNOWN/CONFLICTING beziehungsweise Fehler, nie zu einem erfundenen Schätzwert.
- **Konflikte:** K-M02-001, K-M02-002, K-M02-005.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Getrennte Baseline, Annahmen, Ergebnis und Unsicherheit | FEHLT → Q-M02-002 | `FUNCTION_CATALOG.md`, `KPI_RESEARCH_AND_ADMISSION.md` |
| lädt | Reservierter Ladebereich ohne Zwischenwert als Wahrheit | FEHLT → Q-M02-002 | RT-22 |
| leer | Kein zugelassenes Szenario für Scope und Snapshot | FEHLT → Q-M02-002 | `KPI_RESEARCH_AND_ADMISSION.md` |
| Fehler | Eingabe-/Methodenfehler mit Code | FEHLT → Q-M02-002 | `decision-support.read/v1` |
| gesperrt | Keine Parameter oder Ergebnisse sichtbar | FEHLT → Q-M02-002 | OE-2609-09 |
| In Klärung | Grauer, nicht aktiver Szenariozustand | `In Klärung` | OE-2609-04 |
| In Aufbau | Grauer, nicht aktiver Szenariozustand | `In Aufbau` | OE-2609-04 |

### F-M02-004 — Handlung und Wirkung nachvollziehen

- **Auslöser:** Eine Person öffnet eine Empfehlung mit referenzierter Handlung oder spätere Wirkungsauswertung.
- **Personen:** Lesend alle gemäß Host; der Core selbst löst keine Handlung aus.
- **Ablauf:**
  1. Der Core liefert eine Empfehlung mit Evidenz und optionaler externer Action-Referenz.
  2. Eine Handlung wird ausschließlich in einem zuständigen Fremdmodul ausgelöst.
  3. Dessen kanonisches Receipt wird später als unveränderte Referenz angeliefert.
  4. Neue Ist-Fakten werden mit gleichem Scope und dokumentierter Zeitbasis bewertet.
  5. Der Core erzeugt eine Effect-Assessment-Projektion ohne Kausalitätsbehauptung über die Evidenz hinaus.
- **Ergebnis/Readback:** Lesbare Kette Empfehlung → Fremdhandlung/Receipt → beobachtete Wirkung; keine eigene Command-Schnittstelle.
- **Fehler:** Fehlendes Receipt oder nicht vergleichbare Scopes werden sichtbar; Wirkung bleibt dann unbestätigt.
- **Konflikte:** K-M02-005, K-M02-007.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Empfehlung, externe Receipt-Referenz und Wirkungsauswertung getrennt | FEHLT → Q-M02-002 | `FUNCTION_CATALOG.md`, `DECISION_TRACE_AND_VISUAL_CONTRACT.md` |
| lädt | Ladezustand ohne voreilige Wirkungsbehauptung | FEHLT → Q-M02-002 | RT-22 |
| leer | Keine freigegebene Handlung oder kein vergleichbarer Nachlauf | FEHLT → Q-M02-002 | `RUNTIME_TRUTH.md` |
| Fehler | Fehlercode und nicht auswertbarer Teil der Kette | FEHLT → Q-M02-002 | `decision-support.read/v1` |
| gesperrt | Referenz und abhängige Werte unterdrückt | FEHLT → Q-M02-002 | P1-Abschluss |
| In Klärung | Grauer, nicht aktiver Wirkungszustand | `In Klärung` | OE-2609-04 |
| In Aufbau | Grauer, nicht aktiver Wirkungszustand | `In Aufbau` | OE-2609-04 |

### F-M02-005 — Analyse-Projektion in anderen Modulen lesen

- **Auslöser:** Home, Suche, Kunden-/Auftragsdetail oder Leadership fordert eine freigegebene Analyse-Projektion an.
- **Personen:** Wie F-M02-001; Zielfläche und Personenkontext kommen vom Host.
- **Ablauf:**
  1. Das Fremdmodul sendet nur kanonische Entitätsreferenzen, Scope und gewünschten Projection-Typ.
  2. Der Host prüft Autorisierung und Disclosure.
  3. Der Core liefert eine renderer-neutrale Projektion; das Fremdmodul berechnet keine zweite Kennzahl.
  4. Der Host rendert Kennzahlwerte am Auftrag und Kunden mit Herkunft, Coverage und Aktualität; die Startseite erhält ausschließlich dringende Konflikte, Warnungen oder Entscheidungen und keine Kennzahl-Kachel.
  5. Ohne kanonische Freigabe bleiben die Auftrag-/Kunden-Slots grau und nicht klickbar; ein Analyse-Menüpunkt oder eine Analyse-Route existiert vor Anbindung nicht.
- **Ergebnis/Readback:** Eine einzige fachliche Wahrheit über identische Projection-/Content-Hashes auf allen Flächen.
- **Fehler:** Keine lokale Ersatzberechnung und kein Link auf Legacy-Routen.
- **Konflikte:** K-M02-003, K-M02-006, K-M02-008.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Kompakte Projektion mit Herkunft, Stand und Link zur freigegebenen Detailspur | FEHLT → Q-M02-002 | `MODULARITY_STRATEGY.md`, Core-Projektionsvertrag |
| lädt | Platzhaltender Ladezustand ohne Kennzahl | FEHLT → Q-M02-002 | RT-22 |
| leer | Kein Ergebnis für die referenzierte Entität | FEHLT → Q-M02-002 | RT-22 |
| Fehler | Fehlerzustand ohne Legacy-Fallback | FEHLT → Q-M02-002 | Architektur M02 |
| gesperrt | Slot ohne Daten und ohne Detailnavigation | FEHLT → Q-M02-002 | OE-2609-09 |
| In Klärung | Grauer, nicht klickbarer Slot | `In Klärung` | OE-2609-04 |
| In Aufbau | Grauer, nicht klickbarer Slot | `In Aufbau` | OE-2609-04 |

### F-M02-006 — Datenqualität und Capability-Blocker prüfen

- **Auslöser:** Eine Person öffnet den Qualitäts-/Blockerbereich oder ein Ergebnis enthält eingeschränkte Evidenz.
- **Personen:** Alle gemäß Host; technische Details können rollenbasiert reduziert werden, der fachliche Einschränkungshinweis bleibt sichtbar.
- **Ablauf:**
  1. Der Host übergibt Capability-, Snapshot-, Coverage- und Disclosure-Metadaten.
  2. Der Core validiert die drei unabhängigen Zustandsachsen.
  3. Die UI zeigt fehlende Fähigkeiten, Staleness, Teildaten, Konflikte und Unterdrückung getrennt.
  4. Sie benennt den zuständigen Lieferweg, ohne Provider oder Secret offenzulegen.
  5. Nach Behebung wird mit neuem Snapshot neu gelesen; alte Ergebnisse werden nicht still überschrieben.
- **Ergebnis/Readback:** Prüffähiger Status je Capability, Evidenz und Disclosure samt Zeit-/Scope-Bezug.
- **Fehler:** Auch Fehler in der Qualitätsauskunft werden als ERROR ausgewiesen; kein grüner Default.
- **Konflikte:** K-M02-001, K-M02-002, K-M02-004.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Drei getrennte Statusachsen, Scope, Snapshot und zuständiger Lieferweg | FEHLT → Q-M02-002 | `RUNTIME_TRUTH.md`, Capability-Manifest |
| lädt | Ladezustand ohne positive Vorbelegung | FEHLT → Q-M02-002 | RT-22 |
| leer | Keine gemeldeten Capabilities für den angefragten Scope | FEHLT → Q-M02-002 | Handshake-Beispiel |
| Fehler | Technischer Fehlerstatus mit Code | FEHLT → Q-M02-002 | `decision-support.read/v1` |
| gesperrt | Fachliche Einschränkung sichtbar, geschützte Details verborgen | FEHLT → Q-M02-002 | OE-2609-09 |
| In Klärung | Grauer, nicht aktiver Qualitätszustand | `In Klärung` | OE-2609-04 |
| In Aufbau | Grauer, nicht aktiver Qualitätszustand | `In Aufbau` | OE-2609-04 |

### F-M02-007 — Core in einen Zielhost übernehmen

- **Auslöser:** PL gibt nach Kanon-, Design- und Dossier-Gate einen konkreten Integrationsauftrag frei.
- **Personen:** Writer des künftigen Integrationsauftrags; unabhängiger Reviewer read-only.
- **Ablauf:**
  1. Zielhost, dauerhafter Modulpfad und kanonische Serialisierung werden entschieden.
  2. Der Builder übernimmt den manifestierten Core bytegenau, verifiziert SHA-256 und weist im Zielrepo einen vollständigen Post-Closure-Gesamtlauf einschließlich `artifact-integrity.test.mjs` nach; der historische Receipt vom 2026-09-17 belegt nur 66/66 im damaligen Glob-Lauf und 67/67 in der späteren Funktionssuite ohne Integritätstest (Q-M02-011).
  3. Er implementiert genau einen Domain-Fact-Adapter und ein zugelassenes Metric-Pack, zuerst empfohlen Termintreue.
  4. Er bindet Tenant/Auth/Disclosure/Retention, Leadership-Mapping und Domain-Receipts im Host an.
  5. Er setzt die freigegebenen V5-Screens und sieben Zustände um.
  6. Ein unabhängiger Reviewer prüft Portgrenzen, Traceability, Responsive-Varianten und fehlende Fallbacks.
- **Ergebnis/Readback:** Im Repo adoptierter, reproduzierbar getesteter Host mit dokumentierter Manifest-SHA; erst dann Status „implementiert“.
- **Fehler:** Hash-/Testabweichung, zweiter Datenweg, fehlende Policy oder nicht geschlossene Frage stoppt das Gate.
- **Konflikte:** K-M02-001 bis K-M02-008.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Nach Adoption die freigegebene Moduloberfläche; kein technischer Setup-Screen für Endnutzer | FEHLT → Q-M02-002 | `ADOPTION_AND_ATOMIC_CUTOVER.md` |
| lädt | Erst nach Designphase definierter Host-Zustand | FEHLT → Q-M02-002 | RT-22 |
| leer | Erst nach Designphase definierter Host-Zustand | FEHLT → Q-M02-002 | RT-22 |
| Fehler | Erst nach Designphase definierter Host-Zustand | FEHLT → Q-M02-002 | RT-22 |
| gesperrt | Erst nach Host-Policy definierter Zustand | FEHLT → Q-M02-005 | OE-2609-09 |
| In Klärung | Grauer, nicht aktiver Modulzustand bis zum Integrations-Gate | `In Klärung` | OE-2609-04 |
| In Aufbau | Grauer, nicht aktiver Modulzustand nach freigegebenem Integrationsstart | `In Aufbau` | OE-2609-04 |

### F-M02-008 — Termintreue analysieren

- **Auslöser:** Eine berechtigte Person öffnet die erste produktive Analyse-Kennzahl oder eine dringende Termintreue-Warnung.
- **Personen:** Lesend alle gemäß Host; dringende Abweichungen erscheinen nach fachlicher Zuständigkeit bei Rolf beziehungsweise Phillip.
- **Ablauf:**
  1. Der Orders-/Production-Adapter liefert eine geschlossene Population mit zugesagtem Termin, Fertig-/Abholzeitpunkt, Eligibility, Zeitraum, Snapshot, Coverage und Entitätsreferenzen.
  2. Der Core berechnet ausschließlich über das zugelassene Metric-Pack den Anteil der zum zugesagten Termin fertigen beziehungsweise abgeholten Aufträge.
  3. Die vollständige Analyse zeigt Verlauf, betroffene Aufträge und belegte Ursachen beziehungsweise nicht kausale Hypothesen getrennt.
  4. Auftrag und Kunde erhalten dieselbe unveränderte Kennzahlprojektion.
  5. Nur eine dringende Warnung, ein Konflikt oder eine Entscheidung wird auf die zuständige Startseite projiziert.
- **Ergebnis/Readback:** Termintreue-Projektion mit Population, Zeitraum, Snapshot, Coverage, Provenienz, `projectionId` und `contentHash`.
- **Fehler:** Fehlende oder widersprüchliche Zusage-/Fertig-/Abhol-/Eligibility-Daten liefern keine Quote; die Evidenz bleibt wertfrei `PARTIAL`, `UNKNOWN` oder `CONFLICTING`.
- **Konflikte:** K-M02-007, K-M02-009.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Quote, Verlauf, betroffene Aufträge, Ursachen, Zeitraum, Coverage und Herkunft | FEHLT → Q-M02-002 | OE-2609-21/22 |
| lädt | Reservierter Ladebereich ohne vorläufige Quote | FEHLT → Q-M02-002 | RT-22 |
| leer | Geschlossene Population ohne berechtigte Aufträge | FEHLT → Q-M02-002 | OE-2609-21; Core-Coverage-Vertrag |
| Fehler | Fehlercode und betroffene Faktengruppe ohne Ersatzwert | FEHLT → Q-M02-002 | `decision-support.read/v1` |
| gesperrt | Keine Auftragswerte oder Drill-downs sichtbar | FEHLT → Q-M02-002 | OE-2609-09 |
| In Klärung | Grauer, nicht klickbarer Auftrag-/Kunden-Slot; keine Route | `In Klärung` | OE-2609-04/22 |
| In Aufbau | Grauer, nicht klickbarer Slot während freigegebenem Integrationsaufbau | `In Aufbau` | OE-2609-04 |

### F-M02-009 — Liquidität 30 Tage analysieren

- **Auslöser:** Nach M01-Anbindung öffnet eine berechtigte Person die zweite Kennzahl oder eine dringende Liquiditätswarnung.
- **Personen:** Lesend alle gemäß Host; geschützte Gehaltsplanung liefert ausschließlich freigegebene Summen.
- **Ablauf:**
  1. M01 beziehungsweise die zuständigen Kreile-Einstellungen liefern manuellen Kontostand mit Standdatum, laufende Kosten mit Betrag/Rhythmus/Fälligkeit, offene Posten und freigegebene Personalkosten-Summen.
  2. Der Core prüft Snapshot, Zeitraum, Vollständigkeit, Währung, Coverage und Aktualität der Eingaben.
  3. Das zugelassene Metric-Pack berechnet die Liquidität für 30 Tage ohne direkte Bankverbindung im Core.
  4. Ein veralteter Kontostand führt zu einer sichtbaren Warnung und verhindert eine scheinbar belastbare Entscheidung.
  5. Eine spätere Bankanbindung liefert nur über M01 bestätigte Vorschläge; manuelle Einträge bleiben Kontrolle.
- **Ergebnis/Readback:** Liquiditätsprojektion mit Eingabequellen, 30-Tage-Horizont, Aktualität, Coverage, Unsicherheit, `projectionId` und `contentHash`.
- **Fehler:** Fehlende Vollpopulation, veralteter Kontostand ohne freigegebene Schwelle, unvollständige Kosten oder nicht freigegebene Personaldaten liefern keinen belastbaren Wert.
- **Konflikte:** K-M02-007, K-M02-011.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | 30-Tage-Liquidität, Eingabequellen, Standdatum, Coverage und Unsicherheit | FEHLT → Q-M02-002 | OE-2609-23/24 |
| lädt | Reservierter Ladebereich ohne Zwischenwert als Wahrheit | FEHLT → Q-M02-002 | RT-22 |
| leer | Keine vollständige, freigegebene Eingabepopulation | FEHLT → Q-M02-002 | OE-2609-24 |
| Fehler | Fehlercode und fehlende beziehungsweise widersprüchliche Eingabegruppe | FEHLT → Q-M02-002 | `decision-support.read/v1` |
| gesperrt | Geschützte Detaildaten verborgen; nur freigegebene Summen zulässig | FEHLT → Q-M02-002 | OE-2609-09/24 |
| In Klärung | Kein belastbarer Wert; Kontostand-Schwelle oder Anschluss noch offen | `In Klärung` | OE-2609-04/24; Q-M02-008 |
| In Aufbau | Grauer, nicht aktiver Zustand während freigegebenem M01-/M02-Aufbau | `In Aufbau` | OE-2609-04 |
