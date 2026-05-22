# Kreile WerkstattCockpit — UI/UX Designsystem

## Designziel

Die App soll wie ein professionelles, käuflich erhältliches Werkstattcockpit wirken: klar, hochwertig, schnell erfassbar und farblich stark genug, um Probleme sofort sichtbar zu machen.

Der aktuelle Stand ist eine gute Basis. Das Design soll **veredelt**, nicht zerstört werden.

---

## Gestaltungsprinzipien

### 1. Problem zuerst

Die App ist kein Schönwetter-Dashboard. Sie soll operative Probleme sichtbar machen.

Deshalb:

- Kritische Elemente größer und farblich stärker darstellen.
- Grüne Elemente ruhiger und kleiner halten.
- Rot nicht inflationär verwenden.
- Jede rote Anzeige muss eine konkrete nächste Handlung haben.

### 2. Tablet-first

Die App wird in der Werkstatt auf Tablet oder großem Bildschirm genutzt.

Daher:

- große Touchflächen,
- klare Abstände,
- keine zu kleinen Texte,
- wichtige Zahlen groß,
- Status nicht nur über Text,
- Bedienung auch mit Handschuhen oder im Vorbeigehen denkbar.

### 3. 3-Sekunden-Regel

Innerhalb von 3 Sekunden muss erkennbar sein:

- Was ist kritisch?
- Wo hängt es?
- Welcher Auftrag ist betroffen?
- Was muss als Nächstes getan werden?

### 4. Details erst auf Klick

Auf Übersichtsseiten keine Informationsüberladung.

- Übersicht = Entscheidung.
- Detailansicht = Erklärung.
- Drawer/Panel/Modal = Bearbeitung.

---

## Markenwirkung

Kreile steht für:

- traditionsreiches Handwerk,
- Meisterbetrieb,
- Restaurierung,
- Metalloberflächen,
- Frankfurt,
- Qualität,
- Vertrauen,
- individuelle Arbeit.

Die App darf modern sein, soll aber nicht nach Startup-Spielerei aussehen. Der Stil soll präzise, handwerklich und hochwertig bleiben.

---

## Farbkonzept

### Primärfarben

| Rolle | Farbe | Verwendung |
|---|---|---|
| Dunkelblau | seriöse Grundfarbe | Navigation, Hauptbuttons, Logo-Nähe |
| Kupfer/Orange | handwerklicher Akzent | Hinweise, aktive Elemente, Kreile-Charakter |
| Grün | stabil/im Plan | positive Statuswerte |
| Gelb | Aufmerksamkeit | drohende Probleme |
| Orange | kritisch/hoch | Terminrisiko, hohe Auslastung |
| Rot | sofortiger Handlungsbedarf | Verzug, Überlastung, Nacharbeit |
| Grau/Blau-Grau | neutral/wartend | Material, Freigabe, Archiv |

### Farbregeln

- Rot nur für echte Probleme.
- Orange für drohende Probleme.
- Gelb für Frühwarnung.
- Grün für stabil, aber optisch zurückhaltend.
- Blau für Aktion/Navigation, nicht für Problemstatus.
- Grau für wartende oder passive Zustände.

---

## Form- und Größencodierung

Farbe allein reicht nicht. Status muss auch über Form und Größe erkennbar sein.

| Status | Form | Größe | Wirkung |
|---|---|---|---|
| Kritisch | Oktagon / Warnschild / starker Rand | groß | sofort sichtbar |
| Gefährdet | Dreieck / oranger Rand | mittel | Aufmerksamkeit |
| Im Plan | Kreis / dezenter Rand | normal | ruhig |
| Wartet | Pause-Symbol / graue Karte | normal | blockiert, aber nicht panisch |
| Fertig | Haken / grün | normal | erledigt |
| Nacharbeit | rot-orange + Werkzeug/Loop-Symbol | auffällig | Qualitätsproblem |

---

## Navigationsstruktur

Die linke Navigation bleibt erhalten, aber soll kompakter und moderner wirken.

### Seiten

- Heute
- Aufträge
- Teile
- Kunden
- Scan (OCR)
- Verzug & Engpässe
- Performance
- Einstellungen

### Designanweisung

- Icons klarer und etwas stärker.
- Aktiver Menüpunkt deutlich sichtbar.
- Logo oben beibehalten, aber sauber ausrichten.
- „Meisterbetrieb seit 1962“ als dezentes Vertrauenselement unten oder im Header.
- Keine zu großen linken Textblöcke.
- Auf Tablet darf die Navigation ikonischer sein.

---

## Globaler Header

Der Header soll enthalten:

- globale Suche: Auftrag, Kunde, Teilenummer
- Benachrichtigungssymbol
- Datum/KW
- Benutzerprofil
- optional: schneller Statusindikator kritischer Aufträge

### Suchfeld

Das Suchfeld ist zentral wichtig.

Es soll suchen nach:

