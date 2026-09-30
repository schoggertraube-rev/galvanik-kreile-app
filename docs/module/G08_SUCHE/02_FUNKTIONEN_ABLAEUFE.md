<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G08_SUCHE — Funktionen und Abläufe

## Zustandsmodell

Der Ist-Dialog kennt intern `idle`, `loading`, `empty`, `data`, `denial`, `error`, `conflict`. Für die Dossier-Abnahme werden diese auf die sieben Pflichtzustände abgebildet; der bestehende Datenkonflikt bleibt als zusätzlicher fail-closed Zustand erhalten. „In Klärung“ und „In Aufbau“ sind keine Ersatz-Erfolge.

### F-G08-001 — Globale Suche öffnen, bedienen und schließen

**Auslöser:** Klick/Touch auf den Suchtrigger oder `Ctrl+K`/`Cmd+K`.  
**Wer darf:** jede authentisierte Kreile-Person mit der serverseitig ermittelten Lese-Capability; individuelle Admin-Sperren gelten.  
**Schritte:** (1) HostAdapter prüft, ob der Zielscreen vollständig montiert ist; (2) Dialog wird als Modal geöffnet; (3) Eingabefeld erhält Fokus; (4) Nutzer tippt, navigiert mit Pfeiltasten und wählt mit Enter/Touch; (5) Escape, Hintergrund oder Schließen beendet den Dialog; (6) Fokus und Ausgangskontext werden wiederhergestellt.  
**Ergebnis + Beleg:** sichtbarer, fokussierter Dialog ohne Datenzugriff unter zwei Zeichen; Komponenten- und Browserbeleg mit Ausgangselement.  
**Readback:** Dialog `open=false`, Fokus am Trigger, Route/Filter/Scroll unverändert.  
**Fehler:** fehlende Session oder Capability wird sichtbar gesperrt; UI darf nicht nur schließen.  
**Konflikte:** globale Escape-Behandlung darf nicht Dialog und darunterliegende Karte zugleich poppen; der oberste Stack-Eintrag gewinnt (`K-G08-001`, `K-G08-005`).

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Dialog mit Eingabe und belegten Trefferzeilen | `Interne Quellen · Abfrage {DD.MM.YYYY, HH:mm}` | `SearchDialog.tsx` |
| lädt | Statuszeile während der aktuellen Anfrage | `Interne Bestände werden durchsucht …` | `SearchDialog.tsx` |
| leer | Eingabefeld plus belegter Nullzustand | `Für „{Suchbegriff}“ liegt in den internen Auftrags- und Kundendaten keine belegte Übereinstimmung vor.` | `SearchDialog.tsx` |
| Fehler | fail-closed Hinweis ohne interne Details | `FEHLT → Q-G08-003`; Empfehlung: `Suche nicht möglich. {sichere Meldung} · Vorgang: {Correlation-ID}` | Ist-Template plus D-RES-001; Gesamtwortlaut zu bestätigen |
| gesperrt | Dialog bleibt sichtbar und erklärt die Sperre | `Kein Zugriff. Diese Suche ist für die aktuelle Sitzung nicht freigegeben.` | Ist-Code; Capability-Ziel OE-2609-09 |
| In Klärung | deaktivierter Dokumentquellen-Eintrag | `Dokumente — In Klärung` | OP-10; Owner-Graustandard |
| In Aufbau | deaktivierter Kopfzeilenplatz vor T-04-Abnahme | `Suche — In Aufbau` | Anleitung 1.1; T-04 |

Zusätzlicher Ist-Zustand: `Datenkonflikt. {sichere Meldung} · Vorgang: {Correlation-ID}`; kein Teilresultat und kein automatischer Retry.

### F-G08-002 — Tenantgebundene strukturierte Suche ausführen

