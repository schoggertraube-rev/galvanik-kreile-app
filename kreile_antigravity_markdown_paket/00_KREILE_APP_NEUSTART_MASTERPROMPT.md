# Kreile WerkstattCockpit — Neustart-Masterprompt für Antigravity

## Ziel dieses Dokuments

Dieses Dokument ist die übergeordnete Bauanweisung für Antigravity/Claude Code. Es fasst die bisherigen Markdown-Dateien, Screenshots, neuen Präferenzen und Rechercheergebnisse zu einer konsistenten Produktvision zusammen.

Die App soll nicht einfach hübscher werden. Sie soll ein echtes operatives Werkstatt-Cockpit für einen Galvanik- und Restaurationsbetrieb werden.

## Grundsatz

**Funktion und Haptik haben Vorrang vor Dekoration.**

Die App muss im Handwerk funktionieren:

- auf Tablet und PC,
- mit Fingern statt Mauspräzision,
- unter Zeitdruck,
- mit wenig Lesen,
- mit sofort sichtbaren Problemen,
- mit vollständiger Dokumentation,
- mit später auswertbaren Daten.

## Analyse der bisherigen Umsetzung

Die bisherige App hat eine brauchbare Basis:

- klare linke Navigation,
- erste Werkstattfluss-Struktur,
- Auftragskarten,
- Performance-Seite,
- Statusfarben,
- Detailpanel-Idee,
- Heatmap-Ansätze.

Es gibt aber strukturelle Probleme:

- Der Werkstattfluss sitzt zu stark in der Sidebar und ist nicht präsent genug.
- „Kontrolle & Archiv“ ist noch zu groß, teilweise doppelt und ohne klaren Funktionskern.
- Einige Buttons sind optisch vorhanden, aber funktional tot.
- Wareneingang ist noch nicht konsequent als Kamera-first-Prozess gedacht.
- Kundenakte ist noch nicht stark genug als Werkstattgedächtnis.
- Performance wirkt bereits professionell, soll aber haptischer, motivierender und deutlicher werden.
- Die App zeigt teilweise Daten, aber führt noch nicht konsequent zur nächsten Handlung.

## Produktbild

Die App soll wirken wie:

- ein modernes Werkstatt-Leitsystem,
- ein Produktionscockpit,
- ein Tablet-System für einen echten Betrieb,
- hochwertig, aber nicht verspielt,
- klar, aber nicht steril,
- traditionell im Charakter, modern in der Bedienung.

Sie soll nicht wirken wie:

- Excel 1985,
- Baukasten-Website,
- generische Demo-App,
- überladenes ERP,
- Start-up-Spielerei ohne Werkstattlogik.

## Zentrale Nutzungslogik

Beim Öffnen der App soll der Nutzer nicht in einer Liste landen, sondern zuerst Orientierung bekommen.

### Nach Login erscheint:

1. Firmenlogo / Kreile WerkstattCockpit
2. Begrüßung je nach Tageszeit und Login
3. Minimaler Tagesüberblick
4. Sehr klare Handlung: „Zum heutigen Tag“, „Wareneingang“, „Kritische Punkte“

Beispiel:

```text
Guten Morgen, Max.
Heute zählt: 1 kritisch, 2 gefährdet, 3 im Plan.
Schleiferei ist der aktuelle Engpass.
```

Danach geht der Nutzer in den Werkstattfluss oder in den Tagesleitstand.

## Hauptbereiche der App

Die App besteht aus folgenden Kernbereichen:

| Bereich | Zweck | UI-Ort |
|---|---|---|
| Startseite | Orientierung nach Login | eigene Home-Route |
| Der heutige Tag | operative Tagessteuerung | Topbar-Button neben Werkstattfluss |
| Werkstattfluss | Stationen von Wareneingang bis Warenausgang | horizontal oben über volle Breite |
| Aufträge | Auftragsbuch und Detailsteuerung | Hauptnavigation / Archiv |
| Kundenkartei | Werkstattgedächtnis | Sidebar / Archiv-Menü |
| Wareneingang | Kamera-first-Erfassung | Station 1 |
| Lager / Warenwirtschaft | Bestand und Bewegungen | Station 2 und eigener Unterbereich |
| Badregelkarte | Zustand und Führung galvanischer Bäder | Fachmodul unter Galvanik |
| Verzug & Engpässe | operative Problemzentrale | Sidebar / Leitstand |
| Performance | Analyse, Motivation, Prozessverbesserung | Sidebar / Leitstand |
| Einstellungen | Benutzer, Stammdaten, Kataloge | Sidebar unten |

