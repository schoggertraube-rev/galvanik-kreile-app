<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# 02 — Funktionen und Abläufe

Für alle Funktionen gilt: Rolf, Phillip und Gregor dürfen freigegebene Produktfunktionen standardmäßig sehen; Admin kann Fähigkeiten je Person sperren oder erweitern. Engere fachliche Schreibrechte aus Owner-Entscheidungen bleiben bestehen. Jeder Write ist tenantgebunden, serverseitig autorisiert, versioniert, idempotent, auditierbar und endet mit Receipt plus kanonischem Readback.

## F-G10-001 — Einstellungen öffnen und Status überblicken

**Auslöser:** Anmeldung als Gregor oder Navigation auf die berechtigte Route `/settings`.  
**Personen:** Gregor landet hier; Rolf und Phillip sehen Einstellungen nur, soweit ihre effektive persönliche Fähigkeit es erlaubt; Admin kann je Person sperren/erweitern.  
**Ablauf:**

1. Der App-Adapter löst Tenant und Produktperson serverseitig auf.
2. Fehlende, ungültige oder nicht eindeutige Identität führt nach `/start`; unberechtigte Person zu ihrem Rollen-Home.
3. G10 lädt ausschließlich öffentliche Readports der besitzenden Module.
4. Die Übersicht ordnet reale, fehlende und gesperrte Bereiche; eine offene Karte startet niemals einen Provider oder eine ungeklärte Route.
5. Konflikte und unvollständige Pflichtdaten stehen oberhalb der Bereichskarten.

**Ergebnis + Beleg:** Reale Session- und Bereichszustände sind sichtbar; kein Demo-/Fallbackwert. Der Seiten-Readback enthält Tenant, Actor, Capability-Version und Zeitstempel.  
**Fehler:** Teilportfehler werden je Karte mit Correlation-ID angezeigt; die übrige Seite bleibt nutzbar.  
**Konflikte:** Mehrdeutige Identität, fehlende Capability oder divergierende Version wird fail-closed an G01/G09 gemeldet.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Sessionstatus, Konfliktband und freigegebene Bereichskarten | `Einstellungen sind bereit.` | `SystemAdminView`; OE-2609-02/09 |
| lädt | Skeleton für Kopf und Karten | `Einstellungen werden geladen …` | RT-22 |
| leer | Reale Session, aber noch kein G10-Bereich angebunden | `Noch keine Einstellungen verfügbar.` | OE-2609-04 |
| Fehler | Fehlerband mit Wiederholen und Correlation-ID | `Einstellungen konnten nicht geladen werden. Erneut versuchen.` | D-RES-001 |
| gesperrt | Kein Inhalt, Rückweg zum Rollen-Home | `Keine Berechtigung für Einstellungen.` | G01; OE-2609-09 |
| In Klärung | Gedämpfte Karte ohne Aktion | `Dieser Bereich ist in Klärung.` | OE-2609-04 |
| In Aufbau | Gedämpfte Karte ohne Aktion | `Dieser Bereich ist in Aufbau.` | OE-2609-04 |

## F-G10-002 — Firmenstammdaten und E-Rechnungsangaben pflegen

**Auslöser:** Berechtigte Person öffnet `Firmenstammdaten`; Admin startet Bearbeiten.  
**Personen:** Alle dürfen den Vollständigkeitsstatus sehen, soweit nicht persönlich gesperrt; Schreiben nur Admin.  
**Ablauf:**

1. G10 liest genau eine tenantgebundene `company_settings`-Projektion samt Version.
2. Mehr als eine oder keine Zeile wird als Konfigurationsfehler angezeigt, nicht zusammengeführt.
3. Admin bearbeitet Firma, Anschrift, Kontakt, Steuerkennung, Bankdaten und die nach Q-G10-004 bestätigten E-Rechnungsfelder.
4. Der Server normalisiert nur Format, prüft Pflichtfelder und erwartete Version und schreibt atomar.
5. Receipt und Readback zeigen Feldstatus und neue Version; Secret-Werte existieren nicht.
6. G07 konsumiert die Projektion beim Erstellen einer Rechnung und friert den Verkäufer-Snapshot ein.