- Auftragsnummer
- Kundennamen
- Teilenummer
- Oberfläche
- Station
- Telefonnummer
- Schlagwort in Notizen

---

## Seite: Heute / Kommende Arbeiten

### Ziel

Diese Seite ist die wichtigste operative Ansicht.

Sie zeigt nicht „alles“, sondern „was als Nächstes wichtig ist“.

### Layout

Links/Mitte:

- große Überschrift „Kommende Arbeiten“
- Prioritätsbalken oben
- darunter Auftragskarten nach Dringlichkeit

Rechts:

- Produktionsstatus
- kritische Anzahl je Status
- letzte Aktivitäten
- optional kleine Heatmap oder Stationsstatus

### Auftragskarte

Jede Karte soll zeigen:

- großes Statussymbol
- Auftragsnummer
- Arbeit/Oberfläche
- Kunde
- aktuelle Station
- Fälligkeit
- Statuslabel
- nächster Handlungsschritt
- Pfeil/Öffnen für Details

### Beispiel

```text
[ROTES WARNSYMBOL] A-2026-0042
Stoßstangen vernickeln
Museum Lenzburg

Station: Schleiferei / Vorarbeit
Überfällig seit: 3 Stunden

Nächste Aktion: Express-Schaltung prüfen
```

### Farblogik der Karten

- Kritisch: roter linker Balken, rotes Symbol, rote Frist groß.
- Leicht kritisch: orange/gelber Balken, Frist mittelgroß.
- Im Plan: grüner Kreis, dezente Karte.
- Wartet: graue/blaue Karte mit Pause-Symbol.

---

## Seite: Aufträge

### Ziel

Auftragsbuch mit Filter- und Detailfunktion.

### Layout

- Suchfeld oben.
- Filterchips:
  - Alle
  - In Arbeit
  - Wartend
  - Kritisch / Warnung
  - Fertig
- Liste links/mittig.
- Detailpanel rechts.

### Verbesserung

Aktuelle Auftragskarten sind grundsätzlich gut. Sie sollen jedoch:

- stärkere Prioritätsränder erhalten,
- Friststatus größer zeigen,
- weniger kleinteilige Labels haben,
- bei Klick Detailpanel mit Prozesskette öffnen.

### Detailpanel

Detailpanel zeigt:

- Auftrag
- Kunde
- Teile
- aktuelle Station
- Zeitleiste/StatusEvents
- Fotos
- offene Blocker
- nächste Aktion
- interne Notizen
- Kundenkontaktbutton

---

## Seite: Teile

### Ziel

Jedes physische Teil soll auffindbar sein.

### Kernfunktionen

- Teil suchen
- QR/Etikett scannen
- Teilstatus ansehen
- Fotos vorher/nachher ansehen
- Station ändern
- Teil einem Auftrag zuordnen
- Teil als fehlend/beschädigt/nacharbeitspflichtig markieren

### UI

Teile sollten als Karten mit Mini-Prozessstatus dargestellt werden:

```text
Teil T-2026-0042-02
Stoßstange hinten links
Auftrag A-2026-0042
Station: Schleiferei
Status: Zusatzaufwand
Fotos: 4
```

---

## Seite: Kunden

### Ziel

Kundenkartei als Wissensspeicher.

### Verbesserung

Die aktuelle Kundenansicht wirkt sauber, aber noch leer. Sie soll stärker als Akte funktionieren.

Bei Auswahl eines Kunden rechts anzeigen:

- Kundenprofil
- offene Aufträge
- abgeschlossene Aufträge
- wiederkehrende Teile
- Preisabsprachen
- Reklamationen
- Fotos/Referenzen
- Notizen
- Kommunikationshistorie

### Kundenstatus

Kundentypen farblich dezent unterscheiden:

- Privatkunde
- Geschäftskunde
- Institution
- Stammkunde
- kritischer Kunde / besondere Freigaben

---

## Seite: Scan (OCR)

### Ziel

Wareneingang schnell digitalisieren.

### UI-Prinzip

Der Scanprozess soll wie ein Assistent funktionieren:

1. Foto/Scan aufnehmen
2. Daten erkennen
3. Kunde/Auftrag zuordnen
4. Teile bestätigen
5. Fotos ergänzen
6. Etikett/QR erzeugen

### Wichtig

- Unsichere OCR-Felder farblich markieren.
- Nutzer muss nie mit einem langen leeren Formular starten.
- Nach Scan sofort zeigen: „Was wurde erkannt?“
- Danach: „Was fehlt noch?“

---

## Seite: Verzug & Engpässe

### Ziel

Operative Problemzentrale.

Diese Seite beantwortet:

- Was ist gerade kritisch?
- Warum ist es kritisch?
- Welche Station ist betroffen?
- Welche Maßnahme ist sinnvoll?

### Layout

Oben:

- kritischer Verzug
- gefährdete Aufträge
- wartet auf Freigabe
- Materialmangel

