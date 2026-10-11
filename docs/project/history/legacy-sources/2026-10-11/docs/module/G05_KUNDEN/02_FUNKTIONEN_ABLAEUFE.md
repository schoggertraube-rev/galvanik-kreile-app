<!-- STATUS: REFERENCE_ONLY_NON_EXECUTABLE | CANONICAL_ENTRY: docs/project/DOCUMENT_AUTHORITY.md -->
# G05 Kunden — Funktionen und Zustände

## F-G05-001 — Kunden finden und Kundenkarte öffnen

- **Auslöser:** Person öffnet `/customers`, gibt einen Suchtext ein, setzt einen Filter oder wählt einen Treffer.
- **Personen:** Rolf, Phillip und Michael; alle dürfen den Vorgang grundsätzlich ausführen, der Admin kann den Zugriff je Person sperren oder erweitern.
- **Schritte:** Tenant und Berechtigung aus der Session bestimmen; reale Kundenliste lesen; Suche über Name/Kundennummer/Ort anwenden; Treffer wählen; `/customers/[id]` mit Backstack öffnen.
- **Ergebnis + Receipt/Readback:** Reiner Leseweg, daher kein Schreib-Receipt; der angezeigte Datensatz trägt reale Kunden-ID und belegte Aktualität. Es darf kein Demo-Datensatz eingesetzt werden.
- **Fehler:** Zugriff verweigert, Integritäts-/Tenantkonflikt, nicht vorhandener Kunde, Lesefehler oder leeres Ergebnis werden getrennt angezeigt.
- **Blocker:** Responsive Feindesign und `kr-`-Komponenten folgen Designphase 1; siehe Q-G05-004 und Q-G05-005.

## F-G05-002 — Kundenkarte lesen

- **Auslöser:** Person öffnet `/customers/[id]` aus Liste, Auftrag oder Suche.
- **Personen:** Rolf, Phillip und Michael; der Admin kann die Kundenleseberechtigung je Person sperren oder erweitern.
- **Schritte:** Kunden-ID und Tenant validieren; Stammdaten lesen; nächste/aktive Aufträge und Historie ausschließlich über öffentliche Orders-Reads ergänzen; nicht belegte Abschnitte leer beziehungsweise „In Klärung“ lassen.
- **Ergebnis + Receipt/Readback:** Lese-Readback der Kunden-ID; Kontakt, Anschrift, Hinweise und reale Auftragszusammenfassung stimmen mit den Quellsystemen überein.
- **Fehler:** Nicht gefunden ist von gesperrt, Konflikt und technischem Fehler unterscheidbar; private Modulpfade dürfen nicht als Fallback gelesen werden.
- **Blocker:** Fotos/Dokumente, strukturierte Vereinbarungen und Telefonnotizen bleiben bis Q-G05-003/Q-G05-007/Q-G05-008 nicht klickbar.

## F-G05-003 — Kunden sicher anlegen

- **Auslöser:** Person startet im globalen Anlageweg „Kunde“, erfasst die Felder und bestätigt „Neukunde speichern“.
- **Personen:** Rolf, Phillip und Michael mit `customers.create`; der Admin kann die Berechtigung sperren oder erweitern.
- **Schritte:** Eingabe normalisieren; Tenant/Person/Berechtigung serverseitig prüfen; Dublettenvorprüfung aufrufen, sobald Q-G05-001 freigegeben ist; atomaren Create-Command mit Idempotency-ID ausführen; Receipt lesen; Kunden-Readback laden.
- **Ergebnis + Receipt/Readback:** Tenant-eindeutige Kundennummer, Kunde, `CUSTOMER_CREATED_V1`, unveränderliches Receipt und bestätigter Kunden-Readback. Erst danach darf „Kunde gesichert“ erscheinen.
- **Fehler:** Validierungsfehler bleibt editierbar; Denied zeigt keine Daten; unbekannter Ausgang wird mit derselben Idempotency-ID wiederaufgenommen; Receipt-/Readback-Widerspruch wird als Konflikt eskaliert.
- **Blocker:** Straße/PLZ müssen in Input und Command ergänzt werden; Dublettenkriterien sind Q-G05-001. Bis dahin darf keine automatische Dublettenaussage behauptet werden.