**Ergebnis + Beleg:** `COMPANY_SETTINGS_UPDATED_V1` mit geänderten Feldnamen, Actor, Version und Readback; keine sensiblen Werte im Ereignis.  
**Fehler:** Validierungsfehler stehen am Feld; Server-/DB-Fehler liefern keinen Scheinerfolg.  
**Konflikte:** Lost update, Mehrfachzeile, unvollständige Rechnungspflichtfelder oder fehlender E-Rechnungsvertrag sperren den jeweiligen Folgeschritt.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Feldgruppen, Vollständigkeitsstatus, letzte Änderung | `Firmenstammdaten gespeichert.` | F1.4 |
| lädt | Formular-Skeleton | `Firmenstammdaten werden geladen …` | RT-22 |
| leer | Leeres Pflichtfeldformular, keine Default-Firma | `Firmenstammdaten noch nicht vollständig.` | F1.4 fail-closed |
| Fehler | Feldfehler oder Fehlerband | `Firmenstammdaten konnten nicht geladen werden. Erneut versuchen.` | D-RES-001 |
| gesperrt | Nur Status, keine Bearbeitung | `Keine Berechtigung zum Ändern der Firmenstammdaten.` | G01 |
| In Klärung | E-Rechnungsblock gedämpft | `E-Rechnungsangaben — In Klärung` | Q-G10-004 |
| In Aufbau | Ganze Karte gedämpft, solange Command fehlt | `Firmenstammdaten — In Aufbau` | Ist-Code `NOT_AVAILABLE` |

## F-G10-003 — Kataloge und Preise konfigurieren

**Auslöser:** Berechtigte Person öffnet `Kataloge & Preise`; Admin wählt Mehrarbeitsposition oder Stundensatz.  
**Personen:** Alle dürfen den freigegebenen Katalog lesen; Schreiben nur Admin, persönliche Sperren/Erweiterungen gelten zusätzlich.  
**Ablauf:**

1. G10 liest den vorhandenen Mehrarbeitskatalog über `v_extra_work_catalog_v1` und den aktuellen Satz über `v_extra_work_current_rate_v1`.
2. Admin legt eine Position mit Name und Standardminuten an, ändert sie mit `expectedVersion` oder deaktiviert sie.
3. Admin setzt einen neuen Stundensatz in Cent; der alte Satz bleibt append-only erhalten.
4. Vorhandene Extra-Work-Commands liefern Receipt und kanonischen Readback.
5. Ein allgemeiner Artikel-/Preiskatalog bleibt bis Q-G10-005 geschlossen; `items`, `price_lines` und `price_agreements` werden nicht als Ersatz vermischt.

**Ergebnis + Beleg:** `EXTRA_WORK_CATALOG_CONFIGURED_V1` beziehungsweise `EXTRA_WORK_RATE_SET_V1` und aktuelle Readback-Projektion.  
**Fehler:** Leerer Name, ungültige Minuten/Beträge, doppelte Position oder Versionskonflikt mutieren nichts.  
**Konflikte:** Echte Katalogklassifikation und Besitz eines allgemeinen Katalogs sind ungelöst; G10 zeigt dafür nur den sicheren Zwischenstand.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Mehrarbeitspositionen, Aktivstatus, Minuten, Satz und Version | `Mehrarbeitskatalog gespeichert.` | F1.3 Extra Work |
| lädt | Listen-Skeleton | `Kataloge und Preise werden geladen …` | RT-22 |
| leer | Reale leere Mehrarbeitsliste | `Noch keine Mehrarbeitspositionen angelegt.` | F1.3 Extra Work |
| Fehler | Zeilenfehler oder Fehlerband | `Kataloge und Preise konnten nicht geladen werden. Erneut versuchen.` | D-RES-001 |
| gesperrt | Liste ohne Schreibaktionen | `Keine Berechtigung zum Ändern von Katalogen und Preisen.` | G01 |
| In Klärung | Allgemeiner Katalog gedämpft | `Kataloge & Preise — In Klärung` | Q-G10-005 |
| In Aufbau | Mehrarbeitseditor gedämpft, bis G10-Port angebunden | `Mehrarbeitskatalog — In Aufbau` | Ist: Command gebaut, G10-UI fehlt |

