<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# M07 KI-Suche — Funktionen und Abläufe

## Grundsatz

Jede Funktion wird serverseitig mit dem aktuellen G01-Authkontext ausgeführt. Standardmäßig dürfen alle Personen die Funktion nutzen; ein Admin kann die Fähigkeit je Person sperren oder erweitern. Mandant und Benutzer werden nie aus Clientwerten übernommen.

### F-M07-001 — Frage deterministisch einordnen

**Auslöser:** Eine berechtigte Person sendet im bestehenden Such-Overlay eine Frage ab, nachdem M07 adoptiert und der Modulschalter aktiviert wurde.

**Personen:** Alle; personenbezogene Einschränkung durch Admin/Developer über G01/G10.

**Schritte:**

1. Server löst Tenant, Person, Modulschalter und Capability fail-closed auf.
2. Frage wird auf Länge und erlaubten Inhalt geprüft und erhält eine Korrelations-ID.
3. M07 ruft ausschließlich den öffentlichen G08-Port `searchTenant` auf.
4. Exakte/strukturierte Treffer und Coverage werden ausgewertet.
5. Ist die Frage durch deterministische Treffer beantwortet, werden G08-Ergebnisse ohne Modell und ohne Kosten zurückgegeben.
6. Nur eine echte Kombinations-, Erklärungs- oder Klärungsfrage wird an F-M07-002 übergeben.

**Ergebnis + Receipt/Readback:** `KiSearchOutcome` mit Modus `DETERMINISTIC`, aktuellem G08-Readback, Coverage und Korrelations-ID; kein fachlicher Schreib-Receipt.

**Fehlerfälle:** ungültige Eingabe; Auth-/Tenant-Denial; Modul AUS; G08-Denial/Conflict/Error; veraltete Antwort; begrenzte Coverage.

**Sperren/Konflikte:** S-M07-001, S-M07-002, S-M07-003; K-M07-001, K-M07-002.

### F-M07-002 — Belegte KI-Antwort erzeugen

**Auslöser:** F-M07-001 hat eine echte Sprach-/Kombinationsaufgabe festgestellt und alle Aktivierungsgates sind offen.

**Personen:** Alle; personenbezogene Einschränkung durch Admin/Developer über G01/G10.

**Schritte:**

1. M07 löst nur die in den autorisierten Suchtreffern referenzierten Fachfakten über öffentliche Host-Ports auf.
2. Unbestätigte OCR-/Modellkandidaten und nicht berechtigte Quellen werden entfernt.
3. Budget-, Rate-, Timeout- und Circuit-Breaker-Port reservieren und claimen den Lauf.
4. Der Provideradapter erhält einen minimierten, versionierten Faktenumschlag und ein strikt validiertes Ausgabeschema.
5. Die Antwort wird gegen Schema, Citation-Bindung, Berechtigung und Datenstand validiert.
6. Fakten, Schlussfolgerungen, Unsicherheiten, fehlende Daten und Abdeckung werden getrennt aufgebaut.
7. Usage wird mit tatsächlichem Status abgerechnet; Antwort und Audit bekommen dieselbe Korrelations-ID.

**Ergebnis + Receipt/Readback:** `KiSearchResponse` mit `claims`, `citations`, `uncertainties`, `coverage`, `providerRun`, `costUsage` und Korrelations-ID; der Readback stammt erneut aus autorisierten Fachports, nicht aus Modelltext.

**Fehlerfälle:** Budget blockiert; Provider nicht konfiguriert; Timeout; Circuit offen; Schemafehler; Citation fehlt; Kontext veraltet; Providerstatus unklar; partielle Host-Port-Abdeckung.

**Sperren/Konflikte:** S-M07-001 bis S-M07-009; K-M07-001 bis K-M07-005.

### F-M07-003 — Quelle und Datenstand öffnen

**Auslöser:** Eine Person öffnet eine Quellenreferenz aus einer validierten Antwort.

**Personen:** Alle; der Ziel-Port prüft die aktuelle Berechtigung erneut.

**Schritte:**

1. Client sendet nur die Citation-ID und Korrelations-ID.
2. Server lädt die serverseitig gebundene Referenz und prüft Tenant, Person und Objektzugriff erneut.
3. Der NavigationResolver erzeugt ausschließlich ein bekanntes internes Ziel des Besitzer-Moduls.
4. Das Originalobjekt wird im bestehenden Host-Kontext geöffnet; der Rückweg führt ins Such-Overlay.

**Ergebnis + Receipt/Readback:** aktuelle Originalkarte oder Detailansicht mit Readback; eine inzwischen entzogene Berechtigung führt zu Denial statt Cache-Anzeige.

**Fehlerfälle:** ungültige Citation; gelöschte/veraltete Quelle; Rechteentzug; unbekannte Zielroute.

