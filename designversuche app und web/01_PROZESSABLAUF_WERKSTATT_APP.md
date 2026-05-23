# Kreile WerkstattCockpit — Prozessablauf und Handlungsanweisungen

## Zweck dieses Dokuments

Dieses Dokument beschreibt den Arbeitsablauf, den die App abbilden soll. Es dient als Prozess- und Logikgrundlage für die Umsetzung in Antigravity.

---

## Grundidee

Die App begleitet jeden Auftrag von der Annahme bis zur Auslieferung. Sie ersetzt nicht die handwerkliche Entscheidung, sondern macht sichtbar:

- wo sich ein Auftrag befindet,
- welcher Schritt als Nächstes folgt,
- welche Teile fehlen,
- welche Station überlastet ist,
- welcher Auftrag kritisch wird,
- wo Kundenfreigabe oder Material fehlt,
- welche Maßnahmen erforderlich sind.

---

## Hauptobjekte

### Auftrag

Ein Auftrag ist der kaufmännisch-organisatorische Rahmen.

Pflichtdaten:

- Auftragsnummer
- Kunde
- Eingangsdatum
- gewünschte Leistung
- Zieltermin / zugesagter Termin
- Priorität
- Status
- zuständige Station
- Teileliste
- Dokumente/Fotos
- interne Notizen
- Kundenkommunikation
- Versand-/Abholart

### Teil / Objekt

Ein Auftrag kann mehrere Teile enthalten.

Pflichtdaten je Teil:

- Teilenummer
- Zugehöriger Auftrag
- Bezeichnung
- Menge
- Material
- gewünschte Oberfläche
- aktueller Zustand
- aktuelle Station
- Fotos vorher/nachher
- Besonderheiten
- Qualitätsstatus
- Nacharbeitsstatus
- Verpackungsstatus

### Kunde

Kundenkartei mit Werkstattgedächtnis.

Pflichtdaten:

- Kundennummer
- Name/Firma
- Kundentyp: Privatkunde, Geschäftskunde, Institution
- Adresse
- Kontaktperson
- Telefon/E-Mail
- historische Aufträge
- Preisabsprachen
- Reklamationen
- wiederkehrende Teile
- technische Besonderheiten
- Kommunikationspräferenz
- Zahlungs-/Freigabebesonderheiten

---

## Stationen im Standardprozess

Die App soll folgende Stationen kennen:

1. Wareneingang
2. Prüfung / Vorerfassung
3. Fotodokumentation
4. Angebot / Freigabe
5. Schleiferei / Politur / Vorarbeit
6. Galvanische Bäder
7. Chemische Entlackung / Vorbehandlung
8. Qualitätskontrolle
9. Endmontage / Verpackung
10. Versand / Abholung
11. Abgeschlossen / Archiv

Nicht jeder Auftrag durchläuft jede Station. Die Stationen müssen je Auftrag/Teil aktivierbar oder überspringbar sein.

---

## Statuslogik

### Auftragsstatus

| Status | Bedeutung | Farbe | Aktion |
|---|---|---|---|
| Neu | Auftrag wurde angelegt, aber noch nicht geprüft | Blau/Grau | prüfen |
| Wartet auf Freigabe | Kunde oder intern muss entscheiden | Grau/Blau | Rückfrage stellen |
| Wartet auf Material | Material/Teil/Info fehlt | Grau/Gelb | Material klären |
| In Arbeit | Auftrag läuft aktiv | Grün/Blau | Station fortsetzen |
| Im Plan | Auftrag ist fristgerecht | Grün | keine Sofortaktion |
| Leicht kritisch | Frist nähert sich oder Station wird eng | Gelb/Orange | beobachten/planen |
| Gefährdet | Terminrisiko erkennbar | Orange | Maßnahme einleiten |
| Kritisch | Verzug oder harter Engpass | Rot | sofort eingreifen |
| Nacharbeit | Reklamation oder Qualitätsproblem | Rot/Orange | Ursache dokumentieren |
| Fertig | Auftrag bereit für Versand/Abholung | Grün | ausliefern |
| Abgeschlossen | Auftrag archiviert | Neutral | keine Aktion |

---

## Ereignislogik / StatusEvents

Jede wichtige Handlung erzeugt ein Ereignis.

Beispiele:

- `ORDER_CREATED`
- `ITEM_ADDED`
- `PHOTO_CAPTURED`
- `OCR_SCAN_COMPLETED`
- `LABEL_PRINTED`
- `STATION_STARTED`
- `STATION_COMPLETED`
- `CUSTOMER_APPROVAL_REQUESTED`
- `CUSTOMER_APPROVAL_RECEIVED`
- `MATERIAL_MISSING`
- `MATERIAL_RECEIVED`
- `QUALITY_CHECK_FAILED`
- `REWORK_STARTED`
- `REWORK_COMPLETED`
- `READY_FOR_SHIPPING`
- `SHIPPED`
- `PICKED_UP`
- `ORDER_CLOSED`