## F-G10-004 — Nummernkreise prüfen

**Auslöser:** Berechtigte Person öffnet `Nummernkreise`.  
**Personen:** Alle dürfen den Status lesen, soweit nicht persönlich gesperrt; niemand ändert oder setzt Nummern über G10 zurück.  
**Ablauf:**

1. G10 liest getrennte Projektionen für Auftrag und Rechnung.
2. Die Oberfläche zeigt `A-JJJJ-NNNN`: Vergabe bei Auftragsanlage, aktuelles Jahr und zuletzt vergebene Nummer.
3. Sie zeigt `R-JJJJ-NNNN`: atomare Vergabe bei `createInvoice`, aktuelles Jahr und zuletzt vergebene Nummer.
4. Interne Event-IDs werden nicht als Geschäftsnummer gezeigt.
5. Parallelitäts-/Allocatorstatus wird nur aus belegten Readports abgeleitet; es gibt keinen Edit- oder Reset-Button.

**Ergebnis + Beleg:** Readback beider Kreise mit Quelle und Abrufzeit; keine Mutation.  
**Fehler:** Fehlt ein Readport, bleibt nur der betroffene Kreis `In Klärung`; es wird keine Nummer errechnet.  
**Konflikte:** Doppelte, übersprungene oder konkurrierend vergebene Nummer erzeugt P0-Konflikt an Gregor; G10 repariert nicht selbst.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Zwei getrennte Read-only-Karten | `Nummernkreise geprüft.` | Register #2/#4 |
| lädt | Zwei Skeleton-Karten | `Nummernkreise werden geladen …` | RT-22 |
| leer | Kreis ohne bisherige Nummer | `Noch keine Nummer vergeben.` | Register #2/#4 |
| Fehler | Betroffener Kreis mit Fehler | `Nummernkreise konnten nicht geladen werden. Erneut versuchen.` | D-RES-001 |
| gesperrt | Keine Kreisdetails | `Keine Berechtigung für Nummernkreise.` | G01 |
| In Klärung | `A-`-Karte ohne erfundenen Stand | `Auftragsnummern — In Klärung` | Q-G10-010; RT-15 |
| In Aufbau | Gesamte Zielansicht gedämpft | `Nummernkreise — In Aufbau` | G10-UI fehlt |

## F-G10-005 — Zahlung, Skonto und Zahlungsziel verwalten

**Auslöser:** Berechtigte Person öffnet `Zahlung & Skonto`; Admin startet Parameteränderung.  
**Personen:** Alle sehen die aktive Regel; Schreiben nur Admin. Die Zielrechnungs-Freigabe je Kunde erfolgt durch Admin/Rolf im G05-Vertrag, nicht als G10-Kundenliste.  
**Ablauf:**

1. G10 liest die aktive Payment-Policy-Version.
2. Es zeigt: Abholung bar oder Karte, sonst Vorkasse; Zielrechnung nur bei belegter Kundenfreigabe.
3. Für Zielrechnung zeigt es Skonto 2 Prozent innerhalb 10 Tagen und Nettoziel 14 Tage.
4. Nach Q-G10-006 ändert Admin die Parameter versioniert; Server prüft Bereich, Version und Actor.
5. G07 übernimmt die aktive Version erst beim neuen Rechnungssnapshot; bestehende Rechnungen bleiben unverändert.