**Auslöser:** mindestens zwei normalisierte Zeichen nach 220 ms Debounce.  
**Wer darf:** serverseitig authentisierte und nicht individuell gesperrte Kreile-Person.  
**Schritte:** (1) Request validieren und normalisieren; (2) Identity/Tenant/Capability bestimmen; (3) registrierte Kreile-Read-Ports parallel oder deterministisch aufrufen; (4) jedes Dokument strikt validieren; (5) Treffer je Quelle deduplizieren und sortieren; (6) auf 10 je Quelle/20 gesamt kappen; (7) Abdeckung, Quellen und Zeitstempel zurückgeben; (8) ältere Responses verwerfen.  
**Ergebnis + Beleg:** read-only `OK` mit Query, Treffern, `checkedSources`, `checkedAt` und Coverage; Fresh-DB-Test belegt reale Auftrags-/Kundenfelder.  
**Readback:** dieselbe Anfrage gegen unveränderte Ports liefert dieselbe Reihenfolge und Provenienz.  
**Fehler:** Validierungsfehler vor Portzugriff; bei Port-/Schema-/Clock-Fehler Gesamtergebnis `UNAVAILABLE`, keine Teiltreffer.  
**Konflikte:** widersprüchliche oder tenantinkonsistente Portdaten werden insgesamt verworfen und an Rolf zur Datenklärung beziehungsweise an Gregor bei technischem Zugriffskonflikt geführt (`K-G08-002`, `K-G08-006`).

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Treffer, Treffergrund, Zusammenhang, Aktion und Datenstand | `Treffer über {Trefferfeld}: {Trefferwert}` und `Zusammenhang: {Kontext}` | `SearchDialog.tsx` |
| lädt | keine alten Treffer als neue Wahrheit | `Interne Bestände werden durchsucht …` | `SearchDialog.tsx` |
| leer | geprüfte Quellen und sichere Alternativen | `Interne Quellen: Auftragsbestand und Kundenstamm{, Stand …}.` und `Sicher weitersuchen mit Kundenname, Auftragsnummer, Teil oder Material, Oberfläche oder Datum.` | `SearchDialog.tsx` |
| Fehler | keine Teiltreffer | `FEHLT → Q-G08-003`; Empfehlung: `Suche nicht möglich. Die internen Bestände konnten nicht sicher durchsucht werden. · Vorgang: {Correlation-ID}` | Ist-Text plus D-RES-001; Gesamtwortlaut zu bestätigen |
| gesperrt | keine Portaufrufe, keine Ergebnisreste | `Kein Zugriff. Diese Suche ist für die aktuelle Sitzung nicht freigegeben.` | `search.actions.ts`; `SearchDialog.tsx` |
| In Klärung | ungeklärte Quelle ist nicht Teil von `checkedSources` | `Dokumente — In Klärung` | OP-10; Q-G08-001 |
| In Aufbau | noch nicht angeschlossene Suchquelle ist nicht ausführbar | `{Quellenname} — In Aufbau` | Owner-Graustandard; nur innerhalb freigegebener Grundstamm-Arbeit |

Zusätzlicher Zustand: `Datenkonflikt. {sichere Meldung} · Vorgang: {Correlation-ID}`; die sichere Folgeaktion lautet `Datenstand prüfen`, nicht `erneut versuchen`.

### F-G08-003 — Treffer öffnen und im einen Backstack zurückkehren

**Auslöser:** Enter, Klick oder Touch auf einen belegten Treffer.  
**Wer darf:** dieselbe Person, die den Treffer lesen durfte; Zielkarte prüft Rechte erneut serverseitig.  
**Schritte:** (1) HostAdapter löst ausschließlich den registrierten Resultattyp auf; (2) Ausgangsroute, Querystring, Filter, Scrollposition und fokussiertes Element werden als App-Kontext gesichert; (3) Order öffnet V8, Customer öffnet V2; (4) weitere Karten werden auf denselben Stack gelegt; (5) Zurück/Escape/Schließen poppt exakt eine Ebene; (6) vollständiges Schließen stellt den Ausgangskontext wieder her.  
**Ergebnis + Beleg:** keine zweite Detailwahrheit; automatisierte Sequenzen Home→Auftrag→Kunde→Auftrag, Kunde→Auftrag und Intake→Auftrag.  
**Readback:** oberste Karte und darunterliegende IDs stimmen nach jedem Pop; am Ende sind Filter und Scrollposition identisch.  
**Fehler:** unbekannter Resultattyp öffnet nichts und zeigt einen sicheren Fehler mit Correlation-ID.  
**Konflikte:** ein globaler Escape-Listener darf nur die oberste UI-Schicht schließen; doppelte Listener sind zu beseitigen (`K-G08-003`, `K-G08-004`, `K-G08-005`).

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Originalkarte mit Zurück-/Schließen-Aktion | Auf Treffer: `Auftragskarte öffnen` oder `Kundenkarte öffnen`; Karte nutzt ihren kanonischen Titel | Ist-Code; D-UI-CORE-002 |
| lädt | Karten-Skeleton im Designsystem, Ausgangskontext bleibt gespeichert | `FEHLT → Q-G08-003`; Empfehlung: `Auftrag wird geladen …` oder `Kunde wird geladen …` | Designphase 1 |
| leer | Karte wurde zwischen Suche und Öffnen nicht mehr lesbar gefunden | `FEHLT → Q-G08-003`; Empfehlung: `Dieser Datensatz ist nicht mehr verfügbar. Zurück zur Suche.` | Designphase 1 |
| Fehler | Karte bleibt geschlossen, Suche bleibt erhalten | `FEHLT → Q-G08-003`; Empfehlung: `Karte konnte nicht sicher geöffnet werden. · Vorgang: {Correlation-ID}` | D-RES-001; Designphase 1 |
| gesperrt | keine Karte, Suchdialog bleibt mit Erklärung | `FEHLT → Q-G08-003`; Empfehlung: `Kein Zugriff auf diese Karte.` | G01 Capability-Ziel; Designphase 1 |
| In Klärung | unbekannter/neuer Resultattyp ist deaktiviert | `{Quellenname} — In Klärung` | erweiterbare Source-Registry; kein stiller Fallback |
| In Aufbau | Zielkartenanschluss im aktiven Grundstamm-Bau ist deaktiviert | `{Kartentyp} — In Aufbau` | Owner-Graustandard |