Diese Events bilden später die Grundlage für:

- Durchlaufzeit
- Wartezeit
- Engpassanalyse
- Reklamationsquote
- Termintreue
- Stationsauslastung
- Performance-Trends

---

## Prozess: Wareneingang

### Ziel

Jedes eintreffende Teil wird schnell erfasst, fotografiert, etikettiert und einem Auftrag/Kunden zugeordnet.

### Ablauf

1. Mitarbeiter öffnet **Scan (OCR)** oder klickt auf **Wareneingang scannen**.
2. Kamera oder Dateiupload wird geöffnet.
3. Lieferschein, Zettel, Etikett oder Kundenbegleitschreiben wird gescannt.
4. OCR versucht automatisch zu erkennen:
   - Kunde
   - Telefonnummer/E-Mail
   - Teilebezeichnung
   - Menge
   - gewünschte Bearbeitung
   - eventuell Terminwunsch
5. Mitarbeiter prüft OCR-Vorschlag.
6. System schlägt bestehenden Kunden vor oder bietet **neuen Kunden anlegen**.
7. Auftrag wird angelegt oder einem bestehenden Auftrag zugeordnet.
8. Teile werden einzeln erfasst.
9. Je Teil werden Fotos aufgenommen:
   - Gesamtansicht
   - Schadstelle / Zustand
   - Detailaufnahme
   - Verpackung / Zubehör falls relevant
10. App erzeugt Teilnummern und Etiketten/QR-Codes.
11. Status wird auf **Vorerfassung / Prüfung** gesetzt.

### UI-Anweisung

- Der Scanprozess muss in maximal 3–5 klaren Schritten funktionieren.
- Kein langes Formular zuerst.
- Erst scannen/fotografieren, dann Daten ergänzen.
- OCR-Ergebnisse immer bearbeitbar machen.
- Unsichere OCR-Werte markieren, nicht ungeprüft übernehmen.

---

## Prozess: Prüfung und Angebot/Freigabe

### Ziel

Vor Arbeitsbeginn wird geklärt, ob Auftrag, Preis, Leistung, Risiko und Termin plausibel sind.

### Ablauf

1. Mitarbeiter prüft Zustand und Machbarkeit.
2. App zeigt fehlende Pflichtinformationen:
   - Kunde fehlt
   - Teilfotos fehlen
   - Oberfläche unklar
   - Material unklar
   - Preisfreigabe fehlt
   - Kundenfreigabe fehlt
3. Wenn Angebot nötig ist, Status auf **Wartet auf Freigabe** setzen.
4. Kundennachricht oder interne Notiz hinterlegen.
5. Nach Freigabe Status auf **Freigegeben / bereit für Station** setzen.
6. Auftrag wird in die Prioritäts-Warteschlange aufgenommen.

### UI-Anweisung

- Fehlende Punkte als Checkliste anzeigen.
- Rote Warnung nur bei echten Blockern.
- Graue/blau-gelbe Hinweise für offene Klärung.
- Nächste sinnvolle Aktion als Button anzeigen: z. B. „Kunde anrufen“, „Freigabe eintragen“, „Foto ergänzen“.

---

## Prozess: Schleiferei / Vorarbeit

### Ziel

Vorarbeiten sollen sichtbar werden, weil sie oft Engpässe verursachen.

### Ablauf

1. Auftrag/Teil kommt in Station **Schleiferei / Politur / Vorarbeit**.
2. Mitarbeiter klickt **Station starten**.
3. App speichert Startzeit.
4. Mitarbeiter kann Status setzen:
   - In Arbeit
   - Pausiert
   - Zusatzaufwand
   - Rückfrage nötig
   - Fertig
5. Bei Zusatzaufwand wird Grund erfasst:
   - Rost stärker als erwartet
   - tiefe Kratzer
   - alte Beschichtung problematisch
   - Teil verzogen/beschädigt
   - andere Ursache
6. Bei Abschluss wird **Station abschließen** geklickt.
7. App speichert Endzeit und leitet zur nächsten Station.

### UI-Anweisung

- Stationen als große, klickbare Prozesskarten anzeigen.
- In der Tagesansicht nur nächste Aktion zeigen, nicht alle Details.
- Zusatzaufwand sofort sichtbar machen, weil er Termine verschiebt.
- Engpass Schleiferei in Heatmap und Performance besonders berücksichtigen.

---

## Prozess: Galvanik / Bäder