Mitte:

- Problemkarten nach Dringlichkeit

Rechts:

- Stations-Engpass-Heatmap
- wartende Teile je Station
- stärkster Engpass
- Maßnahmenvorschläge

### Problemkarte

Jede Problemkarte braucht:

- Auftrag
- Kunde
- Problemgrund
- Station
- überfällig seit / Restzeit
- empfohlene Maßnahme
- Button „Maßnahme einleiten“

### Heatmap

Die bestehende Heatmap ist gut. Sie soll erhalten bleiben.

Verbesserung:

- größere Stationskarten
- weniger erklärender Text
- direkter Status je Station
- Klick auf Station zeigt betroffene Aufträge
- rote Station springt deutlicher ins Auge

---

## Seite: Performance

### Ziel

Analyse- und Optimierungsseite.

Nicht Selbstlob, sondern Prozessverbesserung.

### Layout

Oben KPI-Karten:

- Termintreue
- Ø Durchlaufzeit
- Fertig diese Woche
- Offene Aufträge
- Kritische Aufträge
- Reklamationsquote
- OCR-/Scanquote

Mitte:

- Performance Score
- Trend dieser Woche
- Aufträge nach Bereich
- Wochenziel

Rechts:

- Insights & Empfehlungen
- Engpass-Heatmap
- auffällige Stationen

Unten:

- Durchlaufzeiten nach Auftragstyp
- Reklamationsursachen
- wiederkehrende Engpässe
- Verbesserungsmaßnahmen

### Heatmap in Performance

Die Heatmap aus „Verzug & Engpässe“ soll zusätzlich analytisch in „Performance“ erscheinen.

Unterschied:

- Verzug & Engpässe = jetzt handeln
- Performance = Muster erkennen

Beispiel:

```text
Stations-Heatmap diese Woche

Schleiferei / Politur      95 %   Kritisch
Galvanik / Bäder           85 %   Hoch
Wareneingang / Prüfung     60 %   Stabil
Endkontrolle               35 %   Frei
Versand                    40 %   Stabil
```

### Keine unnötige Legende

Nicht schreiben: „Rot bedeutet Überlastung.“

Stattdessen direkt:

- „Schleiferei kritisch: 8 wartende Teile“
- „Galvanik hoch: 3 Aufträge morgen fällig“
- „Endkontrolle frei: 1 Teil wartet“

---

## Komponenten

### StatusBadge

Zeigt Status mit Farbe, Symbol und Text.

### PriorityCard

Auftragskarte mit starkem Statusfokus.

### StationHeatmap

Stationsauslastung als farbliche Karten/Matrix.

### ActionButton

Button für nächste sinnvolle Handlung.

### EventTimeline

Zeitleiste im Auftrag/Teil.

### CustomerFilePanel

Kundenakte rechts.

### ScanWizard

Mehrstufiger Wareneingangsassistent.

### PerformanceKpiCard

KPI-Karte mit großem Wert, Zielwert und Trend.

---

## Mikrointeraktionen

Die App darf leicht spielerisch sein, aber nicht albern.

Erlaubt:

- sanfte Hover-Effekte,
- kleine Fortschrittsringe,
- dezente Animation bei Statuswechsel,
- pulsierender Rand bei kritischem Verzug,
- Fortschrittsbalken,
- Level/Score nur in Performance, nicht in operativer Tagesarbeit übertreiben.

Nicht erlaubt:

- übertriebene Animationen,
- Glitzer,
- zu viel Gold,
- überladene Icons,
- visuelles Bling-Bling,
- unruhige Farbflächen.

---

## Typografie

- Überschriften groß und klar.
- Zahlen sehr groß.
- Status klein, aber fett/kontrastreich.
- Detailtexte kleiner und ruhiger.
- Keine verschnörkelte Schrift für Arbeitsdaten.

---

## Leerzustände

Leere Bereiche sollen nützlich sein.

Beispiele:

- „Kein Auftrag ausgewählt. Wähle links einen Auftrag, um Teile, Fotos und Steuerung zu sehen.“
- „Keine kritischen Engpässe. Alle Stationen im Plan.“
- „Noch keine Kundenakte vorhanden. Ersten Auftrag erfassen.“

---

## Responsive Verhalten

### Desktop/großer Bildschirm

- Sidebar links
- Inhalt Mitte
- Detailpanel rechts

### Tablet quer

- kompakte Sidebar
- Kartenliste groß
- Detailpanel optional als Drawer

### Tablet hoch / Smartphone

- Bottom Navigation oder Icon-Sidebar
- Detailansicht als eigene Seite
- keine zu kleinen Tabellen

---

## Finaler Anspruch

Die App soll beim ersten Blick vermitteln:

„Das ist ein professionelles Steuerungssystem für eine echte Werkstatt.“

Nicht:

„Das ist eine zufällig zusammengebaute Demo.“
