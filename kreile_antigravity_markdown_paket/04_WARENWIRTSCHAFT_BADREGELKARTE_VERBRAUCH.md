# Kreile WerkstattCockpit — Warenwirtschaft, Badregelkarte und Verbrauchsbuchung

## Ziel

Die App soll nicht nur Aufträge verwalten, sondern auch Verbrauch, Bestand und galvanische Prozesszustände sichtbar machen.

Dieser Teil ist essenziell, weil Material, Chemie, Bäder und Verbrauch in der Galvanik direkt auf Kosten, Qualität, Lieferfähigkeit und Nachkalkulation wirken.

## Module

1. Warenwirtschaft
2. Verbrauchsbuchung im Auftrag
3. Badregelkarte
4. Warnungen und Statuslogik
5. Performance-Verknüpfung

## 1. Warenwirtschaft

### Zweck

Die Warenwirtschaft soll beantworten:

- Was ist vorhanden?
- Wo liegt es?
- Was wurde verbraucht?
- Was muss nachbestellt werden?
- Welcher Auftrag hat welchen Verbrauch verursacht?

### Artikelklassen

```text
Chemie
Verbrauchsmaterial
Werkzeuge / Hilfsmittel
Verpackung
Ersatzteile
Sonstiges
```

### Beispiele

| Kategorie | Beispiele |
|---|---|
| Chemie | Nickelzusatz, Entfetter, Säure, Glanzzusatz |
| Verbrauchsmaterial | Schleifpapier, Bürsten, Polierscheiben, Draht |
| Werkzeug/Hilfsmittel | Aufhängungen, Halter, Kontaktierungen |
| Verpackung | Kartons, Folie, Schutzmaterial |
| Zeitverbrauch | Lötzeit, Polierzeit, Schleifzeit |

## Lagerorte

```ts
type StorageLocation = {
  id: string;
  name: string;
  type: "shelf" | "cabinet" | "bath_area" | "chemical_storage" | "workbench" | "other";
  parentLocationId?: string;
  notes?: string;
};
```

Beispiele:

```text
Chemielager Regal A
Schleiferei Schrank 2
Wareneingang Zwischenlager
Galvanik Badbereich
Verpackung Warenausgang
```

## Ein- und Ausbuchung

### Stock In

- Lieferung erhalten.
- Menge eingeben oder scannen.
- Lieferant optional.
- Charge optional.
- Mindestbestand prüfen.

### Stock Out / Consumption

- Verbrauch im Auftrag.
- Verbrauch in Badpflege.
- Korrektur durch Inventur.
- Ausschuss/Entsorgung.

### Bewegungslogik

Jede Lageränderung erzeugt `StockMovement`.

Keine direkte Änderung des Bestands ohne Bewegungsprotokoll.

## UI Warenwirtschaft

### Lagerseite

Oben:

- Suche,
- Filter: Chemie, Verbrauch, Verpackung, kritisch,
- Button: Bestand einbuchen,
- Button: Inventur/Korrektur.

Karten:

```text
Nickelzusatz Typ X
Bestand: 4.5 l
Mindestbestand: 3.0 l
Lagerort: Chemielager A
Status: stabil
```

Kritisch:

```text
Schleifpapier P320
Bestand: 12 Stück
Mindestbestand: 25 Stück
Nächste Aktion: Nachbestellen prüfen
```

## 2. Verbrauchsbuchung im Auftrag

### Ort im UI

Im Auftragdetail gibt es einen klaren Button:

```text
Verbrauch hinzufügen
```

Darunter oder im Drawer:

- Material auswählen,
- Menge per Slider/Stepper,
- Arbeitszeit per Slider/Timer,
- Station auswählen oder automatisch aus aktuellem Auftrag übernehmen,
- speichern.

## Haptik

Der Nutzer soll nicht lange tippen.

### Eingabeformen

| Eingabe | Nutzung |
|---|---|
| Slider | grobe Arbeitszeit, Verbrauchseinheiten |
| Stepper + / - | Stückzahlen |
| Schnellchips | häufige Verbrauchsmengen |
| Scan | Artikel per QR/Barcode |
| Preset | wiederkehrende Arbeitspakete |

### Beispiel

```text
Verbrauch hinzufügen

Station: Schleiferei
Auftrag: A-2026-0042

[Schleifpapier P240]   Menge: 3 Stück  [-] [---Slider---] [+]
[Arbeitszeit]          45 Minuten      [-] [---Slider---] [+]
[Polierscheibe]        1 Stück         [-] [---Slider---] [+]

[Speichern]
```

## Verbrauchs-Presets

Für häufige Arbeiten sollen Presets möglich sein.

Beispiel:

```text
Preset: Stoßstange stark angelaufen
- Schleifpapier P240: 4 Stück
- Schleifpapier P400: 3 Stück
- Polierscheibe: 1 Stück
- Arbeitszeit Schleiferei: 90 Minuten
```