**Ergebnis + Beleg:** `PAYMENT_POLICY_UPDATED_V1`, Receipt und Readback mit Prozent in Basispunkten und Tagen.  
**Fehler:** Ungültige Werte, fehlende Kundenfreigabe oder Versionskonflikt mutieren nichts.  
**Konflikte:** Altcode erlaubt freie `rechnung` und teils Netto 30; er ist vor Freischaltung auf OE-2609-11 zu härten.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Aktive Standards, Parameter und Version | `Zahlungsregeln gespeichert.` | OE-2609-07/11 |
| lädt | Regel-Skeleton | `Zahlungsregeln werden geladen …` | RT-22 |
| leer | Keine Policy-Zeile; feste Ownerwerte nur lesend | `Noch keine bearbeitbare Zahlungsregel angelegt.` | Q-G10-006 |
| Fehler | Fehlerband ohne lokalen Fallback | `Zahlungsregeln konnten nicht geladen werden. Erneut versuchen.` | D-RES-001 |
| gesperrt | Werte lesend, keine Bearbeitung | `Keine Berechtigung zum Ändern der Zahlungsregeln.` | G01 |
| In Klärung | Editor gedämpft | `Zahlung & Skonto — In Klärung` | Q-G10-006 |
| In Aufbau | Port-/Command-Karte gedämpft | `Zahlungsparameter — In Aufbau` | kein Policy-Vertrag im Ist-Code |

## F-G10-006 — Kartenterminal anbinden

**Auslöser:** Berechtigte Person öffnet die Terminalkarte; Aktivierung erst nach M01- und Owner-Gate.  
**Personen:** Status für alle Berechtigten; Anbieter-/Gerätekonfiguration nur Admin.  
**Ablauf:**

1. Vor Gate zeigt G10 ausschließlich den geschlossenen Zustand und die manuelle Zahlungsbestätigung als realen Weg.
2. Nach Q-G10-009 bindet M01 den gewählten Anbieter hinter den tenantneutralen `PaymentAdapter`.
3. G10 zeigt nur Verbindungsstatus, Gerätbezeichnung und letzten belegten Check, nie Secrets.
4. Ein Verbindungscheck liefert echtes Provider-Receipt; Fehler erzeugen keinen bezahlten Status.
5. Zahlungsstatus wird weiterhin nur über den G07-Command kanonisch.

**Ergebnis + Beleg:** Vor Gate keine Mutation; nach Gate reales Provider-Receipt plus G07-Receipt/Readback.  
**Fehler:** Provider-/Netzfehler bleiben sichtbar und lassen den manuellen Kernweg offen.  
**Konflikte:** Nicht gewählter Anbieter, fehlende Zustimmung/Kosten/Secrets oder Stub-Antwort sperren die Aktivierung.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Erst nach Real-E2E: Gerät und Verbindungsstatus | `Kartenterminal verbunden.` | OE-2609-12; zukünftiges M01-Gate |
| lädt | Nur nach Gate beim echten Statuscheck | `Kartenterminal wird geprüft …` | Provider-Port |
| leer | Nach Gate, aber kein Gerät zugeordnet | `Noch kein Kartenterminal zugeordnet.` | Provider-Port |
| Fehler | Providerfehler, manuelle Alternative | `Kartenterminal nicht erreichbar. Zahlung manuell bestätigen.` | OE-2609-12 |
| gesperrt | Keine Gerätekonfiguration | `Keine Berechtigung für die Terminal-Anbindung.` | G01 |
| In Klärung | Anbieter-/Vertragsstatus ohne Aktion | `Terminal-Anbieter — In Klärung` | Q-G10-009 |
| In Aufbau | Standard vor M01, nicht klickbar | `Kartenterminal — In Aufbau` | OE-2609-12 |

## F-G10-007 — Rechte je Person steuern

**Auslöser:** Admin öffnet `Rechte je Person`, wählt eine Person und eine Fähigkeit.  
**Personen:** Alle sehen nur ihren eigenen effektiven Status; ausschließlich Admin sieht und ändert die Gesamtmatrix. Admin kann je Person sperren oder erweitern.  
**Ablauf:**