## F-G05-004 — Kundenstammdaten ändern

- **Auslöser:** Person wählt auf der Kundenkarte eine künftig freigegebene Bearbeiten-Aktion.
- **Personen:** Grundsätzlich alle; Admin kann `customers.update` je Person sperren oder erweitern.
- **Schritte:** Aktuelle Version lesen; Änderungen und erwartete Version senden; serverseitig Tenant, Berechtigung und Konflikt prüfen; Ereignis und Receipt atomar schreiben; Readback der neuen Version laden.
- **Ergebnis + Receipt/Readback:** Nur bestätigte Felder und neue Version erscheinen; Auditbezug und vorherige Version bleiben nachvollziehbar.
- **Fehler:** Veraltete Version führt nicht zum Überschreiben, sondern zum Konflikt; unbekannter Ausgang zeigt keinen Erfolg.
- **Blocker:** Dauerhafter Update-Command/Versionsvertrag ist eine neue Schreibwegentscheidung; Q-G05-002. **Bis dahin:** Aktion nicht klickbar, „In Klärung“.

## F-G05-005 — Potenzielle Dublette behandeln

- **Auslöser:** Person erfasst einen neuen Kunden oder ändert identitätsnahe Felder.
- **Personen:** Erfassende Person entscheidet fachlich; Rolf löst unklare Fälle, Phillip technische Fehlzuordnungen.
- **Schritte:** Serverseitig freigegebene normalisierte Vergleichsfelder prüfen; Kandidaten mit Herkunft und Abweichungen zeigen; bestehenden Kunden öffnen oder bewusst beim Anlageweg bleiben; nie automatisch zusammenführen.
- **Ergebnis + Receipt/Readback:** Entscheidung wird zusammen mit dem späteren Schreib-Receipt nachvollziehbar; ein bestehender Kunde kann ohne Neueingabe gewählt werden.
- **Fehler:** Ist die Prüfung nicht verfügbar, darf „keine Dublette“ nicht behauptet werden; Anlage und Warnstrategie richten sich nach Q-G05-001.
- **Blocker:** Felder, Schwellenwert und Override-Nachweis sind nicht entschieden; Q-G05-001. **Bis dahin:** „Dublettenschutz — In Klärung“, keine Fake-Warnung.

## F-G05-006 — Telefonnotiz erfassen und zuordnen

- **Auslöser:** Person startet eine Telefonnotiz im Intake oder aus der Kundenkarte.
- **Personen:** Rolf, Phillip und Michael; Admin kann den Zugriff je Person sperren oder erweitern.
- **Schritte:** Kunden wählen oder eindeutig neu anlegen; optional Auftrag verknüpfen; unveränderten Freitext als Quell-Snapshot halten; abgeleitete Fakten einzeln bestätigen/korrigieren; sicheren Command ausführen; Receipt und Readback prüfen.
- **Ergebnis + Receipt/Readback:** Nachweisbare Telefonnotiz mit Tenant, Quelle, Kunde, optionalem Auftragslink, Ersteller, Zeit, bestätigten Fakten und Aufbewahrungsklasse; kein ungeprüfter KI-Fakt wird Stammdatum.
- **Fehler:** Mehrdeutiger Kunde/Auftrag, widersprüchliche Fakten, Denied, Provider-/Analyseausfall und unbekannter Schreibausgang sind getrennt; die Rohnotiz darf bei Analyseausfall nicht verloren gehen.
- **Blocker:** Sicherer Command und endgültiger Notizvertrag fehlen; Q-G05-003. **Bis dahin:** Einstieg nicht klickbar, „Telefonnotiz — In Klärung“; `FoundationUnavailable` ist kein Produktzustand.

