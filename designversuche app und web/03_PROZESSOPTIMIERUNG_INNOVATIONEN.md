# Kreile WerkstattCockpit — Prozessoptimierung und innovative Lösungen

## Ziel

Die App soll nicht nur Aufträge verwalten. Sie soll den Werkstattfluss verbessern.

Kernfrage:

> Wo entsteht Reibung, und welche Maßnahme löst sie?

---

## Prozessoptimierung: Grundprinzip

Jeder Auftrag erzeugt Daten. Diese Daten sollen nicht nur archiviert, sondern genutzt werden:

- zur Engpasserkennung,
- zur besseren Reihenfolgeplanung,
- zur Reklamationsvermeidung,
- zur Preis- und Aufwandseinschätzung,
- zur schnelleren Kundenkommunikation,
- zur besseren Dokumentation.

---

## 1. StatusEvents als Datenbasis

Jede Statusänderung wird als Event gespeichert.

Dadurch kann die App automatisch berechnen:

- Wie lange lag ein Teil in der Schleiferei?
- Wie lange wartete der Auftrag auf Kundenfreigabe?
- Welche Station erzeugt regelmäßig Verzug?
- Welche Auftragstypen dauern länger?
- Welche Kunden verursachen häufig Rückfragen?
- Wo entstehen Reklamationen?
- Wo fehlen Fotos oder Informationen?

### Handlungsempfehlung für Umsetzung

Nicht nur ein Feld `status` speichern, sondern zusätzlich eine Eventhistorie:

```json
{
  "eventType": "STATION_STARTED",
  "timestamp": "2026-05-21T09:15:00",
  "station": "Schleiferei / Politur",
  "user": "Max Kreile",
  "note": "Stoßstange vorne begonnen"
}
```

---

## 2. Automatische Prioritätsberechnung

Die App soll Priorität nicht nur manuell setzen. Sie soll Dringlichkeit berechnen.

### Faktoren

- zugesagter Termin
- Restzeit bis Termin
- aktuelle Station
- erwartete Restdauer
- offene Blocker
- Anzahl wartender Teile in Station
- Kundenpriorität
- Nacharbeitsstatus
- Materialstatus
- Freigabestatus

### Beispiel-Regel

```text
Wenn Auftrag innerhalb von 24 Stunden fällig ist
UND aktuelle Station nicht Endkontrolle/Versand ist
DANN Status mindestens "gefährdet".
```

```text
Wenn Auftrag bereits überfällig ist
DANN Status "kritisch".
```

```text
Wenn Auftrag auf Kundenfreigabe wartet
DANN nicht rot markieren, außer Freigabe länger als definierte Frist offen ist.
```

---

## 3. Nächste beste Handlung

Jede kritische Karte soll nicht nur ein Problem zeigen, sondern eine Handlung.

### Beispiele

| Problem | Handlung |
|---|---|
| Kundenfreigabe offen | Kunde kontaktieren |
| Material fehlt | Materialstatus prüfen |
| Schleiferei überlastet | Schichtzuteilung prüfen |
| Foto fehlt | Dokumentation ergänzen |
| Auftrag überfällig | Express-Schaltung prüfen |
| Qualitätsprüfung fehlgeschlagen | Nacharbeit starten |
| Versand liegt fertig | Kunde informieren / Versand abschließen |

### UI-Anweisung

Jede rote/orange Karte braucht einen Button:

- „Maßnahme einleiten“
- „Kunde kontaktieren“
- „Station umplanen“
- „Foto ergänzen“
- „Freigabe eintragen“
- „Nacharbeit starten“

---

## 4. Stations-Engpass-Heatmap

Die Heatmap ist ein zentrales Element.

### Operative Heatmap

Auf Seite **Verzug & Engpässe**:

- zeigt aktuellen Zustand,
- zeigt wartende Teile,
- zeigt kritischste Station,
- klickbar zu betroffenen Aufträgen.

### Analytische Heatmap

Auf Seite **Performance**:

- zeigt Muster über Zeit,
- vergleicht Stationen,
- zeigt wiederkehrende Engpässe,
- verknüpft Auslastung mit Durchlaufzeit und Reklamationen.

### Bewertungslogik

| Wert | Zustand | Farbe |
|---|---|---|
| 0–60 % | frei / stabil | Grün |
| 61–80 % | hohe Auslastung | Gelb/Orange |
| 81–95 % | kritisch | Orange/Rot |
| >95 % | überlastet | Rot |

Aber nicht als banale Legende anzeigen. Besser konkrete Aussagen:

- „Schleiferei kritisch: 8 wartende Teile“
- „Galvanik hoch: 3 Aufträge morgen fällig“
- „Endkontrolle frei: 1 Teil wartet“