### Ziel

Badbelegung, Reihenfolge und Wartezeiten sollen sichtbar werden.

### Ablauf

1. Auftrag/Teil erhält Station **Galvanische Bäder**.
2. System zeigt vorbereitende Bedingungen:
   - Vorarbeit abgeschlossen?
   - Material geeignet?
   - Freigabe vorhanden?
   - Bad verfügbar?
3. Mitarbeiter startet Station.
4. Optional: Badtyp auswählen:
   - Vernickeln
   - Verchromen
   - Vergolden
   - Versilbern
   - Brünieren
   - sonstige Oberfläche
5. Bei Abschluss: Status auf nächste Station setzen.
6. Wenn Bad belegt/überlastet: Engpassereignis erzeugen.

### UI-Anweisung

- Bad-/Stationsauslastung nicht als Textwüste anzeigen.
- Kurze Karten mit Prozent/Anzahl wartender Teile.
- Bei kritischer Belegung automatisch orange/rot markieren.
- Batch-Möglichkeiten anzeigen: ähnliche Teile zusammenfassen.

---

## Prozess: Qualitätskontrolle

### Ziel

Vor Versand muss klar sein, ob Teile fertig, nachzubearbeiten oder zu klären sind.

### Ablauf

1. Fertige Teile landen in **Qualitätskontrolle**.
2. Mitarbeiter nimmt Nachher-Fotos auf.
3. Qualitätsstatus wählen:
   - OK
   - kleine Abweichung dokumentiert
   - Nacharbeit nötig
   - Kundenfreigabe nötig
   - Ausschuss/Risiko
4. Bei Nacharbeit:
   - Grund erfassen
   - betroffene Station markieren
   - Foto hinzufügen
   - Nacharbeit starten
5. Bei OK:
   - Teil geht zu Verpackung/Versand.

### UI-Anweisung

- Qualitätskontrolle als Pflichtschritt für relevante Aufträge.
- Reklamations- und Nacharbeitsdaten fließen in Performance.
- Nacharbeit soll sichtbar sein, aber nicht mit normalen Verzögerungen vermischt werden.

---

## Prozess: Versand / Abholung

### Ziel

Fertige Aufträge sollen nicht unnötig liegen bleiben.

### Ablauf

1. Auftrag wird als **Fertig** markiert.
2. App fragt Versand-/Abholart:
   - Abholung
   - Paketversand
   - Spedition
   - interne Übergabe
3. Verpackungsfotos optional erfassen.
4. Versandlabel / Trackingnummer hinterlegen.
5. Kunde benachrichtigen.
6. Status auf **Versendet / Abholbereit**.
7. Nach Abschluss: **Auftrag schließen**.

### UI-Anweisung

- Fertige, aber nicht abgeholte/versendete Aufträge sichtbar halten.
- Nicht rot markieren, solange keine Frist überschritten ist.
- Abholbereit länger als X Tage: gelb/orange markieren.

---

## Prioritätslogik für „Heute“

Die Tagesansicht sortiert automatisch:

1. Überfällig und kritisch
2. Heute fällig
3. Engpassrelevant
4. Wartet auf Entscheidung
5. Fällig morgen
6. Fällig in 2–5 Tagen
7. Im Plan

### Karte je Auftrag

Jede Karte zeigt maximal:

- Auftragsnummer
- Kunde
- Hauptarbeit
- aktuelle Station
- Friststatus
- nächster Handlungsschritt
- Farbe/Form nach Priorität

Details nur per Klick öffnen.

---

## Automatische Warnungen

Die App soll Warnungen erzeugen, wenn:

- Auftrag überfällig ist
- Auftrag innerhalb 24h fällig und nicht in Endstation
- Station über definierter Auslastung liegt
- Teil zu lange in einer Station liegt
- Kundenfreigabe länger als X Tage offen ist
- Material länger als X Tage fehlt
- Fotos fehlen
- Qualitätskontrolle fehlgeschlagen ist
- Reklamationsquote steigt
- Durchlaufzeit je Auftragstyp deutlich über Durchschnitt liegt

---

## Grundsatz für Prozessoptimierung

Die App darf nicht nur anzeigen, was passiert ist. Sie soll vorschlagen, was jetzt getan werden sollte.

Beispiele:

- „Schleiferei überlastet: 5 wartende Teile. Vorschlag: Schichtzuteilung prüfen.“
- „Kundenfreigabe seit 2 Tagen offen. Vorschlag: Kunde kontaktieren.“
- „Galvanik 85 % ausgelastet. Vorschlag: ähnliche Kleinteile bündeln.“
- „Foto fehlt. Vorschlag: Dokumentation vor Station starten ergänzen.“