Zusätzlicher Zustand: `Datenkonflikt. Karte nicht geöffnet. · Vorgang: {Correlation-ID}`; der Stack bleibt unverändert.

### F-G08-004 — Neue Kreile-Suchquelle registrieren

**Auslöser:** ein besitzendes Kreile-Modul stellt einen freigegebenen öffentlichen, tenantgebundenen Read-Port und einen Resultat-Navigator bereit.  
**Wer darf:** Builder innerhalb eines freigegebenen Tickets; eine neue Tabelle, Datenwahrheit, Capability oder ein Provider erfordert zuvor eine eigene Entscheidung.  
**Schritte:** (1) Source-ID, Label, Priorität, Query-Port, Dokumentvalidator, Matcher/Ranker und typisierte Öffnen-Aktion registrieren; (2) Manifest-Abhängigkeit ergänzen; (3) Tenant-/Fremdtenant-/Fehler-/Kappungstests ergänzen; (4) Dialogzustände und drei Viewports belegen; (5) erst danach Quelle aktiv zeigen.  
**Ergebnis + Beleg:** Kern bleibt app-neutral und kennt keine Kreile-Entität als geschlossenen Union-Zweig; HostAdapter enthält die Kreile-Registrierung.  
**Readback:** `checkedSources` enthält nur tatsächlich vollständig geprüfte Quellen.  
**Fehler:** fehlt ein Vertragsteil, wird die Quelle nicht registriert.  
**Konflikte:** Quellenausfall liefert in V1 fail-closed Gesamtergebnis; eine spätere Teilabdeckungsstrategie wäre eine neue Produktentscheidung (`K-G08-004`, `K-G08-006`).

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | neue Quelle erscheint nur bei real geprüftem Port | `{Quellenlabel}` in der Quellenzeile und am Treffer | Source-Registry-SPEZ |
| lädt | Quelle zählt erst nach abgeschlossener Antwort als geprüft | `Interne Bestände werden durchsucht …` | bestehender Dialogvertrag |
| leer | Quellenzeile nennt auch die neue, tatsächlich geprüfte Quelle | `Interne Quellen: {vollständige Liste}.` | D-AI-001; Ist-Muster |
| Fehler | kein Teilresultat bei Pflichtquellenfehler | `FEHLT → Q-G08-003`; Empfehlung: `Suche nicht möglich. Die internen Bestände konnten nicht sicher durchsucht werden. · Vorgang: {Correlation-ID}` | fail-closed Vertrag; Designphase 1 |
| gesperrt | Quelle wird nicht abgefragt und nicht als geprüft genannt | `FEHLT → Q-G08-003`; Empfehlung: `Kein Zugriff. {Quellenlabel} ist für diese Sitzung nicht freigegeben.` | G01/HostAdapter; Designphase 1 |
| In Klärung | Vertrag oder Owner-Port fehlt | `{Quellenlabel} — In Klärung` | Owner-Graustandard |
| In Aufbau | Port ist im aktiven Grundstamm-Ticket noch nicht abgenommen | `{Quellenlabel} — In Aufbau` | Owner-Graustandard |

## Feste V1-Rankingregel

1. Query: Unicode-kleingeschrieben, getrimmt, mindestens 2 und höchstens 80 Zeichen.
2. Quellenpriorität Kreile V1: `Auftragsbestand` vor `Kundenstamm`.
3. Auftrags-Feldpriorität: Auftragsnummer, Teil, Material, Oberfläche, Titel, Kundenname, Aufgabe, Termin.
4. Kunden-Feldpriorität: Name, Firma, Kundennummer, Ort, belegte Datensatzphrase.
5. Pro Entität zählt die erste belegte Feldübereinstimmung; Dubletten werden nach Source-ID und Entity-ID entfernt.
6. Innerhalb einer Quelle: Titelvergleich `de-DE`, `sensitivity=base`, dann stabile ID.
7. Maximal 10 je V1-Quelle, maximal 20 insgesamt; jede Kappung wird sichtbar.

Bei der Registry-Umstellung bleiben diese Regeln als Kreile-V1-Konfiguration erhalten. Eine Relevanzscore-, Popularitäts-, KI- oder semantische Sortierung gehört nicht in T-04.