---

## 5. OCR-gestützter Wareneingang

### Ziel

Weniger Schreibarbeit und weniger Zettelchaos.

### Funktionen

- Foto von Zettel/Lieferschein aufnehmen.
- OCR erkennt Text.
- App schlägt Kunden/Teile/Auftrag vor.
- Mitarbeiter bestätigt oder korrigiert.
- Auftrag wird angelegt.
- Teilnummern werden erzeugt.
- QR-/Etiketten werden vorbereitet.

### Erweiterung

OCR soll auch unsichere Erkennung markieren.

Beispiel:

```text
Kunde erkannt: Museum Lenzburg   Sicherheit: hoch
Menge erkannt: 2                 Sicherheit: mittel
Oberfläche erkannt: vernickeln    Sicherheit: niedrig
```

Niedrige Sicherheit = gelb markiertes Feld.

---

## 6. Foto- und Zustandsdokumentation

### Ziel

Vorher-/Nachher-Dokumentation schützt vor Missverständnissen, Reklamationen und Preisstreit.

### Pflichtfotos je Teil

- Eingangszustand
- Detail beschädigter Bereich
- nach kritischer Vorarbeit optional
- Endzustand
- Verpackung bei Versand optional

### Prozessregel

Wenn ein Teil in Qualitätskontrolle geht und keine Eingangsfotos vorhanden sind:

- Hinweis anzeigen: „Eingangsfoto fehlt.“
- Nicht zwingend blockieren, aber als Dokumentationsmangel zählen.

### Performance-Kennzahl

`Dokumentationsquote = Teile mit vollständiger Fotodokumentation / alle relevanten Teile`

---

## 7. Kundenkartei als Preis- und Wissensspeicher

### Problem

Kleine Betriebe verlieren oft Wissen über Preisabsprachen, frühere Teile und Sonderfälle.

### Lösung

Die Kundenakte soll speichern:

- wiederkehrende Teile,
- frühere Preise,
- Kulanzfälle,
- Reklamationen,
- Sonderwünsche,
- Zahlungs-/Freigabeabläufe,
- Kommunikationspräferenzen,
- Fotos ähnlicher früherer Arbeiten.

### Innovation

Beim neuen Auftrag soll die App ähnliche frühere Aufträge vorschlagen:

```text
Ähnlicher Auftrag gefunden:
A-2025-0188 — Motorradteile BMW R75 verchromen
Preis: 420 €
Durchlaufzeit: 6 Tage
Hinweis: Kunde wünschte Hochglanzpolitur
```

---

## 8. Reklamations- und Nacharbeitsanalyse

### Ziel

Nicht nur Reklamationen zählen, sondern Ursachen erkennen.

### Nacharbeit erfassen

Bei Nacharbeit immer erfassen:

- betroffenes Teil,
- Station,
- Grund,
- Foto,
- Verantwortungs-/Ursachenkategorie,
- zusätzlicher Zeitaufwand,
- ob Kunde betroffen ist.

### Kategorien

- Vorarbeit unzureichend
- Materialproblem
- falsche Oberfläche
- Kommunikationsfehler
- Transportschaden
- Kundenerwartung unklar
- technischer Grenzfall
- sonstiges

### Performance-Verknüpfung

Die Performance-Seite soll zeigen:

- Reklamationsquote
- Nacharbeit je Station
- häufigste Ursachen
- zeitlicher Trend
- betroffene Auftragstypen

---

## 9. Engpass-Vorhersage

### Ziel

Nicht erst reagieren, wenn der Auftrag rot ist.

### Logik

Die App berechnet eine erwartete Restdauer.

Beispiel:

```text
Restdauer = erwartete Stationszeiten + aktuelle Warteschlangenzeit + offene Blockerzeit
```

Wenn erwartete Restdauer größer als Restzeit bis Termin:

- Status wird gelb/orange,
- Maßnahme wird vorgeschlagen.

### Beispielmeldung

```text
Auftrag A-2026-0040 wird voraussichtlich 1 Tag zu spät fertig.
Ursache: Schleiferei-Auslastung 92 %, Qualitätskontrolle morgen bereits voll.
Vorschlag: Vorarbeit priorisieren oder Kunden über Terminrisiko informieren.
```

---

## 10. Batch- und Ähnlichkeitslogik

### Ziel

Ähnliche Teile besser bündeln.

Die App soll vorschlagen:

- gleiche Oberfläche,
- gleiche Station,
- ähnliche Größe,
- gleiche Kundengruppe,
- gleiche Fristnähe.

### Beispiel