## F-G05-007 — Aufbewahrung vorschlagen und freigeben

- **Auslöser:** Regelmäßiger, rein vorschlagender Lauf oder Admin-Aufruf ermittelt fällige personenbezogene Inhalte.
- **Personen:** Admin prüft und gibt jede Löschung/Anonymisierung frei; Rolf klärt fachliche Bindungen; niemand darf still löschen.
- **Schritte:** Dokumentart und konfigurierten Fristbeginn lesen; gesetzliche/steuerliche Haltegründe prüfen; Vorschlag mit betroffenen Feldern und erhaltenen Geschäftszahlen anzeigen; Freigabe einholen; erst danach gesicherten Command samt Receipt/Readback ausführen.
- **Ergebnis + Receipt/Readback:** Personenbezug ist nachweislich entfernt, erforderliche Geschäftszahlen bleiben, aggregierte/anonymisierte Analyse kann bleiben.
- **Fehler:** Unsichere Klassifizierung, Legal Hold, fehlende Freigabe oder unbekannter Ausgang blockieren die Veränderung vollständig.
- **Blocker:** Mechanik und fachliche Bestätigung vor Livegang sind Q-G05-006. **Bis dahin:** nur Information „Aufbewahrung — In Klärung“, keinerlei automatische Veränderung.

## Zustände

Die Texte gelten für die Kundenliste; auf der Kundenkarte dürfen die bereits belegten spezifischen Überschriften aus `CustomerCardView.tsx` verwendet werden. Jede neue Funktion muss dieselben sieben Zustandsklassen abdecken.

| Zustand | Was sieht man | Wörtlicher Text | Quelle |
|---|---|---|---|
| Daten | Reale Kundenzeilen beziehungsweise reale Kundenkarte; belegte leere Teilabschnitte bleiben sichtbar. | `Kunden` / `Kundendaten` | `CustomersAppAdapter.tsx`; `CustomerCardView.tsx` |
| lädt | Skeleton/ruhige Ladefläche ohne Beispielwerte und ohne aktive Schreibaktion. | `Kunden werden geladen.` | `CustomersAppAdapter.tsx` |
| leer | Leere Liste oder kein Filtertreffer mit nächster sinnvoller Aktion. | `Keine Kunden.` / `Keine Kunden passen zum Filter.` | `CustomersAppAdapter.tsx` |
| Fehler | Fehlerfläche ohne falsche Daten oder Erfolg; Wiederholen ist nur bei sicherem Leseweg aktiv. | `Kundenstamm konnte nicht sicher geladen werden.` | `CustomersAppAdapter.tsx` |
| gesperrt | Neutrale Sperrfläche, keine Kundendetails im DOM und keine aktive Aktion. | `Kundenstamm ist für diese Sitzung nicht freigegeben.` | `CustomersAppAdapter.tsx` |
| In Klärung | Sichtbar zurückhaltender, nicht klickbarer Teilbereich für ungeklärte Produkt-/Strukturfragen. | `In Klärung` | OE-2609-03; Anleitung 1.1 |
| In Aufbau | Sichtbar zurückhaltender, nicht klickbarer Teilbereich für entschiedenes, aber noch nicht angeschlossenes Verhalten. | `In Aufbau` | OE-2609-03; Anleitung 1.1 |

## Bereits belegte kartenspezifische Texte

- Laden: `Kundenkarte wird geladen`
- Nicht gefunden: `Kunde nicht vorhanden`
- Gesperrt: `Kundenkarte nicht freigegeben`
- Konflikt: `Kundenstand nicht eindeutig`
- Fehler: `Kundenkarte nicht verfügbar`
- Leerer nächster Auftrag: `Kein aktiver Auftrag`
- Leere aktive Aufträge: `Keine aktiven Aufträge vorhanden.`
- Leere interne Notiz: `Keine interne Kundennotiz hinterlegt.`
- Leeres Einzelfeld: `Nicht hinterlegt`