## Navigation: neue Grundentscheidung

Der Werkstattfluss gehört **nicht primär in die linke Sidebar**, sondern horizontal nach oben über die volle Breite des Arbeitsbereichs.

Die Sidebar bleibt für:

- Heute / Leitstand,
- Alle Aufträge,
- Kundenkartei,
- Verzug & Engpässe,
- Performance,
- Kontrolle & Archiv als gebündeltes Untermenü,
- Einstellungen.

Der Werkstattfluss oben zeigt:

1. Wareneingang
2. Lager
3. Galvanik / Entmetallisierung
4. Schleiferei
5. Veredelung / Galvanik
6. Warenausgang

Jeder Stationsbutton ist ein Statusindikator. Wenn dort ein Problem liegt, ändert der Button sichtbar Farbe.

## Farb- und Statusgrundsatz

Keine Legendenwüste. Der Status muss aus Form, Farbe, Zahl und Text verständlich sein.

| Status | Farbe | Bedeutung | Wirkung |
|---|---|---|---|
| Grün | stabil | läuft sauber | beruhigend |
| Gelb | beobachten | Frühwarnung | Aufmerksamkeit |
| Orange | gefährdet | bald problematisch | deutlich |
| Rot | kritisch | sofort handeln | dominant |
| Blau/Grau | neutral/wartend | dokumentarisch, Freigabe, Archiv | ruhig |

Regel:

**Rot darf nur verwendet werden, wenn eine konkrete Handlung nötig ist.**

Jede rote Karte benötigt:

- Ursache,
- betroffene Station,
- betroffenen Auftrag,
- nächste Handlung.

## Wareneingang: radikale Vereinfachung

Beim Button „Wareneingang“ dürfen zunächst nur zwei große Hauptoptionen sichtbar sein:

1. Kamera
2. Manuelle Eingabe

Alles Weitere ergibt sich daraus.

Nach Klick auf Kamera:

- Dokument scannen,
- Foto aufnehmen,
- OCR lesen,
- Kunde erkennen,
- Auftrag vorschlagen,
- Teile zählen,
- Teile benennen,
- bestehende Kundenhistorie prüfen,
- Fotos/Dokumente ablegen,
- QR/Etikett vorbereiten,
- fehlende Daten markieren.

Unter den beiden Buttons liegt ein dezenter, aber nutzbarer Bereich:

```text
Vergangene Annahmen / ähnliche Aufträge anzeigen
```

Bei Klick führt dieser zur Kundenakte bzw. zu ähnlichen historischen Aufträgen.

## Kundenakte als Werkstattgedächtnis

Die Kundenkartei darf nicht nur Stammdaten zeigen.

Sie muss speichern und anzeigen:

- alle früheren Aufträge,
- Fotos,
- Preise,
- Preisabsprachen,
- wiederkehrende Teile,
- Reklamationen,
- Freigabegewohnheiten,
- technische Besonderheiten,
- Kommunikationshistorie,
- Zahlungs- und Versandmuster.

Darstellung: rechts oder auf eigener Seite als vertikaler Zeitstrahl.

## Auftragdetail

Beim Anklicken eines Auftrags muss ein echtes Steuerpanel erscheinen.

Pflichtfunktionen:

- Station starten,
- Station abschließen,
- Foto ergänzen,
- Kunde kontaktieren,
- Freigabe eintragen,
- Material hinzufügen,
- Verbrauchsmaterial buchen,
- Arbeitszeit buchen,
- Nacharbeit starten,
- Versand vorbereiten.

Material- und Zeitbuchung:

- Button: „Verbrauch hinzufügen“
- Slider/Stepper für Arbeitszeit
- Slider/Stepper für Verbrauchseinheiten
- Auswahl aus Backend-Katalog: Bürsten, Schleifpapier, Polierscheiben, Chemie, Lötzeit, Verpackung etc.