Diese Werte sind Vorschläge und müssen editierbar bleiben.

## 3. Badregelkarte

### Zweck

Die Badregelkarte ist das digitale Pendant zur chemischen/prozesstechnischen Kontrollkarte.

Sie zeigt pro Bad:

- aktueller Zustand,
- Messwerte,
- Grenzwerte,
- letzte Analyse,
- nächste Prüfung,
- Dosierungen,
- Sperrungen,
- betroffene Aufträge.

## Badübersicht

```text
Galvanische Bäder

[Nickelbad 1]     Stabil       54 °C · pH 4.1
[Chrombad 1]      Beobachten   Analyse fällig
[Entfettung 2]    Kritisch     Temperatur zu niedrig
[Entmetallisierung] Stabil     3 aktive Teile
```

## Badkarte Detail

```text
Nickelbad 1
Status: Beobachten

Aktuelle Werte
Temperatur: 54 °C       Ziel: 52–58 °C
pH: 4.1                 Ziel: 3.8–4.5
Konzentration: 92 %      Ziel: 90–105 %

Letzte Messung: Heute 09:12
Nächste Messung: Heute 15:00

Nächste Aktion:
Glanzzusatz prüfen

[Messung eintragen] [Dosierung buchen] [Bad sperren]
```

## Messwertlogik

```ts
function computeBathStatus(measurement: BathMeasurement, target: BathTargetValues) {
  if (measurement.temperature && target.temperatureMin && measurement.temperature < target.temperatureMin) return "critical";
  if (measurement.temperature && target.temperatureMax && measurement.temperature > target.temperatureMax) return "critical";
  if (measurement.ph && target.phMin && measurement.ph < target.phMin) return "watch";
  if (measurement.ph && target.phMax && measurement.ph > target.phMax) return "watch";
  return "stable";
}
```

Die echte Fachlogik muss später von Kreile/Meister angepasst werden.

## Bad und Auftrag verknüpfen

Wenn ein Auftrag in einer Badstation gestartet wird, kann optional ein Bad gewählt werden:

```text
Auftrag A-2026-0042
Station: Veredelung / Galvanik
Bad: Nickelbad 1
```

Dadurch entstehen spätere Analysen:

- welche Aufträge liefen durch welches Bad,
- ob Reklamationen mit bestimmten Bädern korrelieren,
- ob Badzustand Durchlaufzeiten beeinflusst,
- welche Chemie pro Auftrag verbraucht wurde.

## Warnungen

### Warenwirtschaft

Warnungen bei:

- Bestand unter Mindestbestand,
- Lagerartikel ohne Lagerort,
- negative Bestände,
- ungewöhnlich hoher Verbrauch,
- fehlender Buchungsgrund bei Korrektur.

### Badregelkarte

Warnungen bei:

- Messwert außerhalb Zielbereich,
- Analyse überfällig,
- Bad gesperrt,
- Dosierung überfällig,
- kritisches Bad mit aktiven Aufträgen.

## Stationsbutton-Farben

Der Werkstattfluss-Button „Lager“ wird farbig, wenn:

- Material fehlt,
- Mindestbestand unterschritten,
- Einbuchung ungeprüft,
- Lagerbewegung fehlerhaft.

Der Werkstattfluss-Button „Galvanik“ wird farbig, wenn:

- Bad kritisch,
- Analyse überfällig,
- Bad gesperrt,
- Auftrag wartet wegen Badzustand.

## Performance-Verknüpfung

Performance soll zeigen:

- Verbrauch pro Auftragstyp,
- Materialkosten pro Station,
- Bestandskritikalität,
- Badstabilität pro Woche,
- Messdisziplin,
- Zusammenhang Badzustand/Reklamation,
- Zeitverbrauch je Arbeitstyp.

## Komponenten

```text
src/components/inventory/InventoryDashboard.tsx
src/components/inventory/InventoryItemCard.tsx
src/components/inventory/StockMovementDrawer.tsx
src/components/consumption/AddConsumableUseDrawer.tsx
src/components/consumption/WorkTimeSlider.tsx
src/components/consumption/ConsumableSlider.tsx
src/components/baths/BathDashboard.tsx
src/components/baths/BathCard.tsx
src/components/baths/BathDetailPanel.tsx
src/components/baths/BathMeasurementForm.tsx
src/components/baths/BathAdditionForm.tsx
src/lib/inventory/stock.ts
src/lib/baths/bathStatus.ts
```

## Akzeptanzkriterien

- Lager ist als echte Funktion vorhanden, nicht nur Button.
- Bestände können ein- und ausgebucht werden.
- Verbrauch kann aus dem Auftragdetail gebucht werden.
- Arbeitszeit kann per Slider/Stepper erfasst werden.
- Badregelkarte zeigt Zustand, Messwerte, Grenzwerte und nächste Aktion.
- Kritische Lager-/Badzustände färben Werkstattfluss-Buttons.
- Alle Bewegungen werden protokolliert.