**Sperren/Konflikte:** S-M07-002, S-M07-004; K-M07-001, K-M07-002.

### F-M07-004 — Sichere Aktion bestätigen

**Auslöser:** Eine Antwort enthält einen validierten Vorschlag aus dem erlaubten Command-Katalog und die Person wählt ihn aus.

**Personen:** Alle mit der konkreten Command-Berechtigung; Admin kann je Person sperren oder erweitern.

**Schritte:**

1. M07 zeigt nur `actionKey`, Quellfakten, Wirkung und bekannte Vorbedingungen in einer Vorschau.
2. Der Besitzer-Port prüft Auth, Tenant, Rolle, aktuelle Vorbedingungen und Idempotenz serverseitig.
3. Ohne ausdrückliche Bestätigung erfolgt keine Mutation.
4. Nach Bestätigung führt ausschließlich das Besitzer-Modul seinen sicheren Command aus.
5. M07 zeigt dessen unveränderten Receipt und Readback; das Besitzer-Modul bleibt Daten- und Eventeigner.

**Ergebnis + Receipt/Readback:** Command-Receipt des Besitzer-Moduls plus dessen Readback; M07 selbst besitzt keinen Schreib-Receipt.

**Fehlerfälle:** fehlende Berechtigung; Vorbedingung veraltet; unbekannte `actionKey`; doppelte Bestätigung; Besitzer-Port nicht verfügbar; Readback widerspricht Vorschlag.

**Sperren/Konflikte:** S-M07-002, S-M07-005, S-M07-008; K-M07-003, K-M07-004.

### F-M07-005 — Modul sicher deaktivieren

**Auslöser:** Modulschalter AUS, Provider-Gate geschlossen, Budget/Circuit blockiert oder M07-Ausfall.

**Personen:** Umschalten nur Admin/Developer; Status sehen alle betroffenen Personen.

**Schritte:**

1. Server verweigert M07-Evidenz- und Providerzugriffe.
2. G08 bleibt unverändert nutzbar.
3. Vor Adoption bleibt das Element gedämpft und nicht klickbar; nach Adoption zeigt die M07-Fläche den ehrlichen Sperr-/Fehlerzustand.
4. Ein technischer Fehler erzeugt eine Korrelations-ID und eine sichere nächste Aktion; kein stiller Providerwechsel erfolgt.

**Ergebnis + Receipt/Readback:** Modulschalter-Readback aus G10 beziehungsweise Fehlerstatus; null M07-Daten-/Providerzugriffe im AUS-Zustand.

**Fehlerfälle:** inkonsistenter Schalterstand; Client versucht Bypass; Provider antwortet nach Timeout verspätet.

**Sperren/Konflikte:** S-M07-001, S-M07-006, S-M07-007; K-M07-005.

## Pflichtzustände der M07-Oberfläche

Vor Designphase 1b existiert keine M07-Fläche. Die nachstehenden fehlenden Texte sind bewusst keine Bau-Ratestellen: Der Kern wird zustandsfähig gebaut, die sichtbare Textfreigabe ist ein Adoption-Gate.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Validierte Antwort, getrennte Fakten/Schlussfolgerungen/Unsicherheiten, Quellen, Datenstand, Coverage und erlaubte nächste Aktionen. | FEHLT → Q-M07-001 | D-AI-001; Designphase 1b offen |
| lädt | Bestehende G08-Treffer bleiben sichtbar; M07 zeigt eine nicht blockierende Arbeitsanzeige ohne Erfolgsbehauptung. | FEHLT → Q-M07-001 | D-RES-001; Designphase 1b offen |
| leer | Keine belegbare KI-Antwort; vorhandene G08-Leeranzeige bleibt Wahrheit. | „Für „{query}“ liegt in den internen Auftrags- und Kundendaten keine belegte Übereinstimmung vor.“ | `src/modules/suche/ui/SearchDialog.tsx` |
| Fehler | G08 bleibt bedienbar; M07 nennt Auswirkung, sichere nächste Aktion und Korrelations-ID. | FEHLT → Q-M07-001 | D-RES-001; Designphase 1b offen |
| gesperrt | Keine Evidenz-/Providerabfrage; vorhandene G08-Berechtigungsanzeige bleibt sichtbar. | „Kein Zugriff.“ | `src/modules/suche/ui/SearchDialog.tsx` |
| In Klärung | Vor Adoption ausschließlich gedämpftes, nicht klickbares Element ohne Route und Daten. | „KI-Suche“ / „In Klärung“ | Anleitung §6; OE-2609-04/05 |
| In Aufbau | Während freigegebener Modulbauphase ausschließlich gedämpftes, nicht klickbares Element ohne Route und Daten. | „KI-Suche“ / „In Aufbau“ | Anleitung §6; OE-2609-04/05 |