## Warenwirtschaft

Die App braucht ein einfaches, aber robustes Warenwirtschaftssystem:

- Artikelstamm,
- Lagerorte,
- Mindestbestand,
- Einbuchung,
- Ausbuchung,
- Verbrauch pro Auftrag,
- manuelle Korrektur mit Grund,
- Wareneingang Bestand,
- Warnung bei niedrigem Bestand,
- später Lieferanten und Bestellvorschläge.

## Badregelkarte

Für Galvanik braucht es ein Fachmodul:

- Bäder,
- Chemie,
- Messwerte,
- Soll-/Grenzwerte,
- Zustand,
- Dosierungen,
- Wartung,
- Sperrstatus,
- Historie,
- Auswirkungen auf Aufträge.

Beispiel:

```text
Nickelbad 1
Status: Beobachten
Temperatur: 54 °C
pH: 4.1
Letzte Analyse: gestern
Nächste Aktion: Glanzzusatz prüfen
```

## Datenprinzip

Die App darf nicht nur aktuelle Zustände speichern. Sie muss Ereignisse speichern.

Jede relevante Handlung erzeugt ein `StatusEvent`, `StockMovement`, `WorkTimeLog`, `ConsumableUse`, `BathMeasurement` oder `ActionLog`.

Aus diesen Daten entstehen:

- Durchlaufzeiten,
- Stationswartezeiten,
- Verbrauch pro Auftrag,
- Nachkalkulation,
- Engpassanalyse,
- Reklamationsursachen,
- Kundenhistorie,
- Performance.

## Backend-Grundsatz

Für das Zielbild ist ein relationales Datenmodell sinnvoller als eine reine Dokumentensammlung.

Empfehlung:

- PWA/React-App beibehalten.
- Backend erst abstrahieren, dann anbinden.
- Für echte Daten später Postgres nutzen.
- Für MVP weiterhin Mockdaten, aber mit finaler Datenstruktur.

Technische Zielrichtung:

```text
Frontend PWA
  -> Data Provider Layer
    -> Mock Provider für Demo
    -> API Provider für echtes Backend
      -> Postgres / Supabase / Neon
      -> Objektstorage für Fotos und Dokumente
      -> OCR / Kamera-Pipeline
```

## Bewertung der Recherche gegen Anforderungen

Die Recherche bestätigt sinnvolle Richtungen:

- große Touch-Ziele,
- Kamera/OCR als Prozessbeschleuniger,
- Cloud- oder Postgres-Backend,
- Warenwirtschaft als eigener Datenbereich,
- Gamification als motivierende Ergänzung.

Die Recherche ist aber an einigen Stellen zu allgemein:

- Flutter/React Native ist nicht zwingend nötig. Für dieses Projekt ist PWA-first sinnvoller, weil Antigravity/Claude Code schneller Web-Apps baut und Tablet/PC wichtiger sind.
- Objektzählung per Kamera ist möglich, aber im MVP nur als Assistenz mit manueller Bestätigung realistisch.
- Cloud ist sinnvoll, aber nicht automatisch die beste Antwort. Es braucht eine klare Backend-Strategie.
- Gamification darf nicht zum Selbstzweck werden. Sie muss Engpässe und Erfolg schneller erfassbar machen.

## Nicht verhandelbare Anforderungen

- Keine vollständige Neuerstellung ohne Analyse.
- Keine toten Buttons.
- Keine Navigation ohne Funktion.
- Keine doppelten Menüpunkte.
- Keine Tabellenoptik als Hauptdesign.
- Keine langen Formulare am Anfang des Wareneingangs.
- Keine Statusfarbe ohne fachliche Bedeutung.
- Keine rote Anzeige ohne Handlungsvorschlag.
- Keine Backend-Festlegung, die spätere Auswertungen blockiert.

## Akzeptanzkriterium auf einen Blick

Eine gute Umsetzung erfüllt folgende Frage:

> Erkennt ein Mitarbeiter innerhalb von 3 Sekunden, was heute wichtig ist, wo etwas hängt und was als Nächstes zu tun ist?

Wenn nein, ist die Oberfläche noch nicht fertig.