1. G10 liest Personen aus G01 und deren effektive Fähigkeiten samt Policy-Version.
2. Standard ist `inherit` = alle freigegebenen Produktfähigkeiten erlaubt.
3. Admin setzt für genau eine Person/Fähigkeit `deny`, `allow` oder zurück auf `inherit`.
4. Der G01-Command prüft, dass der Actor Admin ist, Tenant/Person/Fähigkeit existieren und `expectedVersion` stimmt.
5. Audit erfasst vorherige und neue Entscheidung; Receipt und Readback zeigen die effektive Folge.
6. Die nächste serverseitige Autorisierung verwendet die neue Policy; offene Clients erhalten keinen lokalen Bypass.

**Ergebnis + Beleg:** `PERSON_ACCESS_UPDATED_V1` und effektiver G01-Readback.  
**Fehler:** Unbekannte Fähigkeit, Selbstentzug des letzten sicheren Adminzugangs oder Versionskonflikt wird ohne Mutation abgewiesen.  
**Konflikte:** Alte Rollenmatrix und Feature-Flags sind keine persönliche Wahrheit und werden nicht parallel weitergeschrieben.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Personenliste, Fähigkeiten, `Standard`, `Gesperrt`, `Erweitert` | `Rechte gespeichert.` | OE-2609-09 |
| lädt | Personen-/Matrix-Skeleton | `Rechte werden geladen …` | RT-22 |
| leer | Keine Produktperson im Tenant | `Keine Personen vorhanden.` | G01 |
| Fehler | Fehlerband und unveränderte Matrix | `Rechte konnten nicht geladen werden. Erneut versuchen.` | D-RES-001 |
| gesperrt | Eigener Status, keine Matrix | `Keine Berechtigung zur Rechteverwaltung.` | OE-2609-09 |
| In Klärung | Persistenzhinweis ohne Aktion | `Rechtevertrag — In Klärung` | Q-G10-002 |
| In Aufbau | Gesamtkarte gedämpft | `Rechte je Person — In Aufbau` | OP-18; Ist-Code fehlt |

## F-G10-008 — Aufbewahrung verwalten und Vorschläge freigeben

**Auslöser:** Berechtigte Person öffnet `Aufbewahrung`; Admin prüft Policy oder fälligen Vorschlag.  
**Personen:** Policy- und Vorschlagsstatus für Berechtigte; Änderungen und Freigaben nur Admin.  
**Ablauf:**

1. G10 liest die aktive Policy je Dokumentart samt Quelle, Version, Fristbeginn und möglicher Ablaufhemmung.
2. Vorbelegt sind 8 Jahre für Rechnungen/Buchungsbelege, 6 Jahre für Geschäftsbriefe einschließlich Angebots-/Auftragsmails und 3 Jahre nach Jahresende für sonstige Mails/Telefonnotizen.
3. Ein Prüflauf erzeugt nur Vorschläge; aktive steuerliche Prüfbarkeit verschiebt die Fälligkeit.
4. Admin prüft Umfang, Personenbezug, verbleibende Geschäftszahlen und Zielcommand des besitzenden Fachmoduls.
5. Erst Admin-Freigabe ruft den Fachcommand auf; Audit, Receipt und Readback belegen die Wirkung.
6. Microsoft-Postfachdaten sind ausgeschlossen; anonymisierte/aggregierte Analysedaten bleiben unbefristet.