```text
3 Kleinteile mit Vernickelung liegen bereit.
Vorschlag: gemeinsam ins Bad einplanen.
Potenzielle Zeitersparnis: 25 Minuten Rüstzeit.
```

---

## 11. Maßnahmenprotokoll

Wenn ein Problem erkannt wird, soll eine Maßnahme dokumentiert werden.

### Maßnahme enthält

- Problem
- gewählte Aktion
- Verantwortlicher
- Zeitpunkt
- Ergebnis
- optional Wiedervorlage

### Beispiele

- Kunde angerufen, Freigabe offen.
- Auftrag in Schleiferei priorisiert.
- Material bestellt.
- Zusatzaufwand dokumentiert.
- Termin mit Kunde neu abgestimmt.

### Nutzen

Später kann nachvollzogen werden:

- wer eingegriffen hat,
- ob die Maßnahme geholfen hat,
- welche Problemarten wiederkehren.

---

## 12. Performance ohne Selbstlob

Die Performance-Seite darf Score, Level oder Wochenziel enthalten, aber der Hauptzweck bleibt Verbesserung.

### Gute Kennzahlen

- Termintreue
- Ø Durchlaufzeit
- kritische Aufträge
- Engpassstation
- offene Kundenfreigaben
- Materialblocker
- Reklamationsquote
- Nacharbeitsquote
- Scanquote
- Dokumentationsquote
- fertiggestellte Aufträge
- durchschnittliche Wartezeit je Station

### Schlechte/zweitrangige Kennzahlen

- rein dekorative Punkte,
- Gamification ohne Nutzen,
- unklare Scores,
- Erfolge ohne Handlungshinweis.

### Regel

Jede Kennzahl soll erklären:

- Ist das gut oder schlecht?
- Warum?
- Was sollte getan werden?

---

## 13. Intelligente Hinweise

Die App soll einfache, praxisnahe Hinweise geben.

Beispiele:

- „Viele Kleinteile warten auf Galvanik. Batch prüfen.“
- „Schleiferei ist seit 3 Tagen Hauptengpass.“
- „2 Aufträge warten auf Kundenfreigabe. Rückfragen bündeln.“
- „Reklamationen steigen bei Stoßstangen. Vorher-Foto und Erwartungsklärung verpflichtend machen.“
- „Durchlaufzeit bei Motorradteilen ist stabil. Aktueller Engpass betrifft vor allem Oldtimer-Stoßstangen.“

---

## 14. Zukunftsfähige Erweiterungen

### Kundenportal

Später möglich:

- Kunde lädt Fotos hoch.
- Kunde fragt Status ab.
- Kunde gibt Auftrag frei.
- Kunde erhält Zahlungs-/Versandstatus.
- Kunde sieht keine internen Notizen.

### Automatische Kundenkommunikation

Später möglich:

- E-Mail/SMS/WhatsApp Business.
- Statusupdates.
- Freigabeanfragen.
- Abholbenachrichtigung.
- Rückfrage bei fehlenden Angaben.

### DATEV / Lexware / Outlook

Später möglich:

- Kundendaten synchronisieren.
- Angebote/Rechnungen vorbereiten.
- Kommunikationshistorie importieren.
- Zahlungsstatus abgleichen.

### KI-Assistent

Später möglich:

- Zusammenfassung eines Auftrags.
- Erkennung fehlender Informationen.
- Vorschlag ähnlicher Aufträge.
- Formulierung von Kundennachrichten.
- Reklamationsanalyse.
- Prozessverbesserungsvorschläge.

---

## 15. MVP-Reihenfolge

### Phase 1: Saubere operative App

- Heute
- Aufträge
- Teile
- Kunden
- Scan/OCR als Demo
- Statuslogik
- Prioritätskarten
- Heatmap
- Performance-Grundseite

### Phase 2: Prozessdaten

- StatusEvents
- Zeitleiste
- Durchlaufzeiten
- Stationszeiten
- Dokumentationsquote
- Maßnahmenprotokoll

### Phase 3: Optimierung

- Engpassvorhersage
- Batchvorschläge
- Reklamationsanalyse
- ähnliche Aufträge
- bessere Kundenakte

### Phase 4: Integration

- echte Datenbank
- Benutzerrollen
- Etikettendruck
- Kamera/Tablet
- Kundenkommunikation
- Lexware/DATEV/Outlook-Schnittstellen

---

## Umsetzungshinweis

Die App soll zunächst mit realistischen Mockdaten funktionieren. Die Logik muss aber so gebaut sein, dass später echte Datenbank-, OCR-, Kamera- und Schnittstellenfunktionen angeschlossen werden können.