**Ergebnis + Beleg:** `RETENTION_POLICY_UPDATED_V1` oder `RETENTION_ACTION_APPROVED_V1`; kein stiller Zeitjob-Write.  
**Fehler:** Unklare Dokumentart, aktive Ablaufhemmung, fehlender Fachcommand oder unvollständiger Vorschlag verhindert die Freigabe.  
**Konflikte:** OP-13 muss Werte vor Live bestätigen; Q-G10-007 klärt den persistenten Vertrag.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Policyzeilen, Fristen, Hemmung und Vorschläge | `Aufbewahrungseinstellungen gespeichert.` | OE-2609-20 |
| lädt | Policy-/Vorschlags-Skeleton | `Aufbewahrung wird geladen …` | RT-22 |
| leer | Keine fälligen Vorschläge | `Keine Lösch- oder Anonymisierungsvorschläge vorhanden.` | OE-2609-20 |
| Fehler | Fehlerband, keine Aktion | `Aufbewahrung konnte nicht geladen werden. Erneut versuchen.` | D-RES-001 |
| gesperrt | Lesestatus ohne Freigabe | `Keine Berechtigung zur Freigabe von Aufbewahrungsaktionen.` | OE-2609-20 |
| In Klärung | Policykarte gedämpft | `Aufbewahrung — In Klärung` | Q-G10-007; OP-13 |
| In Aufbau | Vorschlagsmechanik gedämpft | `Lösch- und Anonymisierungsvorschläge — In Aufbau` | kein Ist-Vertrag |

## F-G10-009 — Laufende Kosten und Kontostand manuell pflegen

**Auslöser:** Admin öffnet `Liquidität`, erfasst eine laufende Kostenposition oder einen Kontostand mit Stichtag.  
**Personen:** Ausschließlich Admin darf diese Daten sehen oder ändern; spätere M03-Sichten erhalten nur freigegebene Summen.  
**Ablauf:**

1. G10 lädt laufende Kosten und den jüngsten manuellen Kontostand über den nach Q-G10-008 beschlossenen Vertrag.
2. Admin erfasst Kostenbezeichnung, Betrag in Cent, bestätigten Rhythmus und Fälligkeit.
3. Admin erfasst Kontostand in Cent und Stichtag; der Server ergänzt Actor und Erfassungszeit.
4. Die Oberfläche berechnet das Alter aus Stichtag und aktueller Zeit; die Warnung wartet auf die bestätigte Schwelle.
5. Personalkosten kommen nur als freigegebene Summe aus der geschützten Gehaltsplanung.
6. Eine spätere Bankanbindung liefert ausschließlich Vorschläge; manuelle Zeilen bleiben sichtbar und werden nie automatisch überschrieben.

**Ergebnis + Beleg:** Nach Gate `RUNNING_COST_CONFIGURED_V1` beziehungsweise `ACCOUNT_BALANCE_RECORDED_V1` mit Receipt/Readback.  
**Fehler:** Ungültiger Betrag/Stichtag/Rhythmus oder Versionskonflikt mutiert nichts; Bankfehler berührt manuelle Daten nicht.  
**Konflikte:** Rhythmus, Fälligkeit, Warnschwelle und neuer Datenbesitz sind vor Bau offen; Alt-`schema_buchhaltung.ts` wird nicht übernommen.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Kostenliste, Summen, Kontostand, Stichtag und Alter | `Liquiditätsdaten gespeichert.` | OE-2609-24 |
| lädt | Kosten-/Kontostand-Skeleton | `Liquiditätsdaten werden geladen …` | RT-22 |
| leer | Leere Kostenliste und kein Kontostand | `Noch keine laufenden Kosten oder Kontostände erfasst.` | OE-2609-24 |
| Fehler | Fehlerband, Eingaben bleiben lokal unbestätigt | `Liquiditätsdaten konnten nicht geladen werden. Erneut versuchen.` | D-RES-001 |
| gesperrt | Keine Werte oder Summen | `Keine Berechtigung für Liquiditätsdaten.` | OE-2609-24 |
| In Klärung | Beide Karten ohne Eingabe | `Laufende Kosten — In Klärung` / `Kontostand — In Klärung` | Q-G10-008 |
| In Aufbau | Künftige Bankkarte ohne Aktion | `Bankanbindung — In Aufbau` | OE-2609-24 |

